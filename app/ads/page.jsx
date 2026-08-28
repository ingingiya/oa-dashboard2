"use client";
// 🎮 광고 관제 HUD — 게임처럼: 세트 = 유닛(HP바 = 목표 CPA 대비 효율), 액션 큐 = 퀘스트,
// 증액 = 버프, 중지 = 처치. 기능은 그대로 (실행 버튼 = 실제 Graph API 반영 + 로그)
import { useEffect, useState } from "react";

const C = {
  bg: "#0B0E17", panel: "#131828", panel2: "#0F1420", border: "#232B44",
  neon: "#00E6A8", cyan: "#4FD8FF", gold: "#FFD166", red: "#FF5D73", purple: "#B78BFF",
  ink: "#E8ECF8", mid: "#7C87A8",
};
const fmt = (n) => (n == null ? "-" : Number(n).toLocaleString());

export default function AdConsole() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [openCamp, setOpenCamp] = useState({});
  const [adsCache, setAdsCache] = useState({});
  const [adsOpen, setAdsOpen] = useState({});
  const [flash, setFlash] = useState("");

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
      setFlash(action === "pause" ? "💀 처치 완료!" : action === "resume" ? "✨ 부활!" : "🔥 버프 적용!");
      setTimeout(() => setFlash(""), 1800);
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
  if (!data) return <Shell><div style={{ padding: 60, color: C.mid, textAlign: "center", fontSize: 15 }}>⏳ 전장 스캔 중…</div></Shell>;

  const queue = data.campaigns.flatMap((c) => c.adsets.filter((s) => s.judge).map((s) => ({ ...s, camp: c.name })));
  const roas = data.kpi.yesterday.roas || 0;
  const grade = roas >= 4 ? ["S", C.gold] : roas >= 2.5 ? ["A", C.neon] : roas >= 1.5 ? ["B", C.cyan] : roas >= 1 ? ["C", C.purple] : ["D", C.red];

  return (
    <Shell onRefresh={load} flash={flash}>
      {/* ① 스탯 바 */}
      <div style={{ display: "grid", gridTemplateColumns: "auto repeat(auto-fit,minmax(130px,1fr))", gap: 12, alignItems: "stretch" }}>
        <div style={{ ...card, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
          minWidth: 110, borderColor: grade[1], boxShadow: `0 0 18px ${grade[1]}33` }}>
          <div style={{ fontSize: 11, color: C.mid, letterSpacing: 2 }}>어제 등급</div>
          <div style={{ fontSize: 42, fontWeight: 900, color: grade[1], textShadow: `0 0 16px ${grade[1]}88`, lineHeight: 1 }}>{grade[0]}</div>
          <div style={{ fontSize: 11, color: C.mid }}>ROAS {roas}</div>
        </div>
        {[["💰 어제 지출", `₩${fmt(data.kpi.yesterday.spend)}`, C.gold],
          ["🛒 어제 구매", data.kpi.yesterday.purchases, C.neon],
          ["🎯 어제 CPA", data.kpi.yesterday.cpa ? `₩${fmt(data.kpi.yesterday.cpa)}` : "-", C.cyan],
          ["⚔️ 7일 지출", `₩${fmt(data.kpi.week.spend)}`, C.purple],
          ["📈 7일 ROAS", data.kpi.week.roas, C.neon]].map(([k, v, col]) => (
          <div key={k} style={card}>
            <div style={{ fontSize: 11.5, color: C.mid }}>{k}</div>
            <div style={{ fontSize: 19, fontWeight: 800, marginTop: 5, color: col }}>{v}</div>
          </div>
        ))}
      </div>

      {/* ② 퀘스트 (액션 큐) */}
      <h2 style={h2}>⚡ 오늘의 퀘스트 {queue.length ? <span style={{ color: C.gold }}>({queue.length})</span> : <span style={{ color: C.neon, fontSize: 13 }}>— 완료! 전장이 평화롭다 ✅</span>}</h2>
      {queue.map((s) => {
        const conf = s.judge === "kill" ? { c: C.red, tag: "💀 처치 퀘스트", btn: "OFF 실행" }
          : s.judge === "scale" ? { c: C.neon, tag: "🔥 버프 퀘스트", btn: null }
          : { c: C.gold, tag: "⚠️ 정찰 퀘스트", btn: null };
        return (
          <div key={s.id} style={{ display: "flex", gap: 14, alignItems: "center", background: C.panel,
            border: `1px solid ${conf.c}55`, boxShadow: `inset 3px 0 0 ${conf.c}`, borderRadius: 12,
            padding: "12px 16px", marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, fontSize: 12.5, color: conf.c, whiteSpace: "nowrap" }}>{conf.tag}</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div>
              <div style={{ fontSize: 11.5, color: C.mid }}>{s.camp} · 7일 ₩{fmt(s.spend7)} · 구매 {s.purchases7} · CPA {s.cpa7 ? `₩${fmt(s.cpa7)}` : "-"} / 목표 ₩{fmt(s.target)}</div>
            </div>
            {s.judge === "scale" && (
              <button style={btn(C.neon)} disabled={busy === s.id}
                onClick={() => act("budget", s, { budget: Math.round(s.budget * 1.25 / 1000) * 1000, note: "룰 증액 +25%" })}>
                🔥 +25% 버프 (₩{fmt(s.budget)}→₩{fmt(Math.round(s.budget * 1.25 / 1000) * 1000)})</button>
            )}
            {s.judge === "kill" && (
              <button style={btn(C.red)} disabled={busy === s.id} onClick={() => act("pause", s, { note: "룰 중지" })}>💀 OFF 실행</button>
            )}
            {s.judge === "watch" && <span style={{ fontSize: 11.5, color: C.mid }}>소재 교체 검토 → 광고 스튜디오</span>}
          </div>
        );
      })}

      {/* ③ 부대 (캠페인) → 유닛 (세트) */}
      <h2 style={h2}>🛡 부대 편성</h2>
      {data.campaigns.map((c) => {
        const tot = c.adsets.reduce((a, s) => a + s.spend7, 0);
        return (
          <div key={c.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
            <button onClick={() => setOpenCamp((o) => ({ ...o, [c.id]: !o[c.id] }))}
              style={{ width: "100%", textAlign: "left", padding: "13px 16px", background: "none", border: "none",
                cursor: "pointer", display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800, color: C.ink }}>
              <span>⚔️ {c.name} <span style={{ color: C.mid, fontWeight: 500, fontSize: 11.5 }}>목표 CPA ₩{fmt(c.target)} · 유닛 {c.adsets.length}</span></span>
              <span style={{ color: C.gold }}>₩{fmt(tot)} {openCamp[c.id] ? "▲" : "▼"}</span>
            </button>
            {openCamp[c.id] && (
              <div style={{ padding: "0 12px 12px", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(310px,1fr))", gap: 10 }}>
                {c.adsets.map((s) => (
                  <Unit key={s.id} s={s} busy={busy} act={act} adsOpen={adsOpen[s.id]} ads={adsCache[s.id]} toggleAds={toggleAds} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ④ GFA */}
      {data.gfa && (
        <>
          <h2 style={h2}>🗺 GFA 전선 <span style={{ fontSize: 11, color: C.mid, fontWeight: 400 }}>{data.gfa.date || ""} · 집행은 GFA 어드민에서</span></h2>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 16px", fontSize: 13 }}>
            <div style={{ fontWeight: 800, marginBottom: 8, color: C.cyan }}>
              합계 ₩{fmt(Math.round(data.gfa.tot?.cost || 0))} · 구매 {data.gfa.tot?.buy} · ROAS {data.gfa.tot?.cost ? ((data.gfa.tot.rev || 0) / data.gfa.tot.cost).toFixed(1) : "-"}
            </div>
            {(data.gfa.camps || []).map((g, i) => {
              const r = g.cost ? (g.rev || 0) / g.cost : 0;
              const danger = g.cost >= 30000 && r < 1;
              return <div key={i} style={{ padding: "3px 0", color: danger ? C.red : C.ink, fontSize: 12.5 }}>
                {danger ? "🚨" : "·"} {g.name}: ₩{fmt(Math.round(g.cost))} · 구매 {g.buy} · ROAS {r.toFixed(1)}</div>;
            })}
          </div>
        </>
      )}

      {/* ⑤ 전투 기록 */}
      {data.log?.length > 0 && (
        <>
          <h2 style={h2}>📜 전투 기록</h2>
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "10px 16px", fontSize: 12 }}>
            {data.log.map((l, i) => (
              <div key={i} style={{ padding: "4px 0", color: C.mid }}>
                <span style={{ color: C.purple }}>{(l.at || "").slice(5, 16).replace("T", " ")}</span> — <b style={{ color: C.ink }}>{l.name}</b> {l.desc} {l.note && <span style={{ color: C.mid }}>({l.note})</span>}
                {l.verdict === "win" && <span style={{ color: C.neon, fontWeight: 800 }}> ✅ 성공 (3일 CPA ₩{fmt(l.now?.cpa3)} ≤ 목표)</span>}
                {l.verdict === "fail" && <span style={{ color: C.red, fontWeight: 800 }}> ❌ 부진 (3일 CPA {l.now?.cpa3 ? `₩${fmt(l.now.cpa3)}` : "구매 0"}) → 롤백 검토</span>}
                {!l.verdict && l.now && l.desc?.includes("예산") && <span style={{ color: C.mid }}> ⏳ 판정 대기 (24시간 후)</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}

// 유닛 카드 — HP바 = 목표 CPA 대비 효율 (CPA 낮을수록 풀피)
function Unit({ s, busy, act, adsOpen, ads, toggleAds }) {
  const [eb, setEb] = useState(null);
  // HP: CPA 없으면(구매0) 지출 있으면 20, 목표 이하=100~80, 목표×3 이상=5
  const hp = s.cpa7 == null ? (s.spend7 > 0 ? 20 : 60)
    : Math.max(5, Math.min(100, Math.round(100 - ((s.cpa7 / s.target) - 0.5) * 40)));
  const hpColor = hp >= 70 ? C.neon : hp >= 40 ? C.gold : C.red;
  const dead = s.status !== "ACTIVE";
  return (
    <div style={{ background: C.panel2, border: `1px solid ${dead ? C.border : hpColor + "44"}`, borderRadius: 12,
      padding: "10px 12px", opacity: dead ? 0.55 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <button onClick={() => toggleAds(s.id)} title="소재(장비) 보기"
          style={{ background: "none", border: "none", color: C.ink, fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "left", padding: 0, flex: 1 }}>
          {dead ? "💤" : hp >= 70 ? "🟢" : hp >= 40 ? "🟡" : "🔴"} {s.name.slice(0, 26)}
        </button>
        <span style={{ fontSize: 10, color: C.mid }}>{s.goal}</span>
      </div>
      {/* HP 바 */}
      <div style={{ height: 7, background: "#0A0D16", borderRadius: 4, margin: "7px 0 6px", overflow: "hidden", border: `1px solid ${C.border}` }}>
        <div style={{ width: `${hp}%`, height: "100%", background: `linear-gradient(90deg, ${hpColor}, ${hpColor}99)`,
          boxShadow: `0 0 8px ${hpColor}`, transition: "width .4s" }} />
      </div>
      <div style={{ fontSize: 11, color: C.mid, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
        <span>7일 <b style={{ color: C.gold }}>₩{fmt(s.spend7)}</b> · 🛒{s.purchases7}</span>
        <span>CPA <b style={{ color: hpColor }}>{s.cpa7 ? `₩${fmt(s.cpa7)}` : "-"}</b>/₩{fmt(s.target)}</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
        {eb == null ? (
          <button style={{ ...btn(C.cyan), padding: "4px 10px", fontSize: 11 }} onClick={() => setEb(s.budget)}>💎 ₩{fmt(s.budget)}</button>
        ) : (
          <>
            <input type="number" value={eb} onChange={(e) => setEb(e.target.value)} step="1000"
              style={{ width: 84, fontSize: 11.5, background: "#0A0D16", color: C.ink, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 6px" }} />
            <button style={{ ...btn(C.neon), padding: "3px 9px", fontSize: 11 }} disabled={busy === s.id}
              onClick={async () => { await act("budget", s, { budget: Number(eb), note: "수동" }); setEb(null); }}>적용</button>
            <button style={{ ...btn(C.mid), padding: "3px 7px", fontSize: 11 }} onClick={() => setEb(null)}>✕</button>
          </>
        )}
        {!dead
          ? <button style={{ ...btn(C.red), padding: "4px 10px", fontSize: 11 }} disabled={busy === s.id} onClick={() => act("pause", s)}>💀 OFF</button>
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

const h2 = { fontSize: 15, fontWeight: 800, margin: "28px 0 10px", letterSpacing: 0.5 };
const card = { background: "#131828", border: "1px solid #232B44", borderRadius: 14, padding: "12px 16px" };
const btn = (color) => ({ background: `${color}22`, color, border: `1px solid ${color}66`, borderRadius: 8,
  padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" });

function Shell({ children, onRefresh, flash }) {
  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(1200px 500px at 50% -100px, #1A2140 0%, ${C.bg} 55%)`,
      fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif", color: C.ink }}>
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "26px 20px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: 21, fontWeight: 900, letterSpacing: 1 }}>
            🎮 AD BATTLE STATION <span style={{ color: C.neon, textShadow: `0 0 12px ${C.neon}66` }}>메타 × GFA</span>
          </h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {flash && <span style={{ color: C.gold, fontWeight: 800, fontSize: 14, textShadow: `0 0 10px ${C.gold}` }}>{flash}</span>}
            {onRefresh && <button style={btn(C.cyan)} onClick={onRefresh}>🔄 리스캔</button>}
            <a href="/" style={{ ...btn(C.purple), textDecoration: "none" }}>🏠 홈</a>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
