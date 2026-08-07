# refs/ — 스타일 레퍼런스 학습 폴더

여기에 폴더별로 레퍼런스 이미지를 넣으면 Claude가 분석해서
`/detail` 생성기의 프롬프트(모델·컷 스타일)에 반영한다.

## 규칙 (Claude용)
- 새 폴더나 새 이미지가 생기면: 이미지들을 Read로 보고 → 해당 폴더의 `STYLE.md`에
  공통 스타일을 분석·증류 (무드/조명/배경/스타일링/포즈/색감 + 영어 프롬프트 블록)
- 증류한 프롬프트 블록을 관련 라우트에 반영:
  - `모델/` → `app/api/detail/model/route.ts` (MODEL_BASE·헤어·의상·스타일링)
  - `제품컨셉/` → `app/api/detail/generate/route.ts` 또는 컷 컨셉 프리셋(page.tsx CUT_CONCEPTS)
  - `제품연출/` → 컷 프롬프트/연출 컨셉(/api/detail/concepts)
- 이미지 자체는 git에 커밋하지 않는다 (.gitignore) — STYLE.md만 커밋
- 반영 후 STYLE.md 하단에 반영 일자/커밋 기록

## 폴더
- `모델/` — 모델(인물) 느낌 레퍼런스
- `제품컨셉/` — 제품 컨셉 무드 레퍼런스
- `제품연출/` — 제품 연출(디테일컷·씬) 레퍼런스
