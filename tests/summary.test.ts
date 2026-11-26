import { describe, expect, it } from "vitest";
import type { Question, QuestionStatus } from "../src/lib/data";
import { summarizeByTopic, summaryHeadline, WEEK_MS } from "../src/lib/summary";

const NOW = Date.UTC(2026, 11, 10);
const HOUR = 3_600_000;

function q(id: string, topic: string, status: QuestionStatus, hoursAgo: number | null): Question {
  const ts = hoursAgo === null ? null : ({ toMillis: () => NOW - hoursAgo * HOUR } as Question["createdAt"]);
  return {
    id, title: id, body: "", topic, status, answerCount: status === "open" ? 0 : 1,
    verifiedAnswerId: status === "verified" ? "a" : null, createdAt: ts, lastActivityAt: ts,
  };
}

describe("weekly topic summary", () => {
  it("counts each topic's questions of the last seven days by status", () => {
    const [rekursi] = summarizeByTopic(
      [
        q("a", "Rekursi", "open", 1),
        q("b", "Rekursi", "answered", 30),
        q("c", "Rekursi", "verified", 100),
        q("old", "Rekursi", "open", 24 * 8),
      ],
      NOW - WEEK_MS,
      NOW,
    );
    expect(rekursi).toMatchObject({ topic: "Rekursi", total: 3, unanswered: 1, unverified: 1, verified: 1 });
    expect(rekursi.pending.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("puts topics with the most unresolved questions first, unanswered and longest-waiting first", () => {
    const result = summarizeByTopic(
      [
        q("v1", "Stack", "verified", 5),
        q("v2", "Stack", "verified", 6),
        q("new", "Pohon", "answered", 2),
        q("open-recent", "Pohon", "open", 3),
        q("open-old", "Pohon", "open", 40),
      ],
      0,
      NOW,
    );
    expect(result.map((t) => t.topic)).toEqual(["Pohon", "Stack"]);
    expect(result[0].pending.map((x) => x.id)).toEqual(["open-old", "open-recent", "new"]);
    expect(result[1].pending).toEqual([]);
  });

  it("counts a question whose server timestamp has not arrived yet as just asked", () => {
    const [t] = summarizeByTopic([q("pending", "Lainnya", "open", null)], NOW - WEEK_MS, NOW);
    expect(t).toMatchObject({ topic: "Lainnya", total: 1, unanswered: 1 });
  });
});

describe("summary headline", () => {
  it("names the topics with the most unresolved questions", () => {
    const topics = summarizeByTopic(
      [
        q("a", "Pohon", "open", 1),
        q("b", "Pohon", "answered", 2),
        q("c", "Graf", "open", 3),
        q("d", "Rekursi", "answered", 4),
        q("e", "Sorting", "verified", 5),
      ],
      NOW - WEEK_MS,
      NOW,
    );
    expect(summaryHeadline(topics)).toBe(
      "5 pertanyaan masuk, 4 belum selesai. Paling perlu perhatian: Pohon (2) dan Graf (1).",
    );
  });

  it("says when everything is verified, and returns null for an empty period", () => {
    expect(summaryHeadline(summarizeByTopic([q("a", "Graf", "verified", 1)], NOW - WEEK_MS, NOW))).toBe(
      "1 pertanyaan masuk dan semuanya sudah diverifikasi.",
    );
    expect(summaryHeadline([])).toBeNull();
  });
});
