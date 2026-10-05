import { buildMetadata } from "@/lib/seo";
import Card from "@/components/ui/Card";
import { Smartphone, MonitorDown, Download, Check } from "lucide-react";

export const metadata = buildMetadata({
  title: "Download Omni Tool Box — Android & PC Apps",
  description: "Download Omni Tool Box for Android and Windows PC. Free forever.",
  path: "/download",
  keywords: ["download", "android app", "pc app", "windows app"],
});

export default function DownloadPage() {
  return (
    <div className="container py-10 max-w-4xl">
      <div className="text-center mb-10">
        <h1 className="font-display text-3xl md:text-5xl font-bold mb-4">
          Download <span className="text-gradient-warm">Omni Tool Box</span>
        </h1>
        <p className="text-zinc-500 max-w-2xl mx-auto">
          Get the app on your phone or PC.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Android */}
        <Card className="p-6 text-center">
          <span className="inline-grid place-items-center size-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white mb-4">
            <Smartphone size={32} />
          </span>
          <h2 className="font-display text-xl font-bold mb-2">Android App</h2>
          <p className="text-sm text-zinc-500 mb-4">
            For mobile phones & tablets. Install the APK directly.
          </p>
          <ul className="text-left text-sm space-y-2 mb-6 max-w-xs mx-auto">
            <li className="flex items-center gap-2"><Check size={16} className="text-emerald-500 shrink-0" /> All tools in your pocket</li>
            <li className="flex items-center gap-2"><Check size={16} className="text-emerald-500 shrink-0" /> Works offline (cached)</li>
            <li className="flex items-center gap-2"><Check size={16} className="text-emerald-500 shrink-0" /> Auto-updates with website</li>
          </ul>
          <a href="/downloads/omnibox-app.apk" download
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold px-6 py-3 hover:scale-105 transition">
            <Download size={18} /> Download APK
          </a>
          <p className="text-xs text-zinc-500 mt-3">v11 · Android 7.0+</p>
        </Card>

        {/* PC */}
        <Card className="p-6 text-center">
          <span className="inline-grid place-items-center size-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white mb-4">
            <MonitorDown size={32} />
          </span>
          <h2 className="font-display text-xl font-bold mb-2">Windows PC App</h2>
          <p className="text-sm text-zinc-500 mb-4">
            For desktop & laptop. Extract ZIP and run — no install needed!
          </p>
          <ul className="text-left text-sm space-y-2 mb-6 max-w-xs mx-auto">
            <li className="flex items-center gap-2"><Check size={16} className="text-violet-500 shrink-0" /> Big screen experience</li>
            <li className="flex items-center gap-2"><Check size={16} className="text-violet-500 shrink-0" /> Portable — no install</li>
            <li className="flex items-center gap-2"><Check size={16} className="text-violet-500 shrink-0" /> Always latest version</li>
          </ul>
          <a href="https://github.com/rehan33102/omnitoolbox/releases/download/v1.0.0-pc/OmniToolBox-PC-Portable.zip"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold px-6 py-3 hover:scale-105 transition">
            <Download size={18} /> Download for PC
          </a>
          <p className="text-xs text-zinc-500 mt-3">v1.0.0 · Windows 10/11 · 110MB</p>
        </Card>
      </div>

      <Card className="mt-8 p-6">
        <h3 className="font-bold mb-3">📦 How to install PC version:</h3>
        <ol className="text-sm text-zinc-500 space-y-2 list-decimal list-inside">
          <li>Click <strong className="text-zinc-700 dark:text-zinc-300">"Download for PC"</strong> above</li>
          <li>Extract the ZIP file anywhere (right-click → Extract All)</li>
          <li>Open the folder and double-click <strong className="text-zinc-700 dark:text-zinc-300">"Omni Tool Box.exe"</strong></li>
          <li>Done! The app opens with all the latest tools 🎉</li>
        </ol>
      </Card>
    </div>
  );
}
