/**
 * Hermes Sovereign Stronghold — 100% Pure Procedural Canvas 2D Engine
 * Game of Thrones Medieval Council Chamber & War Room Edition
 *
 * ZERO EXTERNAL IMAGE ASSETS — 100% PROGRAMMATIC CODE:
 * - Mathematical Perlin Noise & Seeded PRNG for authentic stone & wood textures
 * - Procedural ashlar flagstone floor with mortar bevels & natural crack veins
 * - Procedural Gothic fluted pillars, pointed archways, and fortified castle walls
 * - Procedural Heraldic Rugs with Mathematical Bézier Charges:
 *   * House Lannister (Lion Rampant)
 *   * House Targaryen (Three-Headed Dragon)
 *   * House Stark (Direwolf)
 *   * House Baratheon (Crowned Antlered Stag)
 * - Procedural Iron Throne compiled from 160+ parametric blade polygons with 8-stop metallic gradient
 * - Procedural Octagonal Painted War Table with relief coastline topography & 13 high-backed chairs
 * - Procedural Medieval Stations:
 *   * Citadel Alchemical Library with glowing emerald Wildfire flasks
 *   * Royal Castle Forge with blazing red-hot hearth, anvils & weapon racks
 *   * Great Banquet Hall with antlered stag fireplace, casks & feast tables
 *   * Subterranean Dragon Cistern with DuckDB golden mascot duck
 * - Multi-pass Dynamic Torchlight Shader (multi-frequency sine flicker) & Fire Embers Particle Engine
 * - 13 Autonomous Agent Avatars with Chibi Kinematics, Soft Shadows & Smallville RPG Dialogue Balloons
 * - A* Corridor Waypoint Navigation (Zero-Clipping)
 * - Live Telemetry, 9Router Cost Sync & Error Triage Integration
 */

(function() {
  'use strict';

  // --- 1. Mathematical Foundations: Seedable PRNG & Perlin Noise ---
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

  // --- 2. Stronghold Stations & Metadata ---
  const STATIONS = {
    briefing: {
      id: 'briefing',
      name: 'The Painted War Table',
      desc: 'Carved dragonstone war table with strategic relief map & troop markers',
      x: 800, y: 440, w: 260, h: 160,
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
      name: "The Grand Maester's Study",
      desc: 'Citadel library with astrolabe, scrolls & leather-bound tomes',
      x: 320, y: 260, w: 220, h: 160,
      color: '#8b5cf6',
      icon: '📜',
      terminalKey: 'ST_LIBRARY'
    },
    crawler: {
      id: 'crawler',
      name: 'The Alchemical Laboratory',
      desc: 'Bubbling emerald flasks, alembics & arcane scrying vials',
      x: 170, y: 250, w: 140, h: 140,
      color: '#10b981',
      icon: '🧪',
      terminalKey: 'ST_ALCHEMY'
    },
    compiler: {
      id: 'compiler',
      name: 'The Royal Forge & Armory',
      desc: 'Blazing coal hearth, dual heavy anvils & weapon toolracks',
      x: 1300, y: 230, w: 240, h: 160,
      color: '#ef4444',
      icon: '🔨',
      terminalKey: 'ST_FORGE'
    },
    quarantine: {
      id: 'quarantine',
      name: 'Armor Inspection Sentry Rack',
      desc: 'Articulated armor stands & static security analysis sentry',
      x: 1200, y: 380, w: 150, h: 120,
      color: '#34d399',
      icon: '🛡️',
      terminalKey: 'ST_ARMOR_RACK'
    },
    pantry: {
      id: 'pantry',
      name: 'Great Banquet Hall & Ale Bar',
      desc: 'Tavern casks of mead, wine bottles & roasted trenchers',
      x: 1300, y: 730, w: 220, h: 150,
      color: '#d97706',
      icon: '🍗',
      terminalKey: 'ST_ALE_BAR'
    },
    lakehouse: {
      id: 'lakehouse',
      name: 'Subterranean Dragon Cistern',
      desc: 'Water reservoir feeding lakehouse conduits with golden duck mascot',
      x: 260, y: 730, w: 180, h: 150,
      color: '#0284c7',
      icon: '🦆',
      terminalKey: 'ST_CISTERN'
    },
    hearth: {
      id: 'hearth',
      name: 'Great Stag Hearth Fireplace',
      desc: 'Roaring log fire under the mounted great horned stag skull',
      x: 800, y: 600, w: 180, h: 90,
      color: '#f97316',
      icon: '🔥',
      terminalKey: 'ST_STAG_HEARTH'
    }
  };

  // --- 3. 13 Specialized Agent Roster in the Council Hall ---
  const AGENTS_ROSTER = [
    {
      id: 'vps-boss',
      name: 'vps-boss',
      title: 'Lord Commander & Chief Orchestrator',
      accentColor: '#f59e0b',
      hairColor: '#0f172a',
      desk: { x: 800, y: 125 },
      aisleKey: 'AE_BOSS',
      bubble: 'Reigning from the Iron Throne',
      type: 'boss'
    },
    {
      id: 'chief-architect',
      name: 'chief-architect',
      title: 'Grand Strategist of Systems',
      accentColor: '#38bdf8',
      hairColor: '#1e293b',
      desk: { x: 800, y: 360 },
      aisleKey: 'AE_ARCHITECT',
      bubble: 'Charting tactical war maps'
    },
    {
      id: 'swe-backend',
      name: 'swe-backend',
      title: 'Master of Server Strongholds',
      accentColor: '#10b981',
      hairColor: '#064e3b',
      desk: { x: 710, y: 415 },
      aisleKey: 'AE_BACKEND',
      bubble: 'Guarding ACID database gates'
    },
    {
      id: 'swe-frontend',
      name: 'swe-frontend',
      title: 'Royal Visual Artisan',
      accentColor: '#06b6d4',
      hairColor: '#083344',
      desk: { x: 710, y: 475 },
      aisleKey: 'AE_FRONTEND',
      bubble: 'Crafting responsive interfaces'
    },
    {
      id: 'swe-verifier',
      name: 'swe-verifier',
      title: 'High Sentry of Verification',
      accentColor: '#34d399',
      hairColor: '#022c22',
      desk: { x: 890, y: 415 },
      aisleKey: 'AE_VERIFIER',
      bubble: 'Zero-tolerance quality audit'
    },
    {
      id: 'github-manager',
      name: 'github-manager',
      title: 'Keeper of the Castle Armory & Git',
      accentColor: '#8b5cf6',
      hairColor: '#2e1065',
      desk: { x: 890, y: 475 },
      aisleKey: 'AE_GITHUB',
      bubble: 'Guarding release branches'
    },
    {
      id: 'professor',
      name: 'professor',
      title: 'Grand Maester of Research',
      accentColor: '#ec4899',
      hairColor: '#831843',
      desk: { x: 320, y: 260 },
      aisleKey: 'AE_PROFESSOR',
      bubble: 'Consulting Citadel manuscripts'
    },
    {
      id: 'paperwright',
      name: 'paperwright',
      title: 'Citadel Scribe & Typesetter',
      accentColor: '#e11d48',
      hairColor: '#4c0519',
      desk: { x: 230, y: 350 },
      aisleKey: 'AE_PAPERWRIGHT',
      bubble: 'Illuminating parchment scrolls'
    },
    {
      id: 'devops-engineer',
      name: 'devops-engineer',
      title: 'Master Blacksmith & SRE',
      accentColor: '#f97316',
      hairColor: '#431407',
      desk: { x: 1280, y: 270 },
      aisleKey: 'AE_DEVOPS',
      bubble: 'Fueling container forge hearths'
    },
    {
      id: 'data-engineer',
      name: 'data-engineer',
      title: 'Keeper of the Dragon Cistern',
      accentColor: '#0284c7',
      hairColor: '#082f49',
      desk: { x: 480, y: 730 },
      aisleKey: 'AE_DATAENG',
      bubble: 'Diverting data pipeline aqueducts'
    },
    {
      id: 'tech-mentor',
      name: 'tech-mentor',
      title: 'Wise Mentor of the Great Hall',
      accentColor: '#14b8a6',
      hairColor: '#042f2e',
      desk: { x: 580, y: 730 },
      aisleKey: 'AE_MENTOR',
      bubble: 'Counseling junior squires & engineers'
    },
    {
      id: 'ui-designer',
      name: 'ui-designer',
      title: 'Royal Tapestry Weaver',
      accentColor: '#d946ef',
      hairColor: '#4a044e',
      desk: { x: 1020, y: 730 },
      aisleKey: 'AE_DESIGNER',
      bubble: 'Weaving heraldic tapestries'
    },
    {
      id: 'vps-assistant',
      name: 'vps-assistant',
      title: 'Castellan of Logistics & Larder',
      accentColor: '#a855f7',
      hairColor: '#3b0764',
      desk: { x: 1120, y: 730 },
      aisleKey: 'AE_ASSISTANT',
      bubble: 'Managing stronghold operations'
    }
  ];

  // --- 4. Waypoint Corridor Navigation Graph ---
  const WAYPOINTS = {
    // North Dais Corridor
    'W_THRONE_EXIT':   { x: 800, y: 190, neighbors: ['W_THRONE_STEPS', 'ST_THRONE'] },
    'W_THRONE_STEPS':  { x: 800, y: 260, neighbors: ['W_THRONE_EXIT', 'C_NORTH_HALL'] },
    
    // North Arterial Hallway (Y = 320)
    'C_NORTH_HALL':    { x: 800, y: 320, neighbors: ['W_THRONE_STEPS', 'C_NW_DOOR', 'C_NE_DOOR', 'ST_WAR_NORTH'] },
    'C_NW_DOOR':       { x: 520, y: 320, neighbors: ['C_NORTH_HALL', 'W_LIB_EAST', 'C_WEST_BREEZEWAY'] },
    'C_NE_DOOR':       { x: 1080, y: 320, neighbors: ['C_NORTH_HALL', 'W_FORGE_WEST', 'C_EAST_BREEZEWAY'] },

    // West Wing: Library & Alchemy
    'W_LIB_EAST':      { x: 430, y: 320, neighbors: ['C_NW_DOOR', 'ST_LIBRARY', 'W_LIB_SOUTH'] },
    'ST_LIBRARY':      { x: 320, y: 260, neighbors: ['W_LIB_EAST', 'ST_ALCHEMY', 'AE_PROFESSOR'] },
    'ST_ALCHEMY':      { x: 170, y: 250, neighbors: ['ST_LIBRARY'] },
    'W_LIB_SOUTH':     { x: 320, y: 350, neighbors: ['W_LIB_EAST', 'AE_PAPERWRIGHT'] },

    // East Wing: Forge & Armory
    'W_FORGE_WEST':    { x: 1170, y: 320, neighbors: ['C_NE_DOOR', 'ST_FORGE', 'ST_ARMOR_RACK'] },
    'ST_FORGE':        { x: 1300, y: 230, neighbors: ['W_FORGE_WEST', 'AE_DEVOPS'] },
    'ST_ARMOR_RACK':   { x: 1200, y: 380, neighbors: ['W_FORGE_WEST'] },

    // Central War Table Array
    'ST_WAR_NORTH':    { x: 800, y: 360, neighbors: ['C_NORTH_HALL', 'ST_WAR_TABLE', 'AE_ARCHITECT'] },
    'ST_WAR_TABLE':    { x: 800, y: 440, neighbors: ['ST_WAR_NORTH', 'ST_WAR_WEST', 'ST_WAR_EAST', 'ST_WAR_SOUTH'] },
    'ST_WAR_WEST':     { x: 710, y: 445, neighbors: ['ST_WAR_TABLE', 'AE_BACKEND', 'AE_FRONTEND'] },
    'ST_WAR_EAST':     { x: 890, y: 445, neighbors: ['ST_WAR_TABLE', 'AE_VERIFIER', 'AE_GITHUB'] },
    'ST_WAR_SOUTH':    { x: 800, y: 530, neighbors: ['ST_WAR_TABLE', 'ST_STAG_HEARTH', 'C_SOUTH_HALL'] },

    // Central Stag Fireplace & Archway
    'ST_STAG_HEARTH':  { x: 800, y: 600, neighbors: ['ST_WAR_SOUTH', 'C_SOUTH_HALL'] },

    // Vertical Outer Breezeways
    'C_WEST_BREEZEWAY':{ x: 520, y: 480, neighbors: ['C_NW_DOOR', 'C_SW_DOOR'] },
    'C_EAST_BREEZEWAY':{ x: 1080, y: 480, neighbors: ['C_NE_DOOR', 'C_SE_DOOR'] },

    // South Arterial Hallway (Y = 650)
    'C_SOUTH_HALL':    { x: 800, y: 650, neighbors: ['ST_STAG_HEARTH', 'C_SW_DOOR', 'C_SE_DOOR'] },
    'C_SW_DOOR':       { x: 520, y: 650, neighbors: ['C_SOUTH_HALL', 'C_WEST_BREEZEWAY', 'W_FEAST_WEST'] },
    'C_SE_DOOR':       { x: 1080, y: 650, neighbors: ['C_SOUTH_HALL', 'C_EAST_BREEZEWAY', 'W_FEAST_EAST'] },

    // Banquet Feast Hall
    'W_FEAST_WEST':    { x: 520, y: 730, neighbors: ['C_SW_DOOR', 'ST_CISTERN', 'AE_DATAENG', 'AE_MENTOR'] },
    'ST_CISTERN':      { x: 260, y: 730, neighbors: ['W_FEAST_WEST'] },
    'W_FEAST_EAST':    { x: 1080, y: 730, neighbors: ['C_SE_DOOR', 'ST_ALE_BAR', 'AE_DESIGNER', 'AE_ASSISTANT'] },
    'ST_ALE_BAR':      { x: 1300, y: 730, neighbors: ['W_FEAST_EAST'] },

    // Station Terminals
    'ST_THRONE':       { x: 800, y: 110, neighbors: ['W_THRONE_EXIT'] },

    // Aisle Exits from Desks
    'AE_BOSS':         { x: 800, y: 155, neighbors: ['W_THRONE_EXIT'] },
    'AE_ARCHITECT':    { x: 800, y: 360, neighbors: ['ST_WAR_NORTH'] },
    'AE_BACKEND':      { x: 710, y: 415, neighbors: ['ST_WAR_WEST'] },
    'AE_FRONTEND':     { x: 710, y: 475, neighbors: ['ST_WAR_WEST'] },
    'AE_VERIFIER':     { x: 890, y: 415, neighbors: ['ST_WAR_EAST'] },
    'AE_GITHUB':       { x: 890, y: 475, neighbors: ['ST_WAR_EAST'] },
    'AE_PROFESSOR':    { x: 320, y: 260, neighbors: ['ST_LIBRARY'] },
    'AE_PAPERWRIGHT':  { x: 230, y: 350, neighbors: ['W_LIB_SOUTH'] },
    'AE_DEVOPS':       { x: 1280, y: 270, neighbors: ['ST_FORGE'] },
    'AE_DATAENG':      { x: 480, y: 730, neighbors: ['W_FEAST_WEST'] },
    'AE_MENTOR':       { x: 580, y: 730, neighbors: ['W_FEAST_WEST'] },
    'AE_DESIGNER':     { x: 1020, y: 730, neighbors: ['W_FEAST_EAST'] },
    'AE_ASSISTANT':    { x: 1120, y: 730, neighbors: ['W_FEAST_EAST'] }
  };

  // --- 5. A* Shortest Pathfinding ---
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

  // --- 6. Pure Procedural Graphics Renderers ---

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

  // --- 7. Main Stronghold Procedural Renderer Class ---
  class StrongholdProceduralRenderer {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas.getContext('2d');
      this.virtualWidth = 1600;
      this.virtualHeight = 900;

      this.tick = 0;
      this.fps = 60;
      this.lastFrameTime = performance.now();
      this.frameCount = 0;
      this.showWaypoints = false;

      // Offscreen Pre-baked Architectural Canvas
      this.floorCanvas = document.createElement('canvas');
      this.floorCanvas.width = this.virtualWidth;
      this.floorCanvas.height = this.virtualHeight;
      this.floorCtx = this.floorCanvas.getContext('2d');

      // Particle System for Torches & Fireplaces
      this.particles = [];

      this.initAgents();
      this.bakeProceduralArchitecture();
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

      // Fit scale: ensures 100% of the council keep is visible without overlap
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
        speed: 2.6,
        walkCycle: 0,
        bubbleText: a.bubble,
        bubbleTimer: (idx % 3 === 0) ? 600 : 0,
        pathQueue: [],
        currentWaypointIdx: 0,
        targetStation: null,
        hasError: false
      }));
    }

    // --- BAKE 100% PROCEDURAL ARCHITECTURE (ZERO IMAGE FILES) ---
    bakeProceduralArchitecture() {
      const ctx = this.floorCtx;
      const W = this.virtualWidth;
      const H = this.virtualHeight;

      // 1. Layer 0: Dark Cast Iron & Slate Mortar Bed
      ctx.fillStyle = '#141210';
      ctx.fillRect(0, 0, W, H);

      // 2. Ashlar Flagstone Tiling across entire keep
      this.renderProceduralFlagstones(ctx, W, H);

      // 3. Castle Ashlar Partition Walls & Wing Chambers
      this.renderProceduralWallsAndChambers(ctx, W, H);

      // 4. Heraldic Sigil Rugs of the Great Houses
      this.renderHeraldicSigilRugs(ctx);

      // 5. Procedural Iron Throne on 4-Tier Dais
      this.renderProceduralIronThrone(ctx, 800, 110);

      // 6. Procedural Octagonal Painted War Table with Topography
      this.renderProceduralWarTable(ctx, 800, 440, 130);

      // 7. Gothic Clustered Pillars & Archways
      this.renderGothicPillars(ctx);

      // 8. Specialized Furniture in Wings
      this.renderWingFurnishings(ctx);
    }

    // A. Flagstone Flooring with Perlin Weathering & Mortar
    renderProceduralFlagstones(ctx, W, H) {
      const rng = mulberry32(1337);
      const tileW = 64;
      const tileH = 44;
      const mortar = 3;

      for (let y = 20; y < H - 20; y += tileH + mortar) {
        const rowIdx = Math.floor(y / (tileH + mortar));
        const xOffset = (rowIdx % 2) * (tileW / 2);

        for (let x = -tileW; x < W + tileW; x += tileW + mortar) {
          const rx = x + xOffset;
          const noiseVal = Perlin.fbm(rx * 0.005, y * 0.005, 3);
          const r = Math.floor(34 + noiseVal * 16 + rng() * 6);
          const g = Math.floor(30 + noiseVal * 14 + rng() * 5);
          const b = Math.floor(26 + noiseVal * 12 + rng() * 5);

          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(rx, y, tileW, tileH);

          // Top & Left Highlight Bevel
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.04 + rng() * 0.04})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(rx, y + tileH);
          ctx.lineTo(rx, y);
          ctx.lineTo(rx + tileW, y);
          ctx.stroke();

          // Bottom & Right Shadow Bevel
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.beginPath();
          ctx.moveTo(rx + tileW, y);
          ctx.lineTo(rx + tileW, y + tileH);
          ctx.lineTo(rx, y + tileH);
          ctx.stroke();

          // Occasional stone cracks
          if (rng() < 0.08) {
            ctx.strokeStyle = 'rgba(10, 8, 6, 0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(rx + 10 + rng() * 20, y + 8 + rng() * 10);
            ctx.lineTo(rx + 25 + rng() * 15, y + 20 + rng() * 15);
            ctx.stroke();
          }
        }
      }
    }

    // B. Walls, Crenelations & Chamber Divisors
    renderProceduralWallsAndChambers(ctx, W, H) {
      // Perimeter Fortress Wall
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#1e1a16';
      ctx.strokeRect(30, 25, W - 60, H - 50);

      // Inner Stone Bevel
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(180, 160, 130, 0.15)';
      ctx.strokeRect(37, 32, W - 74, H - 64);

      // Major Partition Walls
      const drawWall = (x1, y1, x2, y2) => {
        ctx.strokeStyle = '#1a1612';
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y1);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(200, 180, 150, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1 - 4);
        ctx.lineTo(x2, y1 - 4);
        ctx.stroke();
      };

      // West Library Walls
      drawWall(40, 420, 520, 420);
      drawWall(520, 40, 520, 320);
      drawWall(520, 380, 520, 420);

      // East Forge & Armory Walls
      drawWall(1080, 420, W - 40, 420);
      drawWall(1080, 40, 1080, 320);
      drawWall(1080, 380, 1080, 420);

      // South Great Hall Partition
      drawWall(40, 600, 720, 600);
      drawWall(880, 600, W - 40, 600);
    }

    // C. Heraldic Sigil Rugs of the 4 Great Houses
    renderHeraldicSigilRugs(ctx) {
      // 1. House Stark Rug (North-West)
      this.drawRug(ctx, 600, 260, 110, 130, '#1e293b', '#475569', () => {
        // Stark Direwolf Head (Bézier profile)
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(0, 18);
        ctx.bezierCurveTo(-15, 12, -22, 0, -18, -12);
        ctx.lineTo(-24, -24); ctx.lineTo(-14, -18); // Ear
        ctx.bezierCurveTo(-5, -28, 12, -26, 24, -10); // Snout
        ctx.lineTo(26, -4); ctx.lineTo(18, -2); // Jaws
        ctx.bezierCurveTo(15, 8, 8, 15, 0, 18);
        ctx.closePath();
        ctx.fill();
        // Golden eye
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath(); ctx.arc(4, -10, 2.5, 0, Math.PI * 2); ctx.fill();
      });

      // 2. House Targaryen Rug (North-East)
      this.drawRug(ctx, 1000, 260, 110, 130, '#18181b', '#991b1b', () => {
        // Targaryen 3-Headed Dragon
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(0, 4, 18, 0, Math.PI * 2); // Body
        ctx.fill();
        // 3 Dragon Heads
        [-12, 0, 12].forEach(ox => {
          ctx.beginPath();
          ctx.moveTo(ox * 0.6, -6);
          ctx.quadraticCurveTo(ox * 1.4, -22, ox * 1.1, -28);
          ctx.lineTo(ox * 1.5, -24);
          ctx.closePath();
          ctx.fill();
        });
        // Wings
        ctx.beginPath();
        ctx.moveTo(-10, -4);
        ctx.quadraticCurveTo(-30, -22, -28, 2);
        ctx.lineTo(-10, 6);
        ctx.moveTo(10, -4);
        ctx.quadraticCurveTo(30, -22, 28, 2);
        ctx.lineTo(10, 6);
        ctx.fill();
      });

      // 3. House Lannister Promenade Rug & Royal Banners
      this.drawRug(ctx, 800, 235, 130, 85, '#7f1d1d', '#b45309', () => {
        // Gold Lion Rampant silhouette
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(0, 22);
        ctx.bezierCurveTo(-10, 14, -12, -7, -4, -18);
        ctx.lineTo(-10, -25); ctx.lineTo(-1, -22); // Mane
        ctx.bezierCurveTo(6, -29, 14, -22, 11, -14); // Head
        ctx.lineTo(20, -17); ctx.lineTo(14, -10); // Forepaw
        ctx.bezierCurveTo(11, 4, 8, 15, 0, 22);
        ctx.closePath();
        ctx.fill();
      });

      // Twin Royal Lannister Wall Banners flanking Iron Throne
      [680, 920].forEach(bx => {
        this.drawRug(ctx, bx, 110, 36, 90, '#7f1d1d', '#fbbf24', () => {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(0, -10, 8, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      // Central Council Floor Ring beneath War Table
      this.drawRug(ctx, 800, 440, 350, 220, '#312e81', '#4338ca', () => {
        ctx.strokeStyle = '#c7d2fe';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-160, -95, 320, 190);
      });

      // 4. House Baratheon Rug (Great Banquet Hall South)
      this.drawRug(ctx, 800, 730, 280, 140, '#854d0e', '#1c1917', () => {
        // Crowned Stag silhouette
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(0, 10, 14, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        // Antlers branching
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
        // Crown
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-6, -12, 12, 4);
      });
    }

    drawRug(ctx, cx, cy, w, h, baseCol, borderCol, sigilFn) {
      ctx.save();
      ctx.translate(cx, cy);

      // Rug Base
      ctx.fillStyle = baseCol;
      ctx.fillRect(-w / 2, -h / 2, w, h);

      // Decorative Ornate Border
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 3;
      ctx.strokeRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16);

      // Fringed tassels top & bottom
      ctx.fillStyle = borderCol;
      for (let tx = -w / 2 + 4; tx < w / 2 - 4; tx += 6) {
        ctx.fillRect(tx, -h / 2 - 3, 2.5, 3);
        ctx.fillRect(tx, h / 2, 2.5, 3);
      }

      // Draw Heraldic Sigil in Center
      if (sigilFn) sigilFn();

      ctx.restore();
    }

    // D. Procedural Iron Throne on 4-Tier Stone Dais
    renderProceduralIronThrone(ctx, cx, cy) {
      ctx.save();
      ctx.translate(cx, cy);

      // 4-Tier Stepped Stone Dais
      for (let i = 3; i >= 0; i--) {
        const dw = 140 + i * 22;
        const dh = 18;
        const dy = 30 + (3 - i) * dh;

        const g = ctx.createLinearGradient(-dw / 2, dy, dw / 2, dy);
        g.addColorStop(0, '#2b2622');
        g.addColorStop(0.5, '#453e38');
        g.addColorStop(1, '#221e1a');
        ctx.fillStyle = g;
        ctx.fillRect(-dw / 2, dy, dw, dh);

        ctx.strokeStyle = 'rgba(200, 180, 150, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-dw / 2, dy, dw, dh);
      }

      // Royal Crimson Carpet Runner down the steps
      const cGrad = ctx.createLinearGradient(-26, 0, 26, 0);
      cGrad.addColorStop(0, '#7f1d1d');
      cGrad.addColorStop(0.5, '#991b1b');
      cGrad.addColorStop(1, '#7f1d1d');
      ctx.fillStyle = cGrad;
      ctx.fillRect(-26, 30, 52, 72);

      // 160 Parametric Fused Blades (Iron Throne Silhouette)
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

        // 8-stop Specular Metallic Steel Gradient
        const mg = ctx.createLinearGradient(-wid, 0, wid, 0);
        mg.addColorStop(0.00, '#1c1917');
        mg.addColorStop(0.25, '#78716c');
        mg.addColorStop(0.48, '#44403c');
        mg.addColorStop(0.50, '#f5f5f4'); // Specular peak
        mg.addColorStop(0.52, '#57534e');
        mg.addColorStop(0.80, '#a8a29e');
        mg.addColorStop(1.00, '#1c1917');

        ctx.beginPath();
        ctx.moveTo(poly[0].x, poly[0].y);
        poly.forEach(pt => ctx.lineTo(pt.x, pt.y));
        ctx.closePath();
        ctx.fillStyle = mg;
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
      }

      // Central Throne Seat Cushion
      ctx.fillStyle = '#450a0a';
      ctx.beginPath();
      ctx.roundRect(-24, -12, 48, 32, 6);
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
    }

    // E. Procedural Octagonal Painted War Table with Topography
    renderProceduralWarTable(ctx, cx, cy, R) {
      ctx.save();
      ctx.translate(cx, cy);

      const drawOctagon = (r) => {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI / 4) + Math.PI / 8;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      };

      // 1. Table Cast Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      drawOctagon(R + 14);
      ctx.fill();

      // 2. Heavy Carved Oak Table Surface
      const wg = ctx.createRadialGradient(0, 0, 10, 0, 0, R);
      wg.addColorStop(0, '#78350f');
      wg.addColorStop(0.6, '#451a03');
      wg.addColorStop(1, '#290f02');
      ctx.fillStyle = wg;
      drawOctagon(R);
      ctx.fill();

      // 3. Beveled Carved Edge with Brass Corner Studs
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 4;
      drawOctagon(R);
      ctx.stroke();

      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = 1;
      drawOctagon(R - 4);
      ctx.stroke();

      // Corner brass rivets
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI / 4) + Math.PI / 8;
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * (R - 2), Math.sin(a) * (R - 2), 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Painted Relief Map of Westeros Topography (Procedural Coastlines & Mountains)
      ctx.save();
      drawOctagon(R - 10);
      ctx.clip();

      // Sea / Ocean tint
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(-R, -R, R * 2, R * 2);

      // Continent landmass
      ctx.fillStyle = '#78716c';
      ctx.beginPath();
      ctx.moveTo(-60, -R + 10);
      ctx.bezierCurveTo(40, -80, 20, -20, 65, 0);
      ctx.bezierCurveTo(80, 40, -10, 70, -40, 100);
      ctx.bezierCurveTo(-80, 60, -70, -20, -60, -R + 10);
      ctx.fill();

      // Mountain ridge contours
      ctx.strokeStyle = '#44403c';
      ctx.lineWidth = 1.5;
      for (let my = -60; my <= 60; my += 20) {
        ctx.beginPath();
        ctx.moveTo(-30, my);
        ctx.lineTo(0, my - 10);
        ctx.lineTo(30, my);
        ctx.stroke();
      }

      // Scattered miniature troop markers (red, gold, black wooden pawns)
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

      // 5. 13 High-Backed Carved Council Chairs around table
      for (let c = 0; c < 13; c++) {
        const ca = (c / 13) * Math.PI * 2 - Math.PI / 2;
        const cxp = Math.cos(ca) * (R + 26);
        const cyp = Math.sin(ca) * (R + 26);

        ctx.save();
        ctx.translate(cxp, cyp);
        ctx.rotate(ca + Math.PI / 2);

        // Chair Seat (Leather Cushion)
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.roundRect(-10, -8, 20, 16, 3);
        ctx.fill();

        // Carved Mahogany High Backrest
        ctx.fillStyle = '#290f02';
        ctx.fillRect(-12, 8, 24, 5);
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1;
        ctx.strokeRect(-12, 8, 24, 5);

        ctx.restore();
      }

      ctx.restore();
    }

    // F. Gothic Clustered Fluted Stone Pillars
    renderGothicPillars(ctx) {
      const pillarLocs = [
        [520, 200], [520, 400], [520, 600],
        [1080, 200], [1080, 400], [1080, 600],
        [680, 160], [920, 160]
      ];

      pillarLocs.forEach(pl => {
        const px = pl[0];
        const py = pl[1];

        // Pillar Soft Drop Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(px + 4, py + 4, 18, 0, Math.PI * 2);
        ctx.fill();

        // Stepped Plinth (3 Tiers)
        ctx.fillStyle = '#292524';
        ctx.beginPath();
        ctx.arc(px, py, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#57534e';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Fluted Clustered Core
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

    // G. Furniture in Castle Wings
    renderWingFurnishings(ctx) {
      // 1. Library Bookcases & Maester Desks (West Wing)
      ctx.fillStyle = '#3e2723';
      for (let by = 60; by <= 360; by += 45) {
        ctx.fillRect(45, by, 32, 38);
        ctx.strokeStyle = '#5d4037';
        ctx.lineWidth = 1;
        ctx.strokeRect(45, by, 32, 38);
        // Colored book spines
        const bookCols = ['#b71c1c', '#1b5e20', '#0d47a1', '#f57f17'];
        for (let bk = 0; bk < 4; bk++) {
          ctx.fillStyle = bookCols[bk % 4];
          ctx.fillRect(48, by + 4 + bk * 8, 24, 6);
        }
      }

      // Maester Study Desk
      ctx.fillStyle = '#4e342e';
      ctx.beginPath();
      ctx.roundRect(260, 240, 100, 48, 4);
      ctx.fill();
      ctx.strokeStyle = '#8d6e63';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Open Parchment & Astrolabe on desk
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(275, 250, 28, 20);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(335, 264, 8, 0, Math.PI * 2); ctx.stroke();

      // 2. Castle Forge Anvils & Hearth (East Wing)
      // Brick Hearth Smelting Furnace
      ctx.fillStyle = '#3e2723';
      ctx.fillRect(1240, 60, 110, 80);
      ctx.strokeStyle = '#5d4037';
      ctx.strokeRect(1240, 60, 110, 80);

      // Dual Heavy Iron Anvils
      [1260, 1340].forEach(ax => {
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.roundRect(ax, 260, 36, 18, 4);
        ctx.fill();
        ctx.strokeStyle = '#a8a29e';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // 3. Great Banquet Hall Fireplace with Stag Skull (South)
      ctx.fillStyle = '#262626';
      ctx.beginPath();
      ctx.roundRect(720, 560, 160, 70, 6);
      ctx.fill();
      ctx.strokeStyle = '#525252';
      ctx.stroke();

      // Mounted Great Stag Skull
      ctx.fillStyle = '#f5f5f4';
      ctx.beginPath();
      ctx.ellipse(800, 575, 12, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e7e5e4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(800, 565); ctx.lineTo(775, 545); ctx.lineTo(765, 535);
      ctx.moveTo(800, 565); ctx.lineTo(825, 545); ctx.lineTo(835, 535);
      ctx.stroke();

      // Long Banquet Feast Tables
      [420, 960].forEach(tx => {
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.roundRect(tx, 710, 180, 44, 4);
        ctx.fill();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
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

      // Check agents
      for (const a of this.agents) {
        if (Math.hypot(a.x - mx, a.y - my) < 26) {
          if (hud && hudIcon && hudTitle && hudDesc) {
            hud.style.opacity = '1';
            hudIcon.innerText = a.type === 'boss' ? '👑' : '⚔️';
            hudTitle.innerText = a.name;
            hudDesc.innerText = `${a.title} • ${a.state}`;
          }
          this.canvas.style.cursor = 'pointer';
          return;
        }
      }

      // Check stations
      for (const [key, s] of Object.entries(STATIONS)) {
        if (mx >= s.x - s.w / 2 && mx <= s.x + s.w / 2 && my >= s.y - s.h / 2 && my <= s.y + s.h / 2) {
          if (hud && hudIcon && hudTitle && hudDesc) {
            hud.style.opacity = '1';
            hudIcon.innerText = s.icon;
            hudTitle.innerText = s.name;
            hudDesc.innerText = s.desc;
          }
          this.canvas.style.cursor = 'pointer';
          return;
        }
      }

      if (hud) hud.style.opacity = '0';
      this.canvas.style.cursor = 'default';
    }

    handleClick(mx, my) {
      // 1. Click on Agent
      for (const a of this.agents) {
        if (Math.hypot(a.x - mx, a.y - my) < 26) {
          if (typeof focusOnAgent === 'function') {
            focusOnAgent(a.id);
          }
          if (a.state === 'IDLE_AT_DESK') {
            this.dispatchAgent(a.id, 'pantry', '🍗 Feast & Mead Break in Great Hall');
          } else {
            this.returnAgentToDesk(a);
          }
          return;
        }
      }

      // 2. Click on Station
      for (const [key, s] of Object.entries(STATIONS)) {
        if (mx >= s.x - s.w / 2 && mx <= s.x + s.w / 2 && my >= s.y - s.h / 2 && my <= s.y + s.h / 2) {
          if (key === 'briefing') {
            this.openConversationsModal();
            return;
          }
          const idle = this.agents.find(a => a.state === 'IDLE_AT_DESK');
          if (idle) {
            this.dispatchAgent(idle.id, key, `${s.icon} Inspecting ${s.name}`);
          }
          return;
        }
      }
    }

    dispatchAgent(agentId, stationKey, actionText) {
      const agent = this.agents.find(a => a.id === agentId);
      const station = STATIONS[stationKey];
      if (!agent || !station) return;

      const startKey = agent.aisleKey;
      const targetKey = station.terminalKey;
      const corridorWaypoints = aStarPath(startKey, targetKey);

      agent.pathQueue = [
        WAYPOINTS[agent.aisleKey],
        ...corridorWaypoints
      ];
      agent.currentWaypointIdx = 0;
      agent.targetStation = station;
      agent.state = 'WALKING';
      agent.bubbleText = actionText || `${station.icon} Operating ${station.name}`;
      agent.bubbleTimer = 360;
    }

    returnAgentToDesk(agent) {
      if (!agent || agent.state === 'IDLE_AT_DESK') return;
      const currentNearest = this.findNearestWaypoint(agent.x, agent.y);
      const returnWaypoints = aStarPath(currentNearest, agent.aisleKey);

      agent.pathQueue = [
        ...returnWaypoints,
        { x: agent.deskX, y: agent.deskY }
      ];
      agent.currentWaypointIdx = 0;
      agent.state = 'WALKING';
      agent.bubbleText = 'Task concluded. Returning to post.';
      agent.bubbleTimer = 180;
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
      if (this.particles.length < 120 && Math.random() < 0.6) {
        const emitters = [
          [1300, 100, '#ef4444'], // Forge
          [800, 600, '#f97316'],  // Hearth
          [170, 250, '#10b981']   // Alchemy
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

      // Update agents walking
      this.agents.forEach(a => {
        if (a.bubbleTimer > 0) a.bubbleTimer--;

        if (a.state === 'WALKING') {
          if (a.currentWaypointIdx < a.pathQueue.length) {
            const targetWP = a.pathQueue[a.currentWaypointIdx];
            const dx = targetWP.x - a.x;
            const dy = targetWP.y - a.y;
            const d = Math.hypot(dx, dy);

            if (d > 3) {
              const vx = (dx / d) * a.speed;
              const vy = (dy / d) * a.speed;
              a.x += vx;
              a.y += vy;
              a.walkCycle += 0.25;

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
              a.workTimer = 220;
            } else {
              a.state = 'IDLE_AT_DESK';
              a.facing = a.type === 'boss' ? 'down' : 'up';
            }
          }
        } else if (a.state === 'WORKING_AT_STATION') {
          a.workTimer--;
          if (a.workTimer <= 0) {
            this.returnAgentToDesk(a);
          }
        }
      });
    }

    render() {
      const ctx = this.ctx;
      ctx.save();
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Fit Viewport Transform
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

      // Optional Debug Waypoints
      if (this.showWaypoints) this.drawWaypointGraph();

      ctx.restore();
    }

    drawAmbientLighting() {
      const ctx = this.ctx;
      const flicker = Math.sin(this.tick * 0.12) * 5;

      // 1. Great Stag Hearth Fireplace (Center-South)
      const gHearth = ctx.createRadialGradient(800, 600, 5, 800, 600, 85 + flicker);
      gHearth.addColorStop(0, 'rgba(249, 115, 22, 0.45)');
      gHearth.addColorStop(0.5, 'rgba(234, 88, 12, 0.18)');
      gHearth.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gHearth;
      ctx.beginPath();
      ctx.arc(800, 600, 85 + flicker, 0, Math.PI * 2);
      ctx.fill();

      // 2. Royal Forge Smelting Hearth (East Wing)
      const gForge = ctx.createRadialGradient(1300, 100, 5, 1300, 100, 95 + flicker);
      gForge.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
      gForge.addColorStop(0.6, 'rgba(245, 158, 11, 0.22)');
      gForge.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gForge;
      ctx.beginPath();
      ctx.arc(1300, 100, 95 + flicker, 0, Math.PI * 2);
      ctx.fill();

      // 3. Alchemical Glowing Emerald Flasks (West Wing)
      const gAlchemy = ctx.createRadialGradient(170, 250, 2, 170, 250, 65 + flicker * 0.5);
      gAlchemy.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
      gAlchemy.addColorStop(0.6, 'rgba(5, 150, 105, 0.15)');
      gAlchemy.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gAlchemy;
      ctx.beginPath();
      ctx.arc(170, 250, 65 + flicker * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // 4. Standing Iron Braziers (6 Positions)
      const braziers = [
        [690, 360], [910, 360],
        [690, 520], [910, 520],
        [750, 190], [850, 190]
      ];
      braziers.forEach(b => {
        const gb = ctx.createRadialGradient(b[0], b[1], 2, b[0], b[1], 40 + flicker * 0.5);
        gb.addColorStop(0, 'rgba(245, 158, 11, 0.4)');
        gb.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gb;
        ctx.beginPath();
        ctx.arc(b[0], b[1], 40 + flicker * 0.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // 5. Dragon Cistern Water Ripple & Golden Duck (West Feast Hall)
      const gCistern = ctx.createRadialGradient(260, 730, 5, 260, 730, 55);
      gCistern.addColorStop(0, 'rgba(2, 132, 199, 0.4)');
      gCistern.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gCistern;
      ctx.beginPath();
      ctx.arc(260, 730, 55, 0, Math.PI * 2);
      ctx.fill();

      // Golden duck mascot
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      const duckWave = Math.sin(this.tick * 0.08) * 3;
      ctx.fillText('🦆', 260, 736 + duckWave);
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

      // 1. Soft Dynamic Contact Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.ellipse(0, 11, 10, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Walk Kinematics (Leg stride & Body bob)
      const isWalking = agent.state === 'WALKING';
      const legStep = isWalking ? Math.sin(agent.walkCycle) * 3.5 : 0;
      const bodyBob = isWalking ? Math.abs(Math.sin(agent.walkCycle)) * 1.2 : 0;

      // Iron / Leather Boots
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-6, 6 + legStep - bodyBob, 4, 6);
      ctx.fillRect(2, 6 - legStep - bodyBob, 4, 6);

      // Torso / Tunic with Role Sigil Accent
      ctx.fillStyle = agent.accentColor;
      ctx.beginPath();
      ctx.roundRect(-7, -6 - bodyBob, 14, 12, 3);
      ctx.fill();

      // Armor Gorget / Royal Sash
      ctx.fillStyle = agent.type === 'boss' ? '#fbbf24' : '#e2e8f0';
      ctx.fillRect(-2, -4 - bodyBob, 4, 6);

      // Head
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.roundRect(-7, -18 - bodyBob, 14, 12, 3);
      ctx.fill();

      // Hair / Cap / Helmet
      ctx.fillStyle = agent.hairColor || '#1e293b';
      ctx.fillRect(-7, -18 - bodyBob, 14, 4);

      // Crown for Boss / Eyes for others
      if (agent.type === 'boss') {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑', 0, -20 - bodyBob);
      } else {
        ctx.fillStyle = agent.hasError ? '#ef4444' : agent.accentColor;
        ctx.shadowColor = agent.hasError ? '#ef4444' : agent.accentColor;
        ctx.shadowBlur = 6;
        if (agent.facing === 'down') {
          ctx.fillRect(-5, -13 - bodyBob, 10, 3);
        } else if (agent.facing === 'right') {
          ctx.fillRect(-2, -13 - bodyBob, 7, 3);
        } else if (agent.facing === 'left') {
          ctx.fillRect(-5, -13 - bodyBob, 7, 3);
        }
        ctx.shadowBlur = 0;
      }

      // Ground Status Ring
      ctx.strokeStyle = agent.hasError ? '#ef4444' : agent.accentColor;
      ctx.lineWidth = agent.hasError ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(0, 8, 14, 0, Math.PI * 2);
      ctx.stroke();

      if (agent.hasError) {
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🚨', 0, -32 - bodyBob);
      }

      // Crisp Pill Badge above head
      ctx.fillStyle = 'rgba(7, 12, 24, 0.9)';
      ctx.strokeStyle = agent.hasError ? '#ef4444' : agent.accentColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-36, -34 - bodyBob, 72, 13, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(agent.name, 0, -25 - bodyBob);

      ctx.restore();
    }

    drawRPGBubble(agent) {
      if (!agent.bubbleText || agent.bubbleTimer <= 0) return;

      const ctx = this.ctx;
      ctx.save();
      ctx.translate(agent.x, agent.y);

      const text = agent.bubbleText;
      ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
      const textWidth = ctx.measureText(text).width;
      const bw = Math.max(90, textWidth + 24);
      const bh = 28;
      const by = -62;

      ctx.fillStyle = 'rgba(7, 12, 24, 0.95)';
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
        const char = this.agents.find(a => a.id === ag.id);
        if (char) {
          char.model = ag.model;
          char.role = ag.role;
          if (ag.accent_color) char.accentColor = ag.accent_color;
        }
      });
    }

    processTelemetry(events, conversations) {
      this.telemetryEvents = events || [];
      this.conversations = conversations || [];

      const recentTool = (events || []).find(e => e.type === 'tool_call');
      if (recentTool) {
        const char = this.agents.find(a => a.id === recentTool.agent);
        if (char && char.state === 'IDLE_AT_DESK') {
          const stationKey = recentTool.station || 'compiler';
          this.dispatchAgent(char.id, stationKey, this.formatActionBubble(recentTool.detail));
        }
      }

      if (conversations && conversations.length > 0 && Math.random() < 0.35) {
        const convo = conversations[0];
        const subagent = this.agents.find(a => a.id === convo.receiver);
        if (subagent && subagent.state === 'IDLE_AT_DESK') {
          this.dispatchAgent('vps-boss', 'briefing', `👑 Boss: "${convo.boss_order.slice(0, 36)}..."`);
          setTimeout(() => {
            this.dispatchAgent(subagent.id, 'briefing', `⚔️ ${subagent.id}: "Executing decree..."`);
          }, 600);
        }
      }
    }

    formatActionBubble(detail) {
      if (!detail) return 'Executing royal decree...';
      let clean = detail.replace(/->\s*/, '').replace(/\(.*\)/, '');
      if (detail.includes('web_search')) return '🔍 Scrying the known realms...';
      if (detail.includes('pytest')) return '🛡️ Testing armor invariants...';
      if (detail.includes('terminal')) return '🔨 Striking castle forge...';
      if (detail.includes('patch')) return '📜 Scribing scroll amendment...';
      if (detail.includes('read_file')) return '📖 Consulting library tome...';
      if (detail.includes('duckdb')) return '🦆 Channeling dragon cistern...';
      return clean.slice(0, 32);
    }

    openConversationsModal() {
      let modal = document.getElementById('convoModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'convoModal';
        modal.className = 'fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4';
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div class="bg-cyber-900 border border-cyber-700 rounded-2xl max-w-3xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh] font-sans">
          <div class="flex items-center justify-between border-b border-cyber-800 pb-4 mb-4">
            <div class="flex items-center space-x-3">
              <span class="text-2xl">⚔️</span>
              <div>
                <h2 class="text-base font-extrabold text-white">The Painted War Table — Royal Council Decrees</h2>
                <p class="text-xs text-slate-400">Transkrip nyata perintah delegasi vps-boss dan laporan balik para subagent.</p>
              </div>
            </div>
            <button onclick="document.getElementById('convoModal').remove()" class="w-8 h-8 rounded-lg bg-cyber-800 text-slate-400 hover:text-white flex items-center justify-center transition">✕</button>
          </div>

          <div class="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
            ${(this.conversations || []).map(c => `
              <div class="p-4 rounded-xl bg-cyber-950/80 border border-cyber-800/80 space-y-2">
                <div class="flex items-center justify-between font-mono text-[11px]">
                  <span class="font-bold text-amber-400">👑 vps-boss ➔ ⚔️ ${c.receiver}</span>
                  <span class="text-slate-500">${c.started_at || 'recent'}</span>
                </div>
                <div class="p-2.5 rounded-lg bg-amber-500/10 border-l-2 border-amber-500 text-slate-200">
                  <span class="font-bold text-amber-400">Royal Decree:</span> "${c.boss_order}"
                </div>
                ${c.subagent_reply ? `
                  <div class="p-2.5 rounded-lg bg-emerald-500/10 border-l-2 border-emerald-500 text-emerald-200">
                    <span class="font-bold text-emerald-400">${c.receiver} Report:</span> "${c.subagent_reply}"
                  </div>
                ` : ''}
                <div class="flex items-center space-x-2 text-[10px] text-slate-400 font-mono pt-1">
                  <span>Tools Used:</span>
                  ${(c.tools_used || []).map(t => `<span class="px-1.5 py-0.5 rounded bg-cyber-800 text-slate-300 font-bold">${t}</span>`).join(' ')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
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
