/** 오아대시보드 메타 시트 자동입력 수신용 Apps Script.
 *
 * 설치 (1회):
 * 1. 광고 시트(1r9WhAOgvdIcumgrkNkTbyYSVj1ONxyXp0trwzD-xAng) 열기
 * 2. 확장 프로그램 > Apps Script > 이 코드 전체 붙여넣기
 * 3. 배포 > 새 배포 > 유형: 웹 앱 / 실행: 나 / 액세스: 모든 사용자 → 배포
 * 4. 웹 앱 URL 복사 → ~/oa-dashboard2/.env.local 에 추가:
 *      SHEET_WEBAPP_URL=<복사한 URL>
 *
 * 동작: meta-sheet-sync.py가 POST {secret, dates, rows} 전송 →
 * 같은 날짜(E열 '일') 기존 행 삭제 후 새 행 추가 (재실행 안전).
 */
const SHEET_ID = "1r9WhAOgvdIcumgrkNkTbyYSVj1ONxyXp0trwzD-xAng";
const GID = 1293104038;
const SECRET = "oa-meta-sync";

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(60000);
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return out({ ok: false, error: "bad secret" });
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sh = ss.getSheets().filter(s => s.getSheetId() === GID)[0];
    if (!sh) return out({ ok: false, error: "sheet(gid) not found" });

    const dates = {};
    (body.dates || []).forEach(d => dates[d] = true);
    const data = sh.getDataRange().getValues();
    const header = data[0];
    const DI = 4; // E열 = "일"
    const keep = [header];
    for (let i = 1; i < data.length; i++) {
      const d = data[i][DI];
      const ds = d instanceof Date
        ? Utilities.formatDate(d, "Asia/Seoul", "yyyy-MM-dd")
        : String(d).slice(0, 10);
      if (!dates[ds]) keep.push(data[i]);
    }
    const width = header.length;
    const rows = (body.rows || []).map(r => {
      const c = r.slice(0, width);
      while (c.length < width) c.push("");
      return c;
    });
    const all = keep.concat(rows);
    sh.clearContents();
    sh.getRange(1, 1, all.length, width).setValues(all);
    return out({ ok: true, removed: data.length - keep.length, added: rows.length, total: all.length - 1 });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
