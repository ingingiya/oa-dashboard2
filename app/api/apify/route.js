export const dynamic = 'force-dynamic';

const APIFY_BASE = "https://api.apify.com/v2";

async function runActor(token, actorId, input, timeout = 120) {
  const res = await fetch(
    `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=${timeout}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Apify ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

// POST /api/apify
// body: { mode: "keyword"|"followers"|"tagged", keyword?, username?, maxResults?, minFollowers?, maxFollowers? }
export async function POST(request) {
  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  if (!APIFY_TOKEN) return new Response(JSON.stringify({ error: "APIFY_TOKEN 환경변수가 없습니다" }), { status: 500 });

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "잘못된 요청" }), { status: 400 });
  }

  const { mode, keyword, username, maxResults = 100, minFollowers, maxFollowers } = body;
  const minF = minFollowers ? Number(minFollowers) : 0;
  const maxF = maxFollowers ? Number(maxFollowers) : Infinity;

  // 팔로워 수 필터 (followers 값이 있는 경우만 필터링, 없으면 통과)
  const passFollowerFilter = (followers) => {
    if (followers == null) return true; // 데이터 없으면 통과
    return followers >= minF && followers <= maxF;
  };

  try {
    // ── 1. 키워드 → 해시태그 게시물 작성자 추출 ──────────
    if (mode === "keyword") {
      if (!keyword) return new Response(JSON.stringify({ error: "keyword 필요" }), { status: 400 });
      const tag = keyword.trim().replace(/^#/, "").replace(/\s+/g, "");

      const posts = await runActor(APIFY_TOKEN, "apify~instagram-hashtag-scraper", {
        hashtags: [tag],
        resultsLimit: Math.min(maxResults * 4, 800),
        addParentData: false,
      });

      if (!Array.isArray(posts)) throw new Error("Apify 응답 형식 오류");

      const byUser = {};
      for (const post of posts) {
        const uname = post.ownerUsername || post.username;
        if (!uname) continue;
        if (!byUser[uname]) {
          byUser[uname] = {
            username: uname,
            fullName: post.ownerFullName || post.fullName || "",
            followers: post.ownerFollowersCount ?? post.followersCount ?? null,
            likes: [], comments: [],
            profileUrl: `https://www.instagram.com/${uname}/`,
          };
        }
        byUser[uname].likes.push(post.likesCount || 0);
        byUser[uname].comments.push(post.commentsCount || 0);
      }

      const influencers = Object.values(byUser)
        .map(u => ({
          username: u.username,
          fullName: u.fullName,
          followers: u.followers,
          posts: u.likes.length,
          avgLikes: Math.round(u.likes.reduce((s,v)=>s+v,0)/u.likes.length),
          avgComments: Math.round(u.comments.reduce((s,v)=>s+v,0)/u.comments.length),
          bio: "",
          profileUrl: u.profileUrl,
          isVerified: false,
        }))
        .filter(u => passFollowerFilter(u.followers))
        .sort((a, b) => b.avgLikes - a.avgLikes)
        .slice(0, maxResults);

      return new Response(JSON.stringify({ influencers, mode, totalPosts: posts.length }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // ── 2. 경쟁사/브랜드 팔로워 수집 ─────────────────────
    if (mode === "followers") {
      if (!username) return new Response(JSON.stringify({ error: "username 필요" }), { status: 400 });
      const handle = username.replace(/^@/, "");

      const items = await runActor(APIFY_TOKEN, "jaroslavhejlek~instagram-followers", {
        username: handle,
        resultsLimit: Math.min(maxResults * 2, 1000),
      });

      const influencers = (Array.isArray(items) ? items : [])
        .filter(u => u.username)
        .map(u => ({
          username: u.username,
          fullName: u.fullName || u.full_name || "",
          followers: u.followersCount ?? u.follower_count ?? null,
          posts: u.postsCount ?? u.media_count ?? null,
          avgLikes: null, avgComments: null,
          bio: u.biography || u.bio || "",
          profileUrl: `https://www.instagram.com/${u.username}/`,
          isVerified: u.is_verified ?? u.verified ?? false,
        }))
        .filter(u => passFollowerFilter(u.followers))
        .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0))
        .slice(0, maxResults);

      return new Response(JSON.stringify({ influencers, mode }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // ── 3. 브랜드 계정 태그한 게시물 작성자 수집 ──────────
    if (mode === "tagged") {
      if (!username) return new Response(JSON.stringify({ error: "username 필요" }), { status: 400 });
      const handle = username.replace(/^@/, "");

      // 브랜드 계정에 태그된 포스트 = 해당 계정 멘션한 포스트
      // apify/instagram-scraper로 tagged posts 스크래핑
      const posts = await runActor(APIFY_TOKEN, "apify~instagram-scraper", {
        directUrls: [`https://www.instagram.com/${handle}/tagged/`],
        resultsType: "posts",
        resultsLimit: Math.min(maxResults * 3, 600),
        addParentData: false,
      });

      if (!Array.isArray(posts)) throw new Error("Apify 응답 형식 오류");

      const byUser = {};
      for (const post of posts) {
        const uname = post.ownerUsername || post.username;
        if (!uname || uname === handle) continue; // 브랜드 본계정 제외
        if (!byUser[uname]) {
          byUser[uname] = {
            username: uname,
            fullName: post.ownerFullName || post.fullName || "",
            followers: post.ownerFollowersCount ?? null,
            likes: [], comments: [],
            profileUrl: `https://www.instagram.com/${uname}/`,
          };
        }
        byUser[uname].likes.push(post.likesCount || 0);
        byUser[uname].comments.push(post.commentsCount || 0);
      }

      const influencers = Object.values(byUser)
        .map(u => ({
          username: u.username,
          fullName: u.fullName,
          followers: u.followers,
          posts: u.likes.length,
          avgLikes: Math.round(u.likes.reduce((s,v)=>s+v,0)/u.likes.length),
          avgComments: Math.round(u.comments.reduce((s,v)=>s+v,0)/u.comments.length),
          bio: "",
          profileUrl: u.profileUrl,
          isVerified: false,
        }))
        .filter(u => passFollowerFilter(u.followers))
        .sort((a, b) => b.avgLikes - a.avgLikes)
        .slice(0, maxResults);

      return new Response(JSON.stringify({ influencers, mode, totalPosts: posts.length }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "mode는 keyword / followers / tagged 중 하나여야 해요" }), { status: 400 });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
