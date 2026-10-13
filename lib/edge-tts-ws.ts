// lib/edge-tts-ws.ts — Microsoft Edge TTS via the `ws` WebSocket library.
//
// ROOT CAUSE of the long-standing male-voice bug (found 2026-10-13):
// Microsoft's speech endpoint REJECTS WebSocket connections that don't
// carry the Edge read-aloud extension Origin header. Node's native
// WebSocket cannot set custom headers, so every connection failed and the
// route silently fell back to Google TTS (always female). The `ws` package
// CAN set origin + headers — matching the proven edge-tts implementation.

import WebSocket from "ws";

const WEB_SOCKET_URL =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1" +
  "?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4";

const EDGE_ORIGIN = "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold";
const EDGE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.66 Safari/537.36 Edg/103.0.1264.44";

function uuid(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export async function edgeTtsWs(
  text: string,
  opts: { voice: string; rate?: string; pitch?: string; volume?: string }
): Promise<Buffer> {
  const { voice, rate = "+0%", pitch = "+0Hz", volume = "+0%" } = opts;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WEB_SOCKET_URL}&ConnectionId=${uuid()}`, {
      host: "speech.platform.bing.com",
      origin: EDGE_ORIGIN,
      headers: { "User-Agent": EDGE_UA },
    });

    const audioData: Buffer[] = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error("Edge TTS WebSocket timeout"));
    }, 55000);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    ws.on("open", () => {
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
      ws.send(configMessage, (configError) => {
        if (configError) {
          finish(() => reject(configError));
          return;
        }
        const ssmlMessage =
          `X-RequestId:${uuid()}\r\nContent-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${Date()}Z\r\nPath:ssml\r\n\r\n` +
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
          `<voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>` +
          `${safeText}</prosody></voice></speak>`;
        ws.send(ssmlMessage, (ssmlError) => {
          if (ssmlError) finish(() => reject(ssmlError));
        });
      });
    });

    ws.on("message", (rawData: WebSocket.RawData, isBinary: boolean) => {
      if (!isBinary) {
        const data = rawData.toString("utf8");
        if (data.includes("turn.end")) {
          finish(() => {
            resolve(Buffer.concat(audioData));
            try { ws.close(); } catch { /* ignore */ }
          });
        }
        return;
      }
      const data = rawData as Buffer;
      const separator = "Path:audio\r\n";
      const idx = data.indexOf(separator);
      if (idx >= 0) {
        audioData.push(data.subarray(idx + separator.length));
      }
    });

    ws.on("error", (err: Error) => {
      finish(() => reject(new Error(`Edge TTS WebSocket error: ${err.message}`)));
    });

    ws.on("close", () => {
      finish(() => {
        if (audioData.length > 0) {
          resolve(Buffer.concat(audioData));
        } else {
          reject(new Error("Edge TTS WebSocket closed with no audio"));
        }
      });
    });
  });
}
