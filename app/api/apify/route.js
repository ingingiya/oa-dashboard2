export const dynamic = 'force-dynamic';

const APIFY_BASE = "https://api.apify.com/v2";

async function runActor(token, actorId, input) {
  const res = await fetch(
    `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=120`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Apify ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

// POST /api/apify
// body: { mode: "keyword" | "followers", keyword?, username?, maxResults? }
export async function POST(request) {
  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  if (!APIFY_TOKEN) return new Response(JSON.stringify({ error: "APIFY_TOKEN 없음" }), { status: 500 });

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "잘못된 요청" }), { status: 400 });
  }

  const { mode, keyword, username, maxResults = 50 } = body;

  try {
    // ── 1. 키워드 유저 검색 ──────────────────────────
    if (mode === "keyword") {
      if (!keyword) return new Response(JSON.stringify({ error: "keyword 필요" }), { status: 400 });

      const items = await runActor(APIFY_TOKEN, "apify~instagram-scraper", {
        searchType: "user",
        searchLimit: Math.min(maxResults, 100),
        resultsType: "details",
        resultsLimit: 1,
        addParentData: false,
        // 검색어
        search: keyword,
      });

      const influencers = (Array.isArray(items) ? items : [])
        .filter(u => u.username)
        .map(u => ({
          username: u.username,
          fullName: u.fullName || u.name || "",
          followers: u.followersCount ?? u.followers ?? null,
          following: u.followsCount ?? u.following ?? null,
          posts: u.postsCount ?? u.posts ?? null,
          bio: u.biography || u.bio || "",
          profileUrl: `https://www.instagram.com/${u.username}/`,
          isVerified: u.verified ?? false,
        }))
        .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0));

      return new Response(JSON.stringify({ influencers, mode }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // ── 2. 경쟁사 팔로워 수집 ────────────────────────
    if (mode === "followers") {
      if (!username) return new Response(JSON.stringify({ error: "username 필요" }), { status: 400 });

      const handle = username.replace(/^@/, "");
      const items = await runActor(APIFY_TOKEN, "jaroslavhejlek~instagram-followers", {
        username: handle,
        resultsLimit: Math.min(maxResults, 500),
      });

      const influencers = (Array.isArray(items) ? items : [])
        .filter(u => u.username)
        .map(u => ({
          username: u.username,
          fullName: u.fullName || u.full_name || "",
          followers: u.followersCount ?? u.follower_count ?? null,
          following: u.followsCount ?? u.following_count ?? null,
          posts: u.postsCount ?? u.media_count ?? null,
          bio: u.biography || u.bio || "",
          profileUrl: `https://www.instagram.com/${u.username}/`,
          isVerified: u.is_verified ?? u.verified ?? false,
        }))
        .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0));

      return new Response(JSON.stringify({ influencers, mode }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "mode는 keyword 또는 followers여야 해요" }), { status: 400 });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
