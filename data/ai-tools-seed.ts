import type { AIToolListing } from "@/types";

export const AI_TOOLS_SEED: AIToolListing[] = [
  {
    id: "s1", slug: "notion-ai", name: "Notion AI", tagline: "Your wiki that writes with you",
    description: "AI writing assistant built into Notion — summaries, drafts, action items and Q&A over your docs.",
    url: "https://notion.so", category: "productivity", tags: ["writing", "notes", "assistant"],
    votes: 2841, featured: true, createdAt: "2026-09-20",
  },
  {
    id: "s2", slug: "runway-gen4", name: "Runway Gen-4", tagline: "Text-to-video, Hollywood grade",
    description: "Generate cinematic video clips from text and images with best-in-class motion fidelity.",
    url: "https://runway.ml", affiliateUrl: "https://runway.ml?ref=omnitoolbox",
    category: "video", tags: ["video", "generative", "cinematic"],
    votes: 1932, featured: true, createdAt: "2026-09-28",
  },
  {
    id: "s3", slug: "elevenlabs", name: "ElevenLabs", tagline: "The most realistic AI voices",
    description: "Lifelike text-to-speech and voice cloning in 29 languages for videos, podcasts and audiobooks.",
    url: "https://elevenlabs.io", affiliateUrl: "https://elevenlabs.io?ref=omnitoolbox",
    category: "audio", tags: ["voice", "tts", "podcast"],
    votes: 2210, featured: true, createdAt: "2026-09-15",
  },
  {
    id: "s4", slug: "perplexity", name: "Perplexity", tagline: "Answers with sources, not SEO spam",
    description: "AI search engine that cites every claim — research-grade answers in seconds.",
    url: "https://perplexity.ai", category: "research", tags: ["search", "research", "citations"],
    votes: 3102, featured: false, createdAt: "2026-08-30",
  },
  {
    id: "s5", slug: "suno-v4", name: "Suno v4", tagline: "Full songs from a sentence",
    description: "Generate complete songs with vocals, mixing and mastering from a simple prompt.",
    url: "https://suno.com", category: "audio", tags: ["music", "generative", "vocals"],
    votes: 1654, featured: false, createdAt: "2026-10-01",
  },
  {
    id: "s6", slug: "cursor-ide", name: "Cursor", tagline: "The AI-first code editor",
    description: "An editor that predicts your next edit, writes multi-file refactors and chats with your codebase.",
    url: "https://cursor.sh", affiliateUrl: "https://cursor.sh?ref=omnitoolbox",
    category: "coding", tags: ["code", "ide", "developer"],
    votes: 2788, featured: false, createdAt: "2026-09-10",
  },
  {
    id: "s7", slug: "gamma-app", name: "Gamma", tagline: "Decks & docs in one prompt",
    description: "Type an idea, get a designed presentation, doc or webpage — no design skills needed.",
    url: "https://gamma.app", category: "productivity", tags: ["presentations", "design", "docs"],
    votes: 1204, featured: false, createdAt: "2026-10-02",
  },
  {
    id: "s8", slug: "heygen", name: "HeyGen", tagline: "AI avatars that present for you",
    description: "Create studio-quality spokesperson videos from text in 175+ languages.",
    url: "https://heygen.com", category: "video", tags: ["avatar", "video", "marketing"],
    votes: 987, featured: false, createdAt: "2026-09-25",
  },
];

export const DIRECTORY_CATEGORIES = ["productivity", "video", "audio", "coding", "research", "image", "marketing"] as const;
