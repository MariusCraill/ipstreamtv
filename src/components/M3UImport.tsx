import { useState, useRef, useCallback } from "react";
import { Channel } from "../types";
import { parseM3UFile, parseM3U } from "../utils/m3uParser";

interface M3UImportProps {
  onImport: (channels: Channel[]) => void;
  isOpen: boolean;
  onClose: () => void;
  currentImportedCount?: number;
}

export default function M3UImport({ onImport, isOpen, onClose, currentImportedCount = 0 }: M3UImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; fileName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasteContent, setPasteContent] = useState("");
  const [activeTab, setActiveTab] = useState<"file" | "paste" | "url">("file");
  const [urlInput, setUrlInput] = useState("");
  const [urlCountry, setUrlCountry] = useState("Imported");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setImportResult(null);

    try {
      const file = files[0];
      
      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        throw new Error("File too large. Maximum size is 50MB");
      }

      // Read and parse the file
      const channels = await parseM3UFile(file);
      
      if (channels.length === 0) {
        throw new Error(
          `No valid streams found in "${file.name}". Make sure the file is in M3U/M3U8 format with valid stream URLs (http:// or https://).`
        );
      }

      setImportResult({ count: channels.length, fileName: file.name });
      onImport(channels);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse M3U file");
    } finally {
      setIsProcessing(false);
    }
  }, [onImport]);

  const handlePasteImport = useCallback(() => {
    if (!pasteContent.trim()) {
      setError("Please paste M3U content first");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setImportResult(null);

    try {
      const channels = parseM3U(pasteContent, "Imported", "imported");
      
      if (channels.length === 0) {
        throw new Error("No valid streams found in pasted content");
      }

      setImportResult({ count: channels.length, fileName: "Pasted Content" });
      onImport(channels);
      setPasteContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse pasted content");
    } finally {
      setIsProcessing(false);
    }
  }, [pasteContent, onImport]);

  const handleUrlImport = useCallback(async () => {
    if (!urlInput.trim()) {
      setError("Please enter a URL");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setImportResult(null);

    try {
      const response = await fetch(urlInput);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const channels = parseM3U(text, urlCountry || "Imported", "imported");
      
      if (channels.length === 0) {
        throw new Error("No valid streams found at the URL");
      }

      setImportResult({ count: channels.length, fileName: urlInput });
      onImport(channels);
      setUrlInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch M3U from URL");
    } finally {
      setIsProcessing(false);
    }
  }, [urlInput, urlCountry, onImport]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">Import M3U Playlist</h3>
              <p className="text-gray-400 text-sm">
                Load your own .m3u files for streaming
                {currentImportedCount > 0 && (
                  <span className="text-emerald-400 ml-1">
                    • {currentImportedCount} saved
                  </span>
                )}
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

        {/* Content */}
        <div className="p-5">
          {/* Tabs */}
          <div className="flex gap-1 mb-5 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("file")}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "file"
                  ? "bg-gray-700 text-white shadow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              📁 Upload File
            </button>
            <button
              onClick={() => setActiveTab("paste")}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "paste"
                  ? "bg-gray-700 text-white shadow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              📋 Paste Content
            </button>
            <button
              onClick={() => setActiveTab("url")}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "url"
                  ? "bg-gray-700 text-white shadow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              🔗 From URL
            </button>
          </div>

          {/* File Upload Tab */}
          {activeTab === "file" && (
            <div>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-gray-600 hover:border-gray-500 bg-gray-800/30"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".m3u,.m3u8,.txt,*/*"
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                />
                <div className="text-4xl mb-3">
                  {isDragging ? "📂" : "📄"}
                </div>
                <p className="text-white font-medium mb-1">
                  {isDragging ? "Drop your file here" : "Drag & drop your M3U file"}
                </p>
                <p className="text-gray-400 text-sm mb-3">
                  or click to browse
                </p>
                <p className="text-gray-500 text-xs">
                  Supports .m3u, .m3u8, .txt files (max 50MB) • e.g., scraped_live_streams.m3u
                </p>
              </div>
            </div>
          )}

          {/* Paste Tab */}
          {activeTab === "paste" && (
            <div>
              <textarea
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                placeholder={`Paste your M3U content here...\n\n#EXTM3U\n#EXTINF:-1 tvg-id="CNN.us" group-title="News",CNN\nhttps://example.com/stream.m3u8`}
                className="w-full h-48 p-4 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm font-mono placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
              />
              <button
                onClick={handlePasteImport}
                disabled={isProcessing || !pasteContent.trim()}
                className="mt-3 w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-xl font-medium transition-colors"
              >
                {isProcessing ? "Processing..." : "Import Pasted Content"}
              </button>
            </div>
          )}

          {/* URL Tab */}
          {activeTab === "url" && (
            <div className="space-y-3">
              <div>
                <label className="block text-gray-300 text-sm mb-1.5">M3U Playlist URL</label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/playlist.m3u"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1.5">Default Country (optional)</label>
                <input
                  type="text"
                  value={urlCountry}
                  onChange={(e) => setUrlCountry(e.target.value)}
                  placeholder="e.g., USA, England, South Africa"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <button
                onClick={handleUrlImport}
                disabled={isProcessing || !urlInput.trim()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-xl font-medium transition-colors"
              >
                {isProcessing ? "Fetching..." : "Fetch & Import"}
              </button>
            </div>
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <div className="mt-4 flex items-center gap-3 text-blue-300">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm">Parsing M3U content...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Success */}
          {importResult && (
            <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-emerald-300 text-sm">
                    Successfully imported <strong>{importResult.count}</strong> streams
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-medium transition-colors"
                >
                  View Channels →
                </button>
              </div>
              <p className="text-emerald-400/70 text-xs mt-2 ml-7">
                💡 Your imported channels are saved and will be available next time you open the app. Click any channel to play it directly, or use "Test Imported" to check which are live.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-700 bg-gray-800/30">
          <p className="text-gray-500 text-xs text-center">
            💡 Tip: You can import M3U files from services like scraped_live_streams.m3u, iptv-org playlists, or any standard M3U format
          </p>
        </div>
      </div>
    </div>
  );
}
