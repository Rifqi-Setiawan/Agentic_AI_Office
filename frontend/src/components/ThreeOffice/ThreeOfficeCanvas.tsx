import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { buildArchitecturalOfficeGLTF, OfficeSceneBundle } from './officeModelBuilder'
import { INITIAL_3D_AGENTS, Agent3DDef, createAgent3DInstance } from './avatar3DManager'
import './three-office.css'

interface ThreeOfficeCanvasProps {
  onBackToClassic?: () => void
}

export const ThreeOfficeCanvas: React.FC<ThreeOfficeCanvasProps> = ({ onBackToClassic }) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const [agents, setAgents] = useState<Agent3DDef[]>(INITIAL_3D_AGENTS)
  const [selectedRoom, setSelectedRoom] = useState<string>('all')
  const [zoomLevel, setZoomLevel] = useState<number>(1.0)

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const bundleRef = useRef<OfficeSceneBundle | null>(null)
  const isDraggingRef = useRef(false)
  const lastMousePosRef = useRef({ x: 0, y: 0 })
  const targetCamPosRef = useRef(new THREE.Vector3(28, 28, 28))
  const targetLookAtRef = useRef(new THREE.Vector3(0, 0, 0))
  const currentLookAtRef = useRef(new THREE.Vector3(0, 0, 0))

  // Agent sprite meshes
  const agentMeshesRef = useRef<Map<string, THREE.Group>>(new Map())
  const calloutElementsRef = useRef<Map<string, HTMLDivElement>>(new Map())

  const [showDialogs, setShowDialogs] = useState<boolean>(true)
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null)
  const [lightingMode, setLightingMode] = useState<'day' | 'dusk' | 'night'>('day')
  const [activeActivity, setActiveActivity] = useState<'work' | 'meeting' | 'swim' | 'sholat'>('work')
  const [inspectedAgent, setInspectedAgent] = useState<Agent3DDef | null>(null)

  const lightsRef = useRef<{
    hemi: THREE.HemisphereLight
    sun: THREE.DirectionalLight
    rim: THREE.DirectionalLight
    boss: THREE.PointLight
    lab: THREE.PointLight
    musholla: THREE.PointLight
    data: THREE.PointLight
    arcade: THREE.PointLight
    pool: THREE.PointLight
  } | null>(null)

  // Room Camera Targets
  const ROOM_TARGETS: Record<string, { lookAt: [number, number, number]; zoom: number; label: string; icon: string; agentRoles?: string[] }> = {
    'all': { lookAt: [0, 0, 0], zoom: 1.0, label: 'Semua Ruangan (Penthouse Overview)', icon: '🏢' },
    'boss': { lookAt: [9.0, 1.4, -6.5], zoom: 2.85, label: 'Ruang Bos (Executive Suite)', icon: '👑', agentRoles: ['vps-boss', 'vps-assistant'] },
    'meeting': { lookAt: [0.0, 1.4, -6.5], zoom: 2.85, label: 'Ruang Rapat Kaca (Boardroom)', icon: '🤝', agentRoles: ['tech-mentor', 'chief-architect'] },
    'swe': { lookAt: [-2.0, 0.5, 3.0], zoom: 2.7, label: 'Software Engineering Pods', icon: '💻', agentRoles: ['swe-backend', 'swe-frontend', 'swe-qa', 'ui-designer'] },
    'senku': { lookAt: [-10.0, 0.5, 0.5], zoom: 2.85, label: 'Laboratorium & Perpustakaan Senku', icon: '🧪', agentRoles: ['senku', 'paperwright'] },
    'data': { lookAt: [5.0, 0.5, 7.5], zoom: 2.85, label: 'Data Center & Lakehouse Server', icon: '🗄️', agentRoles: ['data-engineer', 'devops-engineer'] },
    'musholla': { lookAt: [-11.0, -0.5, 7.0], zoom: 2.65, label: 'Musholla Khusus (Lower Level)', icon: '🕌', agentRoles: ['dimas-musholla'] },
    'pool': { lookAt: [11.0, 0.0, 6.0], zoom: 2.65, label: 'Rooftop Terrace & Kolam Renang', icon: '🏊', agentRoles: ['rifqi'] },
    'arcade': { lookAt: [-8.0, 1.4, -6.5], zoom: 2.85, label: 'Arcade & Game Lounge', icon: '🕹️' },
  }

  const focusRoom = useCallback((roomId: string) => {
    const target = ROOM_TARGETS[roomId]
    if (!target || !cameraRef.current) return
    setSelectedRoom(roomId)

    // Kill any in-flight tweens
    gsap.killTweensOf(targetLookAtRef.current)
    gsap.killTweensOf(cameraRef.current)

    // Smooth cinematic pan flight
    gsap.to(targetLookAtRef.current, {
      x: target.lookAt[0],
      y: target.lookAt[1],
      z: target.lookAt[2],
      duration: 1.25,
      ease: 'power2.inOut',
    })

    // Smooth synchronized zoom transition
    const cam = cameraRef.current
    gsap.to(cam, {
      zoom: target.zoom,
      duration: 1.25,
      ease: 'power2.inOut',
      onUpdate: () => {
        cam.updateProjectionMatrix()
        setZoomLevel(cam.zoom)
      },
    })
  }, [])

  const setAtmosphere = useCallback((mode: 'day' | 'dusk' | 'night') => {
    setLightingMode(mode)
    if (!lightsRef.current || !sceneRef.current) return
    const l = lightsRef.current
    const scene = sceneRef.current

    const targetColors = {
      day: {
        bg: new THREE.Color(0x0e1117),
        hemiSky: new THREE.Color(0xdbeafe),
        hemiGnd: new THREE.Color(0x473223),
        hemiInt: 0.95,
        sunColor: new THREE.Color(0xfff7ed),
        sunInt: 1.45,
        rimColor: new THREE.Color(0x93c5fd),
        rimInt: 0.45,
        bossInt: 0.9,
        labInt: 0.85,
        mushollaInt: 1.0,
        dataInt: 0.9,
        arcadeInt: 0.9,
        poolInt: 0.8,
      },
      dusk: {
        bg: new THREE.Color(0x180f14),
        hemiSky: new THREE.Color(0xfed7aa),
        hemiGnd: new THREE.Color(0x291811),
        hemiInt: 0.85,
        sunColor: new THREE.Color(0xf97316),
        sunInt: 1.7,
        rimColor: new THREE.Color(0xec4899),
        rimInt: 0.65,
        bossInt: 1.4,
        labInt: 1.3,
        mushollaInt: 1.5,
        dataInt: 1.4,
        arcadeInt: 1.5,
        poolInt: 1.2,
      },
      night: {
        bg: new THREE.Color(0x050811),
        hemiSky: new THREE.Color(0x1e1b4b),
        hemiGnd: new THREE.Color(0x030712),
        hemiInt: 0.35,
        sunColor: new THREE.Color(0x3b82f6),
        sunInt: 0.35,
        rimColor: new THREE.Color(0x818cf8),
        rimInt: 0.4,
        bossInt: 2.2,
        labInt: 2.0,
        mushollaInt: 2.3,
        dataInt: 2.5,
        arcadeInt: 2.5,
        poolInt: 2.2,
      },
    }[mode]

    gsap.to(scene.background, {
      r: targetColors.bg.r,
      g: targetColors.bg.g,
      b: targetColors.bg.b,
      duration: 0.9,
      ease: 'power2.inOut',
    })

    gsap.to(l.hemi.color, { r: targetColors.hemiSky.r, g: targetColors.hemiSky.g, b: targetColors.hemiSky.b, duration: 0.9 })
    gsap.to(l.hemi.groundColor, { r: targetColors.hemiGnd.r, g: targetColors.hemiGnd.g, b: targetColors.hemiGnd.b, duration: 0.9 })
    gsap.to(l.hemi, { intensity: targetColors.hemiInt, duration: 0.9 })

    gsap.to(l.sun.color, { r: targetColors.sunColor.r, g: targetColors.sunColor.g, b: targetColors.sunColor.b, duration: 0.9 })
    gsap.to(l.sun, { intensity: targetColors.sunInt, duration: 0.9 })

    gsap.to(l.rim.color, { r: targetColors.rimColor.r, g: targetColors.rimColor.g, b: targetColors.rimColor.b, duration: 0.9 })
    gsap.to(l.rim, { intensity: targetColors.rimInt, duration: 0.9 })

    gsap.to(l.boss, { intensity: targetColors.bossInt, duration: 0.9 })
    gsap.to(l.lab, { intensity: targetColors.labInt, duration: 0.9 })
    gsap.to(l.musholla, { intensity: targetColors.mushollaInt, duration: 0.9 })
    gsap.to(l.data, { intensity: targetColors.dataInt, duration: 0.9 })
    gsap.to(l.arcade, { intensity: targetColors.arcadeInt, duration: 0.9 })
    gsap.to(l.pool, { intensity: targetColors.poolInt, duration: 0.9 })
  }, [])

  const handleTriggerActivity = useCallback((activity: 'work' | 'meeting' | 'swim' | 'sholat') => {
    setActiveActivity(activity)

    if (activity === 'swim') {
      // Rifqi swims in rooftop pool
      const mesh = agentMeshesRef.current.get('rifqi')
      if (mesh) {
        mesh.userData.state = 'swimming'
        gsap.to(mesh.userData, { baseY: -0.38, duration: 1.4 })
        gsap.to(mesh.position, { x: 11.0, z: 6.0, duration: 1.4, ease: 'power2.inOut' })
      }
      setAgents(prev => prev.map(a => a.id === 'rifqi' ? { ...a, state: 'swimming', speechText: 'Berenang di rooftop pool 🏊' } : a))
      focusRoom('pool')
    } else if (activity === 'meeting') {
      // Tech-mentor, Chief-architect, SWE Devs move to Boardroom table
      const meetingSpots = [
        { id: 'tech-mentor', pos: [-1.4, 1.0, -6.5], rot: Math.PI / 2, speech: 'Membahas arsitektur event-driven 🤝' },
        { id: 'chief-architect', pos: [1.4, 1.0, -6.5], rot: -Math.PI / 2, speech: 'Validasi RFC blueprint sistem 📐' },
        { id: 'swe-backend', pos: [-0.8, 1.0, -8.2], rot: 0, speech: 'Refactoring connection pool DuckDB 💻' },
        { id: 'swe-frontend', pos: [0.8, 1.0, -8.2], rot: 0, speech: 'Sinkronisasi GSAP & Three.js 🎨' },
        { id: 'ui-designer', pos: [0.0, 1.0, -4.8], rot: Math.PI, speech: 'Standar anti-AI-slop disetujui ✨' },
      ]

      meetingSpots.forEach(s => {
        const mesh = agentMeshesRef.current.get(s.id)
        if (mesh) {
          mesh.userData.state = 'meeting'
          gsap.to(mesh.userData, { baseY: s.pos[1], duration: 1.5 })
          gsap.to(mesh.position, { x: s.pos[0], z: s.pos[2], duration: 1.5, ease: 'power2.inOut' })
          gsap.to(mesh.rotation, { y: s.rot, duration: 0.8 })
        }
      })

      setAgents(prev => prev.map(a => {
        const spot = meetingSpots.find(s => s.id === a.id)
        if (spot) {
          return { ...a, state: 'meeting', speechText: spot.speech }
        }
        return a
      }))
      focusRoom('meeting')
    } else if (activity === 'sholat') {
      // Dimas, DevOps, Assistant sholat di musholla
      const mushollaSpots = [
        { id: 'dimas-musholla', pos: [-11.0, -0.75, 5.8], rot: Math.PI, speech: 'Allāhu akbar... ٱللَّٰهُ أَكْبَرُ 🤲' },
        { id: 'vps-assistant', pos: [-9.0, -0.75, 7.8], rot: Math.PI, speech: 'Sholat berjamaah di musholla 🕌' },
        { id: 'devops-engineer', pos: [-13.0, -0.75, 7.8], rot: Math.PI, speech: 'Istirahat sholat sejenak 🤲' },
      ]

      mushollaSpots.forEach(s => {
        const mesh = agentMeshesRef.current.get(s.id)
        if (mesh) {
          mesh.userData.state = 'praying'
          gsap.to(mesh.userData, { baseY: s.pos[1], duration: 1.6 })
          gsap.to(mesh.position, { x: s.pos[0], z: s.pos[2], duration: 1.6, ease: 'power2.inOut' })
          gsap.to(mesh.rotation, { y: s.rot, duration: 0.8 })
        }
      })

      setAgents(prev => prev.map(a => {
        const spot = mushollaSpots.find(s => s.id === a.id)
        if (spot) {
          return { ...a, state: 'praying', speechText: spot.speech }
        }
        return a
      }))
      focusRoom('musholla')
    } else if (activity === 'work') {
      // All return to work desks
      INITIAL_3D_AGENTS.forEach(def => {
        const mesh = agentMeshesRef.current.get(def.id)
        if (mesh) {
          mesh.userData.state = 'working'
          gsap.to(mesh.userData, { baseY: def.position.y, duration: 1.4 })
          gsap.to(mesh.position, { x: def.position.x, z: def.position.z, duration: 1.4, ease: 'power2.inOut' })
          if (def.rotationY !== undefined) {
            gsap.to(mesh.rotation, { y: def.rotationY, duration: 0.8 })
          }
        }
      })

      setAgents(INITIAL_3D_AGENTS)
      focusRoom('all')
    }
  }, [focusRoom])

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight

    // 1. Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0e1117)
    sceneRef.current = scene
    ;(window as any).__scene = scene
    ;(window as any).__camera = cameraRef

    // 2. Orthographic Camera (True Isometric)
    const aspect = width / height
    const frustumSize = 38
    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      -200,
      500
    )
    camera.position.set(28, 28, 28)
    camera.lookAt(0, 0, 0)
    camera.zoom = 1.0
    camera.updateProjectionMatrix()
    cameraRef.current = camera

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    rendererRef.current = renderer
    container.appendChild(renderer.domElement)

    // 4. Studio Three-Point Lighting + Global Illumination Bounces
    // A. Hemisphere Light (Soft Sky Blue + Warm Oak Floor Bounce)
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x473223, 0.95)
    hemiLight.position.set(0, 40, 0)
    scene.add(hemiLight)

    // B. Key Sun Light (Warm Direct Sunlight with High-Res Shadows)
    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.45)
    sunLight.position.set(22, 38, 24)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = 2048
    sunLight.shadow.mapSize.height = 2048
    sunLight.shadow.camera.near = 0.5
    sunLight.shadow.camera.far = 100
    const d = 26
    sunLight.shadow.camera.left = -d
    sunLight.shadow.camera.right = d
    sunLight.shadow.camera.top = d
    sunLight.shadow.camera.bottom = -d
    sunLight.shadow.bias = -0.0002
    sunLight.shadow.normalBias = 0.02
    scene.add(sunLight)

    // C. Rim / Accent Light (Cool Backlight for Crisp Silhouette Separation)
    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.45)
    rimLight.position.set(-24, 20, -26)
    scene.add(rimLight)

    // D. Room-Specific Interior Point Lights
    const bossLight = new THREE.PointLight(0xfef08a, 0.9, 12)
    bossLight.position.set(9.0, 2.5, -6.5)
    scene.add(bossLight)

    const labLight = new THREE.PointLight(0x6ee7b7, 0.85, 14)
    labLight.position.set(-10.0, 2.2, 0.0)
    scene.add(labLight)

    const mushollaLight = new THREE.PointLight(0xfde047, 1.0, 10)
    mushollaLight.position.set(-11.0, 1.5, 7.0)
    scene.add(mushollaLight)

    const dataLight = new THREE.PointLight(0x38bdf8, 0.9, 12)
    dataLight.position.set(5.0, 2.2, 7.5)
    scene.add(dataLight)

    const arcadeLight = new THREE.PointLight(0xc084fc, 0.9, 12)
    arcadeLight.position.set(-8.0, 2.5, -6.5)
    scene.add(arcadeLight)

    const poolLight = new THREE.PointLight(0x06b6d4, 0.8, 14)
    poolLight.position.set(11.0, 0.8, 6.0)
    scene.add(poolLight)

    lightsRef.current = {
      hemi: hemiLight,
      sun: sunLight,
      rim: rimLight,
      boss: bossLight,
      lab: labLight,
      musholla: mushollaLight,
      data: dataLight,
      arcade: arcadeLight,
      pool: poolLight,
    }

    // 5. Build Architectural Office Scene with Real 3D GLTF Furniture Models
    let isDisposed = false

    buildArchitecturalOfficeGLTF().then(bundle => {
      if (isDisposed) return
      bundleRef.current = bundle
      scene.add(bundle.rootGroup)
    }).catch(err => {
      console.error('Failed to load architectural GLTF scene:', err)
    })

    // 6. Build 3D Agent Avatars (Real 3D Human Models)
    INITIAL_3D_AGENTS.forEach(def => {
      createAgent3DInstance(def).then(agentGroup => {
        if (isDisposed) return
        scene.add(agentGroup)
        agentMeshesRef.current.set(def.id, agentGroup)
      }).catch(err => {
        console.error(`Failed to load avatar model for ${def.name}:`, err)
      })
    })

    // 7. Mouse Pan & Zoom Handlers
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 1) {
        isDraggingRef.current = true
        lastMousePosRef.current = { x: e.clientX, y: e.clientY }
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !cameraRef.current) return
      const dx = e.clientX - lastMousePosRef.current.x
      const dy = e.clientY - lastMousePosRef.current.y
      lastMousePosRef.current = { x: e.clientX, y: e.clientY }

      // Kill any active flyTo tweens on manual user drag
      gsap.killTweensOf(targetLookAtRef.current)

      // Pan along isometric ground plane
      const panFactor = 0.035 * (1.0 / (cameraRef.current.zoom || 1.0))
      const right = new THREE.Vector3(-1, 0, 1).normalize()
      const up = new THREE.Vector3(1, 0, 1).normalize()

      targetLookAtRef.current.addScaledVector(right, -dx * panFactor)
      targetLookAtRef.current.addScaledVector(up, dy * panFactor)
    }

    const onMouseUp = () => {
      isDraggingRef.current = false
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (!cameraRef.current) return
      const factor = e.deltaY < 0 ? 1.15 : 0.87
      const targetZoom = Math.max(0.6, Math.min(3.5, (cameraRef.current.zoom || 1.0) * factor))

      gsap.killTweensOf(cameraRef.current)
      gsap.to(cameraRef.current, {
        zoom: targetZoom,
        duration: 0.28,
        ease: 'power1.out',
        onUpdate: () => {
          if (cameraRef.current) {
            cameraRef.current.updateProjectionMatrix()
            setZoomLevel(cameraRef.current.zoom)
          }
        },
      })
    }

    container.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    container.addEventListener('wheel', onWheel, { passive: false })

    // 8. Animation Loop (60 FPS)
    let reqId = 0
    let clock = new THREE.Clock()

    const animate = () => {
      reqId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      // Smooth camera pan glide
      currentLookAtRef.current.lerp(targetLookAtRef.current, 0.08)
      camera.position.x = currentLookAtRef.current.x + 28
      camera.position.y = currentLookAtRef.current.y + 28
      camera.position.z = currentLookAtRef.current.z + 28
      camera.lookAt(currentLookAtRef.current)

      // Water Ripple Oscillation
      if (bundleRef.current?.waterMesh) {
        bundleRef.current.waterMesh.position.y = -0.35 + Math.sin(t * 2.2) * 0.03
      }

      // LED server pulses
      bundleRef.current?.ledLights.forEach((led: THREE.Mesh, idx: number) => {
        const mat = led.material as THREE.MeshStandardMaterial
        if (mat && mat.emissiveIntensity !== undefined) {
          mat.emissiveIntensity = 0.8 + Math.sin(t * 4 + idx * 0.7) * 0.5
        }
      })

      // Bobbing character animations
      agentMeshesRef.current.forEach((mesh, id) => {
        const baseY = mesh.userData.baseY !== undefined ? mesh.userData.baseY : 1.0
        if (mesh.userData.state === 'swimming') {
          mesh.position.y = baseY + Math.sin(t * 2.5) * 0.04
        } else {
          mesh.position.y = baseY + Math.sin(t * 1.5 + (id.charCodeAt(0) % 5)) * 0.02
        }
      })

      renderer.render(scene, camera)

      // Project 3D positions directly to DOM callout elements (Zero React re-renders!)
      INITIAL_3D_AGENTS.forEach(agent => {
        const mesh = agentMeshesRef.current.get(agent.id)
        const el = calloutElementsRef.current.get(agent.id)
        if (!mesh || !el) return

        const pos = new THREE.Vector3()
        mesh.getWorldPosition(pos)
        pos.y += 1.4 // Head height
        pos.project(camera)

        const x = (pos.x * 0.5 + 0.5) * width
        const y = (-(pos.y * 0.5) + 0.5) * height
        const visible = pos.z > -1 && pos.z < 1

        el.style.left = `${x}px`
        el.style.top = `${y}px`
        el.style.display = visible ? 'flex' : 'none'
      })
    }

    animate()

    // 9. Resize Handler
    const onResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return
      const w = container.clientWidth || window.innerWidth
      const h = container.clientHeight || window.innerHeight
      const asp = w / h
      cameraRef.current.left = (-frustumSize * asp) / 2
      cameraRef.current.right = (frustumSize * asp) / 2
      cameraRef.current.top = frustumSize / 2
      cameraRef.current.bottom = -frustumSize / 2
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      isDisposed = true
      cancelAnimationFrame(reqId)
      window.removeEventListener('resize', onResize)
      container.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      container.removeEventListener('wheel', onWheel)
      if (rendererRef.current) {
        rendererRef.current.dispose()
        if (rendererRef.current.domElement && rendererRef.current.domElement.parentNode) {
          rendererRef.current.domElement.parentNode.removeChild(rendererRef.current.domElement)
        }
      }
    }
  }, [focusRoom])

  return (
    <div className="three-office-viewport">
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="three-canvas-container" />

      {/* Top Floating Glass HUD */}
      <header className="three-hud-header">
        <div className="three-brand">
          <span className="brand-dot" />
          <span className="brand-title">RIFQI STUDIO — 3D ARCHITECTURAL CYBER-OFFICE</span>
          <span className="brand-badge">THREE.JS NATIVE</span>
        </div>

        <div className="three-room-pills">
          {Object.entries(ROOM_TARGETS).map(([key, data]) => (
            <button
              key={key}
              className={`three-pill-btn ${selectedRoom === key ? 'active' : ''}`}
              onClick={() => focusRoom(key)}
            >
              <span>{data.icon}</span>
              <span>{data.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        <div className="three-actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Atmosphere Lighting Mode Switcher */}
          <div
            className="three-atmosphere-group"
            style={{
              display: 'flex',
              background: 'rgba(30, 41, 59, 0.7)',
              borderRadius: 6,
              padding: 2,
              border: '1px solid rgba(148, 163, 184, 0.2)',
            }}
          >
            <button
              className={`three-atmo-btn ${lightingMode === 'day' ? 'active' : ''}`}
              onClick={() => setAtmosphere('day')}
              style={{
                background: lightingMode === 'day' ? '#0284c7' : 'transparent',
                border: 'none',
                color: lightingMode === 'day' ? '#fff' : '#94a3b8',
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
              }}
              title="Pencahayaan Siang Hari Alami"
            >
              ☀️ Siang
            </button>
            <button
              className={`three-atmo-btn ${lightingMode === 'dusk' ? 'active' : ''}`}
              onClick={() => setAtmosphere('dusk')}
              style={{
                background: lightingMode === 'dusk' ? '#ea580c' : 'transparent',
                border: 'none',
                color: lightingMode === 'dusk' ? '#fff' : '#94a3b8',
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
              }}
              title="Pencahayaan Golden Hour Sunset"
            >
              🌅 Senja
            </button>
            <button
              className={`three-atmo-btn ${lightingMode === 'night' ? 'active' : ''}`}
              onClick={() => setAtmosphere('night')}
              style={{
                background: lightingMode === 'night' ? '#7c3aed' : 'transparent',
                border: 'none',
                color: lightingMode === 'night' ? '#fff' : '#94a3b8',
                fontSize: 10,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
              }}
              title="Pencahayaan Cyberpunk Malam Hari"
            >
              🌙 Malam
            </button>
          </div>

          {/* Quick Activity Locomotion Triggers */}
          <div className="three-activity-triggers">
            <button
              className={`three-trigger-btn ${activeActivity === 'swim' ? 'active' : ''}`}
              onClick={() => handleTriggerActivity('swim')}
              title="Kirim Rifqi berenang di kolam renang"
            >
              <span>🏊</span>
              <span>Berenang</span>
            </button>
            <button
              className={`three-trigger-btn ${activeActivity === 'meeting' ? 'active' : ''}`}
              onClick={() => handleTriggerActivity('meeting')}
              title="Kumpulkan tim di ruang rapat kaca"
            >
              <span>📊</span>
              <span>Rapat</span>
            </button>
            <button
              className={`three-trigger-btn ${activeActivity === 'work' ? 'active' : ''}`}
              onClick={() => handleTriggerActivity('work')}
              title="Kembalikan semua agen ke meja coding"
            >
              <span>💻</span>
              <span>Kerja</span>
            </button>
            <button
              className={`three-trigger-btn ${activeActivity === 'sholat' ? 'active' : ''}`}
              onClick={() => handleTriggerActivity('sholat')}
              title="Sholat berjamaah di musholla"
            >
              <span>🕌</span>
              <span>Sholat</span>
            </button>
          </div>

          <button
            className="three-action-btn"
            onClick={() => setShowDialogs(!showDialogs)}
            title="Sembunyikan/Tampilkan balon obrolan"
          >
            {showDialogs ? '💬 Sembunyikan Dialog' : '💬 Tampilkan Dialog'}
          </button>
          {onBackToClassic && (
            <button className="three-action-btn switch-btn" onClick={onBackToClassic}>
              🔄 Mode 2.5D Classic
            </button>
          )}
        </div>
      </header>

      {/* Interactive 3D Projected Speech Bubbles & Badges */}
      <div className="three-speech-overlay">
        {agents.map(agent => {
          const isRoomFocused = selectedRoom !== 'all'
          const activeRoomDef = ROOM_TARGETS[selectedRoom]
          const isAgentInActiveRoom = activeRoomDef?.agentRoles?.includes(agent.id)
          const isHovered = hoveredAgentId === agent.id

          // In Overview mode: only show 2-3 prominent bubbles (Jarvis, Dimas in Musholla)
          // In Focused Room mode: only show bubbles for agents in that room
          // On hover: always show!
          const shouldShowBubble =
            showDialogs &&
            (isHovered ||
              (isRoomFocused
                ? isAgentInActiveRoom
                : agent.id === 'vps-boss' || agent.id === 'dimas-musholla'))

          return (
            <div
              key={agent.id}
              ref={el => {
                if (el) calloutElementsRef.current.set(agent.id, el)
                else calloutElementsRef.current.delete(agent.id)
              }}
              className={`three-agent-callout ${isHovered ? 'hovered' : ''}`}
              style={{
                left: `${agent.screenPos?.x ?? 0}px`,
                top: `${agent.screenPos?.y ?? 0}px`,
                zIndex: isHovered ? 100 : shouldShowBubble ? 40 : 20,
              }}
              onMouseEnter={() => setHoveredAgentId(agent.id)}
              onMouseLeave={() => setHoveredAgentId(null)}
            >
              {/* Speech Callout Bubble */}
              {shouldShowBubble && agent.speechText && (
                <div className="three-speech-bubble" style={{ borderLeftColor: agent.color }}>
                  <div className="speech-text">{agent.speechText}</div>
                </div>
              )}

              {/* Agent Name & Role Badge (Pill) */}
              <div
                className="three-agent-badge"
                style={{
                  borderColor: agent.color,
                  opacity: isRoomFocused && !isAgentInActiveRoom && !isHovered ? 0.35 : 1.0,
                  transform: isHovered ? 'scale(1.12)' : 'scale(1.0)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
                onClick={() => setInspectedAgent(agent)}
                title="Klik untuk membuka Agent Inspector"
              >
                <span className="badge-emoji">{agent.emoji}</span>
                <span className="badge-name">{agent.name}</span>
                <span className="badge-role">{agent.role}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Agent Inspector Slide-Out Drawer */}
      {inspectedAgent && (
        <aside className="three-inspector-drawer">
          <div className="inspector-header">
            <div className="inspector-profile">
              <div className="inspector-avatar-box" style={{ borderColor: inspectedAgent.color }}>
                {inspectedAgent.emoji}
              </div>
              <div className="inspector-name-title">
                <span className="inspector-title-name">{inspectedAgent.name}</span>
                <span className="inspector-title-role">{inspectedAgent.role}</span>
              </div>
            </div>
            <button className="inspector-close-btn" onClick={() => setInspectedAgent(null)}>
              ✕
            </button>
          </div>

          <div className="inspector-field">
            <div className="inspector-label">Foundation Model</div>
            <div className="inspector-value" style={{ fontFamily: 'JetBrains Mono', color: '#38bdf8' }}>
              {inspectedAgent.id === 'senku' ? 'ag/claude-opus-4-6-thinking' : 'ag/gemini-3.8-flash-high'}
            </div>
          </div>

          <div className="inspector-field">
            <div className="inspector-label">Status & State</div>
            <div className="inspector-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: inspectedAgent.color, display: 'inline-block' }} />
              <span style={{ textTransform: 'capitalize' }}>{inspectedAgent.state}</span>
            </div>
          </div>

          <div className="inspector-field">
            <div className="inspector-label">Current Objective / Task</div>
            <div className="inspector-value">{inspectedAgent.task || 'Autonomous VPS Ops'}</div>
          </div>

          {inspectedAgent.speechText && (
            <div className="inspector-field">
              <div className="inspector-label">Live Telemetry Decree</div>
              <div className="inspector-value" style={{ fontStyle: 'italic', borderLeft: `3px solid ${inspectedAgent.color}` }}>
                "{inspectedAgent.speechText}"
              </div>
            </div>
          )}

          <button
            className="inspector-focus-btn"
            onClick={() => {
              if (cameraRef.current) {
                const mesh = agentMeshesRef.current.get(inspectedAgent.id)
                const targetX = mesh ? mesh.position.x : inspectedAgent.position.x
                const targetY = mesh ? mesh.position.y : inspectedAgent.position.y
                const targetZ = mesh ? mesh.position.z : inspectedAgent.position.z

                gsap.killTweensOf(targetLookAtRef.current)
                gsap.killTweensOf(cameraRef.current)
                gsap.to(targetLookAtRef.current, {
                  x: targetX,
                  y: targetY + 0.35,
                  z: targetZ,
                  duration: 1.25,
                  ease: 'power2.inOut',
                })
                gsap.to(cameraRef.current, {
                  zoom: 3.1,
                  duration: 1.25,
                  ease: 'power2.inOut',
                  onUpdate: () => {
                    if (cameraRef.current) {
                      cameraRef.current.updateProjectionMatrix()
                      setZoomLevel(cameraRef.current.zoom)
                    }
                  },
                })
              }
            }}
          >
            🎯 Fokus Kamera ke {inspectedAgent.name}
          </button>
        </aside>
      )}

      {/* Bottom Floating Control Bar */}
      <footer className="three-hud-footer">
        <div className="footer-hint">
          🖱️ Click & Drag untuk geser lantai • Scroll untuk zoom • Klik tombol ruangan untuk terbang
        </div>
        <div className="footer-controls">
          <button
            className="hud-ctrl-btn"
            onClick={() => {
              if (cameraRef.current) {
                const targetZ = Math.min(3.5, (cameraRef.current.zoom || 1.0) * 1.25)
                gsap.killTweensOf(cameraRef.current)
                gsap.to(cameraRef.current, {
                  zoom: targetZ,
                  duration: 0.35,
                  ease: 'power1.out',
                  onUpdate: () => {
                    if (cameraRef.current) {
                      cameraRef.current.updateProjectionMatrix()
                      setZoomLevel(cameraRef.current.zoom)
                    }
                  },
                })
              }
            }}
          >
            ＋
          </button>
          <button
            className="hud-ctrl-btn"
            onClick={() => {
              if (cameraRef.current) {
                const targetZ = Math.max(0.6, (cameraRef.current.zoom || 1.0) * 0.8)
                gsap.killTweensOf(cameraRef.current)
                gsap.to(cameraRef.current, {
                  zoom: targetZ,
                  duration: 0.35,
                  ease: 'power1.out',
                  onUpdate: () => {
                    if (cameraRef.current) {
                      cameraRef.current.updateProjectionMatrix()
                      setZoomLevel(cameraRef.current.zoom)
                    }
                  },
                })
              }
            }}
          >
            －
          </button>
          <button className="hud-ctrl-btn" onClick={() => focusRoom('all')}>
            ⛶ Overview
          </button>
        </div>
      </footer>
    </div>
  )
}

export default ThreeOfficeCanvas
