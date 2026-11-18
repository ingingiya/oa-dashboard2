'use client'
// 경은이복사봇 — 해외 탭에서 일을 맡기면 오아 맥(~/oa-globalbot/worker.mjs, 1분마다)이 Claude로 처리
// settings oa_global_bot_v1 = { jobs:[{id,text,files,by,at,status,steps,summary,approval,question,reply,suggest,outs}], beat, morning }
// 상태: 요청됨 → 진행 중 → 승인 대기 → 승인됨 → 실행 중 → 완료 / 질문 → 답변됨 / 실패 · 취소
import { useEffect, useState } from "react";
import { me } from "./useShared";
import { getSetting, setSetting, uploadAdImage } from "../lib/useSupabase";

const KEY = "oa_global_bot_v1";
const ST = { "요청됨": ["#e0e7ff", "#3730a3"], "진행 중": ["#dbeafe", "#1d4ed8"], "실행 중": ["#dbeafe", "#1d4ed8"], "승인 대기": ["#fef3c7", "#92400e"], "승인됨": ["#e0e7ff", "#3730a3"], "질문": ["#fce7f3", "#9d174d"], "답변됨": ["#e0e7ff", "#3730a3"], "완료": ["#dcfce7", "#166534"], "실패": ["#fee2e2", "#991b1b"], "취소": ["#f3f4f6", "#6b7280"] };
const ACTIVE = ["요청됨", "진행 중", "승인됨", "실행 중", "답변됨"];
const kst = () => new Date(Date.now() + 9 * 36e5).toISOString().replace("T", " ").slice(0, 16);
// 업무 메뉴 — 경은님이 해외 일로 실제 하던 것들. [ ] 안은 눌러서 고쳐 쓰는 칸
const MENU = [
  ["📈 매출·순위", ["이번 주 큐텐 매출·순위 정리해서 보여줘", "어제 큐텐 주문·매출 확인하고 특이사항 알려줘", "검색순위 떨어진 상품 찾고 원인이랑 대응안 정리해줘", "Q캐시 잔액이랑 광고(키워드플러스·파워랭크업) 효율 정리해줘", "이번 달 큐텐 실적 월간 리포트 만들어줘"]],
  ["🛍 상품·상세", ["[상품명] 큐텐 상세 일본어 오탈자·「OA」 표기·효과 표현 점검해줘", "[상품명] 큐텐 상세 맨 위에 한국 리뷰 배너 만들어서 넣을 준비해줘", "큐텐 50상품 썸네일·상품명 점검하고 고칠 것 목록 만들어줘", "[상품명] 큐텐 신규 등록 준비해줘 (일본어 상품명·상세·설명서·판매가)", "한국 리뷰 배너 숫자 최신으로 다시 찍어서 갱신할 준비해줘"]],
  ["🏷 행사·가격", ["쿠폰·이벤트 만료일 확인하고 연장·재생성 안 짜줘", "[상품명] 타임세일 손익(판매가·마진·손익분기 수량) 계산해줘", "다음 메가와리·메가포 준비 체크리스트랑 일정 정리해줘", "한국 브랜드 큐텐 경쟁 상품 가격·행사 조사해서 비교해줘", "[상품명] 판매가를 ¥[가격]으로 바꾸는 안 만들어줘 (마진 확인 포함)"]],
  ["💬 고객", ["큐텐 새 문의·리뷰 확인하고 일본어 답변 초안 써줘", "리뷰 안 쓴 구매자 쿠폰 푸시 문구 초안 써줘", "리뷰 적은 상품 리뷰 늘릴 방법 (리뷰 이벤트·샘플마켓) 안 짜줘"]],
  ["🌏 일본 진출", ["첨부한 제안서·메일 보고 할지 말지 판단해줘", "회신 대기 중인 업체 확인하고 리마인드 메일 초안 써줘", "일본 인증(PSE·배터리) 진행 현황 정리해줘", "라쿠텐·아마존 재팬 입점 준비 현황이랑 다음 할 일 정리해줘", "[상품명] 일본어 설명서 만들어서 설명서 사이트에 올릴 준비해줘"]],
  ["📦 발송", ["큐텐 주문 발송 상태(KSE 접수·송장 전송) 확인해줘", "일본 창고 입고 준비 상황(운송 견적·서류) 정리해줘"]],
];
const EVERY = [["daily", "매일 아침"], ["mon", "매주 월요일"], ["fri", "매주 금요일"], ["m1", "매달 1일"]];

export default function GlobalBot({ C, Card }) {
  const [v, setV] = useState(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState({});
  const [reply, setReply] = useState({});
  const [more, setMore] = useState(false);
  const [cat, setCat] = useState(0);
  const [every, setEvery] = useState("");
  const load = () => getSetting(KEY).then((x) => setV(x || { jobs: [] })).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);
  if (!v) return null;

  // 다시 읽고 해당 id만 바꿔 저장 (맥 워커와 동시 수정 보호)
  const patch = async (id, p) => { const cur = (await getSetting(KEY)) || { jobs: [] }; cur.jobs = (cur.jobs || []).map((j) => j.id === id ? { ...j, ...p } : j); await setSetting(KEY, cur); load(); };
  const add = async (t, fl = []) => {
    const cur = (await getSetting(KEY)) || { jobs: [] };
    cur.jobs = [...(cur.jobs || []), { id: Date.now().toString(36), text: t, files: fl, by: me() || "대시보드", at: kst(), status: "요청됨", steps: [] }].slice(-60);
    await setSetting(KEY, cur); load();
  };
  const addRoutine = async () => {
    if (!text.trim() || !every) return; if (/\[(상품명|가격)\]/.test(text)) return alert("[ ] 부분을 실제 상품명·가격으로 바꿔 주세요"); const cur = (await getSetting(KEY)) || { jobs: [] };
    cur.routines = [...(cur.routines || []), { id: "r" + Date.now().toString(36), text: text.trim(), every, on: true, by: me() || "대시보드", at: kst() }];
    await setSetting(KEY, cur); setText(""); setEvery(""); load();
  };
  const setRoutine = async (id, p) => { const cur = (await getSetting(KEY)) || { jobs: [] }; cur.routines = (cur.routines || []).flatMap((r) => r.id !== id ? [r] : p === null ? [] : [{ ...r, ...p }]); await setSetting(KEY, cur); load(); };
  const submit = async () => {
    if (!text.trim() || busy) return;
    if (/\[(상품명|가격)\]/.test(text)) return alert("[ ] 부분을 실제 상품명·가격으로 바꿔 주세요");
    setBusy(true);
    try {
      const up = [];
      for (const f of files) { const r = await uploadAdImage(f, "globalbot_" + f.name.replace(/\.[^.]+$/, "")); up.push({ name: f.name, url: r.url }); }
      await add(text.trim(), up); setText(""); setFiles([]);
    } catch (e) { alert("올리기 실패: " + e.message); } finally { setBusy(false); }
  };

  const beatMin = v.beat ? Math.round((Date.now() - new Date(v.beat.replace(" ", "T") + ":00+09:00")) / 6e4) : null;
  const alive = beatMin !== null && beatMin <= 3;
  const jobs = [...(v.jobs || [])].reverse();
  const need = jobs.filter((j) => j.status === "승인 대기" || j.status === "질문");
  const shown = more ? jobs : jobs.slice(0, 6);
  const btn = (bg, fg = "#fff") => ({ fontSize: 13, fontWeight: 800, padding: "6px 14px", borderRadius: 9, border: 0, background: bg, color: fg, cursor: "pointer" });

  return (
    <Card style={{ padding: "14px 16px", border: need.length ? `2px solid #f59e0b` : undefined }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: C.ink }}>🤖 경은이복사봇</div>
        <span style={{ fontSize: 12.5, color: C.inkMid }}>해외 일을 문장으로 맡기면 경은님이 하던 방식대로 처리해요 · 밖으로 나가는 일은 승인 후에만</span>
        <div style={{ flex: 1 }} />
        {need.length > 0 && <span style={{ fontSize: 12.5, fontWeight: 900, color: "#b45309" }}>확인 필요 {need.length}건</span>}
        <span title={v.beat ? `마지막 확인 ${v.beat}` : ""} style={{ fontSize: 12, fontWeight: 800, color: alive ? "#16a34a" : "#dc2626" }}>● {alive ? "근무 중" : beatMin === null ? "아직 출근 전" : `${beatMin}분째 응답 없음 (오아 맥 확인)`}</span>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "stretch", flexWrap: "wrap" }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }} rows={2} placeholder="할 일을 문장으로 쓰거나 아래 업무 메뉴에서 고르세요   (⌘+Enter로 맡기기)" style={{ flex: "1 1 320px", minWidth: 0, fontSize: 14, lineHeight: 1.5, padding: "8px 10px", borderRadius: 10, border: `1px solid ${C.border}`, fontFamily: "inherit", resize: "vertical" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ ...btn("#f1f5f9", C.ink), textAlign: "center" }}>📎 파일{files.length ? ` ${files.length}` : ""}<input type="file" multiple hidden onChange={(e) => setFiles([...e.target.files])} /></label>
          <button onClick={submit} disabled={busy || !text.trim()} style={btn(busy || !text.trim() ? "#cbd5e1" : C.ink)}>{busy ? "올리는 중…" : "맡기기"}</button>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>{MENU.map(([c], i) => <button key={c} onClick={() => setCat(i)} style={{ fontSize: 12.5, fontWeight: 800, padding: "4px 11px", borderRadius: 999, border: 0, cursor: "pointer", background: cat === i ? C.ink : "#f1f5f9", color: cat === i ? "#fff" : C.inkMid }}>{c}</button>)}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{MENU[cat][1].map((x) => <button key={x} onClick={() => setText(x)} title="누르면 입력칸에 들어가요 — [ ] 부분만 고쳐서 맡기기" style={{ fontSize: 12.5, padding: "4px 11px", borderRadius: 999, border: `1px solid ${C.border}`, background: text === x ? "#eef2ff" : C.white, color: C.ink, cursor: "pointer", textAlign: "left" }}>{x}</button>)}</div>
      </div>
      {text.trim() && <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, flexWrap: "wrap", fontSize: 12.5, color: C.inkMid }}>
        <span>🔁 이 일을 반복으로</span>
        <select value={every} onChange={(e) => setEvery(e.target.value)} style={{ fontSize: 12.5, padding: "3px 6px", borderRadius: 8, border: `1px solid ${C.border}` }}><option value="">선택</option>{EVERY.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button disabled={!every} onClick={addRoutine} style={{ ...btn(every ? "#eef2ff" : "#f1f5f9", every ? "#3730a3" : C.inkLt), fontSize: 12, padding: "3px 10px" }}>반복 등록</button>
      </div>}
      {(v.routines || []).length > 0 && <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 10, background: "#f8fafc" }}>
        <div style={{ fontSize: 12.5, fontWeight: 900, color: C.ink, marginBottom: 4 }}>🔁 반복 업무 <span style={{ fontWeight: 600, color: C.inkLt }}>· 정해진 날 오전 9:30쯤 봇이 알아서 맡아요</span></div>
        {v.routines.map((r) => <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, padding: "3px 0", color: r.on ? C.ink : C.inkLt }}>
          <span style={{ flexShrink: 0, fontWeight: 800, width: 82 }}>{(EVERY.find((e) => e[0] === r.every) || [, r.every])[1]}</span>
          <span style={{ flex: 1, minWidth: 0 }}>{r.text}</span>
          {r.last && <span style={{ flexShrink: 0, color: C.inkLt }}>최근 {r.last.slice(5)}</span>}
          <button onClick={() => setRoutine(r.id, { on: !r.on })} style={{ ...btn(r.on ? "#dcfce7" : "#f1f5f9", r.on ? "#166534" : C.inkMid), fontSize: 11.5, padding: "2px 8px" }}>{r.on ? "켜짐" : "꺼짐"}</button>
          <button onClick={() => setRoutine(r.id, null)} style={{ ...btn("#fee2e2", "#991b1b"), fontSize: 11.5, padding: "2px 8px" }}>삭제</button>
        </div>)}
      </div>}

      {shown.length > 0 && <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map((j) => {
          const [bg, fg] = ST[j.status] || ST["취소"]; const o = open[j.id] ?? (j.status === "승인 대기" || j.status === "질문" || ACTIVE.includes(j.status));
          return (
            <div key={j.id} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px", background: j.status === "승인 대기" ? "#fffbeb" : C.white }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }} onClick={() => setOpen({ ...open, [j.id]: !o })}>
                <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 900, padding: "2px 8px", borderRadius: 999, background: bg, color: fg }}>{j.status}{ACTIVE.includes(j.status) && j.status !== "요청됨" ? " …" : ""}</span>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: C.ink, lineHeight: 1.45, whiteSpace: o ? "pre-wrap" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.text}</div>
                <span style={{ flexShrink: 0, fontSize: 11.5, color: C.inkLt }}>{j.by} {(j.at || "").slice(5)}</span>
              </div>
              {o && <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                {(j.files || []).length > 0 && <div style={{ fontSize: 12 }}>{j.files.map((f) => <a key={f.url} href={f.url} target="_blank" rel="noreferrer" style={{ marginRight: 8, color: C.rose }}>📎 {f.name}</a>)}</div>}
                {(j.steps || []).length > 0 && <details open={ACTIVE.includes(j.status)}><summary style={{ fontSize: 12, color: C.inkLt, cursor: "pointer" }}>진행 기록 {j.steps.length}</summary><ol style={{ margin: "4px 0 0", paddingLeft: 20, fontSize: 12, color: C.inkMid, lineHeight: 1.6 }}>{j.steps.map((s, i) => <li key={i}>{s.t} {s.m}</li>)}</ol></details>}
                {j.summary && <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.6, whiteSpace: "pre-wrap", background: "#f8fafc", borderRadius: 8, padding: "8px 10px" }}>{j.summary}</div>}
                {(j.outs || []).length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{j.outs.map((f) => <a key={f.url} href={/\.html$/i.test(f.url) ? "/api/botfile?p=" + encodeURIComponent(f.url.split("/ad-images/")[1]) : f.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, padding: "3px 10px", borderRadius: 999, background: "#f1f5f9", color: C.ink, textDecoration: "none", fontWeight: 700 }}>⬇ {f.name}</a>)}</div>}
                {j.status === "승인 대기" && <div style={{ border: "1px solid #fcd34d", borderRadius: 10, padding: 10, background: "#fff" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 900, color: "#92400e", marginBottom: 4 }}>승인하면 이렇게 실행해요</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", color: C.ink }}>{j.approval}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <input value={reply[j.id] || ""} onChange={(e) => setReply({ ...reply, [j.id]: e.target.value })} placeholder="메모 (선택)" style={{ flex: "1 1 160px", minWidth: 0, fontSize: 13, padding: "5px 8px", borderRadius: 8, border: `1px solid ${C.border}` }} />
                    <button onClick={() => patch(j.id, { status: "승인됨", reply: reply[j.id] || "", approved_by: me() || "대시보드", approved_at: kst() })} style={btn("#16a34a")}>승인</button>
                    <button onClick={() => patch(j.id, { status: "답변됨", reply: "승인 안 함. 이렇게 고쳐서 다시 승인 요청: " + (reply[j.id] || "(메모 없음)") })} style={btn("#f1f5f9", C.ink)}>고쳐서 다시</button>
                    <button onClick={() => patch(j.id, { status: "취소", done_at: kst() })} style={btn("#fee2e2", "#991b1b")}>취소</button>
                  </div>
                </div>}
                {j.status === "질문" && <div style={{ border: "1px solid #f9a8d4", borderRadius: 10, padding: 10, background: "#fff" }}>
                  <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", color: C.ink }}>❓ {j.question}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <input value={reply[j.id] || ""} onChange={(e) => setReply({ ...reply, [j.id]: e.target.value })} placeholder="답변" style={{ flex: 1, minWidth: 0, fontSize: 13, padding: "5px 8px", borderRadius: 8, border: `1px solid ${C.border}` }} />
                    <button onClick={() => reply[j.id] && patch(j.id, { status: "답변됨", reply: reply[j.id] })} style={btn(C.ink)}>답변</button>
                  </div>
                </div>}
                {(j.suggest || []).length > 0 && j.status === "완료" && <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{j.suggest.map((s) => <div key={s} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, color: C.inkMid }}><span style={{ flex: 1 }}>💡 {s}</span><button onClick={() => add(s)} style={{ ...btn("#eef2ff", "#3730a3"), fontSize: 12, padding: "3px 10px" }}>이거 시키기</button></div>)}</div>}
                {["요청됨", "질문", "승인 대기"].includes(j.status) && j.status === "요청됨" && <button onClick={() => patch(j.id, { status: "취소", done_at: kst() })} style={{ ...btn("#f1f5f9", C.inkMid), alignSelf: "flex-start", fontSize: 12 }}>맡긴 거 취소</button>}
              </div>}
            </div>
          );
        })}
        {jobs.length > 6 && <button onClick={() => setMore(!more)} style={{ fontSize: 12, border: 0, background: "none", color: C.rose, cursor: "pointer", fontWeight: 700 }}>{more ? "접기" : `지난 일 ${jobs.length - 6}건 더 보기`}</button>}
      </div>}
    </Card>
  );
}
