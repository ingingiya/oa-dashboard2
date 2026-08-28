"use client";
// 🎮 AD BATTLE STATION — 아케이드 HUD: 유닛 = 광고 세트 (HP = CPA 효율),
// 퀘스트 = 룰 판정 실행 (버프/처치 = 실제 Graph API + 로그). 재미는 껍데기, 돈은 진짜.
import { useEffect, useRef, useState } from "react";

const C = {
  bg: "#070A14", panel: "#10162A", panel2: "#0B1020", border: "#243056",
  neon: "#00FFB2", cyan: "#4FD8FF", gold: "#FFD166", red: "#FF4D6D", purple: "#B78BFF", pink: "#FF7DEB",
  ink: "#EAF0FF", mid: "#7C89B8",
};
const fmt = (n) => (n == null ? "-" : Number(n).toLocaleString());

// 숫자 카운트업 (스탯 감성)
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

const AVATARS = [["소닉", "🌪"], ["에어리", "💨"], ["드라이", "💇"], ["클린이워터", "💧"], ["워터", "💧"],
  ["스윙", "🪥"], ["칫솔", "🪥"], ["프리온", "✨"], ["고데기", "🌀"], ["뷰러", "👁"], ["마사지", "💆"],
  ["포켓건", "🔫"], ["아이스", "🧊"], ["테스트", "🧪"]];
const avatarOf = (name) => (AVATARS.find(([k]) => name.includes(k)) || [null, "🤖"])[1];

export default function AdConsole() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [openCamp, setOpenCamp] = useState({});
  const [adsCache, setAdsCache] = useState({});
  const [adsOpen, setAdsOpen] = useState({});
  const [fx, setFx] = useState(null); // {emoji, text}

  const load = () => fetch("/api/ad-console").then((r) => r.json())
    .then((j) => (j.ok ? setData(j) : setErr(j.error))).catch((e) => setErr(String(e)));
  useEffect(() => { load(); }, []);

  async function act(action, s, extra = {}) {
    const label = action === "pause" ? `💀 "${s.name}" 처치(OFF)할까요?`
      : action === "resume" ? `✨ "${s.name}" 부활(ON)시킬까요?`
      : `🔥 "${s.name}" 버프: 예산 ₩${fmt(extra.budget)}로?`;
    if (!confirm(label)) return;
    setBusy(s.id);
    try {
      const j = await fetch("/api/ad-console", { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adsetId: s.id, name: s.name, ...extra }) }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error);
      setFx(action === "pause" ? { emoji: "💀", text: "KILL CONFIRMED — 예산 회수!" }
        : action === "resume" ? { emoji: "✨", text: "RESPAWN — 유닛 복귀!" }
        : { emoji: "🔥", text: `POWER UP! +₩${fmt((extra.budget || 0) - s.budget)} 버프` });
      setTimeout(() => setFx(null), 2200);
      await load();
    } catch (e) { alert("실패: " + e.message); } finally { setBusy(""); }
  }

  async function toggleAds(sid) {
    setAdsOpen((o) => ({ ...o, [sid]: !o[sid] }));
    if (!adsCache[sid]) {
      const j = await fetch(`/api/ad-console?adset=${sid}`).then((r) => r.json());
      if (j.ok) setAdsCache((c) => ({ ...c, [sid]: j.ads }));
    }
  }

  if (err) return <Shell><div style={{ color: C.red, padding: 40 }}>⚠️ {err}</div></Shell>;
  if (!data) return <Shell>
    <div style={{ padding: 80, textAlign: "center" }}>
      <div style={{ fontSize: 40, animation: "spin 1.2s linear infinite", display: "inline-block" }}>🛰</div>
      <div style={{ color: C.cyan, marginTop: 14, fontSize: 14, letterSpacing: 3, animation: "blink 1s step-end infinite" }}>SCANNING BATTLEFIELD…</div>
    </div>
  </Shell>;

  const queue = data.campaigns.flatMap((c) => c.adsets.filter((s) => s.judge).map((s) => ({ ...s, camp: c.name })));
  const roas = data.kpi.yesterday.roas || 0;
  const grade = roas >= 4 ? ["S", C.gold] : roas >= 2.5 ? ["A", C.neon] : roas >= 1.5 ? ["B", C.cyan] : roas >= 1 ? ["C", C.purple] : ["D", C.red];
  const wins = (data.log || []).filter((l) => l.verdict === "win").length;
  const allSets = data.campaigns.flatMap((c) => c.adsets);
  const mvp = allSets.filter((s) => s.cpa7 && s.cpa7 <= s.target).sort((a, b) => b.purchases7 - a.purchases7)[0];

  return (
    <Shell onRefresh={load} fx={fx}>
      {/* ① 스탯 바 */}
      <div style={{ display: "grid", gridTemplateColumns: "auto repeat(auto-fit,minmax(128px,1fr))", gap: 12 }}>
        <div className="gradeCard" style={{ ...card, minWidth: 118, textAlign: "center",
          borderColor: grade[1], "--glow": grade[1] }}>
          <div style={pxLabel}>YESTERDAY</div>
          <div style={{ fontSize: 46, fontWeight: 900, color: grade[1], textShadow: `0 0 18px ${grade[1]}`, lineHeight: 1.05, fontFamily: "'Press Start 2P', monospace" }}>{grade[0]}</div>
          <div style={{ fontSize: 10.5, color: C.mid, marginTop: 3 }}>ROAS {roas}</div>
        </div>
        <Stat label="💰 GOLD (어제)" v={data.kpi.yesterday.spend} prefix="₩" color={C.gold} />
        <Stat label="🛒 KILLS (구매)" v={data.kpi.yesterday.purchases} suffix={data.kpi.yesterday.views ? ` +👁${data.kpi.yesterday.views}` : ""} color={C.neon} />
        <Stat label="🎯 CPA (가중)" v={data.kpi.yesterday.cpa} prefix="₩" color={C.cyan} />
        <Stat label="⚔️ 7일 지출" v={data.kpi.week.spend} prefix="₩" color={C.purple} />
        <Stat label="🗓 30일 지출" v={data.kpi.month?.spend} prefix="₩" color={C.pink} suffix={data.kpi.month?.roas ? ` (x${data.kpi.month.roas})` : ""} />
        <div style={card}>
          <div style={pxLabel}>🏆 승전 기록</div>
          <div style={{ fontSize: 19, fontWeight: 800, marginTop: 5, color: C.gold }}>{wins}승 <span style={{ fontSize: 11, color: C.mid }}>/ 조치 {data.log?.length || 0}</span></div>
        </div>
      </div>

      {/* MVP 배너 */}
      {mvp && (
        <div className="mvp" style={{ marginTop: 14, borderRadius: 14, padding: "12px 18px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 26 }}>{avatarOf(mvp.name)}</span>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: "#1a1a1a", background: C.gold, padding: "4px 8px", borderRadius: 6 }}>MVP</span>
          <b style={{ fontSize: 13.5 }}>{mvp.name}</b>
          <span style={{ fontSize: 12, color: "#3b2f00" }}>7일 구매 {mvp.purchases7}{mvp.view7 ? `+👁${mvp.view7}` : ""} · CPA ₩{fmt(mvp.cpa7)} — 오늘의 에이스</span>
        </div>
      )}

      {/* ② 퀘스트 */}
      <h2 style={h2}><span style={px}>QUEST</span> 오늘의 퀘스트 {queue.length ? <span style={{ color: C.gold }}>({queue.length})</span> : <span style={{ color: C.neon, fontSize: 12 }}>ALL CLEAR ✅ 전장이 평화롭다</span>}</h2>
      {queue.map((s, qi) => {
        const conf = s.judge === "kill" ? { c: C.red, tag: "💀 처치" } : s.judge === "scale" ? { c: C.neon, tag: "🔥 버프" } : { c: C.gold, tag: "👀 정찰" };
        return (
          <div key={s.id} className="quest" style={{ display: "flex", gap: 14, alignItems: "center", background: C.panel,
            border: `1px solid ${conf.c}66`, boxShadow: `inset 4px 0 0 ${conf.c}, 0 0 14px ${conf.c}22`, borderRadius: 12,
            padding: "12px 16px", marginBottom: 8, flexWrap: "wrap", animationDelay: `${qi * 0.07}s` }}>
            <span style={{ fontSize: 22 }}>{avatarOf(s.name)}</span>
            <span style={{ fontWeight: 800, fontSize: 12, color: conf.c, whiteSpace: "nowrap", fontFamily: "'Press Start 2P', monospace" }}>{conf.tag}</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div>
              <div style={{ fontSize: 11.5, color: C.mid }}>{s.camp} · 7일 ₩{fmt(s.spend7)} · 🛒{s.purchases7}{s.view7 ? `+👁${s.view7}` : ""} · CPA {s.cpa7 ? `₩${fmt(s.cpa7)}` : "-"} / 목표 ₩{fmt(s.target)}</div>
            </div>
            {s.judge === "scale" && (
              <button className="btnGlow" style={btn(C.neon)} disabled={busy === s.id}
                onClick={() => act("budget", s, { budget: Math.round(s.budget * 1.25 / 1000) * 1000, note: "룰 증액 +25%" })}>
                🔥 +25% 버프</button>
            )}
            {s.judge === "kill" && (
              <button className="btnShake" style={btn(C.red)} disabled={busy === s.id} onClick={() => act("pause", s, { note: "룰 중지" })}>💀 처치</button>
            )}
            {s.judge === "watch" && <span style={{ fontSize: 11.5, color: C.mid }}>소재 교체 → 광고 스튜디오</span>}
          </div>
        );
      })}

      {/* ③ 부대 → 유닛 */}
      <h2 style={h2}><span style={px}>PARTY</span> 부대 편성</h2>
      {data.campaigns.map((c) => {
        const tot = c.adsets.reduce((a, s) => a + s.spend7, 0);
        return (
          <div key={c.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
            <button onClick={() => setOpenCamp((o) => ({ ...o, [c.id]: !o[c.id] }))}
              style={{ width: "100%", textAlign: "left", padding: "13px 16px", background: "none", border: "none",
                cursor: "pointer", display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 800, color: C.ink }}>
              <span>⚔️ {c.name} <span style={{ color: C.mid, fontWeight: 500, fontSize: 11 }}>목표 ₩{fmt(c.target)} · 유닛 {c.adsets.length}</span></span>
              <span style={{ color: C.gold }}>₩{fmt(tot)} {openCamp[c.id] ? "▲" : "▼"}</span>
            </button>
            {openCamp[c.id] && (
              <div style={{ padding: "0 12px 12px", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(315px,1fr))", gap: 10 }}>
                {c.adsets.map((s) => (
                  <Unit key={s.id} s={s} busy={busy} act={act} adsOpen={adsOpen[s.id]} ads={adsCache[s.id]} toggleAds={toggleAds} isMvp={mvp && s.id === mvp.id} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ④ 네이버 */}
      {data.naver && (
        <>
          <h2 style={h2}><span style={px}>N-FRONT</span> 네이버 검색광고 <span style={{ fontSize: 10.5, color: C.mid, fontWeight: 400 }}>{data.naver.date}</span></h2>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 16px", fontSize: 13 }}>
            <div style={{ fontWeight: 800, marginBottom: 8, color: C.neon }}>
              합계 ₩{fmt(Math.round(data.naver.tot.spend))} · 전환 {data.naver.tot.conv} · ROAS {data.naver.tot.spend ? (data.naver.tot.rev / data.naver.tot.spend).toFixed(1) : "-"}
            </div>
            {data.naver.camps.slice(0, 10).map((g, i) => {
              const r = g.spend ? g.rev / g.spend : 0;
              const bar = Math.min(100, r * 5);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "3px 0", fontSize: 12.5 }}>
                  <span style={{ width: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                  <div style={{ flex: 1, height: 6, background: "#0A0E1C", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${bar}%`, height: "100%", background: r >= 3 ? C.neon : r >= 1 ? C.gold : C.red, boxShadow: `0 0 6px ${r >= 3 ? C.neon : r >= 1 ? C.gold : C.red}` }} />
                  </div>
                  <span style={{ width: 170, textAlign: "right", color: C.mid }}>₩{fmt(Math.round(g.spend))} · {g.conv}전환 · <b style={{ color: r >= 3 ? C.neon : r >= 1 ? C.gold : C.red }}>x{r.toFixed(1)}</b></span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ⑤ GFA */}
      {data.gfa && (
        <>
          <h2 style={h2}><span style={px}>G-FRONT</span> GFA <span style={{ fontSize: 10.5, color: C.mid, fontWeight: 400 }}>{data.gfa.date || ""}</span></h2>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 16px", fontSize: 12.5 }}>
            <div style={{ fontWeight: 800, marginBottom: 6, color: C.cyan }}>
              합계 ₩{fmt(Math.round(data.gfa.tot?.cost || 0))} · 구매 {data.gfa.tot?.buy} · ROAS {data.gfa.tot?.cost ? ((data.gfa.tot.rev || 0) / data.gfa.tot.cost).toFixed(1) : "-"}
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

      {/* ⑥ 전투 기록 */}
      {data.log?.length > 0 && (
        <>
          <h2 style={h2}><span style={px}>LOG</span> 전투 기록</h2>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "10px 16px", fontSize: 12 }}>
            {data.log.map((l, i) => (
              <div key={i} style={{ padding: "4px 0", color: C.mid }}>
                <span style={{ color: C.purple }}>{(l.at || "").slice(5, 16).replace("T", " ")}</span> — <b style={{ color: C.ink }}>{l.name}</b> {l.desc} {l.note && `(${l.note})`}
                {l.verdict === "win" && <span style={{ color: C.neon, fontWeight: 800 }}> ✅ VICTORY (3일 CPA ₩{fmt(l.now?.cpa3)})</span>}
                {l.verdict === "fail" && <span style={{ color: C.red, fontWeight: 800 }}> ❌ DEFEAT ({l.now?.cpa3 ? `₩${fmt(l.now.cpa3)}` : "구매 0"}) → 롤백 검토</span>}
                {!l.verdict && l.now && l.desc?.includes("예산") && <span> ⏳ 판정 대기</span>}
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
    <div style={card}>
      <div style={pxLabel}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, marginTop: 5, color }}>{v == null ? "-" : `${prefix}${fmt(x)}${suffix}`}</div>
    </div>
  );
}

function Unit({ s, busy, act, adsOpen, ads, toggleAds, isMvp }) {
  const [eb, setEb] = useState(null);
  const hp = s.cpa7 == null ? (s.spend7 > 0 ? 20 : 60)
    : Math.max(5, Math.min(100, Math.round(100 - ((s.cpa7 / s.target) - 0.5) * 40)));
  const hpColor = hp >= 70 ? C.neon : hp >= 40 ? C.gold : C.red;
  const dead = s.status !== "ACTIVE";
  const rare = isMvp ? C.gold : s.judge === "scale" ? C.neon : s.judge === "kill" ? C.red : C.border;
  return (
    <div className={isMvp ? "unitMvp" : "unit"} style={{ background: C.panel2, border: `1.5px solid ${dead ? C.border : rare}`,
      borderRadius: 12, padding: "10px 12px", opacity: dead ? 0.5 : 1, position: "relative" }}>
      {isMvp && <span style={{ position: "absolute", top: -9, right: 10, fontSize: 9, fontFamily: "'Press Start 2P', monospace",
        background: C.gold, color: "#1a1a1a", padding: "2px 6px", borderRadius: 4 }}>MVP</span>}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 20 }}>{dead ? "💤" : avatarOf(s.name)}</span>
        <button onClick={() => toggleAds(s.id)} title="소재(장비) 보기"
          style={{ background: "none", border: "none", color: C.ink, fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "left", padding: 0, flex: 1 }}>
          {s.name.slice(0, 26)}
        </button>
        <span style={{ fontSize: 9.5, color: C.mid, border: `1px solid ${C.border}`, borderRadius: 4, padding: "1px 5px" }}>{s.goal}</span>
      </div>
      <div style={{ height: 9, background: "#060910", borderRadius: 5, margin: "8px 0 6px", overflow: "hidden", border: `1px solid ${C.border}` }}>
        <div className="hpbar" style={{ width: `${hp}%`, height: "100%", "--hp": hpColor,
          background: `repeating-linear-gradient(45deg, ${hpColor}, ${hpColor} 6px, ${hpColor}AA 6px, ${hpColor}AA 12px)`,
          boxShadow: `0 0 10px ${hpColor}` }} />
      </div>
      <div style={{ fontSize: 11, color: C.mid, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
        <span>HP {hp} · 7일 <b style={{ color: C.gold }}>₩{fmt(s.spend7)}</b> · 🛒{s.purchases7}{s.view7 ? `+👁${s.view7}` : ""}</span>
        <span>CPA <b style={{ color: hpColor }}>{s.cpa7 ? `₩${fmt(s.cpa7)}` : "-"}</b></span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
        {eb == null ? (
          <button style={{ ...btn(C.cyan), padding: "4px 10px", fontSize: 11 }} onClick={() => setEb(s.budget)}>💎 ₩{fmt(s.budget)}</button>
        ) : (
          <>
            <input type="number" value={eb} onChange={(e) => setEb(e.target.value)} step="1000"
              style={{ width: 84, fontSize: 11.5, background: "#060910", color: C.ink, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 6px" }} />
            <button style={{ ...btn(C.neon), padding: "3px 9px", fontSize: 11 }} disabled={busy === s.id}
              onClick={async () => { await act("budget", s, { budget: Number(eb), note: "수동" }); setEb(null); }}>적용</button>
            <button style={{ ...btn(C.mid), padding: "3px 7px", fontSize: 11 }} onClick={() => setEb(null)}>✕</button>
          </>
        )}
        {!dead
          ? <button style={{ ...btn(C.red), padding: "4px 10px", fontSize: 11 }} disabled={busy === s.id} onClick={() => act("pause", s)}>💀</button>
          : <button style={{ ...btn(C.neon), padding: "4px 10px", fontSize: 11 }} disabled={busy === s.id} onClick={() => act("resume", s)}>✨ ON</button>}
        {s.ctr7 > 0 && <span style={{ fontSize: 10.5, color: C.mid }}>CTR {s.ctr7.toFixed(2)}%</span>}
      </div>
      {adsOpen && (
        <div style={{ marginTop: 8, borderTop: `1px dashed ${C.border}`, paddingTop: 8 }}>
          {!ads ? <span style={{ fontSize: 11, color: C.mid }}>장비 확인 중…</span> : ads.length === 0 ? <span style={{ fontSize: 11, color: C.mid }}>소재 없음</span> : (
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

const px = { fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#4FD8FF", letterSpacing: 1,
  border: "1px solid #243056", padding: "3px 6px", borderRadius: 5, marginRight: 8, verticalAlign: 2 };
const pxLabel = { fontSize: 10.5, color: "#7C89B8", letterSpacing: 0.5 };
const h2 = { fontSize: 15, fontWeight: 800, margin: "28px 0 10px", letterSpacing: 0.5 };
const card = { background: "#10162A", border: "1px solid #243056", borderRadius: 14, padding: "12px 16px" };
const btn = (color) => ({ background: `${color}1E`, color, border: `1px solid ${color}77`, borderRadius: 8,
  padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" });

function Shell({ children, onRefresh, fx }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif", color: C.ink, position: "relative", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
      {/* 별 배경 + 스캔라인 */}
      <div className="stars" />
      <div className="scan" />
      {fx && (
        <div className="fxToast">
          <span style={{ fontSize: 40 }}>{fx.emoji}</span>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 13, color: C.gold, textShadow: `0 0 12px ${C.gold}` }}>{fx.text}</span>
        </div>
      )}
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "26px 20px 80px", position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 16, letterSpacing: 1, lineHeight: 1.6 }}>
            <span className="titleNeon">AD BATTLE</span> <span style={{ color: C.pink, textShadow: `0 0 14px ${C.pink}` }}>STATION</span>
          </h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {onRefresh && <button className="btnGlow" style={btn(C.cyan)} onClick={onRefresh}>🔄 리스캔</button>}
            <a href="/" style={{ ...btn(C.purple), textDecoration: "none" }}>🏠 홈</a>
          </div>
        </div>
        {children}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 50% { opacity: 0.25; } }
        @keyframes floatUp { from { opacity: 0; transform: translate(-50%, 24px) scale(0.8); } 15% { opacity: 1; transform: translate(-50%, 0) scale(1.06); } 80% { opacity: 1; } to { opacity: 0; transform: translate(-50%, -18px); } }
        @keyframes hpshift { to { background-position: 24px 0; } }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 14px var(--glow, #00FFB2)33; } 50% { box-shadow: 0 0 30px var(--glow, #00FFB2)77; } }
        @keyframes questIn { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: none; } }
        @keyframes starDrift { to { background-position: 0 -600px, 0 -900px; } }
        @keyframes mvpShine { 0% { background-position: -200% 0; } 100% { background-position: 300% 0; } }
        .stars { position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image: radial-gradient(1px 1px at 20% 30%, #fff8 1px, transparent 1px),
            radial-gradient(1.5px 1.5px at 70% 60%, #4FD8FF66 1.5px, transparent 2px),
            radial-gradient(1px 1px at 45% 80%, #fff5 1px, transparent 1px),
            radial-gradient(1px 1px at 85% 15%, #FF7DEB55 1px, transparent 1px);
          background-size: 220px 300px, 340px 450px, 260px 320px, 400px 380px;
          animation: starDrift 90s linear infinite; }
        .scan { position: fixed; inset: 0; z-index: 1; pointer-events: none; opacity: 0.5;
          background: repeating-linear-gradient(0deg, transparent 0 2px, #00000033 2px 4px); }
        .titleNeon { color: #00FFB2; text-shadow: 0 0 14px #00FFB2AA; animation: blink 4s step-end infinite; }
        .gradeCard { animation: pulse 2.2s ease-in-out infinite; }
        .quest { animation: questIn 0.4s ease both; }
        .hpbar { background-size: 24px 24px !important; animation: hpshift 1s linear infinite; transition: width .5s; }
        .btnGlow:hover { box-shadow: 0 0 14px #00FFB299; transform: translateY(-1px); }
        .btnShake:hover { animation: shake 0.3s; box-shadow: 0 0 14px #FF4D6D99; }
        @keyframes shake { 25% { transform: translateX(-2px) rotate(-1deg); } 75% { transform: translateX(2px) rotate(1deg); } }
        .unit:hover { transform: translateY(-2px); transition: transform .15s; }
        .unitMvp { background: linear-gradient(#0B1020, #0B1020) padding-box,
          linear-gradient(120deg, #FFD166, #FF7DEB, #4FD8FF, #FFD166) border-box !important;
          border: 1.5px solid transparent !important; }
        .mvp { background: linear-gradient(100deg, #FFD166, #FFECB3 30%, #FFD166 60%, #FFC94D);
          background-size: 300% 100%; animation: mvpShine 6s linear infinite; color: #1a1a1a; }
        .fxToast { position: fixed; top: 18%; left: 50%; z-index: 50; display: flex; flexDirection: column;
          align-items: center; gap: 10px; text-align: center; animation: floatUp 2.2s ease both; pointer-events: none;
          flex-direction: column; }
        button:disabled { opacity: 0.5; cursor: wait; }
      `}</style>
    </div>
  );
}
