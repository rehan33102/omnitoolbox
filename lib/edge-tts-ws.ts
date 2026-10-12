// lib/edge-tts-ws.ts — Microsoft Edge TTS via `ws` WebSocket client.
// Replaces the custom raw-TLS WebSocket implementation that was failing on Vercel.
// Uses the battle-tested `ws` npm package for the WebSocket connection.

import { WebSocket } from "ws";

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
    const ws = new WebSocket(`${WEB_SOCKET_URL}&ConnectionId=${uuid()}`, {
      host: "speech.platform.bing.com",
      origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
      },
    });
    const audioData: Buffer[] = [];
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("Edge TTS WebSocket timeout"));
    }, 55000);

    ws.on("message", (rawData: Buffer | string, isBinary: boolean) => {
      if (!isBinary) {
        const data = rawData.toString("utf8");
        if (data.includes("turn.end")) {
          clearTimeout(timer);
          resolve(Buffer.concat(audioData));
          ws.close();
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
    ws.on("error", (e: Error) => {
      clearTimeout(timer);
      reject(e);
    });
    ws.on("close", () => {
      clearTimeout(timer);
      if (audioData.length === 0) {
        reject(new Error("Edge TTS WebSocket closed with no audio"));
      }
    });

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
    // XML-escape the text to avoid breaking SSML
    const safeText = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const configMessage =
      `X-Timestamp:${Date()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${speechConfig}`;
    ws.on("open", () => {
      ws.send(configMessage, (configError: Error | undefined) => {
        if (configError) {
          clearTimeout(timer);
          reject(configError);
          return;
        }
        const ssmlMessage =
          `X-RequestId:${uuid()}\r\nContent-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${Date()}Z\r\nPath:ssml\r\n\r\n` +
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
          `<voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>` +
          `${safeText}</prosody></voice></speak>`;
        ws.send(ssmlMessage, (ssmlError: Error | undefined) => {
          if (ssmlError) {
            clearTimeout(timer);
            reject(ssmlError);
          }
        });
      });
    });
  });
}
