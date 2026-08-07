// app/api/detail/render/route.ts
// 상세페이지 렌더 API — Vercel 서버리스에서 실행
// POST body: product JSON (이미지 URL은 Supabase Storage 등 공개 URL이어야 함)
// 반환: 분할된 JPG의 Supabase Storage 공개 URL 배열
//
// 설치: npm i playwright-core @sparticuz/chromium
// vercel.json 또는 아래 maxDuration으로 실행시간 확보 (Pro 플랜 기준)

import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import { chromium as playwright } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import { readdirSync } from "fs";
import { rm } from "fs/promises";
import { appendHistory } from "../../../../lib/detailHistory";

export const maxDuration = 120; // Pro 플랜: 최대 300까지 가능
export const dynamic = "force-dynamic";

const PAGE_WIDTH = 860;
// 서버리스 크로미움엔 한글 폰트가 없음 — 웹폰트 필수
const FONT_CSS =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css";
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
// 템플릿 레퍼런스 분석으로 생성된 HTML 템플릿 (/api/detail/style)
const HTML_TEMPLATE_KEY = "oa_detail_html_template_v1";

// {{경로}} 치환 + specsTable/certItems/faqItems 확장
function fillHtmlTemplate(tplHtml: string, p: any): string {
  const derived: any = {
    ...p,
    specsTable:
      `<table class="specs-table">` +
      (p.specs || []).map((s: any) => `<tr><th>${s.label}</th><td>${s.value}</td></tr>`).join("") +
      `</table>`,
    certItems: (p.cert?.items || []).map((c: string) => `<li>${c}</li>`).join(""),
    faqItems: (p.faq || [])
      .map((f: any) => `<div class="faq-item"><div class="q">Q. ${f.q}</div><div class="a">A. ${f.a}</div></div>`)
      .join(""),
  };
  return tplHtml.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const v = getPath(derived, String(path).trim());
    return v == null ? "" : String(v);
  });
}

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
  <link rel="stylesheet" href="${FONT_CSS}">
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

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
  <link rel="stylesheet" href="${FONT_CSS}"><style>
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

    // 템플릿 우선순위: 피그마 동기화 > 템플릿 레퍼런스(HTML) > 기본
    let html: string;
    const { data: tplRows } = await getSupabase()
      .from("settings")
      .select("key,value")
      .in("key", [TEMPLATE_KEY, HTML_TEMPLATE_KEY]);
    const figmaTpl = tplRows?.find((r) => r.key === TEMPLATE_KEY)?.value;
    const htmlTpl = tplRows?.find((r) => r.key === HTML_TEMPLATE_KEY)?.value;
    if (figmaTpl?.sections?.length) {
      html = buildFigmaHtml(figmaTpl, product);
    } else if (htmlTpl?.html) {
      html = fillHtmlTemplate(htmlTpl.html, product);
    } else {
      html = buildHtml(product);
    }

    // ---------- 0. 웜 람다 /tmp 찌꺼기 청소 (크로미움 추출본 /tmp/chromium은 보존) ----------
    try {
      for (const d of readdirSync("/tmp")) {
        if (/^(\.org\.chromium|core|playwright|puppeteer|\.com\.google)/.test(d)) {
          rm("/tmp/" + d, { recursive: true, force: true }).catch(() => {});
        }
      }
    } catch {}

    // ---------- 1. 조각 캡처: fullPage 통짜 대신 clip 스크린샷 → 바로 JPG 업로드 ----------
    // (통짜 PNG 한 방이 메모리/tmp를 고갈시켜 웜 람다에서 행 걸리던 문제 픽스)
    const browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    // Storage 키는 한글 불가 — 슬러그 우선, ASCII만 남기고 비면 detail로 폴백
    const safeName =
      String(product.slug || product.productName || "")
        .replace(/[^A-Za-z0-9_-]/g, "")
        .slice(0, 40) || "detail";
    const slug = `${safeName}-${Date.now()}`;
    const urls: string[] = [];
    let count = 0;

    try {
      const page = await browser.newPage({
        viewport: { width: PAGE_WIDTH, height: 1000 },
        deviceScaleFactor: 1, // 서버리스 메모리 절약 — 화질 더 필요하면 1.5
      });
      await page.setContent(html, { waitUntil: "networkidle" });
      await page.waitForTimeout(800); // 배경 PNG + 컷 이미지 로딩 여유

      // 최상위 섹션들의 하단 경계 (디자이너 방식: 섹션 경계에서 자름)
      const bottoms: number[] = await page.evaluate(() =>
        Array.from(document.body.children).map((el) => {
          const e = el as HTMLElement;
          return e.offsetTop + e.offsetHeight;
        })
      );
      // body.scrollHeight가 뷰포트 높이로 잘못 나오는 케이스가 있어 섹션 경계와 max로 보정
      const scrollH: number = await page.evaluate(() =>
        Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          document.body.offsetHeight
        )
      );
      const totalHeight = Math.max(scrollH, ...(bottoms.length ? bottoms : [0]));

      // GIF 조각: product.gifs = [{ after: 섹션번호(1-base), url }] — 캡처하지 않고 원본 그대로 끼움
      const gifReqs: { after: number; url: string }[] = Array.isArray(product.gifs)
        ? product.gifs.filter((g: any) => g?.url && Number(g.after) > 0)
        : [];
      const gifAfter = new Map<number, string[]>();
      for (const g of gifReqs) {
        const arr = gifAfter.get(Number(g.after)) || [];
        arr.push(String(g.url));
        gifAfter.set(Number(g.after), arr);
      }

      // 조각 계획: 섹션 경계를 우선 컷 지점으로, SLICE_HEIGHT 초과 시에만 강제 분할
      type Piece = { kind: "jpg"; top: number; height: number } | { kind: "gif"; url: string };
      const pieces: Piece[] = [];
      let start = 0;
      let prev = 0;
      const flush = (end: number) => {
        let s = start;
        while (end - s > 0) {
          const h = Math.min(SLICE_HEIGHT, end - s);
          pieces.push({ kind: "jpg", top: s, height: h });
          s += h;
        }
        start = end;
      };
      bottoms.forEach((b, idx) => {
        if (b - start > SLICE_HEIGHT && prev > start) flush(prev);
        prev = b;
        const gs = gifAfter.get(idx + 1);
        if (gs) {
          flush(Math.min(b, totalHeight));
          for (const u of gs) pieces.push({ kind: "gif", url: u });
        }
      });
      flush(totalHeight);

      count = pieces.length;
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        const num = String(i + 1).padStart(2, "0");
        let buf: Buffer | Uint8Array;
        let ext = "jpg";
        let contentType = "image/jpeg";

        if (piece.kind === "gif") {
          const r = await fetch(piece.url);
          if (!r.ok) throw new Error(`GIF 다운로드 실패 (${r.status}): ${piece.url}`);
          buf = new Uint8Array(await r.arrayBuffer());
          const low = piece.url.toLowerCase();
          if (low.includes(".mp4")) { ext = "mp4"; contentType = "video/mp4"; }
          else if (low.includes(".webm")) { ext = "webm"; contentType = "video/webm"; }
          else { ext = "gif"; contentType = "image/gif"; }
        } else {
          // clip이 뷰포트 밖에서 잘리는 문제 회피 — 뷰포트를 조각 크기로 맞추고 스크롤해서 캡처
          await page.setViewportSize({ width: PAGE_WIDTH, height: piece.height });
          await page.evaluate((y) => window.scrollTo(0, y), piece.top);
          buf = await page.screenshot({ type: "jpeg", quality: 88 });
        }

        const filePath = `${slug}/detail_${num}.${ext}`;
        const { error } = await getSupabase().storage
          .from(BUCKET)
          .upload(filePath, buf, { contentType, upsert: true });
        if (error) throw error;

        const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(filePath);
        urls.push(data.publicUrl);
      }
    } finally {
      await browser.close().catch(() => {});
    }

    await appendHistory(getSupabase(), { type: "render", slug, urls });

    return NextResponse.json({ ok: true, count, urls });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
