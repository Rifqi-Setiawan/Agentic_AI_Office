import type { Howl, HowlOptions } from 'howler';
import { officeStore } from '../store/officeStore';
import type { TimeOfDay } from '../types/office';

export const AUDIO_ASSETS = {
  dawn: '/audio/dawn.wav', day: '/audio/day.wav', dusk: '/audio/dusk.wav', night: '/audio/night.wav',
  done: '/audio/done.wav', failed: '/audio/failed.wav', stamp: '/audio/stamp.wav', adzan: '/audio/adzan.mp3',
} as const;
type Sound = keyof typeof AUDIO_ASSETS;
type HowlFactory = (options: HowlOptions) => Howl;
export type AudioStatus = 'off' | 'loading' | 'on' | 'error';

/** No Howler import or asset request before an explicit user action. */
export class OfficeAudio {
  private sounds = new Map<Sound, Howl>();
  private factory?: HowlFactory;
  private generation = 0;
  private unsubscribe?: () => void;
  private ambient?: TimeOfDay;
  private volume = .35;
  private status: AudioStatus = 'off';
  private listeners = new Set<() => void>();
  constructor(private load = async (): Promise<HowlFactory> => {
    const { Howl } = await import('howler');
    return (options) => new Howl(options);
  }) {}
  getStatus = () => this.status;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(status: AudioStatus) {
    this.status = status;
    this.listeners.forEach((listener) => listener());
  }
  private sound(key: Sound) {
    let sound = this.sounds.get(key);
    if (!sound) {
      const generation = this.generation;
      sound = this.factory!({
        src: [AUDIO_ASSETS[key]], loop: ['dawn', 'day', 'dusk', 'night'].includes(key),
        preload: false, volume: this.volume,
        onloaderror: () => { if (generation === this.generation) this.fail(); },
        onplayerror: () => { if (generation === this.generation) this.fail(); },
        onload: () => { if (generation === this.generation && this.status === 'loading' && key === this.ambient) this.publish('on'); },
      });
      this.sounds.set(key, sound);
      sound.load();
    }
    return sound;
  }
  private fail() {
    this.disable();
    this.publish('error');
  }
  async enable() {
    if (this.status === 'on' || this.status === 'loading') return;
    const generation = ++this.generation;
    this.publish('loading');
    try {
      this.factory = await this.load();
      if (generation !== this.generation) return;
      let seq = officeStore.getState().lastSeq;
      this.changeAtmosphere(officeStore.getState().timeOfDay);
      if (generation !== this.generation) return;
      this.unsubscribe = officeStore.subscribe((state, previous) => {
        if (state.timeOfDay !== previous.timeOfDay) this.changeAtmosphere(state.timeOfDay);
        // Snapshots and resumed historical events must remain silent.
        if (state.snapshot !== previous.snapshot) { seq = Math.max(seq, state.lastSeq); return; }
        if (state.recentEvents !== previous.recentEvents) {
          for (const event of [...state.recentEvents].reverse()) {
            if (event.seq <= seq) continue;
            seq = event.seq;
            const sentinel = event.agent === 'sentinel' || event.actor === 'sentinel';
            if (event.kind === 'task_blocked' && sentinel) this.play('stamp');
            if (event.kind === 'task_done' || event.kind === 'task_failed') {
              this.play(sentinel ? 'stamp' : event.kind === 'task_done' ? 'done' : 'failed');
            }
          }
        }
        const collective = state.activeCollective;
        if (collective?.active && collective.kind === 'sholat' && collective.id !== previous.activeCollective?.id) this.play('adzan');
      });
    } catch { if (generation === this.generation) this.fail(); }
  }
  private changeAtmosphere(mode: TimeOfDay) {
    if (this.ambient === mode) return;
    if (this.ambient) this.sounds.get(this.ambient)?.stop();
    this.ambient = mode;
    this.play(mode);
  }
  private play(key: Sound) {
    if (this.status !== 'on' && this.status !== 'loading') return;
    const sound = this.sound(key);
    // Bound overlapping effects, and do not queue repeated sounds during loading.
    if ((this.status === 'on' || this.status === 'loading') && !sound.playing()) sound.play();
  }
  setVolume(value: number) {
    if (!Number.isFinite(value)) return;
    this.volume = Math.max(0, Math.min(1, value));
    this.sounds.forEach((sound) => sound.volume(this.volume));
  }
  disable() {
    ++this.generation;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.sounds.forEach((sound) => sound.unload());
    this.sounds.clear();
    this.ambient = undefined;
    this.publish('off');
  }
}
export const officeAudio = new OfficeAudio();
