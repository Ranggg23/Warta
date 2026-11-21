import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL_ID = 'gemini-4-hydrogen';

const CATEGORY_LABELS: Record<string, string> = {
  teknologi: 'Teknologi & AI',
  ekonomi: 'Ekonomi & Bisnis',
  nasional: 'Nasional & Kebijakan',
  sains: 'Sains & Iklim',
  budaya: 'Budaya & Gaya Hidup',
  global: 'Global & Geopolitik',
  olahraga: 'Olahraga',
  kesehatan: 'Kesehatan',
};

const CATEGORY_RSS_QUERIES: Record<string, string> = {
  teknologi: 'teknologi OR kecerdasan buatan OR AI OR startup digital',
  ekonomi: 'ekonomi OR bisnis OR IHSG OR rupiah OR investasi',
  nasional: 'kebijakan pemerintah OR nasional Indonesia OR DPR OR publik',
  sains: 'sains OR riset OR perubahan iklim OR energi terbarukan',
  budaya: 'budaya OR desain OR arsitektur OR gaya hidup OR kuliner',
  global: 'berita internasional OR geopolitik OR global',
  olahraga: 'sepak bola OR bulu tangkis OR olahraga timnas',
  kesehatan: 'kesehatan OR medis OR rumah sakit OR gizi',
};

const PERSONA_PROMPTS: Record<string, { label: string; instruction: string }> = {
  jurnalis: {
    label: 'Jurnalis Ringkas',
    instruction:
      'Gaya Asisten Jurnalis: objektif, netral, padat fakta, menekankan unsur 5W+1H dan akurasi sumber.',
  },
  kreator: {
    label: 'Kreator Konten',
    instruction:
      'Gaya Asisten Kreator Konten: fokus pada sudut pandang menarik, daya tarik audiens, storytelling ringan, dan potensi viralitas yang etis.',
  },
  bisnis: {
    label: 'Analis Bisnis',
    instruction:
      'Gaya Analis Bisnis & Eksekutif: fokus pada dampak pasar, peluang industri, risiko ekonomi, dan implikasi strategis.',
  },
  peneliti: {
    label: 'Asisten Riset',
    instruction:
      'Gaya Asisten Riset: mendalam, sistematis, menyoroti konteks latar belakang, data pendukung, dan pertanyaan lanjutan.',
  },
};

interface GroundedSource {
  title: string;
  url: string;
}

interface TrendingKeyword {
  keyword: string;
  count: number;
}

interface ServerNewsArticle {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  categoryLabel: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  relativeTime: string;
  readMinutes: number;
  isBreaking?: boolean;
  keywords?: string[];
  groundedSources?: GroundedSource[];
}

interface CacheEntry {
  articles: ServerNewsArticle[];
  trendingKeywords: TrendingKeyword[];
  groundedSources: GroundedSource[];
  webSearchQueries: string[];
  fetchedAt: string;
  expiresAt: number;
}

interface SseClient {
  id: string;
  res: Response;
  categories: string[];
}

const newsCache = new Map<string, CacheEntry>();
const sseClients = new Set<SseClient>();
const seenBreakingIds = new Set<string>();
const recentNotifications: Array<{ id: string; article: ServerNewsArticle; receivedAt: string }> = [];

function isConfiguredSecret(val: string | undefined, placeholder?: string): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  return trimmed.length > 5 && trimmed !== placeholder;
}

function getConfiguredProviders() {
  return [
    {
      id: 'gemini',
      label: 'Google Gemini',
      modelLabel: GEMINI_MODEL_ID,
      configured: isConfiguredSecret(process.env.GEMINI_API_KEY, 'MY_GEMINI_API_KEY'),
    },
    {
      id: 'groq',
      label: 'Groq (Llama 3.3)',
      modelLabel: 'llama-3.3-70b-versatile',
      configured: isConfiguredSecret(process.env.GROQ_API_KEY),
    },
    {
      id: 'openai',
      label: 'OpenAI (GPT-4o Mini)',
      modelLabel: 'gpt-4o-mini',
      configured: isConfiguredSecret(process.env.OPENAI_API_KEY),
    },
    {
      id: 'anthropic',
      label: 'Anthropic (Claude Haiku)',
      modelLabel: 'claude-3-5-haiku-latest',
      configured: isConfiguredSecret(process.env.ANTHROPIC_API_KEY),
    },
  ];
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!isConfiguredSecret(apiKey, 'MY_GEMINI_API_KEY')) {
    throw new Error(
      'GEMINI_API_KEY belum dikonfigurasi. Silakan atur API key di panel Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey: apiKey!.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sanitizeHttpUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

function validateExternalUrlForServer(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string') {
    throw new Error('URL tidak valid.');
  }
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Format URL tidak valid. Pastikan diawali http:// atau https://.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Hanya protokol http:// dan https:// yang diizinkan.');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    /^169\.254\./.test(hostname)
  ) {
    throw new Error('URL alamat lokal atau jaringan privat tidak diizinkan.');
  }
  return parsed.toString();
}

function extractJsonBlock(rawText: string): unknown {
  const trimmed = rawText.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const firstBracket = candidate.indexOf('[');
    const lastBracket = candidate.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      return JSON.parse(candidate.slice(firstBracket, lastBracket + 1));
    }
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('Respons model tidak dapat diuraikan sebagai JSON.');
  }
}

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('429') ||
    msg.toLowerCase().includes('quota') ||
    msg.toLowerCase().includes('rate limit')
  );
}

function formatErrorResponse(err: unknown): {
  status: number;
  message: string;
  quotaExceeded: boolean;
} {
  const msg = err instanceof Error ? err.message : 'Terjadi kesalahan pada server.';
  if (msg.includes('GEMINI_API_KEY') || msg.includes('belum dikonfigurasi')) {
    return { status: 400, message: msg, quotaExceeded: false };
  }
  if (msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID') || msg.includes('403')) {
    return {
      status: 403,
      message: 'API key AI tidak valid atau ditolak. Periksa Settings > Secrets.',
      quotaExceeded: false,
    };
  }
  if (isQuotaError(err)) {
    return {
      status: 429,
      message:
        'Batas kuota permintaan AI saat ini tercapai. Anda dapat langsung melanjutkan ke Personal AI pilihan Anda atau gunakan Ringkasan Ekstraktif Lokal tanpa kuota.',
      quotaExceeded: true,
    };
  }
  return { status: 500, message: msg, quotaExceeded: false };
}

function slugifyId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);
}

const STOPWORDS = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'pada', 'dengan', 'ini', 'itu',
  'akan', 'dalam', 'adalah', 'oleh', 'atau', 'juga', 'bisa', 'dapat', 'karena',
  'saat', 'hari', 'tahun', 'baru', 'lebih', 'masih', 'sudah', 'telah', 'bahwa',
  'sebagai', 'hingga', 'sampai', 'antara', 'agar', 'namun', 'tetapi', 'seperti',
  'berita', 'terbaru', 'terkini', 'laporan', 'indonesia', 'global', 'dunia',
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'over', 'after',
  'pemerintah', 'masyarakat', 'perusahaan', 'pengguna', 'melalui', 'menjadi',
  'secara', 'terhadap', 'kepada', 'tidak', 'belum', 'banyak', 'semua', 'mulai',
  'ungkap', 'sebut', 'bukan', 'hanya', 'cara', 'kenali', 'simak', 'berikut',
  'kompas', 'detik', 'tribunnews', 'cnn', 'cnbc', 'tempo', 'viva', 'antara',
]);

function extractTopTrendingKeywords(articles: ServerNewsArticle[]): TrendingKeyword[] {
  if (articles.length === 0) return [];
  const scoreMap = new Map<string, { display: string; count: number; articleHits: Set<string> }>();

  const registerTerm = (raw: string, articleId: string, weight: number) => {
    const cleaned = raw.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned || cleaned.length < 3) return;
    const lower = cleaned.toLowerCase();
    if (STOPWORDS.has(lower)) return;
    const words = lower.split(' ');
    if (words.length > 3 || words.every((w) => STOPWORDS.has(w))) return;

    const existing = scoreMap.get(lower);
    if (existing) {
      existing.count += weight;
      existing.articleHits.add(articleId);
    } else {
      scoreMap.set(lower, {
        display: cleaned,
        count: weight,
        articleHits: new Set([articleId]),
      });
    }
  };

  for (const article of articles) {
    if (Array.isArray(article.keywords)) {
      for (const kw of article.keywords) {
        if (typeof kw === 'string') registerTerm(kw, article.id, 3);
      }
    }

    // Bigram phrases of capitalized words in titles (e.g. "Bank Indonesia", "Kecerdasan Buatan")
    const rawTokens = article.title
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);

    for (let i = 0; i < rawTokens.length - 1; i++) {
      const a = rawTokens[i];
      const b = rawTokens[i + 1];
      if (
        a.length >= 3 &&
        b.length >= 3 &&
        /^[A-Z]/.test(a) &&
        /^[A-Z]/.test(b) &&
        !STOPWORDS.has(a.toLowerCase()) &&
        !STOPWORDS.has(b.toLowerCase())
      ) {
        registerTerm(`${a} ${b}`, article.id, 2.5);
      }
    }

    for (const w of rawTokens) {
      if (w.length >= 4 && !STOPWORDS.has(w.toLowerCase())) {
        registerTerm(w, article.id, 1);
      }
    }
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => {
      if (b.articleHits.size !== a.articleHits.size) {
        return b.articleHits.size - a.articleHits.size;
      }
      return b.count - a.count;
    })
    .slice(0, 5)
    .map((entry) => ({
      keyword: entry.display,
      count: entry.articleHits.size,
    }));
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function formatRelativeTimeId(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMins < 60) return `${diffMins} menit lalu`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Kemarin';
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function inferCategoryFromText(text: string, fallbackCategory: string): string {
  const lower = text.toLowerCase();
  if (/(ai|kecerdasan buatan|teknologi|aplikasi|digital|cyber|semikonduktor|startup|software|google|apple|microsoft)/.test(lower)) {
    return 'teknologi';
  }
  if (/(ihsg|rupiah|ekonomi|saham|investasi|bank|inflasi|bisnis|pajak|ekspor|umkm)/.test(lower)) {
    return 'ekonomi';
  }
  if (/(iklim|energi|sains|peneliti|antariksa|bmkg|hujan|polusi|mikroplastik|lingkungan)/.test(lower)) {
    return 'sains';
  }
  if (/(jantung|kesehatan|dokter|dbd|rumah sakit|medis|gizi|obat|penyakit|kemenkes)/.test(lower)) {
    return 'kesehatan';
  }
  if (/(timnas|sepak bola|liga|bulu tangkis|atlet|olahraga|turnamen|juara)/.test(lower)) {
    return 'olahraga';
  }
  if (/(budaya|film|musik|arsitektur|kuliner|wisata|seni|desain|festival)/.test(lower)) {
    return 'budaya';
  }
  if (/(eropa|amerika|china|pbb|geopolitik|timur tengah|asean|internasional)/.test(lower)) {
    return 'global';
  }
  return fallbackCategory in CATEGORY_LABELS ? fallbackCategory : 'nasional';
}

async function fetchGoogleNewsRssFeed(
  rssUrl: string,
  fallbackCategory: string
): Promise<ServerNewsArticle[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(rssUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WartaKini/1.0)',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
    });
    if (!res.ok) {
      throw new Error(`Google News RSS mengembalikan status ${res.status}`);
    }
    const xml = await res.text();
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    const results: ServerNewsArticle[] = [];

    for (let idx = 0; idx < itemMatches.length; idx++) {
      const block = itemMatches[idx];
      const rawTitle = decodeHtmlEntities(
        block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''
      ).trim();
      const rawLink = decodeHtmlEntities(
        block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? ''
      ).trim();
      const rawPubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '').trim();
      const rawSource = decodeHtmlEntities(
        block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? ''
      ).trim();
      const rawDesc = decodeHtmlEntities(
        block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? ''
      );

      if (!rawTitle) continue;

      let sourceName = rawSource;
      let cleanTitle = rawTitle;
      if (sourceName && cleanTitle.endsWith(` - ${sourceName}`)) {
        cleanTitle = cleanTitle.slice(0, -(` - ${sourceName}`).length).trim();
      } else {
        const dashIdx = cleanTitle.lastIndexOf(' - ');
        if (dashIdx > 12) {
          sourceName = sourceName || cleanTitle.slice(dashIdx + 3).trim();
          cleanTitle = cleanTitle.slice(0, dashIdx).trim();
        }
      }
      sourceName = sourceName || 'Google News';

      // Extract related cluster headlines from Google News <description> HTML
      const relatedSources: GroundedSource[] = [];
      const relatedTitles: string[] = [];
      const anchorRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>(?:[\s\S]*?<font[^>]*>([\s\S]*?)<\/font>)?/g;
      let m: RegExpExecArray | null;
      while ((m = anchorRegex.exec(rawDesc)) !== null) {
        const href = sanitizeHttpUrl(m[1]);
        const anchorText = m[2].replace(/<[^>]+>/g, '').trim();
        const mediaText = (m[3] ?? '').replace(/<[^>]+>/g, '').trim();
        if (href && anchorText) {
          relatedSources.push({
            title: mediaText ? `${anchorText} (${mediaText})` : anchorText,
            url: href,
          });
          if (anchorText.toLowerCase() !== cleanTitle.toLowerCase()) {
            relatedTitles.push(mediaText ? `${anchorText} — ${mediaText}` : anchorText);
          }
        }
      }

      const verifiedLink = sanitizeHttpUrl(rawLink) || relatedSources[0]?.url || '';
      const pubDateObj = rawPubDate ? new Date(rawPubDate) : new Date();
      const validDate = Number.isNaN(pubDateObj.getTime()) ? new Date() : pubDateObj;
      const inferredCategory = inferCategoryFromText(
        `${cleanTitle} ${relatedTitles.join(' ')}`,
        fallbackCategory
      );

      const excerpt =
        relatedTitles.length > 0
          ? `Dilaporkan oleh ${sourceName}. Sorotan terkait: ${relatedTitles.slice(0, 2).join('; ')}.`
          : `Laporan terbaru dari ${sourceName} yang terindeks di Google News hari ini.`;

      const contentParagraphs = [
        `${cleanTitle} — Laporan ini diterbitkan oleh ${sourceName} (${validDate.toLocaleString('id-ID', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}).`,
      ];
      if (relatedTitles.length > 0) {
        contentParagraphs.push(
          `Liputan sudut pandang terkait dari jaringan Google News:\n• ${relatedTitles.slice(0, 4).join('\n• ')}`
        );
      } else {
        contentParagraphs.push(
          'Klik tombol "Buat Rangkuman AI" di atas untuk menyusun intisari otomatis atau gunakan integrasi Personal AI untuk pendalaman topik ini.'
        );
      }

      const ageHours = (Date.now() - validDate.getTime()) / 3600000;
      results.push({
        id: `${inferredCategory}-${slugifyId(cleanTitle)}-${idx}`,
        title: cleanTitle,
        excerpt,
        content: contentParagraphs.join('\n\n'),
        category: inferredCategory,
        categoryLabel: CATEGORY_LABELS[inferredCategory] ?? 'Terkini',
        sourceName,
        sourceUrl: verifiedLink,
        publishedAt: validDate.toISOString(),
        relativeTime: formatRelativeTimeId(validDate),
        readMinutes: Math.max(2, Math.min(6, 2 + Math.floor(relatedTitles.length / 2))),
        isBreaking: ageHours <= 3 && idx < 2,
        groundedSources:
          relatedSources.length > 0
            ? relatedSources.slice(0, 4)
            : verifiedLink
              ? [{ title: `${cleanTitle} (${sourceName})`, url: verifiedLink }]
              : [],
      });
    }
    return results;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchLiveNewsFromGoogle(options: {
  categories: string[];
  query: string;
  limit?: number;
}): Promise<{
  articles: ServerNewsArticle[];
  trendingKeywords: TrendingKeyword[];
  groundedSources: GroundedSource[];
  webSearchQueries: string[];
}> {
  const validCategories = options.categories.filter((c) => c in CATEGORY_LABELS);
  const targetLimit = options.limit ?? 12;
  const webSearchQueries: string[] = [];

  let collected: ServerNewsArticle[] = [];

  if (options.query) {
    const q = options.query.trim();
    webSearchQueries.push(q);
    const searchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id`;
    collected = await fetchGoogleNewsRssFeed(searchUrl, validCategories[0] ?? 'nasional');
  } else if (validCategories.length === 1) {
    const cat = validCategories[0];
    const queryStr = CATEGORY_RSS_QUERIES[cat] ?? CATEGORY_LABELS[cat];
    webSearchQueries.push(CATEGORY_LABELS[cat]);
    const searchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(`${queryStr} when:2d`)}&hl=id&gl=ID&ceid=ID:id`;
    collected = await fetchGoogleNewsRssFeed(searchUrl, cat);
    collected = collected.map((a) => ({
      ...a,
      category: cat,
      categoryLabel: CATEGORY_LABELS[cat],
    }));
  } else if (validCategories.length > 1) {
    const selected = validCategories.slice(0, 4);
    const settled = await Promise.allSettled(
      selected.map(async (cat) => {
        const queryStr = CATEGORY_RSS_QUERIES[cat] ?? CATEGORY_LABELS[cat];
        webSearchQueries.push(CATEGORY_LABELS[cat]);
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${queryStr} when:2d`)}&hl=id&gl=ID&ceid=ID:id`;
        const items = await fetchGoogleNewsRssFeed(url, cat);
        return items.slice(0, 4).map((a) => ({
          ...a,
          category: cat,
          categoryLabel: CATEGORY_LABELS[cat],
        }));
      })
    );
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        collected.push(...result.value);
      }
    }
  } else {
    webSearchQueries.push('Google News Indonesia Hari Ini');
    const topUrl = 'https://news.google.com/rss?hl=id&gl=ID&ceid=ID:id';
    collected = await fetchGoogleNewsRssFeed(topUrl, 'nasional');
  }

  // Deduplicate by normalized title and sort newest first
  const seenTitles = new Set<string>();
  const uniqueArticles: ServerNewsArticle[] = [];
  for (const item of collected.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )) {
    const norm = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 48);
    if (!norm || seenTitles.has(norm)) continue;
    seenTitles.add(norm);
    uniqueArticles.push(item);
    if (uniqueArticles.length >= targetLimit) break;
  }

  const seenUrls = new Set<string>();
  const groundedSources: GroundedSource[] = [];
  for (const art of uniqueArticles) {
    const url = sanitizeHttpUrl(art.sourceUrl);
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      groundedSources.push({
        title: `${art.title} — ${art.sourceName}`,
        url,
      });
    }
  }

  const trendingKeywords = extractTopTrendingKeywords(uniqueArticles);

  return {
    articles: uniqueArticles,
    trendingKeywords,
    groundedSources: groundedSources.slice(0, 9),
    webSearchQueries,
  };
}

function buildLocalExtractiveSummary(
  title: string,
  bodyText: string,
  sourceName: string,
  verifiedUrl: string
) {
  const cleanText = bodyText
    .replace(/\s+/g, ' ')
    .replace(/Klik tombol.*$/i, '')
    .trim();
  const rawSentences = cleanText
    .split(/(?<=[.!?])\s+|\s*•\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);

  const tldr =
    rawSentences.slice(0, 2).join(' ') ||
    `${title} — dilaporkan oleh ${sourceName || 'Google News'}.`;

  const keyPoints = rawSentences.slice(0, 4);
  if (keyPoints.length === 0) {
    keyPoints.push(`Topik utama: ${title}.`, `Sumber berita terindeks: ${sourceName || 'Google News'}.`);
  }

  return {
    articleTitle: title,
    tldr,
    keyPoints,
    impactAndContext: `Ringkasan ekstraktif lokal dari teks artikel (${sourceName || 'Google News'}). Untuk analisis mendalam berbasis AI, pilih salah satu Personal AI terintegrasi di bawah.`,
    readingTimeOriginal: '3 menit',
    readingTimeSaved: '15 detik',
    toneLabel: 'Ekstraktif Lokal (Tanpa Kuota)',
    verifiedUrl,
    engineUsed: 'Ekstraktif Lokal (Tanpa Kuota API)',
    isLocalFallback: true,
  };
}

function buildLocalTemplateCopywriting(options: {
  title: string;
  summary: string;
  sourceName: string;
  platform: string;
  tone: string;
}) {
  const platformMap: Record<string, string> = {
    instagram: 'Instagram Carousel & Caption',
    x_thread: 'X / Twitter Thread',
    linkedin: 'LinkedIn Insight Post',
    tiktok: 'TikTok / Reels Script',
  };
  const cleanSummary = options.summary.trim() || options.title;
  const hook = `Sudah lihat kabar terbaru ini? ${options.title}`;
  const steps = [
    {
      stepNumber: '01',
      partLabel: 'Konteks Utama',
      content: `${options.title} — laporan terbaru dari ${options.sourceName || 'media terpercaya'}.`,
    },
    {
      stepNumber: '02',
      partLabel: 'Inti Fakta',
      content: cleanSummary,
    },
    {
      stepNumber: '03',
      partLabel: 'Sudut Pandang Audiens',
      content: 'Mengapa perkembangan ini relevan untuk diperhatikan minggu ini dan apa dampaknya bagi kita?',
    },
  ];
  const cta = 'Menurut kamu bagaimana dampaknya ke depan? Tulis pendapatmu di komentar dan bagikan jika bermanfaat.';
  const hashtags = ['#BeritaTerkini', '#UpdateHarian', '#InfoHariIni', '#WartaKini'];
  const fullDraft = `${hook}\n\n${steps.map((s) => `${s.stepNumber}. ${s.partLabel}: ${s.content}`).join('\n\n')}\n\n${cta}\n\n${hashtags.join(' ')}`;

  return {
    platform: options.platform,
    platformLabel: platformMap[options.platform] ?? platformMap.instagram,
    tone: options.tone,
    hook,
    structureSteps: steps,
    cta,
    hashtags,
    postingTip:
      'Kerangka ini disusun menggunakan template lokal tanpa kuota API. Anda bisa langsung menyempurnakannya di ChatGPT, Claude, atau Gemini Personal.',
    fullDraft,
    engineUsed: 'Template Lokal (Tanpa Kuota API)',
    isLocalFallback: true,
  };
}

async function callOpenAICompatibleJson(options: {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<Record<string, unknown>> {
  const res = await fetch(options.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.userPrompt },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const errMsg = data?.error?.message || `Status ${res.status}`;
    throw new Error(`${res.status}: ${errMsg}`);
  }
  const content = data?.choices?.[0]?.message?.content ?? '{}';
  return extractJsonBlock(content) as Record<string, unknown>;
}

async function callAnthropicJson(options: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<Record<string, unknown>> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': options.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: 1200,
      system: options.systemPrompt,
      messages: [{ role: 'user', content: options.userPrompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const errMsg = data?.error?.message || `Status ${res.status}`;
    throw new Error(`${res.status}: ${errMsg}`);
  }
  const text = data?.content?.[0]?.text ?? '{}';
  return extractJsonBlock(text) as Record<string, unknown>;
}

function resolveProviderOrder(requestedProvider: string): string[] {
  const configured = getConfiguredProviders()
    .filter((p) => p.configured)
    .map((p) => p.id);

  if (requestedProvider && requestedProvider !== 'auto' && requestedProvider !== 'local') {
    if (!configured.includes(requestedProvider)) {
      throw new Error(
        `Provider AI "${requestedProvider}" belum dikonfigurasi di Settings > Secrets.`
      );
    }
    return [requestedProvider];
  }
  return configured;
}

function broadcastBreakingNews(article: ServerNewsArticle) {
  const payload = {
    id: `${article.id}-${Date.now()}`,
    article,
    receivedAt: new Date().toISOString(),
  };

  recentNotifications.unshift(payload);
  if (recentNotifications.length > 25) {
    recentNotifications.pop();
  }

  for (const client of sseClients) {
    const subscribed =
      client.categories.length === 0 || client.categories.includes(article.category);
    if (subscribed) {
      try {
        client.res.write(`event: breaking\ndata: ${JSON.stringify(payload)}\n\n`);
      } catch {
        sseClients.delete(client);
      }
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get('/api/ai/providers', (_req: Request, res: Response) => {
    res.json({
      providers: getConfiguredProviders(),
      personas: Object.entries(PERSONA_PROMPTS).map(([id, info]) => ({
        id,
        label: info.label,
      })),
    });
  });

  app.get('/api/news', async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 140) : '';
      const rawCategories =
        typeof req.query.categories === 'string' ? req.query.categories : '';
      const categories = rawCategories
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c in CATEGORY_LABELS);
      const forceRefresh = req.query.refresh === 'true';

      const cacheKey = `${categories.sort().join('|')}::${q.toLowerCase()}`;
      const cached = newsCache.get(cacheKey);
      if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
        res.json({
          articles: cached.articles,
          trendingKeywords: cached.trendingKeywords,
          groundedSources: cached.groundedSources,
          webSearchQueries: cached.webSearchQueries,
          fetchedAt: cached.fetchedAt,
          cached: true,
        });
        return;
      }

      const { articles, trendingKeywords, groundedSources, webSearchQueries } =
        await fetchLiveNewsFromGoogle({
          categories,
          query: q,
          limit: q ? 10 : 12,
        });

      const fetchedAt = new Date().toISOString();
      newsCache.set(cacheKey, {
        articles,
        trendingKeywords,
        groundedSources,
        webSearchQueries,
        fetchedAt,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      const breakingItem = articles.find((a) => a.isBreaking) ?? articles[0];
      if (breakingItem && !seenBreakingIds.has(breakingItem.id)) {
        seenBreakingIds.add(breakingItem.id);
        recentNotifications.unshift({
          id: `${breakingItem.id}-init`,
          article: breakingItem,
          receivedAt: fetchedAt,
        });
        if (recentNotifications.length > 25) recentNotifications.pop();
      }

      res.json({
        articles,
        trendingKeywords,
        groundedSources,
        webSearchQueries,
        fetchedAt,
        cached: false,
      });
    } catch (err) {
      const { status, message } = formatErrorResponse(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/news/check-breaking', async (req: Request, res: Response) => {
    try {
      const rawCats = Array.isArray(req.body?.categories) ? req.body.categories : [];
      const categories = rawCats.filter(
        (c: unknown): c is string => typeof c === 'string' && c in CATEGORY_LABELS
      );

      const { articles } = await fetchLiveNewsFromGoogle({
        categories,
        query: '',
        limit: 3,
      });

      const fresh = articles.find((a) => !seenBreakingIds.has(a.id)) ?? articles[0];
      if (!fresh) {
        res.json({ notified: false, message: 'Belum ada berita baru saat ini.' });
        return;
      }

      seenBreakingIds.add(fresh.id);
      broadcastBreakingNews({ ...fresh, isBreaking: true });
      res.json({ notified: true, article: fresh });
    } catch (err) {
      const { status, message } = formatErrorResponse(err);
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/notifications/stream', (req: Request, res: Response) => {
    const rawCats = typeof req.query.categories === 'string' ? req.query.categories : '';
    const categories = rawCats
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c in CATEGORY_LABELS);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const client: SseClient = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      res,
      categories,
    };
    sseClients.add(client);

    res.write(
      `event: connected\ndata: ${JSON.stringify({
        clientId: client.id,
        recent: recentNotifications
          .filter(
            (n) => categories.length === 0 || categories.includes(n.article.category)
          )
          .slice(0, 8),
      })}\n\n`
    );

    const heartbeat = setInterval(() => {
      try {
        res.write(`: keepalive ${Date.now()}\n\n`);
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(client);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(client);
    });
  });

  app.post('/api/ai/summarize', async (req: Request, res: Response) => {
    try {
      const requestedProvider =
        typeof req.body?.provider === 'string' ? req.body.provider : 'auto';
      const personaId =
        typeof req.body?.persona === 'string' && req.body.persona in PERSONA_PROMPTS
          ? req.body.persona
          : 'jurnalis';
      const persona = PERSONA_PROMPTS[personaId];

      const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
      const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
      const article = req.body?.article as Partial<ServerNewsArticle> | undefined;

      const sourceTitle = article?.title?.trim() || 'Artikel Berita';
      const safeArticleUrl = rawUrl
        ? validateExternalUrlForServer(rawUrl)
        : sanitizeHttpUrl(article?.sourceUrl);
      const sourceBody =
        rawText ||
        [article?.title, article?.excerpt, article?.content].filter(Boolean).join('\n\n');

      if (!rawUrl && (!sourceBody || sourceBody.length < 15)) {
        res.status(400).json({ error: 'Masukkan teks artikel atau URL berita yang ingin dirangkum.' });
        return;
      }

      if (requestedProvider === 'local') {
        res.json(
          buildLocalExtractiveSummary(
            sourceTitle,
            sourceBody,
            article?.sourceName ?? 'Google News',
            safeArticleUrl
          )
        );
        return;
      }

      const providersToTry = resolveProviderOrder(requestedProvider);
      if (providersToTry.length === 0) {
        res.status(400).json({
          error:
            'Belum ada API key AI yang dikonfigurasi di Settings > Secrets. Gunakan opsi Ekstraktif Lokal atau buka langsung di Personal AI Anda.',
          quotaExceeded: false,
        });
        return;
      }

      const systemPrompt = `Anda adalah asisten berita pribadi (${persona.label}). ${persona.instruction}
Kembalikan HANYA JSON valid dengan field:
{
  "articleTitle": "Judul artikel",
  "tldr": "Inti berita dalam 2 kalimat padat",
  "keyPoints": ["Poin kunci 1", "Poin kunci 2", "Poin kunci 3"],
  "impactAndContext": "Dampak dan konteks berita (1-2 kalimat)",
  "readingTimeOriginal": "4 menit",
  "readingTimeSaved": "30 detik",
  "toneLabel": "${persona.label}"
}`;

      let lastError: unknown = null;

      for (const providerId of providersToTry) {
        try {
          if (providerId === 'gemini') {
            const ai = getGeminiClient();
            if (rawUrl) {
              const response = await ai.models.generateContent({
                model: GEMINI_MODEL_ID,
                contents: `${systemPrompt}\n\nBaca dan rangkum artikel berita dari tautan: ${safeArticleUrl}`,
                config: {
                  tools: [{ urlContext: {} }, { googleSearch: {} }],
                  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                },
              });
              const parsed = extractJsonBlock(response.text ?? '{}') as Record<string, unknown>;
              const summaryChunks =
                response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
              const summarySources: GroundedSource[] = [];
              for (const chunk of summaryChunks) {
                const uri = sanitizeHttpUrl(chunk?.web?.uri);
                const title = typeof chunk?.web?.title === 'string' ? chunk.web.title.trim() : '';
                if (uri && title) summarySources.push({ title, url: uri });
              }
              res.json({
                articleTitle:
                  typeof parsed.articleTitle === 'string' ? parsed.articleTitle : sourceTitle,
                tldr: typeof parsed.tldr === 'string' ? parsed.tldr : '',
                keyPoints: Array.isArray(parsed.keyPoints)
                  ? parsed.keyPoints.filter((k): k is string => typeof k === 'string')
                  : [],
                impactAndContext:
                  typeof parsed.impactAndContext === 'string' ? parsed.impactAndContext : '',
                readingTimeOriginal:
                  typeof parsed.readingTimeOriginal === 'string'
                    ? parsed.readingTimeOriginal
                    : '4 menit',
                readingTimeSaved:
                  typeof parsed.readingTimeSaved === 'string'
                    ? parsed.readingTimeSaved
                    : '30 detik',
                toneLabel:
                  typeof parsed.toneLabel === 'string' ? parsed.toneLabel : persona.label,
                verifiedUrl: safeArticleUrl,
                groundedSources: summarySources.slice(0, 4),
                engineUsed: `Google Gemini (${GEMINI_MODEL_ID})`,
                isLocalFallback: false,
              });
              return;
            }

            const useSearchGrounding = !rawText && Boolean(article?.title);
            const response = await ai.models.generateContent({
              model: GEMINI_MODEL_ID,
              contents: `${systemPrompt}\n\nJudul: ${sourceTitle}\nSumber: ${article?.sourceName ?? 'Google News'}\nKonteks:\n${sourceBody.slice(0, 12000)}`,
              config: useSearchGrounding
                ? {
                    tools: [{ googleSearch: {} }],
                    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                  }
                : {
                    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                    responseMimeType: 'application/json',
                    responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                        articleTitle: { type: Type.STRING },
                        tldr: { type: Type.STRING },
                        keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                        impactAndContext: { type: Type.STRING },
                        readingTimeOriginal: { type: Type.STRING },
                        readingTimeSaved: { type: Type.STRING },
                        toneLabel: { type: Type.STRING },
                      },
                      required: [
                        'articleTitle',
                        'tldr',
                        'keyPoints',
                        'impactAndContext',
                        'readingTimeOriginal',
                        'readingTimeSaved',
                        'toneLabel',
                      ],
                    },
                  },
            });

            const parsed = useSearchGrounding
              ? (extractJsonBlock(response.text ?? '{}') as Record<string, unknown>)
              : JSON.parse((response.text ?? '{}').trim());

            const groundingChunks =
              response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
            const extraSources: GroundedSource[] = [];
            for (const chunk of groundingChunks) {
              const uri = sanitizeHttpUrl(chunk?.web?.uri);
              const title = typeof chunk?.web?.title === 'string' ? chunk.web.title.trim() : '';
              if (uri && title) extraSources.push({ title, url: uri });
            }

            res.json({
              ...parsed,
              verifiedUrl: safeArticleUrl,
              groundedSources: extraSources.length > 0 ? extraSources.slice(0, 4) : undefined,
              engineUsed: `Google Gemini (${GEMINI_MODEL_ID})`,
              isLocalFallback: false,
            });
            return;
          }

          const userPrompt = rawUrl
            ? `Rangkum artikel berita berikut:\nJudul: ${sourceTitle}\nURL: ${safeArticleUrl}\nKonteks: ${sourceBody.slice(0, 10000)}`
            : `Judul: ${sourceTitle}\nSumber: ${article?.sourceName ?? 'Google News'}\n\nTeks:\n${sourceBody.slice(0, 12000)}`;

          if (providerId === 'groq') {
            const parsed = await callOpenAICompatibleJson({
              endpoint: 'https://api.groq.com/openai/v1/chat/completions',
              apiKey: process.env.GROQ_API_KEY!.trim(),
              model: 'llama-3.3-70b-versatile',
              systemPrompt,
              userPrompt,
            });
            res.json({
              ...parsed,
              verifiedUrl: safeArticleUrl,
              engineUsed: 'Groq (Llama 3.3 70B)',
              isLocalFallback: false,
            });
            return;
          }

          if (providerId === 'openai') {
            const parsed = await callOpenAICompatibleJson({
              endpoint: 'https://api.openai.com/v1/chat/completions',
              apiKey: process.env.OPENAI_API_KEY!.trim(),
              model: 'gpt-4o-mini',
              systemPrompt,
              userPrompt,
            });
            res.json({
              ...parsed,
              verifiedUrl: safeArticleUrl,
              engineUsed: 'OpenAI (GPT-4o Mini)',
              isLocalFallback: false,
            });
            return;
          }

          if (providerId === 'anthropic') {
            const parsed = await callAnthropicJson({
              apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
              model: 'claude-3-5-haiku-latest',
              systemPrompt,
              userPrompt,
            });
            res.json({
              ...parsed,
              verifiedUrl: safeArticleUrl,
              engineUsed: 'Anthropic (Claude 3.5 Haiku)',
              isLocalFallback: false,
            });
            return;
          }
        } catch (err) {
          lastError = err;
          continue;
        }
      }

      throw lastError ?? new Error('Seluruh penyedia AI gagal merespons.');
    } catch (err) {
      const { status, message, quotaExceeded } = formatErrorResponse(err);
      res.status(status).json({ error: message, quotaExceeded });
    }
  });

  app.post('/api/ai/copywrite', async (req: Request, res: Response) => {
    try {
      const requestedProvider =
        typeof req.body?.provider === 'string' ? req.body.provider : 'auto';
      const personaId =
        typeof req.body?.persona === 'string' && req.body.persona in PERSONA_PROMPTS
          ? req.body.persona
          : 'kreator';
      const persona = PERSONA_PROMPTS[personaId];

      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const summary = typeof req.body?.summary === 'string' ? req.body.summary.trim() : '';
      const sourceName = typeof req.body?.sourceName === 'string' ? req.body.sourceName.trim() : '';
      const platform = typeof req.body?.platform === 'string' ? req.body.platform : 'instagram';
      const tone = typeof req.body?.tone === 'string' ? req.body.tone : 'informatif';

      if (!title && !summary) {
        res.status(400).json({ error: 'Judul atau isi berita diperlukan untuk menyusun copywriting.' });
        return;
      }

      if (requestedProvider === 'local') {
        res.json(
          buildLocalTemplateCopywriting({
            title,
            summary,
            sourceName,
            platform,
            tone,
          })
        );
        return;
      }

      const providersToTry = resolveProviderOrder(requestedProvider);
      if (providersToTry.length === 0) {
        res.status(400).json({
          error:
            'Belum ada API key AI yang dikonfigurasi. Gunakan Template Lokal atau lanjutkan langsung ke Personal AI Anda.',
          quotaExceeded: false,
        });
        return;
      }

      const platformMap: Record<string, string> = {
        instagram: 'Instagram Carousel & Caption (visual slide-by-slide + caption engaging)',
        x_thread: 'X / Twitter Thread (tweet pembuka tajam + utas 3-4 tweet ringkas)',
        linkedin: 'LinkedIn Insight Post (profesional, reflektif, berorientasi nilai bisnis/karier)',
        tiktok: 'TikTok / Reels Script (hook 3 detik pertama, poin visual, penutup cepat)',
      };

      const toneMap: Record<string, string> = {
        informatif: 'Informatif, Jelas & Kredibel',
        santai: 'Santai, Relatable & Conversational',
        kritis: 'Kritis, Analitis & Menggugah Diskusi',
        storytelling: 'Storytelling & Naratif Emosional',
      };

      const platformLabel = platformMap[platform] ?? platformMap.instagram;
      const toneLabel = toneMap[tone] ?? toneMap.informatif;

      const systemPrompt = `Anda adalah asisten strategi konten pribadi (${persona.label}). ${persona.instruction}
Kembalikan HANYA JSON valid dengan struktur:
{
  "hook": "Kalimat pembuka kuat untuk menghentikan scroll",
  "structureSteps": [
    { "stepNumber": "01", "partLabel": "Nama Bagian", "content": "Isi copy" }
  ],
  "cta": "Call-to-action untuk memancing diskusi/simpan",
  "hashtags": ["#Tag1", "#Tag2", "#Tag3", "#Tag4"],
  "postingTip": "1 saran eksekusi singkat",
  "fullDraft": "Draf utuh siap salin"
}`;

      const userPrompt = `Susun struktur copywriting media sosial dalam Bahasa Indonesia:
- Judul Berita: ${title}
- Ringkasan / Konteks: ${summary}
- Sumber: ${sourceName || 'Google News'}
- Platform Target: ${platformLabel}
- Gaya Bahasa (Tone): ${toneLabel}`;

      let lastError: unknown = null;

      for (const providerId of providersToTry) {
        try {
          if (providerId === 'gemini') {
            const ai = getGeminiClient();
            const response = await ai.models.generateContent({
              model: GEMINI_MODEL_ID,
              contents: `${systemPrompt}\n\n${userPrompt}`,
              config: {
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    hook: { type: Type.STRING },
                    structureSteps: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          stepNumber: { type: Type.STRING },
                          partLabel: { type: Type.STRING },
                          content: { type: Type.STRING },
                        },
                        required: ['stepNumber', 'partLabel', 'content'],
                      },
                    },
                    cta: { type: Type.STRING },
                    hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    postingTip: { type: Type.STRING },
                    fullDraft: { type: Type.STRING },
                  },
                  required: ['hook', 'structureSteps', 'cta', 'hashtags', 'postingTip', 'fullDraft'],
                },
              },
            });

            const parsed = JSON.parse((response.text ?? '{}').trim());
            res.json({
              platform,
              platformLabel,
              tone,
              ...parsed,
              engineUsed: `Google Gemini (${GEMINI_MODEL_ID})`,
              isLocalFallback: false,
            });
            return;
          }

          if (providerId === 'groq') {
            const parsed = await callOpenAICompatibleJson({
              endpoint: 'https://api.groq.com/openai/v1/chat/completions',
              apiKey: process.env.GROQ_API_KEY!.trim(),
              model: 'llama-3.3-70b-versatile',
              systemPrompt,
              userPrompt,
            });
            res.json({
              platform,
              platformLabel,
              tone,
              ...parsed,
              engineUsed: 'Groq (Llama 3.3 70B)',
              isLocalFallback: false,
            });
            return;
          }

          if (providerId === 'openai') {
            const parsed = await callOpenAICompatibleJson({
              endpoint: 'https://api.openai.com/v1/chat/completions',
              apiKey: process.env.OPENAI_API_KEY!.trim(),
              model: 'gpt-4o-mini',
              systemPrompt,
              userPrompt,
            });
            res.json({
              platform,
              platformLabel,
              tone,
              ...parsed,
              engineUsed: 'OpenAI (GPT-4o Mini)',
              isLocalFallback: false,
            });
            return;
          }

          if (providerId === 'anthropic') {
            const parsed = await callAnthropicJson({
              apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
              model: 'claude-3-5-haiku-latest',
              systemPrompt,
              userPrompt,
            });
            res.json({
              platform,
              platformLabel,
              tone,
              ...parsed,
              engineUsed: 'Anthropic (Claude 3.5 Haiku)',
              isLocalFallback: false,
            });
            return;
          }
        } catch (err) {
          lastError = err;
          continue;
        }
      }

      throw lastError ?? new Error('Seluruh penyedia AI gagal menyusun copywriting.');
    } catch (err) {
      const { status, message, quotaExceeded } = formatErrorResponse(err);
      res.status(status).json({ error: message, quotaExceeded });
    }
  });

  // Real-time breaking news check every 2.5 minutes using Google News RSS (zero AI quota consumed!)
  setInterval(async () => {
    if (sseClients.size === 0) return;
    const activeCategories = Array.from(
      new Set(Array.from(sseClients).flatMap((c) => c.categories))
    );
    try {
      const { articles } = await fetchLiveNewsFromGoogle({
        categories: activeCategories,
        query: '',
        limit: 3,
      });
      const candidate = articles.find((a) => !seenBreakingIds.has(a.id));
      if (candidate) {
        seenBreakingIds.add(candidate.id);
        broadcastBreakingNews({ ...candidate, isBreaking: true });
      }
    } catch {
      // Retry on next interval
    }
  }, 150000);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build belum tersedia. Jalankan npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WartaKini server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
