import { Check, Copy, ExternalLink, Share2 } from 'lucide-react';
import { useState } from 'react';
import { sanitizeExternalUrl } from '../lib/categories';

interface ShareBarProps {
  title: string;
  summary?: string;
  url?: string;
  compact?: boolean;
}

export function ShareBar({ title, summary, url, compact = false }: ShareBarProps) {
  const [copiedKey, setCopiedKey] = useState<'link' | 'brief' | null>(null);

  const safeUrl = sanitizeExternalUrl(url) || (typeof window !== 'undefined' ? window.location.href : '');
  const shareText = summary ? `${title}\n\n${summary}` : title;
  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(safeUrl);
  const encodedTitle = encodeURIComponent(title);

  const platforms = [
    {
      name: 'WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(`${title}\n${summary ? summary + '\n' : ''}${safeUrl}`)}`,
    },
    {
      name: 'X / Twitter',
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    },
    {
      name: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      name: 'Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    },
    {
      name: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      name: 'Threads',
      href: `https://www.threads.net/intent/post?text=${encodeURIComponent(`${title} ${safeUrl}`)}`,
    },
  ];

  async function handleCopy(mode: 'link' | 'brief') {
    const textToCopy =
      mode === 'link'
        ? safeUrl
        : `${title}\n\n${summary || ''}\n\nSumber: ${safeUrl}`.trim();
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedKey(mode);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback ignored
    }
  }

  async function handleNativeShare() {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title,
          text: summary || title,
          url: safeUrl,
        });
      } catch {
        // User cancelled native share
      }
    }
  }

  const supportsNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {platforms.map((platform) => (
          <a
            key={platform.name}
            href={platform.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 rounded-md border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#1A1A20] text-stone-700 dark:text-zinc-200 hover:border-stone-400 dark:hover:border-zinc-600 transition-colors whitespace-nowrap shrink-0 ${
              compact ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-xs font-medium'
            }`}
          >
            <span>{platform.name}</span>
            <ExternalLink className="w-3 h-3 text-stone-400 dark:text-zinc-500" aria-hidden="true" />
          </a>
        ))}

        {supportsNativeShare && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#1A1A20] text-stone-700 dark:text-zinc-200 hover:border-stone-400 dark:hover:border-zinc-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Lainnya</span>
          </button>
        )}
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleCopy('link')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md bg-stone-900 text-[#FBF9F5] hover:bg-stone-800 dark:bg-[#E4E2DD] dark:text-[#0D0D10] dark:hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedKey === 'link' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-700" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{copiedKey === 'link' ? 'Tautan Disalin' : 'Salin Tautan'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopy('brief')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border border-stone-200 dark:border-zinc-800 bg-white dark:bg-[#1A1A20] text-stone-700 dark:text-zinc-200 hover:border-stone-400 dark:hover:border-zinc-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedKey === 'brief' ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{copiedKey === 'brief' ? 'Ringkasan Disalin' : 'Salin Teks Berita'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
