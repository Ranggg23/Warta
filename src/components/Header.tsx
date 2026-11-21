export type ActiveView = 'all' | 'for_you' | 'summarizer' | 'saved';

interface HeaderProps {
  activeView: ActiveView;
  savedCount: number;
  onSelectView: (view: ActiveView) => void;
  onOpenPreferences: () => void;
}

export function Header({
  activeView,
  savedCount,
  onSelectView,
  onOpenPreferences,
}: HeaderProps) {
  const navItems: Array<{ id: ActiveView; label: string }> = [
    { id: 'all', label: 'Hari Ini' },
    { id: 'for_you', label: 'Untuk Anda' },
    { id: 'summarizer', label: 'Ringkas Tautan' },
    { id: 'saved', label: savedCount > 0 ? `Tersimpan (${savedCount})` : 'Tersimpan' },
  ];

  return (
    <header className="border-b border-stone-200 dark:border-zinc-800 bg-[#FBF9F5]/95 dark:bg-[#0D0D10]/95 backdrop-blur-sm sticky top-0 z-30">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onSelectView('all')}
          className="font-serif text-2xl font-bold tracking-tight text-stone-900 dark:text-[#F2F0EB] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 dark:focus-visible:ring-red-400 rounded-sm"
        >
          WartaKini
        </button>

        <nav
          aria-label="Navigasi utama"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 dark:focus-visible:ring-red-400 ${
                  isActive
                    ? 'border-red-700 dark:border-red-400 text-stone-900 dark:text-[#F2F0EB] font-semibold'
                    : 'border-transparent text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onOpenPreferences}
            className="px-4 py-2 text-xs sm:text-sm font-medium rounded-md bg-stone-900 text-[#FBF9F5] hover:bg-stone-800 dark:bg-[#E4E2DD] dark:text-[#0D0D10] dark:hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 dark:focus-visible:ring-red-400"
          >
            Atur Preferensi
          </button>
        </div>
      </div>
    </header>
  );
}
