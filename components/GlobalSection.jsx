'use client'
// 해외 운영: 국가별 진행판 + 인증 진행·회신 대기·할 일(11-09) + 환율 반영 판매가 계산기
import { useEffect, useState } from "react";
import useShared, { me } from "./useShared";

const STAGES = ["조사", "후보 선정", "채널 개설", "상품 등록", "첫 판매", "운영 중"];
const SEED = { countries: [
  { id: "jp", name: "일본", flag: "🇯🇵", stage: 4, owner: "경은", next: "12월 초 첫 입고(USB 무선 5종 × 50~150개, 일본 창고 국내배송) → 그 전에 KC-INTL 운송 견적·국내관리인·수입자(ONEMAKE) 확정. 콘센트 고데기는 FOREST ○PSE로 오마컬 1종 먼저", due: "2026-12-01", notes: ["10/23 보고 덱: 큐텐 직송 조건·보다나 해부", "11/05 판매 방식 결정: 일본 창고 + 국내배송", "11/06 큐텐 상세 일본어판 51·설명서 50종·썸네일 50 교체", "11/09 라쿠텐 입점 심사 통과·판매가 계산(큐텐가 그대로 개당 ¥1,800~4,000)", "11/09 인증 정리(BV·FOREST·ONEMAKE·Qxpress) → FOREST·ONEMAKE 미팅 요청, BV 회신(VCCI 생략)"], links: [["인증 정리", "https://oa-japan-cert.vercel.app"], ["설명서", "https://oa-manual-jp.vercel.app"], ["상세 검수", "https://oa-qoo10-jp.vercel.app"], ["광고·순위 리포트", "https://oa-qoo10-ads.vercel.app"], ["큐텐 전략 한 장", "/qoo10-plan/index.html"], ["큐텐 영상 234편", "/qoo10-plan/video.html"]] },
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
    { id: "forest", who: "FOREST", person: "정요한 과장", what: "○PSE 미팅 요청 — 아마존 심사 통과 사례·국내관리인 대행·프리온 배터리·SKU당 기간/비용", sent: "2026-11-09", status: "대기", owner: "경은" },
    { id: "onemake", who: "ONEMAKE", person: "조선형 팀장", what: "수입자(IOR)·창고 조건(11/5 문의) 리마인드 + 국내관리인·고데기 수입 대행", sent: "2026-11-09", status: "대기", owner: "경은" },
    { id: "kcintl", who: "KC-INTL", person: "AIRKR@ / SEAKR@KC-INTL.COM", what: "한국→일본 창고 대량 운송 견적 (지금은 개당 ¥100 가정)", sent: "", status: "보낼 것", owner: "" },
    { id: "bv", who: "BV CPS Korea", person: "이원호 과장", what: "VCCI 생략·PSE는 비교 후 회신하겠다고 답장", sent: "2026-11-09", status: "완료", owner: "경은" },
    { id: "qx", who: "Qxpress", person: "TracX", what: "리튬 제품 일본 창고 입고·배송 가능 확인", sent: "2026-11-05", status: "완료" },
  ],
  todos: [
    { id: "t1", text: "공장에 USB 무선 제품 UN38.3·SDS 요청", owner: "", done: false },
    { id: "t2", text: "FOREST 미팅 잡기 (정요한)", owner: "", done: false },
    { id: "t3", text: "KC-INTL 한국→일본 운송 견적 요청", owner: "", due: "2026-11-30", done: false },
    { id: "t4", text: "일본 국내관리인 선임 (25년 12월부터 의무)", owner: "", due: "2026-11-30", done: false },
    { id: "t5", text: "라쿠텐 계약 (27년 2월 출점료 인상 전) + 라쿠텐용 썸네일(글자 20% 이하)·회사정보 페이지", owner: "", due: "2027-01-31", done: false },
    { id: "t6", text: "아마존 재팬: 미국 계정에 일본 추가, 무선 제품부터", owner: "", done: false },
    { id: "t7", text: "큐텐 광고 1주 ¥20,000 테스트로 CPC 실측", owner: "", done: false },
    { id: "t8", text: "BV에 VCCI 생략 회신", owner: "경은", done: true },
  ],
};

const CAL_SEED = [
  { id: "c1", date: "2026-11-13", end: "", title: "큐텐 메가와리 4회차 신청 마감", kind: "행사", note: "우리는 자격 미달(7~9월 주문 0) → 불참. 행사 문구 「メガ割」 사용 금지" },
  { id: "c2", date: "2026-11-20", end: "2026-12-02", title: "큐텐 메가와리 4회차 (예상)", kind: "행사", note: "불참. 다음 회차 자격용 주문 이력 쌓기" },
  { id: "c8", date: "2026-11-09", end: "2026-11-16", title: "큐텐 키워드플러스 8건", kind: "광고", note: "11/9 18:00~11/16 · 하루 2,600 Q캐시" },
  { id: "c9", date: "2026-11-10", end: "2026-11-16", title: "큐텐 파워랭크업 8상품", kind: "광고", note: "7일 · 상품당 700 · 자동연장 OFF" },
  { id: "c10", date: "2026-11-16", end: "", title: "큐텐 광고 종료 → 연장 여부 결정", kind: "광고", note: "순위 변화 보고 판단" },
  { id: "c3", date: "2026-12-01", end: "", title: "일본 창고 첫 입고 목표", kind: "물류", note: "USB 무선 5종 × 50~150개. 운송 견적·국내관리인·수입자 정해져야 진행" },
  { id: "c4", date: "2026-12-15", end: "", title: "큐텐 일본 국내배송 판매 시작 (목표)", kind: "판매", note: "12월 중순" },
  { id: "c5", date: "2027-01-31", end: "", title: "라쿠텐 계약 기한", kind: "계약", note: "27년 2월 출점료 인상 전" },
  { id: "c6", date: "2027-02-01", end: "2027-02-09", title: "큐텐 메가포 (예상)", kind: "행사", note: "신상품·세트 테스트장. 10% 쿠폰+10% 포인트" },
  { id: "c7", date: "2027-02-27", end: "2027-03-11", title: "큐텐 메가와리 1회차 (예상)", kind: "행사", note: "실질 목표. 신청 4~1주 전, 2주 전부터 가격 유지. 취소율 10% 이하 필수" },
];
const GOALS_SEED = {
  shops: [
    { id: "qoo10", name: "큐텐", status: "완료", note: "oaworld 스토어 운영 중 · 50상품" },
    { id: "rakuten", name: "라쿠텐", status: "진행", note: "입점 심사 통과 → 계약(27년 2월 출점료 인상 전)" },
    { id: "amazon", name: "아마존", status: "준비", note: "미국 계정에 일본 추가 → 무선 제품부터" },
  ],
  daily: { goal: 10, now: 0, at: "2026-11-09", note: "지금은 행사 없으면 0건 · 기획: 11월 3→7건, 12~1월 5건, 2월 12건, 3월 15건 → 월평균 10건" },
};
const ADS_SEED = {
  qcash: { start: 116500, used: 23800 },
  kwplus: { period: "11/09 18:00 ~ 11/16", end: "2026-11-16", items: [
    { kw: "ホットビューラー", name: "업컬 뷰러", search: 596, bid: 300 }, { kw: "ヘアアイロン", name: "무선고데기S", search: 652, bid: 1100 },
    { kw: "ストレートアイロン", name: "볼륨업 빗고데기", search: 326, bid: 300 }, { kw: "コードレスヘアアイロン", name: "뿌리볼륨 고데기", search: 221, bid: 200 },
    { kw: "カールアイロン", name: "물결고데기", search: 356, bid: 200 }, { kw: "ホットアイマスク", name: "눈편한세상", search: 387, bid: 300 },
    { kw: "マッサージ器", name: "듀얼포켓건", search: 138, bid: 100 }, { kw: "マッサージ", name: "히트스팟S", search: 81, bid: 100 } ] },
  powerup: { period: "11/10 ~ 11/16", end: "2026-11-16", price: 700, items: ["업컬 뷰러", "무선고데기S", "볼륨업 빗고데기", "뿌리볼륨 고데기", "물결고데기", "눈편한세상", "듀얼포켓건", "히트스팟S"] },
  note: "큐텐엔 클릭당 과금(CPC)이 없음 — 키워드플러스=하루 고정가 경매, 파워랭크업=정액, 스마트세일즈=판매 수수료형",
};
const KIND_C = { "광고": "#0891b2", "가격": "#0d9488", "행사": "#e11d48", "물류": "#2563eb", "판매": "#16a34a", "계약": "#9333ea", "인증": "#d97706", "기타": "#6b7280" };
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
  const [ads] = useShared("oa_global_ads_v1", ADS_SEED);
  const [goals, setGoals] = useShared("oa_global_goals_v1", GOALS_SEED);
  const [mob] = useShared("oa_global_mobile_v1", { items: [] });
  const [mobKey, setMobKey] = useState("shop");
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => { try { setIsPhone(/iPhone|Android|Mobile/i.test(navigator.userAgent)); } catch {} }, []);
  const [sales] = useShared("oa_global_qoo10_sales_v1", { updated: "", days: {}, products: [] });
  const [qprod] = useShared("oa_global_qoo10_products_v1", { updated: "", items: [] });
  const [jobs, setJobs] = useShared("oa_global_price_jobs_v1", []);
  const [pf, setPf] = useState(null); // 가격·행사 입력 폼
  const [pfErr, setPfErr] = useState("");
  const [pfAsk, setPfAsk] = useState("");
  const [offAsk, setOffAsk] = useState(""); // 화면 안 확인 문구 (브라우저 confirm은 자동화 크롬에서 자동 취소됨)
  const [rk] = useShared("oa_global_qoo10_rank_v1", { updated: "", rows: [] });
  const [mega, setMega] = useShared("oa_global_mega_plan_v1", { title: "2027 1회차 메가와리 안 (2/27~3/11) · 20% 쿠폰 · 큐텐 10% + 셀러 10% 반반", note: "11/10 접수. 최종가 = 쿠폰 적용 후 고객가(엔). 등록가 = 최종가 ÷ 0.8. 셀러 부담 = 쿠폰 10% + 시스템 이용료 1% + 할인지원 0.5% = 11.5%. 등록가는 모니터링(세일 약 10일 전~3일 전) 전에 맞출 것.", rows: [
    ["듀얼포그", 2960], ["뮤직씽크가습기", 3440], ["냉온진동클렌저", 3790], ["무선뿌리볼륨고데기5000", 4560], ["아이케어", 4720], ["온열찜질기", 4050], ["플랜티플렛", 7110], ["히트스팟S", 4500], ["물결고데기", 4990], ["볼륨업무선고데기", 3900], ["듀얼포켓건", 3300], ["무선고데기", 3890]].map(([n, f]) => ({ n, f })) });
  const upd = (list, id, p) => setOps((prev) => ({ ...prev, [list]: (prev[list] || []).map((x) => x.id === id ? { ...x, ...p } : x) }));
  const Chip = ({ v, opts, onPick }) => { const [bg, fg] = ST_COLOR[v] || ["#f3f4f6", "#374151"]; return <select value={v} onChange={(e) => onPick(e.target.value)} style={{ fontSize: 11, fontWeight: 800, padding: "2px 6px", borderRadius: 20, border: 0, background: bg, color: fg, cursor: "pointer" }}>{opts.map((o) => <option key={o}>{o}</option>)}</select>; };
  const [view, setView0] = useState("glance");
  const [who, setWho0] = useState("");
  useEffect(() => { setWho0(me()); }, []);
  const setWho = (m) => { setWho0(m); try { localStorage.setItem("oa_board_me", m); } catch {} };
  const [mOff, setMOff] = useState(0);
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
  const today = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
  const md = (d) => !d ? "" : d.slice(0, 4) !== today.slice(0, 4) ? d.slice(2, 4) + "/" + d.slice(5).replace("-", "/") : d.slice(5).replace("-", "/");
  const Who = () => <div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 12, fontWeight: 700, color: C.inkLt, marginRight: 2 }}>나는</span>{TEAM.map((m) => <button key={m} onClick={() => setWho(m)} style={{ fontSize: 13, fontWeight: 800, padding: "4px 12px", borderRadius: 20, cursor: "pointer", border: `1px solid ${who === m ? C.rose : C.border}`, background: who === m ? C.rose : C.white, color: who === m ? "#fff" : C.inkMid }}>{m}</button>)}</div>;
  const MonthCal = ({ compact }) => {
    const base = new Date(today + "T00:00:00"); base.setDate(1); base.setMonth(base.getMonth() + mOff);
    const y = base.getFullYear(), mo = base.getMonth();
    const first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
    const cells = []; for (let i = 0; i < first; i++) cells.push(null); for (let d = 1; d <= days; d++) cells.push(`${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`); while (cells.length % 7) cells.push(null);
    const items = (d) => [
      ...(cal || []).filter((e) => e.date <= d && d <= (e.end || e.date)).map((e) => ({ k: e.id, t: e.title, c: KIND_C[e.kind] || "#6b7280", note: e.note, start: e.date === d, own: e.owner })),
      ...(ops.todos || []).filter((t) => t.due === d && !t.done).map((t) => ({ k: t.id, t: "☐ " + t.text, c: "#0f172a", todo: true, own: t.owner })),
    ];
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <button onClick={() => setMOff(mOff - 1)} style={{ border: `1px solid ${C.border}`, background: C.white, borderRadius: 8, cursor: "pointer", padding: "2px 9px" }}>‹</button>
          <div style={{ fontSize: 15, fontWeight: 900, color: C.ink, minWidth: 92, textAlign: "center" }}>{y}년 {mo + 1}월</div>
          <button onClick={() => setMOff(mOff + 1)} style={{ border: `1px solid ${C.border}`, background: C.white, borderRadius: 8, cursor: "pointer", padding: "2px 9px" }}>›</button>
          {mOff !== 0 && <button onClick={() => setMOff(0)} style={{ fontSize: 12, border: 0, background: "none", color: C.rose, cursor: "pointer", fontWeight: 700 }}>오늘</button>}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: C.inkLt }}>{Object.entries(KIND_C).map(([k, c]) => <span key={k} style={{ marginLeft: 8 }}><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 7, background: c, marginRight: 3 }} />{k}</span>)}<span style={{ marginLeft: 8 }}>☐ 할 일 마감</span></span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
          {["일", "월", "화", "수", "목", "금", "토"].map((w, i) => <div key={w} style={{ fontSize: 11, fontWeight: 800, textAlign: "center", padding: "5px 0", background: C.cream, color: i === 0 ? "#dc2626" : i === 6 ? "#2563eb" : C.inkMid, borderBottom: `1px solid ${C.border}` }}>{w}</div>)}
          {cells.map((d, i) => { const its = d ? items(d) : []; const isT = d === today; return (
            <div key={i} onDoubleClick={() => { if (!d) return; const title = prompt(`${md(d)} 일정 이름`); if (!title) return; const kind = prompt("종류: 행사/물류/판매/계약/인증/기타", "기타") || "기타"; setCal((p) => [...(p || []), { id: "c" + Date.now(), date: d, end: "", title, kind, note: "", owner: who }]); }}
              style={{ minHeight: compact ? 64 : 92, padding: 4, borderRight: (i % 7) < 6 ? `1px solid ${C.border}` : 0, borderBottom: `1px solid ${C.border}`, background: !d ? "#fafafa" : isT ? "#EAF3FF" : C.white, cursor: d ? "copy" : "default" }}>
              {d && <div style={{ fontSize: 11, fontWeight: isT ? 900 : 600, color: isT ? C.rose : (i % 7 === 0 ? "#dc2626" : C.inkMid) }}>{+d.slice(8)}{isT ? " 오늘" : ""}</div>}
              {its.slice(0, compact ? 3 : 5).map((x) => x.start === false ? <div key={x.k} title={x.t} style={{ marginTop: 2, height: 5, borderRadius: 3, background: x.c, opacity: 0.55 }} /> : <div key={x.k} title={`${x.t}${x.own ? ` · ${x.own}` : ""}${x.note ? "\n" + x.note : ""}`} style={{ marginTop: 2, fontSize: 10.5, lineHeight: 1.25, fontWeight: 700, borderRadius: 4, padding: "1px 4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", background: x.todo ? (x.own && x.own === who ? "#fde68a" : "#f1f5f9") : x.c + "22", color: x.todo ? "#0f172a" : x.c, borderLeft: x.todo ? 0 : `3px solid ${x.c}` }}>{x.t}</div>)}
              {its.length > (compact ? 3 : 5) && <div style={{ fontSize: 10, color: C.inkLt }}>+{its.length - (compact ? 3 : 5)}</div>}
            </div>); })}
        </div>
        <div style={{ fontSize: 11, color: C.inkLt, marginTop: 6 }}>날짜를 더블클릭하면 일정을 추가해요. 할 일에 마감일을 넣으면 달력에도 떠요.</div>
      </div>
    );
  };
  const Mine = () => {
    if (!who) return <Card style={{ padding: "16px 18px", border: `2px solid ${C.rose}` }}><div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}><div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>내가 챙길 것</div><span style={{ fontSize: 13, color: C.inkMid }}>이름을 고르면 내 할 일만 모아 보여줘요 →</span>{Who()}</div></Card>;
    const myTodos = openTodos.filter((t) => t.owner === who).sort((a, b2) => (a.due || "9").localeCompare(b2.due || "9"));
    const myWaits = (ops.waits || []).filter((w) => w.owner === who && (w.status === "대기" || w.status === "보낼 것" || w.status === "회신"));
    const myCal = upcoming.filter((e) => e.owner === who || !e.owner).filter((e) => -daysSince(e.date) <= 14);
    const myInf = (inf.people || []).filter((x) => x.owner === who && x.stage < 5);
    const free = openTodos.filter((t) => !t.owner);
    const Row = ({ left, children, right, warn }) => <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "7px 0", borderTop: `1px solid ${C.border}` }}>{left}<div style={{ flex: 1, fontSize: 13, color: C.ink, lineHeight: 1.45 }}>{children}</div>{right && <span style={{ fontSize: 11, fontWeight: 800, color: warn ? "#dc2626" : C.inkLt, whiteSpace: "nowrap" }}>{right}</span>}</div>;
    const total = myTodos.length + myWaits.length + myInf.length;
    return (
      <Card style={{ padding: "16px 18px", border: `2px solid ${C.rose}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}><div style={{ fontSize: 17, fontWeight: 900, color: C.ink }}>{who}님이 챙길 것</div><span style={{ fontSize: 13, fontWeight: 800, color: total ? C.rose : C.inkLt }}>{total}건</span><div style={{ flex: 1 }} />{Who()}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16, marginTop: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.inkLt, marginBottom: 2 }}>내 할 일 {myTodos.length}</div>
            {myTodos.map((t) => { const n = t.due ? -daysSince(t.due) : null; return <Row key={t.id} left={<input type="checkbox" checked={false} onChange={() => upd("todos", t.id, { done: true })} style={{ marginTop: 3, cursor: "pointer" }} />} right={t.due ? (n < 0 ? `${-n}일 지남` : n === 0 ? "오늘" : `D-${n}`) : "마감 없음"} warn={n !== null && n <= 3}>{t.text}</Row>; })}
            {!myTodos.length && <div style={{ fontSize: 13, color: C.inkLt, padding: "6px 0" }}>맡은 할 일이 없어요. 아래에서 가져가세요.</div>}
            {myWaits.length > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: C.inkLt, margin: "10px 0 2px" }}>내가 연락한 곳 {myWaits.length}</div>}
            {myWaits.map((w) => { const d = daysSince(w.sent); return <Row key={w.id} left={<span style={{ fontSize: 11, fontWeight: 800, background: ST_COLOR[w.status][0], color: ST_COLOR[w.status][1], borderRadius: 20, padding: "1px 7px", whiteSpace: "nowrap" }}>{w.status}</span>} right={w.status === "대기" && w.sent ? (d ? `${d}일째` : "오늘 보냄") : w.status === "회신" ? "답 확인하기" : "보내기"} warn={(w.status === "대기" && d >= 5) || w.status !== "대기"}><b>{w.who}</b> {w.person}</Row>; })}
            {myInf.length > 0 && <div style={{ fontSize: 12, fontWeight: 800, color: C.inkLt, margin: "10px 0 2px" }}>내 인플루언서 {myInf.length}</div>}
            {myInf.map((x) => <Row key={x.id} left={<span style={{ fontSize: 11, fontWeight: 800, color: C.rose }}>{INF_STAGES[x.stage]}</span>}>{x.name} <span style={{ color: C.inkLt }}>{x.product}</span></Row>)}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.inkLt, marginBottom: 2 }}>2주 안에 있는 일정</div>
            {myCal.map((e) => <Row key={e.id} left={<span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 7, background: KIND_C[e.kind] || "#6b7280", marginTop: 6 }} />} right={-daysSince(e.date) <= 0 ? "진행 중" : `D-${-daysSince(e.date)}`} warn={-daysSince(e.date) <= 3}>{e.title}</Row>)}
            {!myCal.length && <div style={{ fontSize: 13, color: C.inkLt, padding: "6px 0" }}>2주 안 일정 없음</div>}
            {free.length > 0 && <><div style={{ fontSize: 12, fontWeight: 800, color: "#dc2626", margin: "10px 0 2px" }}>담당 없는 일 {free.length} — 가져가기</div>
              {free.map((t) => <Row key={t.id} right={null} left={<button onClick={() => upd("todos", t.id, { owner: who })} style={{ fontSize: 11, fontWeight: 800, border: `1px solid ${C.rose}`, color: C.rose, background: C.white, borderRadius: 20, padding: "1px 8px", cursor: "pointer", whiteSpace: "nowrap" }}>내가 할게</button>}>{t.text}{t.due ? <span style={{ color: C.inkLt }}> · {md(t.due)}까지</span> : ""}</Row>)}</>}
          </div>
        </div>
      </Card>
    );
  };
  const rankSeries = () => { const by = {}; for (const r of rk.rows || []) { (by[r.kw + "|" + r.gd] ||= []).push(r); } return Object.values(by).map((a) => a.sort((x, y) => x.t.localeCompare(y.t))); };
  const rkTxt = (r) => r.rank ? `${r.rank}위` : `${r.scanned}위 밖`;
  const Spark = ({ a }) => { const pts = a.map((r) => r.rank || r.scanned + 20); if (pts.length < 2) return <span style={{ fontSize: 11, color: C.inkLt }}>기록 1회</span>; const mx = Math.max(...pts), mn = Math.min(...pts); const W = 90, Hh = 24; return <svg width={W} height={Hh}><polyline fill="none" stroke={C.rose} strokeWidth="2" points={pts.map((v, i) => `${(i / (pts.length - 1)) * (W - 4) + 2},${mx === mn ? Hh / 2 : 2 + ((v - mn) / (mx - mn)) * (Hh - 4)}`).join(" ")} /></svg>; };
  const AdsView = ({ compact }) => {
    const ser = rankSeries(); const q = ads.qcash || {}; const left = (q.start || 0) - (q.used || 0);
    const live = (e) => e && -daysSince(e) >= 0;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          {[["키워드플러스", `${(ads.kwplus?.items || []).length}건`, `${ads.kwplus?.period} · ${live(ads.kwplus?.end) ? `종료 D-${-daysSince(ads.kwplus.end)}` : "종료"}`],
            ["파워랭크업", `${(ads.powerup?.items || []).length}상품`, `${ads.powerup?.period} · ${live(ads.powerup?.end) ? `종료 D-${-daysSince(ads.powerup.end)}` : "종료"}`],
            ["남은 Q캐시", left.toLocaleString(), `시작 ${(q.start || 0).toLocaleString()} · 사용 ${(q.used || 0).toLocaleString()}`],
            ["순위 갱신", rk.updated ? md(rk.updated.slice(0, 10)) + " " + rk.updated.slice(11) : "—", "하루 5번 자동"]].map(([k, v, sub]) => (
            <div key={k} style={{ border: `1px solid ${C.border}`, background: C.white, borderRadius: 14, padding: "12px 14px" }}><div style={{ fontSize: 12, fontWeight: 700, color: C.inkLt }}>{k}</div><div style={{ fontSize: 24, fontWeight: 900, color: C.ink, marginTop: 2 }}>{v}</div><div style={{ fontSize: 12, color: C.inkMid, marginTop: 2 }}>{sub}</div></div>))}
        </div>
        <Card style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>큐텐 검색 순위</div><span style={{ fontSize: 12, color: C.inkLt }}>자연검색 순위 · 광고 구좌 노출 · 첫 기록(11/09 15:51)은 광고 시작 전</span><div style={{ flex: 1 }} /><a href="/m/qoo10" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.rose, fontWeight: 700, marginRight: 10 }}>📱 모바일</a><a href="https://oa-qoo10-ads.vercel.app" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.rose, fontWeight: 700 }}>리포트 ↗</a></div>
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 13 }}>
            <thead><tr style={{ color: C.inkLt, fontSize: 11, textAlign: "left" }}>{["검색어", "상품", "지금", "변화", "광고 구좌", "추이", "검색/일", "입찰/일"].map((h) => <th key={h} style={{ padding: "6px 6px", borderBottom: `1px solid ${C.border}`, fontWeight: 800 }}>{h}</th>)}</tr></thead>
            <tbody>{ser.map((a) => { const last = a[a.length - 1], prev = a[a.length - 2]; const kw = (ads.kwplus?.items || []).find((x) => x.kw === last.kw); let ch = null; if (prev) { const p0 = prev.rank || prev.scanned + 1, p1 = last.rank || last.scanned + 1; ch = p0 - p1; } return (
              <tr key={last.kw + last.gd} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "7px 6px", fontWeight: 700, color: C.ink }}>{last.kw}</td>
                <td style={{ padding: "7px 6px", color: C.inkMid }}>{last.name}</td>
                <td style={{ padding: "7px 6px", fontWeight: 900, color: last.rank && last.rank <= 40 ? "#16a34a" : last.rank ? C.ink : C.inkLt }}>{rkTxt(last)}</td>
                <td style={{ padding: "7px 6px", fontWeight: 800, color: ch > 0 ? "#16a34a" : ch < 0 ? "#dc2626" : C.inkLt }}>{ch === null ? "—" : ch > 0 ? `▲${ch}` : ch < 0 ? `▼${-ch}` : "–"}</td>
                <td style={{ padding: "7px 6px", color: last.ad ? C.rose : C.inkLt, fontWeight: 700 }}>{last.ad ? `광고 ${last.ad}번째` : `미노출 (구좌 ${last.adn})`}</td>
                <td style={{ padding: "4px 6px" }}><Spark a={a} /></td>
                <td style={{ padding: "7px 6px", color: C.inkMid }}>{kw ? kw.search.toLocaleString() : "—"}</td>
                <td style={{ padding: "7px 6px", color: C.inkMid }}>{kw ? `¥${kw.bid.toLocaleString()}` : "—"}</td>
              </tr>); })}</tbody></table></div>
          {!ser.length && <div style={{ fontSize: 13, color: C.inkLt, padding: 12 }}>순위 기록이 아직 없어요.</div>}
          <div style={{ fontSize: 11, color: C.inkLt, marginTop: 8 }}>「N위 밖」= 검색 결과를 N개까지 내려봐도 없었음. 40위 안이면 초록. {ads.note}</div>
        </Card>
      </div>
    );
  };
  const Goals = () => {
    const dl = goals.daily || {};
    const dkeys = []; for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() + 9 * 36e5 - i * 864e5).toISOString().slice(0, 10); dkeys.push(d); }
    const qty = (d) => (sales.days || {})[d]?.qty || 0;
    const yest = dkeys[12], tdy = dkeys[13]; const now7 = dkeys.slice(6, 13).reduce((a, d) => a + qty(d), 0) / 7;
    const autoNow = sales.updated ? qty(yest) : (+dl.now || 0);
    const pct = Math.min(100, Math.round((autoNow / (+dl.goal || 10)) * 100)); const mxq = Math.max(+dl.goal || 10, ...dkeys.map(qty));
    const SC = { "완료": ["#16a34a", "#dcfce7"], "진행": ["#d97706", "#fef3c7"], "준비": ["#6b7280", "#f3f4f6"] };
    const cycle = (st) => ({ "준비": "진행", "진행": "완료", "완료": "준비" }[st] || "준비");
    return (
      <Card style={{ padding: "16px 18px", background: C.ink }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 18, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#9aa3b2", letterSpacing: ".04em" }}>목표 ① 입점</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>{(goals.shops || []).map((x) => { const [fg, bg] = SC[x.status] || SC["준비"]; return (
              <button key={x.id} title={x.note + " (누르면 상태 변경)"} onClick={() => setGoals((g) => ({ ...g, shops: g.shops.map((y) => y.id === x.id ? { ...y, status: cycle(y.status) } : y) }))} style={{ flex: 1, textAlign: "left", cursor: "pointer", border: 0, borderRadius: 12, padding: "10px 12px", background: x.status === "완료" ? "#16a34a" : "#1f2430" }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{x.status === "완료" ? "✓ " : ""}{x.name}</div>
                <div style={{ display: "inline-block", marginTop: 4, fontSize: 11, fontWeight: 800, color: x.status === "완료" ? "#fff" : fg, background: x.status === "완료" ? "rgba(255,255,255,.2)" : bg, borderRadius: 20, padding: "1px 8px" }}>{x.status}</div>
                <div style={{ fontSize: 11, color: x.status === "완료" ? "#dcfce7" : "#9aa3b2", marginTop: 5, lineHeight: 1.4 }}>{x.note}</div>
              </button>); })}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#9aa3b2", letterSpacing: ".04em" }}>목표 ② 큐텐 하루 판매</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#9aa3b2" }}>어제</span><span style={{ fontSize: 40, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>{autoNow}</span><span style={{ fontSize: 18, fontWeight: 800, color: "#9aa3b2" }}>/ {dl.goal || 10}개</span><span style={{ fontSize: 12, color: "#9aa3b2", marginLeft: 6 }}>오늘 {qty(tdy)} · 7일 평균 {now7.toFixed(1)}</span>
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 34 }} title="최근 14일 판매 개수">{dkeys.map((d) => <div key={d} title={`${md(d)} ${qty(d)}개`} style={{ width: 7, height: Math.max(2, (qty(d) / mxq) * 34), background: qty(d) >= (+dl.goal || 10) ? "#16a34a" : d === tdy ? "#9aa3b2" : "#2997FF", borderRadius: 2 }} />)}</div>
            </div>
            <div style={{ height: 10, borderRadius: 10, background: "#1f2430", marginTop: 6, overflow: "hidden" }}><div style={{ width: `${Math.max(pct, 2)}%`, height: "100%", background: pct >= 100 ? "#16a34a" : "#2997FF", borderRadius: 10 }} /></div>
            <div style={{ fontSize: 11.5, color: "#9aa3b2", marginTop: 6, lineHeight: 1.5 }}>{pct}% · 큐텐 판매자센터에서 자동 집계 ({sales.updated ? md(sales.updated.slice(0, 10)) + " " + sales.updated.slice(11) : "대기"}, 매시 10분) · {dl.note}</div>
          </div>
        </div>
      </Card>
    );
  };
  const PriceView = () => {
    const items = (qprod.items || []).filter((x) => x.stat !== "S4");
    const f = pf;
    const yearLater = new Date(Date.now() + 9 * 36e5 + 365 * 864e5).toISOString().slice(0, 10);
    const weekLater = new Date(Date.now() + 9 * 36e5 + 7 * 864e5).toISOString().slice(0, 10);
    const open = (x, kind) => { setPfErr(""); setPfAsk(""); setPf({ gdno: x.gd_no, name: x.name || x.jp, cur: x.sell_price, kind, price: kind === "price" ? Math.round(x.sell_price * 0.9) : x.sell_price, unit: "R", value: 10, start: today, end: kind === "price" ? yearLater : weekLater, memo: "" }); setTimeout(() => document.getElementById("qoo10-price-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); };
    const submit = (confirmed) => {
      if (!f.end || f.end < f.start) return setPfErr("종료일을 시작일 이후로 넣어 주세요.");
      if (f.kind === "price" && !(+f.price > 0 && +f.price < +f.cur)) return setPfErr(`판매가(¥${(+f.cur).toLocaleString()})보다 낮은 금액을 넣어 주세요. 큐텐은 판매가는 두고 할인으로 가격을 바꿔요.`);
      if (f.kind === "discount" && !(+f.value > 0) ) return setPfErr("할인율이나 할인액을 넣어 주세요.");
      setPfErr("");
      const after = f.kind === "price" ? +f.price : f.unit === "R" ? Math.round(f.cur * (1 - f.value / 100)) : f.cur - f.value;
      const megaWarn = (cal || []).some((e) => /메가와리/.test(e.title) && !/신청/.test(e.title) && -daysSince(e.date) >= 0 && -daysSince(e.date) <= 14) ? "\n⚠ 메가와리 2주 전 가격 유지 기간일 수 있어요(행사 제외 위험)." : "";
      const msg = f.kind === "price" ? `「${f.name}」 고객가를 ¥${(+f.price).toLocaleString()}로 바꿀까요?\n판매가 ¥${(+f.cur).toLocaleString()}는 그대로 두고 정액 할인 ¥${(+f.cur - +f.price).toLocaleString()} (${md(f.start)}~${md(f.end)})으로 큐텐에 설정해요.` : `「${f.name}」 할인 행사 ${f.unit === "R" ? f.value + "%" : "¥" + f.value} (${md(f.start)}~${md(f.end)})\n고객가 약 ¥${after.toLocaleString()} — 큐텐에 등록할까요?`;
      if (!confirmed) { setPfAsk(msg + megaWarn); return; }
      setPfAsk("");
      const id = "j" + Date.now();
      const job = f.kind === "price" ? { ...f, kind: "discount", mode: "price", unit: "M", value: +f.cur - +f.price } : f;
      setJobs((p) => [{ id, ...job, by: who || "", status: "요청됨", at: new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 16).replace("T", " ") }, ...(p || [])]);
      setCal((p) => [...(p || []), f.kind === "price" ? { id: "c" + id, date: f.start, end: f.end, title: `가격 변경(할인): ${f.name} → ¥${(+f.price).toLocaleString()}`, kind: "가격", note: `판매가 ¥${(+f.cur).toLocaleString()} 유지, 정액 할인 ¥${(+f.cur - +f.price).toLocaleString()}${f.memo ? " · " + f.memo : ""}`, owner: who } : { id: "c" + id, date: f.start, end: f.end, title: `할인 행사: ${f.name} ${f.unit === "R" ? f.value + "%" : "¥" + f.value}`, kind: "행사", note: `고객가 약 ¥${after.toLocaleString()}${f.memo ? " · " + f.memo : ""}`, owner: who }]);
      setPf(null); setPfErr("");
      setTimeout(() => document.getElementById("qoo10-promo-status")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    };
    const inp = { fontSize: 13, padding: "5px 8px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.cream };
    const SJ = { "요청됨": ["#fef3c7", "#92400e"], "적용 중": ["#dbeafe", "#1e40af"], "적용 완료": ["#dcfce7", "#166534"], "확인 필요": ["#fee2e2", "#991b1b"], "실패": ["#fee2e2", "#991b1b"], "끝남": ["#f3f4f6", "#6b7280"] };
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card style={{ padding: "12px 14px", border: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}><b style={{ fontSize: 14, color: C.ink }}>메가와리 행사안</b><span style={{ fontSize: 12, color: C.inkMid }}>{mega.title}</span><div style={{ flex: 1 }} /><a href="/qoo10-margin/channel-margins.html?channel=Qoo10" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.rose, fontWeight: 700 }}>마진 계산기에서 원가 대조 ↗</a></div>
          <div style={{ fontSize: 12, color: C.inkLt, margin: "4px 0 8px" }}>{mega.note}</div>
          <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
            <thead><tr style={{ color: C.inkLt, fontSize: 11 }}>{["상품", "최종가(쿠폰 후)", "등록가(÷0.8)", "셀러 부담 11.5%", "셀러 실수령(수수료 전)", "현재 고객가(할인 적용)", "차이"].map((h, i) => <th key={h} style={{ textAlign: i ? "right" : "left", padding: "4px 6px", borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>{h}</th>)}</tr></thead>
            <tbody>{(mega.rows || []).map((r) => { const reg = Math.ceil(r.f / 0.8); const burden = Math.round(reg * 0.115); const q = items.find((x) => (x.name || "").replace(/\s/g, "").includes(r.n.replace(/5000$/, "").replace(/\s/g, "").slice(0, 5))); const cur = q ? +(q.final_price && +q.final_price < +q.sell_price ? q.final_price : q.sell_price) : null; const diff = cur != null ? reg - cur : null;
              return <tr key={r.n} style={{ borderBottom: `1px dashed ${C.border}` }}><td style={{ padding: "5px 6px", fontWeight: 700, color: C.ink }}>{r.n}</td><td style={{ textAlign: "right", padding: "5px 6px" }}>¥{r.f.toLocaleString()}</td><td style={{ textAlign: "right", padding: "5px 6px", fontWeight: 800 }}>¥{reg.toLocaleString()}</td><td style={{ textAlign: "right", padding: "5px 6px", color: "#b45309" }}>−¥{burden.toLocaleString()}</td><td style={{ textAlign: "right", padding: "5px 6px" }}>¥{(reg - burden).toLocaleString()}</td><td style={{ textAlign: "right", padding: "5px 6px", color: C.inkMid }}>{cur != null ? `¥${cur.toLocaleString()}` : "—"}</td><td style={{ textAlign: "right", padding: "5px 6px", fontWeight: 800, color: diff == null ? C.inkLt : diff > 0 ? "#dc2626" : "#16a34a" }}>{diff == null ? "" : (diff > 0 ? "+" : "") + "¥" + diff.toLocaleString()}</td></tr>; })}</tbody>
          </table></div>
          <div style={{ fontSize: 11, color: C.inkLt, marginTop: 6 }}>차이가 +면 지금 고객가보다 올려 등록해야 최종가가 맞음(큐텐은 판매가는 두고 할인으로 조정) → 모니터링 기간 전에 올릴 것(기간 중 인상은 제외 사유). 이 표는 기록용이며 큐텐에 자동 반영되지 않음.</div>
        </Card>
        {f && <div id="qoo10-price-form"><Card style={{ padding: "14px 16px", border: `2px solid ${C.rose}` }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>{f.kind === "price" ? "가격 변경 (할인으로 설정)" : "할인 행사 등록"} · {f.name} <span style={{ fontSize: 12, color: C.inkLt, fontWeight: 600 }}>지금 ¥{(+f.cur).toLocaleString()}</span></div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginTop: 10 }}>
            {f.kind === "price" ? <>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkLt, display: "flex", flexDirection: "column", gap: 3 }}>바꿀 고객가(円)<input type="number" defaultValue={f.price} onBlur={(e) => setPf({ ...f, price: +e.target.value })} style={{ ...inp, width: 110 }} /></label>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkLt, display: "flex", flexDirection: "column", gap: 3 }}>시작<input type="date" value={f.start} onChange={(e) => setPf({ ...f, start: e.target.value })} style={inp} /></label>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkLt, display: "flex", flexDirection: "column", gap: 3 }}>종료<input type="date" value={f.end} onChange={(e) => setPf({ ...f, end: e.target.value })} style={inp} /></label></> : <>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkLt, display: "flex", flexDirection: "column", gap: 3 }}>방식<select value={f.unit} onChange={(e) => setPf({ ...f, unit: e.target.value })} style={inp}><option value="R">정률(%)</option><option value="M">정액(円)</option></select></label>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkLt, display: "flex", flexDirection: "column", gap: 3 }}>{f.unit === "R" ? "할인율 %" : "할인액 円"}<input type="number" defaultValue={f.value} onBlur={(e) => setPf({ ...f, value: +e.target.value })} style={{ ...inp, width: 90 }} /></label>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkLt, display: "flex", flexDirection: "column", gap: 3 }}>시작<input type="date" value={f.start} onChange={(e) => setPf({ ...f, start: e.target.value })} style={inp} /></label>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkLt, display: "flex", flexDirection: "column", gap: 3 }}>종료<input type="date" value={f.end} onChange={(e) => setPf({ ...f, end: e.target.value })} style={inp} /></label></>}
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkLt, display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 160 }}>메모(이유)<input defaultValue={f.memo} onBlur={(e) => setPf({ ...f, memo: e.target.value })} style={inp} /></label>
            <button onClick={() => submit(false)} style={{ fontSize: 13, fontWeight: 800, border: 0, borderRadius: 20, padding: "7px 16px", cursor: "pointer", background: C.rose, color: "#fff" }}>큐텐에 반영</button>
            <button onClick={() => setPf(null)} style={{ fontSize: 13, fontWeight: 700, border: `1px solid ${C.border}`, borderRadius: 20, padding: "6px 14px", cursor: "pointer", background: C.white }}>취소</button>
          </div>
          {pfErr && <div style={{ marginTop: 8, fontSize: 13, fontWeight: 800, color: "#dc2626" }}>⚠ {pfErr}</div>}
          {pfAsk && <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 12, background: "#fff7d6", border: "1px solid #fcd34d" }}>
            <div style={{ fontSize: 13.5, color: C.ink, whiteSpace: "pre-line", lineHeight: 1.55 }}>{pfAsk}</div>
            <div style={{ fontSize: 12, color: C.inkMid, marginTop: 4 }}>반영하기를 누르면 5분 안에 큐텐 판매자센터에 들어가요.</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={() => submit(true)} style={{ fontSize: 13, fontWeight: 900, border: 0, borderRadius: 20, padding: "7px 18px", cursor: "pointer", background: "#16a34a", color: "#fff" }}>반영하기</button>
              <button onClick={() => setPfAsk("")} style={{ fontSize: 13, fontWeight: 700, border: `1px solid ${C.border}`, borderRadius: 20, padding: "6px 14px", cursor: "pointer", background: C.white }}>다시 볼게요</button>
            </div>
          </div>}
          <div style={{ fontSize: 11.5, color: C.inkLt, marginTop: 8 }}>판매가는 건드리지 않고 큐텐 할인 설정으로만 바꿔요. 마진은 「마진 계산」 탭에서 먼저 확인하세요. 등록하면 캘린더에도 자동으로 들어가요. 할인은 큐텐이 기간에 맞춰 알아서 켜고 꺼요.</div>
        </Card></div>}
        <div id="qoo10-promo-status"><Card style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>행사 현황</div><span style={{ fontSize: 12, color: C.inkLt }}>요청한 행사·가격 변경과 큐텐에 지금 걸린 할인</span></div>
          {(() => {
            const live = items.filter((x) => x.final_price && x.final_price < x.sell_price);
            const js = jobs || [];
            const groups = [["진행·예정", js.filter((j) => ["요청됨", "적용 중", "적용 완료", "확인 필요"].includes(j.status) && (!j.end || j.end >= today))], ["실패", js.filter((j) => j.status === "실패")], ["끝난 것", js.filter((j) => j.status === "끝남" || (j.status === "적용 완료" && j.end && j.end < today))]];
            const Row = ({ j }) => { const [bg, fg] = SJ[j.status] || ["#f3f4f6", "#374151"]; const left = j.end ? -daysSince(j.end) : null; return (
              <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderTop: `1px solid ${C.border}`, fontSize: 13, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 800, background: bg, color: fg, borderRadius: 20, padding: "1px 8px" }}>{j.status}</span>
                <b style={{ color: C.ink }}>{j.name}</b>
                <span style={{ color: C.inkMid }}>{j.kind === "cancel" ? "할인 끄기" : j.mode === "price" ? `가격 변경 → ¥${(+j.price).toLocaleString()}` : `할인 ${j.unit === "R" ? j.value + "%" : "¥" + j.value}`}{j.kind === "cancel" ? "" : ` · ${md(j.start)}~${md(j.end)}`}</span>
                {left !== null && left >= 0 && <span style={{ fontSize: 11, fontWeight: 800, color: left <= 2 ? "#dc2626" : C.inkLt }}>{left === 0 ? "오늘 종료" : `종료 D-${left}`}</span>}
                <div style={{ flex: 1 }} /><span style={{ fontSize: 11, color: C.inkLt }}>{j.by}{j.by ? " · " : ""}{j.at}{j.result ? ` · ${j.result}` : ""}</span>
                {j.status === "요청됨" && <button onClick={() => setJobs((p) => p.filter((y) => y.id !== j.id))} style={{ fontSize: 11, border: 0, background: "none", color: C.inkLt, cursor: "pointer" }}>취소</button>}
              </div>); };
            return (<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))", gap: 16, marginTop: 8 }}>
              <div>
                {groups.map(([t, arr]) => arr.length > 0 && <div key={t} style={{ marginBottom: 8 }}><div style={{ fontSize: 12, fontWeight: 800, color: t === "실패" ? "#dc2626" : C.inkLt }}>{t} {arr.length}</div>{arr.slice(0, 20).map((j) => <Row key={j.id} j={j} />)}</div>)}
                {!js.length && <div style={{ fontSize: 13, color: C.inkLt, padding: "6px 0" }}>아직 요청한 행사가 없어요. 아래 표에서 「행사」나 「가격」을 누르세요.</div>}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.inkLt }}>큐텐에 지금 걸린 할인 {live.length} <span style={{ fontWeight: 500 }}>({qprod.updated ? md(qprod.updated.slice(0, 10)) + " " + qprod.updated.slice(11) : ""} 기준)</span></div>
                {live.map((x) => <div key={x.gd_no} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderTop: `1px solid ${C.border}`, fontSize: 13 }}><b style={{ flex: 1, color: C.ink }}>{x.name || x.jp}</b><span style={{ color: C.inkLt, textDecoration: "line-through" }}>¥{(+x.sell_price).toLocaleString()}</span><span style={{ fontWeight: 900, color: "#dc2626" }}>¥{(+x.final_price).toLocaleString()}</span><span style={{ fontSize: 11, color: C.inkLt }}>{x.discount_end_dt ? "~" + String(x.discount_end_dt).slice(5, 10).replace("-", "/") : ""}</span>
                  {(jobs || []).some((j) => j.kind === "cancel" && j.gdno === x.gd_no && ["요청됨", "적용 중"].includes(j.status)) ? <span style={{ fontSize: 11, fontWeight: 800, color: "#92400e" }}>끄는 중</span>
                    : offAsk === x.gd_no ? <><button onClick={() => { setOffAsk(""); setJobs((p) => [{ id: "j" + Date.now(), kind: "cancel", gdno: x.gd_no, name: x.name || x.jp, cur: x.sell_price, start: today, end: today, by: who || "", status: "요청됨", at: new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 16).replace("T", " ") }, ...(p || [])]); }} style={{ fontSize: 11, fontWeight: 900, border: 0, borderRadius: 20, padding: "2px 9px", cursor: "pointer", background: "#dc2626", color: "#fff" }}>정말 끄기</button><button onClick={() => setOffAsk("")} style={{ fontSize: 11, border: 0, background: "none", color: C.inkLt, cursor: "pointer" }}>아니요</button></>
                    : <button onClick={() => setOffAsk(x.gd_no)} style={{ fontSize: 11, fontWeight: 800, border: `1px solid ${C.border}`, borderRadius: 20, padding: "2px 9px", cursor: "pointer", background: C.white, color: C.inkMid }}>할인 끄기</button>}
                </div>)}
                {!live.length && <div style={{ fontSize: 13, color: C.inkLt, padding: "6px 0" }}>지금 할인 중인 상품이 없어요.</div>}
              </div>
            </div>);
          })()}
        </Card></div>
        <Card style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>큐텐 상품 가격</div><span style={{ fontSize: 12, color: C.inkLt }}>{items.length}개 · {qprod.updated ? `${md(qprod.updated.slice(0, 10))} ${qprod.updated.slice(11)} 기준` : ""} (매시 자동)</span></div>
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 13 }}>
            <thead><tr style={{ color: C.inkLt, fontSize: 11, textAlign: "left" }}>{["상품", "판매가", "고객가(할인)", "할인 종료", "30일 판매", "주간 PV", "리뷰", ""].map((h) => <th key={h} style={{ padding: "6px", borderBottom: `1px solid ${C.border}`, fontWeight: 800 }}>{h}</th>)}</tr></thead>
            <tbody>{items.map((x) => { const sold = (sales.products || []).find((y) => y.code === x.gd_no); const disc = x.final_price && x.final_price < x.sell_price; return (
              <tr key={x.gd_no} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "6px", fontWeight: 700, color: C.ink }} title={x.jp}>{x.name || x.jp}<div style={{ fontSize: 10.5, color: C.inkLt, fontWeight: 500 }}>{x.gd_no}</div></td>
                <td style={{ padding: "6px" }}>¥{(+x.sell_price).toLocaleString()}</td>
                <td style={{ padding: "6px", fontWeight: disc ? 800 : 400, color: disc ? "#dc2626" : C.inkLt }}>{disc ? `¥${(+x.final_price).toLocaleString()}` : "—"}</td>
                <td style={{ padding: "6px", color: C.inkLt, fontSize: 12 }}>{disc && x.discount_end_dt ? String(x.discount_end_dt).slice(5, 10).replace("-", "/") : ""}</td>
                <td style={{ padding: "6px", fontWeight: sold ? 800 : 400 }}>{sold ? sold.qty : 0}</td>
                <td style={{ padding: "6px", color: C.inkMid }}>{x.pv_week}</td>
                <td style={{ padding: "6px", color: C.inkMid }}>{x.reviews || 0}</td>
                <td style={{ padding: "6px", whiteSpace: "nowrap" }}><button onClick={() => open(x, "discount")} style={{ fontSize: 11, fontWeight: 800, border: `1px solid ${C.rose}`, color: C.rose, background: C.white, borderRadius: 20, padding: "2px 9px", cursor: "pointer", marginRight: 4 }}>행사</button><button onClick={() => open(x, "price")} style={{ fontSize: 11, fontWeight: 800, border: `1px solid ${C.border}`, color: C.inkMid, background: C.white, borderRadius: 20, padding: "2px 9px", cursor: "pointer" }}>가격</button></td>
              </tr>); })}</tbody></table></div>
          {!items.length && <div style={{ fontSize: 13, color: C.inkLt, padding: 12 }}>상품 목록을 불러오는 중이에요 (매시 10분 자동).</div>}
        </Card>
      </div>
    );
  };
  // 📱 모바일 큐텐: 폰에서 열면 m.qoo10.jp 실시간(iframe), PC는 큐텐이 PC화면으로 바꾸므로 아이폰으로 찍은 최신 화면(하루 5번 자동, ~/oa-qoo10-rank/mobile_shots.py)
  const MobileQ = () => {
    const items = (mob && mob.items) || []; const cur = items.find((x) => x.key === mobKey) || items[0];
    return (
      <Card style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 17, fontWeight: 900, color: C.ink }}>📱 모바일 큐텐 — 손님 폰 화면</span>
          <span style={{ fontSize: 12, color: C.inkLt }}>{isPhone ? "실시간 (지금 큐텐 그대로)" : `아이폰으로 찍은 화면 · ${mob?.updated || "—"} 기준 · 폰으로 열면 실시간`}</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {items.map((x) => <button key={x.key} onClick={() => setMobKey(x.key)} style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 20, cursor: "pointer", border: `1px solid ${x.key === (cur && cur.key) ? C.rose : C.border}`, background: x.key === (cur && cur.key) ? C.rose : "#fff", color: x.key === (cur && cur.key) ? "#fff" : C.ink }}>{x.label}</button>)}
        </div>
        {cur ? <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ width: 300, maxWidth: "100%", height: 600, border: "10px solid #141414", borderRadius: 36, overflow: "auto", background: "#fff" }}>
            {isPhone ? <iframe src={cur.url} title={cur.label} style={{ width: "100%", height: "100%", border: 0 }} /> : <img src={cur.img} alt={cur.label} style={{ width: "100%", display: "block" }} />}
          </div>
          <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.7, minWidth: 0, flex: 1 }}>
            <div><b>{cur.label}</b></div>
            <a href={cur.url} target="_blank" rel="noreferrer" style={{ color: C.rose, fontWeight: 700 }}>큐텐에서 바로 열기 ↗</a>
            <div style={{ color: C.inkLt, marginTop: 6 }}>폰(아이폰·안드로이드)에서 이 대시보드를 열면 틀 안에 진짜 큐텐이 실시간으로 떠서 스크롤·검색이 됩니다. PC에서는 큐텐이 PC 화면으로 바꿔 버려서 최신 캡처를 보여줍니다.</div>
          </div>
        </div> : <div style={{ fontSize: 13, color: C.inkLt, marginTop: 10 }}>화면을 불러오는 중…</div>}
      </Card>
    );
  };
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
        {Mine()}
        {MobileQ()}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <Tile k="첫 입고까지" v={jp.due ? dd(jp.due) : "—"} sub={jp.due ? `${jp.due.slice(5).replace("-", "/")} 목표 · USB 무선 5종` : "기한 미정"} warn={jp.due && -daysSince(jp.due) <= 14} go="jp" />
          <Tile k="답 기다리는 곳" v={`${waiting.filter((w) => w.status === "대기").length}곳`} sub={`${oldest != null ? `가장 오래 ${oldest}일째` : ""}${toSend ? ` · 보낼 것 ${toSend}건` : ""}`} warn={oldest >= 5 || toSend > 0} go="ops" />
          <Tile k="남은 할 일" v={`${openTodos.length}개`} sub={unassigned ? `담당 없음 ${unassigned}개` : "모두 담당 지정됨"} warn={unassigned > 0} go="ops" />
          <Tile k="다음 일정" v={next ? dd(next.date) : "—"} sub={next ? next.title : "예정 없음"} go="cal" />
        </div>
        <Card style={{ padding: "14px 16px" }}>{MonthCal({ compact: true })}</Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
          <Card style={{ padding: "14px 16px" }}>
            <H t="팀 전체 할 일" sub={`${openTodos.length}개 남음`} go="ops" />
            {openTodos.map((t) => (
              <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", borderTop: `1px solid ${C.border}` }}>
                <input type="checkbox" checked={false} onChange={() => upd("todos", t.id, { done: true })} style={{ marginTop: 3, cursor: "pointer" }} />
                <span style={{ flex: 1, fontSize: 13, color: C.ink, lineHeight: 1.45 }}>{t.text}{t.due ? <span style={{ fontSize: 11, color: C.inkLt }}> · {md(t.due)}까지</span> : ""}</span>
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
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
          <Card style={{ padding: "14px 16px" }}>
            <H t="큐텐 광고·순위" sub={rk.updated ? `${md(rk.updated.slice(0, 10))} ${rk.updated.slice(11)} 기준` : ""} go="ads" />
            <div style={{ fontSize: 12, color: C.inkMid, marginBottom: 6 }}>키워드플러스 {(ads.kwplus?.items || []).length}건 · 파워랭크업 {(ads.powerup?.items || []).length}상품 · {-daysSince(ads.kwplus?.end) >= 0 ? `종료 D-${-daysSince(ads.kwplus.end)}` : "종료"} · Q캐시 {((ads.qcash?.start || 0) - (ads.qcash?.used || 0)).toLocaleString()} 남음</div>
            {rankSeries().map((a) => { const l = a[a.length - 1]; return <div key={l.kw + l.gd} style={{ display: "flex", gap: 8, fontSize: 12.5, padding: "3px 0", borderTop: `1px solid ${C.border}` }}><span style={{ flex: 1, color: C.ink, fontWeight: 700 }}>{l.name}</span><span style={{ color: C.inkLt }}>{l.kw}</span><span style={{ width: 70, textAlign: "right", fontWeight: 900, color: l.rank && l.rank <= 40 ? "#16a34a" : l.rank ? C.ink : C.inkLt }}>{rkTxt(l)}</span></div>; })}
          </Card>
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
      {Goals()}
      <Card style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.ink, marginRight: 6 }}>🇯🇵 해외</div>
          {[["glance", "한눈에"], ["jp", "일본 진행판"], ["ops", "인증·연락·할 일"], ["ads", "광고·순위"], ["price", "가격·행사"], ["margin", "마진 계산"], ["cal", "캘린더"], ["inf", "인플루언서"], ["hist", "한 일 기록"], ["calc", "판매가 계산"]].map(([k, l]) => <button key={k} onClick={() => setView(k)} style={{ fontSize: 13, fontWeight: 800, padding: "6px 12px", borderRadius: 20, cursor: "pointer", border: 0, background: view === k ? C.ink : "transparent", color: view === k ? "#fff" : C.inkMid }}>{l}</button>)}
          <div style={{ flex: 1 }} /><span style={{ fontSize: 12, color: C.inkLt }}>담당 김경은 · 조영서 · 차동욱</span>
        </div>
      </Card>
      {view === "glance" && Glance()}
      {view === "ads" && AdsView({})}
      {view === "price" && PriceView()}
      {view === "margin" && <Card style={{ padding: 0, overflow: "hidden" }}><div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}><b style={{ fontSize: 14, color: C.ink }}>큐텐 마진 계산기</b><span style={{ fontSize: 12, color: C.inkLt }}>차동욱 님 제작 · 사내 마진계산기 엑셀 로직</span><div style={{ flex: 1 }} /><a href="/qoo10-margin/channel-margins.html?channel=Qoo10" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.rose, fontWeight: 700 }}>새 창 ↗</a></div><iframe src="/qoo10-margin/channel-margins.html?channel=Qoo10" style={{ width: "100%", height: 1400, border: 0, display: "block" }} /></Card>}
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><Chip v={w.status} opts={["보낼 것", "대기", "회신", "완료"]} onPick={(v) => upd("waits", w.id, { status: v, sent: v === "대기" && !w.sent ? new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10) : w.sent })} /><span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{w.who}</span><span style={{ fontSize: 12, color: C.inkLt }}>{w.person}</span><div style={{ flex: 1 }} /><select value={w.owner || ""} onChange={(e) => upd("waits", w.id, { owner: e.target.value })} style={{ fontSize: 11, padding: "1px 4px", border: `1px solid ${C.border}`, borderRadius: 6 }}><option value="">담당 —</option>{TEAM.map((m) => <option key={m}>{m}</option>)}</select>{w.sent && <span style={{ fontSize: 11, fontWeight: 700, color: late ? "#dc2626" : C.inkLt }}>{w.sent.slice(5).replace("-", "/")} 보냄{w.status === "대기" ? ` · ${d}일째` : ""}</span>}</div>
                <div style={{ fontSize: 12, color: C.inkMid, marginTop: 4, lineHeight: 1.5 }}>{w.what}</div>
              </div>); })}
          </div>
        </Card>
        <Card style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center" }}><div style={{ fontSize: 15, fontWeight: 900, color: C.ink }}>해외 할 일</div><span style={{ fontSize: 12, color: C.inkLt, marginLeft: 8 }}>{(ops.todos || []).filter((t) => !t.done).length}개 남음</span><div style={{ flex: 1 }} />
            <button onClick={() => { const t = prompt("할 일"); if (!t) return; const due = prompt("마감일 (예: 2026-11-20, 없으면 비워두기)", "") || ""; setOps((p) => ({ ...p, todos: [...(p.todos || []), { id: "t" + Date.now(), text: t, owner: who || "", due, done: false }] })); }} style={{ fontSize: 12, fontWeight: 700, border: `1px solid ${C.border}`, background: C.white, borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>+ 할 일</button></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {[...(ops.todos || [])].sort((x, y) => x.done - y.done).map((t) => (
              <label key={t.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: t.done ? C.inkLt : C.ink, textDecoration: t.done ? "line-through" : "none", lineHeight: 1.5, cursor: "pointer" }}>
                <input type="checkbox" checked={!!t.done} onChange={(e) => upd("todos", t.id, { done: e.target.checked })} style={{ marginTop: 3 }} />
                <span style={{ flex: 1 }}>{t.text}</span>
                <input type="date" value={t.due || ""} onClick={(e) => e.stopPropagation()} onChange={(e) => upd("todos", t.id, { due: e.target.value })} title="마감일" style={{ fontSize: 11, padding: "1px 4px", border: `1px solid ${C.border}`, borderRadius: 6, width: 118 }} />
                <select value={t.owner || ""} onChange={(e) => upd("todos", t.id, { owner: e.target.value })} onClick={(e) => e.preventDefault()} style={{ fontSize: 11, padding: "1px 4px", border: `1px solid ${C.border}`, borderRadius: 6 }}><option value="">—</option>{TEAM.map((m) => <option key={m}>{m}</option>)}</select>
              </label>
            ))}
          </div>
        </Card>
      </div>
      )}
      <div style={{ display: view === "cal" || view === "inf" ? "grid" : "none", gridTemplateColumns: "1fr", gap: 12, maxWidth: view === "cal" ? "none" : 900 }}>
        <Card style={{ padding: "14px 16px", display: view === "cal" ? "block" : "none" }}>
          {view === "cal" && <div style={{ marginBottom: 16 }}>{MonthCal({})}</div>}
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
