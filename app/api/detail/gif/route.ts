// app/api/detail/gif/route.ts
// 컷 이미지 → 시댄스 2(ByteDance2FirstLastFrame) 모션 영상 → GIF 변환까지 Comfy Cloud 안에서 완결
// POST { imageUrl, prompt, slug, file?, duration? } → { ok, url }
// 검증된 형식: 다이나믹 콤보 파라미터는 "model.prompt" 중첩 키 (2026-08 라이브 테스트)

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

async function uploadImage(url: string): Promise<string> {
  const img = await fetch(url);
  if (!img.ok) throw new Error(`이미지 다운로드 실패 ${img.status}`);
  const form = new FormData();
  form.append("image", await img.blob(), url.split("/").pop()?.split("?")[0] || "frame.png");
  const info = await (await comfy("/api/upload/image", { method: "POST", body: form })).json();
  return info.subfolder ? `${info.subfolder}/${info.name}` : info.name;
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, prompt, slug, file, duration } = await req.json();
    if (!imageUrl) throw new Error("imageUrl 필요");
    const dur = Math.min(15, Math.max(4, Number(duration) || 5));
    const motion =
      String(prompt || "").trim() ||
      "Subtle premium product motion: slow cinematic camera push-in, soft light sweep across the product surface, everything else stays static. No people.";

    const frameName = await uploadImage(imageUrl);
    const workflow = {
      "1": { class_type: "LoadImage", inputs: { image: frameName } },
      "2": {
        class_type: "ByteDance2FirstLastFrameNode",
        inputs: {
          model: "Seedance 2.0", // 최고 품질 (Fast는 720p 한계)
          "model.prompt": motion,
          "model.resolution": "1080p",
          "model.ratio": "adaptive",
          "model.duration": dur,
          "model.generate_audio": false,
          seed: Math.floor(Math.random() * 2 ** 31),
          watermark: false,
          first_frame: ["1", 0],
        },
      },
      "3": { class_type: "GetVideoComponents", inputs: { video: ["2", 0] } },
      "4": { class_type: "VHS_SelectEveryNthImage", inputs: { images: ["3", 0], select_every_nth: 2, skip_first_images: 0 } },
      "5": {
        class_type: "VHS_VideoCombine",
        inputs: { images: ["4", 0], frame_rate: 12, loop_count: 0, filename_prefix: "detail_gif", format: "image/gif", pingpong: false, save_output: true },
      },
    };

    const submit = await (
      await comfy("/api/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: workflow, extra_data: { api_key_comfy_org: comfyKey() } }),
      })
    ).json();
    const pid = submit.prompt_id;
    if (!pid) throw new Error("Comfy 제출 실패: " + JSON.stringify(submit));

    const deadline = Date.now() + 260_000;
    let buf: Buffer | null = null;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      const st = await (await comfy(`/api/job/${pid}/status`)).json();
      const status = st.status ?? st;
      if (status === "completed" || status === "success") {
        const job = await (await comfy(`/api/jobs/${pid}`)).json();
        for (const out of Object.values<any>(job.outputs || {})) {
          for (const item of [...(out.gifs || []), ...(out.images || [])]) {
            const q = `filename=${encodeURIComponent(item.filename)}&subfolder=${encodeURIComponent(item.subfolder || "")}&type=output`;
            buf = Buffer.from(await (await comfy(`/api/view?${q}`)).arrayBuffer());
            break;
          }
          if (buf) break;
        }
        if (!buf) throw new Error("GIF 출력 없음");
        break;
      }
      if (status === "failed" || status === "cancelled" || status === "error")
        throw new Error(`생성 실패(${status}): ${JSON.stringify(st).slice(0, 400)}`);
    }
    if (!buf) throw new Error("생성 타임아웃 (시댄스 혼잡 — 다시 시도해주세요)");

    const name = String(file || "motion").replace(/\.\w+$/, "") + "_" + Date.now().toString(36) + ".gif";
    const path = `${String(slug || "detail")}/gifs/${name}`;
    const { error } = await getSupabase().storage
      .from(BUCKET)
      .upload(path, buf, { contentType: "image/gif", upsert: true });
    if (error) throw error;
    const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
