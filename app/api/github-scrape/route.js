export const dynamic = 'force-dynamic';

const REPO = "ingingiya/oa-dashboard2";
const VALID_PLATFORMS = ["all", "musinsa", "oliveyoung", "zigzag", "ably", "kakao_gift"];

export async function POST(request) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) return Response.json({ error: "GITHUB_TOKEN 없음" }, { status: 500 });

  const { platform } = await request.json();
  if (!VALID_PLATFORMS.includes(platform)) return Response.json({ error: "지원하지 않는 플랫폼" }, { status: 400 });

  const workflow = "scrape-market.yml";

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main", inputs: { platform } }),
    }
  );

  if (res.status === 204) return Response.json({ ok: true });
  const text = await res.text();
  return Response.json({ error: text }, { status: res.status });
}
