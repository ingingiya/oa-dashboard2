// 시딩 발송킷 생성 — 인플루언서 아카이브(oa_inf_archive_v1)에서 후보 선정 + 발송 엑셀/후보 리스트/DM 문안
// 발송은 수동 (엑셀을 3PL/택배 주문에 사용)
// 사용:
//   node scripts/launch/seeding-kit.mjs "제품명" [--category 뷰티릴스] [--status 잠재,컨택예정] [--min-followers 5000] [--limit 30] [--launch 런칭명]
// 출력: ~/Downloads/시딩주문_<날짜>_<제품>.xlsx, 시딩후보_<제품>.md, DM문안_<제품>.md
import fs from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';
import * as XLSX from '/Users/kirby/oa-dashboard2/node_modules/xlsx/xlsx.mjs';
import { getSetting, patchStage, telegram } from './launch-lib.mjs';
XLSX.set_fs(fs);

const args = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) { flags[args[i].slice(2)] = args[i + 1]; i++; }
  else pos.push(args[i]);
}
const PRODUCT = pos[0];
if (!PRODUCT) { console.error('사용법: node seeding-kit.mjs "제품명" [--category X] [--status 잠재,컨택예정] [--min-followers N] [--limit N] [--launch 런칭명]'); process.exit(1); }
const CATEGORY = flags.category || null;
const STATUSES = (flags.status || '잠재,컨택예정,컨택중').split(',').map(s => s.trim());
const MIN_F = Number(flags['min-followers']) || 0;
const LIMIT = Number(flags.limit) || 30;
const LAUNCH = flags.launch || PRODUCT;
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

const archive = (await getSetting('oa_inf_archive_v1')) || [];
if (!Array.isArray(archive) || archive.length === 0) { console.error('인플루언서 아카이브가 비어 있음'); process.exit(1); }

const candidates = archive
  .filter(p => STATUSES.includes(p.status || '잠재'))
  .filter(p => !CATEGORY || (p.categories || []).includes(CATEGORY))
  .filter(p => (Number(p.followers) || 0) >= MIN_F)
  .sort((a, b) => (Number(b.followers) || 0) - (Number(a.followers) || 0))
  .slice(0, LIMIT);

if (candidates.length === 0) { console.error('조건에 맞는 후보 없음'); process.exit(1); }

const withAddr = candidates.filter(p => p.address);
const noAddr = candidates.filter(p => !p.address);

// ── 발송 엑셀 (컬럼 = 대시보드 exportSeedingXlsx와 동일) ──
const rows = [['주문제품', '수량', '수령인', '연락처', '우편번호', '주소']];
for (const inf of withAddr) {
  const fullAddr = [inf.address || '', inf.addressDetail || ''].filter(Boolean).join(' ');
  rows.push([PRODUCT, 1, inf.recipientName || inf.name || '', inf.phone || '', inf.postCode || '', fullAddr]);
}
const dl = resolve(homedir(), 'Downloads');
const xlsxPath = resolve(dl, `시딩주문_${today}_${PRODUCT}.xlsx`);
const ws = XLSX.utils.aoa_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, '시딩주문');
XLSX.writeFile(wb, xlsxPath);

// ── 시딩 후보 리스트 md ──
const fmtF = n => n >= 10000 ? `${(n / 10000).toFixed(1)}만` : (n || '?').toLocaleString();
const line = p => `| ${p.account || ''} | ${p.name || ''} | ${p.platform || ''} | ${fmtF(Number(p.followers) || 0)} | ${(p.categories || []).join('/')} | ${p.status || ''} | ${(p.notes || '').replace(/\n/g, ' ').slice(0, 40)} |`;
const mdPath = resolve(dl, `시딩후보_${PRODUCT}.md`);
fs.writeFileSync(mdPath, `# 시딩 후보 — ${PRODUCT} (${today})

필터: 상태 ${STATUSES.join('/')}${CATEGORY ? ` · 카테고리 ${CATEGORY}` : ''}${MIN_F ? ` · 팔로워 ${MIN_F.toLocaleString()}+` : ''} · 총 ${candidates.length}명

## 주소 확보 — 바로 발송 가능 (${withAddr.length}명)
| 계정 | 이름 | 플랫폼 | 팔로워 | 카테고리 | 상태 | 메모 |
|---|---|---|---|---|---|---|
${withAddr.map(line).join('\n')}

## 주소 없음 — DM으로 주소 요청 필요 (${noAddr.length}명)
| 계정 | 이름 | 플랫폼 | 팔로워 | 카테고리 | 상태 | 메모 |
|---|---|---|---|---|---|---|
${noAddr.map(line).join('\n')}
`);

// ── DM 문안 md (템플릿 있으면 치환, 없으면 기본) ──
const tplPath = resolve(homedir(), '.claude/skills/launch/templates/dm_template.md');
let dm;
if (fs.existsSync(tplPath)) {
  dm = fs.readFileSync(tplPath, 'utf8').replaceAll('{{제품명}}', PRODUCT).replaceAll('{{날짜}}', today);
} else {
  dm = `# DM 문안 — ${PRODUCT}\n\n안녕하세요, 오아(OA) 뷰티팀입니다 :)\n저희 신제품 "${PRODUCT}"를 체험해보시면 좋을 것 같아 연락드렸어요.\n제품 무상 제공드리고, 사용해보시고 솔직한 후기 남겨주시면 됩니다.\n괜찮으시면 받으실 성함/연락처/주소 부탁드려요!\n`;
}
const dmPath = resolve(dl, `DM문안_${PRODUCT}.md`);
fs.writeFileSync(dmPath, dm);

console.log(`후보 ${candidates.length}명 (주소 확보 ${withAddr.length} / 주소 필요 ${noAddr.length})`);
console.log(`- ${xlsxPath}`);
console.log(`- ${mdPath}`);
console.log(`- ${dmPath}`);

// ── 런칭 상태 패치 + 텔레그램 ──
try {
  await patchStage(LAUNCH, 'seeding', {
    status: '진행',
    checklist: { candidates: true, kit: true },
    artifacts: [{ label: '시딩후보', url: mdPath }, { label: '발송엑셀', url: xlsxPath }],
    set: { candidateIds: candidates.map(p => p.id) },
  });
  console.log(`런칭 "${LAUNCH}" seeding 단계 패치 완료`);
} catch (e) {
  console.log(`(런칭 상태 패치 생략: ${e.message})`);
}
await telegram(`📦 시딩킷 생성 — ${PRODUCT}\n후보 ${candidates.length}명 (발송가능 ${withAddr.length} / 주소필요 ${noAddr.length})\n~/Downloads/시딩주문_${today}_${PRODUCT}.xlsx\n발송은 수동으로 진행해주세요.`);
