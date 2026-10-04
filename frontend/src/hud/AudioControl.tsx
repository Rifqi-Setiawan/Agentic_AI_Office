import { useEffect, useState, useSyncExternalStore } from 'react';
import { officeAudio } from '../audio/OfficeAudio';

export function AudioControl() {
  const status = useSyncExternalStore(officeAudio.subscribe, officeAudio.getStatus, officeAudio.getStatus);
  const [volume, setVolume] = useState(35);
  const enabled = status === 'on' || status === 'loading';
  useEffect(() => () => officeAudio.disable(), []);
  return <div className="flex items-center gap-2">
    <button type="button" aria-pressed={enabled} aria-label={enabled ? 'Matikan suara' : 'Nyalakan suara'}
      className="px-2 py-1 rounded border border-[#687594] text-[#f5f0e1] focus-visible:ring-2 focus-visible:ring-[#2bb3c0]"
      onClick={() => enabled ? officeAudio.disable() : void officeAudio.enable()}>
      <span aria-hidden="true">{enabled ? '🔊' : '🔇'}</span> {status === 'loading' ? 'Memuat suara…' : enabled ? 'Suara aktif' : 'Suara mati'}
    </button>
    {enabled && <label className="flex items-center gap-1 text-[#f5f0e1]">Volume
      <input aria-label="Volume suara" type="range" min="0" max="100" value={volume} className="w-16 accent-[#2bb3c0]"
        onChange={(event) => { const value = Number(event.target.value); setVolume(value); officeAudio.setVolume(value / 100); }} />
      <output className="tabular-nums w-8">{volume}%</output>
    </label>}
    {status === 'error' && <span role="status" className="text-amber-300">Suara gagal dimuat. Coba nyalakan lagi.</span>}
  </div>;
}
