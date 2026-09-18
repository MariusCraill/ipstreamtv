import { useState, useEffect, useCallback, useRef } from "react";
import VideoPlayer from "./components/VideoPlayer";
import ChannelCard from "./components/ChannelCard";
import ChannelListItem from "./components/ChannelListItem";
import M3UImport from "./components/M3UImport";
import { ToastContainer, useToast } from "./components/Toast";
import { Channel, ChannelStatus } from "./types";
import { parseM3U } from "./utils/m3uParser";
import { testStreams } from "./utils/streamTester";

// IPTV-Org GitHub source URLs
const IPTV_ORG_SOURCES: Record<string, { url: string; country: string }> = {
  us: {
    url: "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us.m3u",
    country: "USA",
  },
  za: {
    url: "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/za.m3u",
    country: "South Africa",
  },
};

// Curated UK/England channels
const ukChannels: Channel[] = [
  {
    id: "uk-bbc-news",
    name: "BBC News",
    country: "England",
    category: "News",
    url: "https://vs-hls-push-uk-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_news_channel_hd/pc_hd_abr_v2.m3u8",
    language: "English",
    source: "curated",
  },
  {
    id: "uk-sky-news",
    name: "Sky News",
    country: "England",
    category: "News",
    url: "https://linear417-gb-hls1-prd-ak.cdn.skycdp.com/Content/HLS_001_1080/Live/channel(skynews)/index.m3u8",
    language: "English",
    source: "curated",
  },
  {
    id: "uk-gb-news",
    name: "GB News",
    country: "England",
    category: "News",
    url: "https://live-gbnews.simplestreamcdn.com/live/gbnews/bitrate1.isml/live.m3u8",
    language: "English",
    source: "curated",
  },
  {
    id: "uk-talktv",
    name: "TalkTV",
    country: "England",
    category: "Entertainment",
    url: "https://live-alkamaize.akamaized.net/hls/live/2044460/talktv/master.m3u8",
    language: "English",
    source: "curated",
  },
  {
    id: "uk-faith",
    name: "Daystar UK",
    country: "England",
    category: "Religion",
    url: "https://cdnlive.shooowit.net/daystarlive/smil:daystarlive.smil/playlist.m3u8",
    language: "English",
    source: "curated",
  },
  {
    id: "uk-fashion",
    name: "Fashion One",
    country: "England",
    category: "Entertainment",
    url: "https://fashionone.akamaized.net/hls/live/2034251/fashionone/index.m3u8",
    language: "English",
    source: "curated",
  },
  {
    id: "uk-documentary",
    name: "Documentary+ (UK)",
    country: "England",
    category: "Documentary",
    url: "https://1d153317c8db4250b3789601274e2402.mediatailor.us-west-2.amazonaws.com/v1/master/ba62fe743df0fe93366eba3a257d792884136c7f/LINEAR-887-DOCUMENTARYINTERNATIONAL-DOCUMENTARYPLUS/mt/documentaryplus/887/hls/master/playlist.m3u8",
    language: "English",
    source: "curated",
  },
  {
    id: "uk-vevo-pop",
    name: "Vevo Pop (UK)",
    country: "England",
    category: "Music",
    url: "https://amg00056-amg00056c6-rakuten-uk-3235.playouts.now.amagi.tv/playlist.m3u8",
    language: "English",
    source: "curated",
  },
];

const COUNTRIES = ["All", "Favorites", "USA", "England", "South Africa", "Imported"] as const;
const CATEGORIES = [
  "All",
  "News",
  "Sports",
  "Entertainment",
  "Music",
  "Kids",
  "Movies",
  "Documentary",
  "Weather",
  "Business",
  "Religion",
  "Lifestyle",
  "Comedy",
  "Drama",
  "Other",
] as const;

function App() {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>("All");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [channelStatuses, setChannelStatuses] = useState<Record<string, ChannelStatus>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testProgress, setTestProgress] = useState({ tested: 0, total: 0 });
  const [showOnlyLive, setShowOnlyLive] = useState(false);
  const [hasTested, setHasTested] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("iptv-favorites");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [importedChannels, setImportedChannels] = useState<Channel[]>(() => {
    const saved = localStorage.getItem("iptv-imported-channels");
    return saved ? JSON.parse(saved) : [];
  });
  const abortRef = useRef<AbortController | null>(null);
  const testAbortRef = useRef<AbortController | null>(null);
  const { toasts, addToast } = useToast();

  // Fetch streams from iptv-org GitHub repository
  const fetchStreams = useCallback(async () => {
    setIsFetching(true);
    setFetchError(null);

    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    try {
      const allChannels: Channel[] = [...ukChannels];

      const fetchPromises = Object.entries(IPTV_ORG_SOURCES).map(
        async ([code, source]) => {
          try {
            const response = await fetch(source.url, {
              signal: abortRef.current!.signal,
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            const parsed = parseM3U(text, source.country, "iptv-org");
            return parsed;
          } catch (err) {
            console.warn(`Failed to fetch ${code}:`, err);
            return [];
          }
        }
      );

      const results = await Promise.all(fetchPromises);
      results.forEach((parsed) => {
        allChannels.push(...parsed);
      });

      // Remove duplicates by URL
      const seen = new Set<string>();
      const unique = allChannels.filter((ch) => {
        if (seen.has(ch.url)) return false;
        seen.add(ch.url);
        return true;
      });

      // Merge with imported channels (loaded from localStorage)
      const importedUrls = new Set(importedChannels.map((ch) => ch.url));
      const importedNotInFetched = importedChannels.filter(
        (ch) => !unique.some((fch) => fch.url === ch.url)
      );
      const merged = [...unique, ...importedNotInFetched];

      setChannels(merged);
      setHasFetched(true);

      const statuses: Record<string, ChannelStatus> = {};
      merged.forEach((ch) => {
        statuses[ch.id] = "untested";
      });
      setChannelStatuses(statuses);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setFetchError("Failed to fetch streams. Please try again.");
      console.error("Fetch error:", err);
    } finally {
      setIsFetching(false);
    }
  }, [importedChannels]);

  // Auto-fetch on mount
  useEffect(() => {
    console.log('🚀 App mounted');
    console.log('📂 Loaded favorites from localStorage:', favorites.size);
    console.log('📁 Loaded imported channels from localStorage:', importedChannels.length);
    fetchStreams();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchStreams]);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem("iptv-favorites", JSON.stringify([...favorites]));
  }, [favorites]);

  // Save imported channels to localStorage
  useEffect(() => {
    localStorage.setItem("iptv-imported-channels", JSON.stringify(importedChannels));
  }, [importedChannels]);

  // Toggle favorite
  const toggleFavorite = useCallback((channelId: string) => {
    console.log('🔔 Toggling favorite for channel:', channelId);
    setFavorites((prev) => {
      const next = new Set(prev);
      const isCurrentlyFavorite = next.has(channelId);
      if (isCurrentlyFavorite) {
        next.delete(channelId);
        console.log('❌ Removed from favorites. New count:', next.size);
        addToast('Removed from favorites', 'info');
      } else {
        next.add(channelId);
        console.log('✅ Added to favorites. New count:', next.size);
        addToast('Added to favorites! ⭐', 'success');
      }
      // Force save to localStorage immediately
      localStorage.setItem("iptv-favorites", JSON.stringify([...next]));
      return next;
    });
  }, [addToast]);

  // Clear all imported channels
  const clearImportedChannels = useCallback(() => {
    if (window.confirm("Are you sure you want to clear all imported channels? This cannot be undone.")) {
      setImportedChannels([]);
      setChannels((prev) => prev.filter((ch) => ch.source !== "imported"));
      setChannelStatuses((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if (key.startsWith("imported-")) {
            delete next[key];
          }
        });
        return next;
      });
      // Also remove any favorites that were for imported channels
      setFavorites((prev) => {
        const next = new Set(prev);
        // We can't easily know which favorites were imported, so we'll leave them
        return next;
      });
    }
  }, []);

  // Handle M3U import
  const handleImport = useCallback((newImportedChannels: Channel[]) => {
    console.log('📥 Importing channels:', newImportedChannels.length);
    
    // Save to persistent imported channels state
    setImportedChannels((prev) => {
      const existingUrls = new Set(prev.map((ch) => ch.url));
      const unique = newImportedChannels.filter((ch) => !existingUrls.has(ch.url));
      const updated = [...prev, ...unique];
      console.log('💾 Saving imported channels to state:', updated.length);
      // Force save to localStorage immediately
      localStorage.setItem("iptv-imported-channels", JSON.stringify(updated));
      console.log('✅ Imported channels saved to localStorage');
      return updated;
    });

    // Also add to the main channels list
    setChannels((prev) => {
      // Remove duplicates
      const existingUrls = new Set(prev.map((ch) => ch.url));
      const newChannels = newImportedChannels.filter((ch) => !existingUrls.has(ch.url));
      
      const updated = [...prev, ...newChannels];
      
      // Update statuses
      setChannelStatuses((prevStatuses) => {
        const newStatuses = { ...prevStatuses };
        newChannels.forEach((ch) => {
          newStatuses[ch.id] = "untested";
        });
        return newStatuses;
      });
      
      return updated;
    });

    // Auto-switch to show only imported channels after import
    setSelectedCountry("Imported");
    setSelectedCategory("All");
    setSearchQuery("");
    setShowOnlyLive(false);
    
    addToast(`Imported ${newImportedChannels.length} channels! 📁`, 'success');
  }, [addToast]);

  // Test all streams
  const testAllStreams = useCallback(async () => {
    if (channels.length === 0) return;

    // Create abort controller for this test run
    testAbortRef.current = new AbortController();

    setIsTesting(true);
    setHasTested(true);

    const testingStatuses: Record<string, ChannelStatus> = {};
    channels.forEach((ch) => {
      testingStatuses[ch.id] = "testing";
    });
    setChannelStatuses(testingStatuses);

    const results = await testStreams(
      channels,
      4,
      (tested, total) => {
        setTestProgress({ tested, total });
      },
      testAbortRef.current.signal
    );

    // Check if test was aborted
    const wasAborted = testAbortRef.current.signal.aborted;

    const newStatuses: Record<string, ChannelStatus> = {};
    results.forEach((result) => {
      newStatuses[result.channel.id] = result.isLive ? "live" : "dead";
    });
    setChannelStatuses(newStatuses);
    setIsTesting(false);
    
    if (wasAborted) {
      addToast('Testing aborted', 'info');
    }
    
    testAbortRef.current = null;
  }, [channels, addToast]);

  // Test only imported streams
  const testImportedStreams = useCallback(async () => {
    const importedChannels = channels.filter((ch) => ch.source === "imported");
    if (importedChannels.length === 0) return;

    // Create abort controller for this test run
    testAbortRef.current = new AbortController();

    setIsTesting(true);
    setHasTested(true);

    const testingStatuses: Record<string, ChannelStatus> = {};
    importedChannels.forEach((ch) => {
      testingStatuses[ch.id] = "testing";
    });
    setChannelStatuses((prev) => ({ ...prev, ...testingStatuses }));

    const results = await testStreams(
      importedChannels,
      4,
      (tested, total) => {
        setTestProgress({ tested, total });
      },
      testAbortRef.current.signal
    );

    // Check if test was aborted
    const wasAborted = testAbortRef.current.signal.aborted;

    const newStatuses: Record<string, ChannelStatus> = {};
    results.forEach((result) => {
      newStatuses[result.channel.id] = result.isLive ? "live" : "dead";
    });
    setChannelStatuses((prev) => ({ ...prev, ...newStatuses }));
    setIsTesting(false);
    
    if (wasAborted) {
      addToast('Testing aborted', 'info');
    }
    
    testAbortRef.current = null;
  }, [channels, addToast]);

  // Abort testing
  const abortTesting = useCallback(() => {
    if (testAbortRef.current) {
      testAbortRef.current.abort();
      testAbortRef.current = null;
    }
  }, []);

  // Remove all dead streams
  const removeDeadStreams = useCallback(() => {
    const deadChannels = channels.filter((ch) => channelStatuses[ch.id] === "dead");
    const deadCount = deadChannels.length;
    
    if (deadCount === 0) {
      addToast('No dead streams to remove', 'info');
      return;
    }

    // Remove dead channels from main list
    setChannels((prev) => prev.filter((ch) => channelStatuses[ch.id] !== "dead"));
    
    // Remove dead channels from imported channels
    setImportedChannels((prev) => {
      const updated = prev.filter((ch) => channelStatuses[ch.id] !== "dead");
      localStorage.setItem("iptv-imported-channels", JSON.stringify(updated));
      return updated;
    });
    
    // Clean up channel statuses
    setChannelStatuses((prev) => {
      const updated = { ...prev };
      deadChannels.forEach((ch) => delete updated[ch.id]);
      return updated;
    });

    addToast(`Removed ${deadCount} dead streams`, 'success');
  }, [channels, channelStatuses, addToast]);

  // Filter channels
  const filteredChannels = channels
    .filter((channel) => {
      const matchesCountry =
        selectedCountry === "All" ||
        channel.country === selectedCountry ||
        (selectedCountry === "Favorites" && favorites.has(channel.id));
      const matchesCategory = selectedCategory === "All" || channel.category === selectedCategory;
      const matchesSearch =
        searchQuery === "" ||
        channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        channel.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLive = !showOnlyLive || channelStatuses[channel.id] === "live";

      return matchesCountry && matchesCategory && matchesSearch && matchesLive;
    })
    .sort((a, b) => {
      // Sort favorites first
      const aFav = favorites.has(a.id) ? 1 : 0;
      const bFav = favorites.has(b.id) ? 1 : 0;
      return bFav - aFav;
    });

  const liveCount = Object.values(channelStatuses).filter((s) => s === "live").length;
  const deadCount = Object.values(channelStatuses).filter((s) => s === "dead").length;
  const importedCount = channels.filter((ch) => ch.source === "imported").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  IPTV Stream Finder
                </h1>
                <p className="text-xs text-gray-400">
                  USA • England • South Africa • Custom M3U
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 flex-wrap">
              {hasFetched && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <span className="text-blue-300 text-sm font-medium">{channels.length} Streams</span>
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <span className="text-yellow-300 text-sm font-medium">⭐ {favorites.size} Favorites</span>
              </div>
              {importedCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <span className="text-emerald-300 text-sm font-medium">📁 {importedCount} Imported</span>
                  <button
                    onClick={clearImportedChannels}
                    className="text-emerald-400/60 hover:text-red-400 transition-colors"
                    title="Clear all imported channels"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              {hasTested && (
                <>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    <span className="text-green-300 text-sm font-medium">{liveCount} Live</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                    <span className="text-red-300 text-sm font-medium">{deadCount} Offline</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Fetch Status */}
        {isFetching && (
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3">
            <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-blue-300 text-sm">Fetching streams from iptv-org/iptv repository...</span>
          </div>
        )}

        {fetchError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between">
            <span className="text-red-300 text-sm">{fetchError}</span>
            <button
              onClick={fetchStreams}
              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-xs transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Search and Filter Bar */}
        <div className="mb-6 space-y-4">
          {/* Search + Actions */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search channels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Import M3U
              </button>

              <button
                onClick={fetchStreams}
                disabled={isFetching}
                className={`px-4 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
                  isFetching
                    ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                    : "bg-gray-700 hover:bg-gray-600 text-white border border-gray-600"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>

              {importedCount > 0 && (
                <button
                  onClick={testImportedStreams}
                  disabled={isTesting}
                  className={`px-4 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
                    isTesting
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-500/20"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Test Imported
                </button>
              )}

              <button
                onClick={testAllStreams}
                disabled={isTesting || channels.length === 0}
                className={`px-6 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
                  isTesting || channels.length === 0
                    ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
                }`}
              >
                {isTesting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Testing {testProgress.tested}/{testProgress.total}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Test All
                  </>
                )}
              </button>

              {isTesting && (
                <button
                  onClick={abortTesting}
                  className="px-4 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 animate-pulse"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6h12M6 12h12M6 18h12" />
                  </svg>
                  Abort
                </button>
              )}

              {hasTested && deadCount > 0 && (
                <button
                  onClick={removeDeadStreams}
                  className="px-4 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Remove Dead ({deadCount})
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Country Filter */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Country:</span>
              <div className="flex gap-1">
                {COUNTRIES.map((country) => (
                  <button
                    key={country}
                    onClick={() => setSelectedCountry(country)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                      selectedCountry === country
                        ? country === "Favorites"
                          ? "bg-yellow-600 text-white shadow-lg shadow-yellow-500/20"
                          : "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                        : "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-700/50"
                    }`}
                  >
                    {country === "Favorites" && <span>⭐</span>}
                    {country}
                    {country === "Favorites" && favorites.size > 0 && (
                      <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">
                        {favorites.size}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Category:</span>
              <div className="flex gap-1 flex-wrap">
                {CATEGORIES.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedCategory === category
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
                        : "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-700/50"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Only Toggle */}
            <button
              onClick={() => setShowOnlyLive(!showOnlyLive)}
              className={`ml-auto px-4 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                showOnlyLive
                  ? "bg-green-600 text-white shadow-lg shadow-green-500/20"
                  : "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-700/50"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showOnlyLive ? "bg-green-300 animate-pulse" : "bg-gray-500"}`}></span>
              Live Only
            </button>
          </div>

          {/* Progress Bar */}
          {isTesting && (
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${(testProgress.tested / testProgress.total) * 100}%` }}
              ></div>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <p className="text-gray-400 text-sm">
            Showing <span className="text-white font-medium">{filteredChannels.length}</span> channels
            {showOnlyLive && <span className="text-green-400"> (live only)</span>}
          </p>
          {!hasTested && hasFetched && (
            <p className="text-yellow-400/80 text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Click "Test All" to verify which channels are live
            </p>
          )}
        </div>

        {/* View Toggle */}
        {channels.length > 0 && (
          <div className="mb-4 flex justify-end">
            <div className="flex gap-2 bg-gray-800/50 p-1 rounded-lg border border-gray-700/50">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  viewMode === "grid"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : "text-gray-300 hover:bg-gray-700/50"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Grid
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  viewMode === "list"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : "text-gray-300 hover:bg-gray-700/50"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                List
              </button>
            </div>
          </div>
        )}

        {/* Channel Grid/List */}
        {channels.length > 0 ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredChannels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  status={channelStatuses[channel.id] || "untested"}
                  onPlay={setSelectedChannel}
                  isFavorite={favorites.has(channel.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredChannels.map((channel) => (
                <ChannelListItem
                  key={channel.id}
                  channel={channel}
                  status={channelStatuses[channel.id] || "untested"}
                  onPlay={setSelectedChannel}
                  isFavorite={favorites.has(channel.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          )
        ) : (
          !isFetching && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">📡</div>
              <h3 className="text-xl font-medium text-gray-300 mb-2">Loading streams...</h3>
              <p className="text-gray-500">Fetching from iptv-org/iptv repository</p>
            </div>
          )
        )}

        {/* Empty State */}
        {filteredChannels.length === 0 && channels.length > 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📺</div>
            <h3 className="text-xl font-medium text-gray-300 mb-2">No channels found</h3>
            <p className="text-gray-500">Try adjusting your filters or search query</p>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 p-6 bg-gray-800/30 border border-gray-700/30 rounded-2xl">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            About IPTV Stream Finder
          </h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-400">
            <div className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">🔍</span>
              <p>Streams are fetched from the <a href="https://github.com/iptv-org/iptv" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">iptv-org/iptv</a> repository plus your own imported M3U files.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">📁</span>
              <p>Import your own M3U playlists (like scraped_live_streams.m3u) via the "Import M3U" button. Imported channels are <strong className="text-emerald-300">saved automatically</strong> and will be available next time you open the app.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✅</span>
              <p>Click "Test All" to verify which channels are live. Dead links are hidden with the "Live Only" filter. Click any card to watch.</p>
            </div>
          </div>
          
          {/* Debug Info */}
          <div className="mt-4 pt-4 border-t border-gray-700/30">
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-300 transition-colors">
                🔧 Debug Info (click to expand)
              </summary>
              <div className="mt-2 space-y-1 text-gray-500 font-mono">
                <div>Favorites in state: {favorites.size}</div>
                <div>Favorites in localStorage: {localStorage.getItem("iptv-favorites") ? JSON.parse(localStorage.getItem("iptv-favorites")!).length : 0}</div>
                <div>Imported channels in state: {importedChannels.length}</div>
                <div>Imported channels in localStorage: {localStorage.getItem("iptv-imported-channels") ? JSON.parse(localStorage.getItem("iptv-imported-channels")!).length : 0}</div>
                <div>Total channels loaded: {channels.length}</div>
                <button
                  onClick={() => {
                    console.log('=== DEBUG INFO ===');
                    console.log('Favorites in state:', favorites.size, [...favorites]);
                    console.log('Favorites in localStorage:', localStorage.getItem("iptv-favorites"));
                    console.log('Imported channels in state:', importedChannels.length);
                    console.log('Imported channels in localStorage:', localStorage.getItem("iptv-imported-channels"));
                    console.log('Total channels:', channels.length);
                    console.log('==================');
                    addToast('Debug info logged to console', 'info');
                  }}
                  className="mt-2 px-3 py-1 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded text-xs transition-colors"
                >
                  Log to Console
                </button>
              </div>
            </details>
          </div>
        </div>
      </main>

      {/* Video Player Modal */}
      <VideoPlayer 
        channel={selectedChannel} 
        channels={channels}
        favorites={favorites}
        onClose={() => setSelectedChannel(null)} 
        onChannelChange={setSelectedChannel}
      />

      {/* M3U Import Modal */}
      <M3UImport
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        currentImportedCount={importedChannels.length}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}

export default App;
