"use client";

import { useState } from "react";
import { Download, Loader2, Smartphone, MonitorDown } from "lucide-react";
import Button from "@/components/ui/Button";

export default function DownloadAppButton() {
  const [clicked, setClicked] = useState<"apk" | "exe" | null>(null);

  const handleClick = (type: "apk" | "exe") => {
    setClicked(type);
    const url = type === "apk"
      ? "/downloads/omnibox-app.apk"
      : "https://github.com/rehan33102/omnitoolbox/releases/download/v1.0.0-pc/OmniToolBox-PC-Portable.zip";
    window.open(url, "_blank", "noopener");
    setTimeout(() => setClicked(null), 3000);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="lg" variant="secondary" onClick={() => handleClick("apk")}>
        {clicked === "apk" ? (
          <>
            <Loader2 size={17} className="animate-spin" /> Starting download…
          </>
        ) : (
          <>
            <Smartphone size={17} /> Download Android App
          </>
        )}
      </Button>
      <Button size="lg" onClick={() => handleClick("exe")}>
        {clicked === "exe" ? (
          <>
            <Loader2 size={17} className="animate-spin" /> Starting download…
          </>
        ) : (
          <>
            <MonitorDown size={17} /> Download for PC
          </>
        )}
      </Button>
    </div>
  );
}
