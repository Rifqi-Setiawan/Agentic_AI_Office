/**
     * Hermes Sovereign Cyber-Office 2D Engine
     * Author: ui-designer (Principal UI/UX Design Engineer)
     */

    // --- 1. Waypoint Corridor Navigation Graph ---
    const WAYPOINTS = {
      // North Arterial Highway (Y = 280)
      'C_NW':         { x: 210, y: 280, neighbors: ['C_NW_MID', 'DR_LIBRARY', 'DR_MAINFRAME'] },
      'C_NW_MID':     { x: 350, y: 280, neighbors: ['C_NW', 'C_N_WEST', 'C_V_WEST_MID', 'AE_PAPERWRIGHT'] },
      'C_N_WEST':     { x: 500, y: 280, neighbors: ['C_NW_MID', 'C_N_CENTER', 'AE_BACKEND'] },
      'C_N_CENTER':   { x: 700, y: 280, neighbors: ['C_N_WEST', 'C_N_EAST', 'DR_BOSS', 'DR_WARROOM_N'] },
      'C_N_EAST':     { x: 900, y: 280, neighbors: ['C_N_CENTER', 'C_NE_MID', 'AE_DEVOPS', 'AE_ARCHITECT'] },
      'C_NE_MID':     { x: 1000, y: 280, neighbors: ['C_N_EAST', 'C_NE', 'C_V_EAST_MID'] },
      'C_NE':         { x: 1190, y: 280, neighbors: ['C_NE_MID', 'DR_RADAR', 'DR_CLEANROOM'] },

      // South Arterial Highway (Y = 620)
      'C_SW':         { x: 210, y: 620, neighbors: ['C_SW_MID', 'DR_LAKEHOUSE'] },
      'C_SW_MID':     { x: 350, y: 620, neighbors: ['C_SW', 'C_S_WEST', 'C_V_WEST_MID'] },
      'C_S_WEST':     { x: 500, y: 620, neighbors: ['C_SW_MID', 'C_S_CENTER', 'AE_DATAENG', 'AE_MENTOR'] },
      'C_S_CENTER':   { x: 700, y: 620, neighbors: ['C_S_WEST', 'C_S_EAST', 'DR_WARROOM_S', 'DR_DESIGN_S'] },
      'C_S_EAST':     { x: 900, y: 620, neighbors: ['C_S_CENTER', 'C_SE_MID', 'AE_GITHUB', 'AE_ASSISTANT'] },
      'C_SE_MID':     { x: 1000, y: 620, neighbors: ['C_S_EAST', 'C_SE', 'C_V_EAST_MID'] },
      'C_SE':         { x: 1190, y: 620, neighbors: ['C_SE_MID', 'DR_PANTRY'] },

      // Vertical Breezeways
      'C_V_WEST_MID': { x: 350, y: 450, neighbors: ['C_NW_MID', 'C_SW_MID', 'AE_FRONTEND'] },
      'C_V_EAST_MID': { x: 1000, y: 450, neighbors: ['C_NE_MID', 'C_SE_MID', 'AE_VERIFIER'] },

      // Doorway Thresholds
      'DR_BOSS':      { x: 700, y: 220, neighbors: ['C_N_CENTER', 'AE_BOSS', 'ST_BOSS'] },
      'DR_LIBRARY':   { x: 210, y: 240, neighbors: ['C_NW', 'AE_PROFESSOR', 'ST_LIBRARY'] },
      'DR_MAINFRAME': { x: 210, y: 320, neighbors: ['C_NW', 'ST_MAINFRAME'] },
      'DR_LAKEHOUSE': { x: 210, y: 655, neighbors: ['C_SW', 'ST_LAKEHOUSE'] },
      'DR_RADAR':     { x: 1190, y: 240, neighbors: ['C_NE', 'ST_RADAR'] },
      'DR_CLEANROOM': { x: 1190, y: 320, neighbors: ['C_NE', 'ST_CLEANROOM'] },
      'DR_PANTRY':    { x: 1190, y: 655, neighbors: ['C_SE', 'ST_PANTRY'] },
      'DR_WARROOM_N': { x: 700, y: 350, neighbors: ['C_N_CENTER', 'ST_WARROOM_WEST', 'ST_WARROOM_EAST'] },
      'DR_WARROOM_S': { x: 700, y: 550, neighbors: ['C_S_CENTER', 'ST_WARROOM_WEST', 'ST_WARROOM_EAST'] },
      'DR_DESIGN_S':  { x: 700, y: 660, neighbors: ['C_S_CENTER', 'AE_DESIGNER', 'ST_DESIGN'] },

      // Apparatus Operational Terminals
      'ST_BOSS':          { x: 700, y: 170, neighbors: ['DR_BOSS'] },
      'ST_LIBRARY':       { x: 210, y: 170, neighbors: ['DR_LIBRARY'] },
      'ST_MAINFRAME':     { x: 210, y: 420, neighbors: ['DR_MAINFRAME'] },
      'ST_LAKEHOUSE':     { x: 210, y: 720, neighbors: ['DR_LAKEHOUSE'] },
      'ST_RADAR':         { x: 1190, y: 170, neighbors: ['DR_RADAR'] },
      'ST_CLEANROOM':     { x: 1190, y: 420, neighbors: ['DR_CLEANROOM'] },
      'ST_PANTRY':        { x: 1190, y: 720, neighbors: ['DR_PANTRY'] },
      'ST_WARROOM_WEST':  { x: 640, y: 450, neighbors: ['DR_WARROOM_N', 'DR_WARROOM_S'] },
      'ST_WARROOM_EAST':  { x: 760, y: 450, neighbors: ['DR_WARROOM_N', 'DR_WARROOM_S'] },
      'ST_DESIGN':        { x: 700, y: 740, neighbors: ['DR_DESIGN_S'] },

      // Agent Aisle Exits
      'AE_BOSS':        { x: 700, y: 190, neighbors: ['DR_BOSS'] },
      'AE_PROFESSOR':   { x: 210, y: 190, neighbors: ['DR_LIBRARY'] },
      'AE_ARCHITECT':   { x: 900, y: 250, neighbors: ['C_N_EAST'] },
      'AE_PAPERWRIGHT': { x: 290, y: 250, neighbors: ['C_NW_MID'] },
      'AE_BACKEND':     { x: 380, y: 370, neighbors: ['C_N_WEST', 'C_V_WEST_MID'] },
      'AE_FRONTEND':    { x: 380, y: 490, neighbors: ['C_V_WEST_MID'] },
      'AE_DATAENG':     { x: 380, y: 560, neighbors: ['C_S_WEST', 'C_V_WEST_MID'] },
      'AE_DEVOPS':      { x: 970, y: 370, neighbors: ['C_N_EAST', 'C_V_EAST_MID'] },
      'AE_VERIFIER':    { x: 970, y: 490, neighbors: ['C_V_EAST_MID'] },
      'AE_GITHUB':      { x: 970, y: 560, neighbors: ['C_S_EAST', 'C_V_EAST_MID'] },
      'AE_DESIGNER':    { x: 640, y: 660, neighbors: ['DR_DESIGN_S'] },
      'AE_MENTOR':      { x: 500, y: 660, neighbors: ['C_S_WEST'] },
      'AE_ASSISTANT':   { x: 900, y: 660, neighbors: ['C_S_EAST'] }
    };

    // A* Shortest Pathfinding on Waypoint Graph
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
        for (const nKey of neighbors) {
          const nNode = WAYPOINTS[nKey];
          if (!nNode) continue;
          const tentativeG = gScore[current] + dist(WAYPOINTS[current], nNode);
          if (tentativeG < (gScore[nKey] ?? Infinity)) {
            cameFrom[nKey] = current;
            gScore[nKey] = tentativeG;
            fScore[nKey] = tentativeG + dist(nNode, WAYPOINTS[endKey]);
            if (!openSet.includes(nKey)) openSet.push(nKey);
          }
        }
      }
      return [WAYPOINTS[endKey]];
    }

    function dist(p1, p2) {
      return Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }

    // --- 2. Station Apparatus Definitions ---
    const STATIONS = {
      briefing: {
        id: 'briefing',
        name: 'Central Briefing War Room',
        x: 700, y: 450, w: 220, h: 140,
        color: '#2563eb',
        icon: '🤝',
        terminalKey: 'ST_WARROOM_WEST'
      },
      compiler: {
        id: 'compiler',
        name: 'Git Core Mainframe Server Lab',
        x: 210, y: 440, w: 220, h: 180,
        color: '#10b981',
        icon: '💻',
        terminalKey: 'ST_MAINFRAME'
      },
      quarantine: {
        id: 'quarantine',
        name: 'QA Cleanroom Quarantine Pod',
        x: 1190, y: 440, w: 220, h: 180,
        color: '#34d399',
        icon: '🛡️',
        terminalKey: 'ST_CLEANROOM'
      },
      crawler: {
        id: 'crawler',
        name: 'Web Intel & Satellite Hub',
        x: 1190, y: 150, w: 220, h: 150,
        color: '#f59e0b',
        icon: '📡',
        terminalKey: 'ST_RADAR'
      },
      lakehouse: {
        id: 'lakehouse',
        name: 'DuckDB Lakehouse Basin',
        x: 210, y: 750, w: 220, h: 160,
        color: '#0284c7',
        icon: '🦆',
        terminalKey: 'ST_LAKEHOUSE'
      },
      library: {
        id: 'library',
        name: 'Quantum Research Archives',
        x: 210, y: 150, w: 220, h: 150,
        color: '#8b5cf6',
        icon: '📚',
        terminalKey: 'ST_LIBRARY'
      },
      pantry: {
        id: 'pantry',
        name: 'Cyber Café & Energy Lounge',
        x: 1190, y: 750, w: 220, h: 160,
        color: '#ea580c',
        icon: '☕',
        terminalKey: 'ST_PANTRY'
      },
      design: {
        id: 'design',
        name: 'Holo-Design Canvas Studio',
        x: 700, y: 750, w: 220, h: 150,
        color: '#ec4899',
        icon: '🎨',
        terminalKey: 'ST_DESIGN'
      }
    };

    // --- 3. 13 Specialized Agent Workstations & Personas ---
    const AGENTS_ROSTER = [
      {
        id: 'vps-boss',
        name: 'vps-boss',
        title: 'Chief Orchestrator',
        accentColor: '#f59e0b',
        hairColor: '#0f172a',
        desk: { x: 700, y: 130 },
        aisleKey: 'AE_BOSS',
        bubble: 'Orchestrating sovereign AI squad & pipelines',
        type: 'boss'
      },
      {
        id: 'professor',
        name: 'professor',
        title: 'Research Scientist',
        accentColor: '#8b5cf6',
        hairColor: '#475569',
        desk: { x: 210, y: 130 },
        aisleKey: 'AE_PROFESSOR',
        bubble: 'Auditing primary source research literature'
      },
      {
        id: 'paperwright',
        name: 'paperwright',
        title: 'IEEE LaTeX Specialist',
        accentColor: '#e11d48',
        hairColor: '#334155',
        desk: { x: 290, y: 210 },
        aisleKey: 'AE_PAPERWRIGHT',
        bubble: 'Typesetting two-column IEEEtran proofs'
      },
      {
        id: 'chief-architect',
        name: 'chief-architect',
        title: 'Principal Systems Architect',
        accentColor: '#06b6d4',
        hairColor: '#1e293b',
        desk: { x: 900, y: 210 },
        aisleKey: 'AE_ARCHITECT',
        bubble: 'Drafting microservice DAG contracts'
      },
      {
        id: 'swe-backend',
        name: 'swe-backend',
        title: 'Backend Software Engineer',
        accentColor: '#10b981',
        hairColor: '#0f172a',
        desk: { x: 450, y: 370 },
        aisleKey: 'AE_BACKEND',
        bubble: 'Maintaining ACID transactional loops'
      },
      {
        id: 'swe-frontend',
        name: 'swe-frontend',
        title: 'Frontend UI/UX Specialist',
        accentColor: '#38bdf8',
        hairColor: '#475569',
        desk: { x: 450, y: 490 },
        aisleKey: 'AE_FRONTEND',
        bubble: 'Polishing high-density anti-slop UI components'
      },
      {
        id: 'data-engineer',
        name: 'data-engineer',
        title: 'Data Lakehouse Engineer',
        accentColor: '#0284c7',
        hairColor: '#1e293b',
        desk: { x: 450, y: 560 },
        aisleKey: 'AE_DATAENG',
        bubble: 'Syncing DuckDB Medallion Lakehouse'
      },
      {
        id: 'devops-engineer',
        name: 'devops-engineer',
        title: 'Site Reliability Engineer',
        accentColor: '#f97316',
        hairColor: '#334155',
        desk: { x: 950, y: 370 },
        aisleKey: 'AE_DEVOPS',
        bubble: 'Monitoring zero-overhead vitals: <45MB'
      },
      {
        id: 'swe-verifier',
        name: 'swe-verifier',
        title: 'Independent QA Engineer',
        accentColor: '#34d399',
        hairColor: '#1e293b',
        desk: { x: 950, y: 490 },
        aisleKey: 'AE_VERIFIER',
        bubble: 'Zero-unknown invariant QA certification'
      },
      {
        id: 'github-manager',
        name: 'github-manager',
        title: 'Global Git & Release PIC',
        accentColor: '#a855f7',
        hairColor: '#0f172a',
        desk: { x: 950, y: 560 },
        aisleKey: 'AE_GITHUB',
        bubble: 'Guarding clean commit graph hygiene'
      },
      {
        id: 'ui-designer',
        name: 'ui-designer',
        title: 'Principal Design Engineer',
        accentColor: '#ec4899',
        hairColor: '#581c87',
        desk: { x: 640, y: 720 },
        aisleKey: 'AE_DESIGNER',
        bubble: 'Designing 2D Cyber-Office visual blueprints'
      },
      {
        id: 'tech-mentor',
        name: 'tech-mentor',
        title: 'Technical Mentor & Educator',
        accentColor: '#14b8a6',
        hairColor: '#1e293b',
        desk: { x: 450, y: 720 },
        aisleKey: 'AE_MENTOR',
        bubble: 'Ready for interactive systems pedagogy'
      },
      {
        id: 'vps-assistant',
        name: 'vps-assistant',
        title: 'Executive Assistant',
        accentColor: '#38bdf8',
        hairColor: '#0f172a',
        desk: { x: 950, y: 720 },
        aisleKey: 'AE_ASSISTANT',
        bubble: 'Standing by for switchboard routing'
      }
    ];

    // --- 4. Main Simulation Class ---
    class CyberOfficeSimulation {
      constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.virtualWidth = 1400;
        this.virtualHeight = 900;
        if (this.canvas) {
          this.canvas.width = this.virtualWidth;
          this.canvas.height = this.virtualHeight;
        }
        
        this.showWaypoints = false;
        this.tick = 0;
        this.fps = 60;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;

        // Offscreen pre-baked floor canvas for 60 FPS performance
        this.floorCanvas = document.createElement('canvas');
        this.floorCanvas.width = this.virtualWidth;
        this.floorCanvas.height = this.virtualHeight;
        this.floorCtx = this.floorCanvas.getContext('2d');

        this.initAgents();
        this.bakeFloor();
        this.setupInteractions();
        this.startLoop();
      }

      initAgents() {
        this.agents = AGENTS_ROSTER.map((a, idx) => ({
          ...a,
          x: a.desk.x,
          y: a.desk.y + 20,
          deskX: a.desk.x,
          deskY: a.desk.y + 20,
          state: 'IDLE_AT_DESK', // 'WALKING', 'WORKING_AT_STATION'
          facing: 'up',
          speed: 2.8,
          walkCycle: 0,
          bubbleText: a.bubble,
          bubbleTimer: (idx % 3 === 0) ? 600 : 0, // Show initial bubbles on key agents
          pathQueue: [],
          currentWaypointIdx: 0,
          targetStation: null
        }));
      }

      bakeFloor() {
        const ctx = this.floorCtx;
        
        // 1. Dark Cyber-Slate Base
        ctx.fillStyle = '#070c18';
        ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);

        // 2. Beveled 32px Slate Tiles
        ctx.lineWidth = 1;
        for (let x = 0; x < this.virtualWidth; x += 32) {
          for (let y = 0; y < this.virtualHeight; y += 32) {
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.035)';
            ctx.strokeRect(x, y, 32, 32);
            ctx.strokeStyle = '#04070f';
            ctx.strokeRect(x + 1, y + 1, 30, 30);
          }
        }

        // 3. Zone Demarcations & Flooring Materials
        // Executive Suite Hardwood Oak Parquet
        this.renderParquet(ctx, 470, 50, 460, 170, '#29180d', '#382012');
        
        // Cyber Lounge Hardwood Oak Parquet
        this.renderParquet(ctx, 1050, 650, 300, 200, '#29180d', '#3d2617');

        // Git Mainframe Industrial Caution Stripes
        this.renderCautionStripes(ctx, 50, 320, 300, 260);

        // QA Cleanroom Sterilized Mint Floor
        this.renderCleanroomFloor(ctx, 1050, 320, 300, 260);

        // Research Library Persian Wine Carpet
        this.renderZoneRug(ctx, 50, 50, 320, 190, 'rgba(76, 5, 25, 0.35)', 'Quantum Research Wing');

        // Web Radar Gold Ring Zone
        this.renderZoneRug(ctx, 1050, 50, 300, 190, 'rgba(120, 53, 15, 0.35)', 'Web Intel & Satellite Hub');

        // 4. Glowing Neon Circuit Bus Lines in Corridors
        this.renderCircuitTraces(ctx);
      }

      renderParquet(ctx, x, y, w, h, c1, c2) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        
        // Staggered 3-strip interlocking parquet wood planks
        const pw = 48, ph = 14;
        for (let py = y; py < y + h; py += ph) {
          const rowIdx = Math.floor((py - y) / ph);
          const xOffset = (rowIdx % 2) * (pw / 2);
          for (let px = x - pw; px < x + w + pw; px += pw) {
            const rx = px + xOffset;
            const isAlternate = (Math.floor(rx / pw) + rowIdx) % 3 === 0;
            ctx.fillStyle = isAlternate ? c2 : c1;
            ctx.fillRect(rx, py, pw - 1, ph - 1);

            // Subtle longitudinal wood grain lines
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
            ctx.lineWidth = 1;
            ctx.strokeRect(rx, py, pw, ph);

            // Grain streak
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
            ctx.beginPath();
            ctx.moveTo(rx + 4, py + ph / 2);
            ctx.lineTo(rx + pw - 6, py + ph / 2);
            ctx.stroke();
          }
        }
        ctx.restore();
        // Rich warm amber perimeter border
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
      }

      renderCautionStripes(ctx, x, y, w, h) {
        // Base dark rubber mat
        ctx.fillStyle = '#111827';
        ctx.fillRect(x, y, w, h);

        // Caution diagonal borders
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#eab308';
        ctx.strokeRect(x + 7, y + 7, w - 14, h - 14);

        // Diagonal hazard stripes along border
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 4;
        for (let i = -w; i < w + h; i += 18) {
          ctx.beginPath();
          ctx.moveTo(x + i, y);
          ctx.lineTo(x + i + 20, y + 14);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + i, y + h - 14);
          ctx.lineTo(x + i + 20, y + h);
          ctx.stroke();
        }
        ctx.restore();
      }

      renderCleanroomFloor(ctx, x, y, w, h) {
        ctx.fillStyle = '#082f24';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.2)';
        ctx.lineWidth = 1;
        for (let px = x; px < x + w; px += 24) {
          ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + h); ctx.stroke();
        }
        for (let py = y; py < y + h; py += 24) {
          ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + w, py); ctx.stroke();
        }
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
      }

      renderZoneRug(ctx, x, y, w, h, color, title) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.font = '700 10.5px "JetBrains Mono", monospace';
        ctx.fillText(title.toUpperCase(), x + 14, y + 20);
      }

      renderCircuitTraces(ctx) {
        ctx.save();
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 6;

        // North Arterial Trace
        ctx.beginPath();
        ctx.moveTo(100, 280);
        ctx.lineTo(1300, 280);
        ctx.stroke();

        // South Arterial Trace
        ctx.beginPath();
        ctx.moveTo(100, 620);
        ctx.lineTo(1300, 620);
        ctx.stroke();

        // Vertical Center Spine Trace
        ctx.beginPath();
        ctx.moveTo(700, 220);
        ctx.lineTo(700, 680);
        ctx.stroke();

        // Solder pad nodes with pulsing LEDs
        const nodes = [
          [210, 280], [350, 280], [500, 280], [700, 280], [900, 280], [1000, 280], [1190, 280],
          [210, 620], [350, 620], [500, 620], [700, 620], [900, 620], [1000, 620], [1190, 620],
          [350, 450], [1000, 450]
        ];
        nodes.forEach(([nx, ny]) => {
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(nx, ny, 4, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      }

      setupInteractions() {
        this.hoveredEntity = null;
        this.canvas.addEventListener('mousemove', (e) => {
          const rect = this.canvas.getBoundingClientRect();
          const scaleX = this.virtualWidth / rect.width;
          const scaleY = this.virtualHeight / rect.height;
          const mx = (e.clientX - rect.left) * scaleX;
          const my = (e.clientY - rect.top) * scaleY;
          this.checkHover(mx, my);
        });

        this.canvas.addEventListener('click', (e) => {
          const rect = this.canvas.getBoundingClientRect();
          const scaleX = this.virtualWidth / rect.width;
          const scaleY = this.virtualHeight / rect.height;
          const mx = (e.clientX - rect.left) * scaleX;
          const my = (e.clientY - rect.top) * scaleY;
          this.handleClick(mx, my);
        });

        const toggleBtn = document.getElementById('toggleWaypointsBtn');
        if (toggleBtn) {
          toggleBtn.addEventListener('click', () => {
            this.showWaypoints = !this.showWaypoints;
            toggleBtn.classList.toggle('border-amber-400', this.showWaypoints);
            toggleBtn.classList.toggle('text-amber-300', this.showWaypoints);
          });
        }
      }

      checkHover(mx, my) {
        const hud = document.getElementById('hoverHUD');
        const hudTitle = document.getElementById('hudTitle');
        const hudDesc = document.getElementById('hudDesc');
        const hudIcon = document.getElementById('hudIcon');

        // Check agents
        for (const a of this.agents) {
          if (Math.hypot(a.x - mx, a.y - my) < 22) {
            if (hud && hudIcon && hudTitle && hudDesc) {
              hud.style.opacity = '1';
              hudIcon.innerText = '👤';
              hudTitle.innerText = a.name;
              hudDesc.innerText = `${a.role} • ${a.state}`;
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
        // Click on agent -> Send on coffee break or stretch
        for (const a of this.agents) {
          if (Math.hypot(a.x - mx, a.y - my) < 22) {
            if (a.state === 'IDLE_AT_DESK') {
              this.dispatchAgent(a.id, 'pantry', '☕ Coffee & Stretch Break');
            } else {
              this.returnAgentToDesk(a);
            }
            return;
          }
        }

        // Click on station -> Dispatch nearest available agent
        for (const [key, s] of Object.entries(STATIONS)) {
          if (mx >= s.x - s.w/2 && mx <= s.x + s.w/2 && my >= s.y - s.h/2 && my <= s.y + s.h/2) {
            const idleAgent = this.agents.find(a => a.state === 'IDLE_AT_DESK');
            if (idleAgent) {
              this.dispatchAgent(idleAgent.id, key, `${s.icon} Inspecting ${s.name}`);
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

        // Compute waypoint path:
        // AisleExit -> Corridor Network -> Doorway -> StationTerminal
        const startKey = agent.aisleKey;
        const targetKey = station.terminalKey;
        const corridorWaypoints = aStarPath(startKey, targetKey);

        agent.pathQueue = [
          WAYPOINTS[agent.aisleKey], // 1. First step out of desk to aisle
          ...corridorWaypoints       // 2. Full collision-free path
        ];
        agent.currentWaypointIdx = 0;
        agent.targetStation = station;
        agent.state = 'WALKING';
        agent.bubbleText = actionText;
        agent.bubbleTimer = 350;
      }

      returnAgentToDesk(agent) {
        // Return path: Current Station Terminal -> Doorway -> Corridor Network -> AisleExit -> Desk
        const startKey = agent.targetStation ? agent.targetStation.terminalKey : 'C_N_CENTER';
        const targetKey = agent.aisleKey;
        const returnWaypoints = aStarPath(startKey, targetKey);

        agent.pathQueue = [
          ...returnWaypoints,
          { x: agent.deskX, y: agent.deskY } // Final step into chair
        ];
        agent.currentWaypointIdx = 0;
        agent.state = 'WALKING';
        agent.bubbleText = 'Task concluded. Returning to workstation.';
        agent.bubbleTimer = 180;
      }

      // --- Main Simulation Loop ---
      startLoop() {
        const frame = () => {
          try {
            this.update();
            this.render();
            this.calcFPS();
          } catch(err) {
            console.error('Frame error:', err.message, err.stack);
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
          const fpsEl = document.getElementById('fpsMeter');
          if (fpsEl) fpsEl.innerText = this.fps;
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
              const target = a.pathQueue[a.currentWaypointIdx];
              const dx = target.x - a.x;
              const dy = target.y - a.y;
              const d = Math.hypot(dx, dy);

              if (d > a.speed) {
                a.x += (dx / d) * a.speed;
                a.y += (dy / d) * a.speed;
                a.walkCycle += 0.28;

                // Facing orientation
                if (Math.abs(dx) > Math.abs(dy)) {
                  a.facing = dx > 0 ? 'right' : 'left';
                } else {
                  a.facing = dy > 0 ? 'down' : 'up';
                }
              } else {
                // Reached waypoint, advance to next
                a.x = target.x;
                a.y = target.y;
                a.currentWaypointIdx++;
              }
            } else {
              // Completed all waypoints
              a.walkCycle = 0;
              if (a.targetStation && Math.hypot(a.x - a.deskX, a.y - a.deskY) > 50) {
                // Arrived at station apparatus
                a.state = 'WORKING_AT_STATION';
                a.facing = 'up';
                a.workTimer = 220; // 3.6s
              } else {
                // Returned to desk
                a.state = 'IDLE_AT_DESK';
                a.facing = 'up';
                a.bubbleText = a.bubble;
                a.targetStation = null;
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
        ctx.clearRect(0, 0, this.virtualWidth, this.virtualHeight);

        // Layer 0: Static Pre-baked Floor Architecture
        ctx.drawImage(this.floorCanvas, 0, 0);

        // Layer 1: Structural Walls & Glass Partitions
        this.drawArchitecturalWalls();

        // Layer 2: Heavy Furniture & Station Bases
        this.drawStations();
        this.drawDesks();

        // Optional Layer: Waypoint Graph Overlay
        if (this.showWaypoints) {
          this.drawWaypointGraph();
        }

        // Layer 3: Dynamic Characters (Y-sorted for proper isometric depth)
        const sortedAgents = [...this.agents].sort((a, b) => a.y - b.y);
        sortedAgents.forEach(a => this.drawCharacter(a));

        // Layer 4: Floating Comic RPG Speech Bubbles
        sortedAgents.forEach(a => this.drawRPGBubble(a));
      }

      // --- Layer 1: Architectural Walls & Glass Partitions ---
      drawArchitecturalWalls() {
        const ctx = this.ctx;
        ctx.save();

        // Wall style: 12px reinforced cyber-titanium composite
        const drawWall = (x1, y1, x2, y2) => {
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          // Wall bevel
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        };

        // Glass Partition style: semi-transparent with glowing cyan neon trim
        const drawGlass = (x1, y1, x2, y2) => {
          ctx.strokeStyle = 'rgba(2, 132, 199, 0.2)';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          // Cyan neon rail
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 6;
          ctx.stroke();
          ctx.shadowBlur = 0;
        };

        // Doorway threshold plate
        const drawDoor = (x, y, w, h) => {
          ctx.fillStyle = '#334155';
          ctx.fillRect(x - w/2, y - h/2, w, h);
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 1;
          ctx.strokeRect(x - w/2, y - h/2, w, h);
        };

        // North Wall boundary
        drawWall(50, 50, 1350, 50);
        // South Wall boundary
        drawWall(50, 850, 1350, 850);
        // West Wall boundary
        drawWall(50, 50, 50, 850);
        // East Wall boundary
        drawWall(1350, 50, 1350, 850);

        // Internal Glass Partitions dividing Departments
        // North Wall below Executive Bridge (with 60px open door at X=700)
        drawGlass(470, 220, 670, 220);
        drawDoor(700, 220, 56, 8);
        drawGlass(730, 220, 930, 220);

        // Wall separating Library / Mainframe
        drawWall(50, 240, 180, 240);
        drawDoor(210, 240, 56, 8);
        drawWall(240, 240, 370, 240);

        // Wall separating Radar / Cleanroom
        drawWall(1030, 240, 1160, 240);
        drawDoor(1190, 240, 56, 8);
        drawWall(1220, 240, 1350, 240);

        // Wall separating Mainframe / Lakehouse
        drawWall(50, 650, 180, 650);
        drawDoor(210, 650, 56, 8);
        drawWall(240, 650, 370, 650);

        // Wall separating Cleanroom / Lounge
        drawWall(1030, 650, 1160, 650);
        drawDoor(1190, 650, 56, 8);
        drawWall(1220, 650, 1350, 650);

        // Central War Room Glass Enclosure (with North and South Doorways)
        drawGlass(540, 350, 670, 350);
        drawDoor(700, 350, 56, 8);
        drawGlass(730, 350, 860, 350);
        drawGlass(540, 550, 670, 550);
        drawDoor(700, 550, 56, 8);
        drawGlass(730, 550, 860, 550);
        drawGlass(540, 350, 540, 550);
        drawGlass(860, 350, 860, 550);

        ctx.restore();
      }

      // --- Layer 2: Stations & Rich Furniture ---
      drawStations() {
        const ctx = this.ctx;

        // 1. Executive Bridge Dais & Curved Desk
        ctx.save();
        ctx.translate(700, 100);
        // Mahogany Desk
        ctx.fillStyle = '#451a03';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-80, -25, 160, 50, 10);
        ctx.fill();
        ctx.stroke();

        // Gold Nameplate
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-24, 18, 48, 6);
        ctx.fillStyle = '#0f172a';
        ctx.font = '700 6.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BOSS DAIS', 0, 23);

        // Triple Command Monitor Array
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(-60, -22, 36, 7);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-18, -24, 36, 9);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(24, -22, 36, 7);

        // Large Indoor Palm Trees in Navy Ceramic Pots
        const drawPalm = (px, py) => {
          ctx.fillStyle = '#1e3a8a';
          ctx.beginPath();
          ctx.arc(px, py, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#38bdf8';
          ctx.stroke();
          // Fronds
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3;
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(a) * 26, py + Math.sin(a) * 26);
            ctx.stroke();
          }
        };
        drawPalm(-140, 0);
        drawPalm(140, 0);
        ctx.restore();

        // 2. Central Briefing War Room (Hexagonal Holo Table)
        const sBrief = STATIONS.briefing;
        ctx.save();
        ctx.translate(sBrief.x, sBrief.y);
        ctx.fillStyle = 'rgba(30, 58, 138, 0.5)';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const px = Math.cos(a) * 65;
          const py = Math.sin(a) * 45;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Central Hologram Emitter & Rotating Wireframe
        ctx.fillStyle = '#60a5fa';
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const rot = this.tick * 0.04;
        ctx.ellipse(0, 0, 30, 16, rot, 0, Math.PI * 2);
        ctx.stroke();

        // 8 Swivel Chairs around Table
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          const cx = Math.cos(a) * 82;
          const cy = Math.sin(a) * 60;
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = '#475569';
          ctx.beginPath();
          ctx.arc(cx, cy, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();

        // 3. Git Core Mainframe Server Cabinets
        const sComp = STATIONS.compiler;
        ctx.save();
        ctx.translate(sComp.x, sComp.y);
        // 3 Server Racks
        for (let r = 0; r < 3; r++) {
          const rx = -70 + r * 70;
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.5;
          ctx.fillRect(rx - 25, -45, 50, 90);
          ctx.strokeRect(rx - 25, -45, 50, 90);

          // Server blade horizontal lines & blinking LEDs
          for (let b = 0; b < 6; b++) {
            const by = -35 + b * 13;
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(rx - 20, by, 40, 8);
            // LED
            const isBlink = (this.tick + r * 7 + b * 11) % 20 > 8;
            ctx.fillStyle = isBlink ? '#10b981' : '#06b6d4';
            ctx.fillRect(rx + 12, by + 2, 4, 4);
          }
        }
        ctx.restore();

        // 4. Web Crawler Radar Terminal & Sphere
        const sCrawl = STATIONS.crawler;
        ctx.save();
        ctx.translate(sCrawl.x, sCrawl.y);
        // Parabolic Dish Base
        ctx.fillStyle = '#0b1324';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 42, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Concentric Radar Rings
        const pulse = (this.tick * 0.8) % 40;
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, pulse, 0, Math.PI * 2);
        ctx.stroke();

        // 360 Sweeping Radar Arm
        const armAngle = this.tick * 0.06;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(armAngle) * 40, Math.sin(armAngle) * 40);
        ctx.stroke();
        ctx.restore();

        // 5. QA Cleanroom Laser Scanner Table
        const sQA = STATIONS.quarantine;
        ctx.save();
        ctx.translate(sQA.x, sQA.y);
        ctx.fillStyle = '#064e3b';
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
        ctx.fillRect(-60, -35, 120, 70);
        ctx.strokeRect(-60, -35, 120, 70);

        // Reciprocating Laser Scanner Beam
        const laserY = Math.sin(this.tick * 0.08) * 26;
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(-55, laserY);
        ctx.lineTo(55, laserY);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Heavy Brass PASSED Stamp
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(20, -25, 24, 16);
        ctx.fillStyle = '#10b981';
        ctx.font = '700 7px "JetBrains Mono", monospace';
        ctx.fillText('PASSED', 22, -14);
        ctx.restore();

        // 6. DuckDB Lakehouse Fluid Basin
        const sLake = STATIONS.lakehouse;
        ctx.save();
        ctx.translate(sLake.x, sLake.y);
        // Sunken basin pool
        ctx.fillStyle = '#032b43';
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-70, -40, 140, 80, 16);
        ctx.fill();
        ctx.stroke();

        // Caustic ripple waves
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1.5;
        const wave = Math.sin(this.tick * 0.05) * 6;
        ctx.beginPath();
        ctx.ellipse(0, 0, 50 + wave, 24, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Sleek Stylized Cybernetic Golden Duck Mascot
        const dy = Math.sin(this.tick * 0.08) * 3;
        ctx.save();
        ctx.translate(0, dy);
        // Duck Body
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(0, 4, 14, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        // Duck Head
        ctx.beginPath();
        ctx.arc(8, -4, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Duck Beak
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.moveTo(14, -5);
        ctx.lineTo(21, -3);
        ctx.lineTo(14, -1);
        ctx.closePath();
        ctx.fill();
        // Duck Eye
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(10, -5, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.restore();

        // 7. Cyber Café & Energy Lounge (L-Sofa & Espresso Bar)
        const sPantry = STATIONS.pantry;
        ctx.save();
        ctx.translate(sPantry.x, sPantry.y);
        // L-Shaped Sectional Leather Sofa
        ctx.fillStyle = '#1c1917';
        ctx.strokeStyle = '#44403c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-60, -45);
        ctx.lineTo(30, -45);
        ctx.lineTo(30, -15);
        ctx.lineTo(-30, -15);
        ctx.lineTo(-30, 45);
        ctx.lineTo(-60, 45);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Glass Coffee Table with Espresso Mugs
        ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.fillRect(-10, -5, 45, 30);
        ctx.strokeRect(-10, -5, 45, 30);
        ctx.font = '16px sans-serif';
        ctx.fillText('☕', 4, 16);

        // Stainless Espresso Machine on Bar Counter
        ctx.fillStyle = '#64748b';
        ctx.fillRect(50, -45, 25, 45);
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(52, -40, 21, 6); // indicator light
        ctx.restore();
      }

      // --- Layer 2: 13 Personalized Desks ---
      drawDesks() {
        const ctx = this.ctx;

        this.agents.forEach(a => {
          if (a.type === 'boss') return; // Handled in Executive Dais

          ctx.save();
          ctx.translate(a.desk.x, a.desk.y);

          // Desk Table Surface (80 x 40 px)
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = a.accentColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(-40, -20, 80, 40, 6);
          ctx.fill();
          ctx.stroke();

          // Dual / Ultrawide Monitors
          ctx.fillStyle = a.accentColor;
          ctx.fillRect(-26, -18, 22, 6);
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(4, -18, 22, 6);

          // Desk Chair (Rendered below table)
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = '#475569';
          ctx.beginPath();
          ctx.arc(0, 20, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Role-specific Desk Accessories (Anti-Polos)
          if (a.id === 'professor') {
            // Stack of books + Brass lamp
            ctx.fillStyle = '#b45309';
            ctx.fillRect(26, -12, 10, 16);
            ctx.fillStyle = '#10b981';
            ctx.beginPath(); ctx.arc(-32, -8, 4, 0, Math.PI * 2); ctx.fill();
          } else if (a.id === 'ui-designer') {
            // Drawing tablet with colorful swatch
            ctx.fillStyle = '#ec4899';
            ctx.fillRect(-12, -4, 24, 16);
            ctx.fillStyle = '#fde047';
            ctx.fillRect(26, -8, 8, 8);
          } else if (a.id === 'swe-verifier') {
            // Verification checklist clipboard
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(-32, -10, 8, 14);
            ctx.fillStyle = '#10b981';
            ctx.fillRect(-30, -6, 4, 2);
          } else if (a.id === 'data-engineer') {
            // Mini duck on monitor
            ctx.fillStyle = '#facc15';
            ctx.beginPath(); ctx.arc(26, -10, 3, 0, Math.PI * 2); ctx.fill();
          } else if (a.id === 'devops-engineer') {
            // Emergency shutdown red button
            ctx.fillStyle = '#ef4444';
            ctx.beginPath(); ctx.arc(28, 6, 4, 0, Math.PI * 2); ctx.fill();
          }

          // Occupancy Keyboard & Name Tag
          const isAtDesk = a.state === 'IDLE_AT_DESK';
          if (!isAtDesk) {
            ctx.fillStyle = '#64748b';
            ctx.font = '600 7.5px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(a.id, 0, 4);
          } else {
            // Keyboard when occupied (no text collision with character!)
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-16, -2, 32, 10);
            ctx.fillStyle = '#334155';
            ctx.fillRect(-14, 0, 28, 6);
          }

          // Dedicated Crisp Nameplate Pill Badge placed neatly at the top edge of the desk
          ctx.fillStyle = 'rgba(7, 12, 24, 0.9)';
          ctx.strokeStyle = a.accentColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(-36, -32, 72, 11, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#f8fafc';
          ctx.font = '700 7px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(a.id, 0, -24);

          ctx.restore();
        });
      }

      // --- Layer 3: Dynamic Characters (4-Frame Walk & Chibi Proportions) ---
      drawCharacter(agent) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(agent.x, agent.y);

        // 1. Soft Dynamic Contact Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(0, 10, 9, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. 4-Frame Walk Kinematics (Leg stride & Body bob)
        const isWalking = agent.state === 'WALKING';
        const legStep = isWalking ? Math.sin(agent.walkCycle) * 3.5 : 0;
        const bodyBob = isWalking ? Math.abs(Math.sin(agent.walkCycle)) * 1.2 : 0;

        // Shoes (Left & Right)
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-6, 6 + legStep - bodyBob, 4, 6);
        ctx.fillRect(2, 6 - legStep - bodyBob, 4, 6);

        // Torso / Role Uniform Jacket
        ctx.fillStyle = agent.accentColor;
        ctx.beginPath();
        ctx.roundRect(-7, -6 - bodyBob, 14, 12, 3);
        ctx.fill();

        // Shirt Collar / Lapel
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-1.5, -4 - bodyBob, 3, 6);

        // Head
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.roundRect(-7, -18 - bodyBob, 14, 12, 3);
        ctx.fill();

        // Hair / Cap
        ctx.fillStyle = agent.hairColor || '#1e293b';
        ctx.fillRect(-7, -18 - bodyBob, 14, 4);

        // Cyber Visor (Glowing)
        ctx.fillStyle = agent.accentColor;
        ctx.shadowColor = agent.accentColor;
        ctx.shadowBlur = 6;
        if (agent.facing === 'down') {
          ctx.fillRect(-5, -13 - bodyBob, 10, 3);
        } else if (agent.facing === 'right') {
          ctx.fillRect(-2, -13 - bodyBob, 7, 3);
        } else if (agent.facing === 'left') {
          ctx.fillRect(-5, -13 - bodyBob, 7, 3);
        }
        ctx.shadowBlur = 0;

        // Ground Status Ring
        ctx.strokeStyle = agent.accentColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 8, 14, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }

      // --- Layer 4: Comic RPG Speech & Thought Bubbles ---
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
        const by = -56;

        // Bubble Box
        ctx.fillStyle = 'rgba(7, 12, 24, 0.94)';
        ctx.strokeStyle = agent.accentColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-bw / 2, by, bw, bh, 8);
        ctx.fill();
        ctx.stroke();

        // Arrow Tail pointing directly to head
        ctx.fillStyle = 'rgba(7, 12, 24, 0.94)';
        ctx.beginPath();
        ctx.moveTo(-5, by + bh);
        ctx.lineTo(5, by + bh);
        ctx.lineTo(0, by + bh + 6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = agent.accentColor;
        ctx.stroke();

        // Text
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.fillText(text, 0, by + 18);

        ctx.restore();
      }

      // --- Debug Overlay: Draw Waypoints & Adjacency Edges ---
      
      // --- Live Backend Telemetry Integration ---
      setRoster(roster) {
        if (!roster) return;
        this.rosterData = roster;
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

        // Check if there is an active tool call to dispatch
        const recentTool = (events || []).find(e => e.type === 'tool_call');
        if (recentTool) {
          const char = this.agents.find(a => a.id === recentTool.agent);
          if (char && char.state === 'IDLE_AT_DESK') {
            const stationKey = recentTool.station || 'compiler';
            this.dispatchAgent(char.id, stationKey, this.formatActionBubble(recentTool.detail));
          }
        }

        // Check if there is a recent boss delegation to trigger War Room Briefing
        if (conversations && conversations.length > 0 && Math.random() < 0.35) {
          const convo = conversations[0];
          const subagent = this.agents.find(a => a.id === convo.receiver);
          if (subagent && subagent.state === 'IDLE_AT_DESK') {
            this.dispatchAgent('vps-boss', 'briefing', `👑 Boss: "${convo.boss_order.slice(0, 36)}..."`);
            setTimeout(() => {
              this.dispatchAgent(subagent.id, 'briefing', `🤝 ${subagent.id}: "Executing order..."`);
            }, 600);
          }
        }
      }

      formatActionBubble(detail) {
        if (!detail) return 'Executing tool apparatus...';
        let clean = detail.replace(/->\s*/, '').replace(/\(.*\)/, '');
        if (detail.includes('web_search')) return '🔍 Crawling web intelligence...';
        if (detail.includes('pytest')) return '🛡️ Running automated pytest suite...';
        if (detail.includes('terminal')) return '💻 Executing system bash command...';
        if (detail.includes('patch')) return '📝 Applying code diff patch...';
        if (detail.includes('read_file')) return '📖 Reading source telemetry...';
        if (detail.includes('duckdb')) return '🦆 Syncing DuckDB Lakehouse...';
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
                <span class="text-2xl">🤝</span>
                <div>
                  <h2 class="text-base font-extrabold text-white">Central Briefing Table — Live Multi-Agent Dialogue Log</h2>
                  <p class="text-xs text-slate-400">Transkrip nyata perintah delegasi vps-boss dan laporan balik para subagent.</p>
                </div>
              </div>
              <button onclick="document.getElementById('convoModal').remove()" class="w-8 h-8 rounded-lg bg-cyber-800 text-slate-400 hover:text-white flex items-center justify-center transition">✕</button>
            </div>

            <div class="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              ${(this.conversations || []).map(c => `
                <div class="p-4 rounded-xl bg-cyber-950/80 border border-cyber-800/80 space-y-2">
                  <div class="flex items-center justify-between font-mono text-[11px]">
                    <span class="font-bold text-blue-400">👑 vps-boss ➔ 🤖 ${c.receiver}</span>
                    <span class="text-slate-500">${c.started_at || 'recent'}</span>
                  </div>
                  <div class="p-2.5 rounded-lg bg-blue-500/10 border-l-2 border-blue-500 text-slate-200">
                    <span class="font-bold text-blue-400">Boss Order:</span> "${c.boss_order}"
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

        // Draw edges
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
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

        // Draw nodes
        for (const [key, node] of Object.entries(WAYPOINTS)) {
          ctx.fillStyle = key.startsWith('DR_') ? '#10b981' : (key.startsWith('ST_') ? '#f59e0b' : '#38bdf8');
          ctx.beginPath();
          ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.font = '600 7px "JetBrains Mono", monospace';
          ctx.fillText(key, node.x + 6, node.y + 3);
        }

        ctx.restore();
      }
    }

window.CyberOfficeSimulation = CyberOfficeSimulation;
