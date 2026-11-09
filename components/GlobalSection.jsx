'use client'
// 해외 운영: 국가별 진행판 + 인증 진행·회신 대기·할 일(11-09) + 환율 반영 판매가 계산기
import { useEffect, useState } from "react";
import useShared, { me } from "./useShared";

const STAGES = ["조사", "후보 선정", "채널 개설", "상품 등록", "첫 판매", "운영 중"];
const SEED = { countries: [
  { id: "jp", name: "일본", flag: "🇯🇵", stage: 4, owner: "경은", next: "12월 초 첫 입고(USB 무선 5종 × 50~150개, 일본 창고 국내배송) → 그 전에 KC-INTL 운송 견적·국내관리인·수입자(ONEMAKE) 확정. 콘센트 고데기는 FOREST ○PSE로 오마컬 1종 먼저", due: "2026-12-01", notes: ["10/23 보고 덱: 큐텐 직송 조건·보다나 해부", "11/05 판매 방식 결정: 일본 창고 + 국내배송", "11/06 큐텐 상세 일본어판 51·설명서 50종·썸네일 50 교체", "11/09 라쿠텐 입점 심사 통과·판매가 계산(큐텐가 그대로 개당 ¥1,800~4,000)", "11/09 인증 정리(BV·FOREST·ONEMAKE·Qxpress) → FOREST·ONEMAKE 미팅 요청, BV 회신(VCCI 생략)"], links: [["인증 정리", "https://oa-japan-cert.vercel.app"], ["진출 보고서", "https://oa-global-report.vercel.app"], ["1차 라인업", "https://oa-japan-lineup.vercel.app"], ["상세 검수", "https://oa-qoo10-jp.vercel.app"], ["설명서", "https://oa-manual-jp.vercel.app"], ["도구 모음", "https://oa-overseas-toolkit.vercel.app"]] },
] };

const OPS_SEED = {
  certs: [
    { id: "usb", name: "USB·무선 제품 (큐텐 라인업 대부분)", status: "진행", note: "본체 PSE 불필요. 배터리 서류 UN38.3·SDS만, 충전기 동봉 안 함 · 비용 0원", next: "공장에 제품별 UN38.3·SDS 요청" },
    { id: "preon", name: "프리온 (배터리 분리형)", status: "보류", note: "분리 배터리가 보조배터리 겸용 → 일본 보조배터리 인증 대상 가능성 높음. BV는 'UN38.3이면 될 것'(미확정)", next: "FOREST 미팅에서 서면 확인, 답 전엔 일본 출시 안 함" },
    { id: "ac", name: "콘센트 고데기 (오마컬 등)", status: "대기", note: "FOREST ○PSE 신고+라벨 0원·SKU당 2주~1개월 vs BV 시험 500만 원·8주·샘플 2대", next: "FOREST 미팅 → 아마존 심사 통과되면 0원 방식, 안 되면 아마존용만 BV 시험" },
    { id: "vcci", name: "VCCI (일본 전자파)", status: "안 함", note: "일본 의무 아님·아마존 요건 아님 (BV 120만 원)", next: "11/09 BV에 생략 회신 완료" },
    { id: "kc", name: "기존 KC 성적서", status: "안 함", note: "일본 인증에 재활용 불가 (BV 확인)", next: "" },
  ],
  waits: [
    { id: "forest", who: "FOREST", person: "정요한 과장", what: "○PSE 미팅 요청 — 아마존 심사 통과 사례·국내관리인 대행·프리온 배터리·SKU당 기간/비용", sent: "2026-11-09", status: "대기" },
    { id: "onemake", who: "ONEMAKE", person: "조선형 팀장", what: "수입자(IOR)·창고 조건(11/5 문의) 리마인드 + 국내관리인·고데기 수입 대행", sent: "2026-11-09", status: "대기" },
    { id: "kcintl", who: "KC-INTL", person: "AIRKR@ / SEAKR@KC-INTL.COM", what: "한국→일본 창고 대량 운송 견적 (지금은 개당 ¥100 가정)", sent: "", status: "보낼 것" },
    { id: "bv", who: "BV CPS Korea", person: "이원호 과장", what: "VCCI 생략·PSE는 비교 후 회신하겠다고 답장", sent: "2026-11-09", status: "완료" },
    { id: "qx", who: "Qxpress", person: "TracX", what: "리튬 제품 일본 창고 입고·배송 가능 확인", sent: "2026-11-05", status: "완료" },
  ],
  todos: [
    { id: "t1", text: "공장에 USB 무선 제품 UN38.3·SDS 요청", owner: "", done: false },
    { id: "t2", text: "FOREST 미팅 잡기 (정요한)", owner: "", done: false },
    { id: "t3", text: "KC-INTL 한국→일본 운송 견적 요청", owner: "", done: false },
    { id: "t4", text: "일본 국내관리인 선임 (25년 12월부터 의무)", owner: "", done: false },
    { id: "t5", text: "라쿠텐 계약 (27년 2월 출점료 인상 전) + 라쿠텐용 썸네일(글자 20% 이하)·회사정보 페이지", owner: "", done: false },
    { id: "t6", text: "아마존 재팬: 미국 계정에 일본 추가, 무선 제품부터", owner: "", done: false },
    { id: "t7", text: "큐텐 광고 1주 ¥20,000 테스트로 CPC 실측", owner: "", done: false },
    { id: "t8", text: "BV에 VCCI 생략 회신", owner: "경은", done: true },
  ],
};

const CAL_SEED = [
  { id: "c1", date: "2026-11-13", end: "", title: "큐텐 메가와리 4회차 신청 마감", kind: "행사", note: "우리는 자격 미달(7~9월 주문 0) → 불참. 행사 문구 「メガ割」 사용 금지" },
  { id: "c2", date: "2026-11-20", end: "2026-12-02", title: "큐텐 메가와리 4회차 (예상)", kind: "행사", note: "불참. 다음 회차 자격용 주문 이력 쌓기" },
  { id: "c3", date: "2026-12-01", end: "", title: "일본 창고 첫 입고 목표", kind: "물류", note: "USB 무선 5종 × 50~150개. 운송 견적·국내관리인·수입자 정해져야 진행" },
  { id: "c4", date: "2026-12-15", end: "", title: "큐텐 일본 국내배송 판매 시작 (목표)", kind: "판매", note: "12월 중순" },
  { id: "c5", date: "2027-01-31", end: "", title: "라쿠텐 계약 기한", kind: "계약", note: "27년 2월 출점료 인상 전" },
  { id: "c6", date: "2027-02-01", end: "2027-02-09", title: "큐텐 메가포 (예상)", kind: "행사", note: "신상품·세트 테스트장. 10% 쿠폰+10% 포인트" },
  { id: "c7", date: "2027-02-27", end: "2027-03-11", title: "큐텐 메가와리 1회차 (예상)", kind: "행사", note: "실질 목표. 신청 4~1주 전, 2주 전부터 가격 유지. 취소율 10% 이하 필수" },
];
const KIND_C = { "행사": "#e11d48", "물류": "#2563eb", "판매": "#16a34a", "계약": "#9333ea", "인증": "#d97706", "기타": "#6b7280" };
const INF_STAGES = ["후보", "연락", "수락", "발송", "업로드", "성과"];
const INF_SEED = { accounts: [["인스타 @oa_world_japan", "11/09 메타 비즈니스(Cmpny Oa) 연결"], ["페이스북 페이지 Oa オア", "11/09 메타 비즈니스 연결"]], ref: ["크몽 일본 시딩: 1명 15만 원 / 10명 130만 원", "발렌라이프: 단건 시딩 실비 + 20% / 기프팅 100건 300만 원", "큐텐 대학: 리뷰 부족 제품은 샘플마켓 5회+ 권장"], people: [] };
const HISTORY = [
  ["10/23", "일본 1호 후보 선정: 베이직 빗고데기 (아마존·큐텐 시세 수집, 8개 후보 비교)"],
  ["10/28", "일본 진출 보고서. 결정: 헤어툴 4 + 마사지 2 · 큐텐 자사 스토어(oaworld) 이미 있음 확인"],
  ["11/04", "일본 1차 라인업 8종 보고(판매가·이익·예산·인증) · 발렌라이프 대행 제안 검토 → 비용이 이익보다 커서 발주 안 함"],
  ["11/05", "해외영업 도구·노하우 공유 페이지 · 판매 방식 결정(일본 창고 + 국내배송) · 발렌라이프 통해 FOREST·ONEMAKE 소개, ONEMAKE에 수입자·창고 문의, Qxpress 리튬 입고 확인"],
  ["11/06", "큐텐 oaworld 운영 인수(10월 떨이 86건 실태) · 썸네일 50개 교체·카테고리 수정 · 상세 일본어판 PSD · 일본어 설명서 사이트 · 큐텐 운영 학습 · 건강·뷰티 150종 전원 방식 분류"],
  ["11/09", "라쿠텐 입점 심사 통과·판매가 계산 · BV 인증 회신 → 인증 종합 정리 · 큐텐 하루 10개 판매 기획 · 일본 인스타·페북 메타 비즈니스 연결 · FOREST·ONEMAKE 미팅 요청, BV 회신 · 해외 탭 정리"],
];
const ST_COLOR = { "진행": ["#dcfce7", "#166534"], "대기": ["#fef3c7", "#92400e"], "보류": ["#e5e7eb", "#374151"], "안 함": ["#f3f4f6", "#9ca3af"], "보낼 것": ["#fee2e2", "#991b1b"], "완료": ["#dcfce7", "#166534"], "회신": ["#dbeafe", "#1e40af"] };
const TEAM = ["경은", "영서", "동욱"]; // 해외 담당: 김경은·조영서·차동욱
const daysSince = (d) => d ? Math.floor((Date.now() - new Date(d + "T00:00:00+09:00")) / 864e5) : null;

export default function GlobalSection({ C, Card }) {
  const [b, setB] = useShared("oa_global_board_v1", SEED);
  const [ops, setOps] = useShared("oa_global_ops_v1", OPS_SEED);
  const [cal, setCal] = useShared("oa_global_cal_v1", CAL_SEED);
  const [inf, setInf] = useShared("oa_global_inf_v1", INF_SEED);
  const [hist, setHist] = useShared("oa_global_hist_v1", HISTORY);
  const upd = (list, id, p) => setOps((prev) => ({ ...prev, [list]: (prev[list] || []).map((x) => x.id === id ? { ...x, ...p } : x) }));
  const Chip = ({ v, opts, onPick }) => { const [bg, fg] = ST_COLOR[v] || ["#f3f4f6", "#374151"]; return <select value={v} onChange={(e) => onPick(e.target.value)} style={{ fontSize: 11, fontWeight: 800, padding: "2px 6px", borderRadius: 20, border: 0, background: bg, color: fg, cursor: "pointer" }}>{opts.map((o) => <option key={o}>{o}</option>)}</select>; };
  const [view, setView0] = useState("glance");
  useEffect(() => { try { const v = localStorage.getItem("oa_global_view"); if (v) setView0(v); } catch {} }, []);
  const setView = (v) => { setView0(v); try { localStorage.setItem("oa_global_view", v); } catch {} };
  const [fx, setFx] = useState(null);
  const [calc, setCalc] = useState({ cost: 25151, ship: 3500, fee: 12, ads: 5, margin: 30, cur: "JPY", rate: "" });
  useEffect(() => { fetch("/api/fx").then((r) => r.json()).then(setFx).catch(() => {}); }, []);
  const patch = (id, p) => setB((prev) => ({ countries: prev.countries.map((c) => c.id === id ? { ...c, ...p } : c) }));
  const rate = +calc.rate || (fx && fx[calc.cur]) || 0; // 외화 1단위 = rate 원
  const krwNeed = (calc.cost + calc.ship) / (1 - (calc.fee + calc.ads + calc.margin) / 100);
  const price = rate ? krwNeed / rate : 0;
  const Inp = ({ k, w = 90, step }) => <input type="number" step={step} value={calc[k]} onChange={(e) => setCalc({ ...calc, [k]: e.target.value === "" ? "" : +e.target.value })} style={{ width: w, fontSize: 13, padding: "5px 8px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.cream }} />;
  const jp = (b.countries || []).find((c) => c.id === "jp") || (b.countries || [])[0] || SEED.countries[0];
  const openTodos = (ops.todos || []).filter((t) => !t.done);
  const waiting = (ops.waits || []).filter((w) => w.status === "대기" || w.status === "보낼 것");
  const upcoming = [...(cal || [])].filter((e) => -daysSince(e.end || e.date) >= 0).sort((x, y) => x.date.localeCompare(y.date));
  const dd = (d) => { const n = -daysSince(d); return n === 0 ? "오늘" : n > 0 ? `D-${n}` : `${-n}일 지남`; };
  const H = ({ t, sub, go }) => <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}><div style={{ fontSize: 14, fontWeight: 900, color: C.ink }}>{t}</div>{sub && <span style={{ fontSize: 12, color: C.inkLt }}>{sub}</span>}<div style={{ flex: 1 }} />{go && <button onClick={() => setView(go)} style={{ fontSize: 12, border: 0, background: "none", color: C.rose, cursor: "pointer", fontWeight: 700 }}>전체 →</button>}</div>;
  const Tile = ({ k, v, sub, warn, go }) => <button onClick={() => go && setView(go)} style={{ textAlign: "left", cursor: go ? "pointer" : "default", border: `1px solid ${C.border}`, background: C.white, borderRadius: 14, padding: "12px 14px" }}><div style={{ fontSize: 12, fontWeight: 700, color: C.inkLt }}>{k}</div><div style={{ fontSize: 26, fontWeight: 900, color: warn ? "#dc2626" : C.ink, letterSpacing: "-0.02em", marginTop: 2 }}>{v}</div><div style={{ fontSize: 12, color: C.inkMid, marginTop: 2, lineHeight: 1.4 }}>{sub}</div></button>;
  const Glance = () => {
    const oldest = waiting.filter((w) => w.sent).map((w) => daysSince(w.sent)).sort((a, b2) => b2 - a)[0];
    const toSend = waiting.filter((w) => w.status === "보낼 것").length;
    const unassigned = openTodos.filter((t) => !t.owner).length;
    const next = upcoming[0];
    const latest = (hist || [])[(hist || []).length - 1];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 26 }}>{jp.flag}</span><span style={{ fontSize: 20, fontWeight: 900, color: C.ink }}>{jp.name}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", background: C.rose, borderRadius: 20, padding: "3px 10px" }}>{STAGES[jp.stage]} 단계</span>
            <div style={{ flex: 1 }} />
            {(jp.links || []).map(([l, u], i) => <a key={i} href={u} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.rose, fontWeight: 700, textDecoration: "none", border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 9px" }}>{l} ↗</a>)}
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 12 }}>{STAGES.map((st, i) => <div key={st} style={{ flex: 1 }}><div style={{ height: 6, borderRadius: 6, background: i <= jp.stage ? C.rose : C.border }} /><div style={{ fontSize: 11, fontWeight: i === jp.stage ? 900 : 600, color: i === jp.stage ? C.ink : C.inkLt, marginTop: 4 }}>{st}</div></div>)}</div>
          <div style={{ marginTop: 12, fontSize: 14, color: C.ink, lineHeight: 1.6 }}><b>다음:</b> {jp.next}</div>
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <Tile k="첫 입고까지" v={jp.due ? dd(jp.due) : "—"} sub={jp.due ? `${jp.due.slice(5).replace("-", "/")} 목표 · USB 무선 5종` : "기한 미정"} warn={jp.due && -daysSince(jp.due) <= 14} go="jp" />
          <Tile k="답 기다리는 곳" v={`${waiting.filter((w) => w.status === "대기").length}곳`} sub={`${oldest != null ? `가장 오래 ${oldest}일째` : ""}${toSend ? ` · 보낼 것 ${toSend}건` : ""}`} warn={oldest >= 5 || toSend > 0} go="ops" />
          <Tile k="남은 할 일" v={`${openTodos.length}개`} sub={unassigned ? `담당 없음 ${unassigned}개` : "모두 담당 지정됨"} warn={unassigned > 0} go="ops" />
          <Tile k="다음 일정" v={next ? dd(next.date) : "—"} sub={next ? next.title : "예정 없음"} go="cal" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
          <Card style={{ padding: "14px 16px" }}>
            <H t="할 일" sub={`${openTodos.length}개 남음`} go="ops" />
            {openTodos.map((t) => (
              <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", borderTop: `1px solid ${C.border}` }}>
                <input type="checkbox" checked={false} onChange={() => upd("todos", t.id, { done: true })} style={{ marginTop: 3, cursor: "pointer" }} />
                <span style={{ flex: 1, fontSize: 13, color: C.ink, lineHeight: 1.45 }}>{t.text}</span>
                <select value={t.owner || ""} onChange={(e) => upd("todos", t.id, { owner: e.target.value })} style={{ fontSize: 11, fontWeight: 700, padding: "1px 4px", border: `1px solid ${t.owner ? C.border : "#fca5a5"}`, borderRadius: 6, color: t.owner ? C.ink : "#dc2626", background: C.white }}><option value="">담당?</option>{TEAM.map((m) => <option key={m}>{m}</option>)}</select>
              </div>))}
            {!openTodos.length && <div style={{ fontSize: 13, color: C.inkLt }}>다 했어요 🎉</div>}
          </Card>
          <Card style={{ padding: "14px 16px" }}>
            <H t="기다리는 답 · 보낼 것" go="ops" />
            {waiting.map((w) => { const d = daysSince(w.sent); const late = w.status === "대기" && d >= 5; const [bg, fg] = ST_COLOR[w.status]; return (
              <div key={w.id} style={{ padding: "7px 0", borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 11, fontWeight: 800, background: bg, color: fg, borderRadius: 20, padding: "1px 7px" }}>{w.status}</span><span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{w.who}</span><div style={{ flex: 1 }} /><span style={{ fontSize: 11, fontWeight: 700, color: late ? "#dc2626" : C.inkLt }}>{w.sent ? (w.status === "대기" ? (d ? `${d}일째` : "오늘 보냄") : "") : ""}</span></div>
                <div style={{ fontSize: 12, color: C.inkMid, marginTop: 2, lineHeight: 1.45 }}>{w.what}</div>
                {w.status === "대기" && <button onClick={() => upd("waits", w.id, { status: "회신" })} style={{ marginTop: 4, fontSize: 11, fontWeight: 700, border: `1px solid ${C.border}`, background: C.white, borderRadius: 20, padding: "2px 8px", cursor: "pointer", color: C.inkMid }}>답 왔어요</button>}
              </div>); })}
            {!waiting.length && <div style={{ fontSize: 13, color: C.inkLt }}>기다리는 답이 없어요</div>}
          </Card>
          <Card style={{ padding: "14px 16px" }}>
            <H t="다가오는 일정" go="cal" />
            {upcoming.slice(0, 6).map((e) => { const n = -daysSince(e.date); return (
              <div key={e.id} style={{ display: "flex", gap: 10, padding: "7px 0", borderTop: `1px solid ${C.border}`, alignItems: "flex-start" }}>
                <div style={{ width: 48, flexShrink: 0, textAlign: "center", borderRadius: 8, background: n <= 7 ? "#fee2e2" : C.cream, padding: "3px 0" }}><div style={{ fontSize: 11, fontWeight: 900, color: n <= 7 ? "#dc2626" : C.inkMid }}>{n <= 0 ? "진행 중" : `D-${n}`}</div><div style={{ fontSize: 10, color: C.inkLt }}>{e.date.slice(5).replace("-", "/")}</div></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 7, background: KIND_C[e.kind] || "#6b7280", marginRight: 6, verticalAlign: "middle" }} />{e.title}</div><div style={{ fontSize: 12, color: C.inkMid, lineHeight: 1.4 }}>{e.note}</div></div>
              </div>); })}
          </Card>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
          <Card style={{ padding: "14px 16px" }}>
            <H t="인증 신호등" go="ops" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{(ops.certs || []).map((c) => { const [bg, fg] = ST_COLOR[c.status] || ["#f3f4f6", "#374151"]; return (
              <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ width: 44, textAlign: "center", fontSize: 11, fontWeight: 800, background: bg, color: fg, borderRadius: 20, padding: "2px 0", flexShrink: 0 }}>{c.status}</span><span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{c.name}</span></div>); })}</div>
          </Card>
          <Card style={{ padding: "14px 16px" }}>
            <H t="사람별 할 일" />
            <div style={{ display: "flex", gap: 10 }}>{[...TEAM, ""].map((m) => { const n = openTodos.filter((t) => (t.owner || "") === m).length; return (
              <div key={m || "none"} style={{ flex: 1, textAlign: "center", borderRadius: 12, background: m ? C.cream : n ? "#fee2e2" : C.cream, padding: "10px 0" }}><div style={{ fontSize: 22, fontWeight: 900, color: !m && n ? "#dc2626" : C.ink }}>{n}</div><div style={{ fontSize: 12, fontWeight: 700, color: C.inkMid }}>{m || "담당 없음"}</div></div>); })}</div>
            <div style={{ marginTop: 10, fontSize: 12, color: C.inkLt }}>인플루언서 {(inf.people || []).length}명 진행 · <button onClick={() => setView("inf")} style={{ fontSize: 12, border: 0, background: "none", color: C.rose, cursor: "pointer", fontWeight: 700, padding: 0 }}>관리 →</button></div>
          </Card>
          <Card style={{ padding: "14px 16px" }}>
            <H t="최근 한 일" sub={latest ? latest[0] : ""} go="hist" />
            {latest && <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.6 }}>{latest[1].split(" · ").map((x, j) => <div key={j}>· {x}</div>)}</div>}
          </Card>
        </div>
      </div>
    );
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.ink, marginRight: 6 }}>🇯🇵 해외</div>
          {[["glance", "한눈에"], ["jp", "일본 진행판"], ["ops", "인증·연락·할 일"], ["cal", "캘린더"], ["inf", "인플루언서"], ["hist", "한 일 기록"], ["calc", "판매가 계산"]].map(([k, l]) => <button key={k} onClick={() => setView(k)} style={{ fontSize: 13, fontWeight: 800, padding: "6px 12px", borderRadius: 20, cursor: "pointer", border: 0, background: view === k ? C.ink : "transparent", color: view === k ? "#fff" : C.inkMid }}>{l}</button>)}
          <div style={{ flex: 1 }} /><span style={{ fontSize: 12, color: C.inkLt }}>담당 김경은 · 조영서 · 차동욱</span>
        </div>
      </Card>
      {view === "glance" && <Glance />}
      {view === "jp" && (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 12 }}>
        {(b.countries || []).map((c) => (
          <Card key={c.id} style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 22 }}>{c.flag}</span><span style={{ fontSize: 17, fontWeight: 900, color: C.ink }}>{c.name}</span><div style={{ flex: 1 }} />
              <select value={c.owner || ""} onChange={(e) => patch(c.id, { owner: e.target.value })} style={{ fontSize: 12, padding: "3px 6px", border: `1px solid ${C.border}`, borderRadius: 8 }}><option value="">담당 —</option>{TEAM.map((m) => <option key={m}>{m}</option>)}</select></div>
            <div style={{ display: "flex", gap: 3, marginTop: 10, flexWrap: "wrap" }}>{STAGES.map((s, i) => <button key={s} onClick={() => patch(c.id, { stage: i })} style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 20, cursor: "pointer", border: `1px solid ${i === c.stage ? C.rose : C.border}`, background: i < c.stage ? C.goldLt : i === c.stage ? C.rose : C.white, color: i === c.stage ? "#fff" : C.inkMid }}>{s}</button>)}</div>
            <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: C.inkLt }}>다음 결정 · 할 일</div>
            <textarea defaultValue={c.next} onBlur={(e) => e.target.value !== c.next && patch(c.id, { next: e.target.value })} style={{ width: "100%", boxSizing: "border-box", fontSize: 13, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.cream, minHeight: 64, lineHeight: 1.5, fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}><span style={{ fontSize: 11, color: C.inkLt, fontWeight: 700 }}>기한</span><input type="date" value={c.due || ""} onChange={(e) => patch(c.id, { due: e.target.value })} style={{ fontSize: 12, padding: "3px 6px", border: `1px solid ${C.border}`, borderRadius: 6 }} /></div>
            {(c.notes || []).length > 0 && <ul style={{ margin: "8px 0 0", paddingLeft: 16, fontSize: 12, color: C.inkMid, lineHeight: 1.6 }}>{c.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>{(c.links || []).map(([l, u], i) => <a key={i} href={u} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#2563eb" }}>{l} ↗</a>)}
              <button onClick={() => { const t = prompt("기록 한 줄"); if (t) patch(c.id, { notes: [...(c.notes || []), `${new Date().toISOString().slice(5, 10)} ${t}`] }); }} style={{ fontSize: 11, border: 0, background: "none", color: C.inkLt, cursor: "pointer" }}>+ 기록</button></div>
          </Card>
        ))}
      </div>
      )}
      {view === "ops" && (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 12 }}>
        <Card style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>인증 진행</div>
          <div style={{ fontSize: 12, color: C.inkLt, marginTop: 2 }}>제품 묶음별 일본 인증 상태. 상태를 누르면 바뀌어요.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {(ops.certs || []).map((c) => (
              <div key={c.id} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Chip v={c.status} opts={["진행", "대기", "보류", "안 함", "완료"]} onPick={(v) => upd("certs", c.id, { status: v })} /><span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{c.name}</span></div>
                <div style={{ fontSize: 12, color: C.inkMid, marginTop: 4, lineHeight: 1.5 }}>{c.note}</div>
                {c.next && <div style={{ fontSize: 12, color: C.ink, marginTop: 2, lineHeight: 1.5 }}>→ {c.next}</div>}
              </div>
            ))}
          </div>
        </Card>
        <Card style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>회신 대기 · 연락처</div>
          <div style={{ fontSize: 12, color: C.inkLt, marginTop: 2 }}>보낸 지 5일 넘으면 빨간색. 답이 오면 상태를 "회신"으로.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {(ops.waits || []).map((w) => { const d = daysSince(w.sent); const late = w.status === "대기" && d !== null && d >= 5; return (
              <div key={w.id} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><Chip v={w.status} opts={["보낼 것", "대기", "회신", "완료"]} onPick={(v) => upd("waits", w.id, { status: v, sent: v === "대기" && !w.sent ? new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10) : w.sent })} /><span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{w.who}</span><span style={{ fontSize: 12, color: C.inkLt }}>{w.person}</span><div style={{ flex: 1 }} />{w.sent && <span style={{ fontSize: 11, fontWeight: 700, color: late ? "#dc2626" : C.inkLt }}>{w.sent.slice(5).replace("-", "/")} 보냄{w.status === "대기" ? ` · ${d}일째` : ""}</span>}</div>
                <div style={{ fontSize: 12, color: C.inkMid, marginTop: 4, lineHeight: 1.5 }}>{w.what}</div>
              </div>); })}
          </div>
        </Card>
        <Card style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center" }}><div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>해외 할 일</div><span style={{ fontSize: 12, color: C.inkLt, marginLeft: 8 }}>{(ops.todos || []).filter((t) => !t.done).length}개 남음</span><div style={{ flex: 1 }} />
            <button onClick={() => { const t = prompt("할 일"); if (t) setOps((p) => ({ ...p, todos: [...(p.todos || []), { id: "t" + Date.now(), text: t, owner: me() || "", done: false }] })); }} style={{ fontSize: 12, fontWeight: 700, border: `1px solid ${C.border}`, background: C.white, borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>+ 할 일</button></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {[...(ops.todos || [])].sort((x, y) => x.done - y.done).map((t) => (
              <label key={t.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: t.done ? C.inkLt : C.ink, textDecoration: t.done ? "line-through" : "none", lineHeight: 1.5, cursor: "pointer" }}>
                <input type="checkbox" checked={!!t.done} onChange={(e) => upd("todos", t.id, { done: e.target.checked })} style={{ marginTop: 3 }} />
                <span style={{ flex: 1 }}>{t.text}</span>
                <select value={t.owner || ""} onChange={(e) => upd("todos", t.id, { owner: e.target.value })} onClick={(e) => e.preventDefault()} style={{ fontSize: 11, padding: "1px 4px", border: `1px solid ${C.border}`, borderRadius: 6 }}><option value="">—</option>{TEAM.map((m) => <option key={m}>{m}</option>)}</select>
              </label>
            ))}
          </div>
        </Card>
      </div>
      )}
      <div style={{ display: view === "cal" || view === "inf" ? "grid" : "none", gridTemplateColumns: "1fr", gap: 12, maxWidth: 900 }}>
        <Card style={{ padding: "14px 16px", display: view === "cal" ? "block" : "none" }}>
          <div style={{ display: "flex", alignItems: "center" }}><div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>해외 캘린더</div><span style={{ fontSize: 12, color: C.inkLt, marginLeft: 8 }}>행사·입고·계약 일정</span><div style={{ flex: 1 }} />
            <button onClick={() => { const date = prompt("날짜 (예: 2026-12-10)"); if (!date) return; const title = prompt("일정 이름"); if (!title) return; const kind = prompt("종류: 행사/물류/판매/계약/인증/기타", "기타") || "기타"; setCal((p) => [...(p || []), { id: "c" + Date.now(), date, end: "", title, kind, note: "" }]); }} style={{ fontSize: 12, fontWeight: 700, border: `1px solid ${C.border}`, background: C.white, borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>+ 일정</button></div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
            {[...(cal || [])].sort((x, y) => x.date.localeCompare(y.date)).map((e, i, arr) => { const d = -daysSince(e.date); const past = (e.end ? -daysSince(e.end) : d) < 0; const mon = e.date.slice(0, 7); const newMon = i === 0 || arr[i - 1].date.slice(0, 7) !== mon; return (
              <div key={e.id}>
                {newMon && <div style={{ fontSize: 11, fontWeight: 800, color: C.inkLt, marginTop: i ? 10 : 2 }}>{mon.replace("-", "년 ")}월</div>}
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0", borderBottom: `1px solid ${C.border}`, opacity: past ? 0.45 : 1 }}>
                  <div style={{ width: 74, flexShrink: 0, fontSize: 12, fontWeight: 800, color: C.ink }}>{e.date.slice(5).replace("-", "/")}{e.end ? `~${e.end.slice(5).replace("-", "/")}` : ""}</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 7, background: KIND_C[e.kind] || "#6b7280", marginRight: 6, verticalAlign: "middle" }} />{e.title}</div>{e.note && <div style={{ fontSize: 12, color: C.inkMid, lineHeight: 1.5 }}>{e.note}</div>}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: past ? C.inkLt : d <= 7 ? "#dc2626" : C.inkLt, whiteSpace: "nowrap" }}>{past ? "지남" : d === 0 ? "오늘" : `D-${d}`}</div>
                  <button onClick={() => confirm(`「${e.title}」 지울까요?`) && setCal((p) => p.filter((x) => x.id !== e.id))} style={{ fontSize: 11, border: 0, background: "none", color: C.inkLt, cursor: "pointer" }}>✕</button>
                </div>
              </div>); })}
          </div>
        </Card>
        <Card style={{ padding: "14px 16px", display: view === "inf" ? "block" : "none" }}>
          <div style={{ display: "flex", alignItems: "center" }}><div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>해외 인플루언서</div><span style={{ fontSize: 12, color: C.inkLt, marginLeft: 8 }}>{(inf.people || []).length}명</span><div style={{ flex: 1 }} />
            <button onClick={() => { const name = prompt("인플루언서 이름 / 계정"); if (!name) return; const ch = prompt("채널·팔로워 (예: 인스타 3.2만)", "") || ""; setInf((p) => ({ ...p, people: [...(p.people || []), { id: "i" + Date.now(), name, ch, country: "일본", product: "", stage: 0, owner: me() || "", url: "", memo: "" }] })); }} style={{ fontSize: 12, fontWeight: 700, border: `1px solid ${C.border}`, background: C.white, borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>+ 인플루언서</button></div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{(inf.accounts || []).map(([a, n], i) => <span key={i} title={n} style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: C.cream, border: `1px solid ${C.border}`, color: C.inkMid }}>우리 계정 · {a}</span>)}</div>
          {(inf.people || []).length === 0 ? <div style={{ fontSize: 13, color: C.inkLt, padding: "18px 0", textAlign: "center" }}>아직 진행 중인 해외 인플루언서가 없어요. 「+ 인플루언서」로 후보부터 넣어 주세요.</div> :
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>{inf.people.map((x) => { const up = (q) => setInf((p) => ({ ...p, people: p.people.map((y) => y.id === x.id ? { ...y, ...q } : y) })); return (
            <div key={x.id} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{x.url ? <a href={x.url} target="_blank" rel="noreferrer" style={{ color: C.ink }}>{x.name} ↗</a> : x.name}</span><span style={{ fontSize: 12, color: C.inkLt }}>{x.ch}</span><div style={{ flex: 1 }} />
                <select value={x.owner || ""} onChange={(e) => up({ owner: e.target.value })} style={{ fontSize: 11, padding: "1px 4px", border: `1px solid ${C.border}`, borderRadius: 6 }}><option value="">담당 —</option>{TEAM.map((m) => <option key={m}>{m}</option>)}</select>
                <button onClick={() => confirm(`${x.name} 지울까요?`) && setInf((p) => ({ ...p, people: p.people.filter((y) => y.id !== x.id) }))} style={{ fontSize: 11, border: 0, background: "none", color: C.inkLt, cursor: "pointer" }}>✕</button></div>
              <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>{INF_STAGES.map((st, i) => <button key={st} onClick={() => up({ stage: i })} style={{ fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 20, cursor: "pointer", border: `1px solid ${i === x.stage ? C.rose : C.border}`, background: i < x.stage ? C.goldLt : i === x.stage ? C.rose : C.white, color: i === x.stage ? "#fff" : C.inkMid }}>{st}</button>)}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input defaultValue={x.product} placeholder="제품" onBlur={(e) => e.target.value !== x.product && up({ product: e.target.value })} style={{ width: 110, fontSize: 12, padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6 }} />
                <input defaultValue={x.url} placeholder="링크" onBlur={(e) => e.target.value !== x.url && up({ url: e.target.value })} style={{ width: 130, fontSize: 12, padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6 }} />
                <input defaultValue={x.memo} placeholder="메모 (단가·발송일·조회수)" onBlur={(e) => e.target.value !== x.memo && up({ memo: e.target.value })} style={{ flex: 1, fontSize: 12, padding: "4px 6px", border: `1px solid ${C.border}`, borderRadius: 6 }} /></div>
            </div>); })}</div>}
          <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700, color: C.inkLt }}>참고 단가</div>
          <ul style={{ margin: "4px 0 0", paddingLeft: 16, fontSize: 12, color: C.inkMid, lineHeight: 1.6 }}>{(inf.ref || []).map((r, i) => <li key={i}>{r}</li>)}</ul>
        </Card>
      </div>
      <Card style={{ padding: "14px 16px", display: view === "hist" ? "block" : "none" }}>
        <div style={{ display: "flex", alignItems: "center" }}><div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>지금까지 한 일</div><span style={{ fontSize: 12, color: C.inkLt, marginLeft: 8 }}>해외 진출 기록</span><div style={{ flex: 1 }} />
          <button onClick={() => { const t = prompt("한 일 (한 줄)"); if (t) { const k = new Date(Date.now() + 9 * 36e5); const d = `${String(k.getUTCMonth() + 1).padStart(2, "0")}/${String(k.getUTCDate()).padStart(2, "0")}`; setHist((p) => { const arr = [...(p || [])]; const last = arr[arr.length - 1]; if (last && last[0] === d) arr[arr.length - 1] = [d, last[1] + " · " + t]; else arr.push([d, t]); return arr; }); } }} style={{ fontSize: 12, fontWeight: 700, border: `1px solid ${C.border}`, background: C.white, borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>+ 기록</button></div>
        <div style={{ marginTop: 10, borderLeft: `2px solid ${C.border}`, marginLeft: 6 }}>
          {[...(hist || [])].reverse().map(([d, t], i) => (
            <div key={i} style={{ position: "relative", padding: "0 0 12px 18px" }}>
              <span style={{ position: "absolute", left: -6, top: 4, width: 10, height: 10, borderRadius: 10, background: i === 0 ? C.rose : C.white, border: `2px solid ${i === 0 ? C.rose : C.border}` }} />
              <div style={{ fontSize: 12, fontWeight: 900, color: C.ink }}>{d}</div>
              <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.6 }}>{t.split(" · ").map((x, j) => <div key={j}>· {x}</div>)}</div>
            </div>))}
        </div>
      </Card>
      <Card style={{ padding: "14px 16px", display: view === "calc" ? "block" : "none" }}>
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
