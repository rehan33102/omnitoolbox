import { ImageResponse } from "next/og";

export const alt = "OmniToolBox — Free AI Tools & Web Utilities";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#08080f",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 800, display: "flex" }}>
          Omni
          <span
            style={{
              background: "linear-gradient(90deg,#8b5cf6,#22d3ee)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            ToolBox
          </span>
        </div>
        <div style={{ fontSize: 28, color: "#a1a1aa", marginTop: 16 }}>
          50+ free AI & web utilities. No signup.
        </div>
      </div>
    ),
    { ...size }
  );
}
