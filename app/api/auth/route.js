export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { password } = await request.json();
  const correct = process.env.TEAM_PASSWORD;
  if (!correct) return Response.json({ ok: false, error: "서버 설정 오류" }, { status: 500 });
  if (password === correct) {
    return Response.json({ ok: true });
  }
  return Response.json({ ok: false, error: "비밀번호가 틀렸어요" });
}
