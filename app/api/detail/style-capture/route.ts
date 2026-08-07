// app/api/detail/style-capture/route.ts
// 레퍼런스 URL → 서버리스 크로미움이 직접 접속해 페이지를 조각 캡쳐 → Storage 업로드
// (사용자가 캡쳐 첨부 없이 URL만 넣어도 디자인 분석이 가능하도록)
// POST { url } → { ok, files: [{ url, media_type }] }

import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import { chromium as playwright } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import { readdirSync } from "fs";
import { rm } from "fs/promises";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const WIDTH = 860;
const CHUNK = 1900; // 폭 × 2.2 정도 — style 분석 조각 규격과 동일
const MAX_SLICES = 8;

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!/^https?:\/\//.test(String(url || ""))) throw new Error("http(s) URL이 필요합니다");

    // 웜 람다 /tmp 청소 (크로미움 추출본은 보존)
    try {
      for (const d of readdirSync("/tmp")) {
        if (/^(\.org\.chromium|core|playwright|puppeteer|\.com\.google)/.test(d)) {
          rm("/tmp/" + d, { recursive: true, force: true }).catch(() => {});
        }
      }
    } catch {}

    const browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const files: { url: string; media_type: string }[] = [];
    try {
      const page = await browser.newPage({
        viewport: { width: WIDTH, height: 1000 },
        deviceScaleFactor: 1,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      });
      await page.goto(String(url), { waitUntil: "domcontentloaded", timeout: 45_000 });

      // 지연 로딩(레이지 이미지) 트리거: 끝까지 스크롤하며 로딩 유도
      await page.evaluate(async () => {
        const step = 900;
        let y = 0;
        const max = Math.min(
          Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
          30000
        );
        while (y < max) {
          y += step;
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 250));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1200);

      const totalHeight: number = await page.evaluate(() =>
        Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
      );

      const sb = getSupabase();
      const ts = Date.now();
      for (let i = 0; i < MAX_SLICES; i++) {
        const top = i * CHUNK;
        if (top >= totalHeight) break;
        const h = Math.min(CHUNK, totalHeight - top);
        if (h < 100) break;
        // clip은 뷰포트 밖에서 클램프됨 → 뷰포트를 조각 크기로 맞추고 스크롤 후 캡쳐
        await page.setViewportSize({ width: WIDTH, height: h });
        await page.evaluate((y: number) => window.scrollTo(0, y), top);
        await page.waitForTimeout(350);
        const buf = await page.screenshot({ type: "jpeg", quality: 82 });

        const path = `copy-src/stylecap_${ts}_${i}.jpg`;
        const { error } = await sb.storage
          .from("detail-assets")
          .upload(path, buf, { contentType: "image/jpeg", upsert: true });
        if (error) throw error;
        const { data } = sb.storage.from("detail-assets").getPublicUrl(path);
        files.push({ url: data.publicUrl, media_type: "image/jpeg" });
      }
    } finally {
      await browser.close().catch(() => {});
    }

    if (!files.length) throw new Error("캡쳐된 조각이 없습니다");
    return NextResponse.json({ ok: true, files });
  } catch (e: any) {
    console.error("style-capture 실패:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
