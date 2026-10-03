import Link from "next/link";
import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="container py-24 text-center">
      <p className="font-display text-7xl font-extrabold text-gradient mb-4">404</p>
      <h1 className="font-display text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-zinc-500 text-sm mb-6">The page you are looking for does not exist.</p>
      <Link href="/">
        <Button>Back home</Button>
      </Link>
    </div>
  );
}
