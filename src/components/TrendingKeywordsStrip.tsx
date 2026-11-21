import { TrendingUp, X } from 'lucide-react';
import type { TrendingKeyword } from '../types/news';

interface TrendingKeywordsStripProps {
  keywords: TrendingKeyword[];
  activeQuery: string;
  isLoading: boolean;
  onSelectKeyword: (keyword: string) => void;
  onClearKeyword: () => void;
}

export function TrendingKeywordsStrip({
  keywords,
  activeQuery,
  isLoading,
  onSelectKeyword,
  onClearKeyword,
}: TrendingKeywordsStripProps) {
  if (!isLoading && keywords.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Top 5 Kata Kunci Trending"
      className="border-b border-stone-200 dark:border-zinc-800 bg-stone-50/70 dark:bg-[#101014]"
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 overflow-x-auto min-w-0">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-zinc-300 whitespace-nowrap shrink-0">
            <TrendingUp
              className="w-3.5 h-3.5 text-red-700 dark:text-red-400"
              aria-hidden="true"
            />
            <span>Top 5 Trending</span>
          </div>

          <span
            aria-hidden="true"
            className="h-3.5 w-px bg-stone-300 dark:bg-zinc-700 shrink-0"
          />

          {isLoading && keywords.length === 0 ? (
            <div className="flex items-center gap-4" aria-busy="true">
              {[0, 1, 2, 3, 4].map((idx) => (
                <div
                  key={idx}
                  className="h-4 w-24 rounded bg-stone-200 dark:bg-zinc-800 animate-pulse shrink-0"
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
              {keywords.slice(0, 5).map((item, idx) => {
                const isActive =
                  activeQuery.trim().toLowerCase() === item.keyword.trim().toLowerCase();
                const indexLabel = String(idx + 1).padStart(2, '0');
                return (
                  <button
                    key={`${item.keyword}-${idx}`}
                    type="button"
                    onClick={() =>
                      isActive ? onClearKeyword() : onSelectKeyword(item.keyword)
                    }
                    title={`Cari berita Google terbaru untuk "${item.keyword}"`}
                    className={`px-2.5 py-1 text-xs rounded transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                      isActive
                        ? 'border-red-700 dark:border-red-400 text-red-800 dark:text-red-300 font-semibold bg-red-50/60 dark:bg-red-950/20'
                        : 'border-transparent text-stone-700 dark:text-zinc-300 hover:text-stone-950 dark:hover:text-white hover:bg-stone-200/50 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <span className="font-mono text-[11px] text-stone-400 dark:text-zinc-500 tabular-nums">
                      {indexLabel}.
                    </span>
                    <span>{item.keyword}</span>
                    <span className="font-mono text-[11px] text-stone-400 dark:text-zinc-500 tabular-nums">
                      ({item.count})
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {activeQuery && (
          <button
            type="button"
            onClick={onClearKeyword}
            className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </section>
  );
}
