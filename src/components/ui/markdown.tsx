import type { ReactNode } from "react";

/**
 * Minimal Markdown renderer for learning materials: headings, bullet/numbered lists,
 * paragraphs, **bold** and *italic*. No raw HTML is ever injected.
 */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length) {
      blocks.push(
        <p key={blocks.length} className="leading-7 text-ink">
          {inline(paragraph.join(" "))}
        </p>,
      );
      paragraph = [];
    }
    if (list) {
      const Tag = list.ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={blocks.length} className={`space-y-1 pl-5 leading-7 text-ink ${list.ordered ? "list-decimal" : "list-disc"}`}>
          {list.items.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </Tag>,
      );
      list = null;
    }
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);

    if (!line) flush();
    else if (heading) {
      flush();
      blocks.push(
        heading[1].length <= 2 ? (
          <h3 key={blocks.length} className="pt-2 font-serif text-2xl leading-7 text-ink">
            {inline(heading[2])}
          </h3>
        ) : (
          <h4 key={blocks.length} className="pt-1 text-[15px] font-medium text-ink">
            {inline(heading[2])}
          </h4>
        ),
      );
    } else if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (paragraph.length || (list && list.ordered !== ordered)) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else {
      if (list) flush();
      paragraph.push(line);
    }
  }
  flush();

  return <div className="space-y-3 text-[15px]">{blocks}</div>;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index} className="font-medium">{part.slice(2, -2)}</strong>;
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}
