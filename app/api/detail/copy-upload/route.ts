// app/api/detail/copy-upload/route.ts
// 카피 생성용 첨부(캡쳐/PDF) 업로드 — 클라이언트 anon 키가 Storage RLS에 막혀 서버(service role) 경유
// POST FormData { file } → detail-assets/copy-src/... 공개 URL 반환
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "file 필수" }, { status: 400 });
    const ext = EXT[file.type];
    if (!ext) return NextResponse.json({ ok: false, error: "지원하지 않는 형식: " + file.type }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const path = `copy-src/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const buf = new Uint8Array(await file.arrayBuffer());
    const { error } = await supabase.storage
      .from("detail-assets")
      .upload(path, buf, { contentType: file.type, upsert: true });
    if (error) throw error;

    const { data } = supabase.storage.from("detail-assets").getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl, media_type: file.type });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
