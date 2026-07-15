// 네이버 검색광고 캠페인 생성 — dry-run 기본, --live는 명시 승인 후에만
// 사용:
//   node scripts/launch/naver-ads-create.mjs "제품명" --keywords "키워드1,키워드2" [--budget 30000] [--bid 200] [--url 상품URL] [--launch 런칭명] [--live]
// dry-run: 페이로드 출력 + 텔레그램 요약만. --live: POST /ncc/campaigns → adgroups → keywords
// 성과 수집은 기존 sync-naver-ads 크론이 자동 담당
import { searchAdFetch, patchStage, telegram, env } from './launch-lib.mjs';

const args = process.argv.slice(2);
const flags = {}; const pos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--live') flags.live = true;
  else if (args[i].startsWith('--')) { flags[args[i].slice(2)] = args[i + 1]; i++; }
  else pos.push(args[i]);
}
const PRODUCT = pos[0];
const KEYWORDS = (flags.keywords || '').split(',').map(s => s.trim()).filter(Boolean);
if (!PRODUCT || KEYWORDS.length === 0) {
  console.error('사용법: node naver-ads-create.mjs "제품명" --keywords "키워드1,키워드2" [--budget 30000] [--bid 200] [--url URL] [--launch 런칭명] [--live]');
  process.exit(1);
}
const BUDGET = Number(flags.budget) || 30000; // 일예산
const BID = Number(flags.bid) || 200;          // 기본 입찰가
const LAUNCH = flags.launch || PRODUCT;
const LIVE = !!flags.live;
const CUSTOMER_ID = Number(env.NAVER_CUSTOMER_ID);

const campaignPayload = {
  campaignTp: 'WEB_SITE',
  name: `런칭_${PRODUCT}_${new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)}`,
  customerId: CUSTOMER_ID,
  dailyBudget: BUDGET,
  useDailyBudget: true,
};
const adgroupPayload = (nccCampaignId, channelId) => ({
  nccCampaignId,
  customerId: CUSTOMER_ID,
  adgroupType: 'WEB_SITE', // 3734 Invalid type of ad group — 캠페인 유형과 일치 필요
  name: `${PRODUCT}_기본그룹`,
  bidAmt: BID,
  useGroupBidAmt: true,
  dailyBudget: BUDGET,
  useDailyBudget: true,
  pcChannelId: channelId,     // 비즈채널 필수 (3604 Invalid Biz Channel) — /ncc/channels의 nccBusinessChannelId
  mobileChannelId: channelId,
});

// 비즈채널 선택: --channel <nccBusinessChannelId> 또는 자동 (SITE·ELIGIBLE, --url/스마트스토어 우선)
async function pickChannel() {
  if (flags.channel) return { nccBusinessChannelId: flags.channel, name: '(수동 지정)' };
  const channels = (await searchAdFetch('GET', '/ncc/channels'))
    .filter(c => c.channelTp === 'SITE' && c.status === 'ELIGIBLE' && c.enabled && !c.delFlag);
  if (channels.length === 0) throw new Error('사용 가능한 SITE 비즈채널 없음 — searchad 콘솔에서 등록 필요');
  const byUrl = flags.url && channels.find(c => flags.url.includes(new URL(c.channelKey).hostname));
  return byUrl || channels.find(c => (c.channelKey || '').includes('smartstore')) || channels[0];
}
const keywordPayloads = (nccAdgroupId) => KEYWORDS.map(k => ({ nccAdgroupId, keyword: k.replace(/\s/g, ''), customerId: CUSTOMER_ID }));

console.log(`── 네이버 검색광고 ${LIVE ? 'LIVE 생성' : 'DRY-RUN'} ──`);
console.log('캠페인:', JSON.stringify(campaignPayload, null, 2));
console.log('광고그룹(템플릿):', JSON.stringify(adgroupPayload('<campaignId>', flags.channel || '<자동 선택>'), null, 2));
console.log(`키워드 ${KEYWORDS.length}개:`, KEYWORDS.join(', '));

if (!LIVE) {
  await telegram(`🧪 네이버광고 dry-run — ${PRODUCT}\n캠페인: ${campaignPayload.name}\n일예산 ${BUDGET.toLocaleString()}원 · 기본입찰 ${BID}원\n키워드 ${KEYWORDS.length}개: ${KEYWORDS.slice(0, 8).join(', ')}${KEYWORDS.length > 8 ? '…' : ''}\n\n생성하려면 --live로 재실행 (승인 필요)`);
  try {
    await patchStage(LAUNCH, 'ads', { status: '진행', checklist: { keywords: true, dryrun: true } });
  } catch (e) { console.log(`(런칭 상태 패치 생략: ${e.message})`); }
  console.log('\ndry-run 완료 — 실제 생성하려면 --live 추가 (사용자 승인 후)');
  process.exit(0);
}

// ── LIVE ──
try {
  const channel = await pickChannel();
  console.log('비즈채널:', channel.nccBusinessChannelId, channel.name || channel.channelKey || '');

  // --campaign-id 지정 시 캠페인 생성 생략 (재시도용)
  const camp = flags['campaign-id']
    ? { nccCampaignId: flags['campaign-id'] }
    : await searchAdFetch('POST', '/ncc/campaigns', { body: campaignPayload });
  console.log('캠페인:', camp.nccCampaignId, flags['campaign-id'] ? '(기존 재사용)' : '(생성)');

  const group = await searchAdFetch('POST', '/ncc/adgroups', { body: adgroupPayload(camp.nccCampaignId, channel.nccBusinessChannelId) });
  console.log('광고그룹 생성:', group.nccAdgroupId);

  const kws = await searchAdFetch('POST', `/ncc/keywords`, { query: { nccAdgroupId: group.nccAdgroupId }, body: keywordPayloads(group.nccAdgroupId) });
  const okKws = Array.isArray(kws) ? kws.length : 0;
  console.log(`키워드 등록: ${okKws}개`);

  await patchStage(LAUNCH, 'ads', {
    status: '진행',
    checklist: { keywords: true, dryrun: true, live: true },
    set: { campaignId: camp.nccCampaignId },
    artifacts: [{ label: '캠페인', url: `https://searchad.naver.com` }],
  }).catch(e => console.log(`(런칭 상태 패치 생략: ${e.message})`));

  await telegram(`✅ 네이버광고 캠페인 생성 — ${PRODUCT}\n${campaignPayload.name}\ncampaignId: ${camp.nccCampaignId}\n키워드 ${okKws}개 · 일예산 ${BUDGET.toLocaleString()}원\nsearchad 콘솔에서 비즈채널/소재 연결 확인 필요`);
} catch (e) {
  console.error('생성 실패:', e.message);
  await telegram(`❌ 네이버광고 생성 실패 — ${PRODUCT}\n${e.message.slice(0, 500)}`);
  await patchStage(LAUNCH, 'ads', { status: '차단' }).catch(() => {});
  process.exit(1);
}
