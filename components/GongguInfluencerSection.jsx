"use client";
// 공구 인플루언서 — 구글 뉴스 사례 + 인공(insta-gong.com) 10월 집계를 한 화면에서 보는 리서치 뷰 (10-26)
// 데이터: data/gonggu-influencers.json 정적 임포트 (API 없음). 갱신은 JSON 교체 후 재배포.
import { useEffect, useMemo, useState } from "react";
import DATA from "../data/gonggu-influencers.json";

const IG_RE = /^[a-z0-9._]+$/i;
const isHandle = (a) => IG_RE.test(String(a || ""));
const igUrl = (a) => `https://instagram.com/${a}`;

// 품목 필터: "가습기·드라이기"처럼 복합 품목은 포함 매칭
const ITEM_CHIPS = ["가습기", "고데기", "드라이기", "가전"];
const FIT_CHIPS = ["프리온", "플렌티플렛", "둘 다"];
const IP_LABEL = { beauty: "뷰티", home_living: "홈·리빙", digital: "디지털·가전", digital_electronics: "디지털·가전", baby_kids: "육아·키즈", food_cooking: "식품·요리", fashion: "패션", furniture_interior: "가구·인테리어", sports_health: "스포츠·건강", travel_outdoor: "여행·아웃도어", edu_career: "교육·커리어", hobbies_arts: "취미·아트", pet: "반려동물", other: "기타", efficient: "효율(조회/팔로워)" };
const IP_ORDER = ["beauty", "home_living", "digital", "baby_kids", "food_cooking", "fashion", "furniture_interior", "sports_health", "travel_outdoor", "pet", "edu_career", "hobbies_arts", "other", "efficient"];
const IP_CATS = ["beauty", "home_living", "digital_electronics", "furniture_interior", "baby_kids", "food_cooking", "fashion", "sports_health", "travel_outdoor", "pet", "edu_career", "hobbies_arts", "other"];
const IP_RANGES = { all: [0, Infinity], "1-5": [10000, 50000], "5-10": [50000, 100000], "10-30": [100000, 300000], "30-100": [300000, 1000001] };
const IP_RANGE_LABEL = { all: "전체", "1-5": "1~5만", "5-10": "5~10만", "10-30": "10~30만", "30-100": "30~100만" };
const IP_CAT = { beauty: "뷰티", home_living: "홈리빙", digital_electronics: "가전", furniture_interior: "인테리어", baby_kids: "육아", food_cooking: "식품", fashion: "패션", sports_health: "건강", travel_outdoor: "여행", pet: "펫", other: "기타", hobbies_arts: "취미", edu_career: "교육" };
const won = (v) => { v = +v || 0; return v >= 1e8 ? (v / 1e8).toFixed(1) + "억" : v >= 1e4 ? Math.round(v / 1e4).toLocaleString() + "만원" : Math.round(v).toLocaleString() + "원"; };
const fmtK = (v) => { v = +v || 0; return v >= 1e4 ? (v / 1e4).toFixed(v >= 1e5 ? 0 : 1) + "만" : v.toLocaleString(); };

export default function GongguInfluencerSection({ C, Card }) {
  const [item, setItem] = useState("all");
  const [fit, setFit] = useState("all");
  const [zv, setZv] = useState("history");
  const [zvzo, setZvzo] = useState(null);
  const [ipAll, setIpAll] = useState(null);
  const [ipCats, setIpCats] = useState([]);       // 다중 선택 카테고리
  const [ipRange, setIpRange] = useState("all");  // 팔로워 구간
  const [ipSort, setIpSort] = useState("v");      // v 조회 / f 팔로워 / r 조회·팔로워 / l 좋아요
  const [ipQ, setIpQ] = useState("");
  const [ipLimit, setIpLimit] = useState(100);
  const [zvQ, setZvQ] = useState("");
  useEffect(() => { fetch("/gonggu/zvzo.json").then((r) => r.json()).then(setZvzo).catch(() => {}); fetch("/gonggu/inpock.json").then((r) => r.json()).then(setIpAll).catch(() => {}); }, []);
  const ipRows = useMemo(() => {
    if (!ipAll) return [];
    const q = ipQ.trim().toLowerCase();
    const [lo, hi] = IP_RANGES[ipRange] || [0, Infinity];
    const rows = ipAll.rows.filter((r) => r.f >= lo && r.f < hi && (!ipCats.length || ipCats.some((c) => r.cats.includes(c))) && (!q || r.u.toLowerCase().includes(q)));
    const key = { v: (r) => r.v, f: (r) => r.f, r: (r) => (r.f ? r.v / r.f : 0), l: (r) => r.l }[ipSort];
    return rows.sort((a, b) => key(b) - key(a));
  }, [ipAll, ipQ, ipRange, ipCats, ipSort]);
  const zvHist = useMemo(() => { const q = zvQ.trim().toLowerCase(); const rows = zvzo?.history || []; return q ? rows.filter((r) => (r.alias + " " + r.code + " " + (r.products || []).join(" ")).toLowerCase().includes(q)) : rows; }, [zvzo, zvQ]);
  const zvLiked = useMemo(() => { const q = zvQ.trim().toLowerCase(); const rows = zvzo?.liked || []; return q ? rows.filter((r) => (r.alias + " " + r.code + " " + (r.main || []).join(" ") + " " + (r.bio || "")).toLowerCase().includes(q)) : rows; }, [zvzo, zvQ]);

  const gong = useMemo(() => (DATA.gong || []).filter((g) =>
    (item === "all" || String(g.item || "").includes(item)) &&
    (fit === "all" || g.fit === fit || (fit !== "둘 다" && g.fit === "둘 다"))
  ), [item, fit]);

  const th = { textAlign: "left", fontSize: 11, fontWeight: 700, color: C.inkLt, padding: "8px 12px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", letterSpacing: ".02em" };
  const td = { fontSize: 13, color: C.ink, padding: "9px 12px", borderBottom: `1px solid ${C.border}`, verticalAlign: "top" };
  const Chip = ({ on, onClick, children }) => (
    <button onClick={onClick} style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
      border: `1px solid ${on ? C.rose : C.border}`, background: on ? C.rose : C.white, color: on ? C.white : C.inkMid }}>{children}</button>
  );
  const FitTag = ({ v }) => {
    if (!v || v === "-") return <span style={{ color: C.inkLt }}>—</span>;
    const col = v.startsWith("프리온") ? C.rose : v.startsWith("플렌티") ? C.sage : C.inkMid;
    const bg = v.startsWith("프리온") ? C.blush : v.startsWith("플렌티") ? C.sageLt : C.cream;
    return <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 20, color: col, background: bg, border: `1px solid ${col}33`, whiteSpace: "nowrap" }}>{v}</span>;
  };
  const Account = ({ a }) => isHandle(a)
    ? <a href={igUrl(a)} target="_blank" rel="noreferrer" style={{ color: C.rose, fontWeight: 700, textDecoration: "none" }}>@{a}</a>
    : <span style={{ fontWeight: 700 }}>{a}</span>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 헤더 + 주의사항 */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.ink, letterSpacing: "-0.02em" }}>공구 인플루언서 리서치</div>
            <div style={{ fontSize: 12, color: C.inkLt, marginTop: 3 }}>출처: {DATA.source}</div>
          </div>
          <div style={{ fontSize: 12, color: C.inkMid, fontWeight: 600, background: C.cream, padding: "4px 10px", borderRadius: 20 }}>갱신 {DATA.updated}</div>
        </div>
        {!!(DATA.notes || []).length && (
          <ul style={{ margin: "12px 0 0", padding: "10px 14px 10px 30px", background: "#FFF8EC", border: "1px solid #C9340022", borderRadius: 10, fontSize: 12.5, color: C.inkMid, lineHeight: 1.6 }}>
            {DATA.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        )}
      </Card>

      {/* (a) 뉴스 사례 */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 2 }}>뉴스 사례</div>
        <div style={{ fontSize: 12, color: C.inkLt, marginBottom: 12 }}>공구로 매출을 낸 인플루언서 보도 사례 {DATA.news?.length || 0}건</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {(DATA.news || []).map((n, i) => (
            <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", background: C.white, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>{n.name}</div>
                <FitTag v={n.fit} />
              </div>
              <div style={{ fontSize: 12, color: C.inkLt }}>{n.channel}{n.type ? ` · ${n.type}` : ""}</div>
              <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.55, flex: 1 }}>{n.case}</div>
              {n.url && <a href={n.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: C.rose, textDecoration: "none", marginTop: 4 }}>기사 보기 ↗</a>}
            </div>
          ))}
        </div>
      </Card>

      {/* (b) 우리 품목 공구 계정 */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 18px 10px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 2 }}>우리 품목 공구 계정</div>
          <div style={{ fontSize: 12, color: C.inkLt, marginBottom: 12 }}>가습기·고데기·드라이기 공구를 돌린 계정 — {gong.length}/{DATA.gong?.length || 0}개 표시</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, marginRight: 2 }}>품목</span>
            <Chip on={item === "all"} onClick={() => setItem("all")}>전체</Chip>
            {ITEM_CHIPS.map((k) => <Chip key={k} on={item === k} onClick={() => setItem(k)}>{k}</Chip>)}
            <span style={{ width: 10 }} />
            <span style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, marginRight: 2 }}>적합</span>
            <Chip on={fit === "all"} onClick={() => setFit("all")}>전체</Chip>
            {FIT_CHIPS.map((k) => <Chip key={k} on={fit === k} onClick={() => setFit(k)}>{k}</Chip>)}
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead><tr><th style={th}>계정</th><th style={th}>품목</th><th style={th}>공구 내역</th><th style={th}>적합</th></tr></thead>
            <tbody>
              {gong.map((g, i) => (
                <tr key={i}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}><Account a={g.account} /></td>
                  <td style={{ ...td, whiteSpace: "nowrap", color: C.inkMid }}>{g.item}</td>
                  <td style={{ ...td, lineHeight: 1.5 }}>{g.detail}</td>
                  <td style={td}><FitTag v={g.fit} /></td>
                </tr>
              ))}
              {gong.length === 0 && <tr><td colSpan={4} style={{ ...td, textAlign: "center", color: C.inkLt, padding: 20 }}>조건에 맞는 계정이 없어요</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* (d) 지비지오 — 전체 */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 18px 10px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 2 }}>지비지오(ZVZO)</div>
          <div style={{ fontSize: 12, color: C.inkLt }}>오아 스토어 협업 이력 {zvzo?.history?.length || 0}명 (실매출 발생 {(zvzo?.history || []).filter((r) => r.sales > 0).length}명, 누적 {won((zvzo?.history || []).reduce((a, r) => a + r.sales, 0))}) · 오아를 찜한 크리에이터 {zvzo?.liked?.length || 0}명 · 이번 주 추천 {zvzo?.picks?.length || 0}명. 수수료 18~23%</div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Chip on={zv === "history"} onClick={() => setZv("history")}>협업 이력 {zvHist.length}</Chip>
            <Chip on={zv === "liked"} onClick={() => setZv("liked")}>찜·관심 {zvLiked.length}</Chip>
            <Chip on={zv === "picks"} onClick={() => setZv("picks")}>추천 {(zvzo?.picks || []).length}</Chip>
            <input value={zvQ} onChange={(e) => setZvQ(e.target.value)} placeholder="이름·코드·제품 검색" style={{ marginLeft: 6, fontSize: 12, padding: "5px 10px", border: `1px solid ${C.border}`, borderRadius: 20, outline: "none", minWidth: 160 }} />
          </div>
        </div>
        <div style={{ overflowX: "auto", maxHeight: 560, overflowY: "auto" }}>
          {zv === "history" && (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead><tr><th style={th}>크리에이터</th><th style={{ ...th, textAlign: "right" }}>실매출</th><th style={{ ...th, textAlign: "right" }}>협업/판매</th><th style={th}>최근</th><th style={th}>제품</th></tr></thead>
              <tbody>
                {zvHist.map((r, i) => (
                  <tr key={i} style={{ opacity: r.sales > 0 ? 1 : 0.6 }}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}><a href={`https://zv-zo.com/ko/${r.code}`} target="_blank" rel="noreferrer" style={{ color: C.rose, fontWeight: 700, textDecoration: "none" }}>{r.alias}</a> <span style={{ color: C.inkLt, fontSize: 11 }}>{r.code}</span></td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, whiteSpace: "nowrap" }}>{r.sales > 0 ? won(r.sales) : "—"}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", color: C.inkMid }}>{r.units} / {r.sold}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: C.inkMid }}>{r.last === "9999-12-31" ? "상시" : r.last}</td>
                    <td style={{ ...td, color: C.inkMid, lineHeight: 1.4, fontSize: 12 }}>{(r.products || []).map((p) => p.replace(/^오아 /, "").replace(/ 배터리 분리로.*$/, "")).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {zv === "liked" && (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead><tr><th style={th}>크리에이터</th><th style={{ ...th, textAlign: "right" }}>팔로워</th><th style={th}>주력</th><th style={th}>예상 티어</th><th style={{ ...th, textAlign: "right" }}>희망 수수료</th><th style={th}>소개 / MD</th></tr></thead>
              <tbody>
                {zvLiked.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}><a href={`https://zv-zo.com/ko/${r.code}`} target="_blank" rel="noreferrer" style={{ color: C.rose, fontWeight: 700, textDecoration: "none" }}>{r.alias}</a> <span style={{ color: C.inkLt, fontSize: 11 }}>{r.code}</span>{r.newbie && <span style={{ marginLeft: 4, fontSize: 10, color: C.sage, fontWeight: 800 }}>NEW</span>}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{fmtK(r.f)}{r.yt ? <span style={{ color: C.inkLt, fontSize: 11 }}> · YT {fmtK(r.yt)}</span> : null}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: C.inkMid, fontSize: 12 }}>{(r.main || []).join("·") || "—"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: C.inkMid, fontSize: 12 }}>{r.tier || "—"}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{r.comm ? Math.round(r.comm * 100) + "%" : "—"}</td>
                    <td style={{ ...td, color: C.inkMid, lineHeight: 1.4, fontSize: 12 }}>{r.md || r.bio || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {zv === "picks" && (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead><tr><th style={th}>크리에이터</th><th style={{ ...th, textAlign: "right" }}>팔로워</th><th style={{ ...th, textAlign: "right" }}>매칭</th><th style={th}>평균 매출(본인)</th><th style={th}>외부 검증</th><th style={th}>추천 이유</th></tr></thead>
              <tbody>
                {(zvzo?.picks || []).map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}><a href={`https://zv-zo.com/ko/${r.code}`} target="_blank" rel="noreferrer" style={{ color: C.rose, fontWeight: 700, textDecoration: "none" }}>{r.alias}</a> <span style={{ color: C.inkLt, fontSize: 11 }}>{r.code}</span></td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{fmtK(r.f)}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800 }}>{r.score}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: C.inkMid }}>{r.self_rev || "—"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 700 }}>{r.ext ? won(+r.ext) : "—"}</td>
                    <td style={{ ...td, color: C.inkMid, lineHeight: 1.45, fontSize: 12 }}>{(r.reason || "").replace(/^[^\n]*\n\n/, "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!zvzo && <div style={{ padding: 20, fontSize: 12, color: C.inkLt }}>불러오는 중…</div>}
        </div>
      </Card>

      {/* (f) 인포크 — 전체 탐색 */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 18px 10px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 2 }}>인포크 비즈니스 크리에이터 탐색 {ipAll ? `${ipAll.n.toLocaleString()}명` : ""}</div>
          <div style={{ fontSize: 12, color: C.inkLt }}>팔로워 1만~100만 전 카테고리. 릴스 평균 조회수 기준(판매 지표 아님). 제안은 인포크에서 무료 10회 · {ipRows.length.toLocaleString()}명 표시</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: C.inkLt, fontWeight: 700 }}>카테고리</span>
            <Chip on={!ipCats.length} onClick={() => setIpCats([])}>전체</Chip>
            {IP_CATS.map((k) => <Chip key={k} on={ipCats.includes(k)} onClick={() => setIpCats(ipCats.includes(k) ? ipCats.filter((x) => x !== k) : [...ipCats, k])}>{IP_CAT[k] || k}</Chip>)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: C.inkLt, fontWeight: 700 }}>팔로워</span>
            {Object.keys(IP_RANGES).map((k) => <Chip key={k} on={ipRange === k} onClick={() => setIpRange(k)}>{IP_RANGE_LABEL[k]}</Chip>)}
            <span style={{ width: 8 }} />
            <span style={{ fontSize: 11, color: C.inkLt, fontWeight: 700 }}>정렬</span>
            {[["v", "릴스 조회"], ["f", "팔로워"], ["r", "조회/팔로워"], ["l", "좋아요"]].map(([k, l]) => <Chip key={k} on={ipSort === k} onClick={() => setIpSort(k)}>{l}</Chip>)}
            <input value={ipQ} onChange={(e) => setIpQ(e.target.value)} placeholder="계정 검색" style={{ marginLeft: 6, fontSize: 12, padding: "5px 10px", border: `1px solid ${C.border}`, borderRadius: 20, outline: "none", minWidth: 140 }} />
          </div>
        </div>
        <div style={{ overflowX: "auto", maxHeight: 640, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead><tr><th style={th}>#</th><th style={th}>계정</th><th style={{ ...th, textAlign: "right" }}>팔로워</th><th style={{ ...th, textAlign: "right" }}>릴스 평균 조회</th><th style={{ ...th, textAlign: "right" }}>조회/팔로워</th><th style={{ ...th, textAlign: "right" }}>좋아요</th><th style={{ ...th, textAlign: "right" }}>댓글</th><th style={th}>카테고리</th></tr></thead>
            <tbody>
              {ipRows.slice(0, ipLimit).map((r, i) => (
                <tr key={r.u}>
                  <td style={{ ...td, color: C.inkLt, fontSize: 11 }}>{i + 1}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}><Account a={r.u} /></td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{fmtK(r.f)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 800, whiteSpace: "nowrap" }}>{fmtK(r.v)}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", color: r.v / r.f >= 1 ? C.rose : C.inkMid }}>{(r.v / r.f).toFixed(1)}x</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", color: C.inkMid }}>{fmtK(r.l)}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", color: C.inkMid }}>{r.c}</td>
                  <td style={{ ...td, color: C.inkLt, fontSize: 12 }}>{(r.cats || []).map((c) => IP_CAT[c] || c).join(" · ")}</td>
                </tr>
              ))}
              {!ipAll && <tr><td colSpan={8} style={{ ...td, color: C.inkLt, padding: 20 }}>불러오는 중…</td></tr>}
            </tbody>
          </table>
          {ipRows.length > ipLimit && <div style={{ padding: 12, textAlign: "center" }}><button onClick={() => setIpLimit(ipLimit + 200)} style={{ fontSize: 12, fontWeight: 700, padding: "7px 16px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.white, cursor: "pointer" }}>200명 더 보기 ({(ipRows.length - ipLimit).toLocaleString()}명 남음)</button></div>}
        </div>
      </Card>

      {/* (c) 대형 살림 계정 */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 18px 10px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 2 }}>대형 살림 계정</div>
          <div style={{ fontSize: 12, color: C.inkLt }}>팔로워 상위 살림·생활 계정 — 최근 30일 공구 횟수(d30)와 카테고리 비중</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead><tr><th style={th}>계정</th><th style={{ ...th, textAlign: "right" }}>팔로워</th><th style={{ ...th, textAlign: "right" }}>30일 공구</th><th style={th}>카테고리</th></tr></thead>
            <tbody>
              {(DATA.big_living || []).map((b, i) => (
                <tr key={i}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}><Account a={b.account} /></td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{b.followers}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{b.d30 != null ? `${b.d30}회` : "—"}</td>
                  <td style={{ ...td, color: C.inkMid }}>{b.cat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
