import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArticleStudioModal } from './components/ArticleStudioModal';
import { BreakingToast } from './components/BreakingToast';
import { CategoryFilterBar } from './components/CategoryFilterBar';
import { EditorialFeed, type StudioTab } from './components/EditorialFeed';
import { Header, type ActiveView } from './components/Header';
import { NotificationDrawer } from './components/NotificationDrawer';
import { PreferencesModal } from './components/PreferencesModal';
import { TrendingKeywordsStrip } from './components/TrendingKeywordsStrip';
import { UrlSummarizerView } from './components/UrlSummarizerView';
import { UtilityStrip } from './components/UtilityStrip';
import { DEFAULT_PREFERRED_CATEGORIES } from './lib/categories';
import type {
  AIPersonaId,
  AIProviderId,
  AIProviderStatus,
  BreakingNotification,
  GroundedSource,
  NewsArticle,
  NewsCategoryId,
  TrendingKeyword,
} from './types/news';

function loadStoredCategories(): NewsCategoryId[] {
  try {
    const raw = localStorage.getItem('wartakini_preferred_categories');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Ignore storage parse error
  }
  return DEFAULT_PREFERRED_CATEGORIES;
}

function loadStoredSavedArticles(): NewsArticle[] {
  try {
    const raw = localStorage.getItem('wartakini_saved_articles');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore
  }
  return [];
}

function loadStoredTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem('wartakini_theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Ignore
  }
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(loadStoredTheme);
  const [activeView, setActiveView] = useState<ActiveView>('all');
  const [preferredCategories, setPreferredCategories] = useState<NewsCategoryId[]>(
    loadStoredCategories
  );
  const [realtimeEnabled, setRealtimeEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('wartakini_realtime') !== 'false';
    } catch {
      return true;
    }
  });

  const [selectedCategory, setSelectedCategory] = useState<NewsCategoryId | 'all' | 'preferred'>(
    'all'
  );
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [trendingKeywords, setTrendingKeywords] = useState<TrendingKeyword[]>([]);
  const [groundedSources, setGroundedSources] = useState<GroundedSource[]>([]);
  const [webSearchQueries, setWebSearchQueries] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState('');

  const [savedArticles, setSavedArticles] = useState<NewsArticle[]>(loadStoredSavedArticles);
  const savedIds = useMemo(() => new Set(savedArticles.map((a) => a.id)), [savedArticles]);

  const [modalArticle, setModalArticle] = useState<NewsArticle | null>(null);
  const [modalInitialTab, setModalInitialTab] = useState<StudioTab>('ringkasan');

  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [notifications, setNotifications] = useState<BreakingNotification[]>([]);
  const [activeToast, setActiveToast] = useState<BreakingNotification | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [checkingBreaking, setCheckingBreaking] = useState(false);

  const [aiProviders, setAiProviders] = useState<AIProviderStatus[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<AIProviderId>(() => {
    try {
      const saved = localStorage.getItem('wartakini_ai_provider') as AIProviderId | null;
      return saved || 'auto';
    } catch {
      return 'auto';
    }
  });
  const [selectedPersona, setSelectedPersona] = useState<AIPersonaId>(() => {
    try {
      const saved = localStorage.getItem('wartakini_ai_persona') as AIPersonaId | null;
      return saved || 'jurnalis';
    } catch {
      return 'jurnalis';
    }
  });

  useEffect(() => {
    fetch('/api/ai/providers')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.providers)) {
          setAiProviders(data.providers);
        }
      })
      .catch(() => {
        // Ignore provider probe error
      });
  }, []);

  // Sync light/dark theme class on <html>
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('wartakini_theme', theme);
    } catch {
      // Ignore
    }
  }, [theme]);

  const fetchNews = useCallback(
    async (forceRefresh = false) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        let categoriesParam = '';
        if (selectedCategory === 'preferred') {
          categoriesParam = preferredCategories.join(',');
        } else if (selectedCategory !== 'all') {
          categoriesParam = selectedCategory;
        }

        const params = new URLSearchParams();
        if (categoriesParam) params.set('categories', categoriesParam);
        if (activeQuery) params.set('q', activeQuery);
        if (forceRefresh) params.set('refresh', 'true');

        const res = await fetch(`/api/news?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Gagal memuat daftar berita.');
        }

        const fetchedList = Array.isArray(data.articles) ? data.articles : [];
        setArticles(fetchedList);
        setTrendingKeywords(Array.isArray(data.trendingKeywords) ? data.trendingKeywords : []);
        setGroundedSources(Array.isArray(data.groundedSources) ? data.groundedSources : []);
        setWebSearchQueries(Array.isArray(data.webSearchQueries) ? data.webSearchQueries : []);
        if (data.fetchedAt) {
          setLastUpdatedLabel(
            new Date(data.fetchedAt).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            })
          );
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Terjadi gangguan jaringan saat mengambil berita.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [selectedCategory, preferredCategories, activeQuery]
  );

  useEffect(() => {
    if (activeView === 'all' || activeView === 'for_you') {
      void fetchNews(false);
    }
  }, [activeView, fetchNews]);

  // Real-time SSE notifications subscription
  useEffect(() => {
    if (!realtimeEnabled) {
      setSseConnected(false);
      return;
    }

    const catsParam = preferredCategories.join(',');
    const source = new EventSource(
      `/api/notifications/stream?categories=${encodeURIComponent(catsParam)}`
    );

    source.addEventListener('connected', (event) => {
      setSseConnected(true);
      try {
        const parsed = JSON.parse((event as MessageEvent).data);
        if (Array.isArray(parsed?.recent)) {
          setNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            const incoming: BreakingNotification[] = parsed.recent
              .filter((r: { id: string }) => !existingIds.has(r.id))
              .map((r: { id: string; article: NewsArticle; receivedAt: string }) => ({
                id: r.id,
                article: r.article,
                receivedAt: r.receivedAt,
                read: true,
              }));
            return [...prev, ...incoming].slice(0, 25);
          });
        }
      } catch {
        // Ignore malformed event
      }
    });

    source.addEventListener('breaking', (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as {
          id: string;
          article: NewsArticle;
          receivedAt: string;
        };
        const notif: BreakingNotification = {
          id: parsed.id,
          article: parsed.article,
          receivedAt: parsed.receivedAt,
          read: false,
        };
        setNotifications((prev) => {
          if (prev.some((n) => n.id === notif.id)) return prev;
          return [notif, ...prev].slice(0, 25);
        });
        setActiveToast(notif);

        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification(`WartaKini · ${notif.article.categoryLabel}`, {
            body: notif.article.title,
          });
        }
      } catch {
        // Ignore malformed event
      }
    });

    source.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      source.close();
      setSseConnected(false);
    };
  }, [realtimeEnabled, preferredCategories]);

  function handleSelectView(view: ActiveView) {
    setActiveView(view);
    if (view === 'for_you') {
      setSelectedCategory('preferred');
    } else if (view === 'all' && selectedCategory === 'preferred') {
      setSelectedCategory('all');
    }
  }

  function handleSelectCategory(cat: NewsCategoryId | 'all' | 'preferred') {
    setSelectedCategory(cat);
    if (cat === 'preferred') {
      setActiveView('for_you');
    } else {
      setActiveView('all');
    }
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setActiveView('all');
    setActiveQuery(searchInput.trim());
  }

  function handleClearSearch() {
    setSearchInput('');
    setActiveQuery('');
  }

  function handleSelectTrendingKeyword(keyword: string) {
    setActiveView('all');
    setSearchInput(keyword);
    setActiveQuery(keyword);
  }

  function handleToggleSave(article: NewsArticle) {
    setSavedArticles((prev) => {
      const exists = prev.some((a) => a.id === article.id);
      const next = exists ? prev.filter((a) => a.id !== article.id) : [article, ...prev];
      try {
        localStorage.setItem('wartakini_saved_articles', JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }

  function handleSavePreferences(categories: NewsCategoryId[], realtime: boolean) {
    setPreferredCategories(categories);
    setRealtimeEnabled(realtime);
    try {
      localStorage.setItem('wartakini_preferred_categories', JSON.stringify(categories));
      localStorage.setItem('wartakini_realtime', String(realtime));
    } catch {
      // Ignore
    }
  }

  function handleChangeProvider(provider: AIProviderId) {
    setSelectedProvider(provider);
    try {
      localStorage.setItem('wartakini_ai_provider', provider);
    } catch {
      // Ignore
    }
  }

  function handleChangePersona(persona: AIPersonaId) {
    setSelectedPersona(persona);
    try {
      localStorage.setItem('wartakini_ai_persona', persona);
    } catch {
      // Ignore
    }
  }

  async function handleCheckBreakingNow() {
    setCheckingBreaking(true);
    try {
      const res = await fetch('/api/news/check-breaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: preferredCategories }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal memeriksa berita terkini.');
      }
      // If SSE is paused by user, still append locally so button feedback is immediate
      if (!realtimeEnabled && data.article) {
        const manualNotif: BreakingNotification = {
          id: `${data.article.id}-${Date.now()}`,
          article: data.article,
          receivedAt: new Date().toISOString(),
          read: false,
        };
        setNotifications((prev) => [manualNotif, ...prev].slice(0, 25));
        setActiveToast(manualNotif);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal memeriksa pembaruan berita.'
      );
    } finally {
      setCheckingBreaking(false);
    }
  }

  function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-stone-900 dark:bg-[#0D0D10] dark:text-[#E4E2DD] transition-colors duration-200">
      <Header
        activeView={activeView}
        savedCount={savedArticles.length}
        onSelectView={handleSelectView}
        onOpenPreferences={() => setPreferencesOpen(true)}
      />

      <UtilityStrip
        searchQuery={searchInput}
        onSearchChange={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        onClearSearch={handleClearSearch}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        unreadCount={unreadCount}
        sseConnected={sseConnected}
        onOpenNotifications={() => setNotificationsOpen(true)}
        activeView={activeView}
        onSelectView={handleSelectView}
        savedCount={savedArticles.length}
      />

      {(activeView === 'all' || activeView === 'for_you') && (
        <>
          <CategoryFilterBar
            selectedCategory={selectedCategory}
            preferredCategories={preferredCategories}
            onSelectCategory={handleSelectCategory}
            onRefresh={() => void fetchNews(true)}
            isLoading={isLoading}
            lastUpdatedLabel={lastUpdatedLabel}
          />
          <TrendingKeywordsStrip
            keywords={trendingKeywords}
            activeQuery={activeQuery}
            isLoading={isLoading}
            onSelectKeyword={handleSelectTrendingKeyword}
            onClearKeyword={handleClearSearch}
          />
        </>
      )}

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8">
        {activeView === 'summarizer' ? (
          <UrlSummarizerView
            providers={aiProviders}
            selectedProvider={selectedProvider}
            selectedPersona={selectedPersona}
            onChangeProvider={handleChangeProvider}
            onChangePersona={handleChangePersona}
          />
        ) : activeView === 'saved' ? (
          <div className="pt-8">
            <div className="pb-4 border-b border-stone-200 dark:border-zinc-800 flex items-baseline justify-between">
              <h1 className="font-serif text-3xl font-semibold text-stone-900 dark:text-[#F2F0EB]">
                Artikel Tersimpan
              </h1>
              <span className="font-mono text-xs text-stone-500 dark:text-zinc-400 tabular-nums">
                {savedArticles.length} artikel
              </span>
            </div>
            <EditorialFeed
              articles={savedArticles}
              isLoading={false}
              errorMessage={null}
              searchQuery=""
              savedIds={savedIds}
              onRetry={() => {}}
              onOpenArticle={(article, tab = 'ringkasan') => {
                setModalArticle(article);
                setModalInitialTab(tab);
              }}
              onToggleSave={handleToggleSave}
              emptyTitle="Belum Ada Artikel Tersimpan"
              emptyDescription="Klik ikon marka buku pada berita mana pun untuk menyimpannya di daftar baca malam Anda."
            />
          </div>
        ) : (
          <>
            {activeQuery && (
              <div className="pt-6 flex items-center justify-between gap-4 text-xs text-stone-600 dark:text-zinc-400">
                <p>
                  Menampilkan berita terbaru untuk pencarian:{' '}
                  <strong className="font-semibold text-stone-900 dark:text-zinc-100">
                    “{activeQuery}”
                  </strong>
                </p>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="text-red-700 dark:text-red-400 font-medium hover:underline cursor-pointer"
                >
                  Reset Pencarian
                </button>
              </div>
            )}

            <EditorialFeed
              articles={articles}
              isLoading={isLoading}
              errorMessage={errorMessage}
              searchQuery={activeQuery}
              savedIds={savedIds}
              groundedSources={groundedSources}
              webSearchQueries={webSearchQueries}
              onRetry={() => void fetchNews(true)}
              onOpenArticle={(article, tab = 'ringkasan') => {
                setModalArticle(article);
                setModalInitialTab(tab);
              }}
              onToggleSave={handleToggleSave}
            />
          </>
        )}
      </main>

      <footer className="border-t border-stone-200 dark:border-zinc-800 mt-12">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-stone-500 dark:text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="font-serif text-sm font-semibold text-stone-900 dark:text-zinc-200">
              WartaKini
            </span>
            <span aria-hidden="true">·</span>
            <span>Kurasi Berita Harian, Rangkuman AI &amp; Copywriting Studio</span>
          </div>

          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => handleSelectView('summarizer')}
              className="hover:text-stone-900 dark:hover:text-zinc-200 cursor-pointer"
            >
              Ringkas Tautan
            </button>
            <button
              type="button"
              onClick={() => setPreferencesOpen(true)}
              className="hover:text-stone-900 dark:hover:text-zinc-200 cursor-pointer"
            >
              Preferensi Kategori
            </button>
            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              className="hover:text-stone-900 dark:hover:text-zinc-200 cursor-pointer"
            >
              {theme === 'dark' ? 'Mode Siang' : 'Mode Malam'}
            </button>
          </div>
        </div>
      </footer>

      <ArticleStudioModal
        article={modalArticle}
        initialTab={modalInitialTab}
        isSaved={modalArticle ? savedIds.has(modalArticle.id) : false}
        providers={aiProviders}
        selectedProvider={selectedProvider}
        selectedPersona={selectedPersona}
        onChangeProvider={handleChangeProvider}
        onChangePersona={handleChangePersona}
        onToggleSave={handleToggleSave}
        onClose={() => setModalArticle(null)}
      />

      <PreferencesModal
        isOpen={preferencesOpen}
        preferredCategories={preferredCategories}
        realtimeEnabled={realtimeEnabled}
        onSavePreferences={handleSavePreferences}
        onClose={() => setPreferencesOpen(false)}
      />

      <NotificationDrawer
        isOpen={notificationsOpen}
        notifications={notifications}
        sseConnected={sseConnected}
        checkingBreaking={checkingBreaking}
        onCheckBreakingNow={() => void handleCheckBreakingNow()}
        onMarkAllRead={handleMarkAllRead}
        onSelectNotification={(article) => {
          setModalArticle(article);
          setModalInitialTab('ringkasan');
        }}
        onClose={() => setNotificationsOpen(false)}
      />

      <BreakingToast
        notification={activeToast}
        onOpenArticle={(article) => {
          setModalArticle(article);
          setModalInitialTab('ringkasan');
        }}
        onDismiss={() => setActiveToast(null)}
      />
    </div>
  );
}
