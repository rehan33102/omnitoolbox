import {
  Paintbrush, Eraser, Hash, ImagePlus, LayoutGrid, Minimize2,
  RefreshCw, Type, UserRound, Wand2, Wrench, Mic, Files, Scissors,
  FileImage, QrCode, KeyRound, Banknote, Ruler, Flame, Cake,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  Wand2, RefreshCw, Minimize2, Paintbrush, Eraser, Type,
  UserRound, Hash, LayoutGrid, ImagePlus, Wrench, Mic, Files, Scissors,
  FileImage, QrCode, KeyRound, Banknote, Ruler, Flame, Cake,
};

export default function ToolIcon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const Icon = MAP[name] ?? Wrench;
  return <Icon size={size} className={className} />;
}
