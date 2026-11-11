import type { SupabaseClient } from "@supabase/supabase-js";
import { getCatalog, subjectStyle } from "./queries";

/** Subjects + topics with published question counts, for the session setup forms. */
export async function getSubjectOptions(supabase: SupabaseClient) {
  const catalog = await getCatalog(supabase);
  return catalog.subjects.map((subject) => {
    const topics = subject.topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      questionCount: catalog.questionsPerTopic.get(topic.id) ?? 0,
    }));
    return {
      code: subject.code,
      short: subjectStyle[subject.code].short,
      color: subjectStyle[subject.code].color,
      questionCount: topics.reduce((sum, topic) => sum + topic.questionCount, 0),
      topics,
    };
  });
}
