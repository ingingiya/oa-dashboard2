// 📜 주간 경영 리포트 — 광고상사(/ads) 콘솔 캐시+결재 로그를 Claude가 신문 기사로 요약
// GET: 주간 캐시(oa_ad_weekly_v1, 월요일 기준 주 단위) 반환 / ?fresh=1 강제 재발행. Meta 직접 호출 없음
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const KEY = "oa_ad_weekly_v1";
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// 이번 주 월요일 (KST)
function weekKey() {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const d = now.getUTCDay(); // KST 기준 요일
  now.setUTCDate(now.getUTCDate() - ((d + 6) % 7));
  return now.toISOString().slice(0, 10);
}

export async function GET(req) {
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  const wk = weekKey();
  const s = sb();
  if (!fresh) {
    const { data } = await s.from("settings").select("value").eq("key", KEY).maybeSingle();
    if (data?.value?.week === wk) return Response.json({ ...data.value, cached: true });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "ANTHROPIC_API_KEY 없음" }, { status: 500 });

  const { data: cRow } = await s.from("settings").select("value").eq("key", "oa_ad_console_cache_v1").maybeSingle();
  const cs = cRow?.value?.payload;
  if (!cs?.campaigns) return Response.json({ error: "콘솔 데이터 없음 — 먼저 /ads를 열어주세요" }, { status: 404 });

  // 재료: KPI + 월 장부 + 활성 세트 성과 + 최근 결재 로그(승률)
  const lines = [];
  const k = cs.kpi || {}, m = cs.monthly?.cur || {};
  lines.push(`어제: 지출 ₩${k.yesterday?.spend?.toLocaleString()} 구매 ${k.yesterday?.purchases} ROAS ${k.yesterday?.roas ?? "-"}`);
  lines.push(`7일: 지출 ₩${k.week?.spend?.toLocaleString()} 구매 ${k.week?.purchases} CPA ₩${k.week?.cpa ?? "-"} ROAS ${k.week?.roas}`);
  if (m.mon) lines.push(`이달(${m.mon}): 지출 ₩${(m.spend || 0).toLocaleString()} 매출 ₩${(m.rev || 0).toLocaleString()} 구매 ${m.buy}`);
  for (const c of cs.campaigns) {
    const act = (c.adsets || []).filter((x) => x.status === "ACTIVE" && x.spend7 > 0);
    if (!act.length) continue;
    lines.push(`[캠페인 ${c.name}] 목표CPA ₩${c.target?.toLocaleString()}`);
    for (const x of act.slice(0, 8))
      lines.push(`- ${x.name} | 7일 지출 ₩${x.spend7?.toLocaleString()} 구매 ${x.purchases7} CPA ${x.cpa7 ? "₩" + x.cpa7.toLocaleString() : "없음"} | CTR ${x.ctr7}% | 판정 ${x.judge || "정상"}`);
  }
  const log = (cs.log || []).slice(0, 30);
  const judged = log.filter((l) => l.verdict === "win" || l.verdict === "fail");
  const winRate = judged.length ? Math.round((judged.filter((l) => l.verdict === "win").length / judged.length) * 100) : null;
  if (log.length) {
    lines.push(`최근 결재 ${log.length}건${winRate != null ? ` (성과판정 승률 ${winRate}%)` : ""}:`);
    for (const l of log.slice(0, 12))
      lines.push(`- ${(l.at || "").slice(5, 10)} ${l.name} ${l.desc || ""}${l.by ? ` [도장:${l.by}]` : ""}${l.verdict ? ` → ${l.verdict === "win" ? "성공" : "실패"}` : ""}`);
  }

  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6", max_tokens: 1400,
    messages: [{ role: "user", content: `당신은 이미용가전 브랜드 "오아"의 사내 신문 "주간 광고상사" 편집장입니다. 아래 실데이터로 이번 주 신문 기사를 쓰세요. 광고 세트 = 사원, 예산 = 월급, 구매 = 계약이라는 회사 놀이 세계관입니다.

${lines.join("\n")}

규칙:
- 데이터에 실제로 있는 세트/캠페인/숫자만 사용 (지어내기 금지)
- headline: 이번 주를 한 줄로 (신문 헤드라인체, 재치있게)
- lede: 리드 문단 2~3문장 (핵심 숫자 포함)
- best: 최고 성과 사원(세트) 1~2명 칭찬 (숫자 근거)
- worst: 부진 사원 지적 + 처방 1문장 (숫자 근거, 없으면 "이번 주 반성문 없음")
- decision: 최근 결재들 평가 1~2문장 (도장 찍은 사람 이름 언급 가능)
- strategy: 다음 주 경영 방침 1~2문장 (구체적 행동)
- quote: 가상의 사장 어록 한 줄 (사무실 유머)

JSON만 출력: {"headline":"...","lede":"...","best":"...","worst":"...","decision":"...","strategy":"...","quote":"..."}` }],
  });
  const raw = msg.content?.[0]?.text || "";
  let out;
  try { out = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); }
  catch { return Response.json({ error: "신문 발행 실패(파싱)" }, { status: 502 }); }

  const value = { week: wk, at: Date.now(), winRate, headline: out.headline || "", lede: out.lede || "",
    best: out.best || "", worst: out.worst || "", decision: out.decision || "", strategy: out.strategy || "", quote: out.quote || "" };
  await s.from("settings").upsert({ key: KEY, value }, { onConflict: "key" });
  return Response.json(value);
}
