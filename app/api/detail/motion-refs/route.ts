// app/api/detail/motion-refs/route.ts
// 가전 상세페이지 모션 레퍼런스(oa_motion_refs_v1) 조회
// GET → { ok, items: [{id, category(typo|graph|real), label, url, product, keyword, source}] }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await sb
      .from("settings")
      .select("value")
      .eq("key", "oa_motion_refs_v1")
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ ok: true, items: data?.value?.items || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
