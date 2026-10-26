"use client";
// 공구 인플루언서 — 인포크 탐색(1.2만) · 지비지오(우리 협업/찜/추천) · 인공 공구 계정 · 뉴스 사례 (10-26)
// 정적 data/gonggu-influencers.json(뉴스·인공) + public/gonggu/{inpock,zvzo}.json(클라이언트 fetch). 후보 찜은 localStorage(gonggu_shortlist).
import { useEffect, useMemo, useState } from "react";
import DATA from "../data/gonggu-influencers.json";

const IG_RE = /^[a-z0-9._]+$/i;
const isHandle = (a) => IG_RE.test(String(a || ""));
const igUrl = (a) => `https://instagram.com/${a}`;
const IP_CAT = { beauty: "뷰티", home_living: "홈리빙", digital_electronics: "가전", furniture_interior: "인테리어", baby_kids: "육아", food_cooking: "식품", fashion: "패션", sports_health: "건강", travel_outdoor: "여행", pet: "펫", other: "기타", hobbies_arts: "취미", edu_career: "교육" };
const IP_CATS = ["beauty", "home_living", "digital_electronics", "furniture_interior", "baby_kids", "food_cooking", "fashion", "sports_health", "travel_outdoor", "pet", "edu_career", "hobbies_arts", "other"];
const IP_RANGES = [["all", "전체", 0, Infinity], ["1-5", "1~5만", 10000, 50000], ["5-10", "5~10만", 50000, 100000], ["10-30", "10~30만", 100000, 300000], ["30-100", "30~100만", 300000, 1000001]];
const won = (v) => { v = +v || 0; return v >= 1e8 ? (v / 1e8).toFixed(1) + "억" : v >= 1e4 ? Math.round(v / 1e4).toLocaleString() + "만원" : Math.round(v).toLocaleString() + "원"; };
const fmtK = (v) => { v = +v || 0; return v >= 1e4 ? (v / 1e4).toFixed(v >= 1e5 ? 0 : 1) + "만" : v.toLocaleString(); };
const LS = "gonggu_shortlist";
const loadSL = () => { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } };

export default function GongguInfluencerSection({ C, Card }) {
  const [tab, setTab] = useState("inpock");
  const [zvzo, setZvzo] = useState(null);
  const [ipAll, setIpAll] = useState(null);
  const [sl, setSl] = useState({});
  const [onlySL, setOnlySL] = useState(false);
  // 인포크 필터
  const [ipCats, setIpCats] = useState([]);
  const [ipRange, setIpRange] = useState("all");
  const [ipSort, setIpSort] = useState(["v", -1]); // [key, dir]
  const [ipQ, setIpQ] = useState("");
  const [ipLimit, setIpLimit] = useState(60);
  // 지비지오
  const [zv, setZv] = useState("history");
  const [zvQ, setZvQ] = useState("");
  const [zvSold, setZvSold] = useState(true);
  // 인공
  const [item, setItem] = useState("all");
  const [fit, setFit] = useState("all");

  useEffect(() => {
    setSl(loadSL());
    fetch("/gonggu/zvzo.json").then((r) => r.json()).then(setZvzo).catch(() => {});
    fetch("/gonggu/inpock.json").then((r) => r.json()).then(setIpAll).catch(() => {});
  }, []);
  const toggleSL = (key, meta) => { const n = { ...sl }; if (n[key]) delete n[key]; else n[key] = { ...meta, at: Date.now() }; setSl(n); try { localStorage.setItem(LS, JSON.stringify(n)); } catch {} };
  const slCount = Object.keys(sl).length;
  const copySL = () => { const txt = Object.entries(sl).map(([k, m]) => `${m.src === "zvzo" ? m.name + " (" + k + ")" : "@" + k}${m.f ? " · " + fmtK(m.f) : ""}${m.note ? " · " + m.note : ""}`).join("\n"); navigator.clipboard?.writeText(txt); };

  const ipRows = useMemo(() => {
    if (!ipAll) return [];
    const q = ipQ.trim().toLowerCase();
    const R = IP_RANGES.find((r) => r[0] === ipRange) || IP_RANGES[0];
    const [key, dir] = ipSort;
    const kf = { v: (r) => r.v, f: (r) => r.f, r: (r) => (r.f ? r.v / r.f : 0), l: (r) => r.l, c: (r) => r.c }[key];
    return ipAll.rows.filter((r) => r.f >= R[2] && r.f < R[3] && (!ipCats.length || ipCats.some((c) => r.cats.includes(c))) && (!q || r.u.toLowerCase().includes(q)) && (!onlySL || sl[r.u])).sort((a, b) => (kf(a) - kf(b)) * dir);
  }, [ipAll, ipQ, ipRange, ipCats, ipSort, onlySL, sl]);
  useEffect(() => { setIpLimit(60); }, [ipQ, ipRange, ipCats, ipSort, onlySL]);

  const zvRows = useMemo(() => {
    if (!zvzo) return [];
    const q = zvQ.trim().toLowerCase();
    const src = zv === "history" ? zvzo.history : zv === "liked" ? zvzo.liked : zvzo.picks;
    return (src || []).filter((r) => (!q || `${r.alias} ${r.code} ${(r.products || []).join(" ")} ${(r.main || []).join(" ")} ${r.bio || ""}`.toLowerCase().includes(q)) && (zv !== "history" || !zvSold || r.sales > 0) && (!onlySL || sl[r.code]));
  }, [zvzo, zv, zvQ, zvSold, onlySL, sl]);

  const gong = useMemo(() => (DATA.gong || []).filter((g) => (item === "all" || String(g.item || "").includes(item)) && (fit === "all" || g.fit === fit || (fit !== "둘 다" && g.fit === "둘 다")) && (!onlySL || sl[g.account])), [item, fit, onlySL, sl]);

  // ── UI 조각
  const th = (extra) => ({ textAlign: "left", fontSize: 11, fontWeight: 700, color: C.inkLt, padding: "10px 12px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", position: "sticky", top: 0, background: C.white, zIndex: 1, ...extra });
  const td = { fontSize: 13, color: C.ink, padding: "8px 12px", borderBottom: `1px solid ${C.border}`, verticalAlign: "middle" };
  const Chip = ({ on, onClick, children, small }) => (
    <button onClick={onClick} style={{ fontSize: small ? 11 : 12, fontWeight: 700, padding: small ? "4px 10px" : "6px 13px", borderRadius: 20, cursor: "pointer", border: `1px solid ${on ? C.rose : C.border}`, background: on ? C.rose : C.white, color: on ? C.white : C.inkMid, whiteSpace: "nowrap" }}>{children}</button>
  );
  const Heart = ({ k, meta }) => (
    <button title={sl[k] ? "후보에서 빼기" : "후보로 찜"} onClick={() => toggleSL(k, meta)} style={{ border: 0, background: "none", cursor: "pointer", fontSize: 17, lineHeight: 1, color: sl[k] ? C.rose : C.border, padding: "2px 4px" }}>{sl[k] ? "♥" : "♡"}</button>
  );
  const Av = ({ src, size = 34 }) => src ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", background: C.cream, flexShrink: 0 }} /> : <span style={{ width: size, height: size, borderRadius: "50%", background: C.cream, display: "inline-block", flexShrink: 0 }} />;
  const Thumbs = ({ list, size = 64 }) => <div style={{ display: "flex", gap: 4 }}>{(list || []).map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ width: size, height: size, borderRadius: 8, objectFit: "cover", background: C.cream, display: "block" }} /></a>)}</div>;
  const Handle = ({ a }) => isHandle(a) ? <a href={igUrl(a)} target="_blank" rel="noreferrer" style={{ color: C.ink, fontWeight: 800, textDecoration: "none", fontSize: 14 }}>@{a}</a> : <span style={{ fontWeight: 800, fontSize: 14 }}>{a}</span>;
  const FitTag = ({ v }) => { if (!v || v === "-") return <span style={{ color: C.inkLt }}>—</span>; const col = v.startsWith("프리온") ? C.rose : v.startsWith("플렌티") ? C.sage : C.inkMid; const bg = v.startsWith("프리온") ? C.blush : v.startsWith("플렌티") ? C.sageLt : C.cream; return <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 20, color: col, background: bg, border: `1px solid ${col}33`, whiteSpace: "nowrap" }}>{v}</span>; };
  const SortTh = ({ k, label, align = "right" }) => { const on = ipSort[0] === k; return <th style={th({ textAlign: align, cursor: "pointer", color: on ? C.rose : C.inkLt, userSelect: "none" })} onClick={() => setIpSort(on ? [k, -ipSort[1]] : [k, -1])}>{label}{on ? (ipSort[1] < 0 ? " ↓" : " ↑") : ""}</th>; };
  const inputStyle = { fontSize: 13, padding: "7px 12px", border: `1px solid ${C.border}`, borderRadius: 20, outline: "none", minWidth: 180, background: C.white };
  const TABS = [["inpock", `인포크 탐색 ${ipAll ? ipAll.n.toLocaleString() : ""}`], ["zvzo", `지비지오 ${zvzo ? (zvzo.history.length + zvzo.liked.length + zvzo.picks.length) : ""}`], ["gong", `공구 돌린 계정 ${DATA.gong?.length || 0}`], ["news", "뉴스·메모"]];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* 상단: 탭 + 후보 바 */}
      <Card style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.ink, marginRight: 8 }}>공구 인플루언서</div>
          {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ fontSize: 13, fontWeight: 800, padding: "8px 16px", borderRadius: 12, border: 0, cursor: "pointer", background: tab === k ? C.ink : C.cream, color: tab === k ? C.white : C.inkMid }}>{l}</button>)}
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: slCount ? C.blush : C.cream, padding: "6px 10px 6px 14px", borderRadius: 20 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: slCount ? C.rose : C.inkLt }}>♥ 후보 {slCount}</span>
            <Chip small on={onlySL} onClick={() => setOnlySL(!onlySL)}>찜만 보기</Chip>
            <Chip small onClick={copySL}>목록 복사</Chip>
            {slCount > 0 && <Chip small onClick={() => { if (confirm("후보를 모두 비울까요?")) { setSl({}); try { localStorage.removeItem(LS); } catch {} } }}>비우기</Chip>}
          </div>
        </div>
        <div style={{ fontSize: 12, color: C.inkLt, marginTop: 8 }}>♡를 누르면 후보에 담기고 이 브라우저에 저장됩니다. 갱신 {DATA.updated} · 실매출은 지비지오 우리 협업 이력만 실제값, 인포크 조회수는 노출 지표</div>
      </Card>

      {/* ── 인포크 */}
      {tab === "inpock" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <input value={ipQ} onChange={(e) => setIpQ(e.target.value)} placeholder="계정 검색" style={inputStyle} />
              <span style={{ width: 6 }} />
              {IP_RANGES.map(([k, l]) => <Chip key={k} small on={ipRange === k} onClick={() => setIpRange(k)}>{l}</Chip>)}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: C.inkMid, fontWeight: 700 }}>{ipRows.length.toLocaleString()}명</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <Chip small on={!ipCats.length} onClick={() => setIpCats([])}>전체</Chip>
              {IP_CATS.map((k) => <Chip key={k} small on={ipCats.includes(k)} onClick={() => setIpCats(ipCats.includes(k) ? ipCats.filter((x) => x !== k) : [...ipCats, k])}>{IP_CAT[k]}</Chip>)}
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead><tr>
                <th style={th({ width: 36 })}></th>
                <th style={th()}>계정</th>
                <th style={th()}>최근 콘텐츠</th>
                <SortTh k="f" label="팔로워" />
                <SortTh k="v" label="릴스 평균 조회" />
                <SortTh k="r" label="조회÷팔로워" />
                <SortTh k="l" label="좋아요" />
                <SortTh k="c" label="댓글" />
              </tr></thead>
              <tbody>
                {ipRows.slice(0, ipLimit).map((r, i) => (
                  <tr key={r.u} style={{ background: sl[r.u] ? C.blush + "66" : "transparent" }}>
                    <td style={{ ...td, textAlign: "center" }}><Heart k={r.u} meta={{ src: "inpock", name: r.u, f: r.f, note: fmtK(r.v) + " 조회" }} /></td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, color: C.inkLt, width: 22, textAlign: "right" }}>{i + 1}</span>
                        <Av src={r.pic} />
                        <div><Handle a={r.u} /><div style={{ fontSize: 11, color: C.inkLt, marginTop: 2 }}>{(r.cats || []).map((c) => IP_CAT[c] || c).join(" · ")}</div></div>
                      </div>
                    </td>
                    <td style={{ ...td, padding: "6px 12px" }}><Thumbs list={r.th} /></td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", fontWeight: 600 }}>{fmtK(r.f)}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, whiteSpace: "nowrap", fontSize: 14 }}>{fmtK(r.v)}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", fontWeight: 700, color: r.v / r.f >= 1 ? C.rose : C.inkMid }}>{(r.v / r.f).toFixed(1)}x</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", color: C.inkMid }}>{fmtK(r.l)}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", color: C.inkMid }}>{r.c}</td>
                  </tr>
                ))}
                {!ipAll && <tr><td colSpan={8} style={{ ...td, color: C.inkLt, padding: 24, textAlign: "center" }}>1.2만 명 불러오는 중…</td></tr>}
                {ipAll && !ipRows.length && <tr><td colSpan={8} style={{ ...td, color: C.inkLt, padding: 24, textAlign: "center" }}>조건에 맞는 계정이 없어요</td></tr>}
              </tbody>
            </table>
          </div>
          {ipRows.length > ipLimit && <div style={{ padding: 14, textAlign: "center", borderTop: `1px solid ${C.border}` }}><button onClick={() => setIpLimit(ipLimit + 100)} style={{ fontSize: 13, fontWeight: 800, padding: "9px 22px", borderRadius: 20, border: 0, background: C.ink, color: C.white, cursor: "pointer" }}>100명 더 보기 · {(ipRows.length - ipLimit).toLocaleString()}명 남음</button></div>}
        </Card>
      )}

      {/* ── 지비지오 */}
      {tab === "zvzo" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <Chip on={zv === "history"} onClick={() => setZv("history")}>우리 협업 이력 {zvzo ? zvzo.history.length : ""}</Chip>
            <Chip on={zv === "liked"} onClick={() => setZv("liked")}>오아를 찜한 {zvzo ? zvzo.liked.length : ""}</Chip>
            <Chip on={zv === "picks"} onClick={() => setZv("picks")}>이번 주 추천 {zvzo ? zvzo.picks.length : ""}</Chip>
            <span style={{ width: 6 }} />
            {zv === "history" && <Chip small on={zvSold} onClick={() => setZvSold(!zvSold)}>실매출 있는 사람만</Chip>}
            <input value={zvQ} onChange={(e) => setZvQ(e.target.value)} placeholder="이름·코드·제품 검색" style={inputStyle} />
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: C.inkMid, fontWeight: 700 }}>{zvRows.length}명{zv === "history" && zvzo ? ` · 누적 실매출 ${won(zvzo.history.reduce((a, r) => a + r.sales, 0))} · 수수료 18~23%` : ""}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            {zv === "history" && (
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                <thead><tr><th style={th({ width: 36 })}></th><th style={th()}>크리에이터</th><th style={th({ textAlign: "right" })}>실매출</th><th style={th({ textAlign: "right" })}>협업 / 판매</th><th style={th()}>최근</th><th style={th()}>판매 제품</th></tr></thead>
                <tbody>{zvRows.map((r) => (
                  <tr key={r.code} style={{ opacity: r.sales > 0 ? 1 : 0.55, background: sl[r.code] ? C.blush + "66" : "transparent" }}>
                    <td style={{ ...td, textAlign: "center" }}><Heart k={r.code} meta={{ src: "zvzo", name: r.alias, note: r.sales > 0 ? "실매출 " + won(r.sales) : "" }} /></td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Av src={r.pic} /><div><a href={`https://zv-zo.com/ko/${r.code}`} target="_blank" rel="noreferrer" style={{ color: C.ink, fontWeight: 800, textDecoration: "none", fontSize: 14 }}>{r.alias}</a><div style={{ fontSize: 11, color: C.inkLt }}>{r.code}</div></div></div></td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, whiteSpace: "nowrap", fontSize: 14 }}>{r.sales > 0 ? won(r.sales) : "—"}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", color: C.inkMid }}>{r.units} / {r.sold}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: C.inkMid }}>{r.last === "9999-12-31" ? "상시" : r.last}</td>
                    <td style={{ ...td, color: C.inkMid, lineHeight: 1.4, fontSize: 12 }}>{(r.products || []).map((p) => p.replace(/^오아 /, "").replace(/ 배터리 분리로.*$/, "")).join(" · ")}</td>
                  </tr>))}</tbody>
              </table>
            )}
            {zv === "liked" && (
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead><tr><th style={th({ width: 36 })}></th><th style={th()}>크리에이터</th><th style={th({ textAlign: "right" })}>팔로워</th><th style={th()}>주력</th><th style={th()}>예상 티어</th><th style={th({ textAlign: "right" })}>희망 수수료</th><th style={th()}>소개 / MD 코멘트</th></tr></thead>
                <tbody>{zvRows.map((r) => (
                  <tr key={r.code} style={{ background: sl[r.code] ? C.blush + "66" : "transparent" }}>
                    <td style={{ ...td, textAlign: "center" }}><Heart k={r.code} meta={{ src: "zvzo", name: r.alias, f: r.f, note: r.tier || "" }} /></td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Av src={r.pic} /><div><a href={`https://zv-zo.com/ko/${r.code}`} target="_blank" rel="noreferrer" style={{ color: C.ink, fontWeight: 800, textDecoration: "none", fontSize: 14 }}>{r.alias}</a>{r.newbie && <span style={{ marginLeft: 6, fontSize: 10, color: C.sage, fontWeight: 800 }}>NEW</span>}<div style={{ fontSize: 11, color: C.inkLt }}>{r.code}</div></div></div></td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", fontWeight: 600 }}>{fmtK(r.f)}{r.yt ? <div style={{ color: C.inkLt, fontSize: 11, fontWeight: 400 }}>YT {fmtK(r.yt)}</div> : null}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: C.inkMid, fontSize: 12 }}>{(r.main || []).join(" · ") || "—"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: C.inkMid, fontSize: 12 }}>{r.tier || "—"}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{r.comm ? Math.round(r.comm * 100) + "%" : "—"}</td>
                    <td style={{ ...td, color: C.inkMid, lineHeight: 1.4, fontSize: 12, maxWidth: 420 }}>{r.md || r.bio || "—"}</td>
                  </tr>))}</tbody>
              </table>
            )}
            {zv === "picks" && (
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead><tr><th style={th({ width: 36 })}></th><th style={th()}>크리에이터</th><th style={th({ textAlign: "right" })}>팔로워</th><th style={th({ textAlign: "right" })}>매칭</th><th style={th()}>평균 매출(본인)</th><th style={th()}>외부 검증</th><th style={th()}>추천 이유</th></tr></thead>
                <tbody>{zvRows.map((r) => (
                  <tr key={r.code} style={{ background: sl[r.code] ? C.blush + "66" : "transparent" }}>
                    <td style={{ ...td, textAlign: "center" }}><Heart k={r.code} meta={{ src: "zvzo", name: r.alias, f: r.f, note: r.self_rev ? "평균 " + r.self_rev : "" }} /></td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Av src={r.pic} /><div><a href={`https://zv-zo.com/ko/${r.code}`} target="_blank" rel="noreferrer" style={{ color: C.ink, fontWeight: 800, textDecoration: "none", fontSize: 14 }}>{r.alias}</a><div style={{ fontSize: 11, color: C.inkLt }}>{r.code}</div></div></div></td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", fontWeight: 600 }}>{fmtK(r.f)}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800 }}>{r.score}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: C.inkMid }}>{r.self_rev || "—"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 700 }}>{r.ext ? won(+r.ext) : "—"}</td>
                    <td style={{ ...td, color: C.inkMid, lineHeight: 1.45, fontSize: 12, maxWidth: 460 }}>{(r.reason || "").replace(/^[^\n]*\n\n/, "")}</td>
                  </tr>))}</tbody>
              </table>
            )}
            {!zvzo && <div style={{ padding: 24, fontSize: 12, color: C.inkLt, textAlign: "center" }}>불러오는 중…</div>}
          </div>
        </Card>
      )}

      {/* ── 인공: 우리 품목 공구 계정 + 대형 살림 */}
      {tab === "gong" && (
        <>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.inkLt, fontWeight: 700 }}>품목</span>
              <Chip small on={item === "all"} onClick={() => setItem("all")}>전체</Chip>
              {["가습기", "고데기", "드라이기", "가전"].map((k) => <Chip key={k} small on={item === k} onClick={() => setItem(k)}>{k}</Chip>)}
              <span style={{ width: 10 }} />
              <span style={{ fontSize: 12, color: C.inkLt, fontWeight: 700 }}>적합</span>
              <Chip small on={fit === "all"} onClick={() => setFit("all")}>전체</Chip>
              {["프리온", "플렌티플렛", "둘 다"].map((k) => <Chip key={k} small on={fit === k} onClick={() => setFit(k)}>{k}</Chip>)}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: C.inkMid, fontWeight: 700 }}>인공(insta-gong) 10월 집계 · {gong.length}개</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                <thead><tr><th style={th({ width: 36 })}></th><th style={th()}>계정</th><th style={th()}>품목</th><th style={th()}>공구 내역</th><th style={th()}>적합</th></tr></thead>
                <tbody>{gong.map((g, i) => (
                  <tr key={i} style={{ background: sl[g.account] ? C.blush + "66" : "transparent" }}>
                    <td style={{ ...td, textAlign: "center" }}><Heart k={g.account} meta={{ src: "gong", name: g.account, note: g.item }} /></td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}><Handle a={g.account} /></td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: C.inkMid }}>{g.item}</td>
                    <td style={{ ...td, lineHeight: 1.5 }}>{g.detail}</td>
                    <td style={td}><FitTag v={g.fit} /></td>
                  </tr>))}</tbody>
              </table>
            </div>
          </Card>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 800, color: C.ink }}>대형 살림 계정 <span style={{ fontSize: 12, color: C.inkLt, fontWeight: 400, marginLeft: 6 }}>팔로워 상위 · 최근 30일 공구 횟수</span></div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                <thead><tr><th style={th({ width: 36 })}></th><th style={th()}>계정</th><th style={th({ textAlign: "right" })}>팔로워</th><th style={th({ textAlign: "right" })}>30일 공구</th><th style={th()}>카테고리</th></tr></thead>
                <tbody>{(DATA.big_living || []).filter((b) => !onlySL || sl[b.account]).map((b, i) => (
                  <tr key={i} style={{ background: sl[b.account] ? C.blush + "66" : "transparent" }}>
                    <td style={{ ...td, textAlign: "center" }}><Heart k={b.account} meta={{ src: "gong", name: b.account, note: b.cat }} /></td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}><Handle a={b.account} /></td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{b.followers}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{b.d30 != null ? `${b.d30}회` : "—"}</td>
                    <td style={{ ...td, color: C.inkMid }}>{b.cat}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── 뉴스·메모 */}
      {tab === "news" && (
        <>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 10 }}>뉴스 사례</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {(DATA.news || []).map((n, i) => (
                <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", background: C.white, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><div style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>{n.name}</div><FitTag v={n.fit} /></div>
                  <div style={{ fontSize: 12, color: C.inkLt }}>{n.channel}{n.type ? ` · ${n.type}` : ""}</div>
                  <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.55, flex: 1 }}>{n.case}</div>
                  {n.url && <a href={n.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: C.rose, textDecoration: "none", marginTop: 4 }}>기사 보기 ↗</a>}
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 8 }}>알아둘 것</div>
            <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 13, color: C.inkMid, lineHeight: 1.7 }}>
              {(DATA.notes || []).map((n, i) => <li key={i}>{n}</li>)}
              <li>출처: {DATA.source}</li>
              <li>지비지오·인포크 크리에이터 정보는 내부 검토용. 외부 공유 금지(약관)</li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
