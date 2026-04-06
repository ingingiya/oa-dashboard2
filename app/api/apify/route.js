export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Vercel Pro: 최대 300초

const APIFY_BASE = "https://api.apify.com/v2";

// 액터 비동기 실행 → 완료될 때까지 폴링 → 결과 반환
async function runActorAndWait(token, actorId, input, timeoutSec = 240) {
  // 1. 실행 시작
  const startRes = await fetch(
    `${APIFY_BASE}/acts/${actorId}/runs?token=${token}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }
  );
  if (!startRes.ok) {
    const txt = await startRes.text();
    throw new Error(`Apify 시작 실패 ${startRes.status}: ${txt.slice(0, 300)}`);
  }
  const { data: run } = await startRes.json();
  const runId = run.id;
  const datasetId = run.defaultDatasetId;

  // 2. 완료 폴링 (2초 간격)
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`);
    const { data: runData } = await statusRes.json();
    if (runData.status === "SUCCEEDED") break;
    if (["FAILED","ABORTED","TIMED-OUT"].includes(runData.status)) {
      throw new Error(`Apify 실행 실패: ${runData.status}`);
    }
  }

  // 3. 결과 조회
  const itemsRes = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&clean=true&format=json`,
    { headers: { "Accept": "application/json" } }
  );
  if (!itemsRes.ok) throw new Error(`결과 조회 실패: ${itemsRes.status}`);
  return itemsRes.json();
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

  // 필드명 다양하게 시도
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

      const posts = await runActorAndWait(APIFY_TOKEN, "apify~instagram-hashtag-scraper", {
        hashtags: [tag],
        resultsLimit: Math.min(maxResults * 5, 500),
        addParentData: false,
      });

      if (!Array.isArray(posts) || posts.length === 0) {
        return new Response(JSON.stringify({
          influencers: [], mode, totalPosts: 0,
          _debug: { raw: posts }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      // 첫 아이템 키 확인
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
        influencers, mode, totalPosts: posts.length,
        _debug: { sampleKeys, firstItem: posts[0] }
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // ── 2. 브랜드 팔로워 수집 ─────────────────────────
    if (mode === "followers") {
      if (!username) return new Response(JSON.stringify({ error: "username 필요" }), { status: 400 });
      const handle = username.replace(/^@/, "");

      const items = await runActorAndWait(APIFY_TOKEN, "jaroslavhejlek~instagram-followers", {
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
        influencers, mode,
        _debug: { sampleKeys, firstItem: items[0] }
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // ── 3. 브랜드 해시태그 검색 (계정명 → #계정명 해시태그 포스트 작성자) ──
    if (mode === "tagged") {
      if (!username) return new Response(JSON.stringify({ error: "username 필요" }), { status: 400 });
      // 계정명을 해시태그로 변환 (공백·특수문자 제거)
      const tag = username.replace(/^@/, "").replace(/[^a-zA-Z0-9가-힣]/g, "");

      const posts = await runActorAndWait(APIFY_TOKEN, "apify~instagram-hashtag-scraper", {
        hashtags: [tag],
        resultsLimit: Math.min(maxResults * 5, 500),
        addParentData: false,
      });

      if (!Array.isArray(posts) || posts.length === 0) {
        return new Response(JSON.stringify({ influencers: [], mode, totalPosts: 0 }), {
          status: 200, headers: { "Content-Type": "application/json" }
        });
      }

      const byUser = {};
      for (const post of posts) {
        const uname = getField(post, "ownerUsername","username","owner.username");
        if (!uname) continue;
        if (!byUser[uname]) {
          byUser[uname] = {
            username: uname,
            fullName: getField(post, "ownerFullName","fullName","owner.fullName") || "",
            followers: getField(post, "ownerFollowersCount","followersCount","owner.followersCount"),
            likes: [], comments: [],
            profileUrl: `https://www.instagram.com/${uname}/`,
          };
        }
        byUser[uname].likes.push(Number(getField(post, "likesCount","likes") || 0));
        byUser[uname].comments.push(Number(getField(post, "commentsCount","comments") || 0));
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

      return new Response(JSON.stringify({ influencers, mode, totalPosts: posts.length }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "mode는 keyword / followers / tagged 중 하나여야 해요" }), { status: 400 });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
