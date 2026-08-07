// app/api/detail/analyze/route.ts
// 업로드된 제품 사진 묶음을 Claude 비전으로 분석 → 상세페이지 컷 슬롯에 자동 배치
// POST body: { productSlug, urls: [...] }
// 반환: { assignments: [{url, slot}], cuts: [{file, url}], anchorUrl? }

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { appendHistory } from "../../../../lib/detailHistory";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BUCKET = "detail-assets";
const SLOT_FILES: Record<string, string> = {
  hook: "hook.png", usp1: "usp1.png", usp2: "usp2.png", usp3: "usp3.png",
  scene1: "scene1.png", scene2: "scene2.png", cert: "cert.png", packshot: "packshot.png",
  anchor: "anchor.jpg",
};

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

export async function POST(req: NextRequest) {
  try {
    const { productSlug, urls } = await req.json();
    if (!productSlug || !Array.isArray(urls) || !urls.length)
      throw new Error("productSlug/urls 필요");

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const content: Anthropic.ContentBlockParam[] = [
      {
        type: "text",
        text: `제품 상세페이지 제작용 사진 ${urls.length}장입니다. 각 사진을 아래 슬롯 중 가장 알맞은 곳에 배치하세요.

슬롯 정의:
- anchor: 제품 전체가 정면에서 또렷하게 보이는 대표 실사 (AI 생성 참조용, 가장 깨끗한 정면컷 1장)
- hook: 후킹/무드컷 — 분위기 있는 연출, 어두운 배경, 극적인 조명
- usp1/usp2/usp3: 기능 강조 — 부분 클로즈업, 디테일, 구성품
- scene1/scene2: 사용씬/라이프스타일 — 실내 공간, 생활 맥락
- cert: 신뢰/실험 무드 — 깨끗하고 차가운 톤
- packshot: 이커머스 팩샷 — 흰 배경 정면
- skip: 품질 미달(흔들림/저화질/무관한 사진)

규칙: 슬롯당 최대 1장. 모든 슬롯을 채울 필요 없음. 애매하면 skip.
출력: 순수 JSON 배열만 — [{"index": 0, "slot": "anchor"}, ...]`,
      },
      ...urls.flatMap((u: string, i: number): Anthropic.ContentBlockParam[] => [
        { type: "text", text: `[이미지 ${i}]` },
        { type: "image", source: { type: "url", url: u } },
      ]),
    ];

    const msg = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content }],
    });
    const text = msg.content.find((b) => b.type === "text")?.text || "";
    const cleaned = text.replace(/^```json?\s*|```\s*$/g, "").trim();
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    const parsed: { index: number; slot: string }[] = JSON.parse(arrMatch ? arrMatch[0] : cleaned);

    // 슬롯별 파일로 복사 업로드
    const sb = getSupabase();
    const cuts: { file: string; url: string }[] = [];
    let anchorUrl: string | undefined;
    const used = new Set<string>();

    for (const a of parsed) {
      const file = SLOT_FILES[a.slot];
      if (!file || used.has(a.slot) || a.index < 0 || a.index >= urls.length) continue;
      used.add(a.slot);
      const src = urls[a.index];
      const bin = await fetch(src).then((r) => r.arrayBuffer());
      const path = `${productSlug}/${file}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, Buffer.from(bin), {
        contentType: file.endsWith(".jpg") ? "image/jpeg" : "image/png",
        upsert: true,
      });
      if (error) throw error;
      const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
      if (a.slot === "anchor") anchorUrl = data.publicUrl;
      else cuts.push({ file, url: data.publicUrl });
    }

    await appendHistory(sb, {
      type: "cuts",
      slug: productSlug,
      urls: [...(anchorUrl ? [anchorUrl] : []), ...cuts.map((c) => c.url)],
    });

    return NextResponse.json({
      ok: true,
      assignments: parsed.map((a) => ({ url: urls[a.index], slot: a.slot })),
      cuts,
      anchorUrl,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
