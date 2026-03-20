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
  if(!f.postedDate) return {label:"미게시",  color:C.inkLt,bg:C.cream,   icon:"📦"};
  if(f.reach!==null) return {label:"기록완료",color:C.good, bg:"#EDF7F1", icon:"✅"};
  const due=addDays(f.postedDate,7), d=daysUntil(due);
  if(d>0)   return {label:`D-${d} 대기`,         color:C.inkLt,bg:C.cream,  icon:"⏳"};
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
function lpvCostStatus(spend, lpv){
  if(!lpv||!spend) return null;
  const cost = spend/lpv;
  if(cost<300)  return {label:"매우좋음", color:C.good,  bg:"#EDF7F1", icon:"🟢", cost:Math.round(cost)};
  if(cost<500)  return {label:"유지",     color:C.sage,  bg:C.sageLt,  icon:"🔵", cost:Math.round(cost)};
  if(cost<800)  return {label:"보류",     color:C.warn,  bg:"#FFF8EC", icon:"🟡", cost:Math.round(cost)};
  return              {label:"컷",        color:C.bad,   bg:"#FEF0F0", icon:"🔴", cost:Math.round(cost)};
}
function lpvRateStatus(clicks, lpv){
  if(!clicks||!lpv) return null;
  const rate = (lpv/clicks)*100;
  if(rate>=70)  return {label:"정상",     color:C.good, bg:"#EDF7F1", icon:"✅", rate:rate.toFixed(1)};
  if(rate>=50)  return {label:"보통",     color:C.warn, bg:"#FFF8EC", icon:"⚠️", rate:rate.toFixed(1)};
  return              {label:"랜딩문제",  color:C.bad,  bg:"#FEF0F0", icon:"🚨", rate:rate.toFixed(1)};
}
function cpaStatus(spend, purchases, margin){
  if(!purchases||!spend||!margin) return null;
  const cpa = spend/purchases;
  const ratio = cpa/margin;
  if(ratio<=0.85)  return {label:"유지",  color:C.good, bg:"#EDF7F1", icon:"✅", cpa:Math.round(cpa)};
  if(ratio<=1.0)   return {label:"보류",  color:C.warn, bg:"#FFF8EC", icon:"⚠️", cpa:Math.round(cpa)};
  return                  {label:"컷",    color:C.bad,  bg:"#FEF0F0", icon:"🔴", cpa:Math.round(cpa)};
}
function ctrStatus(clicks, impressions){
  if(!impressions||!clicks) return null;
  const ctr = (clicks/impressions)*100;
  if(ctr>=2)   return {label:"좋음",     color:C.good, bg:"#EDF7F1", icon:"🟢", ctr:ctr.toFixed(2)};
  if(ctr>=1)   return {label:"보통",     color:C.warn, bg:"#FFF8EC", icon:"🟡", ctr:ctr.toFixed(2)};
  return             {label:"소재문제",  color:C.bad,  bg:"#FEF0F0", icon:"🔴", ctr:ctr.toFixed(2)};
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

function adScore(ad, margin){
  // 교체 필요 광고 판단: 하나라도 "컷" or "랜딩문제" or "소재문제"면 경고
  const issues = [];
  const lpvC = lpvCostStatus(ad.spend, ad.lpv);
  const lpvR = lpvRateStatus(ad.clicks, ad.lpv);
  const cpa  = cpaStatus(ad.spend, ad.purchases, margin);
  const ctr  = ctrStatus(ad.clicks||ad.clicksAll, ad.impressions);
  if(lpvC&&(lpvC.label==="컷"||lpvC.label==="보류"))   issues.push({type:"LPV단가",  ...lpvC});
  if(lpvR&&(lpvR.label==="랜딩문제"))                   issues.push({type:"LPV전환율",...lpvR});
  if(cpa &&(cpa.label==="컷"||cpa.label==="보류"))      issues.push({type:"CPA",      ...cpa});
  if(ctr &&(ctr.label==="소재문제"||ctr.label==="보통")) issues.push({type:"CTR",      ...ctr});
  return {issues, lpvC, lpvR, cpa, ctr};
}

function schTypeColor(t){ return {공구:C.rose,시딩:C.purple,광고:C.gold,이벤트:C.sage}[t]||C.inkMid; }
function schTypeIcon(t){  return {공구:"🛍",시딩:"✨",광고:"📣",이벤트:"🎉"}[t]||"📌"; }

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

// CSV 파싱 (구글 시트 export) — 타이틀 행 자동 스킵
function parseCSV(text){
  const lines = text.trim().split("\n").map(l=>{
    // 쉼표가 큰따옴표 안에 있는 경우 처리
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
  // 첫 행이 실제 헤더인지 확인
  const HEADER_HINTS = ["캠페인","campaign","날짜","date","일","광고","지출","노출","impressions","spend"];
  const firstRowStr = lines[0].join(",").toLowerCase();
  const startIdx = HEADER_HINTS.some(h=>firstRowStr.includes(h)) ? 0 : 1;
  // 헤더: 원본 텍스트 그대로 보존 (매핑에서 직접 비교)
  const headers = lines[startIdx].map(h=>h.trim());
  return lines.slice(startIdx+1).filter(l=>l.some(c=>c)).map(row=>{
    const obj={};
    headers.forEach((h,i)=>{ if(h) obj[h]=row[i]||""; });
    return obj;
  });
}

// 메타 컬럼 매핑 — 실제 광고관리자 내보내기 기준
function mapMetaRow(row){
  // 원본 컬럼명 그대로 접근하는 헬퍼
  const g=(...keys)=>{
    for(const k of keys){
      if(row[k]!==undefined&&row[k]!==null&&row[k]!=="") return row[k];
    }
    return "";
  };
  const num=v=>{
    if(v===null||v===undefined||v==="") return 0;
    const n=parseFloat(String(v).replace(/,/g,"").replace(/[^0-9.-]/g,""));
    return isNaN(n)?0:n;
  };

  return {
    date:       g("일","날짜","보고 시작","date"),
    campaign:   g("캠페인 이름","campaign_name","campaign"),
    adset:      g("광고 세트 이름","adset_name"),
    adName:     g("광고 이름","ad_name"),
    // 목표: OUTCOME_SALES / LINK_CLICKS 등 — 전환/트래픽 분류 핵심
    objective:  g("목표","목적","objective"),
    resultType: g("결과 유형","result_type"),
    spend:      num(g("지출 금액 (KRW)","지출 금액","amount_spent","spend")),
    impressions:num(g("노출","impressions")),
    clicks:     num(g("링크 클릭","link_clicks")),
    clicksAll:  num(g("클릭(전체)","clicks")),
    lpv:        num(g("랜딩 페이지 조회","landing_page_views")),
    purchases:  num(g("공유 항목이 포함된 구매","결과","purchases","result")),
    cart:       num(g("공유 항목이 포함된 장바구니에 담기","add_to_cart")),
    convValue:  num(g("공유 항목의 구매 전환값","공유 항목의 웹사이트 구매 전환값","conversion_value")),
    cpc:        num(g("CPC(링크 클릭당 비용)","cpc")),
    cpcAll:     num(g("CPC(전체)")),
    ctr:        num(g("CTR(전체)","ctr")),
    cpa:        num(g("결과당 비용","cost_per_result","cpa")),
    cpm:        num(g("CPM(1,000회 노출당 비용)","cpm")),
    campaignBudget:     num(g("캠페인 예산","campaign_budget")),
    campaignBudgetType: g("캠페인 예산 유형","campaign_budget_type"),
    adsetBudget:        num(g("광고 세트 예산","adset_budget")),
    adsetBudgetType:    g("광고 세트 예산 유형","adset_budget_type"),
  };
}

// 전환/트래픽 분류 — 목표 컬럼 우선, 그 다음 캠페인명
function isConversionCampaign(objective, campaignName=""){
  const obj = (objective||"").toUpperCase();
  // 목표 컬럼으로 정확히 분류 (OUTCOME_SALES / LINK_CLICKS)
  if(obj==="OUTCOME_SALES"||obj==="OUTCOME_ENGAGEMENT"||obj==="CONVERSIONS") return true;
  if(obj==="LINK_CLICKS"||obj==="OUTCOME_TRAFFIC"||obj==="REACH"||obj==="BRAND_AWARENESS") return false;
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
            <div style={{fontSize:18}}>{k.icon}</div>
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
    <Modal title={mode==="edit"?"✏️ 인플루언서 수정":"➕ 인플루언서 추가"} onClose={onClose}>
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
      <div style={{borderTop:`1px solid ${C.border}`,margin:"12px 0 8px",paddingTop:10}}>
        <div style={{fontSize:11,fontWeight:800,color:C.ink,marginBottom:8}}>📹 콘텐츠 활용</div>
        {[{key:"videoReceived",label:"🎬 영상 수령 완료"},{key:"reusable",label:"♻️ 2차 활용 가능"},{key:"metaUsed",label:"📣 메타 광고 소재 활용"},{key:"paid",label:"💰 2차활용 비용 입금 완료"}].map(({key,label})=>(
          <label key={key} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer"}}>
            <input type="checkbox" checked={!!f[key]} onChange={e=>set(key,e.target.checked)} style={{width:15,height:15,accentColor:C.rose}}/>
            <span style={{fontSize:11,color:C.ink}}>{label}</span>
          </label>
        ))}
      </div>
      <Btn onClick={()=>{if(!f.name)return; onSave({...f,sent:+f.sent||1,posted:+f.posted||0});}} style={{width:"100%",marginTop:4}}>
        {mode==="edit"?"💾 저장":"➕ 추가"}
      </Btn>
    </Modal>
  );
}

// 인사이트 기록 모달
function InsModalComp({initial, onSave, onClose}){
  const [f, setF] = useState(()=>initial||{id:null,name:"",reach:"",saves:"",clicks:"",conv:""});
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  return(
    <Modal title="📊 인사이트 기록" onClose={onClose}>
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
  const empty = {type:"공구",title:"",date:"",endDate:"",platform:"",note:"",status:"예정"};
  const [f, setF] = useState(()=>initial||empty);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  return(
    <Modal title={mode==="add"?"일정 추가":"일정 수정"} onClose={onClose}>
      <FR label="유형"><Sel value={f.type} onChange={v=>set("type",v)} options={["공구","시딩","광고","이벤트"]}/></FR>
      <FR label="제목 *"><Inp value={f.title} onChange={v=>set("title",v)} placeholder="세럼 30ml 공구 오픈"/></FR>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <FR label="시작일 *"><Inp type="date" value={f.date} onChange={v=>set("date",v)}/></FR>
        <FR label="종료일"><Inp type="date" value={f.endDate} onChange={v=>set("endDate",v)}/></FR>
      </div>
      <FR label="플랫폼"><Inp value={f.platform} onChange={v=>set("platform",v)} placeholder="네이버 스마트스토어"/></FR>
      <FR label="메모"><Inp value={f.note} onChange={v=>set("note",v)} placeholder="한도 수량, 할인율 등"/></FR>
      <FR label="상태"><Sel value={f.status} onChange={v=>set("status",v)} options={["예정","준비중","진행중","완료"]}/></FR>
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

  // 마진 설정
  const [margin, setMargin]   = useSyncState("oa_margin_v7", 30000);
  const [margins, setMargins] = useSyncState("oa_margins_v7", DEFAULT_MARGINS);
  // 트래픽 캠페인 기준값
  const [trafficCriteria, setTrafficCriteria] = useSyncState("oa_traffic_criteria_v7", {
    cpcMax: 600, ctrMin: 1.5, lpvMin: 55,
    cpcKeywords: [{id:1,keyword:"소닉플로우",cpcMax:600},{id:2,keyword:"프리온",cpcMax:800}],
  });

  const [marginModal, setMarginModal]= useState(false);
  const [marginInput, setMarginInput]= useState("");
  const [editingMargin, setEditingMargin] = useState(null); // {id, keyword, margin}
  const [newKeyword, setNewKeyword]  = useState("");
  const [newMarginVal, setNewMarginVal] = useState("");
  const [newCpcKeyword, setNewCpcKeyword] = useState("");
  const [newCpcVal, setNewCpcVal]         = useState("");
  // 목표 메모 (Supabase 팀 공유)
  const [metaGoal, setMetaGoal]         = useSyncState("oa_meta_goal_v7", "");
  const [metaGoalEditing, setMetaGoalEditing] = useState(false);
  const [metaGoalInput, setMetaGoalInput]     = useState("");

  // ── 시트 URL — Supabase 저장 (팀 공유, 변경 가능) ──
  const [invUrl, setInvUrl]   = useSyncState("oa_inv_url_v7", "https://docs.google.com/spreadsheets/d/1r9WhAOgvdIcumgrkNkTbyYSVj1ONxyXp0trwzD-xAng/edit?gid=960641453#gid=960641453");
  const [infUrl, setInfUrl]   = useSyncState("oa_inf_url_v7", "https://docs.google.com/spreadsheets/d/1r9WhAOgvdIcumgrkNkTbyYSVj1ONxyXp0trwzD-xAng/edit?gid=503054532#gid=503054532");
  const [sheetUrl, setSheetUrl] = useSyncState("oa_sheet_url", "https://docs.google.com/spreadsheets/d/1r9WhAOgvdIcumgrkNkTbyYSVj1ONxyXp0trwzD-xAng/edit?gid=1293104038#gid=1293104038");
  const [orderUrl, setOrderUrl] = useSyncState("oa_order_url_v7", "");
  const invUrlLoaded = true; const infUrlLoaded = true;
  const sheetUrlLoaded = true; const orderUrlLoaded = true;

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

  // 메타 구글 시트
  const [metaRaw,setMetaRaw]         = useState([]);
  const [metaStatus,setMetaStatus]   = useState("idle");
  const [metaError,setMetaError]     = useState("");
  const [sheetModal,setSheetModal]   = useState(false);
  const [sheetInput,setSheetInput]   = useState("");
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
  const fileInputRef                  = useRef(null);
  const [isDragging, setIsDragging]   = useState(false);

  // 전체 광고비 파일 (xlsx — 미게재 포함) — Supabase 저장
  const [allAdRaw, setAllAdRaw]       = useSyncState("oa_all_ad_raw_v7", []);
  const [allAdStatus, setAllAdStatus] = useState(()=>allAdRaw?.length>0?"ok":"idle");
  const allAdFileRef                  = useRef(null);

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

  useEffect(() => {
    getAdImages().then(imgs => { if (imgs?.length) setAdImages(imgs); }).catch(() => {});
  }, []);

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

  // 시트 URL 로드되면 자동 fetch (새로고침해도 자동 연동)
  useEffect(()=>{
    if(sheetUrlLoaded && sheetUrl) fetchSheet(sheetUrl);
  },[sheetUrl, sheetUrlLoaded]);

  // 자동 갱신 없음 — 수동 새로고침만

  // ── 구글 시트 fetch ──────────────────────────────
  async function fetchSheet(url){
    if(!url) return;
    setMetaStatus("loading");
    setMetaError("");
    try{
      // 공유 URL → CSV export URL 변환
      const res = await fetch(`/api/sheet?url=${encodeURIComponent(url)}`);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const rows = parseCSV(text).map(mapMetaRow).filter(r=>r.date||r.campaign);
      setMetaRaw(rows);
      setMetaStatus("ok");
    }catch(e){
      setMetaStatus("error");
      setMetaError(e.message);
    }
  }

  function saveSheetUrl(){
    const url = sheetInput.trim();
    if(!url) return;
    setSheetUrl(url);
    setSheetModal(false);
    fetchSheet(url);
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
  const hasSheet = metaStatus==="ok" && metaRaw.length>0;
  const metaFiltered = metaRaw.filter(r => !deletedAds.includes(r.adName||r.campaign||""));

  const metaAgg = hasSheet ? (() => {
    const totalSpend    = metaFiltered.reduce((s,r)=>s+r.spend,0);
    const totalClicks   = metaFiltered.reduce((s,r)=>s+r.clicks,0);
    const totalLpv      = metaFiltered.reduce((s,r)=>s+r.lpv,0);
    const totalPurchases= metaFiltered.reduce((s,r)=>s+r.purchases,0);
    const avgCtr        = metaFiltered.length ? metaFiltered.reduce((s,r)=>s+r.ctr,0)/metaFiltered.length : 0;
    const avgCpc        = totalClicks ? totalSpend/totalClicks : 0;
    const avgCpa        = totalPurchases ? totalSpend/totalPurchases : 0;
    const lpvRate       = totalClicks ? (totalLpv/totalClicks)*100 : 0;

    // 날짜별 집계
    const byDate = {};
    metaFiltered.forEach(r=>{
      if(!r.date) return;
      if(!byDate[r.date]) byDate[r.date]={
        day:r.date.slice(5).replace("-","/"),
        spend:0, clicks:0, lpv:0, purchases:0,
        impressions:0, convValue:0, n:0
      };
      byDate[r.date].spend      += r.spend||0;
      byDate[r.date].clicks     += r.clicks||0;        // 링크 클릭만 사용 (일관성)
      byDate[r.date].lpv        += r.lpv||0;
      byDate[r.date].purchases  += r.purchases||0;
      byDate[r.date].impressions+= r.impressions||0;
      byDate[r.date].convValue  += r.convValue||0;
      byDate[r.date].n++;
    });
    const daily = Object.values(byDate)
      .sort((a,b)=>a.day.localeCompare(b.day))
      .map(d=>({
        ...d,
        // CTR = 클릭/노출 × 100 (직접 계산, 더 정확)
        ctr: d.impressions>0 ? +((d.clicks/d.impressions)*100).toFixed(2) : 0,
        cpc: d.clicks>0 ? +(d.spend/d.clicks).toFixed(0) : 0,
        lpvRate: d.clicks>0 ? +((d.lpv/d.clicks)*100).toFixed(1) : 0,
      }));

    // 캠페인별 집계
    // 광고 이름 기준으로 집계 (광고세트 정보도 포함)
    const byAd = {};
    metaFiltered.forEach(r=>{
      // key: 광고명+광고세트명 조합 (같은 광고명이 다른 세트에 있어도 구분)
      const key = (r.adName||r.campaign||"unknown") + "|||" + (r.adset||"");
      if(!byAd[key]) byAd[key]={
        name: r.adName || r.campaign || "unknown",
        adset: r.adset || "",
        campaign: r.campaign || "",
        objective: r.objective || "",
        resultType: r.resultType || "",
        spend:0, clicks:0, lpv:0, purchases:0, convValue:0, cart:0, ctrSum:0, n:0,
        firstDate: r.date||null, lastDate: r.date||null, lastActiveDate: null,
      };
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
        if(!byAd[key].firstDate||r.date<byAd[key].firstDate) byAd[key].firstDate=r.date;
        if(!byAd[key].lastDate ||r.date>byAd[key].lastDate)  byAd[key].lastDate=r.date;
        // 실제 지출 있는 마지막 날짜 (집행중 판단용)
        if((r.spend||0)>0){
          if(!byAd[key].lastActiveDate||r.date>byAd[key].lastActiveDate) byAd[key].lastActiveDate=r.date;
        }
      }
    });
    const campaigns = Object.values(byAd).map(c=>({
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
    const convCamps    = campaigns.filter(c=>isConversionCampaign(c.objective, c.campaign));
    const trafficCamps = campaigns.filter(c=>!convCamps.includes(c));

    return {totalSpend,totalClicks,totalLpv,totalPurchases,avgCtr,avgCpc,avgCpa,lpvRate,daily,campaigns,convCamps,trafficCamps};
  })() : null;

  // ── 알림 계산 ────────────────────────────────────
  const overdueIns     = infs.filter(f=>{const s=insightStatus(f);return s.label.includes("미입력")||s.label==="오늘 입력!";});
  const dangerInv      = inv.filter(i=>stockStatus(i).label==="위험");
  const cautionInv     = inv.filter(i=>stockStatus(i).label==="주의");
  const overdueScheds  = sch.filter(s=>{const d=daysUntil(s.endDate||s.date);return d!==null&&d<0&&s.status!=="완료";});
  const urgentScheds   = sch.filter(s=>{const d=daysUntil(s.date);return d!==null&&d>=0&&d<=5&&s.status!=="완료";});
  // 광고 교체/보류 알림 — 시트 데이터 있을 때만
  const adAlerts = hasSheet ? metaFiltered.reduce((acc, r)=>{
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
    const adMargin = getAdMargin(ad.name, ad.campaign, margins, margin);
    const s=adScore(ad, adMargin); return s.issues.some(i=>i.label==="컷"||i.label==="랜딩문제"||i.label==="소재문제");
  });
  const holdAds = Object.values(adAlerts).filter(ad=>{
    const adMargin = getAdMargin(ad.name, ad.campaign, margins, margin);
    const s=adScore(ad, adMargin); return !cutAds.includes(ad)&&s.issues.some(i=>i.label==="보류"||i.label==="보통");
  });
  const totalAlerts    = overdueIns.length+dangerInv.length+overdueScheds.length+urgentScheds.length+cutAds.length+holdAds.length+orderRaw.length;

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
    {id:"home",      icon:"🏠",label:"홈"},
    {id:"meta",      icon:"📣",label:"메타광고"},
    {id:"influencer",icon:"✨",label:"인플루언서"},
    {id:"inventory", icon:"📦",label:"재고"},
    {id:"schedule",  icon:"📅",label:"스케줄"},
  ];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🏠 홈
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const HomeSection=()=>{
    // 알림 그룹 정의
    const alertGroups = [
      {
        id:"dangerInv", icon:"🚨", label:"재고 위험", color:C.bad, bg:"#FEF0F0",
        count:dangerInv.length, items:dangerInv,
        render:(item)=>`${item.name} · ${stockDays(item)}일치`,
        action:()=>setSec("inventory"),
      },
      {
        id:"cutAds", icon:"🔴", label:"광고 끄기", color:C.bad, bg:"#FEF0F0",
        count:cutAds.length, items:cutAds,
        render:(ad)=>ad.name,
        action:()=>{setSec("meta");setCampTab("conversion");},
      },
      {
        id:"overdueIns", icon:"❗", label:"인사이트 미입력", color:C.rose, bg:C.blush,
        count:overdueIns.length, items:overdueIns,
        render:(f)=>f.name,
        action:()=>setSec("influencer"),
      },
      {
        id:"cautionInv", icon:"⚠️", label:"재고 주의", color:C.warn, bg:"#FFF8EC",
        count:cautionInv.length, items:cautionInv,
        render:(item)=>`${item.name} · ${stockDays(item)}일치`,
        action:()=>setSec("inventory"),
      },
      {
        id:"holdAds", icon:"🟡", label:"광고 보류", color:C.warn, bg:"#FFF8EC",
        count:holdAds.length, items:holdAds,
        render:(ad)=>ad.name,
        action:()=>{setSec("meta");setCampTab("conversion");},
      },
      {
        id:"urgentScheds", icon:"🔔", label:"D-5 임박 일정", color:C.purple, bg:C.purpleLt,
        count:urgentScheds.length, items:urgentScheds,
        render:(s)=>`${daysUntil(s.date)===0?"오늘":`D-${daysUntil(s.date)}`} · ${s.title}`,
        action:()=>setSec("schedule"),
      },
      {
        id:"overdueScheds", icon:"📅", label:"기간 초과 일정", color:C.inkMid, bg:C.cream,
        count:overdueScheds.length, items:overdueScheds,
        render:(s)=>s.title,
        action:()=>setSec("schedule"),
      },
      {
        id:"orderRaw", icon:"📦", label:"발주 임박", color:C.sage, bg:C.sageLt,
        count:orderRaw.length, items:orderRaw,
        render:(r)=>r["SKU명"]||r["상품명"]||"",
        action:()=>{},
      },
    ].filter(g=>g.count>0);

    const activeGroups = alertGroups.filter(g=>g.count>0);

    return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>

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
                {g.icon} {g.label} {g.count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── 알림 없을 때 ── */}
      {totalAlerts===0&&(
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,
          padding:"28px",textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:8}}>🎉</div>
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
                padding:"12px 16px",background:g.bg,cursor:"pointer"}}
                onClick={g.action}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>{g.icon}</span>
                  <span style={{fontSize:12,fontWeight:800,color:g.color}}>{g.label}</span>
                  <span style={{fontSize:11,fontWeight:900,color:C.white,background:g.color,
                    padding:"1px 8px",borderRadius:20,minWidth:20,textAlign:"center"}}>{g.count}</span>
                </div>
                <span style={{fontSize:10,color:g.color,fontWeight:700,opacity:0.7}}>→ 바로가기</span>
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

      {/* 발주임박 시트 연결 모달 */}
      {orderModal&&(
        <Modal title="📦 발주임박 시트 연결" onClose={()=>setOrderModal(false)} wide>
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
          }} style={{width:"100%",marginTop:8}}>🔗 연결하기</Btn>
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
    // 원 단위 포맷 (만원)
    const fmt=n=>n>=10000?`₩${Math.round(n/10000).toLocaleString()}만`:`₩${Math.round(n).toLocaleString()}`;

    const metaKpi = d ? [
      {label:"운영중 광고비", value:fmt(d.totalSpend),   change:0, good:"high",icon:"💸",note:`${d.daily.length}일 · ${[...new Set(metaFiltered.map(r=>r.adName||r.campaign||"").filter(Boolean))].length}개 광고`},
      {label:"총 클릭수",    value:d.totalClicks.toLocaleString(), change:0,good:"high",icon:"👆",note:`일평균 ${Math.round(d.totalClicks/Math.max(d.daily.length,1)).toLocaleString()}`},
      {label:"LPV",          value:d.totalLpv.toLocaleString(),    change:0,good:"high",icon:"🛬",note:`LPV율 ${d.lpvRate.toFixed(1)}%`},
      {label:"CPA",          value:d.avgCpa>0?fmt(d.avgCpa):"—",  change:0, good:"low", icon:"🎯",note:"전환당 비용"},
      {label:"CPC",          value:`₩${Math.round(d.avgCpc).toLocaleString()}`, change:0,good:"low",icon:"💡",note:"클릭당 비용"},
      {label:"평균 CTR",     value:`${d.avgCtr.toFixed(2)}%`, change:0,good:"high",icon:"📊",note:"클릭률"},
    ] : [
      {label:"광고비",value:"—",change:0,good:"high",icon:"💸",note:"시트 연결 필요"},
      {label:"클릭수",value:"—",change:0,good:"high",icon:"👆",note:"시트 연결 필요"},
      {label:"LPV",   value:"—",change:0,good:"high",icon:"🛬",note:"시트 연결 필요"},
      {label:"CPA",   value:"—",change:0,good:"low", icon:"🎯",note:"시트 연결 필요"},
      {label:"CPC",   value:"—",change:0,good:"low", icon:"💡",note:"시트 연결 필요"},
      {label:"CTR",   value:"—",change:0,good:"high",icon:"📊",note:"시트 연결 필요"},
    ];

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
                  <Btn small onClick={()=>{setMetaGoal(metaGoalInput);setMetaGoalEditing(false);}}>💾 저장</Btn>
                  <Btn small variant="neutral" onClick={()=>setMetaGoalEditing(false)}>취소</Btn>
                </>
              ) : (
                <Btn small variant="neutral" onClick={()=>{setMetaGoalInput(metaGoal);setMetaGoalEditing(true);}}>✏️ {metaGoal?"수정":"입력"}</Btn>
              )}
            </div>
          </div>
        </div>
        <div style={{
          background: hasSheet ? "#EDF7F1" : C.goldLt,
          border:`1px solid ${hasSheet?C.good+"55":C.gold+"66"}`,
          borderRadius:12,padding:"12px 16px",
          display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>📊</span>
            <div>
              {hasSheet ? (
                <>
                  <div style={{fontSize:12,fontWeight:800,color:C.good}}>구글 시트 연결됨 · {metaRaw.length}행 로드{deletedAds.length>0&&<span style={{color:C.inkLt,fontWeight:600}}> ({deletedAds.length}개 숨김)</span>}</div>
                  <div style={{fontSize:10,color:C.inkMid,marginTop:1}}>마지막 업데이트: 방금</div>
                </>
              ) : metaStatus==="loading" ? (
                <div style={{fontSize:12,fontWeight:700,color:C.gold}}>⏳ 시트 불러오는 중...</div>
              ) : metaStatus==="error" ? (
                <div>
                  <div style={{fontSize:12,fontWeight:800,color:C.bad}}>연결 실패 — {metaError}</div>
                  <div style={{fontSize:10,color:C.inkMid,marginTop:1}}>시트 공유 설정을 확인하세요</div>
                </div>
              ) : (
                <>
                  <div style={{fontSize:12,fontWeight:800,color:C.gold}}>구글 시트를 연결하면 자동으로 데이터를 읽어요</div>
                  <div style={{fontSize:10,color:C.inkMid,marginTop:1}}>메타 광고관리자에서 복붙 → 시트에 저장 → 대시보드 자동 반영</div>
                </>
              )}
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            {hasSheet&&<Btn variant="sage" small onClick={()=>fetchSheet(sheetUrl)}>🔄 새로고침</Btn>}
            {deletedAds.length>0&&<Btn variant="neutral" small onClick={()=>{ setDeletedAds([]); }}>↩ 숨긴 광고 복원 ({deletedAds.length})</Btn>}
            <Btn variant="ghost" small onClick={()=>{setMarginInput(String(margin));setMarginModal(true)}}>⚙️ 기준 설정</Btn>
            <Btn variant={hasSheet?"neutral":"gold"} small onClick={()=>{setSheetInput(sheetUrl);setSheetModal(true)}}>
              {hasSheet?"⚙️ 시트 변경":"🔗 시트 연결"}
            </Btn>
          </div>
        </div>

        <KpiGrid items={metaKpi} cols={6}/>

        {/* ── Total 카드 — 시트(게재중) / 파일(전체) ── */}
        {hasSheet&&(()=>{
          const fmtW = n=>n>=10000?`₩${Math.round(n/10000).toLocaleString()}만`:`₩${Math.round(n).toLocaleString()}`;
          const pct  = (a,b)=>b>0?`${Math.round((a/b)*100)}%`:"—";

          const agg = rows=>({
            spend:  rows.reduce((s,r)=>s+(r.spend||0),0),
            purch:  rows.reduce((s,r)=>s+(r.purchases||0),0),
            convV:  rows.reduce((s,r)=>s+(r.convValue||0),0),
            clicks: rows.reduce((s,r)=>s+(r.clicks||0),0),
            lpv:    rows.reduce((s,r)=>s+(r.lpv||0),0),
            ads:    [...new Set(rows.map(r=>(r.adName||r.campaign||"")+"|||"+(r.adset||"")).filter(Boolean))].length,
          });

          // 게재중 — 시트 데이터
          const sheetConv    = agg(metaRaw.filter(r=>isConversionCampaign(r.objective,r.campaign)));
          const sheetTraffic = agg(metaRaw.filter(r=>!isConversionCampaign(r.objective,r.campaign)));
          const sheetTotal   = agg(metaRaw);

          // 전체 — 업로드 파일 데이터
          const fileConv    = agg(allAdRaw.filter(r=>isConversionCampaign(r.objective,r.campaign)));
          const fileTraffic = agg(allAdRaw.filter(r=>!isConversionCampaign(r.objective,r.campaign)));
          const fileTotal   = agg(allAdRaw);

          const hasFile = allAdStatus==="ok" && allAdRaw.length>0;

          const dates = metaRaw.map(r=>r.date).filter(Boolean).sort();
          const period = dates.length?`${dates[0].slice(5).replace("-","/")} ~ ${dates[dates.length-1].slice(5).replace("-","/")}`:""

          const Col=({label,icon,sheet,file,accent})=>(
            <div style={{background:"rgba(255,255,255,0.07)",borderRadius:12,padding:"14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:10}}>
                <span>{icon}</span>
                <span style={{fontSize:11,fontWeight:800,color:accent||"rgba(255,255,255,0.9)"}}>{label}</span>
              </div>
              {/* 게재중(시트) */}
              <div style={{marginBottom:hasFile?8:0}}>
                <div style={{fontSize:9,opacity:0.45,marginBottom:3}}>게재중 (시트) · {sheet.ads}개</div>
                <div style={{fontSize:16,fontWeight:900,color:"rgba(255,255,255,0.95)"}}>{fmtW(sheet.spend)}</div>
                <div style={{fontSize:9,opacity:0.5,marginTop:2}}>
                  구매 {sheet.purch}건 · ROAS {pct(sheet.convV,sheet.spend)} · LPV율 {pct(sheet.lpv,sheet.clicks)}
                </div>
              </div>
              {/* 전체(파일) */}
              {hasFile&&(
                <div style={{borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:8}}>
                  <div style={{fontSize:9,opacity:0.45,marginBottom:3}}>전체 (파일) · {file.ads}개</div>
                  <div style={{fontSize:16,fontWeight:900,color:"#fbbf24"}}>{fmtW(file.spend)}</div>
                  <div style={{fontSize:9,opacity:0.5,marginTop:2}}>
                    구매 {file.purch}건 · ROAS {pct(file.convV,file.spend)}
                  </div>
                </div>
              )}
            </div>
          );

          return(
            <div style={{background:C.ink,borderRadius:14,padding:"16px 18px",color:C.white}}>
              {/* 헤더 */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:8,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:800,letterSpacing:"0.05em"}}>📊 광고 집계</div>
                  <div style={{fontSize:10,opacity:0.5,marginTop:2}}>{period}</div>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
                  {/* 합산 광고비 */}
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:9,opacity:0.5}}>게재중 광고비</div>
                    <div style={{fontSize:20,fontWeight:900,color:"#86efac"}}>{fmtW(sheetTotal.spend)}</div>
                    {hasFile&&<div style={{fontSize:12,fontWeight:700,color:"#fbbf24",marginTop:1}}>전체 {fmtW(fileTotal.spend)}</div>}
                  </div>
                  {/* 전체파일 업로드 버튼 */}
                  <div style={{textAlign:"right"}}>
                    <input ref={allAdFileRef} type="file" accept=".xlsx,.csv" style={{display:"none"}}
                      onChange={e=>e.target.files[0]&&handleAllAdFile(e.target.files[0])}/>
                    <button onClick={()=>allAdFileRef.current?.click()}
                      style={{fontSize:10,fontWeight:700,padding:"4px 12px",borderRadius:8,
                        background:hasFile?"rgba(251,191,36,0.15)":"rgba(255,255,255,0.1)",
                        color:hasFile?"#fbbf24":"rgba(255,255,255,0.7)",
                        border:`1px solid ${hasFile?"rgba(251,191,36,0.3)":"rgba(255,255,255,0.2)"}`,
                        cursor:"pointer",fontFamily:"inherit"}}>
                      {allAdStatus==="loading"?"⏳ 읽는중...":hasFile?"🔄 전체파일 변경":"📂 전체파일 업로드"}
                    </button>
                    {hasFile&&<div style={{fontSize:9,opacity:0.4,marginTop:2}}>미게재 포함 전체</div>}
                  </div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                <Col label="전환" icon="🎯" sheet={sheetConv} file={fileConv} accent="#f9a8d4"/>
                <Col label="트래픽" icon="🚦" sheet={sheetTraffic} file={fileTraffic} accent="#93c5fd"/>
                <Col label="합산" icon="📊" sheet={sheetTotal} file={fileTotal} accent="#86efac"/>
              </div>
            </div>
          );
        })()}

        {/* 광고 소재 이미지/영상 업로드 — 드래그앤드롭 */}
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontWeight:700,fontSize:13,color:C.ink}}>🎬 광고 소재</div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {imgUploading&&<span style={{fontSize:10,color:C.inkLt}}>⏳ 업로드 중...</span>}
              {imgError&&<span style={{fontSize:10,color:C.bad,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={imgError}>❌ {imgError}</span>}
              <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple style={{display:"none"}}
                onChange={e=>handleAdImageUpload(e.target.files)}/>
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
                <div style={{fontSize:24,marginBottom:6}}>📂</div>
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
          {[{id:"overview",label:"📈 추이"},{id:"campaign",label:"📣 캠페인"},{id:"weekly",label:"📅 주별"},{id:"monthly",label:"🗓️ 월별"},{id:"product",label:"📦 제품별"}].map(t=>(
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
                <div style={{fontSize:36,marginBottom:10}}>📊</div>
                <div style={{fontSize:13,fontWeight:700,color:C.inkMid}}>구글 시트를 연결해주세요</div>
                <div style={{fontSize:11,marginTop:4,marginBottom:16}}>메타 광고관리자 데이터를 시트에 붙여넣으면 자동으로 차트가 그려져요</div>
                <Btn onClick={()=>{setSheetInput(sheetUrl);setSheetModal(true)}}>🔗 지금 연결하기</Btn>
              </div>
            )}
            {hasSheet&&d&&(<>
              <Card>
                <CardTitle title="일별 광고비" sub="소진 패턴"/>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={d.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                    <XAxis dataKey="day" tick={{fontSize:8,fill:C.inkLt}} axisLine={false} tickLine={false} interval={Math.floor(d.daily.length/6)}/>
                    <YAxis tick={{fontSize:8,fill:C.inkLt}} axisLine={false} tickLine={false}
                      tickFormatter={v=>v>=10000?`${Math.round(v/10000)}만`:v}/>
                    <Tooltip content={<BeautyTooltip fmt={v=>`₩${Math.round(v/10000).toLocaleString()}만`}/>}/>
                    <Bar dataKey="spend" fill={C.roseLt} radius={[3,3,0,0]} name="광고비"/>
                  </BarChart>
                </ResponsiveContainer>
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
              <div style={{background:`linear-gradient(135deg,${C.blush},${C.white})`,
                border:`1px solid ${C.rose}33`,borderRadius:14,padding:"16px",
                display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
                <div>
                  <div style={{fontSize:10,color:C.rose,fontWeight:700,letterSpacing:"0.1em"}}>CLICK → LPV 전환율</div>
                  <div style={{fontSize:32,fontWeight:900,color:C.rose,lineHeight:1.1}}>{d.lpvRate.toFixed(1)}%</div>
                  <div style={{fontSize:10,color:C.inkMid}}>{d.totalClicks.toLocaleString()} 클릭 → {d.totalLpv.toLocaleString()} 랜딩 도달</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,color:C.inkLt}}>평균 CPC</div>
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
                <div style={{fontSize:36,marginBottom:10}}>📣</div>
                <div style={{fontSize:13,fontWeight:700,color:C.inkMid}}>시트 연결 후 캠페인 데이터가 표시됩니다</div>
                <div style={{fontSize:11,marginTop:4,marginBottom:16}}>캠페인 목적(전환/트래픽)에 따라 자동 분류돼요</div>
                <Btn onClick={()=>{setSheetInput(sheetUrl);setSheetModal(true)}}>🔗 지금 연결하기</Btn>
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
                            💰 광고세트 예산 현황
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
                                          🟢 활성 {activeAds}개
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
                        const lpvC=lpvCostStatus(c.spend,c.lpv);
                        const lpvR=lpvRateStatus(c.clicks,c.lpv);
                        const cpa =cpaStatus(c.spend,c.purchases,adMargin);
                        const ct  =ctrStatus(c.clicks,c.impressions||0);
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
                            const lpvC=lpvCostStatus(c.spend,c.lpv);
                            const lpvR=lpvRateStatus(c.clicks,c.lpv);
                            const cpa =cpaStatus(c.spend,c.purchases,adMargin);
                            const ct  =ctrStatus(c.clicks,c.impressions||0);

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
                            const sheetMaxDate = metaRaw.map(r=>r.date).filter(Boolean).sort().pop();
                            const sheetMax = parseD(sheetMaxDate);
                            const fd  = parseD(c.firstDate);
                            const lad = parseD(c.lastActiveDate); // 지출 있는 마지막 날
                            const adAge = fd ? Math.floor((today-fd)/86400000) : null;
                            // 시트 최신 날짜 기준으로 지출 있는 마지막 날 비교
                            const lastAgo = lad&&sheetMax ? Math.floor((sheetMax-lad)/86400000) : null;
                            const isActive = lastAgo!==null && lastAgo<=1; // 지출 기준 1일 이내면 집행중

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
                                      {isActive?`🟢 D+${adAge}집행중`:`⏹ D+${adAge} (${lastAgo}일전종료)`}
                                    </span>
                                  )}
                                  {/* 복제 추천 */}
                                  {cloneable&&<span style={{fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:20,color:C.purple,background:C.purpleLt,border:`1px solid ${C.purple}33`}}>📋복제추천</span>}
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
        {metaTab==="weekly"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {!hasSheet?(
              <div style={{textAlign:"center",padding:"40px 0",color:C.inkLt}}>
                <div style={{fontSize:36,marginBottom:10}}>📅</div>
                <div style={{fontSize:13,fontWeight:700,color:C.inkMid}}>시트 연결 후 주별 데이터가 표시됩니다</div>
              </div>
            ):(()=>{
              // 주차별 집계
              const weekMap = {};
              metaRaw.forEach(r=>{
                if(!r.date) return;
                const d = new Date(r.date);
                const day = d.getDay();
                const monday = new Date(d); monday.setDate(d.getDate()-(day===0?6:day-1));
                const wk = monday.toISOString().slice(0,10);
                if(!weekMap[wk]) weekMap[wk]={week:wk,spend:0,clicks:0,lpv:0,purchases:0,convValue:0};
                weekMap[wk].spend+=(r.spend||0);
                weekMap[wk].clicks+=(r.clicks||0);
                weekMap[wk].lpv+=(r.lpv||0);
                weekMap[wk].purchases+=(r.purchases||0);
                weekMap[wk].convValue+=(r.convValue||0);
              });
              const weeks = Object.values(weekMap).sort((a,b)=>a.week.localeCompare(b.week));
              return(
                <Card>
                  <CardTitle title="📅 주별 성과" sub="주차별 광고비·구매·ROAS"/>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
                        {["주차","광고비","클릭","LPV","구매","ROAS"].map((h,i)=>(
                          <th key={i} style={{padding:"8px",textAlign:i===0?"left":"right",color:C.inkLt,fontWeight:700,fontSize:9}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>{weeks.map((w,i)=>{
                        const roas=w.spend>0?(w.convValue/w.spend).toFixed(2):0;
                        return(<tr key={i} style={{borderBottom:`1px solid ${C.border}`}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.cream}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"10px 8px",fontWeight:700,color:C.ink}}>{w.week}</td>
                          <td style={{padding:"10px 8px",textAlign:"right",color:C.rose,fontWeight:700}}>₩{Math.round(w.spend/1000).toLocaleString()}K</td>
                          <td style={{padding:"10px 8px",textAlign:"right",color:C.inkMid}}>{w.clicks.toLocaleString()}</td>
                          <td style={{padding:"10px 8px",textAlign:"right",color:C.sage}}>{w.lpv.toLocaleString()}</td>
                          <td style={{padding:"10px 8px",textAlign:"right",color:C.good,fontWeight:700}}>{w.purchases}</td>
                          <td style={{padding:"10px 8px",textAlign:"right"}}>
                            <span style={{fontWeight:800,fontSize:11,color:roas>=3?C.good:C.warn,background:roas>=3?"#EDF7F1":"#FFF8EC",padding:"2px 7px",borderRadius:20}}>{roas}x</span>
                          </td>
                        </tr>);
                      })}</tbody>
                    </table>
                  </div>
                </Card>
              );
            })()}
          </div>
        )}

        {/* 월별 탭 */}
        {metaTab==="monthly"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {!hasSheet?(
              <div style={{textAlign:"center",padding:"40px 0",color:C.inkLt}}>
                <div style={{fontSize:36,marginBottom:10}}>🗓️</div>
                <div style={{fontSize:13,fontWeight:700,color:C.inkMid}}>시트 연결 후 월별 데이터가 표시됩니다</div>
              </div>
            ):(()=>{
              const monthMap = {};
              metaRaw.forEach(r=>{
                if(!r.date) return;
                const m = r.date.slice(0,7);
                if(!monthMap[m]) monthMap[m]={month:m,spend:0,clicks:0,lpv:0,purchases:0,convValue:0};
                monthMap[m].spend+=(r.spend||0);
                monthMap[m].clicks+=(r.clicks||0);
                monthMap[m].lpv+=(r.lpv||0);
                monthMap[m].purchases+=(r.purchases||0);
                monthMap[m].convValue+=(r.convValue||0);
              });
              const months = Object.values(monthMap).sort((a,b)=>a.month.localeCompare(b.month));
              return(
                <Card>
                  <CardTitle title="🗓️ 월별 성과" sub="월별 광고비·구매·ROAS"/>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
                        {["월","광고비","클릭","LPV","구매","전환값","ROAS"].map((h,i)=>(
                          <th key={i} style={{padding:"8px",textAlign:i===0?"left":"right",color:C.inkLt,fontWeight:700,fontSize:9}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>{months.map((m,i)=>{
                        const roas=m.spend>0?(m.convValue/m.spend).toFixed(2):0;
                        return(<tr key={i} style={{borderBottom:`1px solid ${C.border}`}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.cream}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"10px 8px",fontWeight:800,color:C.ink,fontSize:13}}>{m.month}</td>
                          <td style={{padding:"10px 8px",textAlign:"right",color:C.rose,fontWeight:700}}>₩{Math.round(m.spend/1000).toLocaleString()}K</td>
                          <td style={{padding:"10px 8px",textAlign:"right",color:C.inkMid}}>{m.clicks.toLocaleString()}</td>
                          <td style={{padding:"10px 8px",textAlign:"right",color:C.sage}}>{m.lpv.toLocaleString()}</td>
                          <td style={{padding:"10px 8px",textAlign:"right",color:C.good,fontWeight:700}}>{m.purchases}</td>
                          <td style={{padding:"10px 8px",textAlign:"right",color:C.purple}}>₩{Math.round(m.convValue/1000).toLocaleString()}K</td>
                          <td style={{padding:"10px 8px",textAlign:"right"}}>
                            <span style={{fontWeight:800,fontSize:11,color:roas>=3?C.good:C.warn,background:roas>=3?"#EDF7F1":"#FFF8EC",padding:"2px 7px",borderRadius:20}}>{roas}x</span>
                          </td>
                        </tr>);
                      })}</tbody>
                    </table>
                  </div>
                </Card>
              );
            })()}
          </div>
        )}

        {/* 제품별 탭 */}
        {metaTab==="product"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {!hasSheet?(
              <div style={{textAlign:"center",padding:"40px 0",color:C.inkLt}}>
                <div style={{fontSize:36,marginBottom:10}}>📦</div>
                <div style={{fontSize:13,fontWeight:700,color:C.inkMid}}>시트 연결 후 제품별 데이터가 표시됩니다</div>
              </div>
            ):(()=>{
              // margins 키워드로 제품 분류
              const productMap = {};
              const PRODUCTS = margins.length>0 ? margins.map(m=>m.keyword) : ["프리온","소닉플로우","에어리소닉"];
              metaRaw.forEach(r=>{
                const name = (r.adName||r.campaign||"").toLowerCase();
                let matched = "기타";
                PRODUCTS.forEach(p=>{ if(name.includes(p.toLowerCase())) matched=p; });
                if(!productMap[matched]) productMap[matched]={product:matched,spend:0,clicks:0,lpv:0,purchases:0,convValue:0,count:0};
                productMap[matched].spend+=(r.spend||0);
                productMap[matched].clicks+=(r.clicks||0);
                productMap[matched].lpv+=(r.lpv||0);
                productMap[matched].purchases+=(r.purchases||0);
                productMap[matched].convValue+=(r.convValue||0);
                productMap[matched].count++;
              });
              const products = Object.values(productMap).sort((a,b)=>b.spend-a.spend);
              return(
                <Card>
                  <CardTitle title="📦 제품별 성과" sub="광고명 키워드 기준 자동 분류"/>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
                        {["제품","광고수","광고비","구매","CPA","ROAS"].map((h,i)=>(
                          <th key={i} style={{padding:"8px",textAlign:i===0?"left":"right",color:C.inkLt,fontWeight:700,fontSize:9}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>{products.map((p,i)=>{
                        const cpa=p.purchases>0?Math.round(p.spend/p.purchases):0;
                        const roas=p.spend>0?(p.convValue/p.spend).toFixed(2):0;
                        return(<tr key={i} style={{borderBottom:`1px solid ${C.border}`}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.cream}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"10px 8px",fontWeight:800,color:C.ink}}>{p.product}</td>
                          <td style={{padding:"10px 8px",textAlign:"right",color:C.inkMid}}>{p.count}</td>
                          <td style={{padding:"10px 8px",textAlign:"right",color:C.rose,fontWeight:700}}>₩{Math.round(p.spend/1000).toLocaleString()}K</td>
                          <td style={{padding:"10px 8px",textAlign:"right",color:C.good,fontWeight:700}}>{p.purchases}</td>
                          <td style={{padding:"10px 8px",textAlign:"right"}}>
                            {cpa>0?<span style={{fontWeight:800,fontSize:11,color:cpa<=16000?C.good:C.bad,background:cpa<=16000?"#EDF7F1":"#FEF0F0",padding:"2px 7px",borderRadius:20}}>₩{cpa.toLocaleString()}</span>:<span style={{color:C.inkLt}}>—</span>}
                          </td>
                          <td style={{padding:"10px 8px",textAlign:"right"}}>
                            <span style={{fontWeight:800,fontSize:11,color:roas>=3?C.good:C.warn,background:roas>=3?"#EDF7F1":"#FFF8EC",padding:"2px 7px",borderRadius:20}}>{roas}x</span>
                          </td>
                        </tr>);
                      })}</tbody>
                    </table>
                  </div>
                </Card>
              );
            })()}
          </div>
        )}

        {/* 구글 시트 연결 모달 */}
        {sheetModal&&(
          <Modal title="📊 구글 시트 연결" onClose={()=>setSheetModal(false)} wide>
            {/* 사용 방법 안내 */}
            <div style={{background:C.cream,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px",marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:800,color:C.ink,marginBottom:12}}>📋 연결 방법 (3단계)</div>
              {[
                {n:"1",title:"메타 광고관리자에서 내보내기",desc:"광고관리자 → 보고서 → CSV 다운로드 (날짜·캠페인·목적·노출·클릭·LPV·전환·지출 컬럼 포함)"},
                {n:"2",title:"구글 시트에 붙여넣기",desc:"구글 드라이브에서 새 시트 만들고 → A1 셀에 그대로 붙여넣기 (헤더 포함). 시트명은 아무거나 OK"},
                {n:"3",title:"공유 설정 변경",desc:"시트 우상단 '공유' → '링크가 있는 모든 사용자' → '뷰어'로 설정 후 링크 복사"},
              ].map(s=>(
                <div key={s.n} style={{display:"flex",gap:10,marginBottom:10}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:C.rose,color:C.white,
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,flexShrink:0}}>{s.n}</div>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:C.ink}}>{s.title}</div>
                    <div style={{fontSize:10,color:C.inkMid,marginTop:2}}>{s.desc}</div>
                  </div>
                </div>
              ))}
              <div style={{marginTop:8,padding:"8px 12px",background:C.goldLt,borderRadius:8,fontSize:10,color:C.gold,fontWeight:700}}>
                💡 메타 광고관리자 컬럼 이름이 한국어·영어 둘 다 자동으로 인식돼요
              </div>
            </div>

            <FR label="구글 시트 URL">
              <Inp value={sheetInput} onChange={setSheetInput}
                placeholder="https://docs.google.com/spreadsheets/d/..."/>
            </FR>
            <div style={{fontSize:10,color:C.inkLt,marginBottom:16,marginTop:-6}}>
              공유 링크 또는 편집 링크 모두 가능해요
            </div>
            <Btn onClick={saveSheetUrl} disabled={!sheetInput.trim()} style={{width:"100%"}}>
              🔗 연결하기
            </Btn>
            {sheetUrl&&(
              <Btn variant="danger" onClick={()=>{setMetaRaw([]);setMetaStatus("idle");setSheetModal(false);}}
                style={{width:"100%",marginTop:8}}>
                🗑 연결 해제
              </Btn>
            )}
          </Modal>
        )}

        {/* ── 기준 설정 모달 (전환 마진 + 트래픽 기준) ── */}
        {marginModal&&(
          <Modal title="⚙️ 광고 기준 설정" onClose={()=>setMarginModal(false)} wide>

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
                      <Btn small variant="neutral" onClick={()=>setEditingMargin({...m})}>✏️</Btn>
                      <Btn small variant="danger" onClick={()=>setMargins(margins.filter(x=>x.id!==m.id))}>🗑</Btn>
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
                  })}>🗑</Btn>
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
    {label:"게시 완료",    value:`${infs.filter(f=>f.posted>0).length}/${infs.length}명`,change:0,good:"high",icon:"📸",note:"게시 확인 기준"},
    {label:"2차 활용가능", value:`${infs.filter(f=>f.reusable).length}명`,change:0,good:"high",icon:"♻️",note:"활용 가능"},
    {label:"💰 입금완료",  value:`${infs.filter(f=>f.reusable&&f.paid).length}명`,change:0,good:"high",icon:"✅",note:`미입금 ${infs.filter(f=>f.reusable&&!f.paid).length}명`},
    {label:"메타 활용",    value:`${infs.filter(f=>f.metaUsed).length}명`,change:0,good:"high",icon:"📣",note:"광고 소재 활용"},
  ];
  // 인플루언서 모달 — 별도 컴포넌트로 분리해서 리렌더 차단
  // InfModal
  const [infModalData, setInfModalData] = useState(null); // {mode, initial}
  const [insModalData, setInsModalData] = useState(null); // {initial}
  const [invModalData, setInvModalData] = useState(null); // {mode, initial}
  const [schModalData, setSchModalData] = useState(null); // {mode, initial}
  // 모달은 return JSX 안에서 직접 렌더링


  const InfluencerSection=(()=>{
    const tierData=[
      {name:"매크로",value:infs.filter(f=>f.tier==="매크로").length,color:C.rose},
      {name:"미드",  value:infs.filter(f=>f.tier==="미드").length,  color:C.gold},
      {name:"마이크로",value:infs.filter(f=>f.tier==="마이크로").length,color:C.sage},
      {name:"나노",  value:infs.filter(f=>f.tier==="나노").length,  color:C.purple},
    ].filter(d=>d.value>0);
    return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* 구글 시트 연동 배너 */}
      <div style={{
        background: infSheetStatus==="ok" ? "#EDF7F1" : C.goldLt,
        border:`1px solid ${infSheetStatus==="ok"?C.good+"55":C.gold+"66"}`,
        borderRadius:12,padding:"12px 16px",
        display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",
      }}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>{infSheetStatus==="ok"?"🟢":"📋"}</span>
          <div>
            {infSheetStatus==="ok"
              ? <><div style={{fontSize:12,fontWeight:800,color:C.good}}>구글 시트 연결됨 · {infs.length}명 로드</div>
                  <div style={{fontSize:10,color:C.inkMid,marginTop:1}}>시트 변경 시 자동 반영</div></>
              : infSheetStatus==="loading"
              ? <div style={{fontSize:12,fontWeight:700,color:C.gold}}>⏳ 불러오는 중...</div>
              : infSheetStatus==="error"
              ? <div style={{fontSize:12,fontWeight:800,color:C.bad}}>연결 실패 — 시트 공유 설정 또는 URL을 확인하세요</div>
              : <><div style={{fontSize:12,fontWeight:800,color:C.gold}}>구글 시트 연결하면 인플루언서 데이터가 자동 동기화돼요</div>
                  <div style={{fontSize:10,color:C.inkMid,marginTop:1}}>name · tier · platform · product · reach · saves · clicks · conv 등</div></>
            }
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {infSheetStatus==="ok"&&<Btn variant="sage" small onClick={()=>fetchInfSheet(infUrl)}>🔄 새로고침</Btn>}
          {infSheetStatus==="error"&&<Btn variant="danger" small onClick={()=>{setInfSheetStatus("idle");}}>🗑 URL 초기화</Btn>}
          <Btn variant={infSheetStatus==="ok"?"neutral":"gold"} small onClick={()=>{setInfUrlInput(infUrl);setInfUrlModal(true)}}>
            {infSheetStatus==="ok"?"⚙️ 시트 변경":"🔗 시트 연결"}
          </Btn>
        </div>
      </div>

      {/* 시트 URL 입력 모달 */}
      {infUrlModal&&(
        <Modal title="📋 인플루언서 시트 연결" onClose={()=>setInfUrlModal(false)}>
          <div style={{background:C.cream,borderRadius:10,padding:"14px",marginBottom:16,fontSize:11,color:C.inkMid,lineHeight:1.7}}>
            <b style={{color:C.ink}}>시트 1행 헤더 그대로 사용 가능</b><br/>
            담당자 · 제품명 · 이름 · 인스타그램 아이디 · 매체 · 링크 · 제품 발송 · 제품발송일자 · 작성마감일 · 포스팅 확인 · 비고 · 기간연장<br/>
            <span style={{color:C.rose}}>※ 포스팅 확인 컬럼이 "확인완료"이면 게시완료로 인식</span>
          </div>
          <FR label="구글 시트 URL">
            <Inp value={infUrlInput} onChange={v=>setInfUrlInput(v)} placeholder="https://docs.google.com/spreadsheets/d/..."/>
          </FR>
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <Btn onClick={()=>{setInfUrl(infUrlInput);setInfUrlModal(false);fetchInfSheet(infUrlInput);}} style={{flex:1}}>🔗 연결</Btn>
            {infUrl&&<Btn variant="danger" onClick={()=>{setInfSheetStatus("idle");setInfUrlModal(false);}}>연결 해제</Btn>}
          </div>
        </Modal>
      )}

      {overdueIns.length>0&&(
        <div style={{background:"#FFFBF0",border:`2px solid ${C.warn}66`,borderRadius:14,
          padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <span style={{fontSize:20}}>⏰</span>
          <div style={{flex:1,minWidth:140}}>
            <div style={{fontSize:12,fontWeight:800,color:C.warn}}>인사이트 기록 필요 · {overdueIns.length}명</div>
            <div style={{fontSize:10,color:C.inkMid,marginTop:2}}>{overdueIns.map(f=>f.name).join(" · ")}</div>
          </div>
        </div>
      )}
      <KpiGrid items={infKpi} cols={6}/>
      <div className="content-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {/* 💰 2차활용 미입금 카드 */}
        <Card>
          <CardTitle title="💰 2차활용 입금 현황" sub={`미입금 ${infs.filter(f=>f.reusable&&!f.paid).length}명`}/>
          {infs.filter(f=>f.reusable&&!f.paid).length===0?(
            <div style={{textAlign:"center",padding:"24px 0",color:C.good,fontSize:12,fontWeight:700}}>✅ 모두 입금 완료</div>
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
        <CardTitle title="인플루언서별 시딩 현황" sub="게시일 최근순"
          action={<Btn small onClick={()=>{setInfModalData({mode:"add",initial:null})}}>+ 추가</Btn>}/>
        {infs.length===0&&(
          <div style={{textAlign:"center",padding:"32px 0",color:C.inkLt,fontSize:12}}>
            아직 등록된 인플루언서가 없어요<br/>
            <Btn style={{marginTop:12}} onClick={()=>{setInfModalData({mode:"add",initial:null})}}>+ 첫 번째 추가</Btn>
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[...infs].sort((a,b)=>{
            if(!a.postedDate&&!b.postedDate) return 0;
            if(!a.postedDate) return 1;
            if(!b.postedDate) return -1;
            return new Date(b.postedDate)-new Date(a.postedDate);
          }).map(f=>{
            const st=insightStatus(f);
            const tc={유료:C.rose,무료:C.sage,매크로:C.rose,미드:C.gold,마이크로:C.sage,나노:C.purple}[f.tier]||C.inkMid;
            const due=addDays(f.postedDate,7);
            const elapsed=f.postedDate&&due?Math.min(Math.max((TODAY-new Date(f.postedDate))/(new Date(due)-new Date(f.postedDate)),0),1):0;
            return(
              <div key={f.id} style={{border:`1px solid ${st.label.includes("미입력")||st.label==="오늘 입력!"?C.warn+"66":C.border}`,
                borderRadius:12,padding:"12px 14px",background:st.label.includes("미입력")?"#FFF8F8":C.white}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
                  <div style={{display:"flex",gap:10,alignItems:"center",flex:1,minWidth:0}}>
                    <div style={{width:34,height:34,borderRadius:10,background:`${tc}22`,flexShrink:0,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>
                      {f.platform==="인스타"?"📸":f.platform==="유튜브"?"▶️":"🎵"}
                    </div>
                    <div>
                      <div style={{fontSize:12,fontWeight:800,color:C.ink}}>
                        {(()=>{
                          const handle = f.name.replace(/^@/,"");
                          const url = f.platform==="유튜브"
                            ? `https://www.youtube.com/@${handle}`
                            : f.platform==="틱톡"
                            ? `https://www.tiktok.com/@${handle}`
                            : `https://www.instagram.com/${handle}`;
                          return(
                            <a href={url} target="_blank" rel="noopener noreferrer"
                              style={{color:C.ink,textDecoration:"none",cursor:"pointer",
                                borderBottom:`1px dashed ${C.border}`}}
                              onMouseEnter={e=>{e.currentTarget.style.color=C.rose;e.currentTarget.style.borderBottomColor=C.rose;}}
                              onMouseLeave={e=>{e.currentTarget.style.color=C.ink;e.currentTarget.style.borderBottomColor=C.border;}}>
                              {f.displayName||f.name}
                            </a>
                          );
                        })()}
                      </div>
                      <div style={{fontSize:10,color:C.inkLt}}>
                        <span style={{color:tc,fontWeight:700}}>{f.tier}</span>{" · "}{f.name}{" · "}{f.product}
                      </div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,fontWeight:700,color:st.color,background:st.bg,
                      padding:"3px 10px",borderRadius:20,whiteSpace:"nowrap"}}>{st.icon} {st.label}</span>
                    {st.label!=="기록완료"&&st.label!=="미게시"&&(
                      <Btn variant="ghost" small onClick={()=>{
                        setInsModalData({initial:{id:f.id,name:f.name,reach:"",saves:"",clicks:"",conv:""}});
                        setInsModalData({initial:true});
                      }}>✏️ 기록</Btn>
                    )}
                    <Btn variant="neutral" small onClick={()=>{setInfModalData({mode:"edit",initial:f})}}>수정</Btn>
                    <Btn variant="danger" small onClick={()=>setInfs(infs.filter(x=>x.id!==f.id))}>🗑</Btn>
                  </div>
                </div>
                {f.postedDate&&(
                  <div style={{marginTop:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.inkLt,marginBottom:3}}>
                      <span>게시 {f.postedDate}</span><span>D+7 기록 {due}</span>
                    </div>
                    <div style={{height:4,background:C.border,borderRadius:2,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${elapsed*100}%`,borderRadius:2,
                        background:st.label==="기록완료"?C.good:elapsed>=1?C.bad:`linear-gradient(90deg,${C.rose},${C.gold})`}}/>
                    </div>
                  </div>
                )}
                {/* 콘텐츠 활용 현황 */}
                <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                  {/* 영상 수령 */}
                  <span onClick={()=>setInfs(arr=>arr.map(x=>x.id===f.id?{...x,videoReceived:!x.videoReceived}:x))}
                    style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,cursor:"pointer",
                      color:f.videoReceived?C.good:C.inkLt,
                      background:f.videoReceived?"#EDF7F1":C.cream,
                      border:`1px solid ${f.videoReceived?C.good+"44":C.border}`}}>
                    🎬 {f.videoReceived?"영상수령":"미수령"}
                  </span>
                  {/* 2차 활용 가능 여부 */}
                  {(()=>{ const rs=reusableStatus(f); return(
                    <span onClick={()=>setInfs(arr=>arr.map(x=>x.id===f.id?{...x,reusable:!x.reusable}:x))}
                      style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,cursor:"pointer",
                        color:rs.color,background:rs.bg,border:`1px solid ${rs.color}44`}}>
                      ♻️ {rs.label}
                    </span>
                  );})()}
                  {/* 2차활용 입금 여부 */}
                  {f.reusable&&(
                    <span onClick={()=>setInfs(arr=>arr.map(x=>x.id===f.id?{...x,paid:!x.paid}:x))}
                      style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,cursor:"pointer",
                        color:f.paid?C.good:C.warn,
                        background:f.paid?"#EDF7F1":"#FFF8EC",
                        border:`1px solid ${f.paid?C.good+"44":C.warn+"44"}`}}>
                      💰 {f.paid?"입금완료":"미입금"}
                    </span>
                  )}
                  {/* 메타 광고 활용 */}
                  <span onClick={()=>setInfs(arr=>arr.map(x=>x.id===f.id?{...x,metaUsed:!x.metaUsed}:x))}
                    style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,cursor:"pointer",
                      color:f.metaUsed?C.purple:C.inkLt,
                      background:f.metaUsed?C.purpleLt:C.cream,
                      border:`1px solid ${f.metaUsed?C.purple+"44":C.border}`}}>
                    📣 {f.metaUsed?"메타광고 활용":"미활용"}
                  </span>
                </div>
                {/* 메모 */}
                {f.note&&(
                  <div style={{marginTop:6,fontSize:10,color:C.inkMid,padding:"4px 10px",
                    background:C.cream,borderRadius:8,display:"inline-block"}}>
                    {f.note}
                  </div>
                )}
                {f.reach!==null&&(
                  <div style={{display:"flex",gap:14,marginTop:10,flexWrap:"wrap"}}>
                    {[{l:"도달",v:(f.reach/1000).toFixed(0)+"K",c:C.rose},{l:"저장",v:f.saves?.toLocaleString(),c:C.gold},
                      {l:"클릭",v:f.clicks?.toLocaleString(),c:C.purple},{l:"전환",v:f.conv,c:C.good}].map(({l,v,c})=>(
                      <div key={l} style={{textAlign:"center"}}>
                        <div style={{fontSize:9,color:C.inkLt}}>{l}</div>
                        <div style={{fontSize:13,fontWeight:800,color:c}}>{v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

    </div>
    );
  })();
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📦 재고 + 📅 스케줄 (이전 v5와 동일)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const invKpi=[
    {label:"전체 SKU",    value:`${inv.length}종`,change:0,good:"high",icon:"📋",note:"활성 상품"},
    {label:"위험 재고",   value:`${dangerInv.length}종`,change:dangerInv.length>0?1:0,good:"low",icon:"🚨",note:"즉시 발주"},
    {label:"주의 재고",   value:`${cautionInv.length}종`,change:0,good:"low",icon:"⚠️",note:"21일 내 소진"},
    {label:"30일 판매",   value:inv.reduce((s,i)=>s+i.sold30,0).toLocaleString(),change:+18.4,good:"high",icon:"📈",note:"전월 대비"},
    {label:"총 재고",     value:inv.reduce((s,i)=>s+i.stock,0).toLocaleString(),change:-3.2,good:"high",icon:"📦",note:"전체 수량"},
    {label:"주문 재고",   value:inv.reduce((s,i)=>s+(i.ordered||0),0).toLocaleString(),change:0,good:"high",icon:"🚚",note:"입고 예정"},
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

  const InventorySection=(()=>{
    const [uploadMsg,setUploadMsg]=useState("");
    function handleInvFile(e){
      const file=e.target.files[0]; if(!file)return;
      const reader=new FileReader();
      reader.onload=ev=>{
        try{
          const parsed=parseInvCSV(ev.target.result);
          if(parsed.length===0){setUploadMsg("❌ 데이터를 읽지 못했어요. 양식을 확인해주세요.");}
          else{setInv(parsed);setUploadMsg("✅ "+parsed.length+"개 상품 업로드 완료!");}
        }catch(err){setUploadMsg("❌ 파일 읽기 실패");}
        setTimeout(()=>setUploadMsg(""),4000);
      };
      reader.readAsText(file,"utf-8");
      e.target.value="";
    }
    return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* 구글시트 연결 배너 */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",
        background:C.white,border:`1px solid ${invSheetStatus==="ok"?C.good+"66":C.border}`,
        borderRadius:12,flexWrap:"wrap"}}>
        <span style={{fontSize:18}}>{invSheetStatus==="ok"?"🟢":"📋"}</span>
        <div style={{flex:1}}>
          {invSheetStatus==="ok"
            ? <div style={{fontSize:12,fontWeight:700,color:C.good}}>구글시트 연결됨 · {inv.length}개 상품 로드</div>
            : <><div style={{fontSize:12,fontWeight:700,color:C.ink}}>구글시트 재고원본 연결</div>
               <div style={{fontSize:10,color:C.inkLt}}>재고원본 시트 URL을 연결하면 자동으로 재고가 업데이트돼요</div></>
          }
        </div>
        {invSheetStatus==="loading"&&<span style={{fontSize:11,color:C.inkLt}}>⏳ 불러오는 중...</span>}
        {invSheetStatus==="error"&&<span style={{fontSize:11,color:C.bad,fontWeight:700}}>❌ 연결 실패</span>}
        {invSheetStatus==="ok"&&<Btn variant="sage" small onClick={()=>fetchInvSheet(invUrl)}>🔄</Btn>}
        <Btn variant={invSheetStatus==="ok"?"neutral":"gold"} small
          onClick={()=>{setInvUrlInput(invUrl);setInvUrlModal(true)}}>
          {invSheetStatus==="ok"?"⚙️ 시트변경":"🔗 시트연결"}
        </Btn>
      </div>

      {/* CSV 파일 업로드 (대안) */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
        background:C.cream,border:`1px dashed ${C.border}`,borderRadius:10,flexWrap:"wrap"}}>
        <span style={{fontSize:12,color:C.inkLt}}>📂 또는 CSV 파일로 업로드</span>
        {uploadMsg&&<span style={{fontSize:11,fontWeight:700,
          color:uploadMsg.startsWith("✅")?C.good:C.bad}}>{uploadMsg}</span>}
        <label style={{cursor:"pointer",marginLeft:"auto"}}>
          <input type="file" accept=".csv,.txt" onChange={handleInvFile} style={{display:"none"}}/>
          <span style={{fontSize:10,fontWeight:700,padding:"5px 12px",borderRadius:8,
            border:`1px solid ${C.border}`,background:C.white,color:C.inkMid,whiteSpace:"nowrap"}}>
            파일 선택
          </span>
        </label>
      </div>

      {/* 재고원본 시트 연결 모달 */}
      {invUrlModal&&(
        <Modal title="📋 재고원본 시트 연결" onClose={()=>setInvUrlModal(false)} wide>
          <div style={{background:C.sageLt,borderRadius:10,padding:"12px 14px",marginBottom:16,fontSize:11,color:C.sage,fontWeight:700}}>
            💡 구글시트 발주분석 파일의 <b>재고원본</b> 시트 URL을 붙여넣으세요<br/>
            <span style={{fontWeight:400,color:C.inkMid}}>시트 공유 설정 → "링크 있는 모든 사용자" → 뷰어 권한</span>
          </div>
          <div style={{background:C.cream,borderRadius:8,padding:"10px 12px",fontSize:10,color:C.inkMid,marginBottom:14,lineHeight:1.8}}>
            1. 구글시트에서 <b>재고원본</b> 시트 탭 클릭<br/>
            2. 주소창 URL 전체 복사 (gid=숫자 포함)<br/>
            3. 아래에 붙여넣기
          </div>
          <FR label="구글시트 URL">
            <Inp value={invUrlInput} onChange={setInvUrlInput} placeholder="https://docs.google.com/spreadsheets/d/..."/>
          </FR>
          <Btn onClick={()=>{
            const url=invUrlInput.trim();
            if(url) setInvUrl(url);
            setInvUrlModal(false);
            if(url) fetchInvSheet(url);
          }} style={{width:"100%",marginTop:8}}>🔗 연결하기</Btn>
        </Modal>
      )}
      {dangerInv.length>0&&(<div style={{background:"#FEF0F0",border:`1px solid ${C.bad}44`,borderRadius:12,padding:"12px 14px",display:"flex",gap:10}}><span style={{fontSize:18}}>🚨</span><div><div style={{fontSize:12,fontWeight:800,color:C.bad}}>즉시 발주 — {dangerInv.map(i=>i.name).join(", ")}</div><div style={{fontSize:10,color:C.inkMid,marginTop:2}}>가용 재고 7일치 미만</div></div></div>)}
      {cautionInv.length>0&&(<div style={{background:"#FFF8EC",border:`1px solid ${C.warn}44`,borderRadius:12,padding:"12px 14px",display:"flex",gap:10}}><span style={{fontSize:18}}>⚠️</span><div><div style={{fontSize:12,fontWeight:800,color:C.warn}}>주의 — {cautionInv.map(i=>i.name).join(", ")}</div><div style={{fontSize:10,color:C.inkMid,marginTop:2}}>14~21일 내 소진 예상</div></div></div>)}
      <KpiGrid items={invKpi} cols={6}/>
      <Card>
        <CardTitle title="전체 재고 현황" sub="가용 · 예약 · 재고일수"
          action={<Btn small onClick={()=>{setInvModalData({mode:"add",initial:null})}}>+ 추가</Btn>}/>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:480}}>
            <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
              {["상품","현재재고","주문(입고예정)","재고일수","30일판매","상태",""].map(h=>(
                <th key={h} style={{padding:"8px 8px",textAlign:h==="상품"?"left":"right",color:C.inkLt,fontWeight:700,fontSize:9,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{inv.map(item=>{
              const st=stockStatus(item),d=stockDays(item);
              return(<tr key={item.id} style={{borderBottom:`1px solid ${C.border}`,transition:"background 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.background=C.cream}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"10px 8px"}}><div style={{fontWeight:700,color:C.ink}}>{item.name}</div><div style={{fontSize:9,color:C.inkLt}}>{item.sku}</div></td>
                <td style={{padding:"10px 8px",textAlign:"right",fontWeight:700,color:C.ink}}>{item.stock.toLocaleString()}</td>
                <td style={{padding:"10px 8px",textAlign:"right"}}>
                  {(item.ordered||0)>0
                    ? <span style={{fontWeight:700,color:C.good,background:"#EDF7F1",padding:"2px 8px",borderRadius:20,fontSize:10}}>+{(item.ordered||0).toLocaleString()} 입고예정</span>
                    : <span style={{color:C.inkLt,fontSize:10}}>—</span>}
                </td>
                <td style={{padding:"10px 8px",textAlign:"right"}}><span style={{fontWeight:800,fontSize:11,color:d<7?C.bad:d<21?C.warn:C.good}}>{d}일</span></td>
                <td style={{padding:"10px 8px",textAlign:"right",color:C.inkMid}}>{item.sold30.toLocaleString()}</td>
                <td style={{padding:"10px 8px",textAlign:"right"}}><span style={{fontSize:9,fontWeight:700,color:st.color,background:st.bg,padding:"2px 8px",borderRadius:20}}>{st.label}</span></td>
                <td style={{padding:"10px 8px",textAlign:"right"}}>
                  <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                    <Btn variant="ghost" small onClick={()=>{setInvModalData({mode:"edit",initial:item})}}>수정</Btn>
                    <Btn variant="danger" small onClick={()=>setInv(inv.filter(v=>v.id!==item.id))}>🗑</Btn>
                  </div>
                </td>
              </tr>);
            })}</tbody>
          </table>
        </div>
      </Card>
      <div className="content-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,alignItems:"start"}}>
      <Card>
        <CardTitle title="주요 상품 재고 추이 (4주)" sub="주간 재고 감소 흐름"/>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={stockTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
            <XAxis dataKey="week" tick={{fontSize:10,fill:C.inkLt}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:9,fill:C.inkLt}} axisLine={false} tickLine={false}/>
            <Tooltip content={<BeautyTooltip/>}/>
            <Line type="monotone" dataKey="세럼30"  stroke={C.rose} strokeWidth={2.5} dot={{r:3,fill:C.rose}} name="세럼 30ml"/>
            <Line type="monotone" dataKey="선크림"  stroke={C.gold} strokeWidth={2}   dot={{r:3,fill:C.gold}} name="선크림"/>
            <Line type="monotone" dataKey="토너패드" stroke={C.bad} strokeWidth={2.5} dot={{r:3,fill:C.bad}} strokeDasharray="5 3" name="토너 패드"/>
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <div style={{background:`linear-gradient(135deg,${C.goldLt},#fff)`,border:`1px solid ${C.gold}44`,borderRadius:14,padding:"16px"}}>
        <div style={{fontSize:12,fontWeight:800,color:C.gold,marginBottom:10}}>📋 발주 권고 리스트</div>
        {inv.filter(i=>stockStatus(i).label!=="정상").sort((a,b)=>stockDays(a)-stockDays(b)).map((item,i,arr)=>{
          const st=stockStatus(item);
          return(<div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<arr.length-1?`1px solid ${C.gold}22`:"none"}}>
            <div><div style={{fontSize:11,fontWeight:700,color:C.ink}}>{item.name}</div><div style={{fontSize:9,color:C.inkMid}}>권장 {item.reorder.toLocaleString()}개</div></div>
            <span style={{fontSize:10,fontWeight:800,color:st.color,background:st.bg,padding:"3px 10px",borderRadius:20}}>{st.label==="위험"?"즉시":"14일 내"}</span>
          </div>);
        })}
        {inv.filter(i=>stockStatus(i).label!=="정상").length===0&&<div style={{fontSize:11,color:C.inkLt,textAlign:"center",padding:"12px 0"}}>발주 권고 없음 ✅</div>}
      </div>
      </div>
    </div>
  );
  })();

  const upcoming=sch.filter(s=>s.status!=="완료").sort((a,b)=>new Date(a.date)-new Date(b.date));
  const done=sch.filter(s=>s.status==="완료");
  const ScheduleSection=(()=>{
    return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div className="content-grid-3" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {["공구","시딩","광고","이벤트"].map(type=>{
          const tc=schTypeColor(type);
          return(<div key={type} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
            <div style={{fontSize:20,marginBottom:4}}>{schTypeIcon(type)}</div>
            <div style={{fontSize:9,color:C.inkLt,fontWeight:700,letterSpacing:"0.1em"}}>{type}</div>
            <div style={{fontSize:22,fontWeight:900,color:tc}}>{sch.filter(s=>s.type===type&&s.status!=="완료").length}</div>
            <div style={{fontSize:9,color:C.inkLt}}>진행 예정</div>
          </div>);
        })}
      </div>
      <Card>
        <CardTitle title="📅 전체 일정" sub="공구·시딩·광고·이벤트 통합 스케줄"
          action={<Btn small onClick={()=>{setSchModalData({mode:"add",initial:null})}}>+ 일정 추가</Btn>}/>
        {upcoming.length===0&&<div style={{textAlign:"center",color:C.inkLt,fontSize:12,padding:"28px 0"}}>예정된 일정이 없습니다</div>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {upcoming.map(s=>{
            const d=daysUntil(s.date),tc=schTypeColor(s.type),isUrgent=d!==null&&d<=3&&d>=0;
            return(<div key={s.id} style={{border:`1px solid ${isUrgent?C.rose+"66":C.border}`,borderRadius:12,
              padding:"12px 14px",background:isUrgent?"#FFF8FC":C.white,transition:"box-shadow 0.2s"}}
              onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 4px 16px rgba(232,86,122,0.1)`}
              onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
                <div style={{display:"flex",gap:10,alignItems:"flex-start",flex:1,minWidth:0}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:44,flexShrink:0}}>
                    <span style={{fontSize:10,fontWeight:700,color:tc,background:`${tc}18`,padding:"2px 8px",borderRadius:20,whiteSpace:"nowrap"}}>{schTypeIcon(s.type)} {s.type}</span>
                    {d!==null&&<span style={{fontSize:9,marginTop:4,color:d<0?C.bad:d<=3?C.rose:C.inkLt,fontWeight:700}}>{d===0?"오늘":d<0?`D+${Math.abs(d)}`:`D-${d}`}</span>}
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:800,color:C.ink}}>{s.title}</div>
                    <div style={{fontSize:10,color:C.inkLt,marginTop:2}}>📆 {s.date}{s.endDate?` ~ ${s.endDate}`:""}{s.platform&&` · ${s.platform}`}</div>
                    {s.note&&<div style={{fontSize:10,color:C.inkMid,marginTop:3}}>💬 {s.note}</div>}
                  </div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <Btn variant="ghost" small onClick={()=>{setSchModalData({mode:"edit",initial:s})}}>✏️</Btn>
                  <Btn variant="sage" small onClick={()=>setSch(sch.map(x=>x.id===s.id?{...x,status:"완료"}:x))}>✅</Btn>
                  <Btn variant="danger" small onClick={()=>setSch(sch.filter(x=>x.id!==s.id))}>🗑</Btn>
                </div>
              </div>
            </div>);
          })}
        </div>
      </Card>
      {done.length>0&&(
        <Card>
          <CardTitle title="✅ 완료된 일정" sub={`${done.length}건`}/>
          {done.map(s=>(
            <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"8px 10px",borderRadius:10,background:C.cream,opacity:0.7,marginBottom:4}}>
              <div>
                <span style={{fontSize:10,fontWeight:700,color:schTypeColor(s.type),background:`${schTypeColor(s.type)}18`,
                  padding:"1px 7px",borderRadius:20,marginRight:8}}>{s.type}</span>
                <span style={{fontSize:12,fontWeight:600,color:C.inkMid}}>{s.title}</span>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{fontSize:10,color:C.inkLt}}>{s.date}</span>
                <Btn variant="danger" small onClick={()=>setSch(sch.filter(x=>x.id!==s.id))}>🗑</Btn>
              </div>
            </div>
          ))}
        </Card>
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
                <span style={{fontSize:18,lineHeight:1}}>{n.icon}</span>
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
            {orderStatus==="ok"&&orderRaw.length>0&&<div style={{fontSize:10,color:C.bad,fontWeight:700,marginBottom:3}}>📦 발주임박 {orderRaw.length}개</div>}
            {cutAds.length>0&&<div style={{fontSize:10,color:C.bad,fontWeight:700,marginBottom:3}}>🔴 광고교체 {cutAds.length}개</div>}
            {holdAds.length>0&&<div style={{fontSize:10,color:C.warn,marginBottom:3}}>🟡 광고보류 {holdAds.length}개</div>}
            {dangerInv.length>0&&<div style={{fontSize:10,color:C.inkMid,marginBottom:3}}>🚨 재고위험 {dangerInv.length}종</div>}
            {overdueIns.length>0&&<div style={{fontSize:10,color:C.inkMid,marginBottom:3}}>❗ 인사이트 {overdueIns.length}명</div>}
            {overdueScheds.length>0&&<div style={{fontSize:10,color:C.inkMid,marginBottom:3}}>📅 기간초과 {overdueScheds.length}건</div>}
            {urgentScheds.length>0&&<div style={{fontSize:10,color:C.inkMid}}>🔔 D-5임박 {urgentScheds.length}건</div>}
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
          {sec==="inventory"   && InventorySection}
          {sec==="schedule"    && ScheduleSection}
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
            <span style={{fontSize:18}}>{n.icon}</span>
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
        onSave={(item)=>{
          if(schModalData.mode==="edit"){
            setSch(arr=>arr.map(x=>x.id===item.id?item:x));
          } else {
            setSch(arr=>[...arr,{...item,id:Date.now()}]);
          }
          setSchModalData(null);
        }}
        onClose={()=>setSchModalData(null)}
      />}
    </div>
  );
}
