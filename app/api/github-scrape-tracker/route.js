export const dynamic = 'force-dynamic';

const REPO = "ingingiya/oa-dashboard2";

export async function POST(request) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) return Response.json({ error: "GITHUB_TOKEN 없음" }, { status: 500 });

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/scrape-product-tracker.yml/dispatches`,
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
