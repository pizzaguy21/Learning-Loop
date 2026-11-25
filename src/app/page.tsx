"use client";

import Link from "next/link";
import { useMemo } from "react";
import { GoogleButton } from "@/components/require-auth";
import {
  AnonAvatar,
  Avatar,
  Badge,
  ButtonLink,
  Card,
  courseColor,
  ErrorBox,
  friendlyError,
  initials,
  PageTitle,
  RoleBadge,
  Spinner,
  StatusBadge,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { myMembershipsQuery, type Member } from "@/lib/data";
import { useCollection, useIsApprovedLecturer } from "@/lib/hooks";

export default function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <MyCourses /> : <Landing />;
}

function Landing() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-linear-to-br from-teal-700 to-teal-900 p-6 text-white shadow-sm sm:p-10">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              Bingung di kelas? Tanya tanpa malu.
            </h1>
            <p className="text-teal-50">
              Learning Loop adalah ruang tanya jawab untuk satu mata kuliah. Teman sekelas tidak melihat
              namamu, teman dan peer mentor bisa menjawab, lalu dosen memverifikasi jawaban yang benar.
            </p>
            <GoogleButton variant="light" />
          </div>
          <SampleQuestion />
        </div>
      </section>
      <ol className="grid gap-3 sm:grid-cols-3">
        {[
          ["Tanya", "Masuk dengan kode kelas, tulis pertanyaan. Namamu disembunyikan dari teman sekelas."],
          ["Dijawab", "Teman sekelas dan peer mentor membantu menjawab."],
          ["Diverifikasi", "Dosen menandai jawaban yang benar atau menulis jawaban resmi."],
        ].map(([title, text], i) => (
          <li key={title}>
            <Card className="h-full">
              <span
                aria-hidden
                className="grid size-8 place-items-center rounded-full bg-teal-700 text-sm font-bold text-white"
              >
                {i + 1}
              </span>
              <p className="mt-3 font-display font-semibold">{title}</p>
              <p className="mt-1 text-sm text-stone-600">{text}</p>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Made-up example of the flow, labelled as such like the demo data. */
function SampleQuestion() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-teal-100 uppercase">Contoh tampilan</p>
      <Card className="space-y-3 border-l-4 border-l-green-500">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status="verified" />
          <Badge>Rekursi</Badge>
        </div>
        <p className="font-display font-semibold">Kenapa rekursi butuh base case?</p>
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <AnonAvatar />
          Penanya anonim
        </div>
        <div className="flex gap-2 rounded-lg bg-green-50 p-3 ring-1 ring-green-600/20">
          <Avatar name="Rina" role="mentor" />
          <div className="min-w-0 space-y-1 text-sm">
            <p className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium">Rina</span>
              <RoleBadge role="mentor" />
            </p>
            <p className="text-stone-700">
              Tanpa base case, fungsi terus memanggil dirinya sendiri sampai stack overflow.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MyCourses() {
  const { user } = useAuth();
  const uid = user!.uid;
  const lecturer = useIsApprovedLecturer(user);
  const q = useMemo(() => myMembershipsQuery(uid), [uid]);
  const { data: memberships, loading, error } = useCollection<Member>(q);
  const courses = useMemo(
    () => [...memberships].sort((a, b) => a.courseName.localeCompare(b.courseName, "id")),
    [memberships],
  );

  return (
    <div>
      <PageTitle sub="Kelas yang kamu ikuti atau ajar.">Kelas saya</PageTitle>
      <div className="mb-6 flex flex-wrap gap-2">
        <ButtonLink href="/gabung">Gabung kelas</ButtonLink>
        {lecturer.approved && (
          <ButtonLink href="/kelas/baru" variant="secondary">
            Buat kelas
          </ButtonLink>
        )}
      </div>
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox>{friendlyError(error)}</ErrorBox>
      ) : courses.length === 0 ? (
        <p className="text-sm text-stone-600">
          Kamu belum bergabung ke kelas mana pun. Minta kode kelas ke dosenmu.
        </p>
      ) : (
        <ul className="space-y-2">
          {courses.map((m) => (
            <li key={m.courseId}>
              <Link href={`/kelas/${m.courseId}`}>
                <Card className="flex items-center gap-3 transition hover:shadow-md hover:ring-teal-600/40">
                  <span
                    aria-hidden
                    className={`grid size-11 shrink-0 place-items-center rounded-lg font-display font-bold text-white ${courseColor(m.courseId).tile}`}
                  >
                    {initials(m.courseName)}
                  </span>
                  <span className="min-w-0 flex-1 font-medium">{m.courseName}</span>
                  <RoleBadge role={m.role} />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
