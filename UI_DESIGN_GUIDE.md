# OA HQ 대시보드 — UI/디자인 가이드

## 디자인 원칙

1. **한눈에** — 핵심 지표가 즉시 보여야 함. 클릭 없이 현황 파악.
2. **미니멀** — 불필요한 장식 없이. 데이터가 주인공.
3. **일관성** — 같은 패턴의 카드/버튼/색상 반복 사용.
4. **모바일 우선** — 팀원들이 폰으로도 확인. max-width 제한 없이 반응형.

---

## 컬러 시스템

### 브랜드 컬러
```
Rose (포인트)    #E8567A     — 브랜드 핑크. CTA, 활성 탭, 강조
Blush (연한)     #FFF0F3     — 로즈 배경. 호버, 선택 상태
```

### 텍스트
```
Ink (진한)       #18181B     — 제목, 핵심 숫자
Ink Mid          #52525B     — 본문, 서브 텍스트
Ink Light        #A1A1AA     — 비활성, 힌트, 라벨
```

### 배경
```
BG               #FAFAF9     — 전체 배경 (따뜻한 화이트)
White            #FFFFFF     — 카드 배경
Cream            #F5F4F0     — 버튼 비활성 배경
Border           #E7E5E4     — 구분선, 카드 테두리
```

### 상태 컬러
```
Good (긍정)      #16A34A     — 상승, 완료, ON, 수익+
Bad (부정)       #DC2626     — 하락, 경고, OFF, 손실
Warn (주의)      #F59E0B     — 임박, 보류, 체크 필요
Blue (정보)      #2563EB     — 링크, 기간, 네이버
Purple (특별)    #7C3AED     — AI, 비교, 인플루언서
```

### 사용 규칙
- ROAS 500%+ → Good, 300~500% → Warn(#CA8A04), 300% 미만 → Bad
- 상승 → Good, 하락 → Bad, 변동 없음 → Ink Light
- 활성 탭 → Rose, 비활성 → Ink Light
- 카드 배경 → White + Border 1px

---

## 타이포그래피

### 폰트
**Pretendard Variable** — 한글 최적화 산세리프
```css
font-family: 'Pretendard Variable', -apple-system, sans-serif;
```

### 크기 체계
```
28px  fontWeight:900  — 메인 KPI 숫자 (홈 광고비)
22px  fontWeight:900  — 슬라이드 제목
20px  fontWeight:900  — 섹션 타이틀
17px  fontWeight:900  — KPI 카드 숫자
16px  fontWeight:900  — 서브 타이틀
14px  fontWeight:800  — 카드 제목
13px  fontWeight:800  — 본문 강조
12px  fontWeight:700  — 일반 본문
11px  fontWeight:600  — 서브 본문, 테이블
10px  fontWeight:700  — 라벨, 뱃지
9px   fontWeight:700  — 미니 태그, 힌트
```

---

## 컴포넌트 패턴

### 카드
```jsx
<div style={{
  background: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: "14px 16px",
}}>
  <div style={{fontSize:13, fontWeight:800, color:C.ink, marginBottom:10}}>
    카드 제목
  </div>
  {/* 내용 */}
</div>
```

### KPI 카드 (그리드)
```jsx
<div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8}}>
  {[
    {label:"총 매출", value:"2.4억", color:C.ink},
    {label:"순이익",  value:"8,200만", color:C.good},
    {label:"ROAS",    value:"2,674%", color:C.good},
  ].map(k => (
    <div key={k.label} style={{
      background:C.white, border:`1px solid ${C.border}`,
      borderRadius:10, padding:"12px",
    }}>
      <div style={{fontSize:10, color:C.inkLt, fontWeight:600}}>{k.label}</div>
      <div style={{fontSize:17, fontWeight:900, color:k.color, marginTop:4}}>
        {k.value}
      </div>
    </div>
  ))}
</div>
```

### 뱃지/태그
```jsx
// 상태 뱃지
<span style={{
  fontSize:9, fontWeight:700,
  color:"#16a34a", background:"#f0fdf4",
  padding:"2px 8px", borderRadius:20,
}}>진행 중</span>

// 브랜드 태그
<span style={{
  fontSize:9, fontWeight:700,
  color:"#7c3aed", background:"#f5f3ff",
  padding:"2px 8px", borderRadius:6,
}}>소닉플로우</span>
```

### 토글 스위치
```jsx
<div onClick={toggle} style={{
  width:44, height:24, borderRadius:12,
  background: isOn ? "#16a34a" : "#e5e7eb",
  cursor:"pointer", position:"relative",
}}>
  <div style={{
    width:20, height:20, borderRadius:10,
    background:"#fff", position:"absolute", top:2,
    left: isOn ? 22 : 2,
    transition:"left 0.2s",
    boxShadow:"0 1px 3px rgba(0,0,0,0.2)",
  }}/>
</div>
```

### 상태 도트
```jsx
<div style={{
  width:8, height:8, borderRadius:"50%",
  background: status==="ACTIVE" ? "#16a34a" : "#dc2626",
  boxShadow: status==="ACTIVE" ? "0 0 6px #16a34a55" : "0 0 6px #dc262655",
}}/>
```

### 탭 바
```jsx
<div style={{display:"flex", gap:4}}>
  {tabs.map(t => (
    <button key={t.id} onClick={()=>setTab(t.id)} style={{
      padding:"6px 14px", border:"none", borderRadius:8,
      fontSize:11, fontWeight:700, cursor:"pointer",
      background: tab===t.id ? C.rose : "transparent",
      color: tab===t.id ? "#fff" : C.inkMid,
    }}>{t.label}</button>
  ))}
</div>
```

### 필터 칩
```jsx
<button style={{
  padding:"5px 14px", borderRadius:20,
  fontSize:11, fontWeight:700, cursor:"pointer",
  border: `1.5px solid ${active ? C.rose : C.border}`,
  background: active ? C.rose : C.white,
  color: active ? "#fff" : C.inkMid,
}}>{label}</button>
```

### 테이블
```jsx
<table style={{width:"100%", borderCollapse:"collapse", fontSize:11}}>
  <thead>
    <tr style={{background:C.bg}}>
      <th style={{
        padding:"9px 12px", textAlign:"left",
        fontWeight:700, color:C.inkMid, fontSize:10,
        borderBottom:`1px solid ${C.border}`,
      }}>헤더</th>
    </tr>
  </thead>
  <tbody>
    <tr style={{borderBottom:`1px solid ${C.border}22`}}>
      <td style={{padding:"9px 12px"}}>값</td>
    </tr>
  </tbody>
</table>
```

### 알림 카드
```jsx
// 경고 (노란색)
<div style={{
  background:"#fffbeb", border:"1px solid #fde68a",
  borderRadius:10, padding:"12px 14px",
}}>
  <div style={{fontSize:11, fontWeight:800, color:"#92400e"}}>
    ⚠️ 경고 메시지
  </div>
</div>

// 성공 (초록)
<div style={{background:"#f0fdf4", border:"1px solid #bbf7d0", ...}}>

// 에러 (빨강)
<div style={{background:"#fef2f2", border:"1px solid #fecaca", ...}}>

// 정보 (파랑)
<div style={{background:"#eff6ff", border:"1px solid #93c5fd", ...}}>

// AI/특별 (보라)
<div style={{background:"linear-gradient(135deg,#7c3aed11,#ec489811)", border:"1px solid #e9d5ff", ...}}>
```

### 바 차트 (CSS)
```jsx
<div style={{display:"flex", alignItems:"center", gap:8, marginBottom:4}}>
  <span style={{fontSize:10, fontWeight:700, width:70}}>{label}</span>
  <div style={{flex:1, height:16, background:C.bg, borderRadius:4, overflow:"hidden"}}>
    <div style={{
      width:`${percentage}%`, height:"100%",
      background:color, borderRadius:4,
    }}/>
  </div>
  <span style={{fontSize:10, fontWeight:700, width:30}}>{count}</span>
</div>
```

### 변동 표시
```jsx
// 상승
<span style={{color:C.good, fontWeight:700}}>▲ +15%</span>
// 하락
<span style={{color:C.bad, fontWeight:700}}>▼ -8%</span>
// 순위 변동
<span style={{color:diff>0?C.good:C.bad}}>
  {diff>0?`▲${diff}`:`▼${-diff}`}
</span>
```

---

## 레이아웃

### 사이드바 (데스크탑)
```
width: 236px
background: white
border-right: 1px solid border
position: sticky, height: 100vh
```

### 모바일 하단 탭바
```
position: fixed, bottom: 0
height: 54px + safe-area
background: white
border-top: 1px solid border
```

### 콘텐츠 영역
```
padding: 24px
gap: 12~14px (카드 간격)
```

### 반응형 브레이크포인트
```css
/* 모바일 */
@media (max-width: 768px) {
  .oa-sidebar { display: none; }
  .oa-mobile-nav { display: flex; }
  .oa-topbar { display: flex; }
}

/* 데스크탑 */
.oa-sidebar { width: 236px; }
.oa-body { margin-left: 236px; }
```

---

## 아이콘

### Google Material Symbols Outlined
```html
<span className="material-symbols-outlined" style={{fontSize:18}}>
  icon_name
</span>
```

### 자주 쓰는 아이콘
| 아이콘 | 이름 | 용도 |
|--------|------|------|
| 🏠 | home | 홈 |
| 📊 | campaign | 메타광고 |
| ✨ | auto_awesome | 인플루언서 |
| 📅 | calendar_month | 스케줄 |
| 🎨 | palette | 소재 |
| 🔍 | search | 키워드 |
| ✅ | check_circle | 콘텐츠리뷰 |
| 📝 | edit_note | 팀노트 |
| 📂 | folder_open | 프로젝트 |
| 📄 | article | 상세기획 |
| 💡 | psychology | 가설 |
| ⚡ | bolt | 액션 필요 |
| 📦 | inventory_2 | 재고/제품 |
| 🚚 | local_shipping | 배송 |
| 💰 | calculate | 계산 |
| ⬆ | trending_up | 상승 |
| ⬇ | trending_down | 하락 |
| ▶ | expand_more / expand_less | 펼치기/접기 |
| ← → | chevron_left / chevron_right | 네비게이션 |
| ✕ | close | 닫기/삭제 |
| + | add | 추가 |

---

## 인터랙션 패턴

### 호버
```jsx
onMouseEnter={e => e.currentTarget.style.background = C.cream}
onMouseLeave={e => e.currentTarget.style.background = "transparent"}
```

### 로딩
```jsx
{loading && (
  <div style={{padding:40, textAlign:"center", color:C.inkLt, fontSize:13}}>
    불러오는 중...
  </div>
)}
```

### 빈 상태
```jsx
<div style={{textAlign:"center", padding:"40px 20px", color:C.inkMid}}>
  <div style={{fontSize:28, marginBottom:8}}>📂</div>
  <div style={{fontSize:13, fontWeight:700}}>데이터가 없어요</div>
  <div style={{fontSize:11, color:C.inkLt, marginTop:4}}>
    설명 텍스트
  </div>
</div>
```

### 모달
```jsx
<div style={{
  position:"fixed", inset:0,
  background:"rgba(0,0,0,0.4)", zIndex:1000,
  display:"flex", alignItems:"center", justifyContent:"center",
  padding:20,
}} onClick={close}>
  <div onClick={e=>e.stopPropagation()} style={{
    background:C.white, borderRadius:16,
    padding:24, width:"100%", maxWidth:500,
    maxHeight:"80vh", overflowY:"auto",
  }}>
    {/* 모달 내용 */}
  </div>
</div>
```

### 스트리밍 텍스트
```jsx
{loading && streamText && (
  <div style={{background:C.white, borderRadius:12, padding:16}}>
    <div style={{fontSize:11, fontWeight:700, color:C.rose}}>
      <span style={{display:"inline-block", width:8, height:8,
        borderRadius:"50%", background:C.rose,
        animation:"pulse 1s infinite"}}/>
      AI 생성 중...
    </div>
    <pre style={{fontSize:11, whiteSpace:"pre-wrap", lineHeight:1.6}}>
      {streamText}
    </pre>
  </div>
)}
```

---

## 금액 표시 포맷

```javascript
const fmtW = n => {
  if (n >= 100000000) return `${(n/100000000).toFixed(1)}억`;
  if (n >= 10000) return `${Math.round(n/10000).toLocaleString()}만`;
  return `${Math.round(n).toLocaleString()}원`;
};
// 2.4억, 8,200만, 34,500원
```

---

## DO & DON'T

### ✅ DO
- 숫자는 크고 굵게 (fontWeight:900)
- 라벨은 작고 연하게 (fontSize:10, color:inkLt)
- 카드 사이 간격 8~12px
- 색상으로 상태 즉시 인지 (빨/초/노)
- 클릭 가능한 요소에 cursor:pointer
- 변동값에 +/- 기호 + 색상

### ❌ DON'T
- 이모지 남용 (Material Icons 사용)
- 긴 텍스트 (overflow:hidden + ellipsis)
- 3단 이상 깊은 중첩
- 고정 너비 (flex/grid 사용)
- 테두리 두껍게 (1~1.5px만)
