"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useMemo } from "react";
import { RequireAuth } from "@/components/require-auth";
import { ButtonLink, courseColor, DemoBadge, ErrorBox, friendlyError, RoleBadge, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { courseRef, memberRef, type Course, type Member } from "@/lib/data";
import { useDoc } from "@/lib/hooks";
import { CourseContext } from "./course-context";

export default function CourseLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <CourseShell>{children}</CourseShell>
    </RequireAuth>
  );
}

function CourseShell({ children }: { children: React.ReactNode }) {
  const { courseId: cid } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const pathname = usePathname();

  const myRef = useMemo(() => (user ? memberRef(cid, user.uid) : null), [cid, user]);
  const me = useDoc<Member>(myRef);
  // The course is readable only by members, so wait for the membership.
  const isMember = me.data !== null;
  const cRef = useMemo(() => (isMember ? courseRef(cid) : null), [cid, isMember]);
  const course = useDoc<Course>(cRef);

  const value = useMemo(
    () => (course.data && me.data ? { cid, course: course.data, me: me.data } : null),
    [cid, course.data, me.data],
  );

  if (me.loading || course.loading) return <Spinner />;
  if (me.error || course.error) return <ErrorBox>{friendlyError(me.error ?? course.error)}</ErrorBox>;
  if (!me.data)
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-stone-700">Kamu belum tergabung di kelas ini.</p>
        <ButtonLink href="/gabung">Gabung dengan kode kelas</ButtonLink>
      </div>
    );
  if (!value) return <ErrorBox>Kelas tidak ditemukan.</ErrorBox>;

  const isLecturer = value.me.role === "lecturer";
  const tabs = [
    { href: `/kelas/${cid}`, label: "Pertanyaan" },
    ...(isLecturer
      ? [
          { href: `/kelas/${cid}/ringkasan`, label: "Ringkasan" },
          { href: `/kelas/${cid}/anggota`, label: "Anggota" },
        ]
      : []),
  ];

  return (
    <CourseContext.Provider value={value}>
      <div className="mb-5 space-y-4">
        <div className={`rounded-2xl bg-linear-to-br p-5 text-white shadow-sm sm:p-6 ${courseColor(cid).banner}`}>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{value.course.name}</h1>
            <RoleBadge role={value.me.role} />
            <DemoBadge demo={value.course.demo} />
          </div>
          <p className="mt-1 text-sm text-white/90">Dosen: {value.course.lecturerName}</p>
          {isLecturer && (
            <p className="mt-4 inline-flex items-center gap-3 rounded-xl bg-white/15 px-4 py-2 ring-1 ring-white/25">
              <span className="text-xs font-medium tracking-wide text-white/90 uppercase">Kode kelas</span>
              <span className="font-mono text-2xl font-bold tracking-widest">{value.course.code}</span>
            </p>
          )}
        </div>
        <nav className="flex gap-1 border-b border-stone-200">
          {tabs.map((t) => {
            const active =
              t.href === `/kelas/${cid}`
                ? !pathname.endsWith("/anggota") && !pathname.endsWith("/ringkasan")
                : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                  active ? "border-teal-700 text-teal-800" : "border-transparent text-stone-600 hover:text-stone-900"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </CourseContext.Provider>
  );
}
