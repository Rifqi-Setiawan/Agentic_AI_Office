import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type {
  AgentState,
  CollectiveEventState,
  ConnectionStatus,
  HostVitals,
  OfficeEvent,
  ProjectionMode,
  TimeOfDay,
  WorldSnapshot,
} from '../types/office';

export interface OfficeState {
  // Connection and metadata
  connectionStatus: ConnectionStatus;
  lastSeq: number;
  lastUpdateTs: number;
  projection: ProjectionMode;
  timeOfDay: TimeOfDay;
  errorMessage: string | null;

  // Domain state
  snapshot: WorldSnapshot | null;
  agents: Record<string, AgentState>;
  agentList: AgentState[];
  recentEvents: OfficeEvent[];
  vitals: HostVitals | null;
  activeCollective: CollectiveEventState | null;

  // Interaktivitas HUD dan Agen
  selectedAgentId: string | null;
  hoveredAgentId: string | null;

  // Actions
  setConnectionStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  applySnapshot: (snapshot: WorldSnapshot) => void;
  updateAgentDelta: (agent: AgentState, seq?: number) => void;
  appendOfficeEvent: (event: OfficeEvent, seq?: number) => void;
  updateVitals: (vitals: HostVitals) => void;
  updateCollective: (collective: CollectiveEventState | null, seq?: number) => void;
  selectAgent: (agentId: string | null) => void;
  hoverAgent: (agentId: string | null) => void;
  reset: () => void;
}

const initialAgentsRecord: Record<string, AgentState> = {};

const createInitialState = () => ({
  connectionStatus: 'disconnected' as ConnectionStatus,
  lastSeq: 0,
  lastUpdateTs: 0,
  projection: 'public' as ProjectionMode,
  timeOfDay: 'day' as TimeOfDay,
  errorMessage: null as string | null,
  snapshot: null as WorldSnapshot | null,
  agents: initialAgentsRecord,
  agentList: [] as AgentState[],
  recentEvents: [] as OfficeEvent[],
  vitals: null as HostVitals | null,
  activeCollective: null as CollectiveEventState | null,
  selectedAgentId: null as string | null,
  hoveredAgentId: null as string | null,
});

/**
 * Vanilla Zustand store.
 * Render loop di PixiJS membaca state langsung via `officeStore.getState()`
 * dan tidak pernah memicu re-render React / memanggil setState.
 */
export const officeStore = createStore<OfficeState>((set, get) => ({
  ...createInitialState(),

  setConnectionStatus: (connectionStatus) => {
    set({ connectionStatus });
  },

  setError: (errorMessage) => {
    set({ errorMessage });
  },

  applySnapshot: (snapshot) => {
    const agentsMap: Record<string, AgentState> = {};
    for (const agent of snapshot.agents) {
      agentsMap[agent.id] = agent;
    }

    set({
      snapshot,
      lastSeq: Math.max(get().lastSeq, snapshot.seq),
      lastUpdateTs: snapshot.generated_at,
      projection: snapshot.projection,
      timeOfDay: snapshot.time_of_day,
      agents: agentsMap,
      agentList: snapshot.agents,
      recentEvents: snapshot.recent_events.slice(0, 500),
      vitals: snapshot.vitals,
      activeCollective: snapshot.active_collective ?? null,
      errorMessage: null,
    });
  },

  updateAgentDelta: (agent, seq) => {
    const state = get();
    const currentList = state.agentList;
    const exists = currentList.some((a) => a.id === agent.id);
    const updatedList = exists
      ? currentList.map((a) => (a.id === agent.id ? agent : a))
      : [...currentList, agent];

    set({
      agents: {
        ...state.agents,
        [agent.id]: agent,
      },
      agentList: updatedList,
      lastSeq: seq !== undefined ? Math.max(state.lastSeq, seq) : state.lastSeq,
      lastUpdateTs: Math.floor(Date.now() / 1000),
    });
  },

  appendOfficeEvent: (event, seq) => {
    const state = get();
    // Deduplikasi berdasar seq jika sudah ada
    const alreadyExists = state.recentEvents.some((e) => e.seq === event.seq);
    let updatedEvents: OfficeEvent[];

    if (alreadyExists) {
      updatedEvents = state.recentEvents.map((e) => (e.seq === event.seq ? event : e));
    } else {
      // Simpan dengan urutan teranyar di atas (descending sequence)
      updatedEvents = [event, ...state.recentEvents].slice(0, 500);
    }

    set({
      recentEvents: updatedEvents,
      lastSeq: seq !== undefined ? Math.max(state.lastSeq, seq) : Math.max(state.lastSeq, event.seq),
      lastUpdateTs: Math.floor(Date.now() / 1000),
    });
  },

  updateVitals: (vitals) => {
    set({
      vitals,
      lastUpdateTs: Math.floor(Date.now() / 1000),
    });
  },

  updateCollective: (activeCollective, seq) => {
    set({
      activeCollective,
      lastSeq: seq !== undefined ? Math.max(get().lastSeq, seq) : get().lastSeq,
      lastUpdateTs: Math.floor(Date.now() / 1000),
    });
  },

  selectAgent: (selectedAgentId) => {
    set({ selectedAgentId });
  },

  hoverAgent: (hoveredAgentId) => {
    set({ hoveredAgentId });
  },

  reset: () => {
    set(createInitialState());
  },
}));

// Dukungan SSR / testing renderToString: pastikan useStore membaca state terkini
(officeStore as unknown as { getServerState?: () => OfficeState }).getServerState = () =>
  officeStore.getState();

/**
 * React hook yang terikat ke vanilla store.
 * Hanya digunakan di dalam tree HUD React.
 */
export function useOfficeStore<T>(selector: (state: OfficeState) => T): T {
  return useStore(officeStore, selector);
}
