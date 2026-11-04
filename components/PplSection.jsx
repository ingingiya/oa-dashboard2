'use client'
// PPL 협찬 진행판(21·8·22): 제안 → 회신 → 확정 → 발송 → 업로드 → 성과. 소스 = oa-youtubers 리스트, 단계 메모는 팀 공유 oa_ppl_stage_v1
import { useEffect, useMemo, useState } from "react";
import useShared, { MEMBERS, won } from "./useShared";

const STAGES = ["제안", "회신", "확정", "발송", "업로드", "성과"];
const fmtK = (v) => { v = +v || 0; return v >= 1e4 ? (v / 1e4).toFixed(v >= 1e5 ? 0 : 1) + "만" : v.toLocaleString(); };

export default function PplSection({ C, Card }) {
  const [rows, setRows] = useState(null);
  const [st, setSt] = useShared("oa_ppl_stage_v1", {});
  const [filter, setFilter] = useState("진행");
  const [q, setQ] = useState("");
  useEffect(() => { fetch("/api/ppl-leads").then((r) => r.json()).then((j) => setRows(j.rows || [])).catch(() => setRows([])); }, []);
  const stageOf = (r) => { const s = st[r.id] || {}; if (s.views || s.sales) return 5; if (s.uploaded) return 4; if (s.shipped) return 3; if (r.confirmed) return 2; if (r.replied) return 1; if (r.mailed) return 0; return -1; };
  const list = useMemo(() => (rows || []).map((r) => ({ ...r, _s: stageOf(r), _m: st[r.id] || {} }))
    .filter((r) => r._s >= 0 || r.rejected)
    .filter((r) => filter === "전체" ? true : filter === "진행" ? !r.rejected : filter === "확정" ? r.confirmed && !r.rejected : r.rejected)
    .filter((r) => !q || (r.channel_name || "").includes(q) || (r.handle || "").includes(q))
    .sort((a, b) => (b.confirmed ? 1 : 0) - (a.confirmed ? 1 : 0) || (b.deal_amount || 0) - (a.deal_amount || 0) || b._s - a._s), [rows, st, filter, q]);
  const patch = (id, p) => setSt((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...p, at: Date.now() } }));
  const conf = (rows || []).filter((r) => r.confirmed && !r.rejected);
  const sum = conf.reduce((a, r) => a + Number(r.deal_amount || 0), 0);
  const waitShip = conf.filter((r) => !(st[r.id] || {}).shipped).length, waitUp = conf.filter((r) => (st[r.id] || {}).shipped && !(st[r.id] || {}).uploaded).length;
  const td = { fontSize: 13, color: C.ink, padding: "8px 10px", borderBottom: `1px solid ${C.border}`, verticalAlign: "middle" };
  const Inp = ({ v, k, id, ph, type = "text", w = 110 }) => <input type={type} defaultValue={v || ""} placeholder={ph} onBlur={(e) => { if (e.target.value !== (v || "")) patch(id, { [k]: e.target.value }); }} style={{ width: w, fontSize: 12, padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.cream, color: C.ink, boxSizing: "border-box" }} />;
  const addCal = async (r) => { const d = r._m.uploadDate; if (!d) { alert("업로드일을 먼저 넣어 주세요"); return; } const res = await fetch("/api/notion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", data: { title: `[PPL] ${r.channel_name} 업로드`, date: d, type: "광고", assignee: r._m.by || "경은", status: "예정", memo: `확정 ${Number(r.deal_amount || 0).toLocaleString()}만 · ${r.channel_url || ""}` } }) }); const j = await res.json(); if (j.id) patch(r.id, { notionId: j.id }); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.ink, marginRight: 6 }}>PPL 협찬 진행판</div>
          {["진행", "확정", "거절", "전체"].map((f) => <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 20, cursor: "pointer", border: `1px solid ${filter === f ? C.rose : C.border}`, background: filter === f ? C.rose : C.white, color: filter === f ? C.white : C.inkMid }}>{f}</button>)}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="채널 검색" style={{ fontSize: 12, padding: "5px 10px", border: `1px solid ${C.border}`, borderRadius: 20, width: 140 }} />
          <div style={{ flex: 1 }} />
          <a href="https://oa-youtubers.vercel.app" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.inkMid }}>유튜버 리스트 열기 →</a>
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 10, flexWrap: "wrap" }}>
          {[["확정", `${conf.length}명 · ${sum.toLocaleString()}만원`], ["발송 대기", `${waitShip}명`], ["업로드 대기", `${waitUp}명`], ["성과 입력됨", `${conf.filter((r) => (st[r.id] || {}).views).length}명`]].map(([k, v]) => <div key={k}><div style={{ fontSize: 11, color: C.inkLt, fontWeight: 700 }}>{k}</div><div style={{ fontSize: 16, fontWeight: 900, color: C.ink }}>{v}</div></div>)}
        </div>
        <div style={{ fontSize: 12, color: C.inkLt, marginTop: 8 }}>제안·회신·확정은 유튜버 리스트에서 자동. 발송·업로드·조회수·판매는 여기서 기록하면 팀 전체에 공유돼요. 업로드일을 넣고 📅를 누르면 달력에 들어가요.</div>
      </Card>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1180 }}>
            <thead><tr>{["채널", "구독", "단가(PPL)", "확정액", "단계", "발송", "업로드일", "영상", "조회수", "판매(대)", "담당", "메모", ""].map((h) => <th key={h} style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, textAlign: "left", padding: "6px 10px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", background: C.cream }}>{h}</th>)}</tr></thead>
            <tbody>
              {!rows && <tr><td colSpan={13} style={{ ...td, color: C.inkLt }}>불러오는 중...</td></tr>}
              {list.map((r) => (
                <tr key={r.id} style={{ opacity: r.rejected ? .5 : 1, background: r.confirmed ? "#f0fdf4" : "transparent" }}>
                  <td style={td}><a href={r.channel_url} target="_blank" rel="noreferrer" style={{ fontWeight: 800, color: C.ink, textDecoration: "none" }}>{r.channel_name}</a><div style={{ fontSize: 11, color: C.inkLt }}>{r.handle}</div></td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtK(r.subscriber_count || r.subscribers)}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{r.ppl_price ? Number(r.ppl_price).toLocaleString() + "만" : "—"}{r.cpv ? <div style={{ fontSize: 11, color: C.inkLt }}>조회당 {Math.round(r.cpv)}원</div> : null}</td>
                  <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 800 }}>{r.deal_amount ? Number(r.deal_amount).toLocaleString() + "만" : "—"}</td>
                  <td style={td}><div style={{ display: "flex", gap: 2 }}>{STAGES.map((s, i) => <span key={s} title={s} style={{ fontSize: 10, fontWeight: 800, padding: "2px 5px", borderRadius: 3, background: r.rejected ? C.cream : i <= r._s ? (i === r._s ? C.rose : "#fecdd3") : C.cream, color: r.rejected ? C.inkLt : i <= r._s ? (i === r._s ? "#fff" : C.ink) : C.inkLt }}>{s}</span>)}{r.rejected && <span style={{ fontSize: 10, fontWeight: 800, color: C.inkLt }}>거절</span>}</div></td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{r._m.shipped ? <span onClick={() => patch(r.id, { shipped: null })} style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, color: "#2563eb" }} title="누르면 취소">✓ {r._m.shipped.slice(5)}</span> : <button onClick={() => patch(r.id, { shipped: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10) })} style={{ fontSize: 11, fontWeight: 700, border: `1px solid ${C.border}`, background: C.white, borderRadius: 20, padding: "3px 9px", cursor: "pointer" }}>발송함</button>}</td>
                  <td style={td}><div style={{ display: "flex", gap: 4, alignItems: "center" }}><Inp v={r._m.uploadDate} k="uploadDate" id={r.id} type="date" w={130} /><button onClick={() => addCal(r)} title="달력에 넣기" style={{ border: 0, background: "none", cursor: "pointer", fontSize: 14, color: r._m.notionId ? "#16a34a" : C.inkLt }}>📅</button></div></td>
                  <td style={td}><div style={{ display: "flex", gap: 4, alignItems: "center" }}><Inp v={r._m.url} k="url" id={r.id} ph="영상 링크" w={120} />{r._m.url && <a href={r._m.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>↗</a>}</div>{r._m.url && !r._m.uploaded && <button onClick={() => patch(r.id, { uploaded: true })} style={{ marginTop: 3, fontSize: 11, fontWeight: 700, border: `1px solid ${C.border}`, background: C.white, borderRadius: 20, padding: "2px 8px", cursor: "pointer" }}>업로드 확인</button>}</td>
                  <td style={td}><Inp v={r._m.views} k="views" id={r.id} ph="조회수" type="number" w={90} /></td>
                  <td style={td}><Inp v={r._m.sales} k="sales" id={r.id} ph="판매" type="number" w={70} /></td>
                  <td style={td}><select value={r._m.by || ""} onChange={(e) => patch(r.id, { by: e.target.value })} style={{ fontSize: 12, padding: "3px 4px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.white }}><option value="">—</option>{MEMBERS.map((m) => <option key={m}>{m}</option>)}</select></td>
                  <td style={{ ...td, minWidth: 160 }}><Inp v={r._m.memo} k="memo" id={r.id} ph="조건·일정·특이사항" w={"100%"} /><div style={{ fontSize: 11, color: C.inkLt, marginTop: 2, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.note}>{(r.note || "").slice(0, 60)}</div></td>
                  <td style={td}>{r._m.views && r.deal_amount ? <span style={{ fontSize: 11, color: C.inkMid, whiteSpace: "nowrap" }}>조회당 {Math.round(r.deal_amount * 10000 / r._m.views)}원</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
