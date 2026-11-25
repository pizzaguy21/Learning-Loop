"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AnonAvatar,
  Avatar,
  Badge,
  Button,
  Card,
  DemoBadge,
  ErrorBox,
  friendlyError,
  RoleBadge,
  Spinner,
  StatusBadge,
  timeAgo,
} from "@/components/ui";
import {
  answersQuery,
  deleteAnswer,
  editAnswer,
  postAnswer,
  postOfficialAnswer,
  questionAuthorRef,
  questionRef,
  unverifyAnswer,
  verifyAnswer,
  type Answer,
  type Question,
  type QuestionAuthor,
} from "@/lib/data";
import { useCollection, useDoc } from "@/lib/hooks";
import { useCourse } from "../../course-context";

export default function QuestionPage() {
  const { questionId: qid } = useParams<{ questionId: string }>();
  const { cid, me } = useCourse();
  const isLecturer = me.role === "lecturer";

  const qRef = useMemo(() => questionRef(cid, qid), [cid, qid]);
  const question = useDoc<Question>(qRef);
  const aq = useMemo(() => answersQuery(cid, qid), [cid, qid]);
  const answers = useCollection<Answer>(aq);
  // Readable only by the asker and the lecturer; anyone else gets an error,
  // which here simply means "not yours".
  const authorRef = useMemo(() => questionAuthorRef(cid, qid), [cid, qid]);
  const author = useDoc<QuestionAuthor>(authorRef);

  if (question.loading) return <Spinner />;
  if (question.error) return <ErrorBox>{friendlyError(question.error)}</ErrorBox>;
  if (!question.data) return <ErrorBox>Pertanyaan tidak ditemukan.</ErrorBox>;
  const q = question.data;

  const sorted = [...answers.data].sort(
    (a, b) => Number(b.verified) - Number(a.verified) || (a.createdAt?.toMillis() ?? Infinity) - (b.createdAt?.toMillis() ?? Infinity),
  );

  return (
    <div className="space-y-4">
      <Link href={`/kelas/${cid}`} className="text-sm text-teal-800 hover:underline">
        ← Semua pertanyaan
      </Link>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={q.status} />
          <Badge>{q.topic}</Badge>
          <DemoBadge demo={q.demo} />
        </div>
        <h2 className="text-lg font-semibold text-stone-900">{q.title}</h2>
        {q.body && <p className="whitespace-pre-wrap text-stone-800">{q.body}</p>}
        <div className="flex items-center gap-2">
          <AnonAvatar />
          <p className="text-xs text-stone-500">
            {isLecturer && author.data ? (
              <>
                Ditanyakan oleh <strong className="text-stone-700">{author.data.name}</strong> ({author.data.email}),
                hanya terlihat oleh dosen ·{" "}
              </>
            ) : author.data ? (
              <>Pertanyaanmu, teman sekelas melihatnya sebagai anonim · </>
            ) : (
              <>Penanya anonim · </>
            )}
            {timeAgo(q.createdAt)}
          </p>
        </div>
      </Card>

      <h3 className="pt-2 text-sm font-semibold text-stone-700">{q.answerCount} jawaban</h3>
      {answers.loading ? (
        <Spinner />
      ) : answers.error ? (
        <ErrorBox>{friendlyError(answers.error)}</ErrorBox>
      ) : (
        <ul className="space-y-2">
          {sorted.map((a) => (
            <li key={a.id}>
              <AnswerCard question={q} answer={a} />
            </li>
          ))}
        </ul>
      )}

      <AnswerForm question={q} />
    </div>
  );
}

function AnswerCard({ question, answer }: { question: Question; answer: Answer }) {
  const { cid, me } = useCourse();
  const canVerify = me.role === "lecturer";
  const isAuthor = answer.authorUid === me.uid;
  // Editing a verified answer as a student or mentor removes the verification.
  const editDropsVerification = answer.verified && !canVerify;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(friendlyError(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (draft === null) return;
    if (await run(() => editAnswer(cid, question, answer, me, draft.trim()))) setDraft(null);
  }

  function remove() {
    const whose = isAuthor ? "ini" : `dari ${answer.authorName}`;
    const warning = answer.verified ? " Verifikasi dosen pada jawaban ini juga hilang." : "";
    if (window.confirm(`Hapus jawaban ${whose}?${warning}`)) run(() => deleteAnswer(cid, question, answer.id));
  }

  return (
    <Card
      tone={answer.verified ? "success" : "default"}
      className={`flex gap-3 ${answer.verified ? "border-l-4 border-l-green-500" : ""}`}
    >
      <Avatar name={answer.authorName} role={answer.authorRole} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5 text-sm">
          <span className="font-medium text-stone-900">{answer.authorName}</span>
          <RoleBadge role={answer.authorRole} />
          {answer.verified && (
            <Badge tone="green">{answer.official ? "✓ Jawaban resmi dosen" : "✓ Diverifikasi dosen"}</Badge>
          )}
          <DemoBadge demo={answer.demo} />
          <span className="text-xs text-stone-500">{timeAgo(answer.createdAt)}</span>
        </div>
        {draft === null ? (
          <p className="whitespace-pre-wrap text-stone-800">{answer.body}</p>
        ) : (
          <form onSubmit={save} className="space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={3000}
              rows={4}
              aria-label="Ubah jawaban"
              className="block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-teal-600 focus:outline-none"
              required
            />
            {editDropsVerification && (
              <p className="text-xs text-amber-800">Menyimpan perubahan akan membatalkan verifikasi dosen.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || draft.trim().length === 0}>
                {busy ? "Menyimpan…" : "Simpan"}
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setDraft(null)}>
                Batal
              </Button>
            </div>
          </form>
        )}
        {draft === null && (canVerify || isAuthor) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {canVerify &&
              (answer.verified ? (
                <Button variant="secondary" disabled={busy} onClick={() => run(() => unverifyAnswer(cid, question))}>
                  Batalkan verifikasi
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => run(() => verifyAnswer(cid, question, answer.id))}
                >
                  ✓ Tandai sebagai jawaban benar
                </Button>
              ))}
            {isAuthor && (
              <Button variant="ghost" disabled={busy} onClick={() => setDraft(answer.body)}>
                Ubah
              </Button>
            )}
            {(isAuthor || canVerify) && (
              <Button variant="danger" disabled={busy} onClick={remove}>
                Hapus
              </Button>
            )}
          </div>
        )}
        {error && (
          <div className="mt-2">
            <ErrorBox>{error}</ErrorBox>
          </div>
        )}
      </div>
    </Card>
  );
}

function AnswerForm({ question }: { question: Question }) {
  const { cid, me } = useCourse();
  const isLecturer = me.role === "lecturer";
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const text = body.trim();
      if (isLecturer) await postOfficialAnswer(cid, question, me, text);
      else await postAnswer(cid, question, me, text);
      setBody("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-stone-800">
            {isLecturer ? "Tulis jawaban resmi (atau koreksi)" : "Bantu jawab"}
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={3000}
            rows={4}
            className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-teal-600 focus:outline-none"
            required
          />
        </label>
        <p className="text-xs text-stone-500">
          {isLecturer
            ? "Jawaban resmi langsung ditandai terverifikasi dan menggantikan verifikasi sebelumnya."
            : "Namamu ditampilkan pada jawaban. Hanya penanya yang anonim."}
        </p>
        {error && <ErrorBox>{error}</ErrorBox>}
        <Button type="submit" disabled={busy || body.trim().length === 0}>
          {busy ? "Mengirim…" : isLecturer ? "Kirim jawaban resmi" : "Kirim jawaban"}
        </Button>
      </form>
    </Card>
  );
}
