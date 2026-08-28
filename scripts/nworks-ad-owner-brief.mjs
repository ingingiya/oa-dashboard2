// 👤 담당자 아침 브리핑 — /ads 광고상사 담당 캠페인 성과를 네이버웍스 개인 DM으로
// 담당자 지정은 /ads 부서 헤더의 "담당" 배지 (settings KV oa_ad_owners_v1)
// 사용법:
//   node scripts/nworks-ad-owner-brief.mjs --dry-run   # 발송 없이 미리보기
//   node scripts/nworks-ad-owner-brief.mjs             # 담당자별 웍스 DM 발송
import { MEMBER_EMAIL, sendToUser, telegram, kst } from './nworks-lib.mjs';

const DRY = process.argv.includes('--dry-run');
const URL = 'https://oa-dashboard2.vercel.app/api/ad-console';
const w = (n) => `₩${Math.round(n || 0).toLocaleString()}`;
const md = (d) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;

async function main() {
  const j = await (await fetch(URL)).json();
  if (!j.campaigns?.length) throw new Error(`콘솔 데이터 없음: ${j.error || j.metaDownReason || '캠페인 0'}`);
  const owners = j.owners || {};
  if (!Object.keys(owners).length) { console.log('담당자 지정 없음 — 발송 생략'); return; }

  // 담당자별로 캠페인 묶기
  const byOwner = {};
  for (const c of j.campaigns) {
    const nm = owners[c.id];
    if (nm) (byOwner[nm] = byOwner[nm] || []).push(c);
  }

  for (const [nm, camps] of Object.entries(byOwner)) {
    const lines = [`☀️ ${nm}님, 담당 광고 아침 브리핑 (${md(kst(0))})`];
    let alerts = 0;
    for (const c of camps) {
      const act = (c.adsets || []).filter((s) => s.status === 'ACTIVE' && (s.spend7 || 0) > 0)
        .sort((a, b) => (b.spend7 || 0) - (a.spend7 || 0));
      if (!act.length) continue;
      const spend = act.reduce((a, s) => a + (s.spend7 || 0), 0);
      const buy = act.reduce((a, s) => a + (s.purchases7 || 0), 0);
      const cpa = buy ? Math.round(spend / buy) : null;
      lines.push('', `🚪 ${c.name} — 7일 ${w(spend)} · 구매 ${buy}${cpa ? ` · CPA ${w(cpa)}` : ''} (목표 ${w(c.target)})`);
      // judge: scale=증액 추천(좋음) / watch=관찰 / kill=중지 검토(나쁨)
      const JUDGE = { scale: ['🚀', '증액 추천'], watch: ['👀', '유지관찰'], kill: ['🚨', '중지 검토'] };
      for (const s of act.slice(0, 5)) {
        const [ico, label] = JUDGE[s.judge] || [];
        if (s.judge === 'kill' || s.judge === 'watch') alerts++;
        lines.push(`${ico || '·'} ${s.name} — ${w(s.spend7)} · 구매 ${s.purchases7 || 0}` +
          `${s.cpa7 ? ` · CPA ${w(s.cpa7)}` : ' · CPA 없음'}${label ? ` → ${label}` : ''}`);
      }
      if (act.length > 5) lines.push(`· 외 ${act.length - 5}명 근무 중`);
    }
    lines.push('', alerts ? `⚠️ 요주의 ${alerts}건 — 콘솔에서 결재 부탁드려요` : '✅ 요주의 없음 — 오늘도 순항 중',
      '👉 oa-dashboard2.vercel.app/ads');
    const msg = lines.join('\n');

    console.log(`──── ${nm} ────\n${msg}\n`);
    if (DRY) continue;
    const email = MEMBER_EMAIL[nm];
    if (!email) { console.log(`(${nm} — 웍스 계정 매핑 없음, 발송 생략)`); continue; }
    await sendToUser(email, msg);
    console.log(`발송 완료 → ${nm} (${email})`);
  }
  if (DRY) console.log('(dry-run — 발송 안 함)');
}

main().catch(async (e) => {
  console.error('nworks-ad-owner-brief 실패:', e.message || e);
  await telegram(`⚠️ 광고 담당자 아침 브리핑 실패: ${String(e.message || e).slice(0, 200)}`);
  process.exit(1);
});
