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
import { getSavedHonestMode, saveHonestMode } from './honestModeStorage';

export interface ToastNotification {
  id: string;
  kind: 'task_started' | 'task_done' | 'info';
  agent?: string;
  title: string;
  message: string;
  ts: number;
  durationMs?: number;
}

export interface FlyingIconItem {
  id: string;
  agentId: string;
  kind: 'task_started' | 'task_done';
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  color: string;
  symbol: string;
}

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
  isAgentSidebarOpen: boolean;
  isFounderPanelOpen: boolean;
  isLoginModalOpen: boolean;
  isFounderAuthenticated: boolean;
  atmosphereOverride: TimeOfDay | 'auto';

  // Mode Jujur (F22: matikan ambient simulation, simpan di localStorage)
  isHonestMode: boolean;

  // Notifikasi Visual & Flying Icon (F21)
  toasts: ToastNotification[];
  flyingIcons: FlyingIconItem[];

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
  setAgentSidebarOpen: (isOpen: boolean) => void;
  setFounderPanelOpen: (isOpen: boolean) => void;
  setLoginModalOpen: (isOpen: boolean) => void;
  setFounderAuthenticated: (isAuth: boolean) => void;
  setAtmosphereOverride: (mode: TimeOfDay | 'auto') => void;
  setProjection: (projection: ProjectionMode) => void;
  setHonestMode: (enabled: boolean) => void;
  addToast: (toast: Omit<ToastNotification, 'id' | 'ts'> & { id?: string; ts?: number }) => string;
  dismissToast: (id: string) => void;
  addFlyingIcon: (icon: Omit<FlyingIconItem, 'id'> & { id?: string }) => string;
  removeFlyingIcon: (id: string) => void;
  reset: () => void;
}

const initialAgentsRecord: Record<string, AgentState> = {};

const AGENT_COLORS: Record<string, string> = {
  jarvis: '#1F3A68',
  daedalus: '#2F6FB3',
  oracle: '#B5652B',
  merlin: '#7A4A2E',
  muse: '#8A4FBF',
  prism: '#2BB3C0',
  forge: '#D9622B',
  vector: '#F2C230',
  sentinel: '#D23C3C',
  relay: '#6D5BD0',
  bastion: '#3FA66B',
  warden: '#6B7785',
  steward: '#9CC23A',
  scribe: '#8E8E3A',
  nova: '#E0567A',
  rifqi: '#F5F0E1',
};

const createInitialState = () => ({
  connectionStatus: 'disconnected' as ConnectionStatus,
  lastSeq: 0,
  lastUpdateTs: 0,
  projection: 'public' as ProjectionMode,
  timeOfDay: 'day' as TimeOfDay,
  atmosphereOverride: 'auto' as TimeOfDay | 'auto',
  errorMessage: null as string | null,
  snapshot: null as WorldSnapshot | null,
  agents: initialAgentsRecord,
  agentList: [] as AgentState[],
  recentEvents: [] as OfficeEvent[],
  vitals: null as HostVitals | null,
  activeCollective: null as CollectiveEventState | null,
  selectedAgentId: null as string | null,
  hoveredAgentId: null as string | null,
  isAgentSidebarOpen: false,
  isFounderPanelOpen: false,
  isLoginModalOpen: false,
  isFounderAuthenticated: false,
  isHonestMode: getSavedHonestMode(),
  toasts: [] as ToastNotification[],
  flyingIcons: [] as FlyingIconItem[],
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

    const state = get();
    const effectiveTimeOfDay =
      state.atmosphereOverride !== 'auto'
        ? state.atmosphereOverride
        : snapshot.time_of_day;

    const effectiveProjection = state.isFounderAuthenticated
      ? snapshot.projection || 'founder'
      : snapshot.projection;

    set({
      snapshot,
      lastSeq: Math.max(state.lastSeq, snapshot.seq),
      lastUpdateTs: snapshot.generated_at,
      projection: effectiveProjection,
      timeOfDay: effectiveTimeOfDay,
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

    // Fitur F21: Toast kecil + Ikon terbang saat task mulai/selesai
    if (event.kind === 'task_started' || event.kind === 'task_done') {
      const taskAssignee = (event.task as { assignee?: string } | null | undefined)?.assignee;
      const agentId = (event.agent || taskAssignee || '').toLowerCase();
      const isStart = event.kind === 'task_started';
      const symbol = isStart ? '⚡' : '✅';
      const title = isStart ? 'Task Dimulai' : 'Task Selesai';
      const color = (agentId && AGENT_COLORS[agentId]) || (isStart ? '#F2C230' : '#34D399');

      get().addToast({
        kind: event.kind,
        agent: agentId || undefined,
        title,
        message: event.message,
      });

      // Hitung koordinat awal (posisi agen di layar) dan target (ActivityFeed di pojok kanan bawah)
      let startX = 600;
      let startY = 300;
      let targetX = 1100;
      let targetY = 650;

      if (typeof window !== 'undefined') {
        startX = window.innerWidth / 2;
        startY = window.innerHeight / 2;
        targetX = window.innerWidth - 180;
        targetY = window.innerHeight - 80;

        const w = (window as unknown as {
          __WORLD_APP__?: {
            getCharacterScreenPosition?: (id: string) => { x: number; y: number } | null;
          };
        }).__WORLD_APP__;

        if (w && agentId && typeof w.getCharacterScreenPosition === 'function') {
          const pos = w.getCharacterScreenPosition(agentId);
          if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
            startX = pos.x;
            startY = pos.y;
          }
        }

        const feedEl = document.getElementById('activity-feed');
        if (feedEl && typeof feedEl.getBoundingClientRect === 'function') {
          const rect = feedEl.getBoundingClientRect();
          targetX = rect.left + rect.width / 2;
          targetY = rect.top + 20;
        }
      }

      get().addFlyingIcon({
        agentId: agentId || 'system',
        kind: event.kind,
        startX,
        startY,
        targetX,
        targetY,
        color,
        symbol,
      });
    }
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

  setAgentSidebarOpen: (isAgentSidebarOpen) => {
    set({ isAgentSidebarOpen });
  },

  setFounderPanelOpen: (isFounderPanelOpen) => {
    set({ isFounderPanelOpen });
  },

  setLoginModalOpen: (isLoginModalOpen) => {
    set({ isLoginModalOpen });
  },

  setFounderAuthenticated: (isFounderAuthenticated) => {
    set({
      isFounderAuthenticated,
      projection: isFounderAuthenticated ? 'founder' : 'public',
    });
  },

  setAtmosphereOverride: (atmosphereOverride) => {
    const state = get();
    const effectiveTimeOfDay =
      atmosphereOverride === 'auto'
        ? state.snapshot?.time_of_day || 'day'
        : atmosphereOverride;
    set({
      atmosphereOverride,
      timeOfDay: effectiveTimeOfDay,
    });
  },

  setProjection: (projection) => {
    set({ projection });
  },

  setHonestMode: (isHonestMode) => {
    saveHonestMode(isHonestMode);
    set({ isHonestMode });
  },

  addToast: (toast) => {
    const id = toast.id || `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastNotification = {
      ...toast,
      id,
      ts: toast.ts ?? Math.floor(Date.now() / 1000),
      durationMs: toast.durationMs ?? 4000,
    };
    // Maksimum 5 toast aktif bersamaan
    const toasts = [newToast, ...get().toasts].slice(0, 5);
    set({ toasts });
    return id;
  },

  dismissToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },

  addFlyingIcon: (icon) => {
    const id = icon.id || `fly_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newIcon: FlyingIconItem = {
      ...icon,
      id,
    };
    // Maksimum 10 flying icon bersamaan
    const flyingIcons = [...get().flyingIcons, newIcon].slice(-10);
    set({ flyingIcons });
    return id;
  },

  removeFlyingIcon: (id) => {
    set({ flyingIcons: get().flyingIcons.filter((i) => i.id !== id) });
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
