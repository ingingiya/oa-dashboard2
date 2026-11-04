'use client'
// 홈 카드: 아침 광고 판정(24) · 이번 달 목표 게이지(3) · PPL 예산(23)
import { useEffect, useState } from "react";
import useShared, { PRODUCTS, won } from "./useShared";
import { getSetting } from "../lib/useSupabase";

const V = { off: ["끄기", "#dc2626", "#fef2f2"], down: ["줄이기", "#d97706", "#fffbeb"], up: ["늘리기", "#16a34a", "#f0fdf4"], keep: ["유지", "#6b7280", "#f9fafb"] };

export function VerdictCard({ C, Card }) {
  const [d, setD] = useState(null); const [open, setOpen] = useState(false);
  useEffect(() => { getSetting("oa_ad_verdict_v1").then(setD).catch(() => {}); }, []);
  const rows = d?.rows || [];
  const act = rows.filter((r) => r.verdict !== "keep");
  return (
    <Card style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>오늘의 광고 판정</div>
        <span style={{ fontSize: 12, color: C.inkLt }}>{d ? `${d.at?.slice(5, 16).replace("T", " ")} 기준 · 최근 7일 · 구매완료 ROAS` : "아직 판정 없음 · 매일 9시 자동"}</span>
        <div style={{ flex: 1 }} />
        {rows.length > 0 && <button onClick={() => setOpen(!open)} style={{ fontSize: 12, fontWeight: 700, border: `1px solid ${C.border}`, background: C.cream, borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>{open ? "접기" : `전체 ${rows.length}개`}</button>}
      </div>
      {d && <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        {["off", "down", "up", "keep"].map((k) => { const n = rows.filter((r) => r.verdict === k).length; return <span key={k} style={{ fontSize: 12, fontWeight: 800, color: V[k][1], background: V[k][2], borderRadius: 6, padding: "3px 9px" }}>{V[k][0]} {n}</span>; })}
        <span style={{ fontSize: 12, color: C.inkLt, alignSelf: "center" }}>손익분기 ROAS: 플렌티플렛 {d.be?.["플렌티플렛"] || 250}% · 프리온 {d.be?.["프리온"] || 230}%</span>
      </div>}
      {(open ? rows : act.slice(0, 6)).map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "56px 1fr auto", gap: 10, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", background: V[r.verdict]?.[1], borderRadius: 4, padding: "2px 0", textAlign: "center" }}>{V[r.verdict]?.[0]}</span>
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.product} · {r.channel} · {r.name}</div><div style={{ fontSize: 12, color: C.inkLt }}>{r.reason}</div></div>
          <div style={{ fontSize: 12, color: C.inkMid, textAlign: "right", whiteSpace: "nowrap" }}>{won(r.cost7)}원{r.roas7 != null ? ` · ROAS ${Math.round(r.roas7)}%` : r.cpc7 != null ? ` · CPC ${Math.round(r.cpc7)}원` : ""}</div>
        </div>
      ))}
      {d && !open && act.length === 0 && <div style={{ fontSize: 13, color: C.inkLt, marginTop: 8 }}>오늘은 바꿀 게 없어요. 전부 유지.</div>}
    </Card>
  );
}

export function GoalCard({ C, Card }) {
  const ym = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7);
  const [g, setG] = useShared("oa_goals_v1", { ym, goals: [{ label: "플렌티플렛4L", like: "오아플렌티플렛4L", target: 3000 }] });
  const [act, setAct] = useState({}); const [edit, setEdit] = useState(false);
  const goals = (g.ym === ym ? g.goals : g.goals) || [];
  const key = goals.map((x) => x.like + x.target).join("|");
  useEffect(() => { if (!goals.length) return; fetch("/api/event-perf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: goals.map((x, i) => ({ id: String(i), product: x.like, ym })) }) }).then((r) => r.json()).then((j) => setAct(j.results || {})).catch(() => {}); }, [key]);
  const dim = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate(); const dom = new Date(Date.now() + 9 * 3600e3).getUTCDate();
  return (
    <Card style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>{+ym.slice(5, 7)}월 목표</div>
        <span style={{ fontSize: 12, color: C.inkLt }}>스마트스토어+자사몰 판매 · {dom}/{dim}일 경과</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setEdit(!edit)} style={{ fontSize: 12, fontWeight: 700, border: `1px solid ${C.border}`, background: C.cream, borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>{edit ? "닫기" : "목표 편집"}</button>
      </div>
      {goals.map((x, i) => { const a = act[String(i)]; const q = a?.q || 0; const pct = x.target ? Math.min(100, q / x.target * 100) : 0; const pace = x.target * dom / dim; const ok = q >= pace;
        return (
          <div key={i} style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span style={{ fontWeight: 800, color: C.ink }}>{x.label}</span>
              <span style={{ color: C.inkMid }}><b style={{ color: ok ? "#16a34a" : "#dc2626" }}>{q.toLocaleString()}</b> / {Number(x.target).toLocaleString()}대 · {Math.round(pct)}% {a?.lyQ != null && <span style={{ color: C.inkLt }}>· 작년 같은 기간 {a.lyQ.toLocaleString()}</span>}</span>
            </div>
            <div style={{ height: 10, background: C.cream, borderRadius: 5, position: "relative", overflow: "hidden" }}>
              <div style={{ width: pct + "%", height: "100%", background: ok ? "#16a34a" : "#dc2626", borderRadius: 5 }} />
              <div title="오늘까지 페이스" style={{ position: "absolute", left: Math.min(100, dom / dim * 100) + "%", top: 0, bottom: 0, width: 2, background: C.ink, opacity: .5 }} />
            </div>
            {edit && <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
              <input type="number" value={x.target} onChange={(e) => setG((p) => ({ ym, goals: p.goals.map((y, j) => j === i ? { ...y, target: +e.target.value } : y) }))} style={{ width: 90, fontSize: 12, padding: "3px 6px", border: `1px solid ${C.border}`, borderRadius: 6 }} />
              <span style={{ fontSize: 12, color: C.inkLt }}>대</span>
              <button onClick={() => setG((p) => ({ ym, goals: p.goals.filter((_, j) => j !== i) }))} style={{ fontSize: 12, border: 0, background: "none", color: C.inkLt, cursor: "pointer" }}>✕ 빼기</button>
            </div>}
          </div>
        ); })}
      {edit && <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}>
        <select id="goal-add" style={{ fontSize: 12, padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6 }}>{PRODUCTS.filter((p) => !goals.find((x) => x.like === p.like)).map((p) => <option key={p.like} value={p.like}>{p.label}</option>)}</select>
        <button onClick={() => { const sel = document.getElementById("goal-add"); const p = PRODUCTS.find((x) => x.like === sel.value); if (p) setG((g0) => ({ ym, goals: [...(g0.goals || []), { ...p, target: 500 }] })); }} style={{ fontSize: 12, fontWeight: 700, border: `1px solid ${C.border}`, background: C.white, borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>+ 제품 추가</button>
      </div>}
    </Card>
  );
}

export function PplBudgetCard({ C, Card, onOpen }) {
  const [leads, setLeads] = useState(null);
  const [b, setB] = useShared("oa_ppl_budget_v1", { amount: 10000 });
  const [edit, setEdit] = useState(false);
  useEffect(() => { fetch("/api/ppl-leads").then((r) => r.json()).then((j) => setLeads(j.rows || [])).catch(() => setLeads([])); }, []);
  const conf = (leads || []).filter((r) => r.confirmed);
  const sum = conf.reduce((a, r) => a + Number(r.deal_amount || 0), 0);
  const pct = b.amount ? Math.min(100, sum / b.amount * 100) : 0;
  return (
    <Card style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>PPL 협찬 예산</div>
        <span style={{ fontSize: 12, color: C.inkLt }}>확정 {conf.length}명</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setEdit(!edit)} style={{ fontSize: 12, fontWeight: 700, border: `1px solid ${C.border}`, background: C.cream, borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>{edit ? "닫기" : "예산 편집"}</button>
        <button onClick={onOpen} style={{ fontSize: 12, fontWeight: 700, border: `1px solid ${C.border}`, background: C.white, borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>진행판 →</button>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 900, color: C.ink }}>{sum.toLocaleString()}만</span>
        <span style={{ fontSize: 13, color: C.inkMid }}>/ {Number(b.amount).toLocaleString()}만원 · 남은 {Math.max(0, b.amount - sum).toLocaleString()}만</span>
      </div>
      <div style={{ height: 10, background: C.cream, borderRadius: 5, overflow: "hidden", marginTop: 6 }}><div style={{ width: pct + "%", height: "100%", background: pct >= 100 ? "#dc2626" : C.rose, borderRadius: 5 }} /></div>
      {edit && <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}><input type="number" value={b.amount} onChange={(e) => setB({ amount: +e.target.value })} style={{ width: 110, fontSize: 12, padding: "3px 6px", border: `1px solid ${C.border}`, borderRadius: 6 }} /><span style={{ fontSize: 12, color: C.inkLt }}>만원 (이번 회차 총 예산)</span></div>}
      <div style={{ fontSize: 12, color: C.inkMid, marginTop: 8, lineHeight: 1.6 }}>{conf.sort((a, b2) => (b2.deal_amount || 0) - (a.deal_amount || 0)).map((r) => `${r.channel_name} ${Number(r.deal_amount).toLocaleString()}`).join(" · ") || (leads ? "확정 없음" : "불러오는 중...")}</div>
    </Card>
  );
}
