import { Bell, CheckCheck, Loader2, RefreshCw, X } from 'lucide-react';
import type { BreakingNotification, NewsArticle } from '../types/news';

interface NotificationDrawerProps {
  isOpen: boolean;
  notifications: BreakingNotification[];
  sseConnected: boolean;
  checkingBreaking: boolean;
  onCheckBreakingNow: () => void;
  onMarkAllRead: () => void;
  onSelectNotification: (article: NewsArticle) => void;
  onClose: () => void;
}

export function NotificationDrawer({
  isOpen,
  notifications,
  sseConnected,
  checkingBreaking,
  onCheckBreakingNow,
  onMarkAllRead,
  onSelectNotification,
  onClose,
}: NotificationDrawerProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pusat Notifikasi Real-Time"
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md h-full bg-[#FBF9F5] dark:bg-[#121216] border-l border-stone-200 dark:border-zinc-800 shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-semibold text-stone-900 dark:text-[#F2F0EB]">
              Notifikasi Real-Time
            </h2>
            <p className="font-mono text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5">
              {sseConnected ? 'Terhubung ke siaran langsung' : 'Menghubungkan ulang...'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel notifikasi"
            className="p-2 rounded-md border border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-zinc-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-stone-200 dark:border-zinc-800 bg-stone-100/60 dark:bg-[#17171C] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onCheckBreakingNow}
            disabled={checkingBreaking}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-900 text-[#FBF9F5] hover:bg-stone-800 dark:bg-[#E4E2DD] dark:text-[#0D0D10] inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {checkingBreaking ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{checkingBreaking ? 'Memeriksa...' : 'Cek Breaking News'}</span>
          </button>

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="px-2.5 py-1.5 text-xs font-medium text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100 inline-flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Tandai Dibaca</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-stone-200 dark:divide-zinc-800">
          {notifications.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Bell className="w-7 h-7 text-stone-400 dark:text-zinc-500 mx-auto" aria-hidden="true" />
              <p className="text-sm font-medium text-stone-700 dark:text-zinc-300">
                Belum ada notifikasi baru
              </p>
              <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed">
                Kabar terkini sesuai kategori preferensi Anda akan muncul otomatis di sini.
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const timeStr = new Date(item.receivedAt).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectNotification(item.article);
                    onClose();
                  }}
                  className={`w-full text-left px-5 py-4 hover:bg-stone-100/80 dark:hover:bg-zinc-900/60 transition-colors cursor-pointer space-y-1.5 ${
                    !item.read ? 'bg-red-50/40 dark:bg-red-950/15' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-stone-500 dark:text-zinc-400">
                    <span className="font-medium text-red-700 dark:text-red-400">
                      {item.article.categoryLabel}
                    </span>
                    <span className="font-mono tabular-nums">{timeStr}</span>
                  </div>
                  <p className="font-serif text-base font-semibold text-stone-900 dark:text-zinc-100 leading-snug">
                    {item.article.title}
                  </p>
                  <p className="text-xs text-stone-600 dark:text-zinc-400 line-clamp-2">
                    {item.article.excerpt}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
