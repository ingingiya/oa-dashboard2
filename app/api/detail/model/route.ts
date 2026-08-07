// app/api/detail/model/route.ts
// 모델(인물) 생성/관리 — 나노바나나2로 전신샷 후보를 뽑아 라이브러리에 저장.
// 선택된 모델은 컷 생성 시 제품 앵커와 함께 참조돼 동일 인물로 유지된다.
// GET → { ok, items } / POST { generate: { prompt?, count? } } / POST { remove: id }

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BUCKET = "detail-assets";
const KEY = "oa_detail_models_v1";
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

// 시그니처 K-드라마 배우급 미모 블록 + 멀티뷰 캐릭터 시트 (어느 각도 컷에서도 동일 인물 유지용)
const MODEL_BASE =
  "CHARACTER REFERENCE SHEET of ONE beautiful Korean woman in her mid-20s with the " +
  "polished visual of a top-tier K-drama actress — luminous clear glowing skin. " +
  "The sheet shows the EXACT SAME woman in THREE views side by side on one clean " +
  "light-gray seamless studio background: (1) full-body FRONT view standing head-to-toe " +
  "including shoes with a soft friendly smile, (2) full-body SIDE PROFILE view, " +
  "(3) large close-up FACE portrait. Identical face, identical hairstyle, identical outfit " +
  "in all three views. Soft wraparound beauty light, premium K-beauty commercial fashion " +
  "lookbook quality, no text, no labels, no watermark. " +
  "PHOTOREALISM RULES: she must look like a REAL person photographed on a real set, NOT AI-generated — " +
  "realistic natural skin texture with visible pores and fine facial micro-details, NOT airbrushed plastic, " +
  "NOT AI-perfect symmetry, a few natural flyaway hairs, real fabric weave and natural wrinkles in clothing, " +
  "natural catch-lights in the eyes. Shot on an 85mm lens at f/2.8 like a real fashion lookbook photo, " +
  "natural editorial color grade, subtle fine film grain. ";

// 후보마다 다른 얼굴상 — 전부 같은 얼굴로 수렴하는 것 방지 (강아지상=김유정삘, 고양이상=한소희삘 등)
const FACE_ARCHETYPES = [
  { label: "청순 강아지상",
    desc: "Her face type: adorable puppy-like visual — softly rounded youthful face, big warm round " +
      "brown eyes with charming aegyo-sal under them, small cute nose, bright innocent smile, " +
      "sweet girl-next-door first-love charm like a young K-drama rom-com lead actress. " },
  { label: "시크 고양이상",
    desc: "Her face type: chic cat-like visual — sleek almond feline eyes slightly upturned at the outer " +
      "corners, high elegant cheekbones, slim straight nose, porcelain pale skin, calm alluring gaze, " +
      "an effortlessly cool and slightly mysterious aura like a high-fashion K-drama femme-fatale lead. " },
  { label: "맑은 첫사랑상",
    desc: "Her face type: clear innocent first-love visual — gentle soft drooping eyes, natural fresh " +
      "bare-skin beauty, delicate slender features, a shy warm smile, the pure calm mood of a " +
      "coming-of-age film heroine. " },
  { label: "도시 세련상",
    desc: "Her face type: modern sophisticated city visual — defined jawline, deep double-lidded eyes, " +
      "confident direct gaze, full lips, polished editorial beauty like a luxury brand campaign model. " },
  { label: "우아 배우상",
    desc: "Her face type: elegant classic actress visual — graceful refined symmetrical features, " +
      "serene composed smile, timeless red-carpet beauty of an award-winning actress. " },
  { label: "상큼 발랄상",
    desc: "Her face type: fresh vibrant idol-like visual — sparkling lively eyes, subtle dimples when " +
      "smiling, energetic bright expression, youthful playful charm. " },
];

// 후보마다 다른 헤어 (여러 명 중 고르는 용도) — 의상은 별도 지정 가능
const HAIR_VARIATIONS = [
  "Long natural black hair.",
  "Chin-length bob hair.",
  "Long soft-wave brown hair.",
  "Neat low ponytail.",
  "Shoulder-length dark hair with see-through bangs.",
  "Half-up long hair.",
];

// 깔끔한 기본 의상 로테이션 (의상 미지정 시)
const OUTFIT_VARIATIONS = [
  "a crisp white blouse and tailored beige slacks",
  "a light-blue oxford shirt and white wide-leg pants",
  "an ivory fine-knit one-piece dress",
  "a plain white t-shirt and clean light-beige chinos",
  "a gray tailored blazer over a white top with slim black slacks",
  "a pastel-pink cardigan and an A-line white skirt",
];

// 의상 공통 스타일링 — 깔끔·정돈 강제
const OUTFIT_STYLE =
  "The outfit is CLEAN and NEATLY styled like a fashion lookbook: freshly pressed, " +
  "well-fitted, perfectly tucked and arranged by a stylist, no stains, no clutter, " +
  "no odd layering, simple minimal design with no busy patterns or logos. ";

// 의상 사진을 Comfy에 업로드 → 참조 이미지로 사용
async function uploadImage(url: string): Promise<string> {
  const img = await fetch(url);
  if (!img.ok) throw new Error(`의상 이미지 다운로드 실패 ${img.status}`);
  const form = new FormData();
  form.append("image", await img.blob(), url.split("/").pop()?.split("?")[0] || "outfit.png");
  const info = await (await comfy("/api/upload/image", { method: "POST", body: form })).json();
  return info.subfolder ? `${info.subfolder}/${info.name}` : info.name;
}

function buildWorkflow(prompt: string, prefix: string, refNames?: string[]) {
  const wf: any = {
    "1": {
      class_type: "GeminiNanoBanana2",
      inputs: {
        prompt,
        model: "Nano Banana 2 (Gemini 3.1 Flash Image)",
        seed: Math.floor(Math.random() * 1e9),
        aspect_ratio: "3:2", // 멀티뷰 시트라 가로형
        resolution: "2K", // 4K+HIGH는 너무 느림 (타임아웃 유발) — 2K로 충분
        response_modalities: "IMAGE",
        thinking_level: "MINIMAL",
      },
    },
    "2": { class_type: "SaveImage", inputs: { images: ["1", 0], filename_prefix: prefix } },
  };
  // 참조 이미지: 1장이면 직결, 2장이면 ImageBatch로 묶음 (image1이 무왜곡 기준)
  if (refNames?.length === 1) {
    wf["3"] = { class_type: "LoadImage", inputs: { image: refNames[0] } };
    wf["1"].inputs.images = ["3", 0];
  } else if (refNames && refNames.length >= 2) {
    wf["3"] = { class_type: "LoadImage", inputs: { image: refNames[0] } };
    wf["4"] = { class_type: "LoadImage", inputs: { image: refNames[1] } };
    wf["5"] = { class_type: "ImageBatch", inputs: { image1: ["3", 0], image2: ["4", 0] } };
    wf["1"].inputs.images = ["5", 0];
  }
  return wf;
}

async function generateOne(prompt: string, prefix: string, refNames?: string[]): Promise<Buffer> {
  const submit = await (
    await comfy("/api/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: buildWorkflow(prompt, prefix, refNames),
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
      throw new Error("출력 이미지 없음");
    }
    if (status === "failed" || status === "cancelled" || status === "error")
      throw new Error(`생성 실패(${status}): ${JSON.stringify(st).slice(0, 300)}`);
  }
  throw new Error("생성 타임아웃");
}

type ModelItem = { id: string; url: string; name: string; at: string; samples?: string[] };

// 모델이 제품을 들고 있는 예시샷 프롬프트 (제품=1번 참조, 모델=2번 참조)
const SAMPLE_PROMPT =
  "Two reference images are provided. The FIRST is the product — keep its design, proportions, " +
  "logo placement and materials EXACTLY identical, do not invent buttons or text. " +
  "The SECOND is the model — the EXACT SAME woman (same face, same hairstyle, same outfit) " +
  "holding the product at chest height with both visible, looking at the camera with a soft smile, " +
  "her face clearly visible, waist-up shot, clean bright studio background, " +
  "premium K-beauty commercial quality. " +
  "PHOTOREALISM RULES: she must look like a REAL person photographed on a real set, NOT AI-generated — " +
  "realistic natural skin texture with visible pores, NOT airbrushed plastic, NOT AI-perfect symmetry, " +
  "shot on an 85mm lens at f/2.8, natural editorial color grade, subtle fine film grain.";

async function getList(sb: ReturnType<typeof getSupabase>): Promise<ModelItem[]> {
  const { data } = await sb.from("settings").select("value").eq("key", KEY).maybeSingle();
  return data?.value?.items || [];
}
async function setList(sb: ReturnType<typeof getSupabase>, items: ModelItem[]) {
  await sb.from("settings").upsert({ key: KEY, value: { items: items.slice(0, 60) } }, { onConflict: "key" });
}

export async function GET() {
  return NextResponse.json({ ok: true, items: await getList(getSupabase()) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sb = getSupabase();

    if (body.remove) {
      const items = (await getList(sb)).filter((i) => i.id !== body.remove);
      await setList(sb, items);
      return NextResponse.json({ ok: true, items });
    }

    // 선택 모델이 제품을 들고 있는 예시샷 생성 → item.samples에 저장
    if (body.sample) {
      const { id, productUrl } = body.sample;
      if (!productUrl) throw new Error("제품 앵커 이미지가 필요합니다 (스텝1에서 실사 앵커 등록)");
      const items = await getList(sb);
      const item = items.find((i) => i.id === id);
      if (!item) throw new Error("모델을 찾을 수 없어요");
      const [prodName, mName] = await Promise.all([uploadImage(productUrl), uploadImage(item.url)]);
      const buf = await generateOne(SAMPLE_PROMPT, `sample_${id}`, [prodName, mName]);
      const path = `models/s_${id}_${Date.now().toString(36)}.png`;
      const { error } = await sb.storage
        .from(BUCKET)
        .upload(path, buf, { contentType: "image/png", upsert: true });
      if (error) throw error;
      const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
      item.samples = [data.publicUrl, ...(item.samples || [])].slice(0, 6);
      await setList(sb, items);
      return NextResponse.json({ ok: true, items });
    }

    if (body.generate) {
      const userStyle = String(body.generate.prompt || "").trim();
      const outfit = String(body.generate.outfit || "").trim();
      const outfitUrl = String(body.generate.outfitUrl || "").trim();
      const count = Math.min(6, Math.max(1, Number(body.generate.count) || 4));
      const batch = Date.now().toString(36);
      const made: ModelItem[] = [];

      // 의상 사진이 있으면 Comfy에 한 번만 업로드해 전 후보가 공유
      const outfitName = outfitUrl ? await uploadImage(outfitUrl) : undefined;

      await Promise.all(
        Array.from({ length: count }, async (_, i) => {
          const wear = outfitName
            ? "She is wearing the EXACT outfit shown in the reference image — same garments, " +
              "same colors, same materials and details, naturally fitted on her body. "
            : `She is wearing ${outfit || OUTFIT_VARIATIONS[i % OUTFIT_VARIATIONS.length]}. `;
          // 얼굴상+헤어는 항상 후보별 로테이션 — 사용자 스타일은 대체가 아니라 추가 (전원 같은 얼굴 방지)
          const face = FACE_ARCHETYPES[i % FACE_ARCHETYPES.length];
          const prompt =
            MODEL_BASE +
            face.desc +
            HAIR_VARIATIONS[i % HAIR_VARIATIONS.length] + " " +
            (userStyle ? "Additional style notes: " + userStyle + ". " : "") +
            wear +
            OUTFIT_STYLE;
          const buf = await generateOne(prompt, `model_${batch}_${i}`, outfitName ? [outfitName] : undefined);
          const path = `models/m_${batch}_${i}.png`;
          const { error } = await sb.storage
            .from(BUCKET)
            .upload(path, buf, { contentType: "image/png", upsert: true });
          if (error) throw error;
          const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
          made.push({
            id: `${batch}_${i}`,
            url: data.publicUrl,
            name: `${FACE_ARCHETYPES[i % FACE_ARCHETYPES.length].label} ${batch.slice(-2)}-${i + 1}`,
            at: new Date().toISOString(),
          });
        })
      );

      const items = [...made, ...(await getList(sb))];
      await setList(sb, items);
      return NextResponse.json({ ok: true, items });
    }

    return NextResponse.json({ ok: false, error: "generate 또는 remove 필요" }, { status: 400 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
