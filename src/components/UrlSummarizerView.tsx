import { Check, Copy, ExternalLink, Link2, Loader2, PenTool } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { sanitizeExternalUrl } from '../lib/categories';
import type {
  AIPersonaId,
  AIProviderId,
  AIProviderStatus,
  AISummary,
  CopyTone,
  CopywritingSuggestion,
  SocialPlatform,
} from '../types/news';
import { PersonalAIHandoff } from './PersonalAIHandoff';
import { ShareBar } from './ShareBar';

interface UrlSummarizerViewProps {
  providers: AIProviderStatus[];
  selectedProvider: AIProviderId;
  selectedPersona: AIPersonaId;
  onChangeProvider: (provider: AIProviderId) => void;
  onChangePersona: (persona: AIPersonaId) => void;
}

export function UrlSummarizerView({
  providers,
  selectedProvider,
  selectedPersona,
  onChangeProvider,
  onChangePersona,
}: UrlSummarizerViewProps) {
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url');
  const [urlValue, setUrlValue] = useState('');
  const [textValue, setTextValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaHit, setQuotaHit] = useState(false);
  const [summary, setSummary] = useState<AISummary | null>(null);

  const [platform, setPlatform] = useState<SocialPlatform>('instagram');
  const [tone, setTone] = useState<CopyTone>('informatif');
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyQuotaHit, setCopyQuotaHit] = useState(false);
  const [copyResult, setCopyResult] = useState<CopywritingSuggestion | null>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);

  async function runSummarize(providerOverride: AIProviderId = selectedProvider) {
    setError(null);
    setQuotaHit(false);
    setSummary(null);
    setCopyResult(null);

    if (inputMode === 'url' && !urlValue.trim()) {
      setError('Masukkan tautan artikel berita yang valid.');
      return;
    }
    if (inputMode === 'text' && textValue.trim().length < 20) {
      setError('Masukkan minimal 20 karakter teks berita untuk dirangkum.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          inputMode === 'url'
            ? {
                url: urlValue.trim(),
                provider: providerOverride,
                persona: selectedPersona,
              }
            : {
                text: textValue.trim(),
                article: { title: 'Artikel Kustom' },
                provider: providerOverride,
                persona: selectedPersona,
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setQuotaHit(Boolean(data?.quotaExceeded) || res.status === 429);
        throw new Error(data?.error || 'Gagal merangkum konten.');
      }
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat merangkum.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void runSummarize(selectedProvider);
  }

  async function handleGenerateCopy(
    targetPlatform: SocialPlatform,
    targetTone: CopyTone,
    providerOverride: AIProviderId = selectedProvider
  ) {
    if (!summary) return;
    setCopyLoading(true);
    setCopyQuotaHit(false);
    setError(null);
    try {
      const res = await fetch('/api/ai/copywrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: summary.articleTitle,
          summary: `${summary.tldr} ${summary.keyPoints.join(' ')}`,
          sourceName: summary.verifiedUrl || 'Tautan Eksternal',
          url: summary.verifiedUrl || '',
          platform: targetPlatform,
          tone: targetTone,
          provider: providerOverride,
          persona: selectedPersona,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCopyQuotaHit(Boolean(data?.quotaExceeded) || res.status === 429);
        throw new Error(data?.error || 'Gagal menyusun copywriting.');
      }
      setCopyResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyusun struktur copywriting.');
    } finally {
      setCopyLoading(false);
    }
  }

  async function handleCopyDraft() {
    if (!copyResult) return;
    try {
      await navigator.clipboard.writeText(copyResult.fullDraft);
      setCopiedDraft(true);
      setTimeout(() => setCopiedDraft(false), 2000);
    } catch {
      // Ignore
    }
  }

  const activeTitle = summary?.articleTitle || (inputMode === 'url' ? urlValue.trim() : 'Artikel Berita');
  const activeContext =
    summary?.tldr || (inputMode === 'text' ? textValue.trim() : urlValue.trim());

  return (
    <section className="py-10 max-w-3xl mx-auto space-y-8">
      <div className="space-y-2 border-b border-stone-200 dark:border-zinc-800 pb-6">
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-stone-900 dark:text-[#F2F0EB] headline-balance">
          Ringkas Tautan &amp; Studio Copywriting
        </h1>
        <p className="text-sm sm:text-base text-stone-600 dark:text-zinc-400 leading-relaxed">
          Tempel tautan atau teks artikel untuk dirangkum dengan mesin AI pilihan Anda, atau kirim langsung ke Personal AI seperti ChatGPT, Claude, Perplexity, dan Gemini.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-5 sm:p-6 rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#141418] space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setInputMode('url')}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                inputMode === 'url'
                  ? 'bg-stone-900 text-[#FBF9F5] dark:bg-[#E4E2DD] dark:text-[#0D0D10]'
                  : 'border border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-zinc-400'
              }`}
            >
              Ringkas dari URL
            </button>
            <button
              type="button"
              onClick={() => setInputMode('text')}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                inputMode === 'text'
                  ? 'bg-stone-900 text-[#FBF9F5] dark:bg-[#E4E2DD] dark:text-[#0D0D10]'
                  : 'border border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-zinc-400'
              }`}
            >
              Tempel Teks Artikel
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              aria-label="Pilih mesin AI"
              value={selectedProvider}
              onChange={(e) => onChangeProvider(e.target.value as AIProviderId)}
              className="h-9 px-2.5 text-xs rounded-md border border-stone-200 dark:border-zinc-700 bg-[#FBF9F5] dark:bg-[#1A1A20] text-stone-800 dark:text-zinc-200"
            >
              <option value="auto">Otomatis (Anti-Kuota)</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.configured}>
                  {p.label} {p.configured ? '' : '(Belum diatur)'}
                </option>
              ))}
              <option value="local">Ekstraktif Lokal (Tanpa Kuota)</option>
            </select>

            <select
              aria-label="Pilih persona AI"
              value={selectedPersona}
              onChange={(e) => onChangePersona(e.target.value as AIPersonaId)}
              className="h-9 px-2.5 text-xs rounded-md border border-stone-200 dark:border-zinc-700 bg-[#FBF9F5] dark:bg-[#1A1A20] text-stone-800 dark:text-zinc-200"
            >
              <option value="jurnalis">Persona: Jurnalis</option>
              <option value="kreator">Persona: Kreator</option>
              <option value="bisnis">Persona: Analis Bisnis</option>
              <option value="peneliti">Persona: Riset</option>
            </select>
          </div>
        </div>

        {inputMode === 'url' ? (
          <div className="space-y-2">
            <label
              htmlFor="custom-news-url"
              className="block text-xs font-semibold text-stone-700 dark:text-zinc-300"
            >
              URL Artikel Berita
            </label>
            <div className="relative">
              <Link2
                className="w-4 h-4 text-stone-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="custom-news-url"
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="https://www.kompas.com/..."
                className="w-full h-11 pl-10 pr-4 text-sm rounded-md bg-[#FBF9F5] dark:bg-[#1A1A20] border border-stone-200 dark:border-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-stone-500"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label
              htmlFor="custom-news-text"
              className="block text-xs font-semibold text-stone-700 dark:text-zinc-300"
            >
              Teks Artikel
            </label>
            <textarea
              id="custom-news-text"
              rows={6}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Tempel isi artikel berita di sini..."
              className="w-full p-3.5 text-sm rounded-md bg-[#FBF9F5] dark:bg-[#1A1A20] border border-stone-200 dark:border-zinc-800 text-stone-900 dark:text-zinc-100 placeholder:text-stone-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-stone-500"
            />
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-md border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 space-y-2">
            <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
            {(quotaHit || copyQuotaHit) && (
              <div className="flex flex-wrap gap-2">
                {quotaHit && (
                  <button
                    type="button"
                    onClick={() => void runSummarize('local')}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-900 text-[#FBF9F5] dark:bg-[#E4E2DD] dark:text-[#0D0D10] cursor-pointer"
                  >
                    Ringkas Ekstraktif Lokal (Tanpa Kuota)
                  </button>
                )}
                {copyQuotaHit && summary && (
                  <button
                    type="button"
                    onClick={() => void handleGenerateCopy(platform, tone, 'local')}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-900 text-[#FBF9F5] dark:bg-[#E4E2DD] dark:text-[#0D0D10] cursor-pointer"
                  >
                    Susun Template Lokal (Tanpa Kuota)
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 text-xs sm:text-sm font-medium rounded-md bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500 disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            <span>{loading ? 'Sedang Merangkum...' : 'Buat Rangkuman AI'}</span>
          </button>
        </div>
      </form>

      {(urlValue.trim() || textValue.trim()) && (
        <PersonalAIHandoff
          mode={summary ? 'copywrite' : 'summarize'}
          title={activeTitle}
          contextText={activeContext}
          sourceUrl={inputMode === 'url' ? urlValue.trim() : summary?.verifiedUrl}
          persona={selectedPersona}
          platform={platform}
          tone={tone}
        />
      )}

      {summary && (
        <div className="space-y-6">
          <div className="p-6 rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#141418] space-y-5">
            <div className="space-y-1 pb-3 border-b border-stone-200 dark:border-zinc-800">
              <span className="font-mono text-xs text-stone-500 dark:text-zinc-400 tabular-nums">
                {summary.readingTimeOriginal} → {summary.readingTimeSaved} ·{' '}
                {summary.engineUsed || summary.toneLabel}
              </span>
              <h2 className="font-serif text-2xl font-semibold text-stone-900 dark:text-[#F2F0EB]">
                {summary.articleTitle}
              </h2>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-stone-500 dark:text-zinc-400">
                Inti Berita
              </h3>
              <p className="text-base text-stone-800 dark:text-[#E4E2DD] leading-relaxed">
                {summary.tldr}
              </p>
            </div>

            {summary.keyPoints.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-stone-500 dark:text-zinc-400">
                  Poin Kunci
                </h3>
                <ul className="space-y-2">
                  {summary.keyPoints.map((pt, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm text-stone-700 dark:text-zinc-300 leading-relaxed"
                    >
                      <span className="font-mono text-xs text-red-700 dark:text-red-400 tabular-nums pt-0.5">
                        0{i + 1}.
                      </span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.groundedSources && summary.groundedSources.length > 0 && (
              <div className="pt-4 border-t border-stone-200 dark:border-zinc-800 space-y-2">
                <h3 className="text-xs font-semibold text-stone-500 dark:text-zinc-400">
                  Sumber Google Search Terverifikasi
                </h3>
                <div className="divide-y divide-stone-200/70 dark:divide-zinc-800/80 border border-stone-200 dark:border-zinc-800 rounded-md">
                  {summary.groundedSources.map((src, idx) => {
                    const url = sanitizeExternalUrl(src.url);
                    if (!url) return null;
                    return (
                      <a
                        key={`${url}-${idx}`}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 flex items-center justify-between gap-3 text-xs hover:bg-stone-50 dark:hover:bg-zinc-900/60 transition-colors"
                      >
                        <span className="text-stone-800 dark:text-zinc-200 truncate">
                          {src.title}
                        </span>
                        <ExternalLink
                          className="w-3 h-3 text-stone-400 dark:text-zinc-500 shrink-0"
                          aria-hidden="true"
                        />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-stone-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Pilih platform media sosial"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
                  className="h-9 px-3 text-xs rounded-md border border-stone-200 dark:border-zinc-700 bg-[#FBF9F5] dark:bg-[#1A1A20] text-stone-800 dark:text-zinc-200"
                >
                  <option value="instagram">Instagram Carousel</option>
                  <option value="x_thread">X Thread</option>
                  <option value="linkedin">LinkedIn Insight</option>
                  <option value="tiktok">TikTok / Reels Script</option>
                </select>
                <select
                  aria-label="Pilih gaya bahasa"
                  value={tone}
                  onChange={(e) => setTone(e.target.value as CopyTone)}
                  className="h-9 px-3 text-xs rounded-md border border-stone-200 dark:border-zinc-700 bg-[#FBF9F5] dark:bg-[#1A1A20] text-stone-800 dark:text-zinc-200"
                >
                  <option value="informatif">Informatif</option>
                  <option value="santai">Santai</option>
                  <option value="kritis">Kritis</option>
                  <option value="storytelling">Storytelling</option>
                </select>
                <button
                  type="button"
                  onClick={() => void handleGenerateCopy(platform, tone, selectedProvider)}
                  disabled={copyLoading}
                  className="h-9 px-4 text-xs font-medium rounded-md bg-stone-900 text-[#FBF9F5] hover:bg-stone-800 dark:bg-[#E4E2DD] dark:text-[#0D0D10] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <PenTool className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{copyLoading ? 'Menyusun...' : 'Buat Struktur Copywriting'}</span>
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-stone-200 dark:border-zinc-800">
              <ShareBar
                title={summary.articleTitle}
                summary={summary.tldr}
                url={summary.verifiedUrl}
              />
            </div>
          </div>

          {copyResult && (
            <div className="p-6 rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#141418] space-y-5">
              <div className="flex items-center justify-between gap-4 pb-3 border-b border-stone-200 dark:border-zinc-800">
                <div>
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
                    {copyResult.platformLabel}
                  </h3>
                  {copyResult.engineUsed && (
                    <span className="font-mono text-[11px] text-stone-500 dark:text-zinc-400">
                      {copyResult.engineUsed}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleCopyDraft}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-stone-900 text-[#FBF9F5] dark:bg-[#E4E2DD] dark:text-[#0D0D10] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedDraft ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDraft ? 'Disalin' : 'Salin Draf'}</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                  Hook Pembuka
                </span>
                <p className="font-serif text-lg text-stone-900 dark:text-zinc-100">
                  “{copyResult.hook}”
                </p>
              </div>

              <div className="divide-y divide-stone-200 dark:divide-zinc-800">
                {copyResult.structureSteps.map((s, i) => (
                  <div key={i} className="py-3 space-y-1">
                    <p className="font-mono text-xs text-stone-500 dark:text-zinc-400">
                      {s.stepNumber} · {s.partLabel}
                    </p>
                    <p className="text-sm text-stone-700 dark:text-zinc-300 leading-relaxed">
                      {s.content}
                    </p>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-stone-200 dark:border-zinc-800 space-y-1.5">
                <p className="text-sm text-stone-800 dark:text-zinc-200">
                  <strong className="font-semibold">CTA:</strong> {copyResult.cta}
                </p>
                <p className="font-mono text-xs text-stone-500 dark:text-zinc-400">
                  {copyResult.hashtags.join(' ')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
