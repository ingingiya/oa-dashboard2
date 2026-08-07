// app/api/detail/credits/route.ts
// 팀별 크레딧 — 로그인(팀+PIN), 지급(관리자 PIN), 생성 시 차감, 사용량 랭킹
// KV: oa_detail_credits_v1 = { adminPin, teams:[{id,name,pin,granted,used}], ledger:[{at,teamId,team,action,cost}] }

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const KEY = "oa_detail_credits_v1";
const DEFAULT_ADMIN_PIN = "8807";
const ADMIN_ID = "__admin__";

type Team = { id: string; name: string; pin: string; granted: number; used: number };
type Ledger = { at: string; teamId: string; team: string; action: string; cost: number };
type Store = { adminPin: string; teams: Team[]; ledger: Ledger[] };

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

async function load(sb: ReturnType<typeof getSupabase>): Promise<Store> {
  const { data } = await sb.from("settings").select("value").eq("key", KEY).maybeSingle();
  const v = data?.value || {};
  return { adminPin: v.adminPin || DEFAULT_ADMIN_PIN, teams: v.teams || [], ledger: v.ledger || [] };
}

async function save(sb: ReturnType<typeof getSupabase>, store: Store) {
  store.ledger = store.ledger.slice(0, 500);
  await sb.from("settings").upsert({ key: KEY, value: store }, { onConflict: "key" });
}

// PIN 제거한 공개 뷰
const pub = (s: Store) => ({
  teams: s.teams
    .map(({ pin, ...t }) => ({ ...t, balance: t.granted - t.used }))
    .sort((a, b) => b.used - a.used),
  ledger: s.ledger.slice(0, 50),
});

export async function GET() {
  try {
    const s = await load(getSupabase());
    return NextResponse.json({ ok: true, ...pub(s) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sb = getSupabase();
    const s = await load(sb);

    if (body.login) {
      const { name, pin } = body.login;
      // 관리자 PIN이면 무한 크레딧 관리자로 로그인
      if (String(pin) === s.adminPin)
        return NextResponse.json({ ok: true, team: { id: ADMIN_ID, name: "관리자", balance: "∞" } });
      const t = s.teams.find((x) => x.name === name || x.id === name);
      if (!t || t.pin !== String(pin)) throw new Error("팀 이름 또는 PIN이 틀렸어요");
      return NextResponse.json({ ok: true, team: { id: t.id, name: t.name, balance: t.granted - t.used } });
    }

    if (body.addTeam) {
      const { name, pin, adminPin } = body.addTeam;
      if (String(adminPin) !== s.adminPin) throw new Error("관리자 PIN이 틀렸어요");
      if (!name?.trim() || !String(pin || "").trim()) throw new Error("팀 이름과 PIN을 입력하세요");
      if (s.teams.some((t) => t.name === name.trim())) throw new Error("이미 있는 팀 이름이에요");
      s.teams.push({
        id: Date.now().toString(36),
        name: name.trim(),
        pin: String(pin).trim(),
        granted: 0,
        used: 0,
      });
      await save(sb, s);
      return NextResponse.json({ ok: true, ...pub(s) });
    }

    if (body.grant) {
      const { id, amount, adminPin } = body.grant;
      if (String(adminPin) !== s.adminPin) throw new Error("관리자 PIN이 틀렸어요");
      const t = s.teams.find((x) => x.id === id);
      if (!t) throw new Error("팀 없음");
      const amt = Math.round(Number(amount));
      if (!amt) throw new Error("지급 수량을 입력하세요");
      t.granted += amt;
      s.ledger.unshift({ at: new Date().toISOString(), teamId: t.id, team: t.name, action: `크레딧 ${amt > 0 ? "지급" : "회수"}`, cost: -amt });
      await save(sb, s);
      return NextResponse.json({ ok: true, ...pub(s) });
    }

    if (body.spend) {
      const { id, action, cost } = body.spend;
      if (id === ADMIN_ID) {
        // 관리자는 무한 — 차감 없이 원장에만 기록
        s.ledger.unshift({ at: new Date().toISOString(), teamId: ADMIN_ID, team: "관리자", action: String(action || "사용"), cost: 0 });
        await save(sb, s);
        return NextResponse.json({ ok: true, balance: "∞" });
      }
      const t = s.teams.find((x) => x.id === id);
      if (!t) throw new Error("팀 로그인이 풀렸어요 — 크레딧 탭에서 다시 로그인해주세요");
      const c = Math.max(1, Math.round(Number(cost) || 1));
      if (t.granted - t.used < c)
        throw new Error(`크레딧 부족 — 잔액 ${t.granted - t.used}, 필요 ${c}. 관리자에게 지급을 요청하세요`);
      t.used += c;
      s.ledger.unshift({ at: new Date().toISOString(), teamId: t.id, team: t.name, action: String(action || "사용"), cost: c });
      await save(sb, s);
      return NextResponse.json({ ok: true, balance: t.granted - t.used });
    }

    if (body.setAdminPin) {
      const { current, next } = body.setAdminPin;
      if (String(current) !== s.adminPin) throw new Error("현재 관리자 PIN이 틀렸어요");
      if (!String(next || "").trim()) throw new Error("새 PIN을 입력하세요");
      s.adminPin = String(next).trim();
      await save(sb, s);
      return NextResponse.json({ ok: true });
    }

    throw new Error("지원하지 않는 요청");
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
