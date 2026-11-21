import {
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  PenTool,
  RefreshCw,
  Share2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { getCategoryMeta, sanitizeExternalUrl } from '../lib/categories';
import type {
  AISummary,
  CopyTone,
  CopywritingSuggestion,
  NewsArticle,
  SocialPlatform,
} from '../types/news';
import type { StudioTab } from './EditorialFeed';
import { ShareBar } from './ShareBar';

interface ArticleStudioModalProps {
  article: NewsArticle | null;
  initialTab: StudioTab;
  isSaved: boolean;
  onToggleSave: (article: NewsArticle) => void;
  onClose: () => void;
}

const PLATFORMS: Array<{ id: SocialPlatform; label: string }> = [
  { id: 'instagram', label: 'Instagram Carousel' },
  { id: 'x_thread', label: 'X Thread' },
  { id: 'linkedin', label: 'LinkedIn Insight' },
  { id: 'tiktok', label: 'TikTok / Reels Script' },
];

const TONES: Array<{ id: CopyTone; label: string }> = [
  { id: 'informatif', label: 'Informatif' },
  { id: 'santai', label: 'Santai' },
  { id: 'kritis', label: 'Kritis' },
  { id: 'storytelling', label: 'Storytelling' },
];

export function ArticleStudioModal({
  article,
  initialTab,
  isSaved,
  onToggleSave,
  onClose,
}: ArticleStudioModalProps) {
  const [activeTab, setActiveTab] = useState<StudioTab>(initialTab);
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [platform, setPlatform] = useState<SocialPlatform>('instagram');
  const [tone, setTone] = useState<CopyTone>('informatif');
  const [copySuggestion, setCopySuggestion] = useState<CopywritingSuggestion | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copiedFull, setCopiedFull] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, article?.id]);

  useEffect(() => {
    if (!article) return;
    setSummary(null);
    setSummaryError(null);
    setCopySuggestion(null);
    setCopyError(null);
    void generateSummary(article);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.id]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (article) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [article, onClose]);

  if (!article) return null;

  const meta = getCategoryMeta(article.category);
  const safeSourceUrl = sanitizeExternalUrl(article.sourceUrl);

  async function generateSummary(target: NewsArticle) {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal membuat rangkuman AI.');
      }
      setSummary(data);
    } catch (err) {
      setSummaryError(
        err instanceof Error ? err.message : 'Terjadi kendala saat merangkum berita.'
      );
    } finally {
      setSummaryLoading(false);
    }
  }

  async function generateCopywriting(targetPlatform: SocialPlatform, targetTone: CopyTone) {
    if (!article) return;
    setCopyLoading(true);
    setCopyError(null);
    try {
      const res = await fetch('/api/ai/copywrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          summary: summary?.tldr || `${article.excerpt} ${article.content}`,
          sourceName: article.sourceName,
          url: safeSourceUrl,
          platform: targetPlatform,
          tone: targetTone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal menyusun copywriting.');
      }
      setCopySuggestion(data);
    } catch (err) {
      setCopyError(
        err instanceof Error ? err.message : 'Terjadi kendala saat menyusun copywriting.'
      );
    } finally {
      setCopyLoading(false);
    }
  }

  async function handleCopyFullDraft() {
    if (!copySuggestion) return;
    try {
      await navigator.clipboard.writeText(copySuggestion.fullDraft);
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 2000);
    } catch {
      // Clipboard blocked
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={article.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl h-full sm:h-auto sm:max-h-[90vh] bg-[#FBF9F5] dark:bg-[#121216] border border-stone-200 dark:border-zinc-800 sm:rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Top Header */}
        <div className="px-5 sm:px-8 py-4 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-zinc-400">
            <span className="font-medium text-stone-800 dark:text-zinc-200">
              {article.categoryLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span>{article.sourceName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{article.relativeTime}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleSave(article)}
              aria-label={isSaved ? 'Hapus dari simpanan' : 'Simpan artikel'}
              className="p-2 rounded-md border border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-zinc-300 hover:border-stone-400 dark:hover:border-zinc-600 cursor-pointer"
            >
              {isSaved ? (
                <BookmarkCheck className="w-4 h-4 text-red-700 dark:text-red-400" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup jendela baca"
              className="p-2 rounded-md border border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-zinc-300 hover:border-stone-400 dark:hover:border-zinc-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Studio Navigation Tabs */}
        <div className="px-5 sm:px-8 border-b border-stone-200 dark:border-zinc-800 bg-stone-100/50 dark:bg-[#17171C] flex items-center gap-6 shrink-0 overflow-x-auto">
          {(
            [
              { id: 'ringkasan', label: 'Rangkuman AI & Artikel', icon: FileText },
              { id: 'copywriting', label: 'Struktur Copywriting Sosmed', icon: PenTool },
              { id: 'bagikan', label: 'Bagikan ke Platform', icon: Share2 },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'copywriting' && !copySuggestion && !copyLoading) {
                    void generateCopywriting(platform, tone);
                  }
                }}
                className={`py-3.5 text-xs sm:text-sm font-medium inline-flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'border-red-700 dark:border-red-400 text-stone-900 dark:text-zinc-100 font-semibold'
                    : 'border-transparent text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 sm:py-8">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold leading-tight text-stone-900 dark:text-[#F2F0EB] headline-balance">
              {article.title}
            </h2>

            {activeTab === 'ringkasan' && (
              <div className="space-y-8">
                {/* AI Summary Block */}
                <section
                  aria-label="Rangkuman Otomatis AI"
                  className="p-5 sm:p-6 rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#18181E] space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-200 dark:border-zinc-800">
                    <div>
                      <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                        Rangkuman Otomatis AI
                      </h3>
                      {summary && (
                        <p className="font-mono text-xs text-stone-500 dark:text-zinc-400 tabular-nums mt-0.5">
                          Hemat waktu: {summary.readingTimeOriginal} → {summary.readingTimeSaved} ·{' '}
                          {summary.toneLabel}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void generateSummary(article)}
                      disabled={summaryLoading}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-300 hover:border-stone-400 dark:hover:border-zinc-500 inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${summaryLoading ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      <span>{summaryLoading ? 'Merangkum...' : 'Ringkas Ulang'}</span>
                    </button>
                  </div>

                  {summaryLoading && !summary && (
                    <div className="py-6 flex items-center gap-3 text-sm text-stone-600 dark:text-zinc-400">
                      <Loader2 className="w-4 h-4 animate-spin text-red-700 dark:text-red-400" />
                      <span>Menyusun intisari artikel secara otomatis...</span>
                    </div>
                  )}

                  {summaryError && (
                    <div className="text-sm text-red-700 dark:text-red-400 space-y-2">
                      <p>{summaryError}</p>
                    </div>
                  )}

                  {summary && (
                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-semibold text-stone-500 dark:text-zinc-400">
                          Inti Berita
                        </h4>
                        <p className="text-sm sm:text-base text-stone-800 dark:text-[#E4E2DD] leading-relaxed">
                          {summary.tldr}
                        </p>
                      </div>

                      {summary.keyPoints.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-stone-500 dark:text-zinc-400">
                            Poin Kunci
                          </h4>
                          <ul className="space-y-2">
                            {summary.keyPoints.map((pt, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-3 text-sm text-stone-700 dark:text-zinc-300 leading-relaxed"
                              >
                                <span className="font-mono text-xs text-red-700 dark:text-red-400 tabular-nums pt-0.5 shrink-0">
                                  0{i + 1}.
                                </span>
                                <span>{pt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {summary.impactAndContext && (
                        <div className="pt-3 border-t border-stone-200 dark:border-zinc-800 space-y-1.5">
                          <h4 className="text-xs font-semibold text-stone-500 dark:text-zinc-400">
                            Dampak &amp; Konteks
                          </h4>
                          <p className="text-sm text-stone-700 dark:text-zinc-300 leading-relaxed">
                            {summary.impactAndContext}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                {/* Full Article Body */}
                <section aria-label="Isi Berita" className="space-y-4">
                  <div className="aspect-video w-full overflow-hidden rounded-lg bg-stone-200 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800">
                    <img
                      src={meta.imageUrl}
                      alt={`Ilustrasi ${article.title}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="space-y-4 text-base text-stone-800 dark:text-[#E4E2DD] leading-[1.75]">
                    {article.content.split('\n\n').map((para, idx) => (
                      <p key={idx}>{para}</p>
                    ))}
                  </div>

                  {safeSourceUrl && (
                    <div className="pt-4 border-t border-stone-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-stone-500 dark:text-zinc-400">
                        Sumber rujukan: {article.sourceName}
                      </span>
                      <a
                        href={safeSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 hover:underline"
                      >
                        <span>Baca di Sumber Asli</span>
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    </div>
                  )}
                </section>
              </div>
            )}

            {activeTab === 'copywriting' && (
              <div className="space-y-6">
                <div className="p-5 rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#18181E] space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400">
                      Pilih Platform Konten
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORMS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setPlatform(p.id);
                            void generateCopywriting(p.id, tone);
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            platform === p.id
                              ? 'bg-stone-900 text-[#FBF9F5] dark:bg-[#E4E2DD] dark:text-[#0D0D10]'
                              : 'border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-300 hover:border-stone-400'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400">
                      Gaya Bahasa (Tone)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {TONES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setTone(t.id);
                            void generateCopywriting(platform, t.id);
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            tone === t.id
                              ? 'bg-red-700 text-white dark:bg-red-500'
                              : 'border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-300 hover:border-stone-400'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {copyLoading && (
                  <div className="p-6 rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#18181E] flex items-center gap-3 text-sm text-stone-600 dark:text-zinc-400">
                    <Loader2 className="w-4 h-4 animate-spin text-red-700 dark:text-red-400" />
                    <span>Menyusun struktur hook, alur konten, dan CTA...</span>
                  </div>
                )}

                {copyError && (
                  <div className="p-5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 text-sm text-red-700 dark:text-red-400">
                    {copyError}
                  </div>
                )}

                {copySuggestion && !copyLoading && (
                  <div className="space-y-5">
                    <div className="p-5 sm:p-6 rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#18181E] space-y-5">
                      <div className="flex items-center justify-between gap-4 pb-3 border-b border-stone-200 dark:border-zinc-800">
                        <span className="text-xs font-semibold text-stone-700 dark:text-zinc-300">
                          {copySuggestion.platformLabel}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyFullDraft}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-stone-900 text-[#FBF9F5] hover:bg-stone-800 dark:bg-[#E4E2DD] dark:text-[#0D0D10] dark:hover:bg-white cursor-pointer whitespace-nowrap shrink-0"
                        >
                          {copiedFull ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-700" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedFull ? 'Draf Disalin' : 'Salin Draf Lengkap'}</span>
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <h4 className="text-xs font-semibold text-red-700 dark:text-red-400">
                          01. Hook Pembuka
                        </h4>
                        <p className="font-serif text-lg text-stone-900 dark:text-zinc-100 leading-relaxed">
                          “{copySuggestion.hook}”
                        </p>
                      </div>

                      <div className="space-y-3 pt-2 border-t border-stone-200 dark:border-zinc-800">
                        <h4 className="text-xs font-semibold text-stone-500 dark:text-zinc-400">
                          02. Struktur Isi Konten
                        </h4>
                        <div className="divide-y divide-stone-200 dark:divide-zinc-800">
                          {copySuggestion.structureSteps.map((step, i) => (
                            <div key={i} className="py-3 first:pt-0 last:pb-0 space-y-1">
                              <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-zinc-400">
                                <span className="font-mono font-medium text-stone-800 dark:text-zinc-200 tabular-nums">
                                  {step.stepNumber}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-medium">{step.partLabel}</span>
                              </div>
                              <p className="text-sm text-stone-700 dark:text-zinc-300 leading-relaxed">
                                {step.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-3 border-t border-stone-200 dark:border-zinc-800">
                        <h4 className="text-xs font-semibold text-stone-500 dark:text-zinc-400">
                          03. Call-to-Action (CTA)
                        </h4>
                        <p className="text-sm text-stone-800 dark:text-zinc-200 leading-relaxed">
                          {copySuggestion.cta}
                        </p>
                      </div>

                      <div className="space-y-1.5 pt-3 border-t border-stone-200 dark:border-zinc-800">
                        <h4 className="text-xs font-semibold text-stone-500 dark:text-zinc-400">
                          Rekomendasi Tagar &amp; Tip Eksekusi
                        </h4>
                        <p className="font-mono text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
                          {copySuggestion.hashtags.join(' ')}
                        </p>
                        <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed pt-1">
                          Tip: {copySuggestion.postingTip}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'bagikan' && (
              <div className="p-5 sm:p-6 rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#18181E] space-y-5">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                    Bagikan Berita &amp; Rangkuman
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-zinc-400">
                    Kirim langsung ke jejaring sosial atau salin ringkasan untuk dibagikan ke tim Anda.
                  </p>
                </div>

                <ShareBar
                  title={article.title}
                  summary={summary?.tldr || article.excerpt}
                  url={safeSourceUrl}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
