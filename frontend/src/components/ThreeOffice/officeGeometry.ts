import * as THREE from 'three'

/**
 * officeGeometry.ts
 * Generates the complete 3D architectural dollhouse office layout:
 * - Multi-level floors (Upper Executive Mezzanine, Main SWE Floor, Lower Sunken Musholla, Rooftop Pool)
 * - Glass fishbowl partitions with physical transparency
 * - Marble staircase with step collision
 * - Iconic furniture models (Boss Mahogany Desk, Conference Table, Dev Pods, Senku Chemistry Lab,
 *   Server Racks with LEDs, Billiard Table, Espresso Bar, and Mihrab Musholla)
 */

export interface OfficeSceneBundle {
  rootGroup: THREE.Group
  waterMesh?: THREE.Mesh
  ledLights: THREE.Mesh[]
  interactableObjects: THREE.Object3D[]
}

export function buildArchitecturalOffice(): OfficeSceneBundle {
  const root = new THREE.Group()
  root.name = 'ArchitecturalOfficeRoot'

  const ledLights: THREE.Mesh[] = []
  const interactableObjects: THREE.Object3D[] = []

  // ==========================================
  // 1. MATERIAL PALETTE (Architectural & PBR)
  // ==========================================
  const matParquet = new THREE.MeshStandardMaterial({
    color: 0x8a5d3b,
    roughness: 0.35,
    metalness: 0.05,
  })

  const matLightOak = new THREE.MeshStandardMaterial({
    color: 0xc8ad8d,
    roughness: 0.4,
    metalness: 0.05,
  })

  const matDarkWood = new THREE.MeshStandardMaterial({
    color: 0x3d2314,
    roughness: 0.3,
    metalness: 0.1,
  })

  const matSlateTile = new THREE.MeshStandardMaterial({
    color: 0x33373d,
    roughness: 0.5,
    metalness: 0.2,
  })

  const matEmeraldCarpet = new THREE.MeshStandardMaterial({
    color: 0x0d5c3a,
    roughness: 0.9,
    metalness: 0.0,
  })

  const matMarbleWhite = new THREE.MeshStandardMaterial({
    color: 0xf0f0f5,
    roughness: 0.2,
    metalness: 0.05,
  })

  const matGlassPartition = new THREE.MeshPhysicalMaterial({
    color: 0xd0e8f2,
    transparent: true,
    opacity: 0.38,
    roughness: 0.1,
    transmission: 0.75,
    thickness: 0.3,
    depthWrite: false,
  })

  const matGlassFrame = new THREE.MeshStandardMaterial({
    color: 0x24282e,
    roughness: 0.4,
    metalness: 0.8,
  })

  const matWallWhite = new THREE.MeshStandardMaterial({
    color: 0xededf2,
    roughness: 0.8,
    metalness: 0.0,
  })

  const matWallCutaway = new THREE.MeshStandardMaterial({
    color: 0x2c3038,
    roughness: 0.6,
    metalness: 0.1,
  })

  const matNeonPurple = new THREE.MeshStandardMaterial({
    color: 0x9333ea,
    emissive: 0xa855f7,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  })

  const matWaterTurquoise = new THREE.MeshPhysicalMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.65,
    roughness: 0.05,
    transmission: 0.6,
    ior: 1.333,
    depthWrite: false,
  })

  // ==========================================
  // 2. MULTI-LEVEL FLOORS & ELEVATIONS
  // ==========================================

  // Level A: Main Open Floor (Y = 0) - SWE Dev, Lab Senku, Data Center, Cafeteria
  const mainFloorGeo = new THREE.BoxGeometry(32, 0.4, 24)
  const mainFloor = new THREE.Mesh(mainFloorGeo, matLightOak)
  mainFloor.position.set(0, -0.2, 0)
  mainFloor.receiveShadow = true
  root.add(mainFloor)

  // Level B: Upper Mezzanine (Y = 1.0) - Ruang Bos, Ruang Rapat Kaca, Executive Lounge
  const upperMezzGeo = new THREE.BoxGeometry(32, 1.0, 10)
  const upperMezz = new THREE.Mesh(upperMezzGeo, matParquet)
  upperMezz.position.set(0, 0.5, -7)
  upperMezz.receiveShadow = true
  root.add(upperMezz)

  // Mezzanine Fascia Edge
  const fasciaGeo = new THREE.BoxGeometry(32, 1.0, 0.3)
  const fascia = new THREE.Mesh(fasciaGeo, matWallCutaway)
  fascia.position.set(0, 0.5, -1.85)
  root.add(fascia)

  // Level C: Sunken Musholla (Y = -0.8) - Islamic Prayer Room with Emerald Carpet
  const mushollaFloorGeo = new THREE.BoxGeometry(10, 0.3, 10)
  const mushollaFloor = new THREE.Mesh(mushollaFloorGeo, matEmeraldCarpet)
  mushollaFloor.position.set(-11, -0.9, 7)
  mushollaFloor.receiveShadow = true
  root.add(mushollaFloor)

  // Golden Saf Lines in Musholla
  for (let z = 4; z <= 10; z += 2.2) {
    const safGeo = new THREE.BoxGeometry(9.6, 0.02, 0.1)
    const matSaf = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3 })
    const safMesh = new THREE.Mesh(safGeo, matSaf)
    safMesh.position.set(-11, -0.74, z)
    root.add(safMesh)
  }

  // Marble Staircase down to Musholla (Main Floor Y=0 to Musholla Y=-0.8)
  const numSteps = 5
  const stepWidth = 4.0
  const stepDepth = 0.5
  const totalDrop = 0.8
  for (let i = 0; i < numSteps; i++) {
    const stepH = (totalDrop / numSteps)
    const stepGeo = new THREE.BoxGeometry(stepWidth, stepH, stepDepth)
    const stepMesh = new THREE.Mesh(stepGeo, matMarbleWhite)
    stepMesh.position.set(-5.0, -(i * stepH) - stepH / 2, 3.5 + i * stepDepth)
    stepMesh.receiveShadow = true
    stepMesh.castShadow = true
    root.add(stepMesh)
  }

  // Staircase Brass Railing
  const railingPillarGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.9)
  const matBrass = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.2 })
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(railingPillarGeo, matBrass)
    p.position.set(-3.0, -0.2 - i * 0.2, 3.5 + i * 1.0)
    root.add(p)
  }

  // Level D: Rooftop Terrace & Swimming Pool Deck (Y = 0) on the East Side
  const poolDeckGeo = new THREE.BoxGeometry(10, 0.4, 12)
  const poolDeck = new THREE.Mesh(poolDeckGeo, matParquet)
  poolDeck.position.set(11, -0.2, 6)
  poolDeck.receiveShadow = true
  root.add(poolDeck)

  // Pool Basin (Recessed hole with water)
  const poolOuterGeo = new THREE.BoxGeometry(7, 0.9, 8)
  const poolBasin = new THREE.Mesh(poolOuterGeo, matMarbleWhite)
  poolBasin.position.set(11, -0.5, 6)
  root.add(poolBasin)

  const poolWaterGeo = new THREE.BoxGeometry(6.2, 0.7, 7.2)
  const poolWater = new THREE.Mesh(poolWaterGeo, matWaterTurquoise)
  poolWater.position.set(11, -0.35, 6)
  root.add(poolWater)

  // Chrome Pool Ladder
  const ladderGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.2)
  const matChrome = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.95, roughness: 0.1 })
  const ladderR1 = new THREE.Mesh(ladderGeo, matChrome)
  ladderR1.position.set(13.9, 0.2, 5.0)
  const ladderR2 = new THREE.Mesh(ladderGeo, matChrome)
  ladderR2.position.set(13.9, 0.2, 5.6)
  root.add(ladderR1, ladderR2)

  // ==========================================
  // 3. ARCHITECTURAL PARTITIONS & GLASS FISHBOWL
  // ==========================================

  // Ruang Rapat Kaca (Glass Fishbowl Boardroom) on Upper Mezzanine
  // Glass walls around X: [-4, 4], Z: [-11, -3], Y: 1.0 -> 3.4
  const buildGlassWall = (x: number, z: number, w: number, d: number, hasDoor = false) => {
    const wallGroup = new THREE.Group()
    const height = 2.4

    if (hasDoor) {
      // Left glass panel
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.35, height, d), matGlassPartition)
      p1.position.set(-w * 0.32, height / 2, 0)
      // Right glass panel
      const p2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.35, height, d), matGlassPartition)
      p2.position.set(w * 0.32, height / 2, 0)
      // Top header transom
      const p3 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, height * 0.2, d), matGlassPartition)
      p3.position.set(0, height * 0.9, 0)
      wallGroup.add(p1, p2, p3)
    } else {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), matGlassPartition)
      panel.position.set(0, height / 2, 0)
      wallGroup.add(panel)
    }

    // Metal Frame Trim
    const frameBottom = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d * 1.5), matGlassFrame)
    frameBottom.position.set(0, 0.04, 0)
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d * 1.5), matGlassFrame)
    frameTop.position.set(0, height - 0.04, 0)
    wallGroup.add(frameBottom, frameTop)

    wallGroup.position.set(x, 1.0, z)
    return wallGroup
  }

  // Boardroom Glass Walls
  root.add(buildGlassWall(0, -2.1, 8.0, 0.08, true))   // Front wall with door
  root.add(buildGlassWall(-4.0, -6.5, 0.08, 9.0, false)) // West glass wall
  root.add(buildGlassWall(4.0, -6.5, 0.08, 9.0, false))  // East glass wall

  // Ruang Bos Boiserie Wood Partition (East of Boardroom)
  const bossWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 9.0), matDarkWood)
  bossWall.position.set(4.1, 2.2, -6.5)
  root.add(bossWall)

  // Arcade Acoustic Walls with Neon Purple Glow (West of Boardroom)
  const arcadeBackWall = new THREE.Mesh(new THREE.BoxGeometry(7.0, 2.4, 0.2), matWallCutaway)
  arcadeBackWall.position.set(-8.0, 2.2, -11.0)
  root.add(arcadeBackWall)

  // Neon Purple Accent Strips
  for (let x = -10.5; x <= -5.5; x += 1.8) {
    const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.0, 0.05), matNeonPurple)
    neonStrip.position.set(x, 2.2, -10.85)
    root.add(neonStrip)
  }

  // Mihrab Arch in Musholla (Carved Prayer Niche)
  const mihrabGroup = new THREE.Group()
  const mihrabBack = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 0.3), matDarkWood)
  mihrabBack.position.set(0, 1.2, 0)
  const mihrabGoldTrim = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.35), matBrass)
  mihrabGoldTrim.position.set(0, 2.2, 0)
  mihrabGroup.add(mihrabBack, mihrabGoldTrim)
  mihrabGroup.position.set(-11, -0.8, 2.0)
  root.add(mihrabGroup)

  // ==========================================
  // 4. ICONIC MODULAR FURNITURE MODELS
  // ==========================================

  // --- A. Ruang Bos (CEO Jarvis Executive Suite) ---
  const bossSuiteGroup = new THREE.Group()
  // Mahogany Executive Partner Desk
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.15, 1.8), matDarkWood)
  deskTop.position.set(0, 0.85, 0)
  const deskPedLeft = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.6), matDarkWood)
  deskPedLeft.position.set(-1.1, 0.4, 0)
  const deskPedRight = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.6), matDarkWood)
  deskPedRight.position.set(1.1, 0.4, 0)

  // Executive High-Back Leather Chair
  const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), matSlateTile)
  chairSeat.position.set(0, 0.55, -1.0)
  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.12), matSlateTile)
  chairBack.position.set(0, 0.95, -1.35)

  // Banker Lamp & Laptop
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.25), matBrass)
  lampBase.position.set(-1.1, 1.0, 0.3)
  const lampShade = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.15), new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.2 }))
  lampShade.position.set(-1.1, 1.15, 0.3)
  const laptop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.4), matMarbleWhite)
  laptop.position.set(0, 0.95, 0.1)

  // Trophy
  const trophy = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.22), matBrass)
  trophy.position.set(1.1, 1.05, 0.3)

  bossSuiteGroup.add(deskTop, deskPedLeft, deskPedRight, chairSeat, chairBack, lampBase, lampShade, laptop, trophy)
  bossSuiteGroup.position.set(9.0, 1.0, -6.5)
  root.add(bossSuiteGroup)

  // --- B. Ruang Rapat Kaca (Boardroom Conference Table & Chairs) ---
  const boardroomGroup = new THREE.Group()
  const confTable = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.12, 32), matDarkWood)
  confTable.position.set(0, 0.85, 0)
  const confPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.8, 16), matGlassFrame)
  confPillar.position.set(0, 0.4, 0)
  boardroomGroup.add(confTable, confPillar)

  // 6 Conference Chairs
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    const cMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), matSlateTile)
    cMesh.position.set(Math.cos(angle) * 2.2, 0.5, Math.sin(angle) * 2.2)
    cMesh.lookAt(0, 0.5, 0)
    boardroomGroup.add(cMesh)
  }
  boardroomGroup.position.set(0, 1.0, -6.5)
  root.add(boardroomGroup)

  // --- C. Software Engineering Pods (Main Floor Center) ---
  const sweGroup = new THREE.Group()
  const buildDevDesk = (x: number, z: number) => {
    const pod = new THREE.Group()
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.2), matMarbleWhite)
    desk.position.set(0, 0.75, 0)
    const legs = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.0), matGlassFrame)
    legs.position.set(0, 0.35, 0)

    // Dual Monitors with Syntax Code Glow
    const matScreen = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.6,
      roughness: 0.2,
    })
    const m1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.05), matScreen)
    m1.position.set(-0.45, 1.05, -0.3)
    m1.rotation.y = 0.15
    const m2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.05), matScreen)
    m2.position.set(0.45, 1.05, -0.3)
    m2.rotation.y = -0.15

    // Task Chair
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.55), matSlateTile)
    chair.position.set(0, 0.5, 0.8)

    pod.add(desk, legs, m1, m2, chair)
    pod.position.set(x, 0, z)
    return pod
  }

  // 4 Dev Workstations in Cluster
  sweGroup.add(buildDevDesk(-4.0, 1.0))
  sweGroup.add(buildDevDesk(0.0, 1.0))
  sweGroup.add(buildDevDesk(-4.0, 4.5))
  sweGroup.add(buildDevDesk(0.0, 4.5))
  root.add(sweGroup)

  // Agile Scrum Board
  const scrumBoard = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.8, 0.1), matMarbleWhite)
  scrumBoard.position.set(3.5, 1.4, 2.5)
  root.add(scrumBoard)

  // --- D. Laboratorium Senku & Perpustakaan (Main Floor West) ---
  const senkuGroup = new THREE.Group()
  // Stainless Steel Chemistry Bench
  const chemBench = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.85, 1.4), matGlassFrame)
  chemBench.position.set(0, 0.42, 0)
  // Reagents & Flasks (Glow)
  const matPurpleGlow = new THREE.MeshStandardMaterial({ color: 0x9333ea, emissive: 0xc084fc, emissiveIntensity: 0.9 })
  const matGreenGlow = new THREE.MeshStandardMaterial({ color: 0x16a34a, emissive: 0x4ade80, emissiveIntensity: 0.9 })
  const flask1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.25), matPurpleGlow)
  flask1.position.set(-1.2, 0.98, 0)
  const flask2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.25), matGreenGlow)
  flask2.position.set(-0.7, 0.98, 0)

  // Microscope
  const microscope = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.25), matMarbleWhite)
  microscope.position.set(0.6, 1.05, 0)

  // Tall Scientific Bookcase
  const bookcase = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.8, 0.6), matDarkWood)
  bookcase.position.set(2.8, 1.4, 0)

  senkuGroup.add(chemBench, flask1, flask2, microscope, bookcase)
  senkuGroup.position.set(-10.0, 0, 0)
  root.add(senkuGroup)

  // --- E. Data Center & Lakehouse Server Racks (Main Floor South) ---
  const dataCenterGroup = new THREE.Group()
  const buildServerRack = (x: number, z: number) => {
    const rack = new THREE.Group()
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 1.0), matGlassFrame)
    cabinet.position.set(0, 1.3, 0)
    rack.add(cabinet)

    // Glowing LED arrays
    for (let r = 0; r < 5; r++) {
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.04, 0.05),
        new THREE.MeshStandardMaterial({
          color: r % 2 === 0 ? 0x10b981 : 0x06b6d4,
          emissive: r % 2 === 0 ? 0x34d399 : 0x38bdf8,
          emissiveIntensity: 1.2,
        })
      )
      led.position.set(0, 0.6 + r * 0.4, 0.51)
      rack.add(led)
      ledLights.push(led)
    }

    rack.position.set(x, 0, z)
    return rack
  }

  dataCenterGroup.add(buildServerRack(4.0, 8.5))
  dataCenterGroup.add(buildServerRack(6.0, 8.5))
  root.add(dataCenterGroup)

  // --- F. Entertainment & Game Room (Pool Table & Arcade) ---
  const gameGroup = new THREE.Group()
  // Billiard Table with Green Felt
  const poolTableBody = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.75, 1.8), matDarkWood)
  poolTableBody.position.set(0, 0.38, 0)
  const poolTableFelt = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.05, 1.5), matEmeraldCarpet)
  poolTableFelt.position.set(0, 0.78, 0)
  gameGroup.add(poolTableBody, poolTableFelt)

  // Retro Arcade Machine
  const arcade = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.8), matWallCutaway)
  arcade.position.set(-2.5, 0.9, 0)
  const arcadeScreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.6, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xfbbf24, emissiveIntensity: 1.0 })
  )
  arcadeScreen.position.set(-2.5, 1.1, 0.41)
  gameGroup.add(arcade, arcadeScreen)

  gameGroup.position.set(-8.0, 1.0, -6.5)
  root.add(gameGroup)

  // --- G. Cafeteria & Espresso Bar ---
  const cafeGroup = new THREE.Group()
  const barCounter = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.95, 1.2), matMarbleWhite)
  barCounter.position.set(0, 0.48, 0)
  const espressoMachine = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), matChrome)
  espressoMachine.position.set(0.8, 1.2, 0)
  cafeGroup.add(barCounter, espressoMachine)
  cafeGroup.position.set(0, 0, 9.5)
  root.add(cafeGroup)

  return {
    rootGroup: root,
    waterMesh: poolWater,
    ledLights,
    interactableObjects,
  }
}
