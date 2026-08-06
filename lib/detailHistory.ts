// lib/detailHistory.ts
// 상세페이지 생성기록 — settings KV(oa_detail_history_v1)에 append.
// 파일 삭제 후에도 기록은 남는다 (deleted 플래그).

import type { SupabaseClient } from "@supabase/supabase-js";

export const HISTORY_KEY = "oa_detail_history_v1";

export type HistoryItem = {
  id: string;
  at: string; // ISO (KST 아님 — UTC)
  type: "render" | "cuts";
  slug: string;
  urls: string[];
  deleted?: boolean;
};

export async function appendHistory(
  sb: SupabaseClient,
  item: Omit<HistoryItem, "id" | "at">
) {
  const { data } = await sb
    .from("settings")
    .select("value")
    .eq("key", HISTORY_KEY)
    .maybeSingle();
  const items: HistoryItem[] = data?.value?.items || [];
  items.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    at: new Date().toISOString(),
    ...item,
  });
  await sb
    .from("settings")
    .upsert({ key: HISTORY_KEY, value: { items: items.slice(0, 300) } }, { onConflict: "key" });
}
