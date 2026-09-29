// 카카오 선물하기 트래픽 진행 보고 → 네이버웍스 개인 발송 (텍스트 + 표 PNG)
// 사용: node scripts/kakao-progress-send.mjs [--to email] [--dry]
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, sendFileToUser, sendToUser } from './nworks-lib.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const TO = process.argv.includes('--to') ? process.argv[process.argv.indexOf('--to') + 1] : (env.KAKAO_REPORT_TO || 'kkeim@oa-world.com');
const out = JSON.parse(execFileSync('/usr/bin/python3', ['-W', 'ignore', resolve(HERE, 'kakao-progress-report.py')], { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n').pop());
if (process.argv.includes('--dry')) { console.log(out.text); console.log(out.png); process.exit(0); }
// 웍스 텍스트 길이 제한(EXCEEDED_LENGTH_LIMIT) → 빈 줄 기준 섹션을 1,800자 이하로 묶어 순차 발송
const chunks = []; let buf = '';
for (const sec of out.text.split('\n\n')) { if ((buf + '\n\n' + sec).length > 1800 && buf) { chunks.push(buf); buf = sec; } else buf = buf ? buf + '\n\n' + sec : sec; }
if (buf) chunks.push(buf);
for (const c of chunks) await sendToUser(TO, c);
const d = new Date(Date.now() + 9 * 3600e3);
await sendFileToUser(TO, out.png, `카카오진행_${d.toISOString().slice(2, 10).replace(/-/g, '')}_${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}.png`);
console.log('sent', TO);
