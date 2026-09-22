import { Channel } from "../types";

/**
 * Parse M3U/M3U8 playlist content into Channel objects.
 * Handles various formats including:
 * - Standard #EXTINF with tvg-id, tvg-logo, tvg-name, group-title attributes
 * - Simple format with just URLs
 * - Files with different line endings (CRLF, LF)
 * - Files with #EXTVLCOPT lines (VLC options)
 * - Files with #EXTGRP lines
 * - Files with various URL formats
 */
export function parseM3U(content: string, defaultCountry: string = "Imported", source: "iptv-org" | "imported" | "curated" = "imported"): Channel[] {
  // Normalize line endings
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const channels: Channel[] = [];
  let currentChannel: Partial<Channel> | null = null;
  let idx = 0;
  let currentGroup = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and header
    if (!line || line === "#EXTM3U") continue;

    // Skip VLC options and other metadata lines
    if (line.startsWith("#EXTVLCOPT") || line.startsWith("#KODIPROP")) continue;

    // Handle EXTGRP (group for next channel)
    if (line.startsWith("#EXTGRP:")) {
      currentGroup = line.substring(8).trim();
      continue;
    }

    if (line.startsWith("#EXTINF:")) {
      // Parse #EXTINF line
      // Format: #EXTINF:-1 tvg-id="..." tvg-logo="..." tvg-name="..." group-title="...",Channel Name (720p)
      const nameMatch = line.match(/,(.+)$/);
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupMatch = line.match(/group-title="([^"]*)"/);
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
      const countryMatch = line.match(/tvg-country="([^"]*)"/);
      const languageMatch = line.match(/tvg-language="([^"]*)"/);

      let name = nameMatch ? nameMatch[1].trim() : "";
      
      // If no name after comma, try tvg-name
      if (!name && tvgNameMatch) {
        name = tvgNameMatch[1].trim();
      }

      // If still no name, try tvg-id
      if (!name && tvgIdMatch) {
        name = tvgIdMatch[1].trim();
      }

      // Clean up resolution info and tags from name
      name = name
        .replace(/\s*\(\d+p\)\s*/gi, "")
        .replace(/\s*\[.*?\]\s*/g, "")
        .replace(/\s*\(SD\)\s*/gi, "")
        .replace(/\s*\(HD\)\s*/gi, "")
        .replace(/\s*\(FHD\)\s*/gi, "")
        .replace(/\s*\(4K\)\s*/gi, "")
        .trim();

      if (!name) continue;

      // Determine country
      let country = defaultCountry;
      if (countryMatch && countryMatch[1]) {
        country = mapCountryCode(countryMatch[1]);
      } else if (tvgIdMatch && tvgIdMatch[1]) {
        // Try to extract country from tvg-id (e.g., "CNN.us@US")
        const idCountryMatch = tvgIdMatch[1].match(/\.([a-z]{2})(@|$)/i);
        if (idCountryMatch) {
          country = mapCountryCode(idCountryMatch[1]);
        }
      }

      // Determine category from group-title or EXTGRP
      const group = groupMatch ? groupMatch[1] : currentGroup;
      currentGroup = ""; // Reset for next channel

      currentChannel = {
        name,
        logo: logoMatch ? logoMatch[1] : undefined,
        category: group ? mapCategory(group) : "Other",
        country,
        language: languageMatch ? languageMatch[1] : "English",
        source,
      };
    } else if (!line.startsWith("#") && currentChannel) {
      // This is a URL line
      // Accept ALL http/https URLs (not just .m3u8)
      if (line.startsWith("http://") || line.startsWith("https://")) {
        currentChannel.url = line;
        currentChannel.id = `${source}-${idx++}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        channels.push(currentChannel as Channel);
      }
      currentChannel = null;
    } else if (!line.startsWith("#") && !currentChannel) {
      // URL without preceding EXTINF - create a basic channel entry
      if (line.startsWith("http://") || line.startsWith("https://")) {
        // Try to extract name from URL
        const urlParts = line.split("/");
        const lastPart = urlParts[urlParts.length - 1] || "";
        const secondLast = urlParts[urlParts.length - 2] || "";
        const fileName = lastPart.includes(".") ? lastPart : secondLast || "Stream";
        const name = fileName
          .replace(/\.[^.]+$/, "")
          .replace(/[_-]/g, " ")
          .replace(/\?.*$/, "")
          .trim();
        
        channels.push({
          id: `${source}-${idx++}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: name || `Stream ${idx}`,
          country: defaultCountry,
          category: "Other",
          url: line,
          language: "English",
          source,
        });
      }
    }
  }

  return channels;
}

/**
 * Parse M3U from a File object (user upload)
 */
export function parseM3UFile(file: File): Promise<Channel[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        if (!content || content.trim().length === 0) {
          reject(new Error("File is empty"));
          return;
        }
        const channels = parseM3U(content, "Imported", "imported");
        resolve(channels);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

function mapCountryCode(code: string): string {
  const codeMap: Record<string, string> = {
    "us": "USA",
    "usa": "USA",
    "united states": "USA",
    "gb": "England",
    "uk": "England",
    "england": "England",
    "united kingdom": "England",
    "britain": "England",
    "za": "South Africa",
    "south africa": "South Africa",
  };
  const lower = code.toLowerCase().trim();
  return codeMap[lower] || code.charAt(0).toUpperCase() + code.slice(1);
}

function mapCategory(group: string): string {
  const g = group.toLowerCase();
  if (g.includes("news")) return "News";
  if (g.includes("sport")) return "Sports";
  if (g.includes("movie") || g.includes("cinema")) return "Movies";
  if (g.includes("entertainment") || g.includes("general")) return "Entertainment";
  if (g.includes("music") || g.includes("musiq") || g.includes("mtv")) return "Music";
  if (g.includes("kids") || g.includes("cartoon") || g.includes("animation") || g.includes("children")) return "Kids";
  if (g.includes("weather")) return "Weather";
  if (g.includes("business") || g.includes("finance")) return "Business";
  if (g.includes("science") || g.includes("nature") || g.includes("documentary") || g.includes("docu")) return "Documentary";
  if (g.includes("religion") || g.includes("faith") || g.includes("spiritual")) return "Religion";
  if (g.includes("cook") || g.includes("food")) return "Lifestyle";
  if (g.includes("travel")) return "Lifestyle";
  if (g.includes("education") || g.includes("learn")) return "Other";
  if (g.includes("legislature") || g.includes("government")) return "News";
  if (g.includes("shop")) return "Other";
  if (g.includes("auto") || g.includes("motor")) return "Sports";
  if (g.includes("classic")) return "Movies";
  if (g.includes("comedy")) return "Entertainment";
  if (g.includes("horror") || g.includes("thriller")) return "Movies";
  if (g.includes("western")) return "Movies";
  if (g.includes("family")) return "Entertainment";
  if (g.includes("drama")) return "Entertainment";
  if (g.includes("action")) return "Movies";
  if (g.includes("reality")) return "Entertainment";
  if (g.includes("lifestyle")) return "Lifestyle";
  if (g.includes("outdoor") || g.includes("hunting") || g.includes("fishing")) return "Sports";
  if (g.includes("anime")) return "Entertainment";
  if (g.includes("gaming")) return "Entertainment";
  if (g.includes("home") || g.includes("garden")) return "Lifestyle";
  if (g.includes("serie")) return "Entertainment";
  if (g.includes("culture") || g.includes("art")) return "Documentary";
  if (g.includes("crime")) return "Entertainment";
  if (g.includes("usa") || g.includes("us")) return "Entertainment";
  if (g.includes("uk") || g.includes("gb")) return "Entertainment";
  if (g.includes("latin") || g.includes("español") || g.includes("spanish")) return "Entertainment";
  if (g.includes("arab")) return "Entertainment";
  if (g.includes("india") || g.includes("hindi")) return "Entertainment";
  if (g.includes("africa")) return "Entertainment";
  if (g.includes("canada") || g.includes("ca")) return "Entertainment";
  if (g.includes("local") || g.includes("regional")) return "News";
  if (g.includes("legacy") || g.includes("classic movie")) return "Movies";
  if (g.includes("maz") || g.includes("max")) return "Movies";
  if (g.includes("fox") || g.includes("hbo") || g.includes("showtime")) return "Movies";
  if (g.includes("nba") || g.includes("nfl") || g.includes("mlb") || g.includes("nhl") || g.includes("mls") || g.includes("ufc") || g.includes("boxing") || g.includes("f1") || g.includes("football") || g.includes("soccer") || g.includes("cricket") || g.includes("rugby") || g.includes("tennis") || g.includes("golf")) return "Sports";
  if (g.includes("ppv") || g.includes("pay per view")) return "Sports";
  if (g.includes("vip") || g.includes("premium")) return "Entertainment";
  return "Other";
}
