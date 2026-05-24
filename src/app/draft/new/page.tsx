import { CreateDraftForm } from "@/components/CreateDraftForm";
import Link from "next/link";

export default function NewDraftPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
        ← Back
      </Link>
      <h1 className="mt-4 mb-6 text-2xl font-bold">Create a draft</h1>
      <CreateDraftForm />
    </main>
  );
}
