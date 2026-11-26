import type { Question } from "./data";

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type TopicSummary = {
  topic: string;
  total: number;
  /** No answer yet (status "open"). */
  unanswered: number;
  /** Answered but not yet verified by the lecturer. */
  unverified: number;
  verified: number;
  /** Questions still waiting for the lecturer: unanswered first, then the longest-waiting. */
  pending: Question[];
};

// A question whose server timestamp has not arrived yet was just created.
const createdMs = (q: Question, now: number) => q.createdAt?.toMillis() ?? now;

/**
 * Groups the questions asked since `since` (epoch ms) by topic for the lecturer's weekly summary.
 * Topics with the most unresolved questions come first, so the lecturer sees where the class is stuck.
 */
export function summarizeByTopic(questions: Question[], since: number, now = Date.now()): TopicSummary[] {
  const byTopic = new Map<string, TopicSummary>();
  for (const q of questions) {
    if (createdMs(q, now) < since) continue;
    const s =
      byTopic.get(q.topic) ??
      { topic: q.topic, total: 0, unanswered: 0, unverified: 0, verified: 0, pending: [] };
    s.total++;
    if (q.status === "open") s.unanswered++;
    else if (q.status === "answered") s.unverified++;
    else s.verified++;
    if (q.status !== "verified") s.pending.push(q);
    byTopic.set(q.topic, s);
  }
  const rank = { open: 0, answered: 1, verified: 2 } as const;
  for (const s of byTopic.values())
    s.pending.sort((a, b) => rank[a.status] - rank[b.status] || createdMs(a, now) - createdMs(b, now));
  return [...byTopic.values()].sort(
    (a, b) =>
      b.unanswered + b.unverified - (a.unanswered + a.unverified) ||
      b.total - a.total ||
      a.topic.localeCompare(b.topic, "id"),
  );
}

/**
 * One plain sentence that states what the summary means, so the lecturer does not have to read the
 * topic list to find where the class is stuck. Returns null when the period has no questions.
 */
export function summaryHeadline(topics: TopicSummary[]): string | null {
  const total = topics.reduce((n, t) => n + t.total, 0);
  if (total === 0) return null;
  const unresolved = topics.reduce((n, t) => n + t.unanswered + t.unverified, 0);
  if (unresolved === 0) return `${total} pertanyaan masuk dan semuanya sudah diverifikasi.`;
  // Topics are already sorted by unresolved count, so the first ones need attention most.
  const focus = topics
    .filter((t) => t.unanswered + t.unverified > 0)
    .slice(0, 2)
    .map((t) => `${t.topic} (${t.unanswered + t.unverified})`);
  return `${total} pertanyaan masuk, ${unresolved} belum selesai. Paling perlu perhatian: ${focus.join(" dan ")}.`;
}
