# 제품연출 — 컷 연출 레퍼런스 분석 (2026-08-08, 이미지 5장)

레퍼런스: Torriden 글로우 미스트(부양+분사) / 스킨1004 센텔라(물 위 라인업) /
Anuko 헤어오일 모델컷 2 / e:nk 선크림 모델컷

## 제품 단독 연출 (증류)
- **공중 부양 + 모션 순간포착**: 제품이 사선으로 떠 있고 실제 분사 미스트/입자가
  빛을 받아 퍼지는 순간 — USP(분사력·수분)를 사진 한 장으로 증명
- **단색 그라데이션 배경**: 제품 컬러와 같은 계열의 블루/파스텔 그라데이션 몰입 배경
- **물 연출**: 얕은 물 표면 위에 제품 라인업 배치, 잔물결·반사·물방울 맺힘 —
  수분/청량 소구. 라인업은 높이 리듬을 섞어 지그재그 배치
- **조명**: 밝은 하이키 + 제품 뒤 백라이트로 미스트·물 입자 반짝임 강조

## 모델+제품 연출 (증류)
- **제품을 얼굴 옆에**: 제품을 턱선~뺨 높이로 들어 얼굴과 제품이 한 프레임 —
  뷰티 캠페인 표준 포즈. 손끝 그립은 가볍게, 네일 클린
- **어깨 너머 포즈**: 몸은 옆, 고개만 카메라로 돌려 제품 든 손을 어깨에 얹기
- **다이나믹 헤어 컷**: 머리카락이 바람에 흩날리는 순간 + 제품을 얼굴 옆에 —
  헤어 제품 USP(찰랑임)를 모션으로 전달
- **배경**: 제품 브랜드 컬러의 파스텔 단색(민트/스카이블루) 시밀리스, 의상은 화이트/파스텔 톤온톤

## 영어 프롬프트 블록
```
[FLOATING_SPRAY] the product floating diagonally mid-air against a monochrome gradient
backdrop matching its color, a real fine mist bursting from the nozzle caught by backlight,
sparkling micro droplets, bright high-key studio light.

[WATER_SURFACE] the product standing on a shallow rippling water surface, soft reflections
and water droplets on the bottle, airy pastel-blue gradient light, fresh hydration mood.

[FACE_SIDE_HOLD] she holds the product lightly at cheek level so her face and the product
share the frame, beauty-campaign pose, pastel seamless background matching the product
color, white outfit, clean glossy nails, soft even light.

[HAIR_MOTION] her long hair flying in a wind-swept dynamic moment while she holds the
product beside her face, monochrome pastel backdrop, energetic beauty-campaign feel.
```

## 2차 레퍼런스 추가 (2026-08-10, 이미지 7장 — 전동칫솔/가전 인포그래픽 연출)
usmile/GLEEM/smak/메디큐브 등 — **기능 증명형 인포그래픽 컷** 공식:
- **스트로보 잔상 (usmile)**: 제품 헤드의 움직임을 다중 노출 잔상으로 겹쳐
  진동/스윙 속도를 시각화 — 어두운 배경 + 컬러 라이트
- **브러시모·부품 매크로**: 칫솔모/노즐 끝을 화면 가득 매크로, 모 한 가닥까지 선명,
  미세모 밀도·소재 품질 증명
- **투명 내부 렌더 (GLEEM)**: 제품 바디를 반투명 처리해 내부 모터·구조가 비쳐 보이는
  X-ray 스타일 — 기술력 소구
- **탑뷰 정렬 매크로 (smak)**: 제품/헤드 여러 개를 탑뷰로 정갈하게 정렬, 컬러 배리에이션
  한눈에
- **다크 프리미엄 (냉수펌프)**: 짙은 단색 배경 + 로우키 조명, 금속·플라스틱의 스펙큘러
  하이라이트로 고급감
- **3D 성분 인포그래픽 (메디큐브)**: 성분 입자를 3D 글래스 오브제로 확대 렌더 +
  돋보기 프레임/라벨 — 과학적 신뢰 소구, 블루 그라데이션

### 영어 프롬프트 블록 (추가)
```
[STROBE_MOTION] multiple-exposure strobe trail of the product's moving head showing its
vibration sweep, dark backdrop with colored rim light, high-speed photography look.

[XRAY_INNER] the product body rendered semi-transparent revealing the inner motor and
mechanism glowing softly, technical premium visualization.

[MACRO_BRISTLE] extreme macro of the functional tip (bristles/nozzle) filling the frame,
every filament sharp, material quality clearly readable.

[DARK_PREMIUM] the product on a deep monochrome backdrop, low-key lighting with crisp
specular highlights tracing its edges, luxurious tech mood.

[SCI_PARTICLE] the key ingredient/technology visualized as enlarged glossy 3D glass
particles with a magnifier frame and small labels, blue gradient backdrop, scientific
credibility infographic.
```

## 반영 기록
- 2026-08-08: page.tsx MODEL_POSES에 "제품 얼굴 옆"·"헤어 모션" 포즈 추가,
  CUT_CONCEPTS에 부양·물 연출 톤 반영 예정
- 2026-08-10: 2차 7장 — 스트로보 잔상/X-ray 내부/브러시 매크로/다크 프리미엄/3D 성분
  → page.tsx CUT_CONCEPTS "테크 증명" + PRODUCT_CUTS 스트로보/투명 내부/다크 프리미엄 반영
