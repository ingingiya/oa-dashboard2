// app/api/detail/studio/route.ts
// 폰카 제품사진 → 스튜디오급 클린 앵커 변환 (나노바나나2)
// POST { imageUrl, slug, lockNote? } → { ok, results: [{ angle, url }] }
// 정면/사선/디테일 3앵글 병렬 생성 → detail-assets/{slug}/anchors/ 저장

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BUCKET = "detail-assets";
const COMFY_BASE = "https://cloud.comfy.org";

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

async function uploadToComfy(url: string): Promise<string> {
  const img = await fetch(url);
  if (!img.ok) throw new Error(`사진 다운로드 실패 ${img.status}`);
  const form = new FormData();
  form.append("image", await img.blob(), url.split("/").pop()?.split("?")[0] || "phone.jpg");
  const info = await (await comfy("/api/upload/image", { method: "POST", body: form })).json();
  return info.subfolder ? `${info.subfolder}/${info.name}` : info.name;
}

// 폰카 → 스튜디오 변환 공통 지시문: 제품은 그대로, 촬영 환경만 프로급으로
const STUDIO_REF =
  "The reference image is a casual smartphone photo of a product. " +
  "Recreate the EXACT SAME product as a professional studio anchor photo. " +
  "CRITICAL — product fidelity: keep the design, proportions, logo placement, printed text, " +
  "buttons, materials and colors EXACTLY identical to the reference. Do not invent, remove or " +
  "redesign anything on the product. " +
  "Fix ONLY the photography: replace the messy background with a pure seamless white studio " +
  "background, correct smartphone lens/perspective distortion, fix white balance and remove any " +
  "color cast so the product's true colors read accurately, professional wraparound softbox " +
  "lighting with crisp specular highlights on the edges and a soft natural gradient shadow under " +
  "the product. Remove dust, fingerprints, reflections of the photographer and any clutter. " +
  "8K commercial e-commerce packshot sharpness. No people, no hands, no props, no watermark. ";

const ANGLES: { key: string; label: string; prompt: string }[] = [
  { key: "front", label: "정면", prompt: "Straight-on FRONT view of the product, perfectly centered, upright, e-commerce packshot framing." },
  { key: "quarter", label: "사선(3/4)", prompt: "Three-quarter HERO view showing the front and one side of the product with gentle depth, premium catalog angle." },
  { key: "detail", label: "디테일", prompt: "CLOSE-UP macro detail shot of the product's most important functional part, filling the frame, texture clearly readable." },
];

function buildWorkflow(imageName: string, prompt: string, prefix: string) {
  return {
    "1": { class_type: "LoadImage", inputs: { image: imageName } },
    "2": {
      class_type: "GeminiNanoBanana2",
      inputs: {
        prompt,
        model: "Nano Banana 2 (Gemini 3.1 Flash Image)",
        seed: Math.floor(Math.random() * 1e9),
        aspect_ratio: "1:1",
        resolution: "2K",
        response_modalities: "IMAGE",
        thinking_level: "MINIMAL",
        images: ["1", 0],
      },
    },
    "3": { class_type: "SaveImage", inputs: { images: ["2", 0], filename_prefix: prefix } },
  };
}

async function generateOne(imageName: string, prompt: string, prefix: string): Promise<Buffer> {
  const submit = await (
    await comfy("/api/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: buildWorkflow(imageName, prompt, prefix),
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
          const q = `filename=${encodeURIComponent(item.filename)}&subfolder=${encodeURIComponent(item.subfolder || "")}&type=output`;
          return Buffer.from(await (await comfy(`/api/view?${q}`)).arrayBuffer());
        }
      }
      throw new Error("출력 이미지 없음");
    }
    if (status === "failed" || status === "cancelled" || status === "error")
      throw new Error(`생성 실패(${status}): ${JSON.stringify(st).slice(0, 400)}`);
  }
  throw new Error("생성 타임아웃");
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, slug, lockNote } = await req.json();
    if (!imageUrl) throw new Error("imageUrl 필요");
    const safeSlug = String(slug || "detail").replace(/[^A-Za-z0-9._-]/g, "") || "detail";
    const lock = lockNote
      ? `IMMUTABLE PRODUCT DETAILS — must stay EXACTLY as in the reference: ${String(lockNote).trim()}. `
      : "";

    const imageName = await uploadToComfy(imageUrl);
    const ts = Date.now().toString(36);
    const sb = getSupabase();

    const results = await Promise.all(
      ANGLES.map(async (a) => {
        const buf = await generateOne(imageName, STUDIO_REF + lock + a.prompt, "studio_" + a.key);
        const path = `${safeSlug}/anchors/${ts}_${a.key}.png`;
        const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: "image/png", upsert: true });
        if (error) throw error;
        const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
        return { angle: a.key, label: a.label, url: data.publicUrl };
      })
    );

    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    console.error("detail/studio 실패:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
