import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Channel } from "../types";

interface VideoPlayerProps {
  channel: Channel | null;
  channels: Channel[];
  onClose: () => void;
  onChannelChange: (channel: Channel) => void;
  favorites: Set<string>;
}

export default function VideoPlayer({ channel, channels, onClose, onChannelChange, favorites }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChannelList, setShowChannelList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  useEffect(() => {
    if (!channel || !videoRef.current) return;

    const video = videoRef.current;
    setError(null);
    setIsLoading(true);
    setIsPlaying(false);

    // Clean up previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const url = channel.url;
    let loadTimeout: ReturnType<typeof setTimeout>;

    // Determine if this is an HLS stream
    const isHLS = url.includes(".m3u8") || 
                  url.includes("/hls/") || 
                  url.includes("/live/") ||
                  url.includes("master.m3u8") ||
                  url.includes("playlist.m3u8") ||
                  url.includes("/manifest") ||
                  url.includes("index.m3u8");

    // Set a loading timeout - use a flag to track if we've already resolved
    let didLoad = false;
    loadTimeout = setTimeout(() => {
      if (!didLoad) {
        // If still loading after 15 seconds, show error
        setError("Stream is taking too long to load. It may be offline or geo-blocked.");
        setIsLoading(false);
      }
    }, 15000);

    const handleLoadSuccess = () => {
      didLoad = true;
      clearTimeout(loadTimeout);
      setIsLoading(false);
      video.play().then(() => setIsPlaying(true)).catch(() => {
        // Retry play after short delay
        setTimeout(() => {
          video.play().then(() => setIsPlaying(true)).catch(() => {});
        }, 100);
      });
    };

    const handleError = (msg?: string) => {
      didLoad = true;
      clearTimeout(loadTimeout);
      setIsLoading(false);
      setError(msg || "Stream unavailable. The channel may be offline or geo-blocked.");
    };

    if (isHLS) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          xhrSetup: (xhr) => {
            xhr.timeout = 15000;
          },
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
        });

        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          handleLoadSuccess();
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          console.log("HLS Error:", data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                // Try to recover once
                if (retryCount < 2) {
                  setRetryCount(c => c + 1);
                  hls.startLoad();
                } else {
                  // Last resort: try native video element
                  hls.destroy();
                  hlsRef.current = null;
                  video.src = url;
                  video.addEventListener("loadeddata", handleLoadSuccess);
                  video.addEventListener("error", () => handleError("Network error - stream may be offline or geo-blocked"));
                  video.load();
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                handleError("Stream unavailable");
                break;
            }
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS support (Safari)
        video.src = url;
        video.addEventListener("loadedmetadata", handleLoadSuccess);
        video.addEventListener("canplay", handleLoadSuccess);
        video.addEventListener("error", () => handleError());
        video.load();
      } else {
        // Fallback: try native video element anyway
        video.src = url;
        video.addEventListener("loadeddata", handleLoadSuccess);
        video.addEventListener("canplay", handleLoadSuccess);
        video.addEventListener("error", () => handleError("HLS playback not supported in this browser"));
        video.load();
      }
    } else {
      // Direct stream URL - try native video element
      video.src = url;
      video.addEventListener("loadeddata", handleLoadSuccess);
      video.addEventListener("canplay", handleLoadSuccess);
      video.addEventListener("error", (e) => {
        console.log("Video error:", e);
        handleError();
      });
      video.load();
    }

    return () => {
      clearTimeout(loadTimeout);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [channel, retryCount]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    setRetryCount(c => c + 1);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Handle escape key - always close player and exit fullscreen in one press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Exit fullscreen if active
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        // Always close the player and return to main screen
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Filter channels based on search and favorites
  const filteredChannels = channels.filter((ch) => {
    const matchesSearch = ch.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFavorites = !showOnlyFavorites || favorites.has(ch.id);
    return matchesSearch && matchesFavorites;
  });

  // Sort: favorites first, then by name
  const sortedChannels = [...filteredChannels].sort((a, b) => {
    const aFav = favorites.has(a.id) ? 1 : 0;
    const bFav = favorites.has(b.id) ? 1 : 0;
    if (aFav !== bFav) return bFav - aFav;
    return a.name.localeCompare(b.name);
  });

  if (!channel) return null;

  return (
    <div ref={containerRef} className={`fixed inset-0 z-50 flex flex-col ${isFullscreen ? 'bg-black' : 'bg-black/90 backdrop-blur-sm p-4'}`}>
      <div className={`w-full ${isFullscreen ? 'h-full' : 'max-w-6xl mx-auto'} bg-gray-900 ${isFullscreen ? '' : 'rounded-2xl'} overflow-hidden shadow-2xl border border-gray-700 flex flex-col ${isFullscreen ? 'h-full' : ''}`}>
        
        {/* Channel List Overlay */}
        {showChannelList && (
          <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col">
            {/* Channel List Header */}
            <div className="p-4 md:p-6 border-b border-gray-700 bg-gray-900/95 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => {
                    if (document.fullscreenElement) {
                      document.exitFullscreen().catch(() => {});
                    }
                    onClose();
                  }}
                  className="flex items-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors text-base font-medium"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Close
                </button>
                <h2 className="text-white font-bold text-2xl">Channels</h2>
                <div className="w-24"></div>
              </div>

              {/* Search and Filter */}
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search channels..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <button
                  onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                  className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                    showOnlyFavorites
                      ? "bg-yellow-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  <svg className="w-5 h-5" fill={showOnlyFavorites ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  Favorites
                </button>
              </div>
            </div>

            {/* Channel List */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {sortedChannels.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">📺</div>
                  <p className="text-gray-400 text-lg">No channels found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedChannels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => {
                        onChannelChange(ch);
                        setShowChannelList(false);
                      }}
                      className={`w-full text-left p-4 rounded-xl transition-all flex items-center gap-4 ${
                        ch.id === channel.id
                          ? "bg-blue-600/20 border-2 border-blue-500"
                          : "bg-gray-800/50 hover:bg-gray-700/50 border-2 border-transparent"
                      }`}
                    >
                      {/* Country Flag */}
                      <span className="text-3xl shrink-0">
                        {ch.country === "USA" ? "🇺🇸" : ch.country === "England" ? "🏴󠁧󠁢󠁥󠁮󠁧󠁿" : ch.country === "South Africa" ? "🇿🇦" : ch.country === "Imported" ? "📁" : "🌍"}
                      </span>

                      {/* Channel Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-lg truncate">{ch.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-gray-400 text-sm">{ch.category}</span>
                          {ch.source === "imported" && (
                            <span className="px-2 py-0.5 rounded text-xs bg-emerald-900/50 text-emerald-300 border border-emerald-700/30">
                              📁 Imported
                            </span>
                          )}
                          {favorites.has(ch.id) && (
                            <span className="text-yellow-400">⭐</span>
                          )}
                        </div>
                      </div>

                      {/* Currently Playing Indicator */}
                      {ch.id === channel.id && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                          <span className="text-green-400 font-medium">Now Playing</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Header - TV Friendly - Hidden in fullscreen */}
        {!isFullscreen && (
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-700 bg-gray-900/95 backdrop-blur-sm shrink-0">
            <button
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen().catch(() => {});
                }
                onClose();
              }}
              className="flex items-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors text-base font-medium"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
            
            <div className="flex items-center gap-3 flex-1 justify-center">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <div className="text-center">
                <h3 className="text-white font-bold text-xl md:text-2xl truncate max-w-md">{channel.name}</h3>
                <p className="text-gray-400 text-sm md:text-base">
                  {channel.country} • {channel.category}
                  {channel.source === "imported" && " • 📁 Imported"}
                </p>
              </div>
            </div>

            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors text-base font-medium"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Fullscreen
            </button>
          </div>
        )}

        {/* Video Container */}
        <div className={`relative ${isFullscreen ? 'flex-1' : 'aspect-video'} bg-black`}>
          <video
            ref={videoRef}
            className="w-full h-full"
            playsInline
            controls
            autoPlay
          />

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-white text-lg">Connecting to stream...</p>
                <p className="text-gray-400 text-base mt-2">This may take a moment</p>
              </div>
            </div>
          )}

          {/* Error Overlay */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center p-8">
                <div className="text-6xl mb-4">📡</div>
                <p className="text-red-400 font-bold text-2xl mb-3">Stream Error</p>
                <p className="text-gray-400 text-lg mb-6 max-w-lg">{error}</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleRetry}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-lg font-medium transition-colors"
                  >
                    🔄 Retry
                  </button>
                  <button
                    onClick={() => {
                      if (document.fullscreenElement) {
                        document.exitFullscreen().catch(() => {});
                      }
                      onClose();
                    }}
                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-lg font-medium transition-colors"
                  >
                    ← Back
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Controls Bar - TV Friendly - Hidden in fullscreen */}
        {!isFullscreen && (
          <div className="p-4 md:p-6 flex items-center justify-between bg-gray-900/95 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlay}
                className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-base font-medium"
              >
                {isPlaying ? (
                  <>
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                    Pause
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Play
                  </>
                )}
              </button>
              <span className="text-gray-300 text-base md:text-lg">
                {isPlaying ? "▶ Playing Live" : "⏸ Paused"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowChannelList(true)}
                className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors text-base font-medium"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Channels
              </button>
              {channel.source === "imported" && (
                <span className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm md:text-base font-medium">
                  📁 Imported
                </span>
              )}
              <span className="inline-flex items-center gap-2 px-3 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm md:text-base font-medium">
                <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                LIVE
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
