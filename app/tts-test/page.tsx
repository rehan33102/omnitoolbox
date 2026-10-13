"use client";

import { useEffect, useState } from "react";
import { synthesizeInBrowser, getVoiceName } from "@/lib/edge-tts-client";

/**
 * Temporary diagnostic page for Edge TTS client-side connectivity.
 * Auto-runs a Spanish male synthesis test on load and shows the exact
 * result/error on screen so support can see it via screenshot.
 */
export default function TtsTestPage() {
  const [log, setLog] = useState<string[]>(["Starting test..."]);

  useEffect(() => {
    const add = (m: string) =>
      setLog((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${m}`]);

    (async () => {
      try {
        const voice = getVoiceName("es", "male");
        add(`Voice: ${voice}`);
        add(`Origin: ${window.location.origin}`);
        add(`UA: ${navigator.userAgent.slice(0, 80)}`);
        add("Connecting to Microsoft Edge TTS (browser WebSocket)...");
        const result = await synthesizeInBrowser(
          "Hola, esto es una prueba.",
          voice ?? "es-ES-AlvaroNeural",
          { timeoutMs: 25000 }
        );
        add(`SUCCESS! Audio size: ${result.audio.size} bytes`);
        const url = URL.createObjectURL(result.audio);
        const audio = new Audio(url);
        await audio.play().catch(() => add("(tap screen to hear audio)"));
        add("If you heard a MALE Spanish voice, client-side Edge TTS works.");
      } catch (e) {
        add(`FAILED: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-4">Voice Test (Diagnostic)</h1>
      <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-2 text-sm font-mono">
        {log.map((line, i) => (
          <p key={i} className={line.includes("FAILED") ? "text-red-500" : line.includes("SUCCESS") ? "text-green-500" : ""}>
            {line}
          </p>
        ))}
      </div>
      <p className="mt-4 text-sm opacity-70">Screenshot this page and send it to support.</p>
    </div>
  );
}
