import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</section>;
}

export function IconTile({ icon: Icon, tone = "solid" }: { icon: LucideIcon; tone?: "solid" | "soft" }) {
  if (tone === "soft") {
    return (
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon size={20} strokeWidth={1.8} />
      </span>
    );
  }

  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-b from-[#4f8dff] to-primary-strong text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_14px_-6px_rgba(31,107,255,0.7)]">
      <Icon size={20} strokeWidth={1.9} />
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
    <div className="flex items-center gap-3 p-5 pb-0">
      <IconTile icon={icon} tone="soft" />
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-medium text-ink">{title}</h2>
        {description && <p className="truncate text-sm text-subtle">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  icon,
  label,
  value,
  footer,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  footer: [string, string][];
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-4 p-5">
        <IconTile icon={icon} />
        <div className="min-w-0">
          <p className="truncate text-sm text-muted">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-line bg-[#f8faff] px-5 py-3 text-sm text-primary">
        {footer.map(([key, val], index) => (
          <span key={key} className={`tabular-nums ${index > 0 ? "border-l border-line-strong pl-4" : ""}`}>
            {key}: <span className="font-medium">{val}</span>
          </span>
        ))}
      </div>
    </Card>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-5 py-8 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-subtle">{children}</p>}
    </div>
  );
}
