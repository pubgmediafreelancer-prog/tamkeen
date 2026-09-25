import { Hero } from "@/components/landing/Hero";
import { ProgramCategories } from "@/components/landing/ProgramCategories";
import { WhyStardom } from "@/components/landing/WhyStardom";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Faq } from "@/components/landing/Faq";
import { CtaBand } from "@/components/landing/CtaBand";
import { Footer } from "@/components/landing/Footer";
import { ChatLauncher } from "@/components/chat/ChatLauncher";
import { WhatsAppButton } from "@/components/landing/WhatsAppButton";
import { isSupabaseConfigured, getSupabaseAdmin } from "@/lib/supabase/server";
import { ProgramRow } from "@/lib/types";

export const revalidate = 300;

async function getPrograms(): Promise<ProgramRow[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("programs").select("*").eq("active", true).limit(24);
    return (data ?? []) as ProgramRow[];
  } catch {
    return [];
  }
}

export default async function Home() {
  const programs = await getPrograms();

  return (
    <>
      <main className="flex-1">
        <Hero />
        <ProgramCategories programs={programs} />
        <WhyStardom />
        <HowItWorks />
        <Faq />
        <CtaBand />
      </main>
      <Footer />
      <ChatLauncher />
      <WhatsAppButton />
    </>
  );
}
