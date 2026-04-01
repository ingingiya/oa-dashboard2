export const dynamic = 'force-dynamic';

const FIGMA_API = "https://api.figma.com/v1";

// 제네릭 이름 판별 (Frame 1, Rectangle 3 등)
function isGenericName(name) {
  return /^(frame|rectangle|group|image|vector|section)\s*\d*$/i.test(name.trim());
}

// 트리에서 모든 프레임/컴포넌트/소재 수집
function collectFrames(node, depth = 0) {
  const frames = [];
  if (!node) return frames;

  const collectableTypes = ["FRAME", "COMPONENT", "COMPONENT_SET", "RECTANGLE", "GROUP"];
  const traversableTypes = ["FRAME", "COMPONENT", "COMPONENT_SET", "GROUP", "SECTION", "CANVAS"];

  if (
    collectableTypes.includes(node.type) &&
    depth >= 2 &&
    !isGenericName(node.name)
  ) {
    frames.push({ name: node.name, nodeId: node.id });
  }

  // SECTION, FRAME, GROUP 안쪽도 탐색 (depth 5까지)
  if (node.children && depth < 5 && traversableTypes.includes(node.type || "CANVAS")) {
    node.children.forEach(child => frames.push(...collectFrames(child, depth + 1)));
  }

  return frames;
}

export async function GET(request) {
  const token = process.env.FIGMA_TOKEN;
  if (!token) return Response.json({ error: "FIGMA_TOKEN 없음" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const fileKey = searchParams.get("fileKey");
  const search = searchParams.get("search"); // 검색어

  if (!fileKey) return Response.json({ error: "fileKey 필요" }, { status: 400 });

  const res = await fetch(`${FIGMA_API}/files/${fileKey}?depth=5`, {
    headers: { "X-Figma-Token": token },
  });
  if (!res.ok) return Response.json({ error: `Figma 오류 ${res.status}` }, { status: res.status });

  const data = await res.json();
  const allFrames = collectFrames(data.document);

  // 검색어 있으면 필터
  if (search) {
    const norm = s => s.toLowerCase().replace(/[\s_\-]/g, "");
    const needle = norm(search);
    const matched = allFrames.filter(f => {
      const hay = norm(f.name);
      return hay.includes(needle) || needle.includes(hay);
    });
    return Response.json({ frames: matched, total: allFrames.length });
  }

  return Response.json({ frames: allFrames, total: allFrames.length });
}
