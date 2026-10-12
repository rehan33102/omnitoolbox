// lib/edge-tts-ws.ts — Microsoft Edge TTS via native WebSocket.
// Replaces the custom raw-TLS WebSocket implementation that was failing on Vercel.
// Uses Node.js 22+ native WebSocket — zero npm dependencies.

const WEB_SOCKET_URL =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1" +
  "?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4";

function uuid(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export async function edgeTtsWs(
  text: string,
  opts: { voice: string; rate?: string; pitch?: string; volume?: string }
): Promise<Buffer> {
  const { voice, rate = "+0%", pitch = "+0Hz", volume = "+0%" } = opts;

  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${WEB_SOCKET_URL}&ConnectionId=${uuid()}`);
    } catch (e) {
      reject(e);
      return;
    }

    const audioData: Buffer[] = [];
    const timer = setTimeout(() => {
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error("Edge TTS WebSocket timeout"));
    }, 55000);

    const cleanup = () => clearTimeout(timer);

    ws.onopen = () => {
      const speechConfig = JSON.stringify({
        context: {
          synthesis: {
            audio: {
              metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
              outputFormat: "audio-24khz-48kbitrate-mono-mp3",
            },
          },
        },
      });
      const safeText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const configMessage =
        `X-Timestamp:${Date()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${speechConfig}`;
      try {
        ws.send(configMessage);
        const ssmlMessage =
          `X-RequestId:${uuid()}\r\nContent-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${Date()}Z\r\nPath:ssml\r\n\r\n` +
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
          `<voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>` +
          `${safeText}</prosody></voice></speak>`;
        ws.send(ssmlMessage);
      } catch (e) {
        cleanup();
        reject(e);
      }
    };

    ws.onmessage = async (event: MessageEvent) => {
      const rawData = event.data;
      // Binary audio frame
      if (rawData instanceof ArrayBuffer) {
        const data = Buffer.from(rawData);
        const separator = "Path:audio\r\n";
        const idx = data.indexOf(separator);
        if (idx >= 0) {
          audioData.push(data.subarray(idx + separator.length));
        }
        return;
      }
      if (typeof rawData === "string") {
        if (rawData.includes("turn.end")) {
          cleanup();
          resolve(Buffer.concat(audioData));
          try { ws.close(); } catch { /* ignore */ }
        }
        return;
      }
      // Blob (browser-like environments)
      if (typeof Blob !== "undefined" && rawData instanceof Blob) {
        const ab = await rawData.arrayBuffer();
        const data = Buffer.from(ab);
        const separator = "Path:audio\r\n";
        const idx = data.indexOf(separator);
        if (idx >= 0) {
          audioData.push(data.subarray(idx + separator.length));
        }
      }
    };

    ws.onerror = () => {
      cleanup();
      reject(new Error("Edge TTS WebSocket error"));
    };

    ws.onclose = () => {
      cleanup();
      if (audioData.length === 0) {
        reject(new Error("Edge TTS WebSocket closed with no audio"));
      }
    };
  });
}
