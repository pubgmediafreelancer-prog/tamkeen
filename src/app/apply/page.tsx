import Link from "next/link";
import { ApplyForm } from "@/components/apply/ApplyForm";
import { isSupabaseConfigured, getSupabaseAdmin } from "@/lib/supabase/server";
import { ProgramRow } from "@/lib/types";

export const metadata = {
  title: "Apply — Stardom University Admissions Assistant",
};

async function getPrograms(): Promise<ProgramRow[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("programs").select("*").eq("active", true).limit(100);
    return (data ?? []) as ProgramRow[];
  } catch {
    return [];
  }
}

export default async function ApplyPage() {
  const programs = await getPrograms();

  return (
    <main className="flex-1 bg-(--color-paper-dim) px-6 py-16">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <Link href="/" className="text-xs font-medium text-(--color-teal)">
          ← Back to Stardom University Admissions Assistant
        </Link>
        <h1 className="font-display mt-3 text-3xl sm:text-4xl">Start Your Application</h1>
        <p className="mt-2 text-sm text-(--color-ink)/60">
          Your progress is saved automatically. Submitting starts the university&apos;s review process — it is not
          an admission decision.
        </p>
      </div>
      <ApplyForm programs={programs} />
    </main>
  );
}
