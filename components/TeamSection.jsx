'use client'
// 팀 탭: 요청함(27·41) · 주간 회고(16) · 문서함(17) · 온보딩(14) · PPL 가이드라인(40)
import { useState } from "react";
import useShared, { MEMBERS, me } from "./useShared";

const KINDS = ["소재 제작", "촬영", "제품 구매·샘플", "상세·배너", "기타"];
const ST = { 대기: "#d97706", 진행: "#2563eb", 완료: "#16a34a", 보류: "#9ca3af" };
const weekKey = () => { const d = new Date(Date.now() + 9 * 3600e3); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() - day + 1); return d.toISOString().slice(0, 10); };
const GUIDE = `[프리온 PPL 가이드라인 · 복사해서 보내세요]
■ 제품: 오아 프리온 무선 고데기 (핑크/화이트/퍼플)
■ 꼭 들어갈 내용
 - 무선, 기내 반입 가능(배터리 분리형)
 - 가열 속도·휴대성 체감 장면
 - 실제 사용 장면 1회 이상 (제품 로고 보이게)
■ 하면 안 되는 표현
 - 의학적 효능·"탈모" 등 건강 표현
 - 정확한 원 단위 가격 (가격대 표현만: "4만원대")
 - 날짜·기간 한정 문구, 실제 없는 증정/구성품
 - 타 브랜드 제품명 언급 비교
■ 소재·링크
 - 링크는 저희가 드리는 스마트스토어 링크만 사용
 - 썸네일·본문에 "오아" 표기 (OA 금지)
■ 일정
 - 초안 공유 → 수정 1회 → 업로드 확정일 사전 공유
■ 2차 활용: 별도 협의 전 불가`;

export default function TeamSection({ C, Card }) {
  const [req, setReq] = useShared("oa_requests_v1", []);
  const [retro, setRetro] = useShared("oa_retro_v1", {});
  const [docs, setDocs] = useShared("oa_docs_v1", [["플렌티플렛 캠핑 보고(11/4)", "https://oa-plenty-camping.vercel.app"], ["이사님 CPC 현황판", "https://oa-adcost.vercel.app"], ["광고 시세판", "https://oa-adcost.vercel.app/rates"], ["유튜버 리스트", "https://oa-youtubers.vercel.app"], ["해외 진출 보고", "https://oa-global-report.vercel.app"], ["메타광고 제작가이드(피그마)", "https://www.figma.com/design/W1Ci8MiVyAfUribca7Awd5"]]);
  const [tab, setTab] = useState("req");
  const [f, setF] = useState({ kind: KINDS[0], product: "", channel: "", due: "", assignee: "", note: "" });
  const [showDone, setShowDone] = useState(false);
  const wk = weekKey(); const r = retro[wk] || {};
  const add = () => { if (!f.note) return; setReq((p) => [{ id: "r" + Date.now(), ...f, status: "대기", by: me(), at: Date.now(), link: "" }, ...(p || [])]); setF({ ...f, note: "", product: "", due: "" }); };
  const patch = (id, p) => setReq((prev) => prev.map((x) => x.id === id ? { ...x, ...p } : x));
  const list = (req || []).filter((x) => showDone || x.status !== "완료");
  const td = { fontSize: 13, color: C.ink, padding: "8px 10px", borderBottom: `1px solid ${C.border}`, verticalAlign: "top" };
  const TabBtn = ({ k, l }) => <button onClick={() => setTab(k)} style={{ fontSize: 13, fontWeight: 800, padding: "8px 16px", borderRadius: 12, border: 0, cursor: "pointer", background: tab === k ? C.ink : C.cream, color: tab === k ? C.white : C.inkMid }}>{l}</button>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ padding: "12px 16px" }}><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><div style={{ fontSize: 16, fontWeight: 800, color: C.ink, marginRight: 6 }}>팀</div><TabBtn k="req" l={`요청함 ${(req || []).filter((x) => x.status !== "완료").length}`} /><TabBtn k="retro" l="주간 회고" /><TabBtn k="docs" l="문서함" /><TabBtn k="guide" l="PPL 가이드라인" /><TabBtn k="onb" l="온보딩" /></div></Card>
      {tab === "req" && <>
        <Card style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, marginBottom: 8 }}>요청 넣기</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
            <label style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, display: "flex", flexDirection: "column", gap: 3 }}>종류<select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} style={{ fontSize: 13, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 8 }}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
            <label style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, display: "flex", flexDirection: "column", gap: 3 }}>제품<input value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} placeholder="플렌티플렛" style={{ width: 120, fontSize: 13, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 8 }} /></label>
            <label style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, display: "flex", flexDirection: "column", gap: 3 }}>채널·용도<input value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} placeholder="메타 4:5 / 공구 상세" style={{ width: 140, fontSize: 13, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 8 }} /></label>
            <label style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, display: "flex", flexDirection: "column", gap: 3 }}>마감<input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} style={{ fontSize: 13, padding: "5px 8px", border: `1px solid ${C.border}`, borderRadius: 8 }} /></label>
            <label style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, display: "flex", flexDirection: "column", gap: 3 }}>담당<select value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })} style={{ fontSize: 13, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 8 }}><option value="">—</option>{MEMBERS.map((m) => <option key={m}>{m}</option>)}</select></label>
            <label style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 220 }}>내용<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="무엇을, 어떤 느낌으로, 몇 장" style={{ fontSize: 13, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 8 }} /></label>
            <button onClick={add} style={{ fontSize: 13, fontWeight: 800, padding: "7px 16px", borderRadius: 10, border: 0, background: C.ink, color: C.white, cursor: "pointer" }}>요청</button>
          </div>
        </Card>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: `1px solid ${C.border}` }}><span style={{ fontSize: 12, color: C.inkLt }}>{list.length}건</span><div style={{ flex: 1 }} /><label style={{ fontSize: 12, color: C.inkMid }}><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> 완료 포함</label></div>
          <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%", minWidth: 820 }}>
            <thead><tr>{["상태", "종류", "제품 · 채널", "내용", "마감", "담당", "요청자", "완성본 링크", ""].map((h) => <th key={h} style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, textAlign: "left", padding: "6px 10px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", background: C.cream }}>{h}</th>)}</tr></thead>
            <tbody>{list.map((x) => { const late = x.due && x.status !== "완료" && x.due < new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); return (
              <tr key={x.id}>
                <td style={td}><select value={x.status} onChange={(e) => patch(x.id, { status: e.target.value })} style={{ fontSize: 12, fontWeight: 800, color: "#fff", background: ST[x.status], border: 0, borderRadius: 6, padding: "3px 6px" }}>{Object.keys(ST).map((s) => <option key={s}>{s}</option>)}</select></td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{x.kind}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}><b>{x.product}</b>{x.channel && <div style={{ fontSize: 11, color: C.inkLt }}>{x.channel}</div>}</td>
                <td style={{ ...td, minWidth: 220 }}>{x.note}</td>
                <td style={{ ...td, whiteSpace: "nowrap", color: late ? "#dc2626" : C.ink, fontWeight: late ? 800 : 400 }}>{x.due ? x.due.slice(5) : "—"}{late && " 지남"}</td>
                <td style={td}><select value={x.assignee || ""} onChange={(e) => patch(x.id, { assignee: e.target.value })} style={{ fontSize: 12, padding: "3px 4px", border: `1px solid ${C.border}`, borderRadius: 6 }}><option value="">—</option>{MEMBERS.map((m) => <option key={m}>{m}</option>)}</select></td>
                <td style={{ ...td, whiteSpace: "nowrap", color: C.inkMid }}>{x.by || "—"}<div style={{ fontSize: 11, color: C.inkLt }}>{new Date(x.at).toISOString().slice(5, 10)}</div></td>
                <td style={td}><input defaultValue={x.link || ""} placeholder="피그마·드라이브 링크" onBlur={(e) => e.target.value !== (x.link || "") && patch(x.id, { link: e.target.value, status: e.target.value && x.status !== "완료" ? "완료" : x.status })} style={{ width: 150, fontSize: 12, padding: "3px 6px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.cream }} />{x.link && <a href={x.link} target="_blank" rel="noreferrer" style={{ fontSize: 12, marginLeft: 4 }}>↗</a>}</td>
                <td style={td}><button onClick={() => { if (confirm("지울까요?")) setReq((p) => p.filter((y) => y.id !== x.id)); }} style={{ border: 0, background: "none", color: C.inkLt, cursor: "pointer" }}>✕</button></td>
              </tr>); })}</tbody>
          </table></div>
        </Card>
      </>}
      {tab === "retro" && <Card style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>이번 주 회고 <span style={{ fontSize: 12, fontWeight: 500, color: C.inkLt }}>{wk} 주 · 금요일에 한 줄씩. 월요일 요약에 같이 나가요</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 10 }}>
          {MEMBERS.map((m) => { const v = r[m] || {}; const set = (k, val) => setRetro((p) => ({ ...p, [wk]: { ...(p[wk] || {}), [m]: { ...((p[wk] || {})[m] || {}), [k]: val } } })); return (
            <div key={m} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 6 }}>{m}</div>
              {[["good", "잘된 것"], ["bad", "안 된 것"], ["next", "다음 주"]].map(([k, l]) => <div key={k} style={{ marginBottom: 6 }}><div style={{ fontSize: 11, color: C.inkLt, fontWeight: 700 }}>{l}</div><textarea defaultValue={v[k] || ""} onBlur={(e) => e.target.value !== (v[k] || "") && set(k, e.target.value)} style={{ width: "100%", boxSizing: "border-box", fontSize: 13, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.cream, minHeight: 44, lineHeight: 1.5, fontFamily: "inherit" }} /></div>)}
            </div>); })}
        </div>
        {Object.keys(retro).filter((k) => k !== wk).sort().reverse().slice(0, 4).map((k) => <details key={k} style={{ marginTop: 10, fontSize: 13 }}><summary style={{ cursor: "pointer", fontWeight: 700, color: C.inkMid }}>{k} 주</summary><div style={{ paddingLeft: 12, color: C.inkMid, lineHeight: 1.7 }}>{Object.entries(retro[k]).map(([m, v]) => <div key={m}><b>{m}</b> · 잘됨: {v.good || "—"} / 안됨: {v.bad || "—"} / 다음: {v.next || "—"}</div>)}</div></details>)}
      </Card>}
      {tab === "docs" && <Card style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>자주 쓰는 문서·링크</div><div style={{ flex: 1 }} /><button onClick={() => { const n = prompt("이름"); const u = n && prompt("링크"); if (n && u) setDocs((p) => [...p, [n, u]]); }} style={{ fontSize: 12, fontWeight: 700, border: `1px solid ${C.border}`, background: C.white, borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>+ 추가</button></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 8, marginTop: 10 }}>{(docs || []).map(([n, u], i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px" }}><a href={u} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.ink, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n}</a><button onClick={() => navigator.clipboard?.writeText(u)} style={{ fontSize: 11, border: `1px solid ${C.border}`, background: C.cream, borderRadius: 6, padding: "2px 6px", cursor: "pointer" }}>복사</button><button onClick={() => setDocs((p) => p.filter((_, j) => j !== i))} style={{ border: 0, background: "none", color: C.inkLt, cursor: "pointer" }}>✕</button></div>)}</div>
        <div style={{ fontSize: 12, color: C.inkLt, marginTop: 10 }}>공구 제안서 양식(Downloads 2026_공구제안서_*)·NAS 상세 PSD 같은 로컬 파일은 경로를 링크 대신 적어 두세요.</div>
      </Card>}
      {tab === "guide" && <Card style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>PPL·인플루언서 가이드라인 양식</div><div style={{ flex: 1 }} /><button onClick={() => navigator.clipboard?.writeText(GUIDE)} style={{ fontSize: 12, fontWeight: 700, border: `1px solid ${C.border}`, background: C.white, borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>복사</button></div>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.7, color: C.ink, background: C.cream, borderRadius: 10, padding: 14, marginTop: 10 }}>{GUIDE}</pre>
        <div style={{ fontSize: 12, color: C.inkLt }}>제품이 바뀌면 제품명·필수 장면만 고쳐서 쓰세요. 금지 표현은 팀 규칙(가격대 표기·날짜 금지·실제 숫자만)과 같아요.</div>
      </Card>}
      {tab === "onb" && <Card style={{ padding: "14px 16px", fontSize: 13, lineHeight: 1.8, color: C.ink }}>
        <div style={{ fontSize: 15, fontWeight: 900 }}>부스터즈팀 온보딩 (동욱님용)</div>
        <div style={{ fontSize: 12, color: C.inkLt, marginBottom: 8 }}>팀이 지금 하는 일 5가지와, 각각 대시보드 어디서 보는지</div>
        <ol style={{ paddingLeft: 18, margin: 0 }}>
          <li><b>마케팅(광고·소재)</b> · 메타·네이버 검색·GFA 운영, 소재 제작 → <b>메타광고</b>·<b>소재</b> 탭, 홈 "오늘의 광고 판정". ROAS는 구매완료 기준만 봅니다. 메타 구매 수치는 믿지 않고 클릭 단가로 봅니다.</li>
          <li><b>메인제품 PPL</b> · 프리온 유튜버 협찬(여단오·고요비 등) → <b>PPL 협찬</b> 탭. 단가·회신은 유튜버 리스트, 발송·업로드·성과는 진행판에 기록.</li>
          <li><b>공동구매</b> · 플렌티플렛·포그밍 캠핑 채널 공구 → <b>스케줄</b> 탭 달력(유형 공구) + 위의 "공구·행사 성과". 공구를 넣으면 D-3 점검·D-1 세팅·오픈·원복 할 일이 자동으로 생겨요. 가격은 "가격 엄수".</li>
          <li><b>행사기획</b> · 오늘끝딜·브랜드데이 등 → 스케줄 유형 행사. 끝나면 원복 체크를 꼭. 안 하면 홈에 빨간 경고.</li>
          <li><b>해외운영</b> · 일본·대만 → <b>해외</b> 탭 진행판 + 판매가 계산기.</li>
        </ol>
        <div style={{ marginTop: 10 }}><b>매일</b>: 홈 알림(끄기/원복/휴무 충돌) 확인 → 스케줄 "내 것" → 요청함. <b>월요일</b>: 웍스 주간 요약. <b>금요일</b>: 팀 탭 회고 한 줄.</div>
        <div style={{ marginTop: 6 }}><b>표기 규칙</b>: 브랜드 "오아"(OA 금지), 팀 "부스터즈팀". 광고 문구는 한글만, 날짜·한정 표현 금지, 가격은 "3만원대"식, 숫자는 실제 값만.</div>
        <div style={{ marginTop: 6 }}><b>내 이름 설정</b>: 스케줄 탭 "내 것" 버튼을 처음 누르면 이름을 물어봐요. 요청함·회고에 그 이름이 쓰여요.</div>
      </Card>}
    </div>
  );
}
