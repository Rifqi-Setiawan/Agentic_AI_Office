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

  const [showDialogs, setShowDialogs] = useState<boolean>(true)
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null)
  const [lightingMode, setLightingMode] = useState<'day' | 'dusk' | 'night'>('day')

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
    'boss': { lookAt: [9.0, 1.4, -6.5], zoom: 2.1, label: 'Ruang Bos (Executive Suite)', icon: '👑', agentRoles: ['vps-boss', 'vps-assistant'] },
    'meeting': { lookAt: [0.0, 1.4, -6.5], zoom: 2.0, label: 'Ruang Rapat Kaca (Boardroom)', icon: '🤝', agentRoles: ['tech-mentor', 'chief-architect'] },
    'swe': { lookAt: [-2.0, 0.5, 3.0], zoom: 1.9, label: 'Software Engineering Pods', icon: '💻', agentRoles: ['swe-backend', 'swe-frontend', 'swe-qa', 'ui-designer'] },
    'senku': { lookAt: [-10.0, 0.5, 0.5], zoom: 2.0, label: 'Laboratorium & Perpustakaan Senku', icon: '🧪', agentRoles: ['senku', 'paperwright'] },
    'data': { lookAt: [5.0, 0.5, 7.5], zoom: 2.0, label: 'Data Center & Lakehouse Server', icon: '🗄️', agentRoles: ['data-engineer', 'devops-engineer'] },
    'musholla': { lookAt: [-11.0, -0.6, 7.0], zoom: 2.2, label: 'Musholla Khusus (Lower Level)', icon: '🕌', agentRoles: ['dimas-musholla'] },
    'pool': { lookAt: [11.0, 0.0, 6.0], zoom: 1.85, label: 'Rooftop Terrace & Kolam Renang', icon: '🏊', agentRoles: ['rifqi'] },
    'arcade': { lookAt: [-8.0, 1.4, -6.5], zoom: 2.0, label: 'Arcade & Game Lounge', icon: '🕹️' },
  }

  const focusRoom = useCallback((roomId: string) => {
    const target = ROOM_TARGETS[roomId]
    if (!target || !cameraRef.current) return
    setSelectedRoom(roomId)

    // Kill any in-flight tweens
    gsap.killTweensOf(currentLookAtRef.current)
    gsap.killTweensOf(cameraRef.current)

    // Smooth cinematic pan flight directly on camera target
    gsap.to(currentLookAtRef.current, {
      x: target.lookAt[0],
      y: target.lookAt[1],
      z: target.lookAt[2],
      duration: 1.2,
      ease: 'power2.inOut',
      onUpdate: () => {
        if (cameraRef.current) {
          cameraRef.current.position.x = currentLookAtRef.current.x + 28
          cameraRef.current.position.y = currentLookAtRef.current.y + 28
          cameraRef.current.position.z = currentLookAtRef.current.z + 28
          cameraRef.current.lookAt(currentLookAtRef.current)
        }
      },
    })

    // Smooth synchronized zoom transition
    const cam = cameraRef.current
    gsap.to(cam, {
      zoom: target.zoom,
      duration: 1.2,
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

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight

    // 1. Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0e1117)
    sceneRef.current = scene

    // 2. Orthographic Camera (True Isometric)
    const aspect = width / height
    const frustumSize = 38
    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      200
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
        const agent = INITIAL_3D_AGENTS.find(a => a.id === id)
        if (agent) {
          if (agent.state === 'swimming') {
            mesh.position.y = -0.1 + Math.sin(t * 2.5) * 0.04
          } else {
            mesh.position.y = agent.position.y + Math.sin(t * 1.5 + (id.charCodeAt(0) % 5)) * 0.02
          }
        }
      })

      renderer.render(scene, camera)

      // Project 3D positions to 2D screen coordinates for DOM callouts
      const updatedAgents = INITIAL_3D_AGENTS.map(agent => {
        const mesh = agentMeshesRef.current.get(agent.id)
        if (!mesh) return agent

        const pos = new THREE.Vector3()
        mesh.getWorldPosition(pos)
        pos.y += 1.4 // Head height
        pos.project(camera)

        const x = (pos.x * 0.5 + 0.5) * width
        const y = (-(pos.y * 0.5) + 0.5) * height
        const visible = pos.z > -1 && pos.z < 1

        return {
          ...agent,
          screenPos: { x, y, visible },
        }
      })
      setAgents(updatedAgents)
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
          if (!agent.screenPos || !agent.screenPos.visible) return null

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
              className={`three-agent-callout ${isHovered ? 'hovered' : ''}`}
              style={{
                left: `${agent.screenPos.x}px`,
                top: `${agent.screenPos.y}px`,
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
              >
                <span className="badge-emoji">{agent.emoji}</span>
                <span className="badge-name">{agent.name}</span>
                <span className="badge-role">{agent.role}</span>
              </div>
            </div>
          )
        })}
      </div>

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
