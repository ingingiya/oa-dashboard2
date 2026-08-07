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

// 시그니처 K-드라마 배우급 미모 블록 + 전신샷 조건
const MODEL_BASE =
  "Full-body studio photograph of a BEAUTIFUL KOREAN WOMAN in her mid-20s with the " +
  "polished look of a K-drama actress — luminous clear glowing skin, large bright " +
  "expressive eyes, elegant symmetrical features, full natural lips, a soft V-line jaw. " +
  "Standing naturally facing the camera, visible head-to-toe including shoes, relaxed " +
  "posture, soft friendly smile. Clean light-gray seamless studio background, soft " +
  "wraparound beauty light, premium K-beauty commercial fashion lookbook quality, " +
  "8K sharpness, no text, no watermark. ";

// 후보마다 다른 헤어/의상 (여러 명 중 고르는 용도)
const VARIATIONS = [
  "Long natural black hair, crisp white blouse and beige slacks.",
  "Chin-length bob hair, light-blue shirt and white wide pants.",
  "Long soft-wave brown hair, ivory knit one-piece dress.",
  "Neat low ponytail, casual white t-shirt and light denim jeans.",
  "Shoulder-length dark hair with see-through bangs, gray blazer over white top.",
  "Half-up long hair, pastel-pink cardigan and white skirt.",
];

function buildWorkflow(prompt: string, prefix: string) {
  return {
    "1": {
      class_type: "GeminiNanoBanana2",
      inputs: {
        prompt,
        model: "Nano Banana 2 (Gemini 3.1 Flash Image)",
        seed: Math.floor(Math.random() * 1e9),
        aspect_ratio: "2:3",
        resolution: "2K",
        response_modalities: "IMAGE",
        thinking_level: "MINIMAL",
      },
    },
    "2": { class_type: "SaveImage", inputs: { images: ["1", 0], filename_prefix: prefix } },
  };
}

async function generateOne(prompt: string, prefix: string): Promise<Buffer> {
  const submit = await (
    await comfy("/api/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: buildWorkflow(prompt, prefix),
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

type ModelItem = { id: string; url: string; name: string; at: string };

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

    if (body.generate) {
      const userStyle = String(body.generate.prompt || "").trim();
      const count = Math.min(6, Math.max(1, Number(body.generate.count) || 4));
      const batch = Date.now().toString(36);
      const made: ModelItem[] = [];

      await Promise.all(
        Array.from({ length: count }, async (_, i) => {
          const prompt = MODEL_BASE + (userStyle ? userStyle + ". " : VARIATIONS[i % VARIATIONS.length]);
          const buf = await generateOne(prompt, `model_${batch}_${i}`);
          const path = `models/m_${batch}_${i}.png`;
          const { error } = await sb.storage
            .from(BUCKET)
            .upload(path, buf, { contentType: "image/png", upsert: true });
          if (error) throw error;
          const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
          made.push({
            id: `${batch}_${i}`,
            url: data.publicUrl,
            name: `모델 ${batch.slice(-3)}-${i + 1}`,
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
