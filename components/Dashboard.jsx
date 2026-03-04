'use client'

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 팔레트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const C = {
  rose:"#E8567A", roseLt:"#F2849E", blush:"#FCE8EE",
  cream:"#FEF8F4", gold:"#C9924A", goldLt:"#F6E8D0",
  sage:"#6BAA88", sageLt:"#E4F2EA",
  ink:"#2B1F2E", inkMid:"#6B576F", inkLt:"#B09CB5",
  white:"#FFFFFF", border:"#EDE0E8",
  good:"#4DAD7A", warn:"#E8A020", bad:"#E84B4B",
  purple:"#9B6FC7", purpleLt:"#F0E8FA",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 기본 로컬 데이터
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const DEFAULT_INF = [
  {id:1,name:"@glowwith_miso",  tier:"매크로",  followers:"284K",platform:"인스타",product:"세럼 30ml",   sent:10,posted:8, postedDate:"2025-03-01",reach:310000,saves:4200,clicks:1840,conv:92, videoReceived:true, reusable:true, metaUsed:true},
  {id:2,name:"@beauty.harang",  tier:"미드",    followers:"98K", platform:"인스타",product:"선크림 SPF50",sent:15,posted:14,postedDate:"2025-03-02",reach:128000,saves:2100,clicks:920, conv:61, videoReceived:true, reusable:true, metaUsed:false},
  {id:3,name:"@hanbiteok_vlog", tier:"마이크로",followers:"41K", platform:"유튜브",product:"세럼 50ml",   sent:5, posted:5, postedDate:"2025-03-02",reach:84000, saves:980, clicks:1240,conv:88, videoReceived:false,reusable:false,metaUsed:false},
  {id:4,name:"@soomin_skinlog", tier:"마이크로",followers:"28K", platform:"틱톡",  product:"토너 패드",   sent:8, posted:6, postedDate:"2025-02-26",reach:null,  saves:null,clicks:null,conv:null,videoReceived:false,reusable:false,metaUsed:false},
  {id:5,name:"@rosebloom.daily",tier:"나노",    followers:"12K", platform:"인스타",product:"립밤 세트",   sent:3, posted:2, postedDate:"2025-02-27",reach:null,  saves:null,clicks:null,conv:null,videoReceived:false,reusable:false,metaUsed:false},
  {id:6,name:"@dailyglow_kr",   tier:"매크로",  followers:"156K",platform:"유튜브",product:"세럼 30ml",   sent:10,posted:0, postedDate:null,         reach:null,  saves:null,clicks:null,conv:null,videoReceived:false,reusable:false,metaUsed:false},
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
const LS_SHEET_URL = "oa_sheet_url";
const LS_INF       = "oa_inf_v7";
const LS_INV       = "oa_inv_v7";
const LS_SCH       = "oa_sch_v7";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 유틸
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const TODAY = new Date(); TODAY.setHours(0,0,0,0);
const todayStr = TODAY.toLocaleDateString("ko-KR",{month:"long",day:"numeric"});

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
function schTypeColor(t){ return {공구:C.rose,시딩:C.purple,광고:C.gold,이벤트:C.sage}[t]||C.inkMid; }
function schTypeIcon(t){  return {공구:"🛍",시딩:"✨",광고:"📣",이벤트:"🎉"}[t]||"📌"; }

// localStorage 훅
function useLocal(key, def){
  const [data,setData] = useState(()=>{
    try{ const v=localStorage.getItem(key); return v?JSON.parse(v):def; }catch{ return def; }
  });
  function save(v){ setData(v); try{ localStorage.setItem(key,JSON.stringify(v)); }catch{} }
  return [data,save];
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
const BeautyTooltip=({active,payload,label})=>{
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",
      boxShadow:`0 8px 24px rgba(43,31,46,0.12)`,fontSize:11,minWidth:140}}>
      <p style={{color:C.rose,fontWeight:700,marginBottom:5}}>{label}</p>
      {payload.map((p,i)=>(
        <p key={i} style={{color:C.inkMid,margin:"2px 0"}}>{p.name}:{" "}
          <span style={{color:C.ink,fontWeight:700}}>{typeof p.value==="number"?p.value.toLocaleString():p.value}</span>
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
export default function OaDashboard(){
  const [sec,setSec]           = useState("home");
  const [metaTab,setMetaTab]   = useState("overview");
  const [campTab,setCampTab]   = useState("conversion");
  const [pulse,setPulse]       = useState(false);
  const [nid,setNid]           = useState(300);

  // localStorage 데이터
  const [infs,setInfs] = useLocal(LS_INF, DEFAULT_INF);
  const [inv, setInv]  = useLocal(LS_INV, DEFAULT_INV);
  const [sch, setSch]  = useLocal(LS_SCH, DEFAULT_SCH);

  // 구글 시트 연동 상태
  const [sheetUrl,setSheetUrl]       = useLocal(LS_SHEET_URL, "");
  const [metaRaw,setMetaRaw]         = useState([]);   // 파싱된 원본 rows
  const [metaStatus,setMetaStatus]   = useState("idle"); // idle | loading | ok | error
  const [metaError,setMetaError]     = useState("");
  const [sheetModal,setSheetModal]   = useState(false);
  const [sheetInput,setSheetInput]   = useState("");

  // 모달
  const [infModal, setInfModal] = useState(null);
  const [insModal, setInsModal] = useState(null);
  const [invModal, setInvModal] = useState(null);
  const [schModal, setSchModal] = useState(null);

  // 폼
  const eInf={name:"",tier:"마이크로",followers:"",platform:"인스타",product:"",sent:"",posted:"",postedDate:"",videoReceived:false,reusable:false,metaUsed:false};
  const eInv={name:"",sku:"",category:"",stock:"",ordered:"",reorder:"",sold30:""};
  const eSch={type:"공구",title:"",date:"",endDate:"",platform:"",note:"",status:"예정"};
  const [infF,setInfF]=useState(eInf);
  const [invF,setInvF]=useState(eInv);
  const [schF,setSchF]=useState(eSch);
  const [insF,setInsF]=useState({id:null,name:"",reach:"",saves:"",clicks:"",conv:""});

  useEffect(()=>{const t=setInterval(()=>setPulse(v=>!v),2500);return()=>clearInterval(t);},[]);

  // 시트 URL 저장하면 자동 fetch
  useEffect(()=>{ if(sheetUrl) fetchSheet(sheetUrl); },[sheetUrl]);

  // ── 구글 시트 fetch ──────────────────────────────
  async function fetchSheet(url){
    if(!url) return;
    setMetaStatus("loading");
    setMetaError("");
    try{
      // 공유 URL → CSV export URL 변환
      let csvUrl = url;
      // https://docs.google.com/spreadsheets/d/SHEET_ID/edit... → export csv
      const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      if(match){
        const id=match[1];
        // gid 파라미터 있으면 추출
        const gidMatch = url.match(/[#&?]gid=(\d+)/);
        const gid = gidMatch?gidMatch[1]:"0";
        csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
      }
      const res = await fetch(csvUrl);
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
    setSheetUrl(url);
    setSheetModal(false);
  }

  // ── 메타 데이터 집계 ─────────────────────────────
  const hasSheet = metaStatus==="ok" && metaRaw.length>0;

  const metaAgg = hasSheet ? (() => {
    const totalSpend    = metaRaw.reduce((s,r)=>s+r.spend,0);
    const totalClicks   = metaRaw.reduce((s,r)=>s+r.clicks,0);
    const totalLpv      = metaRaw.reduce((s,r)=>s+r.lpv,0);
    const totalPurchases= metaRaw.reduce((s,r)=>s+r.purchases,0);
    const avgCtr        = metaRaw.length ? metaRaw.reduce((s,r)=>s+r.ctr,0)/metaRaw.length : 0;
    const avgCpc        = totalClicks ? totalSpend/totalClicks : 0;
    const avgCpa        = totalPurchases ? totalSpend/totalPurchases : 0;
    const lpvRate       = totalClicks ? (totalLpv/totalClicks)*100 : 0;

    // 날짜별 집계
    const byDate = {};
    metaRaw.forEach(r=>{
      if(!r.date) return;
      if(!byDate[r.date]) byDate[r.date]={day:r.date.slice(5).replace("-","/"),spend:0,clicks:0,lpv:0,purchases:0,ctr:0,n:0};
      byDate[r.date].spend+=r.spend;
      byDate[r.date].clicks+=r.clicks||r.clicksAll||0;
      byDate[r.date].lpv+=r.lpv;
      byDate[r.date].purchases+=r.purchases;
      byDate[r.date].ctr+=r.ctr;
      byDate[r.date].n++;
    });
    const daily = Object.values(byDate)
      .sort((a,b)=>a.day.localeCompare(b.day))
      .map(d=>({...d,ctr:d.n?+(d.ctr/d.n).toFixed(2):0,cpc:d.clicks?+(d.spend/d.clicks).toFixed(0):0}));

    // 캠페인별 집계
    // 광고 이름 기준으로 집계 (광고세트 정보도 포함)
    const byAd = {};
    metaRaw.forEach(r=>{
      const key = r.adName || r.campaign || "unknown";
      if(!byAd[key]) byAd[key]={
        name: r.adName || key,
        adset: r.adset || "",
        campaign: r.campaign || "",
        objective: r.objective || "",
        resultType: r.resultType || "",
        spend:0, clicks:0, lpv:0, purchases:0, convValue:0, cart:0, ctrSum:0, n:0
      };
      byAd[key].spend      += r.spend;
      byAd[key].clicks     += r.clicks||r.clicksAll||0;
      byAd[key].lpv        += r.lpv;
      byAd[key].purchases  += r.purchases;
      byAd[key].convValue  += r.convValue;
      byAd[key].cart       += r.cart;
      byAd[key].ctrSum     += r.ctr||0;
      byAd[key].n          += 1;
    });
    const campaigns = Object.values(byAd).map(c=>({
      ...c,
      cpa:     c.purchases ? Math.round(c.spend/c.purchases) : 0,
      roas:    c.convValue&&c.spend ? +(c.convValue/c.spend).toFixed(2) : 0,
      lpvRate: c.clicks ? Math.round((c.lpv/c.clicks)*100) : 0,
      cpc:     c.clicks ? Math.round(c.spend/c.clicks) : 0,
      ctr:     c.n ? +(c.ctrSum/c.n).toFixed(2) : 0,
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
  const totalAlerts    = overdueIns.length+dangerInv.length+overdueScheds.length+urgentScheds.length;

  // ── CRUD ────────────────────────────────────────
  function saveInf(){
    if(!infF.name)return;
    const item={...infF,sent:+infF.sent||0,posted:+infF.posted||0,reach:infF.reach??null,saves:infF.saves??null,clicks:infF.clicks??null,conv:infF.conv??null};
    if(infModal==="add"){setInfs([...infs,{...item,id:nid}]);setNid(n=>n+1);}
    else setInfs(infs.map(f=>f.id===infF.id?{...item,id:f.id}:f));
    setInfModal(null);
  }
  function saveIns(){
    setInfs(infs.map(f=>f.id===insF.id?{...f,reach:+insF.reach||0,saves:+insF.saves||0,clicks:+insF.clicks||0,conv:+insF.conv||0}:f));
    setInsModal(null);
  }
  function saveInv(){
    if(!invF.name)return;
    const item={...invF,stock:+invF.stock||0,ordered:+invF.ordered||0,reorder:+invF.reorder||0,sold30:+invF.sold30||0};
    if(invModal==="add"){setInv([...inv,{...item,id:nid}]);setNid(n=>n+1);}
    else setInv(inv.map(v=>v.id===invF.id?{...item,id:v.id}:v));
    setInvModal(null);
  }
  function saveSch(){
    if(!schF.title||!schF.date)return;
    if(schModal==="add"){setSch([...sch,{...schF,id:nid}]);setNid(n=>n+1);}
    else setSch(sch.map(s=>s.id===schF.id?schF:s));
    setSchModal(null);
  }

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
  const HomeSection=()=>(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:`linear-gradient(135deg,${C.rose},${C.roseLt})`,borderRadius:16,padding:"20px",
        color:C.white,boxShadow:`0 8px 28px ${C.rose}44`}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",opacity:0.8,marginBottom:4}}>TODAY · {todayStr}</div>
        <div style={{fontSize:26,fontWeight:900,lineHeight:1.1}}>
          {totalAlerts>0?`확인 필요 ${totalAlerts}건`:"모두 정상 ✅"}</div>
        <div style={{fontSize:11,opacity:0.8,marginTop:6}}>
          {[dangerInv.length>0&&`재고위험 ${dangerInv.length}`,
            overdueIns.length>0&&`인사이트미입력 ${overdueIns.length}`,
            overdueScheds.length>0&&`기간초과 ${overdueScheds.length}`,
            urgentScheds.length>0&&`D-5임박 ${urgentScheds.length}`,
          ].filter(Boolean).join("  ·  ")||"처리할 항목이 없습니다"}
        </div>
      </div>

      <div className="alert-grid" style={{display:"grid",gridTemplateColumns:"1fr",gap:14}}>
      {dangerInv.length>0&&(
        <Card>
          <CardTitle title="🚨 재고 위험 — 즉시 발주 필요" sub="7일치 미만"/>
          {dangerInv.map(item=>(
            <div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              background:"#FEF0F0",border:`1px solid ${C.bad}33`,borderRadius:10,padding:"10px 14px",
              marginBottom:6,flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:12,fontWeight:800,color:C.ink}}>{item.name}</div>
                <div style={{fontSize:10,color:C.inkMid,marginTop:2}}>
                  현재고 {item.stock.toLocaleString()}개 · <span style={{color:C.bad,fontWeight:700}}>{stockDays(item)}일치</span> 남음
                </div>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{fontSize:11,fontWeight:800,color:C.bad,background:C.white,border:`1px solid ${C.bad}44`,
                  padding:"4px 12px",borderRadius:20}}>발주기준 {item.reorder.toLocaleString()}개</span>
                <Btn variant="neutral" small onClick={()=>setSec("inventory")}>→ 재고</Btn>
              </div>
            </div>
          ))}
        </Card>
      )}

      {cautionInv.length>0&&(
        <Card>
          <CardTitle title="⚠️ 재고 주의 — 발주 검토" sub="21일치 미만"/>
          {cautionInv.map(item=>(
            <div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              background:"#FFF8EC",border:`1px solid ${C.warn}33`,borderRadius:10,padding:"10px 14px",marginBottom:6,flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:C.ink}}>{item.name}</div>
                <div style={{fontSize:10,color:C.inkMid,marginTop:2}}>현재고 {item.stock.toLocaleString()}개 · <span style={{color:C.warn,fontWeight:700}}>{stockDays(item)}일치</span></div>
              </div>
              <Btn variant="neutral" small onClick={()=>setSec("inventory")}>→ 재고</Btn>
            </div>
          ))}
        </Card>
      )}
      </div>

      <div className="alert-grid" style={{display:"grid",gridTemplateColumns:"1fr",gap:14}}>
      {overdueIns.length>0&&(
        <Card>
          <CardTitle title="❗ 인사이트 미입력" sub="D+7 기록 기한 초과"/>
          {overdueIns.map(f=>{
            const st=insightStatus(f);
            return(
              <div key={f.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                background:C.blush,border:`1px solid ${C.rose}33`,borderRadius:10,padding:"10px 14px",marginBottom:6,flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{fontSize:12,fontWeight:800,color:C.ink}}>{f.name}</div>
                  <div style={{fontSize:10,color:C.inkMid,marginTop:2}}>
                    {f.platform} · {f.product} · 게시 {f.postedDate} · <span style={{color:st.color,fontWeight:700}}>{st.label}</span>
                  </div>
                </div>
                <Btn variant="ghost" small onClick={()=>{
                  setInsF({id:f.id,name:f.name,reach:"",saves:"",clicks:"",conv:""});
                  setInsModal(true);
                }}>✏️ 바로 입력</Btn>
              </div>
            );
          })}
        </Card>
      )}

      {overdueScheds.length>0&&(
        <Card>
          <CardTitle title="📅 기간 초과 일정" sub="종료일 경과 · 미완료 처리"/>
          {overdueScheds.map(s=>{
            const tc=schTypeColor(s.type);
            return(
              <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                background:C.cream,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",marginBottom:6,flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:10,fontWeight:700,color:tc,background:`${tc}18`,padding:"2px 8px",borderRadius:20}}>{s.type}</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:C.inkMid,textDecoration:"line-through"}}>{s.title}</div>
                    <div style={{fontSize:10,color:C.inkLt}}>{s.endDate||s.date} 종료</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <Btn variant="sage" small onClick={()=>setSch(sch.map(x=>x.id===s.id?{...x,status:"완료"}:x))}>✅ 완료</Btn>
                  <Btn variant="danger" small onClick={()=>setSch(sch.filter(x=>x.id!==s.id))}>🗑</Btn>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {urgentScheds.length>0&&(
        <Card>
          <CardTitle title="🔔 D-5 임박 일정" sub="5일 이내 시작"/>
          {urgentScheds.sort((a,b)=>new Date(a.date)-new Date(b.date)).map(s=>{
            const d=daysUntil(s.date), tc=schTypeColor(s.type);
            return(
              <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                background:d===0?"#FFF8FC":C.white,border:`1px solid ${d<=1?C.rose+"55":C.border}`,
                borderRadius:10,padding:"10px 14px",marginBottom:6,flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <div style={{textAlign:"center",minWidth:32}}>
                    <div style={{fontSize:9,color:C.inkLt}}>시작</div>
                    <div style={{fontSize:15,fontWeight:900,color:d===0?C.rose:d<=2?C.bad:C.warn}}>
                      {d===0?"오늘":`D-${d}`}</div>
                  </div>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:10,fontWeight:700,color:tc,background:`${tc}18`,padding:"1px 7px",borderRadius:20}}>{schTypeIcon(s.type)} {s.type}</span>
                      <span style={{fontSize:12,fontWeight:800,color:C.ink}}>{s.title}</span>
                    </div>
                    <div style={{fontSize:10,color:C.inkLt,marginTop:2}}>{s.platform}{s.note&&` · ${s.note}`}</div>
                  </div>
                </div>
                <Btn variant="neutral" small onClick={()=>setSec("schedule")}>→ 스케줄</Btn>
              </div>
            );
          })}
        </Card>
      )}

      </div>
      {totalAlerts===0&&(
        <div style={{textAlign:"center",padding:"52px 0",color:C.inkLt}}>
          <div style={{fontSize:52,marginBottom:12}}>✨</div>
          <div style={{fontSize:14,fontWeight:700,color:C.inkMid}}>모든 항목 정상</div>
          <div style={{fontSize:11,marginTop:4}}>위험 재고·미입력·기간초과 없음</div>
        </div>
      )}

      {/* 인사이트 입력 모달 (홈에서도 접근) */}
      {insModal&&(
        <Modal title="📊 인사이트 기록" onClose={()=>setInsModal(null)}>
          <div style={{fontSize:11,color:C.rose,fontWeight:700,marginBottom:16,background:C.blush,padding:"8px 12px",borderRadius:8}}>
            {insF.name} — 게시 후 7일 데이터</div>
          {[{k:"reach",l:"👁 도달수",p:"52000"},{k:"saves",l:"🔖 저장수",p:"640"},{k:"clicks",l:"🔗 링크 클릭",p:"480"},{k:"conv",l:"🛒 구매 전환",p:"34"}].map(({k,l,p})=>(
            <FR key={k} label={l}><Inp type="number" value={insF[k]} onChange={v=>setInsF(f=>({...f,[k]:v}))} placeholder={`예: ${p}`}/></FR>
          ))}
          <Btn onClick={saveIns} style={{width:"100%",marginTop:8}}>💾 저장</Btn>
        </Modal>
      )}
    </div>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📣 메타광고
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const MetaSection=()=>{
    const d = metaAgg;
    const fmt=n=>n>=1000?`₩${Math.round(n/1000).toLocaleString()}K`:`₩${Math.round(n).toLocaleString()}`;

    const metaKpi = d ? [
      {label:"총 광고비",  value:fmt(d.totalSpend),   change:0, good:"high",icon:"💸",note:`${d.daily.length}일 집계`},
      {label:"총 클릭수",  value:d.totalClicks.toLocaleString(), change:0,good:"high",icon:"👆",note:`일평균 ${Math.round(d.totalClicks/Math.max(d.daily.length,1)).toLocaleString()}`},
      {label:"LPV",        value:d.totalLpv.toLocaleString(),    change:0,good:"high",icon:"🛬",note:`LPV율 ${d.lpvRate.toFixed(1)}%`},
      {label:"CPA",        value:fmt(d.avgCpa),        change:0, good:"low", icon:"🎯",note:"전환당 비용"},
      {label:"CPC",        value:`₩${Math.round(d.avgCpc).toLocaleString()}`, change:0,good:"low",icon:"💡",note:"클릭당 비용"},
      {label:"평균 CTR",   value:`${d.avgCtr.toFixed(2)}%`, change:0,good:"high",icon:"📊",note:"클릭률"},
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

        {/* 구글 시트 연결 배너 */}
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
                  <div style={{fontSize:12,fontWeight:800,color:C.good}}>구글 시트 연결됨 · {metaRaw.length}행 로드</div>
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
            <Btn variant={hasSheet?"neutral":"gold"} small onClick={()=>{setSheetInput(sheetUrl);setSheetModal(true)}}>
              {hasSheet?"⚙️ 시트 변경":"🔗 시트 연결"}
            </Btn>
          </div>
        </div>

        <KpiGrid items={metaKpi} cols={6}/>

        {/* 탭 */}
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
          {[{id:"overview",label:"📈 추이"},{id:"campaign",label:"📣 캠페인"}].map(t=>(
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
                <CardTitle title="클릭수 vs LPV 일별 추이" sub="클릭 대비 랜딩 도달 흐름"/>
                <ResponsiveContainer width="100%" height={190}>
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
                    <Area type="monotone" dataKey="clicks" stroke={C.rose} strokeWidth={2.5} fill="url(#cg)" name="클릭수"/>
                    <Area type="monotone" dataKey="lpv"    stroke={C.sage} strokeWidth={2}   fill="url(#lg)" name="LPV"/>
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{display:"flex",gap:16,justifyContent:"flex-end",marginTop:8}}>
                  {[{c:C.rose,l:"클릭수"},{c:C.sage,l:"LPV"}].map(({c,l})=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:C.inkMid}}>
                      <div style={{width:14,height:3,background:c,borderRadius:2}}/>{l}
                    </div>
                  ))}
                </div>
              </Card>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Card>
                  <CardTitle title="일별 광고비" sub="소진 패턴"/>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={d.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                      <XAxis dataKey="day" tick={{fontSize:8,fill:C.inkLt}} axisLine={false} tickLine={false} interval={Math.floor(d.daily.length/5)}/>
                      <YAxis tick={{fontSize:8,fill:C.inkLt}} axisLine={false} tickLine={false}/>
                      <Tooltip content={<BeautyTooltip/>}/>
                      <Bar dataKey="spend" fill={C.roseLt} radius={[3,3,0,0]} name="광고비(₩)"/>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card>
                  <CardTitle title="CTR 추이" sub="일별 클릭률"/>
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={d.daily}>
                      <defs>
                        <linearGradient id="ctrg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.gold} stopOpacity={0.25}/><stop offset="95%" stopColor={C.gold} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                      <XAxis dataKey="day" tick={{fontSize:8,fill:C.inkLt}} axisLine={false} tickLine={false} interval={Math.floor(d.daily.length/5)}/>
                      <YAxis tick={{fontSize:8,fill:C.inkLt}} axisLine={false} tickLine={false}/>
                      <Tooltip content={<BeautyTooltip/>}/>
                      <Area type="monotone" dataKey="ctr" stroke={C.gold} strokeWidth={2} fill="url(#ctrg)" name="CTR(%)"/>
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
                if(camps.length===0) return(
                  <div style={{textAlign:"center",padding:"32px",color:C.inkLt,fontSize:12}}>
                    해당 목적의 캠페인 데이터가 없습니다<br/>
                    <span style={{fontSize:10,marginTop:4,display:"block"}}>시트의 "캠페인_목적" 컬럼을 확인해주세요</span>
                  </div>
                );
                return(
                  <>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:0}}>
                      {campTab==="conversion" ? [
                        {label:"전환 광고비",  value:`₩${Math.round(camps.reduce((s,c)=>s+c.spend,0)/1000).toLocaleString()}K`,color:C.rose},
                        {label:"총 구매",      value:`${camps.reduce((s,c)=>s+c.purchases,0)}건`,color:C.good},
                        {label:"총 전환값",    value:`₩${Math.round(camps.reduce((s,c)=>s+c.convValue,0)/1000).toLocaleString()}K`,color:C.purple},
                        {label:"평균 CPA",     value:`₩${Math.round(camps.reduce((s,c)=>s+c.spend,0)/Math.max(camps.reduce((s,c)=>s+c.purchases,0),1)).toLocaleString()}`,color:C.gold},
                        {label:"전체 ROAS",    value:`${camps.reduce((s,c)=>s+c.spend,0)>0?+(camps.reduce((s,c)=>s+c.convValue,0)/camps.reduce((s,c)=>s+c.spend,0)).toFixed(2):0}x`,color:C.sage},
                        {label:"총 광고수",    value:`${camps.length}개`,color:C.inkMid},
                      ] : [
                        {label:"트래픽 광고비",value:`₩${Math.round(camps.reduce((s,c)=>s+c.spend,0)/1000).toLocaleString()}K`,color:C.purple},
                        {label:"총 클릭수",   value:camps.reduce((s,c)=>s+c.clicks,0).toLocaleString(),color:C.good},
                        {label:"총 LPV",      value:camps.reduce((s,c)=>s+c.lpv,0).toLocaleString(),color:C.sage},
                        {label:"평균 CPC",    value:`₩${Math.round(camps.reduce((s,c)=>s+c.spend,0)/Math.max(camps.reduce((s,c)=>s+c.clicks,0),1)).toLocaleString()}`,color:C.gold},
                        {label:"평균 CTR",    value:`${camps.length?+(camps.reduce((s,c)=>s+c.ctr,0)/camps.length).toFixed(2):0}%`,color:C.rose},
                        {label:"총 광고수",   value:`${camps.length}개`,color:C.inkMid},
                      ].map((s,i)=>(
                        <div key={i} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
                          <div style={{fontSize:9,color:C.inkLt,fontWeight:700,letterSpacing:"0.1em"}}>{s.label}</div>
                          <div style={{fontSize:18,fontWeight:900,color:s.color,marginTop:4}}>{s.value}</div>
                        </div>
                      ))}
                    </div>
                    <Card>
                      <CardTitle title={campTab==="conversion"?"전환 캠페인":"트래픽 캠페인"}
                        sub={campTab==="conversion"?"CPA · LPV율 중심":"CPC · CTR 중심"}/>
                      <div style={{overflowX:"auto"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:500}}>
                          <thead><tr style={{borderBottom:`2px solid ${C.border}`}}>
                            {(campTab==="conversion"
                              ?["광고명","광고세트","광고비","클릭","구매","전환값","CPA","ROAS","LPV율"]
                              :["광고명","광고세트","광고비","클릭","LPV","CPC","CTR","LPV율"]
                            ).map(h=>(
                              <th key={h} style={{padding:"8px 8px",textAlign:h==="캠페인"?"left":"right",
                                color:C.inkLt,fontWeight:700,fontSize:9,whiteSpace:"nowrap"}}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>{camps.map((c,i)=>{
                            const cpaOk=c.cpa>0&&c.cpa<=16000, cpcOk=c.cpc<=130, ctrOk=c.ctr>=3, lpvOk=c.lpvRate>=65;
                            return(<tr key={i} style={{borderBottom:`1px solid ${C.border}`,transition:"background 0.15s"}}
                              onMouseEnter={e=>e.currentTarget.style.background=C.cream}
                              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                              {/* 광고명 */}
                              <td style={{padding:"10px 8px",maxWidth:180}}>
                                <div style={{fontWeight:700,color:C.ink,fontSize:11,wordBreak:"break-all"}}>{c.name}</div>
                              </td>
                              {/* 광고세트명 */}
                              <td style={{padding:"10px 8px",maxWidth:160}}>
                                <div style={{fontSize:10,color:C.inkMid,wordBreak:"break-all"}}>{c.adset||"—"}</div>
                              </td>
                              <td style={{padding:"10px 8px",textAlign:"right",color:C.inkMid,fontSize:10}}>₩{Math.round(c.spend/1000).toLocaleString()}K</td>
                              <td style={{padding:"10px 8px",textAlign:"right",color:C.inkMid}}>{c.clicks.toLocaleString()}</td>
                              {campTab==="conversion" ? <>
                                <td style={{padding:"10px 8px",textAlign:"right",fontWeight:800,color:C.good}}>{c.purchases}</td>
                                <td style={{padding:"10px 8px",textAlign:"right",fontSize:10,color:C.inkMid}}>
                                  {c.convValue>0?`₩${Math.round(c.convValue/1000).toLocaleString()}K`:"—"}
                                </td>
                                <td style={{padding:"10px 8px",textAlign:"right"}}>
                                  {c.cpa>0?<span style={{fontWeight:800,fontSize:11,color:cpaOk?C.good:C.bad,background:cpaOk?"#EDF7F1":"#FEF0F0",padding:"2px 7px",borderRadius:20}}>₩{c.cpa.toLocaleString()}</span>:<span style={{color:C.inkLt}}>—</span>}
                                </td>
                                <td style={{padding:"10px 8px",textAlign:"right"}}>
                                  {c.roas>0?<span style={{fontWeight:800,fontSize:11,color:c.roas>=3?C.good:C.warn,background:c.roas>=3?"#EDF7F1":"#FFF8EC",padding:"2px 7px",borderRadius:20}}>{c.roas}x</span>:<span style={{color:C.inkLt}}>—</span>}
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
                              <td style={{padding:"10px 8px",textAlign:"right"}}>
                                <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:5}}>
                                  <div style={{width:32,height:4,background:C.border,borderRadius:2,overflow:"hidden"}}>
                                    <div style={{height:"100%",width:`${Math.min(c.lpvRate,100)}%`,background:lpvOk?C.sage:C.warn,borderRadius:2}}/>
                                  </div>
                                  <span style={{fontWeight:700,color:lpvOk?C.sage:C.warn,fontSize:10}}>{c.lpvRate}%</span>
                                </div>
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
              <Btn variant="danger" onClick={()=>{setSheetUrl("");setMetaRaw([]);setMetaStatus("idle");setSheetModal(false);}}
                style={{width:"100%",marginTop:8}}>
                🗑 연결 해제
              </Btn>
            )}
          </Modal>
        )}
      </div>
    );
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ✨ 인플루언서 (이전과 동일 구조)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const infKpi=[
    {label:"총 도달수",   value:infs.reduce((s,f)=>s+(f.reach||0),0)>0?(infs.reduce((s,f)=>s+(f.reach||0),0)/1000).toFixed(0)+"K":"—",change:+18.4,good:"high",icon:"👁",note:"기록 완료 기준"},
    {label:"총 저장수",   value:infs.reduce((s,f)=>s+(f.saves||0),0).toLocaleString()||"—",change:+24.1,good:"high",icon:"🔖",note:"콘텐츠 저장"},
    {label:"전환수",      value:infs.reduce((s,f)=>s+(f.conv||0),0)+"건",change:+14.2,good:"high",icon:"🛒",note:"구매 전환"},
    {label:"영상 수령",   value:`${infs.filter(f=>f.videoReceived).length}/${infs.length}명`,change:0,good:"high",icon:"🎬",note:"콘텐츠 확보"},
    {label:"2차 활용가능",value:`${infs.filter(f=>{ const rs=reusableStatus(f); return rs.label.includes("활용가능"); }).length}명`,change:0,good:"high",icon:"♻️",note:"3개월 이내"},
    {label:"메타 활용",   value:`${infs.filter(f=>f.metaUsed).length}명`,change:0,good:"high",icon:"📣",note:"광고 소재 활용"},
  ];
  const tierData=[
    {name:"매크로",value:infs.filter(f=>f.tier==="매크로").length,color:C.rose},
    {name:"미드",  value:infs.filter(f=>f.tier==="미드").length,  color:C.gold},
    {name:"마이크로",value:infs.filter(f=>f.tier==="마이크로").length,color:C.sage},
    {name:"나노",  value:infs.filter(f=>f.tier==="나노").length,  color:C.purple},
  ].filter(d=>d.value>0);

  const InfluencerSection=()=>(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
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
        <Card>
          <CardTitle title="티어별 구성" sub="등록된 인플루언서"/>
          {tierData.length>0?(
            <>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={tierData} cx="50%" cy="50%" innerRadius={30} outerRadius={52} dataKey="value" paddingAngle={3}>
                    {tierData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                  <Tooltip formatter={v=>`${v}명`} contentStyle={{background:C.white,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}/>
                </PieChart>
              </ResponsiveContainer>
              {tierData.map((d,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:10,
                  padding:"3px 0",borderBottom:i<tierData.length-1?`1px solid ${C.border}`:"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:7,height:7,borderRadius:2,background:d.color}}/>
                    <span style={{color:C.inkMid}}>{d.name}</span>
                  </div>
                  <span style={{fontWeight:700,color:C.ink}}>{d.value}명</span>
                </div>
              ))}
            </>
          ):(
            <div style={{textAlign:"center",padding:"24px 0",color:C.inkLt,fontSize:11}}>인플루언서를 추가하세요</div>
          )}
        </Card>
        <Card>
          <CardTitle title="기록 현황"/>
          {[
            {label:"기록 완료",count:infs.filter(f=>insightStatus(f).label==="기록완료").length,color:C.good},
            {label:"기록 대기",count:infs.filter(f=>insightStatus(f).label.includes("D-")).length,color:C.inkLt},
            {label:"입력 필요",count:overdueIns.length,color:C.warn},
            {label:"미게시",   count:infs.filter(f=>insightStatus(f).label==="미게시").length,color:C.inkLt},
          ].map((row,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"8px 0",borderBottom:i<3?`1px solid ${C.border}`:"none"}}>
              <span style={{fontSize:11,color:C.inkMid}}>{row.label}</span>
              <span style={{fontSize:18,fontWeight:900,color:row.color}}>{row.count}명</span>
            </div>
          ))}
          <div style={{marginTop:10,padding:"10px 12px",background:C.blush,borderRadius:10}}>
            <div style={{fontSize:10,fontWeight:700,color:C.rose}}>📅 다음 기록 예정</div>
            <div style={{fontSize:10,color:C.inkMid,marginTop:3,lineHeight:1.7}}>
              {infs.filter(f=>f.postedDate&&f.reach===null)
                .sort((a,b)=>new Date(addDays(a.postedDate,7))-new Date(addDays(b.postedDate,7)))
                .slice(0,2).map(f=><div key={f.id}>{f.name} · {addDays(f.postedDate,7)}</div>)}
              {infs.filter(f=>f.postedDate&&f.reach===null).length===0&&"없음"}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle title="인플루언서별 시딩 현황" sub="게시일 기준 D+7 인사이트 기록"
          action={<Btn small onClick={()=>{setInfF({...eInf});setInfModal("add")}}>+ 추가</Btn>}/>
        {infs.length===0&&(
          <div style={{textAlign:"center",padding:"32px 0",color:C.inkLt,fontSize:12}}>
            아직 등록된 인플루언서가 없어요<br/>
            <Btn style={{marginTop:12}} onClick={()=>{setInfF({...eInf});setInfModal("add")}}>+ 첫 번째 추가</Btn>
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {infs.map(f=>{
            const st=insightStatus(f);
            const tc={매크로:C.rose,미드:C.gold,마이크로:C.sage,나노:C.purple}[f.tier]||C.inkMid;
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
                      <div style={{fontSize:12,fontWeight:800,color:C.ink}}>{f.name}</div>
                      <div style={{fontSize:10,color:C.inkLt}}>
                        <span style={{color:tc,fontWeight:700}}>{f.tier}</span>{" · "}{f.followers}{" · "}{f.product}
                      </div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,fontWeight:700,color:st.color,background:st.bg,
                      padding:"3px 10px",borderRadius:20,whiteSpace:"nowrap"}}>{st.icon} {st.label}</span>
                    {st.label!=="기록완료"&&st.label!=="미게시"&&(
                      <Btn variant="ghost" small onClick={()=>{
                        setInsF({id:f.id,name:f.name,reach:"",saves:"",clicks:"",conv:""});
                        setInsModal(true);
                      }}>✏️ 기록</Btn>
                    )}
                    <Btn variant="neutral" small onClick={()=>{setInfF(f);setInfModal("edit")}}>수정</Btn>
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
                  <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,
                    color:f.videoReceived?C.good:C.inkLt,
                    background:f.videoReceived?"#EDF7F1":C.cream,
                    border:`1px solid ${f.videoReceived?C.good+"44":C.border}`}}>
                    🎬 {f.videoReceived?"영상수령":"미수령"}
                  </span>
                  {/* 2차 활용 가능 여부 */}
                  {(()=>{ const rs=reusableStatus(f); return(
                    <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,
                      color:rs.color,background:rs.bg,border:`1px solid ${rs.color}44`}}>
                      ♻️ {rs.label}
                    </span>
                  );})()}
                  {/* 메타 광고 활용 */}
                  <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,
                    color:f.metaUsed?C.purple:C.inkLt,
                    background:f.metaUsed?C.purpleLt:C.cream,
                    border:`1px solid ${f.metaUsed?C.purple+"44":C.border}`}}>
                    📣 {f.metaUsed?"메타광고 활용":"미활용"}
                  </span>
                </div>
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

      {infModal&&(
        <Modal title={infModal==="add"?"인플루언서 추가":"인플루언서 수정"} onClose={()=>setInfModal(null)}>
          <FR label="계정명 *"><Inp value={infF.name} onChange={v=>setInfF(f=>({...f,name:v}))} placeholder="@계정명"/></FR>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <FR label="플랫폼"><Sel value={infF.platform} onChange={v=>setInfF(f=>({...f,platform:v}))} options={["인스타","유튜브","틱톡"]}/></FR>
            <FR label="티어"><Sel value={infF.tier} onChange={v=>setInfF(f=>({...f,tier:v}))} options={["매크로","미드","마이크로","나노"]}/></FR>
          </div>
          <FR label="팔로워"><Inp value={infF.followers} onChange={v=>setInfF(f=>({...f,followers:v}))} placeholder="42K"/></FR>
          <FR label="시딩 제품"><Inp value={infF.product} onChange={v=>setInfF(f=>({...f,product:v}))} placeholder="세럼 30ml"/></FR>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <FR label="발송 수량"><Inp type="number" value={infF.sent} onChange={v=>setInfF(f=>({...f,sent:v}))} placeholder="0"/></FR>
            <FR label="게시 확인 수"><Inp type="number" value={infF.posted} onChange={v=>setInfF(f=>({...f,posted:v}))} placeholder="0"/></FR>
          </div>
          <FR label="게시일 (D+7 자동 계산)">
            <Inp type="date" value={infF.postedDate||""} onChange={v=>setInfF(f=>({...f,postedDate:v}))}/>
          </FR>
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:4,marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:800,color:C.ink,marginBottom:10}}>📹 콘텐츠 활용</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[
                {key:"videoReceived", label:"🎬 영상 수령 완료"},
                {key:"reusable",      label:"♻️ 2차 활용 가능 (게시일+3개월)"},
                {key:"metaUsed",      label:"📣 메타 광고 소재로 활용"},
              ].map(({key,label})=>(
                <label key={key} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",
                  padding:"8px 12px",borderRadius:9,border:`1px solid ${infF[key]?C.rose+"55":C.border}`,
                  background:infF[key]?C.blush:C.cream,transition:"all 0.15s"}}>
                  <div onClick={()=>setInfF(f=>({...f,[key]:!f[key]}))}
                    style={{width:18,height:18,borderRadius:5,flexShrink:0,cursor:"pointer",
                      background:infF[key]?C.rose:C.white,border:`2px solid ${infF[key]?C.rose:C.border}`,
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {infF[key]&&<span style={{color:C.white,fontSize:11,fontWeight:900}}>✓</span>}
                  </div>
                  <span style={{fontSize:11,fontWeight:600,color:infF[key]?C.rose:C.inkMid}}
                    onClick={()=>setInfF(f=>({...f,[key]:!f[key]}))}>{label}</span>
                </label>
              ))}
            </div>
          </div>
          <Btn onClick={saveInf} style={{width:"100%",marginTop:8}}>💾 저장</Btn>
        </Modal>
      )}
      {insModal&&(
        <Modal title="📊 인사이트 기록" onClose={()=>setInsModal(null)}>
          <div style={{fontSize:11,color:C.rose,fontWeight:700,marginBottom:16,background:C.blush,padding:"8px 12px",borderRadius:8}}>
            {insF.name} — 게시 후 7일 데이터</div>
          {[{k:"reach",l:"👁 도달수",p:"52000"},{k:"saves",l:"🔖 저장수",p:"640"},{k:"clicks",l:"🔗 링크 클릭",p:"480"},{k:"conv",l:"🛒 구매 전환",p:"34"}].map(({k,l,p})=>(
            <FR key={k} label={l}><Inp type="number" value={insF[k]} onChange={v=>setInsF(f=>({...f,[k]:v}))} placeholder={`예: ${p}`}/></FR>
          ))}
          <Btn onClick={saveIns} style={{width:"100%",marginTop:8}}>💾 저장</Btn>
        </Modal>
      )}
    </div>
  );

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
  const InventorySection=()=>(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {dangerInv.length>0&&(<div style={{background:"#FEF0F0",border:`1px solid ${C.bad}44`,borderRadius:12,padding:"12px 14px",display:"flex",gap:10}}><span style={{fontSize:18}}>🚨</span><div><div style={{fontSize:12,fontWeight:800,color:C.bad}}>즉시 발주 — {dangerInv.map(i=>i.name).join(", ")}</div><div style={{fontSize:10,color:C.inkMid,marginTop:2}}>가용 재고 7일치 미만</div></div></div>)}
      {cautionInv.length>0&&(<div style={{background:"#FFF8EC",border:`1px solid ${C.warn}44`,borderRadius:12,padding:"12px 14px",display:"flex",gap:10}}><span style={{fontSize:18}}>⚠️</span><div><div style={{fontSize:12,fontWeight:800,color:C.warn}}>주의 — {cautionInv.map(i=>i.name).join(", ")}</div><div style={{fontSize:10,color:C.inkMid,marginTop:2}}>14~21일 내 소진 예상</div></div></div>)}
      <KpiGrid items={invKpi} cols={6}/>
      <Card>
        <CardTitle title="전체 재고 현황" sub="가용 · 예약 · 재고일수"
          action={<Btn small onClick={()=>{setInvF({name:"",sku:"",category:"",stock:"",ordered:"",reorder:"",sold30:""});setInvModal("add")}}>+ 추가</Btn>}/>
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
                    <Btn variant="ghost" small onClick={()=>{setInvF(item);setInvModal("edit")}}>수정</Btn>
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
      {invModal&&(
        <Modal title={invModal==="add"?"상품 추가":"재고 수정"} onClose={()=>setInvModal(null)}>
          <FR label="상품명 *"><Inp value={invF.name} onChange={v=>setInvF(f=>({...f,name:v}))} placeholder="세럼 30ml"/></FR>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <FR label="SKU"><Inp value={invF.sku} onChange={v=>setInvF(f=>({...f,sku:v}))} placeholder="SKU-001"/></FR>
            <FR label="카테고리"><Inp value={invF.category} onChange={v=>setInvF(f=>({...f,category:v}))} placeholder="세럼"/></FR>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <FR label="현재 재고"><Inp type="number" value={invF.stock} onChange={v=>setInvF(f=>({...f,stock:v}))} placeholder="0"/></FR>
            <FR label="주문 수량 (입고예정)"><Inp type="number" value={invF.ordered} onChange={v=>setInvF(f=>({...f,ordered:v}))} placeholder="0"/></FR>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <FR label="발주 기준"><Inp type="number" value={invF.reorder} onChange={v=>setInvF(f=>({...f,reorder:v}))} placeholder="300"/></FR>
            <FR label="30일 판매량"><Inp type="number" value={invF.sold30} onChange={v=>setInvF(f=>({...f,sold30:v}))} placeholder="0"/></FR>
          </div>
          <Btn onClick={saveInv} style={{width:"100%",marginTop:8}}>💾 저장</Btn>
        </Modal>
      )}
    </div>
  );

  const upcoming=sch.filter(s=>s.status!=="완료").sort((a,b)=>new Date(a.date)-new Date(b.date));
  const done=sch.filter(s=>s.status==="완료");
  const ScheduleSection=()=>(
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
          action={<Btn small onClick={()=>{setSchF({type:"공구",title:"",date:"",endDate:"",platform:"",note:"",status:"예정"});setSchModal("add")}}>+ 일정 추가</Btn>}/>
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
                  <Btn variant="ghost" small onClick={()=>{setSchF(s);setSchModal("edit")}}>✏️</Btn>
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
      {schModal&&(
        <Modal title={schModal==="add"?"일정 추가":"일정 수정"} onClose={()=>setSchModal(null)}>
          <FR label="유형"><Sel value={schF.type} onChange={v=>setSchF(f=>({...f,type:v}))} options={["공구","시딩","광고","이벤트"]}/></FR>
          <FR label="제목 *"><Inp value={schF.title} onChange={v=>setSchF(f=>({...f,title:v}))} placeholder="세럼 30ml 공구 오픈"/></FR>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <FR label="시작일 *"><Inp type="date" value={schF.date} onChange={v=>setSchF(f=>({...f,date:v}))}/></FR>
            <FR label="종료일"><Inp type="date" value={schF.endDate} onChange={v=>setSchF(f=>({...f,endDate:v}))}/></FR>
          </div>
          <FR label="플랫폼"><Inp value={schF.platform} onChange={v=>setSchF(f=>({...f,platform:v}))} placeholder="네이버 스마트스토어"/></FR>
          <FR label="메모"><Inp value={schF.note} onChange={v=>setSchF(f=>({...f,note:v}))} placeholder="한도 수량, 할인율 등"/></FR>
          <FR label="상태"><Sel value={schF.status} onChange={v=>setSchF(f=>({...f,status:v}))} options={["예정","준비중","진행중","완료"]}/></FR>
          <Btn onClick={saveSch} style={{width:"100%",marginTop:8}}>💾 저장</Btn>
        </Modal>
      )}
    </div>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return(
    <div className="oa-layout" style={{background:C.cream,minHeight:"100vh",fontFamily:"'Noto Sans KR',sans-serif",color:C.ink}}>
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
            {todayStr}
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
            padding:"4px 10px",borderRadius:20,border:`1px solid ${C.rose}33`}}>{todayStr}</div>
        </div>
      </header>

      {/* ── 콘텐츠 영역 ── */}
      <div className="oa-body">
        <main className="oa-main">
          {sec==="home"        && <HomeSection/>}
          {sec==="meta"        && <MetaSection/>}
          {sec==="influencer"  && <InfluencerSection/>}
          {sec==="inventory"   && <InventorySection/>}
          {sec==="schedule"    && <ScheduleSection/>}
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
    </div>
  );
}
