import React, { useEffect, useRef, useState } from 'react';
import { useOfficeStore } from '../store/officeStore';

export const LoginModal: React.FC = () => {
  const isOpen = useOfficeStore((s) => s.isLoginModalOpen);
  const setOpen = useOfficeStore((s) => s.setLoginModalOpen);
  const setFounderAuth = useOfficeStore((s) => s.setFounderAuthenticated);
  const setFounderPanelOpen = useOfficeStore((s) => s.setFounderPanelOpen);

  const [password, setPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus ke input password saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setErrorMessage(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Keyboard shortcut: Escape untuk membatalkan dan menutup modal
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

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMessage('Kata sandi tidak boleh kosong.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const baseUrl =
        typeof window !== 'undefined' && window.location && window.location.origin
          ? window.location.origin
          : 'http://localhost';
      const url = `${baseUrl}/api/v1/auth/login`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Office-Intent': '1',
        },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setFounderAuth(true);
        setOpen(false);
        setFounderPanelOpen(true);
      } else if (res.status === 401) {
        setErrorMessage('Kata sandi Founder salah. Silakan periksa kembali.');
      } else if (res.status === 429) {
        setErrorMessage('Terlalu banyak percobaan login gagal. Dibatasi 5 kali per 15 menit.');
      } else {
        const errorData = await res.json().catch(() => null);
        setErrorMessage(
          errorData?.error || 'Gagal melakukan login. Terjadi kesalahan pada server.',
        );
      }
    } catch {
      setErrorMessage('Gagal menghubungi server. Periksa koneksi backend.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150 motion-reduce:transition-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-dialog-title"
      data-testid="login-founder-modal"
    >
      <div className="bg-[#14141e] border border-[#282d3f] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden text-xs">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1a1c29] border-b border-[#282d3f]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" aria-hidden="true" />
            <h2 id="login-dialog-title" className="font-bold text-sm text-[#f5f0e1]">
              Login Founder
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup form login"
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

        {/* Konten Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-[11px] text-[#9ca8b8] leading-relaxed">
            Masukkan kata sandi Founder untuk mengaktifkan telemetri lengkap, membuka kontrol
            event kolektif, dan override mode pencahayaan atmosfer.
          </p>

          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-2.5 rounded bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-start gap-2"
            >
              <span className="text-rose-400 font-bold">⚠️</span>
              <p className="leading-snug">{errorMessage}</p>
            </div>
          )}

          <div>
            <label
              htmlFor="founder-password-input"
              className="block text-[11px] font-semibold text-[#f5f0e1] mb-1.5"
            >
              Kata Sandi Founder
            </label>
            <input
              id="founder-password-input"
              ref={inputRef}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan passphrase Founder..."
              aria-label="Kata sandi Founder"
              aria-required="true"
              disabled={isLoading}
              className="w-full bg-[#1a1c29] border border-[#282d3f] text-[#f5f0e1] placeholder-[#687594] text-xs rounded px-3 py-2 outline-none focus:border-[#2bb3c0] focus-visible:ring-2 focus-visible:ring-[#2bb3c0] disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#282d3f]/60">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isLoading}
              aria-label="Batal dan tutup login"
              className="px-3 py-1.5 rounded text-[#9ca8b8] hover:text-[#f5f0e1] hover:bg-[#282d3f] transition-colors focus-visible:ring-2 focus-visible:ring-[#2bb3c0] focus-visible:outline-none"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              aria-label="Masuk sebagai Founder"
              className="px-4 py-1.5 rounded bg-[#2bb3c0] text-[#14141e] font-bold shadow-md hover:bg-[#259ea9] transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-50"
            >
              {isLoading ? 'Memverifikasi...' : 'Masuk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};