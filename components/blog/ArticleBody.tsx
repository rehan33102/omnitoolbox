function inline(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="text-white font-semibold">{p}</strong>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export default function ArticleBody({ body }: { body: string }) {
  const blocks = body.split(/\n\n+/);

  return (
    <div className="space-y-5 text-[15px] leading-relaxed text-zinc-300">
      {blocks.map((b, i) => {
        const t = b.trim();
        if (t.startsWith("## ")) {
          return <h2 key={i} className="font-display text-xl font-bold text-white pt-4">{inline(t.slice(3))}</h2>;
        }
        if (t.startsWith("### ")) {
          return <h3 key={i} className="font-display text-lg font-semibold text-white pt-2">{inline(t.slice(4))}</h3>;
        }
        if (t.split("\n").every((l) => l.trim().startsWith("- "))) {
          return (
            <ul key={i} className="space-y-2.5 list-disc pl-5 marker:text-brand-400">
              {t.split("\n").map((l, j) => (
                <li key={j}>{inline(l.trim().slice(2))}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{inline(t)}</p>;
      })}
    </div>
  );
}
