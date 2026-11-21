import { Bell, Check, X } from 'lucide-react';
import { useState } from 'react';
import { NEWS_CATEGORIES } from '../lib/categories';
import type { NewsCategoryId } from '../types/news';

interface PreferencesModalProps {
  isOpen: boolean;
  preferredCategories: NewsCategoryId[];
  realtimeEnabled: boolean;
  onSavePreferences: (categories: NewsCategoryId[], realtimeEnabled: boolean) => void;
  onClose: () => void;
}

export function PreferencesModal({
  isOpen,
  preferredCategories,
  realtimeEnabled,
  onSavePreferences,
  onClose,
}: PreferencesModalProps) {
  const [selected, setSelected] = useState<NewsCategoryId[]>(preferredCategories);
  const [realtime, setRealtime] = useState(realtimeEnabled);
  const [browserPermission, setBrowserPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  if (!isOpen) return null;

  function toggleCategory(id: NewsCategoryId) {
    setSelected((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // Keep at least 1 category
        return prev.filter((c) => c !== id);
      }
      return [...prev, id];
    });
  }

  async function requestDesktopNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const result = await Notification.requestPermission();
      setBrowserPermission(result);
    } catch {
      // Ignore permission errors
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Atur Preferensi Berita dan Notifikasi"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-[#FBF9F5] dark:bg-[#121216] border border-stone-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-semibold text-stone-900 dark:text-[#F2F0EB]">
              Preferensi Kategori &amp; Notifikasi
            </h2>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
              Pilih topik berita favorit Anda untuk halaman &ldquo;Pilihan Anda&rdquo; dan siaran notifikasi langsung.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan preferensi"
            className="p-2 rounded-md border border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-zinc-300 hover:border-stone-400 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {NEWS_CATEGORIES.map((cat) => {
              const isChecked = selected.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={`text-left p-4 rounded-lg border transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                    isChecked
                      ? 'border-stone-900 dark:border-zinc-200 bg-white dark:bg-[#1A1A20]'
                      : 'border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-[#141418] opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                      {cat.label}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed">
                      {cat.description}
                    </p>
                  </div>
                  <span
                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 border ${
                      isChecked
                        ? 'bg-red-700 border-red-700 text-white dark:bg-red-500 dark:border-red-500'
                        : 'border-stone-300 dark:border-zinc-700'
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-4 rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#18181E] space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-stone-900 dark:text-zinc-100">
                  Notifikasi Breaking News Real-Time
                </p>
                <p className="text-xs text-stone-500 dark:text-zinc-400">
                  Terima pembaruan instan di aplikasi saat ada kabar mendesak pada kategori pilihan Anda.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={realtime}
                onClick={() => setRealtime((v) => !v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer shrink-0 ${
                  realtime
                    ? 'bg-stone-900 text-[#FBF9F5] dark:bg-[#E4E2DD] dark:text-[#0D0D10]'
                    : 'border border-stone-300 dark:border-zinc-700 text-stone-600 dark:text-zinc-400'
                }`}
              >
                {realtime ? 'Aktif' : 'Nonaktif'}
              </button>
            </div>

            {browserPermission !== 'unsupported' && (
              <div className="pt-3 border-t border-stone-200 dark:border-zinc-800 flex items-center justify-between gap-4">
                <p className="text-xs text-stone-600 dark:text-zinc-400">
                  Notifikasi Desktop Browser:{' '}
                  <span className="font-medium text-stone-900 dark:text-zinc-200">
                    {browserPermission === 'granted'
                      ? 'Diizinkan'
                      : browserPermission === 'denied'
                        ? 'Diblokir di browser'
                        : 'Belum diaktifkan'}
                  </span>
                </p>
                {browserPermission === 'default' && (
                  <button
                    type="button"
                    onClick={requestDesktopNotifications}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-200 hover:border-stone-400 cursor-pointer shrink-0"
                  >
                    <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Aktifkan</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-stone-200 dark:border-zinc-800 flex items-center justify-between gap-4">
          <span className="font-mono text-xs text-stone-500 dark:text-zinc-400 tabular-nums">
            {selected.length} kategori dipilih
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-md border border-stone-200 dark:border-zinc-800 text-stone-700 dark:text-zinc-300 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                onSavePreferences(selected, realtime);
                onClose();
              }}
              className="px-4 py-2 text-xs font-medium rounded-md bg-stone-900 text-[#FBF9F5] hover:bg-stone-800 dark:bg-[#E4E2DD] dark:text-[#0D0D10] dark:hover:bg-white cursor-pointer"
            >
              Simpan Preferensi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
