# 모델 스타일 — 레퍼런스 분석 (2026-08-08, 이미지 5장)

## 공통 스타일 (증류)
- **무드**: K-뷰티 에디토리얼 화보 (ELLE/보그 뷰티 캠페인). 클린·미니멀·스킨 중심
- **피부**: 글래스 스킨 — 이슬 맺힌 듯한 광, 진짜 모공/점/잔털 살아있는 리얼 피부.
  과보정 없음. 하이라이트가 광대·콧대에 자연스럽게 맺힘
- **메이크업**: 민낯급 내추럴 — 결 살린 자연 눈썹, 코랄/로지 누드 립(글로시),
  아이메이크업 거의 없음, 블러셔 아주 은은
- **헤어**: 슬릭하게 뒤로 넘긴 웻룩 또는 클린 로우 번 — 얼굴선 드러남,
  잔머리 몇 가닥이 자연스럽게 흘러내림 (완벽하지 않은 리얼함)
- **의상**: 미니멀 화이트 톱(티셔츠/탱크) 또는 맨어깨. 액세서리는 골드 미니 후프 정도
- **배경**: 밝은 회백색~쿨화이트 심리스, 소프트 이븐 라이트 (그림자 최소)
- **포즈**: 손이 얼굴 근처 — 뺨을 감싸거나, 손끝으로 터치하거나, 잔머리를 넘기는
  뷰티 에디토리얼 손동작. 시선은 카메라 정면 or 살짝 빗겨감
- **표정**: 차분한 무표정~은은한 미소, (친구 컷은) 활짝 웃는 생기
- **색감**: 뉴트럴+살구빛 피부톤, 저채도, 밝은 하이키

## 영어 프롬프트 블록 (KBEAUTY_EDITORIAL)
```
K-beauty editorial campaign style like an ELLE Korea beauty cover: dewy glass skin with
natural highlights on the cheekbones and nose bridge, real skin texture with visible pores
and tiny natural moles, bare-faced natural makeup (feathered natural brows, glossy
coral-nude lips, no heavy eye makeup), hair slicked back in a wet-look or a clean low bun
with a few loose baby hairs falling naturally, minimal white top, tiny gold hoop earrings,
bright cool-white seamless studio background, soft even high-key beauty light, elegant
editorial hand-near-face gestures, calm serene expression, neutral low-saturation grade.
```

## 2차 레퍼런스 추가 (2026-08-08, 이미지 6장)
클로즈업/표정 변주 — 기존 스타일 유지하되 아래 디테일 확장:
- **주근깨·리얼 디테일**: 주근깨 있는 내추럴 얼굴, 눈가 주름까지 살아있는 클로즈업 허용
  (bcdaaf, c09f09) — "완벽하지 않은 진짜 피부"가 핵심
- **표정 확장**: 활짝 웃어 치아 보이는 스마일(올려보는 각도), 눈 감고 웃는 윙크성 미소
  — 차분 무표정만이 아니라 생기 있는 치아 스마일 컷도 레퍼런스 톤
- **헤어 변주**: 두꺼운 풀뱅 앞머리 클로즈업(d41cd6), 자연 건조 웻헤어(949176)
- **의상 변주**: 원숄더 니트 톱 + 가는 골드 체인/링 (291583)
- **극단 클로즈업**: 입·치아·뺨 중심 매크로급 뷰티 클로즈업 컷 (치아 미백·립 제품용)

## 3차 레퍼런스 추가 (2026-08-10, 이미지 12장 — 라카/에스티로더/quip/아디다스 등)
제품을 "든" 모델컷 중심 — 기존 뷰티 클로즈업에서 **제품+모델 캠페인 컷**으로 확장:
- **파스텔 원컬러 세트 (라카식)**: 배경·의상·소품을 제품 컬러와 같은 파스텔 한 색으로
  통일 (핑크/스카이블루/라벤더). 모델 메이크업 포인트(립 컬러)까지 톤 매칭
- **제품 프레젠팅 포즈**: 턱을 손등/제품에 살짝 기대거나, 제품을 카메라 쪽으로
  내밀며 팔에 기대는 포즈 (LA PLATEAU) — 제품이 얼굴과 같은 초점 평면
- **소품 위트**: 짐볼·음료·백 등 컬러 매칭 대형 소품 하나로 씬에 유머와 스케일감
- **실루엣 역광 손샷 (에스티로더)**: 어두운 배경 + 림라이트, 손과 제품만 극적으로
  분리 — 럭셔리 무드 연출용
- **욕실 라이프스타일 손샷 (quip)**: 실제 세면대·타일 배경에서 손만 등장해 제품 사용
  — 진정성 있는 사용 맥락 컷
- **다이나믹 스포츠 모션 (아디다스)**: 점프/러닝 순간 포착 + 모션 블러 살짝 —
  활동성 USP 제품(가전·헬스)용

### 영어 프롬프트 블록 (PASTEL_CAMPAIGN)
```
Pastel monochrome campaign set: backdrop, outfit and one oversized prop all matched to the
product's pastel color, model's lip color echoing the same tone, she rests her chin lightly
near the product or presents it toward the camera leaning on her arm, product and face on
the same focal plane, playful minimal art direction like a K-beauty color cosmetics campaign.
```

## 반영 기록
- 2026-08-08: model/route.ts — MODEL_BASE 무드/헤어/의상/메이크업을 위 블록 기준으로 교체
- 2026-08-08: 2차 6장 — 표정(치아 스마일·윙크)/주근깨 리얼 스킨/풀뱅·웻헤어 변주 반영
- 2026-08-10: 3차 12장 — 파스텔 원컬러 세트·제품 프레젠팅·실루엣 역광·욕실 손샷 반영
  (page.tsx MODEL_POSES "파스텔 세트"·"제품 내밀기" + PRODUCT_CUTS "역광 실루엣 손")
