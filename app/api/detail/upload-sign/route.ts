// app/api/detail/upload-sign/route.ts
// 사진 일괄 업로드용 서명 URL 발급 — 브라우저가 Supabase Storage에 직접 업로드 (RLS 우회)
// POST body: { slug, files: ["a.jpg", ...] } → [{ path, token, publicUrl }]

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BUCKET = "detail-assets";

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

export async function POST(req: NextRequest) {
  try {
    const { slug, files } = await req.json();
    if (!slug || !Array.isArray(files) || !files.length) throw new Error("slug/files 필요");
    const sb = getSupabase();
    const ts = Date.now();
    const out = [];
    for (let i = 0; i < files.length; i++) {
      const safe = String(files[i]).replace(/[^A-Za-z0-9._-]/g, "") || `img${i}.jpg`;
      const path = `${slug}/raw/${ts}_${i}_${safe}`;
      const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
      out.push({ path, token: data.token, publicUrl: pub.publicUrl });
    }
    return NextResponse.json({ ok: true, files: out });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
