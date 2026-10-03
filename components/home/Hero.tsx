import Link from "next/link";
import { ArrowRight, Sparkles, Zap } from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

export default function Hero({ toolCount }: { toolCount: number }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-brand-600/20 blur-[140px]" />
        <div className="absolute top-20 right-10 h-64 w-64 rounded-full bg-accent-500/10 blur-[100px]" />
      </div>

      <div className="container pt-16 pb-12 md:pt-24 md:pb-16 text-center">
        <Badge variant="ai" className="mb-5 animate-fade-up">
          <Sparkles size={12} /> {toolCount}+ free tools · no signup
        </Badge>
        <h1 className="font-display text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1] animate-fade-up">
          Every AI & web tool
          <br />
          you need. <span className="text-gradient">One toolbox.</span>
        </h1>
        <p className="mt-5 text-zinc-400 text-base md:text-lg max-w-2xl mx-auto animate-fade-up">
          Prompt Studio, image converter & compressor, fancy text, bio generator,
          hashtag finder and more — blazing fast, private, and 100% free.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 animate-fade-up">
          <Link href="#tools">
            <Button size="lg">
              <Zap size={17} /> Explore tools <ArrowRight size={17} />
            </Button>
          </Link>
          <Link href="/ai-prompt-studio">
            <Button size="lg" variant="secondary">Try Prompt Studio</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
