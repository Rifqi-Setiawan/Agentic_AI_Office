import React, { useEffect, useState } from 'react';
import { useOfficeStore } from '../store/officeStore';
import type { CollectiveKind, TimeOfDay } from '../types/office';

export const FounderPanel: React.FC = () => {
  const isOpen = useOfficeStore((s) => s.isFounderPanelOpen);
  const setOpen = useOfficeStore((s) => s.setFounderPanelOpen);
  const isFounderAuthenticated = useOfficeStore((s) => s.isFounderAuthenticated);
  const setFounderAuth = useOfficeStore((s) => s.setFounderAuthenticated);
  const activeCollective = useOfficeStore((s) => s.activeCollective);
  const updateCollective = useOfficeStore((s) => s.updateCollective);
  const atmosphereOverride = useOfficeStore((s) => s.atmosphereOverride);
  const setAtmosphereOverride = useOfficeStore((s) => s.setAtmosphereOverride);
  const timeOfDay = useOfficeStore((s) => s.timeOfDay);

  const [collectiveLoading, setCollectiveLoading] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; isError: boolean } | null>(
    null,
  );

  // Keyboard shortcut: Escape untuk menutup panel
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setOpen]);

  if (!isOpen || !isFounderAuthenticated) {
    return null;
  }

  const handleLogout = async () => {
    try {
      const baseUrl =
        typeof window !== 'undefined' && window.location && window.location.origin
          ? window.location.origin
          : 'http://localhost';
      await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'X-Office-Intent': '1',
        },
        credentials: 'include',
      });
    } catch {
      // Abaikan kegagalan jaringan saat logout
    } finally {
      setFounderAuth(false);
      setOpen(false);
    }
  };

  const handleTriggerCollective = async (kind: CollectiveKind, title: string) => {
    setCollectiveLoading(kind);
    setFeedbackMessage(null);

    try {
      const baseUrl =
        typeof window !== 'undefined' && window.location && window.location.origin
          ? window.location.origin
          : 'http://localhost';
      const url = `${baseUrl}/api/v1/collective`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Office-Intent': '1',
        },
        credentials: 'include',
        body: JSON.stringify({
          kind,
          duration_seconds: kind === 'sholat' || kind === 'fire_drill' ? 300 : 600,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        updateCollective(data);
        setFeedbackMessage({
          text: `Event "${title}" berhasil dipicu! Peserta menuju lokasi; tugas nyata tetap diprioritaskan.`,
          isError: false,
        });
      } else if (res.status === 409) {
        setFeedbackMessage({
          text: 'Event kolektif lain masih berlangsung aktif. Tunggu hingga selesai.',
          isError: true,
        });
      } else {
        const err = await res.json().catch(() => null);
        setFeedbackMessage({
          text: err?.error || 'Gagal memicu event kolektif.',
          isError: true,
        });
      }
    } catch {
      setFeedbackMessage({
        text: 'Gagal menghubungi server. Periksa koneksi backend.',
        isError: true,
      });
    } finally {
      setCollectiveLoading(null);
    }
  };

  const atmosphereOptions: { id: TimeOfDay | 'auto'; label: string; icon: string }[] = [
    { id: 'auto', label: 'Otomatis WIB', icon: '🔄' },
    { id: 'dawn', label: 'Fajar (05-06)', icon: '🌅' },
    { id: 'day', label: 'Siang (06-17)', icon: '☀️' },
    { id: 'dusk', label: 'Senja (17-18)', icon: '🌇' },
    { id: 'night', label: 'Malam (18-05)', icon: '🌙' },
  ];

  return (
    <aside
      className="pointer-events-auto fixed top-14 right-4 z-40 w-96 max-w-[calc(100vw-2rem)] bg-[#14141e]/98 backdrop-blur-md border border-[#282d3f] rounded-xl shadow-2xl overflow-hidden select-none animate-in slide-in-from-right-4 duration-200 motion-reduce:transition-none"
      role="dialog"
      aria-label="Panel Kontrol Founder"
      data-testid="founder-panel"
    >
      {/* Header Panel */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1a1c29] border-b border-[#282d3f]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" aria-hidden="true" />
          <h2 className="font-bold text-xs text-[#f5f0e1] tracking-wide">
            Panel Kontrol Founder
          </h2>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800">
            Sesi Aktif
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Keluar dari sesi Founder"
            className="text-[11px] text-rose-300 hover:text-rose-200 px-2 py-0.5 rounded hover:bg-rose-950/50 border border-rose-800/40 transition-colors focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none"
          >
            Keluar
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup panel Founder"
            className="text-[#9ca8b8] hover:text-[#f5f0e1] p-1 rounded hover:bg-[#282d3f] transition-colors focus-visible:ring-2 focus-visible:ring-[#2bb3c0] focus-visible:outline-none"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 text-xs overflow-y-auto max-h-[calc(100vh-8rem)]">
        {feedbackMessage && (
          <div
            role="status"
            aria-live="polite"
            className={`p-2.5 rounded border text-[11px] flex items-start gap-2 ${
              feedbackMessage.isError
                ? 'bg-rose-950/80 border-rose-800 text-rose-200'
                : 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
            }`}
          >
            <span>{feedbackMessage.isError ? '⚠️' : '✅'}</span>
            <p className="leading-snug">{feedbackMessage.text}</p>
          </div>
        )}

        {/* Bagian 1: Trigger Event Kolektif (F15) */}
        <section aria-labelledby="heading-collective-events" className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 id="heading-collective-events" className="font-bold text-[#f5f0e1]">
              📢 Event Kolektif Kantor
            </h3>
            {activeCollective?.active && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
                Sedang Aktif: {activeCollective.title}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#9ca8b8]">
            Picu interaksi kantor secara manual. Agen dengan tugas aktif prioritas tinggi tetap
            mengerjakan tugasnya, sementara agen idle berkumpul di lokasi event.
          </p>

          <div className="grid grid-cols-1 gap-2 pt-1">
            {([
              ['pool_party', 'Pesta Kolam', 'Kolam · Bastion berjaga · 10 menit'],
              ['fire_drill', 'Simulasi Evakuasi', 'Kolam · Bastion memimpin hitung kepala · 5 menit'],
              ['town_hall', 'Pertemuan Kantor', 'Kafetaria · Ringkasan harian Jarvis · 10 menit'],
            ] as const).map(([kind, title, description]) => (
              <button key={kind} type="button" aria-label={`Picu event ${title}`}
                disabled={collectiveLoading !== null || !!activeCollective?.active}
                onClick={() => handleTriggerCollective(kind, title)}
                className="p-2.5 rounded bg-[#1a1c29] border border-[#282d3f] text-left hover:border-[#2bb3c0] focus-visible:ring-2 focus-visible:ring-[#2bb3c0] disabled:opacity-50">
                <strong className="block text-[#f5f0e1]">{title}</strong>
                <span className="text-[#9ca8b8]">{description}</span>
              </button>
            ))}
            {/* Rapat Mendadak */}
            <button
              type="button"
              onClick={() => handleTriggerCollective('rapat', 'Rapat Mendadak')}
              disabled={collectiveLoading !== null}
              aria-label="Picu event Rapat Mendadak di Boardroom"
              className="p-2.5 rounded bg-[#1a1c29] border border-[#282d3f] hover:border-[#2bb3c0] hover:bg-[#282d3f] text-left transition-all flex items-center justify-between focus-visible:ring-2 focus-visible:ring-[#2bb3c0] focus-visible:outline-none disabled:opacity-50"
            >
              <div>
                <div className="flex items-center gap-1.5 font-bold text-[#f5f0e1]">
                  <span>📢</span>
                  <span>Rapat Mendadak</span>
                </div>
                <p className="text-[10px] text-[#9ca8b8] mt-0.5">
                  Lokasi: Boardroom (Z02) · Durasi 10 menit
                </p>
              </div>
              <span className="px-2 py-1 rounded bg-[#282d3f] text-[10px] font-semibold text-[#2bb3c0]">
                {collectiveLoading === 'rapat' ? 'Memicu...' : 'Picu'}
              </span>
            </button>

            {/* Break Time */}
            <button
              type="button"
              onClick={() => handleTriggerCollective('break', 'Break Time')}
              disabled={collectiveLoading !== null}
              aria-label="Picu event Break Time di Kafetaria dan Lounge"
              className="p-2.5 rounded bg-[#1a1c29] border border-[#282d3f] hover:border-amber-400 hover:bg-[#282d3f] text-left transition-all flex items-center justify-between focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none disabled:opacity-50"
            >
              <div>
                <div className="flex items-center gap-1.5 font-bold text-[#f5f0e1]">
                  <span>☕</span>
                  <span>Break Time &amp; Santai</span>
                </div>
                <p className="text-[10px] text-[#9ca8b8] mt-0.5">
                  Lokasi: Kafetaria &amp; Lounge (Z14) · Durasi 10 menit
                </p>
              </div>
              <span className="px-2 py-1 rounded bg-[#282d3f] text-[10px] font-semibold text-amber-300">
                {collectiveLoading === 'break' ? 'Memicu...' : 'Picu'}
              </span>
            </button>

            {/* Sholat Berjamaah */}
            <button
              type="button"
              onClick={() => handleTriggerCollective('sholat', 'Sholat Berjamaah')}
              disabled={collectiveLoading !== null}
              aria-label="Picu event Sholat Berjamaah di Musholla"
              className="p-2.5 rounded bg-[#1a1c29] border border-[#282d3f] hover:border-emerald-400 hover:bg-[#282d3f] text-left transition-all flex items-center justify-between focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none disabled:opacity-50"
            >
              <div>
                <div className="flex items-center gap-1.5 font-bold text-[#f5f0e1]">
                  <span>🕌</span>
                  <span>Sholat Berjamaah</span>
                </div>
                <p className="text-[10px] text-[#9ca8b8] mt-0.5">
                  Lokasi: Musholla (Z16) · Durasi 5 menit
                </p>
              </div>
              <span className="px-2 py-1 rounded bg-[#282d3f] text-[10px] font-semibold text-emerald-300">
                {collectiveLoading === 'sholat' ? 'Memicu...' : 'Picu'}
              </span>
            </button>
          </div>
        </section>

        {/* Bagian 2: Override Atmosfer */}
        <section aria-labelledby="heading-atmosphere-override" className="space-y-2 pt-2 border-t border-[#282d3f]/60">
          <div className="flex items-center justify-between">
            <h3 id="heading-atmosphere-override" className="font-bold text-[#f5f0e1]">
              ☀️ Override Pencahayaan Atmosfer
            </h3>
            <span className="text-[10px] text-[#9ca8b8] font-mono">
              Aktif: <strong className="text-[#f5f0e1] uppercase">{timeOfDay}</strong>
            </span>
          </div>
          <p className="text-[11px] text-[#9ca8b8]">
            Pilih mode pencahayaan visual kantor. Pilihan &quot;Otomatis WIB&quot; akan menyinkronkan
            atmosfer dengan waktu aktual Jakarta.
          </p>

          <div
            role="radiogroup"
            aria-label="Pengaturan Mode Atmosfer"
            className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1"
          >
            {atmosphereOptions.map((opt) => {
              const isSelected = atmosphereOverride === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => setAtmosphereOverride(opt.id)}
                  aria-label={`Mode atmosfer: ${opt.label}`}
                  className={`p-2 rounded text-left flex flex-col gap-0.5 border transition-all focus-visible:ring-2 focus-visible:ring-[#2bb3c0] focus-visible:outline-none ${
                    isSelected
                      ? 'bg-[#2bb3c0]/20 border-[#2bb3c0] text-[#f5f0e1] shadow-sm'
                      : 'bg-[#1a1c29] border-[#282d3f] text-[#9ca8b8] hover:text-[#f5f0e1] hover:border-[#687594]'
                  }`}
                >
                  <span className="text-base">{opt.icon}</span>
                  <span className="font-semibold text-[11px] truncate leading-tight">
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Bagian 3: Status Proyeksi Telemetri */}
        <section className="p-2.5 rounded bg-[#1a1c29]/60 border border-[#282d3f] text-[10px] text-[#9ca8b8] space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#f5f0e1]">Proyeksi Telemetri:</span>
            <span className="text-emerald-400 font-mono font-bold">FOUNDER ACTIVE</span>
          </div>
          <p className="text-[#687594] leading-relaxed">
            Dalam mode Founder, rincian teknis tugas asli, workspace path, branch git, dan pid
            pekerja ditampilkan lengkap di panel Inspector agen.
          </p>
        </section>
      </div>
    </aside>
  );
};