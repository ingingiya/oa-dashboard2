# OA HQ 마케팅 대시보드 — 개발 가이드

## 개요
오아(OA) 뷰티팀 통합 마케팅 대시보드. 메타광고, 네이버광고, 인플루언서, 프로젝트, 재고, 매출 데이터를 한 곳에서 관리.

- **프레임워크**: Next.js 14.2 (App Router)
- **UI**: 단일 컴포넌트 (`components/Dashboard.jsx`, ~17,000줄)
- **DB**: Supabase (PostgreSQL) + MySQL (ERP 원본)
- **AI**: Claude API (가설 생성, 상세기획안)
- **광고 API**: Meta Marketing API, 네이버 검색광고 API
- **배포**: Vercel (Git 자동 배포)
- **URL**: https://oa-dashboard2.vercel.app

---

## 아키텍처

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   MySQL      │────▶│   Supabase   │────▶│  Dashboard   │
│   (ERP)      │cron │  (동기화DB)   │ API  │  (Next.js)   │
└──────────────┘     └──────────────┘     └──────────────┘
                           ▲                     │
                     ┌─────┴─────┐          ┌────┴────┐
                     │ Meta API  │          │ Claude  │
                     │ Naver API │          │   API   │
                     └───────────┘          └─────────┘
```

### 데이터 흐름
1. **MySQL (ERP)** → Vercel Cron → **Supabase** (매일 자동 동기화)
2. **Supabase** → Dashboard 프론트엔드 (REST API)
3. **Meta/Naver API** → Supabase (광고 데이터)
4. **Claude API** → 가설 생성, 상세기획안, 인사이트

---

## 프로젝트 구조

```
oa-dashboard2/
├── app/
│   ├── layout.jsx              # 루트 레이아웃
│   ├── page.jsx                # 메인 페이지 (로그인)
│   ├── meta/page.jsx           # OG 이미지
│   └── api/                    # 45개 API 라우트
│       ├── sync-products/      # 프로젝트 판매 + 검색순위 동기화
│       ├── sync-beauty/        # 이미용 매출/재고/입고 동기화
│       ├── sync-ads/           # 광고비 + 프로모션 동기화
│       ├── sync-naver-ads/     # 네이버 검색광고 API 수집
│       ├── meta-schedule/      # 메타 광고 ON/OFF + 예산 + 스케줄
│       ├── hypothesis/         # AI 가설 생성 (Claude)
│       ├── detail-plan/        # 상세기획안 AI 생성 (스트리밍)
│       ├── erp-query/          # ERP 데이터 조회 (Supabase RPC)
│       ├── weekly-report/      # 주간 리포트 (텔레그램)
│       ├── daily-alert/        # 일일 알림
│       ├── monthly-review/     # 월간 리뷰
│       ├── figma-export/       # 피그마 코멘트 전송
│       └── ... (45개)
├── components/
│   └── Dashboard.jsx           # 메인 대시보드 (17,000줄)
├── lib/
│   ├── useSupabase.js          # Supabase 클라이언트
│   └── mysql.js                # MySQL 연결
├── scripts/
│   ├── sync-all-products.js    # 전체 제품 동기화
│   ├── sync-beauty.js          # 이미용 동기화
│   ├── sync-search-rankings.js # 검색순위 동기화
│   ├── sync-ads-promo.js       # 광고/프로모션 동기화
│   └── copy-bank.py            # 카피뱅크 생성
├── vercel.json                 # 크론 설정 (9개)
└── public/
```

---

## 대시보드 섹션 (14개 탭)

### 🏠 홈 (home)
메인 섹션. 한눈에 현황 파악.

| 카드 | 데이터 소스 | 설명 |
|------|------------|------|
| 전날 광고비 | 메타 시트 | 전환/트래픽 구분 |
| 매출 요약 | beauty_sales | 오늘/이번주/이번달 |
| 광고비 소진 | ad_campaigns | 이번달 네이버 이미용 |
| 재고 부족 | beauty_stock | 30개 이하 제품 |
| AI 인사이트 | hypotheses | 최신 분석 3개 |
| 검색순위 변동 | search_rankings | 3위 이상 변동 키워드 |
| 빠른 링크 | settings (Supabase) | 채널/ERP 바로가기 |
| 알림 그룹 | 메타 데이터 | 광고 끄기/보류/일정 |

### 📊 메타광고 (meta)
메타(Facebook/Instagram) 광고 성과 분석 + 관리.

**서브탭 (10개):**
| 탭 | 기능 |
|----|------|
| 추이 | 일별 광고비/ROAS 차트 |
| 캠페인 | 전환/트래픽 캠페인별 성과 |
| 주별 | 주간 비교 |
| 월별 | 월간 트렌드 |
| 일별 | 날짜별 상세 (캠페인 펼치기) |
| 제품별 | 제품별 광고 성과 |
| 행사 | 프로모션 등록 + 기간 성과 비교 + 제품 매칭 |
| 카피뱅크 | 망설임 TOP + AI 카피 변환 |
| 가이드 | 소구 유형별 ROAS + AI 소재 브리프 |
| **광고 스케줄** | 캠페인 ON/OFF + 예산 변경 + 예약 |

**광고 스케줄 상세:**
```
캠페인 트리 (이미용 필터)
├── 캠페인 → 토글 ON/OFF + 예산 표시
│   ├── 광고세트 → 토글 + 썸네일
│   │   └── 광고 → 토글 + 썸네일 (호버 프리뷰)
│   └── ...
│
스케줄 3타입:
├── 1회 예약: 날짜+시간 → 켜기/끄기/예산변경
├── 요일 반복: 월~일 선택 → 4주 자동 생성
└── 행사 연동: 프로모션 선택 → D-1 예산/시작 ON/종료 복구
    └── 캠페인 > 광고세트 > 광고 드릴다운 선택
    └── 현재 예산 표시 + 행사 전/중/후 예산

실행: 대시보드 열려있으면 1분마다 체크 → 자동 실행 → 텔레그램 알림
```

### 🔍 네이버광고 (naver)
네이버 검색광고 성과 (이미용만).

- **데이터**: 네이버 검색광고 API → Supabase `ad_campaigns`
- **ROAS**: 네이버 전환 대신 **실제 판매 데이터(beauty_sales)** 사용
- **뷰**: 캠페인별 / 광고그룹별 / 키워드별 / 날짜별
- **기간**: 7/14/30/90일 선택
- **수정 체크**: 광고 수정 필요 항목 관리

### ✨ 인플루언서 (influencer)
인플루언서 관리 + 시딩 + 인스타/트위터 성과.

- 인플루언서 DB
- 시딩 관리
- 인스타/트위터 월별 성과
- 인플루언서 미팅 기록

### 📂 인플루언서 아카이브
인플루언서 DB (잠재 → 컨택 → 협업).

- 상태별 필터 (잠재/컨택예정/컨택중/협업완료/보류)
- 담당자별 필터
- **전체 선택 + 엑셀 다운로드**
- 시딩 엑셀 출력
- 월별 업로드 일정

### 📅 스케줄 (schedule)
Notion 연동 일정 관리.

### 🎨 소재 (creative)
광고 소재 라이브러리 + 재제작 요청.

- 소재 갤러리 (메타 데이터 연동)
- 재제작 요청 → **피그마 코멘트 자동 전송** + 텔레그램 알림
- 소재별 성과 TOP

### 📝 상세기획 (detailplan)
상세페이지 기획안 AI 자동 생성.

- **기획안 생성**: 제품 정보 입력 → Claude가 30슬라이드 기획안 (스트리밍)
- **경쟁사 분석**: 후킹카피 + 차별화 포인트 + 비교표 추천
- **슬라이드 뷰어**: 좌우 네비게이션 + 썸네일 + PDF 저장
- **피그마 전송**: 코멘트로 기획안 전송
- **히스토리**: Supabase 저장

### 📂 프로젝트 (projects)
프로젝트 관리 (칸반 스타일).

- 카드형 목록 (상태/우선순위/D-day)
- 4탭: 개요 / 할일 / 제품 / 데이터
- 매출 차트 (Recharts)
- 매출처 TOP 5
- 검색순위 자동 로드
- 코멘트
- 시작 전/후 비교

### 🔬 가설 (hypothesis)
AI 자동 판매 가설 생성.

- 매일 자동 생성 (Claude + 판매 데이터)
- 원인분석 / 마케팅액션
- 검증됨 / 기각 / 실행함
- 담당자 지정 + 메모
- **삭제 기능**

### 📝 팀 노트 (insight)
팀 공유 노트.

### 🔍 키워드 (keyword)
키워드 트래킹 + 시장조사.

- 네이버 검색량 조회 (API)
- 경쟁사 가격 비교 (네이버/올리브영/무신사/지그재그/에이블리/카카오)
- 자동 크롤링

### 📊 ERP (erp)
이미용 판매 데이터 (Supabase beauty_agg RPC).

- 기간별 매출/수량/이익
- 카테고리별 분석
- 전년 대비

### 🛒 쿠팡 (coupang)
쿠팡 가격 모니터링.

---

## 데이터베이스 (Supabase 테이블)

| 테이블 | 용도 | 동기화 |
|--------|------|--------|
| `project_product_data` | 프로젝트 제품별 일별 판매 | 매일 09:07 |
| `search_rankings` | 검색순위 | 매일 09:07 |
| `beauty_sales` | 이미용 매출 | 매일 09:12 |
| `beauty_stock` | 이미용 재고 | 매일 09:12 |
| `beauty_incoming` | 이미용 입고 | 매일 09:12 |
| `ad_campaigns` | 네이버+메타 광고비 | 매일 09:17, 09:22 |
| `promotions` | 프로모션 일정 | 매일 09:17 |
| `projects` | 프로젝트 관리 | 실시간 |
| `daily_hypotheses` | AI 가설 | 매일 09:10 |
| `settings` | 앱 설정 (JSON) | 실시간 |
| `naver_ads_cache` | 네이버 광고 CSV 캐시 | 수동 |
| `naver_ads_fixlist` | 수정 체크 목록 | 실시간 |

### MySQL 원본 테이블 (db_for_ai_sm)
| 테이블 | 용도 |
|--------|------|
| `v_daily_sales_detail` | 일별 판매 상세 (판매날짜, 매출처명, 제품명, 판매수량, 총매출액, 총매출이익) |
| `v_stock_status` | 재고 현황 |
| `v_purchase_schedule_detail` | 입고 예정 |
| `v_analyze_search_ranking` | 검색순위 |
| `ad_daily_campaign` | 네이버 광고 캠페인별 일별 |
| `v_sales_promotion_schedule` | 프로모션 일정 |
| `v_sales_promotion_schedule_merchandise` | 프로모션별 상품 |

---

## 자동화 크론 (Vercel Cron — 매일 KST 기준)

| 시간 | API | 기능 |
|------|-----|------|
| 09:07 | sync-products | 프로젝트 판매 + 검색순위 (MySQL→Supabase) |
| 09:12 | sync-beauty | 이미용 매출/재고/입고 (MySQL→Supabase) |
| 09:17 | sync-ads | 광고비+프로모션 (MySQL→Supabase) |
| 09:22 | sync-naver-ads | 네이버 광고 API → Supabase |
| 09:10 | hypothesis | AI 가설 자동 생성 (Claude) |
| 09:00 | meta-schedule | 메타 광고 스케줄 체크 → 자동 ON/OFF |
| 일 08:30 | weekly-report | 주간 리포트 텔레그램 발송 |
| 매일 08:40 | daily-alert | 일일 알림 |
| 매월 1일 10:00 | monthly-review | 월간 리뷰 |

---

## 환경 변수 (Vercel)

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 키 |
| `MYSQL_HOST/PORT/USER/PASS/DB` | MySQL 연결 |
| `META_ACCESS_TOKEN` | Meta Marketing API |
| `META_AD_ACCOUNT_ID` | Meta 광고 계정 |
| `NAVER_API_KEY/SECRET_KEY/CUSTOMER_ID` | 네이버 검색광고 API |
| `ANTHROPIC_API_KEY` | Claude API |
| `FIGMA_TOKEN` | Figma REST API |
| `TELEGRAM_BOT_TOKEN/CHAT_ID` | 텔레그램 알림 |
| `ERP_SYNC_SECRET` | 크론 인증 |
| `TEAM_PASSWORD` | 대시보드 로그인 |

---

## 주요 컴포넌트 구조 (Dashboard.jsx)

```
Dashboard.jsx (17,000줄)
├── 유틸리티 함수/훅
│   ├── useSupabaseState() — Supabase 동기화 훅
│   ├── useSyncState() — 팀 공유 상태
│   ├── NaverReviewSection — 네이버 리뷰 분석
│   └── 기타 헬퍼
│
├── 독립 컴포넌트 (function 선언)
│   ├── AdSchedulePanel — 메타 광고 스케줄 ON/OFF
│   ├── NaverSection — 네이버 광고 탭
│   ├── DetailPlanSection — 상세기획안 생성
│   ├── ProjectSection — 프로젝트 관리
│   ├── InfluencerArchiveSection — 인플루언서 아카이브
│   └── ErpSection — ERP 데이터
│
├── OaDashboard (메인 export)
│   ├── 상태 관리 (useState 450+개)
│   ├── 데이터 로딩 (useEffect)
│   ├── HomeSection — 홈
│   ├── MetaSection — 메타광고 (IIFE)
│   ├── InfluencerSection — 인플루언서
│   ├── ScheduleSection — 스케줄
│   ├── CreativeSection — 소재
│   ├── KeywordSection — 키워드
│   ├── ReviewSection — 콘텐츠리뷰
│   ├── HypothesisSection — 가설
│   ├── InsightSection — 팀노트
│   └── CoupangSection — 쿠팡
│
├── 사이드바 네비게이션
├── 모바일 탭바
└── 챗봇 FAB
```

---

## 신규 기능 추가 방법

### 1. 새 탭 추가
```javascript
// 1. NAVS 배열에 추가 (약 6220줄)
{id:"newtab", icon:"새아이콘", label:"새탭"},

// 2. 섹션 렌더링 추가 (약 14950줄)
{sec==="newtab" && <NewTabSection/>}

// 3. 컴포넌트 작성 (독립 function)
function NewTabSection() {
  const [data, setData] = useState([]);
  // ...
  return <div>...</div>;
}
```

### 2. 새 API 라우트 추가
```javascript
// app/api/new-route/route.js
export const dynamic = 'force-dynamic';
export async function GET(req) {
  // Supabase에서 데이터 읽기
  const res = await fetch(`${SUPA_URL}/rest/v1/table`, {headers: sH});
  return Response.json(await res.json());
}
```

### 3. 새 크론 추가
```json
// vercel.json
{
  "path": "/api/new-cron?secret=${ERP_SYNC_SECRET}",
  "schedule": "0 0 * * *"
}
```
⚠️ Hobby 플랜은 일 1회만 가능

### 4. 새 데이터 동기화 추가
```javascript
// MySQL → Supabase 패턴
const [rows] = await pool.query(`SELECT ... FROM table WHERE ...`);
const data = rows.map(r => ({ /* 매핑 */ }));
await fetch(`${SUPA_URL}/rest/v1/table?on_conflict=key`, {
  method: 'POST',
  headers: { ...sH, Prefer: 'resolution=merge-duplicates' },
  body: JSON.stringify(data),
});
```

---

## 디자인 시스템

### 컬러
```javascript
const C = {
  ink: "#18181B",      // 메인 텍스트
  inkMid: "#52525B",   // 서브 텍스트
  inkLt: "#A1A1AA",    // 비활성 텍스트
  bg: "#FAFAF9",       // 배경
  white: "#FFFFFF",
  border: "#E7E5E4",
  rose: "#E8567A",     // 브랜드 포인트 (OA 핑크)
  blush: "#FFF0F3",    // 로즈 연한
  cream: "#F5F4F0",
  good: "#16A34A",     // 긍정/상승
  bad: "#DC2626",      // 부정/하락
  warn: "#F59E0B",     // 경고
};
```

### 아이콘
Google Material Symbols Outlined
```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined"/>
<span className="material-symbols-outlined">icon_name</span>
```

### 폰트
Pretendard Variable
```html
<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"/>
```

---

## 배포

```bash
# Git push → 자동 배포 (Vercel Git 연동)
git add -A && git commit -m "메시지" && git push origin main

# 또는 CLI 직접 배포
npx vercel --yes --prod

# 환경 변수 추가
echo "value" | npx vercel env add KEY production
```

---

## 주의사항

1. **Dashboard.jsx가 17,000줄** — 수정 시 정확한 줄 번호 확인 필수
2. **IIFE 안에서 useState 금지** — 독립 컴포넌트로 분리해야 함
3. **Hobby 플랜 제한** — 일 100회 배포, 크론 일 1회
4. **MySQL 컬럼명 한글** — 백틱(\`) 필수
5. **Meta API 토큰** — 주기적 갱신 필요
6. **Figma 토큰** — 만료 시 재발급
