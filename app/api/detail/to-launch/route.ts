// app/api/detail/to-launch/route.ts
// 렌더 결과를 런칭 파이프라인(oa_launch_v1)의 상세페이지(detail) 단계에 연결
// GET: 런칭 목록 / POST { launch(id), urls, htmlUrl?, slug } → detail 단계 artifacts 추가 + 완료 처리

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const LAUNCH_KEY = "oa_launch_v1";

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

async function loadLaunches(sb: ReturnType<typeof getSupabase>) {
  const { data } = await sb.from("settings").select("value").eq("key", LAUNCH_KEY).maybeSingle();
  return { value: data?.value || { launches: [] }, launches: (data?.value?.launches || []) as any[] };
}

export async function GET() {
  try {
    const { launches } = await loadLaunches(getSupabase());
    return NextResponse.json({
      ok: true,
      launches: launches.map((l) => ({ id: l.id, name: l.name })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { launch, urls, htmlUrl, slug } = await req.json();
    if (!launch) throw new Error("launch(id) 필요");
    if (!Array.isArray(urls) || !urls.length) throw new Error("urls 필요");

    const sb = getSupabase();
    const { value, launches } = await loadLaunches(sb);
    const l = launches.find((x) => x.id === launch || x.name === launch);
    if (!l) throw new Error("런칭 없음: " + launch);

    l.stages = l.stages || {};
    const st = (l.stages.detail = l.stages.detail || { status: "대기", checklist: {}, artifacts: [] });
    st.artifacts = st.artifacts || [];
    const add = (label: string, url: string) => {
      if (url && !st.artifacts.some((a: any) => a.url === url)) st.artifacts.push({ label, url });
    };
    urls.forEach((u: string, i: number) => add(`상세 조각 ${String(i + 1).padStart(2, "0")}${slug ? ` (${slug})` : ""}`, u));
    if (htmlUrl) add(`상세 HTML${slug ? ` (${slug})` : ""}`, htmlUrl);
    st.status = "완료";

    await sb.from("settings").upsert({ key: LAUNCH_KEY, value }, { onConflict: "key" });
    return NextResponse.json({ ok: true, name: l.name });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
