import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface OfficeSceneBundle {
  rootGroup: THREE.Group
  waterMesh?: THREE.Mesh
  ledLights: THREE.Mesh[]
  interactableObjects: THREE.Object3D[]
}

// In-memory cache for GLTF models to avoid redundant network/disk fetches
const gltfCache = new Map<string, THREE.Group>()
const loader = new GLTFLoader()

export async function preloadGLTF(url: string): Promise<THREE.Group> {
  if (gltfCache.has(url)) {
    return gltfCache.get(url)!.clone(true)
  }
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      gltf => {
        // Enable shadows on all child meshes
        gltf.scene.traverse(node => {
          if ((node as THREE.Mesh).isMesh) {
            node.castShadow = true
            node.receiveShadow = true
          }
        })
        gltfCache.set(url, gltf.scene)
        resolve(gltf.scene.clone(true))
      },
      undefined,
      error => reject(error)
    )
  })
}

export async function buildArchitecturalOfficeGLTF(): Promise<OfficeSceneBundle> {
  const root = new THREE.Group()
  root.name = 'ArchitecturalOfficeGLTF_Root'

  const ledLights: THREE.Mesh[] = []
  const interactableObjects: THREE.Object3D[] = []

  // ==========================================
  // 1. MATERIAL PALETTE (High-Fidelity PBR)
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

  const matEmeraldCarpet = new THREE.MeshStandardMaterial({
    color: 0x0d5c3a,
    roughness: 0.9,
    metalness: 0.0,
  })

  const matMarbleWhite = new THREE.MeshStandardMaterial({
    color: 0xf4f4f8,
    roughness: 0.15,
    metalness: 0.05,
  })

  const matGlassPartition = new THREE.MeshPhysicalMaterial({
    color: 0xd0e8f2,
    transparent: true,
    opacity: 0.36,
    roughness: 0.08,
    transmission: 0.8,
    thickness: 0.25,
    depthWrite: false,
  })

  const matGlassFrame = new THREE.MeshStandardMaterial({
    color: 0x24282e,
    roughness: 0.4,
    metalness: 0.8,
  })

  const matWallCutaway = new THREE.MeshStandardMaterial({
    color: 0x22262e,
    roughness: 0.6,
    metalness: 0.1,
  })

  const matNeonPurple = new THREE.MeshStandardMaterial({
    color: 0x9333ea,
    emissive: 0xa855f7,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  })

  const matWaterTurquoise = new THREE.MeshPhysicalMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.72,
    roughness: 0.05,
    transmission: 0.65,
    ior: 1.333,
    depthWrite: false,
  })

  // ==========================================
  // 2. MULTI-LEVEL FLOORS & ELEVATIONS
  // ==========================================

  // Level A: Main Open Floor (Y = 0) with architectural cutaways for Sunken Musholla & Pool Deck
  // 1. North Transition Floor (between Mezzanine and lower zones)
  const floorNorthGeo = new THREE.BoxGeometry(32, 0.4, 5)
  const floorNorth = new THREE.Mesh(floorNorthGeo, matLightOak)
  floorNorth.position.set(0, -0.2, 0.0)
  floorNorth.receiveShadow = true
  root.add(floorNorth)

  // 2. Central Open Corridor & Data Center Floor
  const floorCenterGeo = new THREE.BoxGeometry(12, 0.4, 10)
  const floorCenter = new THREE.Mesh(floorCenterGeo, matLightOak)
  floorCenter.position.set(0.0, -0.2, 7.0)
  floorCenter.receiveShadow = true
  root.add(floorCenter)

  // 3. East Floor (Pool Deck surrounding the basin)
  // North pool deck
  const deckN = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 2), matParquet)
  deckN.position.set(11.0, -0.2, 1.0)
  deckN.receiveShadow = true

  // South pool deck
  const deckS = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 2), matParquet)
  deckS.position.set(11.0, -0.2, 11.0)
  deckS.receiveShadow = true

  // East pool rim
  const deckE = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 8), matParquet)
  deckE.position.set(15.25, -0.2, 6.0)
  deckE.receiveShadow = true

  // West pool rim (adjacent to Data Center corridor)
  const deckW = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 8), matParquet)
  deckW.position.set(6.75, -0.2, 6.0)
  deckW.receiveShadow = true
  root.add(deckN, deckS, deckE, deckW)

  // 4. Sunken Musholla Architectural Retaining Walls
  const matCurb = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25 })
  const curbEast = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 10), matCurb)
  curbEast.position.set(-5.85, -0.4, 7.0)
  curbEast.castShadow = true
  curbEast.receiveShadow = true
  const curbNorth = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 0.3), matCurb)
  curbNorth.position.set(-11.0, -0.4, 2.15)
  curbNorth.castShadow = true
  curbNorth.receiveShadow = true
  root.add(curbEast, curbNorth)

  // Level B: Upper Mezzanine (Y = 1.0)
  const upperMezzGeo = new THREE.BoxGeometry(32, 1.0, 10)
  const upperMezz = new THREE.Mesh(upperMezzGeo, matParquet)
  upperMezz.position.set(0, 0.5, -7)
  upperMezz.receiveShadow = true
  root.add(upperMezz)

  // Mezzanine Fascia Trim
  const fasciaGeo = new THREE.BoxGeometry(32, 1.0, 0.3)
  const fascia = new THREE.Mesh(fasciaGeo, matWallCutaway)
  fascia.position.set(0, 0.5, -1.85)
  root.add(fascia)

  // Level C: Sunken Musholla (Y = -0.8)
  const mushollaFloorGeo = new THREE.BoxGeometry(10, 0.3, 10)
  const mushollaFloor = new THREE.Mesh(mushollaFloorGeo, matEmeraldCarpet)
  mushollaFloor.position.set(-11, -0.9, 7)
  mushollaFloor.receiveShadow = true
  root.add(mushollaFloor)

  // Golden Saf Lines in Musholla
  for (let z = 3.8; z <= 10.2; z += 2.1) {
    const safGeo = new THREE.BoxGeometry(9.6, 0.02, 0.12)
    const matSaf = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3 })
    const safMesh = new THREE.Mesh(safGeo, matSaf)
    safMesh.position.set(-11, -0.74, z)
    root.add(safMesh)
  }

  // Marble Staircase down to Musholla
  const numSteps = 5
  const stepWidth = 4.0
  const stepDepth = 0.5
  const totalDrop = 0.8
  for (let i = 0; i < numSteps; i++) {
    const stepH = totalDrop / numSteps
    const stepGeo = new THREE.BoxGeometry(stepWidth, stepH, stepDepth)
    const stepMesh = new THREE.Mesh(stepGeo, matMarbleWhite)
    stepMesh.position.set(-5.0, -(i * stepH) - stepH / 2, 3.5 + i * stepDepth)
    stepMesh.receiveShadow = true
    stepMesh.castShadow = true
    root.add(stepMesh)
  }

  // Brass Handrail
  const matBrass = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 })
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9), matBrass)
    p.position.set(-3.0, -0.2 - i * 0.2, 3.5 + i * 1.0)
    root.add(p)
  }

  // Level D: Rooftop Terrace & Swimming Pool Basin
  const poolOuterGeo = new THREE.BoxGeometry(7, 0.9, 8)
  const poolBasin = new THREE.Mesh(poolOuterGeo, matMarbleWhite)
  poolBasin.position.set(11, -0.5, 6)
  root.add(poolBasin)

  const poolWaterGeo = new THREE.BoxGeometry(6.4, 0.7, 7.4)
  const poolWater = new THREE.Mesh(poolWaterGeo, matWaterTurquoise)
  poolWater.position.set(11, -0.15, 6)
  root.add(poolWater)

  // Chrome Pool Ladder
  const matChrome = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.95, roughness: 0.1 })
  const ladderR1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2), matChrome)
  ladderR1.position.set(13.9, 0.2, 5.0)
  const ladderR2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2), matChrome)
  ladderR2.position.set(13.9, 0.2, 5.6)
  root.add(ladderR1, ladderR2)

  // ==========================================
  // 3. ARCHITECTURAL PARTITIONS & GLASS FISHBOWL
  // ==========================================
  const buildGlassWall = (x: number, z: number, w: number, d: number, hasDoor = false) => {
    const wallGroup = new THREE.Group()
    const height = 2.4

    if (hasDoor) {
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.35, height, d), matGlassPartition)
      p1.position.set(-w * 0.32, height / 2, 0)
      const p2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.35, height, d), matGlassPartition)
      p2.position.set(w * 0.32, height / 2, 0)
      const p3 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, height * 0.2, d), matGlassPartition)
      p3.position.set(0, height * 0.9, 0)
      wallGroup.add(p1, p2, p3)
    } else {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), matGlassPartition)
      panel.position.set(0, height / 2, 0)
      wallGroup.add(panel)
    }

    const frameBottom = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d * 1.5), matGlassFrame)
    frameBottom.position.set(0, 0.04, 0)
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d * 1.5), matGlassFrame)
    frameTop.position.set(0, height - 0.04, 0)
    wallGroup.add(frameBottom, frameTop)

    wallGroup.position.set(x, 1.0, z)
    return wallGroup
  }

  root.add(buildGlassWall(0, -2.1, 8.0, 0.08, true))
  root.add(buildGlassWall(-4.0, -6.5, 0.08, 9.0, false))
  root.add(buildGlassWall(4.0, -6.5, 0.08, 9.0, false))

  // Boss Boiserie Wood Partition
  const bossWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 9.0), matDarkWood)
  bossWall.position.set(4.1, 2.2, -6.5)
  root.add(bossWall)

  // Arcade Backwall with Neon Strips
  const arcadeBackWall = new THREE.Mesh(new THREE.BoxGeometry(7.0, 2.4, 0.2), matWallCutaway)
  arcadeBackWall.position.set(-8.0, 2.2, -11.0)
  root.add(arcadeBackWall)
  for (let x = -10.5; x <= -5.5; x += 1.8) {
    const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.0, 0.05), matNeonPurple)
    neonStrip.position.set(x, 2.2, -10.85)
    root.add(neonStrip)
  }

  // Musholla Mihrab Niche
  const mihrabGroup = new THREE.Group()
  const mihrabBack = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 0.3), matDarkWood)
  mihrabBack.position.set(0, 1.2, 0)
  const mihrabGoldTrim = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.35), matBrass)
  mihrabGoldTrim.position.set(0, 2.2, 0)
  mihrabGroup.add(mihrabBack, mihrabGoldTrim)
  mihrabGroup.position.set(-11, -0.8, 2.0)
  root.add(mihrabGroup)

  // ==========================================
  // 4. LOAD & INSTANTIATE REAL 3D GLTF FURNITURE
  // ==========================================
  try {
    // --- A. RUANG BOS (CEO Jarvis Executive Suite) ---
    const bossDesk = await preloadGLTF('/models/furniture/desk.glb')
    bossDesk.scale.set(2.4, 2.2, 2.2)
    bossDesk.position.set(9.0, 1.0, -6.5)
    bossDesk.rotation.y = Math.PI

    const bossChair = await preloadGLTF('/models/furniture/chairDesk.glb')
    bossChair.scale.set(2.2, 2.2, 2.2)
    bossChair.position.set(9.0, 1.0, -7.5)

    const bossLaptop = await preloadGLTF('/models/furniture/laptop.glb')
    bossLaptop.scale.set(1.8, 1.8, 1.8)
    bossLaptop.position.set(9.0, 1.85, -6.5)

    const bossSofa = await preloadGLTF('/models/furniture/loungeDesignSofa.glb')
    bossSofa.scale.set(2.2, 2.2, 2.2)
    bossSofa.position.set(11.5, 1.0, -4.5)
    bossSofa.rotation.y = -Math.PI / 2

    const bossCoffeeTable = await preloadGLTF('/models/furniture/tableCoffeeGlass.glb')
    bossCoffeeTable.scale.set(2.0, 2.0, 2.0)
    bossCoffeeTable.position.set(10.0, 1.0, -4.5)

    const bossPlant = await preloadGLTF('/models/furniture/pottedPlant.glb')
    bossPlant.scale.set(2.4, 2.4, 2.4)
    bossPlant.position.set(6.2, 1.0, -10.5)

    const bossLamp = await preloadGLTF('/models/furniture/lampRoundFloor.glb')
    bossLamp.scale.set(2.2, 2.2, 2.2)
    bossLamp.position.set(12.5, 1.0, -10.5)

    root.add(bossDesk, bossChair, bossLaptop, bossSofa, bossCoffeeTable, bossPlant, bossLamp)

    // --- B. RUANG RAPAT KACA (Boardroom Conference) ---
    const confTable = await preloadGLTF('/models/furniture/tableRound.glb')
    confTable.scale.set(2.8, 2.4, 2.8)
    confTable.position.set(0.0, 1.0, -6.5)
    root.add(confTable)

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      const chair = await preloadGLTF('/models/furniture/chairModernFrameCushion.glb')
      chair.scale.set(2.0, 2.0, 2.0)
      chair.position.set(Math.cos(angle) * 2.2, 1.0, -6.5 + Math.sin(angle) * 2.2)
      chair.lookAt(0.0, 1.0, -6.5)
      root.add(chair)
    }

    // --- C. SOFTWARE ENGINEERING PODS (SWE Dev Cluster) ---
    const buildDevPodGLTF = async (x: number, z: number) => {
      const podGroup = new THREE.Group()

      const desk = await preloadGLTF('/models/furniture/desk.glb')
      desk.scale.set(2.4, 2.2, 2.2)
      desk.position.set(0, 0, 0)

      // Dual Monitors
      const screen1 = await preloadGLTF('/models/furniture/computerScreen.glb')
      screen1.scale.set(2.2, 2.2, 2.2)
      screen1.position.set(-0.45, 0.85, -0.2)
      screen1.rotation.y = 0.2

      const screen2 = await preloadGLTF('/models/furniture/computerScreen.glb')
      screen2.scale.set(2.2, 2.2, 2.2)
      screen2.position.set(0.45, 0.85, -0.2)
      screen2.rotation.y = -0.2

      // Keyboard & Mouse
      const keyboard = await preloadGLTF('/models/furniture/computerKeyboard.glb')
      keyboard.scale.set(2.0, 2.0, 2.0)
      keyboard.position.set(0, 0.85, 0.1)

      const mouse = await preloadGLTF('/models/furniture/computerMouse.glb')
      mouse.scale.set(2.0, 2.0, 2.0)
      mouse.position.set(0.45, 0.85, 0.1)

      // Chair
      const chair = await preloadGLTF('/models/furniture/chairDesk.glb')
      chair.scale.set(2.0, 2.0, 2.0)
      chair.position.set(0, 0, 0.85)

      // Desk Succulent
      const plant = await preloadGLTF('/models/furniture/plantSmall1.glb')
      plant.scale.set(1.8, 1.8, 1.8)
      plant.position.set(-0.75, 0.85, -0.2)

      podGroup.add(desk, screen1, screen2, keyboard, mouse, chair, plant)
      podGroup.position.set(x, 0, z)
      return podGroup
    }

    const pod1 = await buildDevPodGLTF(-4.0, 1.0)
    const pod2 = await buildDevPodGLTF(0.0, 1.0)
    const pod3 = await buildDevPodGLTF(-4.0, 4.5)
    const pod4 = await buildDevPodGLTF(0.0, 4.5)
    root.add(pod1, pod2, pod3, pod4)

    // Agile Scrum Board
    const scrumBoard = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.8, 0.1), matMarbleWhite)
    scrumBoard.position.set(3.5, 1.4, 2.5)
    root.add(scrumBoard)

    // --- D. LABORATORIUM & PERPUSTAKAAN SENKU ---
    const bookcaseWide = await preloadGLTF('/models/furniture/bookcaseClosedWide.glb')
    bookcaseWide.scale.set(2.6, 2.6, 2.6)
    bookcaseWide.position.set(-7.5, 0, 0)
    bookcaseWide.rotation.y = -Math.PI / 2

    const bookcaseOpen = await preloadGLTF('/models/furniture/bookcaseOpen.glb')
    bookcaseOpen.scale.set(2.6, 2.6, 2.6)
    bookcaseOpen.position.set(-7.5, 0, 2.2)
    bookcaseOpen.rotation.y = -Math.PI / 2

    const books = await preloadGLTF('/models/furniture/books.glb')
    books.scale.set(2.4, 2.4, 2.4)
    books.position.set(-10.5, 0.85, 0.4)

    const senkuDesk = await preloadGLTF('/models/furniture/desk.glb')
    senkuDesk.scale.set(2.4, 2.2, 2.2)
    senkuDesk.position.set(-11.0, 0, 0)

    // Chemistry Glassware & Beakers (Glow)
    const matPurpleGlow = new THREE.MeshStandardMaterial({ color: 0x9333ea, emissive: 0xc084fc, emissiveIntensity: 1.0 })
    const matGreenGlow = new THREE.MeshStandardMaterial({ color: 0x16a34a, emissive: 0x4ade80, emissiveIntensity: 1.0 })
    const flask1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.25), matPurpleGlow)
    flask1.position.set(-11.8, 0.98, 0)
    const flask2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.25), matGreenGlow)
    flask2.position.set(-11.3, 0.98, 0)

    // Precision Microscope
    const microscope = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.25), matMarbleWhite)
    microscope.position.set(-10.2, 1.05, 0)

    root.add(bookcaseWide, bookcaseOpen, books, senkuDesk, flask1, flask2, microscope)

    // --- E. DATA CENTER & LAKEHOUSE SERVER RACKS ---
    const buildServerRack = (x: number, z: number) => {
      const rack = new THREE.Group()
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 1.0), matGlassFrame)
      cabinet.position.set(0, 1.3, 0)
      rack.add(cabinet)

      for (let r = 0; r < 5; r++) {
        const led = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.04, 0.05),
          new THREE.MeshStandardMaterial({
            color: r % 2 === 0 ? 0x10b981 : 0x06b6d4,
            emissive: r % 2 === 0 ? 0x34d399 : 0x38bdf8,
            emissiveIntensity: 1.4,
          })
        )
        led.position.set(0, 0.6 + r * 0.4, 0.51)
        rack.add(led)
        ledLights.push(led)
      }
      rack.position.set(x, 0, z)
      return rack
    }

    root.add(buildServerRack(4.0, 8.5))
    root.add(buildServerRack(6.0, 8.5))

    const dataDesk = await preloadGLTF('/models/furniture/desk.glb')
    dataDesk.scale.set(2.0, 2.0, 2.0)
    dataDesk.position.set(5.0, 0, 6.0)

    const dataScreen = await preloadGLTF('/models/furniture/computerScreen.glb')
    dataScreen.scale.set(2.0, 2.0, 2.0)
    dataScreen.position.set(5.0, 0.8, 5.8)

    const dataChair = await preloadGLTF('/models/furniture/chairDesk.glb')
    dataChair.scale.set(1.9, 1.9, 1.9)
    dataChair.position.set(5.0, 0, 6.7)

    root.add(dataDesk, dataScreen, dataChair)

    // --- F. KAFETARIA & ESPRESSO BAR ---
    const bar = await preloadGLTF('/models/furniture/kitchenBar.glb')
    bar.scale.set(2.6, 2.4, 2.6)
    bar.position.set(0, 0, 9.5)

    const barEnd = await preloadGLTF('/models/furniture/kitchenBarEnd.glb')
    barEnd.scale.set(2.6, 2.4, 2.6)
    barEnd.position.set(1.2, 0, 9.5)

    const coffeeMachine = await preloadGLTF('/models/furniture/kitchenCoffeeMachine.glb')
    coffeeMachine.scale.set(2.0, 2.0, 2.0)
    coffeeMachine.position.set(0.6, 1.0, 9.5)

    const fridge = await preloadGLTF('/models/furniture/kitchenFridgeLarge.glb')
    fridge.scale.set(2.4, 2.4, 2.4)
    fridge.position.set(2.8, 0, 9.5)
    fridge.rotation.y = -Math.PI / 2

    const diningTable = await preloadGLTF('/models/furniture/table.glb')
    diningTable.scale.set(2.2, 2.2, 2.2)
    diningTable.position.set(-4.0, 0, 9.5)

    const diningChair1 = await preloadGLTF('/models/furniture/chairRounded.glb')
    diningChair1.scale.set(2.0, 2.0, 2.0)
    diningChair1.position.set(-4.8, 0, 9.5)
    diningChair1.lookAt(-4.0, 0, 9.5)

    const diningChair2 = await preloadGLTF('/models/furniture/chairRounded.glb')
    diningChair2.scale.set(2.0, 2.0, 2.0)
    diningChair2.position.set(-3.2, 0, 9.5)
    diningChair2.lookAt(-4.0, 0, 9.5)

    root.add(bar, barEnd, coffeeMachine, fridge, diningTable, diningChair1, diningChair2)

    // --- G. ENTERTAINMENT & ARCADE LOUNGE ---
    const poolTableBody = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.75, 1.8), matDarkWood)
    poolTableBody.position.set(-8.0, 1.38, -6.5)
    const poolTableFelt = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.05, 1.5), matEmeraldCarpet)
    poolTableFelt.position.set(-8.0, 1.78, -6.5)
    root.add(poolTableBody, poolTableFelt)

    const arcadeSofa = await preloadGLTF('/models/furniture/loungeSofaLong.glb')
    arcadeSofa.scale.set(2.2, 2.2, 2.2)
    arcadeSofa.position.set(-11.5, 1.0, -4.5)
    arcadeSofa.rotation.y = Math.PI / 2

    const arcadeChair = await preloadGLTF('/models/furniture/loungeChairRelax.glb')
    arcadeChair.scale.set(2.0, 2.0, 2.0)
    arcadeChair.position.set(-6.5, 1.0, -4.5)

    root.add(arcadeSofa, arcadeChair)

    // --- H. ROOFTOP SUNDECK ---
    const sunbed1 = await preloadGLTF('/models/furniture/benchCushionLow.glb')
    sunbed1.scale.set(2.2, 2.0, 2.0)
    sunbed1.position.set(11.0, 0.0, 1.5)

    const sunbed2 = await preloadGLTF('/models/furniture/benchCushionLow.glb')
    sunbed2.scale.set(2.2, 2.0, 2.0)
    sunbed2.position.set(13.2, 0.0, 1.5)

    const poolPlant = await preloadGLTF('/models/furniture/pottedPlant.glb')
    poolPlant.scale.set(2.4, 2.4, 2.4)
    poolPlant.position.set(14.5, 0.0, 10.5)

    root.add(sunbed1, sunbed2, poolPlant)
  } catch (err) {
    console.error('Failed to load some GLTF furniture models:', err)
  }

  return {
    rootGroup: root,
    waterMesh: poolWater,
    ledLights,
    interactableObjects,
  }
}
