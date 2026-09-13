import { Channel, StreamTestResult } from "../types";
import Hls from "hls.js";

/**
 * Test if a stream is live.
 * For HLS streams, uses HLS.js which handles CORS better.
 * For other streams, uses a quick connectivity check.
 */
export function testStream(channel: Channel): Promise<StreamTestResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const timeout = 12000;
    let resolved = false;

    const done = (result: StreamTestResult) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(result);
      }
    };

    const timer = setTimeout(() => {
      done({
        channel,
        isLive: false,
        responseTime: Date.now() - startTime,
        error: "Timeout",
      });
    }, timeout);

    const url = channel.url;
    const isHLS = url.includes(".m3u8") || 
                  url.includes("/hls/") || 
                  url.includes("master") ||
                  url.includes("playlist");

    if (isHLS && Hls.isSupported()) {
      // Use HLS.js for testing - it handles CORS internally
      const hls = new Hls({
        enableWorker: false,
        lowLatencyMode: true,
        xhrSetup: (xhr) => {
          xhr.timeout = 10000;
        },
      });

      const video = document.createElement("video");
      video.muted = true;
      video.style.display = "none";
      document.body.appendChild(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        done({
          channel,
          isLive: true,
          responseTime: Date.now() - startTime,
        });
        hls.destroy();
        video.remove();
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          done({
            channel,
            isLive: false,
            responseTime: Date.now() - startTime,
            error: data.type === Hls.ErrorTypes.NETWORK_ERROR
              ? "Network error"
              : "Stream error",
          });
          hls.destroy();
          video.remove();
        }
      });

      try {
        hls.loadSource(url);
        hls.attachMedia(video);
      } catch (e) {
        done({
          channel,
          isLive: false,
          responseTime: Date.now() - startTime,
          error: "Failed to load stream",
        });
        hls.destroy();
        video.remove();
      }
    } else {
      // For non-HLS streams, try a simple fetch test
      // This is less reliable but better than nothing
      const controller = new AbortController();
      const fetchTimer = setTimeout(() => controller.abort(), 8000);

      fetch(url, {
        method: "GET",
        mode: "no-cors",
        signal: controller.signal,
      })
        .then(() => {
          clearTimeout(fetchTimer);
          // no-cors returns opaque response - server responded
          done({
            channel,
            isLive: true,
            responseTime: Date.now() - startTime,
          });
        })
        .catch(() => {
          clearTimeout(fetchTimer);
          done({
            channel,
            isLive: false,
            responseTime: Date.now() - startTime,
            error: "Connection failed",
          });
        });
    }
  });
}

// Test multiple streams in parallel with concurrency limit
export async function testStreams(
  channels: Channel[],
  concurrency: number = 3,
  onProgress?: (tested: number, total: number) => void,
  abortSignal?: AbortSignal
): Promise<StreamTestResult[]> {
  const results: StreamTestResult[] = [];
  let tested = 0;

  const testBatch = async (batch: Channel[]) => {
    // Check if aborted before starting batch
    if (abortSignal?.aborted) {
      return;
    }

    const batchResults = await Promise.allSettled(
      batch.map((channel) => testStream(channel))
    );
    
    batchResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({
          channel: batch[index],
          isLive: false,
          error: "Test failed",
        });
      }
      tested++;
      if (onProgress) onProgress(tested, channels.length);
    });
  };

  // Process in batches
  for (let i = 0; i < channels.length; i += concurrency) {
    // Check if aborted before each batch
    if (abortSignal?.aborted) {
      break;
    }
    
    const batch = channels.slice(i, i + concurrency);
    await testBatch(batch);
  }

  return results;
}
