// app/api/detail/ref-check/route.ts
// 레퍼런스 URL의 "HTML 긁기 적합도" 검사 + 잘 긁히는 사이트 저장 목록
// POST { url } → { ok, verdict: "html"|"image"|"fail", korean, imgs, reason }
// POST { save: {url,name,verdict} } / { remove: id } / GET → 목록

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const KEY = "oa_detail_ref_sites_v1";

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

type RefSite = { id: string; url: string; name: string; verdict: string; at: string };

async function getList(sb: SupabaseClient): Promise<RefSite[]> {
  const { data } = await sb.from("settings").select("value").eq("key", KEY).maybeSingle();
  return data?.value?.items || [];
}
async function setList(sb: SupabaseClient, items: RefSite[]) {
  await sb.from("settings").upsert({ key: KEY, value: { items: items.slice(0, 100) } }, { onConflict: "key" });
}

export async function GET() {
  return NextResponse.json({ ok: true, items: await getList(getSupabase()) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sb = getSupabase();

  if (body.remove) {
    const items = (await getList(sb)).filter((i) => i.id !== body.remove);
    await setList(sb, items);
    return NextResponse.json({ ok: true, items });
  }

  if (body.save?.url) {
    const items = await getList(sb);
    if (!items.some((i) => i.url === body.save.url)) {
      items.unshift({
        id: Date.now().toString(36),
        url: String(body.save.url).slice(0, 500),
        name: String(body.save.name || "").slice(0, 60) || new URL(body.save.url).hostname,
        verdict: String(body.save.verdict || ""),
        at: new Date().toISOString(),
      });
    }
    await setList(sb, items);
    return NextResponse.json({ ok: true, items });
  }

  // ── 적합도 검사 ──
  const url = String(body.url || "").trim();
  if (!/^https?:\/\//.test(url))
    return NextResponse.json({ ok: false, error: "http(s) URL이 필요합니다" }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok)
      return NextResponse.json({ ok: true, verdict: "fail", reason: `접속 실패 (HTTP ${res.status}) — 봇 차단일 수 있어요` });

    let html = (await res.text())
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "");
    const hasAnchor = /prd_?Detail|ec-data-src|se2_inputarea|상세정보/i.test(html);
    const text = html.replace(/<[^>]+>/g, " ");
    const korean = (text.match(/[가-힣]/g) || []).length;
    const imgs = (html.match(/<img/gi) || []).length;

    let verdict: string, reason: string;
    if (korean > 1500) {
      verdict = "html";
      reason = `본문이 텍스트 HTML로 들어있어요 (한글 ${korean.toLocaleString()}자, 이미지 ${imgs}장${hasAnchor ? ", 상세 본문 구간 감지" : ""}) — HTML 학습 + 자동 캡쳐 둘 다 잘 돼요`;
    } else if (imgs > 5) {
      verdict = "image";
      reason = `이미지 통짜 상세예요 (한글 ${korean}자, 이미지 ${imgs}장) — HTML 학습 효과는 적고, 자동 캡쳐로 디자인 분석은 가능해요`;
    } else {
      verdict = "fail";
      reason = `본문을 못 읽었어요 (한글 ${korean}자, 이미지 ${imgs}장) — JS 렌더링 페이지일 수 있어요. 자동 캡쳐는 시도해볼 만해요`;
    }
    return NextResponse.json({ ok: true, verdict, reason, korean, imgs });
  } catch (e: any) {
    return NextResponse.json({ ok: true, verdict: "fail", reason: "접속 실패: " + e.message });
  }
}
