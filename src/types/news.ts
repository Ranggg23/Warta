export type NewsCategoryId =
  | 'teknologi'
  | 'ekonomi'
  | 'nasional'
  | 'sains'
  | 'budaya'
  | 'global'
  | 'olahraga'
  | 'kesehatan';

export interface NewsCategoryMeta {
  id: NewsCategoryId;
  label: string;
  shortLabel: string;
  description: string;
  imageUrl: string;
}

export interface GroundedSource {
  title: string;
  url: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: NewsCategoryId;
  categoryLabel: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  relativeTime: string;
  readMinutes: number;
  isBreaking?: boolean;
  groundedSources?: GroundedSource[];
}

export interface AISummary {
  articleTitle: string;
  tldr: string;
  keyPoints: string[];
  impactAndContext: string;
  readingTimeOriginal: string;
  readingTimeSaved: string;
  toneLabel: string;
  verifiedUrl?: string;
}

export type SocialPlatform = 'instagram' | 'x_thread' | 'linkedin' | 'tiktok';

export type CopyTone = 'informatif' | 'santai' | 'kritis' | 'storytelling';

export interface CopyStructureStep {
  stepNumber: string;
  partLabel: string;
  content: string;
}

export interface CopywritingSuggestion {
  platform: SocialPlatform;
  platformLabel: string;
  tone: CopyTone;
  hook: string;
  structureSteps: CopyStructureStep[];
  cta: string;
  hashtags: string[];
  postingTip: string;
  fullDraft: string;
}

export interface BreakingNotification {
  id: string;
  article: NewsArticle;
  receivedAt: string;
  read: boolean;
}
