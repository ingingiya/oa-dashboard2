// app/api/detail/render/route.ts
// 상세페이지 렌더 API — Vercel 서버리스에서 실행
// POST body: product JSON (이미지 URL은 Supabase Storage 등 공개 URL이어야 함)
// 반환: 분할된 JPG의 Supabase Storage 공개 URL 배열
//
// 설치: npm i playwright-core @sparticuz/chromium sharp
// vercel.json 또는 아래 maxDuration으로 실행시간 확보 (Pro 플랜 기준)

import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import { chromium as playwright } from "playwright-core";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 120; // Pro 플랜: 최대 300까지 가능
export const dynamic = "force-dynamic";

const PAGE_WIDTH = 860;
const SLICE_HEIGHT = 6000;
const BUCKET = "detail-pages";

// 빌드 타임엔 env가 없을 수 있어 lazy 초기화
const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

// ---------- 피그마 템플릿 렌더 (figma-sync로 저장된 settings 키 사용) ----------
const TEMPLATE_KEY = "oa_detail_template_v1";

// "usp[0].headline" 같은 경로로 product JSON에서 값 꺼내기
function getPath(obj: any, path: string): any {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function buildFigmaHtml(template: any, product: any): string {
  const sections = template.sections
    .map((sec: any) => {
      const layers = sec.placeholders
        .map((p: any) => {
          const val = getPath(product, p.path);
          if (val == null || val === "") return "";
          const pos = `position:absolute;left:${p.x}px;top:${p.y}px;width:${p.w}px;`;

          if (p.kind === "image") {
            return `<img src="${val}" style="${pos}height:${p.h}px;object-fit:cover;border-radius:${p.radius || 0}px;">`;
          }
          // 텍스트 — 피그마 스타일 그대로
          return `<div style="${pos}min-height:${p.h}px;
            font-family:'${p.fontFamily}','Pretendard','Apple SD Gothic Neo',sans-serif;
            font-size:${p.fontSize}px;font-weight:${p.fontWeight};
            line-height:${p.lineHeight};letter-spacing:${p.letterSpacing}px;
            color:${p.color};text-align:${p.align};white-space:pre-line;">${val}</div>`;
        })
        .join("");

      return `<div style="position:relative;width:${sec.width}px;height:${sec.height}px;
        background-image:url('${sec.bgUrl}');background-size:${sec.width}px ${sec.height}px;">
        ${layers}</div>`;
    })
    .join("");

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
  <style>*{margin:0;padding:0;box-sizing:border-box}body{width:${PAGE_WIDTH}px;background:#fff}</style>
  </head><body>${sections}</body></html>`;
}

// ---------- 기본 템플릿 (피그마 동기화 전 폴백) ----------
function buildHtml(p: any): string {
  const usp = p.usp
    .map(
      (u: any, i: number) => `
    <div class="usp-item">
      <div class="usp-num">POINT ${String(i + 1).padStart(2, "0")}</div>
      <h3>${u.headline}</h3><p>${u.desc}</p><img src="${u.image}">
    </div>`
    )
    .join("");
  const scenes = p.scene.images.map((s: string) => `<img src="${s}">`).join("");
  const specs = p.specs
    .map((s: any) => `<tr><th>${s.label}</th><td>${s.value}</td></tr>`)
    .join("");
  const certs = p.cert.items.map((c: string) => `<li>${c}</li>`).join("");
  const faqs = p.faq
    .map(
      (f: any) => `
    <div class="faq-item"><div class="q">Q. ${f.q}</div><div class="a">A. ${f.a}</div></div>`
    )
    .join("");

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${PAGE_WIDTH}px;font-family:'Pretendard','Apple SD Gothic Neo',sans-serif;color:#222;background:#fff}
  img{width:100%;display:block}section{padding:80px 60px}.center{text-align:center}
  h2{font-size:44px;font-weight:800;line-height:1.35;white-space:pre-line}
  .sub{font-size:24px;color:#777;margin-top:20px;line-height:1.5}
  .badge{display:inline-block;font-size:20px;font-weight:700;color:#fff;background:#222;border-radius:100px;padding:10px 28px;margin-bottom:28px}
  .hook{background:#f7f5f2}.hook img{margin-top:48px;border-radius:24px}
  .usp-item{margin-top:72px}.usp-num{font-size:22px;font-weight:800;color:#b9a58c;letter-spacing:2px}
  .usp-item h3{font-size:36px;font-weight:800;margin-top:12px}
  .usp-item p{font-size:23px;color:#666;margin-top:14px;line-height:1.55}
  .usp-item img{margin-top:28px;border-radius:24px}
  .scene{background:#f7f5f2}.scene img{margin-top:36px;border-radius:24px}
  table{width:100%;border-collapse:collapse;margin-top:44px;font-size:22px}
  th,td{padding:20px 16px;border-bottom:1px solid #e5e0d8;text-align:left}
  th{width:220px;color:#999;font-weight:600}
  .cert{background:#f7f5f2}.cert ul{margin-top:32px;list-style:none}
  .cert li{font-size:24px;padding:16px 0;font-weight:600}
  .cert li::before{content:"✓  ";color:#b9a58c;font-weight:800}
  .cert img{margin-top:36px;border-radius:24px}
  .faq-item{margin-top:36px;text-align:left}.faq-item .q{font-size:26px;font-weight:800}
  .faq-item .a{font-size:23px;color:#666;margin-top:10px;line-height:1.55}
  .cta{background:#222;color:#fff}.cta h2{color:#fff}.cta img{margin-top:44px;border-radius:24px}
  .tagline{font-size:22px;color:#b9a58c;font-weight:700;margin-top:24px;letter-spacing:1px}
  </style></head><body>
  <section class="hook center"><div class="badge">${p.productName}</div>
    <h2>${p.hook.headline}</h2><p class="sub">${p.hook.sub}</p><img src="${p.hook.image}"></section>
  <section class="usp center"><h2>${p.productName}가\n다른 이유</h2>${usp}</section>
  <section class="scene center"><h2>${p.scene.headline}</h2>${scenes}</section>
  <section class="specs"><h2 class="center">제품 사양</h2><table>${specs}</table></section>
  <section class="cert center"><h2>${p.cert.headline}</h2><ul>${certs}</ul><img src="${p.cert.image}"></section>
  <section class="faq center"><h2>자주 묻는 질문</h2>${faqs}</section>
  <section class="cta center"><h2>${p.cta.headline}</h2><img src="${p.cta.image}">
    <p class="tagline">${p.tagline}</p></section>
  </body></html>`;
}

export async function POST(req: NextRequest) {
  try {
    const product = await req.json();

    // 피그마 동기화 템플릿이 있으면 그걸로, 없으면 기본 템플릿으로 렌더
    let html: string;
    const { data: tplRow } = await getSupabase()
      .from("settings")
      .select("value")
      .eq("key", TEMPLATE_KEY)
      .maybeSingle();
    if (tplRow?.value?.sections?.length) {
      html = buildFigmaHtml(tplRow.value, product);
    } else {
      html = buildHtml(product);
    }

    // ---------- 1. 서버리스 크로미움으로 캡처 ----------
    const browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const page = await browser.newPage({
      viewport: { width: PAGE_WIDTH, height: 1000 },
      deviceScaleFactor: 1, // 서버리스 메모리 절약 — 화질 더 필요하면 1.5
    });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.waitForTimeout(800); // 배경 PNG + 컷 이미지 로딩 여유
    const fullPng = await page.screenshot({ fullPage: true });
    await browser.close();

    // ---------- 2. sharp로 세로 분할 ----------
    const meta = await sharp(fullPng).metadata();
    const count = Math.ceil(meta.height! / SLICE_HEIGHT);
    // Storage 키는 한글 불가 — ASCII만 남기고 비면 detail로 폴백
    const safeName =
      String(product.productName || "")
        .replace(/[^A-Za-z0-9_-]/g, "")
        .slice(0, 40) || "detail";
    const slug = `${safeName}-${Date.now()}`;
    const urls: string[] = [];

    for (let i = 0; i < count; i++) {
      const top = i * SLICE_HEIGHT;
      const h = Math.min(SLICE_HEIGHT, meta.height! - top);
      const buf = await sharp(fullPng)
        .extract({ left: 0, top, width: meta.width!, height: h })
        .jpeg({ quality: 88 })
        .toBuffer();

      const filePath = `${slug}/detail_${String(i + 1).padStart(2, "0")}.jpg`;
      const { error } = await getSupabase().storage
        .from(BUCKET)
        .upload(filePath, buf, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;

      const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(filePath);
      urls.push(data.publicUrl);
    }

    return NextResponse.json({ ok: true, count, urls });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
