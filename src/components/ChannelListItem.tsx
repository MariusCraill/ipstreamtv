import { Channel, ChannelStatus } from "../types";

interface ChannelListItemProps {
  channel: Channel;
  status: ChannelStatus;
  onPlay: (channel: Channel) => void;
  isFavorite: boolean;
  onToggleFavorite: (channelId: string) => void;
}

export default function ChannelListItem({ channel, status, onPlay, isFavorite, onToggleFavorite }: ChannelListItemProps) {
  const getCountryFlag = (country: string) => {
    switch (country) {
      case "USA": return "🇺🇸";
      case "England": return "🏴󠁧󠁢󠁥󠁮󠁧󠁿";
      case "South Africa": return "🇿🇦";
      case "Imported": return "📁";
      default: return "🌍";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "live": return "bg-green-500";
      case "dead": return "bg-red-500";
      case "testing": return "bg-yellow-500 animate-pulse";
      default: return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "live": return "Live";
      case "dead": return "Offline";
      case "testing": return "Testing";
      default: return "Untested";
    }
  };

  return (
    <div
      className={`group relative bg-gray-800/50 backdrop-blur-sm border rounded-xl p-4 transition-all duration-300 hover:bg-gray-700/50 ${
        isFavorite
          ? "border-yellow-500/40 bg-yellow-500/5"
          : status === "dead"
          ? "border-red-500/20 opacity-60"
          : status === "live"
          ? "border-green-500/30"
          : "border-gray-700/50"
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Country Flag */}
        <span className="text-3xl shrink-0">{getCountryFlag(channel.country)}</span>

        {/* Channel Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-lg leading-tight mb-1">
            {channel.name}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-400 text-sm">{channel.category}</span>
            {channel.source === "imported" && (
              <span className="px-2 py-0.5 rounded text-xs bg-emerald-900/50 text-emerald-300 border border-emerald-700/30">
                📁 Imported
              </span>
            )}
            {channel.source === "iptv-org" && (
              <span className="px-2 py-0.5 rounded text-xs bg-blue-900/50 text-blue-300 border border-blue-700/30">
                iptv-org
              </span>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 shrink-0">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
          <span className="text-gray-300 text-sm font-medium">{getStatusText()}</span>
        </div>

        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(channel.id);
          }}
          className={`p-2 rounded-lg transition-all ${
            isFavorite
              ? "text-yellow-400 hover:text-yellow-300 bg-yellow-500/10"
              : "text-gray-500 hover:text-yellow-400 hover:bg-gray-700/50"
          }`}
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <svg className="w-6 h-6" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>

        {/* Play Button */}
        {status !== "dead" && (
          <button
            onClick={() => onPlay(channel)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-base font-medium shrink-0"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Watch
          </button>
        )}
      </div>
    </div>
  );
}
