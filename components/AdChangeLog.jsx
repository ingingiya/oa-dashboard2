'use client'
// 광고 변경 기록(10): 누가 언제 무엇을 켜고 끄고 예산을 바꿨는지. 메타 원클릭 on/off는 서버에서 자동 기록
import { useState } from "react";
import useShared, { MEMBERS, me } from "./useShared";
const CH = ["메타", "네이버 검색", "GFA", "X", "기타"];
const ACT = ["켬", "끔", "예산 변경", "입찰 변경", "소재 교체", "신규 생성", "기타"];
export default function AdChangeLog({ C, Card }) {
  const [log, setLog] = useShared("oa_ad_changes_v1", []);
  const [f, setF] = useState({ channel: CH[0], target: "", action: ACT[0], detail: "", reason: "", by: me() });
  const add = () => { if (!f.target) return; setLog((p) => [{ id: "c" + Date.now(), ...f, at: new Date().toISOString() }, ...(p || [])].slice(0, 500)); setF({ ...f, target: "", detail: "", reason: "" }); };
  const td = { fontSize: 13, color: C.ink, padding: "8px 10px", borderBottom: `1px solid ${C.border}`, verticalAlign: "top" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 8 }}>변경 기록 남기기 <span style={{ fontSize: 12, fontWeight: 500, color: C.inkLt }}>· 메타 원클릭 on/off는 자동으로 남아요</span></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          {[["channel", "채널", CH], ["action", "변경", ACT]].map(([k, l, o]) => <label key={k} style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, display: "flex", flexDirection: "column", gap: 3 }}>{l}<select value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} style={{ fontSize: 13, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 8 }}>{o.map((x) => <option key={x}>{x}</option>)}</select></label>)}
          <label style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, display: "flex", flexDirection: "column", gap: 3 }}>대상(캠페인·그룹·소재)<input value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="가습기_플렌티플렛_캠핑" style={{ width: 200, fontSize: 13, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 8 }} /></label>
          <label style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, display: "flex", flexDirection: "column", gap: 3 }}>내용<input value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} placeholder="일 3만 → 5만" style={{ width: 150, fontSize: 13, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 8 }} /></label>
          <label style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 180 }}>이유<input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="ROAS 45%로 손익분기 밑" style={{ fontSize: 13, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 8 }} /></label>
          <label style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, display: "flex", flexDirection: "column", gap: 3 }}>누가<select value={f.by} onChange={(e) => setF({ ...f, by: e.target.value })} style={{ fontSize: 13, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 8 }}><option value="">—</option>{MEMBERS.map((m) => <option key={m}>{m}</option>)}<option>자동</option></select></label>
          <button onClick={add} style={{ fontSize: 13, fontWeight: 800, padding: "7px 16px", borderRadius: 10, border: 0, background: C.ink, color: C.white, cursor: "pointer" }}>기록</button>
        </div>
      </Card>
      <Card style={{ padding: 0, overflow: "hidden" }}><div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%", minWidth: 760 }}>
        <thead><tr>{["일시", "채널", "대상", "변경", "내용", "이유", "누가"].map((h) => <th key={h} style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, textAlign: "left", padding: "6px 10px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", background: C.cream }}>{h}</th>)}</tr></thead>
        <tbody>{(log || []).length === 0 && <tr><td colSpan={7} style={{ ...td, color: C.inkLt }}>아직 기록 없음</td></tr>}{(log || []).map((x) => <tr key={x.id}><td style={{ ...td, whiteSpace: "nowrap", color: C.inkMid }}>{x.at?.slice(5, 16).replace("T", " ")}</td><td style={{ ...td, whiteSpace: "nowrap" }}>{x.channel}</td><td style={{ ...td, fontWeight: 700 }}>{x.target}</td><td style={{ ...td, whiteSpace: "nowrap" }}><span style={{ fontSize: 11, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: x.action === "끔" ? "#fef2f2" : x.action === "켬" ? "#f0fdf4" : C.cream, color: x.action === "끔" ? "#dc2626" : x.action === "켬" ? "#16a34a" : C.inkMid }}>{x.action}</span></td><td style={td}>{x.detail}</td><td style={{ ...td, color: C.inkMid }}>{x.reason}</td><td style={{ ...td, whiteSpace: "nowrap" }}>{x.by}</td></tr>)}</tbody>
      </table></div></Card>
    </div>
  );
}
