// app/api/detail/figma-sync/route.ts
// 딸깍 1: 피그마 URL 받으면 → sec:* 프레임을 PNG로 export + {{경로}} 레이어 좌표/폰트 추출
//         → Supabase settings 키 "oa_detail_template_v1"에 템플릿 JSON 저장
//
// 피그마 규칙 (FIGMA_GUIDE.md):
// - 최상위 프레임 이름 = "sec:후킹" 처럼 sec: 접두사 (860px 폭 권장)
// - 데이터 자리 레이어 이름 = "{{hook.headline}}" / "{{usp[0].image}}" 등 product JSON 경로
// - {{}} 레이어는 눈알 끄기(숨김) → export PNG에 안 찍히고 좌표 정보만 추출됨

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const FIGMA_API = "https://api.figma.com/v1";
const SETTINGS_KEY = "oa_detail_template_v1";
const ASSET_BUCKET = "detail-assets";

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

// https://www.figma.com/design/<fileKey>/<name>?node-id=1-2 → fileKey
function parseFileKey(url: string): string | null {
  const m = url.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

function rgba(fill: any): string {
  const c = fill?.color;
  if (!c) return "#222222";
  const a = fill.opacity ?? c.a ?? 1;
  const to255 = (v: number) => Math.round(v * 255);
  return `rgba(${to255(c.r)},${to255(c.g)},${to255(c.b)},${a})`;
}

// 프레임 하위에서 {{...}} 이름 레이어 수집 (숨김 포함)
function collectPlaceholders(node: any, frameBox: any, out: any[]) {
  const m = node.name?.match(/^\{\{(.+)\}\}$/);
  if (m && node.absoluteBoundingBox) {
    const b = node.absoluteBoundingBox;
    const st = node.style || {};
    out.push({
      path: m[1].trim(),
      kind: node.type === "TEXT" ? "text" : "image",
      x: Math.round(b.x - frameBox.x),
      y: Math.round(b.y - frameBox.y),
      w: Math.round(b.width),
      h: Math.round(b.height),
      fontFamily: st.fontFamily || "Pretendard",
      fontSize: st.fontSize || 24,
      fontWeight: st.fontWeight || 400,
      lineHeight:
        st.lineHeightPx && st.fontSize
          ? Math.round((st.lineHeightPx / st.fontSize) * 100) / 100
          : 1.4,
      letterSpacing: Math.round((st.letterSpacing || 0) * 10) / 10,
      color: rgba((node.fills || []).find((f: any) => f.type === "SOLID")),
      align: (st.textAlignHorizontal || "LEFT").toLowerCase(),
      radius: node.cornerRadius || 0,
    });
  }
  (node.children || []).forEach((c: any) => collectPlaceholders(c, frameBox, out));
}

// 트리에서 sec:* 프레임 수집
function collectSections(node: any, out: any[]) {
  if (node.name?.startsWith("sec:") && node.absoluteBoundingBox) {
    out.push(node);
    return; // 섹션 안의 섹션은 없음
  }
  (node.children || []).forEach((c: any) => collectSections(c, out));
}

export async function POST(req: NextRequest) {
  try {
    const token = process.env.FIGMA_TOKEN;
    if (!token) throw new Error("FIGMA_TOKEN 환경변수 없음");

    const { figmaUrl } = await req.json();
    const fileKey = parseFileKey(figmaUrl || "");
    if (!fileKey) throw new Error("피그마 파일 URL이 아님 — figma.com/design/... 링크를 넣어줘");

    // 1. 파일 트리 로드
    const fileRes = await fetch(`${FIGMA_API}/files/${fileKey}`, {
      headers: { "X-Figma-Token": token },
    });
    if (!fileRes.ok) throw new Error(`피그마 API ${fileRes.status} — 토큰/파일 권한 확인`);
    const file = await fileRes.json();

    const secNodes: any[] = [];
    collectSections(file.document, secNodes);
    if (secNodes.length === 0)
      throw new Error('sec: 프레임 없음 — 프레임 이름을 "sec:후킹" 형식으로 지정');
    secNodes.sort((a, b) => a.absoluteBoundingBox.y - b.absoluteBoundingBox.y);

    // 2. 섹션 프레임 PNG export ({{}} 레이어는 숨김 상태라 배경만 찍힘)
    const ids = secNodes.map((n) => n.id).join(",");
    const imgRes = await fetch(
      `${FIGMA_API}/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=1`,
      { headers: { "X-Figma-Token": token } }
    );
    const imgJson = await imgRes.json();
    if (imgJson.err) throw new Error(`이미지 export 실패: ${imgJson.err}`);

    // 3. PNG를 Supabase Storage로 복사 (피그마 export URL은 만료됨)
    const supabase = getSupabase();
    const sections: any[] = [];
    for (const node of secNodes) {
      const tmpUrl = imgJson.images[node.id];
      if (!tmpUrl) throw new Error(`"${node.name}" export URL 없음`);
      const png = Buffer.from(await (await fetch(tmpUrl)).arrayBuffer());
      const name = node.name.replace(/^sec:/, "").trim();
      // Supabase Storage 키는 한글 불가 — 순번 기반 ASCII 키 사용
      const filePath = `figma-template/sec-${String(sections.length + 1).padStart(2, "0")}.png`;
      const { error } = await supabase.storage
        .from(ASSET_BUCKET)
        .upload(filePath, png, { contentType: "image/png", upsert: true });
      if (error) throw new Error(`Storage 업로드 실패(${name}): ${error.message}`);
      const { data } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(filePath);

      const placeholders: any[] = [];
      collectPlaceholders(node, node.absoluteBoundingBox, placeholders);
      sections.push({
        name,
        width: Math.round(node.absoluteBoundingBox.width),
        height: Math.round(node.absoluteBoundingBox.height),
        bgUrl: `${data.publicUrl}?v=${Date.now()}`, // 캐시 무효화
        placeholders,
      });
    }

    // 4. settings KV에 저장 (기존 대시보드 패턴 재사용 — 테이블 신설 없음)
    const template = { fileKey, syncedAt: new Date().toISOString(), sections };
    const { error: kvErr } = await supabase
      .from("settings")
      .upsert(
        { key: SETTINGS_KEY, value: template, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    if (kvErr) throw new Error(`settings 저장 실패: ${kvErr.message}`);

    return NextResponse.json({
      ok: true,
      sections: sections.map((s) => ({
        name: s.name,
        size: `${s.width}x${s.height}`,
        placeholders: s.placeholders.map((p: any) => p.path),
      })),
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
