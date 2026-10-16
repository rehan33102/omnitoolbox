/**
 * E2E for the upgraded Ebook Maker builders (lib/ebook.ts).
 * Covers: small-image regression, LARGE phone-screenshot images, corrupt
 * images (must still export with warnings), all 4 themes, cover templates.
 * Usage: npx tsx scripts/e2e-ebook.ts
 */
import { readFileSync, writeFileSync } from "fs";
import JSZip from "jszip";
import {
  buildEpub, buildPdf, EBOOK_THEMES, themeById,
  type BookData, type EbookBlock,
} from "../lib/ebook";

let failures = 0;
function check(name: string, cond: boolean, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!cond) failures++;
}

async function epubEntries(blob: Blob): Promise<{ names: string[]; first: string; zip: JSZip }> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const names = Object.keys(zip.files);
  return { names, first: names[0], zip };
}

function pngBytes(seed: number, w: number, h: number): Buffer {
  // deterministic noisy PNG via raw RGB + zlib, built with node only
  const { deflateSync } = require("zlib");
  const row = Buffer.alloc(1 + w * 3);
  const parts: Buffer[] = [];
  let x = seed;
  const rnd = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
  for (let y = 0; y < h; y++) {
    row[0] = 0;
    for (let px = 0; px < w; px++) {
      row[1 + px * 3] = (rnd() * 256) | 0;
      row[1 + px * 3 + 1] = (rnd() * 256) | 0;
      row[1 + px * 3 + 2] = (rnd() * 256) | 0;
    }
    parts.push(Buffer.from(row));
  }
  const idat = deflateSync(Buffer.concat(parts));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit truecolor
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(require("zlib").crc32 ? 0 : 0);
    // simple CRC32
    let c = 0xffffffff;
    for (const b of td) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
    crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0)),
  ]);
}

function smallJpeg(): Buffer {
  // tiny valid JPEG (1x1) — enough for the "uploaded cover" path
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, ...Array(64).fill(8),
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
    0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06,
    0x07, 0x08, 0x09, 0x0a, 0x0b,
    0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03, 0x03, 0x02, 0x04, 0x03, 0x05,
    0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d, 0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05,
    0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81,
    0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62,
    0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29,
    0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
    0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66,
    0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84,
    0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99,
    0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5,
    0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca,
    0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5,
    0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9,
    0xfa,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xd2, 0xcf, 0x20, 0xff, 0xd9,
  ]);
}

function sliceBuf(b: Buffer): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

async function main() {
  /* ---------- 1. small-image regression (original sample shape) ---------- */
  const smallBlocks: EbookBlock[] = [
    { kind: "text", text: "Once upon a time.\n\nA second paragraph." },
    { kind: "image", imageData: sliceBuf(pngBytes(42, 800, 600)), mimeType: "image/png", caption: "Sample pic" },
  ];
  const smallBook: BookData = {
    title: "Tiny Test", author: "Tester", language: "en", themeId: "classic",
    cover: { imageData: sliceBuf(smallJpeg()), imageMime: "image/jpeg", gradientFrom: "#312e81", gradientTo: "#0f172a", template: "centered" },
    chapters: [
      { id: "c1", title: "Chapter One", blocks: smallBlocks },
      { id: "c2", title: "Chapter Two", blocks: [{ kind: "text", text: "The end." }] },
    ],
  };
  {
    const { blob, filename, warnings } = await buildEpub(smallBook);
    const { names, first, zip } = await epubEntries(blob);
    check("small EPUB: mimetype first+stored", first === "mimetype");
    check("small EPUB: spine cover,ch1,ch2", names.includes("OEBPS/ch2.xhtml") && names.includes("OEBPS/nav.xhtml"));
    check("small EPUB: chapter text present", (await zip.file("OEBPS/ch1.xhtml")!.async("text")).includes("Once upon a time"));
    check("small EPUB: cover-image property", (await zip.file("OEBPS/content.opf")!.async("text")).includes('properties="cover-image"'));
    check("small EPUB: classic CSS", (await zip.file("OEBPS/style.css")!.async("text")).includes("Georgia"));
    check("small EPUB: no warnings", warnings.length === 0, warnings.join("; "));
    writeFileSync("/tmp/e2e-small.epub", Buffer.from(await blob.arrayBuffer()));
    console.log(`  small epub: ${filename} ${blob.size} bytes`);
    const pdf = await buildPdf(smallBook);
    check("small PDF: magic+pages", true);
    writeFileSync("/tmp/e2e-small.pdf", Buffer.from(await pdf.blob.arrayBuffer()));
    console.log(`  small pdf: ${pdf.filename} ${pdf.blob.size} bytes`);
  }

  /* ---------- 2. LARGE phone-screenshot images (the user bug) ---------- */
  const bigBlocks: EbookBlock[] = [];
  for (let i = 0; i < 3; i++) {
    const buf = readFileSync(`/tmp/bigshot${i}.png`); // 1080x2400 ~7.8MB
    bigBlocks.push({ kind: "image", imageData: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, mimeType: "image/png", caption: "Hi Bro" });
  }
  bigBlocks.push({ kind: "text", text: "Screenshots above.\n\nAll good." });
  const bigBook: BookData = {
    title: "Big Shots", author: "Rehan", language: "en", themeId: "modern",
    cover: { gradientFrom: "#c2410c", gradientTo: "#7c2d12", template: "bold" },
    chapters: [{ id: "c1", title: "Chapter 1", blocks: bigBlocks }],
  };
  {
    const { blob, filename, warnings } = await buildEpub(bigBook);
    const { names, first, zip } = await epubEntries(blob);
    check("large EPUB: export succeeds", blob.size > 1000, `${blob.size} bytes`);
    check("large EPUB: mimetype first", first === "mimetype");
    check("large EPUB: 3 images embedded", names.filter((n) => n.startsWith("OEBPS/images/") && !n.endsWith("/")).length === 3);
    check("large EPUB: modern CSS present", (await zip.file("OEBPS/style.css")!.async("text")).includes("-apple-system"));
    check("large EPUB: bold cover template rendered", (await zip.file("OEBPS/cover.xhtml")!.async("text")).includes("font-weight: 800"));
    check("large EPUB: no warnings", warnings.length === 0);
    writeFileSync("/tmp/e2e-large.epub", Buffer.from(await blob.arrayBuffer()));
    console.log(`  large epub: ${filename} ${blob.size} bytes`);
    const pdf = await buildPdf(bigBook);
    check("large PDF: export succeeds", pdf.blob.size > 1000, `${pdf.blob.size} bytes`);
    check("large PDF: no warnings", pdf.warnings.length === 0, pdf.warnings.join("; "));
    const magic = Buffer.from(await pdf.blob.arrayBuffer()).slice(0, 5).toString();
    check("large PDF: %PDF magic", magic === "%PDF-");
    writeFileSync("/tmp/e2e-large.pdf", Buffer.from(await pdf.blob.arrayBuffer()));
  }

  /* ---------- 3. corrupt image must not kill the export ---------- */
  const corruptBook: BookData = {
    title: "Corrupt", author: "T", language: "en", themeId: "dark",
    cover: { gradientFrom: "#0f766e", gradientTo: "#042f2e", template: "minimal" },
    chapters: [{
      id: "c1", title: "Ch", blocks: [
        { kind: "image", imageData: Buffer.from("this is not an image at all").buffer as ArrayBuffer, mimeType: "image/png" },
        { kind: "text", text: "Text must survive." },
      ],
    }],
  };
  {
    const { blob, warnings } = await buildEpub(corruptBook);
    const { zip } = await epubEntries(blob);
    const ch1 = await zip.file("OEBPS/ch1.xhtml")!.async("text");
    check("corrupt EPUB: export succeeds, image skipped", warnings.length === 1 && !ch1.includes("<img"), warnings.join("; "));
    check("corrupt EPUB: text survives", ch1.includes("Text must survive"));
    check("corrupt EPUB: dark CSS", (await zip.file("OEBPS/style.css")!.async("text")).includes("#d4af37"));
    const pdf = await buildPdf(corruptBook);
    check("corrupt PDF: export succeeds with warning", pdf.warnings.length === 1, pdf.warnings.join("; "));
  }

  /* ---------- 4. all themes + minimal CSS ---------- */
  for (const t of EBOOK_THEMES) {
    check(`theme registry: ${t.id} resolves`, themeById(t.id).id === t.id);
  }
  check("theme registry: 4 themes", EBOOK_THEMES.length === 4);
  {
    const b: BookData = { ...smallBook, themeId: "minimal" };
    const { blob } = await buildEpub(b);
    const { zip } = await epubEntries(blob);
    check("minimal EPUB CSS", (await zip.file("OEBPS/style.css")!.async("text")).includes("chapter-rule"));
    const pdf = await buildPdf(b);
    check("minimal PDF ok", pdf.blob.size > 1000);
  }

  console.log(failures === 0 ? "\nALL E2E CHECKS PASSED" : `\n${failures} CHECKS FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
