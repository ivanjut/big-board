import Link from "next/link";
import { JoinDraftForm } from "@/components/JoinDraftForm";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-10 px-5 py-16">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          🏈 Big Board
        </h1>
        <p className="mt-3 text-slate-400">
          Run your offline fantasy football draft from any phone or laptop.
        </p>
      </header>

      <div className="grid gap-4">
        <Link
          href="/draft/new"
          className="rounded-xl bg-emerald-500 px-6 py-4 text-center text-lg font-semibold text-emerald-950 transition hover:bg-emerald-400"
        >
          Create a draft
        </Link>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 light:bg-slate-900">
          <h2 className="mb-3 text-sm font-medium text-slate-300">
            Join an existing draft
          </h2>
          <JoinDraftForm />
          <p className="mt-3 text-xs text-slate-500">
            Anyone with the link can watch live. Enter the draft password on the
            board to make picks.
          </p>
        </div>
      </div>
    </main>
  );
}
