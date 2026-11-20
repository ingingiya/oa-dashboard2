'use client'
// 봇 탭 — 경은이 신입봇(시킨 일·반복 업무) / 경은이 1년차봇(신호 보고 스스로 일 만들어 처리). 워커 ~/oa-globalbot/worker.mjs (BOT=junior|senior)
import { useEffect, useState } from "react";
import GlobalBot from "./GlobalBot";
import { getSetting } from "../lib/useSupabase";

const BOTS = [
  { id: "junior", key: "oa_global_bot_v1", title: "🧑‍💻 경은이 신입봇", short: "신입봇", desc: "시킨 일만 해요 · 문장으로 맡기거나 업무 메뉴에서 고르면 경은님 방식대로 처리 · 반복 업무 등록 가능" },
  { id: "senior", key: "oa_bot_senior_v1", title: "🧑‍💼 경은이 1년차봇", short: "1년차봇", desc: "주문·리뷰·랭킹·재고·할인 마감·판매 급감 신호를 5분마다 보고 스스로 일을 만들어 처리해요 · 밖으로 나가는 일은 권한표대로 승인 후", senior: true },
  { id: "autos", short: "자동화 현황" },
];

// 오아 맥에서 돌아가는 자동화 전체(launchd·cron) — 1년차봇이 5분마다 ~/oa-globalbot/autos.mjs 로 모아 올림
function AutosPanel({ C, Card }) {
  const [v, setV] = useState(null); const [q, setQ] = useState("");
  const load = () => getSetting("oa_automation_status_v1").then((x) => setV(x || { items: [] })).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);
  if (!v) return null;
  const GROUPS = [["🤖 봇", /globalbot$|seniorbot|agent$|youtuber|usagi/], ["🇯🇵 큐텐·해외", /qoo10|qsm|jpdaily|aplan|kse/], ["📣 광고", /^com\.oa\.ad|cpi|competitor|weeklyadsupply|boosters|weekcard|gfa|meta-sheet|daily-ad|adspend|verdict/], ["💛 카카오", /kakao/], ["🛒 공구·PPL·채널", /gonggu|ppl|lowreviews|ssquery|sonic|smartstore|sync-|nworks|keyword|track|weekly-report/], ["🗄 기타", /./]];
  const items = (v.items || []).filter((i) => !q || (i.name + i.id + i.desc).toLowerCase().includes(q.toLowerCase()));
  const used = new Set(); const grouped = GROUPS.map(([g, re]) => [g, items.filter((i) => !used.has(i.id) && re.test(i.id) && used.add(i.id))]).filter(([, l]) => l.length);
  const ageMin = (t) => t ? Math.round((Date.now() - new Date(t.replace(" ", "T") + ":00+09:00")) / 6e4) : null;
  const dot = (i) => { if (i.kind === "launchd" && !i.loaded) return ["#dc2626", "안 올라감"]; if (i.exit && i.exit !== 0) return ["#dc2626", `마지막 종료코드 ${i.exit}`]; if (i.running) return ["#2563eb", "실행 중"]; return ["#16a34a", "정상"]; };
  const fmtAge = (m) => m === null ? "기록 없음" : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`;
  return (
    <Card style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: C.ink }}>⚙️ 자동화 현황</div>
        <span style={{ fontSize: 12.5, color: C.inkMid }}>오아 맥에서 도는 것 {v.items?.length || 0}개 · 최근 확인 {v.at || "-"}</span>
        <div style={{ flex: 1 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="찾기" style={{ fontSize: 13, padding: "5px 10px", borderRadius: 8, border: `1px solid ${C.border}`, width: 160 }} />
      </div>
      {grouped.map(([g, l]) => <div key={g} style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: C.ink, margin: "6px 0 4px" }}>{g} <span style={{ fontWeight: 600, color: C.inkLt }}>{l.length}</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 6 }}>
          {l.map((i) => { const [c, t] = dot(i); const m = ageMin(i.last); return (
            <div key={i.id} title={`${i.id}\n${i.cmd || ""}`} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "7px 10px", borderRadius: 10, border: `1px solid ${C.border}`, background: c === "#dc2626" ? "#fef2f2" : "#fff" }}>
              <span title={t} style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0, marginTop: 6 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}><span style={{ fontSize: 13, fontWeight: 800, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.name}</span><span style={{ fontSize: 11, color: C.inkLt, flexShrink: 0 }}>{i.kind}</span></div>
                <div style={{ fontSize: 12, color: C.inkMid, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.schedule || "수동"}{i.desc ? ` · ${i.desc}` : ""}</div>
                <div style={{ fontSize: 11.5, color: m !== null && m > 1440 * 8 ? "#b45309" : C.inkLt }}>{i.running ? "실행 중" : `마지막 기록 ${fmtAge(m)}`}{i.exit ? ` · 종료코드 ${i.exit}` : ""}</div>
              </div>
            </div>); })}
        </div>
      </div>)}
    </Card>
  );
}

export default function BotSection({ C, Card }) {
  const [cur, setCur] = useState(() => { try { return localStorage.getItem("oa_bot_tab") || "senior"; } catch { return "senior"; } });
  const b = BOTS.find((x) => x.id === cur) || BOTS[0];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.ink }}>봇</div>
          <div style={{ fontSize: 13, color: C.inkMid, marginTop: 2 }}>오아 맥에서 일하는 직원 봇 · 승인이 필요한 일은 노란 테두리로 올라와요</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 6 }}>
          {BOTS.map((x) => <button key={x.id} onClick={() => { setCur(x.id); try { localStorage.setItem("oa_bot_tab", x.id); } catch {} }} style={{ fontSize: 13, fontWeight: 800, padding: "7px 14px", borderRadius: 999, border: 0, cursor: "pointer", background: cur === x.id ? C.ink : "#f1f5f9", color: cur === x.id ? "#fff" : C.inkMid }}>{x.short}</button>)}
        </div>
      </div>
      {b.id === "autos" ? <AutosPanel C={C} Card={Card} /> : <GlobalBot key={b.id} C={C} Card={Card} botKey={b.key} title={b.title} desc={b.desc} senior={!!b.senior} />}
    </div>
  );
}
