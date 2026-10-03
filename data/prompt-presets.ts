export type ModelId = "midjourney" | "chatgpt" | "flux" | "claude";

export interface PresetStyle {
  id: string;
  label: string;
  snippet: string;
}

export const MODEL_META: Record<ModelId, { label: string; tagline: string; supportsNegative: boolean }> = {
  midjourney: { label: "Midjourney", tagline: "Stylized image generation — v6 syntax", supportsNegative: true },
  flux: { label: "Flux", tagline: "Photoreal detail — natural-language prompts", supportsNegative: true },
  chatgpt: { label: "ChatGPT / GPT-4", tagline: "Role + task + constraints format", supportsNegative: false },
  claude: { label: "Claude", tagline: "Context-rich structured instructions", supportsNegative: false },
};

const IMG_STYLES: PresetStyle[] = [
  { id: "cinematic", label: "Cinematic", snippet: "cinematic lighting, film still, dramatic atmosphere, 35mm" },
  { id: "photoreal", label: "Photoreal", snippet: "ultra photorealistic, 8k, sharp focus, natural skin texture" },
  { id: "anime", label: "Anime", snippet: "anime style, vibrant, cel shaded, dynamic composition" },
  { id: "cyberpunk", label: "Cyberpunk", snippet: "cyberpunk, neon lights, rain, futuristic city, moody" },
  { id: "oil", label: "Oil Painting", snippet: "classical oil painting, visible brushstrokes, chiaroscuro" },
  { id: "minimal", label: "Minimalist", snippet: "minimalist composition, negative space, clean lines" },
  { id: "render3d", label: "3D Render", snippet: "octane render, 3d, soft studio lighting, high detail" },
  { id: "watercolor", label: "Watercolor", snippet: "delicate watercolor, soft washes, paper texture" },
];

export const PRESET_STYLES: Record<ModelId, PresetStyle[]> = {
  midjourney: IMG_STYLES,
  flux: IMG_STYLES,
  chatgpt: [
    { id: "eli5", label: "Explain Simply", snippet: "Explain like I'm five, using everyday analogies" },
    { id: "expert", label: "Expert Deep-Dive", snippet: "Answer as a domain expert with nuance and concrete examples" },
    { id: "socratic", label: "Socratic Tutor", snippet: "Guide me with probing questions instead of direct answers" },
    { id: "copywriter", label: "Copywriter", snippet: "Write persuasive, benefit-led copy with a strong call to action" },
    { id: "analyst", label: "Analyst", snippet: "Break down pros/cons, trade-offs and a clear recommendation" },
    { id: "coach", label: "Coach", snippet: "Be encouraging but direct; give me an action plan with next steps" },
  ],
  claude: [
    { id: "research", label: "Research Brief", snippet: "Thorough, balanced research summary with key uncertainties flagged" },
    { id: "editor", label: "Editor", snippet: "Tighten the writing: clarity first, cut filler, keep the author's voice" },
    { id: "strategist", label: "Strategist", snippet: "Think in systems: second-order effects, risks, and leverage points" },
    { id: "teacher", label: "Teacher", snippet: "Build understanding progressively with checks for comprehension" },
    { id: "devil", label: "Devil's Advocate", snippet: "Stress-test the idea: find the strongest counterarguments" },
    { id: "summarizer", label: "Summarizer", snippet: "Distill to the essential points a busy executive needs" },
  ],
};

export const NEGATIVE_BANK = [
  "blurry", "low quality", "distorted", "watermark", "text",
  "extra limbs", "deformed", "oversaturated", "grainy", "cropped",
  "duplicate", "mutated hands", "poor anatomy", "jpeg artifacts",
];

export const MJ_ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:2", "21:9"];
