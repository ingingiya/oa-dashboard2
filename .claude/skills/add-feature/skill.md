---
name: add-feature
description: "OA 대시보드에 새 기능/탭 추가. '탭 추가해줘', '기능 넣어줘', '테이블 만들어줘' 요청 시 사용. Dashboard.jsx 수정 패턴 가이드 포함."
---

# Add Feature — 대시보드 기능 추가

## Dashboard.jsx 수정 패턴

### 시장가조사 서브탭 추가
```jsx
// 1. 상수 정의 (MKT_OLIVE_TAB 근처)
const MKT_NEW_TAB = "🆕새탭";

// 2. 탭 버튼 추가 (올리브영 버튼 뒤)
<button onClick={()=>setMktCategoryTab(MKT_NEW_TAB)}
  style={{padding:"8px 14px",background:"none",border:"none",
    borderBottom:`2px solid ${mktCategoryTab===MKT_NEW_TAB?"#색상":"transparent"}`,
    color:mktCategoryTab===MKT_NEW_TAB?"#색상":C.inkMid,
    fontWeight:mktCategoryTab===MKT_NEW_TAB?800:600,
    fontSize:12,cursor:"pointer",fontFamily:"inherit",marginBottom:-1}}>
  🆕 새탭
</button>

// 3. 렌더링 블록 (올리브영 블록 뒤)
{mktCategoryTab===MKT_NEW_TAB&&(()=>{
  // 데이터 로드 + UI 렌더
  return(<div>...</div>);
})()}
```

### Supabase 직접 호출 패턴
```jsx
const SURL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SKEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sH = {apikey:SKEY, Authorization:`Bearer ${SKEY}`};

fetch(`${SURL}/rest/v1/테이블명?select=*&order=id.asc`, {headers:sH})
  .then(r=>r.json())
  .then(d=>setState(Array.isArray(d)?d:[]));
```

### 테이블 컬럼 패턴
```jsx
<table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
  <thead><tr style={{background:C.cream}}>
    {["컬럼1","컬럼2","컬럼3"].map(h=>(
      <th key={h} style={{padding:"6px 8px",textAlign:"left",
        fontWeight:700,color:C.inkMid,
        borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
    ))}
  </tr></thead>
  <tbody>
    {items.map(item=>(
      <tr key={item.id} style={{borderBottom:`1px solid ${C.cream}`}}>
        <td style={{padding:"6px 8px"}}>{item.field1}</td>
      </tr>
    ))}
  </tbody>
</table>
```

## 체크리스트
- [ ] 상태 변수 추가 (useState)
- [ ] 상수 정의
- [ ] 탭 버튼 추가
- [ ] 렌더링 블록 추가
- [ ] 배포 (/deploy)
