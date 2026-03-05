// app/api/sheet/route.js
// 구글시트 CSV를 서버에서 fetch해서 CORS 우회

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return new Response(JSON.stringify({ error: "url 파라미터 필요" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 구글시트 URL → CSV export URL 변환
  let csvUrl = url;
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    const id = match[1];
    const gidMatch = url.match(/[#&?]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : "0";
    csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  }

  try {
    const res = await fetch(csvUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `구글시트 응답 오류: HTTP ${res.status}` }),
        { status: res.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const text = await res.text();
    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
