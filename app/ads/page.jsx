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

  useEffect(() => {
    try { const m = localStorage.getItem("oa_ads_mute") === "1"; setMute(m); sfxOn = !m; } catch {}
    const t = setTimeout(() => setBoot(false), 1500);
    const talk = setInterval(() => setTalkTick((x) => x + 1), 6000); // 말풍선 로테이션
    return () => { clearTimeout(t); clearInterval(talk); };
  }, []);
  const toggleMute = () => setMute((m) => { const n = !m; sfxOn = !n; try { localStorage.setItem("oa_ads_mute", n ? "1" : "0"); } catch {}; return n; });

  // 기본은 5분 서버 캐시(메타 호출 제한 보호) — 순찰·조치 직후만 fresh
  const load = (fresh) => fetch("/api/ad-console" + (fresh ? "?fresh=1" : "")).then((r) => r.json())
    .then((j) => (j.ok ? setData(j) : setErr(j.error))).catch((e) => setErr(String(e)));
  useEffect(() => { load(); }, []);

  async function act(action, s, extra = {}) {
    const label = action === "pause" ? `🪑 "${s.name}" 사원을 퇴근(OFF)시킬까요?`
      : action === "resume" ? `📢 "${s.name}" 사원을 재고용(ON)할까요?`
      : `💰 "${s.name}" 보너스 결재: 일예산 ₩${fmt(extra.budget)}로?`;
    if (!confirm(label)) return;
    setBusy(s.id);
    try {
      const j = await fetch("/api/ad-console", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adsetId: s.id, name: s.name, ...extra }) }).then((r) => r.json());
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
        body: JSON.stringify({ action: turnOff ? "adPause" : "adResume", adId: ad.id, adsetId: sid, name: ad.name }) }).then((r) => r.json());
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

  const queue = data.campaigns.flatMap((c) => c.adsets.filter((s) => s.judge).map((s) => ({ ...s, camp: c.name })));
  const roas = data.kpi.yesterday.roas || 0;
  const grade = roas >= 4 ? ["S", C.gold, "전설의 광고상사"] : roas >= 2.5 ? ["A", C.neon, "잘나가는 사무실"]
    : roas >= 1.5 ? ["B", C.cyan, "성실한 중소상사"] : roas >= 1 ? ["C", C.purple, "버티는 스타트업"] : ["D", C.red, "폐업 위기…"];
  const logArr = data.log || [];
  const wins = logArr.filter((l) => l.verdict === "win").length;
  let combo = 0; for (const l of logArr) { if (!l.verdict) continue; if (l.verdict === "win") combo++; else break; }
  const allSets = data.campaigns.flatMap((c) => c.adsets);
  const mvp = allSets.filter((s) => s.cpa7 && s.cpa7 <= s.target).sort((a, b) => b.purchases7 - a.purchases7)[0];
  const top3 = [...allSets].sort((a, b) => (b.purchases7 || 0) - (a.purchases7 || 0)).slice(0, 3).filter((s) => s.purchases7 > 0);
  // 사무실 레벨 — 30일 지출 규모 + 승진(성공 조치) XP
  const xp = Math.round((data.kpi.month?.spend || 0) / 10000) + wins * 120 + allSets.reduce((a, s) => a + (s.purchases7 || 0), 0) * 4;
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 60)));
  const nextXp = (level + 1) ** 2 * 60;
  const prevXp = level ** 2 * 60;
  const xpPct = Math.min(100, Math.round(((xp - prevXp) / Math.max(1, nextXp - prevXp)) * 100));

  return (
    <Shell onRefresh={() => { SFX.click(); load(true); }} fx={fx} shake={shake} mute={mute} toggleMute={toggleMute}>
      {/* 전광판 뉴스 티커 */}
      {(() => {
        const news = [];
        if (top3[0]) news.push(`🏆 속보: ${prodKeyOf(top3[0].name) || top3[0].name} 사원, 7일 ${top3[0].purchases7}건 판매로 사내 1위!`);
        if (queue.length) news.push(`🖊 인사부: 사장님 결재 대기 ${queue.length}건 — 결재함을 확인해 주세요`);
        else news.push("✅ 인사부: 결재 대기 없음 — 사무실이 평화롭습니다");
        if (data.naver?.tot?.spend) news.push(`🟢 협력사 네이버: 어제 ROAS x${(data.naver.tot.rev / data.naver.tot.spend).toFixed(1)} — ${data.naver.tot.rev / data.naver.tot.spend >= 3 ? "회식 각입니다" : "분발 요망"}`);
        if (combo >= 2) news.push(`🔥 사장님 결재 ${combo}연속 성공 — 촉이 좋으십니다`);
        if (roas >= 3) news.push(`📈 어제 ROAS ${roas} — 경영지원팀이 박수 치는 중`);
        else if (roas < 1.5) news.push(`📉 어제 ROAS ${roas} — 전 직원 비상 근무 태세`);
        const dead = allSets.filter((x) => x.status !== "ACTIVE").length;
        if (dead) news.push(`🪑 총무부: 퇴근 처리된 사원 ${dead}명 (부서 카드에서 숨김 중)`);
        const line = news.join("   ·   ");
        return (
          <div style={{ background: "#0d0a12", border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 14, overflow: "hidden", padding: "7px 0" }}>
            <div className="ticker"><span style={{ fontSize: 11.5, color: C.gold, fontWeight: 700 }}>{line}   ·   {line}</span></div>
          </div>
        );
      })()}

      {/* 복도 — 산책하는 사원들 */}
      <div style={{ position: "relative", height: 34, marginBottom: 6, overflow: "hidden" }} title="복도를 산책 중인 사원들">
        {allSets.filter((x) => x.status === "ACTIVE").slice(0, 7).map((x, i) => (
          <span key={x.id} className="walker" style={{ "--dur": `${14 + (i * 3.7) % 12}s`, "--delay": `-${(i * 5.3) % 14}s`, top: i % 2 ? 2 : 8 }}>
            {avatarOf(x.name)}{i % 3 === 0 ? "☕" : ""}
          </span>
        ))}
      </div>

      {/* ① 사장실 대시보드 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <div className="gradeCard" onClick={() => { SFX.click(); setBossSay(BOSS_LINES[Math.floor(Math.random() * BOSS_LINES.length)]); setTimeout(() => setBossSay(""), 3200); }}
          title="사장님(클릭하면 한마디)" style={{ ...card, minWidth: 150, flex: "0 0 auto", textAlign: "center", borderColor: grade[1], "--glow": grade[1], cursor: "pointer", position: "relative" }}>
          {bossSay && <div className="bubble" style={{ top: -30, left: 10, right: -60, borderColor: `${grade[1]}66`, zIndex: 9 }}>👔 {bossSay}</div>}
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
        </div>
      </div>

      {/* 이달의 사원 */}
      {mvp && (
        <div className="mvp" style={{ marginTop: 14, borderRadius: 14, padding: "12px 18px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 28 }} className="empWork">{avatarOf(mvp.name)}</span>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#1a1a1a", background: "#fff8", padding: "4px 8px", borderRadius: 6 }}>이달의 사원</span>
          <b style={{ fontSize: 13.5 }}>{mvp.name}</b>
          <span style={{ fontSize: 12, color: "#3b2f00" }}>7일 판매 {mvp.purchases7}{mvp.view7 ? `+👁${mvp.view7}` : ""} · CPA ₩{fmt(mvp.cpa7)} — 사진 액자에 걸어드렸습니다 🖼</span>
          {top3.length > 1 && <span style={{ marginLeft: "auto", fontSize: 12, color: "#3b2f00" }}>
            {["🥇", "🥈", "🥉"].map((m, i) => top3[i] ? `${m}${avatarOf(top3[i].name)}${top3[i].purchases7}` : "").join("  ")}
          </span>}
        </div>
      )}

      {/* 오늘의 미션 */}
      {(() => {
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

      {/* ② 결재 서류함 */}
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
            </div>
            {s.judge === "scale" && (
              <button className="btnGlow stampBtn" style={btn(C.neon)} disabled={busy === s.id}
                onClick={() => { SFX.stamp(); act("budget", s, { budget: Math.round(s.budget * 1.25 / 1000) * 1000, note: "룰 증액 +25%" }); }}>
                🖊 보너스 +25% 결재</button>
            )}
            {s.judge === "kill" && (
              <button className="btnShake stampBtn" style={btn(C.red)} disabled={busy === s.id}
                onClick={() => { SFX.stamp(); act("pause", s, { note: "룰 중지" }); }}>🖊 퇴근 결재</button>
            )}
            {s.judge === "watch" && <span style={{ fontSize: 11.5, color: C.mid }}>소재(작업물) 교체 → 광고 스튜디오</span>}
          </div>
        );
      })}

      {/* ③ 사무실 층별(부서) → 직원 책상 */}
      <h2 style={h2}><span style={px}>사무실</span> 부서별 직원 현황</h2>
      {data.campaigns.map((c) => {
        const tot = c.adsets.reduce((a, s) => a + s.spend7, 0);
        const buy = c.adsets.reduce((a, s) => a + (s.purchases7 || 0), 0);
        const vw = c.adsets.reduce((a, s) => a + (s.view7 || 0), 0);
        const wsum = buy + vw * 0.3;
        const cCpa = wsum >= 1 ? Math.round(tot / wsum) : null;
        const alive = c.adsets.filter((s) => s.status === "ACTIVE").length;
        return (
          <div key={c.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
            <button onClick={() => { SFX.click(); setOpenCamp((o) => ({ ...o, [c.id]: !o[c.id] })); }}
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
                        toggleAds={toggleAds} isMvp={mvp && s.id === mvp.id} talkTick={talkTick} onAdStatus={adStatus} onDetail={openDetail} />
                    ))}
                  </div>
                  {off.length > 0 && (
                    <button onClick={() => setShowOff((o) => ({ ...o, [c.id]: !o[c.id] }))}
                      style={{ ...btn(C.mid), marginTop: 10, fontSize: 11 }}>
                      {showOff[c.id] ? "🙈 퇴근자 숨기기" : `🪑 퇴근한 사원 ${off.length}명 보기`}
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}

      {/* ④ 외주 파트너 — 네이버 */}
      {data.naver && (() => {
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
      {data.advoost?.ok && data.advoost.boost?.length > 0 && (() => {
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
      {data.gfa && (() => {
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
      {logArr.length > 0 && (
        <>
          <h2 style={h2}><span style={px}>인사부</span> 📇 인사 기록부 <span style={{ fontSize: 10.5, color: C.mid, fontWeight: 400 }}>결재 후 3일 실적으로 승진/반성 판정</span></h2>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "10px 16px", fontSize: 12 }}>
            {logArr.map((l, i) => (
              <div key={i} style={{ padding: "4px 0", color: C.mid }}>
                <span style={{ color: C.purple }}>{(l.at || "").slice(5, 16).replace("T", " ")}</span> — <b style={{ color: C.ink }}>{l.name}</b> {l.desc} {l.note && `(${l.note})`}
                {l.verdict === "win" && <span style={{ color: C.neon, fontWeight: 800 }}> ✅ 승진! (3일 CPA ₩{fmt(l.now?.cpa3)})</span>}
                {l.verdict === "fail" && <span style={{ color: C.red, fontWeight: 800 }}> ❌ 반성문 ({l.now?.cpa3 ? `₩${fmt(l.now.cpa3)}` : "판매 0"}) → 롤백 검토</span>}
                {!l.verdict && l.now && l.desc?.includes("예산") && <span> ⏳ 인사평가 대기</span>}
              </div>
            ))}
          </div>
        </>
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
                    <span style={{ fontSize: 24 }}>{detail.kind === "camp" ? "🚪" : avatarOf(d.name)}</span>
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
function Desk({ s, busy, act, adsOpen, ads, toggleAds, isMvp, talkTick, onAdStatus, onDetail }) {
  const [eb, setEb] = useState(null);
  const [pet, setPet] = useState(0); // 쓰다듬기 하트 이펙트
  const morale = s.cpa7 == null ? (s.spend7 > 0 ? 20 : 60)
    : Math.max(5, Math.min(100, Math.round(100 - ((s.cpa7 / s.target) - 0.5) * 40)));
  const mColor = morale >= 70 ? C.neon : morale >= 40 ? C.gold : C.red;
  const dead = s.status !== "ACTIVE";
  const tier = dead ? "idle" : morale >= 70 ? "great" : morale >= 40 ? "ok" : s.spend7 > 0 ? "bad" : "idle";
  const seed = (s.id ? [...String(s.id)].reduce((a, ch) => a + ch.charCodeAt(0), 0) : 0) + talkTick;
  const rare = isMvp ? C.gold : s.judge === "scale" ? C.neon : s.judge === "kill" ? C.red : C.border;
  const earning = !dead && s.purchases7 >= 5; // 코인 이펙트 대상
  return (
    <div className={isMvp ? "unitMvp" : "unit"} style={{ background: C.panel2, border: `1.5px solid ${dead ? C.border : rare}`,
      borderRadius: 12, padding: "10px 12px", opacity: dead ? 0.55 : 1, position: "relative", overflow: "visible" }}>
      {isMvp && <span style={{ position: "absolute", top: -9, right: 10, fontSize: 8.5, fontFamily: "'Press Start 2P', monospace",
        background: C.gold, color: "#1a1a1a", padding: "2px 6px", borderRadius: 4 }}>이달의 사원</span>}
      {/* 말풍선 */}
      {!adsOpen && (
        <div className="bubble" key={tier + (seed % 7)} style={{ borderColor: `${mColor}55` }}>
          {dead ? "…퇴근했습니다 (OFF)" : talkOf(tier, seed)}
        </div>
      )}
      {/* 직원 + 책상 */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
        <div style={{ position: "relative", width: 52, textAlign: "center", flex: "none" }}>
          <span className={dead ? "" : tier === "great" ? "empWork fast" : tier === "bad" ? "empSad" : "empWork"}
            onClick={() => { if (dead) return; SFX.coin(); setPet((p) => p + 1); setTimeout(() => setPet((p) => Math.max(0, p - 1)), 1100); }}
            title={dead ? "" : "쓰다듬기"}
            style={{ fontSize: 30, display: "inline-block", filter: dead ? "grayscale(1)" : "none", cursor: dead ? "default" : "pointer" }}>
            {dead ? "🪑" : avatarOf(s.name)}
          </span>
          {pet > 0 && <span className="petHeart" style={{ position: "absolute", top: -10, left: 8, fontSize: 15 }}>💖</span>}
          {earning && <span className="coinPop" style={{ position: "absolute", top: -6, right: -4, fontSize: 13 }}>🪙</span>}
          {tier === "bad" && !dead && <span style={{ position: "absolute", top: -2, right: 0, fontSize: 12 }}>💦</span>}
          {dead && <span style={{ position: "absolute", top: -4, right: 2, fontSize: 12 }}>💤</span>}
          {s.thumb ? (
            <div title="지금 돌고 있는 대표 소재" style={{ width: 44, height: 32, margin: "0 auto", borderRadius: 4, overflow: "hidden",
              border: `1.5px solid ${C.border}`, boxShadow: "0 2px 0 #0d0a12", background: "#000" }}>
              <img src={s.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: dead ? "grayscale(1) brightness(0.6)" : "none" }} />
            </div>
          ) : <div style={{ fontSize: 13, marginTop: -3 }}>🖥️</div>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => toggleAds(s.id)} title="작업물(소재) 포트폴리오 보기"
              style={{ background: "none", border: "none", color: C.ink, fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "left", padding: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.name.slice(0, 26)}
            </button>
            <span style={{ fontSize: 9.5, color: C.mid, border: `1px solid ${C.border}`, borderRadius: 4, padding: "1px 5px", flex: "none" }}>{s.goal}</span>
          </div>
          {/* 사기(모럴) 게이지 */}
          <div style={{ height: 9, background: "#0d0a12", borderRadius: 5, margin: "6px 0 5px", overflow: "hidden", border: `1px solid ${C.border}` }}>
            <div className="hpbar" style={{ width: `${morale}%`, height: "100%", "--hp": mColor,
              background: `repeating-linear-gradient(45deg, ${mColor}, ${mColor} 6px, ${mColor}AA 6px, ${mColor}AA 12px)`,
              boxShadow: `0 0 10px ${mColor}` }} />
          </div>
          <div style={{ fontSize: 11, color: C.mid, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
            <span>사기 {morale} · 7일 <b style={{ color: C.gold }}>₩{fmt(s.spend7)}</b> · 🛒{s.purchases7}{s.view7 ? `+👁${s.view7}` : ""}</span>
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
              onClick={async () => { await act("budget", s, { budget: Number(eb), note: "수동" }); setEb(null); }}>결재</button>
            <button style={{ ...btn(C.mid), padding: "3px 7px", fontSize: 11 }} onClick={() => setEb(null)}>✕</button>
          </>
        )}
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
              {ads.map((a) => {
                const off = a.status !== "ACTIVE";
                return (
                <div key={a.id} style={{ width: 118, background: C.panel, border: `1px solid ${off ? C.border : C.border}`, borderRadius: 8, padding: 6, opacity: off ? 0.45 : 1, position: "relative" }}>
                  {a.thumb && <img src={a.thumb} alt="" style={{ width: "100%", height: 64, objectFit: "cover", borderRadius: 5, filter: off ? "grayscale(1)" : "none" }} />}
                  <div style={{ fontSize: 9.5, marginTop: 4, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.name}>{a.name}</div>
                  <div style={{ fontSize: 9.5, color: C.mid, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>₩{fmt(a.spend)} · 🛒{a.purchases}{a.cpa ? ` · ₩${fmt(a.cpa)}` : ""}</span>
                    <button onClick={() => onAdStatus(s.id, a, !off)} title={off ? "소재 다시 켜기" : "이 소재만 끄기"}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, padding: 0 }}>{off ? "▶️" : "⏸"}</button>
                  </div>
                </div>
              ); })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const px = { fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#5ED3F3", letterSpacing: 1,
  border: "1px solid #3A2C4E", padding: "3px 6px", borderRadius: 5, marginRight: 8, verticalAlign: 2 };
const pxLabel = { fontSize: 10.5, color: "#9C8DB8", letterSpacing: 0.5 };
const h2 = { fontSize: 15, fontWeight: 800, margin: "28px 0 10px", letterSpacing: 0.5 };
const card = { background: "#241B31", border: "1px solid #3A2C4E", borderRadius: 14, padding: "12px 16px" };
const btn = (color) => ({ background: `${color}1E`, color, border: `1px solid ${color}77`, borderRadius: 8,
  padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" });

function Shell({ children, onRefresh, fx, shake, mute, toggleMute }) {
  return (
    <div className={shake ? "screenShake" : ""} style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif", color: C.ink, position: "relative", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
      {/* 사무실 바닥 타일 + 창밖 야경 별 */}
      <div className="officeTiles" />
      <div className="stars" />
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
        @media (max-width: 640px) { .bubble { display: none; } }
      `}</style>
    </div>
  );
}
