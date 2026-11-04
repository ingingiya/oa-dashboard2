'use client'
// 해외 운영: 국가별 진행판(32) + 환율 반영 판매가 계산기(44)
import { useEffect, useState } from "react";
import useShared, { MEMBERS } from "./useShared";

const STAGES = ["조사", "후보 선정", "채널 개설", "상품 등록", "첫 판매", "운영 중"];
const SEED = { countries: [
  { id: "jp", name: "일본", flag: "🇯🇵", stage: 1, owner: "경은", next: "큐텐 OA official 스토어(상품 50·리뷰 0) 정비 · 1호 후보 베이직 빗고데기(원가 ¥976, 시세 ¥3,950) 등록팩 검토", due: "", notes: ["10/23 보고 덱 16장: 큐텐 직송 조건·보다나 해부·대리점 없는 5가지 길", "10/28 결정: 헤어툴 4 + 마사지 2 잡화 라인"], links: [["보고서", "https://oa-global-report.vercel.app"]] },
  { id: "tw", name: "대만", flag: "🇹🇼", stage: 0, owner: "경은", next: "쇼피 대만 볼륨 3종 확정 · 로그인벽 수집법 정리", due: "", notes: ["10/28 결정: 볼륨 3종 우선"], links: [["보고서", "https://oa-global-report.vercel.app"]] },
] };

export default function GlobalSection({ C, Card }) {
  const [b, setB] = useShared("oa_global_board_v1", SEED);
  const [fx, setFx] = useState(null);
  const [calc, setCalc] = useState({ cost: 25151, ship: 3500, fee: 12, ads: 5, margin: 30, cur: "JPY", rate: "" });
  useEffect(() => { fetch("/api/fx").then((r) => r.json()).then(setFx).catch(() => {}); }, []);
  const patch = (id, p) => setB((prev) => ({ countries: prev.countries.map((c) => c.id === id ? { ...c, ...p } : c) }));
  const rate = +calc.rate || (fx && fx[calc.cur]) || 0; // 외화 1단위 = rate 원
  const krwNeed = (calc.cost + calc.ship) / (1 - (calc.fee + calc.ads + calc.margin) / 100);
  const price = rate ? krwNeed / rate : 0;
  const Inp = ({ k, w = 90, step }) => <input type="number" step={step} value={calc[k]} onChange={(e) => setCalc({ ...calc, [k]: e.target.value === "" ? "" : +e.target.value })} style={{ width: w, fontSize: 13, padding: "5px 8px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.cream }} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ fontSize: 16, fontWeight: 800, color: C.ink }}>해외 진행판</div><span style={{ fontSize: 12, color: C.inkLt }}>국가별 지금 단계 · 다음 결정 · 담당. 바꾸면 팀 전체에 저장돼요.</span>
          <div style={{ flex: 1 }} /><button onClick={() => { const name = prompt("국가 이름"); if (name) setB((p) => ({ countries: [...p.countries, { id: "c" + Date.now(), name, flag: "🌏", stage: 0, owner: "", next: "", due: "", notes: [], links: [] }] })); }} style={{ fontSize: 12, fontWeight: 700, border: `1px solid ${C.border}`, background: C.white, borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>+ 국가</button></div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 12 }}>
        {(b.countries || []).map((c) => (
          <Card key={c.id} style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 22 }}>{c.flag}</span><span style={{ fontSize: 17, fontWeight: 900, color: C.ink }}>{c.name}</span><div style={{ flex: 1 }} />
              <select value={c.owner || ""} onChange={(e) => patch(c.id, { owner: e.target.value })} style={{ fontSize: 12, padding: "3px 6px", border: `1px solid ${C.border}`, borderRadius: 8 }}><option value="">담당 —</option>{MEMBERS.map((m) => <option key={m}>{m}</option>)}</select></div>
            <div style={{ display: "flex", gap: 3, marginTop: 10, flexWrap: "wrap" }}>{STAGES.map((s, i) => <button key={s} onClick={() => patch(c.id, { stage: i })} style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 20, cursor: "pointer", border: `1px solid ${i === c.stage ? C.rose : C.border}`, background: i < c.stage ? "#fecdd3" : i === c.stage ? C.rose : C.white, color: i === c.stage ? "#fff" : C.inkMid }}>{s}</button>)}</div>
            <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: C.inkLt }}>다음 결정 · 할 일</div>
            <textarea defaultValue={c.next} onBlur={(e) => e.target.value !== c.next && patch(c.id, { next: e.target.value })} style={{ width: "100%", boxSizing: "border-box", fontSize: 13, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.cream, minHeight: 64, lineHeight: 1.5, fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}><span style={{ fontSize: 11, color: C.inkLt, fontWeight: 700 }}>기한</span><input type="date" value={c.due || ""} onChange={(e) => patch(c.id, { due: e.target.value })} style={{ fontSize: 12, padding: "3px 6px", border: `1px solid ${C.border}`, borderRadius: 6 }} /></div>
            {(c.notes || []).length > 0 && <ul style={{ margin: "8px 0 0", paddingLeft: 16, fontSize: 12, color: C.inkMid, lineHeight: 1.6 }}>{c.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>{(c.links || []).map(([l, u], i) => <a key={i} href={u} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#2563eb" }}>{l} ↗</a>)}
              <button onClick={() => { const t = prompt("기록 한 줄"); if (t) patch(c.id, { notes: [...(c.notes || []), `${new Date().toISOString().slice(5, 10)} ${t}`] }); }} style={{ fontSize: 11, border: 0, background: "none", color: C.inkLt, cursor: "pointer" }}>+ 기록</button></div>
          </Card>
        ))}
      </div>
      <Card style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>환율 반영 판매가 계산</div>
        <div style={{ fontSize: 12, color: C.inkLt, marginTop: 2 }}>필요 매출 = (원가 + 배송비) ÷ (1 − 수수료 − 광고비 − 목표 마진). 환율 {fx ? `자동 (${fx.at?.slice(5, 16)})` : "불러오는 중"} · 직접 입력하면 그 값 우선</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginTop: 10 }}>
          {[["cost", "원가(원)", 100], ["ship", "해외 배송비(원)", 100], ["fee", "플랫폼 수수료 %", 70], ["ads", "광고비 %", 70], ["margin", "목표 마진 %", 70]].map(([k, l, w]) => <label key={k} style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, display: "flex", flexDirection: "column", gap: 3 }}>{l}<Inp k={k} w={w} /></label>)}
          <label style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, display: "flex", flexDirection: "column", gap: 3 }}>통화<select value={calc.cur} onChange={(e) => setCalc({ ...calc, cur: e.target.value, rate: "" })} style={{ fontSize: 13, padding: "5px 8px", border: `1px solid ${C.border}`, borderRadius: 8 }}>{["JPY", "TWD", "USD", "SGD", "THB"].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, display: "flex", flexDirection: "column", gap: 3 }}>환율 (1 {calc.cur} = 원)<input type="number" step="0.01" placeholder={fx && fx[calc.cur] ? String(fx[calc.cur]) : ""} value={calc.rate} onChange={(e) => setCalc({ ...calc, rate: e.target.value })} style={{ width: 90, fontSize: 13, padding: "5px 8px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.cream }} /></label>
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 14, flexWrap: "wrap" }}>
          <div><div style={{ fontSize: 11, color: C.inkLt, fontWeight: 700 }}>필요 판매가</div><div style={{ fontSize: 28, fontWeight: 900, color: C.ink }}>{price ? price.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"} <span style={{ fontSize: 14 }}>{calc.cur}</span></div><div style={{ fontSize: 12, color: C.inkLt }}>= {Math.round(krwNeed).toLocaleString()}원</div></div>
          <div><div style={{ fontSize: 11, color: C.inkLt, fontWeight: 700 }}>1개 남는 돈</div><div style={{ fontSize: 22, fontWeight: 900, color: "#16a34a" }}>{Math.round(krwNeed * calc.margin / 100).toLocaleString()}원</div></div>
          <div><div style={{ fontSize: 11, color: C.inkLt, fontWeight: 700 }}>수수료+광고</div><div style={{ fontSize: 22, fontWeight: 900, color: C.inkMid }}>{Math.round(krwNeed * (calc.fee + calc.ads) / 100).toLocaleString()}원</div></div>
        </div>
      </Card>
    </div>
  );
}
