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

## 2차 레퍼런스 추가 (2026-08-10, 이미지 11장 — K-뷰티 제품 단독 컨셉샷)
넘버즈인/토코보/구달/beplain/원더랩/퍼셀/ilso/evia 등 — **제품 단독 히어로 컨셉** 공식:
- **성분·컬러 몰입 배경**: 제품 키 컬러(또는 핵심 성분 컬러) 단색 그라데이션이 화면 전체
  — 그린(사과/녹두), 블루(수분), 옐로우(비타민) 등 성분→컬러 직결
- **성분 소품 실물 배치**: 사과·녹두·리본·과일 조각을 제품 주위에 조형적으로 배치,
  일부는 공중에 부양 — "원료가 그대로" 메시지
- **텍스처 스퀴즈**: 튜브에서 크림/젤이 실제로 짜여 나오는 순간, 텍스처 덩어리가
  조형처럼 흐름 (구달 옐로우)
- **버블·워터 드롭 매크로**: 제품 표면·주위에 정밀한 물방울/거품 클러스터,
  백라이트 반짝임 (넘버즈인 버블, 퍼셀 워터드롭)
- **물결 표면**: 리퀴드 물결이 프레임 하단을 채우고 제품이 반쯤 잠기거나 위에 부양
  (원더랩)
- **라이트 빔**: 어두운 배경에 한 줄기 사선 빔이 제품만 스포트라이트 (ilso)
- **구름·소프트 오브제**: 솜구름 등 부드러운 오브제 위에 제품 배치 — 가벼움/편안함 소구

### 영어 프롬프트 블록 (INGREDIENT_HERO)
```
[INGREDIENT_COLOR] the product centered on a full-bleed gradient backdrop in its key
ingredient color, real ingredient props (fruit slices, beans, botanicals) arranged
sculpturally around it with a few floating mid-air, soft studio light, premium K-beauty ad.

[TEXTURE_SQUEEZE] a thick ribbon of the product's cream/gel texture squeezing out and
flowing sculpturally, macro sharpness, color-matched seamless backdrop.

[BUBBLE_MACRO] precise glossy water droplets and bubble clusters on and around the product,
backlit sparkle, fresh hydration macro shot.

[LIGHT_BEAM] a single diagonal beam of light spotlighting the product against a dark
backdrop, dramatic premium mood.
```

## 반영 기록
- 2026-08-08: copy/route.js — 카피 원칙에 "불편 나열→해결 선언" 채팅버블 후킹·스텝 넘버링
  구조 참고 반영 (섹션 카피 톤)
- 2026-08-10: 2차 11장 — 성분 컬러 몰입/부양 소품/텍스처 스퀴즈/버블 매크로/라이트 빔
  → page.tsx CUT_CONCEPTS "성분 컬러 몰입" 컨셉 반영
