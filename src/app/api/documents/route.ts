import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

const DOCUMENT_TYPES = [
  "PHOTO",
  "PASSPORT",
  "HIGH_SCHOOL_DIPLOMA",
  "BACHELOR_DEGREE",
  "MASTER_DEGREE",
  "ACADEMIC_TRANSCRIPT",
  "ENGLISH_CERTIFICATE",
  "OTHER_CERTIFICATE",
  "OTHER_ATTACHMENT",
] as const;

const BUCKET = "student-documents"; // private bucket — create it in Supabase Storage before use
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/**
 * Accepts a single document upload per call. Files are written to a
 * PRIVATE Supabase Storage bucket (never public) and only a `file_path`
 * is stored in `documents` — retrieval always goes through a
 * signed-URL endpoint gated by admin auth, never a public URL.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });

  const sessionId = form.get("sessionId");
  const documentType = form.get("documentType");
  const file = form.get("file");

  if (typeof sessionId !== "string" || !sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  if (typeof documentType !== "string" || !DOCUMENT_TYPES.includes(documentType as (typeof DOCUMENT_TYPES)[number])) {
    return NextResponse.json({ error: `documentType must be one of ${DOCUMENT_TYPES.join(", ")}` }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File exceeds the 10MB limit." }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: "Only PDF, JPEG, PNG or WEBP files are accepted." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: lead } = await supabase.from("leads").select("id").eq("session_id", sessionId).maybeSingle();
  if (!lead) return NextResponse.json({ error: "No lead found for this session. Start the application first." }, { status: 404 });

  const ext = file.name.split(".").pop() || "bin";
  const path = `${lead.id}/${documentType}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json(
      {
        error: `Storage upload failed: ${uploadError.message}. Ensure a private bucket named "${BUCKET}" exists in Supabase Storage.`,
      },
      { status: 500 }
    );
  }

  const { data: doc, error: dbError } = await supabase
    .from("documents")
    .insert({ lead_id: lead.id, document_type: documentType, file_path: path, status: "UPLOADED" })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  await supabase.from("application_events").insert({
    lead_id: lead.id,
    event_type: "document_uploaded",
    metadata: { document_type: documentType },
  });

  return NextResponse.json({ document: doc });
}
