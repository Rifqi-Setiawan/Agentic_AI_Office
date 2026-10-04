import React, { useEffect } from 'react';
import { useOfficeStore } from '../store/officeStore';
import type { ToastNotification } from '../store/officeStore';

export const ToastItem: React.FC<{
  toast: ToastNotification;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const duration = toast.durationMs ?? 4000;
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  const isStart = toast.kind === 'task_started';

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="task-toast"
      data-toast-kind={toast.kind}
      className={`pointer-events-auto w-80 sm:w-96 flex flex-col p-3 rounded-lg shadow-2xl border backdrop-blur-md transition-all duration-300 motion-safe:animate-in ${
        isStart
          ? 'bg-[#181512]/95 border-amber-600/70 text-amber-100 shadow-amber-950/40'
          : 'bg-[#101915]/95 border-emerald-600/70 text-emerald-100 shadow-emerald-950/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider ${
              isStart
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
            }`}
          >
            {isStart ? 'MULAI' : 'SELESAI'}
          </span>
          {toast.agent && (
            <span className="font-semibold text-xs capitalize text-[#f5f0e1]">
              {toast.agent}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Tutup notifikasi"
          className="text-xs text-[#9ca8b8] hover:text-[#f5f0e1] p-0.5 rounded hover:bg-white/10 transition-colors focus-visible:ring-1 focus-visible:ring-white focus-visible:outline-none"
        >
          ✕
        </button>
      </div>
      <p className="text-xs leading-snug text-[#dcd6c8] break-words">
        {toast.message}
      </p>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const toasts = useOfficeStore((s) => s.toasts);
  const dismissToast = useOfficeStore((s) => s.dismissToast);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <aside
      aria-label="Notifikasi Tugas Kantor"
      className="fixed top-14 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none select-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </aside>
  );
};
