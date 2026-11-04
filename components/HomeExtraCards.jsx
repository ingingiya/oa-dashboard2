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

// 카카오 선물하기 순위 카드(30): oa_kakao_rank_v1(추적기 07시 갱신)
export function KakaoRankCard({ C, Card }) {
  const [r, setR] = useState(null);
  useEffect(() => { getSetting("oa_kakao_rank_v1").then(setR).catch(() => {}); }, []);
  if (!r?.products) return null;
  const arrow = (p, t) => p == null && t == null ? "—" : t == null ? `${p}→권외` : p == null ? `신규 ${t}위` : p === t ? `${t}위 (=)` : `${p}→${t}위 ${t < p ? "▲" + (p - t) : "▼" + (t - p)}`;
  return (
    <Card style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>카카오 선물하기 순위</div><span style={{ fontSize: 12, color: C.inkLt }}>{r.date} 07시 · 전일 대비</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 8, marginTop: 10 }}>
        {r.products.map((p, i) => { const g = p.goal || {}; const m = (p.ranks || {})[g.list] || {}; const t = m.today, pv = m.prev; const hit = t && g.max && t <= g.max; const moved = pv != null && t != null && pv !== t;
          return <div key={i} style={{ border: `1px solid ${C.border}`, borderLeft: `4px solid ${hit ? "#16a34a" : moved && t > pv ? "#dc2626" : C.border}`, borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
            <div style={{ fontSize: 12, color: C.inkMid }}>{g.list || "순위"} <b style={{ color: hit ? "#16a34a" : t != null && pv != null && t > pv ? "#dc2626" : C.ink }}>{arrow(pv, t)}</b>{g.max ? <span style={{ color: C.inkLt }}> · 목표 {g.min}~{g.max}위</span> : null}</div>
            {(p.wish?.today != null || p.review?.today != null) && <div style={{ fontSize: 11, color: C.inkLt }}>찜 {p.wish?.today ?? "—"} · 리뷰 {p.review?.today ?? "—"}</div>}
          </div>; })}
      </div>
    </Card>
  );
}

// 제품별 진행 중 카드(42·15): 달력(공구·행사·PPL·광고) + 재고를 제품 기준으로 묶음
export function ProductNowCard({ C, Card, sch, onOpen }) {
  const [stock, setStock] = useState({});
  useEffect(() => { fetch("/api/event-perf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stock: PRODUCTS.map((p) => ({ id: p.label, product: p.like })) }) }).then((r) => r.json()).then((j) => setStock(j.results || {})).catch(() => {}); }, []);
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const RX = { "플렌티플렛4L": /플렌티\s*플렛/, "프리온": /프리온/, "포그밍 코듀": /코듀/, "포그밍 와플": /와플/, "듀얼미스트": /듀얼미스트/, "에어리소닉": /에어리소닉/, "소닉플로우": /소닉\s*플로우/, "히트스팟": /히트스팟/, "타프실링팬": /타프/, "퀵롤차저": /퀵롤/, "듀얼포켓건": /듀얼포켓/ };
  const items = (sch || []).filter((s) => s.date && s.status !== "완료" && (s.endDate || s.date) >= today);
  const groups = Object.entries(RX).map(([label, rx]) => { const mine = items.filter((s) => rx.test(s.title || "")).sort((a, b) => a.date.localeCompare(b.date)); const live = mine.filter((s) => s.date <= today); const sk = stock[label]; return { label, mine, live, sk }; }).filter((g) => g.mine.length || (g.sk && g.sk.daysLeft != null && g.sk.daysLeft < 21));
  if (!groups.length) return null;
  const overlap = (g) => { const by = {}; g.mine.filter((s) => ["공구", "행사"].includes(s.type)).forEach((s) => { for (let d = new Date(s.date + "T00:00:00"); d <= new Date((s.endDate || s.date) + "T00:00:00"); d.setDate(d.getDate() + 1)) { const k = d.toISOString().slice(0, 10); (by[k] = by[k] || []).push(s.title); } }); return Object.entries(by).filter(([, v]) => v.length > 1).map(([k]) => k); };
  return (
    <Card style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>제품별 진행 중</div><span style={{ fontSize: 12, color: C.inkLt }}>달력의 공구·행사·PPL·광고를 제품으로 묶음 · 재고는 전산 발송가능재고 ÷ 최근 14일 하루 판매 · 겹침·재고 부족은 빨간 표시</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 8, marginTop: 10 }}>
        {groups.map((g) => { const ov = overlap(g); return (
          <div key={g.label} onClick={onOpen} style={{ border: `1px solid ${ov.length ? "#dc2626" : C.border}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}><span style={{ fontSize: 14, fontWeight: 900, color: C.ink }}>{g.label}</span><span style={{ fontSize: 11, color: C.inkLt }}>{g.live.length ? `진행 ${g.live.length} · ` : ""}예정 {g.mine.length - g.live.length}</span></div>
            {g.sk && !g.sk.error && (() => { const next = g.mine.find((s) => s.date > today && ["공구", "행사"].includes(s.type)); const nextIn = next ? Math.round((new Date(next.date) - new Date(today)) / 864e5) : null; const short = g.sk.daysLeft != null && (g.sk.daysLeft < 14 || (nextIn != null && g.sk.daysLeft < nextIn + 7));
              return <div style={{ fontSize: 11, color: short ? "#dc2626" : C.inkMid, fontWeight: short ? 800 : 500 }}>재고 {g.sk.stock.toLocaleString()} · 하루 {g.sk.perDay.toFixed(1)}대 → {g.sk.daysLeft != null ? g.sk.daysLeft + "일분" : "판매 없음"}{short ? (next ? ` · ${next.date.slice(5)} ${next.type} 전 발주 필요` : " · 발주 필요") : ""}</div>; })()}
            {ov.length > 0 && <div style={{ fontSize: 11, fontWeight: 800, color: "#dc2626" }}>겹침: {ov.map((d) => d.slice(5)).join(", ")} 가격 확인</div>}
            {g.mine.slice(0, 4).map((s, i) => <div key={i} style={{ fontSize: 12, color: C.inkMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><span style={{ fontSize: 10, fontWeight: 800, color: s.date <= today ? C.rose : C.inkLt }}>{s.date <= today ? "진행" : s.date.slice(5).replace("-", "/")}</span> {s.type} · {s.title.replace(/^\[[^\]]*\]\s*/, "")}</div>)}
          </div>); })}
      </div>
    </Card>
  );
}

// 제품별 손익 카드(1): 이번 달 매출이익(전 채널) − 광고비(메타·네이버·GFA, 아침 판정 스크립트가 집계) − PPL(이번 달 업로드 확정액)
export function ProfitCard({ C, Card }) {
  const ym = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7);
  const P = [{ label: "플렌티플렛4L", like: "오아플렌티플렛4L" }, { label: "프리온", like: "오아프리온무선고데기-%" }];
  const [sales, setSales] = useState({}); const [spend, setSpend] = useState(null); const [ppl, setPpl] = useState({});
  useEffect(() => {
    fetch("/api/event-perf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profit: P.map((p) => ({ id: p.label, product: p.like, ym })) }) }).then((r) => r.json()).then((j) => setSales(j.results || {})).catch(() => {});
    getSetting("oa_ad_spend_v1").then(setSpend).catch(() => {});
    Promise.all([fetch("/api/ppl-leads").then((r) => r.json()).catch(() => ({})), getSetting("oa_ppl_stage_v1").catch(() => ({}))]).then(([j, st]) => { const by = {}; (j.rows || []).forEach((r) => { if (!r.confirmed) return; const up = (st || {})[r.id]?.uploadDate || ""; if (up.startsWith(ym)) by["프리온"] = (by["프리온"] || 0) + Number(r.deal_amount || 0) * 10000; }); setPpl(by); });
  }, []);
  const dom = new Date(Date.now() + 9 * 3600e3).getUTCDate();
  return (
    <Card style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>{+ym.slice(5, 7)}월 제품 손익</div><span style={{ fontSize: 12, color: C.inkLt }}>1~{dom}일 · 매출이익(전 채널, 전산) − 광고비 − PPL(이번 달 업로드분) {spend?.at ? `· 광고비 ${spend.at.slice(5, 16).replace("T", " ")} 집계` : "· 광고비 집계 대기(매일 9시)"}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 10, marginTop: 10 }}>
        {P.map((p) => { const s = sales[p.label]; const ad = spend?.by?.[p.label] || { meta: 0, naver: 0, gfa: 0 }; const adSum = ad.meta + ad.naver + ad.gfa; const pp = ppl[p.label] || 0; const net = s && !s.error ? s.gp - adSum - pp : null; const lyDiff = s && s.lyGp ? (s.gp / s.lyGp - 1) * 100 : null;
          return <div key={p.label} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><b style={{ fontSize: 14 }}>{p.label}</b>{s && !s.error && <span style={{ fontSize: 12, color: C.inkLt }}>{s.q.toLocaleString()}대 · 매출 {won(s.rev)}</span>}</div>
            {!s && <div style={{ fontSize: 12, color: C.inkLt }}>집계 중...</div>}
            {s && s.error && <div style={{ fontSize: 12, color: C.bad }}>전산 연결 실패 · 새로고침</div>}
            {s && !s.error && <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}><span style={{ fontSize: 26, fontWeight: 900, color: net >= 0 ? "#16a34a" : "#dc2626" }}>{(net >= 0 ? "+" : "-") + won(Math.abs(net)) + "원"}</span><span style={{ fontSize: 12, color: C.inkLt }}>남은 돈</span></div>
              <div style={{ fontSize: 12, color: C.inkMid, lineHeight: 1.7 }}>
                <div>매출이익 <b>{won(s.gp)}</b>{lyDiff != null && <span style={{ color: lyDiff >= 0 ? "#16a34a" : "#dc2626" }}>{" (" + (lyDiff >= 0 ? "+" : "") + Math.round(lyDiff) + "% vs 작년)"}</span>}</div>
                <div>광고비 <b>{won(adSum)}</b> <span style={{ color: C.inkLt }}>{"(메타 " + won(ad.meta) + " · 네이버 " + won(ad.naver) + " · GFA " + won(ad.gfa) + ")"}</span></div>
                {pp > 0 && <div>PPL <b>{won(pp)}</b></div>}
                <div>광고비 ÷ 매출이익 <b>{(s.gp ? Math.round(adSum / s.gp * 100) : 0) + "%"}</b></div>
              </div>
            </div>}
          </div>; })}
      </div>
    </Card>
  );
}

// 검색 유입 카드(4): 스마트스토어 검색어 유입(캠핑 등) 주간 자동 수집 결과 oa_ss_query_v1
export function SearchInflowCard({ C, Card }) {
  const [d, setD] = useState(null);
  useEffect(() => { getSetting("oa_ss_query_v1").then(setD).catch(() => {}); }, []);
  if (!d?.groups) return null;
  const pct = (a, b) => b ? Math.round((a / b - 1) * 100) : null;
  return (
    <Card style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>스마트스토어 검색 유입</div><span style={{ fontSize: 12, color: C.inkLt }}>{d.range} · 작년 같은 기간 대비 · 매주 월요일 자동</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8, marginTop: 10 }}>
        {d.groups.map((g) => { const dp = pct(g.pay, g.lyPay), dv = pct(g.visit, g.lyVisit); const f = (x) => x == null ? "" : " (" + (x >= 0 ? "+" : "") + x + "%)"; const conv = g.visit ? (g.pay / g.visit * 100).toFixed(1) : "0";
          return <div key={g.label} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 10px" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{g.label}</div>
            <div style={{ fontSize: 12, color: C.inkMid }}>{"구매 "}<b>{g.pay}</b>{"건"}<span style={{ color: dp == null ? C.inkLt : dp >= 0 ? "#16a34a" : "#dc2626" }}>{f(dp)}</span>{" · 방문 " + g.visit.toLocaleString()}<span style={{ color: C.inkLt }}>{f(dv)}</span></div>
            <div style={{ fontSize: 11, color: C.inkLt }}>{"전환율 " + conv + "% · 매출 " + won(g.sales)}</div>
          </div>; })}
      </div>
    </Card>
  );
}
