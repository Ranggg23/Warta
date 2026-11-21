import { RefreshCw } from 'lucide-react';
import { NEWS_CATEGORIES } from '../lib/categories';
import type { NewsCategoryId } from '../types/news';

interface CategoryFilterBarProps {
  selectedCategory: NewsCategoryId | 'all' | 'preferred';
  preferredCategories: NewsCategoryId[];
  onSelectCategory: (cat: NewsCategoryId | 'all' | 'preferred') => void;
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdatedLabel: string;
}

export function CategoryFilterBar({
  selectedCategory,
  preferredCategories,
  onSelectCategory,
  onRefresh,
  isLoading,
  lastUpdatedLabel,
}: CategoryFilterBarProps) {
  return (
    <div className="border-b border-stone-200 dark:border-zinc-800">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filter kategori berita"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === 'all'}
            onClick={() => onSelectCategory('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-stone-900 text-[#FBF9F5] dark:bg-[#E4E2DD] dark:text-[#0D0D10]'
                : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-200/70 dark:hover:bg-zinc-800/80 hover:text-stone-900 dark:hover:text-zinc-100'
            }`}
          >
            Semua Berita
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === 'preferred'}
            onClick={() => onSelectCategory('preferred')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
              selectedCategory === 'preferred'
                ? 'bg-red-700 text-white dark:bg-red-500 dark:text-white'
                : 'text-stone-700 dark:text-zinc-300 hover:bg-stone-200/70 dark:hover:bg-zinc-800/80'
            }`}
          >
            Pilihan Anda ({preferredCategories.length})
          </button>

          <span
            aria-hidden="true"
            className="h-4 w-px bg-stone-300 dark:bg-zinc-700 mx-1 shrink-0"
          />

          {NEWS_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const isPreferred = preferredCategories.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => onSelectCategory(cat.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-stone-900 text-[#FBF9F5] dark:bg-[#E4E2DD] dark:text-[#0D0D10]'
                    : isPreferred
                      ? 'text-stone-900 dark:text-zinc-100 hover:bg-stone-200/70 dark:hover:bg-zinc-800/80'
                      : 'text-stone-500 dark:text-zinc-400 hover:bg-stone-200/70 dark:hover:bg-zinc-800/80 hover:text-stone-900 dark:hover:text-zinc-100'
                }`}
              >
                {cat.shortLabel}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
          {lastUpdatedLabel && (
            <span className="font-mono text-[11px] text-stone-500 dark:text-zinc-400 tabular-nums whitespace-nowrap">
              Diperbarui {lastUpdatedLabel}
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#1A1A20] text-stone-700 dark:text-zinc-200 hover:border-stone-400 dark:hover:border-zinc-600 disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isLoading ? 'Memuat...' : 'Perbarui'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
