// app/api/detail/history/route.ts
// 생성기록 조회/삭제 — GET: 목록, DELETE: {id} 스토리지 파일만 삭제(기록은 deleted 표시로 보존)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { HISTORY_KEY, type HistoryItem } from "../../../../lib/detailHistory";

export const dynamic = "force-dynamic";

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

async function loadItems(sb: ReturnType<typeof getSupabase>): Promise<HistoryItem[]> {
  const { data } = await sb.from("settings").select("value").eq("key", HISTORY_KEY).maybeSingle();
  return data?.value?.items || [];
}

export async function GET() {
  try {
    return NextResponse.json({ ok: true, items: await loadItems(getSupabase()) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    const sb = getSupabase();
    const items = await loadItems(sb);
    const item = items.find((i) => i.id === id);
    if (!item) throw new Error("기록 없음: " + id);

    // 공개 URL → bucket/path 파싱 후 버킷별로 삭제
    const byBucket: Record<string, string[]> = {};
    for (const u of item.urls) {
      const m = u.match(/\/object\/public\/([^/]+)\/(.+?)(\?|$)/);
      if (m) (byBucket[m[1]] ||= []).push(decodeURIComponent(m[2]));
    }
    for (const [bucket, paths] of Object.entries(byBucket)) {
      const { error } = await sb.storage.from(bucket).remove(paths);
      if (error) throw error;
    }

    item.deleted = true;
    await sb
      .from("settings")
      .upsert({ key: HISTORY_KEY, value: { items } }, { onConflict: "key" });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
