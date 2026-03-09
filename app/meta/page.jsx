'use client'

import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

// ── 팔레트 ──────────────────────────────────────
const C = {
  bg:"#0F0F13", card:"#17171E", border:"#2A2A38",
  rose:"#E8567A", gold:"#C9924A", good:"#4DAD7A",
  warn:"#E8A020", bad:"#E84B4B", purple:"#9B6FC7",
  ink:"#F0EBF4", inkMid:"#9A8FA0", inkLt:"#5A5060",
  white:"#FFFFFF",
};

// ── CSV 파서 ─────────────────────────────────────
function parseCSV(text){
  const lines = text.replace(/^\uFEFF/,"").trim().split("\n").map(l=>{
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
  const HINTS=["캠페인","campaign","날짜","date","지출","spend"];
  const startIdx = HINTS.some(h=>lines[0].join(",").toLowerCase().includes(h)) ? 0 : 1;
  const headers = lines[startIdx].map(h=>h.trim());
  return lines.slice(startIdx+1).filter(l=>l.some(c=>c)).map(row=>{
    const obj={}; headers.forEach((h,i)=>{ if(h) obj[h]=row[i]||""; }); return obj;
  });
}

function mapMetaRow(row){
  const g=(...keys)=>{ for(const k of keys){ if(row[k]!==undefined&&row[k]!=="") return row[k]; } return ""; };
  const num=v=>{ const n=parseFloat(String(v||0).replace(/,/g,"").replace(/[^0-9.-]/g,"")); return isNaN(n)?0:n; };
  return {
    date:        g("일","날짜","보고 시작","date"),
    campaign:    g("캠페인 이름","campaign_name","campaign"),
    adset:       g("광고 세트 이름","adset_name"),
    adName:      g("광고 이름","ad_name"),
    objective:   g("목표","목적","objective"),
    spend:       num(g("지출 금액 (KRW)","지출 금액","amount_spent","spend")),
    impressions: num(g("노출","impressions")),
    clicks:      num(g("링크 클릭","link_clicks")),
    clicksAll:   num(g("클릭(전체)","clicks")),
    lpv:         num(g("랜딩 페이지 조회","landing_page_views")),
    purchases:   num(g("공유 항목이 포함된 구매","결과","purchases","result")),
    convValue:   num(g("공유 항목의 구매 전환값","공유 항목의 웹사이트 구매 전환값","conversion_value")),
    cpc:         num(g("CPC(링크 클릭당 비용)","cpc")),
    ctr:         num(g("CTR(전체)","ctr")),
    cpa:         num(g("결과당 비용","cost_per_result","cpa")),
    cpm:         num(g("CPM(1,000회 노출당 비용)","cpm")),
  };
}

function isConv(objective, campaignName=""){
  const obj=(objective||"").toUpperCase();
  if(["OUTCOME_SALES","OUTCOME_ENGAGEMENT","CONVERSIONS"].includes(obj)) return true;
  if(["LINK_CLICKS","OUTCOME_TRAFFIC","REACH","BRAND_AWARENESS"].includes(obj)) return false;
  const name=(campaignName||"").toLowerCase();
  if(["전환","conversion","purchase","구매","sales"].some(k=>name.includes(k))) return true;
  return false;
}

// ── 공통 UI ──────────────────────────────────────
const Btn=({children,onClick,style={}})=>(
  <button onClick={onClick} style={{
    background:C.rose,color:C.white,border:"none",borderRadius:8,
    padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer",...style
  }}>{children}</button>
);

const KpiCard=({icon,label,value,note,accent=C.rose})=>(
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 14px",position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:accent}}/>
    <div style={{fontSize:18,marginBottom:6}}>{icon}</div>
    <div style={{fontSize:9,color:C.inkLt,fontWeight:700,letterSpacing:"0.1em",marginBottom:2}}>{label.toUpperCase()}</div>
    <div style={{fontSize:20,fontWeight:900,color:C.ink,letterSpacing:"-0.02em"}}>{value}</div>
    {note&&<div style={{fontSize:9,color:C.inkMid,marginTop:3}}>{note}</div>}
  </div>
);

const Tag=({children,color=C.inkMid,bg="transparent"})=>(
  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,
    color,background:bg,border:`1px solid ${color}44`}}>{children}</span>
);

// ── 메인 ─────────────────────────────────────────
export default function MetaDashboard(){
  const [raw, setRaw]         = useState([]);
  const [status, setStatus]   = useState("idle"); // idle | loading | ok | error
  const [url, setUrl]         = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [hidden, setHidden]   = useState([]); // 숨긴 광고명
  const [tab, setTab]         = useState("overview"); // overview | campaigns | daily

  // localStorage 복원
  useEffect(()=>{
    try{
      const saved = localStorage.getItem("oa_meta_light_url");
      if(saved){ setUrl(saved); fetchSheet(saved); }
      const h = JSON.parse(localStorage.getItem("oa_meta_light_hidden")||"[]");
      setHidden(h);
    }catch{}
  },[]);

  async function fetchSheet(sheetUrl){
    if(!sheetUrl) return;
    try{ new URL(sheetUrl); }catch{ setStatus("error"); return; }
    setStatus("loading");
    try{
      const res = await fetch(`/api/sheet?url=${encodeURIComponent(sheetUrl)}`);
      if(!res.ok) throw new Error();
      const text = await res.text();
      const rows = parseCSV(text).map(mapMetaRow).filter(r=>r.date||r.campaign);
      setRaw(rows);
      setStatus(rows.length>0?"ok":"error");
    }catch{ setStatus("error"); }
  }

  function saveUrl(v){
    setUrl(v);
    try{ localStorage.setItem("oa_meta_light_url", v); }catch{}
    fetchSheet(v);
    setShowModal(false);
  }

  function toggleHide(key){
    setHidden(prev=>{
      const next = prev.includes(key)?prev.filter(x=>x!==key):[...prev,key];
      try{ localStorage.setItem("oa_meta_light_hidden", JSON.stringify(next)); }catch{}
      return next;
    });
  }

  // ── 집계 ─────────────────────────────────────
  const filtered = raw.filter(r=>!hidden.includes(r.adName||r.campaign||""));
  const fmt = n => n>=10000?`₩${Math.round(n/1000).toLocaleString()}K`:`₩${Math.round(n).toLocaleString()}`;

  const total = filtered.reduce((s,r)=>({
    spend:      s.spend+r.spend,
    clicks:     s.clicks+r.clicks,
    lpv:        s.lpv+r.lpv,
    purchases:  s.purchases+r.purchases,
    convValue:  s.convValue+r.convValue,
    impressions:s.impressions+r.impressions,
  }),{spend:0,clicks:0,lpv:0,purchases:0,convValue:0,impressions:0});

  const avgCtr = filtered.length ? filtered.reduce((s,r)=>s+r.ctr,0)/filtered.length : 0;
  const avgCpc = total.clicks>0 ? total.spend/total.clicks : 0;
  const avgCpa = total.purchases>0 ? total.spend/total.purchases : 0;
  const lpvRate = total.clicks>0 ? (total.lpv/total.clicks)*100 : 0;
  const roas = total.spend>0 ? total.convValue/total.spend : 0;

  // 일별 집계
  const dailyMap={};
  filtered.forEach(r=>{
    if(!r.date) return;
    if(!dailyMap[r.date]) dailyMap[r.date]={date:r.date,spend:0,lpv:0,purchases:0,clicks:0};
    dailyMap[r.date].spend     +=r.spend;
    dailyMap[r.date].lpv       +=r.lpv;
    dailyMap[r.date].purchases +=r.purchases;
    dailyMap[r.date].clicks    +=r.clicks;
  });
  const daily = Object.values(dailyMap).sort((a,b)=>a.date.localeCompare(b.date));

  // 캠페인별 집계
  const campMap={};
  filtered.forEach(r=>{
    const key=r.campaign||"미분류";
    if(!campMap[key]) campMap[key]={name:key,spend:0,clicks:0,lpv:0,purchases:0,convValue:0,objective:r.objective,rows:[]};
    campMap[key].spend     +=r.spend;
    campMap[key].clicks    +=r.clicks;
    campMap[key].lpv       +=r.lpv;
    campMap[key].purchases +=r.purchases;
    campMap[key].convValue +=r.convValue;
    campMap[key].rows.push(r);
  });
  const camps = Object.values(campMap).sort((a,b)=>b.spend-a.spend);

  // 광고별 집계 (숨기기용)
  const adMap={};
  raw.forEach(r=>{
    const key=r.adName||r.campaign||"";
    if(!key) return;
    if(!adMap[key]) adMap[key]={key,spend:0,clicks:0,lpv:0,purchases:0,campaign:r.campaign};
    adMap[key].spend    +=r.spend;
    adMap[key].clicks   +=r.clicks;
    adMap[key].lpv      +=r.lpv;
    adMap[key].purchases+=r.purchases;
  });
  const ads = Object.values(adMap).sort((a,b)=>b.spend-a.spend);

  // ── UI ───────────────────────────────────────
  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.ink,fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif",padding:"24px 20px"}}>

      {/* 헤더 */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
        <div>
          <div style={{fontSize:20,fontWeight:900,letterSpacing:"-0.03em"}}>
            📣 <span style={{color:C.rose}}>Meta</span> Ads
          </div>
          <div style={{fontSize:11,color:C.inkLt,marginTop:2}}>
            {status==="ok"?`${raw.length}행 로드됨 · ${hidden.length>0?`${hidden.length}개 숨김 · `:""}${daily.length}일`:
             status==="loading"?"로딩 중...":
             status==="error"?"연결 실패":"시트 미연결"}
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {status==="ok"&&<Btn onClick={()=>fetchSheet(url)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.inkMid}}>🔄</Btn>}
          {hidden.length>0&&<Btn onClick={()=>{setHidden([]);try{localStorage.removeItem("oa_meta_light_hidden");}catch{}}} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.warn,fontSize:11}}>↩ 복원({hidden.length})</Btn>}
          <Btn onClick={()=>{setUrlInput(url);setShowModal(true);}}>
            {status==="ok"?"⚙️ 시트":"🔗 시트 연결"}
          </Btn>
        </div>
      </div>

      {/* KPI */}
      {status==="ok"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,marginBottom:20}}>
          <KpiCard icon="💸" label="총 광고비"   value={fmt(total.spend)}    note={`${daily.length}일 합산`}  accent={C.rose}/>
          <KpiCard icon="🛬" label="LPV"         value={total.lpv.toLocaleString()} note={`LPV율 ${lpvRate.toFixed(1)}%`} accent={C.purple}/>
          <KpiCard icon="💡" label="CPC"         value={`₩${Math.round(avgCpc).toLocaleString()}`} note="클릭당 비용" accent={C.gold}/>
          <KpiCard icon="📊" label="CTR"         value={`${avgCtr.toFixed(2)}%`}    note="평균 클릭률"  accent={C.good}/>
          <KpiCard icon="🎯" label="CPA"         value={avgCpa>0?fmt(avgCpa):"—"}   note="전환당 비용"  accent={C.warn}/>
          <KpiCard icon="🔁" label="ROAS"        value={roas>0?`${roas.toFixed(2)}x`:"—"} note="광고비 대비 매출" accent={C.good}/>
        </div>
      )}

      {/* 탭 */}
      {status==="ok"&&(
        <>
          <div style={{display:"flex",gap:4,marginBottom:16}}>
            {[["overview","📈 추이"],["campaigns","🗂 캠페인"],["ads","📋 광고 관리"]].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)} style={{
                padding:"7px 16px",borderRadius:8,border:`1px solid ${tab===k?C.rose:C.border}`,
                background:tab===k?C.rose+"22":"transparent",
                color:tab===k?C.rose:C.inkMid,fontSize:12,fontWeight:700,cursor:"pointer"
              }}>{l}</button>
            ))}
          </div>

          {/* 추이 탭 */}
          {tab==="overview"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px"}}>
                <div style={{fontSize:12,fontWeight:800,marginBottom:12}}>일별 광고비</div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={daily}>
                    <defs>
                      <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.rose} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={C.rose} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                    <XAxis dataKey="date" tick={{fontSize:10,fill:C.inkLt}} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:C.inkLt}} tickLine={false} axisLine={false} tickFormatter={v=>`₩${(v/1000).toFixed(0)}K`}/>
                    <Tooltip formatter={v=>`₩${Math.round(v).toLocaleString()}`} contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}/>
                    <Area type="monotone" dataKey="spend" stroke={C.rose} strokeWidth={2} fill="url(#gSpend)" name="광고비"/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px"}}>
                  <div style={{fontSize:12,fontWeight:800,marginBottom:12}}>일별 LPV</div>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                      <XAxis dataKey="date" tick={{fontSize:9,fill:C.inkLt}} tickLine={false}/>
                      <YAxis tick={{fontSize:9,fill:C.inkLt}} tickLine={false} axisLine={false}/>
                      <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}/>
                      <Bar dataKey="lpv" fill={C.purple} name="LPV" radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px"}}>
                  <div style={{fontSize:12,fontWeight:800,marginBottom:12}}>일별 전환</div>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                      <XAxis dataKey="date" tick={{fontSize:9,fill:C.inkLt}} tickLine={false}/>
                      <YAxis tick={{fontSize:9,fill:C.inkLt}} tickLine={false} axisLine={false}/>
                      <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}/>
                      <Bar dataKey="purchases" fill={C.good} name="전환" radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* 캠페인 탭 */}
          {tab==="campaigns"&&(
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr style={{background:C.bg}}>
                    {["캠페인","유형","광고비","LPV","CPC","CTR","전환","ROAS"].map(h=>(
                      <th key={h} style={{padding:"10px 12px",textAlign:"left",color:C.inkMid,fontWeight:700,fontSize:10,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {camps.map((c,i)=>{
                    const conv = isConv(c.objective, c.name);
                    const cpc  = c.clicks>0 ? c.spend/c.clicks : 0;
                    const ctr  = c.rows.length ? c.rows.reduce((s,r)=>s+r.ctr,0)/c.rows.length : 0;
                    const roas = c.spend>0 ? c.convValue/c.spend : 0;
                    return(
                      <tr key={i} style={{borderTop:`1px solid ${C.border}`}}>
                        <td style={{padding:"10px 12px",color:C.ink,fontWeight:600,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</td>
                        <td style={{padding:"10px 12px"}}><Tag color={conv?C.rose:C.purple} bg={conv?C.rose+"22":C.purple+"22"}>{conv?"전환":"트래픽"}</Tag></td>
                        <td style={{padding:"10px 12px",fontWeight:700,color:C.rose}}>{fmt(c.spend)}</td>
                        <td style={{padding:"10px 12px",color:C.ink}}>{c.lpv.toLocaleString()}</td>
                        <td style={{padding:"10px 12px",color:C.ink}}>₩{Math.round(cpc).toLocaleString()}</td>
                        <td style={{padding:"10px 12px",color:C.ink}}>{ctr.toFixed(2)}%</td>
                        <td style={{padding:"10px 12px",color:c.purchases>0?C.good:C.inkLt}}>{c.purchases}</td>
                        <td style={{padding:"10px 12px",color:roas>1?C.good:roas>0?C.warn:C.inkLt}}>{roas>0?`${roas.toFixed(2)}x`:"—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 광고 관리 탭 (숨기기) */}
          {tab==="ads"&&(
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {ads.map((ad,i)=>{
                const isHidden = hidden.includes(ad.key);
                const cpc = ad.clicks>0 ? ad.spend/ad.clicks : 0;
                return(
                  <div key={i} style={{background:C.card,border:`1px solid ${isHidden?C.border+"44":C.border}`,borderRadius:10,
                    padding:"10px 14px",display:"flex",alignItems:"center",gap:12,opacity:isHidden?0.4:1,transition:"opacity 0.2s"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ad.key}</div>
                      <div style={{fontSize:10,color:C.inkMid,marginTop:1}}>{ad.campaign}</div>
                    </div>
                    <div style={{display:"flex",gap:20,fontSize:11,whiteSpace:"nowrap"}}>
                      <span style={{color:C.rose,fontWeight:700}}>{fmt(ad.spend)}</span>
                      <span style={{color:C.inkMid}}>LPV {ad.lpv.toLocaleString()}</span>
                      <span style={{color:C.inkMid}}>CPC ₩{Math.round(cpc).toLocaleString()}</span>
                      {ad.purchases>0&&<span style={{color:C.good}}>전환 {ad.purchases}</span>}
                    </div>
                    <button onClick={()=>toggleHide(ad.key)} style={{
                      padding:"4px 12px",borderRadius:6,border:`1px solid ${C.border}`,
                      background:"transparent",color:isHidden?C.good:C.warn,
                      fontSize:10,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"
                    }}>{isHidden?"복원":"숨기기"}</button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 미연결 상태 */}
      {status==="idle"&&(
        <div style={{textAlign:"center",padding:"60px 0",color:C.inkLt}}>
          <div style={{fontSize:40,marginBottom:16}}>📊</div>
          <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>메타 광고 시트를 연결하세요</div>
          <div style={{fontSize:12,marginBottom:20}}>구글 시트 URL을 입력하면 광고 데이터가 자동으로 불러와져요</div>
          <Btn onClick={()=>setShowModal(true)}>🔗 시트 연결</Btn>
        </div>
      )}
      {status==="loading"&&(
        <div style={{textAlign:"center",padding:"60px 0",color:C.inkMid,fontSize:13}}>⏳ 불러오는 중...</div>
      )}
      {status==="error"&&(
        <div style={{textAlign:"center",padding:"60px 0"}}>
          <div style={{color:C.bad,fontSize:13,fontWeight:700,marginBottom:12}}>연결 실패 — URL 또는 시트 공유 설정을 확인하세요</div>
          <Btn onClick={()=>{setUrl("");try{localStorage.removeItem("oa_meta_light_url");}catch{} setStatus("idle");}} style={{background:"transparent",border:`1px solid ${C.bad}`,color:C.bad}}>URL 초기화</Btn>
        </div>
      )}

      {/* 시트 연결 모달 */}
      {showModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}}
          onClick={()=>setShowModal(false)}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"24px",width:480,maxWidth:"90vw"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:14,fontWeight:800,marginBottom:16}}>🔗 메타 시트 연결</div>
            <div style={{fontSize:11,color:C.inkMid,marginBottom:14,lineHeight:1.6,background:C.bg,padding:"10px 12px",borderRadius:8}}>
              메타 광고관리자 → 보고서 → CSV 내보내기 후 구글시트에 붙여넣고 공유 URL을 입력하세요
            </div>
            <input
              value={urlInput}
              onChange={e=>setUrlInput(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${C.border}`,
                background:C.bg,color:C.ink,fontSize:12,boxSizing:"border-box",outline:"none",marginBottom:12}}
            />
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>saveUrl(urlInput)} style={{flex:1}}>연결</Btn>
              {url&&<Btn onClick={()=>{setUrl("");setStatus("idle");try{localStorage.removeItem("oa_meta_light_url");}catch{} setShowModal(false);}}
                style={{background:"transparent",border:`1px solid ${C.border}`,color:C.warn}}>해제</Btn>}
              <Btn onClick={()=>setShowModal(false)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.inkMid}}>취소</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
