import React, { useState, useEffect } from 'react'
import { MissionControl } from './components/CommandCenter/MissionControl'
import { Agent, CANONICAL_ROSTER, TelemetryEvent, SystemVitals, ChatMessage } from './types'

export const App: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>(() => CANONICAL_ROSTER)
  const [vitals, setVitals] = useState<SystemVitals | null>(null)
  const [telemetryEvents, setTelemetryEvents] = useState<TelemetryEvent[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: 'Jarvis', text: '👑 Mission Control initialized. All 14 sovereign agents operational.', timestamp: 'now' }
  ])

  // Hydrate vitals and historical telemetry
  useEffect(() => {
    const fetchVitals = () => {
      fetch('/api/v1/vitals')
        .then(r => r.json())
        .then(d => setVitals(d))
        .catch(() => {})
    }

    const fetchTelemetry = () => {
      fetch('/api/v1/telemetry/live')
        .then(r => r.json())
        .then(d => {
          if (d.status === 'success' && Array.isArray(d.events)) {
            setTelemetryEvents(d.events)
          }
        })
        .catch(() => {})
    }

    const fetchRoster = () => {
      fetch('/api/v1/agents/roster')
        .then(r => r.json())
        .then(d => {
          if (d.status === 'success' && Array.isArray(d.agents)) {
            setAgents(prev => {
              const liveMap = new Map(d.agents.map((a: any) => [a.id, a]))
              return prev.map(ag => {
                const live: any = liveMap.get(ag.id)
                if (!live) return ag
                return {
                  ...ag,
                  name: live.name || ag.name,
                  model: live.model || ag.model,
                  state: (live.state || 'idle').toLowerCase() as any,
                  task: live.status_desc || live.task || ag.task,
                  status_desc: live.status_desc,
                }
              })
            })
          }
        })
        .catch(() => {})
    }

    fetchVitals()
    fetchTelemetry()
    fetchRoster()

    const interval = setInterval(() => {
      fetchVitals()
      fetchTelemetry()
      fetchRoster()
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  // Live WebSocket Connection
  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimer: any = null

    const connect = () => {
      const isHttps = window.location.protocol === 'https:'
      const wsUrl = `${isHttps ? 'wss:' : 'ws:'}//${window.location.host}/ws`
      
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('[MissionControl] Connected to real-time WebSocket telemetry')
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'agent_working') {
            setAgents(prev => prev.map(a => 
              a.id === data.agentId ? { ...a, state: 'working', status_desc: data.status, task: data.status } : a
            ))
          } else if (data.type === 'agent_completed') {
            setAgents(prev => prev.map(a => 
              a.id === data.agentId ? { ...a, state: 'idle', status_desc: undefined } : a
            ))
          } else if (data.type === 'chat_message') {
            setMessages(prev => [...prev.slice(-30), {
              id: data.id,
              sender: data.sender || 'Agent',
              text: data.text,
              timestamp: data.timestamp || new Date().toLocaleTimeString(),
            }])
          }
        } catch (err) {
          console.error('[MissionControl] WS Message parse error:', err)
        }
      }

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws?.close()
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [])

  const handleSendMessage = (text: string) => {
    setMessages(prev => [...prev.slice(-30), {
      sender: 'Jarvis',
      text,
      timestamp: new Date().toLocaleTimeString(),
    }])

    fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: 'Jarvis', text }),
    }).catch(() => {})
  }

  return (
    <MissionControl
      agents={agents}
      events={telemetryEvents}
      vitals={vitals}
      messages={messages}
      onSendMessage={handleSendMessage}
      activeView="mission-control"
      onSwitchView={() => {}}
    />
  )
}

export default App
