// app/api/detail/generate/route.ts
// 이미지 생성 API — Vercel에서 RunPod 서버리스 ComfyUI 호출 → 결과를 Supabase Storage에 저장
//
// RunPod 준비 (1회):
//   1. RunPod → Serverless → "ComfyUI" 템플릿으로 엔드포인트 생성
//   2. LoRA(safetensors)를 네트워크 볼륨 models/loras/ 에 업로드
//   3. 워크플로우 Export(API) JSON을 아래 WORKFLOW에 붙여넣기 (또는 Supabase에 저장 후 fetch)
// 환경변수: RUNPOD_API_KEY, RUNPOD_ENDPOINT_ID

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import WORKFLOW from "../../../../lib/workflow_api.json"; // Export(API) 포맷

export const maxDuration = 300; // 생성 대기 폴링 포함
export const dynamic = "force-dynamic";

const PROMPT_NODE_ID = "6"; // 긍정 프롬프트 CLIPTextEncode 노드 번호
const BUCKET = "detail-assets";

// 빌드 타임엔 env가 없을 수 있어 lazy 초기화
const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

const RP_BASE = `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID}`;
const RP_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
};

async function generateOne(prompt: string): Promise<Buffer> {
  // 워크플로우 복제 + 프롬프트/시드 주입
  const wf = JSON.parse(JSON.stringify(WORKFLOW));
  wf[PROMPT_NODE_ID].inputs.text = prompt;
  for (const id of Object.keys(wf)) {
    if (wf[id].class_type === "KSampler")
      wf[id].inputs.seed = Math.floor(Math.random() * 1e15);
  }

  // RunPod 비동기 실행
  const run = await fetch(`${RP_BASE}/run`, {
    method: "POST",
    headers: RP_HEADERS,
    body: JSON.stringify({ input: { workflow: wf } }),
  }).then((r) => r.json());
  if (!run.id) throw new Error("RunPod 실행 실패: " + JSON.stringify(run));

  // 완료 폴링
  while (true) {
    await new Promise((r) => setTimeout(r, 3000));
    const st = await fetch(`${RP_BASE}/status/${run.id}`, {
      headers: RP_HEADERS,
    }).then((r) => r.json());

    if (st.status === "COMPLETED") {
      // ComfyUI worker는 보통 base64 이미지 배열 반환 (템플릿에 따라 output.images / output.message 등)
      const b64 =
        st.output?.images?.[0]?.data ??
        st.output?.images?.[0] ??
        st.output?.message;
      if (!b64) throw new Error("출력 이미지 없음: " + JSON.stringify(st.output));
      return Buffer.from(b64, "base64");
    }
    if (st.status === "FAILED") throw new Error("생성 실패: " + JSON.stringify(st));
  }
}

// POST body: { productSlug: "cleanswingP", cuts: [{ file: "hook.png", prompt: "..." }, ...] }
export async function POST(req: NextRequest) {
  try {
    const { productSlug, cuts } = await req.json();
    const results: { file: string; url: string }[] = [];

    // 서버리스 워커가 병렬 뜨므로 동시 실행 가능 (비용은 컷 수에 비례)
    await Promise.all(
      cuts.map(async (cut: { file: string; prompt: string }) => {
        const buf = await generateOne(cut.prompt);
        const filePath = `${productSlug}/${cut.file}`;
        const { error } = await getSupabase().storage
          .from(BUCKET)
          .upload(filePath, buf, { contentType: "image/png", upsert: true });
        if (error) throw error;
        const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(filePath);
        results.push({ file: cut.file, url: data.publicUrl });
      })
    );

    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
