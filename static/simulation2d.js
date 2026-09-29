/**
 * Hermes Sovereign Stronghold — Hybrid 2.5D HD Matte Plate Edition
 * Pre-rendered 1672×941 architecture + dynamic lighting, particles and agents.
 */

(function() {
  'use strict';

  // --- Seeded PRNG & Perlin Noise Engine ---
  function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const Perlin = (() => {
    const p = new Uint8Array(512);
    const perm = [
      151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,
      140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,
      247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,
      57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,
      74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,
      60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,
      65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,
      200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,
      52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,
      207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,
      119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,
      129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,
      218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,
      81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,
      184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,
      222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
    ];
    for (let i = 0; i < 256; i++) p[i] = p[i + 256] = perm[i];

    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(a, b, t) { return a + t * (b - a); }
    function grad(hash, x, y) {
      const h = hash & 3;
      const u = h < 2 ? x : y;
      const v = h < 2 ? y : x;
      return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    }

    function noise2D(x, y) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      const u = fade(x), v = fade(y);
      const A = p[X] + Y, B = p[X + 1] + Y;
      return lerp(
        lerp(grad(p[A], x, y), grad(p[B], x - 1, y), u),
        lerp(grad(p[A + 1], x, y - 1), grad(p[B + 1], x - 1, y - 1), u),
        v
      );
    }

    function fbm(x, y, octaves = 4, persistence = 0.5) {
      let total = 0, frequency = 1, amplitude = 1, maxAmp = 0;
      for (let i = 0; i < octaves; i++) {
        total += noise2D(x * frequency, y * frequency) * amplitude;
        maxAmp += amplitude;
        amplitude *= persistence;
        frequency *= 2;
      }
      return total / maxAmp;
    }

    return { noise2D, fbm };
  })();

  function dist(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  // --- Stronghold Stations & Physical Coordinates ---
  const STATIONS = {
    briefing: {
      id: 'briefing',
      name: 'The Painted War Table',
      desc: 'Carved dragonstone war table with strategic relief map & 12 empty high-backed chairs',
      x: 836, y: 398, w: 240, h: 240,
      color: '#3b82f6',
      icon: '⚔️',
      terminalKey: 'ST_WAR_TABLE'
    },
    throne: {
      id: 'throne',
      name: 'The Iron Throne Dais',
      desc: 'Imposing throne of fused swords elevated atop stepped stone dais',
      x: 800, y: 110, w: 200, h: 120,
      color: '#f59e0b',
      icon: '👑',
      terminalKey: 'ST_THRONE'
    },
    library: {
      id: 'library',
      name: "The Grand Maester's Scriptorium",
      desc: 'Citadel library with astrolabe, scrolls & leather-bound tomes',
      x: 320, y: 240, w: 220, h: 160,
      color: '#8b5cf6',
      icon: '📜',
      terminalKey: 'ST_LIBRARY'
    },
    crawler: {
      id: 'crawler',
      name: 'The Alchemical Laboratory',
      desc: 'Bubbling emerald flasks, alembics & arcane scrying vials',
      x: 170, y: 340, w: 140, h: 140,
      color: '#10b981',
      icon: '🧪',
      terminalKey: 'ST_ALCHEMY'
    },
    compiler: {
      id: 'compiler',
      name: 'The Royal Forge & Anvils',
      desc: 'Blazing coal smelting hearth, dual heavy steel anvils & weapon toolracks',
      x: 1300, y: 220, w: 240, h: 160,
      color: '#ef4444',
      icon: '🔨',
      terminalKey: 'ST_FORGE'
    },
    guildhall: {
      id: 'guildhall',
      name: 'The Royal Engineering Guildhall',
      desc: 'Craftsmen workbenches with system blueprints, calipers & drafting tools',
      x: 1300, y: 400, w: 240, h: 170,
      color: '#38bdf8',
      icon: '📐',
      terminalKey: 'ST_GUILDHALL'
    },
    quarantine: {
      id: 'quarantine',
      name: 'Armor Inspection Sentry Rack',
      desc: 'Articulated armor stands & static security analysis sentry',
      x: 1450, y: 440, w: 140, h: 120,
      color: '#34d399',
      icon: '🛡️',
      terminalKey: 'ST_ARMOR_RACK'
    },
    pantry: {
      id: 'pantry',
      name: 'Great Banquet Hall & Ale Bar',
      desc: 'Tavern casks of mead, wine bottles & roasted trenchers',
      x: 1100, y: 740, w: 220, h: 150,
      color: '#d97706',
      icon: '🍗',
      terminalKey: 'ST_ALE_BAR'
    },
    lakehouse: {
      id: 'lakehouse',
      name: 'Subterranean Dragon Cistern',
      desc: 'Water reservoir feeding lakehouse conduits with golden duck mascot',
      x: 280, y: 740, w: 180, h: 150,
      color: '#0284c7',
      icon: '🦆',
      terminalKey: 'ST_CISTERN'
    },
    hearth: {
      id: 'hearth',
      name: 'Great Stag Hearth Fireplace',
      desc: 'Roaring log fire under the mounted great horned stag skull with bearskin rug',
      x: 800, y: 620, w: 180, h: 90,
      color: '#f97316',
      icon: '🔥',
      terminalKey: 'ST_STAG_HEARTH'
    }
  };

  // --- 13 AI Agent Roster grouped logically into 4 rooms (Central table is EMPTY!) ---
  const AGENTS_ROSTER = [
    // 1. NORTH THRONE ROOM (Lord Commander)
    {
      id: 'jarvis',
      name: 'Jarvis',
      alias: 'jarvis',
      title: 'Lord Commander & Chief Orchestrator',
      accentColor: '#f59e0b',
      hairColor: '#0f172a',
      desk: { x: 836, y: 120 },
      aisleKey: 'AE_BOSS',
      room: 'North Throne Dais',
      bubble: 'Reigning from the Iron Throne',
      type: 'boss'
    },

    // 2. WEST WING: CITADEL SCRIPTORIUM & ALCHEMICAL LAB (Research & Paper Scribe)
    {
      id: 'senku',
      name: 'Senku',
      alias: 'senku',
      title: 'Grand Maester of Research',
      accentColor: '#ec4899',
      hairColor: '#831843',
      desk: { x: 215, y: 320 },
      aisleKey: 'AE_PROFESSOR',
      room: 'Citadel Scriptorium',
      bubble: 'Consulting celestial astrolabe & ancient tomes'
    },
    {
      id: 'paperwright',
      name: 'paperwright',
      title: 'Citadel Scribe & Typesetter',
      accentColor: '#e11d48',
      hairColor: '#4c0519',
      desk: { x: 395, y: 320 },
      aisleKey: 'AE_PAPERWRIGHT',
      room: 'Citadel Scriptorium',
      bubble: 'Illuminating manuscripts & LaTeX scrolls'
    },

    // 3. EAST WING: ROYAL ENGINEERING GUILDHALL & FORGE (6 Agents)
    {
      id: 'chief-architect',
      name: 'chief-architect',
      title: 'Grand Strategist of Systems',
      accentColor: '#38bdf8',
      hairColor: '#1e293b',
      desk: { x: 1270, y: 460 },
      aisleKey: 'AE_ARCHITECT',
      room: 'Engineering Guildhall',
      bubble: 'Drafting architectural system blueprints'
    },
    {
      id: 'swe-backend',
      name: 'swe-backend',
      title: 'Master of Server Strongholds',
      accentColor: '#10b981',
      hairColor: '#064e3b',
      desk: { x: 1500, y: 348 },
      aisleKey: 'AE_BACKEND',
      room: 'Engineering Guildhall',
      bubble: 'Hardening ACID database transaction logic'
    },
    {
      id: 'swe-frontend',
      name: 'swe-frontend',
      title: 'Royal Visual Artisan',
      accentColor: '#06b6d4',
      hairColor: '#083344',
      desk: { x: 1365, y: 460 },
      aisleKey: 'AE_FRONTEND',
      room: 'Engineering Guildhall',
      bubble: 'Polishing responsive canvas UI components'
    },
    {
      id: 'swe-verifier',
      name: 'swe-QA',
      alias: 'swe-verifier',
      title: 'High Sentry of Verification',
      accentColor: '#34d399',
      hairColor: '#022c22',
      desk: { x: 1460, y: 460 },
      aisleKey: 'AE_VERIFIER',
      room: 'Armor Inspection Cleanroom',
      bubble: 'Conducting zero-tolerance QA invariant audit'
    },
    {
      id: 'github-manager',
      name: 'github-manager',
      title: 'Quartermaster of Git & Releases',
      accentColor: '#8b5cf6',
      hairColor: '#2e1065',
      desk: { x: 1555, y: 460 },
      aisleKey: 'AE_GITHUB',
      room: 'Royal Armory & Quartermaster',
      bubble: 'Locking release tags & branch cleanliness'
    },
    {
      id: 'devops-engineer',
      name: 'devops-engineer',
      title: 'Master Blacksmith & SRE',
      accentColor: '#f97316',
      hairColor: '#431407',
      desk: { x: 1350, y: 348 },
      aisleKey: 'AE_DEVOPS',
      room: 'Royal Smelting Forge',
      bubble: 'Striking anvil & fueling container hearth'
    },

    // 4. SOUTH WING: GREAT HEARTH FEAST HALL & DRAGON CISTERN (4 Agents)
    {
      id: 'tech-mentor',
      name: 'tech-mentor',
      title: 'Wise Mentor of the Great Hall',
      accentColor: '#14b8a6',
      hairColor: '#042f2e',
      desk: { x: 836, y: 680 },
      aisleKey: 'AE_MENTOR',
      room: 'Great Stag Hearth Lounge',
      bubble: 'Counseling engineers beside the stag hearth'
    },
    {
      id: 'ui-designer',
      name: 'ui-designer',
      title: 'Royal Tapestry & Experience Artisan',
      accentColor: '#d946ef',
      hairColor: '#4a044e',
      desk: { x: 995, y: 730 },
      aisleKey: 'AE_DESIGNER',
      room: 'Grand Feast & Design Hall',
      bubble: 'Balancing visual aesthetic & color palette'
    },
    {
      id: 'data-engineer',
      name: 'data-engineer',
      title: 'Keeper of the Dragon Cistern',
      accentColor: '#0284c7',
      hairColor: '#082f49',
      desk: { x: 1110, y: 740 },
      aisleKey: 'AE_DATAENG',
      room: 'Subterranean Dragon Cistern',
      bubble: 'Directing Medallion DuckDB pipeline channels'
    },
    {
      id: 'vps-assistant',
      name: 'vps-assistant',
      title: 'Castellan of Logistics & Larder',
      accentColor: '#a855f7',
      hairColor: '#3b0764',
      desk: { x: 1260, y: 720 },
      aisleKey: 'AE_ASSISTANT',
      room: 'Tavern Supply Bar',
      bubble: 'Triaging orders & managing stronghold supplies'
    },
    {
      id: 'office-lead',
      name: 'office-lead',
      alias: 'office-lead',
      title: 'Grand Architect of Virtual Strongholds',
      accentColor: '#6366f1',
      hairColor: '#312e81',
      desk: { x: 545, y: 730 },
      aisleKey: 'AE_OFFICELEAD',
      room: 'Observatory & Graphics Deck',
      bubble: 'Rendering procedural stronghold canvas & WebGL'
    }
  ];

  // Generous Hit Detection covering enlarged name tag, hair, body, and feet
  function isAgentHit(a, mx, my) {
    const inBox = (mx >= a.x - 52 && mx <= a.x + 52 && my >= a.y - 70 && my <= a.y + 26);
    const inRadius = Math.hypot(a.x - mx, a.y - my) < 46;
    return inBox || inRadius;
  }

  // --- A* topology aligned to the HD matte plate; paths stay outside the table/hearth. ---
  const WAYPOINTS = {
    'ST_THRONE':       { x: 836, y: 120, neighbors: ['W_THRONE_EXIT'] },
    'AE_BOSS':         { x: 836, y: 165, neighbors: ['W_THRONE_EXIT'] },
    'W_THRONE_EXIT':   { x: 836, y: 225, neighbors: ['ST_THRONE', 'AE_BOSS', 'C_NORTH_HALL'] },
    'C_NORTH_HALL':    { x: 836, y: 245, neighbors: ['W_THRONE_EXIT', 'ST_WAR_NORTH', 'DR_WEST', 'DR_EAST'] },

    // Explicit room thresholds requested for zero-clipping.
    'DR_WEST':         { x: 545, y: 360, neighbors: ['C_NORTH_HALL', 'W_LIB_EAST', 'C_WEST_BREEZEWAY'] },
    'DR_EAST':         { x: 1150, y: 410, neighbors: ['C_NORTH_HALL', 'W_GUILD_WEST', 'C_EAST_BREEZEWAY'] },

    'W_LIB_EAST':      { x: 490, y: 360, neighbors: ['DR_WEST', 'ST_LIBRARY', 'ST_ALCHEMY'] },
    'ST_LIBRARY':      { x: 330, y: 370, neighbors: ['W_LIB_EAST', 'AE_PROFESSOR', 'AE_PAPERWRIGHT', 'ST_ALCHEMY'] },
    'AE_PROFESSOR':    { x: 215, y: 350, neighbors: ['ST_LIBRARY'] },
    'AE_PAPERWRIGHT':  { x: 395, y: 350, neighbors: ['ST_LIBRARY'] },
    'ST_ALCHEMY':      { x: 225, y: 500, neighbors: ['ST_LIBRARY', 'W_LIB_EAST'] },

    'W_GUILD_WEST':    { x: 1190, y: 410, neighbors: ['DR_EAST', 'ST_FORGE', 'ST_GUILDHALL'] },
    'ST_FORGE':        { x: 1425, y: 390, neighbors: ['W_GUILD_WEST', 'AE_DEVOPS', 'AE_BACKEND'] },
    'AE_DEVOPS':       { x: 1350, y: 390, neighbors: ['ST_FORGE'] },
    'AE_BACKEND':      { x: 1500, y: 390, neighbors: ['ST_FORGE'] },
    'ST_GUILDHALL':    { x: 1410, y: 510, neighbors: ['W_GUILD_WEST', 'AE_ARCHITECT', 'AE_FRONTEND', 'AE_VERIFIER', 'AE_GITHUB', 'ST_ARMOR_RACK'] },
    'AE_ARCHITECT':    { x: 1270, y: 500, neighbors: ['ST_GUILDHALL'] },
    'AE_FRONTEND':     { x: 1365, y: 500, neighbors: ['ST_GUILDHALL'] },
    'AE_VERIFIER':     { x: 1460, y: 500, neighbors: ['ST_GUILDHALL'] },
    'AE_GITHUB':       { x: 1555, y: 500, neighbors: ['ST_GUILDHALL'] },
    'ST_ARMOR_RACK':   { x: 1550, y: 410, neighbors: ['ST_GUILDHALL'] },

    // Meeting terminals are opposite the table, never on its center/footprint.
    'ST_WAR_TABLE':    { x: 836, y: 290, neighbors: ['ST_WAR_NORTH'] },
    'ST_WAR_NORTH':    { x: 836, y: 290, neighbors: ['C_NORTH_HALL', 'ST_WAR_TABLE', 'ST_WAR_WEST', 'ST_WAR_EAST'] },
    'ST_WAR_WEST':     { x: 675, y: 398, neighbors: ['ST_WAR_NORTH', 'C_WEST_BREEZEWAY', 'C_SOUTH_WEST'] },
    'ST_WAR_EAST':     { x: 1000, y: 398, neighbors: ['ST_WAR_NORTH', 'C_EAST_BREEZEWAY', 'C_SOUTH_EAST'] },
    'ST_WAR_SOUTH':    { x: 836, y: 505, neighbors: ['C_SOUTH_WEST', 'C_SOUTH_EAST'] },

    'C_WEST_BREEZEWAY':{ x: 545, y: 500, neighbors: ['DR_WEST', 'ST_WAR_WEST', 'C_SW_DOOR'] },
    'C_EAST_BREEZEWAY':{ x: 1150, y: 500, neighbors: ['DR_EAST', 'ST_WAR_EAST', 'C_SE_DOOR'] },
    'C_SW_DOOR':       { x: 610, y: 585, neighbors: ['C_WEST_BREEZEWAY', 'C_SOUTH_WEST'] },
    'C_SE_DOOR':       { x: 1060, y: 585, neighbors: ['C_EAST_BREEZEWAY', 'C_SOUTH_EAST'] },
    // Twin southern corridors wrap the hearth at x=720 and x=950.
    'C_SOUTH_WEST':    { x: 720, y: 650, neighbors: ['C_SW_DOOR', 'ST_WAR_WEST', 'ST_WAR_SOUTH', 'C_SOUTH_HALL', 'AE_OFFICELEAD'] },
    'C_SOUTH_EAST':    { x: 950, y: 650, neighbors: ['C_SE_DOOR', 'ST_WAR_EAST', 'ST_WAR_SOUTH', 'C_SOUTH_HALL'] },
    'C_SOUTH_HALL':    { x: 950, y: 700, neighbors: ['C_SOUTH_WEST', 'C_SOUTH_EAST', 'ST_STAG_HEARTH', 'AE_MENTOR', 'AE_DESIGNER', 'ST_CISTERN', 'AE_DATAENG', 'ST_ALE_BAR', 'AE_ASSISTANT', 'AE_OFFICELEAD'] },
    'AE_OFFICELEAD':   { x: 545, y: 730, neighbors: ['C_SOUTH_WEST', 'C_SOUTH_HALL'] },
    'ST_STAG_HEARTH':  { x: 836, y: 680, neighbors: ['C_SOUTH_HALL', 'AE_MENTOR'] },
    'AE_MENTOR':       { x: 836, y: 680, neighbors: ['ST_STAG_HEARTH', 'C_SOUTH_HALL'] },
    'AE_DESIGNER':     { x: 995, y: 730, neighbors: ['C_SOUTH_HALL'] },
    'ST_CISTERN':      { x: 1110, y: 740, neighbors: ['C_SOUTH_HALL', 'AE_DATAENG'] },
    'AE_DATAENG':      { x: 1110, y: 740, neighbors: ['ST_CISTERN'] },
    'ST_ALE_BAR':      { x: 1260, y: 720, neighbors: ['C_SOUTH_HALL', 'AE_ASSISTANT'] },
    'AE_ASSISTANT':    { x: 1260, y: 720, neighbors: ['ST_ALE_BAR'] }
  };

  function aStarPath(startKey, endKey) {
    if (startKey === endKey) return [WAYPOINTS[endKey]];
    if (!WAYPOINTS[startKey] || !WAYPOINTS[endKey]) return [WAYPOINTS[endKey]];

    const openSet = [startKey];
    const cameFrom = {};
    const gScore = { [startKey]: 0 };
    const fScore = { [startKey]: dist(WAYPOINTS[startKey], WAYPOINTS[endKey]) };

    while (openSet.length > 0) {
      let current = openSet.reduce((a, b) => (fScore[a] < fScore[b] ? a : b));
      if (current === endKey) {
        const path = [WAYPOINTS[current]];
        while (cameFrom[current]) {
          current = cameFrom[current];
          path.unshift(WAYPOINTS[current]);
        }
        return path;
      }

      openSet.splice(openSet.indexOf(current), 1);
      const neighbors = WAYPOINTS[current].neighbors || [];

      for (const neighborKey of neighbors) {
        const neighbor = WAYPOINTS[neighborKey];
        if (!neighbor) continue;

        const tentativeGScore = gScore[current] + dist(WAYPOINTS[current], neighbor);
        if (tentativeGScore < (gScore[neighborKey] ?? Infinity)) {
          cameFrom[neighborKey] = current;
          gScore[neighborKey] = tentativeGScore;
          fScore[neighborKey] = tentativeGScore + dist(neighbor, WAYPOINTS[endKey]);

          if (!openSet.includes(neighborKey)) {
            openSet.push(neighborKey);
          }
        }
      }
    }

    return [WAYPOINTS[endKey]];
  }

  // Blade Polygon Generator for Iron Throne
  function generateBladePolygon(L, W, taper, curve) {
    const points = [];
    const N = 8;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y = t * L;
      const widthAtT = t < taper ? W : W * (1 - (t - taper) / (1 - taper));
      const curveOffset = curve * L * t * t;
      points.push({ x: widthAtT + curveOffset, y });
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N;
      const y = t * L;
      const widthAtT = t < taper ? W : W * (1 - (t - taper) / (1 - taper));
      points.push({ x: -widthAtT + curve * L * t * t, y });
    }
    return points;
  }

  // --- Main Stronghold Procedural Renderer Class ---
  class StrongholdProceduralRenderer {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas.getContext('2d');
      this.virtualWidth = 1672;
      this.virtualHeight = 941;

      this.tick = 0;
      this.fps = 60;
      this.lastFrameTime = performance.now();
      this.frameCount = 0;
      this.showWaypoints = false;
      this.selectedAgentId = null;

      // Orchestration State Machine
      this.activeSequence = null;
      this.executedConvoIds = new Set();
      this.lastTelemetryCheck = 0;

      // Offscreen Pre-baked Architectural Floor Canvas
      this.floorCanvas = document.createElement('canvas');
      this.floorCanvas.width = this.virtualWidth;
      this.floorCanvas.height = this.virtualHeight;
      this.floorCtx = this.floorCanvas.getContext('2d');

      // Offscreen Darkness & Lighting Buffer
      this.lightCanvas = document.createElement('canvas');
      this.lightCanvas.width = this.virtualWidth;
      this.lightCanvas.height = this.virtualHeight;
      this.lightCtx = this.lightCanvas.getContext('2d');

      // 120 Living Ember Spark Particles
      this.particles = [];

      this.initAgents();
      this.loadMattePlate();
      this.setupInteractions();
      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.startLoop();
    }

    resize() {
      if (!this.canvas) return;
      const parent = this.canvas.parentElement;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.displayWidth = parent ? parent.clientWidth : window.innerWidth;
      this.displayHeight = parent ? parent.clientHeight : window.innerHeight;
      this.canvas.width = this.displayWidth * dpr;
      this.canvas.height = this.displayHeight * dpr;

      this.scale = Math.min(
        this.canvas.width / this.virtualWidth,
        this.canvas.height / this.virtualHeight
      );
      this.offsetX = (this.canvas.width - this.virtualWidth * this.scale) / 2;
      this.offsetY = (this.canvas.height - this.virtualHeight * this.scale) / 2;
    }

    initAgents() {
      this.agents = AGENTS_ROSTER.map((a, idx) => ({
        ...a,
        x: a.desk.x,
        y: a.desk.y,
        deskX: a.desk.x,
        deskY: a.desk.y,
        state: 'IDLE_AT_DESK',
        facing: 'down',
        speed: 2.8,
        walkCycle: 0,
        bubbleText: a.bubble,
        bubbleTimer: (idx % 3 === 0) ? 600 : 0,
        pathQueue: [],
        currentWaypointIdx: 0,
        targetStation: null,
        onCompleteCallback: null,
        stepBadge: null,
        hasError: false
      }));
    }

    // Decode once, then bake the HD matte plate into the 1672×941 offscreen floor.
    loadMattePlate() {
      const ctx = this.floorCtx;
      ctx.fillStyle = '#080604';
      ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);
      this.backgroundReady = false;
      const matte = new Image();
      matte.decoding = 'async';
      matte.onload = () => {
        ctx.clearRect(0, 0, this.virtualWidth, this.virtualHeight);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(matte, 0, 0, this.virtualWidth, this.virtualHeight);
        this.backgroundReady = true;
      };
      matte.onerror = () => console.error('Failed to load HD stronghold matte plate: /assets/stronghold_map.jpg');
      matte.src = '/assets/stronghold_map.jpg';
      this.backgroundImage = matte;
    }

    // Helper: Soft Contact Shadow under objects
    drawContactShadow(ctx, x, y, w, h, blur = 4) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = blur;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 4;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }

    // --- 100% PURE PROCEDURAL ARCHITECTURE MATCHING img_60158fdf4126.jpg ---
    bakeProceduralArchitecture() {
      const ctx = this.floorCtx;
      const W = this.virtualWidth;
      const H = this.virtualHeight;

      // 1. Base Warm Mortar Bedding
      ctx.fillStyle = '#1c1712';
      ctx.fillRect(0, 0, W, H);

      // 2. FLOOR MATERIAL SYSTEM (Differentiated per room!)
      // South Hall: Warm Honey Oak Wood Planks
      this.renderWoodPlanks(ctx, 40, 600, W - 80, H - 640, true, '#6e4526', '#4e2d14');

      // West Library & Scriptorium: Polished Dark Scholar Oak Planks
      this.renderWoodPlanks(ctx, 40, 35, 480, 385, false, '#4a2f1c', '#331f11');

      // Center War Room & Throne Hall: Warm Sandstone Flagstones
      this.renderRichStoneTiles(ctx, 520, 35, 560, 565, 'sandstone');

      // East Forge & Guildhall: Heat-Darkened Ironstone Flagstones
      this.renderRichStoneTiles(ctx, 1080, 35, W - 1120, 565, 'ironstone');

      // 3. Ambient Occlusion Bands at Wall-Floor Junctions
      this.renderWallFloorAmbientOcclusion(ctx, W, H);

      // 4. Heraldic Sigil Rugs of the Great Houses
      this.renderHeraldicSigilRugs(ctx);

      // 5. Procedural Iron Throne on 5-Tier Dais with Stone Gargoyles & Candelabras
      this.renderProceduralIronThrone(ctx, 800, 110);

      // 6. Procedural 12-Sided Painted War Table with 12 EMPTY Chairs (0 idle agents!)
      this.renderProceduralWarTable(ctx, 800, 440, 130);

      // 7. 3D Thick Masonry Walls with Cut Stone Blocks & Archways
      this.renderDimensional3DMasonryWalls(ctx, W, H);

      // 8. Gothic Clustered Stone Pillars & Torch Braziers
      this.renderGothicPillars(ctx);

      // 9. Enriched Grouped Room Furnishings matching reference
      this.renderGroupedRoomFurnishings(ctx);
    }

    // --- A. Procedural Wood Planks with Grain & Knots ---
    renderWoodPlanks(ctx, bx, by, bw, bh, isHorizontal = true, baseCol = '#6e4526', darkCol = '#4e2d14') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, bw, bh);
      ctx.clip();

      const plankWidth = 20;
      const rng = mulberry32(bx * 17 + by * 31);

      if (isHorizontal) {
        for (let y = by; y < by + bh; y += plankWidth) {
          const noise = Perlin.noise2D(bx * 0.01, y * 0.05);
          ctx.fillStyle = baseCol;
          ctx.fillRect(bx, y, bw, plankWidth);

          ctx.strokeStyle = darkCol;
          ctx.lineWidth = 1;
          for (let g = 0; g < 3; g++) {
            const gy = y + 4 + g * 5;
            ctx.beginPath();
            ctx.moveTo(bx, gy);
            for (let x = bx; x < bx + bw; x += 40) {
              const wav = Math.sin((x + g * 30) * 0.03) * 1.5;
              ctx.lineTo(x, gy + wav);
            }
            ctx.stroke();
          }

          ctx.strokeStyle = '#18110b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx, y + plankWidth);
          ctx.lineTo(bx + bw, y + plankWidth);
          ctx.stroke();

          if (rng() < 0.15) {
            const kx = bx + rng() * bw;
            ctx.fillStyle = '#261408';
            ctx.beginPath();
            ctx.ellipse(kx, y + plankWidth / 2, 4, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        for (let x = bx; x < bx + bw; x += plankWidth) {
          ctx.fillStyle = baseCol;
          ctx.fillRect(x, by, plankWidth, bh);

          ctx.strokeStyle = darkCol;
          ctx.lineWidth = 1;
          for (let g = 0; g < 3; g++) {
            const gx = x + 4 + g * 5;
            ctx.beginPath();
            ctx.moveTo(gx, by);
            for (let y = by; y < by + bh; y += 40) {
              const wav = Math.sin((y + g * 30) * 0.03) * 1.5;
              ctx.lineTo(gx + wav, y);
            }
            ctx.stroke();
          }

          ctx.strokeStyle = '#18110b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x + plankWidth, by);
          ctx.lineTo(x + plankWidth, by + bh);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    // --- B. Rich Stone Tiles with Varied Color & Natural Weathering ---
    renderRichStoneTiles(ctx, bx, by, bw, bh, style = 'sandstone') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, bw, bh);
      ctx.clip();

      const rng = mulberry32(bx * 13 + by * 29);
      const tileW = 56;
      const tileH = 40;
      const mortar = 2.5;

      for (let y = by - tileH; y < by + bh + tileH; y += tileH + mortar) {
        const rowIdx = Math.floor((y - by) / (tileH + mortar));
        const xOffset = (rowIdx % 2) * (tileW / 2);

        for (let x = bx - tileW; x < bx + bw + tileW; x += tileW + mortar) {
          const rx = x + xOffset;
          const noiseVal = Perlin.fbm(rx * 0.006, y * 0.006, 3);

          let r, g, b;
          if (style === 'sandstone') {
            r = Math.floor(52 + noiseVal * 22 + rng() * 6);
            g = Math.floor(45 + noiseVal * 18 + rng() * 5);
            b = Math.floor(36 + noiseVal * 14 + rng() * 4);
          } else {
            r = Math.floor(44 + noiseVal * 18 + rng() * 5);
            g = Math.floor(38 + noiseVal * 14 + rng() * 4);
            b = Math.floor(34 + noiseVal * 12 + rng() * 4);
          }

          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(rx, y, tileW, tileH);

          // Top/Left Warm Sandstone Highlight Bevel
          ctx.strokeStyle = 'rgba(235, 220, 195, 0.12)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(rx, y + tileH);
          ctx.lineTo(rx, y);
          ctx.lineTo(rx + tileW, y);
          ctx.stroke();

          // Bottom/Right Dark Shadow Bevel
          ctx.strokeStyle = 'rgba(15, 12, 9, 0.55)';
          ctx.beginPath();
          ctx.moveTo(rx + tileW, y);
          ctx.lineTo(rx + tileW, y + tileH);
          ctx.lineTo(rx, y + tileH);
          ctx.stroke();

          if (rng() < 0.10) {
            ctx.strokeStyle = 'rgba(18, 14, 10, 0.65)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(rx + 8 + rng() * 20, y + 6 + rng() * 10);
            ctx.lineTo(rx + 22 + rng() * 15, y + 18 + rng() * 15);
            ctx.stroke();
          }
        }
      }

      ctx.restore();
    }

    // --- C. Ambient Occlusion Bands at Wall-Floor Junctions ---
    renderWallFloorAmbientOcclusion(ctx, W, H) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
      ctx.shadowBlur = 12;

      ctx.strokeRect(40, 35, W - 80, H - 70);

      [
        [40, 420, 520, 420],
        [520, 35, 520, 420],
        [1080, 420, W - 40, 420],
        [1080, 35, 1080, 420],
        [40, 600, W - 40, 600]
      ].forEach(seg => {
        ctx.beginPath();
        ctx.moveTo(seg[0], seg[1]);
        ctx.lineTo(seg[2], seg[3]);
        ctx.lineWidth = 16;
        ctx.stroke();
      });

      ctx.restore();
    }

    // --- D. 3D Thick Masonry Walls with Cut Stone Blocks ---
    renderDimensional3DMasonryWalls(ctx, W, H) {
      const renderMasonrySegment = (x, y, w, h, isHorizontal = true) => {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 5;
        ctx.fillRect(x, y, w, h);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#261f18';
        ctx.fillRect(x, y, w, h);

        const rng = mulberry32(x * 19 + y * 43);
        const blockW = isHorizontal ? 28 : w - 4;
        const blockH = isHorizontal ? h - 4 : 20;

        if (isHorizontal) {
          for (let bx = x + 2; bx < x + w - 2; bx += blockW + 2) {
            const bw = Math.min(blockW, (x + w - 2) - bx);
            const noise = Perlin.noise2D(bx * 0.02, y * 0.02);
            const r = Math.floor(48 + noise * 16 + rng() * 6);
            const g = Math.floor(42 + noise * 14 + rng() * 5);
            const b = Math.floor(34 + noise * 10 + rng() * 4);

            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(bx, y + 2, bw, h - 4);
            ctx.strokeStyle = 'rgba(235, 220, 190, 0.22)';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, y + 2, bw, h - 4);
          }
        } else {
          for (let by = y + 2; by < y + h - 2; by += blockH + 2) {
            const bh = Math.min(blockH, (y + h - 2) - by);
            const noise = Perlin.noise2D(x * 0.02, by * 0.02);
            const r = Math.floor(48 + noise * 16 + rng() * 6);
            const g = Math.floor(42 + noise * 14 + rng() * 5);
            const b = Math.floor(34 + noise * 10 + rng() * 4);

            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(x + 2, by, w - 4, bh);
            ctx.strokeStyle = 'rgba(235, 220, 190, 0.22)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 2, by, w - 4, bh);
          }
        }

        ctx.fillStyle = 'rgba(10, 8, 6, 0.45)';
        if (isHorizontal) {
          ctx.fillRect(x, y + h - 6, w, 6);
        } else {
          ctx.fillRect(x + w - 6, y, 6, h);
        }

        ctx.restore();
      };

      const wallThick = 26;

      // Outer Perimeter Curtain Walls
      renderMasonrySegment(30, 20, W - 60, wallThick, true);
      renderMasonrySegment(30, H - 35, W - 60, wallThick, true);
      renderMasonrySegment(30, 20, wallThick, H - 40, false);
      renderMasonrySegment(W - 45, 20, wallThick, H - 40, false);

      // Inner Room Partition Walls with Open Doorway Portals
      renderMasonrySegment(510, 20, wallThick, 290, false);
      renderMasonrySegment(510, 380, wallThick, 220, false);
      renderMasonrySegment(30, 410, 480, wallThick, true);

      renderMasonrySegment(1070, 20, wallThick, 290, false);
      renderMasonrySegment(1070, 380, wallThick, 220, false);
      renderMasonrySegment(1096, 410, W - 1126, wallThick, true);

      renderMasonrySegment(30, 590, 690, wallThick, true);
      renderMasonrySegment(880, 590, W - 910, wallThick, true);
    }

    // --- E. Heraldic Sigil Rugs of the Great Houses ---
    renderHeraldicSigilRugs(ctx) {
      // 1. House Baratheon Golden Stag Rug (Banquet & Lounge)
      this.drawRug(ctx, 800, 730, 280, 140, '#92400e', '#1c1917', () => {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(0, 10, 14, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        [-1, 1].forEach(side => {
          ctx.beginPath();
          ctx.moveTo(side * 6, -8);
          ctx.lineTo(side * 18, -26);
          ctx.lineTo(side * 28, -38);
          ctx.moveTo(side * 14, -18);
          ctx.lineTo(side * 24, -22);
          ctx.stroke();
        });
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-6, -12, 12, 4);
      });

      // 2. Twin Royal Wall Banners flanking Iron Throne (Crimson with Golden Stag)
      [670, 930].forEach(bx => {
        this.drawRug(ctx, bx, 110, 36, 95, '#881337', '#fbbf24', () => {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(0, -12, 8, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      // 3. Central Council Floor Rug under War Table
      this.drawRug(ctx, 800, 440, 360, 220, '#701a1a', '#d97706', () => {
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-165, -95, 330, 190);
      });

      // 4. Library Scholar Area Rug
      this.drawRug(ctx, 320, 250, 240, 120, '#2b3544', '#5a697d', null);
    }

    drawRug(ctx, cx, cy, w, h, baseCol, borderCol, sigilFn) {
      ctx.save();
      ctx.translate(cx, cy);

      this.drawContactShadow(ctx, -w / 2 + 3, -h / 2 + 3, w, h, 6);

      ctx.fillStyle = baseCol;
      ctx.fillRect(-w / 2, -h / 2, w, h);

      if (borderCol) {
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = 3;
        ctx.strokeRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16);

        ctx.fillStyle = borderCol;
        for (let tx = -w / 2 + 4; tx < w / 2 - 4; tx += 6) {
          ctx.fillRect(tx, -h / 2 - 3, 2.5, 3);
          ctx.fillRect(tx, h / 2, 2.5, 3);
        }
      }

      if (sigilFn) sigilFn();
      ctx.restore();
    }

    // --- F. Procedural Iron Throne on 5-Tier Stone Dais ---
    renderProceduralIronThrone(ctx, cx, cy) {
      ctx.save();
      ctx.translate(cx, cy);

      // 5-Tier Stepped Stone Dais
      for (let i = 4; i >= 0; i--) {
        const dw = 140 + i * 22;
        const dh = 16;
        const dy = 25 + (4 - i) * dh;

        const g = ctx.createLinearGradient(-dw / 2, dy, dw / 2, dy);
        g.addColorStop(0, '#2e2620');
        g.addColorStop(0.5, '#483c32');
        g.addColorStop(1, '#241e18');
        ctx.fillStyle = g;
        ctx.fillRect(-dw / 2, dy, dw, dh);

        ctx.strokeStyle = 'rgba(225, 205, 175, 0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-dw / 2, dy, dw, dh);
      }

      // Crimson Runner down the steps
      const cGrad = ctx.createLinearGradient(-26, 0, 26, 0);
      cGrad.addColorStop(0, '#881337');
      cGrad.addColorStop(0.5, '#b91c1c');
      cGrad.addColorStop(1, '#881337');
      ctx.fillStyle = cGrad;
      ctx.fillRect(-26, 25, 52, 80);

      // Two Stone Knight Sentinels flanking bottom stairs
      [-80, 80].forEach(sx => {
        ctx.fillStyle = '#44403c';
        ctx.beginPath();
        ctx.roundRect(sx - 10, 95, 20, 24, 3);
        ctx.fill();
        ctx.strokeStyle = '#a8a29e';
        ctx.stroke();
        ctx.fillStyle = '#78716c';
        ctx.beginPath(); ctx.arc(sx, 92, 7, 0, Math.PI * 2); ctx.fill();
      });

      // 160 Parametric Fused Blades (Iron Throne)
      const rng = mulberry32(777);
      const bladeCount = 160;

      for (let b = 0; b < bladeCount; b++) {
        const angle = (rng() - 0.5) * Math.PI * 1.35;
        const len = 40 + rng() * 75;
        const wid = 3 + rng() * 5;
        const curve = (rng() - 0.5) * 0.18;
        const poly = generateBladePolygon(len, wid, 0.25, curve);

        ctx.save();
        ctx.rotate(angle);
        ctx.translate(0, -len * 0.45);

        const mg = ctx.createLinearGradient(-wid, 0, wid, 0);
        mg.addColorStop(0.00, '#1c1917');
        mg.addColorStop(0.25, '#78716c');
        mg.addColorStop(0.48, '#44403c');
        mg.addColorStop(0.50, '#f5f5f4');
        mg.addColorStop(0.52, '#57534e');
        mg.addColorStop(0.80, '#a8a29e');
        mg.addColorStop(1.00, '#1c1917');

        ctx.beginPath();
        ctx.moveTo(poly[0].x, poly[0].y);
        poly.forEach(pt => ctx.lineTo(pt.x, pt.y));
        ctx.closePath();
        ctx.fillStyle = mg;
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
      }

      // Seat Cushion
      ctx.fillStyle = '#4c0519';
      ctx.beginPath();
      ctx.roundRect(-24, -12, 48, 32, 6);
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
    }

    // --- G. 12-Sided Painted War Table with 12 EMPTY Chairs (Zero Idle Agents!) ---
    renderProceduralWarTable(ctx, cx, cy, R) {
      ctx.save();
      ctx.translate(cx, cy);

      const drawDodecagon = (r) => {
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI / 6);
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      };

      // Table Cast Contact Shadow
      this.drawContactShadow(ctx, -R - 8, -R - 8, (R + 8) * 2, (R + 8) * 2, 10);

      // Carved Warm Walnut Table Surface
      const wg = ctx.createRadialGradient(0, 0, 10, 0, 0, R);
      wg.addColorStop(0, '#854d0e');
      wg.addColorStop(0.6, '#542608');
      wg.addColorStop(1, '#321404');
      ctx.fillStyle = wg;
      drawDodecagon(R);
      ctx.fill();

      // Beveled Edge with Brass Corner Studs
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 4;
      drawDodecagon(R);
      ctx.stroke();

      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = 1;
      drawDodecagon(R - 4);
      ctx.stroke();

      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI / 6);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * (R - 2), Math.sin(a) * (R - 2), 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Painted Relief Map of Westeros Topography
      ctx.save();
      drawDodecagon(R - 10);
      ctx.clip();

      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(-R, -R, R * 2, R * 2);

      // Landmass
      ctx.fillStyle = '#78716c';
      ctx.beginPath();
      ctx.moveTo(-60, -R + 10);
      ctx.bezierCurveTo(40, -80, 20, -20, 65, 0);
      ctx.bezierCurveTo(80, 40, -10, 70, -40, 100);
      ctx.bezierCurveTo(-80, 60, -70, -20, -60, -R + 10);
      ctx.fill();

      // Mountain contours
      ctx.strokeStyle = '#44403c';
      ctx.lineWidth = 1.5;
      for (let my = -60; my <= 60; my += 20) {
        ctx.beginPath();
        ctx.moveTo(-30, my);
        ctx.lineTo(0, my - 10);
        ctx.lineTo(30, my);
        ctx.stroke();
      }

      // Miniature wooden troop markers
      const markers = [
        [-25, -30, '#ef4444'], [15, -45, '#f59e0b'],
        [35, 10, '#10b981'], [-10, 40, '#06b6d4'],
        [20, 55, '#a855f7']
      ];
      markers.forEach(m => {
        ctx.fillStyle = m[2];
        ctx.beginPath();
        ctx.arc(m[0], m[1], 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      ctx.restore();

      // 12 High-Backed Carved Council Chairs (ALL EMPTY during idle!)
      for (let c = 0; c < 12; c++) {
        const ca = (c / 12) * Math.PI * 2 - Math.PI / 2;
        const cxp = Math.cos(ca) * (R + 26);
        const cyp = Math.sin(ca) * (R + 26);

        ctx.save();
        ctx.translate(cxp, cyp);
        ctx.rotate(ca + Math.PI / 2);

        this.drawContactShadow(ctx, -10, -8, 20, 16, 3);

        // Crimson velvet seat
        ctx.fillStyle = '#881337';
        ctx.beginPath();
        ctx.roundRect(-10, -8, 20, 16, 3);
        ctx.fill();

        // Carved Mahogany Backrest
        ctx.fillStyle = '#321404';
        ctx.fillRect(-12, 8, 24, 5);
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1;
        ctx.strokeRect(-12, 8, 24, 5);

        ctx.restore();
      }

      ctx.restore();
    }

    // --- H. Gothic Clustered Fluted Stone Pillars ---
    renderGothicPillars(ctx) {
      const pillarLocs = [
        [520, 200], [520, 400], [520, 600],
        [1080, 200], [1080, 400], [1080, 600],
        [680, 160], [920, 160]
      ];

      pillarLocs.forEach(pl => {
        const px = pl[0];
        const py = pl[1];

        this.drawContactShadow(ctx, px - 18, py - 18, 36, 36, 6);

        ctx.fillStyle = '#292524';
        ctx.beginPath();
        ctx.arc(px, py, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#57534e';
        ctx.lineWidth = 1;
        ctx.stroke();

        const pg = ctx.createRadialGradient(px - 4, py - 4, 2, px, py, 13);
        pg.addColorStop(0, '#a8a29e');
        pg.addColorStop(0.6, '#57534e');
        pg.addColorStop(1, '#1c1917');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(px, py, 12, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // --- I. Enriched Grouped Room Furnishings (4 Rooms) ---
    renderGroupedRoomFurnishings(ctx) {
      // =========================================================================
      // 1. WEST WING: CITADEL LIBRARY & ALCHEMICAL LAB (senku & paperwright)
      // =========================================================================
      // Bookcases along North & West walls
      ctx.fillStyle = '#3e2723';
      for (let by = 50; by <= 350; by += 45) {
        this.drawContactShadow(ctx, 45, by, 32, 38, 4);
        ctx.fillRect(45, by, 32, 38);
        ctx.strokeStyle = '#5d4037';
        ctx.lineWidth = 1;
        ctx.strokeRect(45, by, 32, 38);
        const bookCols = ['#b71c1c', '#1b5e20', '#0d47a1', '#f57f17'];
        for (let bk = 0; bk < 4; bk++) {
          ctx.fillStyle = bookCols[bk % 4];
          ctx.fillRect(48, by + 4 + bk * 8, 24, 6);
        }
      }

      // Rolling Ladder
      ctx.strokeStyle = '#a1887f';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(80, 80); ctx.lineTo(65, 200);
      ctx.moveTo(92, 80); ctx.lineTo(77, 200);
      for (let ly = 100; ly < 190; ly += 16) {
        ctx.moveTo(80 - (ly - 80) * 0.12, ly);
        ctx.lineTo(92 - (ly - 80) * 0.12, ly);
      }
      ctx.stroke();

      // Spiral Stone Staircase in NW corner
      ctx.fillStyle = '#292524';
      ctx.beginPath();
      ctx.arc(80, 80, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#78716c';
      ctx.stroke();

      // Desk 1: Professor's Scholar Study Desk (Left)
      this.drawContactShadow(ctx, 210, 210, 100, 48, 4);
      ctx.fillStyle = '#543019';
      ctx.beginPath();
      ctx.roundRect(210, 210, 100, 48, 4);
      ctx.fill();
      ctx.strokeStyle = '#8d6e63';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Astrolabe & Globe on Professor's Desk
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(235, 234, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.arc(295, 234, 7, 0, Math.PI * 2); ctx.fill();

      // Desk 2: Paperwright's Scribe Desk (Right)
      this.drawContactShadow(ctx, 340, 210, 100, 48, 4);
      ctx.fillStyle = '#4a2810';
      ctx.beginPath();
      ctx.roundRect(340, 210, 100, 48, 4);
      ctx.fill();
      ctx.strokeStyle = '#8d6e63';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Open Manuscripts & Inkpots
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(355, 222, 28, 18);
      ctx.fillStyle = '#0f172a';
      ctx.beginPath(); ctx.arc(415, 232, 4, 0, Math.PI * 2); ctx.fill();

      // Alchemy Reagent Bench (Station: crawler)
      this.drawContactShadow(ctx, 110, 320, 110, 50, 4);
      ctx.fillStyle = '#2d1b0e';
      ctx.fillRect(110, 320, 110, 50);
      ctx.strokeStyle = '#5d4037';
      ctx.strokeRect(110, 320, 110, 50);

      // Bubbling Green Wildfire Cauldron
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(165, 345, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(165, 345, 9, 0, Math.PI * 2);
      ctx.fill();

      // =========================================================================
      // 2. EAST WING: FORGE & GUILDHALL (devops, architect, swe-backend, etc.)
      // =========================================================================
      // Upper: Smelting Furnace & Chimney Hood
      ctx.fillStyle = '#3e2723';
      ctx.fillRect(1240, 55, 110, 75);
      ctx.strokeStyle = '#5d4037';
      ctx.strokeRect(1240, 55, 110, 75);

      // Water Quench Trough
      this.drawContactShadow(ctx, 1150, 170, 36, 60, 3);
      ctx.fillStyle = '#451a03';
      ctx.fillRect(1150, 170, 36, 60);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(1154, 174, 28, 52);

      // Dual Heavy Steel Anvils
      [1250, 1340].forEach(ax => {
        this.drawContactShadow(ctx, ax - 2, 230, 40, 22, 3);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(ax - 2, 230, 40, 22);
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.roundRect(ax, 232, 36, 18, 4);
        ctx.fill();
        ctx.strokeStyle = '#a8a29e';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Weapon Racks along East Wall
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(1460, 140, 20, 160);
      ctx.strokeStyle = '#a8a29e';
      for (let wy = 150; wy <= 280; wy += 20) {
        ctx.beginPath();
        ctx.moveTo(1455, wy); ctx.lineTo(1475, wy);
        ctx.stroke();
      }

      // Lower Guildhall: 4 Craftsmen Workbenches
      const benches = [
        [1160, 340, 'chief-architect (Table 1)'],
        [1290, 320, 'swe-backend (Table 2)'],
        [1160, 440, 'swe-frontend (Table 3)'],
        [1290, 440, 'swe-verifier (Table 4)']
      ];

      benches.forEach(b => {
        this.drawContactShadow(ctx, b[0], b[1], 80, 40, 3);
        ctx.fillStyle = '#543019';
        ctx.beginPath();
        ctx.roundRect(b[0], b[1], 80, 40, 3);
        ctx.fill();
        ctx.strokeStyle = '#8d6e63';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Blueprints & drafting instruments
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(b[0] + 12, b[1] + 8, 22, 16);
      });

      // Armor Inspection Cleanroom Rack (swe-verifier / github-manager)
      this.drawContactShadow(ctx, 1420, 420, 40, 50, 4);
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(1420, 420, 40, 50, 4);
      ctx.fill();
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // =========================================================================
      // 3. SOUTH WING: BANQUET HALL, LOUNGE & DRAGON CISTERN
      // =========================================================================
      // Great Stag Hearth Stone Fireplace
      this.drawContactShadow(ctx, 720, 570, 160, 70, 6);
      ctx.fillStyle = '#262626';
      ctx.beginPath();
      ctx.roundRect(720, 570, 160, 70, 6);
      ctx.fill();
      ctx.strokeStyle = '#525252';
      ctx.stroke();

      // Mounted Great Stag Skull with 8-Point Antlers
      ctx.fillStyle = '#f5f5f4';
      ctx.beginPath();
      ctx.ellipse(800, 585, 12, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e7e5e4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(800, 575); ctx.lineTo(775, 555); ctx.lineTo(765, 545);
      ctx.moveTo(800, 575); ctx.lineTo(825, 555); ctx.lineTo(835, 545);
      ctx.stroke();

      // Bearskin Pelt Rug in front of Fireplace
      this.drawRug(ctx, 800, 680, 140, 60, '#3e2723', '#2d1b0e', null);

      // Fireside Armchair (tech-mentor)
      this.drawContactShadow(ctx, 725, 705, 32, 30, 3);
      ctx.fillStyle = '#881337';
      ctx.beginPath();
      ctx.roundRect(725, 705, 32, 30, 6);
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Long Banquet Feast Table (ui-designer)
      this.drawContactShadow(ctx, 420, 720, 160, 44, 4);
      ctx.fillStyle = '#542608';
      ctx.beginPath();
      ctx.roundRect(420, 720, 160, 44, 4);
      ctx.fill();
      ctx.strokeStyle = '#854d0e';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Feast Platters & Tankards
      for (let p = 0; p < 4; p++) {
        const px = 420 + 20 + p * 38;
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath(); ctx.arc(px, 742, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d97706';
        ctx.fillRect(px + 8, 737, 5, 8);
      }

      // Subterranean Dragon Cistern (data-engineer)
      this.drawContactShadow(ctx, 230, 710, 95, 65, 5);
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(230, 710, 95, 65, 8);
      ctx.fill();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Tavern Service Bar & Ale Casks (vps-assistant)
      this.drawContactShadow(ctx, 1020, 725, 120, 35, 3);
      ctx.fillStyle = '#5c3a21';
      ctx.beginPath();
      ctx.roundRect(1020, 725, 120, 35, 4);
      ctx.fill();
      ctx.strokeStyle = '#8d6e63';
      ctx.stroke();

      for (let cy = 680; cy <= 790; cy += 28) {
        this.drawContactShadow(ctx, 1420, cy - 8, 30, 22, 3);
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.ellipse(1435, cy, 14, 18, Math.PI / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1c1917';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    setupInteractions() {
      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const clientX = (e.clientX - rect.left) * dpr;
        const clientY = (e.clientY - rect.top) * dpr;
        return {
          x: (clientX - this.offsetX) / this.scale,
          y: (clientY - this.offsetY) / this.scale
        };
      };

      this.canvas.addEventListener('mousemove', (e) => {
        const p = getPos(e);
        this.checkHover(p.x, p.y);
      });

      this.canvas.addEventListener('click', (e) => {
        const p = getPos(e);
        this.handleClick(p.x, p.y);
      });
    }

    checkHover(mx, my) {
      const hud = document.getElementById('hoverHUD');
      const hudTitle = document.getElementById('hudTitle');
      const hudDesc = document.getElementById('hudDesc');
      const hudIcon = document.getElementById('hudIcon');

      for (const a of this.agents) {
        if (isAgentHit(a, mx, my)) {
          if (hud && hudIcon && hudTitle && hudDesc) {
            hud.style.opacity = '1';
            hudIcon.innerText = a.type === 'boss' ? '👑' : '⚔️';
            hudTitle.innerText = `${a.name} (${a.room})`;
            hudDesc.innerText = `${a.title} • ${a.state}`;
          }
          this.canvas.style.cursor = 'pointer';
          return;
        }
      }

      const table = STATIONS.briefing;
      if (mx >= table.x - table.w / 2 && mx <= table.x + table.w / 2 &&
          my >= table.y - table.h / 2 && my <= table.y + table.h / 2) {
        if (hud && hudIcon && hudTitle && hudDesc) {
          hud.style.opacity = '1';
          hudIcon.innerText = table.icon;
          hudTitle.innerText = table.name;
          hudDesc.innerText = 'Empty Council War Table — Click to view Decrees';
        }
        this.canvas.style.cursor = 'pointer';
        return;
      }

      if (hud) hud.style.opacity = '0';
      this.canvas.style.cursor = 'default';
    }

    handleClick(mx, my) {
      // 1. Click on Agent -> Inspect & Highlight ONLY!
      for (const a of this.agents) {
        if (isAgentHit(a, mx, my)) {
          this.selectedAgentId = a.id;
          a.bubbleTimer = 450;
          a.bubbleText = a.bubbleText || `Stationed at ${a.room}: ${a.title}`;
          if (typeof focusOnAgent === 'function') {
            focusOnAgent(a.id);
          }
          return;
        }
      }

      // 2. Click on War Table (briefing) -> View Council Decrees Modal
      const table = STATIONS.briefing;
      if (mx >= table.x - table.w / 2 && mx <= table.x + table.w / 2 &&
          my >= table.y - table.h / 2 && my <= table.y + table.h / 2) {
        this.openConversationsModal();
        return;
      }
    }

    dispatchAgent(agentId, stationKey, actionText, onComplete) {
      const agent = this.agents.find(a => a.id === agentId);
      const station = STATIONS[stationKey];
      if (!agent || !station) return;

      const currentNearest = this.findNearestWaypoint(agent.x, agent.y);
      const targetKey = station.terminalKey;
      const corridorWaypoints = aStarPath(currentNearest, targetKey);

      agent.pathQueue = corridorWaypoints;
      agent.currentWaypointIdx = 0;
      agent.targetStation = station;
      agent.state = 'WALKING';
      agent.stepBadge = `WALKING ➔ ${station.name.slice(0, 16)}`;
      agent.bubbleText = actionText || `${station.icon} Operating ${station.name}`;
      agent.bubbleTimer = 360;
      agent.onCompleteCallback = onComplete || null;
    }

    returnAgentToDesk(agent, onComplete) {
      if (!agent) return;
      const currentNearest = this.findNearestWaypoint(agent.x, agent.y);
      const returnWaypoints = aStarPath(currentNearest, agent.aisleKey);

      agent.pathQueue = [
        ...returnWaypoints,
        { x: agent.deskX, y: agent.deskY }
      ];
      agent.currentWaypointIdx = 0;
      agent.targetStation = null;
      agent.state = 'WALKING';
      agent.stepBadge = `RETURNING ➔ ${agent.room.slice(0, 14)}`;
      agent.bubbleText = 'Task concluded. Returning to post.';
      agent.bubbleTimer = 220;
      agent.onCompleteCallback = onComplete || null;
    }

    findNearestWaypoint(x, y) {
      let nearestKey = 'C_NORTH_HALL';
      let minDist = Infinity;
      for (const [k, node] of Object.entries(WAYPOINTS)) {
        const d = Math.hypot(node.x - x, node.y - y);
        if (d < minDist) {
          minDist = d;
          nearestKey = k;
        }
      }
      return nearestKey;
    }

    startLoop() {
      const frame = () => {
        try {
          this.update();
          this.render();
          this.calcFPS();
        } catch (err) {
          console.error('Frame error:', err.message);
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }

    calcFPS() {
      this.frameCount++;
      const now = performance.now();
      if (now - this.lastFrameTime >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.lastFrameTime = now;
      }
    }

    update() {
      this.tick++;

      // Update ember particles
      if (this.particles.length < 120 && Math.random() < 0.65) {
        const emitters = [
          [1455, 225, '#ef4444'], // Forge
          [836, 645, '#f97316'],  // Hearth
          [225, 500, '#10b981']   // Alchemy
        ];
        const em = emitters[Math.floor(Math.random() * emitters.length)];
        this.particles.push({
          x: em[0] + (Math.random() - 0.5) * 30,
          y: em[1] + (Math.random() - 0.5) * 15,
          vx: (Math.random() - 0.5) * 0.8,
          vy: -(0.8 + Math.random() * 1.5),
          life: 1.0,
          decay: 0.015 + Math.random() * 0.02,
          size: 2 + Math.random() * 4,
          color: em[2]
        });
      }

      this.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
      });
      this.particles = this.particles.filter(p => p.life > 0);

      // Update agents walking & step state machine
      this.agents.forEach(a => {
        if (a.bubbleTimer > 0) a.bubbleTimer--;

        if (a.state === 'WALKING') {
          if (a.currentWaypointIdx < a.pathQueue.length) {
            const targetWP = a.pathQueue[a.currentWaypointIdx];
            const dx = targetWP.x - a.x;
            const dy = targetWP.y - a.y;
            const d = Math.hypot(dx, dy);

            if (d > 3.2) {
              const vx = (dx / d) * a.speed;
              const vy = (dy / d) * a.speed;
              a.x += vx;
              a.y += vy;
              a.walkCycle += 0.28;

              if (Math.abs(dx) > Math.abs(dy)) {
                a.facing = dx > 0 ? 'right' : 'left';
              } else {
                a.facing = dy > 0 ? 'down' : 'up';
              }
            } else {
              a.x = targetWP.x;
              a.y = targetWP.y;
              a.currentWaypointIdx++;
            }
          } else {
            a.walkCycle = 0;
            if (a.targetStation) {
              a.state = 'WORKING_AT_STATION';
              a.workTimer = 260;
              if (a.onCompleteCallback) {
                const cb = a.onCompleteCallback;
                a.onCompleteCallback = null;
                cb();
              }
            } else {
              a.state = 'IDLE_AT_DESK';
              a.stepBadge = null;
              a.facing = a.type === 'boss' ? 'down' : 'up';
              if (a.onCompleteCallback) {
                const cb = a.onCompleteCallback;
                a.onCompleteCallback = null;
                cb();
              }
            }
          }
        } else if (a.state === 'WORKING_AT_STATION') {
          a.workTimer--;
          if (a.workTimer <= 0) {
            if (a.onCompleteCallback) {
              const cb = a.onCompleteCallback;
              a.onCompleteCallback = null;
              cb();
            } else {
              this.returnAgentToDesk(a);
            }
          }
        }
      });
    }

    render() {
      const ctx = this.ctx;
      ctx.save();
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.translate(this.offsetX, this.offsetY);
      ctx.scale(this.scale, this.scale);

      // Layer 0: Pre-baked Procedural Castle Floor & Architecture
      ctx.drawImage(this.floorCanvas, 0, 0, this.virtualWidth, this.virtualHeight);

      // Layer 1: Ambient Lighting & Torch Braziers
      this.drawAmbientLighting();

      // Layer 2: Characters (Y-sorted)
      const sortedAgents = [...this.agents].sort((a, b) => a.y - b.y);
      sortedAgents.forEach(a => this.drawCharacter(a));

      // Layer 3: Floating RPG Dialogue Balloons
      sortedAgents.forEach(a => this.drawRPGBubble(a));

      // Layer 4: Floating Embers Particle Pass
      this.drawEmberParticles();

      if (this.showWaypoints) this.drawWaypointGraph();

      ctx.restore();
    }

    drawAmbientLighting() {
      const ctx = this.ctx;
      const flicker = Math.sin(this.tick * 0.12) * 5;

      const lctx = this.lightCtx;
      lctx.clearRect(0, 0, this.virtualWidth, this.virtualHeight);

      lctx.fillStyle = 'rgba(18, 14, 10, 0.16)';
      lctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);

      lctx.globalCompositeOperation = 'destination-out';

      const cutLightHole = (x, y, radius, intensity = 1.0) => {
        const g = lctx.createRadialGradient(x, y, 0, x, y, radius);
        g.addColorStop(0, `rgba(0, 0, 0, ${intensity})`);
        g.addColorStop(0.4, `rgba(0, 0, 0, ${intensity * 0.85})`);
        g.addColorStop(0.75, `rgba(0, 0, 0, ${intensity * 0.35})`);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lctx.fillStyle = g;
        lctx.beginPath();
        lctx.arc(x, y, radius, 0, Math.PI * 2);
        lctx.fill();
      };

      cutLightHole(836, 645, 280 + flicker, 0.95);
      cutLightHole(1455, 225, 310 + flicker, 0.95);
      cutLightHole(225, 500, 220 + flicker * 0.5, 0.85);

      const braziers = [
        [690, 360], [910, 360],
        [690, 520], [910, 520],
        [750, 190], [850, 190]
      ];
      braziers.forEach(b => cutLightHole(b[0], b[1], 160 + flicker * 0.5, 0.85));

      const wallSconces = [
        [520, 200], [520, 400],
        [1080, 200], [1080, 400],
        [200, 420], [1300, 420],
        [400, 600], [1200, 600]
      ];
      wallSconces.forEach(ws => cutLightHole(ws[0], ws[1], 130 + flicker * 0.5, 0.8));

      lctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.lightCanvas, 0, 0);

      // Additive Warm Fire Glow Pass
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const gHearth = ctx.createRadialGradient(836, 645, 5, 836, 645, 180 + flicker);
      gHearth.addColorStop(0, 'rgba(251, 146, 60, 0.55)');
      gHearth.addColorStop(0.5, 'rgba(234, 88, 12, 0.22)');
      gHearth.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gHearth;
      ctx.beginPath();
      ctx.arc(836, 645, 180 + flicker, 0, Math.PI * 2);
      ctx.fill();

      const gForge = ctx.createRadialGradient(1455, 225, 5, 1455, 225, 200 + flicker);
      gForge.addColorStop(0, 'rgba(239, 68, 68, 0.6)');
      gForge.addColorStop(0.6, 'rgba(245, 158, 11, 0.25)');
      gForge.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gForge;
      ctx.beginPath();
      ctx.arc(1455, 225, 200 + flicker, 0, Math.PI * 2);
      ctx.fill();

      const gAlchemy = ctx.createRadialGradient(225, 500, 2, 225, 500, 140 + flicker * 0.5);
      gAlchemy.addColorStop(0, 'rgba(16, 185, 129, 0.55)');
      gAlchemy.addColorStop(0.6, 'rgba(5, 150, 105, 0.2)');
      gAlchemy.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gAlchemy;
      ctx.beginPath();
      ctx.arc(225, 500, 140 + flicker * 0.5, 0, Math.PI * 2);
      ctx.fill();

      [...braziers, ...wallSconces].forEach(b => {
        const gb = ctx.createRadialGradient(b[0], b[1], 2, b[0], b[1], 80 + flicker * 0.5);
        gb.addColorStop(0, 'rgba(245, 158, 11, 0.45)');
        gb.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gb;
        ctx.beginPath();
        ctx.arc(b[0], b[1], 80 + flicker * 0.5, 0, Math.PI * 2);
        ctx.fill();
      });

      const gCistern = ctx.createRadialGradient(1110, 740, 5, 1110, 740, 65);
      gCistern.addColorStop(0, 'rgba(2, 132, 199, 0.45)');
      gCistern.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gCistern;
      ctx.beginPath();
      ctx.arc(1110, 740, 65, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      const duckWave = Math.sin(this.tick * 0.08) * 3;
      ctx.fillText('🦆', 1110, 746 + duckWave);
    }

    drawEmberParticles() {
      const ctx = this.ctx;
      this.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life * 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;
    }

    drawCharacter(agent) {
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(agent.x, agent.y);

      if (this.selectedAgentId === agent.id) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(0, -8, 32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Contact Shadow (scaled up)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.ellipse(0, 14, 15, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      const isWalking = agent.state === 'WALKING';
      const legStep = isWalking ? Math.sin(agent.walkCycle) * 4.5 : 0;
      const bodyBob = isWalking ? Math.abs(Math.sin(agent.walkCycle)) * 1.5 : 0;

      // Legs (scaled up: 5x8)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-8, 8 + legStep - bodyBob, 5, 8);
      ctx.fillRect(3, 8 - legStep - bodyBob, 5, 8);

      // Torso (scaled up: 18x15)
      ctx.fillStyle = agent.accentColor;
      ctx.beginPath();
      ctx.roundRect(-9, -8 - bodyBob, 18, 15, 4);
      ctx.fill();

      ctx.fillStyle = agent.type === 'boss' ? '#fbbf24' : '#e2e8f0';
      ctx.fillRect(-2.5, -5 - bodyBob, 5, 8);

      // Head (scaled up: 18x15)
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.roundRect(-9, -23 - bodyBob, 18, 15, 4);
      ctx.fill();

      ctx.fillStyle = agent.hairColor || '#1e293b';
      ctx.fillRect(-9, -23 - bodyBob, 18, 5);

      if (agent.type === 'boss') {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑', 0, -25 - bodyBob);
      } else {
        ctx.fillStyle = agent.hasError ? '#ef4444' : agent.accentColor;
        ctx.shadowColor = agent.hasError ? '#ef4444' : agent.accentColor;
        ctx.shadowBlur = 8;
        if (agent.facing === 'down') {
          ctx.fillRect(-6, -17 - bodyBob, 12, 3.5);
        } else if (agent.facing === 'right') {
          ctx.fillRect(-2, -17 - bodyBob, 8, 3.5);
        } else if (agent.facing === 'left') {
          ctx.fillRect(-6, -17 - bodyBob, 8, 3.5);
        }
        ctx.shadowBlur = 0;
      }

      ctx.strokeStyle = agent.hasError ? '#ef4444' : agent.accentColor;
      ctx.lineWidth = agent.hasError ? 3 : 2;
      ctx.beginPath();
      ctx.arc(0, 10, 17, 0, Math.PI * 2);
      ctx.stroke();

      if (agent.hasError) {
        ctx.font = '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🚨', 0, -44 - bodyBob);
      }

      // Name Badge Pill (DI-ENLARGE & TULISAN LEBIH TEBAL DAN JELAS)
      const badgeW = 92;
      const badgeH = 18;
      const badgeY = -44 - bodyBob;

      ctx.fillStyle = 'rgba(7, 12, 24, 0.95)';
      ctx.strokeStyle = agent.hasError ? '#ef4444' : agent.accentColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-badgeW / 2, badgeY, badgeW, badgeH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 10.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(agent.name, 0, badgeY + 13);

      if (agent.stepBadge) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '800 9px "JetBrains Mono", monospace';
        ctx.fillText(`▶ ${agent.stepBadge}`, 0, badgeY - 6);
      }

      // Attached Working Sign Component (appears whenever agent is active/working)
      const isWorking = agent.state === 'WALKING' || agent.state === 'WORKING_AT_STATION' ||
                        (agent.rosterState && agent.rosterState !== 'IDLE');

      if (isWorking) {
        // 1. Pulsing work beacon halo under feet
        const pulse = (Math.sin(this.tick * 0.12) + 1) / 2;
        ctx.save();
        ctx.strokeStyle = agent.accentColor || '#38bdf8';
        ctx.lineWidth = 2;
        ctx.shadowColor = agent.accentColor || '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.ellipse(0, 14, 18 + pulse * 5, 8 + pulse * 2.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // 2. Physical Signpost Bracket attached to character right shoulder
        ctx.save();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(9, -8 - bodyBob);
        ctx.lineTo(16, -20 - bodyBob);
        ctx.lineTo(24, -20 - bodyBob);
        ctx.stroke();

        // Determine Sign Text & Icon
        let signIcon = '⚡';
        let rawText = agent.state === 'WALKING' ? 'EN ROUTE' :
                      (agent.stepBadge ? agent.stepBadge.replace(/▶\s*/, '') :
                      (agent.rosterState && agent.rosterState !== 'IDLE' ? agent.rosterState : 'WORKING'));

        if (rawText.includes('OPERATING') || rawText.includes('CODING') || rawText.includes('FORGE')) signIcon = '🔨';
        else if (rawText.includes('SCRYING') || rawText.includes('CRAWL')) signIcon = '🔍';
        else if (rawText.includes('AUDITING') || rawText.includes('QA')) signIcon = '🛡️';
        else if (rawText.includes('WALKING') || rawText.includes('EN ROUTE')) signIcon = '▶';
        else if (rawText.includes('THINKING')) signIcon = '💡';

        const cleanText = rawText.slice(0, 11);
        const signW = Math.max(76, cleanText.length * 6.8 + 26);
        const signH = 19;
        const signX = 22;
        const signY = -30 - bodyBob;

        // Sign Drop Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.roundRect(signX + 2, signY + 2, signW, signH, 5);
        ctx.fill();

        // Signplate with pulsing amber border
        const signGrad = ctx.createLinearGradient(signX, signY, signX, signY + signH);
        signGrad.addColorStop(0, '#1e293b');
        signGrad.addColorStop(1, '#090d16');
        ctx.fillStyle = signGrad;
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.roundRect(signX, signY, signW, signH, 5);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Animated rotating gear/tool icon on sign
        ctx.save();
        ctx.translate(signX + 10, signY + signH / 2);
        ctx.rotate((this.tick * 0.08) % (Math.PI * 2));
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(signIcon, 0, 0);
        ctx.restore();

        // Active green LED indicator
        const ledAlpha = 0.5 + Math.sin(this.tick * 0.15) * 0.5;
        ctx.fillStyle = `rgba(34, 197, 94, ${ledAlpha})`;
        ctx.beginPath();
        ctx.arc(signX + signW - 7, signY + signH / 2, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Sign text
        ctx.fillStyle = '#f8fafc';
        ctx.font = '800 8.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(cleanText, signX + 20, signY + signH / 2);

        ctx.restore();
      }

      ctx.restore();
    }

    drawRPGBubble(agent) {
      if (!agent.bubbleText || agent.bubbleTimer <= 0) return;

      const ctx = this.ctx;
      ctx.save();
      ctx.translate(agent.x, agent.y);

      const text = agent.bubbleText;
      ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
      const textWidth = ctx.measureText(text).width;
      const bw = Math.max(105, textWidth + 28);
      const bh = 32;
      const by = -86;

      ctx.fillStyle = 'rgba(7, 12, 24, 0.96)';
      ctx.strokeStyle = agent.hasError ? '#ef4444' : agent.accentColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-bw / 2, by, bw, bh, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(7, 12, 24, 0.95)';
      ctx.beginPath();
      ctx.moveTo(-5, by + bh);
      ctx.lineTo(5, by + bh);
      ctx.lineTo(0, by + bh + 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = agent.hasError ? '#ef4444' : agent.accentColor;
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(text, 0, by + 18);

      ctx.restore();
    }

    setRoster(roster) {
      if (!roster) return;
      roster.forEach(ag => {
        const char = this.agents.find(a => a.id === ag.id || a.alias === ag.id || a.id === ag.alias);
        if (char) {
          char.model = ag.model;
          char.role = ag.role;
          char.rosterState = ag.state;
          char.statusDesc = ag.status_desc;
          if (ag.name) char.name = ag.name;
          char.kanbanTask = ag.kanban_task || null;
          if (char.kanbanTask && char.rosterState === 'IDLE') char.rosterState = 'KANBAN';
          if (ag.accent_color) char.accentColor = ag.accent_color;
          if (char.rosterState && char.rosterState !== 'IDLE' && char.state === 'IDLE_AT_DESK') {
            char.bubbleText = (ag.status_desc || char.rosterState).slice(0, 48);
            char.bubbleTimer = 240;
          }
        }
      });
    }

    // --- REAL MULTI-STEP TASK & DELEGATION PIPELINE ---
    processTelemetry(events, conversations) {
      this.telemetryEvents = events || [];
      this.conversations = conversations || [];

      if (!this.executedToolKeys) this.executedToolKeys = new Set();

      // Seed only inactive history. A running or just-completed delegation is live state,
      // not history, and must still animate when the operator opens or refreshes the page.
      if (!this.initialPollDone) {
        this.initialPollDone = true;
        (conversations || []).forEach(c => {
          if (!c.is_live) this.executedConvoIds.add(c.id);
        });
        const liveDelegationIds = new Set((conversations || []).filter(c => c.is_live).map(c => c.id));
        (events || []).forEach(e => {
          if (e.type === 'tool_call' && !liveDelegationIds.has(e.delegation_id)) {
            this.executedToolKeys.add(e.id || `${e.delegation_id}_${e.time}_${e.detail}`);
          }
        });
      }

      const latestLiveConvo = (conversations || []).find(c => c.is_live && !this.executedConvoIds.has(c.id));
      if (!this.activeSequence && latestLiveConvo) {
        this.executedConvoIds.add(latestLiveConvo.id);
        this.executeDelegationSequence(latestLiveConvo);
      }

      // Consume every newly observed live tool call, including subagent calls. During a
      // briefing it is queued; once free it immediately moves the actor to its apparatus.
      const recentTool = (events || []).find(e => {
        if (e.type !== 'tool_call') return false;
        const key = e.id || `${e.delegation_id}_${e.time}_${e.detail}`;
        return !this.executedToolKeys.has(key);
      });
      if (!recentTool) return;

      const toolKey = recentTool.id || `${recentTool.delegation_id}_${recentTool.time}_${recentTool.detail}`;
      this.executedToolKeys.add(toolKey);
      if (this.activeSequence) {
        this.pendingToolEvent = recentTool;
      } else {
        this.executeLiveToolAction(recentTool);
      }
    }

    executeDelegationSequence(convo) {
      // Ephemeral delegation roles (for example office-lead) are not permanent map
      // residents. Represent them with the operations avatar instead of dropping the event.
      const subagent = this.agents.find(a => a.id === convo.receiver) ||
        this.agents.find(a => a.id === 'vps-assistant');
      const boss = this.agents.find(a => a.id === 'jarvis');
      if (!subagent || !boss) return;

      this.activeSequence = {
        id: convo.id,
        stage: 'WAR_TABLE_MEETING',
        receiver: convo.receiver
      };

      // Step 1: both agents walk to exact opposite sides of the council table.
      this.dispatchAgent('jarvis', 'briefing', `👑 Decree for ${convo.receiver}...`, () => {
        boss.x = 836;
        boss.y = 290;
        boss.facing = 'down';
        boss.bubbleText = `👑 Boss: "${convo.boss_order.slice(0, 40)}..."`;
        boss.bubbleTimer = 360;
      });

      this.dispatchAgent(subagent.id, 'briefing', `⚔️ ${convo.receiver} summoned via ${subagent.name}`, () => {
        subagent.x = 836;
        subagent.y = 505;
        subagent.facing = 'up';
        subagent.bubbleText = `⚔️ ${convo.receiver}: "Decree acknowledged. Moving to station..."`;
        subagent.bubbleTimer = 360;

        setTimeout(() => {
          this.executeSubagentToolStep(subagent, convo);
        }, 3500);
      });
    }

    executeSubagentToolStep(subagent, convo) {
      const tools = convo.tools_used || [];
      let targetStation = 'compiler';
      let toolIcon = '🔨';
      let toolAction = 'Executing shell & compilation in Royal Forge';

      if (tools.some(t => t.includes('web') || t.includes('crawl') || t.includes('scry'))) {
        targetStation = 'crawler';
        toolIcon = '🔍';
        toolAction = 'Scrying realms via Web Crawler in Alchemical Lab';
      } else if (tools.some(t => t.includes('read') || t.includes('write') || t.includes('patch') || t.includes('paper') || t.includes('session'))) {
        targetStation = 'library';
        toolIcon = '📜';
        toolAction = 'Analyzing manuscripts & files in Grand Library';
      } else if (subagent.id === 'swe-verifier' || tools.some(t => t.includes('audit') || t.includes('inspect') || t.includes('verify'))) {
        targetStation = 'quarantine';
        toolIcon = '🛡️';
        toolAction = 'Auditing armor invariants in Sentry Inspection Rack';
      } else if (subagent.id === 'data-engineer' || tools.some(t => t.includes('duckdb') || t.includes('lakehouse') || t.includes('sql'))) {
        targetStation = 'lakehouse';
        toolIcon = '🦆';
        toolAction = 'Channeling data streams at Dragon Cistern';
      }

      const boss = this.agents.find(a => a.id === 'jarvis');
      if (boss) {
        this.returnAgentToDesk(boss);
      }

      this.dispatchAgent(subagent.id, targetStation, `${toolIcon} ${toolAction}`, () => {
        subagent.state = 'WORKING_AT_STATION';
        subagent.stepBadge = `OPERATING ${targetStation.toUpperCase()}`;
        subagent.bubbleText = `${toolIcon} Operating: ${tools.slice(0, 3).join(', ')}`;
        subagent.bubbleTimer = 320;

        setTimeout(() => {
          subagent.bubbleText = `✅ Completed: "${(convo.subagent_reply || 'Evidence verified').slice(0, 36)}..."`;
          subagent.bubbleTimer = 260;
          this.returnAgentToDesk(subagent, () => {
            this.activeSequence = null;
            if (this.pendingToolEvent) {
              const pending = this.pendingToolEvent;
              this.pendingToolEvent = null;
              this.executeLiveToolAction(pending);
            }
          });
        }, 5000);
      });
    }

    executeLiveToolAction(toolEvent) {
      const actor = this.agents.find(a => a.id === toolEvent.agent);
      if (!actor || actor.state !== 'IDLE_AT_DESK') return;
      if (toolEvent.agent === 'jarvis') {
        this.executeBossToolAction(toolEvent);
        return;
      }

      const station = STATIONS[toolEvent.station] ? toolEvent.station : 'compiler';
      const detail = toolEvent.detail || 'Executing tool';
      this.activeSequence = { id: toolEvent.delegation_id, stage: 'LIVE_TOOL', receiver: actor.id };
      this.dispatchAgent(actor.id, station, `⚡ ${detail.slice(0, 58)}`, () => {
        actor.state = 'WORKING_AT_STATION';
        actor.stepBadge = `OPERATING ${station.toUpperCase()}`;
        actor.bubbleText = `⚡ ${detail.slice(0, 72)}`;
        actor.bubbleTimer = 420;
        setTimeout(() => {
          this.returnAgentToDesk(actor, () => { this.activeSequence = null; });
        }, 4500);
      });
    }

    executeBossToolAction(toolEvent) {
      const boss = this.agents.find(a => a.id === 'jarvis');
      if (!boss || boss.state !== 'IDLE_AT_DESK') return;

      const detail = toolEvent.detail || '';
      let targetStation = 'compiler';
      let toolIcon = '🔨';
      let actionText = 'Striking server forge terminal';

      if (detail.includes('web_search') || detail.includes('web_extract') || detail.includes('crawl')) {
        targetStation = 'crawler';
        toolIcon = '🔍';
        actionText = 'Boss scrying realms via Web Crawler in Alchemical Lab';
      } else if (detail.includes('read_file') || detail.includes('patch') || detail.includes('write_file')) {
        targetStation = 'library';
        toolIcon = '📜';
        actionText = 'Boss consulting Citadel archives in Library';
      }

      this.activeSequence = { id: 'boss_tool', stage: 'BOSS_TOOL' };

      this.dispatchAgent('jarvis', targetStation, `${toolIcon} ${actionText}`, () => {
        boss.state = 'WORKING_AT_STATION';
        boss.stepBadge = `SCRYING ${targetStation.toUpperCase()}`;
        boss.bubbleText = `${toolIcon} Boss: "${detail.slice(0, 30)}..."`;
        boss.bubbleTimer = 280;

        setTimeout(() => {
          this.returnAgentToDesk(boss, () => {
            this.activeSequence = null;
          });
        }, 4500);
      });
    }

    openConversationsModal() {
      document.getElementById('convoModal')?.remove();
      const make = (tag, className, text) => { const el=document.createElement(tag); if(className)el.className=className; if(text!==undefined)el.textContent=String(text); return el; };
      const modal=make('div','fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4'); modal.id='convoModal';
      const panel=make('div','bg-cyber-900 border border-cyber-700 rounded-2xl max-w-3xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh] font-sans');
      const header=make('div','flex items-center justify-between border-b border-cyber-800 pb-4 mb-4');
      const heading=make('div',''); heading.append(make('h2','text-base font-extrabold text-white','⚔️ The Painted War Table — Royal Council Decrees'),make('p','text-xs text-slate-400','Server-redacted delegation orders and subagent reports.'));
      const close=make('button','w-8 h-8 rounded-lg bg-cyber-800 text-slate-400 hover:text-white','✕'); close.type='button'; close.addEventListener('click',()=>modal.remove()); header.append(heading,close);
      const list=make('div','flex-1 overflow-y-auto space-y-4 pr-1 text-xs');
      (this.conversations||[]).forEach(c=>{
        const card=make('article','p-4 rounded-xl bg-cyber-950/80 border border-cyber-800/80 space-y-2');
        const meta=make('div','flex items-center justify-between font-mono text-[11px]'); meta.append(make('span','font-bold text-amber-400',`👑 jarvis ➔ ⚔️ ${c.receiver||'unknown'}`),make('time','text-slate-500',c.started_at||'recent'));
        card.append(meta,make('div','p-2.5 rounded-lg bg-amber-500/10 border-l-2 border-amber-500 text-slate-200',`Royal Decree: “${c.boss_order||''}”`));
        if(c.subagent_reply) card.append(make('div','p-2.5 rounded-lg bg-emerald-500/10 border-l-2 border-emerald-500 text-emerald-200',`${c.receiver||'Agent'} Report: “${c.subagent_reply}”`));
        const tools=make('div','flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-mono pt-1'); tools.append(make('span','','Tools Used:'));
        (c.tools_used||[]).forEach(tool=>tools.append(make('span','px-1.5 py-0.5 rounded bg-cyber-800 text-slate-300 font-bold',tool))); card.append(tools); list.append(card);
      });
      if(!list.children.length) list.append(make('p','text-slate-500','No delegation records available.'));
      panel.append(header,list); modal.append(panel); document.body.append(modal);
    }

    drawWaypointGraph() {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);

      for (const [key, node] of Object.entries(WAYPOINTS)) {
        if (!node.neighbors) continue;
        node.neighbors.forEach(nKey => {
          const neighbor = WAYPOINTS[nKey];
          if (neighbor) {
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(neighbor.x, neighbor.y);
            ctx.stroke();
          }
        });
      }
      ctx.setLineDash([]);

      for (const [key, node] of Object.entries(WAYPOINTS)) {
        ctx.fillStyle = key.startsWith('W_') ? '#10b981' : (key.startsWith('ST_') ? '#f59e0b' : '#38bdf8');
        ctx.beginPath();
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  window.CyberOfficeSimulation = StrongholdProceduralRenderer;
})();
