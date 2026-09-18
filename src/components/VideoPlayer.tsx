import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Channel } from "../types";

interface VideoPlayerProps {
  channel: Channel | null;
  onClose: () => void;
}

export default function VideoPlayer({ channel, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Handle escape key to close player
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          document.exitFullscreen();
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, onClose]);

  if (!channel) return null;

  return (
    <div ref={containerRef} className={`fixed inset-0 z-50 flex flex-col ${isFullscreen ? 'bg-black' : 'bg-black/90 backdrop-blur-sm p-4'}`}>
      <div className={`w-full ${isFullscreen ? 'h-full' : 'max-w-6xl mx-auto'} bg-gray-900 ${isFullscreen ? '' : 'rounded-2xl'} overflow-hidden shadow-2xl border border-gray-700 flex flex-col ${isFullscreen ? 'h-full' : ''}`}>
        {/* Header - TV Friendly */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-700 bg-gray-900/95 backdrop-blur-sm shrink-0">
          <button
            onClick={onClose}
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
            {isFullscreen ? (
              <>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                </svg>
                Exit Fullscreen
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                Fullscreen
              </>
            )}
          </button>
        </div>

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
                    onClick={onClose}
                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-lg font-medium transition-colors"
                  >
                    ← Back
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Controls Bar - TV Friendly */}
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
      </div>
    </div>
  );
}
