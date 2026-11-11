import type { ReactNode } from "react";

/**
 * Minimal Markdown renderer for learning materials: headings, bullet/numbered lists,
 * tables, paragraphs, **bold** and *italic*. No raw HTML is ever injected.
 */
export function Markdown({ text, compact = false }: { text: string; compact?: boolean }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let paragraph: string[] = [];
  let table: string[][] = [];

  const flush = () => {
    if (paragraph.length) {
      blocks.push(
        <p key={blocks.length} className="leading-7 text-ink">
          {inline(paragraph.join(" "))}
        </p>,
      );
      paragraph = [];
    }
    if (table.length) {
      const [head, ...rows] = table;
      blocks.push(
        <div key={blocks.length} className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas text-muted">
              <tr>
                {head.map((cell, index) => (
                  <th key={index} className="px-3 py-2 font-normal">
                    {inline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, index) => (
                    <td key={index} className="px-3 py-2 align-top leading-6">
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      table = [];
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
    else if (line.startsWith("|")) {
      if (paragraph.length || list) flush();
      const cells = line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      // Skip the |---|---| separator row.
      if (!cells.every((cell) => /^:?-{2,}:?$/.test(cell))) table.push(cells);
    } else if (heading) {
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
      if (paragraph.length || table.length || (list && list.ordered !== ordered)) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else {
      if (list || table.length) flush();
      paragraph.push(line);
    }
  }
  flush();

  return <div className={compact ? "space-y-2 text-[13px] [&_li]:leading-6 [&_p]:leading-6" : "space-y-3 text-[15px]"}>{blocks}</div>;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((part, index) => {
    if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-track px-1 py-0.5 text-[0.9em]">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index} className="font-medium">{part.slice(2, -2)}</strong>;
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}
