import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PracticeTopicButton } from "@/components/session/start-forms";
import { EmptyState } from "@/components/ui/card";
import { subjectStyle } from "@/lib/study/queries";
import type { TopicStat } from "@/lib/study/topic-stats";

function tone(mastery: number) {
  if (mastery >= 75) return "var(--success)";
  if (mastery >= 50) return "var(--accent)";
  return "var(--danger)";
}

/** Mastery bar + one-click practice per weak topic. */
export function WeaknessList({ topics, showPractice = true }: { topics: TopicStat[]; showPractice?: boolean }) {
  if (topics.length === 0) {
    return <EmptyState title="Belum cukup data">Kerjakan beberapa soal dulu, nanti topik terlemah muncul di sini.</EmptyState>;
  }
  return (
    <ul className="space-y-3">
      {topics.map((topic) => {
        const attempts = topic.isTkp ? topic.tkp_count : topic.graded;
        return (
          <li key={topic.topic_id} className="flex items-center gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-lg text-[11px] text-white"
              style={{ backgroundColor: subjectStyle[topic.subject].color }}
            >
              {topic.subject}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm text-ink">{topic.topic}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {topic.mastery}% · {attempts} soal
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-track">
                <div className="h-full rounded-full" style={{ width: `${Math.max(topic.mastery, 3)}%`, backgroundColor: tone(topic.mastery) }} />
              </div>
            </div>
            {showPractice && (
              <div className="shrink-0">
                <PracticeTopicButton topicId={topic.topic_id} count={10} label="Latih" />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Dashboard entry point to retry previously-wrong questions. */
export function WrongQuestionsCard({ wrong }: { wrong: number }) {
  return (
    <Link
      href="/latihan?filter=incorrect"
      className="group flex items-center gap-3 rounded-xl border border-line p-3 transition-colors duration-150 hover:border-primary hover:bg-primary-soft/40"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger text-sm font-semibold tabular-nums">
        {wrong}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink group-hover:text-primary">Ulang soal yang pernah salah</span>
        <span className="block text-xs text-subtle">{wrong > 0 ? `${wrong} soal menunggu diperbaiki` : "Belum ada soal salah"}</span>
      </span>
      <ArrowRight size={16} className="text-muted transition-colors group-hover:text-primary" />
    </Link>
  );
}
