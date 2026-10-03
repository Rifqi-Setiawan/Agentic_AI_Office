import type { components, operations, paths } from './api';

export type Paths = paths;
export type Operations = operations;
export type Schemas = components['schemas'];

export type AgentState = components['schemas']['AgentState'];
export type AgentId = NonNullable<AgentState['id']>;
export type AgentPresence = AgentState['presence'];
export type AgentWork = AgentState['work'];
export type AgentDirection = NonNullable<AgentState['direction']>;

export type TaskRef = components['schemas']['TaskRef'];
export type TaskStatus = TaskRef['status'];
export type TaskBlockKind = TaskRef['block_kind'];

export type OfficeEvent = components['schemas']['OfficeEvent'];
export type OfficeEventKind = OfficeEvent['kind'];

export type WorldSnapshot = components['schemas']['WorldSnapshot'];
export type TimeOfDay = WorldSnapshot['time_of_day'];
export type ProjectionMode = WorldSnapshot['projection'];

export type CollectiveEventState = components['schemas']['CollectiveEventState'];
export type CollectiveKind = CollectiveEventState['kind'];

export type HostVitals = components['schemas']['HostVitals'];
export type HostVitalsDetails = components['schemas']['HostVitalsDetails'];
export type HostStatus = HostVitals['status'];

export type SSESnapshotEvent = components['schemas']['SSESnapshotEvent'];
export type SSEAgentDeltaEvent = components['schemas']['SSEAgentDeltaEvent'];
export type SSEOfficeFeedEvent = components['schemas']['SSEOfficeFeedEvent'];
export type SSEVitalsEvent = components['schemas']['SSEVitalsEvent'];
export type SSECollectiveEvent = components['schemas']['SSECollectiveEvent'];

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'fallback_polling';
