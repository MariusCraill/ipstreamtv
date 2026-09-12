export interface Channel {
  id: string;
  name: string;
  country: string;
  category: string;
  url: string;
  logo?: string;
  language: string;
  source: "iptv-org" | "imported" | "curated";
}

export type ChannelStatus = "untested" | "testing" | "live" | "dead";

export interface StreamTestResult {
  channel: Channel;
  isLive: boolean;
  responseTime?: number;
  error?: string;
}
