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
import Anthropic from "@anthropic-ai/sdk";
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

// 광고급 디테일 블록 (ad_style_library.md 기반, 스틸컷용) — 모든 컷 프롬프트 뒤에 자동 삽입
const DETAIL_BLOCK =
  " ★ AD-GRADE DETAIL: shot on a 100mm macro lens at f/2.8 — creamy cinematic depth of field, " +
  "8K commercial sharpness on the product. Crisp specular highlights tracing the product edges, " +
  "soft wraparound softbox key light, gentle gradient shadows with clean falloff. " +
  "Tactile micro-detail: fine premium surface texture readable up close, catalog-perfect styling. " +
  "Color graded like a high-end Korean CF — pure bright white, zero color cast. " +
  "The product reads instantly as the hero of the frame, nothing competing for attention.";

// 인물(여성 모델) 컷 시그니처 스타일 — 클린이스윙 캠페인에서 확정된 K-드라마 배우급 블록
const BEAUTY_BLOCK =
  "The woman is a BEAUTIFUL KOREAN WOMAN in her mid-20s with the polished look of a " +
  "K-drama actress — luminous clear glowing skin, large bright expressive eyes, elegant " +
  "symmetrical features, full natural lips, a soft V-line jaw — soft beauty light, " +
  "premium K-beauty commercial quality. " +
  "PHOTOREALISM RULES: she must look like a REAL person photographed on a real set, NOT AI-generated — " +
  "realistic natural skin texture with visible pores and fine facial micro-details, NOT airbrushed plastic, " +
  "NOT AI-perfect symmetry, a few natural flyaway hairs, real fabric weave and wrinkles in clothing, " +
  "natural catch-lights in the eyes. Shot on an 85mm lens at f/2.8, natural editorial color grade, " +
  "subtle fine film grain. ";

const hasPerson = (p: string) =>
  /woman|female|model|person|lady|girl|hand|인물|여성|모델|사람|손/i.test(p);

// 모델컷: 제품 앵커 + 모델 사진 2장 참조 → 동일 인물 유지 지시문
const MODEL_REF =
  "Two reference images are provided. The FIRST is the product — keep its design, " +
  "proportions, logo placement and materials EXACTLY identical, do not invent buttons or text. " +
  "The SECOND is the model — the EXACT SAME woman (same face, same hairstyle, same features) " +
  "must appear in this shot, naturally interacting with the product, wearing the SAME outfit " +
  "as in her reference photo — clean, neatly pressed and well-fitted. " +
  "Her FACE MUST BE CLEARLY VISIBLE — front or three-quarter view toward the camera, " +
  "never a back view, never cropped above the chin, never hidden by hair, hands or the product. No watermark. ";

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

const ASPECTS = new Set(["1:1", "4:5", "3:4", "9:16", "16:9", "4:3", "2:3", "3:2", "21:9"]);

function buildWorkflow(anchorName: string, prompt: string, prefix: string, aspect: string, modelName?: string) {
  const wf: any = {
    "1": { class_type: "LoadImage", inputs: { image: anchorName } },
    "2": {
      class_type: "GeminiNanoBanana2",
      inputs: {
        prompt,
        model: "Nano Banana 2 (Gemini 3.1 Flash Image)",
        seed: Math.floor(Math.random() * 1e9),
        aspect_ratio: aspect,
        resolution: "4K", // 최고 품질 (네이티브 Gemini 업스케일러)
        response_modalities: "IMAGE",
        thinking_level: "HIGH", // 프롬프트 해석 품질 ↑ (인물/구도 이상함 픽스)
        images: ["1", 0],
      },
    },
    "3": { class_type: "SaveImage", inputs: { images: ["2", 0], filename_prefix: prefix } },
  };
  if (modelName) {
    // 제품(1) + 모델(10)을 배치로 묶어 나노바나나에 2장 참조로 전달
    wf["10"] = { class_type: "LoadImage", inputs: { image: modelName } };
    wf["11"] = { class_type: "ImageBatch", inputs: { image1: ["1", 0], image2: ["10", 0] } };
    wf["2"].inputs.images = ["11", 0];
  }
  return wf;
}

async function generateOne(anchorName: string, prompt: string, prefix: string, aspect: string, modelName?: string): Promise<Buffer> {
  const submit = await (
    await comfy("/api/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: buildWorkflow(anchorName, prompt, prefix, aspect, modelName),
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

// 멀티 앵커: 컷마다 어울리는 각도의 앵커를 AI가 선택 (실패 시 첫 번째 폴백)
async function pickAnchors(
  anchorUrls: string[],
  cuts: { file: string; prompt: string }[]
): Promise<Record<string, number>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (anchorUrls.length < 2 || !apiKey) return {};
  try {
    const client = new Anthropic({ apiKey });
    // Anthropic URL 다운로드 간헐 실패 → 서버가 직접 받아 base64로 전달
    const imgs = await Promise.all(
      anchorUrls.map(async (u) => {
        const res = await fetch(u);
        if (!res.ok) throw new Error(`앵커 다운로드 실패 ${res.status}: ${u}`);
        const mt = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
        return {
          type: "image",
          source: { type: "base64", media_type: mt, data: Buffer.from(await res.arrayBuffer()).toString("base64") },
        };
      })
    );
    const blocks: any[] = imgs.flatMap((img, i) => [
      { type: "text", text: `[앵커 ${i + 1}]` },
      img,
    ]);
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [...blocks, {
          type: "text",
          text: `위 앵커 이미지들은 같은 제품을 다른 각도/구도로 찍은 실사입니다.
아래 각 컷 프롬프트가 요구하는 카메라 각도·보이는 면에 가장 잘 맞는 앵커 번호를 고르세요.
${cuts.map((c) => `- ${c.file}: ${c.prompt}`).join("\n")}
순수 JSON만 출력: {"파일명": 앵커번호(1-base), ...}`,
        }],
      }],
    });
    const text = (msg.content.find((b: any) => b.type === "text") as any)?.text || "{}";
    const map = JSON.parse(text.replace(/^```json?\s*|```\s*$/g, "").trim());
    const out: Record<string, number> = {};
    for (const [f, n] of Object.entries(map)) {
      const idx = Number(n) - 1;
      if (idx >= 0 && idx < anchorUrls.length) out[f] = idx;
    }
    return out;
  } catch (e) {
    console.error("앵커 매칭 실패(첫 앵커 폴백):", e);
    return {};
  }
}

export async function POST(req: NextRequest) {
  try {
    const { productSlug, cuts, anchorUrl, anchorUrls, refPrompt, styleBlock, aspectRatio, modelUrl, lockNote, banNote } = await req.json();
    const aspect = ASPECTS.has(aspectRatio) ? aspectRatio : "1:1";
    const anchors: string[] = (
      Array.isArray(anchorUrls) && anchorUrls.length ? anchorUrls : [anchorUrl]
    ).filter(Boolean);
    if (!anchors.length) throw new Error("앵커 실사 이미지 URL이 필요합니다");
    // 제품 고정사항 (컬러/불변 부위) — 모든 컷 프롬프트에 강제
    const lock = lockNote
      ? `IMMUTABLE PRODUCT DETAILS — the following must stay EXACTLY as in the reference, never change them: ${String(lockNote).trim()}. `
      : "";
    // 금지사항 — 절대 나오면 안 되는 것들 (전 컷 공통)
    const ban = banNote
      ? `STRICTLY FORBIDDEN — the following must NEVER appear in the image, reject them completely: ${String(banNote).trim()}. `
      : "";
    const ref = (refPrompt || DEFAULT_REF) + lock + ban;
    const style = styleBlock ? String(styleBlock).trim() + " " : "";

    const needModel = !!modelUrl && cuts.some((c: any) => c.withModel);
    const [anchorNames, pickMap, modelName] = await Promise.all([
      Promise.all(anchors.map(uploadAnchor)),
      pickAnchors(anchors, cuts),
      needModel ? uploadAnchor(modelUrl) : Promise.resolve(""),
    ]);
    const results: { file: string; url: string }[] = [];

    // Gemini API 노드는 병렬 제출 가능
    await Promise.all(
      cuts.map(async (cut: { file: string; prompt: string; withModel?: boolean; aspect?: string; fixNote?: string }) => {
        const prefix = "gen_" + cut.file.replace(/\.\w+$/, "");
        const anchorName = anchorNames[pickMap[cut.file] ?? 0];
        const useModel = !!(modelName && cut.withModel);
        const cutAspect = cut.aspect && ASPECTS.has(cut.aspect) ? cut.aspect : aspect;
        // 모델컷: 제품+모델 2장 참조 / 인물 컷: "No people" 해제 + 시그니처 미모 블록 삽입
        const cutRef = useModel
          ? MODEL_REF + lock + ban + BEAUTY_BLOCK
          : hasPerson(cut.prompt)
          ? ref.replace(/No people, no hands, /i, "") + BEAUTY_BLOCK
          : ref;
        // 컷별 수정사항 — 직전 결과에서 잘못 나온 부분을 강제 교정
        const fix = cut.fixNote
          ? ` CORRECTION (the previous attempt was wrong — you MUST fix this): ${String(cut.fixNote).trim()}.`
          : "";
        const buf = await generateOne(
          anchorName, cutRef + style + cut.prompt + fix + DETAIL_BLOCK, prefix, cutAspect,
          useModel ? modelName : undefined
        );
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
