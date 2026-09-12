import { Channel, ChannelStatus } from "../types";

interface ChannelCardProps {
  channel: Channel;
  status: ChannelStatus;
  onPlay: (channel: Channel) => void;
  isFavorite: boolean;
  onToggleFavorite: (channelId: string) => void;
}

export default function ChannelCard({ channel, status, onPlay, isFavorite, onToggleFavorite }: ChannelCardProps) {
  const getCountryFlag = (country: string) => {
    switch (country) {
      case "USA": return "🇺🇸";
      case "England": return "🏴󠁧󠁢󠁥󠁮󠁧󠁿";
      case "South Africa": return "🇿🇦";
      case "Imported": return "📁";
      default: return "🌍";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "News": return "bg-red-500/20 text-red-300 border-red-500/30";
      case "Sports": return "bg-green-500/20 text-green-300 border-green-500/30";
      case "Entertainment": return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "Music": return "bg-pink-500/20 text-pink-300 border-pink-500/30";
      case "Kids": return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      case "Weather": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "Business": return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "Science": return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
      case "Documentary": return "bg-teal-500/20 text-teal-300 border-teal-500/30";
      case "Religion": return "bg-orange-500/20 text-orange-300 border-orange-500/30";
      case "Lifestyle": return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "Shopping": return "bg-rose-500/20 text-rose-300 border-rose-500/30";
      case "Movies": return "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";
      case "Comedy": return "bg-lime-500/20 text-lime-300 border-lime-500/30";
      case "Drama": return "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30";
      case "Classic": return "bg-stone-500/20 text-stone-300 border-stone-500/30";
      case "Family": return "bg-sky-500/20 text-sky-300 border-sky-500/30";
      case "Animation": return "bg-violet-500/20 text-violet-300 border-violet-500/30";
      case "Gaming": return "bg-red-600/20 text-red-300 border-red-600/30";
      case "Culture": return "bg-amber-600/20 text-amber-300 border-amber-600/30";
      default: return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
  };

  const getSourceBadge = () => {
    switch (channel.source) {
      case "iptv-org":
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-900/50 text-blue-300 border border-blue-700/30">
            iptv-org
          </span>
        );
      case "imported":
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-900/50 text-emerald-300 border border-emerald-700/30">
            📁 Imported
          </span>
        );
      default:
        return null;
    }
  };

  const getStatusIndicator = () => {
    switch (status) {
      case "testing":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded-full text-xs shrink-0">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
            Testing
          </span>
        );
      case "live":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full text-xs shrink-0">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Live
          </span>
        );
      case "dead":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-300 rounded-full text-xs shrink-0">
            <span className="w-2 h-2 bg-red-400 rounded-full"></span>
            Offline
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-500/20 text-gray-300 rounded-full text-xs shrink-0">
            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
            Untested
          </span>
        );
    }
  };

  return (
    <div
      className={`group relative bg-gray-800/50 backdrop-blur-sm border rounded-xl p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/10 ${
        isFavorite
          ? "border-yellow-500/40 bg-yellow-500/5"
          : status === "dead"
          ? "border-red-500/20 opacity-60"
          : status === "live"
          ? "border-green-500/30 hover:border-green-500/50"
          : "border-gray-700/50 hover:border-blue-500/50"
      }`}
    >
      {/* Play Button Overlay */}
      {status !== "dead" && (
        <button
          onClick={() => onPlay(channel)}
          className="absolute inset-0 flex items-center justify-center bg-blue-600/0 group-hover:bg-blue-600/10 rounded-xl transition-all duration-300 opacity-0 group-hover:opacity-100 z-10"
        >
          <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-600/30 transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </button>
      )}

      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">{getCountryFlag(channel.country)}</span>
          <h3 className="text-white font-medium text-sm leading-tight truncate">
            {channel.name}
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(channel.id);
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all text-xs font-medium ${
              isFavorite
                ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/30"
                : "bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:bg-yellow-500/20 hover:text-yellow-300 hover:border-yellow-500/30"
            }`}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <svg className="w-3.5 h-3.5" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            {isFavorite ? "Favorited" : "Favorite"}
          </button>
          {getStatusIndicator()}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-2 py-0.5 rounded-full text-xs border ${getCategoryColor(channel.category)}`}>
          {channel.category}
        </span>
        {getSourceBadge()}
      </div>

      {/* Quick Play Button */}
      {status !== "dead" && (
        <button
          onClick={() => onPlay(channel)}
          className="mt-3 w-full py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-lg text-xs font-medium transition-colors border border-blue-500/20 hover:border-blue-500/40"
        >
          ▶ Watch Now
        </button>
      )}
    </div>
  );
}
