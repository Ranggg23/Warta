import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  FileText,
  PenTool,
  RefreshCw,
  Share2,
} from 'lucide-react';
import { useState } from 'react';
import { getCategoryMeta } from '../lib/categories';
import type { NewsArticle } from '../types/news';

export type StudioTab = 'ringkasan' | 'copywriting' | 'bagikan';

interface EditorialFeedProps {
  articles: NewsArticle[];
  isLoading: boolean;
  errorMessage: string | null;
  searchQuery: string;
  savedIds: Set<string>;
  onRetry: () => void;
  onOpenArticle: (article: NewsArticle, initialTab?: StudioTab) => void;
  onToggleSave: (article: NewsArticle) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

function EditorialImage({
  src,
  alt,
  categoryLabel,
  aspectClass,
}: {
  src: string;
  alt: string;
  categoryLabel: string;
  aspectClass: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`${aspectClass} w-full rounded-lg bg-gradient-to-br from-stone-200 via-stone-100 to-stone-300 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800 border border-stone-200 dark:border-zinc-800 flex flex-col items-center justify-center p-6 text-center`}
      >
        <FileText className="w-7 h-7 text-stone-400 dark:text-zinc-500 mb-2" aria-hidden="true" />
        <span className="font-serif text-sm text-stone-600 dark:text-zinc-400">
          {categoryLabel}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`${aspectClass} w-full overflow-hidden rounded-lg bg-stone-200 dark:bg-zinc-900 border border-stone-200/80 dark:border-zinc-800`}
    >
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
      />
    </div>
  );
}

export function EditorialFeed({
  articles,
  isLoading,
  errorMessage,
  searchQuery,
  savedIds,
  onRetry,
  onOpenArticle,
  onToggleSave,
  emptyTitle,
  emptyDescription,
}: EditorialFeedProps) {
  if (isLoading && articles.length === 0) {
    return (
      <div className="space-y-10 py-8" aria-busy="true" aria-label="Memuat berita terkini">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch pb-10 border-b border-stone-200 dark:border-zinc-800">
          <div className="lg:col-span-6 space-y-4">
            <div className="h-4 w-44 bg-stone-200 dark:bg-zinc-800 rounded animate-pulse" />
            <div className="h-10 w-full bg-stone-200 dark:bg-zinc-800 rounded animate-pulse" />
            <div className="h-10 w-4/5 bg-stone-200 dark:bg-zinc-800 rounded animate-pulse" />
            <div className="h-20 w-full bg-stone-200/70 dark:bg-zinc-800/70 rounded animate-pulse" />
          </div>
          <div className="lg:col-span-6 aspect-video bg-stone-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="space-y-3">
              <div className="aspect-[4/3] bg-stone-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
              <div className="h-3 w-32 bg-stone-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-6 w-full bg-stone-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-12 w-full bg-stone-200/70 dark:bg-zinc-800/70 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="my-10 p-6 sm:p-8 rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#141418] max-w-2xl mx-auto text-center space-y-4">
        <AlertCircle
          className="w-8 h-8 text-red-700 dark:text-red-400 mx-auto"
          aria-hidden="true"
        />
        <div className="space-y-1.5">
          <h2 className="font-serif text-xl font-semibold text-stone-900 dark:text-zinc-100">
            Gagal Memuat Berita Terupdate
          </h2>
          <p className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">
            {errorMessage}
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md bg-stone-900 text-[#FBF9F5] hover:bg-stone-800 dark:bg-[#E4E2DD] dark:text-[#0D0D10] dark:hover:bg-white transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Coba Muat Ulang</span>
        </button>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="my-12 py-12 px-6 rounded-lg border border-stone-200 dark:border-zinc-800 bg-white/70 dark:bg-[#141418] max-w-xl mx-auto text-center space-y-3">
        <h2 className="font-serif text-2xl font-semibold text-stone-900 dark:text-zinc-100">
          {emptyTitle || 'Belum Ada Berita untuk Filter Ini'}
        </h2>
        <p className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">
          {emptyDescription ||
            (searchQuery
              ? `Tidak ditemukan berita terbaru yang cocok dengan kata kunci "${searchQuery}".`
              : 'Pilih kategori lain atau perbarui untuk memuat laporan berita terbaru hari ini.')}
        </p>
      </div>
    );
  }

  const leadArticle = articles[0];
  const secondaryArticles = articles.slice(1, 4);
  const wireArticles = articles.slice(4);
  const leadMeta = getCategoryMeta(leadArticle.category);
  const isLeadSaved = savedIds.has(leadArticle.id);

  return (
    <div className="py-8 space-y-12">
      {/* Tier 1: Lead Editorial Story */}
      <section aria-label="Berita Utama Hari Ini" className="pb-10 border-b border-stone-200 dark:border-zinc-800">
        <article className="group grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-zinc-400">
                {leadArticle.isBreaking && (
                  <>
                    <span className="font-semibold text-red-700 dark:text-red-400">
                      Berita Terkini
                    </span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span className="font-medium text-stone-700 dark:text-zinc-300">
                  {leadArticle.categoryLabel}
                </span>
                <span aria-hidden="true">·</span>
                <span>{leadArticle.sourceName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{leadArticle.relativeTime}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{leadArticle.readMinutes} mnt baca</span>
              </div>

              <button
                type="button"
                onClick={() => onOpenArticle(leadArticle, 'ringkasan')}
                className="text-left block w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 dark:focus-visible:ring-red-400 rounded-sm"
              >
                <h1 className="font-serif text-3xl sm:text-4xl lg:text-[2.65rem] font-semibold leading-[1.16] tracking-tight text-stone-900 dark:text-[#F2F0EB] group-hover:text-red-800 dark:group-hover:text-red-300 transition-colors headline-balance">
                  {leadArticle.title}
                </h1>
              </button>

              <p className="text-base sm:text-lg text-stone-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
                {leadArticle.excerpt}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => onOpenArticle(leadArticle, 'ringkasan')}
                className="px-4 py-2 text-xs font-medium rounded-md bg-stone-900 text-[#FBF9F5] hover:bg-stone-800 dark:bg-[#E4E2DD] dark:text-[#0D0D10] dark:hover:bg-white transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Baca &amp; Ringkas AI</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenArticle(leadArticle, 'copywriting')}
                className="px-4 py-2 text-xs font-medium rounded-md border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#1A1A20] text-stone-800 dark:text-zinc-200 hover:border-stone-400 dark:hover:border-zinc-600 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <PenTool className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Struktur Copy</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenArticle(leadArticle, 'bagikan')}
                className="px-3.5 py-2 text-xs font-medium rounded-md border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#1A1A20] text-stone-700 dark:text-zinc-300 hover:border-stone-400 dark:hover:border-zinc-600 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Bagikan</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleSave(leadArticle)}
                aria-label={isLeadSaved ? 'Hapus dari simpanan' : 'Simpan artikel'}
                className="p-2 rounded-md border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#1A1A20] text-stone-600 dark:text-zinc-300 hover:border-stone-400 dark:hover:border-zinc-600 transition-colors cursor-pointer"
              >
                {isLeadSaved ? (
                  <BookmarkCheck className="w-4 h-4 text-red-700 dark:text-red-400" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <button
              type="button"
              onClick={() => onOpenArticle(leadArticle, 'ringkasan')}
              className="block w-full h-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 dark:focus-visible:ring-red-400 rounded-lg"
            >
              <EditorialImage
                src={leadMeta.imageUrl}
                alt={`Ilustrasi editorial: ${leadArticle.title}`}
                categoryLabel={leadArticle.categoryLabel}
                aspectClass="aspect-video lg:aspect-auto lg:h-full min-h-[260px]"
              />
            </button>
          </div>
        </article>
      </section>

      {/* Tier 2: Secondary Features Grid */}
      {secondaryArticles.length > 0 && (
        <section
          aria-label="Sorotan Pilihan"
          className="pb-10 border-b border-stone-200 dark:border-zinc-800"
        >
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-serif text-xl sm:text-2xl font-semibold text-stone-900 dark:text-[#F2F0EB]">
              Sorotan Pilihan
            </h2>
            <span className="font-mono text-xs text-stone-500 dark:text-zinc-400 tabular-nums">
              {secondaryArticles.length} laporan utama
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {secondaryArticles.map((article) => {
              const meta = getCategoryMeta(article.category);
              const isSaved = savedIds.has(article.id);
              return (
                <article
                  key={article.id}
                  className="group flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3.5">
                    <button
                      type="button"
                      onClick={() => onOpenArticle(article, 'ringkasan')}
                      className="block w-full text-left cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 dark:focus-visible:ring-red-400"
                    >
                      <EditorialImage
                        src={meta.imageUrl}
                        alt={`Ilustrasi editorial: ${article.title}`}
                        categoryLabel={article.categoryLabel}
                        aspectClass="aspect-[4/3]"
                      />
                    </button>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500 dark:text-zinc-400">
                      <span className="font-medium text-stone-700 dark:text-zinc-300">
                        {article.categoryLabel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{article.sourceName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{article.relativeTime}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenArticle(article, 'ringkasan')}
                      className="block w-full text-left cursor-pointer"
                    >
                      <h3 className="font-serif text-xl font-semibold leading-snug text-stone-900 dark:text-[#F2F0EB] group-hover:text-red-800 dark:group-hover:text-red-300 transition-colors headline-balance">
                        {article.title}
                      </h3>
                    </button>

                    <p className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed line-clamp-3">
                      {article.excerpt}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-stone-200/70 dark:border-zinc-800/80 text-xs">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onOpenArticle(article, 'ringkasan')}
                        className="font-medium text-stone-900 dark:text-zinc-100 hover:text-red-700 dark:hover:text-red-400 transition-colors cursor-pointer"
                      >
                        Ringkas AI
                      </button>
                      <span aria-hidden="true" className="text-stone-300 dark:text-zinc-700">
                        /
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenArticle(article, 'copywriting')}
                        className="font-medium text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
                      >
                        Buat Copy
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onOpenArticle(article, 'bagikan')}
                        aria-label={`Bagikan ${article.title}`}
                        className="p-1.5 rounded text-stone-500 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleSave(article)}
                        aria-label={isSaved ? 'Hapus dari simpanan' : 'Simpan artikel'}
                        className="p-1.5 rounded text-stone-500 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100 cursor-pointer"
                      >
                        {isSaved ? (
                          <BookmarkCheck className="w-3.5 h-3.5 text-red-700 dark:text-red-400" />
                        ) : (
                          <Bookmark className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Tier 3: Compact Archive / Wire List */}
      {wireArticles.length > 0 && (
        <section aria-label="Arsip Kabar Terkini">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-serif text-xl sm:text-2xl font-semibold text-stone-900 dark:text-[#F2F0EB]">
              Kabar Terkini Lainnya
            </h2>
            <span className="font-mono text-xs text-stone-500 dark:text-zinc-400 tabular-nums">
              {wireArticles.length} artikel
            </span>
          </div>

          <div className="divide-y divide-stone-200 dark:divide-zinc-800 border-t border-b border-stone-200 dark:border-zinc-800">
            {wireArticles.map((article, idx) => {
              const isSaved = savedIds.has(article.id);
              const numberLabel = String(idx + 1).padStart(2, '0');
              return (
                <article
                  key={article.id}
                  className="py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                >
                  <div className="flex items-start gap-4 max-w-3xl">
                    <span className="font-mono text-xs text-stone-400 dark:text-zinc-500 tabular-nums pt-1 shrink-0">
                      {numberLabel}.
                    </span>
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-zinc-400">
                        <span className="font-medium text-stone-700 dark:text-zinc-300">
                          {article.categoryLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{article.sourceName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{article.relativeTime}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{article.readMinutes} mnt baca</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenArticle(article, 'ringkasan')}
                        className="text-left block cursor-pointer"
                      >
                        <h3 className="font-serif text-lg sm:text-xl font-semibold text-stone-900 dark:text-[#F2F0EB] group-hover:text-red-800 dark:group-hover:text-red-300 transition-colors headline-balance">
                          {article.title}
                        </h3>
                      </button>

                      <p className="text-sm text-stone-600 dark:text-zinc-400 leading-relaxed">
                        {article.excerpt}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pl-8 md:pl-0">
                    <button
                      type="button"
                      onClick={() => onOpenArticle(article, 'ringkasan')}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#1A1A20] text-stone-800 dark:text-zinc-200 hover:border-stone-400 dark:hover:border-zinc-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Ringkas AI
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenArticle(article, 'copywriting')}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#1A1A20] text-stone-700 dark:text-zinc-300 hover:border-stone-400 dark:hover:border-zinc-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Copywriting
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenArticle(article, 'bagikan')}
                      aria-label={`Bagikan ${article.title}`}
                      className="p-2 rounded-md border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#1A1A20] text-stone-600 dark:text-zinc-300 hover:border-stone-400 dark:hover:border-zinc-600 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleSave(article)}
                      aria-label={isSaved ? 'Hapus dari simpanan' : 'Simpan artikel'}
                      className="p-2 rounded-md border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#1A1A20] text-stone-600 dark:text-zinc-300 hover:border-stone-400 dark:hover:border-zinc-600 cursor-pointer"
                    >
                      {isSaved ? (
                        <BookmarkCheck className="w-3.5 h-3.5 text-red-700 dark:text-red-400" />
                      ) : (
                        <Bookmark className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
