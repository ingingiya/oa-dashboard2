"use client";
// 📊 광고 단가 대시보드 — 매체별 CPC/CPM/ROAS를 매일 갱신해 보는 이사님 열람용 페이지
// 데이터: /api/adcost (settings.oa_ad_cost_map_v1, scripts/ad-cost-map-sync.py 가 매일 09:40 푸시)
import { useEffect, useMemo, useState } from "react";

const C = { ground: "#FAF9F6", paper: "#FFFFFF", ink: "#1C1B19", muted: "#6D6862", line: "#E4E0D8", soft: "#F1EEE7",
  accent: "#F26A1B", accentInk: "#B84A08", good: "#1F6F5C", goodSoft: "#DFF0EA", warn: "#C9A227", bad: "#B84A08", badSoft: "#FDEBDD" };
const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
const fmt = (n, d = 0) => (n == null || !isFinite(n) ? "-" : Number(n).toLocaleString("ko-KR", { maximumFractionDigits: d }));
const pct = (a, b) => (a && b ? Math.round(((a - b) / b) * 100) : null);
const LABEL = { meta: "메타", adboost: "네이버 AD부스터", gfa: "네이버 GFA", esm: "지마켓·옥션", ably: "에이블리", x: "X (트위터)", zigzag: "지그재그" };
const PICKS = [["에이블리", "ably", "에이블리"], ["메타 트래픽", "meta", "트래픽"], ["X (트위터)", "x", "X 트래픽"], ["지그재그", "zigzag", "지그재그"], ["메타 전환", "meta", "전환"],
  ["네이버 디스플레이 전환", "adboost", "웹사이트 전환"], ["네이버 파워링크", "adboost", "파워링크"], ["네이버 쇼핑검색", "adboost", "쇼핑검색"],
  ["GFA", "gfa", "GFA"], ["G마켓 광고센터", "esm", "k2ci00"], ["파워클릭 (G+A)", "esm", "파워클릭"], ["네이버 AD부스터 쇼핑", "adboost", "ADVoost"]];

function pickRows(summary) {
  const rows = [];
  for (const [label, ch, key] of PICKS) {
    const goals = summary?.[ch]?.by_goal || {};
    for (const [g, a] of Object.entries(goals)) if (g.includes(key) && a.spend >= 100000 && a.cpc) { rows.push({ label, ch, goal: g, ...a }); break; }
  }
  return rows.sort((a, b) => a.cpc - b.cpc);
}
const roasColor = (r) => (r == null ? C.accent : r >= 8 ? C.good : r >= 3 ? C.warn : C.bad);

function Card({ label, value, sub, tone }) {
  const col = tone === "good" ? C.good : tone === "bad" ? C.bad : C.ink;
  return (<div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 8, padding: "16px 18px" }}>
    <div style={{ fontSize: 12, color: C.muted, letterSpacing: ".04em", marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 700, fontFamily: MONO, color: col, letterSpacing: "-0.02em" }}>{value}</div>
    <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>{sub}</div>
  </div>);
}
function Bar({ label, cpc, roas, max, delta }) {
  return (<div style={{ display: "grid", gridTemplateColumns: "190px 1fr 64px 72px 64px", alignItems: "center", gap: 12, margin: "6px 0", fontSize: 14 }}>
    <span>{label}</span>
    <div style={{ height: 18, background: C.soft, borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.max(6, (cpc / max) * 100)}%`, background: roasColor(roas), borderRadius: 3 }} /></div>
    <span style={{ fontFamily: MONO, textAlign: "right" }}>{fmt(cpc)}</span>
    <span style={{ fontFamily: MONO, textAlign: "right", fontSize: 13, color: C.muted }}>{roas ? `${roas.toFixed(1)}배` : "측정불가"}</span>
    <span style={{ fontFamily: MONO, textAlign: "right", fontSize: 12, color: delta == null ? C.muted : delta > 0 ? C.bad : C.good }}>{delta == null ? "" : `${delta > 0 ? "+" : ""}${delta}%`}</span>
  </div>);
}
// 일별 CPC 선 그래프 (SVG)
function Trend({ daily, days = 30 }) {
  const series = useMemo(() => {
    const out = [];
    for (const [name, dd] of Object.entries(daily || {})) {
      const pts = Object.entries(dd).sort().slice(-days).map(([d, v]) => ({ d, cpc: v.cpc, spend: v.spend })).filter((p) => p.cpc);
      if (pts.length >= 3) out.push({ name, pts });
    }
    return out;
  }, [daily, days]);
  if (!series.length) return null;
  const W = 900, H = 260, L = 44, R = 12, T = 14, B = 28;
  const all = series.flatMap((s) => s.pts.map((p) => p.cpc)); const ymax = Math.max(...all) * 1.1;
  const dates = [...new Set(series.flatMap((s) => s.pts.map((p) => p.d)))].sort();
  const x = (d) => L + (dates.indexOf(d) / Math.max(1, dates.length - 1)) * (W - L - R); const y = (v) => T + (1 - v / ymax) * (H - T - B);
  const colors = { "메타 트래픽": C.accent, "메타 전환": "#8A5A2B", "X 트래픽": "#3B6EA5", "에이블리": C.good, "지그재그": "#6B5B95" };
  return (<div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 8, padding: "16px 18px 8px", marginTop: 14 }}>
    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>일별 클릭 단가 추이 (최근 {dates.length}일)</div>
    <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8 }}>매체별 하루 광고비 ÷ 클릭. 선이 내려갈수록 같은 돈으로 더 많은 클릭을 산 날입니다.</div>
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 600, display: "block" }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (<g key={f}><line x1={L} x2={W - R} y1={y(ymax * f)} y2={y(ymax * f)} stroke={C.line} strokeWidth="1" /><text x={L - 6} y={y(ymax * f) + 4} fontSize="10" fill={C.muted} textAnchor="end" fontFamily={MONO}>{fmt(ymax * f)}</text></g>))}
        {dates.filter((_, i) => i % Math.ceil(dates.length / 8) === 0).map((d) => (<text key={d} x={x(d)} y={H - 8} fontSize="10" fill={C.muted} textAnchor="middle" fontFamily={MONO}>{d.slice(5)}</text>))}
        {series.map((s) => (<g key={s.name}>
          <polyline fill="none" stroke={colors[s.name] || C.ink} strokeWidth="2" points={s.pts.map((p) => `${x(p.d)},${y(p.cpc)}`).join(" ")} />
          <circle cx={x(s.pts[s.pts.length - 1].d)} cy={y(s.pts[s.pts.length - 1].cpc)} r="3.5" fill={colors[s.name] || C.ink} />
          <text x={x(s.pts[s.pts.length - 1].d) - 6} y={y(s.pts[s.pts.length - 1].cpc) - 8} fontSize="11" fontFamily={MONO} fill={colors[s.name] || C.ink} textAnchor="end">{s.name} {fmt(s.pts[s.pts.length - 1].cpc)}</text>
        </g>))}
      </svg>
    </div>
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: C.muted, marginTop: 6 }}>{series.map((s) => (<span key={s.name}><i style={{ display: "inline-block", width: 10, height: 10, background: colors[s.name] || C.ink, borderRadius: 2, marginRight: 5, verticalAlign: -1 }} />{s.name}</span>))}</div>
  </div>);
}
function DailyTable({ daily }) {
  const names = Object.keys(daily || {}); if (!names.length) return null;
  const dates = [...new Set(names.flatMap((n) => Object.keys(daily[n])))].sort().slice(-7);
  return (<Sec title="최근 7일 일별 CPC (원)" tot={`${dates[0]} ~ ${dates[dates.length - 1]}`}>
    <table style={tbl}><thead><tr><th style={th}>매체</th>{dates.map((d) => <th key={d} style={{ ...th, textAlign: "right" }}>{d.slice(5)}</th>)}</tr></thead>
      <tbody>{names.map((n) => (<tr key={n}><td style={{ ...td, fontWeight: 600 }}>{n}</td>{dates.map((d, i) => { const v = daily[n][d]; const prev = daily[n][dates[i - 1]]; const dl = v && prev ? pct(v.cpc, prev.cpc) : null;
        return <td key={d} style={{ ...td, textAlign: "right", fontFamily: MONO }}>{v?.cpc ? fmt(v.cpc) : "-"}{dl != null && Math.abs(dl) >= 15 ? <span style={{ fontSize: 10, color: dl > 0 ? C.bad : C.good, marginLeft: 3 }}>{dl > 0 ? "▲" : "▼"}</span> : null}</td>; })}</tr>))}</tbody></table>
  </Sec>);
}
const tbl = { borderCollapse: "collapse", width: "100%", minWidth: 640, fontSize: 14 };
const th = { fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: ".04em", background: C.soft, padding: "10px 14px", textAlign: "left", borderBottom: `1px solid ${C.line}` };
const td = { padding: "10px 14px", borderBottom: `1px solid ${C.line}`, verticalAlign: "top" };
const num = { ...td, textAlign: "right", fontFamily: MONO, whiteSpace: "nowrap" };
function Sec({ title, tot, children }) {
  return (<div style={{ marginTop: 22, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
    <div style={{ background: C.ink, color: "#fff", padding: "10px 16px", fontSize: 13.5, fontWeight: 600, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><span>{title}</span><span style={{ fontFamily: MONO, fontWeight: 500, color: "#F4B27A", fontSize: 12.5 }}>{tot}</span></div>
    <div style={{ overflowX: "auto" }}>{children}</div>
  </div>);
}

export default function AdCost() {
  const [d, setD] = useState(null); const [err, setErr] = useState(null); const [tab, setTab] = useState("summary");
  useEffect(() => { fetch("/api/adcost").then((r) => r.json()).then((j) => (j.error ? setErr(j.error) : setD(j))).catch((e) => setErr(String(e))); }, []);
  const summary = d?.latest?.summary; const rows = useMemo(() => pickRows(summary), [summary]);
  const prev = d?.snapshots?.length > 1 ? d.snapshots[d.snapshots.length - 2] : null;
  const maxCpc = rows.length ? Math.max(...rows.map((r) => r.cpc)) : 1;
  const tot = useMemo(() => { let s = 0, c = 0; for (const ch of Object.values(summary || {})) for (const a of Object.values(ch.by_goal || {})) { s += a.spend; c += a.clicks; } return { s, c }; }, [summary]);
  const cheapest = rows[0], best = rows.filter((r) => r.roas).sort((a, b) => b.roas - a.roas)[0], worst = rows.filter((r) => r.roas).sort((a, b) => a.roas - b.roas)[0];
  if (err) return <div style={{ padding: 40, fontFamily: "sans-serif" }}>데이터를 불러오지 못했습니다: {err}</div>;
  if (!d) return <div style={{ padding: 40, color: C.muted, fontFamily: "sans-serif" }}>불러오는 중…</div>;
  return (<div style={{ background: C.ground, color: C.ink, minHeight: "100vh", fontFamily: '"IBM Plex Sans KR","Pretendard","Apple SD Gothic Neo",sans-serif', fontSize: 15, lineHeight: 1.6 }}>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" />
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 24px 80px" }}>
      <div style={{ background: C.ink, color: "#fff", borderRadius: 8, padding: "24px 28px", display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "end" }}>
        <div><h1 style={{ fontSize: 26, margin: "0 0 6px", fontWeight: 700 }}>매체별 광고 단가 대시보드</h1><p style={{ margin: 0, color: "#CFCAC2", maxWidth: 620 }}>클릭 하나를 어디서 얼마에 사고, 그 돈이 얼마로 돌아오는지. 오아 광고 계정 실측이 매일 아침 갱신됩니다.</p></div>
        <div style={{ color: "#CFCAC2", textAlign: "right", fontSize: 12, lineHeight: 1.8, fontFamily: MONO }}><b style={{ color: "#fff" }}>OA 뷰티 · 부스터즈팀</b><br />갱신 {d.updated} 09:40<br />ROAS = 매출 ÷ 광고비 · 부가세 별도</div>
      </div>
      <div style={{ display: "flex", gap: 8, margin: "18px 0 6px", flexWrap: "wrap" }}>{[["summary", "요약"], ["trend", "일별 추이"], ["channels", "매체별"], ["category", "카테고리별"], ["retail", "리테일 단가표"]].map(([k, l]) => (
        <button key={k} onClick={() => setTab(k)} style={{ padding: "8px 14px", borderRadius: 6, border: `1px solid ${tab === k ? C.ink : C.line}`, background: tab === k ? C.ink : C.paper, color: tab === k ? "#fff" : C.ink, cursor: "pointer", fontSize: 13.5, fontWeight: 600 }}>{l}</button>))}</div>

      {tab === "summary" && (<>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginTop: 14 }}>
          <Card label="집계 광고비 (표본 기간 합)" value={`${fmt(tot.s / 1e4)}만`} sub={`클릭 ${fmt(tot.c)}회 · 평균 CPC ${fmt(tot.c ? tot.s / tot.c : 0)}원`} />
          {cheapest && <Card tone="good" label="가장 싼 클릭" value={`${fmt(cheapest.cpc)}원`} sub={`${cheapest.label} · ROAS ${cheapest.roas ?? "-"}배`} />}
          {best && <Card tone="good" label="가장 잘 버는 매체" value={`${best.roas.toFixed(1)}배`} sub={`${best.label} · CPC ${fmt(best.cpc)}원`} />}
          {worst && <Card tone="bad" label="손해 구간" value={`${worst.roas.toFixed(1)}배`} sub={`${worst.label} · CPC ${fmt(worst.cpc)}원`} />}
        </div>
        <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 8, padding: "18px 20px 10px", marginTop: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>클릭 단가 순위 (낮을수록 좋음)</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12 }}>막대 색 = ROAS. 초록 8배↑ · 노랑 3~8배 · 갈색 3배↓ · 주황 측정불가. 오른쪽 %는 직전 갱신 대비 CPC 변화(빨강=비싸짐).</div>
          <div style={{ display: "grid", gridTemplateColumns: "190px 1fr 64px 72px 64px", gap: 12, fontSize: 11, color: C.muted, letterSpacing: ".04em", marginBottom: 4 }}><span>매체</span><span /><span style={{ textAlign: "right" }}>CPC</span><span style={{ textAlign: "right" }}>ROAS</span><span style={{ textAlign: "right" }}>변화</span></div>
          {rows.map((r) => <Bar key={r.label} label={r.label} cpc={r.cpc} roas={r.roas} max={maxCpc} delta={prev ? pct(r.cpc, prev.summary?.[r.ch]?.[r.goal]?.cpc) : null} />)}
        </div>
        {d.actions?.length ? (<><div style={{ fontSize: 15, fontWeight: 600, margin: "26px 0 4px" }}>이번 달 결론</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginTop: 8 }}>{d.actions.map((a, i) => (
            <div key={i} style={{ background: C.paper, border: `1px solid ${C.line}`, borderLeft: `4px solid ${a.tone === "good" ? C.good : a.tone === "bad" ? C.bad : C.accent}`, borderRadius: 6, padding: "14px 16px" }}><b style={{ display: "block", fontSize: 15, marginBottom: 4 }}>{i + 1}. {a.title}</b><span style={{ fontSize: 13.5, color: C.muted }}>{a.body}</span></div>))}</div></>) : null}
        <p style={{ fontSize: 12.5, color: C.muted, marginTop: 12 }}>메타 ROAS는 픽셀 구매 추적값(전환 캠페인만)이라 실제보다 낮게 잡힙니다. 트래픽 캠페인은 외부 랜딩이라 구매가 잡히지 않습니다. 지마켓 k2ci00·네이버 AD부스터·파워클릭은 7일 표본, 나머지는 30일 표본입니다.</p>
      </>)}

      {tab === "trend" && (<><Trend daily={d.latest?.daily} /><DailyTable daily={d.latest?.daily} /></>)}

      {tab === "channels" && Object.entries(summary || {}).map(([ch, v]) => (
        <Sec key={ch} title={`${LABEL[ch] || ch} · ${d.latest.channels?.[ch]?.period || ""}`} tot={`지출 ${fmt(Object.values(v.by_goal).reduce((s, a) => s + a.spend, 0))}원`}>
          <table style={tbl}><thead><tr><th style={th}>목표</th><th style={{ ...th, textAlign: "right" }}>지출</th><th style={{ ...th, textAlign: "right" }}>클릭</th><th style={{ ...th, textAlign: "right" }}>CPC</th><th style={{ ...th, textAlign: "right" }}>CPM</th><th style={{ ...th, textAlign: "right" }}>전환</th><th style={{ ...th, textAlign: "right" }}>ROAS</th></tr></thead>
            <tbody>{Object.entries(v.by_goal).sort((a, b) => b[1].spend - a[1].spend).filter(([, a]) => a.spend >= 50000).map(([g, a]) => (<tr key={g}><td style={{ ...td, fontWeight: 600 }}>{g}</td><td style={num}>{fmt(a.spend)}</td><td style={num}>{fmt(a.clicks)}</td><td style={{ ...num, color: C.accentInk, fontWeight: 600 }}>{fmt(a.cpc)}</td><td style={num}>{fmt(a.cpm)}</td><td style={num}>{fmt(a.conv)}</td><td style={num}>{a.roas ?? "-"}</td></tr>))}</tbody></table>
        </Sec>))}

      {tab === "category" && Object.entries(summary || {}).filter(([, v]) => Object.keys(v.by_cat || {}).length).map(([ch, v]) => (
        <Sec key={ch} title={`${LABEL[ch] || ch} · 카테고리별`} tot={d.latest.channels?.[ch]?.period || ""}>
          <table style={tbl}><thead><tr><th style={th}>카테고리</th><th style={th}>목표</th><th style={{ ...th, textAlign: "right" }}>지출</th><th style={{ ...th, textAlign: "right" }}>클릭</th><th style={{ ...th, textAlign: "right" }}>CPC</th><th style={{ ...th, textAlign: "right" }}>ROAS</th></tr></thead>
            <tbody>{Object.entries(v.by_cat).sort((a, b) => b[1].spend - a[1].spend).filter(([, a]) => a.spend >= 50000).map(([k, a]) => { const [cat, goal] = k.split(" | "); return (<tr key={k}><td style={{ ...td, fontWeight: 600 }}>{cat}</td><td style={td}>{goal}</td><td style={num}>{fmt(a.spend)}</td><td style={num}>{fmt(a.clicks)}</td><td style={{ ...num, color: C.accentInk, fontWeight: 600 }}>{fmt(a.cpc)}</td><td style={num}>{a.roas ?? "-"}</td></tr>); })}</tbody></table>
        </Sec>))}

      {tab === "retail" && (<Sec title="리테일 미디어 · 플랫폼별 광고 상품 단가" tot="각 광고센터·상품소개서·대행 판매가 기준">
        <table style={tbl}><thead><tr><th style={th}>플랫폼</th><th style={th}>상품</th><th style={th}>과금</th><th style={th}>단가 / 최소</th><th style={th}>비고</th><th style={th}>우리 실측</th></tr></thead>
          <tbody>{(d.retail || []).map((r, i) => (<tr key={i}><td style={{ ...td, fontWeight: 600 }}>{r.platform}</td><td style={td}>{r.product}</td><td style={td}>{r.billing}</td><td style={{ ...td, fontFamily: MONO, fontSize: 13 }}>{r.price}</td><td style={{ ...td, color: C.muted, fontSize: 13 }}>{r.note}</td><td style={{ ...td, color: C.muted, fontSize: 13 }}>{r.ours}</td></tr>))}</tbody></table>
      </Sec>)}

      <div style={{ marginTop: 40, paddingTop: 14, borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.muted, fontFamily: MONO }}>OA 뷰티 · 부스터즈팀 내부 자료 · 매일 09:40 자동 수집(메타 API · 네이버 광고주센터 · GFA · ESM · 에이블리 · X) · 벤치마크 문서는 광고단가지도.html</div>
    </div>
  </div>);
}
