import { Check, Copy, ExternalLink, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { sanitizeExternalUrl } from '../lib/categories';
import type { AIPersonaId, CopyTone, SocialPlatform } from '../types/news';

interface PersonalAIHandoffProps {
  mode: 'summarize' | 'copywrite';
  title: string;
  contextText: string;
  sourceUrl?: string;
  persona?: AIPersonaId;
  platform?: SocialPlatform;
  tone?: CopyTone;
}

const PERSONA_LABELS: Record<AIPersonaId, string> = {
  jurnalis: 'Jurnalis Ringkas (objektif, padat 5W+1H)',
  kreator: 'Kreator Konten (hook menarik, storytelling ringan)',
  bisnis: 'Analis Bisnis (fokus dampak pasar & strategis)',
  peneliti: 'Asisten Riset (mendalam & berbasis konteks data)',
};

const PLATFORM_NAMES: Record<SocialPlatform, string> = {
  instagram: 'Instagram Carousel & Caption',
  x_thread: 'X / Twitter Thread',
  linkedin: 'LinkedIn Insight Post',
  tiktok: 'Script Video TikTok / Reels',
};

export function PersonalAIHandoff({
  mode,
  title,
  contextText,
  sourceUrl,
  persona = 'jurnalis',
  platform = 'instagram',
  tone = 'informatif',
}: PersonalAIHandoffProps) {
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

  const safeUrl = sanitizeExternalUrl(sourceUrl);

  const builtPrompt = useMemo(() => {
    const trimmedContext = contextText.trim().slice(0, 1400);
    if (mode === 'summarize') {
      return [
        `Bertindaklah sebagai ${PERSONA_LABELS[persona]}.`,
        `Tolong rangkum berita berikut dalam Bahasa Indonesia yang jernih:`,
        `Judul: ${title}`,
        safeUrl ? `Sumber: ${safeUrl}` : '',
        trimmedContext ? `Konteks: ${trimmedContext}` : '',
        `Berikan output: (1) Inti Berita 2 kalimat, (2) 3-4 Poin Kunci, dan (3) Dampak & Konteks ke depan.`,
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    return [
      `Bertindaklah sebagai ${PERSONA_LABELS[persona]} dan copywriter media sosial.`,
      `Buatkan struktur copywriting siap unggah dalam Bahasa Indonesia untuk platform ${PLATFORM_NAMES[platform]} dengan tone ${tone}:`,
      `Judul Berita: ${title}`,
      trimmedContext ? `Ringkasan/Konteks: ${trimmedContext}` : '',
      safeUrl ? `Referensi: ${safeUrl}` : '',
      `Berikan output terstruktur: (1) Hook Pembuka, (2) Struktur Isi per bagian/slide, (3) CTA, (4) Hashtag relevan, dan (5) Draf utuh siap salin.`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }, [mode, title, contextText, safeUrl, persona, platform, tone]);

  const encodedPrompt = encodeURIComponent(builtPrompt);

  const aiDestinations = [
    {
      id: 'chatgpt',
      label: 'ChatGPT',
      href: `https://chatgpt.com/?q=${encodedPrompt}`,
      supportsQueryPrefill: true,
    },
    {
      id: 'claude',
      label: 'Claude',
      href: `https://claude.ai/new?q=${encodedPrompt}`,
      supportsQueryPrefill: true,
    },
    {
      id: 'perplexity',
      label: 'Perplexity',
      href: `https://www.perplexity.ai/search?q=${encodedPrompt}`,
      supportsQueryPrefill: true,
    },
    {
      id: 'grok',
      label: 'Grok',
      href: `https://x.com/i/grok?text=${encodedPrompt}`,
      supportsQueryPrefill: true,
    },
    {
      id: 'gemini_web',
      label: 'Gemini Web',
      href: 'https://gemini.google.com/app',
      supportsQueryPrefill: false,
    },
    {
      id: 'copilot',
      label: 'Copilot',
      href: 'https://copilot.microsoft.com/',
      supportsQueryPrefill: false,
    },
  ];

  async function handleCopyPrompt(label: string) {
    try {
      await navigator.clipboard.writeText(builtPrompt);
      setCopiedPlatform(label);
      setTimeout(() => setCopiedPlatform(null), 2500);
    } catch {
      // Clipboard denied
    }
  }

  return (
    <div className="p-4 sm:p-5 rounded-lg border border-stone-200 dark:border-zinc-800 bg-stone-50/80 dark:bg-[#15151A] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-red-700 dark:text-red-400" aria-hidden="true" />
          <h4 className="text-xs font-semibold text-stone-900 dark:text-zinc-100">
            Integrasi Langsung ke Personal AI Anda
          </h4>
        </div>
        <button
          type="button"
          onClick={() => void handleCopyPrompt('prompt')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 dark:text-zinc-300 hover:text-stone-950 dark:hover:text-white cursor-pointer"
        >
          {copiedPlatform === 'prompt' ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          ) : (
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>{copiedPlatform === 'prompt' ? 'Prompt Disalin' : 'Salin Prompt'}</span>
        </button>
      </div>

      <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed">
        Kirim konteks berita ini langsung ke asisten AI pribadi pilihan Anda dengan satu klik tanpa batasan kuota.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {aiDestinations.map((dest) => (
          <a
            key={dest.id}
            href={dest.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              void handleCopyPrompt(dest.label);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#1C1C22] text-stone-800 dark:text-zinc-200 hover:border-stone-400 dark:hover:border-zinc-600 transition-colors whitespace-nowrap shrink-0"
          >
            <span>{dest.label}</span>
            <ExternalLink className="w-3 h-3 text-stone-400 dark:text-zinc-500" aria-hidden="true" />
          </a>
        ))}
      </div>

      {copiedPlatform && copiedPlatform !== 'prompt' && (
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
          Prompt terstruktur disalin ke clipboard — siap digunakan di {copiedPlatform}.
        </p>
      )}
    </div>
  );
}
