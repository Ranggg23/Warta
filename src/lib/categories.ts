import type { NewsCategoryId, NewsCategoryMeta } from '../types/news';

export const NEWS_CATEGORIES: NewsCategoryMeta[] = [
  {
    id: 'teknologi',
    label: 'Teknologi & AI',
    shortLabel: 'Teknologi',
    description: 'Kecerdasan buatan, inovasi perangkat lunak, semikonduktor, dan ekonomi digital.',
    imageUrl: '/src/assets/images/news_tech_ai_1795233056013.jpg',
  },
  {
    id: 'ekonomi',
    label: 'Ekonomi & Bisnis',
    shortLabel: 'Ekonomi',
    description: 'Pasar modal, kebijakan moneter, startup, investasi, dan makroekonomi.',
    imageUrl: '/src/assets/images/news_economy_market_1795233056115.jpg',
  },
  {
    id: 'nasional',
    label: 'Nasional & Kebijakan',
    shortLabel: 'Nasional',
    description: 'Kebijakan publik, infrastruktur, pemerintahan, dan isu masyarakat Indonesia.',
    imageUrl: '/src/assets/images/news_national_policy_1795233056147.jpg',
  },
  {
    id: 'sains',
    label: 'Sains & Iklim',
    shortLabel: 'Sains',
    description: 'Energi terbarukan, riset ilmiah, antariksa, dan transisi iklim.',
    imageUrl: '/src/assets/images/news_climate_science_1795233055703.jpg',
  },
  {
    id: 'budaya',
    label: 'Budaya & Gaya Hidup',
    shortLabel: 'Budaya',
    description: 'Desain, arsitektur, kuliner, media kreatif, dan tren urban.',
    imageUrl: '/src/assets/images/news_culture_lifestyle_1795233055147.jpg',
  },
  {
    id: 'global',
    label: 'Global & Geopolitik',
    shortLabel: 'Global',
    description: 'Hubungan internasional, perdagangan global, dan dinamika kawasan.',
    imageUrl: '/src/assets/images/news_national_policy_1795233056147.jpg',
  },
  {
    id: 'olahraga',
    label: 'Olahraga',
    shortLabel: 'Olahraga',
    description: 'Turnamen internasional, sepak bola, bulu tangkis, dan prestasi atlet.',
    imageUrl: '/src/assets/images/news_culture_lifestyle_1795233055147.jpg',
  },
  {
    id: 'kesehatan',
    label: 'Kesehatan',
    shortLabel: 'Kesehatan',
    description: 'Riset medis, kesehatan publik, bioteknologi, dan gaya hidup sehat.',
    imageUrl: '/src/assets/images/news_climate_science_1795233055703.jpg',
  },
];

export const DEFAULT_PREFERRED_CATEGORIES: NewsCategoryId[] = [
  'teknologi',
  'ekonomi',
  'nasional',
  'sains',
];

export function getCategoryMeta(id: string): NewsCategoryMeta {
  return (
    NEWS_CATEGORIES.find((c) => c.id === id) ?? {
      id: 'teknologi',
      label: 'Teknologi & AI',
      shortLabel: 'Teknologi',
      description: 'Berita terbaru pilihan redaksi.',
      imageUrl: '/src/assets/images/news_tech_ai_1795233056013.jpg',
    }
  );
}

export function sanitizeExternalUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
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
