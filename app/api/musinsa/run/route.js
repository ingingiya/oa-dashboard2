export const dynamic = 'force-dynamic';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // "유저명/레포명"

export async function POST() {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    return Response.json({ error: "GITHUB_TOKEN 또는 GITHUB_REPO 설정 없음" }, { status: 500 });
  }
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/scrape.yml/dispatches`,
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
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
