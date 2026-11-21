import { Bell, Moon, Search, Sun, X } from 'lucide-react';
import { type FormEvent } from 'react';
import type { ActiveView } from './Header';

interface UtilityStripProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (e: FormEvent) => void;
  onClearSearch: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  unreadCount: number;
  sseConnected: boolean;
  onOpenNotifications: () => void;
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  savedCount: number;
}

export function UtilityStrip({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onClearSearch,
  theme,
  onToggleTheme,
  unreadCount,
  sseConnected,
  onOpenNotifications,
  activeView,
  onSelectView,
  savedCount,
}: UtilityStripProps) {
  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="border-b border-stone-200 dark:border-zinc-800 bg-stone-100/60 dark:bg-[#131317]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-xs text-stone-600 dark:text-zinc-400 tabular-nums whitespace-nowrap">
            {todayFormatted}
          </p>

          <div className="flex md:hidden items-center gap-3 text-xs font-medium overflow-x-auto">
            {(
              [
                { id: 'all', label: 'Hari Ini' },
                { id: 'for_you', label: 'Untuk Anda' },
                { id: 'summarizer', label: 'Ringkas' },
                { id: 'saved', label: `Simpan (${savedCount})` },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className={`whitespace-nowrap shrink-0 py-1 cursor-pointer ${
                  activeView === item.id
                    ? 'text-red-700 dark:text-red-400 font-semibold'
                    : 'text-stone-600 dark:text-zinc-400'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 flex-1 lg:max-w-2xl lg:justify-end">
          <form onSubmit={onSearchSubmit} className="relative flex-1 min-w-[200px] sm:max-w-sm">
            <Search
              className="w-4 h-4 text-stone-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari isu, tokoh, atau berita hari ini..."
              aria-label="Cari berita terupdate"
              className="w-full h-10 pl-9 pr-9 text-sm rounded-md bg-white dark:bg-[#1A1A20] border border-stone-200 dark:border-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-stone-500 dark:focus:border-zinc-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={onClearSearch}
                aria-label="Bersihkan pencarian"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Buka notifikasi berita real-time"
            className="h-10 px-3.5 inline-flex items-center gap-2 text-xs font-medium rounded-md border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#1A1A20] text-stone-700 dark:text-zinc-200 hover:border-stone-400 dark:hover:border-zinc-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Bell className="w-4 h-4 text-red-700 dark:text-red-400" aria-hidden="true" />
            <span>Notifikasi</span>
            <span className="font-mono tabular-nums text-stone-500 dark:text-zinc-400">
              {unreadCount > 0 ? `(${unreadCount})` : sseConnected ? '· Live' : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode malam'}
            className="h-10 px-3.5 inline-flex items-center gap-2 text-xs font-medium rounded-md border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#1A1A20] text-stone-700 dark:text-zinc-200 hover:border-stone-400 dark:hover:border-zinc-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
                <span>Mode Siang</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-stone-700" aria-hidden="true" />
                <span>Mode Malam</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
