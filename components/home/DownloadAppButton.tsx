"use client";

import { useState } from "react";
import { Download, Loader2, Smartphone } from "lucide-react";
import Button from "@/components/ui/Button";

export default function DownloadAppButton() {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    setClicked(true);
    // Open download in new tab; reset state after a moment
    window.open("/downloads/omnibox-app.apk", "_blank", "noopener");
    setTimeout(() => setClicked(false), 3000);
  };

  return (
    <Button size="lg" variant="secondary" onClick={handleClick}>
      {clicked ? (
        <>
          <Loader2 size={17} className="animate-spin" /> Starting download…
        </>
      ) : (
        <>
          <Smartphone size={17} /> Download App
        </>
      )}
    </Button>
  );
}
