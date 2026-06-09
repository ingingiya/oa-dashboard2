export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Vercel Pro: 최대 300초

const APIFY_BASE = "https://api.apify.com/v2";

// 액터 동기 실행 → 결과 바로 반환 (폴링 없음)
async function runActorSync(token, actorId, input, timeoutSec = 120) {
  const res = await fetch(
    `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSec}&clean=true&format=json`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Apify 실패 ${res.status}: ${txt.slice(0, 300)}`);
  }
  const items = await res.json();
  return { items };
}

// POST /api/apify
export async function POST(request) {
  const APIFY_TOKEN = process.env.APIFY_TOKEN;
  if (!APIFY_TOKEN) return new Response(JSON.stringify({ error: "APIFY_TOKEN 없음" }), { status: 500 });

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "잘못된 요청" }), { status: 400 });
  }

  const { mode, keyword, username, maxResults = 50, minFollowers, maxFollowers } = body;
  const minF = minFollowers ? Number(minFollowers) : 0;
  const maxF = maxFollowers ? Number(maxFollowers) : Infinity;
  const passF = (f) => f == null || (f >= minF && f <= maxF);

  const getField = (obj, ...keys) => {
    for (const k of keys) {
      const val = k.includes(".") ? k.split(".").reduce((o, p) => o?.[p], obj) : obj[k];
      if (val != null) return val;
    }
    return null;
  };

  try {
    // ── 1. 키워드 → 해시태그 게시물 작성자 ──────────────
    if (mode === "keyword") {
      if (!keyword) return new Response(JSON.stringify({ error: "keyword 필요" }), { status: 400 });
      const tag = keyword.trim().replace(/^#/, "").replace(/\s+/g, "");

      const { items: posts, usageUsd: kwUsage } = await runActorAndWait(APIFY_TOKEN, "apify~instagram-hashtag-scraper", {
        hashtags: [tag],
        resultsLimit: Math.min(maxResults * 5, 500),
        addParentData: false,
      });

      if (!Array.isArray(posts) || posts.length === 0) {
        return new Response(JSON.stringify({
          influencers: [], mode, totalPosts: 0, usageUsd: kwUsage,
          _debug: { raw: posts }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      const sampleKeys = Object.keys(posts[0]);
      const byUser = {};
      for (const post of posts) {
        const uname = getField(post, "ownerUsername","username","owner.username","authorUsername","author.username");
        if (!uname) continue;
        if (!byUser[uname]) {
          byUser[uname] = {
            username: uname,
            fullName: getField(post, "ownerFullName","fullName","owner.fullName","authorFullName","author.fullName") || "",
            followers: getField(post, "ownerFollowersCount","followersCount","owner.followersCount","followersCount"),
            likes: [], comments: [],
            profileUrl: `https://www.instagram.com/${uname}/`,
          };
        }
        byUser[uname].likes.push(Number(getField(post, "likesCount","likes","likeCount") || 0));
        byUser[uname].comments.push(Number(getField(post, "commentsCount","comments","commentCount") || 0));
      }

      const influencers = Object.values(byUser)
        .map(u => ({
          username: u.username,
          fullName: u.fullName,
          followers: u.followers ? Number(u.followers) : null,
          posts: u.likes.length,
          avgLikes: Math.round(u.likes.reduce((s,v)=>s+v,0)/Math.max(u.likes.length,1)),
          avgComments: Math.round(u.comments.reduce((s,v)=>s+v,0)/Math.max(u.comments.length,1)),
          bio: "",
          profileUrl: u.profileUrl,
          isVerified: false,
        }))
        .filter(u => passF(u.followers))
        .sort((a,b) => b.avgLikes - a.avgLikes)
        .slice(0, maxResults);

      return new Response(JSON.stringify({
        influencers, mode, totalPosts: posts.length, usageUsd: kwUsage,
        _debug: { sampleKeys, firstItem: posts[0] }
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // ── 2. 브랜드 팔로워 수집 ─────────────────────────
    if (mode === "followers") {
      if (!username) return new Response(JSON.stringify({ error: "username 필요" }), { status: 400 });
      const handle = username.replace(/^@/, "");

      const { items, usageUsd: flUsage } = await runActorAndWait(APIFY_TOKEN, "jaroslavhejlek~instagram-followers", {
        username: handle,
        resultsLimit: Math.min(maxResults, 500),
      });

      const sampleKeys = items[0] ? Object.keys(items[0]) : [];
      const influencers = (Array.isArray(items) ? items : [])
        .filter(u => getField(u, "username"))
        .map(u => ({
          username: getField(u, "username"),
          fullName: getField(u, "fullName","full_name","name") || "",
          followers: Number(getField(u, "followersCount","follower_count","followers") || 0) || null,
          posts: Number(getField(u, "postsCount","media_count","posts") || 0) || null,
          avgLikes: null, avgComments: null,
          bio: getField(u, "biography","bio") || "",
          profileUrl: `https://www.instagram.com/${getField(u,"username")}/`,
          isVerified: getField(u, "is_verified","verified","isVerified") || false,
        }))
        .filter(u => passF(u.followers))
        .sort((a,b) => (b.followers||0) - (a.followers||0))
        .slice(0, maxResults);

      return new Response(JSON.stringify({
        influencers, mode, usageUsd: flUsage,
        _debug: { sampleKeys, firstItem: items[0] }
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // ── 3. 프로필 URL → 단일 계정 조회 ────
    if (mode === "profile_url") {
      if (!username) return new Response(JSON.stringify({ error: "username 필요" }), { status: 400 });
      const handle = username.replace(/^@/, "");
      const profileUrl = `https://www.instagram.com/${handle}/`;

      const { items: profItems } = await runActorSync(APIFY_TOKEN, "apify~instagram-scraper", {
        directUrls: [profileUrl],
        resultsType: "details",
        resultsLimit: 1,
        maxRequestsPerCrawl: 10,
      });

      const u = Array.isArray(profItems) ? profItems[0] : null;
      if (!u) return new Response(JSON.stringify({ profile: null }), { status: 200 });

      return new Response(JSON.stringify({
        profile: {
          username: getField(u, "username","userName"),
          fullName: getField(u, "fullName","full_name","name") || "",
          followers: Number(getField(u, "followersCount","follower_count","followers") || 0) || null,
          profilePicUrl: getField(u, "profilePicUrl","profilePicUrlHD","profile_pic_url") || null,
          bio: getField(u, "biography","bio","description") || "",
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "mode는 keyword / followers / profile_url 중 하나여야 해요" }), { status: 400 });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
