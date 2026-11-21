import { Bell, X } from 'lucide-react';
import type { BreakingNotification, NewsArticle } from '../types/news';

interface BreakingToastProps {
  notification: BreakingNotification | null;
  onOpenArticle: (article: NewsArticle) => void;
  onDismiss: () => void;
}

export function BreakingToast({
  notification,
  onOpenArticle,
  onDismiss,
}: BreakingToastProps) {
  if (!notification) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-stone-300 dark:border-zinc-700 bg-white dark:bg-[#18181E] shadow-xl p-4 space-y-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-400">
          <Bell className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Berita Terkini · {notification.article.categoryLabel}</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup notifikasi"
          className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          onOpenArticle(notification.article);
          onDismiss();
        }}
        className="block text-left w-full cursor-pointer group"
      >
        <p className="font-serif text-sm font-semibold text-stone-900 dark:text-zinc-100 group-hover:text-red-700 dark:group-hover:text-red-400 leading-snug">
          {notification.article.title}
        </p>
        <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1 line-clamp-2">
          {notification.article.excerpt}
        </p>
      </button>
    </div>
  );
}
