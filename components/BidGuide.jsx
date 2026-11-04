'use client'
// 키워드 입찰 가이드(8): 지금 입찰가 vs 1·3·5위 예상 입찰가 + 최근 7일 구매완료 ROAS
import { useEffect, useState } from "react";
import { won } from "./useShared";
export default function BidGuide({ C, Card }) {
  const [d, setD] = useState(null); const [err, setErr] = useState(null);
  useEffect(() => { fetch("/api/bid-guide").then((r) => r.json()).then((j) => j.error ? setErr(j.error) : setD(j)).catch((e) => setErr(String(e))); }, []);
  const td = { fontSize: 13, color: C.ink, padding: "7px 8px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };
  const BE = (g) => /플렌티/.test(g) ? 254 : 228;
  const rows = (d?.rows || []).sort((a, b) => b.cost - a.cost);
  return (
    <Card style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>네이버 파워링크 입찰 가이드 <span style={{ fontSize: 12, fontWeight: 500, color: C.inkLt }}>· 최근 7일 · 모바일 예상 입찰가 · 손익분기 ROAS 플렌티 254% / 프리온 228%</span></div>
      {err && <div style={{ fontSize: 13, color: C.bad, marginTop: 6 }}>불러오기 실패: {err}</div>}
      {!d && !err && <div style={{ fontSize: 13, color: C.inkLt, marginTop: 6 }}>네이버 검색광고에서 가져오는 중... (10초쯤)</div>}
      {d && <div style={{ overflowX: "auto", marginTop: 8 }}><table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
        <thead><tr>{["그룹", "키워드", "현재 입찰", "평균 순위", "3위 예상", "1위 예상", "광고비", "클릭", "구매", "ROAS", "제안"].map((h) => <th key={h} style={{ fontSize: 11, color: C.inkLt, fontWeight: 700, textAlign: "left", padding: "4px 8px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => { const roas = r.cost ? r.rev / r.cost * 100 : 0; const be = BE(r.group); let tip = "유지", col = C.inkMid;
          if (r.cost >= 20000 && roas < be * 0.6) { tip = `입찰 −${Math.max(50, Math.round(r.bid * 0.3 / 10) * 10)}원 또는 중지`; col = "#dc2626"; }
          else if (roas >= be * 1.5 && r.est[3] && r.bid < r.est[3]) { tip = `3위 가려면 +${(r.est[3] - r.bid).toLocaleString()}원`; col = "#16a34a"; }
          else if (roas >= be * 2 && r.est[1] && r.bid < r.est[1]) { tip = `1위 가려면 +${(r.est[1] - r.bid).toLocaleString()}원`; col = "#16a34a"; }
          else if (r.imp < 50 && r.est[5] && r.bid < r.est[5]) { tip = `노출 적음 · 5위 +${(r.est[5] - r.bid).toLocaleString()}원`; col = "#d97706"; }
          return <tr key={i}><td style={{ ...td, color: C.inkLt, fontSize: 12 }}>{r.group.replace(/\(파워링크\)/, "")}</td><td style={{ ...td, fontWeight: 800 }}>{r.keyword}</td><td style={td}>{r.bid.toLocaleString()}원{r.groupBid && <span style={{ fontSize: 10, color: C.inkLt }}> 그룹</span>}</td><td style={td}>{r.rank ?? "—"}</td><td style={td}>{r.est[3] ? r.est[3].toLocaleString() + "원" : "—"}</td><td style={td}>{r.est[1] ? r.est[1].toLocaleString() + "원" : "—"}</td><td style={td}>{won(r.cost)}</td><td style={td}>{r.clk}</td><td style={td}>{r.buy}</td><td style={{ ...td, fontWeight: 800, color: r.cost < 20000 ? C.inkLt : roas >= be ? "#16a34a" : "#dc2626" }}>{Math.round(roas)}%</td><td style={{ ...td, color: col, fontWeight: 700 }}>{tip}</td></tr>; })}</tbody>
      </table></div>}
      <div style={{ fontSize: 12, color: C.inkLt, marginTop: 8 }}>제안은 참고용이에요. 바꾸면 "변경 기록"에 남겨 주세요.</div>
    </Card>
  );
}
