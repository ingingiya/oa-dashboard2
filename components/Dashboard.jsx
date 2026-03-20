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
function lpvCostStatus(spend, lpv, c={}){
  if(!lpv||!spend) return null;
  const cost = spend/lpv;
  const g=c.lpvCostGood||300, ok=c.lpvCostOk||500, h=c.lpvCostHold||800;
  if(cost<g)  return {label:"매우좋음", color:C.good, bg:"#EDF7F1", icon:"🟢", cost:Math.round(cost)};
  if(cost<ok) return {label:"유지",     color:C.sage, bg:C.sageLt,  icon:"🔵", cost:Math.round(cost)};
  if(cost<h)  return {label:"보류",     color:C.warn, bg:"#FFF8EC", icon:"🟡", cost:Math.round(cost)};
  return             {label:"컷",       color:C.bad,  bg:"#FEF0F0", icon:"🔴", cost:Math.round(cost)};
}
function lpvRateStatus(clicks, lpv, c={}){
  if(!clicks||!lpv) return null;
  const rate = (lpv/clicks)*100;
  const g=c.lpvRateGood||70, ok=c.lpvRateOk||50;
  if(rate>=g)  return {label:"정상",    color:C.good, bg:"#EDF7F1", icon:"✅", rate:rate.toFixed(1)};
  if(rate>=ok) return {label:"보통",    color:C.warn, bg:"#FFF8EC", icon:"⚠️", rate:rate.toFixed(1)};
  return             {label:"랜딩문제", color:C.bad,  bg:"#FEF0F0", icon:"🚨", rate:rate.toFixed(1)};
}
function cpaStatus(spend, purchases, margin, c={}){
  if(!purchases||!spend||!margin) return null;
  const cpa = spend/purchases;
  const ratio = (cpa/margin)*100;
  const g=c.cpaGood||85, h=c.cpaHold||100;
  if(ratio<=g)  return {label:"유지", color:C.good, bg:"#EDF7F1", icon:"✅", cpa:Math.round(cpa)};
  if(ratio<=h)  return {label:"보류", color:C.warn, bg:"#FFF8EC", icon:"⚠️", cpa:Math.round(cpa)};
  return              {label:"컷",   color:C.bad,  bg:"#FEF0F0", icon:"🔴", cpa:Math.round(cpa)};
}
function ctrStatus(clicks, impressions, c={}){
  if(!impressions||!clicks) return null;
  const ctr = (clicks/impressions)*100;
  const g=c.ctrGood||2, ok=c.ctrOk||1;
  if(ctr>=g)  return {label:"좋음",    color:C.good, bg:"#EDF7F1", icon:"🟢", ctr:ctr.toFixed(2)};
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
  return lines.slice(startIdx+1).filter(l=>l.trim()).map(row=>{
    const cols = parseLine(row);
    const obj={};
    headers.forEach((h,i)=>{ if(h) obj[h]=cols[i]||""; });
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
  // 목표 메모 (Supabase 팀 공유)
  const [metaGoal, setMetaGoal]         = useSyncState("oa_meta_goal_v7", "");
  const [metaGoalEditing, setMetaGoalEditing] = useState(false);
  const [metaGoalInput, setMetaGoalInput]     = useState("");

  // ── 시트 URL — Supabase 저장 (팀 공유, 변경 가능) ──
  // ── 시트 URL 코드 고정 (Supabase 저장 안 함 — 시트 내용만 fetch)
  const invUrl    = "https://docs.google.com/spreadsheets/d/1r9WhAOgvdIcumgrkNkTbyYSVj1ONxyXp0trwzD-xAng/edit?gid=960641453#gid=960641453";
  const infUrl    = "https://docs.google.com/spreadsheets/d/1r9WhAOgvdIcumgrkNkTbyYSVj1ONxyXp0trwzD-xAng/edit?gid=503054532#gid=503054532";
  const sheetUrl  = "https://docs.google.com/spreadsheets/d/1r9WhAOgvdIcumgrkNkTbyYSVj1ONxyXp0trwzD-xAng/edit?gid=1293104038#gid=1293104038";
  const setInvUrl = ()=>{}, setInfUrl = ()=>{}, setSheetUrl = ()=>{};
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
  const [schedView, setSchedView] = useState("list");
  const [calMonth, setCalMonth]   = useState(new Date().toISOString().slice(0,7));

  // ── 업무관리 (Task V1) ─────────────────────────────
  const [tasks, setTasks]           = useSyncState("oa_tasks_v1", []);
  const [taskModal, setTaskModal]   = useState(false);
  const [taskEdit, setTaskEdit]     = useState(null); // null = 신규, obj = 수정
  const [taskFilter, setTaskFilter] = useState("all"); // all | mine | review
  const MEMBERS_LIST = ["소리","영서","경은","지수"];
  const TASK_TYPES   = ["콘텐츠 업로드","메타광고 제작","행사 제안","기획","기타"];
  const TASK_STATUS  = [
    {id:"todo",         label:"할 일",      color:"#94a3b8"},
    {id:"in_progress",  label:"진행 중",    color:"#60a5fa"},
    {id:"review_needed",label:"검토 요청",  color:"#f59e0b"},
    {id:"approved",     label:"승인",       color:"#34d399"},
    {id:"done",         label:"완료",       color:"#6ee7b7"},
    {id:"hold",         label:"보류",       color:"#f87171"},
  ];
  const PRIORITY = [{id:"high",label:"긴급",color:"#ef4444"},{id:"mid",label:"보통",color:"#f59e0b"},{id:"low",label:"낮음",color:"#94a3b8"}];
  const MEMBER_COLORS_TASK = {"소리":"#f472b6","영서":"#60a5fa","경은":"#34d399","지수":"#a78bfa"};

  function newTask() {
    return {
      id: Date.now(),
      title: "",
      type: "기타",
      assignee: "",
      priority: "mid",
      status: "todo",
      dueDate: "",
      primaryLink: {label:"", url:""},
      secondaryLinks: [],
      checklist: [],
      createdAt: new Date().toISOString(),
      lastReviewedAt: null,
    };
  }

  function saveTask(t) {
    if(!t.title.trim()) return;
    setTasks(prev=>{
      const arr = Array.isArray(prev)?prev:[];
      const idx = arr.findIndex(x=>x.id===t.id);
      return idx>=0 ? arr.map(x=>x.id===t.id?t:x) : [...arr,t];
    });
    setTaskModal(false); setTaskEdit(null);
  }

  function deleteTask(id) {
    setTasks(prev=>(Array.isArray(prev)?prev:[]).filter(x=>x.id!==id));
  }

  function updateTaskStatus(id, status) {
    setTasks(prev=>(Array.isArray(prev)?prev:[]).map(x=>x.id===id?{...x,status}:x));
  }

  function markReviewed(id) {
    setTasks(prev=>(Array.isArray(prev)?prev:[]).map(x=>x.id===id?{...x,lastReviewedAt:new Date().toISOString()}:x));
  }

  // 노션 스케줄
  const [notionItems, setNotionItems]     = useState([]);
  const [notionLoading, setNotionLoading] = useState(false);
  const [notionError, setNotionError]     = useState("");
  const [notionTab, setNotionTab]         = useState("todo"); // "todo" | "done"
  const [notionAddModal, setNotionAddModal] = useState(false);
  const [notionForm, setNotionForm]       = useState({name:"",date:"",product:"",select:""});

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

  // ── 노션 스케줄 함수 ─────────────────────────────
  async function fetchNotion() {
    setNotionLoading(true); setNotionError("");
    try {
      const res = await fetch("/api/notion");
      const data = await res.json();
      if(data.error) throw new Error(data.error);
      setNotionItems(data.items||[]);
    } catch(e) { setNotionError(e.message); }
    setNotionLoading(false);
  }
  async function toggleNotionDone(id, done) {
    setNotionItems(prev=>prev.map(x=>x.id===id?{...x,done}:x));
    await fetch("/api/notion",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"toggle",pageId:id,done})});
  }
  async function createNotionItem() {
    if(!notionForm.name) return;
    const res = await fetch("/api/notion",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"create",data:notionForm})});
    const data = await res.json();
    if(data.ok){ setNotionAddModal(false); setNotionForm({name:"",date:"",product:"",select:""}); fetchNotion(); }
  }
  async function deleteNotionItem(id) {
    setNotionItems(prev=>prev.filter(x=>x.id!==id));
    await fetch("/api/notion",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"delete",pageId:id})});
  }

  useEffect(()=>{ fetchNotion(); },[]);

  useEffect(() => {
    getAdImages().then(imgs => { if (imgs?.length) setAdImages(imgs); }).catch(() => {});
  }, []);

  // ── 데이터 에이전트 컨텍스트 빌더 ────────────────
  function buildAgentContext() {
    const fmtW = n=>n>=10000?`₩${Math.round(n/10000).toLocaleString()}만`:`₩${Math.round(n).toLocaleString()}`;
    const lines = [];
    const dates = metaRaw.map(r=>r.date).filter(Boolean).sort();
    const period = dates.length?`${dates[0].slice(5)} ~ ${dates[dates.length-1].slice(5)}`:"기간 없음";

    // 전체 요약 (핵심만)
    const totalSpend = metaFiltered.reduce((s,r)=>s+(r.spend||0),0);
    const totalPurch = metaFiltered.reduce((s,r)=>s+(r.purchases||0),0);
    const totalConvV = metaFiltered.reduce((s,r)=>s+(r.convValue||0),0);
    const totalClicks= metaFiltered.reduce((s,r)=>s+(r.clicks||0),0);
    const totalLpv   = metaFiltered.reduce((s,r)=>s+(r.lpv||0),0);
    lines.push(`[메타광고 ${period}] 광고비:${fmtW(totalSpend)} 구매:${totalPurch}건 ROAS:${totalSpend>0?Math.round(totalConvV/totalSpend*100):"—"}% CPA:${totalPurch>0?fmtW(totalSpend/totalPurch):"—"} CPC:${totalClicks>0?`₩${Math.round(totalSpend/totalClicks)}`:"—"} LPV율:${totalClicks>0?Math.round(totalLpv/totalClicks*100):"—"}%`);

    // 광고별 성과 — 상위 10개만
    const byAd = {};
    metaFiltered.forEach(r=>{
      const key=(r.adName||r.campaign||"?");
      if(!byAd[key]) byAd[key]={name:key,spend:0,purch:0,convV:0,clicks:0,lpv:0};
      byAd[key].spend+=r.spend||0; byAd[key].purch+=r.purchases||0;
      byAd[key].convV+=r.convValue||0; byAd[key].clicks+=r.clicks||0; byAd[key].lpv+=r.lpv||0;
    });
    const ads = Object.values(byAd).sort((a,b)=>b.spend-a.spend).slice(0,10);
    lines.push(`[광고별 상위10] 광고명|광고비|구매|ROAS|CPA|LPV율`);
    ads.forEach(a=>{
      const roas=a.spend>0?Math.round(a.convV/a.spend*100)+"%":"—";
      const cpa=a.purch>0?fmtW(a.spend/a.purch):"—";
      const lpvR=a.clicks>0?Math.round(a.lpv/a.clicks*100)+"%":"—";
      lines.push(`${a.name}|${fmtW(a.spend)}|${a.purch}건|${roas}|${cpa}|${lpvR}`);
    });

    // 날짜별 추이 — 최근 7일만
    const byDate = {};
    metaFiltered.forEach(r=>{
      if(!r.date) return;
      if(!byDate[r.date]) byDate[r.date]={spend:0,purch:0,clicks:0};
      byDate[r.date].spend+=r.spend||0; byDate[r.date].purch+=r.purchases||0; byDate[r.date].clicks+=r.clicks||0;
    });
    const recentDates = Object.entries(byDate).sort((a,b)=>a[0].localeCompare(b[0])).slice(-7);
    lines.push(`[최근7일] 날짜|광고비|구매`);
    recentDates.forEach(([d,v])=>lines.push(`${d.slice(5)}|${fmtW(v.spend)}|${v.purch}건`));

    // 재고 (소진 임박만)
    const urgentInv = inv.filter(i=>{
      const days = Math.round((i.stock-i.reserved)/Math.max(i.sold30/30,0.01));
      return days < 30;
    });
    if(urgentInv.length>0){
      lines.push(`[재고주의] ${urgentInv.map(i=>`${i.name}:${Math.round((i.stock-i.reserved)/Math.max(i.sold30/30,0.01))}일`).join(", ")}`);
    }

    // 월별 비교 (라벨+핵심 지표만)
    if(Array.isArray(monthlyFiles)&&monthlyFiles.length>0){
      lines.push(`[월별비교] 월|광고비|구매|ROAS|매출|광고비율`);
      monthlyFiles.forEach(f=>{
        const r=(f.rows||[]).filter(x=>!((x.campaign||x.adName||"").includes("Instagram 게시물")));
        const sp=r.reduce((s,x)=>s+(x.spend||0),0);
        const pu=r.reduce((s,x)=>s+(x.purchases||0),0);
        const cv=r.reduce((s,x)=>s+(x.convValue||0),0);
        const roas=sp>0?Math.round(cv/sp*100)+"%":"—";
        const rev=f.revenue>0?fmtW(f.revenue):"—";
        const ratio=f.revenue>0?Math.round(sp/f.revenue*100)+"%":"—";
        lines.push(`${f.label}|${fmtW(sp)}|${pu}건|${roas}|${rev}|${ratio}`);
      });
    }

    // 채널별 광고비 (입력된 것만)
    if(Array.isArray(channelSpends)){
      const filled = channelSpends.filter(ch=>Object.values(ch.amounts||{}).some(v=>v>0));
      if(filled.length>0){
        const months = Array.isArray(monthlyFiles)?monthlyFiles.map(f=>f.label):[];
        if(months.length>0){
          lines.push(`[채널광고비] ${months.slice(-2).map(m=>{
            const meta=(monthlyFiles.find(f=>f.label===m)?.rows||[]).filter(r=>!((r.campaign||r.adName||"").includes("Instagram 게시물"))).reduce((s,r)=>s+(r.spend||0),0);
            const ch=filled.reduce((s,c)=>s+(+(c.amounts?.[m]||0)),0);
            return `${m}:메타${fmtW(meta)}+기타${fmtW(ch)}=합계${fmtW(meta+ch)}`;
          }).join(" / ")}`);
        }
      }
    }

    return lines.join("\n");
  }

    // 월별 성과 비교
    if(Array.isArray(monthlyFiles) && monthlyFiles.length>0){
      lines.push("");
      lines.push("## 월별 성과 비교 (메타광고)");
      lines.push("월 | 메타광고비 | 전환광고비 | 트래픽광고비 | 구매 | ROAS | CPA | CPC | LPV율 | 매출 | 광고비율");
      monthlyFiles.forEach(f=>{
        const r = (f.rows||[]).filter(x=>!((x.campaign||x.adName||"").includes("Instagram 게시물")));
        const spend  = r.reduce((s,x)=>s+(x.spend||0),0);
        const conv   = r.filter(x=>isConversionCampaign(x.objective,x.campaign)).reduce((s,x)=>s+(x.spend||0),0);
        const traff  = r.filter(x=>!isConversionCampaign(x.objective,x.campaign)).reduce((s,x)=>s+(x.spend||0),0);
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
  // 인스타그램 게시물 광고 = 캠페인명에 "Instagram 게시물" 포함
  const isInstaPost = r => (r.campaign||r.adName||"").includes("Instagram 게시물");
  const metaFiltered = metaRaw.filter(r => !deletedAds.includes(r.adName||r.campaign||"") && !isInstaPost(r));
  const instaRaw     = metaRaw.filter(r => isInstaPost(r)); // 인스타 게시물 따로

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
    const s=adScore(ad, adMargin, getConvCriteria(ad.name, ad.campaign, convCriteria)); return s.issues.some(i=>i.label==="컷"||i.label==="랜딩문제"||i.label==="소재문제");
  });
  const holdAds = Object.values(adAlerts).filter(ad=>{
    const adMargin = getAdMargin(ad.name, ad.campaign, margins, margin);
    const s=adScore(ad, adMargin, getConvCriteria(ad.name, ad.campaign, convCriteria)); return !cutAds.includes(ad)&&s.issues.some(i=>i.label==="보류"||i.label==="보통");
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
    {id:"tasks",     icon:"✅",label:"업무관리"},
    {id:"meta",      icon:"📣",label:"메타광고"},
    {id:"adspend",   icon:"💰",label:"총광고비"},
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

      {/* 월별 성과 비교 → 총광고비 탭으로 이동 */}

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


        {/* ── 카드1: 집행중 광고 성과 (시트 기준) ── */}
        {hasSheet&&(()=>{
          const fmtW = n=>n>=10000?`₩${Math.round(n/10000).toLocaleString()}만`:`₩${Math.round(n).toLocaleString()}`;
          const sheetMaxDate = metaRaw.map(r=>r.date).filter(Boolean).sort().pop()||"";

          // 집행중 광고만 필터 (최신 날짜 기준 spend>0)
          const adLastSpend={};
          metaFiltered.forEach(r=>{
            const key=(r.adName||r.campaign||"")+"|||"+(r.adset||"");
            if((r.spend||0)>0&&r.date&&(!adLastSpend[key]||r.date>adLastSpend[key])) adLastSpend[key]=r.date;
          });
          const activeKeys=new Set(Object.entries(adLastSpend)
            .filter(([,d])=>sheetMaxDate&&Math.floor((new Date(sheetMaxDate)-new Date(d))/86400000)<=1)
            .map(([k])=>k));
          const activeRows = metaFiltered.filter(r=>{
            const key=(r.adName||r.campaign||"")+"|||"+(r.adset||"");
            return activeKeys.has(key);
          });

          const agg = rows=>({
            spend:  rows.reduce((s,r)=>s+(r.spend||0),0),
            purch:  rows.reduce((s,r)=>s+(r.purchases||0),0),
            convV:  rows.reduce((s,r)=>s+(r.convValue||0),0),
            clicks: rows.reduce((s,r)=>s+(r.clicks||0),0),
            lpv:    rows.reduce((s,r)=>s+(r.lpv||0),0),
            ads:    [...new Set(rows.map(r=>(r.adName||r.campaign||"")+"|||"+(r.adset||"")).filter(Boolean))].length,
          });

          const conv    = agg(activeRows.filter(r=>isConversionCampaign(r.objective,r.campaign)));
          const traffic = agg(activeRows.filter(r=>!isConversionCampaign(r.objective,r.campaign)));
          const total   = agg(activeRows);

          const dates = metaRaw.map(r=>r.date).filter(Boolean).sort();
          const period = dates.length?`${dates[0].slice(5).replace("-","/")} ~ ${dates[dates.length-1].slice(5).replace("-","/")}`:""

          const Col=({label,icon,data,accent})=>{
            const cpa  = (s,p)=>p>0?fmtW(s/p):"—";
            const roas = (v,s)=>s>0?`${Math.round((v/s)*100)}%`:"—";
            const lpvR = (l,c)=>c>0?`${Math.round((l/c)*100)}%`:"—";
            const cpc  = (s,c)=>c>0?`₩${Math.round(s/c).toLocaleString()}`:"—";
            return(
            <div style={{background:"rgba(255,255,255,0.07)",borderRadius:12,padding:"14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:10}}>
                <span>{icon}</span>
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
                  <div style={{fontSize:12,fontWeight:800,letterSpacing:"0.05em"}}>📊 집행중 광고 성과</div>
                  <div style={{fontSize:10,opacity:0.5,marginTop:2}}>{period} · 집행중 {activeKeys.size}개</div>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
                  {instaRaw.length>0&&(
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:9,opacity:0.4}}>📸 인스타 게시물</div>
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
                <Col label="전환" icon="🎯" data={conv} accent="#f9a8d4"/>
                <Col label="트래픽" icon="🚦" data={traffic} accent="#93c5fd"/>
                <Col label="합산" icon="📊" data={total} accent="#86efac"/>
              </div>
            </div>
          );
        })()}

        {/* ── 카드2: 전체 광고비 (파일 업로드) ── */}
        {hasSheet&&(()=>{
          const fmtW = n=>n>=10000?`₩${Math.round(n/10000).toLocaleString()}만`:`₩${Math.round(n).toLocaleString()}`;
          const hasFile = allAdStatus==="ok" && allAdRaw.length>0;
          const isInsta = r=>(r.campaign||r.adName||"").includes("Instagram 게시물");
          const fileRows = allAdRaw.filter(r=>!isInsta(r));
          const fileConv    = fileRows.filter(r=>isConversionCampaign(r.objective,r.campaign));
          const fileTraffic = fileRows.filter(r=>!isConversionCampaign(r.objective,r.campaign));
          const spend = arr=>arr.reduce((s,r)=>s+(r.spend||0),0);
          const purch = arr=>arr.reduce((s,r)=>s+(r.purchases||0),0);
          const convV = arr=>arr.reduce((s,r)=>s+(r.convValue||0),0);
          const ads   = arr=>[...new Set(arr.map(r=>(r.adName||r.campaign||"")+"|||"+(r.adset||"")).filter(Boolean))].length;

          return(
            <div style={{background:"#1e1e2e",borderRadius:14,padding:"16px 18px",color:C.white,
              border:"1px solid rgba(255,255,255,0.08)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:8,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:800,letterSpacing:"0.05em"}}>💰 전체 광고비</div>
                  <div style={{fontSize:10,opacity:0.4,marginTop:2}}>미게재 포함 · 파일 업로드</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {hasFile&&<div style={{textAlign:"right"}}>
                    <div style={{fontSize:9,opacity:0.5}}>총 광고비</div>
                    <div style={{fontSize:20,fontWeight:900,color:"#fbbf24"}}>{fmtW(spend(fileRows))}</div>
                  </div>}
                  <div>
                    <input ref={allAdFileRef} type="file" accept=".xlsx,.csv" style={{display:"none"}}
                      onChange={e=>e.target.files[0]&&handleAllAdFile(e.target.files[0])}/>
                    <button onClick={()=>allAdFileRef.current?.click()}
                      style={{fontSize:10,fontWeight:700,padding:"6px 14px",borderRadius:8,
                        background:hasFile?"rgba(251,191,36,0.15)":"rgba(255,255,255,0.08)",
                        color:hasFile?"#fbbf24":"rgba(255,255,255,0.5)",
                        border:`1px solid ${hasFile?"rgba(251,191,36,0.3)":"rgba(255,255,255,0.12)"}`,
                        cursor:"pointer",fontFamily:"inherit"}}>
                      {allAdStatus==="loading"?"⏳":hasFile?"🔄 파일 변경":"📂 파일 업로드"}
                    </button>
                  </div>
                </div>
              </div>
              {hasFile?(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  {[
                    {label:"전환",icon:"🎯",rows:fileConv,accent:"#f9a8d4"},
                    {label:"트래픽",icon:"🚦",rows:fileTraffic,accent:"#93c5fd"},
                    {label:"합산",icon:"📊",rows:fileRows,accent:"#fbbf24"},
                  ].map(({label,icon,rows,accent})=>(
                    <div key={label} style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"12px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}>
                        <span>{icon}</span>
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
              ):(
                <div style={{textAlign:"center",padding:"20px 0",opacity:0.3,fontSize:11}}>
                  파일 업로드하면 전체 광고비가 표시돼요
                </div>
              )}
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

              {/* ── 상위 광고 소재 카드 ── */}
              {(()=>{
                const camps = campTab==="conversion" ? d.convCamps : d.trafficCamps;
                const fmtW = n=>n>=10000?`₩${Math.round(n/10000).toLocaleString()}만`:`₩${Math.round(n).toLocaleString()}`;
                const sheetMaxDate = metaRaw.map(r=>r.date).filter(Boolean).sort().pop()||"";

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
                                : <span style={{fontSize:28,opacity:0.2}}>🖼</span>
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
                        {t.id==='default'?'🔧 기본값':`📦 ${t.label}`}
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
                        🗑 삭제
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
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 💰 총광고비
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const AdSpendSection=(()=>{
    const fmtW = n=>n>=10000?`₩${Math.round(n/10000).toLocaleString()}만`:`₩${Math.round(n).toLocaleString()}`;
    const pct  = (a,b)=>b>0?+(a/b*100).toFixed(1):0;
    const diff = (cur,prev)=>prev>0?+((cur-prev)/prev*100).toFixed(1):null;
    const isInsta = r=>(r.campaign||r.adName||"").includes("Instagram 게시물");

    // 월별 메타 집계
    const calcMetaMonth = rows=>{
      const r = rows.filter(x=>!isInsta(x));
      const conv    = r.filter(x=>isConversionCampaign(x.objective,x.campaign));
      const traffic = r.filter(x=>!isConversionCampaign(x.objective,x.campaign));
      const agg = arr=>arr.reduce((s,x)=>s+(x.spend||0),0);
      return {
        total:   agg(r),
        conv:    agg(conv),
        traffic: agg(traffic),
        purch:   r.reduce((s,x)=>s+(x.purchases||0),0),
        convV:   r.reduce((s,x)=>s+(x.convValue||0),0),
        clicks:  r.reduce((s,x)=>s+(x.clicks||0),0),
        lpv:     r.reduce((s,x)=>s+(x.lpv||0),0),
      };
    };

    const months = monthlyFiles.map(f=>({label:f.label, meta:calcMetaMonth(f.rows), rows:f.rows}));

    const METRICS = [
      {key:"total",    label:"메타 총 광고비", fmt:fmtW,                                    good:"none"},
      {key:"conv",     label:"└ 전환",          fmt:fmtW,                                    good:"none"},
      {key:"traffic",  label:"└ 트래픽",        fmt:fmtW,                                    good:"none"},
      {key:"purch",    label:"구매",            fmt:v=>`${v}건`,                             good:"high"},
      {key:"roas",     label:"ROAS",            fmt:v=>`${v}%`,                              good:"high"},
      {key:"cpa",      label:"CPA",             fmt:fmtW,                                    good:"low"},
      {key:"cpc",      label:"CPC",             fmt:v=>`₩${Math.round(v).toLocaleString()}`, good:"low"},
      {key:"lpvRate",  label:"LPV율",           fmt:v=>`${v}%`,                              good:"high"},
    ];

    const getVal = (m, key)=>{
      const meta = m.meta;
      if(key==="total")   return meta.total;
      if(key==="conv")    return meta.conv;
      if(key==="traffic") return meta.traffic;
      if(key==="purch")   return meta.purch;
      if(key==="roas")    return pct(meta.convV, meta.total);
      if(key==="cpa")     return meta.purch>0?meta.total/meta.purch:0;
      if(key==="cpc")     return meta.clicks>0?meta.total/meta.clicks:0;
      if(key==="lpvRate") return pct(meta.lpv, meta.clicks);
      return 0;
    };

    return(
      <div style={{display:"flex",flexDirection:"column",gap:16}}>

        {/* ── 채널별 광고비 현황 ── */}
        {(()=>{
          const months = monthlyFiles.map(f=>f.label);
          const isInsta = r=>(r.campaign||r.adName||"").includes("Instagram 게시물");

          // 메타 광고비 — allAdRaw 파일 기준 (월별 파일 있으면 그것도 포함)
          const metaByMonth = {};
          // 1) allAdRaw 파일에서 날짜 기반 월 추출
          if(allAdRaw.length>0){
            allAdRaw.filter(r=>!isInsta(r)).forEach(r=>{
              if(!r.date) return;
              const m = r.date.slice(0,7); // "2026-03" 형식
              if(!metaByMonth[m]) metaByMonth[m]=0;
              metaByMonth[m]+=(r.spend||0);
            });
          }
          // 2) 월별 비교 파일에서도 읽기 (라벨 매칭)
          monthlyFiles.forEach(f=>{
            const spend = (f.rows||[]).filter(r=>!isInsta(r)).reduce((s,r)=>s+(r.spend||0),0);
            if(spend>0) metaByMonth[f.label] = spend;
          });

          // 표시할 월 목록 — 월별 파일 라벨 + allAdRaw 월 합집합
          const allAdMonths = [...new Set(Object.keys(metaByMonth))].sort();
          const displayMonths = months.length>0 ? months : allAdMonths;

          // allAdRaw 전체 합산 (파일 업로드 기준)
          const metaTotalFromFile = allAdRaw.filter(r=>!isInsta(r)).reduce((s,r)=>s+(r.spend||0),0);

          // 월별 채널 합산
          const totalByMonth = {};
          displayMonths.forEach(m=>{
            let t = metaByMonth[m]||0;
            channelSpends.forEach(ch=>{ t += +(ch.amounts?.[m]||0); });
            totalByMonth[m] = t;
          });

          return(
            <div style={{background:C.ink,borderRadius:14,padding:"16px 18px",color:C.white}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div>
                  <div style={{fontSize:13,fontWeight:800}}>💰 채널별 광고비</div>
                  <div style={{fontSize:10,opacity:0.5,marginTop:2}}>
                    메타: 전체파일 기준 · 기타채널: 직접입력 · Supabase 팀 공유
                  </div>
                </div>
                {metaTotalFromFile>0&&(
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:9,opacity:0.4}}>메타 파일 총합</div>
                    <div style={{fontSize:16,fontWeight:900,color:"#f9a8d4"}}>{fmtW(metaTotalFromFile)}</div>
                  </div>
                )}
              </div>

              {displayMonths.length===0?(
                <div style={{textAlign:"center",padding:"16px 0",opacity:0.3,fontSize:11}}>
                  메타 전체파일을 업로드하거나 아래 월별 비교에 파일을 추가해요
                </div>
              ):(
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead>
                      <tr>
                        <th style={{padding:"8px 10px",textAlign:"left",opacity:0.5,fontWeight:700,fontSize:10}}>채널</th>
                        {displayMonths.map(m=>(
                          <th key={m} style={{padding:"8px 10px",textAlign:"right",fontWeight:800,color:"rgba(255,255,255,0.9)"}}>{m}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* 메타 — 파일 기준 */}
                      <tr style={{borderTop:"1px solid rgba(255,255,255,0.08)"}}>
                        <td style={{padding:"8px 10px",fontWeight:700}}>
                          <span style={{marginRight:6}}>📣</span>메타광고
                          <span style={{fontSize:9,opacity:0.4,marginLeft:4}}>(파일)</span>
                        </td>
                        {displayMonths.map(m=>(
                          <td key={m} style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:"#f9a8d4"}}>
                            {(metaByMonth[m]||0)>0?fmtW(metaByMonth[m]):"—"}
                          </td>
                        ))}
                      </tr>
                      {/* 다른 채널들 */}
                      {channelSpends.map((ch,ci)=>(
                        <tr key={ch.id} style={{borderTop:"1px solid rgba(255,255,255,0.08)"}}>
                          <td style={{padding:"8px 10px",fontWeight:700}}>
                            <span style={{marginRight:6}}>{ch.icon}</span>{ch.name}
                          </td>
                          {displayMonths.map(m=>(
                            <td key={m} style={{padding:"4px 6px",textAlign:"right"}}>
                              <input
                                type="number"
                                value={ch.amounts?.[m]||""}
                                onChange={e=>{
                                  const next = channelSpends.map((x,j)=>j===ci
                                    ?{...x,amounts:{...(x.amounts||{}),[m]:+e.target.value||0}}
                                    :x);
                                  setChannelSpends(next);
                                }}
                                placeholder="0"
                                style={{width:90,padding:"4px 6px",borderRadius:6,border:"1px solid rgba(255,255,255,0.15)",
                                  background:"rgba(255,255,255,0.07)",color:ch.color,
                                  fontSize:11,fontWeight:700,fontFamily:"inherit",outline:"none",textAlign:"right"}}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                      {/* 합계 */}
                      <tr style={{borderTop:"2px solid rgba(255,255,255,0.2)"}}>
                        <td style={{padding:"10px 10px",fontWeight:800,fontSize:12}}>합계</td>
                        {displayMonths.map(m=>(
                          <td key={m} style={{padding:"10px 10px",textAlign:"right",fontWeight:900,fontSize:14,color:"#fbbf24"}}>
                            {totalByMonth[m]>0?fmtW(totalByMonth[m]):"—"}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── 매출 입력 ── */}
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px"}}>
          <div style={{fontSize:13,fontWeight:800,color:C.ink,marginBottom:4}}>📈 매출 현황</div>
          <div style={{fontSize:10,color:C.inkLt,marginBottom:12}}>월별 매출을 입력하면 광고비 대비 효율을 계산해요</div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
            {monthlyFiles.map((f,i)=>(
              <div key={i} style={{background:C.cream,borderRadius:10,padding:"12px",minWidth:140}}>
                <div style={{fontSize:11,fontWeight:700,color:C.ink,marginBottom:8}}>{f.label}</div>
                <div style={{fontSize:10,color:C.inkLt,marginBottom:4}}>매출 (원)</div>
                <input
                  type="number"
                  value={f.revenue||""}
                  onChange={e=>{
                    const next = monthlyFiles.map((x,j)=>j===i?{...x,revenue:+e.target.value}:x);
                    setMonthlyFiles(next);
                  }}
                  placeholder="예: 50000000"
                  style={{width:"100%",padding:"6px 8px",border:`1px solid ${C.border}`,borderRadius:8,
                    fontSize:11,fontFamily:"inherit",outline:"none"}}
                />
                {f.revenue>0&&f.meta&&(
                  <div style={{fontSize:10,color:C.good,fontWeight:700,marginTop:6}}>
                    광고비율 {pct(calcMetaMonth(f.rows).total, f.revenue).toFixed(1)}%
                  </div>
                )}
              </div>
            ))}
            {monthlyFiles.length===0&&(
              <div style={{fontSize:11,color:C.inkLt}}>아래 월별 비교에서 파일을 먼저 추가해주세요</div>
            )}
          </div>
        </div>

        {/* ── 월별 성과 비교 ── */}
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div>
              <div style={{fontSize:13,fontWeight:800,color:C.ink}}>📅 월별 성과 비교</div>
              <div style={{fontSize:10,color:C.inkLt,marginTop:2}}>파일 업로드하면 월별로 자동 집계·비교해요</div>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
              {monthlyFiles.map((f,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:4,
                  background:C.cream,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,color:C.ink}}>
                  {f.label}
                  <button onClick={()=>setMonthlyFiles(monthlyFiles.filter((_,j)=>j!==i))}
                    style={{background:"none",border:"none",cursor:"pointer",color:C.inkLt,fontSize:11,padding:0,lineHeight:1}}>✕</button>
                </div>
              ))}
              <input ref={monthlyFileRef} type="file" accept=".xlsx,.csv" style={{display:"none"}}
                onChange={e=>e.target.files[0]&&handleMonthlyFile(e.target.files[0])}/>
              <button onClick={()=>monthlyFileRef.current?.click()}
                style={{fontSize:11,fontWeight:700,padding:"5px 14px",borderRadius:8,
                  border:`1px solid ${C.rose}`,background:C.blush,color:C.rose,
                  cursor:"pointer",fontFamily:"inherit"}}>
                + 월 추가
              </button>
            </div>
          </div>

          {months.length===0?(
            <div style={{textAlign:"center",padding:"24px 0",color:C.inkLt,fontSize:11}}>
              파일을 추가하면 월별 성과가 여기 표시돼요
            </div>
          ):(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:400}}>
                <thead>
                  <tr style={{borderBottom:`2px solid ${C.border}`}}>
                    <th style={{padding:"8px 10px",textAlign:"left",color:C.inkLt,fontWeight:700,fontSize:10}}>지표</th>
                    {months.map((m,i)=>(
                      <th key={i} style={{padding:"8px 10px",textAlign:"right",color:C.ink,fontWeight:800}}>{m.label}</th>
                    ))}
                    {months.length>=2&&<th style={{padding:"8px 10px",textAlign:"right",color:C.inkLt,fontWeight:700,fontSize:10}}>전월 대비</th>}
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map(({key,label,fmt,good})=>{
                    const vals = months.map(m=>getVal(m,key));
                    const last = vals[vals.length-1];
                    const prev = vals.length>=2?vals[vals.length-2]:null;
                    const d = prev!==null&&prev>0?diff(last,prev):null;
                    const isGood = d===null?null:good==="high"?d>0:good==="low"?d<0:null;
                    const isSub = label.startsWith("└");
                    return(
                      <tr key={key} style={{borderBottom:`1px solid ${C.border}`}}>
                        <td style={{padding:"8px 10px",color:isSub?C.inkLt:C.inkMid,fontWeight:isSub?500:600,
                          fontSize:isSub?10:11,paddingLeft:isSub?20:10}}>{label}</td>
                        {vals.map((v,i)=>(
                          <td key={i} style={{padding:"8px 10px",textAlign:"right",
                            fontWeight:isSub?600:700,color:isSub?C.inkMid:C.ink,fontSize:isSub?10:11}}>
                            {v>0?fmt(v):"—"}
                          </td>
                        ))}
                        {months.length>=2&&(
                          <td style={{padding:"8px 10px",textAlign:"right",fontWeight:800,
                            color:isGood===null?C.inkMid:isGood?C.good:C.bad}}>
                            {d===null?"—":`${d>0?"+":""}${d}%`}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {/* 매출 행 */}
                  {months.some(m=>m.revenue>0)&&(
                    <tr style={{borderBottom:`1px solid ${C.border}`,background:C.cream}}>
                      <td style={{padding:"8px 10px",color:C.inkMid,fontWeight:600}}>매출</td>
                      {months.map((m,i)=>(
                        <td key={i} style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:C.ink}}>
                          {m.revenue>0?fmtW(m.revenue):"—"}
                        </td>
                      ))}
                      {months.length>=2&&<td style={{padding:"8px 10px"}}/>}
                    </tr>
                  )}
                  {months.some(m=>m.revenue>0)&&(
                    <tr style={{borderBottom:`1px solid ${C.border}`,background:C.cream}}>
                      <td style={{padding:"8px 10px",color:C.inkMid,fontWeight:600}}>광고비율</td>
                      {months.map((m,i)=>(
                        <td key={i} style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:C.rose}}>
                          {m.revenue>0?`${pct(getVal(m,"total"),m.revenue).toFixed(1)}%`:"—"}
                        </td>
                      ))}
                      {months.length>=2&&<td style={{padding:"8px 10px"}}/>}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    );
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ✅ 업무관리
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const TaskSection=(()=>{
    const taskList = Array.isArray(tasks)?tasks:[];
    const now = new Date();

    // 미확인 일수 계산
    const daysSince = (dateStr) => {
      if(!dateStr) return 999;
      return Math.floor((now - new Date(dateStr)) / 86400000);
    };

    // 내 확인 필요 (review_needed + 미확인 1일 이상)
    const needReview = taskList.filter(t=>
      t.status==="review_needed" && daysSince(t.lastReviewedAt)>=1
    ).sort((a,b)=>daysSince(b.lastReviewedAt)-daysSince(a.lastReviewedAt));

    const filtered = taskList.filter(t=>{
      if(taskFilter==="review") return t.status==="review_needed";
      if(taskFilter==="todo") return ["todo","in_progress"].includes(t.status);
      if(taskFilter==="done") return ["done","approved"].includes(t.status);
      return true;
    });

    const statusObj = Object.fromEntries(TASK_STATUS.map(s=>[s.id,s]));
    const priorityObj = Object.fromEntries(PRIORITY.map(p=>[p.id,p]));

    const checklistDone = (t) => {
      if(!t.checklist?.length) return {done:0,total:0,pct:100};
      const done = t.checklist.filter(c=>c.done).length;
      return {done, total:t.checklist.length, pct:Math.round(done/t.checklist.length*100)};
    };

    return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* ── 내 확인 필요 ── */}
      {needReview.length>0&&(
        <div style={{background:`linear-gradient(135deg,${C.rose},#f97316)`,borderRadius:14,padding:"14px 16px",color:C.white}}>
          <div style={{fontSize:12,fontWeight:800,marginBottom:10}}>
            🚨 확인 필요 {needReview.length}건
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {needReview.map(t=>{
              const days = daysSince(t.lastReviewedAt);
              const cl = checklistDone(t);
              return(
                <div key={t.id} style={{background:"rgba(255,255,255,0.15)",borderRadius:10,padding:"10px 12px",
                  border:days>=3?"2px solid rgba(255,255,255,0.5)":"none"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                        {days>=3&&<span style={{fontSize:9,background:"rgba(255,255,255,0.3)",padding:"2px 6px",borderRadius:20,fontWeight:800}}>📌 최상단</span>}
                        {days>=2&&days<3&&<span style={{fontSize:9,background:"rgba(255,255,255,0.2)",padding:"2px 6px",borderRadius:20,fontWeight:700}}>⚠️ {days}일째 미확인</span>}
                        <span style={{fontSize:9,background:MEMBER_COLORS_TASK[t.assignee]||"rgba(255,255,255,0.2)",padding:"2px 8px",borderRadius:20,fontWeight:700}}>{t.assignee||"미지정"}</span>
                        <span style={{fontSize:9,opacity:0.7}}>{t.type}</span>
                      </div>
                      <div style={{fontSize:13,fontWeight:800}}>{t.title}</div>
                      {t.dueDate&&<div style={{fontSize:10,opacity:0.7,marginTop:2}}>마감 {t.dueDate}</div>}
                      {cl.total>0&&<div style={{fontSize:10,opacity:0.8,marginTop:2}}>체크리스트 {cl.done}/{cl.total} ({cl.pct}%)</div>}
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap"}}>
                      {t.primaryLink?.url&&(
                        <a href={t.primaryLink.url} target="_blank" rel="noopener noreferrer"
                          style={{padding:"5px 12px",borderRadius:8,background:"rgba(255,255,255,0.9)",
                            color:C.rose,fontSize:10,fontWeight:800,textDecoration:"none"}}>
                          {t.primaryLink.label||"열기"}
                        </a>
                      )}
                      <button onClick={()=>{ markReviewed(t.id); updateTaskStatus(t.id,"approved"); }}
                        style={{padding:"5px 12px",borderRadius:8,background:"rgba(255,255,255,0.2)",
                          color:C.white,fontSize:10,fontWeight:700,border:"none",cursor:"pointer",fontFamily:"inherit"}}>
                        ✅ 승인
                      </button>
                      <button onClick={()=>{ setTaskEdit(t); setTaskModal(true); markReviewed(t.id); }}
                        style={{padding:"5px 12px",borderRadius:8,background:"rgba(255,255,255,0.1)",
                          color:C.white,fontSize:10,fontWeight:700,border:"none",cursor:"pointer",fontFamily:"inherit"}}>
                        ✏️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 필터 + 추가 ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:4,padding:"4px",background:C.cream,borderRadius:10,flexWrap:"wrap"}}>
          {[{id:"all",label:"전체"},{id:"todo",label:"진행 중"},{id:"review",label:"검토요청"},{id:"done",label:"완료"}].map(f=>(
            <button key={f.id} onClick={()=>setTaskFilter(f.id)}
              style={{padding:"5px 12px",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit",
                background:taskFilter===f.id?C.white:"transparent",color:taskFilter===f.id?C.ink:C.inkMid,
                boxShadow:taskFilter===f.id?"0 1px 4px rgba(0,0,0,0.1)":"none"}}>
              {f.label}
              {f.id==="review"&&taskList.filter(t=>t.status==="review_needed").length>0&&(
                <span style={{marginLeft:4,background:C.rose,color:C.white,borderRadius:10,padding:"0 5px",fontSize:9}}>
                  {taskList.filter(t=>t.status==="review_needed").length}
                </span>
              )}
            </button>
          ))}
        </div>
        <button onClick={()=>{ setTaskEdit(newTask()); setTaskModal(true); }}
          style={{padding:"7px 16px",borderRadius:10,border:"none",background:C.rose,
            color:C.white,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          + 업무 추가
        </button>
      </div>

      {/* ── 태스크 목록 ── */}
      {filtered.length===0?(
        <div style={{textAlign:"center",padding:"40px",color:C.inkLt,fontSize:12}}>
          업무가 없어요 🎉
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(t=>{
            const st = statusObj[t.status]||{label:t.status,color:"#94a3b8"};
            const pr = priorityObj[t.priority]||{label:"",color:"#94a3b8"};
            const cl = checklistDone(t);
            const dueDate = t.dueDate?new Date(t.dueDate):null;
            const daysLeft = dueDate?Math.ceil((dueDate-now)/86400000):null;
            const isOverdue = daysLeft!==null&&daysLeft<0;

            return(
              <div key={t.id} style={{
                background:C.white,border:`1px solid ${t.status==="review_needed"?C.gold+"66":C.border}`,
                borderRadius:12,padding:"12px 14px",
                borderLeft:`3px solid ${st.color}`,
              }}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    {/* 상단 뱃지 행 */}
                    <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:5,flexWrap:"wrap"}}>
                      <span style={{fontSize:9,padding:"2px 7px",borderRadius:20,fontWeight:700,
                        background:st.color+"22",color:st.color,border:`1px solid ${st.color}44`}}>
                        {st.label}
                      </span>
                      <span style={{fontSize:9,padding:"2px 7px",borderRadius:20,fontWeight:700,
                        background:pr.color+"18",color:pr.color}}>
                        {pr.label}
                      </span>
                      {t.assignee&&(
                        <span style={{fontSize:9,padding:"2px 7px",borderRadius:20,fontWeight:700,
                          background:(MEMBER_COLORS_TASK[t.assignee]||"#94a3b8")+"25",
                          color:MEMBER_COLORS_TASK[t.assignee]||"#94a3b8"}}>
                          {t.assignee}
                        </span>
                      )}
                      <span style={{fontSize:9,color:C.inkLt}}>{t.type}</span>
                    </div>

                    {/* 제목 */}
                    <div style={{fontSize:13,fontWeight:800,color:C.ink,marginBottom:4}}>{t.title}</div>

                    {/* 날짜 + 체크리스트 */}
                    <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                      {t.dueDate&&(
                        <span style={{fontSize:10,color:isOverdue?C.bad:daysLeft<=2?C.warn:C.inkLt,fontWeight:600}}>
                          📅 {t.dueDate}
                          {daysLeft!==null&&<span style={{marginLeft:4,fontWeight:800}}>
                            {daysLeft===0?"오늘":isOverdue?`D+${Math.abs(daysLeft)}`:`D-${daysLeft}`}
                          </span>}
                        </span>
                      )}
                      {cl.total>0&&(
                        <span style={{fontSize:10,color:C.inkLt}}>
                          ☑ {cl.done}/{cl.total}
                          <span style={{marginLeft:4,color:cl.pct===100?C.good:C.inkLt}}>{cl.pct}%</span>
                        </span>
                      )}
                    </div>

                    {/* 링크 */}
                    {(t.primaryLink?.url||t.secondaryLinks?.some(l=>l.url))&&(
                      <div style={{display:"flex",gap:6,marginTop:7,flexWrap:"wrap"}}>
                        {t.primaryLink?.url&&(
                          <a href={t.primaryLink.url} target="_blank" rel="noopener noreferrer"
                            style={{padding:"4px 10px",borderRadius:6,background:C.rose,
                              color:C.white,fontSize:10,fontWeight:700,textDecoration:"none"}}>
                            {t.primaryLink.label||"메인 링크"}
                          </a>
                        )}
                        {t.secondaryLinks?.filter(l=>l.url).map((l,i)=>(
                          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                            style={{padding:"4px 10px",borderRadius:6,background:C.cream,
                              color:C.inkMid,fontSize:10,fontWeight:600,textDecoration:"none",
                              border:`1px solid ${C.border}`}}>
                            {l.label||`링크${i+1}`}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 우측 액션 */}
                  <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
                    {/* 상태 변경 */}
                    <select value={t.status}
                      onChange={e=>updateTaskStatus(t.id,e.target.value)}
                      style={{fontSize:9,padding:"3px 6px",borderRadius:6,border:`1px solid ${C.border}`,
                        background:C.cream,fontFamily:"inherit",cursor:"pointer",color:C.ink}}>
                      {TASK_STATUS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <button onClick={()=>{ setTaskEdit({...t}); setTaskModal(true); }}
                      style={{fontSize:9,padding:"3px 8px",borderRadius:6,border:`1px solid ${C.border}`,
                        background:C.cream,cursor:"pointer",fontFamily:"inherit",color:C.inkMid}}>
                      편집
                    </button>
                    <button onClick={()=>deleteTask(t.id)}
                      style={{fontSize:9,padding:"3px 8px",borderRadius:6,border:`1px solid ${C.bad}33`,
                        background:"#FEF0F0",cursor:"pointer",fontFamily:"inherit",color:C.bad}}>
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 태스크 모달 ── */}
      {taskModal&&taskEdit&&(
        <Modal title={taskEdit.id&&tasks.find?.(t=>t.id===taskEdit.id)?"✏️ 업무 수정":"➕ 업무 추가"} onClose={()=>{setTaskModal(false);setTaskEdit(null);}} wide>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <FR label="업무명 *">
              <Inp value={taskEdit.title} onChange={v=>setTaskEdit({...taskEdit,title:v})} placeholder="업무를 입력하세요"/>
            </FR>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <FR label="담당자">
                <select value={taskEdit.assignee||""} onChange={e=>setTaskEdit({...taskEdit,assignee:e.target.value})}
                  style={{width:"100%",padding:"8px 10px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,fontFamily:"inherit"}}>
                  <option value="">미지정</option>
                  {MEMBERS_LIST.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </FR>
              <FR label="업무 유형">
                <select value={taskEdit.type||"기타"} onChange={e=>setTaskEdit({...taskEdit,type:e.target.value})}
                  style={{width:"100%",padding:"8px 10px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,fontFamily:"inherit"}}>
                  {TASK_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </FR>
              <FR label="우선순위">
                <select value={taskEdit.priority||"mid"} onChange={e=>setTaskEdit({...taskEdit,priority:e.target.value})}
                  style={{width:"100%",padding:"8px 10px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,fontFamily:"inherit"}}>
                  {PRIORITY.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </FR>
              <FR label="상태">
                <select value={taskEdit.status||"todo"} onChange={e=>setTaskEdit({...taskEdit,status:e.target.value})}
                  style={{width:"100%",padding:"8px 10px",border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,fontFamily:"inherit"}}>
                  {TASK_STATUS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </FR>
            </div>
            <FR label="마감일">
              <Inp type="date" value={taskEdit.dueDate||""} onChange={v=>setTaskEdit({...taskEdit,dueDate:v})}/>
            </FR>
            {/* 메인 링크 */}
            <FR label="메인 링크">
              <div style={{display:"flex",gap:6}}>
                <Inp value={taskEdit.primaryLink?.label||""} onChange={v=>setTaskEdit({...taskEdit,primaryLink:{...taskEdit.primaryLink,label:v}})} placeholder="라벨 (예: 피그마)" style={{flex:"0 0 100px"}}/>
                <Inp value={taskEdit.primaryLink?.url||""} onChange={v=>setTaskEdit({...taskEdit,primaryLink:{...taskEdit.primaryLink,url:v}})} placeholder="https://..." style={{flex:1}}/>
              </div>
            </FR>
            {/* 추가 링크 */}
            <FR label="추가 링크">
              {(taskEdit.secondaryLinks||[]).map((l,i)=>(
                <div key={i} style={{display:"flex",gap:6,marginBottom:6}}>
                  <Inp value={l.label||""} onChange={v=>setTaskEdit({...taskEdit,secondaryLinks:taskEdit.secondaryLinks.map((x,j)=>j===i?{...x,label:v}:x)})} placeholder="라벨" style={{flex:"0 0 100px"}}/>
                  <Inp value={l.url||""} onChange={v=>setTaskEdit({...taskEdit,secondaryLinks:taskEdit.secondaryLinks.map((x,j)=>j===i?{...x,url:v}:x)})} placeholder="https://..." style={{flex:1}}/>
                  <button onClick={()=>setTaskEdit({...taskEdit,secondaryLinks:taskEdit.secondaryLinks.filter((_,j)=>j!==i)})}
                    style={{border:"none",background:"none",cursor:"pointer",color:C.bad,fontSize:16,padding:"0 4px"}}>✕</button>
                </div>
              ))}
              <button onClick={()=>setTaskEdit({...taskEdit,secondaryLinks:[...(taskEdit.secondaryLinks||[]),{label:"",url:""}]})}
                style={{fontSize:11,padding:"5px 12px",borderRadius:8,border:`1px dashed ${C.border}`,
                  background:C.cream,color:C.inkMid,cursor:"pointer",fontFamily:"inherit"}}>
                + 링크 추가
              </button>
            </FR>
            {/* 체크리스트 */}
            <FR label="체크리스트">
              {(taskEdit.checklist||[]).map((c,i)=>(
                <div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
                  <input type="checkbox" checked={c.done||false} onChange={e=>setTaskEdit({...taskEdit,checklist:taskEdit.checklist.map((x,j)=>j===i?{...x,done:e.target.checked}:x)})}/>
                  <Inp value={c.text||""} onChange={v=>setTaskEdit({...taskEdit,checklist:taskEdit.checklist.map((x,j)=>j===i?{...x,text:v}:x)})} placeholder="항목" style={{flex:1}}/>
                  <button onClick={()=>setTaskEdit({...taskEdit,checklist:taskEdit.checklist.filter((_,j)=>j!==i)})}
                    style={{border:"none",background:"none",cursor:"pointer",color:C.bad,fontSize:14}}>✕</button>
                </div>
              ))}
              <button onClick={()=>setTaskEdit({...taskEdit,checklist:[...(taskEdit.checklist||[]),{text:"",done:false}]})}
                style={{fontSize:11,padding:"5px 12px",borderRadius:8,border:`1px dashed ${C.border}`,
                  background:C.cream,color:C.inkMid,cursor:"pointer",fontFamily:"inherit"}}>
                + 항목 추가
              </button>
            </FR>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>saveTask(taskEdit)} style={{flex:1}}>💾 저장</Btn>
              <Btn variant="neutral" onClick={()=>{setTaskModal(false);setTaskEdit(null);}}>취소</Btn>
            </div>
          </div>
        </Modal>
      )}

    </div>
    );
  })();

  const ScheduleSection=(()=>{
    const MEMBER_COLORS = {
      "영서": "#f9a8d4", "지수": "#93c5fd",
      "소리": "#86efac", "경은": "#fbbf24",
    };
    const getMemberColor = name => {
      const found = Object.entries(MEMBER_COLORS).find(([k])=>name?.includes(k));
      return found ? found[1] : "#c4b5fd";
    };

    const todoItems = notionItems.filter(x=>!x.done);
    const doneItems = notionItems.filter(x=>x.done);
    const allItems  = [...notionItems];

    // 달력 계산
    const [calY, calM] = calMonth.split("-").map(Number);
    const firstDay = new Date(calY, calM-1, 1).getDay(); // 0=일
    const daysInMonth = new Date(calY, calM, 0).getDate();
    const prevMonth = () => {
      const d = new Date(calY, calM-2, 1);
      setCalMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
    };
    const nextMonth = () => {
      const d = new Date(calY, calM, 1);
      setCalMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
    };
    const itemsByDate = {};
    allItems.forEach(item=>{
      if(!item.date) return;
      const d = item.date.slice(0,10);
      if(!itemsByDate[d]) itemsByDate[d]=[];
      itemsByDate[d].push(item);
    });
    // 오늘
    const todayStr = new Date().toISOString().slice(0,10);

    return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* ── 뷰 전환 + 헤더 ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:4,padding:"3px",background:C.cream,borderRadius:9}}>
          {[{id:"list",label:"📋 목록"},{id:"calendar",label:"📅 달력"}].map(v=>(
            <button key={v.id} onClick={()=>setSchedView(v.id)}
              style={{padding:"5px 14px",borderRadius:7,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit",
                background:schedView===v.id?C.white:"transparent",color:schedView===v.id?C.ink:C.inkMid,
                boxShadow:schedView===v.id?"0 1px 4px rgba(0,0,0,0.1)":"none"}}>
              {v.label}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={fetchNotion}
            style={{fontSize:10,padding:"5px 12px",borderRadius:8,border:`1px solid ${C.border}`,
              background:C.cream,color:C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
            {notionLoading?"⏳":"🔄"} 동기화
          </button>
          <button onClick={()=>setNotionAddModal(true)}
            style={{fontSize:10,padding:"5px 12px",borderRadius:8,border:"none",
              background:C.rose,color:C.white,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
            + 추가
          </button>
        </div>
      </div>

      {notionError&&(
        <div style={{background:"#FEF0F0",border:`1px solid ${C.bad}33`,borderRadius:8,padding:"10px 12px",
          fontSize:11,color:C.bad}}>
          ❌ {notionError} — NOTION_TOKEN 환경변수를 확인해줘요
        </div>
      )}

      {/* ── 달력 뷰 ── */}
      {schedView==="calendar"&&(
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px"}}>
          {/* 달력 헤더 */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <button onClick={prevMonth}
              style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:C.cream,
                color:C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:12}}>‹</button>
            <div style={{fontSize:14,fontWeight:800,color:C.ink}}>{calY}년 {calM}월</div>
            <button onClick={nextMonth}
              style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:C.cream,
                color:C.inkMid,cursor:"pointer",fontFamily:"inherit",fontWeight:700,fontSize:12}}>›</button>
          </div>
          {/* 요일 헤더 */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
            {["일","월","화","수","목","금","토"].map((d,i)=>(
              <div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,
                color:i===0?C.bad:i===6?"#60a5fa":C.inkMid,padding:"4px 0"}}>{d}</div>
            ))}
          </div>
          {/* 날짜 셀 */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
            {/* 빈 칸 */}
            {Array.from({length:firstDay}).map((_,i)=>(
              <div key={`empty-${i}`} style={{minHeight:64,borderRadius:8,background:C.cream,opacity:0.3}}/>
            ))}
            {/* 날짜 */}
            {Array.from({length:daysInMonth}).map((_,i)=>{
              const day = i+1;
              const dateStr = `${calY}-${String(calM).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const dayItems = itemsByDate[dateStr]||[];
              const isToday = dateStr===todayStr;
              const dow = (firstDay+i)%7;
              return(
                <div key={day} style={{
                  minHeight:64,borderRadius:8,padding:"4px 5px",
                  background:isToday?C.blush:C.white,
                  border:`1px solid ${isToday?C.rose+"66":C.border}`,
                }}>
                  <div style={{fontSize:10,fontWeight:isToday?900:600,
                    color:isToday?C.rose:dow===0?C.bad:dow===6?"#60a5fa":C.inkMid,
                    marginBottom:3}}>
                    {day}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:2}}>
                    {dayItems.slice(0,3).map((item,j)=>(
                      <div key={j} style={{
                        fontSize:9,fontWeight:600,padding:"1px 5px",borderRadius:4,
                        background:getMemberColor(item.assignee||item.name)+"30",
                        color:getMemberColor(item.assignee||item.name),
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                        textDecoration:item.done?"line-through":"none",opacity:item.done?0.5:1,
                      }} title={item.name}>
                        {item.name}
                      </div>
                    ))}
                    {dayItems.length>3&&(
                      <div style={{fontSize:8,color:C.inkLt,paddingLeft:4}}>+{dayItems.length-3}개</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* 범례 */}
          <div style={{display:"flex",gap:10,marginTop:12,flexWrap:"wrap"}}>
            {Object.entries(MEMBER_COLORS).map(([name,color])=>(
              <div key={name} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:color}}/>
                <span style={{fontSize:10,color:C.inkMid}}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 목록 뷰 ── */}
      {schedView==="list"&&(
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px"}}>
          <div style={{display:"flex",gap:4,marginBottom:12,borderBottom:`1px solid ${C.border}`,paddingBottom:8}}>
            {[{id:"todo",label:`진행 중 (${todoItems.length})`},{id:"done",label:`완료 (${doneItems.length})`}].map(t=>(
              <button key={t.id} onClick={()=>setNotionTab(t.id)}
                style={{padding:"5px 14px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"inherit",
                  fontSize:11,fontWeight:700,background:notionTab===t.id?C.rose:"transparent",
                  color:notionTab===t.id?C.white:C.inkMid}}>
                {t.label}
              </button>
            ))}
          </div>

          {notionLoading&&!notionItems.length?(
            <div style={{textAlign:"center",padding:"24px",color:C.inkLt,fontSize:11}}>⏳ 노션에서 불러오는 중...</div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {(notionTab==="todo"?todoItems:doneItems).map(item=>{
                const assignee = item.assignee;
                const memberColor = item.assigneeColor || "#c4b5fd";
                const daysLeft = item.date ? Math.ceil((new Date(item.date)-new Date())/(1000*60*60*24)) : null;
                const typeColor = {공구:C.rose,시딩:C.purple,광고:C.gold,이벤트:C.sage}[item.select]||C.inkMid;
                return(
                  <div key={item.id} style={{
                    display:"flex",alignItems:"flex-start",gap:10,
                    padding:"10px 12px",borderRadius:10,
                    border:`1px solid ${item.done?"#e5e7eb":daysLeft!==null&&daysLeft<=3&&daysLeft>=0?C.rose+"44":C.border}`,
                    background:item.done?"#f9fafb":daysLeft!==null&&daysLeft<=3&&daysLeft>=0?"#FFF8FC":C.white,
                    opacity:item.done?0.6:1,
                  }}>
                    <button onClick={()=>toggleNotionDone(item.id,!item.done)}
                      style={{width:18,height:18,borderRadius:5,border:`2px solid ${item.done?C.good:C.border}`,
                        background:item.done?C.good:"transparent",cursor:"pointer",flexShrink:0,marginTop:1,
                        display:"flex",alignItems:"center",justifyContent:"center",color:C.white,fontSize:11}}>
                      {item.done?"✓":""}
                    </button>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:3}}>
                        <span style={{fontSize:12,fontWeight:800,color:item.done?C.inkLt:C.ink,
                          textDecoration:item.done?"line-through":"none"}}>
                          {item.name||"(제목없음)"}
                        </span>
                        {item.select&&(
                          <span style={{fontSize:9,padding:"2px 8px",borderRadius:20,
                            background:`${typeColor}18`,color:typeColor,fontWeight:700}}>
                            {item.select}
                          </span>
                        )}
                        {item.product&&(
                          <span style={{fontSize:9,padding:"2px 8px",borderRadius:20,
                            background:`${C.rose}15`,color:C.rose,fontWeight:700}}>
                            {item.product}
                          </span>
                        )}
                        {assignee&&(
                          <span style={{fontSize:9,padding:"2px 8px",borderRadius:20,
                            background:`${memberColor}25`,color:memberColor,fontWeight:800,
                            border:`1px solid ${memberColor}55`}}>
                            {assignee}
                          </span>
                        )}
                      </div>
                      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                        {item.date&&(
                          <span style={{fontSize:10,color:daysLeft!==null&&daysLeft<=3&&daysLeft>=0?C.rose:C.inkLt,fontWeight:600}}>
                            📅 {item.date}
                            {daysLeft!==null&&<span style={{marginLeft:4,fontWeight:800}}>
                              {daysLeft===0?"오늘":daysLeft<0?`D+${Math.abs(daysLeft)}`:`D-${daysLeft}`}
                            </span>}
                          </span>
                        )}
                        {item.status&&<span style={{fontSize:9,color:C.inkLt,background:C.cream,padding:"1px 6px",borderRadius:10}}>{item.status}</span>}
                      </div>
                    </div>
                    <button onClick={()=>deleteNotionItem(item.id)}
                      style={{background:"none",border:"none",cursor:"pointer",color:C.inkLt,fontSize:12,
                        padding:"2px 4px",opacity:0.4,flexShrink:0}}
                      onMouseEnter={e=>e.currentTarget.style.opacity="1"}
                      onMouseLeave={e=>e.currentTarget.style.opacity="0.4"}>
                      ✕
                    </button>
                  </div>
                );
              })}
              {(notionTab==="todo"?todoItems:doneItems).length===0&&(
                <div style={{textAlign:"center",padding:"20px",color:C.inkLt,fontSize:11}}>
                  {notionTab==="todo"?"진행 중인 일정이 없어요 🎉":"완료된 일정이 없어요"}
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {/* 노션 일정 추가 모달 */}
      {notionAddModal&&(
        <Modal title="📋 소재 일정 추가" onClose={()=>setNotionAddModal(false)}>
          <FR label="소재명 *">
            <Inp value={notionForm.name} onChange={v=>setNotionForm(f=>({...f,name:v}))} placeholder="소재명 입력"/>
          </FR>
          <FR label="시작일">
            <Inp type="date" value={notionForm.date} onChange={v=>setNotionForm(f=>({...f,date:v}))}/>
          </FR>
          <FR label="제품">
            <Inp value={notionForm.product} onChange={v=>setNotionForm(f=>({...f,product:v}))} placeholder="소닉플로우, 프리온 등"/>
          </FR>
          <FR label="담당자">
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {["영서","지수","소리","경은"].map(name=>(
                <button key={name} onClick={()=>setNotionForm(f=>({...f,select:name}))}
                  style={{padding:"5px 14px",borderRadius:20,border:`1px solid ${notionForm.select===name?MEMBER_COLORS[name]:C.border}`,
                    background:notionForm.select===name?`${MEMBER_COLORS[name]}22`:"transparent",
                    color:notionForm.select===name?MEMBER_COLORS[name]:C.inkMid,
                    fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  {name}
                </button>
              ))}
            </div>
          </FR>
          <Btn onClick={createNotionItem} style={{width:"100%",marginTop:8}}>추가하기</Btn>
        </Modal>
      )}
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
          {sec==="tasks"       && TaskSection}
          {sec==="meta"        && MetaSection}
          {sec==="adspend"     && AdSpendSection}
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

      {/* ── 데이터 에이전트 플로팅 버튼 ── */}
      <div style={{position:"fixed",bottom:24,right:24,zIndex:1000,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:10}}>
        {/* 채팅창 */}
        {agentOpen&&(
          <div style={{width:360,height:520,background:C.white,borderRadius:20,
            boxShadow:"0 20px 60px rgba(0,0,0,0.2)",display:"flex",flexDirection:"column",overflow:"hidden",
            border:`1px solid ${C.border}`}}>
            {/* 헤더 */}
            <div style={{background:C.ink,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:13,fontWeight:800,color:C.white}}>🤖 OA 데이터 에이전트</div>
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
              {[{id:"chat",label:"💬 채팅"},{id:"history",label:`📌 저장됨 ${Array.isArray(agentHistory)&&agentHistory.length>0?`(${agentHistory.length})`:""}`.trim()}].map(t=>(
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
                      {label:"📊 성과 분석", qs:[
                        "ROAS 가장 높은 광고 TOP 3 알려줘",
                        "CPA 가장 낮은 광고 뭐야?",
                        "LPV율 낮은 광고 있어? 랜딩 문제 의심되는 거",
                        "CTR 낮아서 소재 문제인 광고 찾아줘",
                      ]},
                      {label:"💰 광고비 현황", qs:[
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
                      {label:"📦 재고", qs:[
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
                            🖼 이미지
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
                    ⏳ 분석 중...
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

        {/* 플로팅 버튼 */}
        <button onClick={()=>setAgentOpen(v=>!v)}
          style={{width:52,height:52,borderRadius:"50%",border:"none",
            background:agentOpen?C.inkMid:C.rose,color:C.white,
            fontSize:22,cursor:"pointer",boxShadow:"0 4px 20px rgba(0,0,0,0.2)",
            display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>
          {agentOpen?"✕":"🤖"}
        </button>
      </div>
    </div>
  );
}
