"use client";
// 광고관리 (트래픽) — 카카오 선물하기 유입 트래픽 캠페인 운영표 (09-21)
// 어떤 제품을 / 어떤 링크로 / 어떤 소재로 / 어떤 할인·문구로 / 어느 매체에서 돌리는지 한 화면에서 관리.
// 저장: Supabase settings key `oa_traffic_ads_v1` = { items:[...], statuses:[...] } (팀 공유, 즉시 저장)
import { useEffect, useMemo, useState } from "react";

const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SKEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const KEY = "oa_traffic_ads_v1";
const sh = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, "Content-Type": "application/json" };
const STATUS_COLOR = { "준비": "#6b7280", "소재 제작중": "#d97706", "검수중": "#7c3aed", "집행중": "#059669", "일시정지": "#b45309", "종료": "#374151", "확인필요": "#dc2626", "보류": "#9ca3af" };
const DEFAULT_STATUSES = ["준비", "소재 제작중", "검수중", "집행중", "일시정지", "종료", "확인필요", "보류"];
const uid = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const now = () => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

export default function TrafficAdsSection({ C, Card }) {
  const [data, setData] = useState({ items: [], statuses: DEFAULT_STATUSES });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null);       // 펼친 행 id
  const [creInput, setCreInput] = useState({ url: "", label: "" });
  const [comp, setComp] = useState(null);           // 타사 광고 모니터 (settings oa_competitor_ads_v1)
  const [compTopic, setCompTopic] = useState("");
  const [compOpen, setCompOpen] = useState(true);
  const [rank, setRank] = useState(null);           // 카카오 랭킹 스냅샷 (settings oa_kakao_rank_v1 ← scripts/kakao-rank/kakao_rank.py 08:30·17:30)
  const [sonic, setSonic] = useState(null);
  const [sonicTab, setSonicTab] = useState("musinsa"); // 랭킹 카드 탭: musinsa | ably | zigzag         // 소닉플로우 무신사/지그재그 랭킹 트래커 (settings oa_sonic_rank_v1 ← scripts/sonic/sonic_rank_track.py 매시간, 09-23)
  useEffect(() => {
    fetch(`${SURL}/rest/v1/settings?key=eq.oa_sonic_rank_v1&select=value`, { headers: sh }).then((r) => r.json())
      .then((d) => { const v = Array.isArray(d) && d[0]?.value; if (v && v.latest) setSonic(v); }).catch(() => {});
  }, []);
  useEffect(() => {
    fetch(`${SURL}/rest/v1/settings?key=eq.oa_kakao_rank_v1&select=value`, { headers: sh }).then((r) => r.json())
      .then((d) => { const v = Array.isArray(d) && d[0]?.value; if (v && Array.isArray(v.products)) setRank(v); }).catch(() => {});
  }, []);
  // 라인 → 랭킹 상품 매칭: 링크의 product/{id} 우선, 없으면 제품명 앞 3글자
  const rankOf = (it) => {
    if (!rank) return null;
    const m = String(it.web_url || it.kakao_url || "").match(/product\/(\d+)/); const pid = m ? Number(m[1]) : null;
    const key = String(it.product || "").replace(/\s/g, "").slice(0, 3);
    return rank.products.find((p) => pid && p.id === pid) || rank.products.find((p) => key && String(p.name).replace(/\s/g, "").startsWith(key)) || null;
  };
  const platformOf = (it) => { const u = String(it.kakao_url || it.web_url || ""); return /musinsa/i.test(u) ? "musinsa" : /zigzag/i.test(u) ? "zigzag" : /a-bly|ably/i.test(u) ? "ably" : "kakao"; };
  const PLAT_LABEL = { musinsa: "무신사", zigzag: "지그재그", ably: "에이블리", kakao: "카카오" };
  const RankCell = ({ it }) => {
    const plat = platformOf(it);
    if (plat !== "kakao") {
      const L = sonic?.latest || {}, H = sonic?.history || [], prev = H.length > 1 ? H[H.length - 2] : null;
      const cur = plat === "musinsa" ? L.musinsa?.hair_rank : plat === "zigzag" ? L.zigzag?.hair_rank : L.ably?.hair_device_daily;
      const pv = plat === "musinsa" ? prev?.musinsa?.hair_rank : plat === "zigzag" ? prev?.zigzag?.hair_rank : prev?.ably?.hair_device_daily;
      const total = plat === "musinsa" ? L.musinsa?.hair_rank_total : plat === "zigzag" ? L.zigzag?.hair_rank_total : L.ably?.hair_device_daily_total;
      const listName = plat === "musinsa" ? "헤어케어 실시간" : plat === "zigzag" ? "헤어기기 추천순" : "헤어기기 일간";
      if (!sonic) return <span style={{ fontSize: 11, color: C.inkLt }}>순위 미추적</span>;
      const d = cur != null && pv != null ? pv - cur : null;
      return (<div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
        {cur != null ? <span style={{ fontSize: 14, fontWeight: 900, color: C.ink }}>{cur}위</span> : <span style={{ fontSize: 12, fontWeight: 800, color: C.bad }}>{total ? `${total}위 밖` : "미노출"}</span>}
        {d != null && d !== 0 && <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 800, color: d > 0 ? "#059669" : C.bad }}>{d > 0 ? `▲${d}` : `▼${-d}`}</span>}
        <div style={{ fontSize: 10.5, color: C.inkLt, overflow: "hidden", textOverflow: "ellipsis" }}>{PLAT_LABEL[plat]} {listName} · 앱 랭킹 카드 참고</div>
      </div>);
    }
    const p = rankOf(it); if (!p) return <span style={{ fontSize: 11, color: C.inkLt }}>순위 미추적</span>;
    const g = p.goal || {}; const list = g.list || Object.keys(p.ranks).find((l) => p.ranks[l]?.today != null) || "가전·디지털";
    const t = p.ranks[list]?.today, pv = p.ranks[list]?.prev; const d = t != null && pv != null ? pv - t : null;
    const goalTxt = g.min != null ? (g.min === g.max ? `${g.min}위` : `${g.min}~${g.max}위`) : null;
    const hit = t != null && g.max != null && t <= g.max;
    return (<div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }} title={`${list}${goalTxt ? ` · 목표 ${goalTxt}` : ""}${p.wish?.today != null ? ` · 위시 ${Number(p.wish.today).toLocaleString()}` : ""}`}>
      {t != null ? <span style={{ fontSize: 14, fontWeight: 900, color: hit ? "#059669" : C.ink }}>{t}위</span> : <span style={{ fontSize: 12, fontWeight: 800, color: C.bad }}>500위 밖</span>}
      {d != null && d !== 0 && <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 800, color: d > 0 ? "#059669" : C.bad }}>{d > 0 ? `▲${d}` : `▼${-d}`}</span>}
      <div style={{ fontSize: 10.5, color: C.inkLt, overflow: "hidden", textOverflow: "ellipsis" }}>{list}{goalTxt ? ` · 목표 ${goalTxt}` : ""}{p.wish?.today != null ? ` · 위시 ${Number(p.wish.today).toLocaleString()}` : ""}</div>
    </div>);
  };
  useEffect(() => {
    fetch(`${SURL}/rest/v1/settings?key=eq.oa_competitor_ads_v1&select=value`, { headers: sh }).then((r) => r.json())
      .then((d) => { const v = Array.isArray(d) && d[0]?.value; if (v && v.topics) { setComp(v.topics); setCompTopic(Object.keys(v.topics)[0] || ""); } }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${SURL}/rest/v1/settings?key=eq.${KEY}&select=value`, { headers: sh })
      .then((r) => r.json())
      .then((d) => { const v = Array.isArray(d) && d[0]?.value; if (v && Array.isArray(v.items)) setData({ items: v.items, statuses: v.statuses || DEFAULT_STATUSES }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const persist = async (next) => {
    setData(next); setSaving("저장 중…");
    try {
      const r = await fetch(`${SURL}/rest/v1/settings`, { method: "POST", headers: { ...sh, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([{ key: KEY, value: next }]) });
      setSaving(r.ok ? "저장됨 " + now().slice(11) : "저장 실패");
    } catch { setSaving("저장 실패"); }
    setTimeout(() => setSaving(""), 2500);
  };
  const patch = (id, f) => persist({ ...data, items: data.items.map((it) => (it.id === id ? { ...it, ...f, updated_at: now() } : it)) });
  const remove = (id) => { if (!confirm("이 라인을 지울까요?")) return; persist({ ...data, items: data.items.filter((it) => it.id !== id) }); };
  const add = () => persist({ ...data, items: [...data.items, { id: uid(), line: "", product: "", kakao_url: "", media: "캐시슬라이드", period: "", budget: "", status: "준비", discount_note: "", creative_note: "", creatives: [], landing_ok: false, owner: "", memo: "", updated_at: now() }] });
  const move = (id, dir) => { const a = [...data.items]; const i = a.findIndex((x) => x.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; persist({ ...data, items: a }); };

  const items = useMemo(() => data.items.filter((it) => filter === "all" ? true : filter === "live" ? it.status === "집행중" : filter === "todo" ? ["준비", "소재 제작중", "검수중", "확인필요"].includes(it.status) : it.status === filter), [data, filter]);
  const sum = useMemo(() => {
    const won = (s) => { const m = String(s || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*만/); return m ? Math.round(parseFloat(m[1]) * 10000) : (parseInt(String(s || "").replace(/[^\d]/g, ""), 10) || 0); };
    return { total: data.items.reduce((a, b) => a + won(b.budget), 0), live: data.items.filter((x) => x.status === "집행중").length, todo: data.items.filter((x) => ["준비", "소재 제작중", "검수중", "확인필요"].includes(x.status)).length, nolink: data.items.filter((x) => !x.kakao_url).length, nocre: data.items.filter((x) => !(x.creatives || []).length).length };
  }, [data]);

  const th = { padding: "8px 10px", textAlign: "left", fontWeight: 700, fontSize: 12, color: C.inkMid, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", background: C.cream };
  const td = { padding: "7px 10px", fontSize: 12.5, verticalAlign: "top", borderBottom: `1px solid ${C.cream}` };
  const inp = { width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 7px", fontSize: 12.5, fontFamily: "inherit", background: C.white, color: C.ink };
  const btn = { border: `1px solid ${C.border}`, background: C.white, borderRadius: 6, padding: "4px 9px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: C.ink };
  const Cell = ({ it, k, ph, w }) => (
    <input defaultValue={it[k] || ""} placeholder={ph} style={{ ...inp, width: w || "100%" }} onBlur={(e) => { if ((e.target.value || "") !== (it[k] || "")) patch(it.id, { [k]: e.target.value }); }} />
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* 소닉플로우 앱 랭킹 트래커 — 무신사 뷰티 실시간 랭킹(헤어케어/전체) + 지그재그 카테고리 추천순(헤어기기/이미용가전). "N명이 보는 중"은 무신사 랭킹에 노출될 때만 잡힘, 지그재그 "보고 있어요"는 앱 전용이라 미수집 (09-23) */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>소닉플로우 앱 랭킹</span>
          <div style={{ display: "flex", gap: 4 }}>
            {[["musinsa", "무신사"], ["ably", "에이블리"], ["zigzag", "지그재그"]].map(([k, l]) => (
              <button key={k} onClick={() => setSonicTab(k)} style={{ border: `1px solid ${sonicTab === k ? C.ink : C.border}`, background: sonicTab === k ? C.ink : C.white, color: sonicTab === k ? C.white : C.ink, borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
            ))}
          </div>
          <span style={{ fontSize: 11, color: C.inkLt }}>매시간 갱신</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: C.inkLt }}>{sonic ? `갱신 ${sonic.updated_at} · 기록 ${(sonic.history || []).length}건` : "데이터 없음"}</span>
        </div>
        {sonic && (() => {
          const L = sonic.latest, H = sonic.history || [], ms = L.musinsa || {}, zz = L.zigzag || {};
          const prev = H.length > 1 ? H[H.length - 2] : null;
          const Delta = ({ cur, pv }) => { if (cur == null || pv == null || cur === pv) return null; const d = pv - cur; return <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 800, color: d > 0 ? "#059669" : C.bad }}>{d > 0 ? `▲${d}` : `▼${-d}`}</span>; };
          const Spark = ({ pick, invert }) => {
            const pts = H.slice(-48).map((h) => pick(h)).map((v) => (v == null ? null : Number(v)));
            const vals = pts.filter((v) => v != null); if (vals.length < 2) return null;
            const mn = Math.min(...vals), mx = Math.max(...vals), w = 120, h = 26;
            const y = (v) => { const t = mx === mn ? 0.5 : (v - mn) / (mx - mn); return invert ? 3 + t * (h - 6) : h - 3 - t * (h - 6); };
            const d = pts.map((v, i) => (v == null ? null : `${(i / (pts.length - 1)) * w},${y(v)}`)).filter(Boolean).join(" ");
            return <svg width={w} height={h} style={{ display: "block" }}><polyline points={d} fill="none" stroke="#2563eb" strokeWidth="1.5" /></svg>;
          };
          const Metric = ({ label, value, sub, pick, invert, link }) => (
            <div style={{ padding: "10px 14px", borderRight: `1px solid ${C.border}`, minWidth: 150 }}>
              <div style={{ fontSize: 11, color: C.inkLt }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.ink, whiteSpace: "nowrap" }}>{value}{sub}</div>
              {pick && <Spark pick={pick} invert={invert} />}
              {link && <a href={link} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: "#2563eb" }}>상품 열기 ↗</a>}
            </div>
          );
          const rk = (v, total) => (v == null ? <span style={{ color: C.bad, fontSize: 13 }}>{total ? `${total}위 밖` : "미노출"}</span> : `${v}위`);
          return (
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {sonicTab === "musinsa" && (<>
                <Metric label="헤어케어 실시간 랭킹" value={rk(ms.hair_rank, ms.hair_rank_total)} sub={<Delta cur={ms.hair_rank} pv={prev?.musinsa?.hair_rank} />} pick={(h) => h.musinsa?.hair_rank} invert link={sonic.links?.musinsa} />
                <Metric label="뷰티 전체 실시간 랭킹" value={rk(ms.all_rank, ms.all_rank_total)} sub={<Delta cur={ms.all_rank} pv={prev?.musinsa?.all_rank} />} pick={(h) => h.musinsa?.all_rank} invert />
                <Metric label="보는 중 / 구매 중" value={ms.viewers || ms.buying ? `${ms.viewers || ""} ${ms.buying || ""}` : <span style={{ fontSize: 13, color: C.inkLt }}>랭킹 상위 노출 시 표시</span>} />
                <Metric label="가격 (정가 → 판매가 → 쿠폰가)" value={ms.final_price ? <><span style={{ color: C.inkLt, fontWeight: 500, textDecoration: "line-through", fontSize: 13 }}>{Number(ms.normal_price).toLocaleString()}</span> → {Number(ms.sale_price).toLocaleString()} → <span style={{ color: "#dc2626" }}>{Number(ms.final_price).toLocaleString()}원</span> <span style={{ fontSize: 12, color: C.inkLt }}>({ms.discount}%)</span></> : "-"} pick={(h) => h.musinsa?.final_price} />
                <Metric label="조회 / 누적구매 / 리뷰" value={`${ms.page_view_total ?? "-"} / ${ms.purchase_total ?? "-"} / ${ms.reviews ?? "-"}`} pick={(h) => h.musinsa?.purchase_total} />
              </>)}
              {sonicTab === "ably" && (() => { const ab = L.ably || {}; const tp = (k) => ab[k] == null ? <span style={{ color: C.inkLt, fontSize: 13 }}>톱{ab[k + "_total"] || 10} 밖</span> : `${ab[k]}위`; return (<>
                <Metric label="헤어기기 일간 / 주간" value={<>{tp("hair_device_daily")} <span style={{ color: C.inkLt, fontWeight: 500 }}>/</span> {tp("hair_device_weekly")}</>} sub={<Delta cur={ab.hair_device_daily} pv={prev?.ably?.hair_device_daily} />} pick={(h) => h.ably?.hair_device_daily} invert link={sonic.links?.ably} />
                <Metric label="뷰티기기 일간 / 주간" value={<>{tp("beauty_device_daily")} <span style={{ color: C.inkLt, fontWeight: 500 }}>/</span> {tp("beauty_device_weekly")}</>} sub={<Delta cur={ab.beauty_device_daily} pv={prev?.ably?.beauty_device_daily} />} pick={(h) => h.ably?.beauty_device_daily} invert />
                <Metric label="뷰티 전체 일간 / 주간" value={<>{tp("beauty_all_daily")} <span style={{ color: C.inkLt, fontWeight: 500 }}>/</span> {tp("beauty_all_weekly")}</>} pick={(h) => h.ably?.beauty_all_daily} invert />
                <Metric label="가격 / 쿠폰" value={ab.price ? <>{Number(ab.price).toLocaleString()}원{ab.discount ? <span style={{ fontSize: 12, color: C.inkLt }}> ({ab.discount}%)</span> : null}{ab.coupon_price ? <span style={{ color: "#dc2626" }}> → {Number(ab.coupon_price).toLocaleString()}원</span> : null}{ab.coupon_text ? <div style={{ fontSize: 10.5, color: C.inkLt, fontWeight: 500 }}>{ab.coupon_text}</div> : null}</> : "-"} pick={(h) => h.ably?.price} link={sonic.links?.ably} />
                <Metric label="좋아요 / 판매 / 리뷰" value={`${ab.likes ?? "-"} / ${ab.sell_count ?? "-"} / ${ab.reviews ?? "-"}`} pick={(h) => h.ably?.likes} />
              </>); })()}
              {sonicTab === "zigzag" && (<>
                <Metric label="헤어기기 추천순" value={rk(zz.hair_rank, zz.hair_rank_total)} sub={<Delta cur={zz.hair_rank} pv={prev?.zigzag?.hair_rank} />} pick={(h) => h.zigzag?.hair_rank} invert link={sonic.links?.zigzag} />
                <Metric label="이미용가전 추천순" value={rk(zz.appliance_rank, zz.appliance_rank_total)} sub={<Delta cur={zz.appliance_rank} pv={prev?.zigzag?.appliance_rank} />} pick={(h) => h.zigzag?.appliance_rank} invert />
                <Metric label="가격" value={zz.price ? <>{Number(zz.price).toLocaleString()}원 <span style={{ fontSize: 12, color: C.inkLt }}>({zz.discount}% 할인)</span></> : "-"} pick={(h) => h.zigzag?.price} />
                <Metric label="관심 / 리뷰" value={`${zz.interest || "-"} / ${zz.reviews ?? "-"}개`} pick={(h) => { const m = String(h.zigzag?.interest || "").match(/([\d.]+)(천|만)?/); return m ? Number(m[1]) * (m[2] === "만" ? 10000 : m[2] === "천" ? 1000 : 1) : null; }} />
              </>)}
            </div>
          );
        })()}
      </Card>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.ink }}>광고관리 (트래픽)</div>
            <div style={{ fontSize: 12, color: C.inkLt, marginTop: 3 }}>카카오 선물하기 유입 캠페인 — 제품·링크·소재·할인 문구·매체·상태를 한 표에서 관리. 셀을 고치면 바로 팀 공유 저장</div>
          </div>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: saving.includes("실패") ? C.bad : C.inkLt }}>{saving}</span>
          <button style={btn} onClick={add}>＋ 라인 추가</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {[["총 예산", sum.total ? sum.total.toLocaleString() + "원" : "-", C.ink], ["집행중", sum.live + "개", "#059669"], ["진행 필요", sum.todo + "개", "#d97706"], ["링크 없음", sum.nolink + "개", sum.nolink ? C.bad : C.inkLt], ["소재 미등록", sum.nocre + "개", sum.nocre ? C.bad : C.inkLt]].map(([l, v, c]) => (
            <div key={l} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", minWidth: 110 }}>
              <div style={{ fontSize: 11, color: C.inkLt }}>{l}</div><div style={{ fontSize: 16, fontWeight: 800, color: c }}>{v}</div>
            </div>
          ))}
          <span style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
            {[["all", "전체"], ["live", "집행중"], ["todo", "진행 필요"], ["종료", "종료"], ["보류", "보류"]].map(([id, l]) => (
              <button key={id} onClick={() => setFilter(id)} style={{ ...btn, background: filter === id ? C.rose : C.white, color: filter === id ? "#fff" : C.ink, borderColor: filter === id ? C.rose : C.border }}>{l}</button>
            ))}
          </div>
        </div>
      </Card>

      {loading && <Card><div style={{ textAlign: "center", color: C.inkLt, padding: 24 }}>불러오는 중…</div></Card>}
      {!loading && !items.length && <Card><div style={{ textAlign: "center", color: C.inkLt, padding: 24 }}>표시할 라인이 없어요</div></Card>}
      {/* 한 화면 요약: 라인당 한 줄(제품·상태·가격/할인·기간·예산·소재 썸네일) — 상세는 행 클릭 시 아래로 펼침 (09-21 "한 페이지에서 확인") */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {items.map((it, idx) => {
          const sc = STATUS_COLOR[it.status] || C.inkMid; const cre = it.creatives || []; const isOpen = open === it.id;
          return (
            <div key={it.id} style={{ borderTop: idx ? `1px solid ${C.cream}` : "none", borderLeft: `6px solid ${sc}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "56px 130px 118px 200px minmax(0, 190px) minmax(0, 170px) minmax(0, 1fr) 60px", gap: 10, alignItems: "center", padding: "8px 12px", cursor: "pointer" }} onClick={(e) => { if (["INPUT", "SELECT", "TEXTAREA", "BUTTON", "A", "IMG"].includes(e.target.tagName)) return; setOpen(isOpen ? null : it.id); }}>
                <div style={{ fontWeight: 900, fontSize: 13, color: C.ink }}>{it.line || "-"}</div>
                <div style={{ fontWeight: 800, fontSize: 13, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.product || "(제품)"}<div style={{ fontSize: 10.5, fontWeight: 500, color: C.inkLt }}>{it.media || "-"} · {it.period || "-"} · {it.budget || "-"}</div></div>
                <select value={it.status} onChange={(e) => patch(it.id, { status: e.target.value })} style={{ ...inp, width: 112, fontWeight: 800, color: sc, borderColor: sc, padding: "4px 6px" }}>
                  {(data.statuses || DEFAULT_STATUSES).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <div style={{ whiteSpace: "nowrap" }}>
                  {it.price ? (<>
                    <span style={{ fontSize: 14, fontWeight: 900, color: C.ink }}>{Number(it.price.selling).toLocaleString()}원 </span>
                    {it.price.rate ? <span style={{ background: C.bad, color: "#fff", fontWeight: 900, fontSize: 11.5, padding: "2px 7px", borderRadius: 6 }}>{it.price.rate}% 할인</span> : <span style={{ background: C.cream, color: C.inkMid, fontWeight: 700, fontSize: 11, padding: "2px 7px", borderRadius: 6 }}>할인 없음</span>}
                    <div style={{ fontSize: 10.5, color: C.inkLt }}>정가 {Number(it.price.basic).toLocaleString()} · 표기 {Math.floor(Number(it.price.selling) / 10000)}만원대</div>
                  </>) : <span style={{ fontSize: 11, color: C.inkLt }}>가격 미확인</span>}
                </div>
                <RankCell it={it} />
                <div style={{ whiteSpace: "nowrap", fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
                  {it.kakao_url ? <a href={it.kakao_url} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: 700 }}>{PLAT_LABEL[platformOf(it)]} 랜딩 ↗</a> : <span style={{ color: C.bad, fontWeight: 700 }}>링크 없음</span>}
                  <div style={{ fontSize: 10.5, color: it.landing_ok ? "#059669" : C.inkLt, overflow: "hidden", textOverflow: "ellipsis" }}>{it.landing_ok ? (it.landing_note ? it.landing_note.split(" · ")[0] : "랜딩 확인됨") : "랜딩 미확인"}{it.owner ? ` · ${it.owner}` : ""}</div>
                </div>
                <div style={{ display: "flex", gap: 4, overflowX: "auto", minWidth: 0 }}>
                  {cre.length ? cre.map((c, i) => (
                    <a key={i} href={c.url} target="_blank" rel="noreferrer" title={c.label || ""} style={{ flex: "0 0 auto", border: `2px solid ${c.live ? "#059669" : C.border}`, borderRadius: 5, overflow: "hidden", width: 46, height: 82, background: C.cream }}>
                      {/\.(png|jpe?g|gif|webp)(\?|$)/i.test(c.url || "") ? <img src={c.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <span style={{ fontSize: 9, padding: 2, display: "block" }}>링크</span>}
                    </a>
                  )) : <span style={{ fontSize: 11, color: C.bad, fontWeight: 700 }}>소재 없음</span>}
                </div>
                <div style={{ fontSize: 11, color: C.inkLt, textAlign: "right" }}>{cre.length ? `${cre.length}장` : ""}<br />{isOpen ? "▲ 닫기" : "▼ 상세"}</div>
              </div>
              {isOpen && (
                <div style={{ padding: "6px 14px 14px", background: C.cream, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: C.inkLt }}>라인</span><Cell it={it} k="line" ph="A / B-1" w={70} />
                    <span style={{ fontSize: 11, color: C.inkLt }}>제품</span><Cell it={it} k="product" ph="제품명" w={140} />
                    <span style={{ fontSize: 11, color: C.inkLt }}>매체</span><Cell it={it} k="media" ph="캐시슬라이드" w={100} />
                    <span style={{ fontSize: 11, color: C.inkLt }}>기간</span><Cell it={it} k="period" ph="2주" w={60} />
                    <span style={{ fontSize: 11, color: C.inkLt }}>예산</span><Cell it={it} k="budget" ph="100만원" w={90} />
                    <span style={{ fontSize: 11, color: C.inkLt }}>담당</span><Cell it={it} k="owner" ph="담당" w={70} />
                    <span style={{ fontSize: 11, color: C.inkLt }}>링크</span><Cell it={it} k="kakao_url" ph="https://gift.kakao.com/product/…" w={280} />
                    <label style={{ fontSize: 11, color: it.landing_ok ? "#059669" : C.inkLt, cursor: "pointer" }}><input type="checkbox" checked={!!it.landing_ok} onChange={(e) => patch(it.id, { landing_ok: e.target.checked })} /> 랜딩 확인</label>
                    <span style={{ flex: 1 }} />
                    <button style={btn} title="위로" onClick={() => move(it.id, -1)}>↑</button><button style={btn} title="아래로" onClick={() => move(it.id, 1)}>↓</button><button style={{ ...btn, color: C.bad }} onClick={() => remove(it.id)}>삭제</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, marginBottom: 6 }}>소재 {cre.length}개 <span style={{ fontWeight: 500, color: C.inkLt }}>· "집행" 표시 = 실제 운영 소재</span></div>
                      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                        {cre.map((c, i) => (
                          <div key={i} style={{ flex: "0 0 auto", width: 118, border: `2px solid ${c.live ? "#059669" : C.border}`, borderRadius: 8, background: C.white, padding: 4 }}>
                            {/\.(png|jpe?g|gif|webp)(\?|$)/i.test(c.url || "") ? <a href={c.url} target="_blank" rel="noreferrer"><img src={c.url} alt="" style={{ width: "100%", height: 196, objectFit: "cover", borderRadius: 5, display: "block" }} /></a> : <a href={c.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, wordBreak: "break-all" }}>{c.url}</a>}
                            <div style={{ fontSize: 11, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
                              <span style={{ fontWeight: 700, color: c.live ? "#059669" : C.inkMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label || `소재 ${i + 1}`}</span>
                              <span style={{ whiteSpace: "nowrap" }}>
                                <button style={{ ...btn, padding: "1px 5px", fontSize: 10 }} onClick={() => patch(it.id, { creatives: cre.map((x, j) => (j === i ? { ...x, live: !x.live } : x)) })}>{c.live ? "해제" : "집행"}</button>
                                <button style={{ ...btn, padding: "1px 5px", fontSize: 10, color: C.bad, marginLeft: 2 }} onClick={() => patch(it.id, { creatives: cre.filter((_, j) => j !== i) })}>×</button>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <input placeholder="소재 이미지/피그마 링크" value={creInput.url} onChange={(e) => setCreInput({ ...creInput, url: e.target.value })} style={{ ...inp, flex: 1 }} />
                        <input placeholder="이름 (예: 정답형 v2)" value={creInput.label} onChange={(e) => setCreInput({ ...creInput, label: e.target.value })} style={{ ...inp, width: 150 }} />
                        <button style={btn} onClick={() => { if (!creInput.url.trim()) return; patch(it.id, { creatives: [...cre, { url: creInput.url.trim(), label: creInput.label.trim(), live: false }] }); setCreInput({ url: "", label: "" }); }}>추가</button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.ink }}>할인·가격 표기</div>
                      <textarea defaultValue={it.discount_note || ""} rows={2} style={{ ...inp, resize: "vertical" }} onBlur={(e) => { if (e.target.value !== (it.discount_note || "")) patch(it.id, { discount_note: e.target.value }); }} />
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.ink }}>소재 방향·문구</div>
                      <textarea defaultValue={it.creative_note || ""} rows={2} style={{ ...inp, resize: "vertical" }} onBlur={(e) => { if (e.target.value !== (it.creative_note || "")) patch(it.id, { creative_note: e.target.value }); }} />
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.ink }}>운영 메모</div>
                      <textarea defaultValue={it.memo || ""} rows={2} style={{ ...inp, resize: "vertical" }} onBlur={(e) => { if (e.target.value !== (it.memo || "")) patch(it.id, { memo: e.target.value }); }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Card>
      {/* 타사 광고 모니터 — 메타 광고 라이브러리(KR, 게재 중) 스캔 결과. 갱신: scripts/competitor/meta_adlib_scan.py <주제> (09-21) */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", flexWrap: "wrap", cursor: "pointer" }} onClick={() => setCompOpen((v) => !v)}>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>타사 광고 모니터</span>
          <span style={{ fontSize: 11.5, color: C.inkLt }}>메타 광고 라이브러리 · 한국 · 지금 게재 중인 광고만</span>
          <span style={{ flex: 1 }} />
          {comp && Object.keys(comp).map((t) => (
            <button key={t} onClick={(e) => { e.stopPropagation(); setCompTopic(t); setCompOpen(true); }} style={{ ...btn, background: compTopic === t ? C.rose : C.white, color: compTopic === t ? "#fff" : C.ink, borderColor: compTopic === t ? C.rose : C.border }}>{t}</button>
          ))}
          <span style={{ fontSize: 11, color: C.inkLt }}>{comp && compTopic && comp[compTopic] ? `갱신 ${comp[compTopic].updated_at} · 광고 ${comp[compTopic].total}건 · 광고주 ${(comp[compTopic].advertisers || []).length}` : "데이터 없음"} {compOpen ? "▲" : "▼"}</span>
        </div>
        {compOpen && comp && compTopic && comp[compTopic] && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead><tr>{["광고주", "활성 광고", "최근 시작", "소구 · 문구"].map((h) => <th key={h} style={{ padding: "7px 12px", textAlign: "left", fontSize: 11.5, fontWeight: 700, color: C.inkMid, background: C.cream, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
              <tbody>
                {(comp[compTopic].advertisers || []).map((a, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.cream}` }}>
                    <td style={{ padding: "6px 12px", fontSize: 12.5, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>{a.adv}</td>
                    <td style={{ padding: "6px 12px", fontSize: 12.5, fontWeight: 800, color: a.n >= 5 ? C.bad : C.ink, textAlign: "center" }}>{a.n}</td>
                    <td style={{ padding: "6px 12px", fontSize: 11.5, color: C.inkLt, whiteSpace: "nowrap" }}>{a.start}</td>
                    <td style={{ padding: "6px 12px", fontSize: 12, color: C.inkMid, lineHeight: 1.4 }}>{a.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: "8px 12px", fontSize: 11, color: C.inkLt }}>검색어: {(comp[compTopic].queries || []).join(" · ")} · 네이버 파워링크는 자동 수집 불가(수동 확인). 갱신은 맥에서 <code>python3 scripts/competitor/meta_adlib_scan.py {compTopic}</code></div>
          </div>
        )}
      </Card>
      <div style={{ fontSize: 11, color: C.inkLt, padding: "0 4px" }}>
        규칙: 광고 문구는 한글만 · 금액은 "n만원대"로만 · 날짜/마감/증정 표현 금지 · 할인율은 실제 상품 페이지 확인값만. 캐시슬라이드 규격 720×1280 / 100KB 이하 / 소문자 .jpg (안전영역 상205·하330·좌우50px).
      </div>
    </div>
  );
}
function FragmentRow({ children }) { return <>{children}</>; }
