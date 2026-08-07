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

## 반영 기록
- 2026-08-08: model/route.ts — MODEL_BASE 무드/헤어/의상/메이크업을 위 블록 기준으로 교체
- 2026-08-08: 2차 6장 — 표정(치아 스마일·윙크)/주근깨 리얼 스킨/풀뱅·웻헤어 변주 반영
