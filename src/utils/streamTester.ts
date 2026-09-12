import { Channel, StreamTestResult } from "../types";

// Test if a stream URL is accessible and live
export async function testStream(channel: Channel): Promise<StreamTestResult> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(channel.url, {
      method: "HEAD",
      mode: "no-cors",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    // With no-cors mode, we get opaque responses (status 0)
    // which still indicate the server is reachable
    return {
      channel,
      isLive: true,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // If HEAD fails, try a GET request as fallback
    try {
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 5000);
      
      await fetch(channel.url, {
        method: "GET",
        mode: "no-cors",
        signal: controller2.signal,
      });
      
      clearTimeout(timeoutId2);
      
      return {
        channel,
        isLive: true,
        responseTime: Date.now() - startTime,
      };
    } catch {
      return {
        channel,
        isLive: false,
        responseTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Test multiple streams in parallel with concurrency limit
export async function testStreams(
  channels: Channel[],
  concurrency: number = 5,
  onProgress?: (tested: number, total: number) => void
): Promise<StreamTestResult[]> {
  const results: StreamTestResult[] = [];
  let tested = 0;

  const testBatch = async (batch: Channel[]) => {
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
    const batch = channels.slice(i, i + concurrency);
    await testBatch(batch);
  }

  return results;
}
