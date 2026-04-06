export const dynamic = 'force-dynamic';

// POST /api/apify
// body: { hashtag: string, minLikes: number, maxResults: number }
// returns: { influencers: [{username, fullName, postCount, avgLikes, avgComments, sampleUrl}] }
export async function POST(request) {
  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  if (!APIFY_TOKEN) {
    return new Response(JSON.stringify({ error: "APIFY_TOKEN 환경변수가 없습니다" }), { status: 500 });
  }

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "잘못된 요청" }), { status: 400 });
  }

  const { hashtag, minLikes = 0, maxResults = 200 } = body;
  if (!hashtag) {
    return new Response(JSON.stringify({ error: "hashtag 필요" }), { status: 400 });
  }

  const tag = hashtag.replace(/^#/, "");

  try {
    // Apify Instagram Hashtag Scraper - sync run
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hashtags: [tag],
          resultsLimit: maxResults,
          addParentData: false,
        }),
      }
    );

    if (!apifyRes.ok) {
      const errText = await apifyRes.text();
      return new Response(JSON.stringify({ error: `Apify 오류: ${apifyRes.status} ${errText}` }), { status: 502 });
    }

    const posts = await apifyRes.json();
    if (!Array.isArray(posts)) {
      return new Response(JSON.stringify({ error: "Apify 응답 형식 오류" }), { status: 502 });
    }

    // Group posts by username
    const byUser = {};
    for (const post of posts) {
      const username = post.ownerUsername || post.username;
      if (!username) continue;
      const likes = post.likesCount || post.likesTotalCount || 0;
      const comments = post.commentsCount || post.commentsCount || 0;
      if (likes < minLikes) continue;

      if (!byUser[username]) {
        byUser[username] = {
          username,
          fullName: post.ownerFullName || post.fullName || "",
          posts: [],
          sampleUrl: post.url || `https://www.instagram.com/${username}/`,
          profileUrl: `https://www.instagram.com/${username}/`,
        };
      }
      byUser[username].posts.push({ likes, comments });
    }

    const influencers = Object.values(byUser)
      .map(u => ({
        username: u.username,
        fullName: u.fullName,
        postCount: u.posts.length,
        avgLikes: Math.round(u.posts.reduce((s, p) => s + p.likes, 0) / u.posts.length),
        avgComments: Math.round(u.posts.reduce((s, p) => s + p.comments, 0) / u.posts.length),
        sampleUrl: u.sampleUrl,
        profileUrl: u.profileUrl,
      }))
      .sort((a, b) => b.avgLikes - a.avgLikes);

    return new Response(JSON.stringify({ influencers, totalPosts: posts.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
