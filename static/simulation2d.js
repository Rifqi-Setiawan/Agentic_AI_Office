/**
 * Hermes Sovereign Stronghold — 2D Living Medieval Fantasy RPG Work Simulation
 * Inspired by Game of Thrones (Red Keep & Winterfell) + Stanford Generative Agents (Smallville)
 *
 * Features:
 * - 1600x900 High-detail Castle Stronghold Battle Map
 * - Fullscreen Edge-to-Edge Responsive Cover Viewport (Zero Padding / No Letterbox)
 * - 13 AI Agents stationed in authentic Stronghold locations:
 *   * vps-boss at The Iron Throne on the Elevated Dais
 *   * chief-architect, swe-backend, swe-frontend, swe-verifier, github-manager at The Painted War Table
 *   * professor & paperwright at The Grand Maester's Alchemical Library
 *   * devops-engineer at The Castle Blacksmith Forge & Armory
 *   * data-engineer, tech-mentor, ui-designer, vps-assistant at The Great Banquet Hearth Hall
 * - Dynamic Ambient Lighting:
 *   * Flickering torchlight braziers & fireplace hearths
 *   * Pulsing emerald alchemical flask phosphorescence
 *   * Fiery red forge smelting glow
 *   * Water cistern caustics & golden duck easter egg
 * - Topological A* Waypoint Hallway Navigation (Zero-Clipping)
 * - Smallville RPG Dialogue Balloons with Head-Anchored Pointers
 * - Session Replay Timeline Scrubber & Live Telemetry Stream
 */

(function() {
  'use strict';

  function dist(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  // --- 1. Stronghold Stations ---
  const STATIONS = {
    briefing: {
      id: 'briefing',
      name: 'The Painted War Table',
      desc: 'Dragonstone War Table with tactical markers & battle maps',
      x: 800, y: 414, w: 240, h: 140,
      color: '#3b82f6',
      icon: '⚔️',
      terminalKey: 'ST_WAR_TABLE'
    },
    throne: {
      id: 'throne',
      name: 'The Iron Throne Dais',
      desc: 'Forged iron throne on elevated stone steps with lion banners',
      x: 800, y: 110, w: 180, h: 100,
      color: '#f59e0b',
      icon: '👑',
      terminalKey: 'ST_THRONE'
    },
    library: {
      id: 'library',
      name: "The Grand Maester's Study",
      desc: 'Citadel library with astrolabe, parchment scrolls & grimoires',
      x: 320, y: 250, w: 200, h: 140,
      color: '#8b5cf6',
      icon: '📜',
      terminalKey: 'ST_LIBRARY'
    },
    crawler: {
      id: 'crawler',
      name: 'The Alchemical Laboratory',
      desc: 'Bubbling emerald flasks, alembics & arcane scrying vials',
      x: 170, y: 240, w: 120, h: 120,
      color: '#10b981',
      icon: '🧪',
      terminalKey: 'ST_ALCHEMY'
    },
    compiler: {
      id: 'compiler',
      name: 'The Royal Forge & Armory',
      desc: 'Blazing coal hearth, dual iron anvils & weapon toolracks',
      x: 1312, y: 216, w: 220, h: 150,
      color: '#ef4444',
      icon: '🔨',
      terminalKey: 'ST_FORGE'
    },
    quarantine: {
      id: 'quarantine',
      name: 'Armor Inspection Sentry Rack',
      desc: 'Valyrian steel armor stands, whetstones & quality check',
      x: 1220, y: 360, w: 140, h: 110,
      color: '#34d399',
      icon: '🛡️',
      terminalKey: 'ST_ARMOR_RACK'
    },
    pantry: {
      id: 'pantry',
      name: 'Great Banquet Hall & Ale Bar',
      desc: 'Tavern casks of mead, wine bottles & roasted trenchers',
      x: 1320, y: 720, w: 200, h: 140,
      color: '#d97706',
      icon: '🍗',
      terminalKey: 'ST_ALE_BAR'
    },
    lakehouse: {
      id: 'lakehouse',
      name: 'Subterranean Dragon Cistern',
      desc: 'Subterranean water basin with DuckDB golden mascot duck',
      x: 240, y: 720, w: 160, h: 140,
      color: '#0284c7',
      icon: '🦆',
      terminalKey: 'ST_CISTERN'
    },
    hearth: {
      id: 'hearth',
      name: 'Great Stag Hearth Fireplace',
      desc: 'Roaring log fire under the mounted great horned stag skull',
      x: 800, y: 585, w: 160, h: 90,
      color: '#f97316',
      icon: '🔥',
      terminalKey: 'ST_STAG_HEARTH'
    }
  };

  // --- 2. 13 Specialized Agent Roster in the Stronghold ---
  const AGENTS_ROSTER = [
    {
      id: 'vps-boss',
      name: 'vps-boss',
      title: 'Lord Commander & Orchestrator',
      accentColor: '#f59e0b',
      hairColor: '#0f172a',
      desk: { x: 800, y: 110 },
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
      desk: { x: 800, y: 350 },
      aisleKey: 'AE_ARCHITECT',
      bubble: 'Charting tactical war maps'
    },
    {
      id: 'swe-backend',
      name: 'swe-backend',
      title: 'Master of Server Strongholds',
      accentColor: '#10b981',
      hairColor: '#064e3b',
      desk: { x: 740, y: 414 },
      aisleKey: 'AE_BACKEND',
      bubble: 'Guarding ACID database gates'
    },
    {
      id: 'swe-frontend',
      name: 'swe-frontend',
      title: 'Royal Visual Artisan',
      accentColor: '#06b6d4',
      hairColor: '#083344',
      desk: { x: 740, y: 460 },
      aisleKey: 'AE_FRONTEND',
      bubble: 'Drafting responsive interfaces'
    },
    {
      id: 'swe-verifier',
      name: 'swe-verifier',
      title: 'High Sentry of Verification',
      accentColor: '#34d399',
      hairColor: '#022c22',
      desk: { x: 860, y: 414 },
      aisleKey: 'AE_VERIFIER',
      bubble: 'Zero-tolerance quality audit'
    },
    {
      id: 'github-manager',
      name: 'github-manager',
      title: 'Keeper of the Castle Armory & Git',
      accentColor: '#8b5cf6',
      hairColor: '#2e1065',
      desk: { x: 860, y: 460 },
      aisleKey: 'AE_GITHUB',
      bubble: 'Guarding release branches'
    },
    {
      id: 'professor',
      name: 'professor',
      title: 'Grand Maester of Research',
      accentColor: '#ec4899',
      hairColor: '#831843',
      desk: { x: 320, y: 250 },
      aisleKey: 'AE_PROFESSOR',
      bubble: 'Consulting ancient Citadel manuscripts'
    },
    {
      id: 'paperwright',
      name: 'paperwright',
      title: 'Citadel Scribe & Typesetter',
      accentColor: '#e11d48',
      hairColor: '#4c0519',
      desk: { x: 240, y: 340 },
      aisleKey: 'AE_PAPERWRIGHT',
      bubble: 'Illuminating parchment scrolls'
    },
    {
      id: 'devops-engineer',
      name: 'devops-engineer',
      title: 'Master Blacksmith & SRE',
      accentColor: '#f97316',
      hairColor: '#431407',
      desk: { x: 1280, y: 260 },
      aisleKey: 'AE_DEVOPS',
      bubble: 'Fueling container forge hearths'
    },
    {
      id: 'data-engineer',
      name: 'data-engineer',
      title: 'Keeper of the Dragon Cistern',
      accentColor: '#0284c7',
      hairColor: '#082f49',
      desk: { x: 460, y: 720 },
      aisleKey: 'AE_DATAENG',
      bubble: 'Diverting data pipeline aqueducts'
    },
    {
      id: 'tech-mentor',
      name: 'tech-mentor',
      title: 'Wise Mentor of the Great Hall',
      accentColor: '#14b8a6',
      hairColor: '#042f2e',
      desk: { x: 560, y: 720 },
      aisleKey: 'AE_MENTOR',
      bubble: 'Counseling junior squires & engineers'
    },
    {
      id: 'ui-designer',
      name: 'ui-designer',
      title: 'Royal Tapestry Weaver',
      accentColor: '#d946ef',
      hairColor: '#4a044e',
      desk: { x: 1040, y: 720 },
      aisleKey: 'AE_DESIGNER',
      bubble: 'Weaving heraldic tapestries'
    },
    {
      id: 'vps-assistant',
      name: 'vps-assistant',
      title: 'Castellan of Logistics & Larder',
      accentColor: '#a855f7',
      hairColor: '#3b0764',
      desk: { x: 1140, y: 720 },
      aisleKey: 'AE_ASSISTANT',
      bubble: 'Managing stronghold operations'
    }
  ];

  // --- 3. Waypoint Corridor Navigation Graph (Stronghold Architecture) ---
  const WAYPOINTS = {
    // North Dais Corridor
    'W_THRONE_EXIT':   { x: 800, y: 190, neighbors: ['W_THRONE_STEPS', 'ST_THRONE'] },
    'W_THRONE_STEPS':  { x: 800, y: 260, neighbors: ['W_THRONE_EXIT', 'C_NORTH_HALL'] },
    
    // North Arterial Hallway (Y = 320)
    'C_NORTH_HALL':    { x: 800, y: 320, neighbors: ['W_THRONE_STEPS', 'C_NW_DOOR', 'C_NE_DOOR', 'ST_WAR_NORTH'] },
    'C_NW_DOOR':       { x: 520, y: 320, neighbors: ['C_NORTH_HALL', 'W_LIB_EAST', 'C_WEST_BREEZEWAY'] },
    'C_NE_DOOR':       { x: 1080, y: 320, neighbors: ['C_NORTH_HALL', 'W_FORGE_WEST', 'C_EAST_BREEZEWAY'] },

    // West Wing: Library & Alchemy
    'W_LIB_EAST':      { x: 420, y: 320, neighbors: ['C_NW_DOOR', 'ST_LIBRARY', 'W_LIB_SOUTH'] },
    'ST_LIBRARY':      { x: 320, y: 250, neighbors: ['W_LIB_EAST', 'ST_ALCHEMY', 'AE_PROFESSOR'] },
    'ST_ALCHEMY':      { x: 170, y: 240, neighbors: ['ST_LIBRARY'] },
    'W_LIB_SOUTH':     { x: 320, y: 340, neighbors: ['W_LIB_EAST', 'AE_PAPERWRIGHT'] },

    // East Wing: Forge & Armory
    'W_FORGE_WEST':    { x: 1180, y: 320, neighbors: ['C_NE_DOOR', 'ST_FORGE', 'ST_ARMOR_RACK'] },
    'ST_FORGE':        { x: 1312, y: 216, neighbors: ['W_FORGE_WEST', 'AE_DEVOPS'] },
    'ST_ARMOR_RACK':   { x: 1220, y: 360, neighbors: ['W_FORGE_WEST'] },

    // Central War Table Array
    'ST_WAR_NORTH':    { x: 800, y: 350, neighbors: ['C_NORTH_HALL', 'ST_WAR_TABLE', 'AE_ARCHITECT'] },
    'ST_WAR_TABLE':    { x: 800, y: 414, neighbors: ['ST_WAR_NORTH', 'ST_WAR_WEST', 'ST_WAR_EAST', 'ST_WAR_SOUTH'] },
    'ST_WAR_WEST':     { x: 740, y: 440, neighbors: ['ST_WAR_TABLE', 'AE_BACKEND', 'AE_FRONTEND'] },
    'ST_WAR_EAST':     { x: 860, y: 440, neighbors: ['ST_WAR_TABLE', 'AE_VERIFIER', 'AE_GITHUB'] },
    'ST_WAR_SOUTH':    { x: 800, y: 520, neighbors: ['ST_WAR_TABLE', 'ST_STAG_HEARTH', 'C_SOUTH_HALL'] },

    // Central Stag Fireplace & Archway
    'ST_STAG_HEARTH':  { x: 800, y: 585, neighbors: ['ST_WAR_SOUTH', 'C_SOUTH_HALL'] },

    // Vertical Outer Breezeways
    'C_WEST_BREEZEWAY':{ x: 520, y: 480, neighbors: ['C_NW_DOOR', 'C_SW_DOOR'] },
    'C_EAST_BREEZEWAY':{ x: 1080, y: 480, neighbors: ['C_NE_DOOR', 'C_SE_DOOR'] },

    // South Arterial Hallway (Y = 640)
    'C_SOUTH_HALL':    { x: 800, y: 640, neighbors: ['ST_STAG_HEARTH', 'C_SW_DOOR', 'C_SE_DOOR'] },
    'C_SW_DOOR':       { x: 520, y: 640, neighbors: ['C_SOUTH_HALL', 'C_WEST_BREEZEWAY', 'W_FEAST_WEST'] },
    'C_SE_DOOR':       { x: 1080, y: 640, neighbors: ['C_SOUTH_HALL', 'C_EAST_BREEZEWAY', 'W_FEAST_EAST'] },

    // Banquet Feast Hall
    'W_FEAST_WEST':    { x: 520, y: 720, neighbors: ['C_SW_DOOR', 'ST_CISTERN', 'AE_DATAENG', 'AE_MENTOR'] },
    'ST_CISTERN':      { x: 240, y: 720, neighbors: ['W_FEAST_WEST'] },
    'W_FEAST_EAST':    { x: 1080, y: 720, neighbors: ['C_SE_DOOR', 'ST_ALE_BAR', 'AE_DESIGNER', 'AE_ASSISTANT'] },
    'ST_ALE_BAR':      { x: 1320, y: 720, neighbors: ['W_FEAST_EAST'] },

    // Station Terminals
    'ST_THRONE':       { x: 800, y: 110, neighbors: ['W_THRONE_EXIT'] },

    // Aisle Exits from Desks
    'AE_BOSS':         { x: 800, y: 150, neighbors: ['W_THRONE_EXIT'] },
    'AE_ARCHITECT':    { x: 800, y: 350, neighbors: ['ST_WAR_NORTH'] },
    'AE_BACKEND':      { x: 740, y: 414, neighbors: ['ST_WAR_WEST'] },
    'AE_FRONTEND':     { x: 740, y: 460, neighbors: ['ST_WAR_WEST'] },
    'AE_VERIFIER':     { x: 860, y: 414, neighbors: ['ST_WAR_EAST'] },
    'AE_GITHUB':       { x: 860, y: 460, neighbors: ['ST_WAR_EAST'] },
    'AE_PROFESSOR':    { x: 320, y: 250, neighbors: ['ST_LIBRARY'] },
    'AE_PAPERWRIGHT':  { x: 240, y: 340, neighbors: ['W_LIB_SOUTH'] },
    'AE_DEVOPS':       { x: 1280, y: 260, neighbors: ['ST_FORGE'] },
    'AE_DATAENG':      { x: 460, y: 720, neighbors: ['W_FEAST_WEST'] },
    'AE_MENTOR':       { x: 560, y: 720, neighbors: ['W_FEAST_WEST'] },
    'AE_DESIGNER':     { x: 1040, y: 720, neighbors: ['W_FEAST_EAST'] },
    'AE_ASSISTANT':    { x: 1140, y: 720, neighbors: ['W_FEAST_EAST'] }
  };

  // --- 4. A* Shortest Pathfinding on Stronghold Graph ---
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

  // --- 5. Main Stronghold Simulation Class ---
  class CyberOfficeSimulation {
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

      // Offscreen Pre-baked Canvas
      this.floorCanvas = document.createElement('canvas');
      this.floorCanvas.width = this.virtualWidth;
      this.floorCanvas.height = this.virtualHeight;
      this.floorCtx = this.floorCanvas.getContext('2d');
      this.floorReady = false;

      this.initAgents();
      this.bakeFloor();
      this.setupInteractions();
      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.startLoop();
    }

    resize() {
      if (!this.canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.displayWidth = window.innerWidth;
      this.displayHeight = window.innerHeight;
      this.canvas.width = this.displayWidth * dpr;
      this.canvas.height = this.displayHeight * dpr;

      // Cover scaling: fills entire screen edge-to-edge without black borders
      this.scale = Math.max(
        this.canvas.width / this.virtualWidth,
        this.canvas.height / this.virtualHeight
      );
      this.offsetX = (this.canvas.width - this.virtualWidth * this.scale) / 2;
      this.offsetY = (this.canvas.height - this.virtualHeight * this.scale) / 2;
    }

    bakeFloor() {
      this.mapImage = new Image();
      this.mapImage.src = '/assets/stronghold_map.jpg';
      this.mapImage.onload = () => {
        this.floorCtx.drawImage(this.mapImage, 0, 0, this.virtualWidth, this.virtualHeight);
        this.floorReady = true;
      };
      this.mapImage.onerror = () => {
        console.warn('Stronghold map asset failed to load, falling back to procedural background');
        this.floorCtx.fillStyle = '#0f172a';
        this.floorCtx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);
        this.floorReady = true;
      };
    }

    initAgents() {
      this.agents = AGENTS_ROSTER.map((a, idx) => ({
        ...a,
        x: a.desk.x,
        y: a.desk.y,
        deskX: a.desk.x,
        deskY: a.desk.y,
        state: 'IDLE_AT_DESK', // 'WALKING', 'WORKING_AT_STATION'
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

    // --- Corridor Waypoint Navigation Core ---
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

    // --- Main Simulation Loop ---
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
            // Finished walking path
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

      // Apply Fullscreen Cover transform
      ctx.translate(this.offsetX, this.offsetY);
      ctx.scale(this.scale, this.scale);

      // Layer 0: High-detail Stronghold Map
      if (this.floorReady) {
        ctx.drawImage(this.floorCanvas, 0, 0, this.virtualWidth, this.virtualHeight);
      } else {
        ctx.fillStyle = '#0a0d14';
        ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);
      }

      // Layer 1: Ambient Torchlight & Flickering Fireplaces
      this.drawAmbientLighting();

      // Layer 2: Characters (Y-sorted for proper 2D depth)
      const sortedAgents = [...this.agents].sort((a, b) => a.y - b.y);
      sortedAgents.forEach(a => this.drawCharacter(a));

      // Layer 3: Smallville RPG Dialogue Balloons
      sortedAgents.forEach(a => this.drawRPGBubble(a));

      // Optional Debug Waypoints
      if (this.showWaypoints) this.drawWaypointGraph();

      ctx.restore();
    }

    // --- Dynamic Ambient Torchlight & Braziers ---
    drawAmbientLighting() {
      const ctx = this.ctx;
      const flicker = Math.sin(this.tick * 0.12) * 4;

      // 1. Great Stag Hearth Fireplace (Center-South)
      const gHearth = ctx.createRadialGradient(800, 585, 5, 800, 585, 75 + flicker);
      gHearth.addColorStop(0, 'rgba(249, 115, 22, 0.45)');
      gHearth.addColorStop(0.5, 'rgba(234, 88, 12, 0.18)');
      gHearth.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gHearth;
      ctx.beginPath();
      ctx.arc(800, 585, 75 + flicker, 0, Math.PI * 2);
      ctx.fill();

      // 2. Royal Forge Blazing Hearth (East Wing)
      const gForge = ctx.createRadialGradient(1340, 210, 5, 1340, 210, 85 + flicker);
      gForge.addColorStop(0, 'rgba(239, 68, 68, 0.5)');
      gForge.addColorStop(0.6, 'rgba(245, 158, 11, 0.2)');
      gForge.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gForge;
      ctx.beginPath();
      ctx.arc(1340, 210, 85 + flicker, 0, Math.PI * 2);
      ctx.fill();

      // 3. Alchemical Glowing Emerald Flasks (West Wing)
      const gAlchemy = ctx.createRadialGradient(170, 240, 2, 170, 240, 55 + flicker * 0.5);
      gAlchemy.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
      gAlchemy.addColorStop(0.6, 'rgba(5, 150, 105, 0.12)');
      gAlchemy.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gAlchemy;
      ctx.beginPath();
      ctx.arc(170, 240, 55 + flicker * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // 4. War Table Braziers (4 Corners of War Table)
      const braziers = [
        [730, 350], [870, 350],
        [730, 480], [870, 480],
        [760, 200], [840, 200]
      ];
      braziers.forEach(b => {
        const gb = ctx.createRadialGradient(b[0], b[1], 2, b[0], b[1], 35 + flicker * 0.5);
        gb.addColorStop(0, 'rgba(245, 158, 11, 0.35)');
        gb.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gb;
        ctx.beginPath();
        ctx.arc(b[0], b[1], 35 + flicker * 0.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // 5. Dragon Cistern Water Ripple with Duck (West Feast Hall)
      const gCistern = ctx.createRadialGradient(240, 720, 5, 240, 720, 50);
      gCistern.addColorStop(0, 'rgba(2, 132, 199, 0.35)');
      gCistern.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gCistern;
      ctx.beginPath();
      ctx.arc(240, 720, 50, 0, Math.PI * 2);
      ctx.fill();

      // Floating DuckDB mascot
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      const duckWave = Math.sin(this.tick * 0.08) * 3;
      ctx.fillText('🦆', 240, 726 + duckWave);
    }

    // --- Chibi Character Rendering with medieval knightly styling ---
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

      // Chainmail / Armor gorget or Royal Sash
      ctx.fillStyle = agent.type === 'boss' ? '#fbbf24' : '#e2e8f0';
      ctx.fillRect(-2, -4 - bodyBob, 4, 6);

      // Head
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.roundRect(-7, -18 - bodyBob, 14, 12, 3);
      ctx.fill();

      // Hair / Hood / Helmet
      ctx.fillStyle = agent.hairColor || '#1e293b';
      ctx.fillRect(-7, -18 - bodyBob, 14, 4);

      // Crown for Boss / Eyes for others
      if (agent.type === 'boss') {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑', 0, -20 - bodyBob);
      } else {
        // Glowing Visor or Eye Glint
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

      // Ground Status Ring (Glowing Red on Error)
      ctx.strokeStyle = agent.hasError ? '#ef4444' : agent.accentColor;
      ctx.lineWidth = agent.hasError ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(0, 8, 14, 0, Math.PI * 2);
      ctx.stroke();

      // Error Alert Icon above head
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

    // --- Smallville Comic RPG Speech & Thought Bubbles ---
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

      // Bubble Box (Dark Glass with Glowing Border)
      ctx.fillStyle = 'rgba(7, 12, 24, 0.95)';
      ctx.strokeStyle = agent.hasError ? '#ef4444' : agent.accentColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-bw / 2, by, bw, bh, 8);
      ctx.fill();
      ctx.stroke();

      // Arrow Tail pointing directly to head
      ctx.fillStyle = 'rgba(7, 12, 24, 0.95)';
      ctx.beginPath();
      ctx.moveTo(-5, by + bh);
      ctx.lineTo(5, by + bh);
      ctx.lineTo(0, by + bh + 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = agent.hasError ? '#ef4444' : agent.accentColor;
      ctx.stroke();

      // Dialogue Text
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(text, 0, by + 18);

      ctx.restore();
    }

    // --- Live Backend Telemetry Integration ---
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

      // Check for active tool call
      const recentTool = (events || []).find(e => e.type === 'tool_call');
      if (recentTool) {
        const char = this.agents.find(a => a.id === recentTool.agent);
        if (char && char.state === 'IDLE_AT_DESK') {
          const stationKey = recentTool.station || 'compiler';
          this.dispatchAgent(char.id, stationKey, this.formatActionBubble(recentTool.detail));
        }
      }

      // Check for recent delegations to trigger War Table meeting
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
      if (detail.includes('pytest')) return '🛡️ Testing armor & blade invariants...';
      if (detail.includes('terminal')) return '🔨 Striking the castle forge...';
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

  window.CyberOfficeSimulation = CyberOfficeSimulation;
})();
