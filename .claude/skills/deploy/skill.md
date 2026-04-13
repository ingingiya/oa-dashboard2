---
name: deploy
description: "OA 대시보드2를 Vercel에 배포. '배포해줘', '올려줘', 'git push', '반영해줘' 요청 시 반드시 이 스킬 사용. git add → commit → push 전체 자동 처리."
---

# Deploy — Vercel 자동 배포

## 실행 절차

1. `git status` — 변경 파일 확인
2. 변경 없으면 "배포할 내용 없음" 안내
3. 변경 있으면:
   ```bash
   git add -A
   git commit -m "{변경 내용 한줄 요약}"
   git push
   ```
4. Supabase 스키마 변경(새 컬럼/테이블)이 있으면 SQL 제공

## Supabase SQL 패턴
```sql
-- 컬럼 추가
ALTER TABLE 테이블명 ADD COLUMN IF NOT EXISTS 컬럼명 text DEFAULT '';

-- RLS 정책 (신규 테이블)
ALTER TABLE 테이블명 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON 테이블명 FOR ALL USING (true);
```

## 주의
- 커밋 메시지는 한국어로 간결하게
- 배포 후 Vercel 빌드 약 1분 소요
