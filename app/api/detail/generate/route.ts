// app/api/detail/generate/route.ts
// 이미지 생성 API — Comfy Cloud의 GeminiNanoBanana2(API 노드) + 실사 앵커 참조로 컷 생성
// → 결과를 Supabase Storage(detail-assets)에 저장
//
// 환경변수: COMFY_CLOUD_API_KEY
// POST body: {
//   productSlug: "cleanswingP",
//   cuts: [{ file: "hook.png", prompt: "..." }, ...],
//   anchorUrl: "https://.../01.jpg",   // 실사 앵커 이미지 공개 URL (필수)
//   refPrompt?: "Use the ... as the exact product ..." // 제품 고정 지시문 (선택)
// }

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { appendHistory } from "../../../../lib/detailHistory";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BUCKET = "detail-assets";
const COMFY_BASE = "https://cloud.comfy.org";

const DEFAULT_REF =
  "Use the product in the reference image as the exact product. " +
  "Keep the product design, proportions, logo placement and materials EXACTLY " +
  "identical to the reference. Do not invent buttons, text or patterns. " +
  "No people, no hands, no watermark. ";

// 빌드 타임엔 env가 없을 수 있어 lazy 초기화
const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

const comfyKey = () => {
  const k = process.env.COMFY_CLOUD_API_KEY;
  if (!k) throw new Error("COMFY_CLOUD_API_KEY 미설정");
  return k;
};

async function comfy(path: string, init: RequestInit = {}) {
  const res = await fetch(COMFY_BASE + path, {
    ...init,
    headers: { "X-API-Key": comfyKey(), ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Comfy ${path} ${res.status}: ${await res.text()}`);
  return res;
}

// 앵커 이미지 URL → Comfy Cloud 업로드 → 내부 파일명 반환
async function uploadAnchor(anchorUrl: string): Promise<string> {
  const img = await fetch(anchorUrl);
  if (!img.ok) throw new Error(`앵커 다운로드 실패 ${img.status}: ${anchorUrl}`);
  const blob = await img.blob();
  const form = new FormData();
  const name = anchorUrl.split("/").pop()?.split("?")[0] || "anchor.jpg";
  form.append("image", blob, name);
  const info = await (await comfy("/api/upload/image", { method: "POST", body: form })).json();
  return info.subfolder ? `${info.subfolder}/${info.name}` : info.name;
}

function buildWorkflow(anchorName: string, prompt: string, prefix: string) {
  return {
    "1": { class_type: "LoadImage", inputs: { image: anchorName } },
    "2": {
      class_type: "GeminiNanoBanana2",
      inputs: {
        prompt,
        model: "Nano Banana 2 (Gemini 3.1 Flash Image)",
        seed: Math.floor(Math.random() * 1e9),
        aspect_ratio: "1:1",
        resolution: "1K",
        response_modalities: "IMAGE",
        thinking_level: "MINIMAL",
        images: ["1", 0],
      },
    },
    "3": { class_type: "SaveImage", inputs: { images: ["2", 0], filename_prefix: prefix } },
  };
}

async function generateOne(anchorName: string, prompt: string, prefix: string): Promise<Buffer> {
  const submit = await (
    await comfy("/api/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: buildWorkflow(anchorName, prompt, prefix),
        // API 노드(나노바나나 등)는 이 인증이 없으면 "Please login first" 에러
        extra_data: { api_key_comfy_org: comfyKey() },
      }),
    })
  ).json();
  const pid = submit.prompt_id;
  if (!pid) throw new Error("Comfy 제출 실패: " + JSON.stringify(submit));

  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    const st = await (await comfy(`/api/job/${pid}/status`)).json();
    const status = st.status ?? st;
    if (status === "completed" || status === "success") {
      const job = await (await comfy(`/api/jobs/${pid}`)).json();
      for (const out of Object.values<any>(job.outputs || {})) {
        for (const item of out.images || []) {
          const q = `filename=${encodeURIComponent(item.filename)}&subfolder=${encodeURIComponent(
            item.subfolder || ""
          )}&type=output`;
          const bin = await (await comfy(`/api/view?${q}`)).arrayBuffer();
          return Buffer.from(bin);
        }
      }
      throw new Error("출력 이미지 없음: " + JSON.stringify(job.outputs));
    }
    if (status === "failed" || status === "cancelled" || status === "error")
      throw new Error(`생성 실패(${status}): ${JSON.stringify(st).slice(0, 500)}`);
  }
  throw new Error("생성 타임아웃");
}

export async function POST(req: NextRequest) {
  try {
    const { productSlug, cuts, anchorUrl, refPrompt } = await req.json();
    if (!anchorUrl) throw new Error("anchorUrl(실사 앵커 이미지 URL)이 필요합니다");
    const ref = refPrompt || DEFAULT_REF;

    const anchorName = await uploadAnchor(anchorUrl);
    const results: { file: string; url: string }[] = [];

    // Gemini API 노드는 병렬 제출 가능
    await Promise.all(
      cuts.map(async (cut: { file: string; prompt: string }) => {
        const prefix = "gen_" + cut.file.replace(/\.\w+$/, "");
        const buf = await generateOne(anchorName, ref + cut.prompt, prefix);
        const filePath = `${productSlug}/${cut.file}`;
        const { error } = await getSupabase().storage
          .from(BUCKET)
          .upload(filePath, buf, { contentType: "image/png", upsert: true });
        if (error) throw error;
        const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(filePath);
        results.push({ file: cut.file, url: data.publicUrl });
      })
    );

    await appendHistory(getSupabase(), {
      type: "cuts",
      slug: productSlug,
      urls: results.map((r) => r.url),
    });

    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
