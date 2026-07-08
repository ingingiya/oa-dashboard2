# OA HQ 대시보드 — UI/디자인 시스템 v2

> 오아(OA) 뷰티팀 마케팅 대시보드의 디자인 시스템.
> 이 문서를 기준으로 모든 UI를 설계합니다.

---

## 1. 디자인 철학

| 원칙 | 설명 | 예시 |
|------|------|------|
| **즉시 인지** | 숫자/상태가 1초 안에 파악됨 | ROAS 2,674% → 큰 글씨 + 초록색 |
| **계층적 정보** | 중요한 것 크게, 보조 정보 작게 | KPI 17px → 라벨 10px |
| **색상 = 의미** | 색으로 좋고/나쁨 즉시 구분 | 초록=좋음, 빨강=나쁨, 노랑=주의 |
| **일관된 패턴** | 같은 종류의 데이터는 같은 모양 | 모든 카드 = 흰 배경 + 12px 라운드 |
| **터치 친화** | 모바일에서도 쉽게 조작 | 최소 터치 영역 44px |

---

## 2. 컬러 시스템

### 2.1 기본 팔레트

#### 브랜드
| 이름 | HEX | RGB | 용도 |
|------|-----|-----|------|
| **Rose** | `#E8567A` | 232, 86, 122 | CTA, 활성탭, 브랜드 포인트 |
| **Blush** | `#FFF0F3` | 255, 240, 243 | 로즈 배경, 호버 |

#### 텍스트
| 이름 | HEX | 용도 | 예시 |
|------|-----|------|------|
| **Ink** | `#18181B` | 제목, 핵심 숫자 | 매출 2.4억 |
| **Ink Mid** | `#52525B` | 본문, 서브 텍스트 | 설명 텍스트 |
| **Ink Light** | `#A1A1AA` | 비활성, 힌트, 라벨 | "총 매출" 라벨 |

#### 배경/구분
| 이름 | HEX | 용도 |
|------|-----|------|
| **BG** | `#FAFAF9` | 전체 배경 (따뜻한 화이트) |
| **White** | `#FFFFFF` | 카드 배경 |
| **Cream** | `#F5F4F0` | 버튼 비활성, 차트 배경 |
| **Border** | `#E7E5E4` | 테두리, 구분선 |

#### 상태
| 이름 | HEX | 배경 | 의미 |
|------|-----|------|------|
| **Good** | `#16A34A` | `#F0FDF4` | 상승, 완료, ON, 수익+ |
| **Bad** | `#DC2626` | `#FEF2F2` | 하락, 경고, OFF, 손실 |
| **Warn** | `#F59E0B` | `#FFFBEB` | 임박, 보류, 체크 필요 |
| **Blue** | `#2563EB` | `#EFF6FF` | 링크, 정보, 네이버 |
| **Purple** | `#7C3AED` | `#F5F3FF` | AI, 비교, 특별 |

### 2.2 컬러 사용 규칙

```
ROAS 표시:
  500%+     → Good (#16A34A)
  300~500%  → Warn (#CA8A04)
  300% 미만 → Bad (#DC2626)

변동 표시:
  상승 → Good + "▲ +15%"
  하락 → Bad  + "▼ -8%"
  변동없음 → Ink Light

탭/버튼 상태:
  활성   → Rose 배경 + White 텍스트
  비활성 → 투명 배경 + Ink Light 텍스트
  호버   → Cream 배경

알림 카드:
  성공 → Good 배경 + Good 테두리
  경고 → Warn 배경 + Warn 테두리
  에러 → Bad 배경 + Bad 테두리
  정보 → Blue 배경 + Blue 테두리
  AI   → Purple 그라데이션 배경
```

### 2.3 그라데이션
```css
/* AI/특별 카드 */
background: linear-gradient(135deg, #7c3aed11, #ec489811);
border: 1px solid #e9d5ff;

/* 다크 헤더 (카메라 대시보드) */
background: linear-gradient(135deg, #1a1a2e, #16213e);

/* 파란 카드 */
background: linear-gradient(135deg, #1D4ED8, #2563EB);
```

---

## 3. 타이포그래피

### 3.1 폰트
```
기본: Pretendard Variable
코드: SF Mono, Consolas, monospace
```

### 3.2 크기 체계

| Level | Size | Weight | 용도 | 예시 |
|-------|------|--------|------|------|
| **Hero** | 28px | 900 | 메인 KPI | ₩2,400만 |
| **Display** | 22px | 900 | 슬라이드 제목 | 에어스트레이트 |
| **Title** | 20px | 900 | 섹션 타이틀 | 프로젝트 관리 |
| **KPI** | 17px | 900 | KPI 카드 숫자 | 2,674% |
| **Subtitle** | 16px | 900 | 서브 타이틀 | 네이버 광고 |
| **Card Title** | 14px | 800 | 카드 제목 | 월별 수익 |
| **Emphasis** | 13px | 800 | 본문 강조 | 캠페인명 |
| **Body** | 12px | 700 | 일반 본문 | 설명 텍스트 |
| **Small** | 11px | 600 | 서브 본문, 테이블 | 테이블 셀 |
| **Label** | 10px | 700 | 라벨, 뱃지 | "총 매출" |
| **Micro** | 9px | 700 | 미니 태그, 힌트 | 상태 뱃지 |
| **Nano** | 8px | 700 | 초소형 라벨 | "클릭하면 적용" |

### 3.3 텍스트 규칙
```
- 숫자는 항상 fontWeight: 900 (Black)
- 라벨은 항상 fontWeight: 600~700
- 긴 텍스트는 overflow: hidden + textOverflow: ellipsis
- 줄간격: 일반 본문 lineHeight: 1.5~1.7
- letter-spacing: 제목 -0.02em, 라벨 0.02em
```

---

## 4. 간격 (Spacing)

### 4.1 기본 단위: 4px
```
4px   — 인접 요소 최소 간격
6px   — 태그/뱃지 간격
8px   — 카드 내부 요소 간격
10px  — 모바일 카드 패딩
12px  — 카드 간 간격 (gap)
14px  — 섹션 내 카드 간격
16px  — 카드 패딩 (데스크탑)
20px  — 섹션 간 간격
24px  — 페이지 패딩
```

### 4.2 라운딩 (Border Radius)
```
4px   — 미니 바 차트
6px   — 인풋, 작은 버튼
8px   — 버튼, 드롭다운
10px  — 작은 카드, KPI
12px  — 일반 카드
14px  — 큰 카드
16px  — 모달
20px  — 칩/필터 버튼 (pill)
50%   — 상태 도트
```

---

## 5. 컴포넌트 라이브러리

### 5.1 카드

#### 기본 카드
```jsx
<div style={{
  background: "#fff",
  border: "1px solid #E7E5E4",
  borderRadius: 12,
  padding: "14px 16px",
}}>
  <div style={{fontSize:13, fontWeight:800, color:"#18181B", marginBottom:10}}>
    제목
  </div>
  {/* 내용 */}
</div>
```

#### KPI 카드 그리드
```jsx
// 3열 그리드
<div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8}}>
  {metrics.map(k => (
    <div style={{
      background:"#fff", border:"1px solid #E7E5E4",
      borderRadius:10, padding:"12px",
    }}>
      <div style={{fontSize:10, color:"#A1A1AA", fontWeight:600}}>
        {k.label}
      </div>
      <div style={{fontSize:17, fontWeight:900, color:k.color, marginTop:4}}>
        {k.value}
      </div>
    </div>
  ))}
</div>
```

#### 알림 카드 (4종)
```jsx
// 타입별 색상 매핑
const alertStyles = {
  success: { bg:"#f0fdf4", border:"#bbf7d0", text:"#16a34a" },
  warning: { bg:"#fffbeb", border:"#fde68a", text:"#92400e" },
  error:   { bg:"#fef2f2", border:"#fecaca", text:"#dc2626" },
  info:    { bg:"#eff6ff", border:"#93c5fd", text:"#2563eb" },
  ai:      { bg:"linear-gradient(135deg,#7c3aed11,#ec489811)", border:"#e9d5ff", text:"#7c3aed" },
};
```

#### 펼치기/접기 카드
```jsx
<div style={{border:"1px solid #E7E5E4", borderRadius:12, overflow:"hidden"}}>
  <button onClick={toggle} style={{
    width:"100%", display:"flex", justifyContent:"space-between",
    padding:"12px 16px", border:"none", background:isOpen?"#FAFAF9":"#fff",
    cursor:"pointer",
  }}>
    <span style={{fontWeight:800}}>{title}</span>
    <MaterialIcon name={isOpen?"expand_less":"expand_more"}/>
  </button>
  {isOpen && <div style={{padding:16, borderTop:"1px solid #E7E5E4"}}>
    {children}
  </div>}
</div>
```

### 5.2 버튼

#### Primary (CTA)
```jsx
<button style={{
  padding:"10px 20px",
  background:"#E8567A", color:"#fff",
  border:"none", borderRadius:8,
  fontSize:13, fontWeight:800,
  cursor:"pointer",
}}>액션</button>
```

#### Secondary
```jsx
<button style={{
  padding:"8px 14px",
  background:"#fff", color:"#52525B",
  border:"1px solid #E7E5E4", borderRadius:8,
  fontSize:11, fontWeight:700,
}}>보조 액션</button>
```

#### Ghost
```jsx
<button style={{
  padding:"8px 14px",
  background:"transparent", color:"#A1A1AA",
  border:"none", borderRadius:8,
  fontSize:11, fontWeight:700,
}}>텍스트 버튼</button>
```

#### Danger
```jsx
<button style={{
  padding:"6px 12px",
  background:"#fef2f2", color:"#dc2626",
  border:"none", borderRadius:6,
  fontSize:10, fontWeight:700,
}}>삭제</button>
```

#### 필터 칩 (Pill)
```jsx
<button style={{
  padding:"5px 14px", borderRadius:20,
  border: `1.5px solid ${active ? "#E8567A" : "#E7E5E4"}`,
  background: active ? "#E8567A" : "#fff",
  color: active ? "#fff" : "#52525B",
  fontSize:11, fontWeight:700,
}}>필터</button>
```

### 5.3 입력

#### 텍스트 인풋
```jsx
<input style={{
  width:"100%", padding:"8px 10px",
  border:"1px solid #E7E5E4", borderRadius:8,
  fontSize:13, fontFamily:"inherit",
  outline:"none", boxSizing:"border-box",
}}/>
// Focus: borderColor → "#E8567A" 또는 "#18181B"
```

#### 셀렉트
```jsx
<select style={{
  width:"100%", padding:"8px 10px",
  border:"1px solid #E7E5E4", borderRadius:8,
  fontSize:11, fontFamily:"inherit",
  background:"#fff",
}}>
```

#### 날짜 입력
```jsx
<input type="date" style={{
  padding:"4px 8px", borderRadius:7,
  border:"1.5px solid #E7E5E4", // 값 있으면 → "#16a34a"
  fontSize:11, fontFamily:"inherit",
}}/>
```

### 5.4 뱃지/태그

```jsx
// 크기별
const badge = (text, color, bg) => (
  <span style={{
    fontSize:9, fontWeight:700,
    color, background:bg,
    padding:"2px 8px", borderRadius:20,
  }}>{text}</span>
);

// 상태 뱃지
badge("진행 중", "#16a34a", "#f0fdf4")
badge("보류",   "#dc2626", "#fef2f2")
badge("예정",   "#0284c7", "#e0f2fe")
badge("긴급",   "#dc2626", "#fef2f2")
badge("NEW",    "#7c3aed", "#f5f3ff")

// 카테고리 태그 (사각)
<span style={{fontSize:9, fontWeight:700, color:"#7c3aed",
  background:"#f5f3ff", padding:"2px 6px", borderRadius:6}}>
  소닉플로우
</span>
```

### 5.5 토글 스위치
```jsx
<div onClick={toggle} style={{
  width:44, height:24, borderRadius:12,
  background: isOn ? "#16a34a" : "#e5e7eb",
  cursor:"pointer", position:"relative",
  transition:"background 0.2s",
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

### 5.6 상태 도트
```jsx
<div style={{
  width:8, height:8, borderRadius:"50%",
  background: status==="ACTIVE" ? "#16a34a" : "#dc2626",
  boxShadow: `0 0 6px ${status==="ACTIVE" ? "#16a34a55" : "#dc262655"}`,
  flexShrink:0,
}}/>
```

### 5.7 데이터 시각화

#### 바 차트 (수평)
```jsx
<div style={{display:"flex", alignItems:"center", gap:8}}>
  <span style={{fontSize:10, fontWeight:700, width:70}}>{label}</span>
  <div style={{flex:1, height:16, background:"#F5F4F0", borderRadius:4, overflow:"hidden"}}>
    <div style={{
      width:`${percentage}%`, height:"100%",
      background:color, borderRadius:4,
      transition:"width 0.3s",
    }}/>
  </div>
  <span style={{fontSize:10, fontWeight:700, width:30}}>{value}</span>
</div>
```

#### 바 차트 (수직 — 요일별)
```jsx
<div style={{display:"flex", gap:4, alignItems:"flex-end", height:60}}>
  {data.map((val, i) => (
    <div style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2}}>
      <span style={{fontSize:9, fontWeight:700}}>{val}</span>
      <div style={{
        width:"100%", height:`${val/maxVal*40}px`,
        background: isWeekend ? "#f87171" : "#2563eb",
        borderRadius:3, minHeight:2,
      }}/>
      <span style={{fontSize:9, color:"#A1A1AA"}}>{dayLabel}</span>
    </div>
  ))}
</div>
```

#### 변동 표시
```jsx
// 숫자 변동
<span style={{color: diff>0 ? "#16a34a" : "#dc2626", fontWeight:700}}>
  {diff>0 ? "+" : ""}{diff}%
</span>

// 순위 변동
<span style={{color: diff>0 ? "#16a34a" : "#dc2626"}}>
  {diff>0 ? `▲${diff}` : `▼${-diff}`}
</span>

// 퍼센트포인트
<span>{diff>0?"+":""}{Math.round(diff)}%p</span>
```

### 5.8 테이블
```jsx
<div style={{background:"#fff", border:"1px solid #E7E5E4", borderRadius:12, overflow:"hidden"}}>
  <div style={{overflowX:"auto"}}>
    <table style={{width:"100%", borderCollapse:"collapse", fontSize:11}}>
      <thead>
        <tr style={{background:"#FAFAF9"}}>
          <th style={{
            padding:"9px 12px", textAlign:"left",
            fontWeight:700, color:"#52525B", fontSize:10,
            borderBottom:"1px solid #E7E5E4",
            cursor:"pointer", // 정렬 가능
          }}>
            헤더 {sortCol==="key" ? (sortAsc?"▲":"▼") : ""}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr style={{borderBottom:"1px solid #E7E5E422"}}>
          <td style={{padding:"9px 12px"}}>값</td>
        </tr>
      </tbody>
      <tfoot>
        <tr style={{background:"#FAFAF9", borderTop:"2px solid #E7E5E4"}}>
          <td style={{padding:"9px 12px", fontWeight:800}}>합계</td>
        </tr>
      </tfoot>
    </table>
  </div>
</div>
```

### 5.9 모달
```jsx
// 오버레이
<div style={{
  position:"fixed", inset:0,
  background:"rgba(0,0,0,0.4)", zIndex:1000,
  display:"flex", alignItems:"center", justifyContent:"center",
  padding:20,
}} onClick={close}>
  {/* 모달 본체 */}
  <div onClick={e=>e.stopPropagation()} style={{
    background:"#fff", borderRadius:16,
    padding:24, width:"100%", maxWidth:500,
    maxHeight:"80vh", overflowY:"auto",
    boxShadow:"0 20px 60px rgba(0,0,0,0.15)",
  }}>
    <div style={{fontSize:16, fontWeight:900, marginBottom:16}}>제목</div>
    {/* 내용 */}
    <div style={{display:"flex", gap:8, marginTop:16}}>
      <button /* Primary CTA */>확인</button>
      <button /* Secondary */>취소</button>
    </div>
  </div>
</div>
```

### 5.10 이미지 프리뷰 (호버)
```jsx
const [hover, setHover] = useState(false);
<div style={{position:"relative"}}
  onMouseEnter={()=>setHover(true)}
  onMouseLeave={()=>setHover(false)}>
  <img src={src} style={{width:36, height:36, borderRadius:6, objectFit:"cover"}}/>
  {hover && <img src={src} style={{
    position:"fixed", top:"50%", left:"50%",
    transform:"translate(-50%,-50%)",
    maxWidth:300, maxHeight:400, borderRadius:12,
    boxShadow:"0 12px 40px rgba(0,0,0,0.35)",
    border:"3px solid #fff", zIndex:999,
  }}/>}
</div>
```

---

## 6. 레이아웃

### 6.1 전체 구조
```
┌─────────────────────────────────────────┐
│ 모바일 상단 헤더 (768px 이하만)          │
├──────┬──────────────────────────────────┤
│      │                                  │
│ 사이드│         콘텐츠 영역              │
│  바   │    padding: 24px                │
│ 236px│    gap: 12~14px                  │
│      │                                  │
│      │  ┌──────┐ ┌──────┐ ┌──────┐     │
│      │  │ KPI  │ │ KPI  │ │ KPI  │     │
│      │  └──────┘ └──────┘ └──────┘     │
│      │                                  │
│      │  ┌──────────────────────┐        │
│      │  │      차트/테이블      │        │
│      │  └──────────────────────┘        │
│      │                                  │
├──────┴──────────────────────────────────┤
│ 모바일 하단 탭바 (768px 이하만)          │
└─────────────────────────────────────────┘
```

### 6.2 사이드바
```jsx
<aside style={{
  width: 236, position:"sticky", top:0, height:"100vh",
  background:"#fff", borderRight:"1px solid #E7E5E4",
  overflowY:"auto", padding:"20px 12px",
}}>
  {/* 로고 */}
  <div style={{
    display:"flex", alignItems:"center", gap:10, marginBottom:16,
  }}>
    <div style={{
      width:36, height:36,
      background:"linear-gradient(135deg,#E8567A,#F5A0B5)",
      borderRadius:10, display:"flex", alignItems:"center",
      justifyContent:"center", fontSize:18,
    }}>🌸</div>
    <div>
      <div style={{fontSize:15, fontWeight:900}}>OA <span style={{color:"#E8567A"}}>HQ</span></div>
      <div style={{fontSize:9, color:"#A1A1AA"}}>MARKETING DASHBOARD</div>
    </div>
  </div>

  {/* 네비게이션 */}
  <nav>
    {NAVS.map(n => (
      <button style={{
        width:"100%", display:"flex", alignItems:"center", gap:12,
        padding:"11px 14px", borderRadius:11,
        background: active ? "#E8567A" : "transparent",
        color: active ? "#fff" : "#52525B",
        fontWeight:700, fontSize:13,
        boxShadow: active ? "0 4px 14px #E8567A44" : "none",
      }}>
        <MaterialIcon name={n.icon}/>
        {n.label}
      </button>
    ))}
  </nav>
</aside>
```

### 6.3 반응형
```css
/* 데스크탑 (768px+) */
.oa-sidebar { display: block; width: 236px; }
.oa-body { margin-left: 236px; }
.oa-topbar { display: none; }
.oa-mobile-nav { display: none; }

/* 모바일 (768px 이하) */
.oa-sidebar { display: none; }
.oa-body { margin-left: 0; }
.oa-topbar { display: flex; height: 54px; }
.oa-mobile-nav {
  display: flex;
  position: fixed; bottom: 0;
  padding-bottom: env(safe-area-inset-bottom);
}
```

### 6.4 그리드 패턴
```jsx
// KPI 3열
gridTemplateColumns: "repeat(3, 1fr)"

// KPI 4열
gridTemplateColumns: "repeat(4, 1fr)"

// 반응형 자동
gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))"

// 2열 폼
gridTemplateColumns: "1fr 1fr"

// 태그 그리드
gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))"
```

---

## 7. 인터랙션

### 7.1 트랜지션
```css
transition: all 0.15s;     /* 기본 */
transition: all 0.2s;      /* 버튼 호버 */
transition: left 0.2s;     /* 토글 스위치 */
transition: width 0.3s;    /* 바 차트 */
transition: border 0.15s;  /* 카드 선택 */
```

### 7.2 호버 효과
```jsx
// 카드 호버
onMouseEnter={e => e.currentTarget.style.background = "#F5F4F0"}
onMouseLeave={e => e.currentTarget.style.background = "transparent"}

// 사이드바 메뉴
onMouseEnter={e => { if(!active) e.currentTarget.style.background = "#F5F4F0"; }}
onMouseLeave={e => { if(!active) e.currentTarget.style.background = "transparent"; }}
```

### 7.3 로딩 상태
```jsx
// 텍스트 로딩
<div style={{padding:40, textAlign:"center", color:"#A1A1AA", fontSize:13}}>
  불러오는 중...
</div>

// 스트리밍 (AI 생성 중)
<div style={{display:"flex", alignItems:"center", gap:6}}>
  <span style={{
    width:8, height:8, borderRadius:"50%",
    background:"#E8567A",
    animation:"pulse 1s infinite",
  }}/>
  <span style={{fontSize:11, fontWeight:700, color:"#E8567A"}}>
    AI 생성 중...
  </span>
</div>

// 버튼 로딩
<button disabled style={{opacity:0.5}}>
  처리 중...
</button>
```

### 7.4 빈 상태 (Empty State)
```jsx
<div style={{
  textAlign:"center", padding:"40px 20px",
  color:"#52525B",
}}>
  <div style={{fontSize:28, marginBottom:8}}>📂</div>
  <div style={{fontSize:13, fontWeight:700}}>데이터가 없어요</div>
  <div style={{fontSize:11, color:"#A1A1AA", marginTop:4}}>
    액션 유도 텍스트
  </div>
</div>
```

---

## 8. 아이콘 (Material Symbols Outlined)

### 8.1 사용법
```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"/>

<span className="material-symbols-outlined" style={{fontSize:18}}>
  icon_name
</span>
```

### 8.2 아이콘 매핑

| 카테고리 | 아이콘 | 이름 |
|---------|--------|------|
| **네비게이션** | | |
| 홈 | 🏠 | `home` |
| 광고 | 📣 | `campaign` |
| 인플루언서 | ✨ | `auto_awesome` |
| 캘린더 | 📅 | `calendar_month` |
| 소재 | 🎨 | `palette` |
| 검색 | 🔍 | `search` |
| 체크 | ✅ | `check_circle` |
| 노트 | 📝 | `edit_note` |
| 폴더 | 📂 | `folder_open` |
| 문서 | 📄 | `article` |
| AI | 🧠 | `psychology` |
| **액션** | | |
| 추가 | ➕ | `add` |
| 삭제 | ✕ | `close` |
| 수정 | ✏️ | `edit` |
| 저장 | 💾 | `save` |
| 공유 | 📤 | `share` |
| 다운로드 | ⬇️ | `download` |
| 업로드 | ⬆️ | `upload_file` |
| **상태** | | |
| 상승 | ⬆ | `trending_up` |
| 하락 | ⬇ | `trending_down` |
| 경고 | ⚠️ | `warning` |
| 알림 | 🔔 | `notifications` |
| 번개 | ⚡ | `bolt` |
| **UI** | | |
| 펼치기 | ▼ | `expand_more` |
| 접기 | ▲ | `expand_less` |
| 좌 | ◀ | `chevron_left` |
| 우 | ▶ | `chevron_right` |
| 메뉴 | ☰ | `menu` |
| 필터 | 🔽 | `filter_list` |
| 정렬 | ↕ | `sort` |
| 차트 | 📊 | `bar_chart` |
| 설정 | ⚙ | `settings` |

---

## 9. 금액/숫자 포맷

```javascript
// 금액
const fmtW = n => {
  if (n >= 100000000) return `${(n/100000000).toFixed(1)}억`;
  if (n >= 10000) return `${Math.round(n/10000).toLocaleString()}만`;
  return `${Math.round(n).toLocaleString()}원`;
};
// → "2.4억", "8,200만", "34,500원"

// 숫자 축약
const fmtN = v => Number(v||0).toLocaleString();
// → "1,234"

// 퍼센트
const fmtP = v => `${Number(v).toFixed(1)}%`;
// → "44.3%"
```

---

## 10. DO & DON'T

### ✅ DO
- 숫자는 크고 굵게 → `fontSize:17, fontWeight:900`
- 라벨은 작고 연하게 → `fontSize:10, color:"#A1A1AA"`
- 변동에는 항상 색상 + 기호 → `▲ +15%` (초록)
- 카드 간격 8~12px
- 클릭 가능한 요소에 `cursor:"pointer"`
- 상태 즉시 인지 (빨/초/노)
- `overflow:"hidden"` + `textOverflow:"ellipsis"` 긴 텍스트
- 모바일에서 테스트

### ❌ DON'T
- 이모지 남용 → Material Icons 사용
- 테두리 2px+ → 1~1.5px만
- 3단 이상 중첩
- 고정 너비 → flex/grid 사용
- fontWeight 400 (Regular) → 최소 600
- 순수 검정 `#000` → `#18181B` 사용
- 순수 흰색 배경 BG → `#FAFAF9` 사용
- 같은 정보 중복 표시
