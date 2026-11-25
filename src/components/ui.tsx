"use client";

import type { Timestamp } from "firebase/firestore";
import Link from "next/link";
import type { QuestionStatus, Role } from "@/lib/data";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "light";
}) {
  const styles = {
    primary: "bg-teal-700 text-white hover:bg-teal-800 disabled:bg-teal-700/50",
    secondary:
      "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-50",
    ghost: "text-teal-800 hover:bg-teal-50 disabled:opacity-50",
    danger: "text-red-700 hover:bg-red-50 disabled:opacity-50",
    // For dark teal surfaces such as the landing hero.
    light: "bg-white text-teal-900 hover:bg-teal-50 disabled:opacity-70",
  }[variant];
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  children,
}: {
  href: string;
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}) {
  const styles =
    variant === "primary"
      ? "bg-teal-700 text-white hover:bg-teal-800"
      : "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50";
  return (
    <Link
      href={href}
      className={`inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors ${styles}`}
    >
      {children}
    </Link>
  );
}

/**
 * The surface is a prop because a background or ring class passed in className
 * would not reliably override the default one (Tailwind orders the CSS, not the class list).
 */
export function Card({
  children,
  className = "",
  tone = "default",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "success";
}) {
  const surface = tone === "success" ? "bg-green-50 ring-green-600/20" : "bg-white ring-stone-900/5";
  return (
    <div className={`rounded-xl p-4 text-stone-900 shadow-sm ring-1 sm:p-5 ${surface} ${className}`}>
      {children}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "teal" | "sky" | "amber" | "green" | "violet";
  children: React.ReactNode;
}) {
  const styles = {
    neutral: "bg-stone-100 text-stone-700 ring-1 ring-stone-600/20",
    teal: "bg-teal-100 text-teal-800 ring-1 ring-teal-600/20",
    sky: "bg-sky-100 text-sky-800 ring-1 ring-sky-600/20",
    amber: "bg-amber-100 text-amber-800 ring-1 ring-amber-600/20",
    // Solid because verification is the final outcome; green-600 would give white text only ~3.3:1.
    green: "bg-green-700 text-white",
    violet: "bg-violet-100 text-violet-800 ring-1 ring-violet-600/20",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
      {children}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  if (role === "lecturer") return <Badge tone="violet">Dosen</Badge>;
  if (role === "mentor") return <Badge tone="teal">Peer mentor</Badge>;
  return <Badge>Mahasiswa</Badge>;
}

export function StatusBadge({ status }: { status: QuestionStatus }) {
  if (status === "verified") return <Badge tone="green">✓ Diverifikasi dosen</Badge>;
  if (status === "answered") return <Badge tone="sky">Sudah dijawab</Badge>;
  return <Badge tone="amber">Belum dijawab</Badge>;
}

/** Left-border color per status, matching StatusBadge. Use with `border-l-4`. */
export const statusStripe: Record<QuestionStatus, string> = {
  open: "border-l-amber-400",
  answered: "border-l-sky-500",
  verified: "border-l-green-500",
};

/** Synthetic seed data must be labelled (STACK 2026 handbook). */
export function DemoBadge({ demo }: { demo?: boolean }) {
  return demo ? <Badge>Data demo</Badge> : null;
}

// Full class names so Tailwind finds them; all -700 shades keep white text above 4.5:1.
const COURSE_COLORS = [
  { tile: "bg-teal-700", banner: "from-teal-700 to-teal-900" },
  { tile: "bg-blue-700", banner: "from-blue-700 to-blue-900" },
  { tile: "bg-indigo-700", banner: "from-indigo-700 to-indigo-900" },
  { tile: "bg-fuchsia-700", banner: "from-fuchsia-700 to-fuchsia-900" },
  { tile: "bg-rose-700", banner: "from-rose-700 to-rose-900" },
  { tile: "bg-orange-700", banner: "from-orange-700 to-orange-900" },
];

/** Stable color per course, derived from its id so nothing extra is stored. */
export function courseColor(courseId: string) {
  let hash = 0;
  for (const ch of courseId) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COURSE_COLORS[Math.abs(hash) % COURSE_COLORS.length];
}

/** First letters of the first two words, e.g. "Struktur Data - Kelas A" gives "SD". */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((word) => /^[\p{L}\p{N}]/u.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

const AVATAR_TONE = { lecturer: "bg-violet-600", mentor: "bg-teal-700", student: "bg-stone-500" } as const;

/** Decorative: the name is always shown next to it. */
export function Avatar({ name, role }: { name: string; role: Role }) {
  return (
    <span
      aria-hidden
      className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${AVATAR_TONE[role]}`}
    >
      {initials(name)}
    </span>
  );
}

/** Mask avatar for the anonymous asker. */
export function AnonAvatar() {
  return (
    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-700 text-white">
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
        <path
          fillRule="evenodd"
          d="M3 9C3 7.3 4.3 6 6 6c2.2 0 4.2.8 6 2 1.8-1.2 3.8-2 6-2 1.7 0 3 1.3 3 3v1.5c0 3-2.2 5.5-5 5.5-1.7 0-3-.8-4-2-1 1.2-2.3 2-4 2-2.8 0-5-2.5-5-5.5zM5.5 10.8c1-1.5 3.8-1.7 5-.2-1 1.7-3.8 1.8-5 .2zm13 0c-1-1.5-3.8-1.7-5-.2 1 1.7 3.8 1.8 5 .2z"
        />
      </svg>
    </span>
  );
}

export function Spinner({ label = "Memuat…" }: { label?: string }) {
  return (
    <p className="py-10 text-center text-sm text-stone-500" role="status">
      {label}
    </p>
  );
}

export function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
      {children}
    </p>
  );
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">{children}</h1>
      {sub && <p className="mt-1 text-sm text-stone-600">{sub}</p>}
    </div>
  );
}

const rtf = new Intl.RelativeTimeFormat("id", { numeric: "auto" });

export function timeAgo(ts: Timestamp | null | undefined) {
  if (!ts) return "baru saja";
  const seconds = (ts.toMillis() - Date.now()) / 1000;
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
    [Infinity, "year"],
  ];
  let value = seconds;
  for (const [size, unit] of steps) {
    if (Math.abs(value) < size) return rtf.format(Math.round(value), unit);
    value /= size;
  }
  return "";
}

export function friendlyError(err: unknown) {
  const code = (err as { code?: string })?.code;
  if (code === "permission-denied") return "Kamu tidak punya akses untuk tindakan ini.";
  if (code === "unavailable") return "Tidak bisa terhubung ke server. Periksa koneksi internetmu.";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request")
    return "Login dibatalkan.";
  if (code === "auth/popup-blocked") return "Pop-up login diblokir browser. Izinkan pop-up lalu coba lagi.";
  return err instanceof Error ? err.message : "Terjadi kesalahan. Coba lagi.";
}
