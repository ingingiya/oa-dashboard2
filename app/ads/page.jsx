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

export default function AdOfficeTycoon() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [openCamp, setOpenCamp] = useState({});
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

  const load = () => fetch("/api/ad-console").then((r) => r.json())
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
      await load();
    } catch (e) { alert("실패: " + e.message); } finally { setBusy(""); }
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
    <Shell onRefresh={() => { SFX.click(); load(); }} fx={fx} shake={shake} mute={mute} toggleMute={toggleMute}>
      {/* ① 사장실 대시보드 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <div className="gradeCard" style={{ ...card, minWidth: 150, flex: "0 0 auto", textAlign: "center", borderColor: grade[1], "--glow": grade[1] }}>
          <div style={pxLabel}>🏢 사무실 등급</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: grade[1], textShadow: `0 0 18px ${grade[1]}`, lineHeight: 1.1, fontFamily: "'Press Start 2P', monospace" }}>{grade[0]}</div>
          <div style={{ fontSize: 10, color: grade[1], marginTop: 3, fontWeight: 700 }}>{grade[2]}</div>
          <div style={{ fontSize: 10, color: C.mid }}>어제 ROAS {roas}</div>
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
        const alive = c.adsets.filter((s) => s.status === "ACTIVE").length;
        return (
          <div key={c.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
            <button onClick={() => { SFX.click(); setOpenCamp((o) => ({ ...o, [c.id]: !o[c.id] })); }}
              style={{ width: "100%", textAlign: "left", padding: "13px 16px", background: "none", border: "none",
                cursor: "pointer", display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 800, color: C.ink }}>
              <span>🚪 {c.name} <span style={{ color: C.mid, fontWeight: 500, fontSize: 11 }}>목표 CPA ₩{fmt(c.target)} · 근무 {alive}/{c.adsets.length}명</span></span>
              <span style={{ color: C.gold }}>₩{fmt(tot)} {openCamp[c.id] ? "▲" : "▼"}</span>
            </button>
            {openCamp[c.id] && (
              <div className="officeFloor" style={{ padding: "6px 12px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(315px,1fr))", gap: 12 }}>
                {c.adsets.map((s) => (
                  <Desk key={s.id} s={s} busy={busy} act={act} adsOpen={adsOpen[s.id]} ads={adsCache[s.id]}
                    toggleAds={toggleAds} isMvp={mvp && s.id === mvp.id} talkTick={talkTick} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ④ 외주 파트너 — 네이버 */}
      {data.naver && (
        <>
          <h2 style={h2}><span style={px}>협력사</span> 🏬 네이버 검색광고 (외주) <span style={{ fontSize: 10.5, color: C.mid, fontWeight: 400 }}>{data.naver.date}</span></h2>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 16px", fontSize: 13 }}>
            <div style={{ fontWeight: 800, marginBottom: 8, color: C.neon }}>
              청구서 합계 ₩{fmt(Math.round(data.naver.tot.spend))} · 전환 {data.naver.tot.conv} · ROAS {data.naver.tot.spend ? (data.naver.tot.rev / data.naver.tot.spend).toFixed(1) : "-"}
            </div>
            {data.naver.camps.slice(0, 10).map((g, i) => {
              const r = g.spend ? g.rev / g.spend : 0;
              const bar = Math.min(100, r * 5);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "3px 0", fontSize: 12.5 }}>
                  <span style={{ width: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                  <div style={{ flex: 1, height: 6, background: "#0d0a12", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${bar}%`, height: "100%", background: r >= 3 ? C.neon : r >= 1 ? C.gold : C.red, boxShadow: `0 0 6px ${r >= 3 ? C.neon : r >= 1 ? C.gold : C.red}` }} />
                  </div>
                  <span style={{ width: 170, textAlign: "right", color: C.mid }}>₩{fmt(Math.round(g.spend))} · {g.conv}전환 · <b style={{ color: r >= 3 ? C.neon : r >= 1 ? C.gold : C.red }}>x{r.toFixed(1)}</b></span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ⑤ 외주 파트너 — GFA */}
      {data.gfa && (
        <>
          <h2 style={h2}><span style={px}>협력사</span> 🏬 GFA (외주) <span style={{ fontSize: 10.5, color: C.mid, fontWeight: 400 }}>{data.gfa.date || ""}</span></h2>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 16px", fontSize: 12.5 }}>
            <div style={{ fontWeight: 800, marginBottom: 6, color: C.cyan }}>
              청구서 합계 ₩{fmt(Math.round(data.gfa.tot?.cost || 0))} · 구매 {data.gfa.tot?.buy} · ROAS {data.gfa.tot?.cost ? ((data.gfa.tot.rev || 0) / data.gfa.tot.cost).toFixed(1) : "-"}
            </div>
            {(data.gfa.camps || []).map((g, i) => {
              const r = g.cost ? (g.rev || 0) / g.cost : 0;
              const danger = g.cost >= 30000 && r < 1;
              return <div key={i} style={{ padding: "3px 0", color: danger ? C.red : C.ink }}>
                {danger ? "🚨" : "·"} {g.name}: ₩{fmt(Math.round(g.cost))} · 구매 {g.buy} · x{r.toFixed(1)}</div>;
            })}
          </div>
        </>
      )}

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
    </Shell>
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
function Desk({ s, busy, act, adsOpen, ads, toggleAds, isMvp, talkTick }) {
  const [eb, setEb] = useState(null);
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
            style={{ fontSize: 30, display: "inline-block", filter: dead ? "grayscale(1)" : "none" }}>
            {dead ? "🪑" : avatarOf(s.name)}
          </span>
          {earning && <span className="coinPop" style={{ position: "absolute", top: -6, right: -4, fontSize: 13 }}>🪙</span>}
          {tier === "bad" && !dead && <span style={{ position: "absolute", top: -2, right: 0, fontSize: 12 }}>💦</span>}
          {dead && <span style={{ position: "absolute", top: -4, right: 2, fontSize: 12 }}>💤</span>}
          <div style={{ fontSize: 13, marginTop: -3 }}>🖥️</div>
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
        {s.ctr7 > 0 && <span style={{ fontSize: 10.5, color: C.mid }}>CTR {s.ctr7.toFixed(2)}%</span>}
      </div>
      {/* 작업물 포트폴리오 */}
      {adsOpen && (
        <div style={{ marginTop: 8, borderTop: `1px dashed ${C.border}`, paddingTop: 8 }}>
          {!ads ? <span style={{ fontSize: 11, color: C.mid }}>📁 포트폴리오 가져오는 중…</span>
            : ads.length === 0 ? <span style={{ fontSize: 11, color: C.mid }}>작업물 없음</span> : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ads.map((a) => (
                <div key={a.id} style={{ width: 118, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 6 }}>
                  {a.thumb && <img src={a.thumb} alt="" style={{ width: "100%", height: 64, objectFit: "cover", borderRadius: 5 }} />}
                  <div style={{ fontSize: 9.5, marginTop: 4, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.name}>{a.name}</div>
                  <div style={{ fontSize: 9.5, color: C.mid }}>₩{fmt(a.spend)} · 🛒{a.purchases}{a.cpa ? ` · ₩${fmt(a.cpa)}` : ""}</div>
                </div>
              ))}
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
            <span className="titleNeon">OA 광고상사</span> <span style={{ color: C.pink, textShadow: `0 0 14px ${C.pink}`, fontSize: 11 }}>(주) AI사원 근무중</span>
          </h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button style={btn(C.mid)} onClick={toggleMute} title="효과음">{mute ? "🔇" : "🔊"}</button>
            {onRefresh && <button className="btnGlow" style={btn(C.cyan)} onClick={onRefresh}>🔄 순찰</button>}
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
        @media (max-width: 640px) { .bubble { display: none; } }
      `}</style>
    </div>
  );
}
