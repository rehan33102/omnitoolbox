import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  // Embed the real brand logo (transparent PNG) as the favicon
  const logoPath = join(process.cwd(), "public", "images", "logo.png");
  const buf = await readFile(logoPath);
  const dataUri = `data:image/png;base64,${buf.toString("base64")}`;

  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={dataUri}
        width={64}
        height={64}
        style={{ objectFit: "contain" }}
        alt="OmniToolBox"
      />
    ),
    { ...size }
  );
}
