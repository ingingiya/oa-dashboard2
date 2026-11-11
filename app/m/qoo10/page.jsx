"use client";
// 📱 큐텐 광고·순위 모바일 화면 — 휴대폰에서 한눈에 (해외 탭 광고·순위의 모바일판)
// 데이터: oa_global_ads_v1(광고) · oa_global_qoo10_rank_v1(검색 순위) · oa_global_qoo10_catrank_v1(카테고리 순위) · oa_global_qoo10_sales_v1(판매)
import useShared from "../../../components/useShared";

const C = { bg: "#f4f2f7", card: "#fff", ink: "#16131c", mid: "#5d566b", lt: "#9a93a8", line: "#ebe8f0", rose: "#e11d63", green: "#16a34a", red: "#dc2626", blue: "#2563eb" };
const kst = (o = 0) => new Date(Date.now() + 9 * 36e5 - o * 864e5).toISOString().slice(0, 10);
const dday = (e) => (e ? Math.round((new Date(e + "T00:00:00+09:00") - new Date(kst() + "T00:00:00+09:00")) / 864e5) : null);
const PRODUCTS = [
  ["1220487546", "듀얼포켓건"], ["1220338974", "업컬 뷰러"], ["1220121295", "볼륨업 빗고데기"], ["1220708780", "물결고데기"],
  ["1219642801", "히트스팟S"], ["1220413073", "눈편한세상"], ["1220498612", "무선고데기S"], ["1220412993", "뿌리볼륨 고데기"], ["1218238791", "듀얼히팅뷰러"],
];

function series(rows, keyFn) {
  const by = {};
  for (const r of rows || []) (by[keyFn(r)] ||= []).push(r);
  for (const k in by) by[k].sort((a, b) => a.t.localeCompare(b.t));
  return by;
}
const Chg = ({ a, b }) => {
  if (a == null || b == null) return null;
  const d = a - b;
  if (!d) return <span style={{ color: C.lt, fontSize: 12 }}>–</span>;
  return <span style={{ color: d > 0 ? C.green : C.red, fontSize: 12, fontWeight: 800 }}>{d > 0 ? `▲${d}` : `▼${-d}`}</span>;
};

export default function Qoo10Mobile() {
  const [ads] = useShared("oa_global_ads_v1", {});
  const [rk] = useShared("oa_global_qoo10_rank_v1", { rows: [] });
  const [cr] = useShared("oa_global_qoo10_catrank_v1", { rows: [] });
  const [sales] = useShared("oa_global_qoo10_sales_v1", { days: {} });
  const [pv] = useShared("oa_global_qoo10_pv_v1", { items: {}, total: {} });
  const pvY = kst(1), pvB = kst(4);
  const pvOf = (gd, d) => (pv.items?.[gd]?.d || {})[d]?.[0] || 0;

  const q = ads.qcash || {};
  const left = (q.start || 0) - (q.used || 0);
  const kwItems = ads.kwplus?.items || [];
  const dEnd = dday(ads.kwplus?.end);
  const qty = (d) => (sales.days || {})[d]?.qty || 0;
  const yQty = qty(kst(1)), tQty = qty(kst(0));
  const goal = 10;

  const kwSer = series(rk.rows, (r) => r.gd + "|" + r.kw);
  const catSer = series(cr.rows, (r) => r.gd + "|" + r.lvl);
  const pos = (r) => (r ? r.rank || r.scanned + 1 : null);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "Pretendard, -apple-system, sans-serif", color: C.ink, letterSpacing: "-0.02em" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 14px 40px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>큐텐 광고·순위</div>
          <div style={{ fontSize: 12, color: C.lt }}>{rk.updated ? `검색 ${rk.updated.slice(5)}` : ""}{cr.updated ? ` · 카테고리 ${cr.updated.slice(5)}` : ""}</div>
        </div>

        {/* 요약 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          {[
            ["어제 판매", `${yQty}개`, `목표 하루 ${goal}개 · 오늘 ${tQty}개`, yQty >= goal ? C.green : C.ink],
            ["남은 Q캐시", left.toLocaleString(), `사용 ${(q.used || 0).toLocaleString()}`, C.ink],
            ["상세 조회 어제", `${(pv.total?.[pvY]?.[0]) || 0}`, `3일 전 ${(pv.total?.[pvB]?.[0]) || 0} · 키워드 광고 ${kwItems.length}건`, C.ink],
            ["광고 종료", dEnd == null ? "—" : dEnd >= 0 ? `D-${dEnd}` : "종료", (ads.kwplus?.end || "").slice(5).replace("-", "/"), dEnd != null && dEnd <= 2 ? C.rose : C.ink],
          ].map(([k, v, s, col]) => (
            <div key={k} style={{ background: C.card, borderRadius: 14, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.lt }}>{k}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: col, marginTop: 1 }}>{v}</div>
              <div style={{ fontSize: 11, color: C.mid }}>{s}</div>
            </div>
          ))}
        </div>

        {/* 상품별 카드 */}
        {PRODUCTS.map(([gd, name]) => {
          const cs = catSer[gd + "|s"] || [], cm = catSer[gd + "|m"] || [];
          const sNow = cs[cs.length - 1], sPrev = cs[cs.length - 2], mNow = cm[cm.length - 1], mPrev = cm[cm.length - 2];
          const kws = Object.entries(kwSer).filter(([k]) => k.startsWith(gd + "|")).map(([, a]) => a);
          return (
            <div key={gd} style={{ background: C.card, borderRadius: 16, padding: "12px 14px", marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{name}</div>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: C.mid, marginRight: 8 }}>조회 {pvOf(gd, pvB)} → <b style={{ color: pvOf(gd, pvY) > pvOf(gd, pvB) ? C.green : C.ink }}>{pvOf(gd, pvY)}</b></span>
                <a href={`https://www.qoo10.jp/g/${gd}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.lt, textDecoration: "none" }}>상품 ↗</a>
              </div>

              {/* 카테고리 순위 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
                {[[sNow, sPrev, "소분류"], [mNow, mPrev, "중분류"]].map(([n, p, lab]) => (
                  <div key={lab} style={{ background: C.bg, borderRadius: 10, padding: "7px 10px" }}>
                    <div style={{ fontSize: 11, color: C.lt, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lab} · {n?.cat || "—"}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                      <span style={{ fontSize: 20, fontWeight: 900, color: n?.rank && n.rank <= 10 ? C.green : C.ink }}>{n ? (n.rank ? `${n.rank}위` : `${n.scanned}위 밖`) : "—"}</span>
                      {n?.total ? <span style={{ fontSize: 11, color: C.lt }}>/ {n.total.toLocaleString()}</span> : null}
                      <Chg a={pos(p)} b={pos(n)} />
                    </div>
                  </div>
                ))}
              </div>

              {/* 검색어 순위 */}
              {kws.map((a) => {
                const last = a[a.length - 1], prev = a[a.length - 2];
                const kw = kwItems.find((x) => x.kw === last.kw);
                return (
                  <div key={last.kw} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0 2px", borderTop: `1px solid ${C.line}`, marginTop: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{last.kw}</div>
                      <div style={{ fontSize: 11, color: C.mid }}>
                        {last.ad ? <span style={{ color: C.rose, fontWeight: 700 }}>광고 {last.ad}번째</span> : kw ? "광고 미노출" : "광고 안 함"}
                        {kw ? ` · ¥${kw.bid}/일 · 검색 ${kw.search}/일` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 17, fontWeight: 900, color: last.rank && last.rank <= 40 ? C.green : last.rank ? C.ink : C.lt }}>{last.rank ? `${last.rank}위` : `${last.scanned}위 밖`}</div>
                      <Chg a={pos(prev)} b={pos(last)} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        <div style={{ fontSize: 11, color: C.lt, marginTop: 14, lineHeight: 1.6 }}>
          카테고리 순위 = 큐텐 카테고리 페이지 &quot;ランキング順&quot;(광고 구좌 제외) · 검색 순위 = 자연검색 · 「N위 밖」은 N개까지 봐도 없음 · ▲▼는 직전 기록 대비 · 하루 5번 자동 갱신 · 조회 = 상세페이지 조회수(3일 전 → 어제)
        </div>
        <a href="/?sec=global" style={{ display: "block", textAlign: "center", marginTop: 14, fontSize: 13, color: C.blue, textDecoration: "none" }}>PC 대시보드로</a>
      </div>
    </div>
  );
}
