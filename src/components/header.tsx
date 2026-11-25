"use client";

import Link from "next/link";
import { signOut, useAuth } from "@/lib/auth";
import { usingEmulators } from "@/lib/firebase";

export function Header() {
  const { user } = useAuth();
  return (
    <header className="bg-teal-800 text-white">
      {usingEmulators && (
        <p className="bg-amber-100 px-4 py-1 text-center text-xs text-amber-900">
          Mode pengembangan lokal (Firebase Emulator). Data di sini tidak tersimpan permanen.
        </p>
      )}
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display font-bold">
          <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-white text-sm text-teal-800">
            ↻
          </span>
          Learning Loop
        </Link>
        {user && (
          <div className="flex min-w-0 items-center gap-3 text-sm">
            <span className="hidden truncate text-teal-100 sm:inline">{user.displayName ?? user.email}</span>
            <button onClick={() => signOut()} className="shrink-0 font-medium hover:underline">
              Keluar
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
