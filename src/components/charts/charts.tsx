import type { ReactNode } from "react";

/** Dependency-free chart primitives rendered on the server. */

type Point = { label: string; value: number; title?: string };

export function AreaChart({ data, height = 170 }: { data: Point[]; height?: number }) {
  const width = 600;
  const max = Math.max(4, ...data.map((point) => point.value));
  const ceiling = Math.ceil(max / 4) * 4;
  const ticks = [4, 3, 2, 1, 0].map((step) => (ceiling / 4) * step);
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const coords = data.map((point, index) => [index * step, height - (point.value / ceiling) * height] as const);
  const line = coords.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col justify-between pb-6 text-right text-xs text-subtle tabular-nums" style={{ height: height + 24 }}>
        {ticks.map((tick) => (
          <span key={tick} className="-translate-y-1.5">
            {tick}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }}>
          <div className="absolute inset-0 flex flex-col justify-between">
            {ticks.map((tick) => (
              <div key={tick} className="border-t border-dashed border-line" />
            ))}
          </div>
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            <defs>
              <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#area-fill)" />
            <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {coords.map(([x, y], index) => (
            <span
              key={data[index].label}
              title={data[index].title ?? `${data[index].label}: ${data[index].value}`}
              className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-primary bg-surface"
              style={{ left: `${(x / width) * 100}%`, top: y }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-subtle">
          {data.map((point, index) => (
            <span key={point.label} className={index % 2 ? "hidden sm:inline" : ""}>
              {point.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProgressBars({ data }: { data: (Point & { color: string })[] }) {
  return (
    <div className="flex h-48 items-end gap-2.5 sm:gap-3">
      {data.map((point) => (
        <div key={point.label} className="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
          <span className="text-xs text-ink tabular-nums">{point.value}%</span>
          <div
            title={point.title}
            className="relative w-full flex-1 overflow-hidden rounded-lg"
            style={{
              backgroundColor: "var(--track)",
              backgroundImage:
                "repeating-linear-gradient(135deg, transparent 0 6px, rgba(31,107,255,0.07) 6px 8px)",
            }}
          >
            <div
              className="absolute inset-x-0 bottom-0 rounded-lg transition-[height] duration-500"
              style={{
                height: `${Math.max(point.value, 2)}%`,
                background: `linear-gradient(to bottom, ${point.color}, ${point.color}cc)`,
              }}
            />
          </div>
          <span className="truncate text-xs text-muted">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ data, size = 164, center }: { data: (Point & { color: string })[]; size?: number; center?: ReactNode }) {
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const gap = data.filter((point) => point.value > 0).length > 1 ? 5 : 0;
  let offset = 0;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        {total > 0 &&
          data.map((point) => {
            const length = (point.value / total) * circumference;
            const dash = Math.max(length - gap, 0);
            const segment = (
              <circle
                key={point.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={point.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              >
                <title>{`${point.label}: ${point.value}`}</title>
              </circle>
            );
            offset += length;
            return segment;
          })}
      </svg>
      {center && <div className="absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  );
}

export function Legend({ data }: { data: (Point & { color: string })[] }) {
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-muted">
      {data.map((point) => (
        <li key={point.label} className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: point.color }} />
          {point.label}
          <span className="text-ink tabular-nums">{point.value}</span>
        </li>
      ))}
    </ul>
  );
}
