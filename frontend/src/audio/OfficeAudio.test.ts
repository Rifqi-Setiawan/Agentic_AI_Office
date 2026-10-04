import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Howl, HowlOptions } from 'howler';
import { statSync, readdirSync } from 'node:fs';
import { OfficeAudio, AUDIO_ASSETS } from './OfficeAudio';
import { mockSnapshotFixture } from '../mocks/fixtures';
import { officeStore } from '../store/officeStore';
import type { OfficeEvent } from '../types/office';

const event = (seq: number, kind: OfficeEvent['kind'], agent = 'forge'): OfficeEvent => ({ seq, kind, agent, ts: 1, board: 'office', message: 'Uji suara' });
function harness() {
  const sounds: { options: HowlOptions; play: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; unload: ReturnType<typeof vi.fn>; volume: ReturnType<typeof vi.fn> }[] = [];
  const loader = vi.fn(async () => (options: HowlOptions) => {
    const sound = { options, play: vi.fn(), stop: vi.fn(), unload: vi.fn(), volume: vi.fn(), load: vi.fn(), playing: () => false };
    sounds.push(sound);
    return sound as unknown as Howl;
  });
  return { audio: new OfficeAudio(loader), loader, sounds };
}
beforeEach(() => officeStore.getState().reset());
describe('Office audio acceptance', () => {
  it('all shipped audio fits the 1.5 MB budget', () => {
    const files = readdirSync('public/audio');
    expect(files.sort()).toEqual(Object.values(AUDIO_ASSETS).map((path) => path.split('/').pop()!).sort());
    const bytes = files.reduce((sum, name) => sum + statSync(`public/audio/${name}`).size, 0);
    console.log(`Audio assets: ${files.length}; actual total bytes: ${bytes}; limit: 1500000`);
    expect(bytes).toBeLessThanOrEqual(1_500_000);
  });
  it('is silent before enable; lazily loads current atmosphere and switches loops', async () => {
    const { audio, loader, sounds } = harness();
    officeStore.getState().setAtmosphereOverride('night');
    officeStore.getState().appendOfficeEvent(event(1, 'task_done'));
    expect(loader).not.toHaveBeenCalled();
    expect(audio.getStatus()).toBe('off');
    await audio.enable();
    expect(sounds).toHaveLength(1);
    expect(sounds[0].options).toMatchObject({ src: ['/audio/night.wav'], loop: true, preload: false });
    sounds[0].options.onload?.(0);
    expect(audio.getStatus()).toBe('on');
    officeStore.getState().setAtmosphereOverride('dusk');
    expect(sounds[0].stop).toHaveBeenCalledOnce();
    expect(sounds[1].options.src).toEqual(['/audio/dusk.wav']);
    audio.setVolume(.6);
    expect(sounds[1].volume).toHaveBeenCalledWith(.6);
    audio.disable();
    sounds.forEach((s) => expect(s.unload).toHaveBeenCalledOnce());
    officeStore.getState().appendOfficeEvent(event(2, 'task_failed'));
    expect(sounds).toHaveLength(2);
  });
  it('plays new completion, failure, Sentinel stamp and new prayer only once', async () => {
    const { audio, sounds } = harness();
    officeStore.getState().appendOfficeEvent(event(10, 'task_done'));
    await audio.enable();
    officeStore.getState().appendOfficeEvent(event(10, 'task_done'));
    expect(sounds).toHaveLength(1);
    for (const [seq, kind, agent] of [[11, 'task_done', 'forge'], [12, 'task_failed', 'forge'], [13, 'task_done', 'sentinel']] as const) officeStore.getState().appendOfficeEvent(event(seq, kind, agent));
    const collective = { id: 'prayer1', kind: 'sholat' as const, title: 'Sholat', started_at: 1, expires_at: 90, active: true, participants: [] };
    officeStore.getState().updateCollective(collective, 14);
    officeStore.getState().updateCollective({ ...collective }, 15);
    expect(sounds.map((s) => s.options.src)).toEqual([['/audio/day.wav'], ['/audio/done.wav'], ['/audio/failed.wav'], ['/audio/stamp.wav'], ['/audio/adzan.mp3']]);
    expect(sounds[4].play).toHaveBeenCalledOnce();
    officeStore.getState().appendOfficeEvent({ ...event(16, 'task_blocked'), actor: 'sentinel' });
    expect(sounds[3].play).toHaveBeenCalledTimes(2);
    audio.disable();
  });
  it('does not replay snapshot history or already active prayer', async () => {
    const { audio, sounds } = harness();
    const prayer = { id: 'old-prayer', kind: 'sholat' as const, title: 'Sholat', started_at: 1, expires_at: 90, active: true, participants: [] };
    officeStore.getState().applySnapshot({ ...mockSnapshotFixture, seq: 100, time_of_day: 'day', active_collective: prayer, recent_events: [event(100, 'task_done')] });
    await audio.enable();
    officeStore.getState().applySnapshot({ ...mockSnapshotFixture, seq: 200, time_of_day: 'day', active_collective: prayer, recent_events: [event(200, 'task_failed')] });
    officeStore.getState().appendOfficeEvent(event(199, 'task_done'));
    expect(sounds).toHaveLength(1);
    officeStore.getState().appendOfficeEvent(event(201, 'task_done'));
    expect(sounds).toHaveLength(2);
    for (const mode of ['dawn', 'dusk', 'night'] as const) officeStore.getState().setAtmosphereOverride(mode);
    expect(sounds.filter((s) => s.options.loop)).toHaveLength(4);
    audio.disable();
  });
  it('reports asset/import failure and supports retry without retained resources', async () => {
    const { audio, sounds } = harness();
    await audio.enable();
    sounds[0].options.onloaderror?.(0, 'offline');
    expect(audio.getStatus()).toBe('error');
    expect(sounds[0].unload).toHaveBeenCalled();
    await audio.enable();
    sounds[1].options.onload?.(0);
    expect(audio.getStatus()).toBe('on');
    audio.disable();
    const broken = new OfficeAudio(async () => { throw new Error('offline'); });
    await broken.enable();
    expect(broken.getStatus()).toBe('error');
  });
  it('ignores stale load callbacks after failure and retry; failure during load leaves no subscription', async () => {
    let options!: HowlOptions;
    const unload = vi.fn();
    const play = vi.fn();
    const audio = new OfficeAudio(async () => value => {
      options = value;
      return { load: () => value.onloaderror?.(0, 'offline'), unload, play, playing: () => false } as unknown as Howl;
    });
    await audio.enable();
    expect(audio.getStatus()).toBe('error');
    expect(unload).toHaveBeenCalledOnce();
    expect(play).not.toHaveBeenCalled();
    options.onload?.(0);
    expect(audio.getStatus()).toBe('error');
    officeStore.getState().setAtmosphereOverride('night');
    expect(unload).toHaveBeenCalledOnce();
    audio.disable();
  });
  it('cancel during import never starts a sound', async () => {
    const factory = vi.fn();
    let resolve!: (value: typeof factory) => void;
    const audio = new OfficeAudio(() => new Promise((r) => { resolve = r; }));
    const pending = audio.enable();
    audio.disable();
    resolve(factory);
    await pending;
    expect(factory).not.toHaveBeenCalled();
    expect(audio.getStatus()).toBe('off');
  });
});
