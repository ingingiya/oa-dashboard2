'use client'

import { useState, useEffect, useCallback, useRef } from "react";
import { getSetting, setSetting, getAdImages, saveAdImagesMeta, uploadAdImage } from "../lib/useSupabase";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Supabase 동기화 훅 — 팀 전체 공유 (localStorage 대체)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function useSupabaseState(key, def) {
  const [data, setData] = useState(def);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const pendingSave = useRef(null); // 로드 전 save 요청 보관

  useEffect(() => {
    getSetting(key).then(v => {
      // Supabase에 값 있으면 적용, 없으면 def 유지 (절대 덮어쓰기 안 함)
      if(v !== null && v !== undefined) setData(v);
      loadedRef.current = true;
      setLoaded(true);
      // 로드 전에 save 요청 있었으면 이제 실행
      if(pendingSave.current !== null){
        setSetting(key, pendingSave.current);
        pendingSave.current = null;
      }
    }).catch(() => {
      loadedRef.current = true;
      setLoaded(true);
    });
  // eslint-disable-next-line
  }, [key]);

  const save = useCallback(async (v) => {
    setData(v); // UI는 즉시 반영
    if(!loadedRef.current){
      // 아직 로드 중이면 pending에 보관 (나중에 저장)
      pendingSave.current = v;
      return;
    }
    await setSetting(key, v);
  }, [key]);

  return [data, save, loaded];
}
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 팔레트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const C = {
  // 토스 블루+화이트+그레이
  rose:"#2563EB", roseLt:"#3B82F6", blush:"#EFF6FF",
  cream:"#F8FAFC", gold:"#2563EB", goldLt:"#DBEAFE",
  sage:"#16A34A", sageLt:"#F0FDF4",
  ink:"#18181B", inkMid:"#52525B", inkLt:"#A1A1AA",
  white:"#FFFFFF", border:"#E4E4E7",
  good:"#16A34A", warn:"#EA580C", bad:"#DC2626",
  purple:"#2563EB", purpleLt:"#EFF6FF",
  // 배경
  bg:"#F4F4F5",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Material Symbol Icon helper
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function MI({n, size=16, style={}}) {
  return <span className="material-symbols-outlined" style={{fontSize:size,lineHeight:1,verticalAlign:"middle",flexShrink:0,...style}}>{n}</span>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 썸네일 hover 프리뷰
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ThumbPreview({ url, name }) {
  const [pos, setPos] = useState(null);
  if (!url) return null;
  const isVideo = /\.(mp4|mov|webm|avi)$/i.test(url) || url.includes("video");
  return (
    <span style={{position:"relative",display:"inline-block",verticalAlign:"middle",marginRight:6}}>
      {isVideo ? (
        <div
          style={{width:56,height:56,borderRadius:8,objectFit:"cover",cursor:"pointer",
            border:"1px solid #E4E4E7",background:"#F4F4F5",display:"flex",alignItems:"center",
            justifyContent:"center",fontSize:22}}
          onMouseEnter={e=>{const r=e.currentTarget.getBoundingClientRect();setPos({x:r.right+8,y:r.top});}}
          onMouseMove={e=>setPos({x:e.clientX+12,y:e.clientY-150})}
          onMouseLeave={()=>setPos(null)}
        >🎬</div>
      ) : (
        <img src={url} alt={name}
          style={{width:56,height:56,borderRadius:8,objectFit:"cover",cursor:"pointer",border:"1px solid #E4E4E7"}}
          onMouseEnter={e=>{const r=e.target.getBoundingClientRect();setPos({x:r.right+8,y:r.top});}}
          onMouseMove={e=>setPos({x:e.clientX+12,y:e.clientY-150})}
          onMouseLeave={()=>setPos(null)}
        />
      )}
      {pos&&(
        <div style={{position:"fixed",left:pos.x,top:pos.y,zIndex:9999,pointerEvents:"none",
          boxShadow:"0 8px 32px rgba(0,0,0,0.15)",borderRadius:12,overflow:"hidden",border:"1px solid #E4E4E7",background:"#fff"}}>
          {isVideo ? (
            <video src={url} style={{width:280,height:280,objectFit:"cover",display:"block"}} autoPlay muted loop playsInline/>
          ) : (
            <img src={url} alt={name} style={{width:280,height:280,objectFit:"cover",display:"block"}}/>
          )}
          <div style={{padding:"6px 10px",background:"#fff",fontSize:10,color:"#52525B",fontWeight:600}}>{name}</div>
        </div>
      )}
    </span>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 기본 로컬 데이터
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const DEFAULT_INF = [];
// 기본 키워드별 마진 설정
const DEFAULT_MARGINS = [
  {id:1, keyword:"프리온",   margin:20000},
  {id:2, keyword:"소닉플로우", margin:35000},
];

const DEFAULT_INV = [
  {id:1,name:"세럼 30ml (베스트셀러)",sku:"SKU-001",stock:1240,ordered:0,  reorder:500,sold30:920, category:"세럼"},
  {id:2,name:"세럼 50ml",            sku:"SKU-002",stock:340, ordered:500, reorder:400,sold30:510, category:"세럼"},
  {id:3,name:"선크림 SPF50 50ml",    sku:"SKU-003",stock:2140,ordered:0,  reorder:600,sold30:840, category:"선케어"},
  {id:4,name:"토너 패드 60매",        sku:"SKU-004",stock:88,  ordered:300, reorder:300,sold30:420, category:"토너"},
  {id:5,name:"립밤 세트 (3종)",       sku:"SKU-005",stock:640, ordered:0,  reorder:200,sold30:280, category:"립"},
  {id:6,name:"클렌징 폼 150ml",       sku:"SKU-006",stock:1820,ordered:0,  reorder:500,sold30:640, category:"클렌저"},
  {id:7,name:"아이크림 15ml",         sku:"SKU-007",stock:210, ordered:250, reorder:250,sold30:310, category:"아이케어"},
];
const DEFAULT_SCH = [
  {id:1,type:"공구",   title:"세럼 30ml 공구 오픈",     date:"2025-03-10",endDate:"2025-03-12",platform:"네이버 스마트스토어",note:"한정 200개, 20% 할인",status:"예정"},
  {id:2,type:"시딩",   title:"@glowwith_miso 2차 시딩", date:"2025-03-15",endDate:"",          platform:"인스타그램",          note:"세럼 50ml 신제품",   status:"예정"},
  {id:3,type:"광고",   title:"선크림 봄 캠페인 론칭",    date:"2025-03-20",endDate:"2025-04-20",platform:"Meta 전환",           note:"예산 ₩3,000K",      status:"예정"},
  {id:4,type:"이벤트", title:"봄 기획전",               date:"2025-03-22",endDate:"2025-03-25",platform:"전 채널",             note:"선물세트 패키지",    status:"준비중"},
  {id:5,type:"공구",   title:"립밤 세트 공동구매",       date:"2025-02-20",endDate:"2025-02-22",platform:"카카오 쇼핑",         note:"완료",              status:"완료"},
];
// 구글 시트 URL 저장 키
// Supabase key 상수 (useSupabaseState에서 직접 사용)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 유틸
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TODAY: 모듈 레벨에서 한 번만 계산 (서버/클라이언트 동일)
const TODAY = new Date(); TODAY.setHours(0,0,0,0);
const todayStr = "오늘"; // 하이드레이션 불일치 방지 — 날짜는 컴포넌트에서 표시

function addDays(ds,n){ if(!ds)return null; const d=new Date(ds); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function daysUntil(ds){ if(!ds)return null; return Math.ceil((new Date(ds)-TODAY)/86400000); }
function insightStatus(f){
  if(!f.postedDate) return {label:"미게시",  color:C.inkLt,bg:C.cream,   icon:"inventory_2"};
  if(f.reach!==null) return {label:"기록완료",color:C.good, bg:"#EDF7F1", icon:"check_circle"};
  const due=addDays(f.postedDate,7), d=daysUntil(due);
  if(d>0)   return {label:`D-${d} 대기`,         color:C.inkLt,bg:C.cream,  icon:"hourglass_empty"};
  if(d===0) return {label:"오늘 입력!",           color:C.rose, bg:C.blush,  icon:"🔔"};
  return         {label:`D+${Math.abs(d)} 미입력`,color:C.bad,  bg:"#FEF0F0",icon:"❗"};
}
function stockDays(i){ return Math.round(i.stock/Math.max(i.sold30/30,0.01)); }
function stockStatus(i){
  const d=stockDays(i);
  if(d<7)  return {label:"위험",color:C.bad, bg:"#FEF0F0"};
  if(d<21) return {label:"주의",color:C.warn,bg:"#FFF8EC"};
  return        {label:"정상",color:C.good,bg:"#EDF7F1"};
}
// 2차 활용 만료일 계산 (게시일+3개월)
function reusableExpiry(postedDate){
  if(!postedDate) return null;
  const d = new Date(postedDate);
  d.setMonth(d.getMonth()+3);
  return d.toISOString().slice(0,10);
}
function reusableStatus(f){
  if(!f.videoReceived) return {label:"미수령",color:C.inkLt,bg:C.cream};
  if(!f.reusable)      return {label:"활용불가",color:C.bad,bg:"#FEF0F0"};
  const exp = reusableExpiry(f.postedDate);
  if(!exp) return {label:"활용가능",color:C.good,bg:"#EDF7F1"};
  const d = daysUntil(exp);
  if(d<0)  return {label:"만료",color:C.inkLt,bg:C.cream};
  if(d<=14) return {label:`D-${d} 만료임박`,color:C.warn,bg:"#FFF8EC"};
  return {label:`~${exp.slice(5)} 활용가능`,color:C.good,bg:"#EDF7F1"};
}
// ── 광고 소재 판단 기준 ─────────────────────────
function lpvCostStatus(spend, lpv, c={}){
  if(!lpv||!spend) return null;
  const cost = spend/lpv;
  const g=c.lpvCostGood||300, ok=c.lpvCostOk||500, h=c.lpvCostHold||800;
  if(cost<g)  return {label:"매우좋음", color:C.good, bg:"#EDF7F1", icon:"circle", cost:Math.round(cost)};
  if(cost<ok) return {label:"유지",     color:C.sage, bg:C.sageLt,  icon:"🔵", cost:Math.round(cost)};
  if(cost<h)  return {label:"보류",     color:C.warn, bg:"#FFF8EC", icon:"🟡", cost:Math.round(cost)};
  return             {label:"컷",       color:C.bad,  bg:"#FEF0F0", icon:"🔴", cost:Math.round(cost)};
}
function lpvRateStatus(clicks, lpv, c={}){
  if(!clicks||!lpv) return null;
  const rate = (lpv/clicks)*100;
  const g=c.lpvRateGood||70, ok=c.lpvRateOk||50;
  if(rate>=g)  return {label:"정상",    color:C.good, bg:"#EDF7F1", icon:"check_circle", rate:rate.toFixed(1)};
  if(rate>=ok) return {label:"보통",    color:C.warn, bg:"#FFF8EC", icon:"warning", rate:rate.toFixed(1)};
  return             {label:"랜딩문제", color:C.bad,  bg:"#FEF0F0", icon:"🚨", rate:rate.toFixed(1)};
}
function cpaStatus(spend, purchases, margin, c={}){
  if(!purchases||!spend||!margin) return null;
  const cpa = spend/purchases;
  const ratio = (cpa/margin)*100;
  const g=c.cpaGood||85, h=c.cpaHold||100;
  if(ratio<=g)  return {label:"유지", color:C.good, bg:"#EDF7F1", icon:"check_circle", cpa:Math.round(cpa)};
  if(ratio<=h)  return {label:"보류", color:C.warn, bg:"#FFF8EC", icon:"warning", cpa:Math.round(cpa)};
  return              {label:"컷",   color:C.bad,  bg:"#FEF0F0", icon:"🔴", cpa:Math.round(cpa)};
}
function ctrStatus(clicks, impressions, c={}){
  if(!impressions||!clicks) return null;
  const ctr = (clicks/impressions)*100;
  const g=c.ctrGood||2, ok=c.ctrOk||1;
  if(ctr>=g)  return {label:"좋음",    color:C.good, bg:"#EDF7F1", icon:"circle", ctr:ctr.toFixed(2)};
  if(ctr>=ok) return {label:"보통",    color:C.warn, bg:"#FFF8EC", icon:"🟡", ctr:ctr.toFixed(2)};
  return            {label:"소재문제", color:C.bad,  bg:"#FEF0F0", icon:"🔴", ctr:ctr.toFixed(2)};
}
// 광고명/캠페인명에서 키워드 마진 찾기
function getAdMargin(adName, campaignName, margins, defaultMargin){
  const text = (adName + " " + campaignName).toLowerCase();
  const matched = (margins||[]).find(m => m.keyword && text.includes(m.keyword.toLowerCase()));
  return matched ? matched.margin : defaultMargin;
}
// 광고명/캠페인명에서 트래픽 CPC 상한 찾기
function getTrafficCpcMax(adName, campaignName, criteria){
  const text = ((adName||"") + " " + (campaignName||"")).toLowerCase();
  const kws = criteria?.cpcKeywords||[];
  const matched = kws.find(k=>k.keyword&&text.includes(k.keyword.toLowerCase()));
  return matched ? (matched.cpcMax||criteria?.cpcMax||600) : (criteria?.cpcMax||600);
}
// 광고명/캠페인명에서 제품별 전환 기준값 찾기
function getConvCriteria(adName, campaignName, convCriteria){
  const text = ((adName||"") + " " + (campaignName||"")).toLowerCase();
  const products = convCriteria?.products||[];
  const matched = products.find(p=>p.keyword&&text.includes(p.keyword.toLowerCase()));
  return matched || convCriteria || {};
}

function adScore(ad, margin, c={}){
  const issues = [];
  const lpvC = lpvCostStatus(ad.spend, ad.lpv, c);
  const lpvR = lpvRateStatus(ad.clicks, ad.lpv, c);
  const cpa  = cpaStatus(ad.spend, ad.purchases, margin, c);
  const ctr  = ctrStatus(ad.clicks||ad.clicksAll, ad.impressions, c);
  if(lpvC&&(lpvC.label==="컷"||lpvC.label==="보류"))   issues.push({type:"LPV단가",  ...lpvC});
  if(lpvR&&(lpvR.label==="랜딩문제"))                   issues.push({type:"LPV전환율",...lpvR});
  if(cpa &&(cpa.label==="컷"||cpa.label==="보류"))      issues.push({type:"CPA",      ...cpa});
  if(ctr &&(ctr.label==="소재문제"||ctr.label==="보통")) issues.push({type:"CTR",      ...ctr});
  return {issues, lpvC, lpvR, cpa, ctr};
}

function schTypeColor(t){ return {소재제작:"#7c3aed",광고:C.gold,시딩:C.purple,이벤트:C.sage,행사:"#f97316",공구:C.rose,촬영:"#0891b2",인스타:"#e1306c",트위터:"#1da1f2",반복:"#94a3b8"}[t]||C.inkMid; }
function schTypeIcon(t){  return {소재제작:"brush",광고:"campaign",시딩:"auto_awesome",이벤트:"celebration",행사:"flag",공구:"shopping_bag",촬영:"photo_camera",인스타:"photo_camera",트위터:"alternate_email",반복:"check_box"}[t]||"push_pin"; }

// useLocal은 useSupabaseState로 대체됨

// ── 팀 공유 상태 훅 (localStorage 즉시 + Supabase 동기화) ──────────
// ── 팀 공유 상태 훅 — Supabase 전용 ─────────────────────────────
// 로드 전엔 기본값으로 표시, 로드 완료 후에만 저장 허용
function useSyncState(key, def) {
  const [data, setDataRaw] = useState(def);
  const loadedRef = useRef(false);

  useEffect(()=>{
    getSetting(key).then(v=>{
      if(v !== null && v !== undefined) setDataRaw(v);
      loadedRef.current = true;
    }).catch(()=>{ loadedRef.current = true; });
  // eslint-disable-next-line
  },[key]);

  const setData = useCallback((vOrFn)=>{
    setDataRaw(prev=>{
      const val = typeof vOrFn==="function" ? vOrFn(prev) : vOrFn;
      // 로드 완료 후에만 Supabase에 저장 (초기화 방지)
      if(loadedRef.current) setSetting(key, val).catch(()=>{});
      return val;
    });
  },[key]);

  return [data, setData];
}

// CSV 파싱 — 따옴표 안 쉼표/개행 처리, 헤더 자동 감지
function parseCSV(text){
  // RFC4180 CSV 파서 — 따옴표 안 쉼표/개행 정확히 처리
  const parseLine = line => {
    const res=[]; let cur="", inQ=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='"'){
        if(inQ && line[i+1]==='"'){ cur+='"'; i++; } // escaped quote
        else inQ=!inQ;
      } else if(c===','&&!inQ){ res.push(cur.trim()); cur=""; }
      else cur+=c;
    }
    res.push(cur.trim());
    return res;
  };

  const lines = text.trim().split("\n");
  if(lines.length<2) return [];

  // 헤더 행 찾기 — "캠페인 이름" 또는 "지출 금액" 포함한 행
  const HEADER_HINTS = ["캠페인 이름","지출 금액","광고 이름","campaign","impressions"];
  let startIdx = 0;
  for(let i=0;i<Math.min(lines.length,5);i++){
    if(HEADER_HINTS.some(h=>lines[i].includes(h))){ startIdx=i; break; }
  }

  const headers = parseLine(lines[startIdx]);

  // 숫자여야 할 헤더 목록 (노출, 지출금액 등)
  const NUMERIC_HEADERS = new Set(["노출","노출 수","클릭(전체)","지출 금액 (KRW)","지출 금액","impressions","spend"]);

  return lines.slice(startIdx+1).filter(l=>l.trim()).map(row=>{
    const cols = parseLine(row);
    const obj={};

    // 컬럼 수가 맞지 않으면 오프셋 자동 감지:
    // 헤더가 숫자를 기대하는 위치에 텍스트가 오면 그 위치부터 1칸 밀어서 읽음
    let offset = 0;
    if(cols.length > headers.length) {
      // 데이터가 헤더보다 많은 경우 - 어느 위치에 extra 컬럼이 있는지 탐색
      for(let i=0;i<headers.length;i++){
        if(NUMERIC_HEADERS.has(headers[i])){
          const val = cols[i + offset];
          if(val && isNaN(parseFloat(val.replace(/,/g,"")))) {
            offset++; // 이 위치부터 1칸씩 밀림
            break;
          }
        }
      }
    } else if(cols.length === headers.length) {
      // 컬럼 수는 같지만 숫자 헤더에 텍스트가 들어온 경우 감지
      for(let i=0;i<headers.length;i++){
        if(NUMERIC_HEADERS.has(headers[i])){
          const val = cols[i];
          if(val && isNaN(parseFloat(val.replace(/,/g,"")))) {
            // 다음 값이 숫자면 extra 컬럼이 있는 것
            const nextVal = cols[i+1];
            if(nextVal && !isNaN(parseFloat(nextVal.replace(/,/g,"")))) {
              offset = 1;
              // headers에 phantom 컬럼 삽입해서 i 위치부터 1칸 밀기
              break;
            }
          }
        }
      }
    }

    if(offset > 0) {
      // 오프셋이 감지된 경우: 첫 번째 숫자 헤더 위치부터 cols를 1칸 뒤에서 읽음
      let shifted = false;
      headers.forEach((h,i)=>{
        if(!h) return;
        if(!shifted && NUMERIC_HEADERS.has(h)) shifted = true;
        obj[h] = shifted ? (cols[i+offset]||"") : (cols[i]||"");
      });
    } else {
      headers.forEach((h,i)=>{ if(h) obj[h]=cols[i]||""; });
    }
    return obj;
  });
}

// 광고세트명에서 시작일 추출 (예: "250101-250331_세럼" → "2025-01-01")
function extractAdsetStartDate(adsetName) {
  if(!adsetName) return null;
  const m8 = adsetName.match(/(?:^|[^0-9])(\d{8})(?:[^0-9]|$)/);
  if(m8) {
    const s=m8[1];
    const y=s.slice(0,4),mo=s.slice(4,6),d=s.slice(6,8);
    if(+mo>=1&&+mo<=12&&+d>=1&&+d<=31) return `${y}-${mo}-${d}`;
  }
  const m6 = adsetName.match(/(?:^|[^0-9])(\d{6})(?:[^0-9]|-|$)/);
  if(m6) {
    const s=m6[1];
    const yy=s.slice(0,2),mo=s.slice(2,4),d=s.slice(4,6);
    if(+mo>=1&&+mo<=12&&+d>=1&&+d<=31) return `20${yy}-${mo}-${d}`;
  }
  return null;
}

// 메타 컬럼 매핑 — 실제 광고관리자 내보내기 기준
function mapMetaRow(row){
  // 원본 컬럼명 그대로 접근하는 헬퍼
  const g=(...keys)=>{
    for(const k of keys){
      if(row[k]!==undefined&&row[k]!==null&&row[k]!=="") return row[k];
    }
    // 대소문자/공백 무시 fallback
    const rowKeys=Object.keys(row);
    for(const k of keys){
      const norm=k.replace(/\s/g,"").toLowerCase();
      const found=rowKeys.find(rk=>rk.replace(/\s/g,"").toLowerCase()===norm);
      if(found&&row[found]!==undefined&&row[found]!==null&&row[found]!=="") return row[found];
    }
    return "";
  };
  const num=v=>{
    if(v===null||v===undefined||v==="") return 0;
    const n=parseFloat(String(v).replace(/,/g,"").replace(/[^0-9.-]/g,""));
    return isNaN(n)?0:n;
  };

  // 날짜 정규화 → YYYY-MM-DD
  const normalizeDate = v => {
    if(!v) return "";
    const s = String(v).trim();
    // 이미 YYYY-MM-DD
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // YYYY. M. D. / YYYY. MM. DD. (한국 구글시트)
    const ko = s.match(/^(\d{4})[.\s]+(\d{1,2})[.\s]+(\d{1,2})/);
    if(ko) return `${ko[1]}-${ko[2].padStart(2,"0")}-${ko[3].padStart(2,"0")}`;
    // M/D/YYYY 또는 MM/DD/YYYY
    const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(us) return `${us[3]}-${us[1].padStart(2,"0")}-${us[2].padStart(2,"0")}`;
    // YYYY/MM/DD
    const ymd = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if(ymd) return `${ymd[1]}-${ymd[2].padStart(2,"0")}-${ymd[3].padStart(2,"0")}`;
    return s;
  };

  const out = {
    date: normalizeDate(g("일","날짜","보고 시작","date")),
    campaign:   g("캠페인 이름","campaign_name","campaign"),
    adset:      g("광고 세트 이름","adset_name"),
    adId:       g("광고 ID","ad_id","광고id","광고ID"),
    adName:     g("광고 이름","ad_name"),
    // 목표: OUTCOME_SALES / LINK_CLICKS 등 — 전환/트래픽 분류 핵심
    objective:  (g("목표","목적","캠페인 목표","목표 유형","광고 목표","objective")||"").trim(),
    resultType: (g("결과 유형","result_type")||"").trim(),
    spend:      num(g("지출 금액 (KRW)","지출 금액 (KRW)","지출 금액","금액","amount_spent","spend")),
    impressions:num(g("노출","노출 수","impressions")),
    clicks:     num(g("링크 클릭 수","링크 클릭","link_clicks","inline_link_clicks")),
    clicksAll:  num(g("클릭(전체)","클릭 (전체)","클릭수","clicks")),
    lpv:        num(g("랜딩 페이지 조회","랜딩 페이지 조회 수","landing_page_views")),
    purchases:  num(g("공유 항목이 포함된 구매","웹사이트 구매","구매 완료","구매","결과","purchases","result","website_purchase","omni_purchase")),
    cart:       num(g("공유 항목이 포함된 장바구니에 담기","장바구니에 담기","add_to_cart")),
    convValue:  num(g("공유 항목의 구매 전환값","공유 항목의 웹사이트 구매 전환값","웹사이트 구매 전환값","구매 전환값","전환값","conversion_value","website_purchase_value")),
    cpc:        num(g("CPC(링크 클릭당 비용)","CPC (링크 클릭당 비용)","링크 클릭당 비용","cpc","cost_per_link_click")),
    cpcAll:     num(g("CPC(전체)","CPC (전체)")),
    ctr:        num(g("CTR(전체)","CTR (전체)","CTR(링크 클릭률)","CTR (링크 클릭률)","ctr")),
    cpa:        num(g("결과당 비용","결과 당 비용","cost_per_result","cpa")),
    cpm:        num(g("CPM(1,000회 노출당 비용)","CPM (1,000회 노출당 비용)","CPM","cpm")),
    campaignBudget:     num(g("캠페인 예산","campaign_budget")),
    campaignBudgetType: g("캠페인 예산 유형","campaign_budget_type"),
    adsetBudget:        num(g("광고 세트 예산","adset_budget")),
    adsetBudgetType:    g("광고 세트 예산 유형","adset_budget_type"),
  };
  // CPC fallback: 컬럼에 없으면 spend/clicks로 계산
  const _clicks = out.clicks || out.clicksAll || 0;
  if(!out.cpc && out.spend > 0 && _clicks > 0) out.cpc = Math.round(out.spend / _clicks);
  return out;
}

// 전환/트래픽 분류 — 목표 컬럼 우선, 그 다음 캠페인명
function isConversionCampaign(objective, campaignName="", resultType=""){
  const obj = (objective||"").trim().toUpperCase();
  // 목표 컬럼으로 정확히 분류 (OUTCOME_SALES / LINK_CLICKS)
  if(["OUTCOME_SALES","OUTCOME_ENGAGEMENT","CONVERSIONS","SALES","WEBSITE_CONVERSIONS","PRODUCT_CATALOG_SALES"].includes(obj)) return true;
  if(["LINK_CLICKS","OUTCOME_TRAFFIC","REACH","BRAND_AWARENESS","OUTCOME_AWARENESS","OUTCOME_LEADS"].includes(obj)) return false;
  // 결과 유형 컬럼으로 보조 판단 (목표 컬럼 없을 때)
  const rt = (resultType||"").toLowerCase();
  if(rt && ["구매","purchase","전환","웹사이트 구매","website_purchase"].some(k=>rt.includes(k))) return true;
  if(rt && ["링크 클릭","link_click","클릭","트래픽","reach"].some(k=>rt.includes(k))) return false;
  // 목표가 없을 때 캠페인명으로 fallback
  const name=(campaignName||"").toLowerCase();
  if(["전환","conversion","purchase","구매","sales"].some(k=>name.includes(k))) return true;
  if(["트래픽","traffic","클릭","link_click"].some(k=>name.includes(k))) return false;
  return false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 공통 UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const Card=({children,style={}})=>(
  <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 16px",...style}}>{children}</div>
);
const CardTitle=({title,sub,action})=>(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
    <div>
      <div style={{fontSize:13,fontWeight:800,color:C.ink}}>{title}</div>
      {sub&&<div style={{fontSize:10,color:C.inkLt,marginTop:2}}>{sub}</div>}
    </div>
    {action}
  </div>
);
const Btn=({children,onClick,variant="primary",small=false,disabled=false,style={}})=>{
  const v={
    primary:{background:C.rose,  color:C.white,  border:"none",      boxShadow:`0 3px 10px ${C.rose}44`},
    ghost:  {background:C.blush, color:C.rose,   border:`1px solid ${C.rose}44`},
    sage:   {background:C.sageLt,color:C.sage,   border:`1px solid ${C.sage}44`},
    danger: {background:"#FEF0F0",color:C.bad,   border:`1px solid ${C.bad}33`},
    neutral:{background:C.cream, color:C.inkMid, border:`1px solid ${C.border}`},
    gold:   {background:C.goldLt,color:C.gold,   border:`1px solid ${C.gold}44`},
  }[variant];
  return(
    <button onClick={onClick} disabled={disabled}
      style={{...v,borderRadius:8,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",
        fontWeight:700,fontSize:small?10:12,padding:small?"5px 10px":"8px 16px",
        transition:"all 0.15s",opacity:disabled?0.5:1,...style}}>
      {children}
    </button>
  );
};
const Inp=({value,onChange,placeholder,type="text",style={}})=>(
  <input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{width:"100%",padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:9,
      fontSize:12,color:C.ink,background:C.cream,outline:"none",fontFamily:"inherit",...style}}
    onFocus={e=>e.target.style.borderColor=C.rose} onBlur={e=>e.target.style.borderColor=C.border}/>
);
const Sel=({value,onChange,options,style={}})=>(
  <select value={value} onChange={e=>onChange(e.target.value)}
    style={{width:"100%",padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:9,
      fontSize:12,color:C.ink,background:C.cream,outline:"none",fontFamily:"inherit",...style}}>
    {options.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
  </select>
);
const Modal=({title,onClose,children,wide=false})=>(
  <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(43,31,46,0.45)",backdropFilter:"blur(4px)",
    display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
    <div style={{background:C.white,borderRadius:20,padding:"24px",width:"100%",maxWidth:wide?640:440,
      boxShadow:"0 24px 60px rgba(43,31,46,0.2)",maxHeight:"92vh",overflowY:"auto"}}
      onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:14,fontWeight:900,color:C.ink}}>{title}</div>
        <button onClick={onClose} style={{background:C.cream,border:"none",borderRadius:8,width:28,height:28,
          cursor:"pointer",fontSize:14,color:C.inkMid,fontWeight:700}}>✕</button>
      </div>
      {children}
    </div>
  </div>
);
const FR=({label,children})=>(
  <div style={{marginBottom:12}}>
    <div style={{fontSize:11,fontWeight:700,color:C.inkMid,marginBottom:5}}>{label}</div>
    {children}
  </div>
);
const BeautyTooltip=({active,payload,label,fmt})=>{
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",
      boxShadow:`0 8px 24px rgba(43,31,46,0.12)`,fontSize:11,minWidth:140}}>
      <p style={{color:C.rose,fontWeight:700,marginBottom:5}}>{label}</p>
      {payload.map((p,i)=>(
        <p key={i} style={{color:C.inkMid,margin:"2px 0"}}>{p.name}:{" "}
          <span style={{color:C.ink,fontWeight:700}}>
            {fmt ? fmt(p.value) : typeof p.value==="number"?p.value.toLocaleString():p.value}
          </span>
        </p>
      ))}
    </div>
  );
};
const KpiGrid=({items,cols=6})=>(
  <div className={cols===6?"kpi-grid":"kpi-grid-3"} style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:10,marginBottom:18}}>
    {items.map((k,i)=>{
      const good = k.change===0 ? true : k.good==="high"?k.change>0:k.change<0;
      return(
        <div key={i} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,
          padding:"14px 14px 12px",position:"relative",overflow:"hidden",
          transition:"box-shadow 0.2s,transform 0.2s",cursor:"default"}}
          onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 6px 20px rgba(232,86,122,0.13)`;e.currentTarget.style.transform="translateY(-2px)"}}
          onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="translateY(0)"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,
            background:good?`linear-gradient(90deg,${C.good},${C.good}66)`:`linear-gradient(90deg,${C.bad},${C.bad}66)`}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div style={{fontSize:18}}>{k.icon&&typeof k.icon==="string"&&k.icon.length<30?<MI n={k.icon} size={18}/>:k.icon}</div>
            {k.change!==0&&(
              <span style={{fontSize:10,fontWeight:700,color:good?C.good:C.bad,
                background:good?"#EDF7F1":"#FEF0F0",padding:"2px 6px",borderRadius:20}}>
                {k.change>0?"↑":"↓"}{Math.abs(k.change)}%</span>
            )}
          </div>
          <div style={{fontSize:9,color:C.inkLt,fontWeight:700,letterSpacing:"0.1em",marginBottom:3}}>{k.label.toUpperCase()}</div>
          <div style={{fontSize:18,fontWeight:900,color:C.ink,letterSpacing:"-0.02em",lineHeight:1}}>{k.value}</div>
          <div style={{fontSize:9,color:C.inkLt,marginTop:4}}>{k.note}</div>
        </div>
      );
    })}
  </div>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN APP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 독립 모달 컴포넌트 — 내부 상태 관리, 외부 리렌더 차단
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 인플루언서 추가/수정 모달
function InfModalComp({mode, initial, onSave, onClose}){
  const eInf = {name:"",displayName:"",tier:"무료",followers:"—",platform:"인스타",product:"",sent:1,posted:0,postedDate:null,reach:null,saves:null,clicks:null,conv:null,videoReceived:false,reusable:false,metaUsed:false,note:"",paid:false};
  const [f, setF] = useState(()=>initial||eInf);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  return(
    <Modal title={mode==="edit"?<><MI n="edit"/> 인플루언서 수정</>:<><MI n="add"/> 인플루언서 추가</>} onClose={onClose}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <FR label="실명 / 닉네임"><Inp value={f.displayName||""} onChange={v=>set("displayName",v)} placeholder="경서"/></FR>
        <FR label="계정 (핸들)"><Inp value={f.name} onChange={v=>set("name",v)} placeholder="@seoooazi"/></FR>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <FR label="티어"><Sel value={f.tier} onChange={v=>set("tier",v)} options={["유료","무료"]}/></FR>
        <FR label="팔로워"><Inp value={f.followers} onChange={v=>set("followers",v)} placeholder="예: 28K"/></FR>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <FR label="플랫폼"><Sel value={f.platform} onChange={v=>set("platform",v)} options={["인스타","유튜브","틱톡","블로그"]}/></FR>
        <FR label="제품"><Inp value={f.product} onChange={v=>set("product",v)} placeholder="프리온무선고데기-유료"/></FR>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <FR label="게시일"><Inp type="date" value={f.postedDate||""} onChange={v=>set("postedDate",v)}/></FR>
        <FR label="게시 여부"><Sel value={String(f.posted)} onChange={v=>set("posted",v==="1"?1:0)} options={["0","1"]}/></FR>
      </div>
      <FR label="메모"><Inp value={f.note||""} onChange={v=>set("note",v)} placeholder="릴스/2차활용가능 3개월"/></FR>
      {f.tier==="유료"&&(
      <div style={{borderTop:`1px solid ${C.border}`,margin:"12px 0 8px",paddingTop:10}}>
        <div style={{fontSize:11,fontWeight:800,color:C.ink,marginBottom:8}}>📹 콘텐츠 활용</div>
        {[{key:"videoReceived",label:"🎬 영상 수령 완료"},{key:"reusable",label:"♻️ 2차 활용 가능"},{key:"metaUsed",label:"📣 메타 광고 소재 활용"},{key:"paid",label:"💰 2차활용 비용 입금 완료"}].map(({key,label})=>(
          <label key={key} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer"}}>
            <input type="checkbox" checked={!!f[key]} onChange={e=>set(key,e.target.checked)} style={{width:15,height:15,accentColor:C.rose}}/>
            <span style={{fontSize:11,color:C.ink}}>{label}</span>
          </label>
        ))}
      </div>
      )}
      <Btn onClick={()=>{if(!f.name)return; onSave({...f,sent:+f.sent||1,posted:+f.posted||0});}} style={{width:"100%",marginTop:4}}>
        {mode==="edit"?<><MI n="save" size={13}/> 저장</>:<><MI n="add" size={13}/> 추가</>}
      </Btn>
    </Modal>
  );
}

// 인사이트 기록 모달
function InsModalComp({initial, onSave, onClose}){
  const [f, setF] = useState(()=>initial||{id:null,name:"",reach:"",saves:"",clicks:"",conv:""});
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  return(
    <Modal title={<><MI n="bar_chart"/> 인사이트 기록</>} onClose={onClose}>
      <div style={{fontSize:12,fontWeight:700,color:C.ink,marginBottom:12}}>{f.name}</div>
      <FR label="도달(Reach)"><Inp type="number" value={f.reach} onChange={v=>set("reach",v)} placeholder="0"/></FR>
      <FR label="저장수"><Inp type="number" value={f.saves} onChange={v=>set("saves",v)} placeholder="0"/></FR>
      <FR label="링크 클릭"><Inp type="number" value={f.clicks} onChange={v=>set("clicks",v)} placeholder="0"/></FR>
      <FR label="전환(구매)"><Inp type="number" value={f.conv} onChange={v=>set("conv",v)} placeholder="0"/></FR>
      <Btn onClick={()=>onSave({...f,reach:+f.reach||0,saves:+f.saves||0,clicks:+f.clicks||0,conv:+f.conv||0})}
        style={{width:"100%",marginTop:8}}>💾 저장</Btn>
    </Modal>
  );
}

// 재고 추가/수정 모달
function InvModalComp({mode, initial, onSave, onClose}){

  const [f, setF] = useState(()=>initial||eInv);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  return(
    <Modal title={mode==="add"?"상품 추가":"재고 수정"} onClose={onClose}>
      <FR label="상품명 *"><Inp value={f.name} onChange={v=>set("name",v)} placeholder="세럼 30ml"/></FR>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <FR label="SKU"><Inp value={f.sku} onChange={v=>set("sku",v)} placeholder="SKU-001"/></FR>
        <FR label="카테고리"><Inp value={f.category} onChange={v=>set("category",v)} placeholder="세럼"/></FR>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <FR label="현재 재고"><Inp type="number" value={f.stock} onChange={v=>set("stock",v)} placeholder="0"/></FR>
        <FR label="주문 수량(입고예정)"><Inp type="number" value={f.ordered} onChange={v=>set("ordered",v)} placeholder="0"/></FR>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <FR label="발주 기준"><Inp type="number" value={f.reorder} onChange={v=>set("reorder",v)} placeholder="300"/></FR>
        <FR label="30일 판매량"><Inp type="number" value={f.sold30} onChange={v=>set("sold30",v)} placeholder="0"/></FR>
      </div>
      <Btn onClick={()=>{if(!f.name)return; onSave({...f,stock:+f.stock||0,ordered:+f.ordered||0,reorder:+f.reorder||0,sold30:+f.sold30||0});}}
        style={{width:"100%",marginTop:8}}>💾 저장</Btn>
    </Modal>
  );
}

// 스케줄 추가/수정 모달
function SchModalComp({mode, initial, onSave, onClose}){
  const empty = {type:"공구",title:"",date:"",endDate:"",assignee:"",note:"",status:"예정"};
  const [f, setF] = useState(()=>initial||empty);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  return(
    <Modal title={mode==="add"?"일정 추가":"일정 수정"} onClose={onClose}>
      <FR label="유형"><Sel value={f.type} onChange={v=>set("type",v)} options={["소재제작","광고","시딩","이벤트","행사","공구","촬영","인스타","트위터","기타"]}/></FR>
      <FR label="제목 *"><Inp value={f.title} onChange={v=>set("title",v)} placeholder="세럼 30ml 공구 오픈"/></FR>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <FR label="시작일 *"><Inp type="date" value={f.date} onChange={v=>set("date",v)}/></FR>
        <FR label="종료일"><Inp type="date" value={f.endDate} onChange={v=>set("endDate",v)}/></FR>
      </div>
      <FR label="담당자"><Sel value={f.assignee||""} onChange={v=>set("assignee",v)} options={["","소리","영서","경은","지수"]}/></FR>
      <FR label="메모">
        <textarea value={f.note||""} onChange={e=>set("note",e.target.value)} placeholder="한도 수량, 할인율, 주의사항 등 자유롭게 입력"
          style={{width:"100%",padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:9,
            fontSize:12,color:C.ink,background:C.cream,outline:"none",fontFamily:"inherit",
            resize:"vertical",minHeight:100,lineHeight:1.7,boxSizing:"border-box"}}
          onFocus={e=>e.target.style.borderColor=C.rose} onBlur={e=>e.target.style.borderColor=C.border}/>
      </FR>
      <FR label="상태"><Sel value={f.status} onChange={v=>set("status",v)} options={["예정","진행중","완료","보류"]}/></FR>
      <Btn onClick={()=>{if(!f.title||!f.date)return; onSave(f);}} style={{width:"100%",marginTop:8}}>💾 저장</Btn>
    </Modal>
  );
}

export default function OaDashboard(){
  // 날짜 문자열 — 클라이언트에서만 계산 (하이드레이션 불일치 방지)
  const dateStr = typeof window !== "undefined"
    ? new Date().toLocaleDateString("ko-KR", {year:"numeric",month:"long",day:"numeric",weekday:"short"})
    : "";
  const [sec,setSec]           = useState("home");
  const [metaTab,setMetaTab]   = useState("overview");
  const [campTab,setCampTab]   = useState("conversion");
  const [pulse,setPulse]       = useState(false);
  const [nid,setNid]           = useState(300);

  const [infs,setInfs] = useState([]);
  const [inv, setInv]         = useSyncState("oa_inv_v7",     DEFAULT_INV);
  const [sch, setSch]         = useSyncState("oa_sch_v7", DEFAULT_SCH);

  // ── Notion 스케줄 연동 ──────────────────────────────
  const [notionSch, setNotionSch] = useState([]);
  const [notionLoading, setNotionLoading] = useState(false);
  const [notionError, setNotionError] = useState(null);

  const fetchNotionSch = useCallback(async (opts={}) => {
    setNotionLoading(true);
    setNotionError(null);
    try {
      const params = new URLSearchParams();
      if (opts.month) params.set("month", opts.month);
      if (opts.from) params.set("from", opts.from);
      if (opts.to) params.set("to", opts.to);
      if (opts.completed) params.set("completed", "true");
      const res = await fetch("/api/notion?" + params.toString());
      const data = await res.json();
      if (data.error) { setNotionError(data.error); }
      else {
        const items = data.items || [];
        // 로컬에만 있는 항목(local_/csv_/temp_ 접두사) 보존
        setNotionSch(prev => {
          const localOnly = prev.filter(s => !s.id || s.id.startsWith("local_") || s.id.startsWith("csv_") || s.id.startsWith("temp_"));
          return [...items, ...localOnly];
        });
        setSetting("oa_notion_sch_cache_v1", items).catch(()=>{});
      }
    } catch(e) { setNotionError(e.message); }
    setNotionLoading(false);
  }, []);

  // 초기 로딩: 캐시 먼저 표시 → Notion API 갱신
  useEffect(() => {
    getSetting("oa_notion_sch_cache_v1").then(cached => {
      if (Array.isArray(cached) && cached.length > 0) setNotionSch(cached);
    }).catch(()=>{});
    const now = new Date();
    const fromD = new Date(now); fromD.setDate(fromD.getDate()-14);
    const toD = new Date(now); toD.setDate(toD.getDate()+60);
    fetchNotionSch({ from: fromD.toISOString().slice(0,10), to: toD.toISOString().slice(0,10) });
  }, [fetchNotionSch]);

  const NOTION_ASSIGNEE_COLORS = {"소리":"#f472b6","영서":"#60a5fa","경은":"#34d399","지수":"#a78bfa"};

  // ── Notion CSV 내보내기 파일 파싱 ──────────────────────────────
  function parseNotionCSV(text) {
    const lines = text.split(/\r?\n/);
    if (!lines.length) return [];
    // BOM 제거
    const header = lines[0].replace(/^\uFEFF/, "");
    // CSV 파서 (따옴표 처리 포함)
    function parseRow(line) {
      const cols = []; let cur = ""; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { if (inQ && line[i+1]==='"') { cur+='"'; i++; } else inQ=!inQ; }
        else if (c === ',' && !inQ) { cols.push(cur); cur=""; }
        else cur+=c;
      }
      cols.push(cur);
      return cols;
    }
    // 한국어 날짜 "2025년 11월 7일" → "2025-11-07"
    function parseKorDate(s) {
      if (!s) return null;
      const m = s.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
      if (m) return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
      const iso = s.match(/(\d{4}-\d{2}-\d{2})/);
      return iso ? iso[1] : null;
    }
    const headers = parseRow(header);
    const idx = (keys) => { for (const k of keys) { const i=headers.findIndex(h=>h.trim()===k); if(i>=0)return i; } return -1; };
    const iName    = idx(["이름","Name"]);
    const iDate    = idx(["날짜","Date"]);
    const iStatus  = idx(["상태","Status"]);
    const iType    = idx(["선택","유형","Type"]);
    const iDone    = idx(["체크박스","완료","Done"]);
    const iMemo    = idx(["메모","Memo"]);
    const iProduct = idx(["제품"]);

    const items = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = parseRow(line);
      const get = (j) => j >= 0 ? (cols[j]||"").trim() : "";
      const rawName = get(iName);
      if (!rawName) continue;

      // 담당자: 이름 맨 앞 "(소리)" "(경은)" 등 파싱
      let assignee = null;
      let title = rawName;
      const assigneeMatch = rawName.match(/^\(([^)]+)\)\s*/);
      if (assigneeMatch) {
        const candidate = assigneeMatch[1];
        if (["소리","영서","경은","지수"].includes(candidate)) {
          assignee = candidate;
          title = rawName.slice(assigneeMatch[0].length);
        }
      }

      // 날짜 파싱: 날짜범위 "2025년 11월 7일 → 2025년 11월 9일"
      const rawDate = get(iDate);
      let date = null; let endDate = null;
      const parts = rawDate.split("→");
      date = parseKorDate(parts[0].trim());
      endDate = parts[1] ? parseKorDate(parts[1].trim()) : null;

      const type = get(iType) || "기타";
      const status = get(iStatus) || "예정";
      const doneRaw = get(iDone).toLowerCase();
      const done = doneRaw==="yes"||doneRaw==="true"||doneRaw==="완료"||doneRaw==="1";
      const memo = get(iMemo) || get(iProduct) || "";

      items.push({
        id: `csv_${i}_${Date.now()}`,
        title, date, endDate, assignee, type, status, done, memo,
        assigneeColor: NOTION_ASSIGNEE_COLORS[assignee] || "#c4b5fd",
      });
    }
    return items;
  }

  const notionCsvInputRef = useRef(null);
  function handleNotionCSVUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const items = parseNotionCSV(text);
      if (!items.length) { alert("파싱된 항목이 없습니다. CSV 형식을 확인해주세요."); return; }
      setNotionSch(items);
      setSetting("oa_notion_sch_cache_v1", items).catch(()=>{});
      alert(`${items.length}개 항목을 불러왔습니다.`);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  // 캐시 저장 헬퍼 — 모든 CRUD 후 호출
  function saveSchCache(items) {
    setSetting("oa_notion_sch_cache_v1", items).catch(()=>{});
  }
  // CSV/로컬 ID 여부 (Notion API 호출 불필요)
  function isLocalId(id) { return !id || id.startsWith("csv_") || id.startsWith("local_") || id.startsWith("temp_"); }

  async function saveNotionSch(item) {
    const isEdit = schModalData?.mode === "edit" && item.notionId;
    setSchModalData(null);

    if (isEdit) {
      const updated = { title: item.title, date: item.date, endDate: item.endDate || null,
        assignee: item.assignee || null, type: item.type, status: item.status,
        memo: item.note || "", assigneeColor: NOTION_ASSIGNEE_COLORS[item.assignee] || "#94a3b8" };
      setNotionSch(prev => {
        const next = prev.map(s => s.id === item.notionId ? { ...s, ...updated } : s);
        saveSchCache(next);
        return next;
      });
      // Notion API 백그라운드 시도 (로컬 ID면 스킵)
      if (!isLocalId(item.notionId)) {
        fetch("/api/notion", { method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ action:"update", pageId:item.notionId, data:{
            title:item.title, date:item.date, endDate:item.endDate||null,
            assignee:item.assignee||null, type:item.type, status:item.status, memo:item.note||"",
          }}),
        }).catch(()=>{});
      }
    } else {
      const newItem = {
        id: `local_${Date.now()}`, title: item.title, date: item.date, endDate: item.endDate || null,
        assignee: item.assignee || null, type: item.type, status: item.status || "예정",
        memo: item.note || "", done: false,
        assigneeColor: NOTION_ASSIGNEE_COLORS[item.assignee] || "#94a3b8",
      };
      setNotionSch(prev => {
        const next = [...prev, newItem];
        saveSchCache(next);
        return next;
      });
      // Notion API 백그라운드 시도
      fetch("/api/notion", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"create", data:{
          title:item.title, date:item.date, endDate:item.endDate||null,
          assignee:item.assignee||null, type:item.type, status:item.status||"예정", memo:item.note||"",
        }}),
      }).then(r=>r.json()).then(data=>{
        if (data.id) setNotionSch(prev => { const next=prev.map(s=>s.id===newItem.id?{...s,id:data.id}:s); saveSchCache(next); return next; });
      }).catch(()=>{});
    }
  }

  function deleteNotionSch(notionId) {
    setNotionSch(prev => {
      const next = prev.filter(s => s.id !== notionId);
      saveSchCache(next);
      return next;
    });
    if (!isLocalId(notionId)) {
      fetch("/api/notion", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"delete", pageId:notionId }),
      }).catch(()=>{});
    }
  }

  function toggleNotionDone(notionId, done) {
    const newStatus = done ? "완료" : "예정";
    setNotionSch(prev => {
      const next = prev.map(s => s.id === notionId ? { ...s, done, status: newStatus } : s);
      saveSchCache(next);
      return next;
    });
    if (!isLocalId(notionId)) {
      fetch("/api/notion", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"update", pageId:notionId, data:{ done, status: newStatus } }),
      }).catch(()=>{});
    }
  }

  // 마진 설정
  const [margin, setMargin]   = useSyncState("oa_margin_v7", 30000);
  const [margins, setMargins] = useSyncState("oa_margins_v7", DEFAULT_MARGINS);
  // 트래픽 캠페인 기준값
  const [trafficCriteria, setTrafficCriteria] = useSyncState("oa_traffic_criteria_v7", {
    cpcMax: 600, ctrMin: 1.5, lpvMin: 55,
    cpcKeywords: [{id:1,keyword:"소닉플로우",cpcMax:600},{id:2,keyword:"프리온",cpcMax:800}],
  });
  // 전환 캠페인 기준값 (변경 가능)
  const [convCriteria, setConvCriteria] = useSyncState("oa_conv_criteria_v7", {
    cpaGood: 85, cpaHold: 100,
    lpvCostGood: 800, lpvCostOk: 1200, lpvCostHold: 2000,
    lpvRateGood: 60, lpvRateOk: 40,
    ctrGood: 1.2, ctrOk: 0.7,
    // 제품별 기준값 (키워드 매칭)
    products: [
      {id:1, keyword:"소닉플로우", label:"드라이기",
        cpaGood:85, cpaHold:100,
        lpvCostGood:800, lpvCostOk:1200, lpvCostHold:2000,
        lpvRateGood:60, lpvRateOk:40, ctrGood:1.2, ctrOk:0.7},
      {id:2, keyword:"프리온", label:"고데기",
        cpaGood:85, cpaHold:100,
        lpvCostGood:1000, lpvCostOk:1500, lpvCostHold:2500,
        lpvRateGood:55, lpvRateOk:35, ctrGood:1.0, ctrOk:0.6},
    ],
  });

  const [marginModal, setMarginModal]= useState(false);
  const [marginInput, setMarginInput]= useState("");
  const [editingMargin, setEditingMargin] = useState(null);
  const [newKeyword, setNewKeyword]  = useState("");
  const [newMarginVal, setNewMarginVal] = useState("");
  const [newCpcKeyword, setNewCpcKeyword] = useState("");
  const [newCpcVal, setNewCpcVal]         = useState("");
  const [convCriteriaTab, setConvCriteriaTab] = useState("default");

  // 데이터 에이전트
  const [agentOpen, setAgentOpen]           = useState(false);
  const [agentMsgs, setAgentMsgs]           = useState([]);
  const [agentInput, setAgentInput]         = useState("");
  const [agentLoading, setAgentLoading]     = useState(false);
  const [agentTab, setAgentTab]             = useState("chat"); // "chat" | "history"
  const [agentHistory, setAgentHistory]     = useSyncState("oa_agent_history_v7", []);
  const agentEndRef = useRef(null);
  // ── 공지 팝업 ──────────────────────────────────────
  const [activeNotice, setActiveNotice] = useSyncState("oa_active_notice_v1", null);
  const [noticeReads, setNoticeReads]   = useSyncState("oa_notice_reads_v1", {});
  const [noticeEditMode, setNoticeEditMode] = useState(false);
  const [noticeInput, setNoticeInput]   = useState("");
  const NOTICE_MEMBERS = ["소리","영서","경은","지수"];

  // 목표 메모 (Supabase 팀 공유)
  const [metaGoal, setMetaGoal]         = useSyncState("oa_meta_goal_v7", "");
  const [metaGoalEditing, setMetaGoalEditing] = useState(false);
  const [metaGoalInput, setMetaGoalInput]     = useState("");

  // ── 시트 URL — Supabase 저장 (팀 공유, 변경 가능) ──
  // ── 시트 URL 코드 고정 (Supabase 저장 안 함 — 시트 내용만 fetch)
  const invUrl    = "https://docs.google.com/spreadsheets/d/1r9WhAOgvdIcumgrkNkTbyYSVj1ONxyXp0trwzD-xAng/edit?gid=960641453#gid=960641453";
  const infUrl    = "https://docs.google.com/spreadsheets/d/1r9WhAOgvdIcumgrkNkTbyYSVj1ONxyXp0trwzD-xAng/edit?gid=503054532#gid=503054532";
  const [sheetUrl, setSheetUrl] = useSyncState("oa_conv_sheet_url_v1", "");
  const setInvUrl = ()=>{}, setInfUrl = ()=>{};
  const [orderUrl, setOrderUrl] = useSyncState("oa_order_url_v7", "");
  const invUrlLoaded = true; const infUrlLoaded = true;
  const sheetUrlLoaded = true; const orderUrlLoaded = true;

  // Figma 파일 연동
  const [figmaFileKey, setFigmaFileKey] = useSyncState("oa_figma_key_v7", "IzWkfCEUljK2E3utjpJxRa");
  const [figmaFrames, setFigmaFrames] = useState([]); // [{name, nodeId}]
  const [figmaLoading, setFigmaLoading] = useState(false);

  const fetchFigmaFrames = useCallback(async (key) => {
    const k = key || figmaFileKey;
    if (!k) return;
    setFigmaLoading(true);
    try {
      const res = await fetch(`/api/figma?fileKey=${k}`);
      const data = await res.json();
      if (data.frames) setFigmaFrames(data.frames);
    } catch(e) {}
    setFigmaLoading(false);
  }, [figmaFileKey]);

  useEffect(() => { if (figmaFileKey) fetchFigmaFrames(figmaFileKey); }, [figmaFileKey]);

  function matchFigmaFrame(adName) {
    if (!figmaFrames.length || !adName) return null;
    const norm = s => s.toLowerCase().replace(/[\s_\-\(\)\[\]]/g, "");
    const needle = norm(adName);
    // 완전일치 우선
    let found = figmaFrames.find(f => norm(f.name) === needle);
    if (!found) found = figmaFrames.find(f => {
      const hay = norm(f.name);
      return hay.includes(needle) || needle.includes(hay);
    });
    return found || null;
  }

  function figmaLink(nodeId) {
    return `figma://file/${figmaFileKey}?node-id=${nodeId.replace(":", "-")}`;
  }

  // 콘텐츠 리뷰
  const [reviewItems, setReviewItems] = useSyncState("oa_review_v7", []);
  const [igInsights, setIgInsights] = useSyncState("oa_ig_insights_v1", []);
  const [meetingNotes, setMeetingNotes] = useSyncState("oa_meeting_notes_v1", []);
  // 체크리스트
  const [checkItems, setCheckItems] = useSyncState("oa_checklist_v7", []);
  const [checkDone,  setCheckDone]  = useSyncState("oa_checkdone_v7", {});

  // 발주임박
  const [orderRaw, setOrderRaw]   = useState([]);
  const [orderStatus, setOrderStatus] = useState("idle");
  const [orderModal, setOrderModal]   = useState(false);
  const [orderInput, setOrderInput]   = useState("");

  // 재고원본
  const [invSheetStatus, setInvSheetStatus] = useState("idle");
  const [invUrlModal, setInvUrlModal] = useState(false);
  const [invUrlInput, setInvUrlInput] = useState("");

  // 인플루언서
  const [infSheetStatus, setInfSheetStatus] = useState("idle");
  const [infUrlModal, setInfUrlModal]   = useState(false);
  const [infUrlInput, setInfUrlInput]   = useState("");
  // 인플루언서 수집 (Apify)
  const [infTabMode, setInfTabMode]       = useState("관리"); // "관리" | "수집"
  const [collectMode, setCollectMode]     = useState("keyword"); // "keyword" | "followers" | "tagged"
  const [collectKeyword, setCollectKeyword] = useState("");
  const [collectUsername, setCollectUsername] = useState("");
  const [collectCount, setCollectCount]   = useState(50);
  const [collectMinFollowers, setCollectMinFollowers] = useState("");
  const [collectMaxFollowers, setCollectMaxFollowers] = useState("");
  const [collectLoading, setCollectLoading] = useState(false);
  const [collectError, setCollectError]   = useState("");
  const [collectResults, setCollectResults] = useState([]);
  const [collectSelected, setCollectSelected] = useState({});
  const [collectCategory, setCollectCategory] = useState("");

  // 메타 (하이브리드: API 트래픽 + 시트 전환)
  const [metaRaw,setMetaRaw]         = useState([]);
  const [sheetConvRaw,setSheetConvRaw] = useState([]);
  const [sheetModal,setSheetModal]   = useState(false);
  const [sheetInput,setSheetInput]   = useState("");
  const [metaStatus,setMetaStatus]   = useState("idle");
  const [metaError,setMetaError]     = useState("");
  const [deletedAds, setDeletedAdsRaw] = useState([]);
  // 마운트 시 Supabase에서 삭제 목록 로드
  useEffect(()=>{
    getSetting("oa_deleted_ads_v7").then(v=>{ if(Array.isArray(v)) setDeletedAdsRaw(v); }).catch(()=>{});
  },[]);
  // 저장 시 Supabase에만 저장 (팀 전체 공유)
  const setDeletedAds = useCallback(async (v)=>{
    const val = typeof v==="function"?v(deletedAds):v;
    setDeletedAdsRaw(val);
    await setSetting("oa_deleted_ads_v7", val).catch(()=>{});
  },[deletedAds]);
  const [adImages, setAdImages]       = useState([]);
  const [imgUploading, setImgUploading] = useState(false);
  const [imgError, setImgError]       = useState("");
  const [hoverImg, setHoverImg]       = useState(null);
  const [dailyOpenDate, setDailyOpenDate] = useState(null);
  const [weekOpenKey, setWeekOpenKey] = useState(null);
  const [monthOpenKey, setMonthOpenKey] = useState(null);
  const [productOpenKey, setProductOpenKey] = useState(null);
  const fileInputRef                  = useRef(null);
  const [isDragging, setIsDragging]   = useState(false);

  // 전체 광고비 파일 (xlsx — 미게재 포함) — Supabase 저장
  // 소재 라이브러리 & 재제작 요청
  const [creativeLib, setCreativeLib] = useSyncState("oa_creative_lib_v8", []);
  const [recreateReqs, setRecreateReqs] = useSyncState("oa_recreate_req_v8", []);
  const [kwData, setKwData] = useSyncState("oa_kw_v1", {
    keywords: [{id:"oa-fixed",name:"OA",competitor:"",color:"#2563EB",type:"my",addedAt:"",fixed:true}],
    logs: []
  });

  const [allAdRaw, setAllAdRaw]       = useSyncState("oa_all_ad_raw_v7", []);
  const [allAdStatus, setAllAdStatus] = useState(()=>allAdRaw?.length>0?"ok":"idle");
  const allAdFileRef                  = useRef(null);

  // 월별 성과 비교 파일들 — Supabase 저장
  const [monthlyFiles, setMonthlyFiles] = useSyncState("oa_monthly_files_v7", []); // [{label, rows}]
  const monthlyFileRef = useRef(null);
  // 채널별 광고비 직접 입력 — {id, name, icon, color, amounts: {월라벨: 금액}}
  const [channelSpends, setChannelSpends] = useSyncState("oa_channel_spends_v7", [
    {id:"ably",    name:"에이블리",   icon:"🛍", color:"#f9a8d4", amounts:{}},
    {id:"zigzag",  name:"지그재그",   icon:"👗", color:"#c4b5fd", amounts:{}},
    {id:"musinsa", name:"무신사",     icon:"👟", color:"#93c5fd", amounts:{}},
    {id:"naver",   name:"네이버광고", icon:"🔍", color:"#86efac", amounts:{}},
  ]);
  // 채널 바로가기 링크 — Supabase 저장
  const [quickLinks, setQuickLinks] = useSyncState("oa_quick_links_v7", [
    {id:"instagram", name:"인스타그램",   url:"", group:"channel"},
    {id:"twitter",   name:"트위터",       url:"https://twitter.com/OA_store_beauty", group:"channel"},
    {id:"naver",     name:"네이버",       url:"", group:"channel"},
    {id:"ebay",      name:"이베이",       url:"", group:"channel"},
    {id:"11st",      name:"11번가",       url:"", group:"channel"},
    {id:"zigzag",    name:"지그재그",     url:"", group:"channel"},
    {id:"ably",      name:"에이블리",     url:"", group:"channel"},
    {id:"musinsa",   name:"무신사",       url:"", group:"channel"},
    {id:"oamall",    name:"오아몰",       url:"", group:"channel"},
    {id:"kakao",     name:"카카오톡채널", url:"", group:"channel"},
    {id:"erp_main",      name:"ERP",       url:"", group:"erp"},
    {id:"erp_approval",  name:"전자결재",  url:"", group:"erp"},
    {id:"erp_purchase",  name:"발주관리",  url:"", group:"erp"},
    {id:"erp_stock",     name:"재고관리",  url:"", group:"erp"},
    {id:"erp_account",   name:"회계/정산", url:"", group:"erp"},
    {id:"erp_hr",        name:"근태/HR",   url:"", group:"erp"},
  ]);
  const [quickLinksEditing, setQuickLinksEditing] = useState(false);

  // 새 채널 항목이 기존 Supabase 저장값에 없으면 자동 병합
  useEffect(()=>{
    const defaults = [
      {id:"instagram", name:"인스타그램",   url:"", group:"channel"},
      {id:"twitter",   name:"트위터",       url:"https://twitter.com/OA_store_beauty", group:"channel"},
      {id:"naver",     name:"네이버",       url:"", group:"channel"},
      {id:"ebay",      name:"이베이",       url:"", group:"channel"},
      {id:"11st",      name:"11번가",       url:"", group:"channel"},
      {id:"zigzag",    name:"지그재그",     url:"", group:"channel"},
      {id:"ably",      name:"에이블리",     url:"", group:"channel"},
      {id:"musinsa",   name:"무신사",       url:"", group:"channel"},
      {id:"kakao",     name:"카카오톡채널", url:"", group:"channel"},
      {id:"erp_main",     name:"ERP",       url:"", group:"erp"},
      {id:"erp_approval", name:"전자결재",  url:"", group:"erp"},
      {id:"erp_purchase", name:"발주관리",  url:"", group:"erp"},
      {id:"erp_stock",    name:"재고관리",  url:"", group:"erp"},
      {id:"erp_account",  name:"회계/정산", url:"", group:"erp"},
      {id:"erp_hr",       name:"근태/HR",   url:"", group:"erp"},
    ];
    if(!Array.isArray(quickLinks)) return;
    const existingIds = new Set(quickLinks.map(x=>x.id));
    // 지마켓 제거, 새 항목 추가
    const filtered = quickLinks.filter(x=>x.id!=="gmarket");
    const newItems = defaults.filter(d=>!existingIds.has(d.id));
    if(newItems.length>0 || filtered.length!==quickLinks.length){
      setQuickLinks([...filtered, ...newItems]);
    }
  // eslint-disable-next-line
  },[]);

  // ── 전체 광고비 xlsx 파일 읽기 → Supabase 저장 ────────────────
  async function handleAllAdFile(file) {
    if(!file) return;
    setAllAdStatus("loading");
    try {
      // xlsx를 동적 import (Next.js 빌드 호환)
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, {type:"array"});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const csv = XLSX.utils.sheet_to_csv(ws);
      const rows = parseCSV(csv).map(mapMetaRow).filter(r=>r.date||r.campaign);
      await setAllAdRaw(rows);
      setAllAdStatus("ok");
    } catch(e) {
      console.error("파일 읽기 에러:", e);
      setAllAdStatus("error");
    }
  }

  useEffect(()=>{
    agentEndRef.current?.scrollIntoView({behavior:"smooth"});
  },[agentMsgs]);

  useEffect(() => {
    getAdImages().then(imgs => { if (imgs?.length) setAdImages(imgs); }).catch(() => {});
  }, []);

  // ── 데이터 에이전트 컨텍스트 빌더 ────────────────
  function buildAgentContext() {
    const fmtW = n=>n>=10000?`₩${Math.round(n/10000).toLocaleString()}만`:`₩${Math.round(n).toLocaleString()}`;
    const lines = [];
    const dates = metaRaw.map(r=>r.date).filter(Boolean).sort();
    const period = dates.length?`${dates[0]} ~ ${dates[dates.length-1]}`:"기간 없음";

    lines.push(`## 메타광고 데이터 (${period})`);
    lines.push(`- 총 광고비: ${fmtW(metaForChart.reduce((s,r)=>s+(r.spend||0),0))}`);
    lines.push(`- 총 구매: ${metaForChart.reduce((s,r)=>s+(r.purchases||0),0)}건`);
    lines.push(`- 총 전환값: ${fmtW(metaForChart.reduce((s,r)=>s+(r.convValue||0),0))}`);
    lines.push(`- 총 클릭: ${metaForChart.reduce((s,r)=>s+(r.clicks||0),0).toLocaleString()}`);
    lines.push(`- 총 LPV: ${metaForChart.reduce((s,r)=>s+(r.lpv||0),0).toLocaleString()}`);
    lines.push("");

    // 광고별 성과
    const byAd = {};
    metaForChart.forEach(r=>{
      const key=(r.adName||r.campaign||"unknown")+"|||"+(r.adset||"");
      if(!byAd[key]) byAd[key]={name:r.adName||r.campaign||"",campaign:r.campaign||"",adset:r.adset||"",spend:0,purch:0,convV:0,clicks:0,lpv:0};
      byAd[key].spend+=r.spend||0;
      byAd[key].purch+=r.purchases||0;
      byAd[key].convV+=r.convValue||0;
      byAd[key].clicks+=r.clicks||0;
      byAd[key].lpv+=r.lpv||0;
    });

    const ads = Object.values(byAd).sort((a,b)=>b.spend-a.spend).slice(0,20);
    lines.push("## 광고별 성과 (상위 20개, 광고비 순)");
    lines.push("광고명 | 캠페인 | 광고비 | 구매 | ROAS | CPA | CPC | LPV율");
    ads.forEach(a=>{
      const roas = a.spend>0?Math.round(a.convV/a.spend*100)+"%" :"—";
      const cpa  = a.purch>0?fmtW(a.spend/a.purch):"—";
      const cpc  = a.clicks>0?`₩${Math.round(a.spend/a.clicks)}`:"—";
      const lpvR = a.clicks>0?Math.round(a.lpv/a.clicks*100)+"%":"—";
      lines.push(`${a.name} | ${a.campaign} | ${fmtW(a.spend)} | ${a.purch}건 | ${roas} | ${cpa} | ${cpc} | ${lpvR}`);
    });

    // 날짜별 추이
    const byDate = {};
    metaForChart.forEach(r=>{
      if(!r.date) return;
      if(!byDate[r.date]) byDate[r.date]={spend:0,clicks:0,lpv:0,purch:0};
      byDate[r.date].spend+=r.spend||0;
      byDate[r.date].clicks+=r.clicks||0;
      byDate[r.date].lpv+=r.lpv||0;
      byDate[r.date].purch+=r.purchases||0;
    });
    lines.push("");
    lines.push("## 날짜별 추이");
    lines.push("날짜 | 광고비 | 구매 | CPC");
    Object.entries(byDate).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([d,v])=>{
      lines.push(`${d} | ${fmtW(v.spend)} | ${v.purch}건 | ${v.clicks>0?`₩${Math.round(v.spend/v.clicks)}`:"—"}`);
    });

    // 재고
    if(inv.length>0){
      lines.push("");
      lines.push("## 재고 현황");
      inv.forEach(i=>{
        const days = Math.round((i.stock-i.reserved)/Math.max(i.sold30/30,0.01));
        lines.push(`${i.name}: 재고 ${i.stock}개, 예약 ${i.reserved}개, 월판매 ${i.sold30}개, 소진예상 ${days}일`);
      });
    }

    // 월별 성과 비교
    if(Array.isArray(monthlyFiles) && monthlyFiles.length>0){
      lines.push("");
      lines.push("## 월별 성과 비교 (메타광고)");
      lines.push("월 | 메타광고비 | 전환광고비 | 트래픽광고비 | 구매 | ROAS | CPA | CPC | LPV율 | 매출 | 광고비율");
      monthlyFiles.forEach(f=>{
        const r = (f.rows||[]).filter(x=>!((x.campaign||x.adName||"").includes("Instagram 게시물")));
        const spend  = r.reduce((s,x)=>s+(x.spend||0),0);
        const conv   = r.filter(x=>isConversionCampaign(x.objective,x.campaign,x.resultType)).reduce((s,x)=>s+(x.spend||0),0);
        const traff  = r.filter(x=>!isConversionCampaign(x.objective,x.campaign,x.resultType)).reduce((s,x)=>s+(x.spend||0),0);
        const purch  = r.reduce((s,x)=>s+(x.purchases||0),0);
        const convV  = r.reduce((s,x)=>s+(x.convValue||0),0);
        const clicks = r.reduce((s,x)=>s+(x.clicks||0),0);
        const lpv    = r.reduce((s,x)=>s+(x.lpv||0),0);
        const roas   = spend>0?Math.round(convV/spend*100)+"%":"—";
        const cpa    = purch>0?fmtW(spend/purch):"—";
        const cpc    = clicks>0?`₩${Math.round(spend/clicks)}`:"—";
        const lpvR   = clicks>0?Math.round(lpv/clicks*100)+"%":"—";
        const rev    = f.revenue>0?fmtW(f.revenue):"—";
        const ratio  = f.revenue>0?Math.round(spend/f.revenue*100)+"%":"—";
        lines.push(`${f.label} | ${fmtW(spend)} | ${fmtW(conv)} | ${fmtW(traff)} | ${purch}건 | ${roas} | ${cpa} | ${cpc} | ${lpvR} | ${rev} | ${ratio}`);
      });

      // 채널별 광고비
      if(Array.isArray(channelSpends) && channelSpends.length>0){
        lines.push("");
        lines.push("## 월별 채널별 광고비");
        const months = monthlyFiles.map(f=>f.label);
        lines.push("채널 | " + months.join(" | "));
        // 메타
        const metaRow = months.map(m=>{
          const spend = (monthlyFiles.find(f=>f.label===m)?.rows||[])
            .filter(r=>!((r.campaign||r.adName||"").includes("Instagram 게시물")))
            .reduce((s,r)=>s+(r.spend||0),0);
          return spend>0?fmtW(spend):"—";
        });
        lines.push(`메타광고 | ${metaRow.join(" | ")}`);
        channelSpends.forEach(ch=>{
          const row = months.map(m=>+(ch.amounts?.[m]||0)>0?fmtW(+(ch.amounts[m])):"—");
          lines.push(`${ch.name} | ${row.join(" | ")}`);
        });
        // 합계
        const totalRow = months.map(m=>{
          const metaSpend = (monthlyFiles.find(f=>f.label===m)?.rows||[])
            .filter(r=>!((r.campaign||r.adName||"").includes("Instagram 게시물")))
            .reduce((s,r)=>s+(r.spend||0),0);
          const chSpend = channelSpends.reduce((s,ch)=>s+(+(ch.amounts?.[m]||0)),0);
          return fmtW(metaSpend+chSpend);
        });
        lines.push(`총합 | ${totalRow.join(" | ")}`);
      }
    }

    // 어제 광고비
    const yDate = new Date(); yDate.setDate(yDate.getDate()-1);
    const yStr2 = `${yDate.getFullYear()}-${String(yDate.getMonth()+1).padStart(2,'0')}-${String(yDate.getDate()).padStart(2,'0')}`;
    const yRows2 = metaForChart.filter(r=>r.date===yStr2);
    if(yRows2.length>0){
      const ySpend2 = yRows2.reduce((s,r)=>s+(r.spend||0),0);
      const yConv2  = yRows2.filter(r=>isConversionCampaign(r.objective,r.campaign,r.resultType)).reduce((s,r)=>s+(r.spend||0),0);
      const yTraff2 = yRows2.filter(r=>!isConversionCampaign(r.objective,r.campaign,r.resultType)).reduce((s,r)=>s+(r.spend||0),0);
      lines.push("");
      lines.push(`## 어제 광고비 (${yStr2})`);
      lines.push(`- 총: ${fmtW(ySpend2)}`);
      lines.push(`- 전환: ${fmtW(yConv2)} / 트래픽: ${fmtW(yTraff2)}`);
    }

    // 캠페인별 집계 (전환/트래픽 분리)
    const campMap = {};
    metaForChart.forEach(r=>{
      const k = r.campaign||"기타";
      if(!campMap[k]) campMap[k]={campaign:k,objective:r.objective||"",spend:0,purch:0,convV:0,clicks:0,lpv:0,isConv:isConversionCampaign(r.objective,r.campaign,r.resultType)};
      campMap[k].spend+=r.spend||0; campMap[k].purch+=r.purchases||0;
      campMap[k].convV+=r.convValue||0; campMap[k].clicks+=r.clicks||0; campMap[k].lpv+=r.lpv||0;
    });
    const camps = Object.values(campMap).sort((a,b)=>b.spend-a.spend);
    const convCamps  = camps.filter(c=>c.isConv);
    const traffCamps = camps.filter(c=>!c.isConv);
    lines.push("");
    lines.push("## 전환 캠페인 성과");
    lines.push("캠페인 | 광고비 | 구매 | 전환값 | ROAS | CPA");
    convCamps.forEach(c=>{
      const roas=c.spend>0?Math.round(c.convV/c.spend*100)+"%":"—";
      const cpa=c.purch>0?fmtW(c.spend/c.purch):"—";
      lines.push(`${c.campaign} | ${fmtW(c.spend)} | ${c.purch}건 | ${fmtW(c.convV)} | ${roas} | ${cpa}`);
    });
    lines.push("");
    lines.push("## 트래픽 캠페인 성과");
    lines.push("캠페인 | 광고비 | 클릭 | CPC | LPV율");
    traffCamps.forEach(c=>{
      const cpc=c.clicks>0?`₩${Math.round(c.spend/c.clicks)}`:"—";
      const lpvR=c.clicks>0?Math.round(c.lpv/c.clicks*100)+"%":"—";
      lines.push(`${c.campaign} | ${fmtW(c.spend)} | ${c.clicks.toLocaleString()} | ${cpc} | ${lpvR}`);
    });

    // 데이터 출처 표시
    lines.push("");
    lines.push(`## 데이터 출처`);
    lines.push(`- 구글 시트 (전환): ${sheetConvRaw.length>0?`연결됨 (${sheetConvRaw.length}건)`:"미연결"}`);

    return lines.join("\n");
  }

  function saveAgentMsg(question, answer) {
    const item = {
      id: Date.now(),
      question: question || "질문 없음",
      answer,
      savedAt: new Date().toISOString(),
    };
    setAgentHistory(prev => {
      const list = Array.isArray(prev) ? prev : [];
      return [item, ...list].slice(0, 50); // 최대 50개
    });
    setAgentTab("history");
  }

  async function sendAgentMessage() {
    const q = agentInput.trim();
    if(!q || agentLoading) return;
    const userMsg = {role:"user", content:q};
    const newMsgs = [...agentMsgs, userMsg];
    setAgentMsgs(newMsgs);
    setAgentInput("");
    setAgentLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          messages: newMsgs,
          context: buildAgentContext(),
        }),
      });
      const data = await res.json();
      if(data.error) throw new Error(data.error);
      const reply = data.reply;
      const finalMsgs = [...newMsgs, {role:"assistant", content:reply}];
      setAgentMsgs(finalMsgs);

      // 차트가 포함된 답변 자동 저장 (Supabase — 팀 공유)
      const hasChart = reply.includes("```chart");
      if(hasChart) {
        const record = {
          id: Date.now(),
          question: q,
          answer: reply,
          savedAt: new Date().toISOString(),
        };
        setAgentHistory(prev=>[record, ...(Array.isArray(prev)?prev:[])].slice(0,30));
      }
    } catch(e) {
      setAgentMsgs([...newMsgs, {role:"assistant", content:`❌ 오류: ${e.message}`}]);
    }
    setAgentLoading(false);
  }

  // 답변 수동 저장
  function saveAgentMsg(question, answer) {
    const record = {id:Date.now(), question, answer, savedAt:new Date().toISOString()};
    setAgentHistory(prev=>[record, ...(Array.isArray(prev)?prev:[])].slice(0,30));
  }

  // ── 월별 성과 파일 업로드 ────────────────────────
  async function handleMonthlyFile(file) {
    if(!file) return;
    // 파일명에서 월 추출 (예: 2월, 3월, 202502 등)
    const name = file.name;
    const mMatch = name.match(/(\d{4})[.\-_]?(\d{1,2})/) || name.match(/(\d{1,2})월/);
    let label = mMatch
      ? mMatch[0].includes('월') ? mMatch[0] : `${mMatch[1]}.${String(mMatch[2]).padStart(2,'0')}`
      : name.replace(/\.[^.]+$/,'');
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, {type:"array"});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const csv = XLSX.utils.sheet_to_csv(ws);
      const rows = parseCSV(csv).map(mapMetaRow).filter(r=>r.date||r.campaign);
      const next = [...monthlyFiles.filter(f=>f.label!==label), {label, rows}]
        .sort((a,b)=>a.label.localeCompare(b.label));
      setMonthlyFiles(next);
    } catch(e) { console.error("월별 파일 에러:", e); }
  }

  // allAdRaw Supabase에서 로드되면 status 자동 설정
  useEffect(()=>{
    if(allAdRaw?.length>0) setAllAdStatus("ok");
  },[allAdRaw]);

  async function handleAdImageUpload(files) {
    setImgUploading(true);
    setImgError("");
    try {
      const newImgs = [...adImages];
      for (const file of Array.from(files)) {
        const originalName = file.name.replace(/\.[^.]+$/, "");
        const { url, path } = await uploadAdImage(file, originalName);
        newImgs.push({ id: Date.now() + Math.random(), name: originalName, url, path });
      }
      setAdImages(newImgs);
      await saveAdImagesMeta(newImgs);
    } catch(e) {
      console.error("업로드 에러:", e);
      setImgError(e.message||"업로드 실패 — Supabase Storage 정책을 확인해주세요");
    }
    setImgUploading(false);
  }

  // 모달

  // 폼








  useEffect(()=>{const t=setInterval(()=>setPulse(v=>!v),2500);return()=>clearInterval(t);},[]);

  // 인플루언서 데이터 Supabase에서 로드 (구글 시트 없을 때 fallback)
  useEffect(()=>{
    getSetting("oa_infs_v7").then(v=>{ if(Array.isArray(v)&&v.length>0) setInfs(v); }).catch(()=>{});
  },[]);

  // 시트 자동 fetch 제거 — Meta API 사용

  // 자동 갱신 없음 — 수동 새로고침만

  // ── Meta Ads API fetch ───────────────────────────

  // 시트 URL 로드 시 자동 fetch
  useEffect(() => { if(sheetUrl) fetchSheet(sheetUrl); }, [sheetUrl]); // eslint-disable-line

  // 시트 전용
  useEffect(() => {
    setMetaRaw(sheetConvRaw.length > 0 ? sheetConvRaw : []);
    if(sheetConvRaw.length > 0) setMetaStatus("ok");
  }, [sheetConvRaw]); // eslint-disable-line

  // 시트 fetch
  async function fetchSheet(url) {
    if(!url) return;
    setMetaStatus("loading"); setMetaError("");
    try {
      const res = await fetch(`/api/sheet?url=${encodeURIComponent(url)}`);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const rows = parseCSV(text).map(mapMetaRow).filter(r=>r.date||r.campaign);
      setSheetConvRaw(rows);
      setMetaStatus("ok");
    } catch(e) {
      setMetaStatus("error"); setMetaError(e.message);
    }
  }

  function saveSheetUrl() {
    const url = sheetInput.trim();
    if(!url) return;
    setSheetUrl(url); setSheetModal(false); fetchSheet(url);
  }

  // ── 발주임박 시트 fetch ─────────────────────────────
  async function fetchOrderSheet(url){
    if(!url) return;
    setOrderStatus("loading");
    try{
      const res = await fetch(`/api/sheet?url=${encodeURIComponent(url)}`);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const rows = parseOrderCSV(text);
      setOrderRaw(rows);
      setOrderStatus("ok");
    }catch(e){
      setOrderStatus("error");
    }
  }

  function parseOrderCSV(text){
    const lines = text.trim().split("\n").map(l=>{
      const res=[]; let cur="", inQ=false;
      for(let i=0;i<l.length;i++){
        if(l[i]==='"'){inQ=!inQ;}
        else if(l[i]===","&&!inQ){res.push(cur.trim().replace(/^"|"$/g,""));cur="";}
        else cur+=l[i];
      }
      res.push(cur.trim().replace(/^"|"$/g,""));
      return res;
    });
    if(lines.length<2) return [];
    // 고정 컬럼 인덱스로 직접 읽기 (헤더 파싱 오류 방지)
    // 컬럼 순서: SKU명(0), 최소발주일(1), 조정후발주일(2), 원본1주평균(3),
    //   쿠팡7일평균(4), 합산7일평균(5), 판매량차이(6), 차이비율(7),
    //   현재고(8), 현재고소진합산(9), 총재고소진합산(10), 발주판단(11), 메모(12)
    let dataStart=0;
    for(let i=0;i<Math.min(lines.length,5);i++){
      const first=(lines[i][0]||"").trim();
      if(!first||first.includes("발주 임박")||first.includes("SKU")||first==="없음") continue;
      dataStart=i; break;
    }
    return lines.slice(dataStart)
      .filter(l=>l[0]&&l[0].trim()&&l[0]!=="없음"&&!l[0].includes("발주 임박")&&!l[0].includes("SKU명"))
      .map(row=>({
        "SKU명":              (row[0]||"").trim(),
        "최소발주일":         (row[1]||"").trim(),
        "조정후발주일":       (row[2]||"").trim(),
        "원본1주평균":        (row[3]||"").trim(),
        "쿠팡7일평균":        (row[4]||"").trim(),
        "합산7일평균":        (row[5]||"").trim(),
        "판매량차이":         (row[6]||"").trim(),
        "차이비율":           (row[7]||"").trim(),
        "현재고":             (row[8]||"").trim(),
        "합산기준 현재고소진":(row[9]||"").trim(),
        "합산기준 총재고소진":(row[10]||"").trim(),
        "발주판단":           (row[11]||"").trim(),
        "메모":               (row[12]||"").trim(),
      }));
  }

  // 발주임박 URL 로드시 자동 fetch
  useEffect(()=>{
    if(orderUrlLoaded && orderUrl) fetchOrderSheet(orderUrl);
  },[orderUrl, orderUrlLoaded]);

  // ── 재고원본 시트 fetch ─────────────────────────
  async function fetchInvSheet(url){
    if(!url) return;
    setInvSheetStatus("loading");
    try{
      const res = await fetch(`/api/sheet?url=${encodeURIComponent(url)}`);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = parseInvSheetCSV(text);
      if(parsed.length > 0){
        setInv(parsed);
        setInvSheetStatus("ok");
      } else {
        setInvSheetStatus("error");
      }
    }catch(e){ setInvSheetStatus("error"); }
  }

  function parseInvSheetCSV(text){
    const lines = text.trim().split("\n").map(l=>{
      const res=[]; let cur="", inQ=false;
      for(let i=0;i<l.length;i++){
        if(l[i]==='"'){inQ=!inQ;}
        else if(l[i]===","&&!inQ){res.push(cur.trim());cur="";}
        else cur+=l[i];
      }
      res.push(cur.trim());
      return res;
    });
    if(lines.length<2) return [];

    // 헤더행 찾기
    let hIdx=0;
    for(let i=0;i<Math.min(lines.length,5);i++){
      if(lines[i].join(",").includes("구분1")){hIdx=i;break;}
    }

    // 재고원본 고정 컬럼 인덱스 (통합_문서1.xlsx 기준)
    // A(0)=구분1, B(1)=구분2, E(4)=제품명, F(5)=재고,
    // I(8)=생산중, J(9)=예상발주, AD(29)=28일평균판매, AF(31)=1주평균판매
    return lines.slice(hIdx+1).filter(l=>l.some(c=>c)).map((row,ri)=>{
      const g = (i) => (row[i]||"").trim();
      const n = (i) => parseFloat((row[i]||"").replace(/,/g,""))||0;
      const name = g(4);  // E열 = 제품명
      if(!name) return null;
      return {
        id:       Date.now()+ri,
        name,
        sku:      g(1)||g(0)||"",   // B열(구분2) 또는 A열(구분1)
        category: g(0)||"기타",      // A열(구분1)
        stock:    n(5),              // F열 = 재고
        ordered:  n(8),              // I열 = 생산중
        reorder:  n(9)||Math.round(n(31)*14),  // J열 = 예상발주
        sold30:   Math.round(n(29)),            // AD열 = 28일평균판매
      };
    }).filter(Boolean);
  }

  // 재고 URL 로드시 자동 fetch
  useEffect(()=>{
    if(invUrlLoaded && invUrl) fetchInvSheet(invUrl);
  },[invUrl, invUrlLoaded]);

  // ── 인플루언서 Apify 수집 ─────────────────────────
  async function handleCollect() {
    const isKeyword = collectMode === "keyword";
    if (isKeyword && !collectKeyword.trim()) return;
    if (!isKeyword && !collectUsername.trim()) return;
    setCollectLoading(true);
    setCollectError("");
    setCollectResults([]);
    setCollectSelected({});
    try {
      const res = await fetch("/api/apify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: collectMode,
          keyword: collectKeyword.trim(),
          username: collectUsername.trim().replace(/^@/, ""),
          maxResults: Number(collectCount) || 50,
          minFollowers: collectMinFollowers ? Number(collectMinFollowers) : undefined,
          maxFollowers: collectMaxFollowers ? Number(collectMaxFollowers) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "수집 실패");
      setCollectResults(data.influencers || []);
      if ((data.influencers||[]).length === 0) {
        const debugKeys = data._debug?.sampleKeys?.join(", ") || "없음";
        const firstItem = data._debug?.firstItem ? JSON.stringify(data._debug.firstItem).slice(0,300) : "없음";
        setCollectError(`수집된 계정 없음 (포스트 ${data.totalPosts||0}개)\n필드: ${debugKeys}\n샘플: ${firstItem}`);
      }
    } catch (e) {
      setCollectError(e.message);
    } finally {
      setCollectLoading(false);
    }
  }

  function handleAddCollected() {
    const toAdd = collectResults.filter(r => collectSelected[r.username]);
    if (toAdd.length === 0) return;
    const existingHandles = new Set(infs.map(f => (f.name||"").replace(/^@/,"")));
    const src = collectMode === "keyword" ? `키워드: ${collectKeyword}` : `팔로워: @${collectUsername}`;
    const newItems = toAdd
      .filter(r => !existingHandles.has(r.username))
      .map(r => ({
        id: Date.now() + Math.random(),
        name: "@" + r.username,
        displayName: r.fullName || r.username,
        tier: "무료",
        followers: r.followers ? (r.followers >= 10000 ? (r.followers/1000).toFixed(0)+"K" : String(r.followers)) : "—",
        platform: "인스타",
        product: "",
        sent: 0, posted: 0, postedDate: null,
        reach: null, saves: null, clicks: null, conv: null,
        videoReceived: false, reusable: false, metaUsed: false, paid: false,
        note: collectCategory ? `[${collectCategory}] ${src}` : src,
      }));
    const duplicates = toAdd.filter(r => existingHandles.has(r.username));
    const next = [...infs, ...newItems];
    setInfs(next);
    setSetting("oa_infs_v7", next);
    setCollectSelected({});
    setCollectError(duplicates.length > 0
      ? `✅ ${newItems.length}명 추가됨 (중복 ${duplicates.length}명 제외)`
      : `✅ ${newItems.length}명이 인플루언서 목록에 추가됐어요`
    );
  }

  // ── 인플루언서 시트 fetch ─────────────────────────
  async function fetchInfSheet(url){
    if(!url) return;
    // URL 기본 유효성 검사
    try{ new URL(url); } catch(e){ setInfSheetStatus("error"); return; }
    setInfSheetStatus("loading");
    try{
      const res = await fetch(`/api/sheet?url=${encodeURIComponent(url)}`);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      let parsed = [];
      try{ parsed = parseInfSheetCSV(text); } catch(e){ parsed = []; }
      if(parsed.length > 0){
        // 새로고침 시 대시보드에서 직접 체크한 값 유지 (name 기준 매칭)
        setInfs(prev => {
          const prevMap = {};
          prev.forEach(p => { prevMap[p.name] = p; });
          return parsed.map(p => {
            const old = prevMap[p.name];
            if(!old) return p;
            return {...p, videoReceived:old.videoReceived, reusable:old.reusable, metaUsed:old.metaUsed, paid:old.paid};
          });
        });
        setInfSheetStatus("ok");
      } else {
        setInfSheetStatus("error");
      }
    }catch(e){ setInfSheetStatus("error"); }
  }

  function parseInfSheetCSV(text){
    // BOM 제거
    const clean = text.replace(/^\uFEFF/, "");
    const lines = clean.trim().split("\n").map(l=>{
      const res=[]; let cur="", inQ=false;
      for(let i=0;i<l.length;i++){
        if(l[i]==='\"'){inQ=!inQ;}
        else if(l[i]===","&&!inQ){res.push(cur.trim());cur="";}
        else cur+=l[i];
      }
      res.push(cur.trim());
      return res;
    });
    if(lines.length<2) return [];

    // 헤더행 찾기 — "담당자" 또는 "제품명" 또는 "이름" 포함 행
    let hIdx=0;
    for(let i=0;i<Math.min(lines.length,5);i++){
      const joined = lines[i].join(",");
      if(joined.includes("담당자")||joined.includes("제품명")||joined.includes("이름")){hIdx=i;break;}
    }
    // 헤더 정규화 (공백/줄바꿈 제거, 소문자)
    const headers = lines[hIdx].map(h=>h.replace(/\s+/g,"").toLowerCase());

    // 컬럼 인덱스 찾기 — 정규화된 헤더에서 키워드 포함 여부
    const col = (...keys) => {
      for(const k of keys){
        const kn = k.replace(/\s+/g,"").toLowerCase();
        const i = headers.findIndex(h=>h.includes(kn));
        if(i>=0) return i;
      }
      return -1;
    };

    const iProduct  = col("제품명","제품","상품");
    const iName     = col("이름","name");
    const iHandle   = col("인스타그램아이디","인스타그램","아이디","handle","계정");
    const iPlatform = col("매체","platform","플랫폼");
    const iSent     = col("제품발송","발송");
    const iDeadline = col("작성마감일","마감일","마감");
    const iConfirm  = col("포스팅확인","포스팅","확인");
    const iNote     = col("비고","note","메모");
    const iExtend   = col("기간연장","연장");

    // "확인완료" / "발송완료" / O / Y / TRUE / 1 → true
    const bool = v => !!(v && (
      v==="확인완료"||v==="발송완료"||v==="완료"||
      v==="O"||v==="o"||v==="Y"||v==="y"||
      v==="TRUE"||v==="true"||v==="1"
    ));

    // M/D 또는 YYYY-MM-DD 날짜 파싱
     const parseDate = raw => {
       if(!raw) return null;
       const s = raw.trim();
       // YYYY-MM-DD
       if(s.match(/^\d{4}-\d{2}-\d{2}$/)) return s;
       // YYYY. M. D 또는 YYYY.MM.DD 또는 YYYY/MM/DD (공백 포함)
       const m1 = s.match(/^(\d{4})[\.\/]\s*(\d{1,2})[\.\/]\s*(\d{1,2})\.?$/);
       if(m1) return `${m1[1]}-${m1[2].padStart(2,"0")}-${m1[3].padStart(2,"0")}`;
       // M.D 또는 M/D
       const m2 = s.match(/^(\d{1,2})[\.\/](\d{1,2})$/);
       if(m2) return `2026-${m2[1].padStart(2,"0")}-${m2[2].padStart(2,"0")}`;
       return null;
     };
    return lines.slice(hIdx+1).filter(l=>l.some(c=>c)).map((row,ri)=>{
      const g = i => i>=0?(row[i]||"").trim():"";
      const handle = g(iHandle)||g(iName);
      const displayName = g(iName);
      if(!handle && !displayName) return null;

      const product  = g(iProduct);
      const noteRaw  = [g(iNote), g(iExtend)].filter(Boolean).join(" / ");
      const tier = /\d+만원|\d+,\d{3}원/.test(noteRaw) ? "유료" : "무료";
      const reusable = noteRaw.includes("2차활용")||noteRaw.includes("2차 활용");
      const confirmed = bool(g(iConfirm));

      return {
        id:            Date.now()+ri,
        name:          handle.startsWith("@")?handle:`@${handle}`,
        displayName:   displayName||handle,
        tier,
        followers:     "—",
        platform:      g(iPlatform)||"인스타",
        product,
        sent:          bool(g(iSent)) ? 1 : 0,
        posted:        confirmed ? 1 : 0,
        postedDate:    parseDate(g(iDeadline)),
        reach:         null, saves:null, clicks:null, conv:null,
        videoReceived: confirmed,
        reusable,
        metaUsed:      false,
        paid:          false,
        note:          noteRaw,
      };
    }).filter(Boolean);
  }
  // 인플루언서 URL 로드시 자동 fetch
  useEffect(()=>{
    if(!infUrlLoaded || !infUrl) return;
    try {
      new URL(infUrl); // URL 유효성 검사
      fetchInfSheet(infUrl);
    } catch(e) {
      // URL 고정
      setInfSheetStatus("idle");
    }
  },[infUrl, infUrlLoaded]);

  // ── 메타 데이터 집계 ─────────────────────────────
  const hasData = sheetConvRaw.length > 0 && metaRaw.length > 0;
  const hasSheet = hasData; // 하위호환 — 모든 카드/차트에서 동일 기준 사용
  // 인스타그램 게시물 광고 = 캠페인명에 "Instagram 게시물" 포함
  const isInstaPost = r => (r.campaign||r.adName||"").includes("Instagram 게시물");
  // deletedAds Set — O(1) 조회
  const deletedAdsSet = new Set(deletedAds);
  // 갤러리/소재 표시용 (숨긴 소재 제외)
  const metaFiltered = metaRaw.filter(r => !deletedAdsSet.has(r.adName||r.campaign||"") && !isInstaPost(r));
  // 차트/집계용 (숨긴 소재 포함 — 숨김은 갤러리 표시 전용, 성과 집계에선 모두 포함)
  const metaForChart = metaRaw.filter(r => !isInstaPost(r));
  const instaRaw     = metaRaw.filter(r => isInstaPost(r));
  // 최신 날짜 — 여러 곳에서 반복 계산되던 것 한 번만
  const sheetMaxDate = metaRaw.map(r=>r.date).filter(Boolean).sort().pop()||"";

  const metaAgg = hasSheet ? (() => {

    // 날짜별 집계 (전환/트래픽 분리 포함)
    const byDate = {};
    metaForChart.forEach(r=>{
      if(!r.date) return;
      if(!byDate[r.date]) byDate[r.date]={
        day:r.date.slice(5).replace("-","/"),
        spend:0, clicks:0, lpv:0, purchases:0,
        impressions:0, convValue:0, n:0,
        convSpend:0, traffSpend:0,
        convClicks:0, traffClicks:0,
      };
      const isConv = isConversionCampaign(r.objective, r.campaign, r.resultType);
      byDate[r.date].spend      += r.spend||0;
      byDate[r.date].clicks     += r.clicks||0;
      byDate[r.date].lpv        += r.lpv||0;
      byDate[r.date].purchases  += r.purchases||0;
      byDate[r.date].impressions+= r.impressions||0;
      byDate[r.date].convValue  += r.convValue||0;
      byDate[r.date].n++;
      if(isConv){ byDate[r.date].convSpend  += r.spend||0; byDate[r.date].convClicks  += r.clicks||0; }
      else      { byDate[r.date].traffSpend += r.spend||0; byDate[r.date].traffClicks += r.clicks||0; }
    });
    const daily = Object.values(byDate)
      .sort((a,b)=>a.day.localeCompare(b.day))
      .map(d=>({
        ...d,
        // CTR = 클릭/노출 × 100 (직접 계산, 더 정확)
        ctr: d.impressions>0 ? +((d.clicks/d.impressions)*100).toFixed(2) : 0,
        cpc: d.clicks>0 ? +(d.spend/d.clicks).toFixed(0) : 0,
        convCpc:  d.convClicks>0  ? +(d.convSpend/d.convClicks).toFixed(0)   : null,
        traffCpc: d.traffClicks>0 ? +(d.traffSpend/d.traffClicks).toFixed(0) : null,
        lpvRate: d.clicks>0 ? +((d.lpv/d.clicks)*100).toFixed(1) : 0,
      }));

    // 광고 집계 — 광고 ID 있으면 ID 기준, 없으면 광고명+광고세트 기준
    const byAd = {};
    metaForChart.forEach(r=>{
      // 광고 ID가 있으면 ID 기준으로 묶기 (이름 변경 대응)
      const key = r.adId
        ? r.adId + "|||" + (r.adset||"")
        : (r.adName||r.campaign||"unknown") + "|||" + (r.adset||"");
      if(!byAd[key]) byAd[key]={
        name: r.adName || r.campaign || "unknown",
        adId: r.adId || "",
        adset: r.adset || "",
        campaign: r.campaign || "",
        objective: r.objective || "",
        resultType: r.resultType || "",
        spend:0, clicks:0, lpv:0, purchases:0, convValue:0, cart:0, ctrSum:0, n:0,
        firstDate: extractAdsetStartDate(r.adset)||null, lastDate: r.date||null, lastActiveDate: null,
      };
      // 이름은 가장 최신 날짜 기준으로 업데이트 (이름 변경 반영)
      if(r.date && r.adName && (!byAd[key].lastDate || r.date >= byAd[key].lastDate)){
        byAd[key].name = r.adName;
      }
      byAd[key].spend      += r.spend;
      byAd[key].clicks     += r.clicks||r.clicksAll||0;
      byAd[key].lpv        += r.lpv;
      byAd[key].purchases  += r.purchases;
      byAd[key].convValue  += r.convValue;
      byAd[key].cart       += r.cart;
      byAd[key].ctrSum     += r.ctr||0;
      byAd[key].n          += 1;
      // 날짜 범위 추적
      if(r.date){
        // firstDate: adset명 파싱 날짜 없으면 "지출>0인 첫날" 기준 (CSV 내보내기 시작일 X)
        if((r.spend||0)>0 && !extractAdsetStartDate(r.adset)){
          if(!byAd[key].firstDate||r.date<byAd[key].firstDate) byAd[key].firstDate=r.date;
        }
        if(!byAd[key].lastDate ||r.date>byAd[key].lastDate)  byAd[key].lastDate=r.date;
        // 실제 지출 있는 마지막 날짜 (집행중 판단용)
        if((r.spend||0)>0){
          if(!byAd[key].lastActiveDate||r.date>byAd[key].lastActiveDate) byAd[key].lastActiveDate=r.date;
        }
      }
    });
    const allCampaigns = Object.values(byAd).map(c=>({
      ...c,
      cpa:     (c.purchases||0)>0 ? Math.round((c.spend||0)/(c.purchases||1)) : 0,
      roas:    (c.convValue||0)>0&&(c.spend||0)>0 ? +((c.convValue||0)/(c.spend||1)).toFixed(2) : 0,
      lpvRate: (c.clicks||0)>0 ? Math.round(((c.lpv||0)/(c.clicks||1))*100) : 0,
      cpc:     (c.clicks||0)>0 ? Math.round((c.spend||0)/(c.clicks||1)) : 0,
      ctr:     (c.n||0)>0 ? +((c.ctrSum||0)/(c.n||1)).toFixed(2) : 0,
      convValue: c.convValue||0,
      purchases: c.purchases||0,
      cart:      c.cart||0,
      clicks:    c.clicks||0,
      lpv:       c.lpv||0,
      spend:     c.spend||0,
    }));
    // 테이블 표시용 — 숨긴 광고 제외
    const campaigns    = allCampaigns.filter(c=>!deletedAdsSet.has(c.name));
    const convCamps    = campaigns.filter(c=>isConversionCampaign(c.objective, c.campaign, c.resultType));
    const trafficCamps = campaigns.filter(c=>!convCamps.includes(c));

    // KPI 합계 — 인스타 제외, 숨긴 광고 포함 (시트 원본 - 인스타)
    const totalSpend     = metaForChart.reduce((s,r)=>s+r.spend,0);
    const totalClicks    = metaForChart.reduce((s,r)=>s+r.clicks,0);
    const totalLpv       = metaForChart.reduce((s,r)=>s+r.lpv,0);
    const totalPurchases = metaForChart.reduce((s,r)=>s+r.purchases,0);
    const avgCtr         = metaForChart.length ? metaForChart.reduce((s,r)=>s+r.ctr,0)/metaForChart.length : 0;
    const avgCpc         = totalClicks ? totalSpend/totalClicks : 0;
    const avgCpa         = totalPurchases ? totalSpend/totalPurchases : 0;
    const lpvRate        = totalClicks ? (totalLpv/totalClicks)*100 : 0;

    return {totalSpend,totalClicks,totalLpv,totalPurchases,avgCtr,avgCpc,avgCpa,lpvRate,daily,campaigns,convCamps,trafficCamps};
  })() : null;

  // ── 알림 계산 ────────────────────────────────────
  const overdueIns     = infs.filter(f=>{const s=insightStatus(f);return s.label.includes("미입력")||s.label==="오늘 입력!";});
  const dangerInv      = inv.filter(i=>stockStatus(i).label==="위험");
  const cautionInv     = inv.filter(i=>stockStatus(i).label==="주의");
  const overdueScheds  = notionSch.filter(s=>{const d=daysUntil(s.endDate||s.date);return d!==null&&d<0&&d>=-14&&s.status!=="완료";});
  const urgentScheds   = notionSch.filter(s=>{const d=daysUntil(s.date);return d!==null&&d>=0&&d<=5&&s.status!=="완료";});
  // 광고 교체/보류 알림 — 시트 데이터 있을 때만
  const adAlerts = hasSheet ? metaForChart.reduce((acc, r)=>{
    const key = (r.adName||r.campaign||"") + "|||" + (r.adset||"");
    if(!key||key==="|||") return acc;
    if(!acc[key]) acc[key]={...r, name:r.adName||r.campaign||"", adset:r.adset||"", campaign:r.campaign||""};
    else {
      acc[key].spend      =(acc[key].spend||0)+(r.spend||0);
      acc[key].clicks     =(acc[key].clicks||0)+(r.clicks||r.clicksAll||0);
      acc[key].clicksAll  =(acc[key].clicksAll||0)+(r.clicksAll||0);
      acc[key].lpv        =(acc[key].lpv||0)+(r.lpv||0);
      acc[key].purchases  =(acc[key].purchases||0)+(r.purchases||0);
      acc[key].impressions=(acc[key].impressions||0)+(r.impressions||0);
    }
    return acc;
  }, {}) : {};
  const cutAds  = Object.values(adAlerts).filter(ad=>{
    if(deletedAdsSet.has(ad.name)) return false;
    const adMargin = getAdMargin(ad.name, ad.campaign, margins, margin);
    const s=adScore(ad, adMargin, getConvCriteria(ad.name, ad.campaign, convCriteria)); return s.issues.some(i=>i.label==="컷"||i.label==="랜딩문제"||i.label==="소재문제");
  });
  const holdAds = Object.values(adAlerts).filter(ad=>{
    if(deletedAdsSet.has(ad.name)) return false;
    const adMargin = getAdMargin(ad.name, ad.campaign, margins, margin);
    const s=adScore(ad, adMargin, getConvCriteria(ad.name, ad.campaign, convCriteria)); return !cutAds.includes(ad)&&s.issues.some(i=>i.label==="보류"||i.label==="보통");
  });
  const totalAlerts    = urgentScheds.length+cutAds.length+holdAds.length+orderRaw.length;

  // ── CRUD 콜백 (모달 컴포넌트에서 onSave로 호출) ─────
  async function saveInf(item){
    let next;
    if(infModalData?.mode==="edit"){
      next=infs.map(x=>x.id===item.id?item:x);
    } else {
      next=[...infs,{...item,id:Date.now()}];
    }
    setInfs(next);
    await setSetting("oa_infs_v7", next);
    setInfModalData(null);
  }
  async function saveIns(item){
    const next=infs.map(f=>f.id===item.id?{...f,...item}:f);
    setInfs(next);
    await setSetting("oa_infs_v7", next);
    setInsModalData(null);
  }
  async function deleteInf(id){
    const next=infs.filter(x=>x.id!==id);
    setInfs(next);
    await setSetting("oa_infs_v7", next);
  }
  function saveInv(item){
    if(invModalData?.mode==="edit"){
      setInv(arr=>arr.map(v=>v.id===item.id?item:v));
    } else {
      setInv(arr=>[...arr,{...item,id:Date.now()}]);
    }
    setInvModalData(null);
  }
  async function deleteInv(id){ setInv(arr=>arr.filter(v=>v.id!==id)); }
  function saveSch(item){
    if(schModalData?.mode==="edit"){
      setSch(arr=>arr.map(s=>s.id===item.id?item:s));
    } else {
      setSch(arr=>[...arr,{...item,id:Date.now()}]);
    }
    setSchModalData(null);
  }
  async function deleteSch(id){ setSch(arr=>arr.filter(s=>s.id!==id)); }

  const NAVS=[
    {id:"home",      icon:"home",           label:"홈"},
    {id:"meta",      icon:"campaign",       label:"메타광고"},
    {id:"influencer",icon:"auto_awesome",   label:"인플루언서"},
    {id:"inventory", icon:"inventory_2",    label:"재고"},
    {id:"schedule",  icon:"calendar_month", label:"스케줄"},
    {id:"erp",       icon:"storage",        label:"ERP"},
    {id:"creative",  icon:"palette",        label:"소재"},
    {id:"keyword",   icon:"search",         label:"키워드"},
    {id:"review",    icon:"check_circle",   label:"콘텐츠리뷰"},
    {id:"insight",   icon:"edit_note",      label:"팀 노트"},
  ];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🏠 홈
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const HomeSection=()=>{
    // 알림 그룹 정의
    const alertGroups = [
      {
        id:"cutAds", icon:"cancel", label:"광고 끄기", color:C.bad, bg:"#FEF0F0",
        count:cutAds.length, items:cutAds,
        render:(ad)=>ad.name,
        action:()=>{setSec("meta");setCampTab("conversion");},
        dismissAll:()=>setDeletedAds(prev=>[...new Set([...prev,...cutAds.map(a=>a.name)])]),
      },
      {
        id:"holdAds", icon:"pause_circle", label:"광고 보류", color:C.warn, bg:"#FFF8EC",
        count:holdAds.length, items:holdAds,
        render:(ad)=>ad.name,
        action:()=>{setSec("meta");setCampTab("conversion");},
        dismissAll:()=>setDeletedAds(prev=>[...new Set([...prev,...holdAds.map(a=>a.name)])]),
      },
      {
        id:"urgentScheds", icon:"notifications", label:"D-5 임박 일정", color:C.purple, bg:C.purpleLt,
        count:urgentScheds.length, items:urgentScheds,
        render:(s)=>`${daysUntil(s.date)===0?"오늘":`D-${daysUntil(s.date)}`} · ${s.title}`,
        action:()=>setSec("schedule"),
      },
      {
        id:"orderRaw", icon:"📦", label:"발주 임박", color:C.sage, bg:C.sageLt,
        count:orderRaw.length, items:orderRaw,
        render:(r)=>r["SKU명"]||r["상품명"]||"",
        action:()=>{},
      },
      {
        id:"recreateReqs", icon:"palette", label:"재제작 요청", color:"#8b5cf6", bg:"#f5f3ff",
        count:recreateReqs.filter(r=>r.status==="pending").length,
        items:recreateReqs.filter(r=>r.status==="pending"),
        render:(r)=>r.adName,
        action:()=>setSec("creative"),
      },
    ].filter(g=>g.count>0);

    const activeGroups = alertGroups.filter(g=>g.count>0);

    // 전날 광고비 계산 (로컬 타임존 기준 — toISOString은 UTC라 한국 시간과 다를 수 있음)
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
    // metaForChart 기준 — 숨김광고 포함 전체 집계
    const yRows = metaForChart.filter(r=>r.date===yStr);
    const ySpend = yRows.reduce((s,r)=>s+(r.spend||0),0);
    const yConv  = yRows.filter(r=>isConversionCampaign(r.objective,r.campaign,r.resultType)).reduce((s,r)=>s+(r.spend||0),0);
    const yTraff = yRows.filter(r=>!isConversionCampaign(r.objective,r.campaign,r.resultType)).reduce((s,r)=>s+(r.spend||0),0);
    const fmtW = n=>n>=10000?`₩${Math.round(n/10000).toLocaleString()}만`:`₩${Math.round(n).toLocaleString()}`;

    return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>

      {/* ── 전날 광고비 카드 ── */}
      {sheetConvRaw.length>0&&(
        <div onClick={()=>setSec("meta")} style={{
          background: ySpend>0 ? "linear-gradient(135deg,#1D4ED8 0%,#2563EB 100%)" : C.cream,
          borderRadius:14, padding:"14px 18px", cursor:"pointer",
          border:`1px solid ${ySpend>0?"#1D4ED8":C.border}`,
          display:"flex", alignItems:"center", justifyContent:"space-between",
          boxShadow: ySpend>0?"0 4px 20px rgba(37,99,235,0.25)":"none",
        }}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:ySpend>0?"rgba(255,255,255,0.75)":C.inkMid,marginBottom:4}}>
              전날 광고비 · {yStr}
              {ySpend===0&&metaRaw.length>0&&<span style={{marginLeft:6,fontSize:10}}>({metaRaw.map(r=>r.date).sort().pop()||"—"} 기준)</span>}
            </div>
            <div style={{fontSize:28,fontWeight:900,color:ySpend>0?"#fff":C.inkLt,lineHeight:1}}>
              {ySpend>0 ? fmtW(ySpend) : metaRaw.length===0 ? "데이터 없음" : "어제 데이터 없음"}
            </div>
            {ySpend>0&&(
              <div style={{display:"flex",gap:12,marginTop:6}}>
                <span style={{fontSize:11,color:"rgba(255,255,255,0.8)"}}>전환 {fmtW(yConv)}</span>
                <span style={{fontSize:11,color:"rgba(255,255,255,0.8)"}}>트래픽 {fmtW(yTraff)}</span>
              </div>
            )}
          </div>
          <MI n="arrow_forward_ios" size={16} style={{color:ySpend>0?"rgba(255,255,255,0.6)":C.inkLt}}/>
        </div>
      )}

      {/* ── 채널 바로가기 + ERP ── */}
      <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{fontSize:9,fontWeight:700,color:C.inkLt,letterSpacing:"0.08em"}}>빠른 링크</div>
          <button onClick={()=>setQuickLinksEditing(v=>!v)}
            style={{fontSize:9,padding:"3px 10px",borderRadius:6,border:`1px solid ${C.border}`,
              background:quickLinksEditing?C.rose:C.cream,color:quickLinksEditing?C.white:C.inkMid,
              cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
            {quickLinksEditing?"완료":"편집"}
          </button>
        </div>

        {["channel","erp"].map(group=>(
          <div key={group} style={{marginBottom:10}}>
            <div style={{fontSize:9,color:C.inkLt,fontWeight:600,marginBottom:6}}>
              {group==="channel"?"판매 채널":"ERP / 사내 툴"}
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              {quickLinks.filter(l=>l.group===group).map(ch=>(
                quickLinksEditing ? (
                  <div key={ch.id} style={{display:"flex",alignItems:"center",gap:4,
                    background:C.cream,borderRadius:8,padding:"4px 8px",border:`1px solid ${C.border}`}}>
                    {/* 이름 편집 */}
                    <input
                      value={ch.name||""}
                      onChange={e=>setQuickLinks(quickLinks.map(x=>x.id===ch.id?{...x,name:e.target.value}:x))}
                      placeholder="이름"
                      style={{width:70,padding:"3px 6px",border:`1px solid ${C.border}`,borderRadius:6,
                        fontSize:10,fontFamily:"inherit",outline:"none",fontWeight:700}}
                    />
                    {/* URL 편집 */}
                    <input
                      value={ch.url||""}
                      onChange={e=>setQuickLinks(quickLinks.map(x=>x.id===ch.id?{...x,url:e.target.value}:x))}
                      placeholder="https://..."
                      style={{width:180,padding:"3px 6px",border:`1px solid ${C.border}`,borderRadius:6,
                        fontSize:10,fontFamily:"inherit",outline:"none"}}
                    />
                    {/* 삭제 */}
                    <button onClick={()=>setQuickLinks(quickLinks.filter(x=>x.id!==ch.id))}
                      style={{background:"none",border:"none",cursor:"pointer",color:C.bad,fontSize:13,padding:"0 2px",lineHeight:1}}>
                      ✕
                    </button>
                  </div>
                ) : (
                  <a key={ch.id} href={ch.url||"#"} target={ch.url?"_blank":"_self"} rel="noopener noreferrer"
                    onClick={e=>{if(!ch.url)e.preventDefault();}}
                    style={{padding:"5px 14px",borderRadius:20,border:`1px solid ${C.border}`,
                      background:C.cream,color:ch.url?C.ink:C.inkLt,fontSize:11,fontWeight:700,
                      textDecoration:"none",whiteSpace:"nowrap",opacity:ch.url?1:0.5}}
                    onMouseEnter={e=>{if(ch.url){e.currentTarget.style.background=group==="erp"?C.purple:C.rose;e.currentTarget.style.color=C.white;e.currentTarget.style.borderColor=group==="erp"?C.purple:C.rose;}}}
                    onMouseLeave={e=>{e.currentTarget.style.background=C.cream;e.currentTarget.style.color=ch.url?C.ink:C.inkLt;e.currentTarget.style.borderColor=C.border;}}>
                    {ch.name}
                  </a>
                )
              ))}
              {/* 항목 추가 버튼 */}
              {quickLinksEditing&&(
                <button onClick={()=>setQuickLinks([...quickLinks,{id:`${group}_${Date.now()}`,name:"새 링크",url:"",group}])}
                  style={{padding:"4px 12px",borderRadius:20,border:`1px dashed ${C.border}`,
                    background:"transparent",color:C.inkLt,fontSize:11,fontWeight:700,
                    cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                  + 추가
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── 상단 헤더 배너 ── */}
      <div style={{background:totalAlerts>0?`linear-gradient(135deg,${C.bad},#EF4444)`:`linear-gradient(135deg,${C.good},#22C55E)`,
        borderRadius:16,padding:"18px 20px",color:C.white,boxShadow:`0 4px 20px rgba(0,0,0,0.12)`}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",opacity:0.75,marginBottom:6}}>TODAY · {dateStr}</div>
        <div style={{fontSize:24,fontWeight:900,lineHeight:1.15}}>
          {totalAlerts>0?`확인 필요 ${totalAlerts}건`:"모두 정상 ✅"}
        </div>
        {totalAlerts>0&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10}}>
            {activeGroups.map(g=>(
              <span key={g.id} onClick={g.action} style={{
                fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,
                background:"rgba(255,255,255,0.2)",color:C.white,
                cursor:"pointer",backdropFilter:"blur(4px)",border:"1px solid rgba(255,255,255,0.3)"}}>
                <MI n={g.icon} size={10}/> {g.label} {g.count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── 알림 없을 때 ── */}
      {totalAlerts===0&&(
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,
          padding:"28px",textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:8}}><MI n="celebration" size={32}/></div>
          <div style={{fontSize:13,fontWeight:800,color:C.ink}}>오늘은 처리할 항목이 없어요</div>
          <div style={{fontSize:11,color:C.inkLt,marginTop:4}}>재고·광고·인플루언서·일정 모두 정상</div>
        </div>
      )}

      {/* ── 알림 그룹 컴팩트 카드 ── */}
      {activeGroups.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {activeGroups.map(g=>(
            <div key={g.id} style={{background:C.white,border:`1px solid ${g.color}33`,
              borderRadius:14,overflow:"hidden"}}>
              {/* 헤더 */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"12px 16px",background:g.bg}}>
                <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",flex:1}} onClick={g.action}>
                  <span style={{fontSize:16}}>{g.icon}</span>
                  <span style={{fontSize:12,fontWeight:800,color:g.color}}>{g.label}</span>
                  <span style={{fontSize:11,fontWeight:900,color:C.white,background:g.color,
                    padding:"1px 8px",borderRadius:20,minWidth:20,textAlign:"center"}}>{g.count}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  {g.dismissAll&&(
                    <button onClick={e=>{e.stopPropagation();g.dismissAll();}}
                      style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:6,cursor:"pointer",
                        border:`1px solid ${g.color}44`,background:"transparent",color:g.color,fontFamily:"inherit"}}>
                      전체 삭제
                    </button>
                  )}
                  <span onClick={g.action} style={{fontSize:10,color:g.color,fontWeight:700,opacity:0.7,cursor:"pointer"}}>→ 바로가기</span>
                </div>
              </div>
              {/* 아이템 목록 */}
              <div style={{padding:"8px 16px 10px"}}>
                {g.items.slice(0,3).map((item,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:6,
                    padding:"5px 0",borderBottom:i<Math.min(g.items.length,3)-1?`1px solid ${C.border}`:"none"}}>
                    <div style={{width:4,height:4,borderRadius:"50%",background:g.color,flexShrink:0}}/>
                    <span style={{fontSize:11,color:C.ink,fontWeight:600,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {g.render(item)}
                    </span>
                  </div>
                ))}
                {g.items.length>3&&(
                  <div style={{fontSize:10,color:C.inkLt,marginTop:4,textAlign:"center"}}>
                    +{g.items.length-3}개 더
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 발주임박은 알림 그룹에 통합됨 — 상세 테이블은 재고 섹션에서 확인 */}

      {/* 월별 성과 비교 → 총광고비 탭으로 이동 */}

      {/* 발주임박 시트 연결 모달 */}
      {orderModal&&(
        <Modal title={<><MI n="inventory_2"/> 발주임박 시트 연결</>} onClose={()=>setOrderModal(false)} wide>
          <div style={{background:C.sageLt,borderRadius:10,padding:"12px 14px",marginBottom:16,fontSize:11,color:C.sage,fontWeight:700}}>
            💡 구글시트 발주분석 파일의 <b>📋발주임박목록</b> 시트 URL을 붙여넣으세요<br/>
            <span style={{fontWeight:400,color:C.inkMid}}>시트 공유 설정 → "링크 있는 모든 사용자" → 뷰어 권한</span>
          </div>
          <FR label="구글시트 URL">
            <Inp value={orderInput} onChange={setOrderInput} placeholder="https://docs.google.com/spreadsheets/d/..."/>
          </FR>
          <Btn onClick={()=>{
            const url=orderInput.trim();
            // URL 고정
            setOrderModal(false);
            if(url) fetchOrderSheet(url);
          }} style={{width:"100%",marginTop:8}}><MI n="link" size={13}/> 연결하기</Btn>
        </Modal>
      )}
    </div>
    );
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📣 메타광고
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const MetaSection=(()=>{
    const d = metaAgg;
    const fmt=n=>n>=10000?`₩${Math.round(n/10000).toLocaleString()}만`:`₩${Math.round(n).toLocaleString()}`;
    const [showDeletedPanel, setShowDeletedPanel] = useState(false);

    // 월 선택기 — 집행중 광고성과 / 전체 광고비 카드용
    const availableMonths = [...new Set(metaRaw.map(r=>r.date?.slice(0,7)).filter(Boolean))].sort();
    const defaultMonth = availableMonths[availableMonths.length-1] || "";
    const [selectedMonth, setSelectedMonth] = useState("");
    const activeMonth = selectedMonth || defaultMonth;
    // 선택한 달의 데이터만 필터
    const monthFiltered = metaFiltered.filter(r=>r.date?.startsWith(activeMonth));
    const monthRaw      = metaRaw.filter(r=>r.date?.startsWith(activeMonth));


    return(
      <div style={{display:"flex",flexDirection:"column",gap:14}}>

        {/* ── 목표 메모 ── */}
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:metaGoalEditing?10:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
              <span style={{fontSize:14}}>🎯</span>
              {metaGoalEditing ? (
                <textarea
                  value={metaGoalInput}
                  onChange={e=>setMetaGoalInput(e.target.value)}
                  placeholder="이번 캠페인 목표를 입력하세요 (예: 3월 ROAS 700% 달성, CPA 5,000원 이하 유지)"
                  style={{flex:1,padding:"8px 10px",border:`1px solid ${C.rose}`,borderRadius:8,
                    fontSize:11,color:C.ink,background:C.cream,outline:"none",fontFamily:"inherit",
                    resize:"vertical",minHeight:60,lineHeight:1.6}}
                />
              ) : (
                <span style={{fontSize:12,color:metaGoal?C.ink:C.inkLt,fontWeight:metaGoal?700:400,lineHeight:1.6,flex:1}}>
                  {metaGoal||"목표를 입력하면 팀 전체가 볼 수 있어요"}
                </span>
              )}
            </div>
            <div style={{display:"flex",gap:6,marginLeft:10,flexShrink:0}}>
              {metaGoalEditing ? (
                <>
                  <Btn small onClick={()=>{setMetaGoal(metaGoalInput);setMetaGoalEditing(false);}}><MI n="save" size={13}/> 저장</Btn>
                  <Btn small variant="neutral" onClick={()=>setMetaGoalEditing(false)}>취소</Btn>
                </>
              ) : (
                <Btn small variant="neutral" onClick={()=>{setMetaGoalInput(metaGoal);setMetaGoalEditing(true);}}><MI n="edit" size={13}/> {metaGoal?"수정":"입력"}</Btn>
              )}
            </div>
          </div>
        </div>
        {/* 데이터 상태 배너 */}
        <div style={{
          background: sheetConvRaw.length>0 ? "#EDF7F1" : C.goldLt,
          border:`1px solid ${sheetConvRaw.length>0?C.good+"55":C.gold+"66"}`,
          borderRadius:12,padding:"12px 16px",
          display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <MI n="bar_chart" size={20}/>
            <div>
              {sheetConvRaw.length>0 ? (
                <>
                  <div style={{fontSize:12,fontWeight:800,color:C.good}}>데이터 연결됨 · {metaRaw.length}건{deletedAds.length>0&&<span style={{color:C.inkLt,fontWeight:600}}> ({deletedAds.length}개 숨김)</span>}</div>
                  <div style={{fontSize:10,color:C.inkMid,marginTop:1}}>기간: {metaRaw.map(r=>r.date).filter(Boolean).sort()[0]||"—"} ~ {sheetMaxDate||"—"}</div>
                </>
              ) : (
                <div style={{fontSize:12,fontWeight:700,color:C.gold}}>전환 시트를 연결해주세요</div>
              )}
            </div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            {sheetUrl && <Btn variant="sage" small onClick={()=>fetchSheet(sheetUrl)}><MI n="refresh" size={13}/> 새로고침</Btn>}
            <Btn variant={sheetConvRaw.length>0?"neutral":"gold"} small onClick={()=>{setSheetInput(sheetUrl);setSheetModal(true);}}>
              <MI n="table_chart" size={13}/> {sheetConvRaw.length>0?`시트 (${sheetConvRaw.length}건)`:"시트 연결"}
            </Btn>
            {deletedAds.length>0&&(
              <div style={{position:"relative"}}>
                <Btn variant="neutral" small onClick={()=>setShowDeletedPanel(p=>!p)}>
                  <MI n="undo" size={13}/> 숨긴 광고 ({deletedAds.length}) {showDeletedPanel?"▲":"▼"}
                </Btn>
                {showDeletedPanel&&(
                  <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:200,
                    background:"#fff",border:`1px solid ${C.border}`,borderRadius:12,
                    boxShadow:"0 8px 24px rgba(0,0,0,0.12)",minWidth:260,padding:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                      padding:"4px 8px 8px",borderBottom:`1px solid ${C.border}`,marginBottom:4}}>
                      <span style={{fontSize:11,fontWeight:700,color:C.inkMid}}>최근 숨긴 순서</span>
                      <button onClick={()=>{setDeletedAds([]);setShowDeletedPanel(false);}}
                        style={{fontSize:10,fontWeight:700,color:C.rose,background:"none",border:`1px solid ${C.rose}`,
                          borderRadius:6,padding:"2px 8px",cursor:"pointer",fontFamily:"inherit"}}>
                        전체 복원
                      </button>
                    </div>
                    {[...deletedAds].reverse().map((name,i)=>(
                      <div key={name} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",
                        borderRadius:8,transition:"background 0.1s"}}>
                        <span style={{fontSize:10,color:C.inkMid,flexShrink:0,width:16,textAlign:"right"}}>{i+1}</span>
                        <span style={{flex:1,fontSize:11,fontWeight:600,color:C.ink,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={name}>{name}</span>
                        <button onClick={()=>{
                          const next=deletedAds.filter(n=>n!==name);
                          setDeletedAds(next);
                          if(next.length===0) setShowDeletedPanel(false);
                        }} style={{fontSize:10,fontWeight:700,color:"#4DAD7A",background:"none",
                          border:`1px solid #4DAD7A`,borderRadius:6,padding:"2px 8px",
                          cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                          복원
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Btn variant="ghost" small onClick={()=>{setMarginInput(String(margin));setMarginModal(true)}}>⚙️ 기준 설정</Btn>
          </div>
        </div>


        {/* ── 월 선택기 (집행중/전체광고비 카드용) ── */}
        {hasSheet&&availableMonths.length>1&&(
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:11,color:C.inkLt,fontWeight:700,marginRight:2}}>월별 보기</span>
            {availableMonths.map(m=>{
              const [y,mo]=m.split("-");
              const label=`${parseInt(mo)}월`;
              const active=m===activeMonth;
              return(
                <button key={m} onClick={()=>setSelectedMonth(m===defaultMonth?"":m)}
                  style={{padding:"4px 12px",borderRadius:20,border:`1.5px solid ${active?"#7c3aed":C.border}`,
                    background:active?"#7c3aed":"transparent",color:active?"#fff":C.inkMid,
                    fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  {y}.{label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── 카드1: 집행중 광고 성과 (시트 기준) ── */}
        {hasSheet&&(()=>{
          const fmtW = n=>n>=10000?`₩${Math.round(n/10000).toLocaleString()}만`:`₩${Math.round(n).toLocaleString()}`;

          // 최신 달이면 집행중(3일)만, 과거 달이면 해당 월 전체
          const isLatestMonth = activeMonth === defaultMonth;
          let activeRows;
          let activeKeys;
          if(isLatestMonth){
            const adLastSpend={};
            monthFiltered.forEach(r=>{
              const key=(r.adName||r.campaign||"")+"|||"+(r.adset||"");
              if((r.spend||0)>0&&r.date&&(!adLastSpend[key]||r.date>adLastSpend[key])) adLastSpend[key]=r.date;
            });
            activeKeys=new Set(Object.entries(adLastSpend)
              .filter(([,d])=>sheetMaxDate&&Math.floor((new Date(sheetMaxDate)-new Date(d))/86400000)<=3)
              .map(([k])=>k));
            activeRows=monthFiltered.filter(r=>activeKeys.has((r.adName||r.campaign||"")+"|||"+(r.adset||"")));
          } else {
            activeRows = monthFiltered;
            activeKeys = new Set(monthFiltered.map(r=>(r.adName||r.campaign||"")+"|||"+(r.adset||"")));
          }

          const agg = rows=>({
            spend:  rows.reduce((s,r)=>s+(r.spend||0),0),
            purch:  rows.reduce((s,r)=>s+(r.purchases||0),0),
            convV:  rows.reduce((s,r)=>s+(r.convValue||0),0),
            clicks: rows.reduce((s,r)=>s+(r.clicks||0),0),
            lpv:    rows.reduce((s,r)=>s+(r.lpv||0),0),
            ads:    [...new Set(rows.map(r=>(r.adName||r.campaign||"")+"|||"+(r.adset||"")).filter(Boolean))].length,
          });

          const conv    = agg(activeRows.filter(r=>isConversionCampaign(r.objective,r.campaign,r.resultType)));
          const traffic = agg(activeRows.filter(r=>!isConversionCampaign(r.objective,r.campaign,r.resultType)));
          const total   = agg(activeRows);

          const dates = monthRaw.map(r=>r.date).filter(Boolean).sort();
          const period = dates.length?`${dates[0].slice(5).replace("-","/")} ~ ${dates[dates.length-1].slice(5).replace("-","/")}`:activeMonth

          const Col=({label,icon,data,accent})=>{
            const cpa  = (s,p)=>p>0?fmtW(s/p):"—";
            const roas = (v,s)=>s>0?`${Math.round((v/s)*100)}%`:"—";
            const lpvR = (l,c)=>c>0?`${Math.round((l/c)*100)}%`:"—";
            const cpc  = (s,c)=>c>0?`₩${Math.round(s/c).toLocaleString()}`:"—";
            return(
            <div style={{background:"rgba(255,255,255,0.07)",borderRadius:12,padding:"14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:10}}>
                {typeof icon==="string"&&icon.length<30?<MI n={icon} size={14}/>:<span>{icon}</span>}
                <span style={{fontSize:11,fontWeight:800,color:accent||"rgba(255,255,255,0.9)"}}>{label}</span>
                <span style={{marginLeft:"auto",fontSize:10,opacity:0.4}}>{data.ads}개</span>
              </div>
              <div style={{fontSize:18,fontWeight:900,color:"rgba(255,255,255,0.95)",marginBottom:8}}>{fmtW(data.spend)}</div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {[
                  ["구매",   `${data.purch}건`],
                  ["ROAS",   roas(data.convV,data.spend)],
                  ["CPA",    cpa(data.spend,data.purch)],
                  ["CPC",    cpc(data.spend,data.clicks)],
                  ["LPV율",  lpvR(data.lpv,data.clicks)],
                  ["클릭",   data.clicks.toLocaleString()],
                  ["LPV",    data.lpv.toLocaleString()],
                ].map(([l,v])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:9,opacity:0.45,fontWeight:600}}>{l}</span>
                    <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.85)"}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            );
          };

          return(
            <div style={{background:C.ink,borderRadius:14,padding:"16px 18px",color:C.white}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:8,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:800,letterSpacing:"0.05em"}}><MI n="bar_chart" size={14}/> {isLatestMonth?"집행중 광고 성과":`${parseInt(activeMonth.slice(5))}월 광고 성과`}</div>
                  <div style={{fontSize:10,opacity:0.5,marginTop:2}}>{period} · {isLatestMonth?`집행중 ${activeKeys.size}개`:`광고 ${activeKeys.size}개`}</div>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
                  {instaRaw.length>0&&(
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:9,opacity:0.4}}><MI n="photo_camera" size={10}/> 인스타 게시물</div>
                      <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.5)"}}>{fmtW(instaRaw.reduce((s,r)=>s+(r.spend||0),0))}</div>
                    </div>
                  )}
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:9,opacity:0.5}}>집행중 총 광고비</div>
                    <div style={{fontSize:20,fontWeight:900,color:"#86efac"}}>{fmtW(total.spend)}</div>
                  </div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                <Col label="전환" icon="track_changes" data={conv} accent="#f9a8d4"/>
                <Col label="트래픽" icon="traffic" data={traffic} accent="#93c5fd"/>
                <Col label="합산" icon="bar_chart" data={total} accent="#86efac"/>
              </div>
            </div>
          );
        })()}

        {/* ── 카드2: 전체 광고비 (시트+API 합산) ── */}
        {hasData&&(()=>{
          const fmtW = n=>n>=10000?`₩${Math.round(n/10000).toLocaleString()}만`:`₩${Math.round(n).toLocaleString()}`;
          const allRows = monthRaw.filter(r=>!isInstaPost(r));
          const allConv    = allRows.filter(r=>isConversionCampaign(r.objective,r.campaign,r.resultType));
          const allTraffic = allRows.filter(r=>!isConversionCampaign(r.objective,r.campaign,r.resultType));
          const spend = arr=>arr.reduce((s,r)=>s+(r.spend||0),0);
          const purch = arr=>arr.reduce((s,r)=>s+(r.purchases||0),0);
          const convV = arr=>arr.reduce((s,r)=>s+(r.convValue||0),0);
          const ads   = arr=>[...new Set(arr.map(r=>(r.adName||r.campaign||"")+"|||"+(r.adset||"")).filter(Boolean))].length;

          return(
            <div style={{background:"#1e1e2e",borderRadius:14,padding:"16px 18px",color:C.white,
              border:"1px solid rgba(255,255,255,0.08)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:8,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:800,letterSpacing:"0.05em"}}><MI n="payments" size={14}/> {parseInt(activeMonth.slice(5))}월 전체 광고비</div>
                  <div style={{fontSize:10,opacity:0.4,marginTop:2}}>시트 기준 합산</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:9,opacity:0.5}}>총 광고비</div>
                  <div style={{fontSize:20,fontWeight:900,color:"#fbbf24"}}>{fmtW(spend(allRows))}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                {[
                  {label:"전환",icon:"track_changes",rows:allConv,accent:"#f9a8d4"},
                  {label:"트래픽",icon:"traffic",rows:allTraffic,accent:"#93c5fd"},
                  {label:"합산",icon:"bar_chart",rows:allRows,accent:"#fbbf24"},
                ].map(({label,icon,rows,accent})=>(
                  <div key={label} style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"12px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}>
                      <MI n={icon} size={14}/>
                      <span style={{fontSize:11,fontWeight:800,color:accent}}>{label}</span>
                      <span style={{marginLeft:"auto",fontSize:10,opacity:0.35}}>{ads(rows)}개</span>
                    </div>
                    <div style={{fontSize:16,fontWeight:900,color:"rgba(255,255,255,0.9)",marginBottom:6}}>{fmtW(spend(rows))}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:3}}>
                      {[
                        ["구매",`${purch(rows)}건`],
                        ["ROAS",spend(rows)>0?`${Math.round((convV(rows)/spend(rows))*100)}%`:"—"],
                        ["CPA", purch(rows)>0?fmtW(spend(rows)/purch(rows)):"—"],
                      ].map(([l,v])=>(
                        <div key={l} style={{display:"flex",justifyContent:"space-between"}}>
                          <span style={{fontSize:9,opacity:0.4,fontWeight:600}}>{l}</span>
                          <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.7)"}}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* 광고 소재 이미지/영상 업로드 — 드래그앤드롭 */}
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontWeight:700,fontSize:13,color:C.ink}}>🎬 광고 소재</div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {imgUploading&&<span style={{fontSize:10,color:C.inkLt}}><MI n="hourglass_empty" size={13}/> 업로드 중...</span>}
              {imgError&&<span style={{fontSize:10,color:C.bad,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={imgError}><MI n="cancel" size={13}/> {imgError}</span>}
              <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple style={{display:"none"}}
                onChange={e=>handleAdImageUpload(e.target.files)}/>
              {adImages.length>0&&<button onClick={async()=>{if(confirm("업로드된 소재를 모두 삭제할까요?")){{setAdImages([]);await saveAdImagesMeta([]);}}}}
                style={{fontSize:11,fontWeight:600,padding:"5px 10px",borderRadius:8,
                  border:`1px solid ${C.bad}44`,background:"#fff5f5",cursor:"pointer",
                  color:C.bad,fontFamily:"inherit"}}>
                전체삭제
              </button>}
              <button onClick={()=>fileInputRef.current?.click()}
                style={{fontSize:11,fontWeight:600,padding:"5px 14px",borderRadius:8,
                  border:`1px solid ${C.border}`,background:C.white,cursor:"pointer",
                  color:C.rose,fontFamily:"inherit"}}>
                + 소재 추가
              </button>
            </div>
          </div>
          {/* 드래그앤드롭 영역 */}
          <div
            onDrop={e=>{e.preventDefault();e.stopPropagation();setIsDragging(false);const f=e.dataTransfer.files;if(f?.length)handleAdImageUpload(f);}}
            onDragOver={e=>{e.preventDefault();setIsDragging(true);}}
            onDragEnter={e=>{e.preventDefault();setIsDragging(true);}}
            onDragLeave={e=>{e.preventDefault();setIsDragging(false);}}
            onClick={()=>adImages.length===0&&fileInputRef.current?.click()}
            style={{
              border:`2px dashed ${isDragging?C.rose:adImages.length?C.border+"88":C.border}`,
              borderRadius:10,
              padding:adImages.length?"10px":"28px 16px",
              background:isDragging?C.blush:"transparent",
              transition:"all 0.2s",
              cursor:adImages.length?"default":"pointer",
            }}
          >
            {adImages.length===0?(
              <div style={{textAlign:"center",pointerEvents:"none"}}>
                <div style={{fontSize:24,marginBottom:6}}><MI n="folder_open" size={24}/></div>
                <div style={{fontSize:11,fontWeight:700,color:isDragging?C.rose:C.inkMid}}>
                  {isDragging?"여기에 놓으세요!":"파일을 드래그해서 놓거나 클릭해서 추가"}
                </div>
                <div style={{fontSize:10,color:C.inkLt,marginTop:3}}>이미지·영상 모두 가능 · 광고명과 자동 매칭</div>
              </div>
            ):(
              <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-start"}}>
                {adImages.map((img,i)=>(
                  <div key={i} style={{position:"relative",display:"inline-flex",flexDirection:"column",alignItems:"center",gap:4}}>
                    <ThumbPreview url={img.url} name={img.name}/>
                    <span style={{fontSize:9,color:C.inkMid,maxWidth:56,textAlign:"center",
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{img.name}</span>
                    <button onClick={async(e)=>{
                      e.stopPropagation();
                      const next=adImages.filter((_,j)=>j!==i);
                      setAdImages(next);
                      await saveAdImagesMeta(next);
                    }} style={{position:"absolute",top:-4,right:-4,width:16,height:16,borderRadius:"50%",
                      background:C.bad,color:"#fff",border:"none",cursor:"pointer",fontSize:9,
                      display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>✕</button>
                  </div>
                ))}
                {isDragging&&(
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",
                    width:56,height:56,borderRadius:8,border:`2px dashed ${C.rose}`,
                    background:C.blush,fontSize:20,pointerEvents:"none"}}>+</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 탭 */}
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
          {[{id:"overview",label:<><MI n="trending_up" size={12}/> 추이</>},{id:"campaign",label:<><MI n="campaign" size={12}/> 캠페인</>},{id:"weekly",label:<><MI n="calendar_month" size={12}/> 주별</>},{id:"monthly",label:<><MI n="date_range" size={12}/> 월별</>},{id:"daily",label:<><MI n="calendar_today" size={12}/> 일별</>},{id:"product",label:<><MI n="inventory_2" size={12}/> 제품별</>}].map(t=>(
            <button key={t.id} onClick={()=>setMetaTab(t.id)} style={{
              padding:"6px 16px",borderRadius:8,cursor:"pointer",border:`1px solid ${metaTab===t.id?C.rose:C.border}`,
              background:metaTab===t.id?C.blush:C.white,color:metaTab===t.id?C.rose:C.inkMid,
              fontSize:11,fontWeight:700,whiteSpace:"nowrap",transition:"all 0.2s",fontFamily:"inherit"}}>{t.label}</button>
          ))}
        </div>

        {/* 추이 탭 */}
        {metaTab==="overview"&&(
          <>
            {!hasSheet&&(
              <div style={{textAlign:"center",padding:"40px 0",color:C.inkLt}}>
                <div style={{fontSize:36,marginBottom:10}}><MI n="bar_chart" size={36}/></div>
                <div style={{fontSize:13,fontWeight:700,color:C.inkMid}}>데이터 없음 — 시트를 연결해주세요</div>
              </div>
            )}
            {hasSheet&&d&&(<>
              <Card>
                <CardTitle title="일별 광고비" sub="전환(분홍) + 트래픽(파랑) 누적"/>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={d.daily} stackOffset="none">
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                    <XAxis dataKey="day" tick={{fontSize:8,fill:C.inkLt}} axisLine={false} tickLine={false} interval={Math.floor(d.daily.length/6)}/>
                    <YAxis tick={{fontSize:8,fill:C.inkLt}} axisLine={false} tickLine={false}
                      tickFormatter={v=>v>=10000?`${Math.round(v/10000)}만`:v}/>
                    <Tooltip formatter={(v,n)=>[`₩${Math.round(v/10000).toLocaleString()}만`,n]} labelStyle={{fontWeight:700,fontSize:11}}/>
                    <Bar dataKey="convSpend"  stackId="a" fill="#f9a8d4" name="전환"/>
                    <Bar dataKey="traffSpend" stackId="a" fill={C.roseLt} radius={[3,3,0,0]} name="트래픽"/>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{display:"flex",gap:16,justifyContent:"flex-end",marginTop:4}}>
                  {[{c:"#f9a8d4",l:"전환"},{c:C.roseLt,l:"트래픽"}].map(({c,l})=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:C.inkMid}}>
                      <div style={{width:12,height:12,background:c,borderRadius:3}}/>{l}
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <CardTitle title="클릭수 vs LPV 일별 추이" sub="클릭 대비 랜딩 도달 흐름"/>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={d.daily}>
                    <defs>
                      <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.rose} stopOpacity={0.2}/><stop offset="95%" stopColor={C.rose} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.sage} stopOpacity={0.2}/><stop offset="95%" stopColor={C.sage} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                    <XAxis dataKey="day" tick={{fontSize:9,fill:C.inkLt}} axisLine={false} tickLine={false} interval={Math.floor(d.daily.length/7)}/>
                    <YAxis tick={{fontSize:9,fill:C.inkLt}} axisLine={false} tickLine={false}/>
                    <Tooltip content={<BeautyTooltip/>}/>
                    <Area type="monotone" dataKey="clicks" stroke={C.rose} strokeWidth={2.5} fill="url(#cg)" name="링크클릭"/>
                    <Area type="monotone" dataKey="lpv"    stroke={C.sage} strokeWidth={2}   fill="url(#lg)" name="LPV"/>
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{display:"flex",gap:16,justifyContent:"flex-end",marginTop:4}}>
                  {[{c:C.rose,l:"링크클릭"},{c:C.sage,l:"LPV"}].map(({c,l})=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:C.inkMid}}>
                      <div style={{width:14,height:3,background:c,borderRadius:2}}/>{l}
                    </div>
                  ))}
                </div>
              </Card>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Card>
                  <CardTitle title="CTR 추이" sub="일별 클릭률 (링크클릭/노출)"/>
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={d.daily}>
                      <defs>
                        <linearGradient id="ctrg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.gold} stopOpacity={0.25}/><stop offset="95%" stopColor={C.gold} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                      <XAxis dataKey="day" tick={{fontSize:8,fill:C.inkLt}} axisLine={false} tickLine={false} interval={Math.floor(d.daily.length/5)}/>
                      <YAxis tick={{fontSize:8,fill:C.inkLt}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
                      <Tooltip content={<BeautyTooltip fmt={v=>`${v}%`}/>}/>
                      <Area type="monotone" dataKey="ctr" stroke={C.gold} strokeWidth={2} fill="url(#ctrg)" name="CTR"/>
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
                <Card>
                  <CardTitle title="LPV율 추이" sub="링크클릭 → 랜딩 도달률"/>
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={d.daily}>
                      <defs>
                        <linearGradient id="lpvrg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.purple} stopOpacity={0.25}/><stop offset="95%" stopColor={C.purple} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                      <XAxis dataKey="day" tick={{fontSize:8,fill:C.inkLt}} axisLine={false} tickLine={false} interval={Math.floor(d.daily.length/5)}/>
                      <YAxis tick={{fontSize:8,fill:C.inkLt}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
                      <Tooltip content={<BeautyTooltip fmt={v=>`${v}%`}/>}/>
                      <Area type="monotone" dataKey="lpvRate" stroke={C.purple} strokeWidth={2} fill="url(#lpvrg)" name="LPV율"/>
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </div>
              <Card>
                <CardTitle title="일별 CPC" sub="전환(분홍) vs 트래픽(파랑)"/>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={d.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                    <XAxis dataKey="day" tick={{fontSize:8,fill:C.inkLt}} axisLine={false} tickLine={false} interval={Math.floor(d.daily.length/6)}/>
                    <YAxis tick={{fontSize:8,fill:C.inkLt}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?`${Math.round(v/1000)}k`:v}/>
                    <Tooltip formatter={(v,n)=>[v!=null?`₩${Math.round(v).toLocaleString()}`:"—",n]} labelStyle={{fontWeight:700,fontSize:11}}/>
                    <Line type="monotone" dataKey="convCpc"  stroke="#f9a8d4" strokeWidth={2} dot={false} name="전환 CPC" connectNulls={false}/>
                    <Line type="monotone" dataKey="traffCpc" stroke={C.roseLt} strokeWidth={2} dot={false} name="트래픽 CPC" connectNulls={false}/>
                  </LineChart>
                </ResponsiveContainer>
                <div style={{display:"flex",gap:16,justifyContent:"flex-end",marginTop:4}}>
                  {[{c:"#f9a8d4",l:"전환 CPC"},{c:C.roseLt,l:"트래픽 CPC"}].map(({c,l})=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:C.inkMid}}>
                      <div style={{width:14,height:3,background:c,borderRadius:2}}/>{l}
                    </div>
                  ))}
                </div>
              </Card>
              <div style={{background:`linear-gradient(135deg,${C.blush},${C.white})`,
                border:`1px solid ${C.rose}33`,borderRadius:14,padding:"16px",
                display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
                <div>
                  <div style={{fontSize:10,color:C.rose,fontWeight:700,letterSpacing:"0.1em"}}>CLICK → LPV 전환율</div>
                  <div style={{fontSize:32,fontWeight:900,color:C.rose,lineHeight:1.1}}>{d.lpvRate.toFixed(1)}%</div>
                  <div style={{fontSize:10,color:C.inkMid}}>{d.totalClicks.toLocaleString()} 클릭 → {d.totalLpv.toLocaleString()} 랜딩 도달</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,color:C.inkLt}}>기간 평균 CPC</div>
                  <div style={{fontSize:22,fontWeight:900,color:C.gold}}>₩{Math.round(d.avgCpc).toLocaleString()}</div>
                  <div style={{fontSize:10,color:C.inkLt}}>총 {d.campaigns.length}개 캠페인</div>
                </div>
              </div>
            </>)}
          </>
        )}

        {/* 캠페인 탭 */}
        {metaTab==="campaign"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {!hasSheet&&(
              <div style={{textAlign:"center",padding:"40px 0",color:C.inkLt}}>
                <div style={{fontSize:36,marginBottom:10}}><MI n="campaign" size={36}/></div>
                <div style={{fontSize:13,fontWeight:700,color:C.inkMid}}>데이터 없음 — 시트를 연결해주세요</div>
              </div>
            )}
            {hasSheet&&d&&(<>
              <div style={{display:"flex",gap:4,padding:"4px",background:C.cream,borderRadius:12,width:"fit-content"}}>
                {[{id:"conversion",label:"🛒 전환 캠페인"},{id:"traffic",label:"🚀 트래픽 캠페인"}].map(t=>(
                  <button key={t.id} onClick={()=>setCampTab(t.id)} style={{
                    padding:"7px 16px",borderRadius:9,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit",
                    background:campTab===t.id?C.white:"transparent",color:campTab===t.id?C.ink:C.inkMid,
                    boxShadow:campTab===t.id?"0 2px 8px rgba(43,31,46,0.1)":"none",transition:"all 0.2s"}}>{t.label}</button>
                ))}
              </div>

              {/* ── 상위 광고 소재 카드 ── */}
              {(()=>{
                const camps = campTab==="conversion" ? d.convCamps : d.trafficCamps;
                const fmtW = n=>n>=10000?`₩${Math.round(n/10000).toLocaleString()}만`:`₩${Math.round(n).toLocaleString()}`;

                // 집행중 + 판정 좋은 광고만
                const topAds = camps.filter(c=>{
                  const lad = c.lastActiveDate;
                  const isActive = lad && sheetMaxDate && Math.floor((new Date(sheetMaxDate)-new Date(lad))/86400000)<=1;
                  if(!isActive) return false;
                  if(campTab==="conversion"){
                    const adMargin = getAdMargin(c.name,c.campaign,margins,margin);
                    const cpa = cpaStatus(c.spend,c.purchases,adMargin,getConvCriteria(c.name,c.campaign,convCriteria));
                    const lpvR = lpvRateStatus(c.clicks,c.lpv,getConvCriteria(c.name,c.campaign,convCriteria));
                    return (!cpa||cpa.label==="유지") && (!lpvR||lpvR.label==="정상");
                  } else {
                    const cpcOk=(c.cpc||0)>0&&(c.cpc||0)<=getTrafficCpcMax(c.name,c.campaign,trafficCriteria);
                    const ctrOk=(c.ctr||0)>=(trafficCriteria?.ctrMin||1);
                    const lpvOk=(c.lpvRate||0)>=(trafficCriteria?.lpvMin||50);
                    return cpcOk && ctrOk && lpvOk;
                  }
                }).sort((a,b)=>(b.convValue||b.clicks||0)-(a.convValue||a.clicks||0)).slice(0,6);

                if(topAds.length===0) return null;

                return(
                  <div style={{background:`linear-gradient(135deg,${C.blush},${C.white})`,
                    border:`1px solid ${C.rose}33`,borderRadius:14,padding:"16px"}}>
                    <div style={{fontSize:12,fontWeight:800,color:C.rose,marginBottom:12}}>
                      ⭐ 상위 광고 소재 · {campTab==="conversion"?"CPA 유지 + LPV 정상":"CPC·CTR·LPV 기준 통과"}
                    </div>
                    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                      {topAds.map((c,i)=>{
                        const thumb = adImages.find(img=>img.name&&c.name&&(c.name.includes(img.name)||img.name.includes(c.name)));
                        const adMargin = campTab==="conversion"?getAdMargin(c.name,c.campaign,margins,margin):0;
                        return(
                          <div key={i} style={{
                            background:C.white,borderRadius:12,padding:"12px",
                            border:`1px solid ${C.rose}22`,
                            width:160,flexShrink:0,
                          }}>
                            {/* 썸네일 */}
                            <div style={{width:"100%",height:90,borderRadius:8,overflow:"hidden",
                              background:C.cream,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
                              {thumb
                                ? <ThumbPreview url={thumb.url} name={thumb.name}/>
                                : <MI n="image" size={28} style={{opacity:0.2}}/>
                              }
                            </div>
                            {/* 광고명 */}
                            <div style={{fontSize:10,fontWeight:700,color:C.ink,marginBottom:6,
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={c.name}>
                              {c.name}
                            </div>
                            {/* 지표 */}
                            <div style={{display:"flex",flexDirection:"column",gap:3}}>
                              {campTab==="conversion"?<>
                                <div style={{display:"flex",justifyContent:"space-between"}}>
                                  <span style={{fontSize:9,color:C.inkLt}}>광고비</span>
                                  <span style={{fontSize:9,fontWeight:700,color:C.ink}}>{fmtW(c.spend)}</span>
                                </div>
                                <div style={{display:"flex",justifyContent:"space-between"}}>
                                  <span style={{fontSize:9,color:C.inkLt}}>ROAS</span>
                                  <span style={{fontSize:9,fontWeight:700,color:C.good}}>{c.spend>0?`${Math.round((c.convValue||0)/c.spend*100)}%`:"—"}</span>
                                </div>
                                <div style={{display:"flex",justifyContent:"space-between"}}>
                                  <span style={{fontSize:9,color:C.inkLt}}>CPA</span>
                                  <span style={{fontSize:9,fontWeight:700,color:C.ink}}>{c.purchases>0?fmtW(c.spend/c.purchases):"—"}</span>
                                </div>
                              </>:<>
                                <div style={{display:"flex",justifyContent:"space-between"}}>
                                  <span style={{fontSize:9,color:C.inkLt}}>광고비</span>
                                  <span style={{fontSize:9,fontWeight:700,color:C.ink}}>{fmtW(c.spend)}</span>
                                </div>
                                <div style={{display:"flex",justifyContent:"space-between"}}>
                                  <span style={{fontSize:9,color:C.inkLt}}>CPC</span>
                                  <span style={{fontSize:9,fontWeight:700,color:C.good}}>₩{Math.round(c.cpc||0).toLocaleString()}</span>
                                </div>
                                <div style={{display:"flex",justifyContent:"space-between"}}>
                                  <span style={{fontSize:9,color:C.inkLt}}>LPV율</span>
                                  <span style={{fontSize:9,fontWeight:700,color:C.ink}}>{c.lpvRate||0}%</span>
                                </div>
                              </>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {(()=>{
                const camps = campTab==="conversion" ? d.convCamps : d.trafficCamps;
                if(!camps||camps.length===0) return(
                  <div style={{textAlign:"center",padding:"32px",color:C.inkLt,fontSize:12}}>
                    해당 목적의 캠페인 데이터가 없습니다<br/>
                    <span style={{fontSize:10,marginTop:4,display:"block"}}>시트의 "캠페인_목적" 컬럼을 확인해주세요</span>
                  </div>
                );
                return(
                  <>
                    {(()=>{
                      const totalSpend = camps.reduce((s,c)=>s+(c.spend||0),0);
                      const totalPurch = camps.reduce((s,c)=>s+(c.purchases||0),0);
                      const totalConvV = camps.reduce((s,c)=>s+(c.convValue||0),0);
                      const totalClicks= camps.reduce((s,c)=>s+(c.clicks||0),0);
                      const totalLpv   = camps.reduce((s,c)=>s+(c.lpv||0),0);
                      const avgCtr     = camps.length ? camps.reduce((s,c)=>s+(c.ctr||0),0)/camps.length : 0;
                      const summaryItems = campTab==="conversion" ? [
                        {label:"전환 광고비",  value:`₩${Math.round(totalSpend/10000).toLocaleString()}만`,      color:C.rose},
                        {label:"총 구매",      value:`${totalPurch}건`,                                           color:C.good},
                        {label:"총 전환값",    value:`₩${Math.round(totalConvV/10000).toLocaleString()}만`,      color:C.purple},
                        {label:"평균 CPA",     value:totalPurch>0?`₩${Math.round(totalSpend/totalPurch).toLocaleString()}`:"—", color:C.gold},
                        {label:"전체 ROAS",    value:totalSpend>0?`${Math.round((totalConvV/totalSpend)*100)}%`:"—", color:C.sage},
                        {label:"총 광고수",    value:`${camps.length}개`,                                         color:C.inkMid},
                      ] : [
                        {label:"트래픽 광고비",value:`₩${Math.round(totalSpend/10000).toLocaleString()}만`,      color:C.purple},
                        {label:"총 클릭수",    value:totalClicks.toLocaleString(),                                color:C.good},
                        {label:"총 LPV",       value:totalLpv.toLocaleString(),                                   color:C.sage},
                        {label:"평균 CPC",     value:totalClicks>0?`₩${Math.round(totalSpend/totalClicks).toLocaleString()}`:"—", color:C.gold},
                        {label:"평균 CTR",     value:`${avgCtr.toFixed(2)}%`,                                    color:C.rose},
                        {label:"총 광고수",    value:`${camps.length}개`,                                        color:C.inkMid},
                      ];
                      return(
                        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
                          {summaryItems.map((s,i)=>(
                            <div key={i} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
                              <div style={{fontSize:9,color:C.inkLt,fontWeight:700,letterSpacing:"0.1em"}}>{s.label}</div>
                              <div style={{fontSize:18,fontWeight:900,color:s.color,marginTop:4}}>{s.value}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    {/* ── 광고세트 예산 분석 패널 ── */}
                    {(()=>{
                      const fmtW=n=>n>=10000?`₩${Math.round(n/10000).toLocaleString()}만`:`₩${Math.round(n).toLocaleString()}`;
                      // 광고세트별 집계
                      const adsetMap={};
                      // 광고세트별로 최신 날짜 예산 찾기 (예산은 변경될 수 있어서 최신값 기준)
                      const adsetBudgetMap={};
                      metaRaw.forEach(r=>{
                        const key=r.adset||"";
                        if(!key) return;
                        const budget=(r.adsetBudget||0)>0?r.adsetBudget:(r.campaignBudget||0)>0&&typeof r.campaignBudget==="number"?r.campaignBudget:0;
                        if(!budget) return;
                        if(!adsetBudgetMap[key]||r.date>adsetBudgetMap[key].date){
                          adsetBudgetMap[key]={
                            budget,
                            budgetType:r.adsetBudgetType||r.campaignBudgetType||"일일 예산",
                            date:r.date||"",
                          };
                        }
                      });

                      camps.forEach(c=>{
                        const key=c.adset||"(세트없음)";
                        if(!adsetMap[key]) adsetMap[key]={
                          name:key,
                          budget:0, budgetType:"",
                          ads:[], spend:0,
                        };
                        // 최신 날짜 예산 적용
                        if(adsetBudgetMap[key]&&adsetMap[key].budget===0){
                          adsetMap[key].budget=adsetBudgetMap[key].budget;
                          adsetMap[key].budgetType=adsetBudgetMap[key].budgetType;
                        }
                        adsetMap[key].ads.push(c);
                        adsetMap[key].spend+=(c.spend||0);
                      });
                      const adsets=Object.values(adsetMap).filter(s=>s.budget>0).sort((a,b)=>b.budget-a.budget);
                      if(!adsets.length) return null;

                      return(
                        <div style={{marginBottom:14}}>
                          <div style={{fontSize:11,fontWeight:800,color:C.ink,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                            <MI n="payments" size={13}/> 광고세트 예산 현황
                            <span style={{fontSize:9,color:C.inkLt,fontWeight:500}}>최신 날짜 기준 일일 예산 · 끈 광고 제외 권장예산 자동 계산</span>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:8}}>
                            {adsets.map((s,i)=>{
                              const totalAds=s.ads.length;
                              // 끈 광고 = deletedAds에 포함된 것
                              const offAds=s.ads.filter(a=>deletedAds.includes(a.name));
                              const activeAds=totalAds-offAds.length;
                              // 권장 예산 = 현재예산 ÷ 전체 × 활성
                              const recommended=totalAds>0?Math.round((s.budget/totalAds)*activeAds/10000)*10000:s.budget;
                              const needsAdjust=offAds.length>0&&recommended<s.budget;
                              const sosinRate=s.budget>0?Math.round((s.spend/s.budget)*100):0;

                              return(
                                <div key={i} style={{background:needsAdjust?"#FFF8EC":C.white,
                                  border:`1px solid ${needsAdjust?C.warn+"55":C.border}`,
                                  borderRadius:12,padding:"12px 14px"}}>
                                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{fontSize:11,fontWeight:800,color:C.ink,marginBottom:4,
                                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                                        {/* 광고 수 */}
                                        <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:20,
                                          background:C.cream,color:C.inkMid,border:`1px solid ${C.border}`}}>
                                          광고 총 {totalAds}개
                                        </span>
                                        <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:20,
                                          background:"#EDF7F1",color:C.good,border:`1px solid ${C.good}33`}}>
                                          <MI n="circle" size={9} style={{color:C.good}}/> 활성 {activeAds}개
                                        </span>
                                        {offAds.length>0&&(
                                          <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:20,
                                            background:"#FEF0F0",color:C.bad,border:`1px solid ${C.bad}33`}}>
                                            ⏹ 꺼짐 {offAds.length}개
                                          </span>
                                        )}
                                        <span style={{fontSize:9,fontWeight:600,padding:"2px 8px",borderRadius:20,
                                          background:C.purpleLt,color:C.purple,border:`1px solid ${C.purple}33`}}>
                                          {s.budgetType||"일일 예산"}
                                        </span>
                                      </div>
                                    </div>
                                    <div style={{textAlign:"right",flexShrink:0}}>
                                      <div style={{fontSize:9,color:C.inkLt,marginBottom:2}}>
                                        현재 일일 예산
                                        {adsetBudgetMap[s.name]?.date&&<span style={{marginLeft:4,color:C.inkLt}}>({adsetBudgetMap[s.name].date.slice(5).replace("-","/")} 기준)</span>}
                                      </div>
                                      <div style={{fontSize:16,fontWeight:900,color:C.ink}}>{fmtW(s.budget)}</div>
                                      <div style={{fontSize:9,color:C.inkMid,marginTop:1}}>기간 지출 {fmtW(s.spend)} ({sosinRate}%)</div>
                                    </div>
                                  </div>
                                  {/* 예산 조정 권장 */}
                                  {needsAdjust&&(
                                    <div style={{marginTop:10,padding:"10px 12px",background:"#FFF3E0",
                                      borderRadius:8,border:`1px solid ${C.warn}44`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                                      <div>
                                        <div style={{fontSize:10,fontWeight:800,color:C.warn}}>⚠️ 예산 조정 권장</div>
                                        <div style={{fontSize:9,color:C.inkMid,marginTop:2}}>
                                          꺼진 광고 {offAds.length}개 제외 · {activeAds}개 기준으로 재배분
                                        </div>
                                      </div>
                                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                                        <div style={{textAlign:"center"}}>
                                          <div style={{fontSize:9,color:C.inkLt}}>현재</div>
                                          <div style={{fontSize:13,fontWeight:800,color:C.warn,textDecoration:"line-through"}}>{fmtW(s.budget)}</div>
                                        </div>
                                        <span style={{fontSize:12,color:C.inkMid}}>→</span>
                                        <div style={{textAlign:"center"}}>
                                          <div style={{fontSize:9,color:C.inkLt}}>권장</div>
                                          <div style={{fontSize:15,fontWeight:900,color:C.good}}>{fmtW(recommended)}</div>
                                        </div>
                                        <div style={{fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:20,
                                          background:"#EDF7F1",color:C.good,border:`1px solid ${C.good}33`}}>
                                          -{fmtW(s.budget-recommended)} 절감
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {/* 소진율 바 */}
                                  <div style={{marginTop:8,height:4,background:C.border,borderRadius:2,overflow:"hidden"}}>
                                    <div style={{height:"100%",width:`${Math.min(sosinRate,100)}%`,
                                      background:sosinRate>=80?C.good:sosinRate>=40?C.warn:C.rose,
                                      borderRadius:2,transition:"width 0.5s"}}/>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                    {/* ── 예산 분류 패널 ── */}
                    {(()=>{
                      const isConv = campTab==="conversion";
                      const classify=(c)=>{
                        const adMargin=getAdMargin(c.name,c.campaign,margins,margin);
                        const lpvC=lpvCostStatus(c.spend,c.lpv,getConvCriteria(c.name,c.campaign,convCriteria));
                        const lpvR=lpvRateStatus(c.clicks,c.lpv,getConvCriteria(c.name,c.campaign,convCriteria));
                        const cpa =cpaStatus(c.spend,c.purchases,adMargin,getConvCriteria(c.name,c.campaign,convCriteria));
                        const ct  =ctrStatus(c.clicks,c.impressions||0,getConvCriteria(c.name,c.campaign,convCriteria));
                        if(isConv){
                          const isCut=(lpvC&&lpvC.label==="컷")||(cpa&&cpa.label==="컷")||(lpvR&&lpvR.label==="랜딩문제")||(ct&&ct.label==="소재문제");
                          const isHold=(lpvC&&lpvC.label==="보류")||(cpa&&cpa.label==="보류")||(ct&&ct.label==="보통");
                          const isUp=!isCut&&!isHold&&(lpvC&&lpvC.label==="유지")&&(cpa&&cpa.label==="유지")&&(c.purchases||0)>=5;
                          return isCut?"cut":isHold?"hold":isUp?"up":"watch";
                        } else {
                          // 트래픽: CPC·CTR 기준
                          const cpcOk=(c.cpc||0)>0&&(c.cpc||0)<=getTrafficCpcMax(c.name,c.campaign,trafficCriteria);
                          const ctrOk=(c.ctr||0)>=(trafficCriteria?.ctrMin||1);
                          const lpvOk=(c.lpvRate||0)>=(trafficCriteria?.lpvMin||50);
                          if(!cpcOk||(ct&&ct.label==="소재문제")) return "cut";
                          if(!ctrOk||!lpvOk) return "hold";
                          if(cpcOk&&ctrOk&&lpvOk) return "up";
                          return "watch";
                        }
                      };
                      const upList  =camps.filter(c=>classify(c)==="up");
                      const holdList=camps.filter(c=>classify(c)==="hold");
                      const cutList =camps.filter(c=>classify(c)==="cut");
                      if(!upList.length&&!holdList.length&&!cutList.length) return null;
                      const typeTag=isConv
                        ?<span style={{fontSize:9,fontWeight:700,padding:"1px 7px",borderRadius:20,background:C.blush,color:C.rose,border:`1px solid ${C.rose}33`,marginLeft:4}}>전환</span>
                        :<span style={{fontSize:9,fontWeight:700,padding:"1px 7px",borderRadius:20,background:C.purpleLt,color:C.purple,border:`1px solid ${C.purple}33`,marginLeft:4}}>트래픽</span>;
                      const metric=isConv
                        ?(c)=>`CPA ₩${(c.cpa||0).toLocaleString()}`
                        :(c)=>`CPC ₩${(c.cpc||0).toLocaleString()}`;
                      return(
                        <div style={{marginBottom:14}}>
                          <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:6,display:"flex",alignItems:"center",gap:4}}>
                            예산 운영 판단{typeTag}
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                            <div style={{background:"#EDF7F1",border:`1px solid ${C.good}44`,borderRadius:14,padding:"12px 14px"}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                                <span style={{fontSize:15}}>🚀</span>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:11,fontWeight:800,color:C.good}}>예산 올리기</div>
                                  <div style={{fontSize:9,color:C.inkMid}}>{isConv?"CPA✅·구매5건↑":"CPC✅·CTR✅·LPV✅"}</div>
                                </div>
                                <span style={{fontSize:13,fontWeight:900,color:C.good}}>{upList.length}</span>
                              </div>
                              {upList.length===0?<div style={{fontSize:10,color:C.inkLt,textAlign:"center",padding:"6px 0"}}>없음</div>:
                              upList.map((c,i)=>(
                                <div key={i} style={{fontSize:10,padding:"3px 7px",background:C.white,borderRadius:7,marginBottom:3,display:"flex",justifyContent:"space-between",gap:4}}>
                                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:600,color:C.ink,flex:1}}>{c.name}</span>
                                  <span style={{color:C.good,fontWeight:800,flexShrink:0,fontSize:9}}>{metric(c)}</span>
                                </div>
                              ))}
                            </div>
                            <div style={{background:"#FFF8EC",border:`1px solid ${C.warn}44`,borderRadius:14,padding:"12px 14px"}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                                <span style={{fontSize:15}}>⚠️</span>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:11,fontWeight:800,color:C.warn}}>예산 줄이기</div>
                                  <div style={{fontSize:9,color:C.inkMid}}>{isConv?"CPA·LPV 보류":"CPC↑·CTR↓"}</div>
                                </div>
                                <span style={{fontSize:13,fontWeight:900,color:C.warn}}>{holdList.length}</span>
                              </div>
                              {holdList.length===0?<div style={{fontSize:10,color:C.inkLt,textAlign:"center",padding:"6px 0"}}>없음</div>:
                              holdList.map((c,i)=>(
                                <div key={i} style={{fontSize:10,padding:"3px 7px",background:C.white,borderRadius:7,marginBottom:3,display:"flex",justifyContent:"space-between",gap:4}}>
                                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:600,color:C.ink,flex:1}}>{c.name}</span>
                                  <span style={{color:C.warn,fontWeight:800,flexShrink:0,fontSize:9}}>{metric(c)}</span>
                                </div>
                              ))}
                            </div>
                            <div style={{background:"#FEF0F0",border:`1px solid ${C.bad}44`,borderRadius:14,padding:"12px 14px"}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                                <span style={{fontSize:15}}>🔴</span>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:11,fontWeight:800,color:C.bad}}>끄기</div>
                                  <div style={{fontSize:9,color:C.inkMid}}>{isConv?"CPA컷·랜딩문제":"소재문제·CPC과다"}</div>
                                </div>
                                <span style={{fontSize:13,fontWeight:900,color:C.bad}}>{cutList.length}</span>
                              </div>
                              {cutList.length===0?<div style={{fontSize:10,color:C.inkLt,textAlign:"center",padding:"6px 0"}}>없음</div>:
                              cutList.map((c,i)=>(
                                <div key={i} style={{fontSize:10,padding:"3px 7px",background:C.white,borderRadius:7,marginBottom:3,display:"flex",justifyContent:"space-between",gap:4}}>
                                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:600,color:C.ink,flex:1}}>{c.name}</span>
                                  <span style={{color:C.bad,fontWeight:800,flexShrink:0,fontSize:9}}>{metric(c)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    <Card>
                      <CardTitle title={campTab==="conversion"?"전환 캠페인":"트래픽 캠페인"}
                        sub={campTab==="conversion"?"CPA · LPV율 중심":"CPC · CTR 중심"}/>
                      <div style={{overflowX:"auto"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:600}}>
                          <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
                            {(campTab==="conversion"
                              ?["광고명","광고세트","광고비","클릭","구매","전환값","CPA","ROAS","LPV율","삭제"]
                              :["광고명","광고세트","광고비","클릭","LPV","CPC","CTR","LPV율","삭제"]
                            ).map((h,hi)=>(
                              <th key={hi} style={{padding:"8px 8px",textAlign:h==="광고명"?"left":"center",
                                color:C.inkLt,fontWeight:700,fontSize:9,whiteSpace:"nowrap"}}>{h==="삭제"?"":h}</th>
                            ))}
                          </tr></thead>
                          <tbody>{camps.map((c,i)=>{
                            const adMargin=getAdMargin(c.name,c.campaign,margins,margin);
                            const lpvC=lpvCostStatus(c.spend,c.lpv,getConvCriteria(c.name,c.campaign,convCriteria));
                            const lpvR=lpvRateStatus(c.clicks,c.lpv,getConvCriteria(c.name,c.campaign,convCriteria));
                            const cpa =cpaStatus(c.spend,c.purchases,adMargin,getConvCriteria(c.name,c.campaign,convCriteria));
                            const ct  =ctrStatus(c.clicks,c.impressions||0,getConvCriteria(c.name,c.campaign,convCriteria));

                            // ── 켜야/꺼야 판정 ──
                            let verdict, verdictColor, verdictBg;
                            if(campTab==="conversion"){
                              const isCut=(lpvC&&lpvC.label==="컷")||(cpa&&cpa.label==="컷")||(lpvR&&lpvR.label==="랜딩문제")||(ct&&ct.label==="소재문제");
                              const isHold=(lpvC&&lpvC.label==="보류")||(cpa&&cpa.label==="보류");
                              const isUp=!isCut&&!isHold&&(lpvC?.label==="유지")&&(cpa?.label==="유지")&&(c.purchases||0)>=5;
                              if(isCut){verdict="🔴끄기";verdictColor=C.bad;verdictBg="#FEF0F0";}
                              else if(isHold){verdict="⚠️줄이기";verdictColor=C.warn;verdictBg="#FFF8EC";}
                              else if(isUp){verdict="🚀올리기";verdictColor=C.good;verdictBg:"#EDF7F1";}
                              else{verdict="👀유지";verdictColor=C.inkMid;verdictBg:C.cream;}
                            } else {
                              const cpcOk=(c.cpc||0)>0&&(c.cpc||0)<=getTrafficCpcMax(c.name,c.campaign,trafficCriteria);
                              const ctrOk=(c.ctr||0)>=(trafficCriteria?.ctrMin||1);
                              const lpvOk=(c.lpvRate||0)>=(trafficCriteria?.lpvMin||50);
                              if(!cpcOk||(ct?.label==="소재문제")){verdict="🔴끄기";verdictColor=C.bad;verdictBg="#FEF0F0";}
                              else if(!ctrOk||!lpvOk){verdict="⚠️줄이기";verdictColor=C.warn;verdictBg="#FFF8EC";}
                              else{verdict="🚀올리기";verdictColor=C.good;verdictBg="#EDF7F1";}
                            }

                            // ── 게시 기간 (시트 날짜 기반) ──
                            const today = new Date(); today.setHours(0,0,0,0);
                            const parseD = s=>{ if(!s)return null; const d=new Date(s); return isNaN(d)?null:d; };
                            // 시트 전체 최신 날짜 (기준점)
                            const sheetMax = parseD(sheetMaxDate);
                            const fd  = parseD(c.firstDate);
                            const lad = parseD(c.lastActiveDate); // 지출 있는 마지막 날
                            const adAge = fd ? Math.floor((today-fd)/86400000) : null;
                            // 시트 최신 날짜 기준으로 지출 있는 마지막 날 비교
                            const lastAgo = lad&&sheetMax ? Math.floor((sheetMax-lad)/86400000) : null;
                            const isActive = lastAgo!==null && lastAgo<=3; // 지출 기준 3일 이내면 집행중 (Meta 데이터 딜레이 고려)

                            // ── 복제 적합 판정 (CTR좋고 LPV좋은데 CPA보류/컷) ──
                            const cloneable = campTab==="conversion" && (ct?.label==="좋음"||ct?.label==="보통") && (lpvR?.label==="정상") && (cpa&&(cpa.label==="보류"||cpa.label==="컷"));

                            // ── LPV 하락 원인 진단 ──
                            const lpvIssue = (()=>{
                              if(!c.lpv||!c.clicks) return null;
                              const rate=(c.lpv/c.clicks)*100;
                              if(rate>=65) return null;
                              if((c.ctr||0)<1) return "소재 피로";
                              if((c.cpc||0)>200) return "CPC 과다";
                              if(rate<30) return "랜딩 불일치";
                              return "LPV 전환 저하";
                            })();

                            // ── 광고비 원 표시 ──
                            const spendKr = c.spend>=10000
                              ? `₩${Math.round(c.spend/10000).toLocaleString()}만`
                              : `₩${Math.round(c.spend).toLocaleString()}`;

                            // ── ROAS % 변환 ──
                            const roasPct = c.roas>0?`${Math.round(c.roas*100)}%`:null;
                            const roasOk  = (c.roas||0)>=3;

                            const cpaOk=(c.cpa||0)>0&&(c.cpa||0)<=16000;
                            const cpcOk=(c.cpc||0)<=getTrafficCpcMax(c.name,c.campaign,trafficCriteria)&&(c.cpc||0)>0;
                            const ctrOk=(c.ctr||0)>=(trafficCriteria?.ctrMin||1);
                            const lpvOk=(c.lpvRate||0)>=(trafficCriteria?.lpvMin||50);

                            return(<tr key={i} style={{borderBottom:`1px solid ${C.border}`,transition:"background 0.15s"}}
                              onMouseEnter={e=>e.currentTarget.style.background=C.cream}
                              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                              {/* 광고명 + 뱃지들 */}
                              <td style={{padding:"10px 8px",maxWidth:220}}>
                                <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:3}}>
                                  {(()=>{const thumb=adImages.find(img=>img.name&&c.name&&(c.name.includes(img.name)||img.name.includes(c.name)));return thumb?<ThumbPreview url={thumb.url} name={thumb.name}/>:null;})()}
                                  <span style={{fontWeight:700,color:C.ink,fontSize:11,wordBreak:"break-all"}}>{c.name}</span>
                                </div>
                                <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                                  {/* 판정 뱃지 */}
                                  <span style={{fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:20,color:verdictColor,background:verdictBg,border:`1px solid ${verdictColor}33`}}>{verdict}</span>
                                  {/* 게시 기간 뱃지 */}
                                  {adAge!==null&&(
                                    <span style={{fontSize:9,fontWeight:600,padding:"2px 7px",borderRadius:20,
                                      color:isActive?C.good:C.inkLt,
                                      background:isActive?"#EDF7F1":C.cream,
                                      border:`1px solid ${isActive?C.good+"44":C.border}`}}>
                                      {isActive?<><MI n="circle" size={9} style={{color:C.good}}/> D+{adAge}집행중</>:`⏹ D+${adAge}${lastAgo!==null?` (${lastAgo}일전종료)`:""}`}
                                    </span>
                                  )}
                                  {/* 복제 추천 */}
                                  {cloneable&&<span style={{fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:20,color:C.purple,background:C.purpleLt,border:`1px solid ${C.purple}33`,display:"inline-flex",alignItems:"center",gap:2}}><MI n="assignment" size={9}/>복제추천</span>}
                                  {/* LPV 원인 */}
                                  {lpvIssue&&<span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:20,color:C.warn,background:"#FFF8EC",border:`1px solid ${C.warn}33`}}>⚡{lpvIssue}</span>}
                                </div>
                              </td>
                              {/* 광고세트 */}
                              <td style={{padding:"10px 8px",maxWidth:140}}>
                                <div style={{fontSize:10,color:C.inkMid,wordBreak:"break-all"}}>{c.adset||"—"}</div>
                              </td>
                              {/* 광고비 (원) */}
                              <td style={{padding:"10px 8px",textAlign:"right",color:C.inkMid,fontSize:10,whiteSpace:"nowrap"}}>{spendKr}</td>
                              {/* 클릭 */}
                              <td style={{padding:"10px 8px",textAlign:"right",color:C.inkMid}}>{c.clicks.toLocaleString()}</td>
                              {campTab==="conversion" ? <>
                                <td style={{padding:"10px 8px",textAlign:"right",fontWeight:800,color:C.good}}>{c.purchases}</td>
                                <td style={{padding:"10px 8px",textAlign:"right",fontSize:10,color:C.inkMid,whiteSpace:"nowrap"}}>
                                  {c.convValue>0?`₩${Math.round(c.convValue/10000).toLocaleString()}만`:"—"}
                                </td>
                                <td style={{padding:"10px 8px",textAlign:"right"}}>
                                  {c.cpa>0?<span style={{fontWeight:800,fontSize:11,color:cpaOk?C.good:C.bad,background:cpaOk?"#EDF7F1":"#FEF0F0",padding:"2px 7px",borderRadius:20,whiteSpace:"nowrap"}}>₩{c.cpa.toLocaleString()}</span>:<span style={{color:C.inkLt}}>—</span>}
                                </td>
                                <td style={{padding:"10px 8px",textAlign:"right"}}>
                                  {roasPct?<span style={{fontWeight:800,fontSize:11,color:roasOk?C.good:C.warn,background:roasOk?"#EDF7F1":"#FFF8EC",padding:"2px 7px",borderRadius:20}}>{roasPct}</span>:<span style={{color:C.inkLt}}>—</span>}
                                </td>
                              </> : <>
                                <td style={{padding:"10px 8px",textAlign:"right",color:C.sage,fontWeight:700}}>{c.lpv.toLocaleString()}</td>
                                <td style={{padding:"10px 8px",textAlign:"right"}}>
                                  <span style={{fontWeight:800,fontSize:11,color:cpcOk?C.good:C.bad,background:cpcOk?"#EDF7F1":"#FEF0F0",padding:"2px 7px",borderRadius:20}}>₩{c.cpc}</span>
                                </td>
                                <td style={{padding:"10px 8px",textAlign:"right"}}>
                                  <span style={{fontWeight:800,fontSize:11,color:ctrOk?C.good:C.warn,background:ctrOk?"#EDF7F1":"#FFF8EC",padding:"2px 7px",borderRadius:20}}>{c.ctr}%</span>
                                </td>
                              </>}
                              {/* LPV율 */}
                              <td style={{padding:"10px 8px",textAlign:"right"}}>
                                <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:5}}>
                                  <div style={{width:32,height:4,background:C.border,borderRadius:2,overflow:"hidden"}}>
                                    <div style={{height:"100%",width:`${Math.min(c.lpvRate,100)}%`,background:lpvOk?C.sage:C.warn,borderRadius:2}}/>
                                  </div>
                                  <span style={{fontWeight:700,color:lpvOk?C.sage:C.warn,fontSize:10}}>{c.lpvRate}%</span>
                                </div>
                              </td>
                              {/* 삭제 */}
                              <td style={{padding:"10px 8px",textAlign:"center"}}>
                                <button onClick={()=>{const next=[...deletedAds,c.name];setDeletedAds(next);}}
                                  style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,
                                    width:24,height:24,cursor:"pointer",fontSize:12,color:C.inkLt,
                                    display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}
                                  title="광고 숨기기"
                                  onMouseEnter={e=>{e.currentTarget.style.background="#FEF0F0";e.currentTarget.style.borderColor=C.bad;e.currentTarget.style.color=C.bad;}}
                                  onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.inkLt;}}>
                                  ✕
                                </button>
                              </td>
                            </tr>);
                          })}</tbody>
                        </table>
                      </div>
                    </Card>
                  </>
                );
              })()}
            </>)}
          </div>
        )}

        {/* 주별 탭 */}
        {metaTab==="weekly"&&(()=>{
          if(!hasSheet) return(
            <div style={{textAlign:"center",padding:"40px 0",color:C.inkLt}}>
              <MI n="calendar_month" size={36}/><div style={{fontSize:13,fontWeight:700,color:C.inkMid,marginTop:10}}>데이터 없음</div>
            </div>
          );
          const fmtW=n=>n>=10000?`₩${Math.round(n/10000).toLocaleString()}만`:`₩${Math.round(n).toLocaleString()}`;
          const weekMap={};
          metaForChart.forEach(r=>{
            if(!r.date||!r.campaign) return;
            const dd=new Date(r.date); const day=dd.getDay();
            const mon=new Date(dd); mon.setDate(dd.getDate()-(day===0?6:day-1));
            const wk=`${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,"0")}-${String(mon.getDate()).padStart(2,"0")}`;
            if(!weekMap[wk]) weekMap[wk]={week:wk,spend:0,purchases:0,convValue:0,camps:{}};
            weekMap[wk].spend+=(r.spend||0);
            weekMap[wk].purchases+=(r.purchases||0);
            weekMap[wk].convValue+=(r.convValue||0);
            if(!weekMap[wk].camps[r.campaign]) weekMap[wk].camps[r.campaign]={spend:0,purchases:0,convValue:0,clicks:0,objective:r.objective||""};
            weekMap[wk].camps[r.campaign].spend+=(r.spend||0);
            weekMap[wk].camps[r.campaign].purchases+=(r.purchases||0);
            weekMap[wk].camps[r.campaign].convValue+=(r.convValue||0);
            weekMap[wk].camps[r.campaign].clicks+=(r.clicks||0);
          });
          const weeks=Object.values(weekMap).sort((a,b)=>b.week.localeCompare(a.week));
          return(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {weeks.map((w,i)=>{
                const isOpen=weekOpenKey===w.week;
                const roas=w.spend>0?Math.round((w.convValue/w.spend)*100):0;
                const campList=Object.entries(w.camps).filter(([,v])=>v.spend>0).sort((a,b)=>b[1].spend-a[1].spend);
                const endDate=new Date(w.week); endDate.setDate(endDate.getDate()+6);
                const endStr=`${String(endDate.getMonth()+1).padStart(2,"0")}/${String(endDate.getDate()).padStart(2,"0")}`;
                const startStr=w.week.slice(5).replace("-","/");
                return(
                  <div key={w.week} style={{borderRadius:12,border:`1px solid ${i===0?C.rose+"66":C.border}`,overflow:"hidden",background:C.white}}>
                    <div onClick={()=>setWeekOpenKey(isOpen?null:w.week)}
                      style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",cursor:"pointer",
                        background:i===0?"linear-gradient(135deg,#EFF6FF,#fff)":"transparent"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{fontSize:14,fontWeight:800,color:i===0?C.rose:C.ink}}>
                          {startStr} ~ {endStr}
                          {i===0&&<span style={{fontSize:10,marginLeft:6,color:C.rose,fontWeight:700,background:C.blush,padding:"2px 6px",borderRadius:4}}>최신</span>}
                        </div>
                        <div style={{fontSize:10,color:C.inkLt,display:"flex",gap:8}}>
                          {w.purchases>0&&<span style={{color:C.sage,fontWeight:700}}>{w.purchases}건</span>}
                          {roas>0&&<span>ROAS {roas}%</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{fontSize:15,fontWeight:900,color:C.ink}}>{fmtW(w.spend)}</div>
                        <MI n={isOpen?"expand_less":"expand_more"} size={18} style={{color:C.inkLt}}/>
                      </div>
                    </div>
                    {isOpen&&(
                      <div style={{borderTop:`1px solid ${C.border}`,padding:"8px 12px",display:"flex",flexDirection:"column",gap:4}}>
                        {campList.map(([camp,v])=>{
                          const isConv=isConversionCampaign(v.objective,camp);
                          const cr=v.convValue>0&&v.spend>0?Math.round((v.convValue/v.spend)*100):null;
                          return(
                            <div key={camp} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                              padding:"8px 10px",borderRadius:8,background:isConv?"#fff5f7":C.cream}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:11,fontWeight:700,color:isConv?C.rose:C.inkMid,
                                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{camp}</div>
                                <div style={{fontSize:10,color:C.inkLt,display:"flex",gap:8,marginTop:2}}>
                                  {v.purchases>0&&<span style={{color:C.sage,fontWeight:700}}>{v.purchases}건</span>}
                                  {cr&&<span>ROAS {cr}%</span>}
                                  {v.clicks>0&&<span>{v.clicks.toLocaleString()} 클릭</span>}
                                </div>
                              </div>
                              <div style={{fontSize:14,fontWeight:800,color:C.ink,marginLeft:12}}>{fmtW(v.spend)}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* 월별 탭 */}
        {metaTab==="monthly"&&(()=>{
          if(!hasSheet) return(
            <div style={{textAlign:"center",padding:"40px 0",color:C.inkLt}}>
              <MI n="date_range" size={36}/><div style={{fontSize:13,fontWeight:700,color:C.inkMid,marginTop:10}}>데이터 없음</div>
            </div>
          );
          const fmtW=n=>n>=10000?`₩${Math.round(n/10000).toLocaleString()}만`:`₩${Math.round(n).toLocaleString()}`;
          const monthMap={};
          metaForChart.forEach(r=>{
            if(!r.date||!r.campaign) return;
            const m=r.date.slice(0,7);
            if(!monthMap[m]) monthMap[m]={month:m,spend:0,purchases:0,convValue:0,camps:{}};
            monthMap[m].spend+=(r.spend||0);
            monthMap[m].purchases+=(r.purchases||0);
            monthMap[m].convValue+=(r.convValue||0);
            if(!monthMap[m].camps[r.campaign]) monthMap[m].camps[r.campaign]={spend:0,purchases:0,convValue:0,clicks:0,objective:r.objective||""};
            monthMap[m].camps[r.campaign].spend+=(r.spend||0);
            monthMap[m].camps[r.campaign].purchases+=(r.purchases||0);
            monthMap[m].camps[r.campaign].convValue+=(r.convValue||0);
            monthMap[m].camps[r.campaign].clicks+=(r.clicks||0);
          });
          const months=Object.values(monthMap).sort((a,b)=>b.month.localeCompare(a.month));
          return(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {months.map((m,i)=>{
                const isOpen=monthOpenKey===m.month;
                const roas=m.spend>0?Math.round((m.convValue/m.spend)*100):0;
                const campList=Object.entries(m.camps).filter(([,v])=>v.spend>0).sort((a,b)=>b[1].spend-a[1].spend);
                const [yr,mo]=m.month.split("-");
                return(
                  <div key={m.month} style={{borderRadius:12,border:`1px solid ${i===0?C.rose+"66":C.border}`,overflow:"hidden",background:C.white}}>
                    <div onClick={()=>setMonthOpenKey(isOpen?null:m.month)}
                      style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",cursor:"pointer",
                        background:i===0?"linear-gradient(135deg,#EFF6FF,#fff)":"transparent"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{fontSize:14,fontWeight:800,color:i===0?C.rose:C.ink}}>
                          {yr}년 {mo}월
                          {i===0&&<span style={{fontSize:10,marginLeft:6,color:C.rose,fontWeight:700,background:C.blush,padding:"2px 6px",borderRadius:4}}>최신</span>}
                        </div>
                        <div style={{fontSize:10,color:C.inkLt,display:"flex",gap:8}}>
                          {m.purchases>0&&<span style={{color:C.sage,fontWeight:700}}>{m.purchases}건</span>}
                          {roas>0&&<span>ROAS {roas}%</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{fontSize:15,fontWeight:900,color:C.ink}}>{fmtW(m.spend)}</div>
                        <MI n={isOpen?"expand_less":"expand_more"} size={18} style={{color:C.inkLt}}/>
                      </div>
                    </div>
                    {isOpen&&(
                      <div style={{borderTop:`1px solid ${C.border}`,padding:"8px 12px",display:"flex",flexDirection:"column",gap:4}}>
                        {campList.map(([camp,v])=>{
                          const isConv=isConversionCampaign(v.objective,camp);
                          const cr=v.convValue>0&&v.spend>0?Math.round((v.convValue/v.spend)*100):null;
                          return(
                            <div key={camp} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                              padding:"8px 10px",borderRadius:8,background:isConv?"#fff5f7":C.cream}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:11,fontWeight:700,color:isConv?C.rose:C.inkMid,
                                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{camp}</div>
                                <div style={{fontSize:10,color:C.inkLt,display:"flex",gap:8,marginTop:2}}>
                                  {v.purchases>0&&<span style={{color:C.sage,fontWeight:700}}>{v.purchases}건</span>}
                                  {cr&&<span>ROAS {cr}%</span>}
                                  {v.clicks>0&&<span>{v.clicks.toLocaleString()} 클릭</span>}
                                </div>
                              </div>
                              <div style={{fontSize:14,fontWeight:800,color:C.ink,marginLeft:12}}>{fmtW(v.spend)}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* 일별 탭 — 날짜 카드 클릭 → 캠페인 펼치기 */}
        {metaTab==="daily"&&(()=>{
          if(!hasSheet||!d) return(
            <div style={{textAlign:"center",padding:"40px 0",color:C.inkLt}}>
              <MI n="calendar_today" size={36}/><div style={{fontSize:13,fontWeight:700,color:C.inkMid,marginTop:10}}>데이터 없음</div>
            </div>
          );
          const fmtW = n=>n>=10000?`₩${Math.round(n/10000).toLocaleString()}만`:`₩${Math.round(n).toLocaleString()}`;
          const byDateCamp = {};
          metaForChart.forEach(r=>{
            if(!r.date||!r.campaign) return;
            if(!byDateCamp[r.date]) byDateCamp[r.date]={};
            if(!byDateCamp[r.date][r.campaign]) byDateCamp[r.date][r.campaign]={spend:0,purchases:0,convValue:0,clicks:0,objective:r.objective||""};
            byDateCamp[r.date][r.campaign].spend     += r.spend||0;
            byDateCamp[r.date][r.campaign].purchases += r.purchases||0;
            byDateCamp[r.date][r.campaign].convValue += r.convValue||0;
            byDateCamp[r.date][r.campaign].clicks    += r.clicks||0;
          });
          const dates = Object.keys(byDateCamp).sort().reverse();
          return(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {dates.map((date,i)=>{
                const camps = byDateCamp[date];
                const total = Object.values(camps).reduce((s,v)=>s+(v.spend||0),0);
                const isLatest = i===0;
                const isOpen = dailyOpenDate===date;
                const campList = Object.entries(camps).filter(([,v])=>v.spend>0).sort((a,b)=>b[1].spend-a[1].spend);
                const convTotal = campList.filter(([c,v])=>isConversionCampaign(v.objective,c)).reduce((s,[,v])=>s+v.spend,0);
                const traffTotal = campList.filter(([c,v])=>!isConversionCampaign(v.objective,c)).reduce((s,[,v])=>s+v.spend,0);
                return(
                  <div key={date} style={{borderRadius:12,border:`1px solid ${isLatest?C.rose+"66":C.border}`,overflow:"hidden",background:C.white}}>
                    {/* 날짜 헤더 — 클릭으로 펼치기 */}
                    <div onClick={()=>setDailyOpenDate(isOpen?null:date)}
                      style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",cursor:"pointer",
                        background:isLatest?"linear-gradient(135deg,#EFF6FF,#fff)":"transparent"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{fontSize:14,fontWeight:800,color:isLatest?C.rose:C.ink}}>
                          {date.slice(5).replace("-","/")}
                          {isLatest&&<span style={{fontSize:10,marginLeft:6,color:C.rose,fontWeight:700,background:C.blush,padding:"2px 6px",borderRadius:4}}>최신</span>}
                        </div>
                        <div style={{fontSize:10,color:C.inkLt,display:"flex",gap:8}}>
                          {convTotal>0&&<span style={{color:"#f9a8d4",fontWeight:700}}>전환 {fmtW(convTotal)}</span>}
                          {traffTotal>0&&<span style={{color:C.roseLt,fontWeight:700}}>트래픽 {fmtW(traffTotal)}</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{fontSize:15,fontWeight:900,color:C.ink}}>{fmtW(total)}</div>
                        <MI n={isOpen?"expand_less":"expand_more"} size={18} style={{color:C.inkLt}}/>
                      </div>
                    </div>
                    {/* 캠페인 목록 — 펼쳐진 상태 */}
                    {isOpen&&(
                      <div style={{borderTop:`1px solid ${C.border}`,padding:"8px 12px",display:"flex",flexDirection:"column",gap:4}}>
                        {campList.map(([camp,v])=>{
                          const isConv = isConversionCampaign(v.objective,camp);
                          const roas = v.convValue>0&&v.spend>0 ? Math.round((v.convValue/v.spend)*100) : null;
                          return(
                            <div key={camp} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                              padding:"8px 10px",borderRadius:8,background:isConv?"#fff5f7":C.cream}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:11,fontWeight:700,color:isConv?C.rose:C.inkMid,
                                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{camp}</div>
                                <div style={{fontSize:10,color:C.inkLt,display:"flex",gap:8,marginTop:2}}>
                                  {v.purchases>0&&<span style={{color:C.sage,fontWeight:700}}>{v.purchases}건</span>}
                                  {roas&&<span>ROAS {roas}%</span>}
                                  {v.clicks>0&&<span>{v.clicks.toLocaleString()} 클릭</span>}
                                </div>
                              </div>
                              <div style={{fontSize:14,fontWeight:800,color:C.ink,marginLeft:12}}>{fmtW(v.spend)}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* 제품별 탭 */}
        {metaTab==="product"&&(()=>{
          if(!hasSheet) return(
            <div style={{textAlign:"center",padding:"40px 0",color:C.inkLt}}>
              <MI n="inventory_2" size={36}/><div style={{fontSize:13,fontWeight:700,color:C.inkMid,marginTop:10}}>데이터 없음</div>
            </div>
          );
          const fmtW=n=>n>=10000?`₩${Math.round(n/10000).toLocaleString()}만`:`₩${Math.round(n).toLocaleString()}`;
          const PRODUCTS=margins.length>0?margins.map(m=>m.keyword):["프리온","소닉플로우","에어리소닉"];
          const productMap={};
          metaForChart.forEach(r=>{
            const name=(r.adName||r.campaign||"").toLowerCase();
            let matched="기타";
            PRODUCTS.forEach(p=>{if(name.includes(p.toLowerCase())) matched=p;});
            if(!productMap[matched]) productMap[matched]={product:matched,spend:0,purchases:0,convValue:0,camps:{}};
            productMap[matched].spend+=(r.spend||0);
            productMap[matched].purchases+=(r.purchases||0);
            productMap[matched].convValue+=(r.convValue||0);
            const ck=r.campaign||"(기타)";
            if(!productMap[matched].camps[ck]) productMap[matched].camps[ck]={spend:0,purchases:0,convValue:0,clicks:0,objective:r.objective||""};
            productMap[matched].camps[ck].spend+=(r.spend||0);
            productMap[matched].camps[ck].purchases+=(r.purchases||0);
            productMap[matched].camps[ck].convValue+=(r.convValue||0);
            productMap[matched].camps[ck].clicks+=(r.clicks||0);
          });
          const products=Object.values(productMap).sort((a,b)=>b.spend-a.spend);
          return(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {products.map((p,i)=>{
                const isOpen=productOpenKey===p.product;
                const roas=p.spend>0?Math.round((p.convValue/p.spend)*100):0;
                const cpa=p.purchases>0?Math.round(p.spend/p.purchases):0;
                const campList=Object.entries(p.camps).filter(([,v])=>v.spend>0).sort((a,b)=>b[1].spend-a[1].spend);
                return(
                  <div key={p.product} style={{borderRadius:12,border:`1px solid ${i===0?C.rose+"66":C.border}`,overflow:"hidden",background:C.white}}>
                    <div onClick={()=>setProductOpenKey(isOpen?null:p.product)}
                      style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",cursor:"pointer",
                        background:i===0?"linear-gradient(135deg,#EFF6FF,#fff)":"transparent"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{fontSize:14,fontWeight:800,color:C.ink}}>{p.product}</div>
                        <div style={{fontSize:10,color:C.inkLt,display:"flex",gap:8}}>
                          {p.purchases>0&&<span style={{color:C.sage,fontWeight:700}}>{p.purchases}건</span>}
                          {roas>0&&<span>ROAS {roas}%</span>}
                          {cpa>0&&<span style={{color:cpa<=16000?C.good:C.bad}}>CPA {fmtW(cpa)}</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{fontSize:15,fontWeight:900,color:C.ink}}>{fmtW(p.spend)}</div>
                        <MI n={isOpen?"expand_less":"expand_more"} size={18} style={{color:C.inkLt}}/>
                      </div>
                    </div>
                    {isOpen&&(
                      <div style={{borderTop:`1px solid ${C.border}`,padding:"8px 12px",display:"flex",flexDirection:"column",gap:4}}>
                        {campList.map(([camp,v])=>{
                          const isConv=isConversionCampaign(v.objective,camp);
                          const cr=v.convValue>0&&v.spend>0?Math.round((v.convValue/v.spend)*100):null;
                          return(
                            <div key={camp} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                              padding:"8px 10px",borderRadius:8,background:isConv?"#fff5f7":C.cream}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:11,fontWeight:700,color:isConv?C.rose:C.inkMid,
                                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{camp}</div>
                                <div style={{fontSize:10,color:C.inkLt,display:"flex",gap:8,marginTop:2}}>
                                  {v.purchases>0&&<span style={{color:C.sage,fontWeight:700}}>{v.purchases}건</span>}
                                  {cr&&<span>ROAS {cr}%</span>}
                                  {v.clicks>0&&<span>{v.clicks.toLocaleString()} 클릭</span>}
                                </div>
                              </div>
                              <div style={{fontSize:14,fontWeight:800,color:C.ink,marginLeft:12}}>{fmtW(v.spend)}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ── 전환 시트 연결 모달 ── */}
        {sheetModal&&(
          <Modal title={<><MI n="table_chart"/> 전환캠페인 시트 연결</>} onClose={()=>setSheetModal(false)} wide>
            <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:11,color:"#1D4ED8",fontWeight:700}}>
              📊 전환캠페인(구매·전환값·CPA·ROAS)은 시트에서, 트래픽캠페인은 Meta API에서 자동 병합돼요.
            </div>
            <div style={{background:C.cream,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px",marginBottom:16,fontSize:11,color:C.inkMid,lineHeight:1.8}}>
              <b style={{color:C.ink}}>연결 방법</b><br/>
              1. 메타 광고관리자 → 보고서 → CSV 내보내기<br/>
              2. 구글 시트에 붙여넣기<br/>
              3. 시트 공유 → "링크 있는 모든 사용자" → 뷰어 → URL 복사
            </div>
            <FR label="구글 시트 URL">
              <Inp value={sheetInput} onChange={setSheetInput} placeholder="https://docs.google.com/spreadsheets/d/..."/>
            </FR>
            <Btn onClick={saveSheetUrl} disabled={!sheetInput.trim()} style={{width:"100%"}}>
              <MI n="link" size={13}/> 연결하기
            </Btn>
            {sheetUrl&&(
              <Btn variant="danger" onClick={()=>{setSheetConvRaw([]);setSheetUrl("");setMetaStatus("idle");setSheetModal(false);}} style={{width:"100%",marginTop:8}}>
                <MI n="delete" size={13}/> 연결 해제
              </Btn>
            )}
          </Modal>
        )}

        {/* ── 기준 설정 모달 (전환 마진 + 트래픽 기준) ── */}
        {marginModal&&(
          <Modal title="⚙️ 광고 기준 설정" onClose={()=>setMarginModal(false)} wide>

            {/* ── 전환 캠페인 판단 기준 (제품별) ── */}
            <div style={{borderTop:`2px solid ${C.border}`,paddingTop:16,marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:800,color:C.ink,marginBottom:6}}>🎯 전환 캠페인 — 제품별 판단 기준</div>
              <div style={{background:C.goldLt,borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:10,color:C.gold,fontWeight:700}}>
                광고명에 키워드가 포함되면 제품별 기준이 자동 적용돼요. 키워드 미매칭 시 기본값 적용.
              </div>

              {/* 제품별 탭 */}
              {(()=>{
                const products = convCriteria?.products||[];
                const allTabs = [{id:'default', label:'기본값', keyword:''},...products.map(p=>({id:String(p.id),label:p.label||p.keyword,keyword:p.keyword,pid:p.id}))];
                const selTab = convCriteriaTab;
                const setSelTab = setConvCriteriaTab;
                const cur = selTab==='default' ? convCriteria : products.find(p=>String(p.id)===selTab)||convCriteria;
                const update = (key, val) => {
                  if(selTab==='default'){
                    setConvCriteria({...convCriteria, [key]:val});
                  } else {
                    setConvCriteria({...convCriteria, products: products.map(p=>String(p.id)===selTab?{...p,[key]:val}:p)});
                  }
                };
                return(<>
                  {/* 탭 */}
                  <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
                    {allTabs.map(t=>(
                      <button key={t.id} onClick={()=>setSelTab(t.id)}
                        style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${selTab===t.id?C.rose:C.border}`,
                          background:selTab===t.id?C.blush:C.white,color:selTab===t.id?C.rose:C.inkMid,
                          fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        {t.id==='default'?'🔧 기본값':<><MI n="inventory_2" size={11}/> {t.label}</>}
                      </button>
                    ))}
                    {/* 제품 추가 */}
                    <button onClick={()=>{
                      const kw = prompt("제품 키워드 (예: 소닉플로우)");
                      if(!kw) return;
                      const lb = prompt("제품명 (예: 드라이기)") || kw;
                      const newP = {id:Date.now(),keyword:kw,label:lb,
                        cpaGood:convCriteria?.cpaGood||85,cpaHold:convCriteria?.cpaHold||100,
                        lpvCostGood:convCriteria?.lpvCostGood||800,lpvCostOk:convCriteria?.lpvCostOk||1200,lpvCostHold:convCriteria?.lpvCostHold||2000,
                        lpvRateGood:convCriteria?.lpvRateGood||60,lpvRateOk:convCriteria?.lpvRateOk||40,
                        ctrGood:convCriteria?.ctrGood||1.2,ctrOk:convCriteria?.ctrOk||0.7};
                      setConvCriteria({...convCriteria,products:[...products,newP]});
                    }} style={{padding:"6px 14px",borderRadius:8,border:`1px dashed ${C.border}`,
                      background:C.cream,color:C.inkMid,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                      + 제품 추가
                    </button>
                    {selTab!=='default'&&(
                      <button onClick={()=>{
                        setConvCriteria({...convCriteria,products:products.filter(p=>String(p.id)!==selTab)});
                        setSelTab('default');
                      }} style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${C.bad}44`,
                        background:"#FEF0F0",color:C.bad,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        <MI n="delete" size={13}/> 삭제
                      </button>
                    )}
                  </div>

                  {/* 기준값 편집 */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                    <FR label="CPA 유지 (마진 대비 %)">
                      <Inp type="number" value={cur?.cpaGood||85} onChange={v=>update('cpaGood',+v)} placeholder="85"/>
                      <div style={{fontSize:9,color:C.inkLt,marginTop:2}}>이하 → ✅ 유지</div>
                    </FR>
                    <FR label="CPA 보류 (마진 대비 %)">
                      <Inp type="number" value={cur?.cpaHold||100} onChange={v=>update('cpaHold',+v)} placeholder="100"/>
                      <div style={{fontSize:9,color:C.inkLt,marginTop:2}}>이하 → ⚠️ 보류 / 초과 → 🔴 컷</div>
                    </FR>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
                    <FR label="LPV 단가 좋음 (원)">
                      <Inp type="number" value={cur?.lpvCostGood||800} onChange={v=>update('lpvCostGood',+v)} placeholder="800"/>
                      <div style={{fontSize:9,color:C.inkLt,marginTop:2}}>미만 → 🟢</div>
                    </FR>
                    <FR label="LPV 단가 유지 (원)">
                      <Inp type="number" value={cur?.lpvCostOk||1200} onChange={v=>update('lpvCostOk',+v)} placeholder="1200"/>
                      <div style={{fontSize:9,color:C.inkLt,marginTop:2}}>미만 → 🔵</div>
                    </FR>
                    <FR label="LPV 단가 보류 (원)">
                      <Inp type="number" value={cur?.lpvCostHold||2000} onChange={v=>update('lpvCostHold',+v)} placeholder="2000"/>
                      <div style={{fontSize:9,color:C.inkLt,marginTop:2}}>미만 → 🟡 / 초과 → 🔴</div>
                    </FR>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
                    <FR label="LPV율 정상 (%)">
                      <Inp type="number" value={cur?.lpvRateGood||60} onChange={v=>update('lpvRateGood',+v)} placeholder="60"/>
                      <div style={{fontSize:9,color:C.inkLt,marginTop:2}}>이상 → ✅</div>
                    </FR>
                    <FR label="LPV율 보통 (%)">
                      <Inp type="number" value={cur?.lpvRateOk||40} onChange={v=>update('lpvRateOk',+v)} placeholder="40"/>
                      <div style={{fontSize:9,color:C.inkLt,marginTop:2}}>이상 → ⚠️</div>
                    </FR>
                    <FR label="CTR 좋음 (%)">
                      <Inp type="number" step="0.1" value={cur?.ctrGood||1.2} onChange={v=>update('ctrGood',+v)} placeholder="1.2"/>
                      <div style={{fontSize:9,color:C.inkLt,marginTop:2}}>이상 → 🟢</div>
                    </FR>
                    <FR label="CTR 보통 (%)">
                      <Inp type="number" step="0.1" value={cur?.ctrOk||0.7} onChange={v=>update('ctrOk',+v)} placeholder="0.7"/>
                      <div style={{fontSize:9,color:C.inkLt,marginTop:2}}>이상 → 🟡</div>
                    </FR>
                  </div>
                </>);
              })()}
            </div>

            {/* ── 전환 캠페인 마진 ── */}
            <div style={{fontSize:12,fontWeight:800,color:C.ink,marginBottom:10}}>🎯 전환 캠페인 — 마진 기준</div>
            <div style={{background:C.goldLt,borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:10,color:C.gold,fontWeight:700}}>
              광고명 키워드 포함 시 해당 마진 자동 적용 · 마진 85% 이하 → 유지 / 85~100% → 보류 / 초과 → 컷
            </div>
            <FR label="기본 마진 (키워드 미매칭 시 적용)">
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <Inp type="number" value={marginInput} onChange={setMarginInput} placeholder="30000" style={{flex:1}}/>
                <span style={{fontSize:11,color:C.inkMid,whiteSpace:"nowrap"}}>원</span>
              </div>
            </FR>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {[15000,20000,30000,50000].map(v=>(
                <button key={v} onClick={()=>setMarginInput(String(v))}
                  style={{flex:1,padding:"7px 4px",borderRadius:8,border:`1px solid ${C.border}`,
                    background:marginInput==String(v)?C.rose:C.cream,
                    color:marginInput==String(v)?C.white:C.inkMid,
                    fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  ₩{v/10000}만
                </button>
              ))}
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:800,color:C.ink,marginBottom:8}}>키워드별 마진</div>
              {margins.map((m)=>(
                <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,
                  padding:"10px 12px",background:C.cream,borderRadius:10,border:`1px solid ${C.border}`}}>
                  {editingMargin?.id===m.id ? (
                    <>
                      <Inp value={editingMargin.keyword} onChange={v=>setEditingMargin(e=>({...e,keyword:v}))} placeholder="키워드" style={{flex:1}}/>
                      <Inp type="number" value={editingMargin.margin} onChange={v=>setEditingMargin(e=>({...e,margin:v}))} placeholder="마진" style={{width:100}}/>
                      <span style={{fontSize:10,color:C.inkMid}}>원</span>
                      <Btn small onClick={()=>{setMargins(margins.map(x=>x.id===m.id?{...x,keyword:editingMargin.keyword,margin:+editingMargin.margin||0}:x));setEditingMargin(null);}}>✓</Btn>
                      <Btn small variant="neutral" onClick={()=>setEditingMargin(null)}>✕</Btn>
                    </>
                  ) : (
                    <>
                      <div style={{flex:1}}>
                        <span style={{fontSize:12,fontWeight:700,color:C.ink,background:C.blush,padding:"2px 10px",borderRadius:20,border:`1px solid ${C.rose}33`}}>{m.keyword}</span>
                      </div>
                      <span style={{fontSize:13,fontWeight:800,color:C.rose}}>₩{(+m.margin||0).toLocaleString()}</span>
                      <span style={{fontSize:10,color:C.inkLt}}>원</span>
                      <Btn small variant="neutral" onClick={()=>setEditingMargin({...m})}><MI n="edit" size={13}/></Btn>
                      <Btn small variant="danger" onClick={()=>setMargins(margins.filter(x=>x.id!==m.id))}><MI n="delete" size={13}/></Btn>
                    </>
                  )}
                </div>
              ))}
              <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8,
                padding:"10px 12px",background:C.sageLt,borderRadius:10,border:`1px dashed ${C.sage}66`}}>
                <Inp value={newKeyword} onChange={setNewKeyword} placeholder="키워드 (예: 프리온)" style={{flex:1}}/>
                <Inp type="number" value={newMarginVal} onChange={setNewMarginVal} placeholder="마진" style={{width:100}}/>
                <span style={{fontSize:10,color:C.inkMid,whiteSpace:"nowrap"}}>원</span>
                <Btn small variant="sage" onClick={()=>{
                  if(!newKeyword||!newMarginVal) return;
                  setMargins([...margins,{id:Date.now(),keyword:newKeyword,margin:+newMarginVal}]);
                  setNewKeyword(""); setNewMarginVal("");
                }}>+ 추가</Btn>
              </div>
            </div>

            {/* ── 트래픽 캠페인 기준 ── */}
            <div style={{borderTop:`2px solid ${C.border}`,paddingTop:16,marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:800,color:C.ink,marginBottom:6}}>🚦 트래픽 캠페인 — 판단 기준</div>
              <div style={{background:C.purpleLt,borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:10,color:C.purple,fontWeight:700}}>
                CPC·CTR·LPV율 기준 이하면 🚀올리기 / 초과면 ⚠️줄이기 or 🔴끄기
              </div>

              {/* 기본값 3개 */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
                <FR label="기본 CPC 상한 (원)">
                  <Inp type="number"
                    value={trafficCriteria?.cpcMax||600}
                    onChange={v=>setTrafficCriteria({...trafficCriteria,cpcMax:+v||600})}
                    placeholder="600"/>
                  <div style={{fontSize:9,color:C.inkLt,marginTop:3}}>키워드 미매칭 시 적용</div>
                </FR>
                <FR label="CTR 하한 (%)">
                  <Inp type="number"
                    value={trafficCriteria?.ctrMin||1.5}
                    onChange={v=>setTrafficCriteria({...trafficCriteria,ctrMin:+v||1.5})}
                    placeholder="1.5"/>
                  <div style={{fontSize:9,color:C.inkLt,marginTop:3}}>미달 시 줄이기</div>
                </FR>
                <FR label="LPV율 하한 (%)">
                  <Inp type="number"
                    value={trafficCriteria?.lpvMin||55}
                    onChange={v=>setTrafficCriteria({...trafficCriteria,lpvMin:+v||55})}
                    placeholder="55"/>
                  <div style={{fontSize:9,color:C.inkLt,marginTop:3}}>미달 시 줄이기</div>
                </FR>
              </div>

              {/* 제품별 CPC 상한 */}
              <div style={{fontSize:11,fontWeight:800,color:C.ink,marginBottom:8}}>제품별 CPC 상한</div>
              <div style={{fontSize:10,color:C.inkMid,marginBottom:10,background:C.cream,borderRadius:8,padding:"8px 12px"}}>
                💡 광고명에 키워드가 포함되면 제품별 CPC 상한이 자동 적용돼요<br/>
                <span style={{color:C.inkLt}}>예: "소닉플로우_출근길" → 소닉플로우 기준 적용</span>
              </div>
              {(trafficCriteria?.cpcKeywords||[]).map((k)=>(
                <div key={k.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,
                  padding:"10px 12px",background:C.cream,borderRadius:10,border:`1px solid ${C.border}`}}>
                  <div style={{flex:1}}>
                    <span style={{fontSize:12,fontWeight:700,color:C.ink,background:C.purpleLt,
                      padding:"2px 10px",borderRadius:20,border:`1px solid ${C.purple}33`}}>{k.keyword}</span>
                  </div>
                  <span style={{fontSize:13,fontWeight:800,color:C.purple}}>₩{(k.cpcMax||0).toLocaleString()}</span>
                  <span style={{fontSize:10,color:C.inkLt}}>원</span>
                  <Btn small variant="danger" onClick={()=>setTrafficCriteria({
                    ...trafficCriteria,
                    cpcKeywords:(trafficCriteria.cpcKeywords||[]).filter(x=>x.id!==k.id)
                  })}><MI n="delete" size={13}/></Btn>
                </div>
              ))}
              {/* 새 키워드 추가 */}
              <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8,
                padding:"10px 12px",background:C.purpleLt,borderRadius:10,border:`1px dashed ${C.purple}44`}}>
                <Inp value={newCpcKeyword} onChange={setNewCpcKeyword} placeholder="키워드 (예: 소닉플로우)" style={{flex:1}}/>
                <Inp type="number" value={newCpcVal} onChange={setNewCpcVal} placeholder="CPC 상한" style={{width:110}}/>
                <span style={{fontSize:10,color:C.inkMid,whiteSpace:"nowrap"}}>원</span>
                <Btn small variant="ghost" onClick={()=>{
                  if(!newCpcKeyword||!newCpcVal) return;
                  setTrafficCriteria({
                    ...trafficCriteria,
                    cpcKeywords:[...(trafficCriteria.cpcKeywords||[]),{id:Date.now(),keyword:newCpcKeyword,cpcMax:+newCpcVal}]
                  });
                  setNewCpcKeyword(""); setNewCpcVal("");
                }}>+ 추가</Btn>
              </div>
            </div>

            <Btn onClick={()=>{setMargin(+marginInput||30000);setMarginModal(false);}} style={{width:"100%"}}>💾 저장</Btn>
          </Modal>
        )}
      </div>
    );
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ✨ 인플루언서 (이전과 동일 구조)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const infKpi=[
    {label:"유료",         value:`${infs.filter(f=>f.tier==="유료").length}명`,change:0,good:"high",icon:"💸",note:`무료 ${infs.filter(f=>f.tier==="무료").length}명`},
    {label:"게시 완료",    value:`${infs.filter(f=>f.posted>0).length}/${infs.length}명`,change:0,good:"high",icon:"photo_camera",note:"게시 확인 기준"},
    {label:"2차 활용가능", value:`${infs.filter(f=>f.reusable).length}명`,change:0,good:"high",icon:"♻️",note:"활용 가능"},
    {label:"💰 입금완료",  value:`${infs.filter(f=>f.reusable&&f.paid).length}명`,change:0,good:"high",icon:"check_circle",note:`미입금 ${infs.filter(f=>f.reusable&&!f.paid).length}명`},
    {label:"메타 활용",    value:`${infs.filter(f=>f.metaUsed).length}명`,change:0,good:"high",icon:"campaign",note:"광고 소재 활용"},
  ];
  // 인플루언서 모달 — 별도 컴포넌트로 분리해서 리렌더 차단
  // InfModal
  const [infModalData, setInfModalData] = useState(null); // {mode, initial}
  const [insModalData, setInsModalData] = useState(null); // {initial}
  const [invModalData, setInvModalData] = useState(null); // {mode, initial}
  const [schModalData, setSchModalData] = useState(null); // {mode, initial}
  // 모달은 return JSX 안에서 직접 렌더링

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔍 인플루언서 수집 (Apify) — InfluencerSection보다 먼저 정의
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const CollectSection=(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        {/* 수집 방법 선택 */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
          {[
            {id:"keyword",   icon:"tag",    label:"키워드 (해시태그)", desc:"#비건뷰티 게시물 작성자 추출"},
            {id:"followers", icon:"group",  label:"브랜드 팔로워",     desc:"특정 계정 팔로워 목록 수집"},
          ].map(m=>(
            <div key={m.id} onClick={()=>{setCollectMode(m.id);setCollectResults([]);setCollectError("");}}
              style={{padding:"12px 14px",borderRadius:10,cursor:"pointer",
                border:`2px solid ${collectMode===m.id?C.rose:C.border}`,
                background:collectMode===m.id?C.blush:C.white,transition:"all 0.15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                <MI n={m.icon} size={13} style={{color:collectMode===m.id?C.rose:C.inkMid}}/>
                <span style={{fontSize:11,fontWeight:800,color:collectMode===m.id?C.rose:C.ink}}>{m.label}</span>
              </div>
              <div style={{fontSize:10,color:C.inkMid}}>{m.desc}</div>
            </div>
          ))}
        </div>

        {/* 입력 폼 */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 80px auto",gap:8,alignItems:"flex-end",marginBottom:12}}>
          {collectMode==="keyword"?(
            <FR label="해시태그 키워드 (띄어쓰기 없이)">
              <input value={collectKeyword} onChange={e=>setCollectKeyword(e.target.value)}
                placeholder="예: 비건뷰티" onKeyDown={e=>{if(e.key==="Enter")handleCollect();}}
                style={{width:"100%",boxSizing:"border-box",fontSize:12,padding:"7px 10px",borderRadius:8,
                  border:`1px solid ${C.border}`,fontFamily:"inherit",outline:"none"}}/>
            </FR>
          ):(
            <FR label={collectMode==="followers"?"브랜드/경쟁사 계정":"브랜드 계정 (태그 추출)"}>
              <input value={collectUsername} onChange={e=>setCollectUsername(e.target.value)}
                placeholder="예: oabrand_official" onKeyDown={e=>{if(e.key==="Enter")handleCollect();}}
                style={{width:"100%",boxSizing:"border-box",fontSize:12,padding:"7px 10px",borderRadius:8,
                  border:`1px solid ${C.border}`,fontFamily:"inherit",outline:"none"}}/>
            </FR>
          )}
          <FR label="최소 팔로워">
            <input type="number" value={collectMinFollowers} onChange={e=>setCollectMinFollowers(e.target.value)}
              placeholder="0" style={{width:"100%",boxSizing:"border-box",fontSize:12,padding:"7px 10px",borderRadius:8,
                border:`1px solid ${C.border}`,fontFamily:"inherit",outline:"none"}}/>
          </FR>
          <FR label="최대 팔로워">
            <input type="number" value={collectMaxFollowers} onChange={e=>setCollectMaxFollowers(e.target.value)}
              placeholder="∞" style={{width:"100%",boxSizing:"border-box",fontSize:12,padding:"7px 10px",borderRadius:8,
                border:`1px solid ${C.border}`,fontFamily:"inherit",outline:"none"}}/>
          </FR>
          <FR label="수집 수">
            <input type="number" value={collectCount} onChange={e=>setCollectCount(e.target.value)}
              style={{width:"100%",boxSizing:"border-box",fontSize:12,padding:"7px 10px",borderRadius:8,
                border:`1px solid ${C.border}`,fontFamily:"inherit",outline:"none"}}/>
          </FR>
          <Btn onClick={handleCollect}
            disabled={collectLoading||(collectMode==="keyword"?!collectKeyword.trim():!collectUsername.trim())}
            style={{alignSelf:"flex-end",height:36}}>
            {collectLoading?<><MI n="hourglass_empty" size={13}/> 수집중...</>:<><MI n="search" size={13}/> 수집 시작</>}
          </Btn>
        </div>

        <FR label="카테고리 태그 (선택 · 추가 시 메모에 자동 포함)">
          <input value={collectCategory} onChange={e=>setCollectCategory(e.target.value)}
            placeholder="예: 비건뷰티" style={{width:"100%",boxSizing:"border-box",
              fontSize:12,padding:"7px 10px",borderRadius:8,
              border:`1px solid ${C.border}`,fontFamily:"inherit",outline:"none"}}/>
        </FR>

        {collectError&&(
          <div style={{fontSize:11,fontWeight:700,padding:"8px 12px",borderRadius:8,marginTop:8,
            whiteSpace:"pre-wrap",wordBreak:"break-all",
            background:collectError.startsWith("✅")?C.sageLt:"#FFF8F8",
            color:collectError.startsWith("✅")?C.good:C.bad,
            border:`1px solid ${collectError.startsWith("✅")?C.good+"44":C.bad+"44"}`}}>
            {collectError}
          </div>
        )}

        {!collectResults.length&&!collectLoading&&!collectError&&(
          <div style={{textAlign:"center",padding:"32px 0",color:C.inkLt,fontSize:12}}>
            <MI n="travel_explore" size={32} style={{color:C.border,display:"block",margin:"0 auto 8px"}}/>
            {collectMode==="keyword"?"키워드를 입력하고 수집 시작을 눌러주세요":"경쟁사 계정을 입력하고 수집 시작을 눌러주세요"}
          </div>
        )}
      </Card>

      {collectResults.length>0&&(
        <Card>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:800,color:C.ink}}>
              수집 결과 <span style={{color:C.rose}}>{collectResults.length}개</span> 계정
              {Object.values(collectSelected).filter(Boolean).length>0&&(
                <span style={{fontSize:10,color:C.inkMid,marginLeft:8}}>{Object.values(collectSelected).filter(Boolean).length}개 선택됨</span>
              )}
            </div>
            <div style={{display:"flex",gap:6}}>
              <Btn variant="neutral" small onClick={()=>{const sel={};collectResults.forEach(r=>{sel[r.username]=true;});setCollectSelected(sel);}}>전체 선택</Btn>
              <Btn variant="neutral" small onClick={()=>setCollectSelected({})}>해제</Btn>
              <Btn variant="sage" small disabled={Object.values(collectSelected).filter(Boolean).length===0} onClick={handleAddCollected}>
                <MI n="add" size={12}/> 관리 목록에 추가
              </Btn>
            </div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:520}}>
              <thead>
                <tr style={{background:C.cream,borderBottom:`2px solid ${C.border}`}}>
                  <th style={{padding:"6px 10px",width:32}}/>
                  {collectMode==="keyword"
                    ?["계정","이름","#포스트","평균좋아요","평균댓글",""].map(h=>(
                        <th key={h} style={{padding:"6px 10px",textAlign:"left",fontSize:10,fontWeight:700,color:C.inkMid,whiteSpace:"nowrap"}}>{h}</th>
                      ))
                    :["계정","이름","팔로워","게시물","바이오",""].map(h=>(
                        <th key={h} style={{padding:"6px 10px",textAlign:"left",fontSize:10,fontWeight:700,color:C.inkMid,whiteSpace:"nowrap"}}>{h}</th>
                      ))
                  }
                </tr>
              </thead>
              <tbody>
                {collectResults.map(r=>{
                  const isDup=infs.some(f=>(f.name||"").replace(/^@/,"")===r.username);
                  const checked=!!collectSelected[r.username];
                  const fmtNum=n=>n==null?"—":n>=1000000?(n/1000000).toFixed(1)+"M":n>=1000?(n/1000).toFixed(0)+"K":String(n);
                  return(
                    <tr key={r.username} style={{borderBottom:`1px solid ${C.border}`,
                      background:isDup?"#FFFBEB":checked?"#EFF6FF":C.white,cursor:"pointer"}}
                      onClick={()=>!isDup&&setCollectSelected(p=>({...p,[r.username]:!p[r.username]}))}>
                      <td style={{padding:"8px 10px"}}>
                        {isDup
                          ?<span style={{fontSize:9,color:C.warn,fontWeight:700,background:"#FFF8EC",padding:"2px 6px",borderRadius:10}}>이미 있음</span>
                          :<input type="checkbox" checked={checked} readOnly style={{accentColor:C.rose}}/>}
                      </td>
                      <td style={{padding:"8px 10px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <a href={r.profileUrl} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                            style={{fontSize:12,fontWeight:800,color:C.rose,textDecoration:"none"}}>@{r.username}</a>
                          {r.isVerified&&<MI n="verified" size={12} style={{color:C.rose}}/>}
                        </div>
                      </td>
                      <td style={{padding:"8px 10px",fontSize:11,color:C.inkMid}}>{r.fullName||"—"}</td>
                      {collectMode==="keyword"?(
                        <>
                          <td style={{padding:"8px 10px",fontSize:12,fontWeight:700,color:C.ink,textAlign:"center"}}>{r.posts??"-"}</td>
                          <td style={{padding:"8px 10px",fontSize:12,fontWeight:700,color:C.rose,textAlign:"center"}}>{r.avgLikes!=null?r.avgLikes.toLocaleString():"—"}</td>
                          <td style={{padding:"8px 10px",fontSize:11,color:C.inkMid,textAlign:"center"}}>{r.avgComments!=null?r.avgComments.toLocaleString():"—"}</td>
                        </>
                      ):(
                        <>
                          <td style={{padding:"8px 10px",fontSize:12,fontWeight:700,color:C.ink}}>{fmtNum(r.followers)}</td>
                          <td style={{padding:"8px 10px",fontSize:11,color:C.inkMid}}>{r.posts??"-"}</td>
                          <td style={{padding:"8px 10px",fontSize:10,color:C.inkMid,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.bio||"—"}</td>
                        </>
                      )}
                      <td style={{padding:"8px 10px"}}>
                        <a href={r.profileUrl} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                          style={{fontSize:10,color:C.inkLt,textDecoration:"none"}}><MI n="open_in_new" size={12}/></a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );

  const InfluencerSection=(()=>{
    const [infSearch, setInfSearch] = useState("");
    const [infStatusFilter, setInfStatusFilter] = useState("전체");
    const [expandedRow, setExpandedRow] = useState(null);
    const tierData=[
      {name:"매크로",value:infs.filter(f=>f.tier==="매크로").length,color:C.rose},
      {name:"미드",  value:infs.filter(f=>f.tier==="미드").length,  color:C.gold},
      {name:"마이크로",value:infs.filter(f=>f.tier==="마이크로").length,color:C.sage},
      {name:"나노",  value:infs.filter(f=>f.tier==="나노").length,  color:C.purple},
    ].filter(d=>d.value>0);
    return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* 서브탭 */}
      <div style={{display:"flex",gap:0,borderBottom:`2px solid ${C.border}`}}>
        {[
          {id:"수집",icon:"travel_explore"},
          {id:"저장",icon:"bookmark"},
          {id:"진행상황",icon:"table_rows"},
        ].map(t=>(
          <button key={t.id} onClick={()=>setInfTabMode(t.id)} style={{
            fontSize:12,fontWeight:700,padding:"8px 20px",
            border:"none",borderBottom:infTabMode===t.id?`2px solid ${C.rose}`:"2px solid transparent",
            marginBottom:-2,background:"transparent",cursor:"pointer",fontFamily:"inherit",
            color:infTabMode===t.id?C.rose:C.inkMid,display:"flex",alignItems:"center",gap:5,
          }}>
            <MI n={t.icon} size={13}/> {t.id}
          </button>
        ))}
      </div>

      {/* 수집 탭 */}
      {infTabMode==="수집"&&<>{CollectSection}</>}

      {/* 저장 탭 */}
      {infTabMode==="저장"&&(()=>{
        // note 필드에서 카테고리/키워드 파싱
        const getCat = f => {
          const m = (f.note||"").match(/^\[([^\]]+)\]/);
          return m ? m[1] : "기타";
        };
        const getSrc = f => {
          const note = (f.note||"");
          const m = note.match(/키워드:\s*(.+?)(\s·|$)/);
          if(m) return "키워드: " + m[1].trim();
          const m2 = note.match(/팔로워:\s*(.+?)(\s·|$)/);
          if(m2) return "팔로워: " + m2[1].trim();
          return note.replace(/^\[[^\]]+\]\s*/,"").split("·")[0].trim() || "직접 추가";
        };
        // Apify로 수집된 것만 (note에 키워드:/팔로워:/태그: 포함)
        const isCollected = f => /키워드:|팔로워:|태그:/.test(f.note||"") || /^\[/.test(f.note||"");
        // 카테고리별 그룹핑
        const groups = {};
        infs.filter(isCollected).forEach(f => {
          const cat = getCat(f);
          if(!groups[cat]) groups[cat] = [];
          groups[cat].push(f);
        });
        const cats = Object.keys(groups).sort();
        if(cats.length === 0) return(
          <div style={{textAlign:"center",padding:"48px 0",color:C.inkLt,fontSize:12}}>
            <MI n="bookmark" size={32} style={{color:C.border,display:"block",margin:"0 auto 8px"}}/>
            저장된 인플루언서가 없어요<br/>
            <span style={{fontSize:10}}>수집 탭에서 계정을 추가하면 여기에 모여요</span>
          </div>
        );
        return(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {cats.map(cat=>(
              <Card key={cat}>
                <CardTitle
                  title={<><MI n="label" size={13}/> {cat}</>}
                  sub={`${groups[cat].length}명`}
                />
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:460}}>
                    <thead>
                      <tr style={{background:C.cream,borderBottom:`2px solid ${C.border}`}}>
                        {["계정","이름","팔로워","수집 경로",""].map(h=>(
                          <th key={h} style={{padding:"6px 10px",textAlign:"left",fontSize:10,fontWeight:700,color:C.inkMid,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groups[cat].map(f=>{
                        const handle=f.name.replace(/^@/,"");
                        const url=`https://www.instagram.com/${handle}`;
                        return(
                          <tr key={f.id} style={{borderBottom:`1px solid ${C.border}`}}>
                            <td style={{padding:"8px 10px"}}>
                              <a href={url} target="_blank" rel="noreferrer"
                                style={{fontSize:12,fontWeight:800,color:C.rose,textDecoration:"none"}}>
                                @{handle}
                              </a>
                            </td>
                            <td style={{padding:"8px 10px",fontSize:11,color:C.inkMid}}>{f.displayName||"—"}</td>
                            <td style={{padding:"8px 10px",fontSize:11,fontWeight:700,color:C.ink}}>{f.followers||"—"}</td>
                            <td style={{padding:"8px 10px",fontSize:10,color:C.inkMid,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{getSrc(f)}</td>
                            <td style={{padding:"8px 10px"}}>
                              <Btn variant="neutral" small onClick={()=>setInfModalData({mode:"edit",initial:f})}>
                                <MI n="edit" size={11}/>
                              </Btn>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>
        );
      })()}

      {/* 진행상황 탭 */}
      {infTabMode==="진행상황"&&<>

      {/* 구글 시트 연동 배너 */}
      <div style={{
        background: infSheetStatus==="ok" ? "#EDF7F1" : C.goldLt,
        border:`1px solid ${infSheetStatus==="ok"?C.good+"55":C.gold+"66"}`,
        borderRadius:12,padding:"12px 16px",
        display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",
      }}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {infSheetStatus==="ok"?<MI n="circle" size={20} style={{color:C.good}}/>:<MI n="assignment" size={20}/>}
          <div>
            {infSheetStatus==="ok"
              ? <><div style={{fontSize:12,fontWeight:800,color:C.good}}>구글 시트 연결됨 · {infs.length}명 로드</div>
                  <div style={{fontSize:10,color:C.inkMid,marginTop:1}}>시트 변경 시 자동 반영</div></>
              : infSheetStatus==="loading"
              ? <div style={{fontSize:12,fontWeight:700,color:C.gold}}><MI n="hourglass_empty" size={13}/> 불러오는 중...</div>
              : infSheetStatus==="error"
              ? <div style={{fontSize:12,fontWeight:800,color:C.bad}}>연결 실패 — 시트 공유 설정 또는 URL을 확인하세요</div>
              : <><div style={{fontSize:12,fontWeight:800,color:C.gold}}>구글 시트 연결하면 인플루언서 데이터가 자동 동기화돼요</div>
                  <div style={{fontSize:10,color:C.inkMid,marginTop:1}}>name · tier · platform · product · reach · saves · clicks · conv 등</div></>
            }
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {infSheetStatus==="ok"&&<Btn variant="sage" small onClick={()=>fetchInfSheet(infUrl)}><MI n="refresh" size={13}/> 새로고침</Btn>}
          {infSheetStatus==="error"&&<Btn variant="danger" small onClick={()=>{setInfSheetStatus("idle");}}><MI n="delete" size={13}/> URL 초기화</Btn>}
          <Btn variant={infSheetStatus==="ok"?"neutral":"gold"} small onClick={()=>{setInfUrlInput(infUrl);setInfUrlModal(true)}}>
            {infSheetStatus==="ok"?"⚙️ 시트 변경":<><MI n="link" size={13}/> 시트 연결</>}
          </Btn>
        </div>
      </div>

      {/* 시트 URL 입력 모달 */}
      {infUrlModal&&(
        <Modal title={<><MI n="assignment"/> 인플루언서 시트 연결</>} onClose={()=>setInfUrlModal(false)}>
          <div style={{background:C.cream,borderRadius:10,padding:"14px",marginBottom:16,fontSize:11,color:C.inkMid,lineHeight:1.7}}>
            <b style={{color:C.ink}}>시트 1행 헤더 그대로 사용 가능</b><br/>
            담당자 · 제품명 · 이름 · 인스타그램 아이디 · 매체 · 링크 · 제품 발송 · 제품발송일자 · 작성마감일 · 포스팅 확인 · 비고 · 기간연장<br/>
            <span style={{color:C.rose}}>※ 포스팅 확인 컬럼이 "확인완료"이면 게시완료로 인식</span>
          </div>
          <FR label="구글 시트 URL">
            <Inp value={infUrlInput} onChange={v=>setInfUrlInput(v)} placeholder="https://docs.google.com/spreadsheets/d/..."/>
          </FR>
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <Btn onClick={()=>{setInfUrl(infUrlInput);setInfUrlModal(false);fetchInfSheet(infUrlInput);}} style={{flex:1}}><MI n="link" size={13}/> 연결</Btn>
            {infUrl&&<Btn variant="danger" onClick={()=>{setInfSheetStatus("idle");setInfUrlModal(false);}}>연결 해제</Btn>}
          </div>
        </Modal>
      )}

      <KpiGrid items={infKpi} cols={6}/>
      <div className="content-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {/* 💰 2차활용 미입금 카드 */}
        <Card>
          <CardTitle title={<><MI n="payments" size={14}/> 2차활용 입금 현황</>} sub={`미입금 ${infs.filter(f=>f.reusable&&!f.paid).length}명`}/>
          {infs.filter(f=>f.reusable&&!f.paid).length===0?(
            <div style={{textAlign:"center",padding:"24px 0",color:C.good,fontSize:12,fontWeight:700}}><MI n="check_circle" size={14}/> 모두 입금 완료</div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:220,overflowY:"auto"}}>
              {infs.filter(f=>f.reusable&&!f.paid).map((f,i)=>(
                <div key={f.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"7px 10px",borderRadius:9,background:C.cream,border:`1px solid ${C.border}`}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:800,color:C.ink}}>{f.displayName||f.name}</div>
                    <div style={{fontSize:9,color:C.inkMid,marginTop:1}}>{f.product} · {f.note&&f.note.slice(0,30)}</div>
                  </div>
                  <button onClick={()=>setInfs(arr=>arr.map(x=>x.id===f.id?{...x,paid:true}:x))}
                    style={{fontSize:10,fontWeight:700,padding:"4px 10px",borderRadius:20,cursor:"pointer",
                      background:"#EDF7F1",color:C.good,border:`1px solid ${C.good}44`}}>
                    입금완료 ✓
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ♻️ 2차활용 기간 만료 체크 카드 */}
        <Card>
          <CardTitle title="♻️ 2차활용 기간 현황" sub="게시일 기준"/>
          {(()=>{
            const now = new Date();
            const reusables = infs.filter(f=>f.reusable&&f.postedDate);
            // 기간 파싱 — note에서 "3개월","6개월","1개월","무한" 추출
            const getDays = (note="") => {
              if(note.includes("무한")) return 9999;
              const m = note.match(/(\d+)개월/);
              return m ? parseInt(m[1])*30 : 90; // 기본 3개월
            };
            const withExpiry = reusables.map(f=>{
              const days = getDays(f.note||"");
              const expiry = new Date(f.postedDate);
              expiry.setDate(expiry.getDate()+days);
              const left = Math.ceil((expiry-now)/(1000*60*60*24));
              return {...f, left, expiry: days===9999?"무한":expiry.toLocaleDateString("ko-KR",{month:"short",day:"numeric"})};
            }).sort((a,b)=>a.left-b.left);
            const expired  = withExpiry.filter(f=>f.left<=0&&f.left!==9999);
            const soon     = withExpiry.filter(f=>f.left>0&&f.left<=14);
            const ok       = withExpiry.filter(f=>f.left>14||f.left===9999);
            return(
              <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:220,overflowY:"auto"}}>
                {expired.length>0&&expired.map(f=>(
                  <div key={f.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"6px 10px",borderRadius:8,background:"#FEF0F0",border:`1px solid ${C.bad}33`}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.bad}}>{f.displayName||f.name}</div>
                    <span style={{fontSize:10,color:C.bad,fontWeight:700}}>만료</span>
                  </div>
                ))}
                {soon.length>0&&soon.map(f=>(
                  <div key={f.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"6px 10px",borderRadius:8,background:"#FFF8EC",border:`1px solid ${C.warn}33`}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.warn}}>{f.displayName||f.name}</div>
                    <span style={{fontSize:10,color:C.warn,fontWeight:700}}>D-{f.left}</span>
                  </div>
                ))}
                {ok.length>0&&ok.map(f=>(
                  <div key={f.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"6px 10px",borderRadius:8,background:C.cream}}>
                    <div style={{fontSize:11,color:C.inkMid}}>{f.displayName||f.name}</div>
                    <span style={{fontSize:10,color:C.inkLt}}>{f.left===9999?"무한":f.expiry+"까지"}</span>
                  </div>
                ))}
                {withExpiry.length===0&&<div style={{textAlign:"center",padding:"24px 0",color:C.inkLt,fontSize:11}}>데이터 없음</div>}
              </div>
            );
          })()}
        </Card>
      </div>

      <Card>
        <CardTitle title={<><MI n="table_rows" size={14}/> 인플루언서 목록</>}
          sub={`${infs.length}명`}
          action={<Btn small onClick={()=>setInfModalData({mode:"add",initial:null})}>+ 추가</Btn>}/>

        {/* 검색 + 필터 */}
        <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
          <input value={infSearch} onChange={e=>setInfSearch(e.target.value)} placeholder="이름 · 제품 검색"
            style={{flex:1,minWidth:120,fontSize:11,padding:"6px 10px",borderRadius:8,
              border:`1px solid ${C.border}`,fontFamily:"inherit",outline:"none"}}/>
          {["전체","미게시","대기중","완료필요","기록완료"].map(f=>(
            <button key={f} onClick={()=>setInfStatusFilter(f)}
              style={{fontSize:10,padding:"4px 12px",borderRadius:20,border:`1px solid ${infStatusFilter===f?C.rose:C.border}`,
                background:infStatusFilter===f?C.rose:C.cream,color:infStatusFilter===f?C.white:C.inkMid,
                cursor:"pointer",fontFamily:"inherit",fontWeight:700,whiteSpace:"nowrap"}}>
              {f}
            </button>
          ))}
        </div>

        {infs.length===0&&(
          <div style={{textAlign:"center",padding:"32px 0",color:C.inkLt,fontSize:12}}>
            아직 등록된 인플루언서가 없어요<br/>
            <Btn style={{marginTop:12}} onClick={()=>setInfModalData({mode:"add",initial:null})}>+ 첫 번째 추가</Btn>
          </div>
        )}

        {infs.length>0&&(()=>{
          const norm = s => (s||"").toLowerCase();
          const filtered = [...infs]
            .filter(f=>{
              if(infSearch){
                const q=norm(infSearch);
                if(!norm(f.displayName).includes(q)&&!norm(f.name).includes(q)&&!norm(f.product).includes(q)) return false;
              }
              if(infStatusFilter!=="전체"){
                const st=insightStatus(f);
                if(infStatusFilter==="미게시"&&f.posted) return false;
                if(infStatusFilter==="미게시"&&!f.posted) return true;
                if(infStatusFilter==="기록완료"&&st.label!=="기록완료") return false;
                if(infStatusFilter==="완료필요"&&!st.label.includes("미입력")&&st.label!=="오늘 입력!") return false;
                if(infStatusFilter==="대기중"&&f.posted&&(st.label==="기록완료"||st.label.includes("미입력")||st.label==="오늘 입력!")) return false;
              }
              return true;
            })
            .sort((a,b)=>{
              if(!a.postedDate&&!b.postedDate) return 0;
              if(!a.postedDate) return 1; if(!b.postedDate) return -1;
              return new Date(b.postedDate)-new Date(a.postedDate);
            });

          const TC = {유료:C.rose,무료:C.sage,매크로:C.rose,미드:C.gold,마이크로:C.sage,나노:C.purple};
          const platIcon = p => p==="유튜브"?<MI n="play_circle" size={14}/>:p==="틱톡"?<MI n="music_note" size={14}/>:<MI n="photo_camera" size={14}/>;

          return(
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:520}}>
              <thead>
                <tr style={{background:C.cream,borderBottom:`2px solid ${C.border}`}}>
                  {["이름","플랫폼","제품","상태","게시일","발송",""].map(h=>(
                    <th key={h} style={{padding:"7px 10px",textAlign:"left",fontSize:10,fontWeight:700,
                      color:C.inkMid,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(f=>{
                  const st=insightStatus(f);
                  const tc=TC[f.tier]||C.inkMid;
                  const isExp=expandedRow===f.id;
                  const handle=f.name.replace(/^@/,"");
                  const profileUrl=f.platform==="유튜브"?`https://www.youtube.com/@${handle}`:f.platform==="틱톡"?`https://www.tiktok.com/@${handle}`:`https://www.instagram.com/${handle}`;
                  const urgent=st.label.includes("미입력")||st.label==="오늘 입력!";
                  return(<>
                    <tr key={f.id} onClick={()=>setExpandedRow(isExp?null:f.id)}
                      style={{borderBottom:`1px solid ${C.border}`,cursor:"pointer",
                        background:isExp?"#EFF6FF":urgent?"#FFF8F8":C.white,
                        transition:"background 0.1s"}}>
                      <td style={{padding:"9px 10px",whiteSpace:"nowrap"}}>
                        <div style={{fontSize:12,fontWeight:800,color:C.ink}}>
                          <a href={profileUrl} target="_blank" rel="noreferrer"
                            onClick={e=>e.stopPropagation()}
                            style={{color:C.ink,textDecoration:"none",borderBottom:`1px dashed ${C.border}`}}>
                            {f.displayName||f.name}
                          </a>
                        </div>
                        <div style={{fontSize:9,color:C.inkLt}}>{f.name}</div>
                      </td>
                      <td style={{padding:"9px 10px"}}>
                        <span style={{color:tc,display:"flex",alignItems:"center",gap:3,fontSize:10,fontWeight:700}}>
                          {platIcon(f.platform)}
                        </span>
                      </td>
                      <td style={{padding:"9px 10px",fontSize:11,color:C.inkMid,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.product||"—"}</td>
                      <td style={{padding:"9px 10px"}}>
                        {f.tier==="유료"?(
                          <span style={{fontSize:10,fontWeight:700,color:st.color,background:st.bg,
                            padding:"2px 8px",borderRadius:20,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:3}}>
                            <MI n={st.icon} size={11}/> {st.label}
                          </span>
                        ):(
                          <span style={{fontSize:10,fontWeight:700,color:C.sage,background:C.sageLt,
                            padding:"2px 8px",borderRadius:20,whiteSpace:"nowrap"}}>무료</span>
                        )}
                      </td>
                      <td style={{padding:"9px 10px",fontSize:11,color:C.inkMid,whiteSpace:"nowrap"}}>{f.postedDate||"—"}</td>
                      <td style={{padding:"9px 10px"}}>
                        <MI n={f.sent?"check_circle":"radio_button_unchecked"} size={14} style={{color:f.sent?C.good:C.border}}/>
                      </td>
                      <td style={{padding:"9px 10px"}}>
                        <div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
                          <Btn variant="neutral" small onClick={()=>setInfModalData({mode:"edit",initial:f})}><MI n="edit" size={12}/></Btn>
                          <Btn variant="danger" small onClick={()=>setInfs(infs.filter(x=>x.id!==f.id))}><MI n="delete" size={12}/></Btn>
                        </div>
                      </td>
                    </tr>
                    {isExp&&(
                      <tr key={f.id+"_exp"} style={{background:"#F0F7FF"}}>
                        <td colSpan={7} style={{padding:"12px 14px"}}>
                          {f.tier==="유료"&&(
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                            {[
                              {label:f.videoReceived?"🎬 영상수령":"🎬 미수령",active:f.videoReceived,onClick:()=>setInfs(arr=>arr.map(x=>x.id===f.id?{...x,videoReceived:!x.videoReceived}:x))},
                              {label:f.reusable?"♻️ 2차활용":"♻️ 미허용",active:f.reusable,onClick:()=>setInfs(arr=>arr.map(x=>x.id===f.id?{...x,reusable:!x.reusable}:x))},
                              ...(f.reusable?[{label:f.paid?"💰 입금완료":"💰 미입금",active:f.paid,onClick:()=>setInfs(arr=>arr.map(x=>x.id===f.id?{...x,paid:!x.paid}:x))}]:[]),
                              {label:f.metaUsed?"📢 메타활용":"📢 미활용",active:f.metaUsed,onClick:()=>setInfs(arr=>arr.map(x=>x.id===f.id?{...x,metaUsed:!x.metaUsed}:x))},
                            ].map(({label,active,onClick})=>(
                              <span key={label} onClick={onClick} style={{fontSize:10,fontWeight:700,padding:"3px 10px",
                                borderRadius:20,cursor:"pointer",userSelect:"none",
                                background:active?"#EDF7F1":C.cream,color:active?C.good:C.inkMid,
                                border:`1px solid ${active?C.good+"44":C.border}`}}>{label}</span>
                            ))}
                          </div>
                        )}
                          {f.reach!==null&&(
                            <div style={{display:"flex",gap:16,marginBottom:6}}>
                              {[{l:"도달",v:(f.reach/1000).toFixed(0)+"K",c:C.rose},{l:"저장",v:f.saves?.toLocaleString(),c:C.gold},{l:"클릭",v:f.clicks?.toLocaleString(),c:C.purple},{l:"전환",v:f.conv,c:C.good}].map(({l,v,c})=>(
                                <div key={l}><div style={{fontSize:9,color:C.inkLt}}>{l}</div><div style={{fontSize:13,fontWeight:800,color:c}}>{v}</div></div>
                              ))}
                            </div>
                          )}
                          {f.note&&<div style={{fontSize:10,color:C.inkMid,background:"#fff",padding:"4px 10px",borderRadius:8,display:"inline-block"}}>{f.note}</div>}
                        </td>
                      </tr>
                    )}
                  </>);
                })}
              </tbody>
            </table>
            {filtered.length===0&&<div style={{textAlign:"center",padding:"24px 0",color:C.inkLt,fontSize:12}}>검색 결과 없음</div>}
          </div>
          );
        })()}
      </Card>

      </>}

    </div>
    );
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📦 재고 + 📅 스케줄 (이전 v5와 동일)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const invKpi=[
    {label:"전체 SKU",    value:`${inv.length}종`,change:0,good:"high",icon:"assignment",note:"활성 상품"},
    {label:"위험 재고",   value:`${dangerInv.length}종`,change:dangerInv.length>0?1:0,good:"low",icon:"warning",note:"즉시 발주"},
    {label:"주의 재고",   value:`${cautionInv.length}종`,change:0,good:"low",icon:"warning",note:"21일 내 소진"},
    {label:"30일 판매",   value:inv.reduce((s,i)=>s+i.sold30,0).toLocaleString(),change:+18.4,good:"high",icon:"trending_up",note:"전월 대비"},
    {label:"총 재고",     value:inv.reduce((s,i)=>s+i.stock,0).toLocaleString(),change:-3.2,good:"high",icon:"inventory_2",note:"전체 수량"},
    {label:"주문 재고",   value:inv.reduce((s,i)=>s+(i.ordered||0),0).toLocaleString(),change:0,good:"high",icon:"local_shipping",note:"입고 예정"},
  ];
  const stockTrend=[
    {week:"W1",세럼30:1680,선크림:2480,토너패드:380},
    {week:"W2",세럼30:1520,선크림:2310,토너패드:280},
    {week:"W3",세럼30:1380,선크림:2180,토너패드:188},
    {week:"W4",세럼30:1240,선크림:2140,토너패드:88},
  ];
  function parseInvCSV(text){
    const lines = text.trim().split("\n").map(l=>{
      const res=[]; let cur="", inQ=false;
      for(let i=0;i<l.length;i++){
        if(l[i]==='"'){inQ=!inQ;}
        else if(l[i]===","&&!inQ){res.push(cur.trim());cur="";}
        else cur+=l[i];
      }
      res.push(cur.trim());
      return res;
    });
    const HINTS=["상품명","sku","카테고리","재고","판매"];
    let startIdx=0;
    for(let i=0;i<Math.min(lines.length,5);i++){
      if(HINTS.some(h=>lines[i].join(",").toLowerCase().includes(h))){startIdx=i;break;}
    }
    const headers=lines[startIdx].map(h=>h.toLowerCase().replace(/[\s\(\)개]/g,"").replace(/_+/g,"_"));
    return lines.slice(startIdx+1).filter(l=>l.some(c=>c)).map((row,ri)=>{
      const obj={};
      headers.forEach((h,i)=>{obj[h]=row[i]||"";});
      const num=(...ks)=>{for(const k of ks){const v=obj[k];if(v)return parseInt(String(v).replace(/,/g,""))||0;}return 0;};
      return {
        id:Date.now()+ri,
        name:    obj["상품명"]||obj["name"]||"",
        sku:     obj["sku"]||"",
        category:obj["카테고리"]||obj["category"]||"기타",
        stock:   num("현재재고","재고"),
        ordered: num("주문수량","주문"),
        reorder: num("발주기준","발주"),
        sold30:  num("30일판매량","판매량","판매"),
      };
    }).filter(r=>r.name);
  }

  const ScheduleSection=(()=>{
    const [calMonth, setCalMonth] = useState(()=>{const n=new Date();return{y:n.getFullYear(),m:n.getMonth()};});
    const [selDay, setSelDay] = useState(null);
    const [schFilter, setSchFilter] = useState("미완료"); // 미완료 | 전체
    const [assigneeFilter, setAssigneeFilter] = useState("전체"); // 전체 | 소리 | 영서 | 경은 | 지수
    const [clModal, setClModal] = useState(false);
    const [clForm, setClForm] = useState({title:"",cycle:"weekly",weekDay:1,monthDay:1,assignee:""});
    const [dragOverDay, setDragOverDay] = useState(null);
    const dragRef = useRef(null);
    const [moveItemId, setMoveItemId] = useState(null);

    async function handleDropOnDay(targetKey) {
      const item = dragRef.current;
      dragRef.current = null;
      setDragOverDay(null);
      if (!item || item.date === targetKey || item._isChecklist) return;
      const delta = new Date(targetKey+"T00:00:00") - new Date(item.date+"T00:00:00");
      const newEnd = item.endDate ? (()=>{const e=new Date(item.endDate+"T00:00:00");e.setTime(e.getTime()+delta);return toLocalKey(e);})() : null;
      // 낙관적 업데이트
      setNotionSch(prev=>prev.map(s=>s.id===item.id?{...s,date:targetKey,endDate:newEnd}:s));
      await fetch("/api/notion",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"update",pageId:item.id,data:{date:targetKey,endDate:newEnd}})});
    }

    // 달력 월 변경 시 자동 재로드
    useEffect(() => {
      if (schFilter === "전체") return; // 전체 모드는 이미 다 로드됨
      const month = `${calMonth.y}-${String(calMonth.m+1).padStart(2,"0")}`;
      fetchNotionSch({ month });
    }, [calMonth.y, calMonth.m]);

    function handleFilterChange(f) {
      setSchFilter(f);
      if (f === "전체") {
        fetchNotionSch({ completed: true });
      } else {
        const month = `${calMonth.y}-${String(calMonth.m+1).padStart(2,"0")}`;
        fetchNotionSch({ month });
      }
    }

    const baseItems = schFilter==="전체" ? notionSch : notionSch.filter(s=>s.status!=="완료");
    const activeItems = assigneeFilter==="전체" ? baseItems : baseItems.filter(s=>s.assignee===assigneeFilter);

    // 달력 계산
    const firstDay = new Date(calMonth.y, calMonth.m, 1);
    const lastDay  = new Date(calMonth.y, calMonth.m+1, 0);
    const startDow = firstDay.getDay(); // 0=일
    const daysInMonth = lastDay.getDate();

    // 날짜별 항목 매핑 (로컬 날짜 기준 — toISOString은 UTC라 한국에서 날짜 오류 발생)
    const toLocalKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const itemsByDate = {};
    activeItems.forEach(s => {
      if (!s.date) return;
      const sd = new Date(s.date + "T00:00:00");
      const ed = s.endDate ? new Date(s.endDate + "T00:00:00") : new Date(sd);
      let firstVisibleInMonth = true;
      for (let d = new Date(sd); d <= ed; d.setDate(d.getDate()+1)) {
        const key = toLocalKey(d);
        if (!itemsByDate[key]) itemsByDate[key] = [];
        const isStart = d.getTime()===sd.getTime();
        const isEnd = d.getTime()===ed.getTime();
        const spanPos = isStart&&isEnd?"single":isStart?"start":isEnd?"end":"mid";
        const inThisMonth = d.getMonth()===calMonth.m && d.getFullYear()===calMonth.y;
        const _firstVisible = inThisMonth && firstVisibleInMonth;
        if (inThisMonth) firstVisibleInMonth = false;
        itemsByDate[key].push({...s, _spanPos: spanPos, _firstVisible});
      }
    });

    // 반복 체크리스트 → 달력에 자동 표시
    const ASSIGNEE_COLORS={"소리":"#f472b6","영서":"#60a5fa","경은":"#34d399","지수":"#a78bfa"};
    (checkItems||[]).forEach(ci=>{
      const daysInCal = new Date(calMonth.y, calMonth.m+1, 0).getDate();
      for(let day=1; day<=daysInCal; day++){
        const d = new Date(calMonth.y, calMonth.m, day);
        const dow2 = d.getDay(); // 0=일,1=월
        let show = false;
        if(ci.cycle==="daily") show=true;
        else if(ci.cycle==="weekly") show=(dow2===(ci.weekDay??1)); // 기본 월요일
        else if(ci.cycle==="monthly") show=(day===(ci.monthDay??1)); // 기본 1일
        if(!show) continue;
        const key=toLocalKey(d);
        if(!itemsByDate[key]) itemsByDate[key]=[];
        itemsByDate[key].push({
          id:"cl_"+ci.id+"_"+key,
          title:ci.title,
          type:"반복",
          date:key,
          assignee:ci.assignee||"",
          assigneeColor:ASSIGNEE_COLORS[ci.assignee]||"#94a3b8",
          _isChecklist:true,
          _checkItem:ci,
        });
      }
    });

    const todayStr2 = toLocalKey(new Date());
    const months=["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
    const days=["일","월","화","수","목","금","토"];

    const selItems = selDay ? (itemsByDate[selDay]||[]) : [];

    return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* 노션 상태 배너 */}
      <div style={{background:C.white,border:`1px solid ${notionError?C.bad+"44":C.good+"44"}`,borderRadius:12,padding:"10px 12px"}}>
        {/* 상태 + 새로고침 */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          {notionLoading?<MI n="hourglass_empty" size={15}/>:notionError?<MI n="cancel" size={15}/>:<MI n="circle" size={15} style={{color:C.good}}/>}
          <div style={{flex:1,fontSize:11,fontWeight:700,color:notionError?C.bad:C.good}}>
            {notionLoading?"노션 불러오는 중...":notionError?`노션 오류: ${notionError}`:`노션 연동됨 · ${notionSch.length}개 · 미완료 ${notionSch.filter(s=>s.status!=="완료").length}개`}
          </div>
          <button onClick={()=>notionCsvInputRef.current?.click()} title="노션 CSV 업로드" style={{fontSize:12,padding:"4px 10px",borderRadius:20,
            border:`1px solid ${C.border}`,background:C.cream,cursor:"pointer",fontFamily:"inherit",fontWeight:700,flexShrink:0}}>
            <MI n="upload_file" size={14}/>
          </button>
          <input ref={notionCsvInputRef} type="file" accept=".csv" style={{display:"none"}} onChange={handleNotionCSVUpload}/>
          <button onClick={()=>handleFilterChange(schFilter)} style={{fontSize:12,padding:"4px 10px",borderRadius:20,
            border:`1px solid ${C.border}`,background:C.cream,cursor:"pointer",fontFamily:"inherit",fontWeight:700,flexShrink:0}}>
            <MI n="refresh" size={14}/>
          </button>
        </div>
        {/* 필터 버튼 — 가로 스크롤 */}
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:2}}>
          <div style={{display:"flex",gap:4,whiteSpace:"nowrap",minWidth:"max-content"}}>
            {/* 담당자 필터 */}
            {[{n:"전체",c:C.inkMid},{n:"소리",c:"#f472b6"},{n:"영서",c:"#60a5fa"},{n:"경은",c:"#34d399"},{n:"지수",c:"#a78bfa"}].map(({n:a,c:col})=>{
              const active=assigneeFilter===a;
              return(
                <button key={a} onClick={()=>setAssigneeFilter(a)} style={{fontSize:10,padding:"4px 12px",borderRadius:20,
                  border:`1px solid ${active?col:C.border}`,background:active?col:C.cream,
                  color:active?C.white:C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700,whiteSpace:"nowrap"}}>
                  {a==="전체"?<><MI n="group" size={12}/> 전체</>:a}
                </button>
              );
            })}
            <div style={{width:1,background:C.border,margin:"0 4px",flexShrink:0}}/>
            {/* 완료 필터 */}
            {["미완료","전체"].map(f=>(
              <button key={f} onClick={()=>handleFilterChange(f)} style={{fontSize:10,padding:"4px 12px",borderRadius:20,
                border:`1px solid ${schFilter===f?C.rose:C.border}`,background:schFilter===f?C.rose:C.cream,
                color:schFilter===f?C.white:C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700,whiteSpace:"nowrap"}}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 달력 */}
      <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,overflow:"clip"}}>
        {/* 달력 헤더 */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",
          borderBottom:`1px solid ${C.border}`}}>
          <button onClick={()=>setCalMonth(p=>p.m===0?{y:p.y-1,m:11}:{y:p.y,m:p.m-1})}
            style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:C.inkMid,padding:"0 8px"}}>‹</button>
          <div style={{fontSize:16,fontWeight:900,color:C.ink}}>
            {calMonth.y}년 {months[calMonth.m]}
            <span style={{fontSize:10,fontWeight:600,color:C.inkLt,marginLeft:8}}>
              {activeItems.filter(s=>s.date&&s.date.startsWith(`${calMonth.y}-${String(calMonth.m+1).padStart(2,'0')}`)).length}개
            </span>
          </div>
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <button onClick={()=>setCalMonth({y:new Date().getFullYear(),m:new Date().getMonth()})}
              style={{fontSize:10,padding:"3px 10px",borderRadius:20,border:`1px solid ${C.border}`,
                background:C.cream,cursor:"pointer",fontFamily:"inherit",fontWeight:700,color:C.inkMid}}>오늘</button>
            <Btn small onClick={()=>{setSchModalData({mode:"add",initial:null})}}>+ 추가</Btn>
            <button onClick={()=>setCalMonth(p=>p.m===11?{y:p.y+1,m:0}:{y:p.y,m:p.m+1})}
              style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:C.inkMid,padding:"0 8px"}}>›</button>
          </div>
        </div>
        {/* 달력 본체 — 모바일 가로 스크롤 */}
        <div className="cal-scroll">
          <div className="cal-grid-wrap">
            {/* 요일 헤더 */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:`1px solid ${C.border}`}}>
              {days.map((d,i)=>(
                <div key={d} style={{padding:"6px 0",textAlign:"center",fontSize:10,fontWeight:700,
                  color:i===0?C.bad:i===6?"#3B82F6":C.inkLt}}>{d}</div>
              ))}
            </div>
            {/* 날짜 그리드 */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
              {Array.from({length:startDow}).map((_,i)=>(
                <div key={`e${i}`} className="cal-cell" style={{borderRight:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,background:C.cream}}/>
              ))}
              {Array.from({length:daysInMonth}).map((_,i)=>{
                const day=i+1;
                const dateKey=`${calMonth.y}-${String(calMonth.m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const items=itemsByDate[dateKey]||[];
                const isToday=dateKey===todayStr2;
                const isSel=dateKey===selDay;
                const col=(startDow+i)%7;
                return(
                  <div key={day} className="cal-cell"
                    onClick={()=>setSelDay(selDay===dateKey?null:dateKey)}
                    onDragOver={e=>{e.preventDefault();setDragOverDay(dateKey);}}
                    onDragLeave={()=>setDragOverDay(null)}
                    onDrop={e=>{e.preventDefault();handleDropOnDay(dateKey);}}
                    style={{padding:"6px 4px",borderRight:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,
                      cursor:"pointer",transition:"background 0.15s",
                      background:dragOverDay===dateKey?"#DBEAFE":isSel?"#EFF6FF":isToday?C.blush:C.white}}>
                    <div style={{fontSize:13,fontWeight:isToday?900:600,
                      width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
                      background:isToday?C.rose:isSel?"#DBEAFE":"transparent",
                      color:isToday?C.white:col===0?C.bad:col===6?"#3B82F6":C.ink,marginBottom:2,flexShrink:0}}>
                      {day}
                    </div>
                    {items.slice(0,8).map((s,j)=>{
                      const tc=schTypeColor(s.type);
                      const ac=s.assigneeColor||C.inkLt;
                      const isCont=s._spanPos==="mid"||s._spanPos==="end";
                      const isLast=!s._spanPos||s._spanPos==="end"||s._spanPos==="single";
                      const isFirst=!s._spanPos||s._spanPos==="start"||s._spanPos==="single";
                      const showTitle=isFirst||s._firstVisible||!!s._isChecklist;
                      const isHaengsa=s.type==="행사";
                      if(isHaengsa) return(
                        <div key={j}
                          onClick={e=>{e.stopPropagation();setSchModalData({mode:"edit",initial:{...s,notionId:s.id,note:s.memo}});}}
                          style={{fontSize:9,fontWeight:600,padding:"1px 4px",
                            borderRadius:isFirst&&isLast?3:isFirst?"3px 0 0 3px":isLast?"0 3px 3px 0":0,
                            background:`${tc}22`,color:showTitle?tc:`${tc}55`,
                            marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                            cursor:"pointer",borderLeft:isFirst?`2px solid ${tc}`:s._firstVisible?`2px dashed ${tc}`:"none",
                            marginLeft:isCont&&!s._firstVisible?"-4px":"0",
                            marginRight:!isLast?"-4px":"0"}}>
                          {showTitle?s.title.replace(/[(\[（][가-힣]{2,4}[)\]）]\s*/g,"").slice(0,10):"·"}
                        </div>
                      );
                      return(
                        <div key={j}
                          draggable={!s._isChecklist&&isFirst}
                          onDragStart={e=>{e.stopPropagation();dragRef.current=s;}}
                          onClick={e=>{e.stopPropagation();setSchModalData({mode:"edit",initial:{...s,notionId:s.id,note:s.memo}});}}
                          style={{fontSize:11,fontWeight:700,
                            padding:"2px 5px",
                            borderRadius:isFirst&&isLast?3:isFirst?"3px 0 0 3px":isLast?"0 3px 3px 0":0,
                            background:`${tc}${isCont?"33":"18"}`,
                            color:showTitle?tc:`${tc}66`,
                            marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                            cursor:isCont?"default":"grab",
                            borderLeft:isFirst?`2px solid ${ac}`:s._firstVisible?`2px dashed ${ac}`:"none",
                            marginLeft:isCont&&!s._firstVisible?"-4px":"0",
                            marginRight:!isLast?"-4px":"0",
                          }}>
                          {showTitle
                            ?(s.assignee?`(${s.assignee.slice(0,1)}) `:"")+s.title.replace(/[(\[（][가-힣]{2,4}[)\]）]\s*/g,"").slice(0,12)
                            :"·"}
                        </div>
                      );
                    })}
                    {items.length>8&&<div style={{fontSize:10,color:C.inkLt,fontWeight:700}}>+{items.length-8}개 더</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 선택된 날짜 상세 */}
      {selDay&&(
        <Card>
          <CardTitle title={<><MI n="assignment" size={14}/> {selDay} 일정</>} sub={`${selItems.length}개`}
            action={<Btn small onClick={()=>{setSchModalData({mode:"add",initial:{date:selDay}})}}>+ 추가</Btn>}/>
          {selItems.length===0&&<div style={{textAlign:"center",color:C.inkLt,fontSize:12,padding:"16px 0"}}>이날 일정 없음</div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {selItems.map(s=>{
              const tc=schTypeColor(s.type);
              if(s._isChecklist){
                // 반복 체크리스트 항목
                const ci=s._checkItem;
                const dCL=new Date(selDay+"T00:00:00");
                const dow3=dCL.getDay();
                const mondayD=dCL.getDate()-dow3+(dow3===0?-6:1);
                const monCL=new Date(dCL.getFullYear(),dCL.getMonth(),mondayD);
                let dkCL;
                if(ci.cycle==="daily") dkCL=ci.id+"_"+selDay;
                else if(ci.cycle==="weekly") dkCL=ci.id+"_"+`${monCL.getFullYear()}-${String(monCL.getMonth()+1).padStart(2,"0")}-W${String(Math.ceil(monCL.getDate()/7)).padStart(2,"0")}`;
                else dkCL=ci.id+"_"+selDay.slice(0,7);
                const isDone=(checkDone||{})[dkCL];
                return(
                  <div key={s.id} onClick={()=>setCheckDone(prev=>({...(prev||{}),[dkCL]:!isDone}))}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer",
                      borderRadius:10,border:`1px solid ${isDone?"#94a3b8":C.border}`,background:isDone?"#f8fafc":C.white}}>
                    <span style={{fontSize:10,fontWeight:700,color:"#94a3b8",background:"#94a3b818",padding:"2px 8px",borderRadius:20,whiteSpace:"nowrap",flexShrink:0}}>
                      <MI n="check_box" size={12}/> 반복
                    </span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:800,color:C.ink,textDecoration:isDone?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.title}</div>
                      {s.assignee&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:10,background:s.assigneeColor+"22",color:s.assigneeColor,fontWeight:700}}>{s.assignee}</span>}
                    </div>
                    <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${isDone?"#94a3b8":C.border}`,
                      background:isDone?"#94a3b8":"transparent",display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:13,color:"#fff",flexShrink:0}}>{isDone?"✓":""}</div>
                  </div>
                );
              }
              return(
                <div key={s.id} style={{borderRadius:10,border:`1px solid ${C.border}`,background:C.white,overflow:"hidden"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px"}}>
                    <span style={{fontSize:9,fontWeight:700,color:tc,background:`${tc}18`,padding:"1px 6px",borderRadius:20,whiteSpace:"nowrap",flexShrink:0}}>
                      <MI n={schTypeIcon(s.type)} size={10}/> {s.type}
                    </span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:800,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.title}</div>
                      <div style={{fontSize:10,color:C.inkLt,marginTop:1}}>
                        {s.endDate&&s.endDate!==s.date?`${s.date} ~ ${s.endDate}`:s.date}
                        {s.assignee&&<span style={{marginLeft:6,padding:"1px 6px",borderRadius:10,background:s.assigneeColor+"22",color:s.assigneeColor,fontWeight:700}}>{s.assignee}</span>}
                      </div>
                      {s.memo&&<div style={{fontSize:10,color:C.inkMid,marginTop:2}}><MI n="chat_bubble" size={11}/> {s.memo}</div>}
                    </div>
                    <div style={{display:"flex",gap:4,flexShrink:0}}>
                      <Btn variant="ghost" small onClick={()=>setMoveItemId(moveItemId===s.id?null:s.id)} title="날짜 이동"><MI n="calendar_month" size={13}/></Btn>
                      <Btn variant="ghost" small onClick={()=>setSchModalData({mode:"edit",initial:{...s,notionId:s.id,note:s.memo}})}><MI n="edit" size={13}/></Btn>
                      <Btn variant="sage" small onClick={()=>toggleNotionDone(s.id,true)}><MI n="check_circle" size={13}/></Btn>
                      <Btn variant="danger" small onClick={()=>deleteNotionSch(s.id)}><MI n="delete" size={13}/></Btn>
                    </div>
                  </div>
                  {moveItemId===s.id&&(
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px 10px",borderTop:`1px solid ${C.border}`,background:C.cream}}>
                      <MI n="arrow_forward" size={13} style={{color:C.inkMid}}/>
                      <span style={{fontSize:11,color:C.inkMid,flexShrink:0}}>이동할 날짜:</span>
                      <input type="date" defaultValue={s.date} id={`mv_${s.id}`}
                        style={{fontSize:11,padding:"3px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontFamily:"inherit",outline:"none"}}/>
                      <Btn small onClick={async()=>{
                        const el=document.getElementById(`mv_${s.id}`);
                        if(!el||!el.value) return;
                        const newDate=el.value;
                        if(newDate===s.date){setMoveItemId(null);return;}
                        const delta=new Date(newDate+"T00:00:00")-new Date(s.date+"T00:00:00");
                        const newEnd=s.endDate?(()=>{const e=new Date(s.endDate+"T00:00:00");e.setTime(e.getTime()+delta);return toLocalKey(e);})():null;
                        setNotionSch(prev=>prev.map(x=>x.id===s.id?{...x,date:newDate,endDate:newEnd}:x));
                        setSelDay(newDate);
                        setMoveItemId(null);
                        await fetch("/api/notion",{method:"POST",headers:{"Content-Type":"application/json"},
                          body:JSON.stringify({action:"update",pageId:s.id,data:{date:newDate,endDate:newEnd}})});
                      }}>이동</Btn>
                      <Btn variant="ghost" small onClick={()=>setMoveItemId(null)}>취소</Btn>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── 반복 체크리스트 ── */}
      {(()=>{
        const CYCLE_LABELS={daily:"매일",weekly:"매주",monthly:"매월"};
        const CYCLE_COLORS={daily:{bg:"#eff6ff",border:"#93c5fd",text:"#1d4ed8"},weekly:{bg:"#f5f3ff",border:"#c4b5fd",text:"#6d28d9"},monthly:{bg:"#fff7ed",border:"#fdba74",text:"#c2410c"}};
        const DOW_LABELS=["일","월","화","수","목","금","토"];
        const todayCL=new Date();
        const todayStrCL=`${todayCL.getFullYear()}-${String(todayCL.getMonth()+1).padStart(2,"0")}-${String(todayCL.getDate()).padStart(2,"0")}`;
        const dow=todayCL.getDay();
        const mondayDiff=todayCL.getDate()-dow+(dow===0?-6:1);
        const monday=new Date(todayCL.getFullYear(),todayCL.getMonth(),mondayDiff);
        const weekStrCL=`${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,"0")}-W${String(Math.ceil(monday.getDate()/7)).padStart(2,"0")}`;
        const monthStrCL=`${todayCL.getFullYear()}-${String(todayCL.getMonth()+1).padStart(2,"0")}`;

        function doneKeyCL(item){
          if(item.cycle==="daily") return item.id+"_"+todayStrCL;
          if(item.cycle==="weekly") return item.id+"_"+weekStrCL;
          return item.id+"_"+monthStrCL;
        }

        function cycleSub(item){
          if(item.cycle==="daily") return "매일";
          if(item.cycle==="weekly") return `매주 ${DOW_LABELS[item.weekDay??1]}요일`;
          return `매월 ${item.monthDay??1}일`;
        }

        function saveClItem(){
          if(!clForm.title.trim()){alert("항목명을 입력해주세요");return;}
          setCheckItems(prev=>[...(prev||[]),{
            id:Date.now()+"_"+Math.random().toString(36).slice(2),
            title:clForm.title.trim(),cycle:clForm.cycle,
            weekDay:clForm.weekDay,monthDay:clForm.monthDay,
            assignee:clForm.assignee,createdAt:todayStrCL
          }]);
          setClForm({title:"",cycle:"weekly",weekDay:1,monthDay:1,assignee:""});
          setClModal(false);
        }

        // 오늘 표시할 체크리스트
        const todayItems=(checkItems||[]).filter(i=>{
          if(i.cycle==="daily") return true;
          if(i.cycle==="weekly") return dow===(i.weekDay??1);
          if(i.cycle==="monthly") return todayCL.getDate()===(i.monthDay??1);
          return false;
        });
        const totalToday=todayItems.length;
        const doneToday=todayItems.filter(i=>(checkDone||{})[doneKeyCL(i)]).length;
        const inputS={width:"100%",fontSize:12,padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};

        return(<>
        <Card>
          <CardTitle title={<><MI n="check_box" size={14}/> 반복 체크리스트</>}
            sub={totalToday>0?`오늘 ${doneToday}/${totalToday} 완료`:`전체 ${(checkItems||[]).length}개`}
            action={<Btn small onClick={()=>{setClForm({title:"",cycle:"weekly",weekDay:1,monthDay:1,assignee:""});setClModal(true);}}>+ 추가</Btn>}/>

          {/* 오늘 할 항목 */}
          {totalToday>0&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:6}}>
                오늘 할 항목
                <span style={{marginLeft:8,fontSize:10,color:doneToday===totalToday?"#4DAD7A":C.inkLt}}>
                  {doneToday===totalToday?<><MI n="celebration" size={12}/> 모두 완료!</>:`${doneToday}/${totalToday}`}
                </span>
              </div>
              <div style={{height:5,borderRadius:3,background:C.cream,overflow:"hidden",marginBottom:8}}>
                <div style={{height:"100%",borderRadius:3,background:"#4DAD7A",width:`${totalToday>0?Math.round(doneToday/totalToday*100):0}%`,transition:"width 0.3s"}}/>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {todayItems.map(item=>{
                  const done=(checkDone||{})[doneKeyCL(item)];
                  const cc=CYCLE_COLORS[item.cycle];
                  return(
                  <div key={item.id} onClick={()=>{const k=doneKeyCL(item);setCheckDone(prev=>({...(prev||{}),[k]:!(prev||{})[k]}));}}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,cursor:"pointer",
                      border:`1px solid ${done?cc.border:C.border}`,background:done?cc.bg:C.white,transition:"all 0.15s"}}>
                    <div style={{width:18,height:18,borderRadius:5,flexShrink:0,border:`2px solid ${done?cc.border:C.border}`,
                      background:done?cc.border:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff"}}>
                      {done?"✓":""}
                    </div>
                    <div style={{flex:1}}>
                      <span style={{fontSize:12,fontWeight:700,color:C.ink,textDecoration:done?"line-through":"none"}}>{item.title}</span>
                      {item.assignee&&<span style={{fontSize:10,color:C.inkMid,marginLeft:6}}><MI n="person" size={12}/> {item.assignee}</span>}
                    </div>
                    <span style={{fontSize:9,fontWeight:700,color:cc.text,background:cc.bg,padding:"2px 7px",borderRadius:10,flexShrink:0}}>{cycleSub(item)}</span>
                    <button onClick={e=>{e.stopPropagation();setCheckItems(prev=>(prev||[]).filter(i=>i.id!==item.id));}}
                      style={{fontSize:11,color:C.inkLt,background:"none",border:"none",cursor:"pointer",padding:"2px 4px"}}><MI n="delete" size={13}/></button>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 전체 목록 */}
          {(checkItems||[]).length>0&&(
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.inkLt,marginBottom:6}}>전체 반복 항목</div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {(checkItems||[]).map(item=>{
                  const cc=CYCLE_COLORS[item.cycle]||CYCLE_COLORS.daily;
                  return(
                  <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:C.cream}}>
                    <span style={{fontSize:9,fontWeight:700,color:cc.text,background:cc.bg,padding:"1px 7px",borderRadius:10,flexShrink:0,whiteSpace:"nowrap"}}>{cycleSub(item)}</span>
                    <span style={{flex:1,fontSize:11,fontWeight:700,color:C.ink}}>{item.title}</span>
                    {item.assignee&&<span style={{fontSize:10,color:C.inkMid}}><MI n="person" size={12}/> {item.assignee}</span>}
                    <button onClick={()=>setCheckItems(prev=>(prev||[]).filter(i=>i.id!==item.id))}
                      style={{fontSize:11,color:C.inkLt,background:"none",border:"none",cursor:"pointer",padding:"2px 4px"}}><MI n="delete" size={13}/></button>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {(checkItems||[]).length===0&&(
            <div style={{textAlign:"center",color:C.inkLt,fontSize:12,padding:"20px 0"}}>+ 추가 버튼으로 반복 업무를 등록해보세요</div>
          )}
        </Card>

        {/* 추가 모달 */}
        {clModal&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
            <div style={{background:C.white,borderRadius:20,padding:24,width:"100%",maxWidth:380}}>
              <div style={{fontSize:16,fontWeight:900,marginBottom:16}}>반복 항목 추가</div>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>항목명 *</div>
                  <input value={clForm.title} onChange={e=>setClForm(p=>({...p,title:e.target.value}))} placeholder="예: 메타 성과 확인" style={inputS}/>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>주기</div>
                  <div style={{display:"flex",gap:6}}>
                    {[["daily","매일"],["weekly","매주"],["monthly","매월"]].map(([k,l])=>{
                      const cc=CYCLE_COLORS[k];
                      return <button key={k} onClick={()=>setClForm(p=>({...p,cycle:k}))} style={{flex:1,fontSize:11,padding:"7px 0",borderRadius:10,
                        border:`1px solid ${clForm.cycle===k?cc.border:C.border}`,background:clForm.cycle===k?cc.bg:C.white,
                        color:clForm.cycle===k?cc.text:C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{l}</button>;
                    })}
                  </div>
                </div>
                {clForm.cycle==="weekly"&&(
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>요일</div>
                    <div style={{display:"flex",gap:4}}>
                      {["일","월","화","수","목","금","토"].map((d,i)=>(
                        <button key={i} onClick={()=>setClForm(p=>({...p,weekDay:i}))} style={{flex:1,fontSize:11,padding:"6px 0",borderRadius:8,
                          border:`1px solid ${clForm.weekDay===i?"#c4b5fd":C.border}`,background:clForm.weekDay===i?"#f5f3ff":C.white,
                          color:clForm.weekDay===i?"#6d28d9":C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{d}</button>
                      ))}
                    </div>
                  </div>
                )}
                {clForm.cycle==="monthly"&&(
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>날짜</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {Array.from({length:31},(_,i)=>i+1).map(d=>(
                        <button key={d} onClick={()=>setClForm(p=>({...p,monthDay:d}))} style={{width:32,height:32,fontSize:11,borderRadius:8,
                          border:`1px solid ${clForm.monthDay===d?"#fdba74":C.border}`,background:clForm.monthDay===d?"#fff7ed":C.white,
                          color:clForm.monthDay===d?"#c2410c":C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{d}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>담당자</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {["","소리","영서","경은","지수"].map(m=>(
                      <button key={m} onClick={()=>setClForm(p=>({...p,assignee:m}))} style={{fontSize:11,padding:"4px 12px",borderRadius:20,
                        border:`1px solid ${clForm.assignee===m?C.rose:C.border}`,background:clForm.assignee===m?C.rose:C.white,
                        color:clForm.assignee===m?C.white:C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{m||"미지정"}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:16}}>
                <Btn onClick={saveClItem} style={{flex:1}}>추가</Btn>
                <Btn variant="ghost" onClick={()=>setClModal(false)} style={{flex:1}}>취소</Btn>
              </div>
            </div>
          </div>
        )}
        </>);
      })()}
    </div>
    );
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🎨 소재 라이브러리 & 재제작 요청
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const CreativeSection=(()=>{
    const [tab, setTab] = useState("library"); // library | requests
    const [libModal, setLibModal] = useState(null); // null | {mode:"add"|"edit", item}
    const [libForm, setLibForm] = useState({name:"",link:"",figmaUrl:"",product:"",note:"",tags:""});
    const [libSearch, setLibSearch] = useState("");
    const [reqFigmaId, setReqFigmaId] = useState(null);
    const [reqNote, setReqNote] = useState("");
    const [reqAssignee, setReqAssignee] = useState("");
    const [reqPopover, setReqPopover] = useState(null); // ad object being requested
    const [crFilter, setCrFilter] = useState("전체"); // 전체 | 우수 | 전환 | 트래픽
    const [crSort, setCrSort] = useState("점수");
    const [hiddenAds, setHiddenAds] = useSyncState("oa_hidden_ads_v1", []);

    // 메타 데이터 소재별 집계 (전체 누적 + 시트 병합)
    const _galleryRows = [
      ...allAdRaw.filter(r=>!isInstaPost(r)),
      ...metaFiltered,
    ];
    const adByName = {};
    _galleryRows.forEach(r=>{
      const n = r.adName||"(미입력)";
      if(!adByName[n]) adByName[n]={adName:n,spend:0,impressions:0,clicks:0,purchases:0,convValue:0,lpv:0,ctr:0,cpc:0,_rows:0,campaign:"",objective:"",adset:""};
      const d=adByName[n];
      d.spend+=r.spend||0; d.impressions+=r.impressions||0; d.clicks+=r.clicks||0;
      d.purchases+=r.purchases||0; d.convValue+=r.convValue||0; d.lpv+=r.lpv||0;
      d._rows++;
      if(!d.campaign && r.campaign) d.campaign = r.campaign;
      if(!d.objective && r.objective) d.objective = r.objective;
      if(!d.adset && r.adset) d.adset = r.adset;
    });
    const adList = Object.values(adByName).map(d=>({
      ...d,
      ctr:     d.impressions>0?(d.clicks/d.impressions*100):0,
      cpc:     d.clicks>0?(d.spend/d.clicks):0,
      roas:    d.spend>0?(d.convValue/d.spend*100):0,
      lpvRate: d.clicks>0?(d.lpv/d.clicks*100):0,
    })).filter(d=>d.spend>0).map(d=>{
      const score = Math.min(d.ctr/3,1)*40 + Math.min(d.roas/300,1)*40 + Math.min(d.spend/300000,1)*20;
      return {...d, _score: score};
    }).sort((a,b)=>b._score-a._score);

    // MetaSection과 동일한 기준으로 "잘 나온 소재" 판정
    function adQuality(ad) {
      try {
        const isConv = isConversionCampaign(ad.objective, ad.campaign);
        if (isConv) {
          const adMargin = getAdMargin(ad.adName||"", ad.campaign||"", margins||[], margin||30000);
          const crit = getConvCriteria(ad.adName||"", ad.campaign||"", convCriteria||{});
          const cpa  = cpaStatus(ad.spend||0, ad.purchases||0, adMargin, crit);
          const lpvR = lpvRateStatus(ad.clicks||0, ad.lpv||0, crit);
          return (cpa?.label==="유지") && (lpvR?.label==="정상") ? "good" : "normal";
        } else {
          const crit = trafficCriteria||{};
          const cpcOk = (ad.cpc||0)>0 && (ad.cpc||0) <= getTrafficCpcMax(ad.adName||"", ad.campaign||"", crit);
          const ctrOk = (ad.ctr||0) >= (crit.ctrMin||1);
          const lpvOk = (ad.lpvRate||0) >= (crit.lpvMin||50);
          return cpcOk && ctrOk && lpvOk ? "good" : "normal";
        }
      } catch(e) {
        return "normal";
      }
    }

    const libNames = new Set((creativeLib||[]).map(i=>i.name));

    // 광고명으로 업로드된 이미지 매칭 (공백·언더스코어·특수문자 정규화)
    function findThumb(adName) {
      if (!adName || !adImages?.length) return "";
      const norm = s => s.toLowerCase().replace(/[\s_\-\.]+/g, "");
      const normAd = norm(adName);
      // 1순위: 정규화 후 포함 관계
      const img = adImages.find(img => {
        if (!img.name) return false;
        const normImg = norm(img.name);
        return normAd.includes(normImg) || normImg.includes(normAd);
      });
      return img?.url || "";
    }

    function saveGoodAds() {
      const goodAds = adList.filter(ad => adQuality(ad) !== "normal" && !libNames.has(ad.adName));
      if (goodAds.length === 0) { alert("새로 저장할 소재가 없어요 (이미 모두 저장됐거나 기준 미달)"); return; }
      const now = new Date().toISOString().slice(0,10);
      const newItems = goodAds.map(ad => ({
        id: Date.now() + "_" + Math.random().toString(36).slice(2),
        name: ad.adName,
        link: "",
        product: "",
        thumbUrl: findThumb(ad.adName),
        campaignType: isConversionCampaign(ad.objective, ad.campaign) ? "전환" : "트래픽",
        note: `CTR ${ad.ctr.toFixed(2)}% · ROAS ${ad.roas.toFixed(0)}% · 소진 ${Math.round(ad.spend).toLocaleString()}원`,
        tags: "잘나온소재",
        addedAt: now,
      }));
      setCreativeLib(prev => [...newItems, ...(prev||[])]);
      const withThumb = newItems.filter(i=>i.thumbUrl).length;
      alert(`✅ ${newItems.length}개 소재 저장 완료!\n${withThumb > 0 ? `🖼 ${withThumb}개에 썸네일 자동 연결됨` : "썸네일 없음 (이미지 업로드 필요)"}`);
      setTab("library");
    }

    const topAds = adList
      .filter(ad=>{
        if(crFilter==="우수") return adQuality(ad)==="good";
        if(crFilter==="전환") return isConversionCampaign(ad.objective,ad.campaign,ad.resultType);
        if(crFilter==="트래픽") return !isConversionCampaign(ad.objective,ad.campaign,ad.resultType);
        return true;
      })
      .sort((a,b)=>{
        if(crSort==="CTR") return b.ctr-a.ctr;
        if(crSort==="ROAS") return b.roas-a.roas;
        if(crSort==="소진") return b.spend-a.spend;
        return b._score-a._score; // 점수 (기본)
      });

    function requestRecreate(ad) {
      const req = {
        id: Date.now()+"", adName:ad.adName,
        adset: ad.adset||"",
        campaign: ad.campaign||"",
        ctr: ad.ctr.toFixed(2), roas: ad.roas.toFixed(0), spend: ad.spend,
        thumbUrl: findThumb(ad.adName)||"",
        note: reqNote, assignee: reqAssignee, status:"pending",
        requestedAt: new Date().toISOString().slice(0,10),
      };
      setRecreateReqs(prev=>[req,...(prev||[])]);
      setReqNote("");
      setReqAssignee("");
      setReqPopover(null);
    }

    function resolveReq(id) {
      setRecreateReqs(prev=>(prev||[]).map(r=>r.id===id?{...r,status:"done"}:r));
    }

    function deleteReq(id) {
      setRecreateReqs(prev=>(prev||[]).filter(r=>r.id!==id));
    }

    function addToLib(form) {
      if (libModal?.mode==="edit" && libModal?.item) {
        setCreativeLib(prev=>prev.map(i=>i.id===libModal.item.id?{...i,...form}:i));
      } else {
        setCreativeLib(prev=>[{id:Date.now()+"_"+Math.random().toString(36).slice(2),...form,addedAt:new Date().toISOString().slice(0,10)},...(prev||[])]);
      }
      setLibModal(null);
    }

    function removeFromLib(id) {
      setCreativeLib(prev=>(prev||[]).filter(i=>i.id!==id));
    }

    const pendingReqs = (recreateReqs||[]).filter(r=>r.status==="pending");
    const doneReqs    = (recreateReqs||[]).filter(r=>r.status==="done");

    const reqPopoverAd = reqPopover ? adList.find(a=>a.adName===reqPopover) : null;

    return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* 재제작 요청 모달 */}
      {reqPopoverAd&&(
        <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>setReqPopover(null)}>
          <div style={{background:C.white,borderRadius:14,padding:20,width:280,boxShadow:"0 8px 32px rgba(0,0,0,0.18)"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:13,fontWeight:800,color:C.ink,marginBottom:4}}>재제작 요청</div>
            <div style={{fontSize:11,color:C.inkMid,marginBottom:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{reqPopoverAd.adName}</div>
            <div style={{fontSize:11,fontWeight:700,color:C.inkMid,marginBottom:6}}>담당자</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
              {["","소리","영서","경은","지수"].map(a=>(
                <span key={a} onClick={()=>setReqAssignee(a)}
                  style={{fontSize:11,padding:"4px 12px",borderRadius:20,cursor:"pointer",fontWeight:700,
                    background:reqAssignee===a?"#8b5cf6":"#f5f3ff",
                    color:reqAssignee===a?"#fff":"#8b5cf6",
                    border:`1px solid ${reqAssignee===a?"#8b5cf6":"#8b5cf644"}`}}>
                  {a||"전체"}
                </span>
              ))}
            </div>
            <input value={reqNote} onChange={e=>setReqNote(e.target.value)}
              placeholder="메모 (선택)"
              style={{width:"100%",fontSize:11,padding:"7px 10px",borderRadius:8,
                border:`1px solid ${C.border}`,fontFamily:"inherit",outline:"none",marginBottom:12,boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setReqPopover(null)}
                style={{flex:1,fontSize:11,fontWeight:700,padding:"8px 0",borderRadius:8,
                  background:C.cream,color:C.inkMid,border:`1px solid ${C.border}`,cursor:"pointer",fontFamily:"inherit"}}>
                취소
              </button>
              <button onClick={()=>{requestRecreate(reqPopoverAd);setTab("requests");}}
                style={{flex:2,fontSize:11,fontWeight:700,padding:"8px 0",borderRadius:8,
                  background:"#8b5cf6",color:"#fff",border:"none",cursor:"pointer",fontFamily:"inherit"}}>
                요청 보내기
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 탭 */}
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {[{k:"library",label:<><MI n="grid_view" size={12}/> 소재 갤러리</>},{k:"requests",label:<><MI n="palette" size={12}/> 재제작 요청 ({pendingReqs.length})</>}].map(({k,label})=>(
          <button key={k} onClick={()=>setTab(k)} style={{fontSize:11,padding:"6px 14px",borderRadius:20,whiteSpace:"nowrap",
            border:`1px solid ${tab===k?C.rose:C.border}`,background:tab===k?C.rose:C.white,
            color:tab===k?C.white:C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
            {label}
          </button>
        ))}
      </div>


      {/* 라이브러리 — 소재 갤러리 */}
      {tab==="library"&&(
        <Card>
          {/* 헤더 */}
          <CardTitle title={<><MI n="grid_view" size={14}/> 소재 갤러리</>}
            sub={adList.length>0?`${adList.length-(hiddenAds||[]).length}개 소재${(hiddenAds||[]).length>0?` (${(hiddenAds||[]).length}개 숨김)`:""}`:(creativeLib||[]).length>0?`저장 ${(creativeLib||[]).length}개`:"소재 없음"}
            action={
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <input value={libSearch} onChange={e=>setLibSearch(e.target.value)} placeholder="검색..."
                  style={{width:90,padding:"4px 8px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:11,fontFamily:"inherit",outline:"none",background:C.cream}}/>
                {(hiddenAds||[]).length>0&&<Btn small onClick={()=>setHiddenAds([])}>숨김 복원</Btn>}
                {(creativeLib||[]).length>0&&<Btn small onClick={()=>{
                  const headers=["이름","제품","유형","태그","메모","링크","Figma","저장일"];
                  const rows=(creativeLib||[]).map(i=>[i.name,i.product,i.campaignType,i.tags,i.note,i.link,i.figmaUrl,i.addedAt].map(v=>`"${(v||"").replace(/"/g,'""')}"`).join(","));
                  const csv=[headers.join(","),...rows].join("\n");
                  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));a.download="소재라이브러리.csv";a.click();
                }}>CSV</Btn>}
                <Btn small onClick={()=>{setLibForm({name:"",link:"",figmaUrl:"",product:"",note:"",tags:""});setLibModal({mode:"add"});}}>+ 추가</Btn>
              </div>
            }/>

          {/* 필터 */}
          <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>
            {["전체","잘나온","전환","트래픽"].map(f=>(
              <button key={f} onClick={()=>setCrFilter(f)} style={{fontSize:10,padding:"3px 10px",borderRadius:20,
                border:`1px solid ${crFilter===f?"#4DAD7A":C.border}`,
                background:crFilter===f?"#4DAD7A":C.cream,
                color:crFilter===f?C.white:C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
                {f}
              </button>
            ))}
          </div>

          {/* 메타 CSV 소재 갤러리 */}
          {adList.length>0&&(()=>{
            const hiddenSet = new Set(hiddenAds||[]);
            const galleryItems = adList.filter(ad=>{
              if(hiddenSet.has(ad.adName)) return false;
              const q = adQuality(ad);
              const isConv = isConversionCampaign(ad.objective, ad.campaign);
              if(crFilter==="잘나온" && q!=="good") return false;
              if(crFilter==="전환" && !isConv) return false;
              if(crFilter==="트래픽" && isConv) return false;
              if(libSearch && !ad.adName.toLowerCase().includes(libSearch.toLowerCase())) return false;
              return true;
            });
            return(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginBottom:16}}>
                {galleryItems.map(ad=>{
                  const thumb = findThumb(ad.adName);
                  const matchedImg = adImages?.find(img=>img.name&&ad.adName&&(ad.adName.includes(img.name)||img.name.includes(ad.adName)));
                  const quality = adQuality(ad);
                  const isConv = isConversionCampaign(ad.objective, ad.campaign);
                  const savedItem = (creativeLib||[]).find(i=>i.name===ad.adName);
                  const autoFm = !savedItem?.figmaUrl ? matchFigmaFrame(ad.adName) : null;
                  const figmaUrl = savedItem?.figmaUrl || (autoFm ? figmaLink(autoFm.nodeId) : null);
                  const figmaIsAuto = !savedItem?.figmaUrl && !!autoFm;
                  return(
                    <div key={ad.adName} style={{
                      borderRadius:10,overflow:"hidden",
                      border:quality==="good"?`1.5px solid #4DAD7A66`:`1px solid ${C.border}`,
                      background:quality==="good"?"#f0fdf4":C.white,
                      boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
                    }}>
                      {/* 썸네일 */}
                      <div style={{width:"100%",height:110,background:C.cream,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
                        {thumb
                          ? <ThumbPreview url={thumb} name={ad.adName}/>
                          : <MI n="image" size={32} style={{opacity:0.18}}/>
                        }
                        {/* 뱃지 오버레이 */}
                        <div style={{position:"absolute",top:5,left:5,display:"flex",gap:3,flexWrap:"wrap"}}>
                          {quality==="good"&&<span style={{fontSize:8,fontWeight:800,padding:"1px 5px",borderRadius:6,background:"#4DAD7A",color:"#fff"}}>✓잘나옴</span>}
                          <span style={{fontSize:8,fontWeight:700,padding:"1px 5px",borderRadius:6,
                            background:isConv?"#8b5cf6":"#60a5fa",color:"#fff"}}>
                            {isConv?"전환":"트래픽"}
                          </span>
                        </div>
                        {figmaUrl&&(
                          <a href={figmaUrl} target="_blank" rel="noreferrer"
                            title={figmaIsAuto?`자동 매칭: ${autoFm.name}`:"Figma"}
                            style={{position:"absolute",bottom:5,right:5,display:"flex",alignItems:"center",gap:2,padding:"2px 4px",borderRadius:5,background:"rgba(255,255,255,0.9)",border:"none",textDecoration:"none"}}>
                            <svg width="10" height="10" viewBox="0 0 38 57" fill="none"><path d="M10 28.5a9.5 9.5 0 0 1 9.5-9.5h9.5v19H19.5A9.5 9.5 0 0 1 10 28.5Z" fill="#1ABCFE"/><path d="M1 47.5A9.5 9.5 0 0 1 10.5 38H20v9.5a9.5 9.5 0 0 1-19 0Z" fill="#0ACF83"/><path d="M20 1v19h9.5a9.5 9.5 0 0 0 0-19H20Z" fill="#FF7262"/><path d="M1 9.5A9.5 9.5 0 0 0 10.5 19H20V1H10.5A9.5 9.5 0 0 0 1 9.5Z" fill="#F24E1E"/><path d="M1 28.5A9.5 9.5 0 0 0 10.5 38H20V19H10.5A9.5 9.5 0 0 0 1 28.5Z" fill="#A259FF"/></svg>
                            {figmaIsAuto&&<span style={{fontSize:7,color:"#0d7fa8",fontWeight:700}}>자동</span>}
                          </a>
                        )}
                      </div>
                      {/* 텍스트 */}
                      <div style={{padding:"6px 7px"}}>
                        <div style={{fontSize:9,fontWeight:800,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:3}} title={ad.adName}>{ad.adName}</div>
                        <div style={{fontSize:8,color:C.inkMid,lineHeight:1.6}}>
                          <span>CTR {ad.ctr.toFixed(1)}%</span>
                          <span style={{marginLeft:5}}>{isConv?`ROAS ${ad.roas.toFixed(0)}%`:`CPC ₩${Math.round(ad.cpc).toLocaleString()}`}</span>
                        </div>
                        <div style={{fontSize:8,color:C.inkLt}}>₩{ad.spend>=10000?`${Math.round(ad.spend/10000)}만`:`${Math.round(ad.spend).toLocaleString()}`} · 점수 {Math.round(ad._score)}</div>
                        {/* 버튼 */}
                        <div style={{display:"flex",gap:4,marginTop:5}}>
                          {!figmaUrl&&(
                            <button onClick={()=>{setLibForm({name:ad.adName,link:"",figmaUrl:"",product:"",note:`CTR ${ad.ctr.toFixed(1)}% · ${isConv?`ROAS ${ad.roas.toFixed(0)}%`:`CPC ${Math.round(ad.cpc)}`}`,tags:quality==="good"?"잘나온소재":""});setLibModal({mode:"add"});}}
                              style={{fontSize:8,padding:"2px 6px",borderRadius:5,border:`1px dashed ${C.border}`,background:"none",color:C.inkLt,cursor:"pointer",fontFamily:"inherit"}}>
                              +Figma
                            </button>
                          )}
                          <button onClick={()=>setReqPopover(reqPopover===ad.adName?null:ad.adName)}
                            style={{fontSize:8,padding:"2px 6px",borderRadius:5,border:`1px solid #8b5cf644`,
                              background:"#f5f3ff",color:"#8b5cf6",cursor:"pointer",fontFamily:"inherit",flex:1,fontWeight:700}}>
                            재제작
                          </button>
                          <button onClick={()=>setHiddenAds(prev=>[...(prev||[]),ad.adName])}
                            style={{fontSize:8,padding:"2px 6px",borderRadius:5,border:`1px solid ${C.bad}44`,
                              background:"none",color:C.bad,cursor:"pointer",fontFamily:"inherit"}}>
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* 메타 데이터 없으면 안내 */}
          {adList.length===0&&(creativeLib||[]).length===0&&(
            <div style={{textAlign:"center",color:C.inkLt,fontSize:12,padding:"32px 0"}}>
              메타광고 탭에서 파일 업로드 후 소재가 표시돼요
            </div>
          )}
          {/* 저장된 라이브러리 항목 (항상 표시) */}
          {(creativeLib||[]).length>0&&(
            <div style={{marginTop:adList.length>0?12:0}}>
              {adList.length>0&&<div style={{fontSize:10,fontWeight:700,color:C.inkLt,marginBottom:8,paddingTop:8,borderTop:`1px dashed ${C.border}`}}>저장된 소재 라이브러리</div>}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {(creativeLib||[]).filter(item=>!libSearch||item.name?.toLowerCase().includes(libSearch.toLowerCase())).map(item=>{
                const t = findThumb(item.name) || item.thumbUrl;
                const isGood = item.tags?.includes("잘나온소재");
                return(
                <div key={item.id} style={{padding:"8px 10px",borderRadius:8,border:isGood?`1px solid #4DAD7A55`:`1px solid ${C.border}`,background:isGood?"#f0fdf4":C.white}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {t?<div style={{flexShrink:0,width:40,height:40,borderRadius:6,overflow:"hidden",border:`1px solid ${C.border}`}}><ThumbPreview url={t} name={item.name}/></div>
                     :<div style={{flexShrink:0,width:40,height:40,borderRadius:6,border:`1px dashed ${C.border}`,background:C.cream,display:"flex",alignItems:"center",justifyContent:"center",color:C.inkLt}}><MI n="image" size={16}/></div>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:800,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                      <div style={{fontSize:9,color:C.inkMid,marginTop:1}}>{item.note}</div>
                    </div>
                    <div style={{display:"flex",gap:4}}>
                      {item.figmaUrl&&<a href={item.figmaUrl} target="_blank" rel="noreferrer" style={{display:"flex",padding:"3px 5px",borderRadius:5,background:"#1ABCFE22",border:"1px solid #1ABCFE55",textDecoration:"none"}}><svg width="10" height="10" viewBox="0 0 38 57" fill="none"><path d="M10 28.5a9.5 9.5 0 0 1 9.5-9.5h9.5v19H19.5A9.5 9.5 0 0 1 10 28.5Z" fill="#1ABCFE"/><path d="M1 47.5A9.5 9.5 0 0 1 10.5 38H20v9.5a9.5 9.5 0 0 1-19 0Z" fill="#0ACF83"/><path d="M20 1v19h9.5a9.5 9.5 0 0 0 0-19H20Z" fill="#FF7262"/><path d="M1 9.5A9.5 9.5 0 0 0 10.5 19H20V1H10.5A9.5 9.5 0 0 0 1 9.5Z" fill="#F24E1E"/><path d="M1 28.5A9.5 9.5 0 0 0 10.5 38H20V19H10.5A9.5 9.5 0 0 0 1 28.5Z" fill="#A259FF"/></svg></a>}
                      <Btn variant="ghost" small onClick={()=>{setLibForm({name:item.name,link:item.link||"",figmaUrl:item.figmaUrl||"",product:item.product||"",note:item.note||"",tags:item.tags||""});setLibModal({mode:"edit",item});}}><MI n="edit" size={12}/></Btn>
                      <Btn variant="danger" small onClick={()=>removeFromLib(item.id)}><MI n="delete" size={12}/></Btn>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
            </div>
          )}
        </Card>
      )}

      {/* 재제작 요청 */}
      {tab==="requests"&&(
        <Card>
          <CardTitle title={<><MI n="palette" size={14}/> 재제작 요청</>} sub={`대기 ${pendingReqs.length}건 · 완료 ${doneReqs.length}건`}/>
          {pendingReqs.length===0&&doneReqs.length===0&&(
            <div style={{textAlign:"center",color:C.inkLt,fontSize:12,padding:"20px 0"}}>
              소재 갤러리에서 재제작 요청을 보내보세요
            </div>
          )}
          {pendingReqs.length>0&&(
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:700,color:C.inkLt,marginBottom:6}}>대기 중</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {pendingReqs.map(r=>(
                  <div key={r.id} style={{borderRadius:10,border:`1px solid #8b5cf644`,background:"#f5f3ff",overflow:"hidden"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px"}}>
                      {(()=>{const t=r.thumbUrl||findThumb(r.adName);return t?(
                        <div style={{width:56,height:56,borderRadius:8,overflow:"hidden",flexShrink:0,
                          border:`1px solid #8b5cf633`,background:C.cream}}>
                          <ThumbPreview url={t} name={r.adName}/>
                        </div>
                      ):null;})()}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:800,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.adName}</div>
                        {r.adset&&<div style={{fontSize:10,color:"#8b5cf6",marginTop:1}}><MI n="folder_open" size={11}/> {r.adset}</div>}
                        {r.campaign&&<div style={{fontSize:10,color:C.inkMid,marginTop:1}}><MI n="campaign" size={11}/> {r.campaign}</div>}
                        <div style={{fontSize:10,color:C.inkMid,marginTop:2,display:"flex",alignItems:"center",gap:6}}>
                          <span>CTR {r.ctr}% · ROAS {r.roas}% · {r.requestedAt}</span>
                          {r.assignee&&<span style={{padding:"1px 7px",borderRadius:20,background:"#8b5cf622",color:"#8b5cf6",fontWeight:700,fontSize:10}}>{r.assignee}</span>}
                        </div>
                        {r.note&&<div style={{fontSize:10,color:C.inkMid,marginTop:2}}><MI n="chat_bubble" size={11}/> {r.note}</div>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0,alignItems:"flex-end"}}>
                        {(()=>{
                          const autoFm = !r.figmaUrl ? matchFigmaFrame(r.adName) : null;
                          const href = r.figmaUrl || (autoFm ? figmaLink(autoFm.nodeId) : null);
                          const isAuto = !r.figmaUrl && !!autoFm;
                          const FigSVG = ()=><svg width="11" height="11" viewBox="0 0 38 57" fill="none"><path d="M10 28.5a9.5 9.5 0 0 1 9.5-9.5h9.5v19H19.5A9.5 9.5 0 0 1 10 28.5Z" fill="#1ABCFE"/><path d="M1 47.5A9.5 9.5 0 0 1 10.5 38H20v9.5a9.5 9.5 0 0 1-19 0Z" fill="#0ACF83"/><path d="M20 1v19h9.5a9.5 9.5 0 0 0 0-19H20Z" fill="#FF7262"/><path d="M1 9.5A9.5 9.5 0 0 0 10.5 19H20V1H10.5A9.5 9.5 0 0 0 1 9.5Z" fill="#F24E1E"/><path d="M1 28.5A9.5 9.5 0 0 0 10.5 38H20V19H10.5A9.5 9.5 0 0 0 1 28.5Z" fill="#A259FF"/></svg>;
                          return href ? (
                            <a href={href} title={isAuto?`자동 매칭: ${autoFm.name}`:"직접 입력"}
                              style={{display:"flex",alignItems:"center",gap:4,fontSize:10,fontWeight:800,
                                padding:"4px 8px",borderRadius:8,background:"#1ABCFE22",color:"#0d7fa8",
                                border:"1px solid #1ABCFE55",textDecoration:"none",whiteSpace:"nowrap"}}>
                              <FigSVG/> Figma{isAuto&&<span style={{fontSize:8,opacity:0.6}}> 자동</span>}
                            </a>
                          ) : (
                            <button onClick={()=>setReqFigmaId(reqFigmaId===r.id?null:r.id)}
                              style={{fontSize:10,fontWeight:700,padding:"4px 8px",borderRadius:8,
                                border:`1px dashed #8b5cf6`,background:"none",color:"#8b5cf6",
                                cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                              + Figma
                            </button>
                          );
                        })()}
                        <Btn variant="sage" small onClick={()=>resolveReq(r.id)}><MI n="check_circle" size={13}/> 완료</Btn>
                        <Btn variant="danger" small onClick={()=>deleteReq(r.id)}><MI n="delete" size={13}/></Btn>
                      </div>
                    </div>
                    {reqFigmaId===r.id&&(
                      <div style={{display:"flex",gap:8,padding:"6px 12px 10px",borderTop:`1px solid #8b5cf622`,background:"#ede9fe"}}>
                        <input autoFocus placeholder="https://www.figma.com/..." id={`figma_${r.id}`}
                          defaultValue={r.figmaUrl||""}
                          style={{flex:1,fontSize:11,padding:"6px 10px",borderRadius:8,
                            border:`1px solid #a78bfa`,outline:"none",fontFamily:"inherit"}}/>
                        <Btn small onClick={()=>{
                          const el=document.getElementById(`figma_${r.id}`);
                          if(!el) return;
                          setRecreateReqs(prev=>prev.map(x=>x.id===r.id?{...x,figmaUrl:el.value.trim()}:x));
                          setReqFigmaId(null);
                        }}>저장</Btn>
                        <Btn variant="ghost" small onClick={()=>setReqFigmaId(null)}>취소</Btn>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {doneReqs.length>0&&(
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.inkLt,marginBottom:6}}>완료</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {doneReqs.map(r=>(
                  <div key={r.id} style={{padding:"8px 12px",borderRadius:10,border:`1px solid ${C.border}`,background:C.cream,opacity:0.7,display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.inkMid,textDecoration:"line-through"}}>{r.adName}</div>
                      <div style={{fontSize:9,color:C.inkLt}}>CTR {r.ctr}% · {r.requestedAt}</div>
                    </div>
                    <Btn variant="danger" small onClick={()=>deleteReq(r.id)}><MI n="delete" size={13}/></Btn>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 라이브러리 추가 모달 */}
      {libModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:C.white,borderRadius:20,padding:24,width:"100%",maxWidth:400}}>
            <div style={{fontSize:16,fontWeight:900,marginBottom:16}}>{libModal?.mode==="edit"?"소재 편집":"소재 추가"}</div>
            {[{key:"name",label:"소재명",placeholder:"광고 소재 이름"},{key:"figmaUrl",label:"피그마 링크",placeholder:"https://www.figma.com/..."},{key:"link",label:"기타 링크",placeholder:"https://"},{key:"product",label:"제품",placeholder:"제품명"},{key:"tags",label:"태그",placeholder:"상위소재, 전환, 영상"},{key:"note",label:"메모",placeholder:"성과 메모"}].map(({key,label,placeholder})=>(
              <div key={key} style={{marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>{label}</div>
                <input value={libForm[key]||""} onChange={e=>setLibForm(p=>({...p,[key]:e.target.value}))}
                  placeholder={placeholder} style={{width:"100%",fontSize:12,padding:"8px 10px",borderRadius:8,
                  border:`1px solid ${C.border}`,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <Btn onClick={()=>addToLib(libForm)} style={{flex:1}}>저장</Btn>
              <Btn variant="ghost" onClick={()=>setLibModal(null)} style={{flex:1}}>취소</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
    );
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🛒 쿠팡
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const CoupangSection = (() => {
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState([]);
    const [error, setError]       = useState(null);
    const [savedIds, setSavedIds] = useSupabaseState("cp_product_ids_v1", []);
    const fileRef = useRef(null);

    async function fetchProducts() {
      if (!savedIds.length) return;
      setLoading(true); setError(null);
      try {
        const results = await Promise.all(savedIds.map(async ({ id, label }) => {
          const res  = await fetch(`/api/coupang?type=product&id=${id}`);
          const data = await res.json();
          if (data.error) return { id, label, error: data.error };
          return { id, label, ...data.product };
        }));
        setProducts(results);
      } catch(e) { setError(e.message); }
      setLoading(false);
    }

    async function fetchOrders() {
      setLoading(true); setError(null);
      try {
        const res  = await fetch(`/api/coupang?type=orders`);
        const data = await res.json();
        if (data.error) { setError(data.error); setLoading(false); return; }
        setOrders(data.list || []);
      } catch(e) { setError(e.message); }
      setLoading(false);
    }

    function handleFileUpload(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const text = ev.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const parsed = [];
        for (const line of lines) {
          const cols = line.split(/[,\t]/);
          const id = cols[0]?.trim().replace(/^["']|["']$/g, "");
          const label = cols[1]?.trim().replace(/^["']|["']$/g, "") || id;
          if (id && /^\d+$/.test(id)) parsed.push({ id, label });
        }
        if (parsed.length) {
          setSavedIds(parsed);
          alert(`${parsed.length}개 상품 ID 불러왔어요`);
        } else {
          alert("상품 ID를 찾지 못했어요. 첫 번째 열에 숫자 ID가 있어야 해요.");
        }
        e.target.value = "";
      };
      reader.readAsText(file);
    }

    return (
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontSize:20,fontWeight:900,color:C.ink}}>쿠팡 가격 모니터링</div>
            <div style={{fontSize:12,color:C.inkMid,marginTop:2}}>오아스토어 기준 · 할인전가 vs 현재판매가 비교</div>
          </div>
          <Btn small onClick={fetchProducts} disabled={loading||!savedIds.length}>
            <MI n="sync" size={13}/> {loading?"조회 중...":"가격 조회"}
          </Btn>
        </div>

        {error&&(
          <Card>
            <div style={{color:C.bad,fontSize:13,fontWeight:700}}>{error}</div>
          </Card>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {/* 상품 파일 관리 */}
            <Card>
              <CardTitle title="모니터링 상품 목록" sub="CSV 파일 업로드 · Supabase 공유 저장"/>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
                <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} style={{display:"none"}}/>
                <Btn small onClick={()=>fileRef.current?.click()}>
                  <MI n="upload_file" size={13}/> CSV 업로드
                </Btn>
                <span style={{fontSize:11,color:C.inkLt}}>첫 번째 열: 등록상품ID / 두 번째 열: 상품명(선택)</span>
                {savedIds.length>0&&(
                  <button onClick={()=>{if(confirm("목록을 초기화할까요?"))setSavedIds([]);}}
                    style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:C.inkLt,fontSize:12}}>
                    초기화
                  </button>
                )}
              </div>
              {savedIds.length===0 ? (
                <div style={{fontSize:12,color:C.inkLt,padding:"12px 0"}}>
                  CSV 파일을 업로드하면 팀 전체에 공유됩니다
                </div>
              ) : (
                <div style={{fontSize:12,color:C.inkMid}}>
                  {savedIds.length}개 상품 등록됨 · {savedIds.slice(0,5).map(s=>s.label).join(", ")}{savedIds.length>5?` 외 ${savedIds.length-5}개`:""}
                </div>
              )}
            </Card>

            {/* 가격 비교 테이블 */}
            {products.length>0&&(
              <Card>
                <CardTitle title="가격 현황" sub="할인율기준가(originalPrice) vs 판매가(salePrice)"/>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead>
                      <tr style={{background:C.cream}}>
                        {["상품명","옵션","할인전가(기준가)","현재판매가","차이","재고","상태"].map(h=>(
                          <th key={h} style={{padding:"7px 10px",textAlign:"left",fontWeight:700,color:C.inkMid,
                            borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {products.flatMap((p,pi) => {
                        if(p.error) return [(
                          <tr key={pi} style={{borderBottom:`1px solid ${C.border}`}}>
                            <td colSpan={7} style={{padding:"7px 10px",color:C.bad,fontSize:11}}>{p.label} — {p.error}</td>
                          </tr>
                        )];
                        return (p.items||[]).map((item,ii)=>{
                          const sale = item.salePrice || 0;
                          const orig = item.originalPrice || 0;
                          const diff = orig && sale ? sale - orig : null;
                          const pct  = orig && sale ? Math.round((1 - sale/orig)*100) : null;
                          const diffColor = diff===null?C.inkLt:diff<0?C.bad:diff===0?C.inkMid:C.good;
                          return (
                            <tr key={`${pi}-${ii}`} style={{borderBottom:`1px solid ${C.border}`}}>
                              <td style={{padding:"7px 10px",fontWeight:700,color:C.ink,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</td>
                              <td style={{padding:"7px 10px",color:C.inkMid,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.itemName||"—"}</td>
                              <td style={{padding:"7px 10px",color:C.inkMid}}>{orig?orig.toLocaleString()+"원":"—"}</td>
                              <td style={{padding:"7px 10px",fontWeight:800,color:C.ink}}>{sale?sale.toLocaleString()+"원":"—"}</td>
                              <td style={{padding:"7px 10px",fontWeight:700,color:diffColor}}>
                                {diff!==null?(diff===0?"동일":(diff>0?"+":"")+diff.toLocaleString()+"원"+(pct?` (${pct}%↓)`:"")):"—"}
                              </td>
                              <td style={{padding:"7px 10px",color:item.stockQuantity===0?C.bad:C.inkMid,fontWeight:item.stockQuantity===0?800:400}}>
                                {item.stockQuantity??"—"}
                              </td>
                              <td style={{padding:"7px 10px"}}>
                                <span style={{fontSize:11,fontWeight:700,
                                  color:p.status==="APPROVED"||p.status==="판매중"?C.good:C.warn,
                                  background:p.status==="APPROVED"||p.status==="판매중"?"#F0FDF4":"#FFF7ED",
                                  padding:"2px 8px",borderRadius:10}}>{p.status||"—"}</span>
                              </td>
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
        </div>
      </div>
    );
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ERP 섹션 (이미용 판매 데이터)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function ErpSection() {
    const [erpTab, setErpTab]       = useState("summary");   // summary | trend | daily
    const [days,   setDays]         = useState(7);
    const [catId,  setCatId]        = useState("");           // "" = 전체 이미용
    const [data,   setData]         = useState(null);
    const [loading,setLoading]      = useState(false);
    const [error,  setError]        = useState(null);

    const BEAUTY_CATS = [
      {id:"",   name:"전체 이미용"},
      {id:"70",  name:"헤어"},
      {id:"71",  name:"피부미용"},
      {id:"72",  name:"이미용잡화"},
      {id:"73",  name:"기타이미용"},
    ];

    const fmtW = v => {
      const n = Number(v||0);
      if(n>=100000000) return `${(n/100000000).toFixed(1)}억`;
      if(n>=10000)     return `${Math.round(n/10000).toLocaleString()}만`;
      return `₩${Math.round(n).toLocaleString()}`;
    };

    async function load(tab, d, cId) {
      setLoading(true); setError(null);
      try {
        const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const since = new Date(); since.setDate(since.getDate() - d);
        const sinceStr = since.toISOString().split('T')[0];

        // 날짜 범위 내 raw 데이터 전체 조회 (카테고리 필터 포함)
        let url = `${SUPA_URL}/rest/v1/beauty_sales?select=name,cat_id,date,qty,revenue,profit&date=gte.${sinceStr}&order=date.desc&limit=5000`;
        if(cId) url += `&cat_id=eq.${cId}`;

        const res = await fetch(url, {
          headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
        });
        if(!res.ok) throw new Error(`Supabase 오류 ${res.status}`);
        const raw = await res.json();
        if(!raw.length) { setData([]); setLoading(false); return; }

        if(tab === "summary") {
          // 상품별 합산
          const map = {};
          raw.forEach(r => {
            if(!map[r.name]) map[r.name] = {name:r.name, qty:0, revenue:0, profit:0};
            map[r.name].qty     += Number(r.qty);
            map[r.name].revenue += Number(r.revenue);
            map[r.name].profit  += Number(r.profit);
          });
          setData(Object.values(map).sort((a,b)=>b.revenue-a.revenue).slice(0,50));

        } else if(tab === "trend") {
          // 이번주 vs 지난주
          const now = new Date();
          const w0 = new Date(now); w0.setDate(now.getDate()-7);
          const w1 = new Date(now); w1.setDate(now.getDate()-14);
          const w0s = w0.toISOString().split('T')[0];
          const w1s = w1.toISOString().split('T')[0];
          const map = {};
          raw.forEach(r => {
            if(!map[r.name]) map[r.name] = {name:r.name, this_week:0, last_week:0, this_revenue:0, last_revenue:0};
            if(r.date >= w0s) { map[r.name].this_week += Number(r.qty); map[r.name].this_revenue += Number(r.revenue); }
            else if(r.date >= w1s) { map[r.name].last_week += Number(r.qty); map[r.name].last_revenue += Number(r.revenue); }
          });
          setData(Object.values(map).filter(r=>r.this_week>0||r.last_week>0).sort((a,b)=>(b.this_week-b.last_week)-(a.this_week-a.last_week)));

        } else {
          // 일별 (raw 그대로 — 날짜+상품별)
          setData(raw);
        }
      } catch(e) { setError(e.message); setData(null); }
      finally { setLoading(false); }
    }

    useEffect(() => { load(erpTab, days, catId); }, [erpTab, days, catId]);

    function changeTab(t) { setErpTab(t); }

    const TABS = [
      {id:"summary", label:"📊 상품별"},
      {id:"trend",   label:"📈 급등/급락"},
      {id:"daily",   label:"📅 일별"},
    ];

    // trend 데이터 가공
    const trendRows = erpTab==="trend" && data ? data.map(r=>({
      ...r,
      this_week: Number(r.this_week),
      last_week: Number(r.last_week),
      this_revenue: Number(r.this_revenue),
      diff: Number(r.this_week) - Number(r.last_week),
      pct: r.last_week>0 ? Math.round((Number(r.this_week)-Number(r.last_week))/Number(r.last_week)*100) : 999,
    })) : [];
    const rising  = trendRows.filter(r=>r.diff>0).slice(0,10);
    const falling = trendRows.filter(r=>r.diff<0).sort((a,b)=>a.diff-b.diff).slice(0,10);

    // daily: 날짜별 합산 + 상품별 피벗
    const dailyAgg = erpTab==="daily" && data ? (() => {
      const byDate = {};
      data.forEach(r=>{
        if(!byDate[r.date]) byDate[r.date]={date:r.date, qty:0, revenue:0};
        byDate[r.date].qty     += Number(r.qty);
        byDate[r.date].revenue += Number(r.revenue);
      });
      return Object.values(byDate).sort((a,b)=>a.date.localeCompare(b.date));
    })() : [];

    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {/* 헤더 */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontSize:16,fontWeight:900,color:C.ink}}>🗄️ ERP · <span style={{color:C.rose}}>이미용</span> 판매</div>
            <div style={{fontSize:11,color:C.inkLt,marginTop:2}}>매일 오전 7시 자동 동기화 · Supabase</div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {/* 기간 선택 */}
            {[7,14,30].map(d=>(
              <button key={d} onClick={()=>setDays(d)} style={{
                padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",
                border:`1px solid ${days===d?C.rose:C.border}`,
                background:days===d?C.blush:C.white, color:days===d?C.rose:C.inkMid,
              }}>{d}일</button>
            ))}
            {/* 카테고리 필터 */}
            <select value={catId} onChange={e=>setCatId(e.target.value)} style={{
              padding:"5px 10px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",
              border:`1px solid ${C.border}`,background:C.white,color:C.ink,outline:"none",
            }}>
              {BEAUTY_CATS.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* 탭 */}
        <div style={{display:"flex",gap:4}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>changeTab(t.id)} style={{
              padding:"6px 16px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",
              border:`1px solid ${erpTab===t.id?C.rose:C.border}`,
              background:erpTab===t.id?C.blush:C.white,
              color:erpTab===t.id?C.rose:C.inkMid,
            }}>{t.label}</button>
          ))}
        </div>

        {loading && <div style={{textAlign:"center",padding:"60px 0",color:C.inkLt,fontSize:13}}>⏳ 불러오는 중...</div>}
        {error   && <div style={{textAlign:"center",padding:"40px 0",color:C.bad,fontSize:12,fontWeight:700}}>⚠️ {error}</div>}

        {/* 상품별 요약 */}
        {!loading && !error && erpTab==="summary" && data && (
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,fontSize:12,fontWeight:800,color:C.ink}}>
              상품별 판매 ({days}일) · {data.length}개 제품
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:480}}>
                <thead>
                  <tr style={{background:C.bg}}>
                    {["제품명","판매수량","총매출","이익"].map(h=>(
                      <th key={h} style={{padding:"8px 12px",textAlign:h==="제품명"?"left":"right",
                        fontWeight:700,color:C.inkMid,borderBottom:`1px solid ${C.border}`,fontSize:10}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((r,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${C.border}33`,
                      background:i%2===0?C.white:"#FAFAFA"}}>
                      <td style={{padding:"9px 12px",fontWeight:700,color:C.ink,maxWidth:220,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</td>
                      <td style={{padding:"9px 12px",textAlign:"right",fontWeight:700,color:C.inkMid}}>{Number(r.qty).toLocaleString()}</td>
                      <td style={{padding:"9px 12px",textAlign:"right",fontWeight:700,color:C.rose}}>{fmtW(r.revenue)}</td>
                      <td style={{padding:"9px 12px",textAlign:"right",fontWeight:700,
                        color:Number(r.profit)>0?C.good:C.bad}}>{fmtW(r.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 급등/급락 */}
        {!loading && !error && erpTab==="trend" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            {/* 급등 */}
            <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,
                display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14}}>🚀</span>
                <span style={{fontSize:12,fontWeight:800,color:C.good}}>급등 Top 10</span>
                <span style={{fontSize:10,color:C.inkLt}}>전주 대비</span>
              </div>
              {rising.length===0
                ? <div style={{padding:"30px",textAlign:"center",color:C.inkLt,fontSize:12}}>데이터 없음</div>
                : rising.map((r,i)=>(
                  <div key={i} style={{padding:"10px 14px",borderBottom:`1px solid ${C.border}22`,
                    display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.ink,overflow:"hidden",
                        textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
                      <div style={{fontSize:10,color:C.inkLt}}>{r.last_week} → {r.this_week}개</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:13,fontWeight:900,color:C.good}}>+{r.pct===999?"NEW":r.pct+"%"}</div>
                      <div style={{fontSize:10,color:C.good}}>+{r.diff}개</div>
                    </div>
                  </div>
                ))
              }
            </div>
            {/* 급락 */}
            <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,
                display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14}}>📉</span>
                <span style={{fontSize:12,fontWeight:800,color:C.bad}}>급락 Top 10</span>
                <span style={{fontSize:10,color:C.inkLt}}>전주 대비</span>
              </div>
              {falling.length===0
                ? <div style={{padding:"30px",textAlign:"center",color:C.inkLt,fontSize:12}}>데이터 없음</div>
                : falling.map((r,i)=>(
                  <div key={i} style={{padding:"10px 14px",borderBottom:`1px solid ${C.border}22`,
                    display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.ink,overflow:"hidden",
                        textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
                      <div style={{fontSize:10,color:C.inkLt}}>{r.last_week} → {r.this_week}개</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:13,fontWeight:900,color:C.bad}}>{r.pct}%</div>
                      <div style={{fontSize:10,color:C.bad}}>{r.diff}개</div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* 일별 차트 + 상세 */}
        {!loading && !error && erpTab==="daily" && data && (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {/* 일별 매출 차트 */}
            <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
              <div style={{fontSize:12,fontWeight:800,color:C.ink,marginBottom:12}}>일별 매출 추이</div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={dailyAgg}>
                  <defs>
                    <linearGradient id="gErp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.rose} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={C.rose} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                  <XAxis dataKey="date" tick={{fontSize:10,fill:C.inkLt}} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:C.inkLt}} tickLine={false} axisLine={false}
                    tickFormatter={v=>fmtW(v)}/>
                  <Tooltip formatter={v=>[fmtW(v),"매출"]}
                    contentStyle={{background:C.white,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}/>
                  <Area type="monotone" dataKey="revenue" stroke={C.rose} strokeWidth={2}
                    fill="url(#gErp)" name="매출"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* 일별 상세 테이블 */}
            <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,fontSize:12,fontWeight:800,color:C.ink}}>
                일별 판매 상세
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:440}}>
                  <thead>
                    <tr style={{background:C.bg}}>
                      {["날짜","제품명","수량","매출"].map(h=>(
                        <th key={h} style={{padding:"8px 12px",textAlign:h==="날짜"||h==="제품명"?"left":"right",
                          fontWeight:700,color:C.inkMid,borderBottom:`1px solid ${C.border}`,fontSize:10}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0,100).map((r,i)=>(
                      <tr key={i} style={{borderBottom:`1px solid ${C.border}22`,background:i%2===0?C.white:"#FAFAFA"}}>
                        <td style={{padding:"8px 12px",color:C.inkMid,whiteSpace:"nowrap"}}>{r.date}</td>
                        <td style={{padding:"8px 12px",fontWeight:600,color:C.ink,maxWidth:200,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",color:C.inkMid}}>{Number(r.qty).toLocaleString()}</td>
                        <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:C.rose}}>{fmtW(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const ReviewSection=(()=>{
    const MEMBERS=["소리","영서","경은","지수"];
    const PLATFORMS={instagram:{label:"인스타그램",icon:"photo_camera",color:"#e1306c",bg:"#fff0f5"},twitter:{label:"트위터",icon:"flutter_dash",color:"#1da1f2",bg:"#f0f9ff"}};
    const EMPTY_FORM={title:"",platform:"instagram",link:"",postedAt:"",views:"",likes:"",comments:"",saves:"",isAd:false,adSpend:"",adRoas:"",adCtr:"",adCpc:"",adCpa:"",adPurchases:"",isManyChat:false,assignee:"",note:""};
    const EMPTY_IG={month:"",views:"",reach:"",interactions:"",follows:"",unfollows:""};

    const [rvTab,setRvTab]=useState("all"); // all|instagram|twitter
    const [modal,setModal]=useState(null); // null|"add"|{mode:"edit",item}
    const [form,setForm]=useState(EMPTY_FORM);
    const [igModal,setIgModal]=useState(false);
    const [igForm,setIgForm]=useState(EMPTY_IG);
    const [rvSort,setRvSort]=useState("newest");
    const [igSelMonth,setIgSelMonth]=useState("");
    const [twSelMonth,setTwSelMonth]=useState("");

    // Notion 데이터 1회 시딩
    useEffect(()=>{
      const SEED=[
        {title:"왓츠인마이백 컨텐츠 제작",platform:"instagram",postedAt:"2026-01-29",assignee:"지수"},
        {title:"프리온 행사 홍보 컨텐츠",platform:"instagram",postedAt:"2026-01-30",assignee:"영서"},
        {title:"오토 고데기 홍보 컨텐츠",platform:"instagram",postedAt:"2026-02-05",assignee:"영서"},
        {title:"팔로워 이벤트",platform:"instagram",postedAt:"2026-02-05",assignee:"지수"},
        {title:"네이버 설특가 홍보 컨텐츠",platform:"instagram",postedAt:"2026-02-09",assignee:"영서"},
        {title:"발렌타인-히팅뷰러 rt 이벤트",platform:"twitter",postedAt:"2026-02-10",assignee:"영서"},
        {title:"에이블리 설 에누리 행사 홍보 컨텐츠",platform:"instagram",postedAt:"2026-02-12",assignee:"영서"},
        {title:"발렌타인데이_컨텐츠 제작",platform:"instagram",postedAt:"2026-02-13",assignee:"지수"},
        {title:"에이블리 에누리 기획전_오토고데기 홍보 컨텐츠",platform:"instagram",postedAt:"2026-02-13",assignee:"지수"},
        {title:"에이블리 단독 기획전_홍보 컨텐츠",platform:"instagram",postedAt:"2026-02-19",assignee:"지수"},
        {title:"지그재그 셀프케어페스타 홍보 컨텐츠",platform:"instagram",postedAt:"2026-02-23",assignee:"영서"},
        {title:"프리온 홍보 글",platform:"instagram",postedAt:"2026-02-24",assignee:"영서"},
        {title:"오아 고데기 홍보 콘텐츠",platform:"instagram",postedAt:"2026-02-27",assignee:"영서"},
        {title:"여성의 날 rt 이벤트",platform:"twitter",postedAt:"2026-03-06",assignee:"영서"},
      ];
      const t=setTimeout(async()=>{
        try{
          const seeded=await getSetting("oa_notion_seeded_v1");
          if(seeded) return;
          const existing=await getSetting("oa_review_v7");
          const items=Array.isArray(existing)?existing:[];
          const titles=new Set(items.map(i=>i.title));
          const toAdd=SEED.filter(s=>!titles.has(s.title)).map(s=>({
            ...s,id:Date.now()+Math.random()+"",
            link:"",views:null,likes:null,comments:null,saves:null,
            isAd:false,adSpend:null,adRoas:null,adCtr:null,adCpc:null,adCpa:null,adPurchases:null,
            isManyChat:false,note:"",createdAt:"2026-03-30"
          }));
          if(toAdd.length>0){
            setReviewItems([...toAdd,...items]);
          }
          await setSetting("oa_notion_seeded_v1",true);
        }catch(e){}
      },2500);
      return()=>clearTimeout(t);
    // eslint-disable-next-line
    },[]);

    function saveIg(){
      if(!igForm.month){alert("월을 선택해주세요");return;}
      const num=v=>v?Number(String(v).replace(/,/g,"")):null;
      const item={id:Date.now()+"",month:igForm.month,
        views:num(igForm.views),reach:num(igForm.reach),
        interactions:num(igForm.interactions),follows:num(igForm.follows),
        unfollows:num(igForm.unfollows),
        createdAt:new Date().toISOString().slice(0,10)};
      if(igModal==="add"){
        setIgInsights(prev=>[item,...(prev||[])].sort((a,b)=>b.month.localeCompare(a.month)));
      } else {
        setIgInsights(prev=>(prev||[]).map(i=>i.id===igModal.item.id?{...item,id:i.id}:i));
      }
      setIgForm(EMPTY_IG); setIgModal(false);
    }

    function importInstagramCSV(e){
      const file=e.target.files[0]; if(!file) return;
      const reader=new FileReader();
      reader.onload=ev=>{
        const text=ev.target.result;
        const lines=text.split("\n");
        // BOM 제거 후 헤더 파싱
        const header=lines[0].replace(/^\uFEFF/,"").split(",").map(h=>h.trim().replace(/^"|"$/g,""));
        const get=(row,key)=>{
          const i=header.findIndex(h=>h===key);
          return i>=0?(row[i]||"").trim():"";
        };
        // CSV rows — 큰따옴표 안의 줄바꿈 처리
        const rawRows=[]; let cur=""; let inQ=false;
        for(let i=1;i<lines.length;i++){
          const line=lines[i];
          for(const ch of line){ if(ch==='"') inQ=!inQ; }
          cur+=cur?"\n"+line:line;
          if(!inQ){ rawRows.push(cur); cur=""; }
        }
        const parseRow=raw=>{
          const cols=[]; let cell=""; let q=false;
          for(let i=0;i<raw.length;i++){
            const ch=raw[i];
            if(ch==='"'){ q=!q; }
            else if(ch===','&&!q){ cols.push(cell); cell=""; }
            else { cell+=ch; }
          }
          cols.push(cell);
          return cols.map(c=>c.replace(/^"|"$/g,"").trim());
        };
        // 날짜 파싱: "03/05/2026 23:21" → "2026-03-05"
        const parseDate=s=>{
          if(!s) return "";
          const m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if(m) return `${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`;
          return "";
        };
        const newItems=rawRows.filter(r=>r.trim()).map(raw=>{
          const row=parseRow(raw);
          const gi=key=>{const i=header.findIndex(h=>h===key);return i>=0?(row[i]||"").trim():"";};
          const username=gi("계정 사용자 이름");
          const desc=gi("설명").replace(/\r/g,"");
          const firstLine=desc.split("\n")[0].trim().slice(0,60);
          const title=(username?`@${username} `:"")+(firstLine||"(제목없음)");
          const num=v=>v&&v!=="-"&&v!=="—"?Number(String(v).replace(/,/g,"")):null;
          return {
            id:Date.now()+"_"+Math.random().toString(36).slice(2)+"_"+gi("게시물 ID").slice(-6),
            platform:"instagram",
            title,
            link:gi("고유 링크"),
            postedAt:parseDate(gi("게시 시간")),
            views:num(gi("조회")),
            reach:num(gi("도달")),
            likes:num(gi("좋아요")),
            comments:num(gi("댓글")),
            saves:num(gi("저장")),
            shares:num(gi("공유")),
            follows:num(gi("팔로우")),
            isAd:false, adSpend:null, isManyChat:false, assignee:"",
            note:`${gi("계정 이름")} · ${gi("게시물 유형")}`,
            createdAt:new Date().toISOString().slice(0,10),
          };
        }).filter(i=>i.title);
        if(!newItems.length){alert("가져올 항목이 없어요");return;}
        setReviewItems(prev=>[...newItems,...(prev||[])]);
        alert(`${newItems.length}개 가져왔어요`);
      };
      reader.readAsText(file,"utf-8");
      e.target.value="";
    }

    const filtered=(reviewItems||[])
      .filter(i=>rvTab==="all"||i.platform===rvTab)
      .sort((a,b)=>{
        const da=a.postedAt||a.createdAt||""; const db=b.postedAt||b.createdAt||"";
        return rvSort==="newest"?db.localeCompare(da):da.localeCompare(db);
      });

    function addItem(){
      if(!form.title.trim()){alert("콘텐츠 제목을 입력해주세요");return;}
      const item={id:Date.now()+"_"+Math.random().toString(36).slice(2),
        ...form,
        title:form.title.trim(),link:form.link.trim(),note:form.note.trim(),
        views:form.views?Number(form.views.replace(/,/g,"")):null,
        likes:form.likes?Number(form.likes.replace(/,/g,"")):null,
        comments:form.comments?Number(form.comments.replace(/,/g,"")):null,
        saves:form.saves?Number(form.saves.replace(/,/g,"")):null,
        adSpend:form.adSpend?Number(form.adSpend.replace(/,/g,"")):null,
        adRoas:form.adRoas?Number(form.adRoas.replace(/,/g,"")):null,
        adCtr:form.adCtr?Number(form.adCtr.replace(/,/g,"")):null,
        adCpc:form.adCpc?Number(form.adCpc.replace(/,/g,"")):null,
        adCpa:form.adCpa?Number(form.adCpa.replace(/,/g,"")):null,
        adPurchases:form.adPurchases?Number(form.adPurchases.replace(/,/g,"")):null,
        createdAt:new Date().toISOString().slice(0,10)};
      if(modal==="add"){
        setReviewItems(prev=>[item,...(prev||[])]);
      } else {
        setReviewItems(prev=>(prev||[]).map(i=>i.id===modal.item.id?{...item,id:i.id,createdAt:i.createdAt}:i));
      }
      setForm(EMPTY_FORM);setModal(null);
    }

    function deleteItem(id){
      setReviewItems(prev=>(prev||[]).filter(i=>i.id!==id));
    }

    function openEdit(item){
      setForm({...EMPTY_FORM,...item,
        views:item.views!=null?String(item.views):"",
        likes:item.likes!=null?String(item.likes):"",
        comments:item.comments!=null?String(item.comments):"",
        saves:item.saves!=null?String(item.saves):"",
        adSpend:item.adSpend!=null?String(item.adSpend):"",
        adRoas:item.adRoas!=null?String(item.adRoas):"",
        adCtr:item.adCtr!=null?String(item.adCtr):"",
        adCpc:item.adCpc!=null?String(item.adCpc):"",
        adCpa:item.adCpa!=null?String(item.adCpa):"",
        adPurchases:item.adPurchases!=null?String(item.adPurchases):"",
      });
      setModal({mode:"edit",item});
    }

    const instaCount=(reviewItems||[]).filter(i=>i.platform==="instagram").length;
    const twitterCount=(reviewItems||[]).filter(i=>i.platform==="twitter").length;

    const instaItems=(reviewItems||[]).filter(i=>i.platform==="instagram"&&i.postedAt);
    const monthGroups={};
    instaItems.forEach(i=>{const m=i.postedAt.slice(0,7);if(!monthGroups[m])monthGroups[m]=[];monthGroups[m].push(i);});
    const latestMonth=Object.keys(monthGroups).sort().pop()||"";
    const activeIgMonth=igSelMonth||latestMonth;
    const instaMonthItems=activeIgMonth?(monthGroups[activeIgMonth]||[]):instaItems;
    const instaSum=arr=>arr.reduce((s,i)=>{
      s.views+=(i.views||0); s.reach+=(i.reach||0); s.likes+=(i.likes||0);
      s.comments+=(i.comments||0); s.saves+=(i.saves||0); s.shares+=(i.shares||0); s.follows+=(i.follows||0);
      return s;
    },{views:0,reach:0,likes:0,comments:0,saves:0,shares:0,follows:0});
    const instaStat=instaSum(instaMonthItems);
    const monthLabel=activeIgMonth?`${activeIgMonth.slice(0,4)}년 ${parseInt(activeIgMonth.slice(5))}월`:"";
    const igMonths=Object.keys(monthGroups).sort().reverse();

    const twitterItems=(reviewItems||[]).filter(i=>i.platform==="twitter"&&i.postedAt);
    const twMonthGroups={};
    twitterItems.forEach(i=>{const m=i.postedAt.slice(0,7);if(!twMonthGroups[m])twMonthGroups[m]=[];twMonthGroups[m].push(i);});
    const latestTwMonth=Object.keys(twMonthGroups).sort().pop()||"";
    const activeTwMonth=twSelMonth||latestTwMonth;
    const twMonthItems=activeTwMonth?(twMonthGroups[activeTwMonth]||[]):twitterItems;
    const twSum=arr=>arr.reduce((s,i)=>{
      s.views+=(i.views||0); s.likes+=(i.likes||0);
      s.comments+=(i.comments||0); s.saves+=(i.saves||0); s.shares+=(i.shares||0);
      return s;
    },{views:0,likes:0,comments:0,saves:0,shares:0});
    const twStat=twSum(twMonthItems);
    const twMonthLabel=activeTwMonth?`${activeTwMonth.slice(0,4)}년 ${parseInt(activeTwMonth.slice(5))}월`:"";
    const twMonths=Object.keys(twMonthGroups).sort().reverse();

    const inputStyle={width:"100%",fontSize:12,padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};

    return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <CardTitle title={<><MI n="assignment" size={14}/> 콘텐츠 리뷰</>} sub={`전체 ${(reviewItems||[]).length}건`}
          action={<div style={{display:"flex",gap:6}}>
            <label style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,fontWeight:700,color:C.inkMid,cursor:"pointer",background:C.white}}>
              <MI n="upload_file" size={12}/> CSV
              <input type="file" accept=".csv" style={{display:"none"}} onChange={importInstagramCSV}/>
            </label>
            <Btn small onClick={()=>{setForm(EMPTY_FORM);setModal("add");}}>+ 등록</Btn>
          </div>}/>

        {/* 플랫폼 탭 + 정렬 */}
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,flexWrap:"wrap"}}>
          {[["all","전체",C.rose,(reviewItems||[]).length],["instagram",<><MI n="photo_camera" size={12}/> 인스타그램</>,"#e1306c",instaCount],["twitter",<><MI n="flutter_dash" size={12}/> 트위터</>,"#1da1f2",twitterCount]].map(([k,l,col,cnt])=>(
            <button key={k} onClick={()=>setRvTab(k)} style={{fontSize:11,padding:"5px 14px",borderRadius:20,
              border:`1px solid ${rvTab===k?col:C.border}`,background:rvTab===k?col:C.white,
              color:rvTab===k?C.white:C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
              {l} <span style={{opacity:0.8}}>({cnt})</span>
            </button>
          ))}
          <button onClick={()=>setRvSort(s=>s==="newest"?"oldest":"newest")}
            style={{marginLeft:"auto",fontSize:10,padding:"4px 10px",borderRadius:20,border:`1px solid ${C.border}`,background:C.white,color:C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
            <MI n="swap_vert" size={11}/> {rvSort==="newest"?"최신순":"오래된순"}
          </button>
        </div>

        {/* 인스타 월 요약 카드 */}
        {rvTab==="instagram"&&(
          <div style={{marginBottom:8}}>
            {igMonths.length>1&&(
              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
                {igMonths.map(m=>{
                  const active=m===activeIgMonth;
                  return(
                    <button key={m} onClick={()=>setIgSelMonth(igSelMonth===m?"":m)} style={{fontSize:10,padding:"3px 10px",borderRadius:20,border:`1px solid ${active?"#e1306c":C.border}`,background:active?"#e1306c":C.white,color:active?C.white:C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
                      {m.slice(0,4)}년 {parseInt(m.slice(5))}월
                    </button>
                  );
                })}
              </div>
            )}
            {instaMonthItems.length>0&&(
              <div style={{background:"linear-gradient(135deg,#fff0f5,#fce7f3)",border:"1px solid #f9a8d4",borderRadius:14,padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                  <MI n="photo_camera" size={14} style={{color:"#e1306c"}}/>
                  <span style={{fontSize:12,fontWeight:800,color:"#e1306c"}}>{monthLabel} 인스타그램 성과</span>
                  <span style={{marginLeft:"auto",fontSize:10,color:"#e1306c",opacity:0.7}}>{instaMonthItems.length}개 게시물</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                  {[
                    {label:"조회수",value:instaStat.views,icon:"visibility",color:"#be185d"},
                    {label:"도달",value:instaStat.reach,icon:"radar",color:"#9d174d"},
                    {label:"좋아요",value:instaStat.likes,icon:"favorite",color:"#e1306c"},
                    {label:"댓글",value:instaStat.comments,icon:"chat_bubble",color:"#be185d"},
                    {label:"저장",value:instaStat.saves,icon:"bookmark",color:"#7c3aed"},
                    {label:"공유",value:instaStat.shares,icon:"share",color:"#0891b2"},
                    {label:"팔로워 증가",value:instaStat.follows,icon:"person_add",color:"#059669"},
                  ].map(({label,value,icon,color})=>(
                    <div key={label} style={{background:"rgba(255,255,255,0.7)",borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                      <MI n={icon} size={14} style={{color}}/>
                      <div style={{fontSize:16,fontWeight:900,color,marginTop:2}}>{value.toLocaleString()}</div>
                      <div style={{fontSize:9,color:"#9d174d",opacity:0.7,fontWeight:700,marginTop:1}}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 트위터 월 요약 카드 */}
        {rvTab==="twitter"&&(
          <div style={{marginBottom:8}}>
            {twMonths.length>1&&(
              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
                {twMonths.map(m=>{
                  const active=m===activeTwMonth;
                  return(
                    <button key={m} onClick={()=>setTwSelMonth(twSelMonth===m?"":m)} style={{fontSize:10,padding:"3px 10px",borderRadius:20,border:`1px solid ${active?"#1da1f2":C.border}`,background:active?"#1da1f2":C.white,color:active?C.white:C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
                      {m.slice(0,4)}년 {parseInt(m.slice(5))}월
                    </button>
                  );
                })}
              </div>
            )}
            {twMonthItems.length>0&&(
              <div style={{background:"linear-gradient(135deg,#f0f9ff,#e0f2fe)",border:"1px solid #7dd3fc",borderRadius:14,padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                  <MI n="flutter_dash" size={14} style={{color:"#1da1f2"}}/>
                  <span style={{fontSize:12,fontWeight:800,color:"#1da1f2"}}>{twMonthLabel} 트위터 성과</span>
                  <span style={{marginLeft:"auto",fontSize:10,color:"#1da1f2",opacity:0.7}}>{twMonthItems.length}개 게시물</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                  {[
                    {label:"조회수",value:twStat.views,icon:"visibility",color:"#0369a1"},
                    {label:"좋아요",value:twStat.likes,icon:"favorite",color:"#1da1f2"},
                    {label:"댓글",value:twStat.comments,icon:"chat_bubble",color:"#0284c7"},
                    {label:"리트윗",value:twStat.shares,icon:"repeat",color:"#059669"},
                    {label:"저장",value:twStat.saves,icon:"bookmark",color:"#7c3aed"},
                  ].map(({label,value,icon,color})=>(
                    <div key={label} style={{background:"rgba(255,255,255,0.7)",borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                      <MI n={icon} size={14} style={{color}}/>
                      <div style={{fontSize:16,fontWeight:900,color,marginTop:2}}>{value.toLocaleString()}</div>
                      <div style={{fontSize:9,color:"#0369a1",opacity:0.7,fontWeight:700,marginTop:1}}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {filtered.length===0&&(
          <div style={{textAlign:"center",color:C.inkLt,fontSize:12,padding:"24px 0"}}>
            + 등록 버튼으로 콘텐츠를 추가해보세요
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map(item=>{
            const pl=PLATFORMS[item.platform]||PLATFORMS.instagram;
            return(
            <div key={item.id} style={{borderRadius:12,border:`1px solid ${pl.color}44`,background:pl.bg,padding:"12px 14px"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  {/* 뱃지 행 */}
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:6}}>
                    <span style={{fontSize:11,fontWeight:700,color:pl.color}}><MI n={pl.icon} size={13}/> {pl.label}</span>
                    {item.isAd&&<span style={{fontSize:10,fontWeight:700,color:"#8b5cf6",background:"#f5f3ff",padding:"2px 8px",borderRadius:10}}><MI n="campaign" size={11}/> 광고</span>}
                    {item.isManyChat&&<span style={{fontSize:10,fontWeight:700,color:"#f59e0b",background:"#fffbeb",padding:"2px 8px",borderRadius:10}}><MI n="smart_toy" size={11}/> 매니챗</span>}
                    {item.assignee&&<span style={{fontSize:10,color:C.inkMid}}><MI n="person" size={12}/> {item.assignee}</span>}
                  </div>
                  {/* 제목 */}
                  <div style={{fontSize:13,fontWeight:800,color:C.ink,marginBottom:6}}>{item.title}</div>
                  {/* 수치 */}
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                    {item.views!=null&&<span style={{fontSize:10,fontWeight:700,color:C.inkMid,background:C.cream,padding:"2px 8px",borderRadius:10}}><MI n="visibility" size={11}/> {item.views.toLocaleString()}</span>}
                    {item.likes!=null&&<span style={{fontSize:10,fontWeight:700,color:"#e1306c",background:"#fff0f5",padding:"2px 8px",borderRadius:10}}><MI n="favorite" size={11}/> {item.likes.toLocaleString()}</span>}
                    {item.comments!=null&&<span style={{fontSize:10,fontWeight:700,color:C.inkMid,background:C.cream,padding:"2px 8px",borderRadius:10}}><MI n="chat_bubble" size={11}/> {item.comments.toLocaleString()}</span>}
                    {item.saves!=null&&<span style={{fontSize:10,fontWeight:700,color:"#8b5cf6",background:"#f5f3ff",padding:"2px 8px",borderRadius:10}}><MI n="bookmark" size={11}/> {item.saves.toLocaleString()}</span>}
                    {item.isAd&&item.adSpend!=null&&<span style={{fontSize:10,fontWeight:700,color:"#8b5cf6",background:"#f5f3ff",padding:"2px 8px",borderRadius:10}}><MI n="payments" size={11}/> {item.adSpend.toLocaleString()}원</span>}
                    {item.isAd&&item.adRoas!=null&&<span style={{fontSize:10,fontWeight:700,color:C.good,background:"#f0fdf4",padding:"2px 8px",borderRadius:10}}><MI n="trending_up" size={11}/> ROAS {item.adRoas}%</span>}
                    {item.isAd&&item.adCtr!=null&&<span style={{fontSize:10,fontWeight:700,color:C.gold,background:"#fffbeb",padding:"2px 8px",borderRadius:10}}>CTR {item.adCtr}%</span>}
                    {item.isAd&&item.adCpc!=null&&<span style={{fontSize:10,fontWeight:700,color:C.inkMid,background:C.cream,padding:"2px 8px",borderRadius:10}}>CPC ₩{item.adCpc.toLocaleString()}</span>}
                    {item.isAd&&item.adPurchases!=null&&<span style={{fontSize:10,fontWeight:700,color:C.rose,background:"#fff0f5",padding:"2px 8px",borderRadius:10}}><MI n="receipt" size={11}/> {item.adPurchases}건</span>}
                  </div>
                  {item.note&&<div style={{fontSize:11,color:C.inkMid,marginBottom:4}}><MI n="edit_note" size={12}/> {item.note}</div>}
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    {item.link&&<a href={item.link} target="_blank" rel="noreferrer" style={{fontSize:10,color:pl.color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}><MI n="link" size={11}/> 게시물 보기</a>}
                    {item.postedAt&&<span style={{fontSize:9,color:C.inkLt}}>{item.postedAt} 게시</span>}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
                  <Btn small onClick={()=>openEdit(item)}><MI n="edit" size={13}/> 수정</Btn>
                  <Btn variant="danger" small onClick={()=>deleteItem(item.id)}><MI n="delete" size={13}/></Btn>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </Card>

      {/* 등록/수정 모달 */}
      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
          <div style={{background:C.white,borderRadius:20,padding:24,width:"100%",maxWidth:440,margin:"auto"}}>
            <div style={{fontSize:16,fontWeight:900,marginBottom:16}}>{modal==="add"?"콘텐츠 등록":"콘텐츠 수정"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {/* 플랫폼 */}
              <div>
                <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>플랫폼</div>
                <div style={{display:"flex",gap:6}}>
                  {Object.entries(PLATFORMS).map(([k,pl])=>(
                    <button key={k} onClick={()=>setForm(p=>({...p,platform:k}))} style={{flex:1,fontSize:12,padding:"8px 0",borderRadius:10,
                      border:`1px solid ${form.platform===k?pl.color:C.border}`,
                      background:form.platform===k?pl.bg:C.white,
                      color:form.platform===k?pl.color:C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
                      <MI n={pl.icon} size={13}/> {pl.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* 제목 */}
              <div>
                <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>제목 *</div>
                <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="콘텐츠 제목" style={inputStyle}/>
              </div>
              {/* 링크 + 게시일 */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>게시물 링크</div>
                  <input value={form.link} onChange={e=>setForm(p=>({...p,link:e.target.value}))} placeholder="https://..." style={inputStyle}/>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>게시일</div>
                  <input type="date" value={form.postedAt} onChange={e=>setForm(p=>({...p,postedAt:e.target.value}))} style={inputStyle}/>
                </div>
              </div>
              {/* 수치 */}
              <div>
                <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>성과 수치</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[["views",<><MI n="visibility" size={11}/> 조회수</>],["likes",<><MI n="favorite" size={11}/> 좋아요</>],["comments",<><MI n="chat_bubble" size={11}/> 댓글</>],["saves",<><MI n="bookmark" size={11}/> 저장</>]].map(([k,l])=>(
                    <div key={k}>
                      <div style={{fontSize:9,color:C.inkMid,marginBottom:2}}>{l}</div>
                      <input value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} placeholder="0" style={inputStyle}/>
                    </div>
                  ))}
                </div>
              </div>
              {/* 광고 여부 */}
              <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>광고 진행</div>
                  <div style={{display:"flex",gap:6}}>
                    {[["true",<><MI n="campaign" size={11}/> 했음</>],["false","없음"]].map(([v,l])=>(
                      <button key={v} onClick={()=>setForm(p=>({...p,isAd:v==="true"}))} style={{flex:1,fontSize:11,padding:"6px 0",borderRadius:10,
                        border:`1px solid ${String(form.isAd)===v?"#8b5cf6":C.border}`,
                        background:String(form.isAd)===v?"#f5f3ff":C.white,
                        color:String(form.isAd)===v?"#8b5cf6":C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{l}</button>
                    ))}
                  </div>
                  {form.isAd&&(
                    <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6}}>
                      <div>
                        <div style={{fontSize:9,color:C.inkMid,marginBottom:2}}><MI n="payments" size={11}/> 광고 소진액 (원)</div>
                        <input value={form.adSpend} onChange={e=>setForm(p=>({...p,adSpend:e.target.value}))} placeholder="0" style={inputStyle}/>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                        {[["adRoas","ROAS (%)","trending_up"],["adCtr","CTR (%)","percent"],["adCpc","CPC (원)","payments"],["adCpa","CPA (원)","shopping_bag"],["adPurchases","구매수","receipt"]].map(([k,l,ic])=>(
                          <div key={k}>
                            <div style={{fontSize:9,color:C.inkMid,marginBottom:2}}><MI n={ic} size={10}/> {l}</div>
                            <input value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} placeholder="0" style={inputStyle}/>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* 매니챗 */}
                <div style={{flex:1}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>매니챗</div>
                  <div style={{display:"flex",gap:6}}>
                    {[["true",<><MI n="smart_toy" size={11}/> 했음</>],["false","없음"]].map(([v,l])=>(
                      <button key={v} onClick={()=>setForm(p=>({...p,isManyChat:v==="true"}))} style={{flex:1,fontSize:11,padding:"6px 0",borderRadius:10,
                        border:`1px solid ${String(form.isManyChat)===v?"#f59e0b":C.border}`,
                        background:String(form.isManyChat)===v?"#fffbeb":C.white,
                        color:String(form.isManyChat)===v?"#f59e0b":C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
              {/* 담당자 */}
              <div>
                <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>담당자</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {["",...MEMBERS].map(m=>(
                    <button key={m} onClick={()=>setForm(p=>({...p,assignee:m}))} style={{fontSize:11,padding:"4px 12px",borderRadius:20,
                      border:`1px solid ${form.assignee===m?C.rose:C.border}`,background:form.assignee===m?C.rose:C.white,
                      color:form.assignee===m?C.white:C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{m||"미지정"}</button>
                  ))}
                </div>
              </div>
              {/* 메모 */}
              <div>
                <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>메모</div>
                <input value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} placeholder="특이사항, 반응 등" style={inputStyle}/>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <Btn onClick={addItem} style={{flex:1}}>{modal==="add"?"등록":"저장"}</Btn>
              <Btn variant="ghost" onClick={()=>setModal(null)} style={{flex:1}}>취소</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
    );
  })();


  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📝 팀 노트
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const InsightSection = (()=>{
    const MEMBERS = ["소리","영서","경은","지수"];
    const CATS = ["공통","공지","요청","기획","인사이트"];
    const CAT_COLORS = {공통:C.inkMid,공지:C.rose,요청:"#f59e0b",기획:"#7c3aed",인사이트:"#0891b2"};
    const [noteTab, setNoteTab] = useState("board"); // board | meeting
    const [posts, setPosts] = useSyncState("oa_insight_posts_v1", []);
    const [text, setText] = useState("");
    const [assignee, setAssignee] = useState("");
    const [cat, setCat] = useState("공통");
    const [filterCat, setFilterCat] = useState("전체");
    const [mtModal, setMtModal] = useState(false);
    const [mtForm, setMtForm] = useState({title:"",date:new Date().toISOString().slice(0,10),attendees:[],content:"",actions:"",htmlContent:"",summary:""});
    const [recording, setRecording] = useState(false);
    const [recSupported, setRecSupported] = useState(false);
    const recognitionRef = useRef(null);
    const mtHtmlRef = useRef(null);
    const inputStyle={width:"100%",fontSize:12,padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};

    // Web Speech API 지원 확인
    useEffect(()=>{
      setRecSupported(!!(window.SpeechRecognition||window.webkitSpeechRecognition));
    },[]);

    function startRecording(){
      const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!SR) return;
      const r = new SR();
      r.lang="ko-KR"; r.continuous=true; r.interimResults=true;
      r.onresult=e=>{
        let final="";
        for(let i=e.resultIndex;i<e.results.length;i++){
          if(e.results[i].isFinal) final+=e.results[i][0].transcript+" ";
        }
        if(final) setMtForm(p=>({...p,content:(p.content+(p.content?"\n":"")+final.trim())}));
      };
      r.onend=()=>{ if(recording){ try{r.start();}catch(e){} } };
      r.start();
      recognitionRef.current=r;
      setRecording(true);
    }

    function stopRecording(){
      if(recognitionRef.current){ try{recognitionRef.current.stop();}catch(e){} recognitionRef.current=null; }
      setRecording(false);
    }

    function handleHtmlUpload(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => setMtForm(p => ({...p, htmlContent: ev.target.result, htmlFileName: file.name}));
      reader.readAsText(file, "utf-8");
      e.target.value = "";
    }

    function saveMeeting(){
      if(!mtForm.title.trim()) return;
      if(mtForm.id){
        // 수정 모드 — 기존 항목 업데이트
        setMeetingNotes(prev=>(prev||[]).map(n=>n.id===mtForm.id?{...n,...mtForm}:n));
      } else {
        // 신규 추가
        setMeetingNotes(prev=>[{id:Date.now()+"", ...mtForm,
          createdAt:new Date().toISOString().slice(0,10)},...(prev||[])]);
      }
      setMtForm({title:"",date:new Date().toISOString().slice(0,10),attendees:[],content:"",actions:"",htmlContent:"",htmlFileName:"",summary:""});
      setMtModal(false); stopRecording();
    }

    function addPost(){
      if(!text.trim()) return;
      setPosts(prev=>[{id:Date.now()+"",text:text.trim(),assignee,cat,
        createdAt:new Date().toISOString().slice(0,10)},...(prev||[])]);
      setText("");
    }

    const filtered=(posts||[]).filter(p=>filterCat==="전체"||p.cat===filterCat);

    return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* 탭 */}
      <div style={{display:"flex",gap:4,padding:4,background:C.cream,borderRadius:12,width:"fit-content"}}>
        {[["board","edit_note","팀 게시판"],["meeting","mic","미팅 노트"]].map(([id,ic,l])=>(
          <button key={id} onClick={()=>setNoteTab(id)} style={{display:"flex",alignItems:"center",gap:5,
            padding:"7px 14px",borderRadius:9,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit",
            background:noteTab===id?C.white:"transparent",color:noteTab===id?C.ink:C.inkMid,
            boxShadow:noteTab===id?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>
            <MI n={ic} size={13}/>{l}
          </button>
        ))}
      </div>

      {/* ── 팀 게시판 ── */}
      {noteTab==="board"&&(
      <Card>
        <CardTitle title={<><MI n="edit_note" size={14}/> 팀 게시판</>} sub={`${(posts||[]).length}건`}/>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14,padding:"12px",background:C.cream,borderRadius:12}}>
          <textarea value={text} onChange={e=>setText(e.target.value)}
            placeholder="공지, 요청, 기획 아이디어, 인사이트..."
            style={{...inputStyle,resize:"vertical",minHeight:72,lineHeight:1.6,background:C.white}}/>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
            {CATS.map(c=>(
              <button key={c} onClick={()=>setCat(c)}
                style={{fontSize:10,padding:"3px 9px",borderRadius:20,fontFamily:"inherit",fontWeight:700,cursor:"pointer",
                border:`1px solid ${cat===c?CAT_COLORS[c]:C.border}`,
                background:cat===c?CAT_COLORS[c]:C.white,color:cat===c?C.white:C.inkMid}}>{c}</button>
            ))}
            <select value={assignee} onChange={e=>setAssignee(e.target.value)}
              style={{marginLeft:"auto",fontSize:10,padding:"4px 7px",borderRadius:8,border:`1px solid ${C.border}`,fontFamily:"inherit",background:C.white}}>
              <option value="">전체</option>
              {MEMBERS.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
            <Btn small onClick={addPost}>등록</Btn>
          </div>
        </div>
        <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>
          {["전체",...CATS].map(c=>(
            <button key={c} onClick={()=>setFilterCat(c)}
              style={{fontSize:10,padding:"3px 9px",borderRadius:20,fontFamily:"inherit",fontWeight:700,cursor:"pointer",
              border:`1px solid ${filterCat===c?(CAT_COLORS[c]||C.rose):C.border}`,
              background:filterCat===c?(CAT_COLORS[c]||C.rose):C.white,
              color:filterCat===c?C.white:C.inkMid}}>{c}</button>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.length===0&&<div style={{textAlign:"center",color:C.inkLt,fontSize:12,padding:"20px 0"}}>아직 등록된 내용이 없어요</div>}
          {filtered.map(p=>{
            const col=CAT_COLORS[p.cat]||C.inkMid;
            return(
            <div key={p.id} style={{borderRadius:10,border:`1px solid ${col}33`,background:C.white,padding:"11px 13px"}}>
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5}}>
                <span style={{fontSize:10,fontWeight:700,color:col,background:`${col}18`,padding:"2px 7px",borderRadius:10}}>{p.cat||"공통"}</span>
                {p.assignee&&<span style={{fontSize:10,color:C.inkMid}}><MI n="person" size={11}/>{p.assignee}</span>}
                <span style={{fontSize:9,color:C.inkLt,marginLeft:"auto"}}>{p.createdAt}</span>
                <button onClick={()=>setPosts(prev=>(prev||[]).filter(i=>i.id!==p.id))}
                  style={{fontSize:11,color:C.inkLt,background:"none",border:"none",cursor:"pointer"}}>✕</button>
              </div>
              <div style={{fontSize:12,color:C.ink,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{p.text}</div>
            </div>
            );
          })}
        </div>
      </Card>
      )}

      {/* ── 미팅 노트 ── */}
      {noteTab==="meeting"&&(
      <Card>
        <CardTitle title={<><MI n="mic" size={14}/> 미팅 노트</>} sub={`${(meetingNotes||[]).length}건`}
          action={<Btn small onClick={()=>{setMtForm({title:"",date:new Date().toISOString().slice(0,10),attendees:[],content:"",actions:"",htmlContent:"",htmlFileName:"",summary:""});setMtModal(true);}}>+ 새 미팅</Btn>}/>
        {(meetingNotes||[]).length===0&&<div style={{textAlign:"center",color:C.inkLt,fontSize:12,padding:"24px 0"}}>미팅 노트를 추가해보세요</div>}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {(meetingNotes||[]).map(m=>(
            <div key={m.id} style={{borderRadius:12,border:`1px solid ${C.border}`,background:C.white,padding:"14px"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
                <div>
                  <div style={{fontSize:13,fontWeight:800,color:C.ink}}>{m.title}</div>
                  <div style={{fontSize:10,color:C.inkLt,marginTop:2}}>
                    <MI n="calendar_today" size={10}/> {m.date}
                    {m.attendees?.length>0&&<span style={{marginLeft:8}}><MI n="group" size={10}/> {m.attendees.join(", ")}</span>}
                  </div>
                </div>
                <div style={{display:"flex",gap:4}}>
                  <button onClick={()=>{setMtForm({...m});setMtModal(true);}}
                    style={{fontSize:11,color:C.inkMid,background:"none",border:"none",cursor:"pointer",padding:"2px 6px"}}><MI n="edit" size={13}/></button>
                  <button onClick={()=>setMeetingNotes(prev=>(prev||[]).filter(i=>i.id!==m.id))}
                    style={{fontSize:11,color:C.inkLt,background:"none",border:"none",cursor:"pointer"}}>✕</button>
                </div>
              </div>
              {m.content&&<div style={{fontSize:12,color:C.ink,lineHeight:1.7,whiteSpace:"pre-wrap",marginBottom:8,padding:"8px 10px",background:C.cream,borderRadius:8}}>{m.content}</div>}
              {m.actions&&(
                <div style={{fontSize:11,color:"#7c3aed",padding:"6px 10px",background:"#f5f3ff",borderRadius:8}}>
                  <MI n="checklist" size={11}/> <strong>액션아이템:</strong> {m.actions}
                </div>
              )}
              {/* HTML 첨부 파일 표시 */}
              {m.htmlContent&&(
                <div style={{marginTop:10}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:11,fontWeight:700,color:C.inkMid}}><MI n="attach_file" size={11}/> {m.htmlFileName||"첨부 파일"}</span>
                    <button onClick={()=>{const blob=new Blob([m.htmlContent],{type:"text/html;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=(m.htmlFileName||m.title||"미팅")+".html";document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);}}
                      style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:8,border:`1px solid ${C.border}`,
                        background:C.cream,color:C.inkMid,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
                      <MI n="download" size={12}/> 다운로드
                    </button>
                  </div>
                  <iframe srcDoc={m.htmlContent} style={{width:"100%",height:420,border:`1px solid ${C.border}`,borderRadius:10,background:"#fff"}} sandbox="allow-scripts allow-same-origin" title="미팅자료"/>
                </div>
              )}
              {/* 미팅 종료 후 정리내용 */}
              <div style={{marginTop:10,borderTop:`1px solid ${C.border}`,paddingTop:10}}>
                <div style={{fontSize:11,fontWeight:700,color:C.inkMid,marginBottom:4}}><MI n="summarize" size={12}/> 정리내용 (미팅 후)</div>
                <textarea value={m.summary||""} onChange={e=>{const v=e.target.value;setMeetingNotes(prev=>(prev||[]).map(n=>n.id===m.id?{...n,summary:v}:n));}}
                  placeholder="미팅 종료 후 결론, 다음 스텝, 주요 결정사항 등 정리"
                  style={{width:"100%",fontSize:12,padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,
                    fontFamily:"inherit",outline:"none",boxSizing:"border-box",resize:"vertical",minHeight:80,lineHeight:1.7,background:C.cream}}/>
              </div>
            </div>
          ))}
        </div>
      </Card>
      )}

      {/* ── 미팅 노트 모달 ── */}
      {mtModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:0}}
          onClick={()=>{setMtModal(false);stopRecording();}}>
          <div style={{background:C.white,borderRadius:"20px 20px 0 0",padding:"20px 16px 32px",width:"100%",maxWidth:480,maxHeight:"85vh",overflowY:"auto"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div style={{fontSize:14,fontWeight:800,color:C.ink}}><MI n="mic" size={14}/> 미팅 노트</div>
              <button onClick={()=>{setMtModal(false);stopRecording();}} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:C.inkLt}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>제목</div>
                <input value={mtForm.title} onChange={e=>setMtForm(p=>({...p,title:e.target.value}))} placeholder="ex. 3월 4주차 주간 미팅" style={inputStyle}/>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>날짜</div>
                <input type="date" value={mtForm.date} onChange={e=>setMtForm(p=>({...p,date:e.target.value}))} style={inputStyle}/>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:6}}>참석자</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {MEMBERS.map(m=>(
                    <button key={m} onClick={()=>setMtForm(p=>({...p,attendees:p.attendees.includes(m)?p.attendees.filter(a=>a!==m):[...p.attendees,m]}))}
                      style={{fontSize:11,padding:"5px 12px",borderRadius:20,fontFamily:"inherit",fontWeight:700,cursor:"pointer",
                      border:`1px solid ${mtForm.attendees.includes(m)?C.rose:C.border}`,
                      background:mtForm.attendees.includes(m)?C.rose:C.white,
                      color:mtForm.attendees.includes(m)?C.white:C.inkMid}}>{m}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.inkMid}}>내용</div>
                  {recSupported&&(
                    <button onClick={recording?stopRecording:startRecording}
                      style={{display:"flex",alignItems:"center",gap:4,fontSize:10,fontWeight:700,padding:"4px 10px",borderRadius:20,
                      border:`1px solid ${recording?"#dc2626":C.border}`,
                      background:recording?"#fef2f2":C.white,
                      color:recording?"#dc2626":C.inkMid,cursor:"pointer",fontFamily:"inherit"}}>
                      <MI n={recording?"stop":"mic"} size={12}/>
                      {recording?"녹음 중지":"녹음 시작"}
                      {recording&&<span style={{width:6,height:6,borderRadius:"50%",background:"#dc2626",animation:"pulse 1s infinite",display:"inline-block"}}/>}
                    </button>
                  )}
                </div>
                <textarea value={mtForm.content} onChange={e=>setMtForm(p=>({...p,content:e.target.value}))}
                  placeholder={recSupported?"녹음 시작 버튼을 누르면 자동으로 텍스트로 변환돼요":"미팅 내용을 입력해주세요"}
                  style={{...inputStyle,resize:"vertical",minHeight:120,lineHeight:1.7}}/>
                {recording&&<div style={{fontSize:10,color:"#dc2626",marginTop:4}}><MI n="mic" size={10}/> 녹음 중... 말하면 자동으로 입력돼요</div>}
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>액션아이템</div>
                <textarea value={mtForm.actions} onChange={e=>setMtForm(p=>({...p,actions:e.target.value}))}
                  placeholder="ex. 소리 - 소재 3개 제작 / 영서 - 광고 세팅 확인"
                  style={{...inputStyle,resize:"vertical",minHeight:60,lineHeight:1.6}}/>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:C.inkMid,marginBottom:4}}>HTML 자료 첨부</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button onClick={()=>mtHtmlRef.current?.click()}
                    style={{fontSize:11,fontWeight:700,padding:"6px 12px",borderRadius:8,border:`1px solid ${C.border}`,
                      background:mtForm.htmlContent?C.sage+"22":C.cream,color:mtForm.htmlContent?C.sage:C.inkMid,
                      cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
                    <MI n="attach_file" size={13}/>{mtForm.htmlContent?`✓ ${mtForm.htmlFileName||"파일 첨부됨"}`:"HTML 파일 업로드"}
                  </button>
                  {mtForm.htmlContent&&<button onClick={()=>setMtForm(p=>({...p,htmlContent:"",htmlFileName:""}))}
                    style={{fontSize:10,color:C.inkLt,background:"none",border:"none",cursor:"pointer"}}>✕</button>}
                  <input ref={mtHtmlRef} type="file" accept=".html,.htm" style={{display:"none"}} onChange={handleHtmlUpload}/>
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <Btn onClick={saveMeeting} style={{flex:1}}>저장</Btn>
              <Btn variant="ghost" onClick={()=>{setMtModal(false);stopRecording();}} style={{flex:1}}>취소</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
    );
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔍 경쟁사 키워드 트래킹
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const KeywordSection = (() => {
    const keywords = kwData?.keywords || [];
    const logs = kwData?.logs || [];
    const [addKwModal, setAddKwModal] = useState(false);
    const [kwInput, setKwInput] = useState("");
    const [compInput, setCompInput] = useState("");
    const [kwTab, setKwTab] = useState("all"); // all | my | competitor
    const [selectedKw, setSelectedKw] = useState(null);
    const [logModal, setLogModal] = useState(false);
    const [logKwId, setLogKwId] = useState(null);
    const [logRank, setLogRank] = useState("");
    const [logVol, setLogVol] = useState("");
    const [logNote, setLogNote] = useState("");
    const [logDate, setLogDate] = useState(new Date().toISOString().slice(0,10));
    const [naverLoading, setNaverLoading] = useState(false);
    const [naverResult, setNaverResult] = useState({}); // {keyword: {pcMonthly, mobileMonthly}}
    const [rankLoading, setRankLoading] = useState(false);
    const [autoRank, setAutoRank] = useState({}); // {keyword: {rank, matchedProduct, topItems}}
    const [rankModal, setRankModal] = useState(null); // keyword name
    const [searchInput, setSearchInput] = useState("");
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchResults, setSearchResults] = useState(null); // null | []
    const [mainTab, setMainTab] = useState("track"); // track | explore | market | musinsa
    const [musinsaItems, setMusinsaItems] = useState(null);
    const [musinsaLoading, setMusinsaLoading] = useState(false);
    const [musinsaRunning, setMusinsaRunning] = useState(false);
    const [musinsaLinks, setMusinsaLinks] = useState(null);
    const [musinsaTab, setMusinsaTab] = useState("prices"); // prices | links
    const [newLinkUrl, setNewLinkUrl] = useState("");
    const [newLinkKeyword, setNewLinkKeyword] = useState("");
    const [oliveyoungItems, setOliveyoungItems] = useState(null);
    const [oliveyoungLoading, setOliveyoungLoading] = useState(false);
    const [oliveyoungLinks, setOliveyoungLinks] = useState(null);
    const [oliveyoungTab, setOliveyoungTab] = useState("prices");
    const [newOliveUrl, setNewOliveUrl] = useState("");
    const [newOliveKeyword, setNewOliveKeyword] = useState("");
    const [editingLinkId, setEditingLinkId] = useState(null);
    const [editingLinkKeyword, setEditingLinkKeyword] = useState("");
    const [editingOliveId, setEditingOliveId] = useState(null);
    const [editingOliveKeyword, setEditingOliveKeyword] = useState("");
    // 통합 시장가 플랫폼 UI
    const PLATFORM_TAB_MAP = {"🫒올리브영":"oliveyoung","🛍무신사":"musinsa","👗지그재그":"zigzag","🎀에이블리":"ably","🎁카카오선물하기":"kakao_gift"};
    const [mktPlatformTab, setMktPlatformTab] = useState("prices"); // prices | links
    const [mktPlatformPrices, setMktPlatformPrices] = useState({});
    const [mktPlatformLinks, setMktPlatformLinks] = useState({});
    const [mktPlatformLoading, setMktPlatformLoading] = useState({});
    const [mktPlatformRunning, setMktPlatformRunning] = useState({});
    const [mktAllRunning, setMktAllRunning] = useState(false);
    const [mktNewCategory, setMktNewCategory] = useState("");
    const [mktCompareData, setMktCompareData] = useState(null); // {prices:[], links:[]}
    const [mktCompareLoading, setMktCompareLoading] = useState(false);
    const [mktCompLinkOpen, setMktCompLinkOpen] = useState(null); // prodId | null
    const [mktCompLinkSearch, setMktCompLinkSearch] = useState("");
    const [mktOurProds, setMktOurProds] = useState(null); // null=미로드
    const [mktOurProdsLoading, setMktOurProdsLoading] = useState(false);
    const [mktOurProdInput, setMktOurProdInput] = useState({name:"",category:"드라이기",ourPrice:""});
    const MKT_COMPARE_TAB = "📊시장비교";
    const [mktNewUrl, setMktNewUrl] = useState("");
    const [mktNewKeyword, setMktNewKeyword] = useState("");
    const [mktEditId, setMktEditId] = useState(null);
    const [mktEditKeyword, setMktEditKeyword] = useState("");
    const [marketData, setMarketData] = useSyncState("oa_market_research_v1", []);
    const [mktProductModal, setMktProductModal] = useState(false);
    const [mktBulkModal, setMktBulkModal] = useState(false);
    const COLOR_SUFFIXES = /[-\s]*(베이지|화이트|핑크|블랙|퍼플|블루|아이보리|레드|그린|옐로우|골드|실버|그레이|민트|라벤더|코랄|스카이|네이비|브라운|오렌지|크림|카키|연두|하늘|노랑|노랑이|파랑|보라|빨강|초록|검정|흰색|흰|검|살구|연핑크|딥블루|버건디|샴페인|카멜|머스타드|파우더|누드|앤틱|올리브|바이올렛|라일락|로즈|루비|에메랄드|틸|세이지|차콜|슬레이트|애쉬|인디고|테라코타|샌드|스모키|젯블랙)+$/gi;
    function stripColor(name) { return name.replace(COLOR_SUFFIXES, "").trim(); }
    const [mktBulkText, setMktBulkText] = useState("");
    const [mktBulkCategory, setMktBulkCategory] = useState("우리브랜드");
    const [mktProductInput, setMktProductInput] = useState({name:"",ourPrice:""});
    const [mktItemModal, setMktItemModal] = useState(null); // {productId, itemId?} | null
    const [mktItemInput, setMktItemInput] = useState({channel:"스마트스토어",productName:"",url:"",image:"",regularPrice:"",salePrice:"",promotion:"",note:""});
    const [mktOgFetching, setMktOgFetching] = useState(false);
    const [mktFetching, setMktFetching] = useState({}); // {itemId: true}
    const [mktEditCell, setMktEditCell] = useState(null); // {productId, itemId, field}
    const [mktEditValue, setMktEditValue] = useState("");
    const [mktCategoryTab, setMktCategoryTab] = useState("드라이기");
    const MKT_CATEGORIES = ["드라이기","고데기","케어제품","우리브랜드"];
    const MKT_FAV_TAB = "⭐즐겨찾기";
    const [mktFavUpdating, setMktFavUpdating] = useState(false);
    const MKT_PRICE_TAB = "🔍최저가체크";
    const MKT_OLIVE_TAB = "🫒올리브영";
    const MKT_MUSINSA_TAB = "🛍무신사";
    const [mktPriceUpdating, setMktPriceUpdating] = useState(false);
    const [mktLastUpdateAt, setMktLastUpdateAt] = useSyncState("oa_mkt_last_update_v1", null);
    const [mktPriceCatFilter, setMktPriceCatFilter] = useState("전체");
    const [mktOurBrandFilter, setMktOurBrandFilter] = useState("전체");
    const [mktAutoFetching, setMktAutoFetching] = useState({}); // {prodId: true}
    const [mktSearchQuery, setMktSearchQuery] = useState({}); // {prodId: "검색어"}
    const [mktModalSearch, setMktModalSearch] = useState(""); // 모달 내 검색어
    const [mktModalResults, setMktModalResults] = useState([]); // 모달 내 검색 결과
    const [mktModalSearching, setMktModalSearching] = useState(false);
    const CHANNELS = ["스마트스토어","쿠팡","무신사","올리브영","에이블리","지그재그","11번가","G마켓","기타"];

    const CHANNEL_MALL_DETECT = [
      {channel:"스마트스토어", keywords:["스마트스토어","네이버쇼핑","smartstore"]},
      {channel:"쿠팡",         keywords:["쿠팡","coupang"]},
      {channel:"무신사",       keywords:["무신사","musinsa"]},
      {channel:"올리브영",     keywords:["올리브영","oliveyoung"]},
      {channel:"에이블리",     keywords:["에이블리","ably"]},
      {channel:"지그재그",     keywords:["지그재그","zigzag"]},
      {channel:"11번가",       keywords:["11번가","11st"]},
      {channel:"G마켓",        keywords:["g마켓","gmarket","지마켓"]},
    ];
    function detectMallChannel(mallName) {
      const m = (mallName||"").toLowerCase();
      for(const {channel,keywords} of CHANNEL_MALL_DETECT) {
        if(keywords.some(k=>m.includes(k))) return channel;
      }
      return "기타";
    }

    async function autoFillCompetitors(prodId, searchQ, ourPrice, isOurBrand=false) {
      if(!searchQ?.trim()) return;
      setMktAutoFetching(p=>({...p,[prodId]:true}));
      try {
        // 쉼표로 구분된 여러 검색어 병렬 실행
        const queries = searchQ.split(",").map(q=>q.trim()).filter(Boolean);
        const results = await Promise.all(
          queries.map(q=>fetch(`/api/naver-rank?query=${encodeURIComponent(q)}`).then(r=>r.json()).catch(()=>({})))
        );
        const allTopItems = results.flatMap(d=>d.topItems||[]);
        if(!allTopItems.length) return;
        // 전체 결과에서 단일 query 변수로 키워드 필터 적용 (모든 쿼리 키워드 통합)
        const query = queries.join(" ");

        const OA_KW = ["오아","oa ","oabeauty","소닉플로우","프리온","에어리소닉"];
        const queryWords = query.toLowerCase().split(/\s+/).filter(w=>w.length>=2);
        const filtered = allTopItems.filter(it=>{
          const title = (it.title||"").replace(/<[^>]+>/g,"").toLowerCase();
          const text = [title,(it.mallName||""),(it.brand||"")].join(" ").toLowerCase();
          const isOA = OA_KW.some(k=>text.includes(k));
          if(isOurBrand) {
            // 우리 브랜드 탭: OA 제품만 포함
            if(!isOA) return false;
          } else {
            // 경쟁사 탭: OA 제품 제외
            if(isOA) return false;
            // 가격 범위 필터
            if(ourPrice && it.lprice) {
              const ratio = it.lprice / ourPrice;
              if(ratio < 0.4 || ratio > 1.6) return false;
            }
          }
          if(queryWords.length && !queryWords.some(w=>title.includes(w))) return false;
          return true;
        });

        // 쇼핑몰별 최저가 1개
        const byMall = {};
        for(const it of filtered) {
          const mall = it.mallName||"기타";
          if(!byMall[mall] || (it.lprice && it.lprice < byMall[mall].lprice)) byMall[mall] = it;
        }

        const newItems = Object.values(byMall).map(it=>({
          id: Date.now().toString() + Math.random().toString(36).slice(2),
          channel: detectMallChannel(it.mallName),
          productName: (it.title||"").replace(/<[^>]+>/g,"").slice(0,40),
          url: it.link||"",
          image: it.image||"",
          regularPrice: it.lprice||null,
          salePrice: it.lprice||null,
          promotion: "",
          note: "",
          lastChecked: new Date().toISOString().slice(0,10),
          naverItems: [],
        }));

        if(!newItems.length) return;

        setMarketData(prev=>(prev||[]).map(p=>{
          if(p.id!==prodId) return p;
          // 이미 같은 productName 있으면 스킵
          const existNames = new Set((p.items||[]).map(i=>(i.productName||"").toLowerCase()));
          const existMalls = new Set((p.items||[]).map(i=>(i.mallName||i.channel||"").toLowerCase()));
          const toAdd = newItems.filter(ni=>{
            if(existNames.has((ni.productName||"").toLowerCase())) return false;
            if((ni.mallName||ni.channel) && existMalls.has((ni.mallName||ni.channel||"").toLowerCase())) return false;
            return true;
          });
          return {...p, items:[...(p.items||[]),...toAdd]};
        }));
      } catch(e) { /* silent */ }
      setMktAutoFetching(p=>({...p,[prodId]:false}));
    }

    async function updateFavPrices() {
      const today = new Date().toISOString().slice(0,10);
      const allData = marketData||[];
      const favItems = allData.flatMap(p=>(p.items||[]).filter(i=>i.favorite).map(i=>({prodId:p.id,item:i})));
      if(!favItems.length) return;
      setMktFavUpdating(true);
      try {
        await Promise.all(favItems.map(async({prodId,item})=>{
          const query = (item.productName||"").trim();
          if(!query) return;
          try {
            const params = new URLSearchParams({query});
            if(item.url) params.set("url",item.url);
            if(item.channel) params.set("channel",item.channel);
            const res = await fetch(`/api/price-check?${params}`);
            const data = await res.json();
            if(data.error||!data.salePrice) return;
            setMarketData(prev=>(prev||[]).map(p=>p.id!==prodId?p:{
              ...p, items:(p.items||[]).map(i=>i.id!==item.id?i:{
                ...i,
                salePrice: data.salePrice,
                lastChecked: today,
                priceHistory: [...((i.priceHistory||[]).filter(h=>h.date!==today)),{date:today,price:data.salePrice}].slice(-30),
              })
            }));
          } catch(e){}
        }));
      } catch(e){}
      setMktFavUpdating(false);
    }

    async function updateOurBrandPrices() {
      const today = new Date().toISOString().slice(0,10);
      const allData = marketData||[];
      const ourProds = allData.filter(p=>p.category==="우리브랜드");
      const allItems = ourProds.flatMap(p=>(p.items||[]).map(i=>({prodId:p.id,item:i})));
      if(!allItems.length) return;
      setMktPriceUpdating(true);
      try {
        await Promise.all(allItems.map(async({prodId,item})=>{
          const query = (item.productName||"").trim();
          if(!query) return;
          try {
            const params = new URLSearchParams({query});
            if(item.url) params.set("url",item.url);
            if(item.channel) params.set("channel",item.channel);
            const res = await fetch(`/api/price-check?${params}`);
            const data = await res.json();
            if(data.error||!data.salePrice) return;
            const topItem = data.items?.[0] || null;
            setMarketData(prev=>(prev||[]).map(p=>p.id!==prodId?p:{
              ...p, items:(p.items||[]).map(i=>i.id!==item.id?i:{
                ...i,
                salePrice: data.salePrice,
                naverPrice: data.salePrice,
                lastChecked: today,
                checkedMallName: topItem?.mallName || null,
                naverLink: topItem?.link || null,
                priceHistory:[...((i.priceHistory||[]).filter(h=>h.date!==today)),{date:today,price:data.salePrice}].slice(-30),
              })
            }));
          } catch(e){}
        }));
      } catch(e){}
      setMktPriceUpdating(false);
      setMktLastUpdateAt(new Date().toLocaleString("ko-KR",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}));
    }

    async function searchMktModal(q) {
      if(!q?.trim()) return;
      setMktModalSearching(true);
      setMktModalResults([]);
      try {
        const res = await fetch(`/api/naver-rank?query=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        if(data.error) { alert("검색 오류: "+data.error); return; }
        setMktModalResults(data.topItems?.slice(0,8)||[]);
      } catch(e) {}
      setMktModalSearching(false);
    }

    async function fetchOgImage(url) {
      if(!url?.trim()) return;
      setMktOgFetching(true);
      try {
        const res = await fetch(`/api/og-image?url=${encodeURIComponent(url.trim())}`);
        const data = await res.json();
        if(data.image) setMktItemInput(p=>({...p,image:data.image}));
        else alert("이미지를 자동으로 가져오지 못했어요. URL을 직접 입력해주세요.");
      } catch(e) { alert("오류: "+e.message); }
      setMktOgFetching(false);
    }

    function saveMktCell(productId, itemId, field, value) {
      setMarketData((marketData||[]).map(p=>p.id!==productId?p:{
        ...p, items:(p.items||[]).map(i=>i.id!==itemId?i:{...i,[field]:value})
      }));
      setMktEditCell(null);
    }

    async function fetchMarketPrice(productId, itemId) {
      const allData = marketData||[];
      const prod = allData.find(p=>p.id===productId);
      const item = prod?.items?.find(i=>i.id===itemId);
      const query = (item?.productName||"").trim() || (prod?.name||"").trim();
      if(!query) { alert("제품명을 먼저 입력해주세요"); return; }
      setMktFetching(prev=>({...prev,[itemId]:true}));
      try {
        const params = new URLSearchParams();
        params.set("query", query);
        if((item?.url||"").trim()) params.set("url", item.url.trim());
        if((item?.channel||"").trim()) params.set("channel", item.channel.trim());
        const res = await fetch(`/api/price-check?${params.toString()}`);
        const data = await res.json();
        if(data.error) { alert("가격 조회 실패: "+data.error); return; }
        const topItem = data.items?.[0] || null;
        const updated = allData.map(p=>p.id!==productId?p:{
          ...p, items: (p.items||[]).map(i=>i.id!==itemId?i:{
            ...i,
            naverPrice: data.salePrice || i.naverPrice,
            checkedMallName: topItem?.mallName || i.checkedMallName,
            naverLink: topItem?.link || i.naverLink,
            channel: data.channel || i.channel,
            lastChecked: new Date().toISOString().slice(0,10),
            naverItems: data.items || [],
          })
        });
        setMarketData(updated);
      } catch(e) { alert("오류: "+e.message); }
      setMktFetching(prev=>({...prev,[itemId]:false}));
    }

    // OA 고정 키워드 보장
    const OA_FIXED = {id:"oa-fixed",name:"OA",competitor:"",color:"#2563EB",type:"my",addedAt:"",fixed:true};
    useEffect(()=>{
      if(!(kwData?.keywords||[]).some(k=>k.id==="oa-fixed")){
        setKwData({...kwData, keywords:[OA_FIXED,...(kwData?.keywords||[])]});
      }
    // eslint-disable-next-line
    },[]);

    async function searchKeywords(overrideQuery) {
      const q = (overrideQuery || searchInput).trim();
      if(!q) return;
      setSearchLoading(true);
      setSearchResults(null);
      try {
        const res = await fetch(`/api/naver-keywords?keywords=${encodeURIComponent(q)}`);
        const data = await res.json();
        if(data.error) { alert("네이버 API: "+data.error); return; }
        setSearchResults(data.keywords || []);
      } catch(e) { alert("오류: "+e.message); }
      setSearchLoading(false);
    }

    async function fetchAutoRank() {
      if(!keywords.length) return;
      setRankLoading(true);
      try {
        const map = {};
        const naverVolMap = {};
        const today = new Date().toISOString().slice(0,10);
        const newLogs = [];
        await Promise.all(keywords.map(async kw => {
          const brand = kw.competitor || "오아";
          // 순위: 키워드만으로 검색, 결과에서 브랜드 위치 찾기
          const rankRes  = await fetch(`/api/naver-rank?query=${encodeURIComponent(kw.name)}&brand=${encodeURIComponent(brand)}`);
          const rankData = await rankRes.json();

          map[kw.name] = { rank: rankData.rank, matchedProduct: rankData.matchedProduct, matchedMall: rankData.matchedMall, total: rankData.total, topItems: rankData.topItems||[], brand };

          // 검색량: 브랜드+키워드로 조회
          let volume = 0;
          try {
            const volQuery = brand + kw.name;
            const volRes = await fetch(`/api/naver-keywords?keywords=${encodeURIComponent(volQuery)}`);
            const volData = await volRes.json();
            if(!volData.error && volData.keywords?.length) {
              const norm = s => (s||"").toLowerCase().replace(/\s/g,"");
              const exact = volData.keywords.find(k=>norm(k.keyword)===norm(volQuery));
              const result = exact || volData.keywords[0];
              if(result) {
                volume = (result.pcMonthly||0) + (result.mobileMonthly||0);
                naverVolMap[kw.name] = result;
              }
            }
          } catch(_) {}

          // 순위 기록 자동 저장 (순위 또는 검색량이 있을 때)
          if(rankData.rank || volume > 0) {
            newLogs.push({ keywordId: kw.id, date: today, rank: rankData.rank||null, volume, brand });
          }
        }));
        setAutoRank(map);
        if(Object.keys(naverVolMap).length>0) setNaverResult(prev=>({...prev,...naverVolMap}));
        if(newLogs.length>0) {
          // 오늘 자동기록이 이미 있으면 업데이트, 없으면 새로 추가
          const existingLogs = kwData?.logs||[];
          const updatedLogs = existingLogs.map(l => {
            const match = newLogs.find(nl=>nl.keywordId===l.keywordId && nl.date===today && l.auto);
            if(match) return { ...l, rank: match.rank??l.rank, volume: match.volume||l.volume };
            return l;
          });
          const addedIds = new Set(existingLogs.filter(l=>l.date===today&&l.auto).map(l=>l.keywordId));
          const toAdd = newLogs.filter(nl=>!addedIds.has(nl.keywordId)).map(nl=>({
            id: Date.now()+"-"+nl.keywordId, ...nl, note: "자동조회", auto: true,
          }));
          setKwData({ ...kwData, logs: [...updatedLogs, ...toAdd] });
        }
      } catch(e) { alert("순위 조회 오류: "+e.message); }
      setRankLoading(false);
    }

    async function fetchNaverVolume() {
      if(!keywords.length) return;
      setNaverLoading(true);
      try {
        const map = {};
        await Promise.all(keywords.map(async kw => {
          // 검색량: 브랜드명+키워드로 검색
          const brand2 = kw.competitor || "오아";
          const volQuery = brand2+kw.name;
          const res  = await fetch(`/api/naver-keywords?keywords=${encodeURIComponent(volQuery)}`);
          const data = await res.json();
          if(data.error) return;
          const norm = s => (s||"").toLowerCase().replace(/\s/g,"");
          const exact = (data.keywords||[]).find(k=>norm(k.keyword)===norm(volQuery));
          const result = exact || data.keywords?.[0];
          if(result) map[kw.name] = result;
        }));
        setNaverResult(map);
      } catch(e) { alert("오류: "+e.message); }
      setNaverLoading(false);
    }

    const COLORS = ["#2563EB","#16A34A","#EA580C","#8B5CF6","#EC4899","#0891B2","#D97706","#DC2626"];

    function addKeyword() {
      if (!kwInput.trim()) return;
      const newKw = {
        id: Date.now()+"",
        name: kwInput.trim(),
        competitor: compInput.trim(),
        color: COLORS[keywords.length % COLORS.length],
        type: compInput.trim() ? "competitor" : "my",
        addedAt: new Date().toISOString().slice(0,10),
      };
      setKwData({ ...kwData, keywords: [...keywords, newKw] });
      setKwInput(""); setCompInput(""); setAddKwModal(false);
    }

    function deleteKeyword(id) {
      setKwData({
        keywords: keywords.filter(k=>k.id!==id),
        logs: logs.filter(l=>l.keywordId!==id),
      });
    }

    function addLog() {
      if (!logKwId || !logRank) return;
      const newLog = {
        id: Date.now()+"",
        keywordId: logKwId,
        date: logDate,
        rank: parseInt(logRank) || 0,
        volume: parseInt(logVol) || 0,
        note: logNote.trim(),
      };
      setKwData({ ...kwData, logs: [...logs, newLog] });
      setLogRank(""); setLogVol(""); setLogNote(""); setLogModal(false);
    }

    // 키워드별 최신 순위 + 이전 대비 변화
    const kwStats = keywords.map(kw => {
      const kwLogs = logs.filter(l=>l.keywordId===kw.id).sort((a,b)=>a.date.localeCompare(b.date));
      const latest = kwLogs[kwLogs.length-1];
      const prev   = kwLogs[kwLogs.length-2];
      const change = latest && prev ? prev.rank - latest.rank : null; // 양수=순위 올라감
      return { ...kw, latest, prev, change, logs: kwLogs };
    });

    const filtered = kwTab==="my" ? kwStats.filter(k=>k.type==="my")
      : kwTab==="competitor" ? kwStats.filter(k=>k.type==="competitor")
      : kwStats;

    // 차트용 데이터: 선택된 키워드들의 날짜별 순위
    const chartKws = selectedKw ? kwStats.filter(k=>k.id===selectedKw) : kwStats.slice(0,5);
    const allDates = [...new Set(logs.map(l=>l.date))].sort();
    const chartData = allDates.map(date => {
      const entry = { date: date.slice(5) }; // MM-DD
      chartKws.forEach(kw => {
        const log = kw.logs.find(l=>l.date===date);
        if(log) entry[kw.name] = log.rank;
      });
      return entry;
    });

    const fmtChange = c => {
      if(c===null) return null;
      if(c>0) return { text:`▲${c}`, color:C.good };
      if(c<0) return { text:`▼${Math.abs(c)}`, color:C.bad };
      return { text:"—", color:C.inkLt };
    };

    return (
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {/* 헤더 */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontSize:20,fontWeight:900,color:C.ink}}>키워드 관리</div>
            <div style={{fontSize:12,color:C.inkMid,marginTop:2}}>네이버 검색광고 API 연동 · 검색량 조회 및 순위 트래킹</div>
          </div>
          {mainTab==="track"&&(
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Btn variant="neutral" small onClick={fetchAutoRank} disabled={rankLoading||keywords.length===0}>
                <MI n="military_tech" size={13}/> {rankLoading?"조회 중...":"순위 조회"}
              </Btn>
              <Btn variant="sage" small onClick={()=>{setLogKwId(keywords[0]?.id||null);setLogModal(true);}}>
                <MI n="edit_note" size={13}/> 순위 기록
              </Btn>
              <Btn small onClick={()=>setAddKwModal(true)}>
                <MI n="add" size={13}/> 키워드 추가
              </Btn>
            </div>
          )}
        </div>

        {/* 메인 탭 */}
        <div style={{display:"flex",gap:4,background:C.cream,borderRadius:12,padding:4,width:"fit-content"}}>
          {[{id:"track",label:"순위 트래킹"},{id:"explore",label:"키워드 탐색"},{id:"market",label:"시장가 조사"}].map(t=>(
            <button key={t.id} onClick={()=>setMainTab(t.id)} style={{
              fontSize:12,fontWeight:700,padding:"6px 18px",borderRadius:8,border:"none",cursor:"pointer",
              background:mainTab===t.id?C.rose:"transparent",
              color:mainTab===t.id?"#fff":C.inkMid,fontFamily:"inherit",
            }}>{t.label}</button>
          ))}
        </div>

        {/* 키워드 탐색 탭 */}
        {mainTab==="explore"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Card>
              <CardTitle title="키워드 탐색" sub="키워드 입력 → 연관 키워드 + 월간 검색량 + 경쟁도 조회"/>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                <input
                  value={searchInput}
                  onChange={e=>setSearchInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&searchKeywords()}
                  placeholder="예: 헤어드라이기, 소닉플로우"
                  style={{flex:1,padding:"9px 14px",borderRadius:10,border:`1px solid ${C.border}`,
                    fontSize:13,fontFamily:"inherit",color:C.ink,outline:"none"}}
                />
                <Btn onClick={searchKeywords} disabled={searchLoading||!searchInput.trim()}>
                  <MI n="search" size={13}/> {searchLoading?"조회 중...":"검색"}
                </Btn>
              </div>
              {searchResults===null&&!searchLoading&&(
                <div style={{textAlign:"center",padding:"24px 0",color:C.inkLt,fontSize:13}}>
                  키워드를 입력하고 검색하면 연관 키워드와 검색량을 볼 수 있어요
                </div>
              )}
              {searchLoading&&(
                <div style={{textAlign:"center",padding:"24px 0",color:C.inkMid,fontSize:13}}>조회 중...</div>
              )}
              {searchResults!==null&&!searchLoading&&(
                searchResults.length===0 ? (
                  <div style={{textAlign:"center",padding:"20px 0",color:C.inkLt,fontSize:13}}>결과가 없어요</div>
                ) : (
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead>
                        <tr style={{background:C.cream}}>
                          {["키워드","PC 월검색","모바일 월검색","합계","경쟁도","추가"].map(h=>(
                            <th key={h} style={{padding:"7px 10px",textAlign:"left",fontWeight:700,color:C.inkMid,
                              borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.sort((a,b)=>(b.pcMonthly+b.mobileMonthly)-(a.pcMonthly+a.mobileMonthly)).map((k,i)=>{
                          const total = (k.pcMonthly||0)+(k.mobileMonthly||0);
                          const compColor = k.competition==="HIGH"?C.bad:k.competition==="MID"?C.warn:C.good;
                          const compLabel = k.competition==="HIGH"?"높음":k.competition==="MID"?"중간":"낮음";
                          const alreadyTracked = keywords.some(kw=>kw.name===k.keyword);
                          return (
                            <tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
                              <td style={{padding:"7px 10px",fontWeight:700,color:C.ink}}>{k.keyword}</td>
                              <td style={{padding:"7px 10px",color:C.inkMid}}>{(k.pcMonthly||0).toLocaleString()}</td>
                              <td style={{padding:"7px 10px",color:C.inkMid}}>{(k.mobileMonthly||0).toLocaleString()}</td>
                              <td style={{padding:"7px 10px",fontWeight:800,color:C.ink}}>{total.toLocaleString()}</td>
                              <td style={{padding:"7px 10px"}}>
                                <span style={{fontSize:11,fontWeight:700,color:compColor,background:compColor+"18",
                                  padding:"2px 8px",borderRadius:20}}>{compLabel}</span>
                              </td>
                              <td style={{padding:"7px 10px"}}>
                                {alreadyTracked ? (
                                  <span style={{fontSize:11,color:C.inkLt}}>트래킹 중</span>
                                ) : (
                                  <button onClick={()=>{
                                    const newKw={id:Date.now()+"",name:k.keyword,competitor:"",
                                      color:["#2563EB","#16A34A","#EA580C","#8B5CF6","#EC4899"][keywords.length%5],
                                      type:"my",addedAt:new Date().toISOString().slice(0,10)};
                                    setKwData({...kwData,keywords:[...keywords,newKw]});
                                  }} style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:8,
                                    border:`1px solid ${C.rose}`,color:C.rose,background:"#fff",cursor:"pointer",fontFamily:"inherit"}}>
                                    + 트래킹
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div style={{marginTop:8,fontSize:11,color:C.inkLt}}>총 {searchResults.length}개 연관 키워드 · 네이버 검색광고 API 기준</div>
                  </div>
                )
              )}
            </Card>
          </div>
        )}

        {/* ── 시장가 조사 탭 ── */}
        {mainTab==="market"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {/* 제품 추가 모달 */}
            {mktProductModal&&(
              <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setMktProductModal(false)}>
                <div style={{background:C.white,borderRadius:14,padding:20,width:280,boxShadow:"0 8px 32px rgba(0,0,0,0.18)"}} onClick={e=>e.stopPropagation()}>
                  <div style={{fontSize:13,fontWeight:800,marginBottom:14}}>우리 제품 추가</div>
                  <div style={{fontSize:11,fontWeight:700,color:C.inkMid,marginBottom:4}}>카테고리</div>
                  <div style={{display:"flex",gap:6,marginBottom:10}}>
                    {MKT_CATEGORIES.map(cat=>(
                      <button key={cat} onClick={()=>setMktProductInput(p=>({...p,category:cat}))}
                        style={{flex:1,padding:"6px 0",borderRadius:8,border:`1.5px solid ${(mktProductInput.category||MKT_CATEGORIES[0])===cat?C.rose:C.border}`,background:(mktProductInput.category||MKT_CATEGORIES[0])===cat?C.rose:"transparent",color:(mktProductInput.category||MKT_CATEGORIES[0])===cat?"#fff":C.inkMid,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div style={{fontSize:11,fontWeight:700,color:C.inkMid,marginBottom:4}}>제품명</div>
                  <input value={mktProductInput.name} onChange={e=>setMktProductInput(p=>({...p,name:e.target.value}))}
                    placeholder="예: 프리온, 소닉플로우"
                    style={{width:"100%",padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:10}}/>
                  <div style={{fontSize:11,fontWeight:700,color:C.inkMid,marginBottom:4}}>우리 판매가 (원)</div>
                  <input value={mktProductInput.ourPrice} onChange={e=>setMktProductInput(p=>({...p,ourPrice:e.target.value}))}
                    placeholder="예: 59000"
                    style={{width:"100%",padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:14}}/>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>setMktProductModal(false)} style={{flex:1,fontSize:11,fontWeight:700,padding:"8px 0",borderRadius:8,border:`1px solid ${C.border}`,background:C.cream,color:C.inkMid,cursor:"pointer",fontFamily:"inherit"}}>취소</button>
                    <button onClick={()=>{
                      if(!mktProductInput.name.trim()) return;
                      const newProd = {id:Date.now().toString(),name:mktProductInput.name.trim(),ourPrice:parseInt(mktProductInput.ourPrice)||0,category:mktProductInput.category||MKT_CATEGORIES[0],items:[]};
                      setMarketData([...(marketData||[]),newProd]);
                      setMktProductModal(false);
                      setMktProductInput({name:"",ourPrice:"",category:MKT_CATEGORIES[0]});
                    }} style={{flex:2,fontSize:11,fontWeight:700,padding:"8px 0",borderRadius:8,border:"none",background:C.rose,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>추가</button>
                  </div>
                </div>
              </div>
            )}

            {/* 일괄 추가 모달 */}
            {mktBulkModal&&(
              <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setMktBulkModal(false)}>
                <div style={{background:C.white,borderRadius:14,padding:20,width:340,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",maxHeight:"90vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
                  <div style={{fontSize:13,fontWeight:800,marginBottom:12}}>제품 일괄 추가</div>
                  <div style={{fontSize:11,fontWeight:700,color:C.inkMid,marginBottom:6}}>카테고리</div>
                  <div style={{display:"flex",gap:6,marginBottom:12}}>
                    {["우리브랜드",...MKT_CATEGORIES.filter(c=>c!=="우리브랜드")].map(cat=>(
                      <button key={cat} onClick={()=>setMktBulkCategory(cat)}
                        style={{flex:1,padding:"6px 0",borderRadius:8,border:`1.5px solid ${mktBulkCategory===cat?C.rose:C.border}`,background:mktBulkCategory===cat?C.rose:"transparent",color:mktBulkCategory===cat?"#fff":C.inkMid,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div style={{fontSize:11,fontWeight:700,color:C.inkMid,marginBottom:4}}>제품명 목록 (한 줄에 하나)</div>
                  <textarea value={mktBulkText} onChange={e=>setMktBulkText(e.target.value)}
                    placeholder={"오아데일리고데기\n오아무선고데기-베이지\n..."}
                    style={{flex:1,minHeight:260,padding:"8px 10px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:11,fontFamily:"inherit",outline:"none",resize:"none",lineHeight:1.7}}/>
                  <div style={{fontSize:10,color:C.inkLt,marginTop:4}}>
                    {(()=>{
                      const seen=new Set();
                      return mktBulkText.split("\n").map(l=>stripColor(l.trim())).filter(n=>{if(!n||seen.has(n.toLowerCase()))return false;seen.add(n.toLowerCase());return true;}).length;
                    })()}개 제품 (색상 제거 후)
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:12}}>
                    <button onClick={()=>setMktBulkModal(false)} style={{flex:1,fontSize:11,fontWeight:700,padding:"8px 0",borderRadius:8,border:`1px solid ${C.border}`,background:C.cream,color:C.inkMid,cursor:"pointer",fontFamily:"inherit"}}>취소</button>
                    <button onClick={()=>{
                      const rawNames = mktBulkText.split("\n").map(l=>l.trim()).filter(Boolean);
                      if(!rawNames.length) return;
                      // 색상 제거 + 중복 제거
                      const seen = new Set();
                      const names = rawNames.map(stripColor).filter(n=>{
                        if(!n||seen.has(n.toLowerCase())) return false;
                        seen.add(n.toLowerCase()); return true;
                      });
                      const existing = new Set((marketData||[]).map(p=>stripColor(p.name).toLowerCase()));
                      const newProds = names
                        .filter(n=>!existing.has(n.toLowerCase()))
                        .map(n=>({id:Date.now().toString()+Math.random().toString(36).slice(2),name:n,ourPrice:0,category:mktBulkCategory,items:[]}));
                      if(newProds.length) setMarketData([...(marketData||[]),...newProds]);
                      setMktBulkModal(false);
                      setMktBulkText("");
                    }} style={{flex:2,fontSize:11,fontWeight:700,padding:"8px 0",borderRadius:8,border:"none",background:C.rose,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>
                      추가
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 경쟁사 항목 추가/수정 모달 */}
            {mktItemModal&&(
              <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setMktItemModal(null)}>
                <div style={{background:C.white,borderRadius:14,padding:20,width:320,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
                  <div style={{fontSize:13,fontWeight:800,marginBottom:12}}>{mktItemModal.itemId?"경쟁사 제품 수정":"경쟁사 제품 추가"}</div>
                  {/* 네이버 검색해서 고르기 */}
                  <div style={{background:C.cream,borderRadius:10,padding:"10px 12px",marginBottom:14}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.inkMid,marginBottom:6}}>네이버에서 검색해서 가져오기</div>
                    <div style={{display:"flex",gap:6}}>
                      <input value={mktModalSearch} onChange={e=>setMktModalSearch(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter")searchMktModal(mktModalSearch);}}
                        placeholder="모델명 검색 (예: 파나소닉 EH-NA67)"
                        style={{flex:1,padding:"6px 10px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:11,fontFamily:"inherit",outline:"none"}}/>
                      <button onClick={()=>searchMktModal(mktModalSearch)} disabled={mktModalSearching}
                        style={{padding:"0 12px",borderRadius:8,border:"none",background:C.rose,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:mktModalSearching?0.6:1}}>
                        {mktModalSearching?"…":"검색"}
                      </button>
                    </div>
                    {mktModalResults.length>0&&(
                      <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:4,maxHeight:200,overflowY:"auto"}}>
                        {mktModalResults.map((it,i)=>(
                          <div key={i} onClick={()=>{
                            setMktItemInput(p=>({
                              ...p,
                              productName:(it.title||"").replace(/<[^>]+>/g,"").slice(0,40),
                              channel:detectMallChannel(it.mallName),
                              url:it.link||"",
                              image:it.image||"",
                              regularPrice:it.lprice||"",
                              salePrice:it.lprice||"",
                            }));
                            setMktModalResults([]);
                            setMktModalSearch("");
                          }} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:8,background:C.white,cursor:"pointer",border:`1px solid ${C.border}`}}>
                            {it.image&&<img src={it.image} alt="" style={{width:32,height:32,objectFit:"cover",borderRadius:4,flexShrink:0}}/>}
                            <div style={{flex:1,overflow:"hidden"}}>
                              <div style={{fontSize:10,fontWeight:700,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(it.title||"").replace(/<[^>]+>/g,"")}</div>
                              <div style={{fontSize:9,color:C.inkLt}}>{it.mallName} · {it.lprice?`₩${it.lprice.toLocaleString()}`:"가격미상"}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {[
                    {label:"채널",field:"channel",type:"select"},
                    {label:"제품명",field:"productName",placeholder:"경쟁 제품명"},
                    {label:"링크 URL",field:"url",placeholder:"https://..."},
                    {label:"정가 (원)",field:"regularPrice",placeholder:"예: 65000"},
                    {label:"할인가 (원)",field:"salePrice",placeholder:"예: 52000"},
                    {label:"행사/프로모션",field:"promotion",placeholder:"예: 쿠폰 20% 할인"},
                    {label:"메모",field:"note",placeholder:"예: 번들 구성, 무료배송"},
                  ].map(({label,field,type,placeholder})=>(
                    <div key={field} style={{marginBottom:10}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.inkMid,marginBottom:3}}>{label}</div>
                      {type==="select" ? (
                        <select value={mktItemInput[field]} onChange={e=>setMktItemInput(p=>({...p,[field]:e.target.value}))}
                          style={{width:"100%",padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,fontFamily:"inherit",outline:"none",background:C.white}}>
                          {CHANNELS.map(ch=><option key={ch}>{ch}</option>)}
                        </select>
                      ) : (
                        <input value={mktItemInput[field]} onChange={e=>setMktItemInput(p=>({...p,[field]:e.target.value}))}
                          placeholder={placeholder}
                          style={{width:"100%",padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
                      )}
                    </div>
                  ))}
                  {/* 이미지 URL + 자동 추출 */}
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.inkMid,marginBottom:3}}>이미지 URL</div>
                    <div style={{display:"flex",gap:6}}>
                      <input value={mktItemInput.image} onChange={e=>setMktItemInput(p=>({...p,image:e.target.value}))}
                        placeholder="https://...jpg"
                        style={{flex:1,padding:"7px 10px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
                      <button onClick={()=>fetchOgImage(mktItemInput.url)} disabled={mktOgFetching||!mktItemInput.url}
                        title="링크 URL에서 이미지 자동 추출"
                        style={{padding:"0 10px",borderRadius:8,border:`1px solid ${C.border}`,background:C.cream,cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:700,color:C.inkMid,whiteSpace:"nowrap",opacity:(!mktItemInput.url||mktOgFetching)?0.5:1}}>
                        {mktOgFetching?"…":"자동"}
                      </button>
                    </div>
                    {mktItemInput.image&&(
                      <div style={{marginTop:8,textAlign:"center"}}>
                        <img src={mktItemInput.image} alt="" style={{maxWidth:"100%",maxHeight:90,objectFit:"contain",borderRadius:8,border:`1px solid ${C.border}`}} onError={e=>e.target.style.display="none"}/>
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:4}}>
                    <button onClick={()=>setMktItemModal(null)} style={{flex:1,fontSize:11,fontWeight:700,padding:"8px 0",borderRadius:8,border:`1px solid ${C.border}`,background:C.cream,color:C.inkMid,cursor:"pointer",fontFamily:"inherit"}}>취소</button>
                    <button onClick={()=>{
                      const itemData = {
                        ...mktItemInput,
                        manual: true,
                        regularPrice:parseInt(mktItemInput.regularPrice)||null,
                        salePrice:parseInt(mktItemInput.salePrice)||null,
                        lastChecked:new Date().toISOString().slice(0,10),
                      };
                      if(mktItemModal.itemId) {
                        // 수정
                        setMarketData((marketData||[]).map(p=>p.id!==mktItemModal.productId?p:{
                          ...p, items:(p.items||[]).map(i=>i.id!==mktItemModal.itemId?i:{...i,...itemData})
                        }));
                      } else {
                        // 추가
                        setMarketData((marketData||[]).map(p=>p.id!==mktItemModal.productId?p:{
                          ...p, items:[...(p.items||[]),{id:Date.now().toString(),...itemData}]
                        }));
                      }
                      setMktItemModal(null);
                      setMktItemInput({channel:"스마트스토어",productName:"",url:"",image:"",regularPrice:"",salePrice:"",promotion:"",note:""});
                    }} style={{flex:2,fontSize:11,fontWeight:700,padding:"8px 0",borderRadius:8,border:"none",background:C.rose,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>저장</button>
                  </div>
                </div>
              </div>
            )}

            {/* 제품 목록 */}
            {(marketData||[]).length===0 ? (
              <Card>
                <div style={{textAlign:"center",padding:"32px 0",color:C.inkLt}}>
                  <MI n="storefront" size={32} style={{opacity:0.2,marginBottom:8}}/>
                  <div style={{fontSize:12}}>우리 제품을 추가하고 경쟁사 가격을 조사해보세요</div>
                  <button onClick={()=>setMktProductModal(true)} style={{marginTop:12,padding:"8px 20px",borderRadius:8,border:"none",background:C.rose,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                    + 제품 추가
                  </button>
                </div>
              </Card>
            ) : (
              <>
                <div style={{display:"flex",alignItems:"center",gap:0,borderBottom:`1px solid ${C.border}`,marginBottom:8,flexWrap:"wrap"}}>
                  {MKT_CATEGORIES.map(cat=>(
                    <button key={cat} onClick={()=>setMktCategoryTab(cat)}
                      style={{padding:"8px 14px",background:"none",border:"none",borderBottom:`2px solid ${mktCategoryTab===cat?C.rose:"transparent"}`,color:mktCategoryTab===cat?C.rose:C.inkMid,fontWeight:mktCategoryTab===cat?800:600,fontSize:12,cursor:"pointer",fontFamily:"inherit",marginBottom:-1}}>
                      {cat}
                      <span style={{marginLeft:4,fontSize:10,color:mktCategoryTab===cat?C.rose:C.inkLt}}>
                        {(marketData||[]).filter(p=>(p.category||MKT_CATEGORIES[0])===cat).length}
                      </span>
                    </button>
                  ))}
                  <button onClick={()=>setMktCategoryTab(MKT_FAV_TAB)}
                    style={{padding:"8px 14px",background:"none",border:"none",borderBottom:`2px solid ${mktCategoryTab===MKT_FAV_TAB?"#f59e0b":"transparent"}`,color:mktCategoryTab===MKT_FAV_TAB?"#f59e0b":C.inkMid,fontWeight:mktCategoryTab===MKT_FAV_TAB?800:600,fontSize:12,cursor:"pointer",fontFamily:"inherit",marginBottom:-1}}>
                    ⭐ 즐겨찾기
                    <span style={{marginLeft:4,fontSize:10,color:mktCategoryTab===MKT_FAV_TAB?"#f59e0b":C.inkLt}}>
                      {(marketData||[]).reduce((s,p)=>s+(p.items||[]).filter(i=>i.favorite).length,0)}
                    </span>
                  </button>
                  <button onClick={()=>setMktCategoryTab(MKT_PRICE_TAB)}
                    style={{padding:"8px 14px",background:"none",border:"none",borderBottom:`2px solid ${mktCategoryTab===MKT_PRICE_TAB?"#7c3aed":"transparent"}`,color:mktCategoryTab===MKT_PRICE_TAB?"#7c3aed":C.inkMid,fontWeight:mktCategoryTab===MKT_PRICE_TAB?800:600,fontSize:12,cursor:"pointer",fontFamily:"inherit",marginBottom:-1}}>
                    🔍 최저가체크
                  </button>
                  <button onClick={()=>setMktCategoryTab(MKT_COMPARE_TAB)}
                    style={{padding:"8px 14px",background:"none",border:"none",borderBottom:`2px solid ${mktCategoryTab===MKT_COMPARE_TAB?"#0891b2":"transparent"}`,color:mktCategoryTab===MKT_COMPARE_TAB?"#0891b2":C.inkMid,fontWeight:mktCategoryTab===MKT_COMPARE_TAB?800:600,fontSize:12,cursor:"pointer",fontFamily:"inherit",marginBottom:-1}}>
                    📊 시장비교
                  </button>
                  {[
                    {id:"🫒올리브영",    key:"oliveyoung", color:"#16a34a"},
                    {id:"🛍무신사",      key:"musinsa",    color:"#111"},
                    {id:"👗지그재그",    key:"zigzag",     color:"#7c3aed"},
                    {id:"🎀에이블리",    key:"ably",       color:"#ec4899"},
                    {id:"🎁카카오선물하기",key:"kakao_gift",color:"#f59e0b"},
                  ].map(t=>(
                    <button key={t.id} onClick={()=>setMktCategoryTab(t.id)}
                      style={{padding:"8px 14px",background:"none",border:"none",borderBottom:`2px solid ${mktCategoryTab===t.id?t.color:"transparent"}`,color:mktCategoryTab===t.id?t.color:C.inkMid,fontWeight:mktCategoryTab===t.id?800:600,fontSize:12,cursor:"pointer",fontFamily:"inherit",marginBottom:-1,whiteSpace:"nowrap"}}>
                      {t.id}
                    </button>
                  ))}
                  <div style={{flex:1}}/>
                  <button onClick={()=>{
                    if(mktAllRunning) return;
                    if(!confirm("전체 플랫폼 수집을 시작할까요? (5~15분 소요)")) return;
                    setMktAllRunning(true);
                    fetch("/api/github-scrape",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({platform:"all"})})
                      .then(r=>r.json()).then(d=>{
                        if(d.ok) alert("전체 수집 시작! GitHub Actions 실행 중.\n완료 후 각 탭에서 새로고침 버튼 누르세요.");
                        else alert("오류: "+d.error);
                        setMktAllRunning(false);
                      }).catch(e=>{alert("오류: "+e.message);setMktAllRunning(false);});
                  }} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:7,border:"none",background:mktAllRunning?"#e5e7eb":"#111",color:mktAllRunning?"#9ca3af":"#fff",fontWeight:700,fontSize:11,cursor:mktAllRunning?"not-allowed":"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                    <MI n="play_arrow" size={13}/>{mktAllRunning?"수집 중...":"전체 수집"}
                  </button>
                  <Btn small onClick={()=>{setMktBulkModal(true);setMktBulkText("");}}>일괄 추가</Btn>
                  <Btn small onClick={()=>setMktProductModal(true)}>+ 제품 추가</Btn>
                </div>

                {/* 즐겨찾기 탭 */}
                {mktCategoryTab===MKT_FAV_TAB&&(()=>{
                  const favList = (marketData||[]).filter(p=>p.category!=="우리브랜드").flatMap(p=>(p.items||[]).filter(i=>i.favorite).map(i=>({...i,prodName:p.name,prodId:p.id,ourPrice:p.ourPrice})));
                  return(
                    <div>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                        <div style={{fontSize:12,color:C.inkMid}}>{favList.length}개 즐겨찾기 항목</div>
                        <button onClick={updateFavPrices} disabled={mktFavUpdating}
                          style={{display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:8,border:"none",background:mktFavUpdating?C.cream:"#f59e0b",color:mktFavUpdating?C.inkMid:"#fff",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit",opacity:mktFavUpdating?0.7:1}}>
                          <MI n="sync" size={13} style={{color:mktFavUpdating?C.inkMid:"#fff"}}/>
                          {mktFavUpdating?"가격 조회 중...":"전체 가격 업데이트"}
                        </button>
                      </div>
                      {favList.length===0?(
                        <Card><div style={{textAlign:"center",padding:"24px 0",color:C.inkLt,fontSize:12}}>⭐ 즐겨찾기한 항목이 없어요</div></Card>
                      ):(
                        <div style={{display:"flex",flexDirection:"column",gap:8}}>
                          {favList.map(item=>{
                            const history = (item.priceHistory||[]).slice().sort((a,b)=>a.date>b.date?1:-1);
                            const prev = history.length>=2 ? history[history.length-2].price : null;
                            const curr = item.salePrice;
                            const change = (curr&&prev) ? curr-prev : null;
                            return(
                              <Card key={item.id} style={{padding:"12px 14px"}}>
                                <div style={{display:"flex",alignItems:"center",gap:10}}>
                                  {item.image&&<img src={item.image} alt="" style={{width:40,height:40,objectFit:"cover",borderRadius:6,border:`1px solid ${C.border}`,flexShrink:0}}/>}
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontSize:10,color:C.inkLt,marginBottom:2}}>{item.prodName}</div>
                                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                                      <span style={{fontWeight:800,fontSize:12,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.productName||"—"}</span>
                                      <span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:6,background:C.cream,color:C.inkMid}}>{item.channel}</span>
                                    </div>
                                    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4,flexWrap:"wrap"}}>
                                      <span style={{fontSize:13,fontWeight:800,color:C.ink}}>{curr?`₩${curr.toLocaleString()}`:"—"}</span>
                                      {change!==null&&(
                                        <span style={{fontSize:10,fontWeight:700,color:change>0?C.bad:C.good}}>
                                          {change>0?`▲ ₩${change.toLocaleString()}`:`▼ ₩${Math.abs(change).toLocaleString()}`}
                                        </span>
                                      )}
                                      {item.url&&<a href={item.url} target="_blank" rel="noreferrer" style={{fontSize:9,color:"#2563eb",textDecoration:"none",display:"flex",alignItems:"center",gap:2}}><MI n="open_in_new" size={10}/>링크</a>}
                                    </div>
                                  </div>
                                </div>
                                {history.length>0&&(
                                  <div style={{marginTop:10,borderTop:`1px solid ${C.border}`,paddingTop:8}}>
                                    <div style={{fontSize:9,color:C.inkLt,marginBottom:4,fontWeight:700}}>가격 히스토리</div>
                                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                                      {history.slice(-10).map((h,hi)=>(
                                        <div key={hi} style={{textAlign:"center",minWidth:52,background:C.cream,borderRadius:6,padding:"4px 6px"}}>
                                          <div style={{fontSize:9,color:C.inkLt}}>{h.date.slice(5)}</div>
                                          <div style={{fontSize:10,fontWeight:700,color:C.ink}}>₩{h.price.toLocaleString()}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 시장비교 탭 */}
                {mktCategoryTab===MKT_COMPARE_TAB&&(()=>{
                  // 데이터 로드 (market_prices + 우리제품 목록)
                  if((!mktCompareData||mktOurProds===null) && !mktCompareLoading && !mktOurProdsLoading) {
                    setMktCompareLoading(true);
                    setMktOurProdsLoading(true);
                    Promise.all([
                      fetch("/api/market/prices",{cache:"no-store"}).then(r=>r.json()).catch(()=>[]),
                      fetch("/api/market/compare-prods",{cache:"no-store"}).then(r=>r.json()).catch(()=>[]),
                    ]).then(([prices,ourProds])=>{
                      setMktCompareData({prices:Array.isArray(prices)?prices:[]});
                      setMktOurProds(Array.isArray(ourProds)?ourProds:[]);
                      setMktCompareLoading(false);
                      setMktOurProdsLoading(false);
                    });
                  }
                  if(mktCompareLoading||mktOurProdsLoading) return <Card><div style={{textAlign:"center",padding:"32px 0",color:C.inkLt,fontSize:12}}>불러오는 중...</div></Card>;
                  if(!mktCompareData||mktOurProds===null) return null;
                  const {prices} = mktCompareData;
                  const PLATFORM_LABEL = {"musinsa":"무신사","oliveyoung":"올리브영","zigzag":"지그재그","ably":"에이블리","kakao_gift":"카카오선물하기"};
                  const PLATFORM_COLOR = {"musinsa":"#111","oliveyoung":"#16a34a","zigzag":"#7c3aed","ably":"#ec4899","kakao_gift":"#f59e0b"};
                  const ourBrandProds = mktOurProds||[];
                  // 경쟁사 연결 헬퍼 (Supabase 필드명: comp_links, our_price)
                  function getCompLinks(prod) { return prod.comp_links||[]; }
                  function hasLink(prod, key) { return getCompLinks(prod).includes(key); }
                  async function toggleLink(prod, key) {
                    const links = getCompLinks(prod);
                    const next = links.includes(key) ? links.filter(k=>k!==key) : [...links,key];
                    setMktOurProds(prev=>(prev||[]).map(p=>p.id===prod.id?{...p,comp_links:next}:p));
                    await fetch("/api/market/compare-prods",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:prod.id,comp_links:next})});
                  }
                  return(
                    <div style={{display:"flex",flexDirection:"column",gap:16}}>
                      <div style={{display:"flex",justifyContent:"flex-end"}}>
                        <button onClick={()=>{setMktCompareData(null);setMktOurProds(null);setMktCompLinkOpen(null);}} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:7,border:"none",background:"#f3f4f6",color:C.inkMid,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                          <MI n="refresh" size={12}/>새로고침
                        </button>
                      </div>
                      {/* 우리 제품 추가 폼 */}
                      <Card>
                        <div style={{fontSize:12,fontWeight:800,color:C.ink,marginBottom:10}}>우리 브랜드 제품 추가</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                          <input value={mktOurProdInput.name} onChange={e=>setMktOurProdInput(p=>({...p,name:e.target.value}))}
                            placeholder="제품명 (예: 미니고데기)"
                            style={{flex:2,minWidth:120,padding:"6px 10px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:11,fontFamily:"inherit",outline:"none"}}/>
                          <input value={mktOurProdInput.ourPrice} onChange={e=>setMktOurProdInput(p=>({...p,ourPrice:e.target.value}))}
                            placeholder="판매가"
                            style={{width:90,padding:"6px 10px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:11,fontFamily:"inherit",outline:"none"}}/>
                          <div style={{display:"flex",gap:4}}>
                            {["드라이기","고데기","케어제품"].map(cat=>(
                              <button key={cat} onClick={()=>setMktOurProdInput(p=>({...p,category:cat}))}
                                style={{padding:"5px 10px",borderRadius:6,border:`1.5px solid ${mktOurProdInput.category===cat?"#7c3aed":C.border}`,background:mktOurProdInput.category===cat?"#7c3aed":"transparent",color:mktOurProdInput.category===cat?"#fff":C.inkMid,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                                {cat}
                              </button>
                            ))}
                          </div>
                          <button onClick={async()=>{
                            if(!mktOurProdInput.name.trim()) return;
                            const newProd = {id:Date.now().toString(),name:mktOurProdInput.name.trim(),category:mktOurProdInput.category,our_price:parseInt(mktOurProdInput.ourPrice)||0,comp_links:[]};
                            await fetch("/api/market/compare-prods",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(newProd)});
                            setMktOurProds(prev=>[...(prev||[]),newProd]);
                            setMktOurProdInput(p=>({...p,name:"",ourPrice:""}));
                          }} style={{padding:"6px 14px",borderRadius:6,border:"none",background:"#7c3aed",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                            추가
                          </button>
                        </div>
                      </Card>
                      {ourBrandProds.map(prod=>{
                        const linkedKeys = getCompLinks(prod);
                        const linkedComps = prices.filter(p=>linkedKeys.includes(`${p.platform}__${p.product_id}`) && p.sale_price>0);
                        const ourMin = prod.our_price||0;
                        const isOpen = mktCompLinkOpen===prod.id;
                        // 피커용 필터링
                        const sq = mktCompLinkSearch.toLowerCase().trim();
                        const pickerItems = prices.filter(p=>{
                          if(!sq) return true;
                          return (p.name||"").toLowerCase().includes(sq)||(p.brand||"").toLowerCase().includes(sq)||(PLATFORM_LABEL[p.platform]||"").includes(sq);
                        }).slice(0,50);
                        return(
                          <Card key={prod.id}>
                            {/* 우리 제품 헤더 */}
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                                <span style={{background:"#16a34a",color:"#fff",fontSize:9,fontWeight:700,padding:"3px 7px",borderRadius:4}}>우리</span>
                                <span style={{background:"#7c3aed",color:"#fff",fontSize:9,fontWeight:700,padding:"3px 7px",borderRadius:4}}>{prod.category}</span>
                                <span style={{fontWeight:900,fontSize:14,color:C.ink}}>{prod.name}</span>
                                {prod.our_price>0&&<span style={{fontWeight:800,fontSize:13,color:"#16a34a"}}>₩{prod.our_price.toLocaleString()}</span>}
                              </div>
                              <div style={{display:"flex",gap:6}}>
                                <button onClick={()=>{setMktCompLinkOpen(isOpen?null:prod.id);setMktCompLinkSearch("");}}
                                  style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:6,border:`1.5px solid ${isOpen?"#0891b2":C.border}`,background:isOpen?"#e0f2fe":"transparent",color:isOpen?"#0369a1":C.inkMid,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                                  <MI n="add_link" size={13}/>{isOpen?"닫기":"경쟁사 연결"}
                                </button>
                                <button onClick={async()=>{
                                  setMktOurProds(prev=>(prev||[]).filter(p=>p.id!==prod.id));
                                  await fetch("/api/market/compare-prods",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:prod.id})});
                                }} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,background:"none",color:"#dc2626",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                                  삭제
                                </button>
                              </div>
                            </div>

                            {/* 연결된 경쟁사 테이블 */}
                            {linkedComps.length>0&&(
                              <div style={{overflowX:"auto",marginBottom:isOpen?12:0}}>
                                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                                  <thead><tr style={{background:C.cream}}>
                                    {["","브랜드/상품명","플랫폼","판매가","정가","할인율","비교","링크",""].map(h=>(
                                      <th key={h} style={{padding:"5px 8px",textAlign:"left",fontWeight:700,color:C.inkMid,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                                    ))}
                                  </tr></thead>
                                  <tbody>
                                    {[...linkedComps].sort((a,b)=>a.sale_price-b.sale_price).map(p=>{
                                      const cheaper = ourMin && p.sale_price<ourMin;
                                      const disc = p.original_price&&p.original_price>p.sale_price?Math.round((1-p.sale_price/p.original_price)*100):0;
                                      const diff = ourMin ? p.sale_price-ourMin : null;
                                      const key = `${p.platform}__${p.product_id}`;
                                      return(
                                        <tr key={key} style={{borderBottom:`1px solid ${C.cream}`,background:cheaper?"#fff7ed":"transparent"}}>
                                          <td style={{padding:"5px 8px"}}>{p.image&&<img src={p.image} alt="" style={{width:34,height:34,objectFit:"cover",borderRadius:4,border:`1px solid ${C.border}`}}/>}</td>
                                          <td style={{padding:"5px 8px",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                            <div style={{fontWeight:600}}>{p.brand}</div>
                                            <div style={{color:C.inkMid,fontSize:10}}>{p.name}</div>
                                          </td>
                                          <td style={{padding:"5px 8px"}}>
                                            <span style={{background:PLATFORM_COLOR[p.platform]||"#999",color:"#fff",fontSize:9,fontWeight:700,padding:"2px 5px",borderRadius:4,whiteSpace:"nowrap"}}>{PLATFORM_LABEL[p.platform]||p.platform}</span>
                                          </td>
                                          <td style={{padding:"5px 8px",fontWeight:800,color:cheaper?"#dc2626":C.ink}}>{`₩${p.sale_price.toLocaleString()}`}</td>
                                          <td style={{padding:"5px 8px",color:C.inkMid,textDecoration:"line-through"}}>{p.original_price&&p.original_price!==p.sale_price?`₩${p.original_price.toLocaleString()}`:"—"}</td>
                                          <td style={{padding:"5px 8px"}}>{disc>0&&<span style={{background:"#fee2e2",color:"#dc2626",fontWeight:700,padding:"2px 5px",borderRadius:4,fontSize:10}}>{disc}%</span>}</td>
                                          <td style={{padding:"5px 8px",whiteSpace:"nowrap"}}>
                                            {diff!==null&&<span style={{fontWeight:700,color:diff<0?"#dc2626":"#6b7280",fontSize:10}}>{diff<0?`▼₩${Math.abs(diff).toLocaleString()}`:`+₩${diff.toLocaleString()}`}</span>}
                                          </td>
                                          <td style={{padding:"5px 8px"}}>
                                            {p.url&&<a href={p.url} target="_blank" rel="noopener noreferrer" style={{display:"inline-block",padding:"2px 8px",borderRadius:4,background:"#e0f2fe",color:"#0369a1",fontSize:10,fontWeight:700,textDecoration:"none",whiteSpace:"nowrap"}}>보기</a>}
                                          </td>
                                          <td style={{padding:"5px 8px"}}>
                                            <button onClick={()=>toggleLink(prod,key)} style={{background:"none",border:"none",cursor:"pointer",color:"#dc2626",fontSize:14,lineHeight:1,padding:"0 2px"}} title="연결 해제">×</button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            {linkedComps.length===0&&!isOpen&&(
                              <div style={{color:C.inkLt,fontSize:11,padding:"8px 0"}}>연결된 경쟁사 없음 — 우측 "경쟁사 연결" 버튼으로 추가하세요</div>
                            )}

                            {/* 경쟁사 연결 피커 */}
                            {isOpen&&(
                              <div style={{marginTop:8,border:`1.5px solid #0891b2`,borderRadius:8,padding:10,background:"#f0f9ff"}}>
                                <input
                                  value={mktCompLinkSearch}
                                  onChange={e=>setMktCompLinkSearch(e.target.value)}
                                  placeholder="제품명, 브랜드, 플랫폼 검색..."
                                  style={{width:"100%",padding:"6px 10px",border:`1px solid ${C.border}`,borderRadius:6,fontSize:11,fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:8}}
                                  autoFocus
                                />
                                {pickerItems.length===0&&<div style={{color:C.inkLt,fontSize:11,textAlign:"center",padding:"8px 0"}}>수집된 제품이 없습니다</div>}
                                <div style={{maxHeight:260,overflowY:"auto",display:"flex",flexDirection:"column",gap:2}}>
                                  {pickerItems.map(p=>{
                                    const key=`${p.platform}__${p.product_id}`;
                                    const linked=hasLink(prod,key);
                                    return(
                                      <div key={key} onClick={()=>toggleLink(prod,key)}
                                        style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:6,cursor:"pointer",background:linked?"#dcfce7":"#fff",border:`1px solid ${linked?"#16a34a":C.border}`}}>
                                        {p.image&&<img src={p.image} alt="" style={{width:30,height:30,objectFit:"cover",borderRadius:4,flexShrink:0}}/>}
                                        <div style={{flex:1,minWidth:0}}>
                                          <div style={{fontWeight:600,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.brand} {p.name}</div>
                                          <div style={{fontSize:10,color:C.inkMid}}>
                                            <span style={{background:PLATFORM_COLOR[p.platform]||"#999",color:"#fff",fontSize:8,fontWeight:700,padding:"1px 4px",borderRadius:3,marginRight:4}}>{PLATFORM_LABEL[p.platform]||p.platform}</span>
                                            {p.sale_price?`₩${p.sale_price.toLocaleString()}`:""}
                                          </div>
                                        </div>
                                        <span style={{fontSize:16,color:linked?"#16a34a":"#9ca3af",flexShrink:0}}>{linked?"✓":"+"}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* 최저가 체크 탭 */}
                {mktCategoryTab===MKT_PRICE_TAB&&(()=>{
                  const priceCats = ["전체",...MKT_CATEGORIES.filter(c=>c!=="우리브랜드")];
                  const allOurProds = (marketData||[]).filter(p=>p.category==="우리브랜드" && (p.items||[]).length>0);
                  // 카테고리 필터: 우리브랜드 제품의 modelMemo나 제품명에서 카테고리 매칭
                  const ourProds = mktPriceCatFilter==="전체" ? allOurProds : allOurProds.filter(p=>{
                    const text = ((p.modelMemo||"")+(p.name||"")).toLowerCase();
                    if(mktPriceCatFilter==="드라이기") return text.includes("드라이기")||text.includes("드라이")||text.includes("소닉")||text.includes("에어리");
                    if(mktPriceCatFilter==="고데기") return text.includes("고데기")||text.includes("컬링")||text.includes("빗고데")||text.includes("볼륨")||text.includes("뷰러");
                    if(mktPriceCatFilter==="케어제품") return !text.includes("드라이")&&!text.includes("소닉")&&!text.includes("에어리")&&!text.includes("고데기")&&!text.includes("컬링")&&!text.includes("볼륨");
                    return true;
                  });
                  return(
                    <div>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}}>
                        <div style={{display:"flex",gap:4}}>
                          {priceCats.map(cat=>(
                            <button key={cat} onClick={()=>setMktPriceCatFilter(cat)}
                              style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${mktPriceCatFilter===cat?"#7c3aed":C.border}`,background:mktPriceCatFilter===cat?"#7c3aed":"transparent",color:mktPriceCatFilter===cat?"#fff":C.inkMid,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                              {cat}
                              <span style={{marginLeft:3,fontSize:9,opacity:0.8}}>
                                {cat==="전체"?allOurProds.length:allOurProds.filter(p=>{
                                  const text=((p.modelMemo||"")+(p.name||"")).toLowerCase();
                                  if(cat==="드라이기") return text.includes("드라이기")||text.includes("드라이")||text.includes("소닉")||text.includes("에어리");
                                  if(cat==="고데기") return text.includes("고데기")||text.includes("컬링")||text.includes("빗고데")||text.includes("볼륨")||text.includes("뷰러");
                                  if(cat==="케어제품") return !text.includes("드라이")&&!text.includes("소닉")&&!text.includes("에어리")&&!text.includes("고데기")&&!text.includes("컬링")&&!text.includes("볼륨");
                                  return true;
                                }).length}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          {mktLastUpdateAt&&<span style={{fontSize:10,color:C.inkLt}}>마지막 조회 {mktLastUpdateAt}</span>}
                          <button onClick={updateOurBrandPrices} disabled={mktPriceUpdating}
                            style={{display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:8,border:"none",background:mktPriceUpdating?C.cream:"#7c3aed",color:mktPriceUpdating?C.inkMid:"#fff",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit",opacity:mktPriceUpdating?0.7:1}}>
                            <MI n="sync" size={13}/>
                            {mktPriceUpdating?"조회 중...":"전체 가격 업데이트"}
                          </button>
                        </div>
                      </div>
                      {ourProds.length===0?(
                        <Card><div style={{textAlign:"center",padding:"24px 0",color:C.inkLt,fontSize:12}}>우리브랜드 탭에 제품과 채널을 먼저 추가해주세요</div></Card>
                      ):(
                        <div style={{display:"flex",flexDirection:"column",gap:8}}>
                          {ourProds.every(prod=>{
                            const officialMin=parseInt(prod.ourPrice)||null;
                            const getPrice=i=>parseInt(i.salePrice||i.naverPrice)||0;
                            const cnt=officialMin?(prod.items||[]).filter(i=>{const p=getPrice(i);return p&&p<officialMin;}).length:0;
                            return !officialMin||cnt===0;
                          })&&<Card><div style={{textAlign:"center",padding:"24px 0",color:"#16a34a",fontSize:13,fontWeight:700}}>✓ 공식가 이탈 없음 — 모든 채널 정상</div></Card>}
                          {ourProds.map(prod=>{
                            const allItems = prod.items||[];
                            if(!allItems.length) return null;
                            const officialMin = parseInt(prod.ourPrice)||null;
                            const getPrice = i => parseInt(i.salePrice||i.naverPrice)||0;
                            const isOurStore = i => (i.channel||i.mallName||"").includes("스마트스토어");
                            const marketPrices = allItems.filter(i=>!isOurStore(i)).map(getPrice).filter(Boolean);
                            const marketMin = marketPrices.length ? Math.min(...marketPrices) : null;
                            const undercutItems = officialMin ? allItems.filter(i=>{ const p=getPrice(i); return p && p<officialMin; }) : [];
                            const undercutCount = undercutItems.length;
                            if(!officialMin || undercutCount===0) return null;
                            return(
                              <Card key={prod.id}>
                                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                                  <span style={{fontSize:13,fontWeight:900,color:C.ink}}>{prod.name}</span>
                                  {prod.modelMemo&&<span style={{fontSize:10,color:C.inkLt,borderBottom:`1px dashed ${C.border}`}}>{prod.modelMemo}</span>}
                                  {officialMin&&<span style={{fontSize:11,fontWeight:700,background:"#ede9fe",color:"#7c3aed",padding:"2px 8px",borderRadius:6}}>공식가 ₩{officialMin.toLocaleString()}</span>}
                                  {undercutCount>0?(
                                    <span style={{fontSize:10,fontWeight:700,background:"#fee2e2",color:"#dc2626",padding:"2px 8px",borderRadius:6}}>⚠ {undercutCount}개 이탈</span>
                                  ):officialMin?(
                                    <span style={{fontSize:10,fontWeight:700,background:"#dcfce7",color:"#16a34a",padding:"2px 8px",borderRadius:6}}>✓ 이탈 없음</span>
                                  ):null}
                                </div>
                                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                                  {[...allItems].sort((a,b)=>(getPrice(a)||Infinity)-(getPrice(b)||Infinity)).map(item=>{
                                    const price = getPrice(item);
                                    const ourStore = isOurStore(item);
                                    const isUndercut = !ourStore && officialMin && price && price < officialMin;
                                    const isMarketMin = !ourStore && marketMin && price === marketMin;
                                    const diff = officialMin && price ? price - officialMin : null;
                                    return(
                                      <div key={item.id} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 10px",borderRadius:8,border:`1.5px solid ${isUndercut?"#fca5a5":isMarketMin?"#86efac":ourStore?"#c4b5fd":C.border}`,background:isUndercut?"#fff5f5":isMarketMin?"#f0fdf4":ourStore?"#faf5ff":"transparent",minWidth:130}}>
                                        {item.image&&<img src={item.image} alt="" style={{width:28,height:28,objectFit:"cover",borderRadius:4,flexShrink:0}}/>}
                                        <div style={{flex:1,minWidth:0}}>
                                          <div style={{display:"flex",alignItems:"center",gap:4}}>
                                            <span style={{fontSize:10,fontWeight:700,color:C.inkMid,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.channel||item.mallName}</span>
                                            {ourStore&&<span style={{fontSize:8,fontWeight:700,background:"#7c3aed",color:"#fff",padding:"1px 4px",borderRadius:3,flexShrink:0}}>기준</span>}
                                          </div>
                                          {price?(
                                            <>
                                              <div style={{fontSize:12,fontWeight:800,color:isUndercut?"#dc2626":isMarketMin?"#16a34a":ourStore?"#7c3aed":C.ink}}>₩{price.toLocaleString()}</div>
                                              {!ourStore&&diff!==null&&diff!==0&&<div style={{fontSize:9,color:isUndercut?"#dc2626":C.inkMid,fontWeight:isUndercut?700:400}}>
                                                {diff<0?`-₩${Math.abs(diff).toLocaleString()} 이탈`:`+₩${diff.toLocaleString()}`}
                                              </div>}
                                            </>
                                          ):(
                                            <div style={{fontSize:11,color:C.inkLt}}>미입력</div>
                                          )}
                                          {item.lastChecked&&<div style={{fontSize:8,color:C.inkLt,marginTop:2}}>{item.lastChecked} 조회</div>}
                                          {(item.naverLink||item.url)&&<a href={isUndercut?(item.naverLink||item.url):item.url} target="_blank" rel="noreferrer" style={{fontSize:9,color:"#2563eb",textDecoration:"none",display:"flex",alignItems:"center",gap:1}}><MI n="open_in_new" size={9}/>링크</a>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {PLATFORM_TAB_MAP[mktCategoryTab]&&(()=>{
                  const platform = PLATFORM_TAB_MAP[mktCategoryTab];
                  const prices = mktPlatformPrices[platform];
                  const links = mktPlatformLinks[platform];
                  const loading = mktPlatformLoading[platform];
                  const running = mktPlatformRunning[platform];
                  // 가격 로드
                  if(mktPlatformTab==="prices" && !prices && !loading) {
                    setMktPlatformLoading(p=>({...p,[platform]:true}));
                    fetch(`/api/market/prices?platform=${platform}`)
                      .then(r=>r.json()).then(d=>{
                        setMktPlatformPrices(p=>({...p,[platform]:Array.isArray(d)?d:[]}));
                        setMktPlatformLoading(p=>({...p,[platform]:false}));
                      }).catch(()=>setMktPlatformLoading(p=>({...p,[platform]:false})));
                  }
                  // 링크 로드
                  if(mktPlatformTab==="links" && !links) {
                    fetch(`/api/market/links?platform=${platform}`)
                      .then(r=>r.json()).then(d=>setMktPlatformLinks(p=>({...p,[platform]:Array.isArray(d)?d:[]})));
                  }
                  const byBrand = {};
                  (prices||[]).forEach(item=>{ const b=item.brand||"기타"; if(!byBrand[b])byBrand[b]=[]; byBrand[b].push(item); });
                  const extractPid = (url) => {
                    const patterns = [/\/products\/(\d+)/, /goodsNo=([A-Z0-9]+)/i, /\/catalog\/products\/(\d+)/, /\/goods\/(\d+)/, /\/product\/(\d+)/];
                    for(const p of patterns){ const m=url.match(p); if(m) return m[1]; }
                    return Date.now().toString();
                  };
                  return(
                    <div style={{display:"flex",flexDirection:"column",gap:12}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                        <div style={{display:"flex",gap:4,background:C.cream,borderRadius:10,padding:3}}>
                          {[{id:"prices",label:"가격 현황"},{id:"links",label:"링크 관리"}].map(t=>(
                            <button key={t.id} onClick={()=>setMktPlatformTab(t.id)} style={{fontSize:11,fontWeight:700,padding:"5px 14px",borderRadius:8,border:"none",cursor:"pointer",background:mktPlatformTab===t.id?"#fff":"transparent",color:mktPlatformTab===t.id?C.ink:C.inkMid,fontFamily:"inherit"}}>{t.label}</button>
                          ))}
                        </div>
                        {mktPlatformTab==="prices"&&(
                          <div style={{display:"flex",gap:8}}>
                            <button onClick={()=>{
                              if(running) return;
                              setMktPlatformRunning(p=>({...p,[platform]:true}));
                              fetch("/api/github-scrape",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({platform})})
                                .then(r=>r.json()).then(d=>{
                                  if(d.ok) alert("수집 시작! GitHub Actions 실행 중. 2~3분 후 새로고침.");
                                  else alert("오류: "+d.error);
                                  setMktPlatformRunning(p=>({...p,[platform]:false}));
                                }).catch(e=>{alert("오류: "+e.message);setMktPlatformRunning(p=>({...p,[platform]:false}));});
                            }} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:8,border:"none",background:running?"#e5e7eb":"#111",color:running?C.inkMid:"#fff",fontWeight:700,fontSize:11,cursor:running?"not-allowed":"pointer",fontFamily:"inherit"}}>
                              <MI n="play_arrow" size={13}/>{running?"실행 중...":"수집 실행"}
                            </button>
                            <button onClick={()=>setMktPlatformPrices(p=>({...p,[platform]:null}))} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:8,border:"none",background:"#f3f4f6",color:C.inkMid,fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
                              <MI n="refresh" size={13}/>새로고침
                            </button>
                          </div>
                        )}
                      </div>
                      {mktPlatformTab==="prices"&&(
                        loading?(
                          <Card><div style={{textAlign:"center",padding:"32px 0",color:C.inkLt,fontSize:12}}>불러오는 중...</div></Card>
                        ):!prices||prices.length===0?(
                          <Card><div style={{textAlign:"center",padding:"32px 0",color:C.inkLt,fontSize:12}}>데이터 없음 — 링크 추가 후 수집 실행</div></Card>
                        ):(
                          Object.entries(byBrand).map(([brand,items])=>(
                            <Card key={brand}>
                              <div style={{fontSize:13,fontWeight:900,color:C.ink,marginBottom:10}}>{brand} <span style={{fontSize:10,fontWeight:500,color:C.inkLt}}>({items.length}개)</span></div>
                              <div style={{overflowX:"auto"}}>
                                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                                  <thead><tr style={{background:C.cream}}>
                                    {["이미지","상품명","순위","판매가","정가","할인율","수집일","링크"].map(h=>(
                                      <th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:700,color:C.inkMid,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                                    ))}
                                  </tr></thead>
                                  <tbody>
                                    {items.map(item=>{
                                      const disc=item.original_price&&item.sale_price&&item.original_price>item.sale_price?Math.round((1-item.sale_price/item.original_price)*100):0;
                                      return(
                                        <tr key={item.product_id} style={{borderBottom:`1px solid ${C.cream}`}}>
                                          <td style={{padding:"6px 8px"}}>{item.image&&<img src={item.image} alt="" style={{width:40,height:40,objectFit:"cover",borderRadius:4,border:`1px solid ${C.border}`}}/>}</td>
                                          <td style={{padding:"6px 8px",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</td>
                                          <td style={{padding:"6px 8px",whiteSpace:"nowrap"}}>{item.rank!=null?<span style={{fontWeight:800,color:item.rank<=3?"#dc2626":item.rank<=10?"#ea580c":"#111"}}>{item.rank}위</span>:"—"}</td>
                                          <td style={{padding:"6px 8px",fontWeight:800,color:C.ink,whiteSpace:"nowrap"}}>{item.sale_price?`₩${item.sale_price.toLocaleString()}`:"—"}</td>
                                          <td style={{padding:"6px 8px",color:C.inkMid,whiteSpace:"nowrap",textDecoration:"line-through"}}>{item.original_price&&item.original_price!==item.sale_price?`₩${item.original_price.toLocaleString()}`:"—"}</td>
                                          <td style={{padding:"6px 8px",whiteSpace:"nowrap"}}>{disc>0&&<span style={{background:"#fee2e2",color:"#dc2626",fontWeight:700,padding:"2px 6px",borderRadius:4,fontSize:10}}>{disc}%</span>}</td>
                                          <td style={{padding:"6px 8px",color:C.inkLt,whiteSpace:"nowrap"}}>{item.collected_at?item.collected_at.slice(0,10):"—"}</td>
                                          <td style={{padding:"6px 8px"}}>{item.url&&<a href={item.url} target="_blank" rel="noreferrer" style={{fontSize:10,color:"#2563eb",textDecoration:"none",display:"flex",alignItems:"center",gap:2}}><MI n="open_in_new" size={10}/>보기</a>}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </Card>
                          ))
                        )
                      )}
                      {mktPlatformTab==="links"&&(
                        <div style={{display:"flex",flexDirection:"column",gap:10}}>
                          <Card>
                            <div style={{fontSize:12,fontWeight:700,color:C.ink,marginBottom:8}}>링크 추가</div>
                            <div style={{display:"flex",flexDirection:"column",gap:6}}>
                              <input value={mktNewUrl} onChange={e=>setMktNewUrl(e.target.value)}
                                placeholder="상품 URL"
                                style={{fontSize:11,padding:"7px 10px",borderRadius:8,border:`1px solid ${C.border}`,outline:"none",fontFamily:"inherit"}}/>
                              <div style={{display:"flex",gap:6}}>
                                {MKT_CATEGORIES.filter(c=>c!=="우리브랜드").map(cat=>(
                                  <button key={cat} onClick={()=>setMktNewCategory(cat)}
                                    style={{flex:1,padding:"5px 0",borderRadius:7,border:`1.5px solid ${mktNewCategory===cat?C.rose:C.border}`,background:mktNewCategory===cat?C.rose:"transparent",color:mktNewCategory===cat?"#fff":C.inkMid,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                                    {cat}
                                  </button>
                                ))}
                              </div>
                              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                                <input value={mktNewKeyword} onChange={e=>setMktNewKeyword(e.target.value)}
                                  placeholder="검색 키워드 (순위 추적용, 선택)"
                                  style={{flex:1,fontSize:11,padding:"7px 10px",borderRadius:8,border:`1px solid ${C.border}`,outline:"none",fontFamily:"inherit"}}/>
                                <button onClick={()=>{
                                  const url=mktNewUrl.trim(); if(!url) return;
                                  const pid=extractPid(url);
                                  fetch("/api/market/links",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({platform,product_id:pid,url,active:true,search_keyword:mktNewKeyword.trim()||null,category:mktNewCategory||null})})
                                    .then(()=>{setMktNewUrl("");setMktNewKeyword("");setMktNewCategory("");setMktPlatformLinks(p=>({...p,[platform]:null}));setMktCompareData(null);});
                                }} style={{padding:"7px 16px",borderRadius:8,border:"none",background:"#111",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                                  <MI n="add" size={13}/>추가
                                </button>
                              </div>
                            </div>
                          </Card>
                          <Card>
                            <div style={{fontSize:12,fontWeight:700,color:C.ink,marginBottom:8}}>등록된 링크 <span style={{fontWeight:400,color:C.inkLt}}>({(links||[]).length}개)</span></div>
                            {!links?(
                              <div style={{color:C.inkLt,fontSize:11,textAlign:"center",padding:"16px 0"}}>불러오는 중...</div>
                            ):links.length===0?(
                              <div style={{color:C.inkLt,fontSize:11,textAlign:"center",padding:"16px 0"}}>등록된 링크 없음</div>
                            ):(
                              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                                {links.map(link=>(
                                  <div key={link.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:`1px solid ${C.cream}`}}>
                                    <span style={{fontSize:10,color:C.inkLt,minWidth:60}}>#{link.product_id}</span>
                                    <div style={{flex:1,overflow:"hidden"}}>
                                      <a href={link.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#2563eb",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{link.url}</a>
                                      {mktEditId===link.id?(
                                        <div style={{display:"flex",gap:4,marginTop:3}}>
                                          <input value={mktEditKeyword} onChange={e=>setMktEditKeyword(e.target.value)}
                                            placeholder="검색 키워드" autoFocus
                                            style={{flex:1,fontSize:10,padding:"3px 6px",borderRadius:6,border:`1px solid ${C.border}`,outline:"none",fontFamily:"inherit"}}/>
                                          <button onClick={()=>{
                                            fetch("/api/market/links",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:link.id,search_keyword:mktEditKeyword.trim()||null})})
                                              .then(()=>{setMktEditId(null);setMktPlatformLinks(p=>({...p,[platform]:null}));});
                                          }} style={{padding:"3px 8px",borderRadius:6,border:"none",background:"#111",color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>저장</button>
                                          <button onClick={()=>setMktEditId(null)} style={{padding:"3px 6px",borderRadius:6,border:"none",background:"#f3f4f6",color:C.inkMid,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>취소</button>
                                        </div>
                                      ):(
                                        <span style={{fontSize:10,color:"#7c3aed",cursor:"pointer"}} onClick={()=>{setMktEditId(link.id);setMktEditKeyword(link.search_keyword||"");}}>
                                          {link.search_keyword?`🔍 ${link.search_keyword}`:"+ 키워드 추가"}
                                        </span>
                                      )}
                                    </div>
                                    <button onClick={()=>{
                                      fetch("/api/market/links",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:link.id,active:!link.active})})
                                        .then(()=>setMktPlatformLinks(p=>({...p,[platform]:null})));
                                    }} style={{padding:"3px 8px",borderRadius:6,border:"none",background:link.active?"#dcfce7":"#f3f4f6",color:link.active?"#16a34a":C.inkMid,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                                      {link.active?"활성":"비활성"}
                                    </button>
                                    <button onClick={()=>{
                                      if(!confirm("삭제할까요?")) return;
                                      fetch("/api/market/links",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:link.id})})
                                        .then(()=>setMktPlatformLinks(p=>({...p,[platform]:null})));
                                    }} style={{padding:"3px 8px",borderRadius:6,border:"none",background:"#fee2e2",color:"#dc2626",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                                      삭제
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </Card>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {mktCategoryTab!==MKT_FAV_TAB&&mktCategoryTab!==MKT_PRICE_TAB&&mktCategoryTab==="우리브랜드"&&(()=>{
                  const matchOurCat = (prod) => {
                    if(mktOurBrandFilter==="전체") return true;
                    const text = ((prod.modelMemo||"")+(prod.name||"")).toLowerCase();
                    if(mktOurBrandFilter==="드라이기") return text.includes("드라이기")||text.includes("드라이")||text.includes("소닉")||text.includes("에어리");
                    if(mktOurBrandFilter==="고데기") return text.includes("고데기")||text.includes("컬링")||text.includes("빗고데")||text.includes("볼륨")||text.includes("뷰러");
                    if(mktOurBrandFilter==="케어제품") return !text.includes("드라이")&&!text.includes("소닉")&&!text.includes("에어리")&&!text.includes("고데기")&&!text.includes("컬링")&&!text.includes("볼륨");
                    return true;
                  };
                  const allOurProds = (marketData||[]).filter(p=>(p.category||MKT_CATEGORIES[0])==="우리브랜드");
                  const subCats = ["전체","드라이기","고데기","케어제품"];
                  return(<>
                    <div style={{display:"flex",gap:4,marginBottom:10,flexWrap:"wrap"}}>
                      {subCats.map(cat=>{
                        const cnt = cat==="전체" ? allOurProds.length : allOurProds.filter(matchOurCat).length;
                        const c = cat==="전체" ? allOurProds.length : allOurProds.filter(p=>{
                          const text=((p.modelMemo||"")+(p.name||"")).toLowerCase();
                          if(cat==="드라이기") return text.includes("드라이기")||text.includes("드라이")||text.includes("소닉")||text.includes("에어리");
                          if(cat==="고데기") return text.includes("고데기")||text.includes("컬링")||text.includes("빗고데")||text.includes("볼륨")||text.includes("뷰러");
                          if(cat==="케어제품") return !text.includes("드라이")&&!text.includes("소닉")&&!text.includes("에어리")&&!text.includes("고데기")&&!text.includes("컬링")&&!text.includes("볼륨");
                          return true;
                        }).length;
                        return(
                          <button key={cat} onClick={()=>setMktOurBrandFilter(cat)}
                            style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${mktOurBrandFilter===cat?"#7c3aed":C.border}`,background:mktOurBrandFilter===cat?"#7c3aed":"transparent",color:mktOurBrandFilter===cat?"#fff":C.inkMid,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                            {cat} <span style={{fontSize:9,opacity:0.8}}>{c}</span>
                          </button>
                        );
                      })}
                    </div>
                    {allOurProds.filter(matchOurCat).map(prod=>{
                  const items = [...(prod.items||[])].sort((a,b)=>{
                    const score = x => (x.favorite?2:0)+(x.manual?1:0);
                    return score(b)-score(a);
                  });
                  const fmtP = n => n ? `₩${Math.round(n).toLocaleString()}` : "—";
                  return(
                    <Card key={prod.id}>
                      {/* 제품 헤더 */}
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                            <span style={{fontSize:14,fontWeight:900,color:C.ink}}>{prod.name}</span>
                            <span style={{fontSize:11,fontWeight:700,color:C.inkMid,background:C.cream,padding:"2px 8px",borderRadius:8}}>
                              우리 판매가 {fmtP(prod.ourPrice)}
                            </span>
                            <input
                              value={prod.modelMemo||""}
                              onChange={e=>setMarketData((marketData||[]).map(p=>p.id!==prod.id?p:{...p,modelMemo:e.target.value}))}
                              placeholder="모델명/원부 메모"
                              style={{fontSize:10,color:C.inkMid,background:"transparent",border:"none",borderBottom:`1px dashed ${C.border}`,outline:"none",padding:"1px 4px",minWidth:80,fontFamily:"inherit"}}/>
                          </div>
                          {items.length>0&&(()=>{
                            const withSale = items.filter(i=>i.salePrice);
                            const avgSale = withSale.length ? Math.round(withSale.reduce((s,i)=>s+i.salePrice,0)/withSale.length) : null;
                            const minSale = withSale.length ? Math.min(...withSale.map(i=>i.salePrice)) : null;
                            const maxSale = withSale.length ? Math.max(...withSale.map(i=>i.salePrice)) : null;
                            if(!avgSale) return null;
                            const diff = prod.ourPrice ? prod.ourPrice - avgSale : null;
                            return(
                              <div style={{fontSize:10,color:C.inkMid,marginTop:3}}>
                                시장 할인가 범위: {fmtP(minSale)} ~ {fmtP(maxSale)} · 평균 {fmtP(avgSale)}
                                {diff!==null&&<span style={{marginLeft:6,fontWeight:700,color:diff>0?C.good:C.bad}}>
                                  {diff>0?`우리가 ₩${Math.round(diff).toLocaleString()} 더 비쌈`:`우리가 ₩${Math.round(-diff).toLocaleString()} 더 저렴`}
                                </span>}
                              </div>
                            );
                          })()}
                        </div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <input type="number" value={prod.ourPrice||""} onChange={e=>{
                            setMarketData((marketData||[]).map(p=>p.id!==prod.id?p:{...p,ourPrice:parseInt(e.target.value)||0}));
                          }} placeholder="판매가"
                            style={{width:90,padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:11,fontFamily:"inherit",outline:"none"}}/>
                          <button onClick={()=>{if(confirm(`'${prod.name}' 제품을 삭제할까요?`))setMarketData((marketData||[]).filter(p=>p.id!==prod.id));}}
                            style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,width:24,height:24,cursor:"pointer",fontSize:12,color:C.inkLt,display:"flex",alignItems:"center",justifyContent:"center"}}>
                            <MI n="delete" size={13}/>
                          </button>
                        </div>
                      </div>

                      {/* 경쟁사 테이블 */}
                      {items.length>0&&(
                        <div style={{overflowX:"auto",marginBottom:10}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                            <thead>
                              <tr style={{background:C.cream}}>
                                {["채널","제품명","정가","할인가","차이","행사/프로모션","메모","조회일",""].map(h=>(
                                  <th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:700,color:C.inkMid,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {items.map(item=>{
                                const diff = (prod.ourPrice && item.salePrice) ? prod.ourPrice - item.salePrice : null;
                                const fetching = mktFetching[item.id];
                                return(
                                  <tr key={item.id} style={{borderBottom:`1px solid ${C.border}`,background:item.favorite?"#fffbeb":item.manual?"#fefce8":undefined}}>
                                    <td style={{padding:"7px 8px",whiteSpace:"nowrap"}}>
                                      <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:6,background:C.cream,color:C.inkMid}}>{item.channel}</span>
                                    </td>
                                    <td style={{padding:"7px 8px",maxWidth:200}}>
                                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                                        {item.image&&<img src={item.image} alt="" style={{width:32,height:32,objectFit:"cover",borderRadius:4,flexShrink:0,border:`1px solid ${C.border}`}}/>}
                                        <div style={{flex:1,overflow:"hidden"}}>
                                          <div style={{fontWeight:700,color:C.ink,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.productName||"—"}</div>
                                          {item.url&&(
                                            <a href={item.url} target="_blank" rel="noreferrer"
                                              style={{display:"inline-flex",alignItems:"center",gap:2,fontSize:9,color:"#2563eb",textDecoration:"none",marginTop:1}}>
                                              <MI n="open_in_new" size={10}/>판매 페이지
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{padding:"7px 8px",color:C.inkMid,whiteSpace:"nowrap"}}>{item.regularPrice?`₩${item.regularPrice.toLocaleString()}`:"—"}</td>
                                    <td style={{padding:"7px 8px",whiteSpace:"nowrap"}}>
                                      <div style={{fontWeight:800,color:C.ink}}>{item.salePrice?`₩${item.salePrice.toLocaleString()}`:"—"}</div>
                                      {item.naverItems?.slice(0,2).map((ni,ni_i)=>(
                                        <div key={ni_i} style={{fontSize:9,color:C.inkLt,marginTop:1,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                          {ni.mallName} ₩{ni.lprice?.toLocaleString()}
                                        </div>
                                      ))}
                                    </td>
                                    <td style={{padding:"7px 8px",whiteSpace:"nowrap"}}>
                                      {diff!==null&&(
                                        <span style={{fontWeight:700,fontSize:10,color:diff>0?C.bad:C.good}}>
                                          {diff>0?`+₩${Math.round(diff).toLocaleString()}`:`-₩${Math.round(-diff).toLocaleString()}`}
                                          <span style={{fontWeight:400,color:C.inkLt,marginLeft:3}}>{diff>0?"우리 더 비쌈":"우리 더 저렴"}</span>
                                        </span>
                                      )}
                                    </td>
                                    <td style={{padding:"4px 8px",maxWidth:160}} onClick={()=>{if(mktEditCell?.itemId!==item.id||mktEditCell?.field!=="promotion"){setMktEditCell({productId:prod.id,itemId:item.id,field:"promotion"});setMktEditValue(item.promotion||"");}}}>
                                      {mktEditCell?.itemId===item.id&&mktEditCell?.field==="promotion"
                                        ? <textarea autoFocus rows={2} value={mktEditValue} onChange={e=>setMktEditValue(e.target.value)}
                                            onBlur={e=>saveMktCell(prod.id,item.id,"promotion",e.target.value)}
                                            onKeyDown={e=>{if(e.key==="Escape")setMktEditCell(null);}}
                                            style={{width:"100%",fontSize:10,border:`1px solid ${C.accent}`,borderRadius:4,padding:"3px 5px",resize:"vertical",minHeight:36,fontFamily:"inherit",outline:"none"}}/>
                                        : <span style={{fontSize:10,color:item.promotion?C.warn:C.inkLt,cursor:"text",display:"block",minHeight:18,whiteSpace:"pre-wrap",wordBreak:"break-all"}} title={item.promotion||"클릭해서 입력"}>
                                            {item.promotion||<span style={{color:C.inkLt,fontStyle:"italic"}}>—</span>}
                                          </span>
                                      }
                                    </td>
                                    <td style={{padding:"4px 8px",maxWidth:140}} onClick={()=>{if(mktEditCell?.itemId!==item.id||mktEditCell?.field!=="note"){setMktEditCell({productId:prod.id,itemId:item.id,field:"note"});setMktEditValue(item.note||"");}}}>
                                      {mktEditCell?.itemId===item.id&&mktEditCell?.field==="note"
                                        ? <textarea autoFocus rows={2} value={mktEditValue} onChange={e=>setMktEditValue(e.target.value)}
                                            onBlur={e=>saveMktCell(prod.id,item.id,"note",e.target.value)}
                                            onKeyDown={e=>{if(e.key==="Escape")setMktEditCell(null);}}
                                            style={{width:"100%",fontSize:10,border:`1px solid ${C.accent}`,borderRadius:4,padding:"3px 5px",resize:"vertical",minHeight:36,fontFamily:"inherit",outline:"none"}}/>
                                        : <span style={{fontSize:10,color:item.note?C.inkMid:C.inkLt,cursor:"text",display:"block",minHeight:18,whiteSpace:"pre-wrap",wordBreak:"break-all"}} title={item.note||"클릭해서 입력"}>
                                            {item.note||<span style={{color:C.inkLt,fontStyle:"italic"}}>—</span>}
                                          </span>
                                      }
                                    </td>
                                    <td style={{padding:"7px 8px",color:C.inkLt,fontSize:10,whiteSpace:"nowrap"}}>{item.lastChecked||"—"}</td>
                                    <td style={{padding:"7px 8px",whiteSpace:"nowrap"}}>
                                      <div style={{display:"flex",gap:4}}>
                                        <button onClick={()=>setMarketData((marketData||[]).map(p=>p.id!==prod.id?p:{...p,items:p.items.map(i=>i.id!==item.id?i:{...i,favorite:!i.favorite})}))}
                                          title="즐겨찾기"
                                          style={{border:`1px solid ${item.favorite?"#f59e0b":C.border}`,borderRadius:6,width:24,height:24,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",background:item.favorite?"#fef3c7":"transparent"}}>
                                          <MI n="star" size={12} style={{color:item.favorite?"#f59e0b":C.inkLt}}/>
                                        </button>
                                        <button onClick={()=>{
                                            setMktItemModal({productId:prod.id,itemId:item.id});
                                            setMktItemInput({
                                              channel:item.channel||"스마트스토어",
                                              productName:item.productName||"",
                                              url:item.url||"",
                                              image:item.image||"",
                                              regularPrice:item.regularPrice||"",
                                              salePrice:item.salePrice||"",
                                              promotion:item.promotion||"",
                                              note:item.note||"",
                                            });
                                            setMktModalSearch("");setMktModalResults([]);
                                          }}
                                          title="수정"
                                          style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,width:24,height:24,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                          <MI n="edit" size={12} style={{color:C.inkMid}}/>
                                        </button>
                                        <button onClick={()=>fetchMarketPrice(prod.id,item.id)} disabled={fetching}
                                          title="네이버 쇼핑에서 가격 조회"
                                          style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,width:24,height:24,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",opacity:fetching?0.5:1}}>
                                          <MI n="sync" size={12} style={{color:fetching?C.inkLt:C.good}}/>
                                        </button>
                                        <button onClick={()=>setMarketData((marketData||[]).map(p=>p.id!==prod.id?p:{...p,items:p.items.filter(i=>i.id!==item.id)}))}
                                          style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,width:24,height:24,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                          <MI n="close" size={12} style={{color:C.inkLt}}/>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                        <input
                          value={mktSearchQuery[prod.id]??prod.name}
                          onChange={e=>setMktSearchQuery(p=>({...p,[prod.id]:e.target.value}))}
                          placeholder="검색 키워드 (예: 드라이기)"
                          onKeyDown={e=>{if(e.key==="Enter")autoFillCompetitors(prod.id,mktSearchQuery[prod.id]??prod.name,prod.ourPrice,prod.category==="우리브랜드");}}
                          style={{flex:1,minWidth:140,padding:"6px 10px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:11,fontFamily:"inherit",outline:"none"}}/>
                        <button onClick={()=>autoFillCompetitors(prod.id,mktSearchQuery[prod.id]??prod.name,prod.ourPrice,prod.category==="우리브랜드")} disabled={mktAutoFetching[prod.id]}
                          style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:mktAutoFetching[prod.id]?C.cream:"#f0fdf4",color:C.good,fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit",opacity:mktAutoFetching[prod.id]?0.6:1,whiteSpace:"nowrap"}}>
                          <MI n="auto_awesome" size={13} style={{color:C.good}}/>
                          {mktAutoFetching[prod.id]?"검색 중...":"자동 채우기"}
                        </button>
                        <Btn small onClick={()=>{setMktItemModal({productId:prod.id});setMktItemInput({channel:"스마트스토어",productName:"",url:"",image:"",regularPrice:"",salePrice:"",promotion:"",note:""});setMktModalSearch("");setMktModalResults([]);}}>
                          + 직접 추가
                        </Btn>
                      </div>
                    </Card>
                  );
                })}
                  </>);
                })()}

                {mktCategoryTab!==MKT_FAV_TAB&&mktCategoryTab!==MKT_PRICE_TAB&&mktCategoryTab!=="우리브랜드"&&(marketData||[]).filter(prod=>(prod.category||MKT_CATEGORIES[0])===mktCategoryTab).map(prod=>{
                  const items = [...(prod.items||[])].sort((a,b)=>{
                    const score = x => (x.favorite?2:0)+(x.manual?1:0);
                    return score(b)-score(a);
                  });
                  const fmtP = n => n ? `₩${Math.round(n).toLocaleString()}` : "—";
                  return(
                    <Card key={prod.id}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                            <span style={{fontSize:14,fontWeight:900,color:C.ink}}>{prod.name}</span>
                            <span style={{fontSize:11,fontWeight:700,color:C.inkMid,background:C.cream,padding:"2px 8px",borderRadius:8}}>
                              우리 판매가 {fmtP(prod.ourPrice)}
                            </span>
                            <input
                              value={prod.modelMemo||""}
                              onChange={e=>setMarketData((marketData||[]).map(p=>p.id!==prod.id?p:{...p,modelMemo:e.target.value}))}
                              placeholder="모델명/원부 메모"
                              style={{fontSize:10,color:C.inkMid,background:"transparent",border:"none",borderBottom:`1px dashed ${C.border}`,outline:"none",padding:"1px 4px",minWidth:80,fontFamily:"inherit"}}/>
                          </div>
                          {items.length>0&&(()=>{
                            const withSale = items.filter(i=>i.salePrice);
                            const avgSale = withSale.length ? Math.round(withSale.reduce((s,i)=>s+i.salePrice,0)/withSale.length) : null;
                            const minSale = withSale.length ? Math.min(...withSale.map(i=>i.salePrice)) : null;
                            const maxSale = withSale.length ? Math.max(...withSale.map(i=>i.salePrice)) : null;
                            if(!avgSale) return null;
                            const diff = prod.ourPrice ? prod.ourPrice - avgSale : null;
                            return(
                              <div style={{fontSize:10,color:C.inkMid,marginTop:3}}>
                                시장 최저 {fmtP(minSale)} · 최고 {fmtP(maxSale)} · 평균 {fmtP(avgSale)}
                                {diff!==null&&<span style={{marginLeft:6,color:diff>0?C.good:"#dc2626",fontWeight:700}}>{diff>0?`우리가 ₩${diff.toLocaleString()} 높음`:`우리가 ₩${Math.abs(diff).toLocaleString()} 낮음`}</span>}
                              </div>
                            );
                          })()}
                        </div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <input type="number" value={prod.ourPrice||""} onChange={e=>{
                            setMarketData((marketData||[]).map(p=>p.id!==prod.id?p:{...p,ourPrice:parseInt(e.target.value)||0}));
                          }} placeholder="판매가"
                            style={{width:90,padding:"5px 8px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:11,fontFamily:"inherit",outline:"none"}}/>
                          <button onClick={()=>setMarketData((marketData||[]).filter(p=>p.id!==prod.id))}
                            style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 8px",cursor:"pointer",fontSize:10,color:C.inkLt,fontFamily:"inherit"}}>삭제</button>
                        </div>
                      </div>
                      {items.length>0&&(
                        <div style={{overflowX:"auto",marginBottom:10}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                            <thead>
                              <tr style={{background:C.cream}}>
                                {["채널","제품명","정가","할인가","차이","행사/프로모션","메모","조회일",""].map(h=>(
                                  <th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:700,color:C.inkMid,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {items.map(item=>{
                                const diff = (prod.ourPrice && item.salePrice) ? prod.ourPrice - item.salePrice : null;
                                const fetching = mktFetching[item.id];
                                return(
                                  <tr key={item.id} style={{borderBottom:`1px solid ${C.border}`,background:item.favorite?"#fffbeb":item.manual?"#fefce8":undefined}}>
                                    <td style={{padding:"7px 8px",whiteSpace:"nowrap"}}>
                                      <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:6,background:C.cream,color:C.inkMid}}>{item.channel}</span>
                                    </td>
                                    <td style={{padding:"7px 8px",maxWidth:200}}>
                                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                                        {item.image&&<img src={item.image} alt="" style={{width:32,height:32,objectFit:"cover",borderRadius:4,flexShrink:0,border:`1px solid ${C.border}`}}/>}
                                        <div style={{flex:1,overflow:"hidden"}}>
                                          <div style={{fontWeight:700,color:C.ink,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.productName||"—"}</div>
                                          {item.url&&(
                                            <a href={item.url} target="_blank" rel="noreferrer"
                                              style={{display:"inline-flex",alignItems:"center",gap:2,fontSize:9,color:"#2563eb",textDecoration:"none",marginTop:1}}>
                                              <MI n="open_in_new" size={10}/>판매 페이지
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{padding:"7px 8px",color:C.inkMid,whiteSpace:"nowrap"}}>{item.regularPrice?`₩${item.regularPrice.toLocaleString()}`:"—"}</td>
                                    <td style={{padding:"7px 8px",whiteSpace:"nowrap"}}>
                                      <div style={{fontWeight:800,color:C.ink}}>{item.salePrice?`₩${item.salePrice.toLocaleString()}`:"—"}</div>
                                      {item.naverItems?.slice(0,2).map((ni,ni_i)=>(
                                        <div key={ni_i} style={{fontSize:9,color:C.inkLt,marginTop:1,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                          {ni.mallName} ₩{ni.lprice?.toLocaleString()}
                                        </div>
                                      ))}
                                    </td>
                                    <td style={{padding:"7px 8px",whiteSpace:"nowrap"}}>
                                      {diff!==null&&(
                                        <span style={{fontWeight:700,fontSize:10,color:diff>0?C.bad:C.good}}>
                                          {diff>0?`+₩${Math.round(diff).toLocaleString()}`:`-₩${Math.round(-diff).toLocaleString()}`}
                                          <span style={{fontWeight:400,color:C.inkLt,marginLeft:3}}>{diff>0?"우리 더 비쌈":"우리 더 저렴"}</span>
                                        </span>
                                      )}
                                    </td>
                                    <td style={{padding:"4px 8px",maxWidth:160}} onClick={()=>{if(mktEditCell?.itemId!==item.id||mktEditCell?.field!=="promotion"){setMktEditCell({productId:prod.id,itemId:item.id,field:"promotion"});setMktEditValue(item.promotion||"");}}}>
                                      {mktEditCell?.itemId===item.id&&mktEditCell?.field==="promotion"
                                        ? <textarea autoFocus rows={2} value={mktEditValue} onChange={e=>setMktEditValue(e.target.value)}
                                            onBlur={e=>saveMktCell(prod.id,item.id,"promotion",e.target.value)}
                                            onKeyDown={e=>{if(e.key==="Escape")setMktEditCell(null);}}
                                            style={{width:"100%",fontSize:10,border:`1px solid ${C.accent}`,borderRadius:4,padding:"3px 5px",resize:"vertical",minHeight:36,fontFamily:"inherit",outline:"none"}}/>
                                        : <span style={{fontSize:10,color:item.promotion?C.warn:C.inkLt,cursor:"text",display:"block",minHeight:18,whiteSpace:"pre-wrap",wordBreak:"break-all"}} title={item.promotion||"클릭해서 입력"}>
                                            {item.promotion||<span style={{color:C.inkLt,fontStyle:"italic"}}>—</span>}
                                          </span>
                                      }
                                    </td>
                                    <td style={{padding:"4px 8px",maxWidth:140}} onClick={()=>{if(mktEditCell?.itemId!==item.id||mktEditCell?.field!=="note"){setMktEditCell({productId:prod.id,itemId:item.id,field:"note"});setMktEditValue(item.note||"");}}}>
                                      {mktEditCell?.itemId===item.id&&mktEditCell?.field==="note"
                                        ? <textarea autoFocus rows={2} value={mktEditValue} onChange={e=>setMktEditValue(e.target.value)}
                                            onBlur={e=>saveMktCell(prod.id,item.id,"note",e.target.value)}
                                            onKeyDown={e=>{if(e.key==="Escape")setMktEditCell(null);}}
                                            style={{width:"100%",fontSize:10,border:`1px solid ${C.accent}`,borderRadius:4,padding:"3px 5px",resize:"vertical",minHeight:36,fontFamily:"inherit",outline:"none"}}/>
                                        : <span style={{fontSize:10,color:item.note?C.inkMid:C.inkLt,cursor:"text",display:"block",minHeight:18,whiteSpace:"pre-wrap",wordBreak:"break-all"}} title={item.note||"클릭해서 입력"}>
                                            {item.note||<span style={{color:C.inkLt,fontStyle:"italic"}}>—</span>}
                                          </span>
                                      }
                                    </td>
                                    <td style={{padding:"7px 8px",color:C.inkLt,fontSize:10,whiteSpace:"nowrap"}}>{item.lastChecked||"—"}</td>
                                    <td style={{padding:"7px 8px",whiteSpace:"nowrap"}}>
                                      <div style={{display:"flex",gap:4}}>
                                        <button onClick={()=>setMarketData((marketData||[]).map(p=>p.id!==prod.id?p:{...p,items:p.items.map(i=>i.id!==item.id?i:{...i,favorite:!i.favorite})}))}
                                          title="즐겨찾기"
                                          style={{border:`1px solid ${item.favorite?"#f59e0b":C.border}`,borderRadius:6,width:24,height:24,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",background:item.favorite?"#fef3c7":"transparent"}}>
                                          <MI n="star" size={12} style={{color:item.favorite?"#f59e0b":C.inkLt}}/>
                                        </button>
                                        <button onClick={()=>{setMktItemModal({productId:prod.id,itemId:item.id});setMktItemInput({channel:item.channel||"스마트스토어",productName:item.productName||"",url:item.url||"",image:item.image||"",regularPrice:item.regularPrice||"",salePrice:item.salePrice||"",promotion:item.promotion||"",note:item.note||""});setMktModalSearch("");setMktModalResults([]);}}
                                          title="수정"
                                          style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,width:24,height:24,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                          <MI n="edit" size={12} style={{color:C.inkMid}}/>
                                        </button>
                                        <button onClick={()=>fetchMarketPrice(prod.id,item.id)} disabled={fetching}
                                          title="네이버 쇼핑에서 가격 조회"
                                          style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,width:24,height:24,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",opacity:fetching?0.5:1}}>
                                          <MI n="sync" size={12} style={{color:fetching?C.inkLt:C.good}}/>
                                        </button>
                                        <button onClick={()=>setMarketData((marketData||[]).map(p=>p.id!==prod.id?p:{...p,items:p.items.filter(i=>i.id!==item.id)}))}
                                          style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,width:24,height:24,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                          <MI n="close" size={12} style={{color:C.inkLt}}/>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                        <input
                          value={mktSearchQuery[prod.id]??prod.name}
                          onChange={e=>setMktSearchQuery(p=>({...p,[prod.id]:e.target.value}))}
                          placeholder="검색 키워드 (예: 드라이기)"
                          onKeyDown={e=>{if(e.key==="Enter")autoFillCompetitors(prod.id,mktSearchQuery[prod.id]??prod.name,prod.ourPrice,prod.category==="우리브랜드");}}
                          style={{flex:1,minWidth:140,padding:"6px 10px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:11,fontFamily:"inherit",outline:"none"}}/>
                        <button onClick={()=>autoFillCompetitors(prod.id,mktSearchQuery[prod.id]??prod.name,prod.ourPrice,prod.category==="우리브랜드")} disabled={mktAutoFetching[prod.id]}
                          style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:mktAutoFetching[prod.id]?C.cream:"#f0fdf4",color:C.good,fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit",opacity:mktAutoFetching[prod.id]?0.6:1,whiteSpace:"nowrap"}}>
                          <MI n="auto_awesome" size={13} style={{color:C.good}}/>
                          {mktAutoFetching[prod.id]?"검색 중...":"자동 채우기"}
                        </button>
                        <Btn small onClick={()=>{setMktItemModal({productId:prod.id});setMktItemInput({channel:"스마트스토어",productName:"",url:"",image:"",regularPrice:"",salePrice:"",promotion:"",note:""});setMktModalSearch("");setMktModalResults([]);}}>
                          + 직접 추가
                        </Btn>
                      </div>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        )}


        {mainTab==="track"&&(<>

        {/* 서브 탭 */}
        <div style={{display:"flex",gap:4,background:C.cream,borderRadius:12,padding:4,width:"fit-content"}}>
          {[{id:"all",label:"전체"},
            {id:"my",label:"우리 브랜드"},
            {id:"competitor",label:"경쟁사"}
          ].map(t=>(
            <button key={t.id} onClick={()=>setKwTab(t.id)} style={{
              fontSize:11,fontWeight:700,padding:"5px 14px",borderRadius:8,border:"none",cursor:"pointer",
              background:kwTab===t.id?C.rose:"transparent",
              color:kwTab===t.id?"#fff":C.inkMid,fontFamily:"inherit",
            }}>{t.label}</button>
          ))}
        </div>

        {keywords.length===0 ? (
          <Card>
            <div style={{textAlign:"center",padding:"40px 0",color:C.inkLt}}>
              <MI n="search" size={40} style={{display:"block",margin:"0 auto 12px"}}/>
              <div style={{fontSize:14,fontWeight:700,color:C.inkMid,marginBottom:6}}>아직 키워드가 없어요</div>
              <div style={{fontSize:12,color:C.inkLt,marginBottom:16}}>추적할 키워드를 추가하고 매주 순위를 기록해보세요</div>
              <Btn onClick={()=>setAddKwModal(true)}><MI n="add" size={13}/> 첫 키워드 추가</Btn>
            </div>
          </Card>
        ) : (
          <>
            {/* 키워드 카드 목록 */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
              {filtered.map(kw => {
                const ch = fmtChange(kw.change);
                return (
                  <div key={kw.id} onClick={()=>setSelectedKw(selectedKw===kw.id?null:kw.id)}
                    style={{
                      background:"#fff",border:`2px solid ${selectedKw===kw.id?kw.color:C.border}`,
                      borderRadius:14,padding:"14px 16px",cursor:"pointer",
                      boxShadow:selectedKw===kw.id?`0 0 0 3px ${kw.color}22`:"none",
                      transition:"all 0.15s",
                    }}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:10,height:10,borderRadius:"50%",background:kw.color,flexShrink:0}}/>
                        <div style={{fontSize:13,fontWeight:800,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:110}}>{kw.name}</div>
                      </div>
                      {!kw.fixed&&<button onClick={e=>{e.stopPropagation();deleteKeyword(kw.id);}}
                        style={{background:"none",border:"none",cursor:"pointer",color:C.inkLt,padding:2,fontSize:12}}>✕</button>}
                    </div>
                    {kw.competitor&&<div style={{fontSize:10,color:C.inkLt,marginBottom:6}}>{kw.competitor}</div>}
                    <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
                      <div style={{fontSize:28,fontWeight:900,color:kw.latest?kw.color:C.inkLt,lineHeight:1}}>
                        {kw.latest ? `${kw.latest.rank}위` : "—"}
                      </div>
                      {ch&&<div style={{fontSize:11,fontWeight:800,color:ch.color,marginBottom:2}}>{ch.text}</div>}
                    </div>
                    {kw.latest&&<div style={{fontSize:10,color:C.inkLt,marginTop:4}}>{kw.latest.date} 기준</div>}
                    <div style={{display:"flex",gap:4,marginTop:6}}>
                      {autoRank[kw.name]?.topItems?.length>0&&(
                        <button onClick={e=>{e.stopPropagation();setRankModal(kw.name);}}
                          style={{flex:1,padding:"5px 0",borderRadius:8,
                            border:`1px solid ${C.border}`,background:"#fff",color:C.inkMid,
                            fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                          <MI n="military_tech" size={11}/> 순위 보기
                        </button>
                      )}
                      <button onClick={e=>{
                        e.stopPropagation();
                        const brand = kw.competitor||"오아";
                        const q = brand+kw.name;
                        setSearchInput(q);
                        setMainTab("explore");
                        searchKeywords(q);
                      }} style={{flex:1,padding:"5px 0",borderRadius:8,
                        border:`1px solid ${C.border}`,background:"#fff",color:C.inkMid,
                        fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        <MI n="bar_chart" size={11}/> 검색량 보기
                      </button>
                    </div>
                    <button onClick={e=>{e.stopPropagation();setLogKwId(kw.id);setLogModal(true);}}
                      style={{marginTop:8,width:"100%",padding:"5px 0",borderRadius:8,border:`1px solid ${C.border}`,
                        background:C.cream,color:C.inkMid,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                      + 순위 기록
                    </button>
                  </div>
                );
              })}
            </div>

            {/* 순위 추이 차트 */}
            {chartData.length > 0 && (
              <Card>
                <CardTitle title="순위 추이" sub={selectedKw?"선택 키워드":"상위 5개 키워드 · 클릭으로 선택"}/>
                <div style={{fontSize:10,color:C.inkLt,marginBottom:8}}>낮을수록 상위 노출 (1위가 최상위)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                    <XAxis dataKey="date" tick={{fontSize:10}} stroke={C.border}/>
                    <YAxis reversed tick={{fontSize:10}} stroke={C.border} domain={['dataMin - 2','dataMax + 2']}/>
                    <Tooltip formatter={(v,n)=>[`${v}위`,n]}/>
                    {chartKws.map(kw=>(
                      <Line key={kw.id} type="monotone" dataKey={kw.name}
                        stroke={kw.color} strokeWidth={2} dot={{r:4}} connectNulls/>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* 최근 기록 */}
            {logs.length > 0 && (
              <Card>
                <CardTitle title="최근 기록" sub="최신 20개"/>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead>
                      <tr style={{background:C.cream}}>
                        {["날짜","키워드","브랜드","순위","검색량","메모",""].map(h=>(
                          <th key={h} style={{padding:"6px 10px",textAlign:"left",fontWeight:700,color:C.inkMid,
                            borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...logs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20).map(log=>{
                        const kw = keywords.find(k=>k.id===log.keywordId);
                        return (
                          <tr key={log.id} style={{borderBottom:`1px solid ${C.border}`}}>
                            <td style={{padding:"7px 10px",color:C.inkMid}}>{log.date}</td>
                            <td style={{padding:"7px 10px"}}>
                              <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
                                <span style={{width:8,height:8,borderRadius:"50%",background:kw?.color||C.inkLt,flexShrink:0}}/>
                                <span style={{fontWeight:700,color:C.ink}}>{kw?.name||"삭제됨"}</span>
                                {kw?.competitor&&<span style={{fontSize:10,color:C.inkLt}}>({kw.competitor})</span>}
                              </span>
                            </td>
                            <td style={{padding:"7px 10px"}}>
                              <span style={{fontSize:11,fontWeight:700,color:C.rose,background:"#EFF6FF",padding:"2px 8px",borderRadius:10}}>
                                {log.brand||"OA"}
                              </span>
                            </td>
                            <td style={{padding:"7px 10px",fontWeight:800,color:C.ink}}>{log.rank}위</td>
                            <td style={{padding:"7px 10px",color:C.inkMid}}>{log.volume?log.volume.toLocaleString():"—"}</td>
                            <td style={{padding:"7px 10px",color:C.inkMid,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {log.auto ? <span style={{fontSize:10,color:C.rose,fontWeight:700,background:"#EFF6FF",padding:"1px 6px",borderRadius:10}}>자동</span> : log.note||"—"}
                            </td>
                            <td style={{padding:"4px 6px"}}>
                              <button onClick={()=>setKwData({...kwData,logs:logs.filter(l=>l.id!==log.id)})}
                                style={{background:"none",border:"none",cursor:"pointer",color:C.inkLt,fontSize:13,padding:2}}>✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
        </>)}

        {/* 경쟁사 순위 모달 */}
        {rankModal&&autoRank[rankModal]&&(
          <Modal title={<><MI n="military_tech"/> "{rankModal}" 네이버쇼핑 순위</>} onClose={()=>setRankModal(null)}>
            <div style={{overflowY:"auto",maxHeight:460}}>
              {autoRank[rankModal].topItems.map(item=>(
                <div key={item.rank} style={{
                  display:"flex",alignItems:"center",gap:10,
                  padding:"9px 12px",borderRadius:10,marginBottom:4,
                  background:item.isTarget?"#EFF6FF":"#fff",
                  border:`1px solid ${item.isTarget?C.rose:C.border}`,
                }}>
                  <div style={{fontSize:16,fontWeight:900,color:item.isTarget?C.rose:item.rank<=3?"#F59E0B":C.inkMid,
                    minWidth:36,textAlign:"center"}}>
                    {item.rank}위
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      {item.isTarget&&<span style={{fontSize:10,fontWeight:800,color:"#fff",background:C.rose,
                        padding:"1px 6px",borderRadius:10}}>{autoRank[rankModal].brand||"OA"}</span>}
                      <span style={{fontSize:12,fontWeight:800,color:item.isTarget?C.rose:C.ink}}>
                        {item.brand||item.mallName||"—"}
                      </span>
                    </div>
                    <div style={{fontSize:11,color:C.inkMid,marginTop:1,overflow:"hidden",
                      textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.title}</div>
                  </div>
                  {item.lprice&&(
                    <div style={{fontSize:12,fontWeight:800,color:C.ink,whiteSpace:"nowrap",textAlign:"right"}}>
                      {item.lprice.toLocaleString()}원
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{marginTop:8,fontSize:11,color:C.inkLt}}>네이버쇼핑 관련도순 기준 · 상위 30개</div>
          </Modal>
        )}

        {/* 키워드 추가 모달 */}
        {addKwModal&&(
          <Modal title={<><MI n="add_circle"/> 키워드 추가</>} onClose={()=>{setAddKwModal(false);setKwInput("");setCompInput("");}}>
            <FR label="키워드 *">
              <Inp value={kwInput} onChange={setKwInput} placeholder="예: 전동칫솔, 음파칫솔" autoFocus/>
            </FR>
            <FR label="브랜드명 (비우면 오아 기준)">
              <Inp value={compInput} onChange={setCompInput} placeholder="예: 유닉스, 다이슨 (비우면 오아)"/>
            </FR>
            <Btn onClick={addKeyword} disabled={!kwInput.trim()} style={{width:"100%",marginTop:4}}>
              <MI n="add" size={13}/> 추가하기
            </Btn>
          </Modal>
        )}

        {/* 순위 기록 모달 */}
        {logModal&&(
          <Modal title={<><MI n="edit_note"/> 순위 기록</>} onClose={()=>setLogModal(false)}>
            <FR label="키워드">
              <select value={logKwId||""} onChange={e=>setLogKwId(e.target.value)}
                style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${C.border}`,
                  fontSize:13,fontFamily:"inherit",background:"#fff",color:C.ink}}>
                {keywords.map(k=><option key={k.id} value={k.id}>{k.name}{k.competitor?` (${k.competitor})`:""}</option>)}
              </select>
            </FR>
            <FR label="날짜">
              <Inp value={logDate} onChange={setLogDate} placeholder="YYYY-MM-DD"/>
            </FR>
            <FR label="순위 *">
              <Inp value={logRank} onChange={setLogRank} placeholder="예: 3"/>
            </FR>
            <FR label="검색량 (선택)">
              <Inp value={logVol} onChange={setLogVol} placeholder="예: 12000"/>
            </FR>
            <FR label="메모 (선택)">
              <Inp value={logNote} onChange={setLogNote} placeholder="예: 주말 이벤트 영향"/>
            </FR>
            <Btn onClick={addLog} disabled={!logKwId||!logRank} style={{width:"100%",marginTop:4}}>
              <MI n="save" size={13}/> 저장
            </Btn>
          </Modal>
        )}
      </div>
    );
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return(
    <div className="oa-layout" style={{background:"#F4F4F5",minHeight:"100vh",fontFamily:"'Noto Sans KR',sans-serif",color:C.ink}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        *{box-sizing:border-box;margin:0;padding:0;} button{font-family:inherit;}
        input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        ::-webkit-scrollbar{height:4px;width:6px;}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;}
        ::-webkit-scrollbar-track{background:transparent;}

        /* PC 레이아웃 */
        .oa-layout { display:flex; flex-direction:column; min-height:100vh; }
        .oa-topbar { display:none; }
        .oa-body   { display:flex; flex:1; }
        .oa-sidebar{
          width:220px; flex-shrink:0;
          background:${C.white}; border-right:1px solid ${C.border};
          position:fixed; top:0; left:0; bottom:0;
          display:flex; flex-direction:column;
          z-index:100; overflow-y:auto;
        }
        .oa-main { margin-left:220px; flex:1; padding:28px 32px 60px; max-width:1200px; }
        .oa-mobile-nav { display:none !important; }
        .kpi-grid { grid-template-columns: repeat(6,1fr) !important; }
        .kpi-grid-3 { grid-template-columns: repeat(3,1fr) !important; }
        .content-grid-2 { grid-template-columns: 1fr 1fr !important; }
        .content-grid-3 { grid-template-columns: repeat(3,1fr) !important; }
        .alert-grid { grid-template-columns: 1fr 1fr !important; }

        /* 모바일 */
        @media (max-width: 768px) {
          .oa-sidebar { display:none !important; }
          .oa-topbar  { display:flex !important; }
          .oa-main    { margin-left:0 !important; padding:12px 14px 80px !important; max-width:100% !important; }
          .oa-mobile-nav { display:flex !important; }
          .kpi-grid   { grid-template-columns: repeat(3,1fr) !important; }
          .kpi-grid-3 { grid-template-columns: repeat(3,1fr) !important; }
          .content-grid-2 { grid-template-columns: 1fr !important; }
          .content-grid-3 { grid-template-columns: repeat(2,1fr) !important; }
          .alert-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width:480px){
          .kpi-grid   { grid-template-columns: repeat(2,1fr) !important; }
          .content-grid-3 { grid-template-columns: 1fr 1fr !important; }
        }

        /* 달력 모바일 */
        .cal-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .cal-grid-wrap { min-width: 560px; }
        .cal-cell { min-height: 200px; }
        @media (max-width: 768px) {
          .cal-cell { min-height: 160px; padding: 4px 2px !important; }
          .cal-item-text { font-size: 10px !important; }
          .sch-banner { flex-wrap: wrap; gap: 6px !important; }
          .sch-banner-btns { flex-wrap: wrap; }
        }
        @media (max-width: 480px) {
          .cal-cell { min-height: 130px; }
        }

        /* 챗봇 FAB — 모바일에서 하단 nav 위로 */
        .agent-fab-wrap { bottom: 24px !important; right: 24px !important; }
        @media (max-width: 768px) {
          .agent-fab-wrap { bottom: 72px !important; right: 12px !important; }
          .agent-fab-btn  { width: 44px !important; height: 44px !important; font-size: 20px !important; }
          .agent-chat-box { width: calc(100vw - 24px) !important; right: 0 !important; left: 12px !important; height: 70vh !important; }
        }
      `}</style>

      {/* ── PC 사이드바 ── */}
      <aside className="oa-sidebar">
        {/* 로고 */}
        <div style={{padding:"24px 20px 20px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <div style={{width:36,height:36,background:`linear-gradient(135deg,${C.rose},${C.roseLt})`,
              borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:18,boxShadow:`0 3px 12px ${C.rose}44`,flexShrink:0}}>🌸</div>
            <div>
              <div style={{fontSize:15,fontWeight:900,color:C.ink,letterSpacing:"-0.02em"}}>OA <span style={{color:C.rose}}>HQ</span></div>
              <div style={{fontSize:9,color:C.inkLt,letterSpacing:"0.08em"}}>MARKETING DASHBOARD</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",
            background:C.blush,borderRadius:10,fontSize:11,color:C.rose,fontWeight:700}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:C.rose,flexShrink:0,
              boxShadow:pulse?`0 0 0 4px ${C.rose}33`:"none",transition:"box-shadow 0.4s",display:"inline-block"}}/>
            {dateStr}
          </div>
        </div>

        {/* 사이드 네비 */}
        <nav style={{flex:1,padding:"16px 12px"}}>
          {NAVS.map(n=>{
            const active = sec===n.id;
            return(
              <button key={n.id} onClick={()=>setSec(n.id)} style={{
                width:"100%",display:"flex",alignItems:"center",gap:12,
                padding:"11px 14px",borderRadius:11,border:"none",cursor:"pointer",
                fontFamily:"inherit",fontWeight:700,fontSize:13,
                marginBottom:4,transition:"all 0.18s",textAlign:"left",
                background:active?C.rose:"transparent",
                color:active?C.white:C.inkMid,
                boxShadow:active?`0 4px 14px ${C.rose}44`:"none",
                position:"relative",
              }}
              onMouseEnter={e=>{ if(!active){ e.currentTarget.style.background=C.cream; } }}
              onMouseLeave={e=>{ if(!active){ e.currentTarget.style.background="transparent"; } }}>
                <MI n={n.icon} size={18}/>
                <span>{n.label}</span>
                {n.id==="home"&&totalAlerts>0&&(
                  <span style={{marginLeft:"auto",minWidth:20,height:20,borderRadius:10,
                    background:active?C.white:C.bad,color:active?C.bad:C.white,
                    fontSize:10,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 5px"}}>
                    {totalAlerts}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* 사이드바 하단: 알림 요약 */}
        {totalAlerts>0&&(
          <div style={{margin:"0 12px 20px",padding:"12px",background:"#FFF8EC",
            border:`1px solid ${C.warn}33`,borderRadius:12}}>
            <div style={{fontSize:11,fontWeight:800,color:C.warn,marginBottom:6}}>🔔 확인 필요</div>
            {orderStatus==="ok"&&orderRaw.length>0&&<div style={{fontSize:10,color:C.bad,fontWeight:700,marginBottom:3}}><MI n="inventory_2" size={11}/> 발주임박 {orderRaw.length}개</div>}
            {cutAds.length>0&&<div style={{fontSize:10,color:C.bad,fontWeight:700,marginBottom:3}}><MI n="cancel" size={11}/> 광고교체 {cutAds.length}개</div>}
            {holdAds.length>0&&<div style={{fontSize:10,color:C.warn,marginBottom:3}}><MI n="pause_circle" size={11}/> 광고보류 {holdAds.length}개</div>}
            {overdueScheds.length>0&&<div style={{fontSize:10,color:C.inkMid,marginBottom:3}}><MI n="calendar_month" size={11}/> 기간초과 {overdueScheds.length}건</div>}
            {urgentScheds.length>0&&<div style={{fontSize:10,color:C.inkMid}}><MI n="notifications" size={11}/> D-5임박 {urgentScheds.length}건</div>}
          </div>
        )}
      </aside>

      {/* ── 모바일 상단 헤더 ── */}
      <header className="oa-topbar" style={{background:C.white,borderBottom:`1px solid ${C.border}`,
        padding:"0 16px",height:54,alignItems:"center",justifyContent:"space-between",
        position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 10px rgba(232,86,122,0.07)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,background:`linear-gradient(135deg,${C.rose},${C.roseLt})`,
            borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🌸</div>
          <div style={{fontSize:13,fontWeight:900,color:C.ink}}>OA <span style={{color:C.rose}}>HQ</span></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {totalAlerts>0&&(
            <div onClick={()=>setSec("home")} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",
              background:"#FFF8EC",border:`1px solid ${C.warn}44`,borderRadius:20,
              fontSize:10,color:C.warn,fontWeight:700,cursor:"pointer"}}>🔔 {totalAlerts}건</div>
          )}
          <div style={{fontSize:10,color:C.rose,fontWeight:700,background:C.blush,
            padding:"4px 10px",borderRadius:20,border:`1px solid ${C.rose}33`}}>{dateStr}</div>
        </div>
      </header>

      {/* ── 콘텐츠 영역 ── */}
      <div className="oa-body">
        <main className="oa-main">
          {sec==="home"        && <HomeSection/>}
          {sec==="meta"        && MetaSection}
          {sec==="influencer"  && InfluencerSection}
          {sec==="schedule"    && ScheduleSection}
          {sec==="erp"         && <ErpSection/>}
          {sec==="creative"    && CreativeSection}
          {sec==="keyword"     && KeywordSection}
          {sec==="review"      && ReviewSection}
          {sec==="insight"     && InsightSection}
          {sec==="coupang"     && CoupangSection}
        </main>
      </div>

      {/* ── 모바일 하단 탭바 ── */}
      <nav className="oa-mobile-nav" style={{position:"fixed",bottom:0,left:0,right:0,background:C.white,
        borderTop:`1px solid ${C.border}`,padding:"6px 0 max(6px,env(safe-area-inset-bottom))",
        zIndex:200,boxShadow:"0 -4px 20px rgba(43,31,46,0.08)"}}>
        {NAVS.map(n=>(
          <button key={n.id} onClick={()=>setSec(n.id)} style={{
            flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,
            background:"transparent",border:"none",cursor:"pointer",padding:"4px 0",
            fontFamily:"inherit",position:"relative"}}>
            <MI n={n.icon} size={18}/>
            <span style={{fontSize:9,fontWeight:700,color:sec===n.id?C.rose:C.inkLt}}>{n.label}</span>
            {sec===n.id&&<div style={{width:18,height:2,background:C.rose,borderRadius:2,marginTop:1}}/>}
            {n.id==="home"&&totalAlerts>0&&(
              <div style={{position:"absolute",top:0,right:"15%",width:14,height:14,borderRadius:"50%",
                background:C.bad,display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:8,fontWeight:900,color:C.white}}>{totalAlerts}</div>
            )}
          </button>
        ))}
      </nav>

      {/* ── 전역 모달 — 섹션 밖에서 렌더해서 리렌더 격리 ── */}
      {infModalData&&<InfModalComp
        mode={infModalData.mode}
        initial={infModalData.initial}
        onSave={(item)=>{
          if(infModalData.mode==="edit"){
            setInfs(arr=>arr.map(x=>x.id===item.id?item:x));
          } else {
            setInfs(arr=>[...arr,{...item,id:Date.now()}]);
          }
          setInfModalData(null);
        }}
        onClose={()=>setInfModalData(null)}
      />}
      {insModalData&&<InsModalComp
        initial={insModalData.initial}
        onSave={(item)=>{
          setInfs(arr=>arr.map(x=>x.id===item.id?{...x,reach:item.reach,saves:item.saves,clicks:item.clicks,conv:item.conv}:x));
          setInsModalData(null);
        }}
        onClose={()=>setInsModalData(null)}
      />}
      {invModalData&&<InvModalComp
        mode={invModalData.mode}
        initial={invModalData.initial}
        onSave={(item)=>{
          if(invModalData.mode==="edit"){
            setInv(arr=>arr.map(x=>x.id===item.id?item:x));
          } else {
            setInv(arr=>[...arr,{...item,id:Date.now()}]);
          }
          setInvModalData(null);
        }}
        onClose={()=>setInvModalData(null)}
      />}
      {schModalData&&<SchModalComp
        mode={schModalData.mode}
        initial={schModalData.initial}
        onSave={saveNotionSch}
        onClose={()=>setSchModalData(null)}
      />}

      {/* ── 데이터 에이전트 플로팅 버튼 ── */}
      <div className="agent-fab-wrap" style={{position:"fixed",bottom:24,right:24,zIndex:1000,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:10}}>
        {/* 채팅창 */}
        {agentOpen&&(
          <div className="agent-chat-box" style={{width:360,height:520,background:C.white,borderRadius:20,
            boxShadow:"0 20px 60px rgba(0,0,0,0.2)",display:"flex",flexDirection:"column",overflow:"hidden",
            border:`1px solid ${C.border}`}}>
            {/* 헤더 */}
            <div style={{background:C.ink,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:13,fontWeight:800,color:C.white}}><MI n="smart_toy" size={14}/> OA 데이터 에이전트</div>
                <div style={{fontSize:10,opacity:0.5,color:C.white,marginTop:2}}>메타광고 · 재고 데이터 기반</div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>setAgentMsgs([])}
                  style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:6,padding:"4px 8px",
                    color:"rgba(255,255,255,0.6)",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>초기화</button>
                <button onClick={()=>setAgentOpen(false)}
                  style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:6,padding:"4px 8px",
                    color:"rgba(255,255,255,0.6)",fontSize:14,cursor:"pointer"}}>✕</button>
              </div>
            </div>

            {/* 탭 */}
            <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,background:C.cream}}>
              {[{id:"chat",label:<><MI n="chat_bubble" size={12}/> 채팅</>},{id:"history",label:<><MI n="bookmark" size={12}/> 저장됨 {Array.isArray(agentHistory)&&agentHistory.length>0?`(${agentHistory.length})`:""}</>}].map(t=>(
                <button key={t.id} onClick={()=>setAgentTab(t.id)}
                  style={{flex:1,padding:"8px",border:"none",background:"transparent",
                    fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                    color:agentTab===t.id?C.rose:C.inkMid,
                    borderBottom:agentTab===t.id?`2px solid ${C.rose}`:"2px solid transparent"}}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* 메시지 영역 */}
            <div style={{flex:1,overflowY:"auto",padding:"14px",display:"flex",flexDirection:"column",gap:10}}>
              {/* 히스토리 탭 */}
              {agentTab==="history"&&(
                Array.isArray(agentHistory)&&agentHistory.length>0 ? (
                  agentHistory.map((h,i)=>(
                    <div key={h.id||i} style={{background:C.cream,borderRadius:12,padding:"12px",border:`1px solid ${C.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                        <div style={{fontSize:10,fontWeight:700,color:C.ink,flex:1}}>{h.question}</div>
                        <div style={{display:"flex",gap:4,flexShrink:0}}>
                          <button onClick={()=>{setAgentMsgs([{role:"user",content:h.question},{role:"assistant",content:h.answer}]);setAgentTab("chat");}}
                            style={{fontSize:9,padding:"3px 8px",borderRadius:6,border:`1px solid ${C.border}`,background:C.white,cursor:"pointer",fontFamily:"inherit",color:C.inkMid}}>
                            불러오기
                          </button>
                          <button onClick={()=>setAgentHistory(prev=>(Array.isArray(prev)?prev:[]).filter(x=>x.id!==h.id))}
                            style={{fontSize:9,padding:"3px 8px",borderRadius:6,border:`1px solid ${C.bad}44`,background:"#FEF0F0",cursor:"pointer",fontFamily:"inherit",color:C.bad}}>
                            삭제
                          </button>
                        </div>
                      </div>
                      <div style={{fontSize:10,color:C.inkMid,lineHeight:1.5,whiteSpace:"pre-wrap"}}>
                        {h.answer.replace(/```chart[\s\S]*?```/g,"[차트]").slice(0,150)}{h.answer.length>150?"...":""}
                      </div>
                      <div style={{fontSize:9,color:C.inkLt,marginTop:6}}>
                        {new Date(h.savedAt).toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{textAlign:"center",padding:"40px 10px",color:C.inkLt,fontSize:11}}>
                    저장된 분석이 없어요<br/>
                    <span style={{fontSize:10,marginTop:4,display:"block"}}>그래프 답변은 자동 저장돼요<br/>일반 답변은 💾 버튼으로 저장해요</span>
                  </div>
                )
              )}

              {/* 채팅 탭 */}
              {agentTab==="chat"&&(<>
              {agentMsgs.length===0&&(
                <div style={{textAlign:"center",padding:"20px 10px"}}>
                  <div style={{fontSize:28,marginBottom:8}}>👋</div>
                  <div style={{fontSize:12,fontWeight:700,color:C.ink,marginBottom:6}}>안녕하세요! 마케팅 데이터 에이전트예요</div>
                  <div style={{fontSize:10,color:C.inkLt,lineHeight:1.6}}>현재 메타광고 · 재고 데이터를 알고 있어요.<br/>아래 질문을 눌러보세요!</div>
                  <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:10,textAlign:"left"}}>
                    {[
                      {label:<><MI n="bar_chart" size={12}/> 성과 분석</>, qs:[
                        "ROAS 가장 높은 광고 TOP 3 알려줘",
                        "CPA 가장 낮은 광고 뭐야?",
                        "LPV율 낮은 광고 있어? 랜딩 문제 의심되는 거",
                        "CTR 낮아서 소재 문제인 광고 찾아줘",
                      ]},
                      {label:<><MI n="payments" size={12}/> 광고비 현황</>, qs:[
                        "날짜별 광고비 추이 그래프 그려줘",
                        "전환 vs 트래픽 광고비 비율 파이차트로 보여줘",
                        "광고별 광고비 바차트 그려줘",
                      ]},
                      {label:"🔍 광고 판단", qs:[
                        "지금 당장 꺼야 할 광고 있어?",
                        "예산 올려볼 만한 광고 추천해줘",
                        "소닉플로우 광고 중에 성과 좋은 거 뭐야?",
                        "프리온 광고 CPA 어때?",
                      ]},
                      {label:<><MI n="inventory_2" size={12}/> 재고</>, qs:[
                        "재고 소진 임박한 제품 있어?",
                        "재고 현황 전체 알려줘",
                      ]},
                    ].map(cat=>(
                      <div key={cat.label}>
                        <div style={{fontSize:10,fontWeight:800,color:C.ink,marginBottom:5}}>{cat.label}</div>
                        <div style={{display:"flex",flexDirection:"column",gap:4}}>
                          {cat.qs.map(q=>(
                            <button key={q} onClick={()=>setAgentInput(q)}
                              style={{padding:"7px 12px",borderRadius:10,border:`1px solid ${C.border}`,
                                background:C.white,color:C.inkMid,fontSize:10,fontWeight:500,
                                cursor:"pointer",fontFamily:"inherit",textAlign:"left",
                                transition:"background 0.15s"}}
                              onMouseEnter={e=>e.target.style.background=C.cream}
                              onMouseLeave={e=>e.target.style.background=C.white}>
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {agentMsgs.map((m,i)=>{
                const isUser = m.role==="user";
                const chartMatch = !isUser && m.content.match(/```chart\s*([\s\S]*?)```/);
                const chartData = chartMatch ? (() => {
                  try {
                    const raw = chartMatch[1].trim();
                    const parsed = JSON.parse(raw);
                    // data 배열 없으면 null
                    if(!parsed.data||!Array.isArray(parsed.data)) return null;
                    return parsed;
                  } catch { return null; }
                })() : null;
                const textContent = m.content.replace(/```chart[\s\S]*?```/g,"").trim();
                const question = agentMsgs[i-1]?.content||"";
                return(
                  <div key={i} style={{display:"flex",justifyContent:isUser?"flex-end":"flex-start",flexDirection:"column",alignItems:isUser?"flex-end":"flex-start",gap:4}}>
                    <div style={{maxWidth:"85%",padding:"10px 13px",borderRadius:isUser?"16px 16px 4px 16px":"16px 16px 16px 4px",
                      background:isUser?C.rose:C.cream,color:isUser?C.white:C.ink,
                      fontSize:11,lineHeight:1.6,whiteSpace:"pre-wrap"}}>
                      {textContent}
                      {chartData&&(()=>{
                        if(!chartData.data||!chartData.data.length) return null;
                        const data = chartData.data.map(d=>({...d, value: typeof d.value==="string"?parseFloat(d.value.replace(/[^0-9.-]/g,""))||0:d.value}));
                        const COLORS=["#f9a8d4","#93c5fd","#86efac","#fbbf24","#c4b5fd","#6ee7b7"];
                        const chartId = `chart-${i}`;
                        return(
                          <div id={chartId} style={{marginTop:10,background:C.white,borderRadius:10,padding:"10px",width:280}}>
                            <div style={{fontSize:10,fontWeight:700,color:C.ink,marginBottom:6}}>{chartData.title}</div>
                            <ResponsiveContainer width="100%" height={160}>
                              {chartData.type==="pie"?(
                                <PieChart>
                                  <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false} style={{fontSize:8}}>
                                    {data.map((_,idx)=><Cell key={idx} fill={COLORS[idx%COLORS.length]}/>)}
                                  </Pie>
                                  <Tooltip formatter={(v)=>v.toLocaleString()}/>
                                </PieChart>
                              ):chartData.type==="line"?(
                                <LineChart data={data}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                                  <XAxis dataKey="name" tick={{fontSize:8}} axisLine={false} tickLine={false}/>
                                  <YAxis tick={{fontSize:8}} axisLine={false} tickLine={false} width={40} tickFormatter={v=>v>=10000?`${Math.round(v/10000)}만`:v}/>
                                  <Tooltip formatter={(v)=>v.toLocaleString()}/>
                                  <Line type="monotone" dataKey="value" stroke={C.rose} strokeWidth={2} dot={{r:3}} activeDot={{r:5}}/>
                                </LineChart>
                              ):(
                                <BarChart data={data}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                                  <XAxis dataKey="name" tick={{fontSize:8}} axisLine={false} tickLine={false}/>
                                  <YAxis tick={{fontSize:8}} axisLine={false} tickLine={false} width={40} tickFormatter={v=>v>=10000?`${Math.round(v/10000)}만`:v}/>
                                  <Tooltip formatter={(v)=>v.toLocaleString()}/>
                                  <Bar dataKey="value" radius={[4,4,0,0]}>
                                    {data.map((_,idx)=><Cell key={idx} fill={COLORS[idx%COLORS.length]}/>)}
                                  </Bar>
                                </BarChart>
                              )}
                            </ResponsiveContainer>
                          </div>
                        );
                      })()}
                    </div>
                    {/* 저장/이미지 버튼 (assistant 메시지만) */}
                    {!isUser&&(
                      <div style={{display:"flex",gap:4}}>
                        <button onClick={()=>saveAgentMsg(question, m.content)}
                          style={{fontSize:9,padding:"3px 10px",borderRadius:6,border:`1px solid ${C.border}`,
                            background:C.white,cursor:"pointer",fontFamily:"inherit",color:C.inkMid}}>
                          💾 저장
                        </button>
                        {chartData&&(
                          <button onClick={async()=>{
                            try {
                              const el = document.getElementById(`chart-${i}`);
                              if(!el) return;
                              const { default: h2c } = await import("html2canvas");
                              const canvas = await h2c(el, {backgroundColor:"#ffffff",scale:2});
                              const a = document.createElement("a");
                              a.href = canvas.toDataURL("image/png");
                              a.download = `${chartData.title||"chart"}_${new Date().toLocaleDateString("ko-KR").replace(/\./g,"").replace(/ /g,"")}.png`;
                              a.click();
                            } catch(e) { alert("저장 실패: "+e.message); }
                          }} style={{fontSize:9,padding:"3px 10px",borderRadius:6,border:`1px solid ${C.border}`,
                            background:C.white,cursor:"pointer",fontFamily:"inherit",color:C.inkMid}}>
                            <MI n="image" size={11}/> 이미지
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {agentLoading&&(
                <div style={{display:"flex",justifyContent:"flex-start"}}>
                  <div style={{padding:"10px 14px",borderRadius:"16px 16px 16px 4px",background:C.cream,fontSize:11,color:C.inkLt}}>
                    <MI n="hourglass_empty" size={13}/> 분석 중...
                  </div>
                </div>
              )}
              <div ref={agentEndRef}/>
              </>)}
            </div>

            {/* 입력창 */}
            <div style={{padding:"12px",borderTop:`1px solid ${C.border}`,display:"flex",gap:8}}>
              <input
                value={agentInput}
                onChange={e=>setAgentInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendAgentMessage()}
                placeholder="질문을 입력하세요..."
                style={{flex:1,padding:"9px 12px",border:`1px solid ${C.border}`,borderRadius:10,
                  fontSize:11,fontFamily:"inherit",outline:"none",background:C.cream}}
              />
              <button onClick={sendAgentMessage} disabled={!agentInput.trim()||agentLoading}
                style={{padding:"9px 14px",borderRadius:10,border:"none",
                  background:agentInput.trim()&&!agentLoading?C.rose:"#ddd",
                  color:C.white,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                전송
              </button>
            </div>
          </div>
        )}

        {/* ── 공지 팝업 (하단 고정) ── */}
        {(()=>{
          if(!activeNotice) return null;
          const readBy = (noticeReads[activeNotice.id])||[];
          const allRead = NOTICE_MEMBERS.every(m=>readBy.includes(m));
          if(allRead) return null;
          return(
            <div style={{
              position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",
              width:"min(460px,calc(100vw - 32px))",
              background:C.white,borderRadius:18,
              boxShadow:"0 8px 40px rgba(0,0,0,0.18)",
              border:`1.5px solid ${C.rose}55`,
              zIndex:2000,overflow:"hidden",
            }}>
              {/* 헤더 */}
              <div style={{background:C.rose,padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
                <MI n="campaign" size={16} style={{color:C.white}}/>
                <span style={{fontSize:12,fontWeight:800,color:C.white,flex:1}}>📣 팀 공지</span>
                <span style={{fontSize:10,color:"rgba(255,255,255,0.75)"}}>
                  {readBy.length}/{NOTICE_MEMBERS.length} 확인
                </span>
                <button onClick={()=>{setNoticeInput(activeNotice.content);setNoticeEditMode(true);}}
                  style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:6,
                    width:24,height:24,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <MI n="edit" size={13} style={{color:C.white}}/>
                </button>
              </div>

              {/* 공지 내용 */}
              <div style={{padding:"14px 16px"}}>
                {noticeEditMode ? (
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <textarea value={noticeInput} onChange={e=>setNoticeInput(e.target.value)}
                      rows={3}
                      style={{width:"100%",padding:"8px 10px",border:`1.5px solid ${C.border}`,
                        borderRadius:8,fontSize:12,fontFamily:"inherit",outline:"none",
                        resize:"none",boxSizing:"border-box"}}/>
                    <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                      <button onClick={()=>setNoticeEditMode(false)}
                        style={{fontSize:11,padding:"6px 14px",borderRadius:8,border:`1px solid ${C.border}`,
                          background:C.cream,color:C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
                        취소
                      </button>
                      <button onClick={()=>{
                        const id = Date.now().toString();
                        setActiveNotice({id,content:noticeInput.trim(),createdAt:new Date().toISOString().slice(0,10)});
                        setNoticeReads(prev=>({...prev,[id]:[]}));
                        setNoticeEditMode(false);
                      }}
                        style={{fontSize:11,padding:"6px 14px",borderRadius:8,border:"none",
                          background:C.rose,color:C.white,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{fontSize:13,color:C.ink,lineHeight:1.7,margin:0,whiteSpace:"pre-wrap"}}>
                    {activeNotice.content}
                  </p>
                )}
              </div>

              {/* 확인 버튼 */}
              {!noticeEditMode&&(
                <div style={{padding:"0 16px 14px",display:"flex",gap:8,flexWrap:"wrap"}}>
                  {NOTICE_MEMBERS.map(m=>{
                    const done = readBy.includes(m);
                    return(
                      <button key={m} onClick={()=>{
                        if(done) return;
                        const next = [...readBy, m];
                        setNoticeReads(prev=>({...prev,[activeNotice.id]:next}));
                      }}
                        style={{flex:1,minWidth:60,padding:"8px 0",borderRadius:10,fontFamily:"inherit",
                          fontWeight:800,fontSize:12,cursor:done?"default":"pointer",transition:"all 0.15s",
                          border:`1.5px solid ${done?"#4DAD7A":C.border}`,
                          background:done?"#EDF7F1":C.cream,
                          color:done?"#2e7d32":C.inkMid}}>
                        {done?"✓ ":""}{m}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* 공지 없을 때 작성 버튼 */}
        {(()=>{
          if(!activeNotice) return(
            <button onClick={()=>{setNoticeInput("");setNoticeEditMode(true);setActiveNotice({id:"__new__",content:"",createdAt:""});}}
              style={{position:"fixed",bottom:80,right:80,background:"#fff",border:`1.5px solid ${C.rose}55`,
                borderRadius:12,padding:"6px 12px",fontSize:11,fontWeight:700,color:C.rose,
                cursor:"pointer",boxShadow:"0 2px 12px rgba(0,0,0,0.1)",zIndex:1999,fontFamily:"inherit",
                display:"flex",alignItems:"center",gap:4}}>
              <MI n="campaign" size={13}/> 공지 작성
            </button>
          );
          const readBy = (noticeReads[activeNotice.id])||[];
          const allRead = NOTICE_MEMBERS.every(m=>readBy.includes(m));
          if(!allRead) return null;
          // 모두 읽은 경우에도 작성 버튼 표시
          return(
            <button onClick={()=>{setNoticeInput("");setNoticeEditMode(true);setActiveNotice({id:"__new__",content:"",createdAt:""});}}
              style={{position:"fixed",bottom:80,right:80,background:"#fff",border:`1.5px solid ${C.rose}55`,
                borderRadius:12,padding:"6px 12px",fontSize:11,fontWeight:700,color:C.rose,
                cursor:"pointer",boxShadow:"0 2px 12px rgba(0,0,0,0.1)",zIndex:1999,fontFamily:"inherit",
                display:"flex",alignItems:"center",gap:4}}>
              <MI n="campaign" size={13}/> 공지 작성
            </button>
          );
        })()}

        {/* 플로팅 버튼 */}
        <button className="agent-fab-btn" onClick={()=>setAgentOpen(v=>!v)}
          style={{width:52,height:52,borderRadius:"50%",border:"none",
            background:agentOpen?C.inkMid:C.rose,color:C.white,
            fontSize:22,cursor:"pointer",boxShadow:"0 4px 20px rgba(0,0,0,0.2)",
            display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>
          {agentOpen?"✕":<MI n="smart_toy" size={22}/>}
        </button>
      </div>
    </div>
  );
}
