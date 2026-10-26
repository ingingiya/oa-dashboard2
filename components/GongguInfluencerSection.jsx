"use client";
// 공구 인플루언서 — 구글 뉴스 사례 + 인공(insta-gong.com) 10월 집계를 한 화면에서 보는 리서치 뷰 (10-26)
// 데이터: data/gonggu-influencers.json 정적 임포트 (API 없음). 갱신은 JSON 교체 후 재배포.
import { useMemo, useState } from "react";
import DATA from "../data/gonggu-influencers.json";

const IG_RE = /^[a-z0-9._]+$/i;
const isHandle = (a) => IG_RE.test(String(a || ""));
const igUrl = (a) => `https://instagram.com/${a}`;

// 품목 필터: "가습기·드라이기"처럼 복합 품목은 포함 매칭
const ITEM_CHIPS = ["가습기", "고데기", "드라이기", "가전"];
const FIT_CHIPS = ["프리온", "플렌티플렛", "둘 다"];
const IP_TABS = [["beauty", "뷰티"], ["home_living", "홈·리빙"], ["digital", "디지털·가전"], ["efficient", "효율(조회/팔로워)"]];
const IP_CAT = { beauty: "뷰티", home_living: "홈리빙", digital_electronics: "가전", furniture_interior: "인테리어", baby_kids: "육아", food_cooking: "식품", fashion: "패션", sports_health: "건강", travel_outdoor: "여행", pet: "펫", other: "기타", hobbies_arts: "취미", edu_career: "교육" };
const won = (v) => { v = +v || 0; return v >= 1e8 ? (v / 1e8).toFixed(1) + "억" : v >= 1e4 ? Math.round(v / 1e4).toLocaleString() + "만원" : Math.round(v).toLocaleString() + "원"; };
const fmtK = (v) => { v = +v || 0; return v >= 1e4 ? (v / 1e4).toFixed(v >= 1e5 ? 0 : 1) + "만" : v.toLocaleString(); };

export default function GongguInfluencerSection({ C, Card }) {
  const [item, setItem] = useState("all");
  const [fit, setFit] = useState("all");
  const [zv, setZv] = useState("picks");
  const [ip, setIp] = useState("beauty");

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

      {/* (d) 지비지오 — 오아 스토어 협업 실매출 */}
      {DATA.zvzo_history && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 18px 10px" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 2 }}>지비지오(ZVZO) 우리 협업 실매출 TOP</div>
            <div style={{ fontSize: 12, color: C.inkLt }}>{DATA.zvzo_history.note} · 누적 {won(DATA.zvzo_history.total_sales)}</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead><tr><th style={th}>크리에이터</th><th style={{ ...th, textAlign: "right" }}>실매출</th><th style={{ ...th, textAlign: "right" }}>협업/판매</th><th style={th}>최근</th><th style={th}>판매 제품</th></tr></thead>
              <tbody>
                {DATA.zvzo_history.rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}><a href={`https://zv-zo.com/ko/${r.code}`} target="_blank" rel="noreferrer" style={{ color: C.rose, fontWeight: 700, textDecoration: "none" }}>{r.alias}</a> <span style={{ color: C.inkLt, fontSize: 11 }}>{r.code}</span></td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, whiteSpace: "nowrap" }}>{won(r.sales)}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", color: C.inkMid }}>{r.units}회 / {r.sold}회</td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: C.inkMid }}>{r.last}</td>
                    <td style={{ ...td, color: C.inkMid, lineHeight: 1.4 }}>{(r.products || []).map((p) => p.replace(/^오아 /, "").replace(/ 배터리 분리로.*$/, "")).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* (e) 지비지오 추천 + 관심 크리에이터 */}
      {DATA.zvzo_picks && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 18px 10px" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 2 }}>지비지오 이번 주 추천 {DATA.zvzo_picks.length}명 · 오아를 찜한 크리에이터</div>
            <div style={{ fontSize: 12, color: C.inkLt }}>매칭 점수·본인 작성 평균 매출·외부 매출 검증값. 상세 열람은 지비지오에서 제안 후 가능</div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <Chip on={zv === "picks"} onClick={() => setZv("picks")}>추천 {DATA.zvzo_picks.length}</Chip>
              <Chip on={zv === "liked"} onClick={() => setZv("liked")}>찜·관심 {(DATA.zvzo_brand_liked || []).length}</Chip>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            {zv === "picks" ? (
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                <thead><tr><th style={th}>크리에이터</th><th style={{ ...th, textAlign: "right" }}>팔로워</th><th style={{ ...th, textAlign: "right" }}>매칭</th><th style={th}>평균 매출(본인)</th><th style={th}>외부 검증</th><th style={th}>추천 이유</th></tr></thead>
                <tbody>
                  {DATA.zvzo_picks.map((r, i) => (
                    <tr key={i}>
                      <td style={{ ...td, whiteSpace: "nowrap" }}><a href={`https://zv-zo.com/ko/${r.code}`} target="_blank" rel="noreferrer" style={{ color: C.rose, fontWeight: 700, textDecoration: "none" }}>{r.alias}</a> <span style={{ color: C.inkLt, fontSize: 11 }}>{r.code}</span></td>
                      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{fmtK(r.f)}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 800 }}>{r.score}</td>
                      <td style={{ ...td, whiteSpace: "nowrap", color: C.inkMid }}>{r.self_rev || "—"}</td>
                      <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 700 }}>{r.ext ? won(+r.ext) : "—"}</td>
                      <td style={{ ...td, color: C.inkMid, lineHeight: 1.45, fontSize: 12 }}>{r.reason.replace(/^[^\n]*\n\n/, "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                <thead><tr><th style={th}>크리에이터</th><th style={{ ...th, textAlign: "right" }}>팔로워</th><th style={th}>예상 티어</th><th style={{ ...th, textAlign: "right" }}>희망 수수료</th><th style={th}>MD 코멘트</th></tr></thead>
                <tbody>
                  {(DATA.zvzo_brand_liked || []).map((r, i) => (
                    <tr key={i}>
                      <td style={{ ...td, whiteSpace: "nowrap" }}><a href={`https://zv-zo.com/ko/${r.code}`} target="_blank" rel="noreferrer" style={{ color: C.rose, fontWeight: 700, textDecoration: "none" }}>{r.alias}</a> <span style={{ color: C.inkLt, fontSize: 11 }}>{r.code}</span></td>
                      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{fmtK(r.f)}</td>
                      <td style={{ ...td, whiteSpace: "nowrap", color: C.inkMid }}>{r.tier || "—"}</td>
                      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{r.comm ? Math.round(r.comm * 100) + "%" : "—"}</td>
                      <td style={{ ...td, color: C.inkMid, lineHeight: 1.45, fontSize: 12 }}>{r.md || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}

      {/* (f) 인포크 — 릴스 조회수 상위 */}
      {DATA.inpock && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 18px 10px" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginBottom: 2 }}>인포크 비즈니스 크리에이터 탐색</div>
            <div style={{ fontSize: 12, color: C.inkLt }}>{DATA.inpock.note}. 제안은 인포크에서 무료 10회</div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {IP_TABS.map(([k, l]) => <Chip key={k} on={ip === k} onClick={() => setIp(k)}>{l} {(DATA.inpock[k] || []).length}</Chip>)}
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead><tr><th style={th}>계정</th><th style={{ ...th, textAlign: "right" }}>팔로워</th><th style={{ ...th, textAlign: "right" }}>릴스 평균 조회</th><th style={{ ...th, textAlign: "right" }}>조회/팔로워</th><th style={{ ...th, textAlign: "right" }}>좋아요</th><th style={{ ...th, textAlign: "right" }}>댓글</th><th style={th}>카테고리</th></tr></thead>
              <tbody>
                {(DATA.inpock[ip] || []).map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}><Account a={r.u} /></td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{fmtK(r.f)}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, whiteSpace: "nowrap" }}>{fmtK(r.view)}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", color: r.view / r.f >= 1 ? C.rose : C.inkMid }}>{(r.view / r.f).toFixed(1)}x</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", color: C.inkMid }}>{fmtK(r.like)}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", color: C.inkMid }}>{r.cmt}</td>
                    <td style={{ ...td, color: C.inkLt, fontSize: 12 }}>{(r.cats || []).map((c) => IP_CAT[c] || c).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

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
