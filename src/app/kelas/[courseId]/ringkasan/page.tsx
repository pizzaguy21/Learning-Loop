"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Card, ErrorBox, friendlyError, Spinner, StatusBadge, timeAgo } from "@/components/ui";
import { questionsQuery, type Question } from "@/lib/data";
import { useCollection } from "@/lib/hooks";
import { summarizeByTopic, WEEK_MS } from "@/lib/summary";
import { useCourse } from "../course-context";

type Period = "week" | "all";

function windowFor(period: Period) {
  const now = Date.now();
  return { period, now, since: period === "week" ? now - WEEK_MS : 0 };
}

export default function WeeklySummaryPage() {
  const { cid, course, me } = useCourse();
  const isLecturer = me.role === "lecturer";
  // The window is fixed when the period is chosen, so the summary does not shift while the lecturer reads it.
  const [view, setView] = useState(() => windowFor("week"));
  const qq = useMemo(() => (isLecturer ? questionsQuery(cid) : null), [cid, isLecturer]);
  const questions = useCollection<Question>(qq);
  const topics = useMemo(
    () => summarizeByTopic(questions.data, view.since, view.now),
    [questions.data, view],
  );
  const period = view.period;

  if (!isLecturer) return <p className="text-sm text-stone-600">Hanya dosen yang dapat melihat ringkasan.</p>;
  if (questions.loading) return <Spinner />;
  if (questions.error) return <ErrorBox>{friendlyError(questions.error)}</ErrorBox>;

  const sum = (key: "total" | "unanswered" | "unverified" | "verified") =>
    topics.reduce((n, t) => n + t[key], 0);
  const quiet = course.topics.filter((t) => !topics.some((s) => s.topic === t));
  const periods: { id: Period; label: string }[] = [
    { id: "week", label: "7 hari terakhir" },
    { id: "all", label: "Semua waktu" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-600">
          Topik dengan pertanyaan yang belum selesai ada di urutan teratas.
        </p>
        <div className="flex gap-1" role="tablist" aria-label="Periode ringkasan">
          {periods.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={period === p.id}
              onClick={() => setView(windowFor(p.id))}
              className={`rounded-full px-3 py-1.5 text-sm ${
                period === p.id ? "bg-teal-700 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <dl className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
          {[
            ["Pertanyaan", sum("total")],
            ["Belum dijawab", sum("unanswered")],
            ["Belum diverifikasi", sum("unverified")],
            ["Diverifikasi", sum("verified")],
          ].map(([label, value]) => (
            // dt must come first inside a dl group; flex-col-reverse shows the number on top.
            <div key={label} className="flex flex-col-reverse">
              <dt className="text-xs text-stone-600">{label}</dt>
              <dd className="text-2xl font-bold text-stone-900">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {topics.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-600">
          {period === "week" ? "Tidak ada pertanyaan dalam 7 hari terakhir." : "Belum ada pertanyaan di kelas ini."}
        </p>
      ) : (
        <ul className="space-y-3">
          {topics.map((t) => (
            <li key={t.topic}>
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h2 className="mr-1 font-semibold text-stone-900">{t.topic}</h2>
                  <Badge>{t.total} pertanyaan</Badge>
                  {t.unanswered > 0 && <Badge tone="amber">{t.unanswered} belum dijawab</Badge>}
                  {t.unverified > 0 && <Badge tone="sky">{t.unverified} belum diverifikasi</Badge>}
                  {t.verified > 0 && <Badge tone="green">{t.verified} diverifikasi</Badge>}
                </div>
                {t.pending.length > 0 && (
                  <ul className="space-y-1.5">
                    {t.pending.map((q) => (
                      <li key={q.id}>
                        <Link
                          href={`/kelas/${cid}/pertanyaan/${q.id}`}
                          className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-stone-50"
                        >
                          <StatusBadge status={q.status} />
                          <span className="font-medium text-stone-900">{q.title}</span>
                          <span className="text-xs text-stone-500">ditanyakan {timeAgo(q.createdAt)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {quiet.length > 0 && (
        <p className="text-xs text-stone-500">Tanpa pertanyaan di periode ini: {quiet.join(", ")}.</p>
      )}
    </div>
  );
}
