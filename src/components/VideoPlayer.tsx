import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Channel } from "../types";

interface VideoPlayerProps {
  channel: Channel | null;
  onClose: () => void;
}

export default function VideoPlayer({ channel, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

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

    if (url.includes(".m3u8")) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          xhrSetup: (xhr) => {
            xhr.timeout = 10000;
          },
        });

        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          video.play().then(() => setIsPlaying(true)).catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setError("Network error - stream may be offline");
                setIsLoading(false);
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                setError("Stream unavailable");
                setIsLoading(false);
                break;
            }
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS support (Safari)
        video.src = url;
        video.addEventListener("loadedmetadata", () => {
          setIsLoading(false);
          video.play().then(() => setIsPlaying(true)).catch(() => {});
        });
        video.addEventListener("error", () => {
          setError("Stream unavailable");
          setIsLoading(false);
        });
      } else {
        setError("HLS not supported in this browser");
        setIsLoading(false);
      }
    } else {
      // Direct stream URL
      video.src = url;
      video.addEventListener("loadeddata", () => {
        setIsLoading(false);
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      });
      video.addEventListener("error", () => {
        setError("Stream unavailable");
        setIsLoading(false);
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  if (!channel) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <div>
              <h3 className="text-white font-semibold text-lg">{channel.name}</h3>
              <p className="text-gray-400 text-sm">
                {channel.country} • {channel.category}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video Container */}
        <div className="relative aspect-video bg-black">
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
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-white text-sm">Connecting to stream...</p>
              </div>
            </div>
          )}

          {/* Error Overlay */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <div className="text-center p-6">
                <div className="text-4xl mb-3">📡</div>
                <p className="text-red-400 font-medium mb-2">Stream Error</p>
                <p className="text-gray-400 text-sm">{error}</p>
                <button
                  onClick={onClose}
                  className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Controls Bar */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <span className="text-gray-300 text-sm">
              {isPlaying ? "Playing Live" : "Paused"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              LIVE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
