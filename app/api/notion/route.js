export const dynamic = 'force-dynamic';

const NOTION_DB_ID = "2c464cd9cb0280b9abbde125306fe8df";
const MEMBERS = ["소리", "영서", "경은", "지수"];

const MEMBER_COLORS = {
  "소리": "#f472b6",
  "영서": "#60a5fa",
  "경은": "#34d399",
  "지수": "#a78bfa",
};

function guessType(title, product) {
  const text = (title + " " + (product||"")).toLowerCase();
  if(text.includes("공구")) return "공구";
  if(text.includes("시딩") || text.includes("체험단")) return "시딩";
  if(text.includes("광고") || text.includes("ppl") || text.includes("협찬")) return "광고";
  if(text.includes("이벤트") || text.includes("프로모") || text.includes("할인")) return "이벤트";
  return "광고";
}

function extractAssignee(title) {
  // "(경은)" "(소리)" 형식 우선 매칭
  const bracketMatch = title.match(/[(\[（]([가-힣]{2,3})[)\]）]/);
  if(bracketMatch) {
    const found = MEMBERS.find(m=>bracketMatch[1].includes(m));
    if(found) return found;
  }
  // 괄호 없이 이름만 있는 경우 fallback
  for(const m of MEMBERS) {
    if(title.includes(m)) return m;
  }
  return null;
}

function parseProps(props) {
  const titleProp = props["소재명"] || props["이름"] || props["Name"] || Object.values(props).find(p=>p.type==="title");
  const title = titleProp?.title?.map(t=>t.plain_text).join("") || "";
  const dateProp = props["시작일"] || props["날짜"] || Object.values(props).find(p=>p.type==="date");
  const date = dateProp?.date?.start || null;
  const productProp = props["제품"];
  const product = productProp?.select?.name || productProp?.rich_text?.map(t=>t.plain_text).join("") || "";
  const statusProp = props["상태"];
  const status = statusProp?.status?.name || statusProp?.select?.name || "";
  const checkProp = props["체크박스"];
  const done = checkProp?.checkbox || false;
  return { title, date, product, status, done };
}

export async function GET() {
  const token = process.env.NOTION_TOKEN;
  if(!token) return Response.json({error:"NOTION_TOKEN 없음"},{status:500});
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`,{
      method:"POST",
      headers:{"Authorization":`Bearer ${token}`,"Notion-Version":"2022-06-28","Content-Type":"application/json"},
      body:JSON.stringify({sorts:[{property:"시작일",direction:"ascending"}],page_size:100}),
    });
    if(!res.ok) return Response.json({error:`Notion 오류 ${res.status}`},{status:res.status});
    const data = await res.json();
    const items = data.results.map(page=>{
      const {title,date,product,status,done} = parseProps(page.properties);
      const assignee = extractAssignee(title);
      // 담당자 이름을 제목에서 제거해서 깔끔하게 표시
      const cleanTitle = title.replace(/[(\[（][가-힣]{2,3}[)\]）]/g,"").trim();
      return {
        id: page.id,
        name: cleanTitle,
        rawTitle: title,
        date,
        product,
        status,
        done,
        assignee,
        assigneeColor: MEMBER_COLORS[assignee] || "#c4b5fd",
        select: guessType(title, product),
      };
    });
    return Response.json({items});
  } catch(e) { return Response.json({error:e.message},{status:500}); }
}

export async function POST(request) {
  const token = process.env.NOTION_TOKEN;
  if(!token) return Response.json({error:"NOTION_TOKEN 없음"},{status:500});
  const body = await request.json();

  if(body.action === "toggle") {
    const res = await fetch(`https://api.notion.com/v1/pages/${body.pageId}`,{
      method:"PATCH",
      headers:{"Authorization":`Bearer ${token}`,"Notion-Version":"2022-06-28","Content-Type":"application/json"},
      body:JSON.stringify({properties:{"체크박스":{checkbox:body.done}}}),
    });
    return Response.json({ok:res.ok});
  }

  if(body.action === "create") {
    const d = body.data;
    const res = await fetch("https://api.notion.com/v1/pages",{
      method:"POST",
      headers:{"Authorization":`Bearer ${token}`,"Notion-Version":"2022-06-28","Content-Type":"application/json"},
      body:JSON.stringify({
        parent:{database_id:NOTION_DB_ID},
        properties:{
          "소재명":{title:[{text:{content:d.name||""}}]},
          ...(d.date?{"시작일":{date:{start:d.date}}}:{}),
          ...(d.product?{"제품":{rich_text:[{text:{content:d.product}}]}}:{}),
          "체크박스":{checkbox:false},
        }
      }),
    });
    return Response.json({ok:res.ok});
  }

  if(body.action === "delete") {
    const res = await fetch(`https://api.notion.com/v1/pages/${body.pageId}`,{
      method:"PATCH",
      headers:{"Authorization":`Bearer ${token}`,"Notion-Version":"2022-06-28","Content-Type":"application/json"},
      body:JSON.stringify({archived:true}),
    });
    return Response.json({ok:res.ok});
  }

  return Response.json({error:"unknown action"},{status:400});
}
