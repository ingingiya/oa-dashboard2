'use client'
// 공구 채널 성적표(5): 최근 1년 공구 일정의 [성과] 메모를 진행자(채널)별로 합산. 메모 없는 종료 건은 성과 API로 보충
import { useEffect, useMemo, useState } from "react";
import { PRODUCTS, won } from "./useShared";
export default function GongguScoreboard({ C, Card }) {
  const [items, setItems] = useState(null); const [perf, setPerf] = useState({});
  useEffect(() => { const from = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10); fetch(`/api/notion?from=${from}&completed=true`).then((r) => r.json()).then((j) => setItems((j.items || []).filter((s) => s.type === "공구" && !/^\[공구 D|^\[공구 오픈|^★원복/.test(s.title || "")))).catch(() => setItems([])); }, []);
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const rows = useMemo(() => (items || []).map((s) => { const m = (s.memo || "").match(/\[성과\]\s*([\d,]+)대 · ([\d.,]+)(억|만)원/); const q = m ? +m[1].replace(/,/g, "") : null; const amt = m ? (+m[2].replace(/,/g, "")) * (m[3] === "억" ? 1e8 : 1e4) : null; const ch = (s.title || "").replace(/^\[공구\]\s*/, "").split("·").map((x) => x.trim()); const prod = PRODUCTS.find((p) => (s.title || "").replace(/\s/g, "").includes(p.label.replace(/\s/g, "").replace("4L", ""))); return { ...s, q, amt, channel: ch[1] || ch[0], prodLabel: ch[0], like: prod?.like, ended: (s.endDate || s.date) < today }; }), [items]);
  const needKey = rows.filter((r) => r.ended && r.q == null && r.like).map((r) => r.id).join("|");
  useEffect(() => { const need = rows.filter((r) => r.ended && r.q == null && r.like).slice(0, 20); if (!need.length) return; fetch("/api/event-perf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: need.map((r) => ({ id: r.id, product: r.like, start: r.date, end: r.endDate || r.date })) }) }).then((r) => r.json()).then((j) => setPerf(j.results || {})).catch(() => {}); }, [needKey]);
  const done = rows.filter((r) => r.ended).map((r) => { const p = perf[r.id]; return { ...r, q: r.q ?? (p && !p.error ? p.q : null), amt: r.amt ?? (p && !p.error ? p.amt : null) }; }).filter((r) => r.q != null);
  const by = {}; done.forEach((r) => { const k = r.channel; by[k] = by[k] || { n: 0, q: 0, amt: 0, last: "", prods: new Set() }; by[k].n++; by[k].q += r.q; by[k].amt += r.amt || 0; if (r.date > by[k].last) by[k].last = r.date; by[k].prods.add(r.prodLabel); });
  const list = Object.entries(by).sort((a, b) => b[1].q / b[1].n - a[1].q / a[1].n);
  if (!items) return null;
  return (
    <Card style={{ padding: "12px 16px" }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>공구 채널 성적표 <span style={{ fontSize: 12, fontWeight: 500, color: C.inkLt }}>· 최근 1년 종료 공구 {done.length}건 · 1건당 평균 판매 순 · 스마트스토어+자사몰 기준</span></div>
      {!list.length ? <div style={{ fontSize: 13, color: C.inkLt, marginTop: 6 }}>아직 성과가 기록된 공구가 없어요. 공구가 끝나면 자동으로 쌓여요.</div> :
        <div style={{ overflowX: "auto", marginTop: 8 }}><table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
          <thead><tr>{["채널", "공구 수", "1건당 평균", "누적 판매", "누적 금액", "제품", "마지막", "추천"].map((h) => <th key={h} style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, textAlign: "left", padding: "4px 8px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
          <tbody>{list.map(([k, v], i) => { const avg = v.q / v.n; const top = i === 0 || avg >= 150; return <tr key={k}><td style={{ padding: "7px 8px", borderBottom: `1px solid ${C.border}`, fontWeight: 800, fontSize: 13 }}>{k}</td><td style={{ padding: "7px 8px", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>{v.n}</td><td style={{ padding: "7px 8px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 800, color: top ? "#16a34a" : C.ink }}>{Math.round(avg).toLocaleString()}대</td><td style={{ padding: "7px 8px", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>{v.q.toLocaleString()}대</td><td style={{ padding: "7px 8px", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>{won(v.amt)}원</td><td style={{ padding: "7px 8px", borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.inkMid }}>{[...v.prods].join(", ")}</td><td style={{ padding: "7px 8px", borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.inkLt }}>{v.last.slice(5)}</td><td style={{ padding: "7px 8px", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>{avg >= 150 ? <span style={{ fontWeight: 800, color: "#16a34a" }}>재공구 추천</span> : avg < 60 ? <span style={{ color: C.inkLt }}>조건 재협의</span> : "유지"}</td></tr>; })}</tbody>
        </table></div>}
    </Card>
  );
}
