import type { Tool } from "@/types";

export const TOOLS: Tool[] = [
  {
    id: "t1", slug: "ai-prompt-studio", title: "AI Prompt Studio",
    tagline: "Generate & optimize prompts for Midjourney, ChatGPT, Flux & Claude",
    description: "Multi-input prompt builder with preset styles, negative-prompt bank and {variable} placeholders. One-click copy, history included.",
    category: "ai", href: "/tools/ai-prompt-studio", icon: "Wand2", image: "/images/tools/ai-prompt-studio.jpg", badge: "popular",
    enabled: true, sortOrder: 1, usageCount: 0, updatedAt: "2026-10-03",
    keywords: ["prompt generator", "prompt maker", "midjourney prompt", "chatgpt prompt", "ai prompt", "prompt builder", "prompt optimizer", "flux prompt", "claude prompt", "prompt engineering", "dalle prompt", "image prompt maker", "ai prompt writer"],
  },
  {
    id: "t-new", slug: "image-generator", title: "AI Image Generator",
    tagline: "Create stunning AI images from text - free, no signup",
    description: "Type a prompt and generate stunning AI images instantly — free via Pollinations.ai. Style presets, multiple sizes, Flux & Turbo models. Download or save to your library.",
    category: "ai", href: "/tools/image-generator", icon: "Sparkles", badge: "new",
    enabled: true, sortOrder: 1.5, usageCount: 0, updatedAt: "2026-10-05",
    keywords: ["ai image generator", "text to image", "generate image", "ai art", "ai photo maker", "free image generator", "flux image", "ai picture generator", "text to picture", "ai image creator", "generate ai art", "free ai art"],
  },
  {
    id: "t2", slug: "image-converter", title: "Image Converter",
    tagline: "Convert WebP ↔ PNG ↔ JPG instantly in your browser",
    description: "Client-side image format converter. Your files never leave your device.",
    category: "image", href: "/tools/image-converter", icon: "RefreshCw", image: "/images/tools/image-converter.jpg", badge: "popular",
    enabled: true, sortOrder: 2, usageCount: 0, updatedAt: "2026-10-03",
    keywords: ["image converter", "convert image", "webp to png", "png to jpg", "jpg to png", "webp converter", "photo converter", "format converter", "picture converter", "convert webp", "image format changer", "photo format converter", "png to webp"],
  },
  {
    id: "t3", slug: "image-compressor", title: "Image Compressor",
    tagline: "Shrink images up to 90% with zero visible quality loss",
    description: "Smart client-side compression with quality slider and max-dimension control.",
    category: "image", href: "/tools/image-compressor", icon: "Minimize2", image: "/images/tools/image-compressor.jpg",
    enabled: true, sortOrder: 3, usageCount: 0, updatedAt: "2026-10-03",
    keywords: ["image compressor", "compress image", "reduce image size", "shrink photo", "photo compressor", "compress jpg", "compress png", "make image smaller", "reduce file size", "kb reducer", "photo size reducer", "image optimizer", "picture compressor"],
  },
  {
    id: "t4", slug: "svg-cleaner", title: "SVG Cleaner",
    tagline: "Strip bloat from SVGs — smaller files, same pixels",
    description: "Removes comments, metadata, editor namespaces and scripts from SVG markup.",
    category: "image", href: "/tools/svg-cleaner", icon: "Paintbrush", image: "/images/tools/svg-cleaner.jpg",
    enabled: true, sortOrder: 4, usageCount: 0, updatedAt: "2026-10-03",
    keywords: ["svg cleaner", "clean svg", "svg optimizer", "optimize svg", "svg minifier", "reduce svg size", "svg editor", "remove svg metadata", "svg compressor", "minify svg"],
  },
  {
    id: "t5", slug: "background-remover", title: "Background Remover",
    tagline: "Remove image backgrounds with one click",
    description: "Client-side background removal interface powered by in-browser ML.",
    category: "image", href: "/tools/background-remover", icon: "Eraser", image: "/images/tools/background-remover.jpg", badge: "new",
    enabled: true, sortOrder: 5, usageCount: 0, updatedAt: "2026-10-03",
    keywords: ["photo maker", "remove background", "background remover", "transparent background", "png maker", "cutout", "erase bg", "photo editor", "bild hintergrund entfernen", "remove bg", "transparent png", "bg eraser", "photo cutout", "sticker maker", "photo background changer"],
  },
  {
    id: "t21", slug: "background-studio", title: "Background Studio",
    tagline: "Pro background studio — change backgrounds like a pro",
    description: "Upload a photo, AI removes the background, then restyle it: solid colors, gradients, blurred background, custom photos, studio scenes. Add drop shadows, tune brightness & contrast, download in HD. 100% free, on-device.",
    category: "image", href: "/tools/background-studio", icon: "Palette", image: "/images/tools/background-studio.jpg", badge: "new",
    enabled: true, sortOrder: 5.5, usageCount: 0, updatedAt: "2026-10-04",
    keywords: ["background studio", "change background", "photo background changer", "free background remover", "blur background", "photo background editor", "replace background", "background changer app", "portrait background", "studio background", "add shadow to photo", "photo editor online free", "hintergrund ändern", "foto hintergrund wechseln"],
  },
  {
    id: "t6", slug: "fancy-text", title: "Fancy Text Stylizer",
    tagline: "Unicode text styles with live preview — copy anywhere",
    description: "50+ unicode font styles for bios, captions and posts. Live preview, one-click copy.",
    category: "social", href: "/tools/fancy-text", icon: "Type", image: "/images/tools/fancy-text.jpg", badge: "popular",
    enabled: true, sortOrder: 6, usageCount: 0, updatedAt: "2026-10-03",
    keywords: ["fancy text", "stylish text", "cool fonts", "unicode fonts", "text styler", "aesthetic text", "instagram fonts", "bio fonts", "fancy letters", "cute text", "bold text generator", "cool text maker", "text decorator"],
  },
  {
    id: "t7", slug: "bio-generator", title: "Bio Generator",
    tagline: "Instagram & TikTok bios that convert followers",
    description: "Niche-aware bio templates with emoji, CTA and line-break formatting.",
    category: "social", href: "/tools/bio-generator", icon: "UserRound", image: "/images/tools/bio-generator.jpg",
    enabled: true, sortOrder: 7, usageCount: 0, updatedAt: "2026-10-03",
    keywords: ["bio generator", "instagram bio", "tiktok bio", "bio maker", "profile bio", "bio ideas", "insta bio", "bio writer", "cool bio", "profile description", "bio creator", "best bio"],
  },
  {
    id: "t8", slug: "hashtag-finder", title: "Hashtag Finder",
    tagline: "High-reach hashtags for every niche",
    description: "Curated hashtag packs balanced across high/medium/low competition.",
    category: "social", href: "/tools/hashtag-finder", icon: "Hash", image: "/images/tools/hashtag-finder.jpg",
    enabled: true, sortOrder: 8, usageCount: 0, updatedAt: "2026-10-03",
    keywords: ["hashtag finder", "hashtag generator", "instagram hashtags", "tiktok hashtags", "best hashtags", "viral hashtags", "hashtag maker", "reels hashtags", "trending hashtags", "hashtag ideas", "hashtag tool", "more likes hashtags"],
  },
  {
    id: "t9", slug: "ai-directory", title: "AI Tools Directory",
    tagline: "Discover newly launched AI tools, voted by the community",
    description: "Community-voted directory of new AI tools with categories, tags and honest rankings.",
    category: "ai", href: "/tools/ai-directory", icon: "LayoutGrid", image: "/images/tools/ai-directory.jpg",
    enabled: true, sortOrder: 9, usageCount: 0, updatedAt: "2026-10-03",
    keywords: ["ai tools directory", "ai tools list", "new ai tools", "best ai tools", "ai apps", "discover ai", "ai website list", "chatgpt alternatives", "ai tools website", "find ai tools", "ai apps list"],
  },
  {
    id: "t10", slug: "ai-voiceover", title: "AI Voiceover Studio",
    tagline: "Turn text into natural AI voiceovers — free",
    description: "Free text-to-speech studio using your device's built-in AI voices. Pick a voice, tune rate & pitch, play instantly. Nothing uploaded.",
    category: "ai", href: "/tools/ai-voiceover", icon: "Mic", image: "/images/tools/ai-voiceover.jpg", badge: "new",
    enabled: true, sortOrder: 10, usageCount: 0, updatedAt: "2026-10-03",
    keywords: ["text to speech", "tts", "voice generator", "narrator", "audio", "voice maker", "speech", "voiceover", "text to voice", "ai voice", "read aloud", "mp3 voice", "voice over generator", "robot voice", "speak text", "voice studio"],
  },
  {
    id: "t11", slug: "pdf-merge", title: "PDF Merger",
    tagline: "Combine multiple PDFs into one file",
    description: "Merge PDFs in your browser — reorder pages, one click, private. No uploads, no watermarks.",
    category: "pdf", href: "/tools/pdf-merge", icon: "Files", image: "/images/tools/pdf-merge.jpg", badge: "popular",
    enabled: true, sortOrder: 11, usageCount: 0, updatedAt: "2026-10-03",
    keywords: ["merge pdf", "combine pdf", "join pdf", "pdf merger", "pdf joiner", "pdf combiner", "merge pdf files", "attach pdf", "pdf binder", "pdf joiner online", "combine pdf files"],
  },
  {
    id: "t12", slug: "pdf-split", title: "PDF Splitter",
    tagline: "Extract pages from any PDF",
    description: "Pick a page range and split it out into a new PDF — all client-side, all private.",
    category: "pdf", href: "/tools/pdf-split", icon: "Scissors", image: "/images/tools/pdf-split.jpg",
    enabled: true, sortOrder: 12, usageCount: 0, updatedAt: "2026-10-03",
    keywords: ["split pdf", "pdf splitter", "extract pdf pages", "separate pdf", "divide pdf", "pdf page extractor", "remove pages pdf", "pdf cutter", "split pdf pages", "pdf separator"],
  },
  {
    id: "t13", slug: "images-to-pdf", title: "Images to PDF",
    tagline: "Turn JPG/PNG photos into a PDF",
    description: "Convert photos to a clean A4 PDF in seconds. Reorder pages, everything stays on your device.",
    category: "pdf", href: "/tools/images-to-pdf", icon: "FileImage", image: "/images/tools/images-to-pdf.jpg",
    enabled: true, sortOrder: 13, usageCount: 0, updatedAt: "2026-10-03",
    keywords: ["images to pdf", "jpg to pdf", "png to pdf", "photo to pdf", "image to pdf", "pictures to pdf", "convert photo to pdf", "make pdf from images", "scan to pdf", "photo pdf maker"],
  },
  {
    id: "t14", slug: "qr-generator", title: "QR Code Generator",
    tagline: "Custom QR codes with colors — free download",
    description: "Generate scannable QR codes for links, text and WiFi. Custom colors, sizes and error correction.",
    category: "web", href: "/tools/qr-generator", icon: "QrCode", image: "/images/tools/qr-generator.jpg", badge: "popular",
    enabled: true, sortOrder: 14, usageCount: 0, updatedAt: "2026-10-03",
    keywords: ["qr code", "qr generator", "barcode", "scan code", "link to qr", "qr maker", "qr code maker", "create qr", "wifi qr", "qr code free", "generate qr", "url to qr", "qr code download"],
  },
  {
    id: "t15", slug: "password-generator", title: "Password Generator",
    tagline: "Military-grade random passwords",
    description: "Cryptographically secure passwords with strength meter. Generated locally — never sent anywhere.",
    category: "web", href: "/tools/password-generator", icon: "KeyRound", image: "/images/tools/password-generator.jpg",
    enabled: true, sortOrder: 15, usageCount: 0, updatedAt: "2026-10-04",
    keywords: ["password generator", "password maker", "strong password", "random password", "secure password", "passwort generator", "create password", "password creator", "safe password", "secure pass", "wifi password generator"],
  },
  {
    id: "t16", slug: "currency-converter", title: "Currency Converter",
    tagline: "Live USD, PKR, EUR, USDT & 15 currencies",
    description: "Convert between 15 currencies with live mid-market rates (PKR, USD, EUR, GBP, AED, USDT…). 100% free.",
    category: "web", href: "/tools/currency-converter", icon: "Banknote", image: "/images/tools/currency-converter.jpg", badge: "new",
    enabled: true, sortOrder: 16, usageCount: 0, updatedAt: "2026-10-04",
    keywords: ["currency converter", "currency exchange", "usd to pkr", "pkr to usd", "money converter", "dollar to rupee", "forex converter", "exchange rate", "eur to usd", "usdt price", "dollar rate today", "currency calculator", "dollar to pkr"],
  },
  {
    id: "t17", slug: "unit-converter", title: "Unit Converter",
    tagline: "Length, weight, temperature, volume & more",
    description: "Instant conversions across 6 unit categories with a full equivalents table. All client-side.",
    category: "web", href: "/tools/unit-converter", icon: "Ruler", image: "/images/tools/unit-converter.jpg", badge: "new",
    enabled: true, sortOrder: 17, usageCount: 0, updatedAt: "2026-10-04",
    keywords: ["unit converter", "length converter", "weight converter", "temperature converter", "kg to lbs", "cm to inch", "celsius to fahrenheit", "measurement converter", "volume converter", "miles to km", "unit calculator", "convert units"],
  },
  {
    id: "t18", slug: "bmi-calorie-calculator", title: "BMI & Calorie Calculator",
    tagline: "BMI score + daily calorie targets",
    description: "Body Mass Index with healthy-weight range plus BMR/TDEE calorie targets for losing, maintaining or gaining.",
    category: "web", href: "/tools/bmi-calorie-calculator", icon: "Flame", image: "/images/tools/bmi-calorie-calculator.jpg", badge: "new",
    enabled: true, sortOrder: 18, usageCount: 0, updatedAt: "2026-10-04",
    keywords: ["bmi calculator", "calorie calculator", "bmi", "body mass index", "weight calculator", "calories per day", "tdee calculator", "bmr calculator", "lose weight calculator", "ideal weight", "fat calculator", "diet calculator"],
  },
  {
    id: "t19", slug: "age-calculator", title: "Age Calculator",
    tagline: "Exact age, total days & next birthday",
    description: "Years, months, days, total hours lived and a countdown to your next birthday. Private — nothing uploaded.",
    category: "web", href: "/tools/age-calculator", icon: "Cake", image: "/images/tools/age-calculator.jpg", badge: "new",
    enabled: true, sortOrder: 19, usageCount: 0, updatedAt: "2026-10-04",
    keywords: ["age calculator", "how old am i", "birthday calculator", "calculate age", "date of birth calculator", "age finder", "years old calculator", "days lived", "next birthday", "dob calculator", "my age", "age in days"],
  },
  {
    id: "t20", slug: "watermark-remover", title: "Watermark Remover",
    tagline: "Erase watermarks from photos & videos",
    description: "Paint over watermarks, logos or text marks and erase them with smart AI inpainting — works on IMAGES and VIDEOS. Auto-detects corner watermarks (like Gemini AI marks). 100% client-side — nothing uploaded.",
    category: "image", href: "/tools/watermark-remover", icon: "Droplets", image: "/images/tools/watermark-remover.jpg", badge: "new",
    enabled: true, sortOrder: 20, usageCount: 0, updatedAt: "2026-10-04",
    keywords: ["watermark remover", "remove watermark", "gemini watermark", "ai watermark remover", "logo remover", "remove logo from photo", "erase watermark", "watermark eraser", "text remover", "remove text from image", "clean image", "photo watermark remover", "free watermark remover", "video watermark remover", "remove watermark from video", "gemini video watermark"],
  },
];

export const getEnabledTools = (): Tool[] =>
  TOOLS.filter((t) => t.enabled).sort((a, b) => a.sortOrder - b.sortOrder);

export const getToolBySlug = (slug: string): Tool | undefined =>
  TOOLS.find((t) => t.slug === slug);

/** Merge DB overrides (admin toggles/edits + admin-added tools) over the registry. */
export function mergeTools(dbRows: Record<string, unknown>[]): Tool[] {
  // Soft-deleted rows (admin removed the tool) are skipped entirely.
  const live = dbRows.filter((r) => !r.is_deleted);
  const bySlug = new Map(live.map((r) => [r.slug as string, r]));
  const merged: Tool[] = TOOLS.map((t) => ({ ...t, ...rowToPartial(bySlug.get(t.slug)) }));
  for (const row of live) {
    if (!merged.some((t) => t.slug === row.slug)) {
      merged.push(rowToPartial(row) as Tool);
    }
  }
  return merged.sort((a, b) => a.sortOrder - b.sortOrder);
}

function rowToPartial(row: Record<string, unknown> | undefined): Partial<Tool> {
  if (!row) return {};
  const partial: Partial<Tool> = {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    tagline: (row.tagline as string) ?? "",
    description: (row.description as string) ?? "",
    category: (row.category as Tool["category"]) ?? "web",
    href: (row.href as string) ?? `/tools/${row.slug}`,
    icon: (row.icon as string) ?? "Wrench",
    keywords: Array.isArray(row.keywords) ? (row.keywords as string[]) : [],
    badge: row.badge as Tool["badge"],
    enabled: row.enabled as boolean,
    sortOrder: (row.sort_order as number) ?? 99,
    usageCount: (row.usage_count as number) ?? 0,
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
  // Only override the image when the DB row actually sets one — a missing
  // value must not wipe the registry's built-in card image.
  if (typeof row.image === "string" && row.image.length > 0) {
    partial.image = row.image;
  }
  return partial;
}
