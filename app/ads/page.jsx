"use client";
// 🏢 OA 광고상사 — AI 에이전트 사무실 타이쿤: 광고 세트 = 픽셀 직원, 성과 = 사기(모럴),
// 증액 = 보너스 결재, 중지 = 퇴근 조치, 소재 = 작업물 포트폴리오. 재미는 껍데기, 돈은 진짜.
// (기존 AD BATTLE STATION 전면 리스킨 — API 계약 동일: /api/ad-console GET/POST)
import { useEffect, useRef, useState } from "react";

const C = {
  bg: "#141019", floor: "#1D1526", floor2: "#231A2E", panel: "#241B31", panel2: "#1B1424",
  border: "#3A2C4E", wood: "#5C4033",
  neon: "#4ADE80", cyan: "#5ED3F3", gold: "#FFD166", red: "#FF6B81", purple: "#C4A7FF", pink: "#FF9DE0",
  ink: "#F5EFFF", mid: "#9C8DB8",
};
const fmt = (n) => (n == null ? "-" : Number(n).toLocaleString());

// ── 8비트 효과음 (WebAudio 합성 — 파일 없음) ──────────────────────────────
let audioCtx = null;
let sfxOn = true;
function beep(seq) {
  // seq: [{f: 주파수, d: 길이s, type, g}]
  if (!sfxOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    let t = audioCtx.currentTime;
    for (const s of seq) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = s.type || "square"; o.frequency.setValueAtTime(s.f, t);
      if (s.slide) o.frequency.linearRampToValueAtTime(s.slide, t + s.d);
      g.gain.setValueAtTime(s.g ?? 0.04, t); g.gain.exponentialRampToValueAtTime(0.001, t + s.d);
      o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + s.d + 0.02);
      t += s.gap != null ? s.gap : s.d;
    }
  } catch {}
}
const SFX = {
  coin: () => beep([{ f: 988, d: 0.07 }, { f: 1319, d: 0.18 }]),
  stamp: () => beep([{ f: 160, d: 0.08, type: "triangle", g: 0.09 }, { f: 90, d: 0.12, type: "triangle", g: 0.08 }]),
  bonus: () => beep([{ f: 523, d: 0.07 }, { f: 659, d: 0.07 }, { f: 784, d: 0.07 }, { f: 1047, d: 0.2 }]),
  fire: () => beep([{ f: 440, d: 0.1, slide: 110, type: "sawtooth", g: 0.05 }, { f: 220, d: 0.25, slide: 55, type: "sawtooth", g: 0.05 }]),
  hire: () => beep([{ f: 392, d: 0.08 }, { f: 523, d: 0.08 }, { f: 659, d: 0.16 }]),
  click: () => beep([{ f: 880, d: 0.04, g: 0.02 }]),
};

// 숫자 카운트업
function useCountUp(v, ms = 700) {
  const [x, setX] = useState(0);
  useEffect(() => {
    if (typeof v !== "number" || !isFinite(v)) { setX(v); return; }
    const t0 = performance.now(); let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      setX(Math.round(v * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [v, ms]);
  return typeof v === "number" ? x : v;
}

// 픽셀아트 스프라이트 (나노바나나 생성, detail-assets 공개 스토리지)
const SPRITE_BASE = "https://lugqeflqusqsyotdiaxg.supabase.co/storage/v1/object/public/detail-assets/hudassets/";
// 팀원 캐릭터 — 영서·소리·혜영·지원. 사장 = 경은
const TEAM = [
  { name: "영서", img: SPRITE_BASE + "mtcov5hd_hud_yeongseo.png" },
  { name: "소리", img: SPRITE_BASE + "mtcov5kx_hud_sori.png" },
  { name: "혜영", img: SPRITE_BASE + "mtcovgjk_hud_hyeyeong.png" },
  { name: "지원", img: SPRITE_BASE + "mtcov5ta_hud_jiwon.png", still: true },
];
const BOSS_IMG = SPRITE_BASE + "mtcov5no_hud_kyeongeun.png"; // 경은 사장님 👑
const BANNER_IMG = SPRITE_BASE + "mtcop9ce_hud_banner.png";
const teamOf = (id = "") => TEAM[[...String(id)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % TEAM.length];
const charOf = (id = "") => teamOf(id).img;

const AVATARS = [["소닉", "🧑‍💻"], ["에어리", "👩‍💼"], ["드라이", "💇"], ["클린이워터", "🧑‍🔬"], ["워터", "🧑‍🔬"],
  ["스윙", "🦷"], ["칫솔", "🦷"], ["프리온", "👩‍🎤"], ["고데기", "💁‍♀️"], ["뷰러", "🧝‍♀️"], ["마사지", "💆"],
  ["포켓건", "🕵️"], ["아이스", "🥶"], ["테스트", "🧪"]];
const avatarOf = (name) => (AVATARS.find(([k]) => name.includes(k)) || [null, "🤖"])[1];

// 직원 상태별 혼잣말 (성과 티어별 랜덤)
const TALK = {
  great: ["실적 미쳤어요 사장님!! 💰", "이번 달 보너스 각이죠?", "전환이 쏟아집니다!!", "제가 좀 잘하긴 해요 ㅎ", "광고비가 아깝지 않죠?"],
  ok: ["열심히 하는 중입니다…", "곧 터질 것 같아요!", "조금만 더 지켜봐 주세요", "오늘도 성실 근무 중 ☕"],
  bad: ["죄…죄송합니다 사장님 😰", "제 소재가 문제일까요…", "한 번만 더 기회를…!", "요즘 슬럼프예요 💦"],
  idle: ["일감(전환)이 안 들어와요…", "대기 중… 뭐라도 시켜주세요", "월급 루팡 아닙니다…"],
};
const talkOf = (tier, seed) => TALK[tier][seed % TALK[tier].length];

// 광고 스튜디오(소재 제작) 연결 — 세트명에서 제품 키워드 추출해 딥링크
const PRODUCT_KEYS = ["소닉플로우", "에어리소닉", "클린이워터", "클린이스윙", "프리온", "오마컬", "듀얼포켓건", "아이스볼트", "퀵롤차저", "오아데이", "클린이"];
const prodKeyOf = (name = "") => PRODUCT_KEYS.find((k) => name.includes(k))
  || ((name.match(/[가-힣]{2,}/g) || []).sort((a, b) => b.length - a.length)[0] || "");
const studioUrl = (name) => `https://oa-detail-gen.vercel.app/detail?tab=adtab&adq=${encodeURIComponent(prodKeyOf(name))}`;

const BOSS_LINES = ["결재 밀린 거 없나? 🖊", "소재가 생명이다, 소재가.", "ROAS가 곧 인격이다.", "커피 한 잔 하고 하지 ☕",
  "이번 달 S등급 가보자고.", "잘하는 사원엔 보너스, 화끈하게.", "부진하면… 알지? 🪑", "우리 회사 좋은 회사다 😎"];
const officeHour = () => {
  const h = new Date().getHours();
  return h >= 9 && h < 12 ? "☀️ 오전 근무" : h >= 12 && h < 13 ? "🍜 점심시간" : h >= 13 && h < 18 ? "☕ 오후 근무"
    : h >= 18 && h < 23 ? "🌙 야근 중" : "🌃 무인 경비 모드";
};

export default function AdOfficeTycoon() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [openCamp, setOpenCamp] = useState({});
  const [showOff, setShowOff] = useState({}); // 부서별 퇴근자 표시 토글
  const [bossSay, setBossSay] = useState(""); // 사장 한마디 (등급 카드 클릭)
  const [detail, setDetail] = useState(null); // 인사카드 모달 {busy, kind, camp, data}
  const [adsCache, setAdsCache] = useState({});
  const [adsOpen, setAdsOpen] = useState({});
  const [fx, setFx] = useState(null); // {emoji, text, kind}
  const [shake, setShake] = useState(false);
  const [boot, setBoot] = useState(true);
  const [mute, setMute] = useState(false);
  const [talkTick, setTalkTick] = useState(0);
  const [spot, setSpot] = useState(null); // 전광판→책상 점프 스포트라이트
  const [brief, setBrief] = useState(null); // AI 비서 브리핑 {items, mood, at}
  const [briefBusy, setBriefBusy] = useState(false);
  const [evt, setEvt] = useState(null); // 랜덤 사무실 이벤트 토스트
  const [nego, setNego] = useState(null); // 💰 연봉 협상 {s} | "no"(이번 세션 무시)
  const [tab, setTab] = useState("work"); // 🗂 메인 탭 — work 오늘 업무 / report 리포트 / partner 협력사 / log 기록
  const [tgtEdit, setTgtEdit] = useState(null); // 🎯 목표 CPA 편집 {default, rules[], monthCap} | null
  const [paper, setPaper] = useState(null); // 🖊 결재서류 {action, s, extra, stamped} — 도장 찍어야 실행
  const [signer, setSigner] = useState(""); // 결재 도장 이름 (마지막 사용 기억)

  useEffect(() => {
    try { const m = localStorage.getItem("oa_ads_mute") === "1"; setMute(m); sfxOn = !m; } catch {}
    try { setSigner(localStorage.getItem("oa_ads_signer_v1") || ""); } catch {}
    const t = setTimeout(() => setBoot(false), 1500);
    const talk = setInterval(() => setTalkTick((x) => x + 1), 6000); // 말풍선 로테이션
    const auto = setInterval(() => load(false), 5 * 60_000); // 🔄 5분 자동 새로고침 (서버 캐시 내 — 메타 호출 없음)
    return () => { clearTimeout(t); clearInterval(talk); clearInterval(auto); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 💰 실시간 계약 체결 알림 — 오늘 구매수 diff (localStorage 기준, 날짜 바뀌면 리셋)
  useEffect(() => {
    if (!data?.campaigns) return;
    const today = new Date().toISOString().slice(0, 10);
    const map = Object.fromEntries(data.campaigns.flatMap((c) => c.adsets)
      .filter((s) => (s.buyToday || 0) > 0).map((s) => [s.id, s.buyToday]));
    try {
      const prev = JSON.parse(localStorage.getItem("oa_ads_todaybuy_v1") || "null");
      if (prev?.date === today) {
        const gains = Object.entries(map).map(([id, n]) => ({ id, n: n - (prev.map[id] || 0) })).filter((x) => x.n > 0);
        if (gains.length) {
          const top = gains.sort((a, b) => b.n - a.n)[0];
          const s = data.campaigns.flatMap((c) => c.adsets).find((x) => x.id === top.id);
          const tot = gains.reduce((a, x) => a + x.n, 0);
          SFX.coin();
          setEvt(["💰", `${prodKeyOf(s?.name || "") || s?.name || "사원"} 사원 방금 계약 ${top.n}건 체결!${tot > top.n ? ` (외 ${tot - top.n}건)` : ""}`]);
          setTimeout(() => setEvt(null), 5000);
        }
      }
      localStorage.setItem("oa_ads_todaybuy_v1", JSON.stringify({ date: today, map }));
    } catch {}
  }, [data]);

  // 🎲 랜덤 사무실 이벤트 — 40초마다 20% 확률, 4초 토스트 (업무 방해 없음)
  useEffect(() => {
    const EVENTS = [
      ["🚚", "택배가 도착했습니다 — 누가 또 뭘 샀는지…"],
      ["🐈", "길고양이가 창밖 난간을 지나갑니다"],
      ["🤝", "거래처(메타 본사)에서 인사 왔습니다"],
      ["☕", "커피 타임 — 3분간 전 직원 충전 중"],
      ["🍕", "누군가 회의실에 피자를 시켰습니다"],
      ["📠", "팩스가 왔습니다. 2026년에 팩스라니…"],
      ["💡", "절전 모드 — 복도 형광등이 깜빡입니다"],
      ["🪴", "화분에 물 주는 날입니다"],
    ];
    const iv = setInterval(() => {
      if (Math.random() < 0.2) {
        setEvt(EVENTS[Math.floor(Math.random() * EVENTS.length)]);
        setTimeout(() => setEvt(null), 4000);
      }
    }, 40000);
    return () => clearInterval(iv);
  }, []);

  // 💰 연봉 협상 — scale 판정(잘나가는) 사원 중 하나가 가끔 인상 요구 (세션당 1회)
  useEffect(() => {
    if (!data || nego) return;
    const cands = data.campaigns.flatMap((c) => c.adsets.filter((s) => s.judge === "scale" && s.status === "ACTIVE"));
    if (cands.length && Math.random() < 0.5) setNego({ s: cands[Math.floor(Math.random() * cands.length)] });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // 🤵 AI 비서 브리핑 — 콘솔 캐시 기반, 서버 3h 캐시
  async function loadBrief(fresh) {
    SFX.click(); setBriefBusy(true);
    try {
      const j = await fetch("/api/ad-brief" + (fresh ? "?fresh=1" : "")).then((r) => r.json());
      if (j.error) throw new Error(j.error);
      setBrief(j);
    } catch (e) { alert("브리핑 실패: " + e.message); } finally { setBriefBusy(false); }
  }
  const toggleMute = () => setMute((m) => { const n = !m; sfxOn = !n; try { localStorage.setItem("oa_ads_mute", n ? "1" : "0"); } catch {}; return n; });

  // 기본은 5분 서버 캐시(메타 호출 제한 보호) — 순찰·조치 직후만 fresh
  const load = (fresh) => fetch("/api/ad-console" + (fresh ? "?fresh=1" : "")).then((r) => r.json())
    .then((j) => (j.ok ? setData(j) : setErr(j.error))).catch((e) => setErr(String(e)));
  useEffect(() => { load(); }, []);

  // 🖊 결재는 반드시 결재서류에 도장을 찍어야 실행 — act()는 서류만 올림
  function act(action, s, extra = {}) {
    SFX.click();
    setPaper({ action, s, extra, stamped: "" });
  }
  async function doAct(action, s, extra = {}, by = "") {
    setBusy(s.id);
    try {
      const j = await fetch("/api/ad-console", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adsetId: s.id, name: s.name, by,
          before: { cpa7: s.cpa7, spend7: s.spend7, purchases7: s.purchases7, budget: s.budget }, ...extra }) }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error);
      if (action === "pause") {
        SFX.fire(); setShake(true); setTimeout(() => setShake(false), 500);
        setFx({ emoji: "🪑", text: "퇴근 조치 완료 — 예산 회수!", kind: "fire" });
      } else if (action === "resume") {
        SFX.hire(); setFx({ emoji: "📢", text: "재고용! 자리로 복귀합니다", kind: "hire" });
      } else {
        SFX.bonus(); setFx({ emoji: "💰", text: `보너스 결재! +₩${fmt((extra.budget || 0) - s.budget)}`, kind: "bonus" });
      }
      setTimeout(() => setFx(null), 2200);
      // 낙관적 반영 — 서버 새로고침 전에 즉시 화면에서 퇴근/복귀 처리
      if (action === "pause" || action === "resume") {
        const ns = action === "pause" ? "PAUSED" : "ACTIVE";
        setData((d) => d && ({ ...d, campaigns: d.campaigns.map((c) => ({ ...c,
          adsets: c.adsets.map((x) => x.id === s.id ? { ...x, status: ns, judge: action === "pause" ? null : x.judge } : x) })) }));
      }
      await load(true);
    } catch (e) { alert("실패: " + e.message); } finally { setBusy(""); }
  }

  // 📋 인사카드 — 세트/캠페인 14일 상세
  async function openDetail(id, kind, campName) {
    SFX.click();
    setDetail({ busy: true, kind, camp: campName });
    try {
      const j = await fetch(`/api/ad-console?detail=${id}&kind=${kind}`).then((r) => r.json());
      if (!j.ok) throw new Error(j.error);
      setDetail({ busy: false, kind, camp: campName, data: j.detail });
    } catch (e) { alert("상세 조회 실패: " + e.message); setDetail(null); }
  }

  // 개별 소재(광고) ON/OFF — 부진 소재만 끄는 "소재 교체" 절반
  async function adStatus(sid, ad, turnOff) {
    if (!confirm(turnOff ? `📉 소재 "${ad.name}"만 끌까요? (사원은 계속 근무)` : `소재 "${ad.name}"을 다시 켤까요?`)) return;
    try {
      const j = await fetch("/api/ad-console", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: turnOff ? "adPause" : "adResume", adId: ad.id, adsetId: sid, name: ad.name,
          before: { cpa7: ad.cpa, spend7: ad.spend, purchases7: ad.purchases } }) }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error);
      SFX.stamp();
      setAdsCache((cc) => ({ ...cc, [sid]: (cc[sid] || []).map((x) => x.id === ad.id ? { ...x, status: turnOff ? "PAUSED" : "ACTIVE" } : x) }));
    } catch (e) { alert("실패: " + e.message); }
  }

  async function toggleAds(sid) {
    SFX.click();
    setAdsOpen((o) => ({ ...o, [sid]: !o[sid] }));
    if (!adsCache[sid]) {
      const j = await fetch(`/api/ad-console?adset=${sid}`).then((r) => r.json());
      if (j.ok) setAdsCache((c) => ({ ...c, [sid]: j.ads }));
    }
  }

  // 전광판/전당 클릭 → 담당 직원 책상으로 점프 (부서 펼치고 스크롤 + 스포트라이트)
  function jumpToDesk(s) {
    SFX.click();
    setTab("work"); // 책상은 오늘 업무 탭에 있음 — 리포트 탭에서 점프해도 도착하게
    setOpenCamp((o) => ({ ...o, [s.campId]: true }));
    setSpot(s.id);
    setTimeout(() => document.getElementById("desk-" + s.id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    setTimeout(() => setSpot(null), 2600);
  }

  // 부서를 열면 성과 있는 직원의 소재 포트폴리오는 자동 펼침 — 메타 호출 보호로 최대 6명, 순차 로드
  async function autoOpenAds(sets) {
    const targets = sets.filter((s) => s.status === "ACTIVE" && (s.purchases7 || 0) >= 1).slice(0, 6);
    if (!targets.length) return;
    setAdsOpen((o) => ({ ...o, ...Object.fromEntries(targets.map((s) => [s.id, true])) }));
    for (const s of targets) {
      if (adsCache[s.id]) continue;
      try {
        const j = await fetch(`/api/ad-console?adset=${s.id}`).then((r) => r.json());
        if (j.ok) setAdsCache((c) => ({ ...c, [s.id]: j.ads }));
      } catch {}
    }
  }

  if (err) return <Shell mute={mute} toggleMute={toggleMute}><div style={{ color: C.red, padding: 40 }}>⚠️ {err}</div></Shell>;
  if (!data || boot) return <Shell mute={mute} toggleMute={toggleMute}>
    <div style={{ padding: 80, textAlign: "center" }}>
      <div style={{ fontSize: 44 }} className="bootDoor">🏢</div>
      <div style={{ color: C.cyan, marginTop: 16, fontSize: 13, letterSpacing: 2, fontFamily: "'Press Start 2P', monospace" }} className="bootType">
        {!data ? "사무실 불 켜는 중…" : "AI 사원들 출근 중…"}
      </div>
      <div style={{ color: C.mid, marginTop: 10, fontSize: 11 }}>☕ 커피머신 예열 · 🖥 모니터 부팅 · 📠 메타 본사 회선 연결</div>
    </div>
  </Shell>;

  const queue = data.campaigns.flatMap((c) => c.adsets.filter((s) => s.judge && s.status === "ACTIVE").map((s) => ({ ...s, camp: c.name })));
  const roas = data.kpi.yesterday.roas || 0;
  const grade = data.metaDown ? ["?", C.mid, "메타 회선 점검 중"]
    : roas >= 4 ? ["S", C.gold, "전설의 광고상사"] : roas >= 2.5 ? ["A", C.neon, "잘나가는 사무실"]
    : roas >= 1.5 ? ["B", C.cyan, "성실한 중소상사"] : roas >= 1 ? ["C", C.purple, "버티는 스타트업"] : ["D", C.red, "폐업 위기…"];
  const logArr = data.log || [];
  const wins = logArr.filter((l) => l.verdict === "win").length;
  let combo = 0; for (const l of logArr) { if (!l.verdict) continue; if (l.verdict === "win") combo++; else break; }
  const allSets = data.campaigns.flatMap((c) => c.adsets);
  const mvp = allSets.filter((s) => s.cpa7 && s.cpa7 <= s.target).sort((a, b) => b.purchases7 - a.purchases7)[0];
  const top3 = [...allSets].sort((a, b) => (b.purchases7 || 0) - (a.purchases7 || 0)).slice(0, 3).filter((s) => s.purchases7 > 0);
  // 전광판·전당용 — 캠페인 ID를 붙여 클릭 시 책상 점프 가능하게
  const withCamp = data.campaigns.flatMap((c) => c.adsets.map((s) => ({ ...s, campId: c.id })));
  const bill = withCamp.filter((s) => s.status === "ACTIVE" && s.thumb)
    .sort((a, b) => (b.spend7 || 0) - (a.spend7 || 0)).slice(0, 12);
  const fame = withCamp.filter((s) => s.status === "ACTIVE" && s.thumb && (s.purchases7 || 0) > 0)
    .sort((a, b) => (b.purchases7 || 0) - (a.purchases7 || 0)).slice(0, 3);
  const shame = withCamp.filter((s) => s.status === "ACTIVE" && s.thumb && (s.spend7 || 0) >= 30000 && !(s.purchases7 > 0))
    .sort((a, b) => b.spend7 - a.spend7).slice(0, 3);
  // 🚨 비상벨 — 3일 성과가 7일 대비 급변한 세트 (CPA 1.8배 급등 or 일지출 2배 급증, 3일 지출 3만↑만)
  const alarms = withCamp.filter((s) => s.status === "ACTIVE" && (s.spend3 || 0) >= 30000).map((s) => {
    const cpaSpike = s.cpa7 && s.cpa3 && s.cpa3 >= s.cpa7 * 1.8;
    const spendSpike = s.spend7 > 0 && (s.spend3 / 3) > (s.spend7 / 7) * 2;
    const cpmSpike = s.cpm7 > 0 && s.cpm3 >= s.cpm7 * 1.5; // 경매 과열 — 노출 단가 급등
    return cpaSpike ? { ...s, why: `CPA 급등 ₩${fmt(s.cpa7)}→₩${fmt(s.cpa3)}` }
      : spendSpike ? { ...s, why: `지출 급증 일₩${fmt(Math.round(s.spend7 / 7))}→₩${fmt(Math.round(s.spend3 / 3))}` }
      : cpmSpike ? { ...s, why: `CPM 급등(경매 과열) ₩${fmt(s.cpm7)}→₩${fmt(s.cpm3)} — 시장 임대료 상승` } : null;
  }).filter(Boolean).slice(0, 4);
  // 사무실 레벨 — 30일 지출 규모 + 승진(성공 조치) XP
  const xp = Math.round((data.kpi.month?.spend || 0) / 10000) + wins * 120 + allSets.reduce((a, s) => a + (s.purchases7 || 0), 0) * 4;
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 60)));
  const nextXp = (level + 1) ** 2 * 60;
  const prevXp = level ** 2 * 60;
  const xpPct = Math.min(100, Math.round(((xp - prevXp) / Math.max(1, nextXp - prevXp)) * 100));

  return (
    <Shell onRefresh={() => { SFX.click(); load(true); }} fx={fx} shake={shake} mute={mute} toggleMute={toggleMute}>
      {/* 🖊 결재서류 — 도장을 찍어야 실제 집행 (진짜 돈이 움직이는 문서) */}
      {paper && (() => {
        const p = paper;
        const title = p.action === "budget" ? "예 산 변 경 품 의 서" : p.action === "pause" ? "광 고 중 지 품 의 서" : "광 고 재 개 품 의 서";
        const chg = p.action === "budget"
          ? `일예산 ₩${fmt(p.s.budget)} → ₩${fmt(p.extra.budget)} (${p.extra.budget >= p.s.budget ? "+" : ""}${Math.round(((p.extra.budget - p.s.budget) / Math.max(1, p.s.budget)) * 100)}%)`
          : p.action === "pause" ? `광고 세트 OFF — 일예산 ₩${fmt(p.s.budget)} 지출 중단 (퇴근 조치)`
          : `광고 세트 ON — 일예산 ₩${fmt(p.s.budget)} 지출 재개 (재고용)`;
        const now = new Date();
        const docNo = `OA-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${String(p.s.id).slice(-4)}`;
        const rowSt = { display: "flex", borderBottom: "1px solid #00000018", fontSize: 12.5 };
        const th = { width: 88, background: "#00000008", padding: "8px 10px", fontWeight: 800, color: "#333", flexShrink: 0 };
        const td = { padding: "8px 10px", color: "#111", flex: 1, wordBreak: "keep-all" };
        const stamp = (name) => {
          if (p.stamped) return;
          SFX.stamp();
          try { localStorage.setItem("oa_ads_signer_v1", name); } catch {}
          setSigner(name);
          setPaper({ ...p, stamped: name });
          setTimeout(() => { setPaper(null); doAct(p.action, p.s, p.extra, name); }, 850);
        };
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000000AA", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={() => !p.stamped && setPaper(null)}>
            <div className="paperIn" onClick={(e) => e.stopPropagation()}
              style={{ background: "#FBF8F1", borderRadius: 6, width: "min(480px, 94vw)", padding: "22px 22px 18px",
                boxShadow: "0 20px 60px #000000AA", border: "1px solid #00000022", color: "#111",
                fontFamily: "'Noto Serif KR', serif" }}>
              <div style={{ textAlign: "center", fontSize: 19, fontWeight: 900, letterSpacing: 4, color: "#1a1a1a",
                borderBottom: "2.5px solid #1a1a1a", paddingBottom: 10, marginBottom: 12 }}>{title}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#666", marginBottom: 8 }}>
                <span>문서번호 {docNo}</span><span>기안일 {now.toISOString().slice(0, 10)} · OA 광고상사</span>
              </div>
              <div style={{ border: "1.5px solid #00000030", borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
                <div style={rowSt}><div style={th}>대상 사원</div><div style={td}>{p.s.name}</div></div>
                <div style={rowSt}><div style={th}>결재 내용</div><div style={{ ...td, fontWeight: 800 }}>{chg}</div></div>
                <div style={rowSt}><div style={th}>최근 성과</div><div style={td}>7일 지출 ₩{fmt(p.s.spend7)} · 구매 {p.s.purchases7 ?? 0}건 · CPA {p.s.cpa7 ? "₩" + fmt(p.s.cpa7) : "—"}{p.s.target ? ` (목표 ₩${fmt(p.s.target)})` : ""}</div></div>
                <div style={{ ...rowSt, borderBottom: "none" }}><div style={th}>사유</div><div style={td}>{p.extra.note || "사장 직권 결재"}</div></div>
              </div>
              <div style={{ fontSize: 11, color: "#8A2B2B", marginBottom: 10, fontWeight: 700 }}>
                ⚠️ 본 결재는 메타 광고비(실제 돈)가 즉시 움직입니다. 담당자 서명 도장을 찍어야 집행됩니다.
              </div>
              <div style={{ fontSize: 11, color: "#555", marginBottom: 6, fontWeight: 800 }}>결재란 — 진행자 본인 도장을 찍어주세요</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                {["영서", "경은", "지원", "소리", "혜영"].map((nm) => (
                  <button key={nm} onClick={() => stamp(nm)} disabled={!!p.stamped}
                    style={{ width: 72, cursor: p.stamped ? "default" : "pointer", background: "#fff",
                      border: `1.5px solid ${signer === nm && !p.stamped ? "#B3392F" : "#00000025"}`, borderRadius: 4,
                      padding: "6px 0 5px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 46, height: 46, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {p.stamped === nm ? (
                        <div className="stampIn" style={{ width: 44, height: 44, borderRadius: "50%", border: "2.5px solid #C0392B",
                          color: "#C0392B", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, fontWeight: 900, transform: "rotate(-12deg)", letterSpacing: 1,
                          boxShadow: "inset 0 0 6px #C0392B33" }}>{nm}</div>
                      ) : <span style={{ fontSize: 10, color: "#bbb" }}>(인)</span>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#333" }}>{nm}{nm === "경은" ? " 👑" : ""}</span>
                  </button>
                ))}
              </div>
              {!p.stamped && (
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <button onClick={() => setPaper(null)} style={{ background: "transparent", border: "1px solid #00000030",
                    borderRadius: 6, padding: "6px 18px", fontSize: 12, color: "#666", cursor: "pointer" }}>↩ 반려 (취소)</button>
                </div>
              )}
              {p.stamped && <div style={{ textAlign: "center", marginTop: 10, fontSize: 12.5, fontWeight: 900, color: "#C0392B" }}>결재 완료 — 집행 중…</div>}
            </div>
          </div>
        );
      })()}
      {/* 픽셀 사무실 배너 */}
      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 14, border: `1px solid ${C.border}` }}>
        <img src={BANNER_IMG} alt="" style={{ width: "100%", height: 150, objectFit: "cover", display: "block", imageRendering: "pixelated" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, #141019EE 0%, #14101966 40%, transparent 70%)" }} />
        <div style={{ position: "absolute", left: 18, bottom: 14 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 13, color: "#4ADE80", textShadow: "0 0 12px #4ADE80AA" }}>OA 광고상사</div>
          <div style={{ fontSize: 11, color: C.ink, marginTop: 5, opacity: 0.85 }}>AI 사원 {allSets.filter((x) => x.status === "ACTIVE").length}명 근무 중 · {officeHour()}</div>
        </div>
      </div>

      {/* 메타 회선 불통 배너 */}
      {data.metaDown && (
        <div style={{ background: "#FF6B8115", border: `1px solid ${C.red}55`, borderRadius: 12, padding: "10px 16px",
          marginBottom: 14, fontSize: 12.5, color: C.red, fontWeight: 700 }}>
          📠 메타 본사 회선 불통 — {data.metaDownReason || "일시 오류"}. 협력사(네이버·GFA)·직영(AD부스터)·인사기록만 표시 중이에요. 회복되면 자동으로 전체가 돌아옵니다.
        </div>
      )}

      {/* 전광판 뉴스 티커 */}
      {(() => {
        const news = [];
        if (alarms.length) news.push(`🚨 긴급: ${alarms.map((a) => prodKeyOf(a.name) || a.name.slice(0, 10)).join("·")} 세트 이상 감지 — 비상벨 확인!`);
        if (top3[0]) news.push(`🏆 속보: ${prodKeyOf(top3[0].name) || top3[0].name} 사원, 7일 ${top3[0].purchases7}건 판매로 사내 1위!`);
        if (queue.length) news.push(`🖊 인사부: 사장님 결재 대기 ${queue.length}건 — 결재함을 확인해 주세요`);
        else news.push("✅ 인사부: 결재 대기 없음 — 사무실이 평화롭습니다");
        if (data.naver?.tot?.spend) news.push(`🟢 협력사 네이버: 어제 ROAS x${(data.naver.tot.rev / data.naver.tot.spend).toFixed(1)} — ${data.naver.tot.rev / data.naver.tot.spend >= 3 ? "회식 각입니다" : "분발 요망"}`);
        if (combo >= 2) news.push(`🔥 사장님 결재 ${combo}연속 성공 — 촉이 좋으십니다`);
        if (roas >= 3) news.push(`📈 어제 ROAS ${roas} — 경영지원팀이 박수 치는 중`);
        else if (roas < 1.5) news.push(`📉 어제 ROAS ${roas} — 전 직원 비상 근무 태세`);
        const line = news.join("   ·   ");
        return (
          <div style={{ background: "#0d0a12", border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 14, overflow: "hidden", padding: "7px 0" }}>
            <div className="ticker"><span style={{ fontSize: 11.5, color: C.gold, fontWeight: 700 }}>{line}   ·   {line}</span></div>
          </div>
        );
      })()}

      {/* 🗂 메인 탭 — 화면 정리: 매일 보는 것만 앞에, 나머지는 탭 뒤로 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[["work", "📋 오늘 업무", queue.length + alarms.length], ["report", "📊 리포트", 0],
          ["partner", "🤝 협력사·직영", 0], ["log", "🗂 기록", 0]].map(([k, label, n]) => (
          <button key={k} onClick={() => { SFX.click(); setTab(k); }}
            style={{ background: tab === k ? "#ffffff10" : "transparent", color: tab === k ? C.ink : C.mid,
              border: `1px solid ${tab === k ? C.cyan + "66" : C.border}`, borderRadius: 9, padding: "7px 14px",
              fontSize: 12, fontWeight: tab === k ? 800 : 500, cursor: "pointer",
              boxShadow: tab === k ? `0 0 10px ${C.cyan}22` : "none" }}>
            {label}{n > 0 && <span style={{ marginLeft: 5, background: C.red, color: "#fff", borderRadius: 8,
              padding: "1px 6px", fontSize: 9.5, fontWeight: 900 }}>{n}</span>}
          </button>
        ))}
      </div>

      {/* 🚨 비상벨 — 급변 감지 */}
      {tab === "work" && alarms.length > 0 && (
        <div className="siren" style={{ background: "#FF6B8112", border: `1.5px solid ${C.red}88`, borderRadius: 14,
          padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span className="sirenLight" style={{ fontSize: 18 }}>🚨</span>
            <b style={{ fontSize: 12.5, color: C.red }}>비상벨 — 최근 3일 급변 감지 {alarms.length}건</b>
            <span style={{ fontSize: 10.5, color: C.mid }}>7일 평균 대비 CPA 1.8배↑ · 지출 2배↑ · CPM 1.5배↑(경매 과열)</span>
          </div>
          {alarms.map((s) => (
            <div key={s.id} onClick={() => jumpToDesk(s)} style={{ display: "flex", gap: 10, alignItems: "center",
              padding: "5px 8px", fontSize: 12, cursor: "pointer", borderRadius: 8, background: "#0d0a1266" }} title="클릭하면 담당 책상으로">
              <span>{avatarOf(s.name)}</span>
              <b style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</b>
              <span style={{ color: C.red, fontWeight: 700, whiteSpace: "nowrap" }}>{s.why}</span>
            </div>
          ))}
        </div>
      )}

      {/* 🎬 전광판 월 — 지금 송출 중인 소재를 크게 */}
      {tab === "report" && bill.length > 0 && (
        <div style={{ background: "#0d0a12", border: `1px solid ${C.border}`, borderRadius: 14, padding: "10px 12px 12px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={px}>전광판</span>
            <span style={{ fontSize: 11, color: C.mid }}>지금 송출 중인 소재 · 7일 지출순 — 클릭하면 담당 책상으로 점프</span>
          </div>
          <div className="bbRow">
            {bill.map((s, i) => {
              const hot = s.cpa7 && s.cpa7 <= s.target;
              const cold = s.judge === "kill" || (s.spend7 >= 30000 && !(s.purchases7 > 0));
              return (
                <div key={s.id} className="bbCard" onClick={() => jumpToDesk(s)} title={s.name}
                  style={{ border: `1.5px solid ${hot ? C.neon : cold ? C.red : C.border}`, boxShadow: hot ? `0 0 12px ${C.neon}44` : "none" }}>
                  <img src={s.thumb} alt="" />
                  <span className="bbRank">{i + 1}</span>
                  {(hot || cold) && <span className="bbFlag">{hot ? "🔥" : "🥶"}</span>}
                  <div className="bbCap">
                    <b style={{ color: C.gold }}>₩{fmt(s.spend7)}</b> · 🛒{s.purchases7 || 0}{s.cpa7 ? ` · ₩${fmt(s.cpa7)}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 복도 — 산책하는 사원들 */}
      {tab === "report" && (
      <div style={{ position: "relative", height: 34, marginBottom: 6, overflow: "hidden" }} title="복도를 산책 중인 사원들">
        {allSets.filter((x) => x.status === "ACTIVE").slice(0, 7).map((x, i) => (
          <span key={x.id} className="walker" style={{ "--dur": `${14 + (i * 3.7) % 12}s`, "--delay": `-${(i * 5.3) % 14}s`, top: i % 2 ? 0 : 5 }}>
            <img src={charOf(x.id)} alt="" style={{ width: 26, height: 26, borderRadius: 6, imageRendering: "pixelated", verticalAlign: "middle" }} />
            {i % 3 === 0 ? "☕" : ""}
          </span>
        ))}
      </div>
      )}

      {/* ① 사장실 대시보드 */}
      {tab === "work" && (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <div className="gradeCard" onClick={() => { SFX.click(); setBossSay(BOSS_LINES[Math.floor(Math.random() * BOSS_LINES.length)]); setTimeout(() => setBossSay(""), 3200); }}
          title="사장님(클릭하면 한마디)" style={{ ...card, minWidth: 150, flex: "0 0 auto", textAlign: "center", borderColor: grade[1], "--glow": grade[1], cursor: "pointer", position: "relative" }}>
          {bossSay && <div className="bubble" style={{ top: -30, left: 10, right: -60, borderColor: `${grade[1]}66`, zIndex: 9 }}>👔 {bossSay}</div>}
          <img src={BOSS_IMG} alt="" title="경은 사장님 👑" style={{ width: 54, height: 54, borderRadius: 10, imageRendering: "pixelated",
            border: `1px solid ${C.border}`, display: "block", margin: "0 auto 4px" }} />
          <div style={pxLabel}>🏢 사무실 등급</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: grade[1], textShadow: `0 0 18px ${grade[1]}`, lineHeight: 1.1, fontFamily: "'Press Start 2P', monospace" }}>{grade[0]}</div>
          <div style={{ fontSize: 10, color: grade[1], marginTop: 3, fontWeight: 700 }}>{grade[2]}</div>
          <div style={{ fontSize: 10, color: C.mid }}>어제 ROAS {roas}</div>
          {data.stale ? (
            <div style={{ fontSize: 9, color: C.gold, marginTop: 2 }}>⚠️ {data.staleReason || "일시 오류"} · 마지막 스냅샷 표시 중</div>
          ) : data.cachedAt && Date.now() - data.cachedAt > 60_000 ? (
            <div style={{ fontSize: 9, color: C.mid, marginTop: 2 }}>🕐 {Math.round((Date.now() - data.cachedAt) / 60_000)}분 전 · 🔄순찰=실시간</div>
          ) : null}
        </div>
        {data.kpi.today && <Stat label="🔥 오늘 실황 (계약)" v={data.kpi.today.purchases}
          suffix={`건 · ₩${fmt(data.kpi.today.spend)}`} color={C.gold} />}
        <Stat label="💸 어제 광고비" v={data.kpi.yesterday.spend} prefix="₩" color={C.gold} />
        <Stat label="🛒 어제 판매" v={data.kpi.yesterday.purchases} suffix={data.kpi.yesterday.views ? ` +👁${data.kpi.yesterday.views}` : ""} color={C.neon} />
        <Stat label="🎯 CPA (가중)" v={data.kpi.yesterday.cpa} prefix="₩" color={C.cyan} />
        <Stat label="📆 7일 광고비" v={data.kpi.week.spend} prefix="₩" color={C.purple} />
        <Stat label="🗓 30일 광고비" v={data.kpi.month?.spend} prefix="₩" color={C.pink} suffix={data.kpi.month?.roas ? ` (x${data.kpi.month.roas})` : ""} />
        <div style={{ ...card, flex: "1 1 170px", minWidth: 160 }}>
          <div style={pxLabel}>🏆 사무실 Lv.{level}</div>
          <div style={{ height: 8, background: "#0d0a12", borderRadius: 4, margin: "8px 0 5px", overflow: "hidden", border: `1px solid ${C.border}` }}>
            <div className="xpbar" style={{ width: `${xpPct}%`, height: "100%" }} />
          </div>
          <div style={{ fontSize: 10, color: C.mid }}>승진 {wins}회{combo >= 2 && <b style={{ color: C.gold }}> · 🔥{combo}연속 성공</b>}</div>
          {/* 레벨 장식 진열대 — 레벨업할 때마다 사무실 살림이 늘어남 */}
          <div style={{ marginTop: 7, paddingTop: 6, borderTop: `1px dashed ${C.border}`, fontSize: 14, letterSpacing: 2, lineHeight: 1.5 }}
            title={DECOS.slice(0, level).map((d) => d.n).join(", ") || "아직 텅 빈 사무실"}>
            {DECOS.slice(0, Math.min(level, DECOS.length)).map((d) => <span key={d.n} title={d.n}>{d.e}</span>)}
            {level < DECOS.length && (
              <span style={{ fontSize: 9.5, color: C.mid, letterSpacing: 0, marginLeft: 6 }}>
                다음 Lv.{level + 1}: {DECOS[level].e}{DECOS[level].n}
              </span>
            )}
          </div>
        </div>
      </div>
      )}

      {/* 💰 회사 손익 계좌 — 진짜 돈: 전환매출 − 광고비 (메타 기준, 마진 미반영) */}
      {tab === "work" && data.monthly?.cur && (() => {
        const m = data.monthly;
        const profit = (m.cur.rev || 0) - (m.cur.spend || 0);
        const pProfit = (m.prev.rev || 0) - (m.prev.spend || 0);
        const yRow = [...(m.days30 || [])].reverse().find((d) => d.d < new Date().toISOString().slice(0, 10) && (d.spend > 0 || d.rev > 0));
        const yProfit = yRow ? (yRow.rev || 0) - yRow.spend : null;
        const roasM = m.cur.spend > 0 ? +(m.cur.rev / m.cur.spend).toFixed(1) : 0;
        const pc = profit >= 0 ? C.neon : C.red;
        return (
          <div style={{ ...card, marginTop: 14, borderColor: `${pc}44`, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <span style={px}>계좌</span>
            <div>
              <div style={{ fontSize: 10, color: C.mid }}>이번 달 광고 손익 (전환매출 − 광고비)</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: pc, textShadow: `0 0 12px ${pc}55` }}>
                {profit >= 0 ? "+" : "−"}₩{fmt(Math.abs(profit))}
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: C.mid }}>
              매출 <b style={{ color: C.cyan }}>₩{fmt(m.cur.rev)}</b> − 광고비 <b style={{ color: C.gold }}>₩{fmt(m.cur.spend)}</b> · ROAS x{roasM}
            </div>
            {yProfit != null && (
              <div style={{ fontSize: 11.5, color: C.mid }}>
                어제 하루 <b style={{ color: yProfit >= 0 ? C.neon : C.red }}>{yProfit >= 0 ? "+" : "−"}₩{fmt(Math.abs(yProfit))}</b>
              </div>
            )}
            {/* 💳 월 예산 금고 — 한도 대비 소진 페이스 (목표 CPA ⚙️에서 설정) */}
            {(data.targets?.monthCap || 0) > 0 && (() => {
              const cap = data.targets.monthCap;
              const now = new Date();
              const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
              const elapsed = Math.round((now.getDate() / dim) * 100);
              const usedPct = Math.min(100, Math.round(((m.cur.spend || 0) / cap) * 100));
              const proj = Math.round((m.cur.spend || 0) / now.getDate() * dim);
              const over = proj > cap;
              return (
                <div style={{ flex: "1 1 230px", minWidth: 210 }}>
                  <div style={{ fontSize: 10, color: C.mid, display: "flex", justifyContent: "space-between" }}>
                    <span>💳 월 예산 금고 ₩{fmt(cap)}</span>
                    <span style={{ color: over ? C.red : C.neon, fontWeight: 800 }}>{usedPct}% 소진</span>
                  </div>
                  <div style={{ position: "relative", height: 10, background: "#0d0a12", border: `1px solid ${C.border}`,
                    borderRadius: 5, marginTop: 4, overflow: "hidden" }}>
                    <div style={{ width: `${usedPct}%`, height: "100%",
                      background: over ? C.red : usedPct > elapsed + 10 ? C.gold : C.neon }} />
                    <div title={`이번 달 경과 ${elapsed}%`} style={{ position: "absolute", left: `${elapsed}%`, top: 0, bottom: 0, width: 2, background: "#ffffff88" }} />
                  </div>
                  <div style={{ fontSize: 9.5, color: over ? C.red : C.mid, marginTop: 3, fontWeight: over ? 800 : 500 }}>
                    이 페이스면 월말 ₩{fmt(proj)} {over ? "— 한도 초과 예상 ⚠️ 지출 점검!" : "— 한도 내 페이스 ✅"} · 경과 {elapsed}%
                  </div>
                </div>
              );
            })()}
            <div style={{ marginLeft: "auto", fontSize: 10.5, color: C.mid }}>
              지난달 손익 {pProfit >= 0 ? "+" : "−"}₩{fmt(Math.abs(pProfit))} · 원가·수수료 미반영 참고치
            </div>
          </div>
        );
      })()}

      {/* 이달의 사원 */}
      {tab === "report" && mvp && (
        <div className="mvp" style={{ marginTop: 14, borderRadius: 14, padding: "12px 18px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <img src={charOf(mvp.id)} alt="" className="empWork" style={{ width: 44, height: 44, borderRadius: 10, imageRendering: "pixelated", border: "2px solid #1a1a1a" }} />
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#1a1a1a", background: "#fff8", padding: "4px 8px", borderRadius: 6 }}>이달의 사원</span>
          <b style={{ fontSize: 13.5 }}>{mvp.name}</b>
          <span style={{ fontSize: 12, color: "#3b2f00" }}>7일 판매 {mvp.purchases7}{mvp.view7 ? `+👁${mvp.view7}` : ""} · CPA ₩{fmt(mvp.cpa7)} — 사진 액자에 걸어드렸습니다 🖼</span>
          {top3.length > 1 && <span style={{ marginLeft: "auto", fontSize: 12, color: "#3b2f00" }}>
            {["🥇", "🥈", "🥉"].map((m, i) => top3[i] ? `${m}${avatarOf(top3[i].name)}${top3[i].purchases7}` : "").join("  ")}
          </span>}
        </div>
      )}

      {/* 🖼 명예의 전당 vs 반성의 구석 */}
      {tab === "report" && (fame.length > 0 || shame.length > 0) && (
        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          {fame.length > 0 && (
            <div style={{ ...card, flex: "2 1 340px" }}>
              <div style={{ fontSize: 11.5, color: C.gold, fontWeight: 800, marginBottom: 10 }}>🖼 명예의 전당 — 이번 주 벽에 걸린 소재</div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {fame.map((s, i) => (
                  <div key={s.id} className="fameFrame" onClick={() => jumpToDesk(s)} title={s.name}>
                    <img src={s.thumb} alt="" />
                    <span className="fameMedal">{["🥇", "🥈", "🥉"][i]}</span>
                    <div className="fameCap">🛒{s.purchases7}{s.cpa7 ? ` · ₩${fmt(s.cpa7)}` : ""}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {shame.length > 0 && (
            <div style={{ ...card, flex: "1 1 240px", borderColor: `${C.red}44` }}>
              <div style={{ fontSize: 11.5, color: C.red, fontWeight: 800, marginBottom: 10 }}>📌 반성의 구석 — 돈만 쓰는 소재</div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {shame.map((s) => (
                  <div key={s.id} className="shamePoster" onClick={() => jumpToDesk(s)} title={s.name}>
                    <img src={s.thumb} alt="" />
                    <div className="fameCap" style={{ color: C.red }}>₩{fmt(s.spend7)} · 🛒0</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🏁 부서 대항전 — 주간(7일) 판매 랭킹 */}
      {tab === "report" && data.campaigns.length > 1 && (() => {
        const depts = data.campaigns.map((c) => {
          const buy = c.adsets.reduce((a, s) => a + (s.purchases7 || 0), 0);
          const sp = c.adsets.reduce((a, s) => a + (s.spend7 || 0), 0);
          const vw = c.adsets.reduce((a, s) => a + (s.view7 || 0), 0);
          const w = buy + vw * 0.3;
          return { id: c.id, name: c.name, buy, sp, cpa: w >= 1 ? Math.round(sp / w) : null,
            alive: c.adsets.filter((s) => s.status === "ACTIVE").length };
        }).filter((d) => d.alive > 0 && d.sp > 0).sort((a, b) => b.buy - a.buy || a.sp - b.sp);
        if (depts.length < 2) return null;
        const maxBuy = Math.max(1, depts[0].buy);
        return (
          <div style={{ ...card, marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={px}>대항전</span>
              <span style={{ fontSize: 11, color: C.mid }}>이번 주 부서 판매 랭킹 — 꼴찌 부서는 야근입니다</span>
            </div>
            {depts.map((d, i) => {
              const last = i === depts.length - 1;
              const medal = i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : last ? "🕯" : "🏢";
              const cl = i === 0 ? C.gold : last ? C.red : C.cyan;
              return (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 8px", fontSize: 12,
                  background: i === 0 ? "#FFD16612" : "transparent", borderRadius: 8 }}>
                  <span style={{ fontSize: 15 }}>{medal}</span>
                  <span style={{ width: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>{d.name}</span>
                  <div style={{ flex: 1, height: 9, background: "#0d0a12", borderRadius: 5, overflow: "hidden", border: `1px solid ${C.border}` }}>
                    <div style={{ width: `${Math.max(3, Math.round((d.buy / maxBuy) * 100))}%`, height: "100%",
                      background: `repeating-linear-gradient(45deg, ${cl}, ${cl} 6px, ${cl}AA 6px, ${cl}AA 12px)`, boxShadow: `0 0 8px ${cl}` }} />
                  </div>
                  <b style={{ width: 54, textAlign: "right", color: cl }}>🛒{d.buy}</b>
                  <span style={{ width: 88, textAlign: "right", color: C.mid, fontSize: 11 }}>₩{fmt(d.sp)}</span>
                  <span style={{ width: 80, textAlign: "right", color: C.mid, fontSize: 11 }}>{d.cpa ? `CPA ₩${fmt(d.cpa)}` : "-"}</span>
                  {last && <span style={{ fontSize: 10, color: C.red }}>야근 확정</span>}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* 📅 월말 결산 — 이번 달 vs 지난 달 + 30일 지출 차트 */}
      {tab === "report" && data.monthly?.days30?.length > 0 && (() => {
        const { cur, prev, days30 } = data.monthly;
        const roasOf = (m) => (m.spend > 0 ? Math.round((m.rev / m.spend) * 100) / 100 : 0);
        const rows = [
          { t: "지출", a: cur.spend, b: prev.spend, f: (v) => `₩${fmt(v)}`, goodUp: false },
          { t: "판매", a: cur.buy, b: prev.buy, f: (v) => `🛒${v}`, goodUp: true },
          { t: "ROAS", a: roasOf(cur), b: roasOf(prev), f: (v) => `${v}`, goodUp: true },
        ];
        const maxSp = Math.max(1, ...days30.map((d) => d.spend));
        return (
          <div style={{ ...card, marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={px}>결산</span>
              <span style={{ fontSize: 12.5, fontWeight: 800 }}>📅 월말 결산 — {cur.mon.slice(5)}월 장부</span>
              <span style={{ fontSize: 10, color: C.mid }}>지난 달({prev.mon.slice(5)}월)은 한 달 전체, 이번 달은 진행 중</span>
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 10 }}>
              {rows.map((r) => {
                const up = r.a > r.b, same = r.a === r.b;
                const cl = same ? C.mid : (up === r.goodUp ? C.neon : C.red);
                return (
                  <div key={r.t} style={{ fontSize: 12 }}>
                    <span style={{ color: C.mid }}>{r.t} </span>
                    <b>{r.f(r.a)}</b>
                    <span style={{ color: cl, fontSize: 11, marginLeft: 4 }}>
                      {same ? "―" : up ? "▲" : "▼"} 지난달 {r.f(r.b)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 46 }}>
              {days30.map((d) => (
                <div key={d.d} title={`${d.d} ₩${fmt(d.spend)} 🛒${d.buy}`}
                  style={{ flex: 1, minWidth: 3, height: Math.max(2, Math.round((d.spend / maxSp) * 44)),
                    background: d.buy > 0 ? C.cyan : "#ffffff22", borderRadius: 2, opacity: d.d.startsWith(cur.mon) ? 1 : 0.45 }} />
              ))}
            </div>
            <div style={{ fontSize: 9.5, color: C.mid, opacity: 0.6, marginTop: 4 }}>최근 30일 일별 지출 (밝은 막대=이번 달, 하늘색=판매 발생일)</div>
            {/* 💰 월급날 보너스 — 이번 달 ROAS 목표 달성 여부 */}
            {(() => {
              const r = cur.spend > 0 ? cur.rev / cur.spend : 0;
              const hit = r >= 3;
              return (
                <div style={{ marginTop: 8, fontSize: 11.5, padding: "6px 10px", borderRadius: 8,
                  background: hit ? `${C.gold}18` : "#ffffff06", border: `1px dashed ${hit ? C.gold : C.border}` }}>
                  {hit
                    ? <span style={{ color: C.gold, fontWeight: 800 }}>💰 월급날 보너스 조건 달성! 이번 달 ROAS x{r.toFixed(1)} (기준 x3.0) — 전 부서 보너스 풀 확보</span>
                    : <span style={{ color: C.mid }}>💼 보너스 기준: 월 ROAS x3.0 이상 — 현재 x{r.toFixed(1)}, 조금 더 힘냅시다</span>}
                </div>
              );
            })()}
            {/* 🏆 주간 MVP 명예의전당 — 매주 자동 기록 */}
            {data.hall?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10.5, color: C.mid, marginBottom: 4 }}>🏆 주간 MVP 명예의전당 (매주 자동 헌액)</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {data.hall.map((h, i) => (
                    <div key={h.w} style={{ fontSize: 11, background: i === 0 ? `${C.gold}14` : "#ffffff06",
                      border: `1px solid ${i === 0 ? C.gold + "55" : C.border}`, borderRadius: 8, padding: "4px 9px" }}
                      title={`${h.w} 주 — 7일 판매 ${h.buy}건`}>
                      <span style={{ color: C.mid }}>{h.w.slice(5)}주</span> {avatarOf(h.name)} <b>{(prodKeyOf(h.name) || h.name).slice(0, 12)}</b>
                      <span style={{ color: C.neon }}> 🛒{h.buy}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* 📆 요일별 성과 히트맵 — 60일 표본, 어느 요일에 장사가 잘되나 */}
      {tab === "report" && (data.monthly?.days60?.length || 0) >= 14 && (() => {
        const days = data.monthly.days60.filter((d) => d.spend > 0 || d.buy > 0);
        const WD = ["일", "월", "화", "수", "목", "금", "토"];
        const agg = WD.map((w, i) => {
          const rows = days.filter((d) => new Date(d.d + "T12:00:00").getDay() === i);
          const sp = rows.reduce((a, x) => a + x.spend, 0), buy = rows.reduce((a, x) => a + x.buy, 0),
            rev = rows.reduce((a, x) => a + x.rev, 0);
          return { w, n: rows.length, spend: rows.length ? Math.round(sp / rows.length) : 0,
            buy: rows.length ? +(buy / rows.length).toFixed(1) : 0,
            roas: sp > 0 ? +(rev / sp).toFixed(1) : 0 };
        });
        const best = [...agg].sort((a, b) => b.roas - a.roas)[0];
        const maxRoas = Math.max(0.1, ...agg.map((a) => a.roas));
        return (
          <div style={{ ...card, marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={px}>요일</span>
              <span style={{ fontSize: 12.5, fontWeight: 800 }}>📆 요일별 장사 성적표 (최근 60일 평균)</span>
              {best?.roas > 0 && <span style={{ fontSize: 10.5, color: C.gold, fontWeight: 700 }}>🏆 {best.w}요일이 최고 효율 (ROAS x{best.roas}) — 이 날 예산을 아끼지 마세요</span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {agg.map((a) => {
                const heat = a.roas / maxRoas; // 0~1
                const bg = a.roas <= 0 ? "#ffffff08" : `rgba(78, 222, 128, ${0.08 + heat * 0.38})`;
                const isBest = a.w === best?.w && a.roas > 0;
                return (
                  <div key={a.w} title={`${a.w}요일 · 표본 ${a.n}일 · 일평균 지출 ₩${fmt(a.spend)} / 판매 ${a.buy}건 / ROAS x${a.roas}`}
                    style={{ flex: 1, textAlign: "center", borderRadius: 10, padding: "9px 4px", background: bg,
                      border: `1px solid ${isBest ? C.gold + "77" : C.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: a.w === "일" ? C.red : a.w === "토" ? C.cyan : C.ink }}>{a.w}</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: a.roas >= 3 ? C.neon : a.roas >= 1.5 ? C.cyan : C.mid, marginTop: 3 }}>
                      x{a.roas}
                    </div>
                    <div style={{ fontSize: 9, color: C.mid, marginTop: 2 }}>🛒{a.buy} · ₩{fmt(a.spend)}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 9.5, color: C.mid, opacity: 0.6, marginTop: 5 }}>진할수록 ROAS 높음 · 요일당 표본 8~9일 평균이라 참고용</div>
          </div>
        );
      })()}

      {/* 오늘의 미션 */}
      {tab === "work" && (() => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const actedToday = logArr.some((l) => (l.at || "").startsWith(todayStr));
        const missions = [
          { t: "결재함 비우기", done: queue.length === 0, hint: `${queue.length}건 남음` },
          { t: "어제 ROAS 3.0 달성", done: roas >= 3, hint: `현재 ${roas}` },
          { t: "오늘 조치 1건 이상", done: actedToday, hint: "결재·소재 정리 아무거나" },
        ];
        const all = missions.every((m) => m.done);
        return (
          <div style={{ marginTop: 12, background: C.panel, border: `1px solid ${all ? C.gold : C.border}`, borderRadius: 12, padding: "10px 16px",
            display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", boxShadow: all ? `0 0 16px ${C.gold}44` : "none" }}>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: C.purple }}>DAILY</span>
            {missions.map((m) => (
              <span key={m.t} style={{ fontSize: 12, color: m.done ? C.neon : C.mid, fontWeight: 700 }}>
                {m.done ? "✅" : "⬜"} {m.t} <span style={{ fontWeight: 400, fontSize: 10.5 }}>({m.hint})</span>
              </span>
            ))}
            {all && <span style={{ marginLeft: "auto", fontSize: 12, color: C.gold, fontWeight: 900 }}>🎉 퍼펙트 데이! 사장님 퇴근하셔도 됩니다</span>}
          </div>
        );
      })()}

      {/* 🤵 AI 비서 브리핑 */}
      {tab === "work" && (
      <div style={{ ...card, marginTop: 12, borderColor: brief ? `${C.purple}55` : C.border }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={px}>비서실</span>
          <span style={{ fontSize: 12.5, fontWeight: 800 }}>🤵 AI 비서 브리핑</span>
          <span style={{ fontSize: 10.5, color: C.mid }}>실데이터 기반 오늘의 지시 3개</span>
          <button style={{ ...btn(C.purple), padding: "4px 12px", fontSize: 11.5, marginLeft: "auto" }} disabled={briefBusy}
            onClick={() => loadBrief(false)}>{briefBusy ? "보고서 작성 중…" : brief ? "🔄 새 브리핑" : "📋 브리핑 받기"}</button>
        </div>
        {brief && (
          <div style={{ marginTop: 10 }}>
            {brief.mood && <div style={{ fontSize: 12, color: C.gold, marginBottom: 8, fontStyle: "italic" }}>💬 "{brief.mood}"</div>}
            {(brief.items || []).map((it, i) => {
              const cl = /증액/.test(it.action) ? C.neon : /중지|OFF/.test(it.action) ? C.red : /교체/.test(it.action) ? C.pink : C.gold;
              // 🖊 원클릭 결재 — 지시 대상 세트를 실데이터에서 찾아 즉시 실행 (돈은 결재 버튼으로만)
              const tg = String(it.target || "");
              const hit = allSets.find((x) => x.name === tg) ||
                allSets.find((x) => tg && (x.name.includes(tg) || tg.includes(x.name)));
              const canAct = hit && hit.status === "ACTIVE";
              return (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 8px", fontSize: 12,
                  background: "#ffffff06", borderRadius: 8, marginBottom: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: cl, border: `1px solid ${cl}66`, borderRadius: 5,
                    padding: "2px 7px", whiteSpace: "nowrap", marginTop: 1 }}>{it.action}</span>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <b style={{ color: C.ink }}>{it.target}</b>
                    <span style={{ color: C.mid }}> — {it.reason}</span>
                  </div>
                  {canAct && /증액/.test(it.action) && (
                    <button className="stampBtn" style={{ ...btn(C.neon), padding: "3px 10px", fontSize: 10.5 }} disabled={busy === hit.id}
                      onClick={() => act("budget", hit, { budget: Math.round(hit.budget * 1.25 / 1000) * 1000, note: "비서 지시 증액" })}>
                      🖊 결재 +25%</button>
                  )}
                  {canAct && /중지|OFF/.test(it.action) && (
                    <button className="stampBtn" style={{ ...btn(C.red), padding: "3px 10px", fontSize: 10.5 }} disabled={busy === hit.id}
                      onClick={() => act("pause", hit, { note: "비서 지시 중지" })}>
                      🖊 퇴근 결재</button>
                  )}
                  {canAct && /유지|관찰|교체/.test(it.action) && (
                    <button style={{ ...btn(C.mid), padding: "3px 10px", fontSize: 10.5 }}
                      onClick={() => jumpToDesk(hit)}>👀 책상 보기</button>
                  )}
                </div>
              );
            })}
            <div style={{ fontSize: 9.5, color: C.mid, opacity: 0.6 }}>
              {brief.at ? `${new Date(brief.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 보고` : ""}{brief.cached ? " · 캐시" : ""}
            </div>
          </div>
        )}
      </div>
      )}

      {/* 💰 연봉 협상 이벤트 */}
      {tab === "work" && nego && nego !== "no" && nego.s && (
        <div style={{ ...card, marginTop: 12, borderColor: `${C.gold}66`, boxShadow: `0 0 14px ${C.gold}22` }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 24 }}>{avatarOf(nego.s.name)}</span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: C.gold }}>💰 연봉 협상 요청</div>
              <div style={{ fontSize: 12, marginTop: 2 }}>
                <b>{nego.s.name}</b><span style={{ color: C.mid }}> — "요즘 제 실적 보셨죠? 🛒{nego.s.purchases7}건에 CPA {nego.s.cpa7 ? `₩${fmt(nego.s.cpa7)}` : "-"}입니다. 연봉(예산) 15% 인상 요구합니다!"</span>
              </div>
              <div style={{ fontSize: 10.5, color: C.mid, marginTop: 2 }}>현재 일예산 ₩{fmt(nego.s.budget)} → 수락 시 ₩{fmt(Math.round(nego.s.budget * 1.15 / 1000) * 1000)}</div>
            </div>
            <button className="btnGlow" style={btn(C.neon)} disabled={busy === nego.s.id}
              onClick={() => { const s = nego.s; setNego("no"); act("budget", s, { budget: Math.round(s.budget * 1.15 / 1000) * 1000, note: "연봉 협상 +15%" }); }}>
              🖊 인상 수락</button>
            <button style={btn(C.mid)} onClick={() => { setNego("no"); setEvt(["😤", `${(nego.s.name || "").slice(0, 14)}… "알겠습니다. 열심히 하겠습니다" (사기 -1)`]); setTimeout(() => setEvt(null), 4000); }}>
              거절</button>
          </div>
        </div>
      )}

      {/* ② 결재 서류함 */}
      {tab === "work" && (<>
      <h2 style={h2}><span style={px}>결재함</span> 사장님 결재 대기 {queue.length
        ? <span style={{ color: C.gold }}>({queue.length}건)</span>
        : <span style={{ color: C.neon, fontSize: 12 }}>결재할 서류가 없습니다 ✅ 사무실이 평화롭다</span>}</h2>
      {queue.map((s, qi) => {
        const conf = s.judge === "kill" ? { c: C.red, tag: "🪑 퇴근 결재" } : s.judge === "scale" ? { c: C.neon, tag: "💰 보너스 결재" } : { c: C.gold, tag: "👀 면담 필요" };
        return (
          <div key={s.id} className="quest paper" style={{ display: "flex", gap: 14, alignItems: "center",
            border: `1px solid ${conf.c}66`, boxShadow: `inset 4px 0 0 ${conf.c}, 0 0 14px ${conf.c}22`, borderRadius: 12,
            padding: "12px 16px", marginBottom: 8, flexWrap: "wrap", animationDelay: `${qi * 0.07}s`, background: C.panel }}>
            <span style={{ fontSize: 22 }}>{avatarOf(s.name)}</span>
            <span style={{ fontWeight: 800, fontSize: 11, color: conf.c, whiteSpace: "nowrap", fontFamily: "'Press Start 2P', monospace" }}>{conf.tag}</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div>
              <div style={{ fontSize: 11.5, color: C.mid }}>{s.camp} · 7일 ₩{fmt(s.spend7)} · 🛒{s.purchases7}{s.view7 ? `+👁${s.view7}` : ""} · CPA {s.cpa7 ? `₩${fmt(s.cpa7)}` : "-"} / 목표 ₩{fmt(s.target)}</div>
              {s.judge === "kill" && s.created && Math.floor((Date.now() - new Date(s.created)) / 86400000) < 7 && (
                <div style={{ fontSize: 10.5, color: C.gold }}>🐣 수습 기간(생성 7일 미만) — 학습 중이라 성급한 퇴근 주의</div>
              )}
              {s.judge === "kill" && s.hr?.c >= 3 && (
                <div style={{ fontSize: 10.5, color: C.red }}>⚠️ 경고 {s.hr.c}회 누적(14일) — 인사규정상 퇴근 대상입니다</div>
              )}
            </div>
            {s.judge === "scale" && (
              <button className="btnGlow stampBtn" style={btn(C.neon)} disabled={busy === s.id}
                onClick={() => act("budget", s, { budget: Math.round(s.budget * 1.25 / 1000) * 1000, note: "룰 증액 +25%" })}>
                🖊 보너스 +25% 결재</button>
            )}
            {s.judge === "kill" && (
              <button className="btnShake stampBtn" style={btn(C.red)} disabled={busy === s.id}
                onClick={() => act("pause", s, { note: "룰 중지" })}>🖊 퇴근 결재</button>
            )}
            {s.judge === "watch" && <span style={{ fontSize: 11.5, color: C.mid }}>소재(작업물) 교체 → 광고 스튜디오</span>}
          </div>
        );
      })}

      {/* ③ 사무실 층별(부서) → 직원 책상 */}
      <h2 style={h2}><span style={px}>사무실</span> 부서별 직원 현황
        <button style={{ ...btn(C.mid), padding: "3px 10px", fontSize: 10.5, marginLeft: "auto" }}
          onClick={() => { SFX.click(); setTgtEdit(tgtEdit ? null : {
            default: data.targets?.default || 30000,
            monthCap: data.targets?.monthCap || 0,
            rules: (data.targets?.rules || []).map((r) => ({ ...r })) }); }}>
          ⚙️ 목표 CPA {tgtEdit ? "닫기" : "관리"}</button>
      </h2>
      {/* 🎯 목표 CPA 편집 — 등급·판정·브리핑의 기준값 */}
      {tgtEdit && (
        <div style={{ ...card, marginBottom: 12, borderColor: `${C.cyan}55` }}>
          <div style={{ fontSize: 11, color: C.mid, marginBottom: 8 }}>
            🎯 목표 CPA 규정 — 캠페인 이름에 <b style={{ color: C.ink }}>키워드</b>가 포함되면 해당 목표 적용, 없으면 기본값. (등급 S/A/B/C·결재 판정·비서 브리핑이 모두 이 기준으로 계산됩니다)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12 }}>
            <span style={{ width: 130, color: C.mid }}>기본 목표</span>
            <input type="number" step={1000} value={tgtEdit.default}
              onChange={(e) => setTgtEdit({ ...tgtEdit, default: Number(e.target.value) })}
              style={{ width: 110, background: "#0d0a12", border: `1px solid ${C.border}`, borderRadius: 7, color: C.ink, padding: "5px 8px", fontSize: 12 }} />
            <span style={{ color: C.mid, fontSize: 10.5 }}>원</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12 }}>
            <span style={{ width: 130, color: C.mid }}>💳 월 예산 한도</span>
            <input type="number" step={100000} value={tgtEdit.monthCap || 0}
              onChange={(e) => setTgtEdit({ ...tgtEdit, monthCap: Number(e.target.value) })}
              style={{ width: 130, background: "#0d0a12", border: `1px solid ${C.border}`, borderRadius: 7, color: C.ink, padding: "5px 8px", fontSize: 12 }} />
            <span style={{ color: C.mid, fontSize: 10.5 }}>원 (0=미설정 — 설정하면 계좌 카드에 금고 게이지 표시)</span>
          </div>
          {tgtEdit.rules.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, fontSize: 12 }}>
              <input placeholder="캠페인 키워드 (예: 소닉플로우)" value={r.match}
                onChange={(e) => setTgtEdit({ ...tgtEdit, rules: tgtEdit.rules.map((x, j) => j === i ? { ...x, match: e.target.value } : x) })}
                style={{ width: 200, background: "#0d0a12", border: `1px solid ${C.border}`, borderRadius: 7, color: C.ink, padding: "5px 8px", fontSize: 12 }} />
              <input type="number" step={1000} value={r.cpa}
                onChange={(e) => setTgtEdit({ ...tgtEdit, rules: tgtEdit.rules.map((x, j) => j === i ? { ...x, cpa: Number(e.target.value) } : x) })}
                style={{ width: 110, background: "#0d0a12", border: `1px solid ${C.border}`, borderRadius: 7, color: C.ink, padding: "5px 8px", fontSize: 12 }} />
              <span style={{ color: C.mid, fontSize: 10.5 }}>원</span>
              <button style={{ ...btn(C.red), padding: "2px 8px", fontSize: 10 }}
                onClick={() => setTgtEdit({ ...tgtEdit, rules: tgtEdit.rules.filter((_, j) => j !== i) })}>삭제</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button style={{ ...btn(C.mid), padding: "4px 12px", fontSize: 11 }}
              onClick={() => setTgtEdit({ ...tgtEdit, rules: [...tgtEdit.rules, { match: "", cpa: tgtEdit.default || 30000 }] })}>＋ 규칙 추가</button>
            <button className="btnGlow" style={{ ...btn(C.cyan), padding: "4px 14px", fontSize: 11, marginLeft: "auto" }} disabled={busy === "__tgt"}
              onClick={async () => {
                SFX.click(); setBusy("__tgt");
                try {
                  const j = await fetch("/api/ad-console", { method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "targets", targets: tgtEdit }) }).then((r) => r.json());
                  if (!j.ok) throw new Error(j.error);
                  setTgtEdit(null); setEvt(["🎯", "목표 CPA 규정 개정 완료 — 새 기준으로 재평가합니다"]); setTimeout(() => setEvt(null), 3500);
                  load(true);
                } catch (e) { alert("저장 실패: " + e.message); }
                setBusy(null);
              }}>🖊 규정 저장</button>
          </div>
        </div>
      )}
      {/* 🏅 성과등급 규정표 — 보상·징계의 근거를 명문화 */}
      <div style={{ fontSize: 10.5, color: C.mid, margin: "-4px 0 10px", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <span style={{ color: C.mid }}>인사규정:</span>
        <span><b style={{ color: C.gold }}>S</b> 목표CPA 70%↓ = 🏅표창·증액 후보</span>
        <span><b style={{ color: C.neon }}>A</b> 목표 이내 = 정상 근무</span>
        <span><b style={{ color: C.cyan }}>B</b> 1.5배 이내 = 관찰</span>
        <span><b style={{ color: C.red }}>C</b> 초과·무구매 = ⚠️경고 (14일 내 3회 누적 시 퇴근 심사)</span>
      </div>
      {data.metaDown && <div style={{ fontSize: 12.5, color: C.mid, padding: "14px 16px", background: C.panel, border: `1px dashed ${C.border}`, borderRadius: 12, marginBottom: 12 }}>
        😴 메타 사원들은 회선 점검으로 잠시 자리 비움 — 아래 협력사·직영 현황은 정상 근무 중</div>}
      {data.campaigns.map((c) => {
        const tot = c.adsets.reduce((a, s) => a + s.spend7, 0);
        const buy = c.adsets.reduce((a, s) => a + (s.purchases7 || 0), 0);
        const vw = c.adsets.reduce((a, s) => a + (s.view7 || 0), 0);
        const wsum = buy + vw * 0.3;
        const cCpa = wsum >= 1 ? Math.round(tot / wsum) : null;
        const alive = c.adsets.filter((s) => s.status === "ACTIVE").length;
        if (!alive || (tot <= 0 && buy <= 0)) return null; // 전원 퇴근·7일 지출 0 부서는 통째로 숨김 ("운영 안하는 건 안 보이게")
        return (
          <div key={c.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
            <button onClick={() => { SFX.click(); const opening = !openCamp[c.id]; setOpenCamp((o) => ({ ...o, [c.id]: !o[c.id] })); if (opening) autoOpenAds(c.adsets); }}
              style={{ width: "100%", textAlign: "left", padding: "13px 16px", background: "none", border: "none",
                cursor: "pointer", display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 800, color: C.ink, gap: 8, flexWrap: "wrap" }}>
              <span>🚪 {c.name}
                <span onClick={(e) => { e.stopPropagation(); openDetail(c.id, "camp", c.name); }} title="캠페인 14일 상세"
                  style={{ marginLeft: 8, fontSize: 12, cursor: "pointer" }}>📋</span>
                <span style={{ color: C.mid, fontWeight: 500, fontSize: 11, marginLeft: 6 }}>목표 ₩{fmt(c.target)} · 근무 {alive}/{c.adsets.length}명</span></span>
              <span style={{ color: C.gold }}>₩{fmt(tot)} <span style={{ color: C.neon, fontSize: 11.5 }}>🛒{buy}{vw ? `+👁${vw}` : ""}</span>{cCpa && <span style={{ color: C.cyan, fontSize: 11.5 }}> CPA ₩{fmt(cCpa)}</span>} {openCamp[c.id] ? "▲" : "▼"}</span>
            </button>
            {openCamp[c.id] && (() => {
              const working = c.adsets.filter((s) => s.status === "ACTIVE");
              const off = c.adsets.filter((s) => s.status !== "ACTIVE");
              const list = showOff[c.id] ? [...working, ...off] : working;
              return (
                <div style={{ padding: "6px 12px 14px" }}>
                  <div className="officeFloor" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(315px,1fr))", gap: 12 }}>
                    {list.map((s) => (
                      <Desk key={s.id} s={s} busy={busy} act={act} adsOpen={adsOpen[s.id]} ads={adsCache[s.id]}
                        toggleAds={toggleAds} isMvp={mvp && s.id === mvp.id} talkTick={talkTick} onAdStatus={adStatus} onDetail={openDetail}
                        spot={spot === s.id} />
                    ))}
                  </div>
                  {off.length > 0 && (
                    <span onClick={() => setShowOff((o) => ({ ...o, [c.id]: !o[c.id] }))}
                      style={{ display: "inline-block", marginTop: 8, fontSize: 10, color: C.mid, opacity: 0.55, cursor: "pointer" }}>
                      {showOff[c.id] ? "퇴근자 숨기기" : `퇴근 ${off.length}`}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}
      </>)}

      {/* ④ 외주 파트너 — 네이버 */}
      {tab === "partner" && data.naver && (() => {
        const nR = data.naver.tot.spend ? data.naver.tot.rev / data.naver.tot.spend : 0;
        return (
        <>
          <h2 style={h2}><span style={px}>협력사</span> 🟢 네이버 검색광고 <span style={{ fontSize: 10.5, color: C.mid, fontWeight: 400 }}>어제 {data.naver.date}</span></h2>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <Partner label="💸 어제 지출" v={`₩${fmt(Math.round(data.naver.tot.spend))}`} color={C.gold} />
              <Partner label="🛒 전환" v={fmt(data.naver.tot.conv)} color={C.neon} />
              <Partner label="📈 ROAS" v={`x${nR.toFixed(1)}`} color={nR >= 3 ? C.neon : nR >= 1 ? C.gold : C.red} big />
              <Partner label="💰 매출" v={`₩${fmt(Math.round(data.naver.tot.rev))}`} color={C.cyan} />
            </div>
            {[...data.naver.camps].sort((a, b) => b.spend - a.spend).slice(0, 10).map((g, i) => {
              const r = g.spend ? g.rev / g.spend : 0;
              const cl = r >= 3 ? C.neon : r >= 1 ? C.gold : C.red;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", fontSize: 12.5,
                  background: i % 2 ? "transparent" : "#ffffff06", borderRadius: 8 }}>
                  <span style={{ fontSize: 15 }}>{r >= 3 ? "🤝" : r >= 1 ? "🏪" : "🥶"}</span>
                  <span style={{ width: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{g.name}</span>
                  <div style={{ flex: 1, height: 9, background: "#0d0a12", borderRadius: 5, overflow: "hidden", border: `1px solid ${C.border}` }}>
                    <div className="hpbar" style={{ width: `${Math.min(100, r * 5)}%`, height: "100%", "--hp": cl,
                      background: `repeating-linear-gradient(45deg, ${cl}, ${cl} 6px, ${cl}AA 6px, ${cl}AA 12px)`, boxShadow: `0 0 8px ${cl}` }} />
                  </div>
                  <span style={{ width: 90, textAlign: "right", color: C.mid }}>₩{fmt(Math.round(g.spend))}</span>
                  <span style={{ width: 52, textAlign: "right", color: C.mid }}>🛒{g.conv}</span>
                  <b style={{ width: 48, textAlign: "right", color: cl, fontSize: 13 }}>x{r.toFixed(1)}</b>
                </div>
              );
            })}
          </div>
        </>
        );
      })()}

      {/* AD부스터 (ADVoost) — 오아 직영 */}
      {tab === "partner" && data.advoost?.ok && data.advoost.boost?.length > 0 && (() => {
        const bt = data.advoost.boost_tot;
        const aR = bt.cost ? bt.rev / bt.cost : 0;
        return (
        <>
          <h2 style={h2}><span style={px}>직영</span> 🚀 AD부스터 <span style={{ fontSize: 10.5, color: C.mid, fontWeight: 400 }}>{data.advoost.period} · 매일 아침 갱신</span></h2>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <Partner label="💸 7일 지출" v={`₩${fmt(Math.round(bt.cost))}`} color={C.gold} />
              <Partner label="🛒 전환" v={fmt(bt.conv)} color={C.neon} />
              <Partner label="📈 ROAS" v={`x${aR.toFixed(1)}`} color={aR >= 10 ? C.neon : aR >= 3 ? C.gold : C.red} big />
              <Partner label="💰 매출" v={`₩${fmt(Math.round(bt.rev))}`} color={C.cyan} />
            </div>
            {data.advoost.boost.map((g, i) => {
              const r = g.cost ? g.rev / g.cost : 0;
              const cl = r >= 10 ? C.neon : r >= 3 ? C.gold : C.red;
              const nm = `[${g.acct}] ` + g.name.replace("MO_오아_AD부스터_", "").split("#")[0];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", fontSize: 12.5,
                  background: i % 2 ? "transparent" : "#ffffff06", borderRadius: 8 }}>
                  <span style={{ fontSize: 15 }}>{r >= 15 ? "🔥" : r >= 3 ? "🚀" : "🥶"}</span>
                  <span style={{ width: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{nm}</span>
                  <div style={{ flex: 1, height: 9, background: "#0d0a12", borderRadius: 5, overflow: "hidden", border: `1px solid ${C.border}` }}>
                    <div className="hpbar" style={{ width: `${Math.min(100, r * 3.3)}%`, height: "100%", "--hp": cl,
                      background: `repeating-linear-gradient(45deg, ${cl}, ${cl} 6px, ${cl}AA 6px, ${cl}AA 12px)`, boxShadow: `0 0 8px ${cl}` }} />
                  </div>
                  <span style={{ width: 90, textAlign: "right", color: C.mid }}>₩{fmt(Math.round(g.cost))}</span>
                  <span style={{ width: 52, textAlign: "right", color: C.mid }}>🛒{g.conv}</span>
                  <b style={{ width: 48, textAlign: "right", color: cl, fontSize: 13 }}>x{r.toFixed(1)}</b>
                </div>
              );
            })}
          </div>
        </>
        );
      })()}

      {/* ⑤ 외주 파트너 — GFA */}
      {tab === "partner" && data.gfa && (() => {
        const gR = data.gfa.tot?.cost ? (data.gfa.tot.rev || 0) / data.gfa.tot.cost : 0;
        return (
        <>
          <h2 style={h2}><span style={px}>협력사</span> 🟩 GFA 성과형 <span style={{ fontSize: 10.5, color: C.mid, fontWeight: 400 }}>{data.gfa.date || ""}</span></h2>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <Partner label="💸 지출" v={`₩${fmt(Math.round(data.gfa.tot?.cost || 0))}`} color={C.gold} />
              <Partner label="🛒 구매" v={fmt(data.gfa.tot?.buy)} color={C.neon} />
              <Partner label="📈 ROAS" v={`x${gR.toFixed(1)}`} color={gR >= 3 ? C.neon : gR >= 1 ? C.gold : C.red} big />
            </div>
            {[...(data.gfa.camps || [])].sort((a, b) => (b.cost || 0) - (a.cost || 0)).map((g, i) => {
              const r = g.cost ? (g.rev || 0) / g.cost : 0;
              const danger = g.cost >= 30000 && r < 1;
              const cl = r >= 3 ? C.neon : r >= 1 ? C.gold : C.red;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", fontSize: 12.5,
                  background: danger ? "#FF6B8112" : i % 2 ? "transparent" : "#ffffff06", borderRadius: 8,
                  border: danger ? `1px solid ${C.red}44` : "none" }}>
                  <span style={{ fontSize: 15 }}>{danger ? "🚨" : r >= 3 ? "🤝" : "🏪"}</span>
                  <span style={{ width: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{g.name}</span>
                  <div style={{ flex: 1, height: 9, background: "#0d0a12", borderRadius: 5, overflow: "hidden", border: `1px solid ${C.border}` }}>
                    <div className="hpbar" style={{ width: `${Math.min(100, r * 5)}%`, height: "100%", "--hp": cl,
                      background: `repeating-linear-gradient(45deg, ${cl}, ${cl} 6px, ${cl}AA 6px, ${cl}AA 12px)`, boxShadow: `0 0 8px ${cl}` }} />
                  </div>
                  <span style={{ width: 90, textAlign: "right", color: C.mid }}>₩{fmt(Math.round(g.cost))}</span>
                  <span style={{ width: 52, textAlign: "right", color: C.mid }}>🛒{g.buy}</span>
                  <b style={{ width: 48, textAlign: "right", color: cl, fontSize: 13 }}>x{r.toFixed(1)}</b>
                </div>
              );
            })}
          </div>
        </>
        );
      })()}

      {/* ⑥ 인사기록부 */}
      {tab === "log" && logArr.length > 0 && (
        <>
          <h2 style={h2}><span style={px}>인사부</span> 📇 인사 기록부 <span style={{ fontSize: 10.5, color: C.mid, fontWeight: 400 }}>결재 후 3일 실적으로 승진/반성 판정</span></h2>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "10px 16px", fontSize: 12 }}>
            {logArr.map((l, i) => {
              // ↩️ 실패 결재 원클릭 롤백 — 예산 결재가 fail이면 당시 예산으로 되돌리는 결재서류를 올림
              const rbSet = l.verdict === "fail" && l.before?.budget && l.desc?.includes("예산")
                ? allSets.find((x) => x.id === l.adsetId && x.status === "ACTIVE" && x.budget !== l.before.budget) : null;
              return (
              <div key={i} style={{ padding: "4px 0", color: C.mid }}>
                <span style={{ color: C.purple }}>{(l.at || "").slice(5, 16).replace("T", " ")}</span> — <b style={{ color: C.ink }}>{l.name}</b> {l.desc} {l.note && `(${l.note})`}
                {l.by && <span title={`결재 도장: ${l.by}`} style={{ marginLeft: 5, fontSize: 9.5, color: "#E06C5E",
                  border: "1px solid #E06C5E66", borderRadius: 99, padding: "1px 6px", fontWeight: 800 }}>🖊 {l.by}</span>}
                {l.before && l.now && (l.before.cpa7 || l.now.cpa3) && (
                  <span style={{ fontSize: 11, color: C.cyan }}>
                    {" "}📒 당시 CPA {l.before.cpa7 ? `₩${fmt(l.before.cpa7)}` : "-"} → 지금 3일 {l.now.cpa3 ? `₩${fmt(l.now.cpa3)}` : "판매 없음"}
                    {l.before.cpa7 && l.now.cpa3 && (l.now.cpa3 <= l.before.cpa7
                      ? <b style={{ color: C.neon }}> ▼ 개선</b> : <b style={{ color: C.red }}> ▲ 악화</b>)}
                  </span>
                )}
                {l.verdict === "win" && <span style={{ color: C.neon, fontWeight: 800 }}> ✅ 승진! (3일 CPA ₩{fmt(l.now?.cpa3)})</span>}
                {l.verdict === "fail" && <span style={{ color: C.red, fontWeight: 800 }}> ❌ 반성문 ({l.now?.cpa3 ? `₩${fmt(l.now.cpa3)}` : "판매 0"}){!rbSet && " → 롤백 검토"}</span>}
                {rbSet && (
                  <button style={{ ...btn(C.red), padding: "2px 9px", fontSize: 10.5, marginLeft: 6 }} disabled={busy === rbSet.id}
                    onClick={() => act("budget", rbSet, { budget: l.before.budget, note: "실패 결재 롤백" })}>
                    ↩️ ₩{fmt(l.before.budget)}로 롤백
                  </button>
                )}
                {!l.verdict && l.now && l.desc?.includes("예산") && <span> ⏳ 인사평가 대기</span>}
              </div>
            ); })}
          </div>
        </>
      )}
      {tab === "log" && logArr.length === 0 && (
        <div style={{ fontSize: 12.5, color: C.mid, padding: "20px 16px", background: C.panel, border: `1px dashed ${C.border}`, borderRadius: 12 }}>
          📇 아직 결재 기록이 없어요 — 결재함에서 첫 결재를 하면 여기에 남습니다
        </div>
      )}
      {/* 📋 인사카드 모달 — 세트/캠페인 14일 상세 */}
      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "#000A", display: "flex",
          alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16,
            padding: "18px 20px", width: "min(680px, 94vw)", maxHeight: "86vh", overflowY: "auto" }}>
            {detail.busy || !detail.data ? (
              <div style={{ padding: 40, textAlign: "center", color: C.cyan, fontSize: 13 }}>📇 인사 기록 열람 중…</div>
            ) : (() => {
              const d = detail.data;
              const mx = Math.max(1, ...d.days.map((x) => x.spend));
              const tabs = detail.kind === "set"
                ? [["개요", "ov"], [`소재별 (${(d.ads || []).length})`, "ads"], [`제품별 (${(d.products || []).length})`, "prod"]]
                : [["개요", "ov"]];
              const dt = detail.tab || "ov";
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                    {detail.kind === "camp" ? <span style={{ fontSize: 24 }}>🚪</span>
                      : <img src={charOf(d.id)} alt="" style={{ width: 44, height: 44, borderRadius: 10, imageRendering: "pixelated", border: `1px solid ${C.border}` }} />}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800 }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: C.mid }}>
                        {detail.kind === "camp" ? "캠페인" : `세트 · ${detail.camp || ""}`} · {d.status === "ACTIVE" ? "🟢 근무 중" : "🪑 퇴근"}
                        {d.budget ? ` · 월급 ₩${fmt(d.budget)}` : ""}{d.created ? ` · 입사 ${d.created}` : ""}
                      </div>
                    </div>
                    <button onClick={() => setDetail(null)} style={{ ...btn(C.mid), padding: "4px 10px" }}>✕</button>
                  </div>
                  {tabs.length > 1 && (
                    <div style={{ display: "flex", gap: 6, margin: "10px 0 2px" }}>
                      {tabs.map(([lb, k]) => (
                        <button key={k} onClick={() => setDetail((dd) => ({ ...dd, tab: k }))}
                          style={{ ...btn(dt === k ? C.neon : C.mid), padding: "4px 12px", fontSize: 11.5,
                            background: dt === k ? `${C.neon}22` : "transparent" }}>{lb}</button>
                      ))}
                    </div>
                  )}
                  {dt === "ads" && (
                    <div style={{ marginTop: 10 }}>
                      {(d.ads || []).length === 0 && <div style={{ fontSize: 12, color: C.mid, padding: 20 }}>소재 데이터 없음</div>}
                      {(d.ads || []).map((a) => {
                        const off = a.status !== "ACTIVE";
                        return (
                          <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 8px",
                            background: "#ffffff06", borderRadius: 10, marginBottom: 6, opacity: off ? 0.5 : 1 }}>
                            {a.thumb ? <img src={a.thumb} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 7, filter: off ? "grayscale(1)" : "none" }} />
                              : <span style={{ width: 52, textAlign: "center", fontSize: 22 }}>🖼</span>}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{off ? "⏸ " : ""}{a.name}</div>
                              <div style={{ fontSize: 10.5, color: C.mid }}>₩{fmt(a.spend)} · 🛒{a.purchases}{a.views ? `+👁${a.views}` : ""} · CTR {a.ctr.toFixed(2)}%{a.cpa ? ` · CPA ₩${fmt(a.cpa)}` : ""}</div>
                            </div>
                            <b style={{ color: a.roas >= 3 ? C.neon : a.roas >= 1 ? C.gold : C.red, fontSize: 13 }}>x{a.roas}</b>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {dt === "prod" && (
                    <div style={{ marginTop: 10 }}>
                      {(d.products || []).length === 0 && <div style={{ fontSize: 12, color: C.mid, padding: 20 }}>제품별 분해 데이터가 없어요 (카탈로그 세트가 아니거나 기간 내 실적 없음)</div>}
                      {(d.products || []).map((p, i) => (
                        <div key={p.productId + i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 8px",
                          background: "#ffffff06", borderRadius: 10, marginBottom: 6 }}>
                          <span style={{ fontSize: 16 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "📦"}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name || `제품 ${p.productId}`}</div>
                            <div style={{ fontSize: 10.5, color: C.mid }}>₩{fmt(p.spend)} · 🛒{p.purchases}{p.views ? `+👁${p.views}` : ""} · 매출 ₩{fmt(p.revenue)}</div>
                          </div>
                          <b style={{ color: p.roas >= 3 ? C.neon : p.roas >= 1 ? C.gold : C.red, fontSize: 13 }}>x{p.roas}</b>
                        </div>
                      ))}
                    </div>
                  )}
                  {dt === "ov" && (<>
                  <div style={{ fontSize: 10.5, color: C.mid, margin: "10px 0 4px" }}>최근 14일 일별 지출 (🛒 = 그날 판매)</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 110, padding: "0 2px", borderBottom: `1px solid ${C.border}` }}>
                    {d.days.map((x) => {
                      const h = Math.max(4, Math.round((x.spend / mx) * 88));
                      const good = x.purchases > 0;
                      return (
                        <div key={x.date} title={`${x.date} · ₩${fmt(x.spend)} · 🛒${x.purchases}${x.views ? `+👁${x.views}` : ""} · 클릭 ${fmt(x.clicks)}`}
                          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                          {good && <span style={{ fontSize: 9, color: C.neon, fontWeight: 800 }}>{x.purchases}</span>}
                          <div style={{ width: "78%", height: h, borderRadius: "3px 3px 0 0",
                            background: good ? `linear-gradient(${C.neon}, ${C.neon}55)` : `linear-gradient(${C.purple}88, ${C.purple}33)`,
                            boxShadow: good ? `0 0 8px ${C.neon}55` : "none" }} />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 3, padding: "3px 2px 0", marginBottom: 12 }}>
                    {d.days.map((x) => <span key={x.date} style={{ flex: 1, textAlign: "center", fontSize: 8, color: C.mid }}>{x.date.slice(3)}</span>)}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(105px,1fr))", gap: 8 }}>
                    {[["💸 14일 지출", `₩${fmt(d.tot.spend)}`, C.gold], ["🛒 판매(가중)", `${d.tot.purchases}${d.tot.views ? `+👁${d.tot.views}` : ""}`, C.neon],
                      ["🎯 CPA", d.tot.cpa ? `₩${fmt(d.tot.cpa)}` : "-", C.cyan], ["📈 ROAS", `x${d.tot.roas}`, d.tot.roas >= 3 ? C.neon : d.tot.roas >= 1 ? C.gold : C.red],
                      ["💰 매출", `₩${fmt(d.tot.revenue)}`, C.pink], ["👀 노출", fmt(d.tot.impressions), C.purple],
                      ["🙋 도달", fmt(d.tot.reach), C.purple], ["👆 클릭", fmt(d.tot.clicks), C.cyan],
                      ["CTR", `${d.tot.ctr.toFixed(2)}%`, C.mid], ["CPC", `₩${fmt(d.tot.cpc)}`, C.mid],
                      ["빈도", d.tot.freq.toFixed(1), d.tot.freq >= 4 ? C.red : C.mid]].map(([l, v, cl]) => (
                      <div key={l} style={{ background: "#0d0a12", border: `1px solid ${C.border}`, borderRadius: 9, padding: "7px 10px" }}>
                        <div style={{ fontSize: 9, color: C.mid }}>{l}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: cl }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {d.tot.freq >= 4 && <div style={{ marginTop: 8, fontSize: 11, color: C.red }}>⚠️ 빈도 {d.tot.freq.toFixed(1)} — 같은 사람에게 너무 자주 노출 중, 소재 교체 시점</div>}
                  </>)}
                </>
              );
            })()}
          </div>
        </div>
      )}
      {/* 🎲 랜덤 사무실 이벤트 토스트 */}
      {evt && (
        <div className="evtToast" style={{ position: "fixed", left: 16, bottom: 16, zIndex: 55, background: C.panel,
          border: `1px solid ${C.border}`, borderRadius: 12, padding: "9px 14px", display: "flex", gap: 9, alignItems: "center",
          boxShadow: "0 6px 24px #000A", fontSize: 12, maxWidth: 320 }}>
          <span style={{ fontSize: 20 }}>{evt[0]}</span>
          <span style={{ color: C.mid }}>{evt[1]}</span>
        </div>
      )}
    </Shell>
  );
}

function Partner({ label, v, color, big }) {
  return (
    <div style={{ background: "#0d0a12", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", flex: "0 0 auto" }}>
      <div style={{ fontSize: 9.5, color: C.mid }}>{label}</div>
      <div style={{ fontSize: big ? 20 : 15, fontWeight: 900, color, textShadow: big ? `0 0 10px ${color}66` : "none" }}>{v}</div>
    </div>
  );
}

function Stat({ label, v, prefix = "", suffix = "", color }) {
  const x = useCountUp(v);
  return (
    <div style={{ ...card, flex: "1 1 150px", minWidth: 140 }}>
      <div style={pxLabel}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 5, color }}>{v == null ? "-" : `${prefix}${fmt(x)}${suffix}`}</div>
    </div>
  );
}

// ── 직원 책상 카드 ──────────────────────────────────────────────────────
function Desk({ s, busy, act, adsOpen, ads, toggleAds, isMvp, talkTick, onAdStatus, onDetail, spot }) {
  const [eb, setEb] = useState(null);
  const [pet, setPet] = useState(0); // 쓰다듬기 하트 이펙트
  const [showOffAds, setShowOffAds] = useState(false); // 꺼진 소재 표시 토글
  const morale = s.cpa7 == null ? (s.spend7 > 0 ? 20 : 60)
    : Math.max(5, Math.min(100, Math.round(100 - ((s.cpa7 / s.target) - 0.5) * 40)));
  const mColor = morale >= 70 ? C.neon : morale >= 40 ? C.gold : C.red;
  const dead = s.status !== "ACTIVE";
  const tier = dead ? "idle" : morale >= 70 ? "great" : morale >= 40 ? "ok" : s.spend7 > 0 ? "bad" : "idle";
  const seed = (s.id ? [...String(s.id)].reduce((a, ch) => a + ch.charCodeAt(0), 0) : 0) + talkTick;
  const rare = isMvp ? C.gold : s.judge === "scale" ? C.neon : s.judge === "kill" ? C.red : C.border;
  const earning = !dead && s.purchases7 >= 5; // 코인 이펙트 대상
  return (
    <div id={"desk-" + s.id} className={(isMvp ? "unitMvp" : "unit") + (spot ? " deskSpot" : "")} style={{ background: C.panel2, border: `1.5px solid ${dead ? C.border : rare}`,
      borderRadius: 12, padding: "10px 12px", opacity: dead ? 0.55 : 1, position: "relative", overflow: "visible" }}>
      {isMvp && <span style={{ position: "absolute", top: -9, right: 10, fontSize: 8.5, fontFamily: "'Press Start 2P', monospace",
        background: C.gold, color: "#1a1a1a", padding: "2px 6px", borderRadius: 4 }}>이달의 사원</span>}
      {/* 말풍선 */}
      {!adsOpen && (
        <div className="bubble" key={tier + (seed % 7)} style={{ borderColor: `${mColor}55` }}>
          {dead ? "…퇴근했습니다 (OFF)" : teamOf(s.id).still ? ["...", "냐", "(응시)", "...zzz", "골골골"][seed % 5] : talkOf(tier, seed)}
        </div>
      )}
      {/* 직원 + 책상 */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
        <div style={{ position: "relative", width: 56, textAlign: "center", flex: "none" }}>
          <img src={charOf(s.id)} alt="" className={dead || teamOf(s.id).still ? "" : tier === "great" ? "empWork fast" : tier === "bad" ? "empSad" : "empWork"}
            onClick={() => { if (dead) return; SFX.coin(); setPet((p) => p + 1); setTimeout(() => setPet((p) => Math.max(0, p - 1)), 1100); }}
            title={dead ? "퇴근" : "쓰다듬기"}
            style={{ width: 52, height: 52, borderRadius: 10, imageRendering: "pixelated", display: "inline-block",
              border: `1.5px solid ${dead ? C.border : `${mColor}55`}`, boxShadow: dead ? "none" : `0 0 10px ${mColor}33`,
              filter: dead ? "grayscale(1) brightness(0.55)" : tier === "bad" ? "saturate(0.65)" : "none",
              cursor: dead ? "default" : "pointer" }} />
          {pet > 0 && <span className="petHeart" style={{ position: "absolute", top: -10, left: 8, fontSize: 15 }}>💖</span>}
          {earning && <span className="coinPop" style={{ position: "absolute", top: -6, right: -4, fontSize: 13 }}>🪙</span>}
          {tier === "bad" && !dead && <span style={{ position: "absolute", top: -2, right: 0, fontSize: 12 }}>💦</span>}
          {dead && <span style={{ position: "absolute", top: -4, right: 2, fontSize: 12 }}>💤</span>}
        </div>
        {/* 책상 모니터 — 지금 송출 중인 대표 소재를 크게 (클릭=포트폴리오) */}
        {s.thumb && (
          <div className="deskMon" onClick={() => toggleAds(s.id)} title="모니터 — 지금 송출 중인 소재 (클릭하면 포트폴리오)"
            style={{ flex: "none", width: 104, borderRadius: 8, overflow: "hidden", cursor: "pointer", position: "relative",
              border: `2px solid ${dead ? C.border : `${mColor}66`}`, boxShadow: dead ? "none" : `0 0 12px ${mColor}33`, background: "#000" }}>
            <img src={s.thumb} alt="" style={{ width: "100%", height: 72, objectFit: "cover", display: "block", filter: dead ? "grayscale(1) brightness(0.6)" : "none" }} />
            <div className="monScan" />
            {tier === "great" && !dead && <span style={{ position: "absolute", top: 2, right: 4, fontSize: 11 }}>🔥</span>}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => toggleAds(s.id)} title="작업물(소재) 포트폴리오 보기"
              style={{ background: "none", border: "none", color: C.ink, fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "left", padding: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.name.slice(0, 26)}
            </button>
            {s.grade && (() => { // 🏅 성과등급 — 목표 CPA 대비 규정 (서버 판정)
              const gc = { S: C.gold, A: C.neon, B: C.cyan, C: C.red }[s.grade];
              return (
                <span title={`성과등급 ${s.grade} — 규정: S=목표CPA 70%↓ 표창 / A=목표 이내 / B=1.5배 이내 / C=초과·무구매 경고`}
                  style={{ fontSize: 10, fontWeight: 900, color: gc, border: `1px solid ${gc}88`, borderRadius: 4,
                    padding: "1px 6px", flex: "none", textShadow: `0 0 6px ${gc}66` }}>{s.grade}</span>
              );
            })()}
            <span style={{ fontSize: 9.5, color: C.mid, border: `1px solid ${C.border}`, borderRadius: 4, padding: "1px 5px", flex: "none" }}>{s.goal}</span>
            {(() => { // 🐣 신입 온보딩 — 생성 7일 미만은 학습 기간
              const days = s.created ? Math.floor((Date.now() - new Date(s.created)) / 86400000) : null;
              return days != null && days < 7 ? (
                <span title="세트 생성 7일 미만 — 머신러닝 학습 기간이라 판단 보류 권장"
                  style={{ fontSize: 9.5, color: C.gold, border: `1px solid ${C.gold}66`, borderRadius: 4, padding: "1px 5px", flex: "none", fontWeight: 800 }}>
                  🐣 수습 D+{days}</span>
              ) : null;
            })()}
          </div>
          {/* 사기(모럴) 게이지 */}
          <div style={{ height: 9, background: "#0d0a12", borderRadius: 5, margin: "6px 0 5px", overflow: "hidden", border: `1px solid ${C.border}` }}>
            <div className="hpbar" style={{ width: `${morale}%`, height: "100%", "--hp": mColor,
              background: `repeating-linear-gradient(45deg, ${mColor}, ${mColor} 6px, ${mColor}AA 6px, ${mColor}AA 12px)`,
              boxShadow: `0 0 10px ${mColor}` }} />
          </div>
          <div style={{ fontSize: 11, color: C.mid, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
            <span>사기 {morale} · 7일 <b style={{ color: C.gold }}>₩{fmt(s.spend7)}</b> · 🛒{s.purchases7}{s.view7 ? `+👁${s.view7}` : ""}
              {(s.buyToday || 0) > 0 && <b title="오늘 실시간 계약" style={{ color: C.neon, marginLeft: 4 }}>· 오늘 💰{s.buyToday}건!</b>}
              {(s.hr?.s > 0 || s.hr?.c > 0) && (
                <span title="14일 상벌 이력 — 🏅표창(S등급 일수) ⚠️경고(C등급 일수), 경고 3회 누적 시 퇴근 심사" style={{ marginLeft: 4 }}>
                  {s.hr.s > 0 && <span style={{ color: C.gold }}> 🏅{s.hr.s}</span>}
                  {s.hr.c > 0 && <span style={{ color: s.hr.c >= 3 ? C.red : C.mid }}> ⚠️{s.hr.c}</span>}
                </span>
              )}</span>
            <span>CPA <b style={{ color: mColor }}>{s.cpa7 ? `₩${fmt(s.cpa7)}` : "-"}</b></span>
          </div>
        </div>
      </div>
      {/* 액션 */}
      <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
        {eb == null ? (
          <button style={{ ...btn(C.cyan), padding: "4px 10px", fontSize: 11 }} onClick={() => { SFX.click(); setEb(s.budget); }}
            title="일예산 (클릭해서 수정)">💵 월급 ₩{fmt(s.budget)}</button>
        ) : (
          <>
            <input type="number" value={eb} onChange={(e) => setEb(e.target.value)} step="1000"
              style={{ width: 84, fontSize: 11.5, background: "#0d0a12", color: C.ink, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 6px" }} />
            <button style={{ ...btn(C.neon), padding: "3px 9px", fontSize: 11 }} disabled={busy === s.id}
              onClick={() => { act("budget", s, { budget: Number(eb), note: "수동" }); setEb(null); }}>결재</button>
            <button style={{ ...btn(C.mid), padding: "3px 7px", fontSize: 11 }} onClick={() => setEb(null)}>✕</button>
          </>
        )}
        {/* 💹 예산 시뮬레이터 — 7일 실적 기반 예상치 (체감 수익 체감: ^0.8) */}
        {eb != null && (() => {
          const nb = Number(eb) || 0;
          const daily = s.spend7 / 7;
          if (!(daily > 0 && s.purchases7 > 0 && nb > 0)) return (
            <div style={{ flexBasis: "100%", fontSize: 10, color: C.mid }}>
              <input type="range" min={Math.max(1000, Math.round(s.budget * 0.5 / 1000) * 1000)} max={s.budget * 2} step={1000}
                value={nb || s.budget} onChange={(e) => setEb(Number(e.target.value))} style={{ width: "100%", accentColor: C.cyan }} />
              실적이 부족해 예측 불가 — 감으로 결재하시죠 🎲
            </div>
          );
          const ratio = (nb / daily) ** 0.8; // 예산 늘려도 효율은 완만히 감소
          const pBuy = Math.round(s.purchases7 * ratio * 10) / 10;
          const pCpa = pBuy >= 0.5 ? Math.round((nb * 7) / pBuy) : null;
          const worse = pCpa && s.target && pCpa > s.target;
          return (
            <div style={{ flexBasis: "100%" }}>
              <input type="range" min={Math.max(1000, Math.round(s.budget * 0.5 / 1000) * 1000)} max={s.budget * 2} step={1000}
                value={nb} onChange={(e) => setEb(Number(e.target.value))} style={{ width: "100%", accentColor: C.cyan }} />
              <div style={{ fontSize: 10.5, color: C.mid }}>
                💹 ₩{fmt(nb)}/일이면 7일 예상: <b style={{ color: C.neon }}>🛒{pBuy}</b>
                {pCpa && <> · CPA <b style={{ color: worse ? C.red : C.cyan }}>₩{fmt(pCpa)}</b></>}
                {worse && <span style={{ color: C.red }}> ⚠️ 목표 초과 예상</span>}
                <span style={{ opacity: 0.55 }}> (7일 실적 기반 추정)</span>
              </div>
            </div>
          );
        })()}
        {!dead
          ? <button style={{ ...btn(C.red), padding: "4px 10px", fontSize: 11 }} disabled={busy === s.id} onClick={() => act("pause", s)} title="퇴근(OFF)">🪑 퇴근</button>
          : <button style={{ ...btn(C.neon), padding: "4px 10px", fontSize: 11 }} disabled={busy === s.id} onClick={() => act("resume", s)}>📢 재고용</button>}
        <button style={{ ...btn(C.purple), padding: "4px 9px", fontSize: 11 }} title="14일 상세(인사카드)"
          onClick={() => onDetail(s.id, "set", s.name)}>📋</button>
        <a href={studioUrl(s.name)} target="_blank" rel="noreferrer" title="광고 스튜디오에서 이 제품 새 소재 만들기 (제품 자동 검색)"
          style={{ ...btn(C.pink), padding: "4px 10px", fontSize: 11, textDecoration: "none" }}>🎨 소재 의뢰</a>
        {s.ctr7 > 0 && <span style={{ fontSize: 10.5, color: C.mid }}>CTR {s.ctr7.toFixed(2)}%</span>}
      </div>
      {/* 작업물 포트폴리오 */}
      {adsOpen && (
        <div style={{ marginTop: 8, borderTop: `1px dashed ${C.border}`, paddingTop: 8 }}>
          {!ads ? <span style={{ fontSize: 11, color: C.mid }}>📁 포트폴리오 가져오는 중…</span>
            : ads.length === 0 ? <span style={{ fontSize: 11, color: C.mid }}>작업물 없음</span> : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ads.filter((a) => showOffAds || a.status === "ACTIVE").map((a) => {
                const off = a.status !== "ACTIVE";
                // 피로도 — 7일 노출빈도(frequency) 기반: 같은 사람이 여러 번 볼수록 소재가 지침
                const fq = a.freq || 0;
                const fat = fq >= 4 ? 2 : fq >= 2.5 ? 1 : 0;
                const fatCl = fat === 2 ? C.red : fat === 1 ? C.gold : C.neon;
                return (
                <div key={a.id} style={{ width: 118, background: C.panel, border: `1px solid ${!off && fat === 2 ? `${C.red}66` : C.border}`, borderRadius: 8, padding: 6, opacity: off ? 0.45 : 1, position: "relative" }}>
                  {a.thumb && <img src={a.thumb} alt="" style={{ width: "100%", height: 64, objectFit: "cover", borderRadius: 5, filter: off ? "grayscale(1)" : "none" }} />}
                  <div style={{ fontSize: 9.5, marginTop: 4, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.name}>{a.name}</div>
                  {!off && fq > 0 && (
                    <div title={`7일 노출빈도 ${fq.toFixed(1)}회 — ${fat === 2 ? "소재 교체 시급" : fat === 1 ? "슬슬 피로 누적" : "아직 신선"}`}
                      style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <span style={{ fontSize: 10 }}>{fat === 2 ? "🪫" : fat === 1 ? "😮‍💨" : "🔋"}</span>
                      <div style={{ flex: 1, height: 5, background: "#0d0a12", borderRadius: 3, overflow: "hidden", border: `1px solid ${C.border}` }}>
                        <div style={{ width: `${Math.max(8, Math.min(100, Math.round(100 - (fq - 1) * 28)))}%`, height: "100%", background: fatCl, boxShadow: `0 0 5px ${fatCl}` }} />
                      </div>
                      <span style={{ fontSize: 8.5, color: fatCl, fontWeight: 700 }}>{fat === 2 ? "교체" : fq.toFixed(1)}</span>
                    </div>
                  )}
                  <div style={{ fontSize: 9.5, color: C.mid, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>₩{fmt(a.spend)} · 🛒{a.purchases}{a.cpa ? ` · ₩${fmt(a.cpa)}` : ""}</span>
                    <button onClick={() => onAdStatus(s.id, a, !off)} title={off ? "소재 다시 켜기" : "이 소재만 끄기"}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, padding: 0 }}>{off ? "▶️" : "⏸"}</button>
                  </div>
                </div>
              ); })}
            </div>
          )}
          {ads && ads.some((a) => a.status !== "ACTIVE") && (
            <button onClick={() => setShowOffAds((v) => !v)}
              style={{ marginTop: 6, background: "none", border: "none", cursor: "pointer", fontSize: 10.5, color: C.mid, padding: 0 }}>
              {showOffAds ? "🙈 꺼진 소재 숨기기" : `⏸ 꺼진 소재 ${ads.filter((a) => a.status !== "ACTIVE").length}개 보기`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// 사무실 레벨 장식 — 레벨마다 하나씩 언락
const DECOS = [
  { e: "🪴", n: "화분" }, { e: "☕", n: "커피머신" }, { e: "🐠", n: "어항" }, { e: "🖼", n: "그림" },
  { e: "🎮", n: "게임기" }, { e: "🛋", n: "소파" }, { e: "🤖", n: "안마의자" }, { e: "🏓", n: "탁구대" },
  { e: "🏆", n: "트로피 진열장" }, { e: "🎰", n: "간식 자판기" }, { e: "🛗", n: "전용 엘리베이터" }, { e: "🚁", n: "옥상 헬기장" },
];

const px = { fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#5ED3F3", letterSpacing: 1,
  border: "1px solid #3A2C4E", padding: "3px 6px", borderRadius: 5, marginRight: 8, verticalAlign: 2 };
const pxLabel = { fontSize: 10.5, color: "#9C8DB8", letterSpacing: 0.5 };
const h2 = { fontSize: 15, fontWeight: 800, margin: "28px 0 10px", letterSpacing: 0.5 };
const card = { background: "#241B31", border: "1px solid #3A2C4E", borderRadius: 14, padding: "12px 16px" };
const btn = (color) => ({ background: `${color}1E`, color, border: `1px solid ${color}77`, borderRadius: 8,
  padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" });

function Shell({ children, onRefresh, fx, shake, mute, toggleMute }) {
  // 🌙 밤 연출 — 19시~익일 7시는 사무실 소등 톤
  const hh = new Date().getHours();
  const night = hh >= 19 || hh < 7;
  return (
    <div className={shake ? "screenShake" : ""} style={{ minHeight: "100vh", background: night ? "#0C0912" : C.bg, fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif", color: C.ink, position: "relative", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
      {/* 사무실 바닥 타일 + 창밖 야경 별 */}
      <div className="officeTiles" style={night ? { opacity: 0.45 } : undefined} />
      <div className="stars" style={night ? { opacity: 1 } : undefined} />
      {night && <span style={{ position: "fixed", top: 18, right: 24, fontSize: 26, zIndex: 1, filter: "drop-shadow(0 0 14px #FFD16688)" }}>🌙</span>}
      {fx && (
        <div className="fxToast">
          <span style={{ fontSize: 40 }}>{fx.emoji}</span>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: C.gold, textShadow: `0 0 12px ${C.gold}` }}>{fx.text}</span>
          {fx.kind === "bonus" && <div className="confetti">{"🪙💵🪙✨🪙💵✨🪙".split("").map((ch, i) => <span key={i} style={{ "--i": i }}>{ch}</span>)}</div>}
        </div>
      )}
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "26px 20px 80px", position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 15, letterSpacing: 1, lineHeight: 1.6 }}>
            <span className="titleNeon">OA 광고상사</span> <span style={{ color: C.pink, textShadow: `0 0 14px ${C.pink}`, fontSize: 11 }}>(주)</span>
            <span style={{ fontSize: 10, color: C.mid, marginLeft: 10, fontFamily: "'Pretendard',sans-serif", fontWeight: 700 }}>{officeHour()}</span>
          </h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button style={btn(C.mid)} onClick={toggleMute} title="효과음">{mute ? "🔇" : "🔊"}</button>
            {onRefresh && <button className="btnGlow" style={btn(C.cyan)} onClick={onRefresh} title="캐시 무시하고 실시간 조회">🔄 순찰</button>}
            <a href="/" style={{ ...btn(C.purple), textDecoration: "none" }}>🏠 홈</a>
          </div>
        </div>
        {children}
      </div>
      <style>{`
        @keyframes blink { 50% { opacity: 0.25; } }
        .paperIn { animation: paperIn 0.28s cubic-bezier(0.2, 1.4, 0.4, 1); }
        @keyframes paperIn { from { opacity: 0; transform: translateY(26px) scale(0.92) rotate(-1deg); } to { opacity: 1; transform: none; } }
        .stampIn { animation: stampIn 0.32s cubic-bezier(0.3, 1.6, 0.5, 1); }
        @keyframes stampIn { 0% { opacity: 0; transform: rotate(-12deg) scale(2.6); } 60% { opacity: 1; transform: rotate(-12deg) scale(0.92); } 100% { transform: rotate(-12deg) scale(1); } }
        @keyframes floatUp { from { opacity: 0; transform: translate(-50%, 24px) scale(0.8); } 15% { opacity: 1; transform: translate(-50%, 0) scale(1.06); } 80% { opacity: 1; } to { opacity: 0; transform: translate(-50%, -18px); } }
        @keyframes hpshift { to { background-position: 24px 0; } }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 14px var(--glow, #4ADE80)33; } 50% { box-shadow: 0 0 30px var(--glow, #4ADE80)77; } }
        @keyframes questIn { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: none; } }
        @keyframes starDrift { to { background-position: 0 -600px, 0 -900px; } }
        @keyframes mvpShine { 0% { background-position: -200% 0; } 100% { background-position: 300% 0; } }
        @keyframes workBob { 0%,100% { transform: translateY(0) rotate(0); } 25% { transform: translateY(-2px) rotate(-3deg); } 75% { transform: translateY(-1px) rotate(3deg); } }
        @keyframes sadSway { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg) translateY(1px); } }
        @keyframes coinUp { 0% { opacity: 0; transform: translateY(6px) scale(0.6); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(-14px) scale(1.1); } }
        @keyframes bubbleIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; } }
        @keyframes shakeX { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
        @keyframes evtIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .evtToast { animation: evtIn 0.3s ease-out; }
        @keyframes sirenPulse { 0%,100% { box-shadow: 0 0 8px #FF5D5D22; border-color: #FF5D5D55; } 50% { box-shadow: 0 0 20px #FF5D5D55; border-color: #FF5D5DAA; } }
        .siren { animation: sirenPulse 1.6s ease-in-out infinite; }
        @keyframes sirenBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        .sirenLight { animation: sirenBlink 0.9s step-end infinite; }
        @keyframes doorOpen { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12) rotate(-2deg); } }
        @keyframes confettiFall { 0% { opacity: 1; transform: translateY(0) rotate(0); } 100% { opacity: 0; transform: translateY(70px) rotate(200deg); } }
        @keyframes xpGlow { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.4); } }
        .officeTiles { position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: 0.5;
          background-image: linear-gradient(#2A1F3A 1px, transparent 1px), linear-gradient(90deg, #2A1F3A 1px, transparent 1px);
          background-size: 44px 44px; }
        .stars { position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: 0.6;
          background-image: radial-gradient(1px 1px at 20% 20%, #fff8 1px, transparent 1px),
            radial-gradient(1.5px 1.5px at 75% 40%, #5ED3F366 1.5px, transparent 2px),
            radial-gradient(1px 1px at 50% 70%, #fff5 1px, transparent 1px);
          background-size: 240px 300px, 360px 450px, 280px 340px;
          animation: starDrift 90s linear infinite; }
        .titleNeon { color: #4ADE80; text-shadow: 0 0 14px #4ADE80AA; }
        .gradeCard { animation: pulse 2.2s ease-in-out infinite; }
        .quest { animation: questIn 0.4s ease both; }
        .hpbar { background-size: 24px 24px !important; animation: hpshift 1s linear infinite; transition: width .5s; }
        .xpbar { background: linear-gradient(90deg, #C4A7FF, #FF9DE0); box-shadow: 0 0 8px #C4A7FF; animation: xpGlow 2.4s ease-in-out infinite; transition: width .6s; }
        .btnGlow:hover { box-shadow: 0 0 14px #4ADE8099; transform: translateY(-1px); }
        .btnShake:hover { animation: shakeX 0.35s; box-shadow: 0 0 14px #FF6B8199; }
        .stampBtn:active { transform: scale(0.92) rotate(-2deg); }
        .unit:hover { transform: translateY(-2px); transition: transform .15s; }
        .unitMvp { background: linear-gradient(#1B1424, #1B1424) padding-box,
          linear-gradient(120deg, #FFD166, #FF9DE0, #5ED3F3, #FFD166) border-box !important;
          border: 1.5px solid transparent !important; }
        .mvp { background: linear-gradient(100deg, #FFD166, #FFECB3 30%, #FFD166 60%, #FFC94D);
          background-size: 300% 100%; animation: mvpShine 6s linear infinite; color: #1a1a1a; }
        .fxToast { position: fixed; top: 18%; left: 50%; z-index: 50; display: flex; flex-direction: column;
          align-items: center; gap: 10px; text-align: center; animation: floatUp 2.2s ease both; pointer-events: none; }
        .confetti span { position: absolute; top: 0; left: calc(50% + (var(--i) - 4) * 22px); font-size: 16px;
          animation: confettiFall 1.6s ease-in calc(var(--i) * 0.08s) both; }
        .empWork { animation: workBob 0.9s ease-in-out infinite; transform-origin: bottom center; }
        .empWork.fast { animation-duration: 0.45s; }
        .empSad { animation: sadSway 2.4s ease-in-out infinite; transform-origin: bottom center; filter: saturate(0.7); }
        .coinPop { animation: coinUp 1.8s ease-out infinite; }
        .bubble { position: absolute; top: -14px; left: 54px; right: 12px; z-index: 3; background: #0d0a12EE;
          border: 1px solid; border-radius: 10px 10px 10px 2px; padding: "4px 9px"; padding: 4px 9px;
          font-size: 10.5px; color: #CBBFE3; animation: bubbleIn .5s ease both; pointer-events: none;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .screenShake { animation: shakeX 0.45s; }
        .bootDoor { display: inline-block; animation: doorOpen 1.4s ease-in-out infinite; }
        .bootType { animation: blink 1s step-end infinite; }
        button:disabled { opacity: 0.5; cursor: wait; }
        @keyframes tickerMove { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .ticker span { display: inline-block; white-space: nowrap; padding-left: 20px; animation: tickerMove 36s linear infinite; }
        @keyframes walkX { 0% { left: -5%; transform: scaleX(1); } 49% { left: 96%; transform: scaleX(1); }
          50% { left: 96%; transform: scaleX(-1); } 99% { left: -5%; transform: scaleX(-1); } 100% { left: -5%; transform: scaleX(1); } }
        @keyframes walkBob { 0%,100% { margin-top: 0; } 50% { margin-top: -3px; } }
        .walker { position: absolute; font-size: 18px; animation: walkX var(--dur) linear infinite var(--delay), walkBob 0.5s ease-in-out infinite; opacity: 0.9; }
        @keyframes petUp { 0% { opacity: 0; transform: translateY(4px) scale(0.5); } 25% { opacity: 1; transform: scale(1.2); } 100% { opacity: 0; transform: translateY(-20px); } }
        .petHeart { animation: petUp 1.1s ease-out both; pointer-events: none; }
        .bbRow { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin; }
        .bbCard { position: relative; flex: none; width: 148px; border-radius: 10px; overflow: hidden; cursor: pointer; background: #000; transition: transform .15s; }
        .bbCard:hover { transform: translateY(-3px) scale(1.02); }
        .bbCard img { width: 100%; height: 104px; object-fit: cover; display: block; }
        .bbRank { position: absolute; top: 4px; left: 4px; font-family: 'Press Start 2P', monospace; font-size: 9px; color: #fff; background: #0d0a12CC; padding: 3px 5px; border-radius: 5px; }
        .bbFlag { position: absolute; top: 4px; right: 4px; font-size: 14px; filter: drop-shadow(0 0 4px #000); }
        .bbCap { font-size: 10px; color: #CBBFE3; padding: 4px 6px; background: #0d0a12; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fameFrame { position: relative; width: 128px; cursor: pointer; background: #0d0a12; padding: 5px; border: 3px solid #FFD166; border-radius: 6px; box-shadow: 0 0 14px #FFD16644, inset 0 0 0 1px #a8842e; transition: transform .15s; }
        .fameFrame:hover { transform: translateY(-3px); }
        .fameFrame img { width: 100%; height: 86px; object-fit: cover; display: block; border-radius: 3px; }
        .fameMedal { position: absolute; top: -10px; left: -8px; font-size: 18px; filter: drop-shadow(0 1px 2px #000); }
        .fameCap { font-size: 9.5px; color: #CBBFE3; margin-top: 4px; text-align: center; white-space: nowrap; overflow: hidden; }
        .shamePoster { position: relative; width: 108px; cursor: pointer; padding: 4px; background: #1a1218; border: 1px dashed #FF6B8177; border-radius: 4px; transform: rotate(-2.5deg); transition: transform .15s; }
        .shamePoster:nth-child(even) { transform: rotate(2deg); }
        .shamePoster:hover { transform: rotate(0); }
        .shamePoster img { width: 100%; height: 74px; object-fit: cover; display: block; filter: grayscale(0.85) brightness(0.75); border-radius: 2px; }
        .shamePoster::before { content: "📌"; position: absolute; top: -9px; left: 50%; transform: translateX(-50%); font-size: 13px; z-index: 2; }
        @keyframes spotFlash { 0%, 100% { box-shadow: 0 0 0 0 #FFD16600; } 25%, 60% { box-shadow: 0 0 0 3px #FFD166, 0 0 24px #FFD166AA; } }
        .deskSpot { animation: spotFlash 2.4s ease both; }
        @keyframes scanMove { to { background-position: 0 6px; } }
        .monScan { position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, #0000 0 2px, #00000022 2px 3px); animation: scanMove 0.6s linear infinite; }
        @media (max-width: 640px) { .bubble { display: none; } }
      `}</style>
    </div>
  );
}
