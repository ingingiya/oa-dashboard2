// 광고상사 공유 상수/산식 — page.jsx · api/ad-console · nworks 봇들이 공용으로 import
// (복제 3벌이던 RANKS·퀘스트 산식 단일화)

// 임직원 커리어 직급 (커리어 pt 기준)
export const RANKS = [[0, "인턴"], [2, "사원"], [5, "주임"], [10, "대리"], [18, "과장"], [30, "차장"], [45, "부장"], [70, "상무"], [100, "전무"], [140, "부사장"]];
export const rankOf = (pts) => { let r = RANKS[0][1]; for (const [th, nm] of RANKS) if (pts >= th) r = nm; return r; };

// 복지몰 칭호 카탈로그 (표시 전용 — 구매해도 직급/pt 랭크는 그대로, spent만 별도 누적)
export const SHOP = [
  { id: "coffee", icon: "☕", name: "카페인 수혈러", cost: 3, desc: "오늘도 아메리카노가 결재를 돌린다" },
  { id: "closer", icon: "📄", name: "계약 성사꾼", cost: 6, desc: "품의서에 도장이 마르질 않는다" },
  { id: "golden", icon: "🖊", name: "황금 도장", cost: 10, desc: "사장님도 탐내는 순금 결재 도장" },
  { id: "eye", icon: "👁", name: "매의 눈", cost: 15, desc: "부실 소재는 내 눈을 못 피한다" },
  { id: "legend", icon: "👑", name: "광고상사의 전설", cost: 25, desc: "사훈에 이름이 새겨졌다" },
];

// 전사 협력 퀘스트 — 이번주(월요일 시작, KST) / 지난주 구간
export function weekWindow() {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const dow = (now.getUTCDay() + 6) % 7; // 월=0
  const mon = new Date(now); mon.setUTCDate(now.getUTCDate() - dow);
  const monS = mon.toISOString().slice(0, 10);
  const pmon = new Date(mon); pmon.setUTCDate(mon.getUTCDate() - 7);
  return { monS, pmonS: pmon.toISOString().slice(0, 10) };
}
// 목표 = 지난주 계약 +5% (최소 10)
export const questGoal = (prevW) => Math.max(10, Math.ceil(prevW * 1.05));
