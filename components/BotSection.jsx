'use client'
// 봇 탭 — 경은이 신입봇(시킨 일·반복 업무) / 경은이 1년차봇(신호 보고 스스로 일 만들어 처리). 워커 ~/oa-globalbot/worker.mjs (BOT=junior|senior)
import { useState } from "react";
import GlobalBot from "./GlobalBot";

const BOTS = [
  { id: "junior", key: "oa_global_bot_v1", title: "🧑‍💻 경은이 신입봇", short: "신입봇", desc: "시킨 일만 해요 · 문장으로 맡기거나 업무 메뉴에서 고르면 경은님 방식대로 처리 · 반복 업무 등록 가능" },
  { id: "senior", key: "oa_bot_senior_v1", title: "🧑‍💼 경은이 1년차봇", short: "1년차봇", desc: "주문·리뷰·랭킹·재고·할인 마감·판매 급감 신호를 5분마다 보고 스스로 일을 만들어 처리해요 · 밖으로 나가는 일은 권한표대로 승인 후", senior: true },
];

export default function BotSection({ C, Card }) {
  const [cur, setCur] = useState(() => { try { return localStorage.getItem("oa_bot_tab") || "senior"; } catch { return "senior"; } });
  const b = BOTS.find((x) => x.id === cur) || BOTS[0];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.ink }}>봇</div>
          <div style={{ fontSize: 13, color: C.inkMid, marginTop: 2 }}>오아 맥에서 일하는 직원 봇 · 승인이 필요한 일은 노란 테두리로 올라와요</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 6 }}>
          {BOTS.map((x) => <button key={x.id} onClick={() => { setCur(x.id); try { localStorage.setItem("oa_bot_tab", x.id); } catch {} }} style={{ fontSize: 13, fontWeight: 800, padding: "7px 14px", borderRadius: 999, border: 0, cursor: "pointer", background: cur === x.id ? C.ink : "#f1f5f9", color: cur === x.id ? "#fff" : C.inkMid }}>{x.short}</button>)}
        </div>
      </div>
      <GlobalBot key={b.id} C={C} Card={Card} botKey={b.key} title={b.title} desc={b.desc} senior={!!b.senior} />
    </div>
  );
}
