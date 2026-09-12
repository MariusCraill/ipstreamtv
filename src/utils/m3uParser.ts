import { Channel } from "../types";

/**
 * Parse M3U/M3U8 playlist content into Channel objects.
 * Handles various formats including:
 * - Standard #EXTINF with tvg-id, tvg-logo, tvg-name, group-title attributes
 * - Simple format with just URLs
 * - Files with different line endings (CRLF, LF)
 * - Files with #EXTVLCOPT lines (VLC options)
 */
export function parseM3U(content: string, defaultCountry: string = "Unknown", source: "iptv-org" | "imported" | "curated" = "imported"): Channel[] {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const channels: Channel[] = [];
  let currentChannel: Partial<Channel> | null = null;
  let idx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and header
    if (!line || line === "#EXTM3U") continue;

    // Skip VLC options and other metadata lines
    if (line.startsWith("#EXTVLCOPT") || line.startsWith("#KODIPROP")) continue;

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
        .trim();

      if (!name) continue;

      // Determine country
      let country = defaultCountry;
      if (countryMatch && countryMatch[1]) {
        country = mapCountryCode(countryMatch[1]);
      } else if (tvgIdMatch && tvgIdMatch[1]) {
        // Try to extract country from tvg-id (e.g., "CNN.us@US")
        const idCountryMatch = tvgIdMatch[1].match(/\.([a-z]{2})@/i);
        if (idCountryMatch) {
          country = mapCountryCode(idCountryMatch[1]);
        }
      }

      currentChannel = {
        name,
        logo: logoMatch ? logoMatch[1] : undefined,
        category: groupMatch ? mapCategory(groupMatch[1]) : "Other",
        country,
        language: languageMatch ? languageMatch[1] : "English",
        source,
      };
    } else if (!line.startsWith("#") && currentChannel) {
      // This is a URL line
      // Only accept valid stream URLs
      if (line.startsWith("http://") || line.startsWith("https://") || line.startsWith("rtmp://") || line.startsWith("rtsp://")) {
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
        const fileName = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || "Unknown Stream";
        const name = fileName.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").trim();
        
        channels.push({
          id: `${source}-${idx++}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: name || "Unknown Stream",
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

/**
 * Parse M3U from a URL (fetch remote playlist)
 */
export async function parseM3UFromURL(url: string, defaultCountry: string = "Unknown"): Promise<Channel[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  return parseM3U(text, defaultCountry, "iptv-org");
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
  return codeMap[code.toLowerCase()] || code.charAt(0).toUpperCase() + code.slice(1);
}

function mapCategory(group: string): string {
  const g = group.toLowerCase();
  if (g.includes("news")) return "News";
  if (g.includes("sport")) return "Sports";
  if (g.includes("movie") || g.includes("cinema")) return "Movies";
  if (g.includes("entertainment") || g.includes("general")) return "Entertainment";
  if (g.includes("music") || g.includes("musiq")) return "Music";
  if (g.includes("kids") || g.includes("cartoon") || g.includes("animation") || g.includes("children")) return "Kids";
  if (g.includes("weather")) return "Weather";
  if (g.includes("business") || g.includes("finance")) return "Business";
  if (g.includes("science") || g.includes("nature") || g.includes("documentary")) return "Documentary";
  if (g.includes("religion") || g.includes("faith") || g.includes("spiritual")) return "Religion";
  if (g.includes("cook") || g.includes("food")) return "Lifestyle";
  if (g.includes("travel")) return "Lifestyle";
  if (g.includes("education") || g.includes("learn")) return "Education";
  if (g.includes("legislature") || g.includes("government")) return "Government";
  if (g.includes("shop")) return "Shopping";
  if (g.includes("auto") || g.includes("motor")) return "Sports";
  if (g.includes("classic")) return "Classic";
  if (g.includes("comedy")) return "Comedy";
  if (g.includes("horror") || g.includes("thriller")) return "Movies";
  if (g.includes("western")) return "Movies";
  if (g.includes("family")) return "Family";
  if (g.includes("drama")) return "Drama";
  if (g.includes("action")) return "Movies";
  if (g.includes("reality")) return "Entertainment";
  if (g.includes("lifestyle")) return "Lifestyle";
  if (g.includes("outdoor") || g.includes("hunting") || g.includes("fishing")) return "Sports";
  if (g.includes("lego") || g.includes("toy")) return "Kids";
  if (g.includes("anime")) return "Animation";
  if (g.includes("gaming")) return "Gaming";
  if (g.includes("home") || g.includes("garden")) return "Lifestyle";
  if (g.includes("serie")) return "Entertainment";
  if (g.includes("culture") || g.includes("art")) return "Culture";
  if (g.includes("classic movie")) return "Movies";
  if (g.includes("black")) return "Movies";
  if (g.includes("crimen") || g.includes("crime")) return "Entertainment";
  if (g.includes("maz") || g.includes("max")) return "Movies";
  return "Other";
}
