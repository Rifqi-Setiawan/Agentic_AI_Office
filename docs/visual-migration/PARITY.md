# Feature parity inventory

Source of truth is the checked-out implementation, not historical README claims.

| Capability | Existing source | Migration obligation |
|---|---|---|
| Logical grid, collision, slots, doors and zones | GridMap, floor1.tmj | Reuse map parsing; compare all semantic values |
| A*, approach rules, no corner cutting, reservations, local avoidance | navigation/ | Keep existing decisions and timings |
| Character FSM, movement, facing and work gestures | Character.ts | Pure model; compare recorded legacy motion trace |
| Persona ambient, task priority, event reactions, collective prayer/meeting/break/class/events | choreographer/ | Same controller, renderer-independent character registry |
| Rifqi Founder movement, approach-agent and public permissions | Choreographer.ts | Inverse camera hit testing, same controller methods |
| Real task badge, stale, blocked, failed, parcel, inspection, crown, sweat | Character.ts | Present store truth; effects never author work status |
| Bubble priority, cooldown, conversation and placeholders | bubble/ | Reuse DOM bubble pool, preserve redaction |
| CPU 80%/60 seconds, RAM 85%, disk 85% | VitalsEnvironmentManager.ts | Reuse threshold transitions and pacing; port effects |
| Konami, Oracle confetti, Steward repair, Friday, 03:00 lounge, espresso | easterEgg/ | Preserve triggers/timers and task precedence |
| Day/night and lighting | AtmosphereManager.ts | Port presentation on shared world |
| Audio, adzan, mute/autoplay | audio/ and HudRoot | Retain existing audio owner and HUD |
| Inspector, feed, sidebar, Founder panel/login, honest mode, freshness | hud/, officeStore, sseClient | Keep real store and one event stream |
| Renderer lifecycle and rollback | WorldApp.ts, main.tsx | Exactly one world; lazy legacy import; dispose all callbacks |

Art gate: all 17 zones and all 17 identities are required. All baseline animation actions are required; two mirrored directions are an explicit art gap. A working DOM preview with legacy art is technical evidence only.

## Per-zone checkpoint

Logical content and anchors are extracted from floor1.tmj. All rooms exist in the DOM scene; only Z08 focus was inspected in the browser. No zone has approved final Blender art.

| Zone | Name | Resident | Slots | Current art / browser QA |
|---|---|---|---:|---|
| Z01 | Ruang CEO | Jarvis | 6 | Baseline art; room detail QA pending |
| Z02 | Boardroom | Rapat | 13 | Baseline art; room detail QA pending |
| Z03 | Ruang Arsitektur | Daedalus | 3 | Baseline art; room detail QA pending |
| Z04 | Ruang Kelas | Merlin | 7 | Baseline art; room detail QA pending |
| Z05 | Perpustakaan | Scribe | 6 | Baseline art; room detail QA pending |
| Z06 | Lab Riset | Oracle | 4 | Baseline art; room detail QA pending |
| Z07 | Studio Desain | Muse | 2 | Baseline art; room detail QA pending |
| Z08 | Dev Pods | Prism, Forge, Nova | 6 | Baseline art; focus observed |
| Z09 | Graphics Lab | Steward | 2 | Baseline art; room detail QA pending |
| Z10 | QA Station | Sentinel | 2 | Baseline art; room detail QA pending |
| Z11 | Release Dock | Relay | 3 | Baseline art; room detail QA pending |
| Z12 | Data Center & SOC | Vector, Bastion | 6 | Baseline art; room detail QA pending |
| Z13 | Lobi | Warden | 3 | Baseline art; room detail QA pending |
| Z14 | Kafetaria & Lounge | Semua | 16 | Baseline art; room detail QA pending |
| Z15 | Arcade | Semua | 8 | Baseline art; room detail QA pending |
| Z16 | Musholla | Semua | 21 | Baseline art; room detail QA pending |
| Z17 | Kolam luar | Semua | 25 | Baseline art; room detail QA pending |
