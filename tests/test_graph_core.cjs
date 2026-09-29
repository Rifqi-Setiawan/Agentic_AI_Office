// Runs against real TypeScript-compiled pure modules; no React mocks or type stubs.
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { AGENTS, CARD_WIDTH: W, CARD_HEIGHT: H, ROUTES, routePoints, roundedPath,
  activePairs, adjacentPairs, pairKey, cleanText, agentStatus } = require(path.join(process.env.MC_CORE_BUILD, 'graphModel.js'))
const { decodeSnapshot, canReplace } = require(path.join(process.env.MC_CORE_BUILD, 'executionProtocol.js'))
const sample = JSON.parse(fs.readFileSync(path.join(__dirname, '../qa/snapshot.example.json'), 'utf8'))
const clone = value => JSON.parse(JSON.stringify(value))
const segments = points => points.slice(1).map((point, index) => [points[index], point]).filter(([a,b]) => a.x !== b.x || a.y !== b.y)
function intersects(a, b, c, d) {
  const min = Math.min, max = Math.max
  if (a.x === b.x && c.x === d.x) return a.x === c.x && max(min(a.y,b.y), min(c.y,d.y)) <= min(max(a.y,b.y), max(c.y,d.y))
  if (a.y === b.y && c.y === d.y) return a.y === c.y && max(min(a.x,b.x), min(c.x,d.x)) <= min(max(a.x,b.x), max(c.x,d.x))
  if (a.x === b.x) return a.x >= min(c.x,d.x) && a.x <= max(c.x,d.x) && c.y >= min(a.y,b.y) && c.y <= max(a.y,b.y)
  return intersects(c,d,a,b)
}
test('official roster is 14 nodes = 13 AI + 1 human, with 13 tree edges', () => {
  assert.equal(AGENTS.length, 14); assert.equal(ROUTES.length, 13)
  assert.equal(new Set(AGENTS.map(a => a.id)).size, 14)
})
test('every card rectangle is disjoint with a positive gutter', () => {
  for (let i = 0; i < AGENTS.length; i++) for (let j = i+1; j < AGENTS.length; j++) {
    const a=AGENTS[i], b=AGENTS[j]
    const overlap = a.position.x < b.position.x+W+16 && a.position.x+W+16 > b.position.x && a.position.y < b.position.y+H+16 && a.position.y+H+16 > b.position.y
    assert.equal(overlap, false, `${a.id} overlaps ${b.id}`)
  }
})
test('every route is orthogonal and never penetrates another card, with 8px clearance', () => {
  for (const route of ROUTES) for (const [a,b] of segments(routePoints(route))) {
    assert.ok(a.x === b.x || a.y === b.y)
    for (const card of AGENTS.filter(card => card.id !== route.source && card.id !== route.target)) {
      const x=card.position.x-8,y=card.position.y-8,r=x+W+16,bottom=y+H+16
      const hit = a.x === b.x ? a.x > x && a.x < r && Math.max(a.y,b.y) > y && Math.min(a.y,b.y) < bottom : a.y > y && a.y < bottom && Math.max(a.x,b.x)>x && Math.min(a.x,b.x)<r
      assert.equal(hit,false,`${route.source}->${route.target} clips ${card.id}`)
    }
  }
})
test('no tree-edge crossing or shared overlapping segment', () => {
  for (let i=0;i<ROUTES.length;i++) for (let j=i+1;j<ROUTES.length;j++) {
    for (const [a,b] of segments(routePoints(ROUTES[i]))) for (const [c,d] of segments(routePoints(ROUTES[j]))) {
      assert.equal(intersects(a,b,c,d),false,`Edge ${i} crosses edge ${j}`)
    }
  }
})
test('rounded routing is finite and emits explicit curve corners', () => {
  for(const route of ROUTES){ const svg=roundedPath(routePoints(route)); assert.ok(svg.startsWith('M ')); assert.ok(!svg.includes('NaN')) }
  assert.ok(roundedPath([{x:0,y:0},{x:0,y:40},{x:40,y:40}]).includes(' Q '))
})
test('non-adjacent membership cannot activate a skipped edge', () => {
  const pairs=adjacentPairs(['rifqi','jarvis','swe-backend','swe-verifier'])
  assert.ok(pairs.has('jarvis->swe-backend'))
  assert.ok(!pairs.has('rifqi->swe-backend'))
  assert.ok(!pairs.has('jarvis->swe-verifier'))
})
test('canonical aliases do not create duplicate graph identities', () => {
  assert.ok(adjacentPairs(['swe-backend','swe-QA']).has('swe-backend->swe-verifier'))
})
test('backend-produced snapshot validates and lights precisely its three edges', () => {
  const parsed=decodeSnapshot(sample)
  assert.deepEqual([...activePairs(parsed,0).keys()].sort(), ['rifqi->jarvis','jarvis->swe-backend','swe-backend->swe-verifier'].sort())
})
test('disconnected stale snapshot fails closed', () => {
  const parsed=decodeSnapshot(sample)
  assert.equal(activePairs(parsed,parsed.freshness_ttl_ms).size,0)
  assert.equal(activePairs(null,0).size,0)
})
test('lease expiration hides only its pair, even if SSE remains connected', () => {
  const parsed=decodeSnapshot(sample)
  parsed.caller_callee_pairs[0].invocations[0].expires_at_ms=parsed.generated_at_ms+50
  assert.equal(activePairs(parsed,100).size,2)
})
test('mission filtering cannot concatenate unrelated missions', () => {
  const parsed=decodeSnapshot(sample)
  assert.equal(activePairs(parsed,0,'other-mission').size,0)
  assert.equal(activePairs(parsed,0,'mission-1').size,3)
})
test('one completed invocation does not extinguish another in the same pair', () => {
  const parsed=decodeSnapshot(sample), pair=parsed.caller_callee_pairs[0]
  pair.invocations.push({...pair.invocations[0],span_id:'other-span',expires_at_ms:parsed.generated_at_ms+20000})
  pair.invocations[0].expires_at_ms=parsed.generated_at_ms
  assert.equal(activePairs(parsed,0).get(pairKey(pair.caller,pair.callee)).invocations.length,1)
})
test('unknown schema or agent is rejected rather than guessed', () => {
  const future=clone(sample);future.schema_version=2;assert.throws(()=>decodeSnapshot(future))
  const unknown=clone(sample);unknown.caller_callee_pairs[0].caller='ghost';assert.throws(()=>decodeSnapshot(unknown))
})
test('chain and pair inconsistency is rejected', () => {
  const bad=clone(sample);bad.active_delegation_chains[0].active_delegation_path[1]='senku';assert.throws(()=>decodeSnapshot(bad))
  const orphan=clone(sample);orphan.active_delegation_chains=[];assert.throws(()=>decodeSnapshot(orphan))
})
test('duplicate span and unreasonable payload sizes are rejected', () => {
  const duplicate=clone(sample);duplicate.caller_callee_pairs[0].invocations.push(duplicate.caller_callee_pairs[0].invocations[0]);assert.throws(()=>decodeSnapshot(duplicate))
  const huge=clone(sample);huge.freshness_ttl_ms=600000;assert.throws(()=>decodeSnapshot(huge))
  const invalidId=clone(sample);invalidId.stream_id='invalid id';assert.throws(()=>decodeSnapshot(invalidId))
})
test('older snapshots cannot regress the same stream; a new DB epoch can reset sequence', () => {
  const parsed=decodeSnapshot(sample)
  assert.equal(canReplace(parsed,{...parsed,revision:parsed.revision-1}),false)
  assert.equal(canReplace(parsed,{...parsed,stream_id:'new-stream',revision:0}),true)
  assert.equal(canReplace(parsed,{...parsed,generated_at_ms:parsed.generated_at_ms-1}),false)
  assert.equal(canReplace(parsed,{...parsed}),false) // identical replay must not renew freshness
  assert.equal(canReplace(parsed,{...parsed,generated_at_ms:parsed.generated_at_ms+1}),true)
})
test('emoji are removed, and error/offline are not treated as working', () => {
  assert.equal(cleanText('Build \u{1F680} UI'),'Build  UI')
  assert.equal(agentStatus('FAILED').tone,'failed')
  assert.equal(agentStatus('offline').tone,'unknown')
  assert.equal(agentStatus(undefined).tone,'unknown')
})
