"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Mic, Play, Square, Volume2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

const MAX_CHARS = 5000;
const TEST_SAMPLE =
  "Hello! This is a preview of the selected voice. Adjust the rate and pitch sliders to make it sound just right.";
const DEFAULT_TEXT =
  "Welcome to the OmniToolBox AI Voiceover Studio. Type or paste your script here, pick a voice, and press play to hear it spoken aloud — right in your browser.";

function getSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return "speechSynthesis" in window ? window.speechSynthesis : null;
}

function friendlyLang(lang: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(lang) ?? lang;
  } catch {
    return lang;
  }
}

function pickDefaultVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const googleUS = voices.find((v) => /google us english/i.test(v.name));
  if (googleUS) return googleUS;
  const def = voices.find((v) => v.default);
  if (def) return def;
  const en = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
  return en ?? voices[0];
}

interface VoiceGroup {
  label: string;
  voices: SpeechSynthesisVoice[];
}

export default function VoiceoverStudio() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [text, setText] = useState(DEFAULT_TEXT);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  // Load voices (Chrome populates them asynchronously) + cancel speech on unmount.
  useEffect(() => {
    const synth = getSynthesis();
    if (!synth) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const loadVoices = () => {
      const list = synth.getVoices();
      if (list.length === 0) return;
      setVoices(list);
      setVoiceURI((current) => current || pickDefaultVoice(list)?.voiceURI || "");
    };

    loadVoices();
    synth.addEventListener("voiceschanged", loadVoices);
    return () => {
      synth.removeEventListener("voiceschanged", loadVoices);
      synth.cancel();
    };
  }, []);

  const groups: VoiceGroup[] = useMemo(() => {
    const map = new Map<string, SpeechSynthesisVoice[]>();
    for (const v of voices) {
      const key = v.lang || "unknown";
      const bucket = map.get(key);
      if (bucket) bucket.push(v);
      else map.set(key, [v]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([lang, list]) => ({ label: friendlyLang(lang), voices: list }));
  }, [voices]);

  const selectedVoice = voices.find((v) => v.voiceURI === voiceURI) ?? null;
  const overLimit = text.length > MAX_CHARS;

  const speak = useCallback(
    (utterText: string) => {
      const synth = getSynthesis();
      if (!synth) return;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(utterText);
      const voice = voices.find((v) => v.voiceURI === voiceURI) ?? null;
      if (voice) utterance.voice = voice;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.onboundary = (event) => {
        if (utterText.length > 0) {
          setProgress(Math.min(100, Math.round((event.charIndex / utterText.length) * 100)));
        }
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        setProgress(100);
      };
      utterance.onerror = (event) => {
        // "canceled" fires when we intentionally stop — not a real error.
        if (event.error !== "canceled") {
          toast({
            title: "Playback error",
            variant: "error",
            description: "The voice could not speak this text. Try a different voice.",
          });
        }
        setIsSpeaking(false);
      };
      setProgress(0);
      setIsSpeaking(true);
      synth.speak(utterance);
    },
    [voices, voiceURI, rate, pitch, toast]
  );

  const handlePlay = () => {
    if (text.trim().length === 0) {
      toast({ title: "Nothing to speak", variant: "error", description: "Type or paste your script first." });
      return;
    }
    if (overLimit) {
      toast({
        title: "Text too long",
        variant: "error",
        description: `Keep your script under ${MAX_CHARS.toLocaleString()} characters for smooth playback.`,
      });
      return;
    }
    speak(text);
  };

  const handleStop = () => {
    getSynthesis()?.cancel();
    setIsSpeaking(false);
    setProgress(0);
  };

  const handleTestVoice = () => {
    if (overLimit) return;
    speak(TEST_SAMPLE);
  };

  if (supported === false) {
    return (
      <Card className="text-center py-12">
        <div className="mx-auto mb-4 grid place-items-center size-14 rounded-2xl bg-red-500/15 border border-red-500/30">
          <AlertTriangle size={26} className="text-red-400" />
        </div>
        <h2 className="font-display text-xl font-bold">Voiceover not supported in this browser — try Chrome or Edge</h2>
        <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto">
          The AI Voiceover Studio uses your device&apos;s built-in text-to-speech voices, which need the Web Speech
          API. Open this page in Google Chrome or Microsoft Edge to use it.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-zinc-300">Your script</p>
          <p className={`text-xs font-medium ${overLimit ? "text-red-400" : "text-zinc-500"}`}>
            {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </p>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste the text you want voiced…"
          rows={7}
          hint={overLimit ? `Over the ${MAX_CHARS.toLocaleString()} character limit — shorten it to play.` : undefined}
          error={overLimit ? "Text exceeds the character limit." : undefined}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="voice-picker" className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
            <Volume2 size={15} className="text-brand-400" /> Voice
          </label>
          <select
            id="voice-picker"
            value={voiceURI}
            onChange={(e) => setVoiceURI(e.target.value)}
            disabled={voices.length === 0}
            className="input-base w-full"
          >
            {voices.length === 0 && <option value="">Loading voices…</option>}
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} · {v.lang}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="text-xs text-zinc-500 mt-1.5">
            {voices.length > 0
              ? `${voices.length} voices found on this device`
              : "Voices load from your device…"}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-zinc-300 mb-2">
              Rate: <span className="text-brand-300">{rate.toFixed(1)}×</span>
            </p>
            <input
              type="range" min={0.5} max={2} step={0.1} value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full accent-brand-500" aria-label="Speech rate"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-300 mb-2">
              Pitch: <span className="text-brand-300">{pitch.toFixed(1)}</span>
            </p>
            <input
              type="range" min={0} max={2} step={0.1} value={pitch}
              onChange={(e) => setPitch(Number(e.target.value))}
              className="w-full accent-brand-500" aria-label="Speech pitch"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {!isSpeaking ? (
          <Button onClick={handlePlay} className="flex-1" disabled={supported === null}>
            <Play size={16} /> Play voiceover
          </Button>
        ) : (
          <Button onClick={handleStop} variant="danger" className="flex-1">
            <Square size={16} /> Stop
          </Button>
        )}
        <Button onClick={handleTestVoice} variant="outline" disabled={supported === null || isSpeaking}>
          <Mic size={16} /> Test voice
        </Button>
      </div>

      {(isSpeaking || progress > 0) && (
        <div className="space-y-2" aria-live="polite">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">
              {isSpeaking ? "Speaking…" : "Finished"} {selectedVoice ? `· ${selectedVoice.name}` : ""}
            </span>
            <span className="font-medium text-zinc-300">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-fuchsia-500 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <p className="text-[11px] text-zinc-500 leading-relaxed">
        Voices are generated on your device with built-in speech synthesis — nothing is uploaded or sent to a server.
        Quality varies by device; Chrome and Edge ship the most natural voices.
      </p>
    </Card>
  );
}
