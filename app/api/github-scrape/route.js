export const dynamic = 'force-dynamic';

const REPO = "ingingiya/oa-dashboard2";

const WORKFLOWS = {
  musinsa:    "scrape-musinsa.yml",
  oliveyoung: "scrape-oliveyoung.yml",
};

export async function POST(request) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) return Response.json({ error: "GITHUB_TOKEN 없음" }, { status: 500 });

  const { platform } = await request.json();
  const workflow = WORKFLOWS[platform];
  if (!workflow) return Response.json({ error: "platform은 musinsa / oliveyoung" }, { status: 400 });

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    }
  );

  if (res.status === 204) return Response.json({ ok: true });
  const text = await res.text();
  return Response.json({ error: text }, { status: res.status });
}
