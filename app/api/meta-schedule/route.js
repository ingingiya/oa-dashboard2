export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const META_API = 'https://graph.facebook.com/v21.0';
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sH = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json' };

// 캠페인 목록 조회
async function listCampaigns() {
  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  const res = await fetch(`${META_API}/${accountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=50&access_token=${token}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.data || [];
}

// 광고세트 목록 조회
async function listAdsets(campaignId) {
  const token = process.env.META_ACCESS_TOKEN;
  const res = await fetch(`${META_API}/${campaignId}/adsets?fields=id,name,status,daily_budget&limit=50&access_token=${token}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.data || [];
}

// 캠페인/광고세트 상태 변경
async function updateStatus(id, status) {
  const token = process.env.META_ACCESS_TOKEN;
  const res = await fetch(`${META_API}/${id}?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }), // ACTIVE or PAUSED
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`상태 변경 실패 (${id}): ${err}`);
  }
  return res.json();
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  try {
    if (action === 'campaigns') {
      const campaigns = await listCampaigns();
      return Response.json({ ok: true, campaigns });
    }

    if (action === 'adsets') {
      const campaignId = searchParams.get('campaignId');
      if (!campaignId) return Response.json({ error: 'campaignId 필요' }, { status: 400 });
      const adsets = await listAdsets(campaignId);
      return Response.json({ ok: true, adsets });
    }

    // 크론: 스케줄 체크 후 자동 on/off
    if (action === 'cron') {
      const secret = searchParams.get('secret');
      if (secret !== process.env.ERP_SYNC_SECRET && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
      }

      // Supabase에서 스케줄 로드
      const schRes = await fetch(`${SUPA_URL}/rest/v1/settings?key=eq.meta_schedules&select=value`, { headers: sH });
      const schData = await schRes.json();
      const schedules = schData?.[0]?.value || [];

      const now = new Date();
      const kstNow = new Date(now.getTime() + 9 * 3600000);
      const nowStr = kstNow.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM

      const results = [];
      const updated = [];

      for (const sch of schedules) {
        if (sch.executed) { updated.push(sch); continue; }

        const schTime = sch.datetime; // YYYY-MM-DDTHH:MM
        if (schTime <= nowStr) {
          try {
            await updateStatus(sch.targetId, sch.action === 'on' ? 'ACTIVE' : 'PAUSED');
            results.push({ id: sch.id, targetId: sch.targetId, action: sch.action, success: true });
            updated.push({ ...sch, executed: true, executedAt: now.toISOString() });
          } catch (e) {
            results.push({ id: sch.id, targetId: sch.targetId, action: sch.action, success: false, error: e.message });
            updated.push(sch);
          }
        } else {
          updated.push(sch);
        }
      }

      // 실행된 스케줄 업데이트
      if (results.length) {
        await fetch(`${SUPA_URL}/rest/v1/settings`, {
          method: 'POST',
          headers: { ...sH, Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({ key: 'meta_schedules', value: updated, updated_at: now.toISOString() }),
        });
      }

      return Response.json({ ok: true, executed: results.length, results });
    }

    return Response.json({ error: 'action 필요 (campaigns|adsets|cron)' }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// 수동 on/off + 스케줄 저장
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, targetId, targetName, datetime, schedules } = body;

    // 즉시 on/off
    if (action === 'on' || action === 'off') {
      if (!targetId) return Response.json({ error: 'targetId 필요' }, { status: 400 });
      const result = await updateStatus(targetId, action === 'on' ? 'ACTIVE' : 'PAUSED');
      return Response.json({ ok: true, result });
    }

    // 스케줄 저장
    if (action === 'save_schedules') {
      await fetch(`${SUPA_URL}/rest/v1/settings`, {
        method: 'POST',
        headers: { ...sH, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ key: 'meta_schedules', value: schedules || [], updated_at: new Date().toISOString() }),
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'action 필요' }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
