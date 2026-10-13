// lib/piper-tts-client.ts — OUR OWN TTS: Piper neural voices running 100% in the
// visitor's browser (ONNX Runtime Web + espeak phonemization, models from HF CDN).
//
// Why this exists: Microsoft Edge TTS is dead for this site — proven via the
// debug endpoint: Microsoft returns HTTP 403 to Vercel's server IPs AND rejects
// browser WebSocket connections (browsers can't fake the required Origin header).
// Piper runs fully client-side: no server to block, no account, no API key,
// real male AND female voices, and the output is a real downloadable MP3.

export type PiperGender = "male" | "female";

type PiperVoiceEntry = {
  /** Piper voice id for the male selection */
  male: string;
  /** Piper voice id for the female selection */
  female: string;
  maleLabel: string;
  femaleLabel: string;
  /** true when a single voice serves both genders (only one exists for the language) */
  single: boolean;
};

/**
 * Language -> Piper voice mapping. Prefer "medium" quality models (~60MB, cached
 * in OPFS after first download). Gender inferred from voice/dataset names.
 * Languages without any Piper voice return null from getPiperVoiceId().
 */
const PIPER_VOICE_MAP: Record<string, PiperVoiceEntry> = {
  en: { male: "en_US-ryan-medium", female: "en_US-amy-medium", maleLabel: "Ryan", femaleLabel: "Amy", single: false },
  es: { male: "es_ES-davefx-medium", female: "es_ES-davefx-medium", maleLabel: "Dave", femaleLabel: "Dave", single: true },
  de: { male: "de_DE-thorsten-medium", female: "de_DE-kerstin-low", maleLabel: "Thorsten", femaleLabel: "Kerstin", single: false },
  fr: { male: "fr_FR-tom-medium", female: "fr_FR-siwis-medium", maleLabel: "Tom", femaleLabel: "Siwis", single: false },
  ru: { male: "ru_RU-dmitri-medium", female: "ru_RU-irina-medium", maleLabel: "Dmitri", femaleLabel: "Irina", single: false },
  it: { male: "it_IT-riccardo-x_low", female: "it_IT-paola-medium", maleLabel: "Riccardo", femaleLabel: "Paola", single: false },
  pl: { male: "pl_PL-darkman-medium", female: "pl_PL-gosia-medium", maleLabel: "Darkman", femaleLabel: "Gosia", single: false },
  nl: { male: "nl_BE-rdh-medium", female: "nl_BE-nathalie-medium", maleLabel: "RDH", femaleLabel: "Nathalie", single: false },
  ar: { male: "ar_JO-kareem-medium", female: "ar_JO-kareem-medium", maleLabel: "Kareem", femaleLabel: "Kareem", single: true },
  pt: { male: "pt_BR-faber-medium", female: "pt_BR-faber-medium", maleLabel: "Faber", femaleLabel: "Faber", single: true },
  zh: { male: "zh_CN-huayan-medium", female: "zh_CN-huayan-medium", maleLabel: "Huayan", femaleLabel: "Huayan", single: true },
  tr: { male: "tr_TR-fahrettin-medium", female: "tr_TR-fahrettin-medium", maleLabel: "Fahrettin", femaleLabel: "Fahrettin", single: true },
  fa: { male: "fa_IR-amir-medium", female: "fa_IR-amir-medium", maleLabel: "Amir", femaleLabel: "Amir", single: true },
  vi: { male: "vi_VN-vais1000-medium", female: "vi_VN-vais1000-medium", maleLabel: "Vais", femaleLabel: "Vais", single: true },
  sv: { male: "sv_SE-nst-medium", female: "sv_SE-nst-medium", maleLabel: "NST", femaleLabel: "NST", single: true },
  da: { male: "da_DK-talesyntese-medium", female: "da_DK-talesyntese-medium", maleLabel: "Talesyntese", femaleLabel: "Talesyntese", single: true },
  fi: { male: "fi_FI-harri-medium", female: "fi_FI-harri-medium", maleLabel: "Harri", femaleLabel: "Harri", single: true },
  no: { male: "no_NO-talesyntese-medium", female: "no_NO-talesyntese-medium", maleLabel: "Talesyntese", femaleLabel: "Talesyntese", single: true },
  el: { male: "el_GR-rapunzelina-low", female: "el_GR-rapunzelina-low", maleLabel: "Rapunzelina", femaleLabel: "Rapunzelina", single: true },
  ro: { male: "ro_RO-mihai-medium", female: "ro_RO-mihai-medium", maleLabel: "Mihai", femaleLabel: "Mihai", single: true },
  uk: { male: "uk_UA-lada-x_low", female: "uk_UA-lada-x_low", maleLabel: "Lada", femaleLabel: "Lada", single: true },
  cs: { male: "cs_CZ-jirka-medium", female: "cs_CZ-jirka-medium", maleLabel: "Jirka", femaleLabel: "Jirka", single: true },
  // No Piper voice exists for: ur, ja, hi, ko, id, ms, bn, ta, te, th, he
};

/** Get the Piper voice id for a site language code + gender. Null = no Piper voice. */
export function getPiperVoiceId(lang: string, gender: PiperGender): string | null {
  const entry = PIPER_VOICE_MAP[lang];
  if (!entry) return null;
  return gender === "male" ? entry.male : entry.female;
}

/** Does this language have a Piper voice (either gender)? */
export function hasPiperVoice(lang: string): boolean {
  return lang in PIPER_VOICE_MAP;
}

/** Languages where male and female are genuinely different voices. */
export function piperGenders(lang: string): { male: boolean; female: boolean } {
  const entry = PIPER_VOICE_MAP[lang];
  if (!entry) return { male: false, female: false };
  return { male: true, female: !entry.single };
}

// ---------------------------------------------------------------------------
// Synthesis
// ---------------------------------------------------------------------------

export type PiperProgress = {
  /** "download" = voice model downloading (first time only, cached after), "synthesis" = generating audio */
  stage: "download" | "synthesis" | "encode";
  /** 0..1 */
  fraction: number;
};

type TtsSessionLike = {
  predict: (text: string) => Promise<Blob>;
};

// One session per voice id — model stays loaded, OPFS caches the files.
const sessionCache = new Map<string, Promise<TtsSessionLike>>();

async function getSession(
  voiceId: string,
  onProgress?: (p: PiperProgress) => void,
): Promise<TtsSessionLike> {
  let pending = sessionCache.get(voiceId);
  if (!pending) {
    pending = (async () => {
      const mod = await import("@mintplex-labs/piper-tts-web");
      const session = await mod.TtsSession.create({
        voiceId,
        progress: (prog: { url: string; total: number; loaded: number }) => {
          if (!prog.total) return;
          if (prog.url.startsWith("tts://")) {
            onProgress?.({ stage: "synthesis", fraction: prog.loaded / prog.total });
          } else {
            onProgress?.({ stage: "download", fraction: prog.loaded / prog.total });
          }
        },
      });
      return session as unknown as TtsSessionLike;
    })();
    sessionCache.set(voiceId, pending);
    // Don't poison the cache with a rejected session — allow retry.
    pending.catch(() => sessionCache.delete(voiceId));
  }
  return pending;
}

/** Read 16-bit mono PCM samples + sample rate from a WAV blob (44-byte header). */
async function wavToPcm(wav: Blob): Promise<{ samples: Int16Array; sampleRate: number }> {
  const buf = await wav.arrayBuffer();
  const view = new DataView(buf);
  const sampleRate = view.getUint32(24, true) || 22050;
  // Find the "data" chunk (defensive: header is 44 bytes for this package's output).
  let dataOffset = 44;
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (riff === "RIFF") {
    // walk chunks after the 12-byte RIFF header
    let off = 12;
    while (off + 8 <= view.byteLength) {
      const id = String.fromCharCode(view.getUint8(off), view.getUint8(off + 1), view.getUint8(off + 2), view.getUint8(off + 3));
      const size = view.getUint32(off + 4, true);
      if (id === "data") {
        dataOffset = off + 8;
        break;
      }
      off += 8 + size;
    }
  }
  const sampleCount = Math.floor((buf.byteLength - dataOffset) / 2);
  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = view.getInt16(dataOffset + i * 2, true);
  }
  return { samples, sampleRate };
}

/**
 * Synthesize text with Piper in the browser and return an MP3 blob.
 * Long text is chunked internally by the engine (400 chars); MP3 encoding
 * runs per slice with progress. Throws with a human-readable message on
 * failure — callers must surface it, never silently substitute another voice.
 */
export async function synthesizePiper(
  text: string,
  lang: string,
  gender: PiperGender,
  onProgress?: (p: PiperProgress) => void,
): Promise<{ blob: Blob; voiceId: string }> {
  const clean = text.trim();
  if (!clean) throw new Error("Nothing to speak.");
  const voiceId = getPiperVoiceId(lang, gender);
  if (!voiceId) {
    throw new Error(`No on-device voice for this language yet.`);
  }

  let session: TtsSessionLike;
  try {
    session = await getSession(voiceId, onProgress);
  } catch (e) {
    throw new Error(
      `Could not load the voice model (${e instanceof Error ? e.message : "network error"}). Check your connection and try again.`,
    );
  }

  let wav: Blob;
  try {
    wav = await session.predict(clean);
  } catch (e) {
    throw new Error(
      `Voice generation failed (${e instanceof Error ? e.message : "unknown error"}). Try shorter text.`,
    );
  }

  // WAV -> MP3 (chunked encode with progress)
  const { samples, sampleRate } = await wavToPcm(wav);
  if (samples.length === 0) throw new Error("Voice generation returned no audio.");
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const encoder = new Mp3Encoder(1, sampleRate, 128);
  const mp3Parts: Uint8Array[] = [];
  const SLICE = 1152 * 64; // ~1.6s of audio per encode step
  for (let off = 0; off < samples.length; off += SLICE) {
    const slice = samples.subarray(off, Math.min(off + SLICE, samples.length));
    const out = encoder.encodeBuffer(slice);
    if (out.length) mp3Parts.push(out);
    onProgress?.({ stage: "encode", fraction: Math.min(1, off / samples.length) });
  }
  const flushed = encoder.flush();
  if (flushed.length) mp3Parts.push(flushed);
  onProgress?.({ stage: "encode", fraction: 1 });

  const total = mp3Parts.reduce((n, p) => n + p.length, 0);
  if (total < 100) throw new Error("Voice generation returned no audio.");
  const mp3 = new Uint8Array(total);
  let pos = 0;
  for (const p of mp3Parts) {
    mp3.set(p, pos);
    pos += p.length;
  }
  return { blob: new Blob([mp3.buffer as ArrayBuffer], { type: "audio/mpeg" }), voiceId };
}
