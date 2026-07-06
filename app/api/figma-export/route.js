export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// 피그마 REST API를 통해 기획안 구조를 코멘트로 남기기
// (Slides 파일은 Plugin API 제한이 있어서 코멘트 방식 사용)

export async function POST(req) {
  const token = process.env.FIGMA_TOKEN;
  if (!token) return Response.json({ error: 'FIGMA_TOKEN 없음' }, { status: 500 });

  try {
    const { fileKey, plan } = await req.json();
    if (!fileKey || !plan) return Response.json({ error: 'fileKey, plan 필수' }, { status: 400 });

    // 기획안을 마크다운 형태로 변환
    let md = `# ${plan.productName || '상세 기획안'}\n\n`;
    md += `**메인 카피:** ${plan.mainCopy || ''}\n`;
    md += `**서브 카피:** ${plan.subCopy || ''}\n`;
    if (plan.techBranding) md += `**기술 브랜딩:** ${plan.techBranding}\n`;
    md += `\n---\n\n`;

    // 슬라이드 구성
    if (plan.slides?.length) {
      md += `## 슬라이드 구성 (${plan.slides.length}p)\n\n`;
      plan.slides.forEach(s => {
        md += `### p${s.page}. [${s.type}] ${s.title}\n`;
        if (s.copy) md += `- 카피: ${s.copy}\n`;
        if (s.imageGuide) md += `- 이미지: ${s.imageGuide}\n`;
        if (s.notes) md += `- 노트: ${s.notes}\n`;
        md += `\n`;
      });
    }

    // 핵심 기능
    if (plan.features?.length) {
      md += `## 핵심 기능\n`;
      plan.features.forEach(f => {
        md += `- **${f.title}**: ${f.description}\n`;
      });
      md += `\n`;
    }

    // 비교표
    if (plan.comparisonTable?.rows?.length) {
      md += `## 비교표\n`;
      const h = plan.comparisonTable.headers || [];
      md += `| ${h.join(' | ')} |\n`;
      md += `| ${h.map(() => '---').join(' | ')} |\n`;
      plan.comparisonTable.rows.forEach(row => {
        md += `| ${row.join(' | ')} |\n`;
      });
      md += `\n`;
    }

    // 스펙
    if (plan.specs?.length) {
      md += `## 스펙\n`;
      plan.specs.forEach(s => {
        md += `- ${s.label}: ${s.value}\n`;
      });
    }

    // 피그마 코멘트로 남기기
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/comments`, {
      method: 'POST',
      headers: {
        'X-Figma-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: md,
        client_meta: { x: 0, y: 0 },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: `피그마 API 오류: ${err}` }, { status: res.status });
    }

    const result = await res.json();
    return Response.json({ ok: true, commentId: result.id, message: '피그마에 기획안 코멘트가 추가되었습니다' });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
