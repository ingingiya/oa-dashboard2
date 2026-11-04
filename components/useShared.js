'use client'
// 팀 공유 상태 (Supabase settings) — 로드 전엔 기본값, 변경 시 저장
import { useCallback, useEffect, useRef, useState } from "react";
import { getSetting, setSetting } from "../lib/useSupabase";
export default function useShared(key, def) {
  const [v, setV] = useState(def);
  const loaded = useRef(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { getSetting(key).then((x) => { if (x !== null && x !== undefined) setV(x); loaded.current = true; setReady(true); }).catch(() => { loaded.current = true; setReady(true); }); }, [key]);
  const set = useCallback((fn) => { setV((prev) => { const next = typeof fn === "function" ? fn(prev) : fn; if (loaded.current) setSetting(key, next).catch(() => {}); return next; }); }, [key]);
  return [v, set, ready];
}
export const MEMBERS = ["경은", "소리", "영서", "동욱"];
export const PRODUCTS = [
  { label: "플렌티플렛4L", like: "오아플렌티플렛4L" }, { label: "프리온", like: "오아프리온무선고데기-%" }, { label: "포그밍 코듀", like: "오아포그밍L코듀%" },
  { label: "포그밍 와플", like: "오아포그밍L와플%" }, { label: "듀얼미스트", like: "오아듀얼미스트무선가습기" }, { label: "듀얼미스트맥스", like: "오아듀얼미스트맥스-%" },
  { label: "에어리소닉", like: "오아에어리소닉드라이기-%" }, { label: "소닉플로우", like: "오아소닉플로우-%" }, { label: "히트스팟", like: "오아히트스팟%" },
  { label: "타프실링팬", like: "오아타프실링팬-화이트" }, { label: "퀵롤차저", like: "오아퀵롤차저65W%" }, { label: "듀얼포켓건", like: "오아듀얼포켓건-%" },
];
export const won = (v) => { v = +v || 0; return v >= 1e8 ? (v / 1e8).toFixed(2) + "억" : Math.round(v / 1e4).toLocaleString() + "만"; };
export const me = () => { try { return localStorage.getItem("oa_board_me") || ""; } catch { return ""; } };
