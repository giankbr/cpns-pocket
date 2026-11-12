import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubjectCode } from "./queries";

type Row = {
  subject: SubjectCode;
  subject_order: number;
  topic: string;
  topic_id: string;
  answered: number;
  graded: number;
  correct: number;
  wrong: number;
  tkp_count: number;
  tkp_score: number;
};

export type TopicStat = Row & {
  /** 0–100. Objective: correct/graded. TKP: average awarded score out of 5. */
  mastery: number;
  isTkp: boolean;
};

/** Per-topic performance for the signed-in user (latest attempt per question). */
export async function getTopicStats(supabase: SupabaseClient): Promise<TopicStat[]> {
  const { data, error } = await supabase.rpc("my_topic_stats");
  if (error) throw new Error(`Gagal memuat statistik: ${error.message}`);
  const rows = (data as Row[] | null) ?? [];
  return rows.map((row) => {
    const isTkp = row.tkp_count > 0 && row.graded === 0;
    const mastery = isTkp
      ? row.tkp_count
        ? Math.round((row.tkp_score / (row.tkp_count * 5)) * 100)
        : 0
      : row.graded
        ? Math.round((row.correct / row.graded) * 100)
        : 0;
    return { ...row, mastery, isTkp };
  });
}

/** Weakest topics first: lowest mastery among topics with enough attempts. */
export function weakestTopics(stats: TopicStat[], minAttempts = 3, limit = 5): TopicStat[] {
  return stats
    .filter((row) => (row.isTkp ? row.tkp_count : row.graded) >= minAttempts)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, limit);
}

export function totalWrong(stats: TopicStat[]): number {
  return stats.reduce((sum, row) => sum + row.wrong, 0);
}
