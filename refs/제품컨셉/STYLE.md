# 제품컨셉 — 상세페이지 레이아웃 레퍼런스 분석 (2026-08-08, 이미지 2장)

레퍼런스: 유고비(YOU GO BE, 다이어트 보조제) / 빌바 두유제조기 상세페이지

## 공통 레이아웃·카피 패턴 (증류)
- **브랜드 원컬러 시스템**: 페이지 전체를 한 가지 브랜드 컬러의 그라데이션·틴트로 통일
  (유고비=번트 오렌지→베이지, 빌바=웜 베이지·브라운). 포인트 컬러는 카피 강조에만
- **영문 타이포 오버레이**: 대형 세리프/디스플레이 영문 로고타입을 배경에 크게 깔거나
  섹션 타이틀로 사용 ("YOU GO BE", "overWHELMING") — 프리미엄 무드 형성
- **스텝 넘버링 구조**: "Step 03", "POINT 3" 등 넘버링 + 진행 인디케이터로 스크롤 리듬
- **불편함 후킹 → 해결 선언**: 고객 불평을 채팅 버블로 나열("세척하기가 너무 불편해요…")
  → "이젠, 더이상 걱정하지 마세요. OO가 만들면 다릅니다!" 전환 공식
- **혜택 다이어그램**: 중앙 원형 이미지 + 방사형 키워드 3~4개 (간식 충동 감소/장 편안함/수면 안정)
- **카피 리듬**: 짧은 선언형 헤드라인(2줄) + 강조색 볼드 키워드 + 박스형 결론 문장
- **제품컷**: 소프트 스튜디오 라이트, 브랜드 컬러 배경 위 패키지 연출(박스 기대 세우기·소품)
- **인물 삽입**: 섹션 사이 무드컷으로 바디/뒷모습 크롭 — 얼굴 노출 최소, 감성 브릿지 용도

## 영어 프롬프트 블록 (BRAND_TONE_LAYOUT)
```
Premium Korean e-commerce detail page mood: one-brand-color gradient backdrop, large serif
English typography overlay, soft studio product staging with packaging boxes leaning at
angles, warm minimal props, clean high-key light, editorial negative space.
```

## 반영 기록
- 2026-08-08: copy/route.js — 카피 원칙에 "불편 나열→해결 선언" 채팅버블 후킹·스텝 넘버링
  구조 참고 반영 (섹션 카피 톤)
