// AI 비서 브리핑 — 광고상사(/ads) 콘솔 캐시를 요약해 Claude가 오늘의 지시 3개 생성
// GET: 캐시(oa_ad_brief_v1, 3h) 반환 / ?fresh=1 강제 재생성. Meta 직접 호출 없음(콘솔 KV만 읽음)
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store"; // ★ad-weekly와 동일 — Data Cache 스테일 픽스
export const maxDuration = 60;

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const BRIEF_KEY = "oa_ad_brief_v1";
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export async function GET(req) {
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  const s = sb();
  if (!fresh) {
    const { data } = await s.from("settings").select("value").eq("key", BRIEF_KEY).maybeSingle();
    if (data?.value?.at && Date.now() - data.value.at < 3 * 3600 * 1000)
      return Response.json({ ...data.value, cached: true });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "ANTHROPIC_API_KEY 없음" }, { status: 500 });

  const { data: cRow } = await s.from("settings").select("value").eq("key", "oa_ad_console_cache_v1").maybeSingle();
  const cs = cRow?.value?.payload;
  if (!cs?.campaigns) return Response.json({ error: "콘솔 데이터 없음 — 먼저 /ads를 열어주세요" }, { status: 404 });

  // 브리핑 재료: KPI + 활성 세트 성과 요약 (텍스트 압축)
  const lines = [];
  const k = cs.kpi || {};
  lines.push(`어제: 지출 ₩${k.yesterday?.spend?.toLocaleString()} 구매 ${k.yesterday?.purchases} CPA ₩${k.yesterday?.cpa ?? "-"}`);
  lines.push(`7일: 지출 ₩${k.week?.spend?.toLocaleString()} 구매 ${k.week?.purchases} CPA ₩${k.week?.cpa ?? "-"} ROAS ${k.week?.roas}`);
  for (const c of cs.campaigns) {
    const act = c.adsets.filter((x) => x.status === "ACTIVE" && x.spend7 > 0);
    if (!act.length) continue;
    lines.push(`[캠페인 ${c.name}] 목표CPA ₩${c.target?.toLocaleString()}`);
    for (const x of act.slice(0, 8))
      lines.push(`- ${x.name} | 예산/일 ₩${x.budget?.toLocaleString()} | 7일 지출 ₩${x.spend7?.toLocaleString()} 구매 ${x.purchases7} CPA ${x.cpa7 ? "₩" + x.cpa7.toLocaleString() : "없음"} | 3일 CPA ${x.cpa3 ? "₩" + x.cpa3.toLocaleString() : "없음"} | CTR ${x.ctr7}% | 판정 ${x.judge || "정상"}`);
  }

  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6", max_tokens: 1200,
    messages: [{ role: "user", content: `당신은 이미용가전 브랜드 "오아"의 메타 광고 운영 비서입니다. 아래 실데이터를 보고 오늘 사장이 해야 할 지시를 딱 3개 뽑아주세요.

${lines.join("\n")}

규칙:
- 데이터에 실제로 있는 세트/캠페인 이름만 언급 (지어내기 금지)
- action은 증액/중지/유지관찰/소재교체 중 하나
- reason은 숫자 근거 포함 1문장, 한국어 구어체 비서 말투 ("~하시죠", "~가 좋겠어요")
- 마지막에 한 줄 요약 mood: 오늘 전체 분위기 한 문장 (재치있게, 사무실 비유)

JSON만 출력: {"items":[{"action":"증액","target":"세트명","reason":"..."}],"mood":"..."}` }],
  });
  const raw = msg.content?.[0]?.text || "";
  let out;
  try { out = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); }
  catch { return Response.json({ error: "브리핑 파싱 실패" }, { status: 502 }); }

  const value = { at: Date.now(), items: out.items || [], mood: out.mood || "" };
  await s.from("settings").upsert({ key: BRIEF_KEY, value }, { onConflict: "key" });
  return Response.json(value);
}
