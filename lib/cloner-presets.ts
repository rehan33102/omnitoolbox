/**
 * Ready-made studio voices for the AI Voice Studio.
 *
 * Each preset is a real voice on the clone engine (created from a clean
 * reference recording), so "simple voiceover" mode needs no upload:
 * visitors pick a voice, type, and generate. `preview` is a short clip
 * actually rendered by the engine in that voice.
 */
export interface ClonerPreset {
  slug: string;
  voiceId: string;
  name: string;
  gender: "Male" | "Female";
  accent: "American" | "British";
  blurb: string;
  gradient: string;
  preview: string;
}

export const CLONER_PRESETS: ClonerPreset[] = [
  {
    slug: "ryan",
    voiceId: "0187f75d73f3",
    name: "Ryan",
    gender: "Male",
    accent: "American",
    blurb: "Friendly narrator for YouTube videos",
    gradient: "from-sky-500 to-blue-600",
    preview: "/previews/ryan.mp3",
  },
  {
    slug: "marcus",
    voiceId: "6d1c74ad4c17",
    name: "Marcus",
    gender: "Male",
    accent: "American",
    blurb: "Deep storyteller — documentaries & audiobooks",
    gradient: "from-zinc-600 to-zinc-900",
    preview: "/previews/marcus.mp3",
  },
  {
    slug: "amy",
    voiceId: "382bd908a070",
    name: "Amy",
    gender: "Female",
    accent: "American",
    blurb: "Bright & clear — tutorials and explainers",
    gradient: "from-rose-500 to-pink-600",
    preview: "/previews/amy.mp3",
  },
  {
    slug: "sarah",
    voiceId: "8728bd985a23",
    name: "Sarah",
    gender: "Female",
    accent: "American",
    blurb: "Warm & natural — podcasts and lessons",
    gradient: "from-amber-500 to-orange-600",
    preview: "/previews/sarah.mp3",
  },
  {
    slug: "alan",
    voiceId: "59921644d090",
    name: "Alan",
    gender: "Male",
    accent: "British",
    blurb: "Classic British narration — stories & history",
    gradient: "from-emerald-500 to-teal-700",
    preview: "/previews/alan.mp3",
  },
  {
    slug: "emily",
    voiceId: "07bef3509947",
    name: "Emily",
    gender: "Female",
    accent: "British",
    blurb: "Soft British voice — reading and stories",
    gradient: "from-violet-500 to-purple-700",
    preview: "/previews/emily.mp3",
  },
];

/** Purpose presets — mapped to real engine options (speed / pauses). */
export interface PurposePreset {
  id: string;
  label: string;
  speed: number;
  pauseMult: number;
}

export const PURPOSE_PRESETS: PurposePreset[] = [
  { id: "youtube", label: "YouTube video", speed: 1.0, pauseMult: 1.0 },
  { id: "shorts", label: "Shorts / Reels", speed: 1.08, pauseMult: 0.9 },
  { id: "audiobook", label: "Audiobook", speed: 0.94, pauseMult: 1.15 },
  { id: "podcast", label: "Podcast", speed: 1.0, pauseMult: 1.05 },
  { id: "social", label: "Social media ad", speed: 1.05, pauseMult: 0.95 },
];
