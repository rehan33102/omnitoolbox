"use client";

import { useRef, useState } from "react";
import { Maximize, Minimize, Play, Pause, Volume2, VolumeX } from "lucide-react";

/** Video player with WORKING fullscreen — like YouTube. */
export default function TutorialVideo({ src }: { src: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const toggleFullscreen = async () => {
    const el = wrapRef.current;
    if (!el) return;
    // Try native fullscreen first
    try {
      if (!document.fullscreenElement) {
        const req = el.requestFullscreen?.bind(el)
          || (el as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen?.bind(el);
        if (req) { await req(); setIsFull(true); return; }
      } else {
        await document.exitFullscreen();
        setIsFull(false);
        return;
      }
    } catch { /* fall through to CSS fake fullscreen */ }
    // CSS fake fullscreen — works everywhere incl. Android WebView
    setIsFull((prev) => {
      const next = !prev;
      if (next) {
        el.style.position = "fixed";
        el.style.inset = "0";
        el.style.zIndex = "9999";
        el.style.borderRadius = "0";
        document.body.style.overflow = "hidden";
      } else {
        el.style.position = "";
        el.style.inset = "";
        el.style.zIndex = "";
        el.style.borderRadius = "";
        document.body.style.overflow = "";
      }
      return next;
    });
  };

  const onTime = () => {
    const v = videoRef.current;
    if (v && v.duration) setProgress((v.currentTime / v.duration) * 100);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - r.left) / r.width) * v.duration;
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div ref={wrapRef} className="relative w-full aspect-video bg-black rounded-xl overflow-hidden group">
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        playsInline
        className="w-full h-full"
        onClick={togglePlay}
        onTimeUpdate={onTime}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      {/* Big center play button */}
      {!playing && (
        <button onClick={togglePlay} aria-label="Play"
          className="absolute inset-0 grid place-items-center bg-black/30">
          <span className="grid place-items-center size-20 rounded-full bg-white/90 text-black shadow-2xl hover:scale-110 transition">
            <Play size={36} className="ml-1" fill="currentColor" />
          </span>
        </button>
      )}

      {/* Bottom controls — always visible on touch */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8">
        <div onClick={seek} className="h-1.5 bg-white/25 rounded-full cursor-pointer mb-2">
          <div className="h-full bg-gradient-to-r from-ember-500 to-magent-500 rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center gap-3 text-white">
          <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="hover:scale-110 transition">
            {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <button onClick={toggleMute} aria-label="Mute" className="hover:scale-110 transition">
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <span className="text-xs font-medium">
            {fmt(videoRef.current?.currentTime ?? 0)} / {fmt(videoRef.current?.duration ?? 0)}
          </span>
          <div className="flex-1" />
          <button onClick={toggleFullscreen} aria-label="Fullscreen"
            className="grid place-items-center size-9 rounded-full bg-white/20 hover:bg-white/35 hover:scale-110 transition">
            {isFull ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
