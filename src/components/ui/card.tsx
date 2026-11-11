import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-xl border border-line bg-surface ${className}`}>{children}</section>;
}

export function IconTile({ icon: Icon, tone = "solid" }: { icon: LucideIcon; tone?: "solid" | "soft" }) {
  if (tone === "soft") {
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
        <Icon size={16} strokeWidth={1.9} />
      </span>
    );
  }

  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg btn-solid">
      <Icon size={17} strokeWidth={1.9} />
    </span>
  );
}

export function CardHeader({
  icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 pt-4">
      <IconTile icon={icon} tone="soft" />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[15px] text-ink">{title}</h2>
        {description && <p className="truncate text-xs text-subtle">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  className = "",
  icon,
  label,
  value,
  footer,
}: {
  className?: string;
  icon: LucideIcon;
  label: string;
  value: string;
  footer: [string, string][];
}) {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <IconTile icon={icon} />
        <div className="min-w-0">
          <p className="truncate text-[13px] text-muted">{label}</p>
          <p className="font-serif lining-nums text-[28px] leading-8 tracking-tight text-ink tabular-nums">{value}</p>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-line bg-tint px-4 py-2 text-[13px] text-primary">
        {footer.map(([key, val], index) => (
          <span key={key} className={`tabular-nums ${index > 0 ? "border-l border-line-strong pl-3" : ""}`}>
            {key}: <span className="text-primary-strong">{val}</span>
          </span>
        ))}
      </div>
    </Card>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center">
      <p className="text-sm text-ink">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-[13px] leading-5 text-subtle">{children}</p>}
    </div>
  );
}
