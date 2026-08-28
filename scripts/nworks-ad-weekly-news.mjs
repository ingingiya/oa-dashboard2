// 📰 주간 광고상사 신문 — /api/ad-weekly가 발행한 신문을 네이버웍스 채널에 게재
// 크론: 월요일 아침. 콘솔 캐시 갱신(ad-console GET) 후 신문 강제 재발행(fresh=1)
// 사용법: node scripts/nworks-ad-weekly-news.mjs [--dry-run]
import { sendToChannel, telegram } from './nworks-lib.mjs';

const DRY = process.argv.includes('--dry-run');
const BASE = 'https://oa-dashboard2.vercel.app';

async function main() {
  // 1) 콘솔 캐시 갱신 — 신문 재료(oa_ad_console_cache_v1)를 최신으로
  const c = await (await fetch(`${BASE}/api/ad-console`)).json();
  if (!c.campaigns?.length) throw new Error(`콘솔 데이터 없음: ${c.error || c.metaDownReason || ''}`);
  // 2) 신문 발행 (Claude가 회사 놀이 세계관으로 작성)
  const n = await (await fetch(`${BASE}/api/ad-weekly?fresh=1`)).json();
  if (n.error) throw new Error(`신문 발행 실패: ${n.error}`);

  const msg = [
    `📰 주간 광고상사 — ${n.week}주 호외`,
    ``,
    `【${n.headline}】`,
    n.lede,
    ``,
    `🏅 이주의 우수사원`,
    n.best,
    ``,
    `😓 반성문`,
    n.worst,
    ``,
    `🖊 결재 평가${n.winRate != null ? ` (승률 ${n.winRate}%)` : ''}`,
    n.decision,
    ``,
    `📋 다음 주 경영 방침`,
    n.strategy,
    ``,
    `💬 사장 어록: "${n.quote}"`,
    ``,
    `👉 oa-dashboard2.vercel.app/ads`,
  ].join('\n');

  console.log('──── 미리보기 ────\n' + msg + '\n─────────────────');
  if (DRY) { console.log('(dry-run — 발송 안 함)'); return; }
  await sendToChannel(msg);
  console.log('채널 발행 완료');
}

main().catch(async (e) => {
  console.error('nworks-ad-weekly-news 실패:', e.message || e);
  await telegram(`⚠️ 주간 광고상사 신문 발행 실패: ${String(e.message || e).slice(0, 200)}`);
  process.exit(1);
});
