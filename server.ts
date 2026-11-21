import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_ID = 'gemini-4-hydrogen';

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

interface GroundedSource {
  title: string;
  url: string;
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
  groundedSources?: GroundedSource[];
}

interface CacheEntry {
  articles: ServerNewsArticle[];
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

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY belum dikonfigurasi. Silakan atur API key di panel Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
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

function formatErrorResponse(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : 'Terjadi kesalahan pada server.';
  if (msg.includes('GEMINI_API_KEY')) {
    return { status: 400, message: msg };
  }
  if (msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID') || msg.includes('403')) {
    return {
      status: 403,
      message: 'API key Gemini tidak valid atau ditolak. Periksa Settings > Secrets.',
    };
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return {
      status: 429,
      message: 'Batas kuota permintaan Gemini tercapai. Coba lagi sebentar lagi.',
    };
  }
  return { status: 500, message: msg };
}

function slugifyId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64);
}

async function fetchLiveNewsWithGemini(options: {
  categories: string[];
  query: string;
  limit?: number;
  breakingOnly?: boolean;
}): Promise<{ articles: ServerNewsArticle[]; groundedSources: GroundedSource[] }> {
  const ai = getGeminiClient();
  const todayIso = new Date().toISOString().split('T')[0];
  const todayReadable = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const validCategories = options.categories.filter((c) => c in CATEGORY_LABELS);
  const categoryList =
    validCategories.length > 0 ? validCategories : ['teknologi', 'ekonomi', 'nasional', 'sains'];
  const categoryNames = categoryList.map((c) => `${c} (${CATEGORY_LABELS[c]})`).join(', ');
  const count = options.limit ?? 9;

  const searchDirective = options.query
    ? `Cari ${count} berita terbaru hari ini (${todayReadable}, ${todayIso}) yang paling relevan dengan kata kunci pencarian: "${options.query}". Gunakan kategori paling sesuai dari daftar: ${Object.keys(CATEGORY_LABELS).join(', ')}.`
    : options.breakingOnly
      ? `Cari 2 berita terkini / breaking news paling baru yang rilis hari ini (${todayReadable}, ${todayIso}) untuk kategori: ${categoryNames}.`
      : `Cari ${count} berita aktual dan terupdate hari ini (${todayReadable}, ${todayIso}) dari media terpercaya Indonesia & internasional untuk kategori: ${categoryNames}. Pastikan beragam dan mencakup setiap kategori yang diminta.`;

  const prompt = `Anda adalah kurator redaksi berita profesional WartaKini.
${searchDirective}

WAJIB gunakan hasil pencarian Google Search terbaru untuk memastikan berita benar-benar terjadi dan terbit baru-baru ini (${todayIso}).
Kembalikan HANYA sebuah JSON array valid (tanpa teks tambahan di luar blok JSON) dengan struktur tiap item:
{
  "title": "Judul berita informatif dan akurat dalam Bahasa Indonesia (maks 18 kata)",
  "excerpt": "Ringkasan pembuka 2 kalimat yang jelas dalam Bahasa Indonesia",
  "content": "Isi artikel berita informatif 2-3 paragraf padat fakta berdasarkan laporan terkini",
  "category": "salah satu id persis: teknologi | ekonomi | nasional | sains | budaya | global | olahraga | kesehatan",
  "sourceName": "Nama media sumber berita (misal: Kompas, Tempo, CNBC Indonesia, Reuters, BBC, TechCrunch)",
  "sourceUrl": "URL artikel sumber jika tersedia dari hasil pencarian, atau string kosong jika tidak yakin",
  "publishedAt": "ISO timestamp perkiraan terbit hari ini (${todayIso})",
  "relativeTime": "Misal: '15 menit lalu', '1 jam lalu', '3 jam lalu', 'Hari ini'",
  "readMinutes": 3,
  "isBreaking": true atau false (hanya 1-2 berita paling mendesak yang true)
}`;

  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const rawText = response.text ?? '[]';
  const parsed = extractJsonBlock(rawText);
  const items = Array.isArray(parsed) ? parsed : [];

  const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const groundedSources: GroundedSource[] = [];
  for (const chunk of rawChunks) {
    const uri = sanitizeHttpUrl(chunk?.web?.uri);
    const title = typeof chunk?.web?.title === 'string' ? chunk.web.title.trim() : '';
    if (uri && title) {
      groundedSources.push({ title, url: uri });
    }
  }

  const articles: ServerNewsArticle[] = items
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, idx) => {
      const cat =
        typeof item.category === 'string' && item.category in CATEGORY_LABELS
          ? item.category
          : categoryList[idx % categoryList.length];
      const title =
        typeof item.title === 'string' && item.title.trim()
          ? item.title.trim()
          : 'Perkembangan Berita Terkini';
      const directUrl = sanitizeHttpUrl(item.sourceUrl);
      const fallbackGrounded = groundedSources[idx % Math.max(groundedSources.length, 1)]?.url ?? '';
      const resolvedUrl = directUrl || fallbackGrounded;

      return {
        id: `${cat}-${slugifyId(title)}-${idx}`,
        title,
        excerpt:
          typeof item.excerpt === 'string' && item.excerpt.trim()
            ? item.excerpt.trim()
            : 'Laporan terkini dari jaringan berita terverifikasi.',
        content:
          typeof item.content === 'string' && item.content.trim()
            ? item.content.trim()
            : typeof item.excerpt === 'string'
              ? item.excerpt.trim()
              : '',
        category: cat,
        categoryLabel: CATEGORY_LABELS[cat] ?? 'Terkini',
        sourceName:
          typeof item.sourceName === 'string' && item.sourceName.trim()
            ? item.sourceName.trim()
            : groundedSources[idx]?.title || 'Redaksi Terkini',
        sourceUrl: resolvedUrl,
        publishedAt:
          typeof item.publishedAt === 'string' && item.publishedAt.trim()
            ? item.publishedAt.trim()
            : new Date().toISOString(),
        relativeTime:
          typeof item.relativeTime === 'string' && item.relativeTime.trim()
            ? item.relativeTime.trim()
            : 'Hari ini',
        readMinutes:
          typeof item.readMinutes === 'number' && item.readMinutes > 0 && item.readMinutes <= 20
            ? Math.round(item.readMinutes)
            : 3,
        isBreaking: Boolean(item.isBreaking),
        groundedSources: groundedSources.slice(0, 4),
      };
    });

  return { articles, groundedSources };
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
          fetchedAt: cached.fetchedAt,
          cached: true,
        });
        return;
      }

      const { articles } = await fetchLiveNewsWithGemini({
        categories,
        query: q,
        limit: q ? 8 : 9,
      });

      const fetchedAt = new Date().toISOString();
      newsCache.set(cacheKey, {
        articles,
        fetchedAt,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      // Seed breaking notification history from latest breaking story if unseen
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

      const { articles } = await fetchLiveNewsWithGemini({
        categories,
        query: '',
        limit: 2,
        breakingOnly: true,
      });

      const fresh = articles[0];
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
      const ai = getGeminiClient();
      const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
      const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
      const article = req.body?.article as Partial<ServerNewsArticle> | undefined;

      if (rawUrl) {
        const safeUrl = validateExternalUrlForServer(rawUrl);
        const prompt = `Baca dan analisis artikel berita dari tautan berikut: ${safeUrl}
Buat rangkuman terstruktur dalam Bahasa Indonesia yang jernih, akurat, dan objektif agar pembaca memahami intinya dalam 30 detik.
Kembalikan HANYA JSON valid dengan format:
{
  "articleTitle": "Judul artikel",
  "tldr": "Inti berita dalam 2 kalimat padat",
  "keyPoints": ["Poin kunci 1", "Poin kunci 2", "Poin kunci 3"],
  "impactAndContext": "Mengapa berita ini penting dan dampaknya bagi pembaca/industri (1-2 kalimat)",
  "readingTimeOriginal": "4 menit",
  "readingTimeSaved": "30 detik",
  "toneLabel": "Netral & Analitis"
}`;

        const response = await ai.models.generateContent({
          model: MODEL_ID,
          contents: prompt,
          config: {
            tools: [{ urlContext: {} }, { googleSearch: {} }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });

        const parsed = extractJsonBlock(response.text ?? '{}') as Record<string, unknown>;
        res.json({
          articleTitle:
            typeof parsed.articleTitle === 'string' ? parsed.articleTitle : 'Ringkasan Artikel',
          tldr: typeof parsed.tldr === 'string' ? parsed.tldr : '',
          keyPoints: Array.isArray(parsed.keyPoints)
            ? parsed.keyPoints.filter((k): k is string => typeof k === 'string')
            : [],
          impactAndContext:
            typeof parsed.impactAndContext === 'string' ? parsed.impactAndContext : '',
          readingTimeOriginal:
            typeof parsed.readingTimeOriginal === 'string' ? parsed.readingTimeOriginal : '4 menit',
          readingTimeSaved:
            typeof parsed.readingTimeSaved === 'string' ? parsed.readingTimeSaved : '30 detik',
          toneLabel: typeof parsed.toneLabel === 'string' ? parsed.toneLabel : 'Informatif',
          verifiedUrl: safeUrl,
        });
        return;
      }

      const sourceTitle = article?.title?.trim() || 'Artikel Berita';
      const sourceBody =
        rawText ||
        [article?.title, article?.excerpt, article?.content].filter(Boolean).join('\n\n');

      if (!sourceBody || sourceBody.length < 20) {
        res.status(400).json({ error: 'Masukkan teks artikel atau URL berita yang ingin dirangkum.' });
        return;
      }

      const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: `Rangkum artikel berita berikut dalam Bahasa Indonesia yang jernih, padat fakta, dan mudah dipahami:\n\nJudul: ${sourceTitle}\nSumber: ${article?.sourceName ?? 'Umum'}\n\nTeks:\n${sourceBody.slice(0, 12000)}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              articleTitle: { type: Type.STRING },
              tldr: { type: Type.STRING, description: 'Inti berita dalam 2 kalimat ringkas' },
              keyPoints: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 sampai 4 poin penting berbasis fakta',
              },
              impactAndContext: {
                type: Type.STRING,
                description: 'Analisis singkat konteks dan dampaknya bagi pembaca',
              },
              readingTimeOriginal: { type: Type.STRING, description: 'Misal: 4 menit' },
              readingTimeSaved: { type: Type.STRING, description: 'Misal: 25 detik' },
              toneLabel: { type: Type.STRING, description: 'Misal: Informatif, Kritis, Optimistis' },
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

      const summary = JSON.parse((response.text ?? '{}').trim());
      res.json({
        ...summary,
        verifiedUrl: sanitizeHttpUrl(article?.sourceUrl),
      });
    } catch (err) {
      const { status, message } = formatErrorResponse(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/ai/copywrite', async (req: Request, res: Response) => {
    try {
      const ai = getGeminiClient();
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const summary = typeof req.body?.summary === 'string' ? req.body.summary.trim() : '';
      const sourceName = typeof req.body?.sourceName === 'string' ? req.body.sourceName.trim() : '';
      const platform = typeof req.body?.platform === 'string' ? req.body.platform : 'instagram';
      const tone = typeof req.body?.tone === 'string' ? req.body.tone : 'informatif';

      if (!title && !summary) {
        res.status(400).json({ error: 'Judul atau isi berita diperlukan untuk menyusun copywriting.' });
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

      const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: `Anda adalah ahli strategi konten dan copywriter media sosial Indonesia.
Susun struktur copywriting siap pakai dalam Bahasa Indonesia berdasarkan berita berikut:
- Judul Berita: ${title}
- Ringkasan / Konteks: ${summary}
- Sumber: ${sourceName || 'Media Berita'}
- Platform Target: ${platformLabel}
- Gaya Bahasa (Tone): ${toneLabel}

Pastikan strukturnya taktis, tidak klise, dan langsung bisa dipakai kreator konten atau jurnalis media sosial.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hook: {
                type: Type.STRING,
                description: 'Kalimat pembuka kuat untuk menghentikan scroll',
              },
              structureSteps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.STRING, description: 'Misal: 01, 02, Slide 1, Tweet 2' },
                    partLabel: { type: Type.STRING, description: 'Misal: Konteks Masalah, Fakta Kunci, Sudut Pandang' },
                    content: { type: Type.STRING, description: 'Isi copy untuk bagian tersebut' },
                  },
                  required: ['stepNumber', 'partLabel', 'content'],
                },
                description: '3 sampai 5 blok struktur isi konten',
              },
              cta: {
                type: Type.STRING,
                description: 'Call-to-action untuk memancing komentar, simpan, atau bagikan',
              },
              hashtags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '4 sampai 6 hashtag relevan (tanpa spasi, diawali #)',
              },
              postingTip: {
                type: Type.STRING,
                description: '1 saran singkat eksekusi visual atau waktu unggah terbaik untuk platform ini',
              },
              fullDraft: {
                type: Type.STRING,
                description: 'Draf utuh gabungan hook, isi, CTA, dan hashtag yang siap disalin',
              },
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
      });
    } catch (err) {
      const { status, message } = formatErrorResponse(err);
      res.status(status).json({ error: message });
    }
  });

  // Background real-time breaking news check every 2.5 minutes when SSE clients are listening
  setInterval(async () => {
    if (sseClients.size === 0) return;
    const activeCategories = Array.from(
      new Set(Array.from(sseClients).flatMap((c) => c.categories))
    );
    try {
      const { articles } = await fetchLiveNewsWithGemini({
        categories: activeCategories,
        query: '',
        limit: 2,
        breakingOnly: true,
      });
      const candidate = articles.find((a) => !seenBreakingIds.has(a.id));
      if (candidate) {
        seenBreakingIds.add(candidate.id);
        broadcastBreakingNews({ ...candidate, isBreaking: true });
      }
    } catch {
      // Silent background retry on next interval
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
