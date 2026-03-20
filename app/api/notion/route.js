export const dynamic = 'force-dynamic';

const SCHEDULE_DB_ID = "32964cd9-cb02-81a5-82ce-f06d2b2fe959";

const MEMBERS = ["소리", "영서", "경은", "지수"];
const MEMBER_COLORS = {
  "소리": "#f472b6",
  "영서": "#60a5fa",
  "경은": "#34d399",
  "지수": "#a78bfa",
};

function parseProps(props) {
  const title = props["이름"]?.title?.map(t => t.plain_text).join("") || "";
  const dateRange = props["날짜"]?.date || null;
  const date = dateRange?.start || null;
  const endDate = dateRange?.end || null;
  const assignee = props["담당자"]?.select?.name || null;
  const type = props["유형"]?.select?.name || "기타";
  const status = props["상태"]?.select?.name || "예정";
  const done = props["완료"]?.checkbox || false;
  const memo = props["메모"]?.rich_text?.map(t => t.plain_text).join("") || "";
  return { title, date, endDate, assignee, type, status, done, memo };
}

export async function GET() {
  const token = process.env.NOTION_TOKEN;
  if (!token) return Response.json({ error: "NOTION_TOKEN 없음" }, { status: 500 });
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${SCHEDULE_DB_ID}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sorts: [{ property: "날짜", direction: "ascending" }],
        page_size: 100,
      }),
    });
    if (!res.ok) return Response.json({ error: `Notion 오류 ${res.status}` }, { status: res.status });
    const data = await res.json();
    const items = data.results.map(page => ({
      id: page.id,
      ...parseProps(page.properties),
      assigneeColor: MEMBER_COLORS[parseProps(page.properties).assignee] || "#c4b5fd",
    }));
    return Response.json({ items });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return Response.json({ error: "NOTION_TOKEN 없음" }, { status: 500 });
  const body = await request.json();

  if (body.action === "create") {
    const d = body.data;
    const props = {
      "이름": { title: [{ text: { content: d.title || "" } }] },
      "완료": { checkbox: false },
    };
    if (d.date) props["날짜"] = { date: { start: d.date, end: d.endDate || null } };
    if (d.assignee) props["담당자"] = { select: { name: d.assignee } };
    if (d.type) props["유형"] = { select: { name: d.type } };
    if (d.status) props["상태"] = { select: { name: d.status } };
    if (d.memo) props["메모"] = { rich_text: [{ text: { content: d.memo } }] };

    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ parent: { database_id: SCHEDULE_DB_ID }, properties: props }),
    });
    const result = await res.json();
    return Response.json({ ok: res.ok, id: result.id });
  }

  if (body.action === "update") {
    const d = body.data;
    const props = {};
    if (d.title !== undefined) props["이름"] = { title: [{ text: { content: d.title } }] };
    if (d.date !== undefined) props["날짜"] = { date: d.date ? { start: d.date, end: d.endDate || null } : null };
    if (d.assignee !== undefined) props["담당자"] = d.assignee ? { select: { name: d.assignee } } : { select: null };
    if (d.type !== undefined) props["유형"] = d.type ? { select: { name: d.type } } : { select: null };
    if (d.status !== undefined) props["상태"] = d.status ? { select: { name: d.status } } : { select: null };
    if (d.done !== undefined) props["완료"] = { checkbox: d.done };
    if (d.memo !== undefined) props["메모"] = { rich_text: [{ text: { content: d.memo } }] };

    const res = await fetch(`https://api.notion.com/v1/pages/${body.pageId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties: props }),
    });
    return Response.json({ ok: res.ok });
  }

  if (body.action === "toggle") {
    const res = await fetch(`https://api.notion.com/v1/pages/${body.pageId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties: { "완료": { checkbox: body.done } } }),
    });
    return Response.json({ ok: res.ok });
  }

  if (body.action === "delete") {
    const res = await fetch(`https://api.notion.com/v1/pages/${body.pageId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ archived: true }),
    });
    return Response.json({ ok: res.ok });
  }

  return Response.json({ error: "unknown action" }, { status: 400 });
}
