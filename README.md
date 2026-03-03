# 🌸 OA HQ — Marketing Dashboard

## 로컬 실행 (VSCode)

```bash
# 1. 터미널 열고
npm install

# 2. 개발 서버 시작
npm run dev

# 3. 브라우저에서 열기
http://localhost:3000
```

---

## GitHub + Vercel 배포

### GitHub에 올리기
```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/[내아이디]/oa-dashboard2.git
git push -u origin main
```

### Vercel 배포
1. [vercel.com](https://vercel.com) → GitHub 로그인
2. `Add New Project` → `oa-dashboard2` 선택
3. 설정 그대로 → **Deploy**
4. 완료! `oa-dashboard2.vercel.app` 🎉

---

## 구글 시트 연결 (메타광고)

1. 메타 광고관리자 → 보고서 → CSV 다운로드
2. 구글 시트 새로 만들고 A1에 붙여넣기
3. 공유 → "링크가 있는 모든 사용자" → 뷰어
4. 대시보드 메타광고 탭 → "🔗 시트 연결" → URL 입력

---

## 파일 구조

```
oa-dashboard2/
├── app/
│   ├── layout.jsx      # HTML 루트
│   └── page.jsx        # 메인 페이지
├── components/
│   └── Dashboard.jsx   # 대시보드 전체 (여기서 수정)
├── package.json
└── next.config.js
```
