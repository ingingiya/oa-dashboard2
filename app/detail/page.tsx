"use client";
// app/detail/page.tsx
// 상세페이지 생성기 — 원스톱 UI
// 흐름: ① 제품 정보 입력 → ② 컷 생성(Comfy Cloud 나노바나나2 + 실사 앵커) + 미리보기/재생성 → ③ 상세페이지 렌더 → 분할 JPG 링크
// 실사 업로드 슬롯은 브라우저에서 배경제거(@imgly/background-removal) 후 Supabase 업로드
// 설치: npm i @imgly/background-removal @supabase/supabase-js

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DEFAULT_CUTS = [
  { file: "hook.png", label: "후킹(문제제기)",
    prompt: "Dramatic hero shot: the product floating upright on a dark charcoal background, single spotlight from above, subtle rim light, cinematic premium product photography." },
  { file: "usp1.png", label: "USP 1",
    prompt: "Extreme close-up of the key functional part of the product, pure white background, crisp studio product photo." },
  { file: "usp2.png", label: "USP 2",
    prompt: "The product standing upright, clean white background, soft studio lighting, minimal product photo." },
  { file: "usp3.png", label: "USP 3",
    prompt: "Close-up of the product's control/display detail, soft light-gray gradient background, premium tech product photo." },
  { file: "scene1.png", label: "사용씬 1",
    prompt: "Lifestyle shot: the product placed in its natural home environment, soft morning window light, airy clean interior." },
  { file: "scene2.png", label: "사용씬 2",
    prompt: "Lifestyle shot: the product on a marble shelf with a small green plant, warm cozy evening light, shallow depth of field." },
  { file: "cert.png", label: "인증/실험",
    prompt: "The product on a clean cool blue gradient background, clinical laboratory mood, subtle floating light particles, trust concept." },
  { file: "packshot.png", label: "팩샷(CTA)",
    prompt: "Clean front-view packshot: the product on a pure white background, even studio lighting, e-commerce product photo." },
];

export default function DetailBuilder() {
  const [slug, setSlug] = useState("cleanswingP");
  const [trigger, setTrigger] = useState("cleanswingP");
  const [anchorUrl, setAnchorUrl] = useState(
    "https://lugqeflqusqsyotdiaxg.supabase.co/storage/v1/object/public/detail-assets/cleanswingP/anchor.jpg"
  );
  const [cuts, setCuts] = useState(
    DEFAULT_CUTS.map((c) => ({ ...c, url: "", loading: false }))
  );
  const [productJson, setProductJson] = useState("");
  const [sliceUrls, setSliceUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState("");

  // ── 피그마 템플릿 동기화 ──
  const [figmaUrl, setFigmaUrl] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  async function syncFigma() {
    if (!figmaUrl) return alert("피그마 파일 링크를 입력하세요");
    setSyncBusy(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/detail/figma-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ figmaUrl }),
      }).then((r) => r.json());
      if (!res.ok) throw new Error(res.error || "동기화 실패");
      setSyncMsg(
        `동기화 완료 — 섹션 ${res.sections.length}개: ` +
          res.sections.map((s: any) => `${s.name}(${s.placeholders.length})`).join(", ")
      );
    } catch (e: any) {
      setSyncMsg("실패: " + e.message);
    } finally {
      setSyncBusy(false);
    }
  }

  // ── 카피 생성 폼 ──
  const [form, setForm] = useState({
    productName: "",
    category: "",
    specs: "",
    points: ["", "", ""],
    tagline: "현명한 당신, 오아하시네요",
  });
  const [copyBusy, setCopyBusy] = useState(false);

  async function generateCopy() {
    if (!form.productName) return alert("제품명을 입력하세요");
    setCopyBusy(true);
    try {
      const res = await fetch("/api/detail/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then((r) => r.json());
      if (!res.ok) throw new Error(res.error || "카피 생성 실패");
      setProductJson(JSON.stringify(res.product, null, 2));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCopyBusy(false);
    }
  }

  // ── 컷 생성 (개별/전체 동일 라우트) ──
  async function generateCuts(indices: number[]) {
    setCuts((p) => p.map((c, i) => (indices.includes(i) ? { ...c, loading: true } : c)));
    const targets = indices.map((i) => ({
      file: cuts[i].file,
      prompt: `${trigger}, ${cuts[i].prompt}`,
    }));
    const res = await fetch("/api/detail/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productSlug: slug, cuts: targets, anchorUrl }),
    }).then((r) => r.json());

    setCuts((p) =>
      p.map((c) => {
        const hit = res.results?.find((r: any) => r.file === c.file);
        return hit
          ? { ...c, url: hit.url + "?t=" + Date.now(), loading: false }
          : { ...c, loading: false };
      })
    );
  }

  // ── 실사 업로드 (브라우저 배경제거) ──
  async function uploadReal(idx: number, file: File) {
    setCuts((p) => p.map((c, i) => (i === idx ? { ...c, loading: true } : c)));
    // 번들 제외(CDN 로드) — onnxruntime이 next 빌드를 깨서 webpackIgnore 필수
    const { removeBackground } = await import(
      /* webpackIgnore: true */ "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/dist/browser.mjs" as any
    );
    const blob = await removeBackground(file); // WASM, 브라우저에서 처리

    // 흰 배경 합성
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0);
    const jpg: Blob = await new Promise((r) =>
      canvas.toBlob((b) => r(b!), "image/jpeg", 0.92)
    );

    const path = `${slug}/${cuts[idx].file}`;
    await supabase.storage
      .from("detail-assets")
      .upload(path, jpg, { contentType: "image/jpeg", upsert: true });
    const { data } = supabase.storage.from("detail-assets").getPublicUrl(path);
    setCuts((p) =>
      p.map((c, i) =>
        i === idx ? { ...c, url: data.publicUrl + "?t=" + Date.now(), loading: false } : c
      )
    );
  }

  // ── 최종 렌더 ──
  async function renderPage() {
    setBusy("렌더링 중… (30초~1분)");
    const product = JSON.parse(productJson);
    // 컷 URL을 product JSON에 주입
    const u = (f: string) => cuts.find((c) => c.file === f)?.url || "";
    product.hook.image = u("hook.png");
    product.usp[0].image = u("usp1.png");
    product.usp[1].image = u("usp2.png");
    product.usp[2].image = u("usp3.png");
    product.scene.images = [u("scene1.png"), u("scene2.png")];
    product.cert.image = u("cert.png");
    product.cta.image = u("packshot.png");

    const res = await fetch("/api/detail/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    }).then((r) => r.json());
    setSliceUrls(res.urls || []);
    setBusy(res.ok ? "" : "실패: " + res.error);
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Pretendard','Noto Sans KR',sans-serif" }}>
      <style>{`@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
        *{box-sizing:border-box} input:focus,textarea:focus{border-color:#0071E3 !important}`}</style>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px 60px" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/" style={{ fontSize: 13, fontWeight: 700, color: C.inkMid, textDecoration: "none",
            background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "7px 14px" }}>← 대시보드</a>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: "-0.02em" }}>상세페이지 생성기</h1>
        </div>

        <div style={card}>
          <div style={cardTitle}>기본 설정</div>
          <div style={cardSub}>슬러그는 저장 폴더명 · 앵커는 제품 실사 공개 URL(나노바나나가 이 이미지 그대로 그려요)</div>
          <div style={{ display: "flex", gap: 12 }}>
            <input value={slug} onChange={(e) => setSlug(e.target.value)}
              placeholder="제품 슬러그" style={{ ...inp, flex: 1 }} />
            <input value={trigger} onChange={(e) => setTrigger(e.target.value)}
              placeholder="제품명(프롬프트 접두어)" style={{ ...inp, flex: 1 }} />
          </div>
          <input value={anchorUrl} onChange={(e) => setAnchorUrl(e.target.value)}
            placeholder="앵커 실사 이미지 URL (필수)" style={{ ...inp, width: "100%", marginTop: 8 }} />
        </div>

        <div style={card}>
          <div style={cardTitle}>피그마 템플릿 동기화</div>
          <div style={cardSub}>
            {"디자인 수정 후 딸깍 — sec: 프레임 + {{경로}} 레이어(숨김) 규칙, 미동기화 시 기본 템플릿 사용"}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <input value={figmaUrl} onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder="https://www.figma.com/design/..." style={{ ...inp, flex: 1 }} />
            <button onClick={syncFigma} disabled={syncBusy}
              style={{ ...btn, marginTop: 0, opacity: syncBusy ? 0.6 : 1 }}>
              {syncBusy ? "동기화 중…" : "피그마 동기화"}
            </button>
          </div>
          {syncMsg && <p style={{ marginTop: 8, fontSize: 13, color: syncMsg.startsWith("실패") ? "#D70015" : C.inkMid }}>{syncMsg}</p>}
        </div>

        <div style={card}>
          <div style={cardTitle}>① 제품 정보 → 카피 생성</div>
          <div style={cardSub}>스펙·소구점을 넣으면 Claude가 상세페이지 전체 카피(JSON)를 만들어요</div>
          <div style={{ display: "flex", gap: 12 }}>
            <input value={form.productName}
              onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
              placeholder="제품명 (예: 클린이스윙P)" style={{ ...inp, flex: 1 }} />
            <input value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="카테고리 (예: 음파전동칫솔)" style={{ ...inp, flex: 1 }} />
          </div>
          <textarea value={form.specs}
            onChange={(e) => setForm((f) => ({ ...f, specs: e.target.value }))}
            placeholder={"스펙 (줄 단위)\n진동수: 분당 38,000회\n충전: USB-C\n방수: IPX7"}
            style={{ ...inp, width: "100%", height: 90, marginTop: 10, resize: "vertical" as const }} />
          {form.points.map((p, i) => (
            <input key={i} value={p}
              onChange={(e) =>
                setForm((f) => ({ ...f, points: f.points.map((x, j) => (j === i ? e.target.value : x)) }))}
              placeholder={`핵심 소구점 ${i + 1}`}
              style={{ ...inp, width: "100%", marginTop: 8 }} />
          ))}
          <button onClick={generateCopy} disabled={copyBusy}
            style={{ ...btn, opacity: copyBusy ? 0.6 : 1 }}>
            {copyBusy ? "카피 생성 중… (10~20초)" : "카피 생성 (Claude)"}
          </button>
          <textarea value={productJson} onChange={(e) => setProductJson(e.target.value)}
            placeholder="카피 생성 결과 JSON (직접 수정 가능 / 붙여넣기도 가능)"
            style={{ ...inp, width: "100%", height: 160, marginTop: 12, fontFamily: "monospace", fontSize: 12 }} />
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={cardTitle}>② 컷 생성 / 재생성</div>
              <div style={cardSub}>AI 생성(LoRA) 또는 실사 업로드(자동 배경제거) — 슬롯별로 섞어 써도 돼요</div>
            </div>
            <button onClick={() => generateCuts(cuts.map((_, i) => i))} style={{ ...btn, marginTop: 0 }}>
              전체 컷 생성
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 4 }}>
            {cuts.map((c, i) => (
              <div key={c.file} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: 10, background: C.white }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.ink }}>{c.label}</div>
                <input value={c.prompt} placeholder="컷 프롬프트"
                  onChange={(e) =>
                    setCuts((p) => p.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))
                  }
                  style={{ ...inp, width: "100%", fontSize: 12, marginTop: 6, padding: "6px 8px" }} />
                <div style={{ marginTop: 8, aspectRatio: "1", background: C.bg, borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {c.loading ? <span style={{ fontSize: 12, color: C.rose, fontWeight: 700 }}>생성중…</span> : c.url
                    ? <img src={c.url} style={{ width: "100%" }} />
                    : <span style={{ fontSize: 12, color: C.inkLt }}>미생성</span>}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button onClick={() => generateCuts([i])} style={{ ...btnS }}>재생성</button>
                  <label style={{ ...btnS, cursor: "pointer" }}>
                    실사
                    <input type="file" accept="image/*" hidden
                      onChange={(e) => e.target.files?.[0] && uploadReal(i, e.target.files[0])} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>③ 최종 렌더</div>
          <div style={cardSub}>서버에서 860px 상세페이지를 렌더해 세로 분할 JPG로 업로드해요</div>
          <button onClick={renderPage} style={btn}>
            상세페이지 렌더 → 분할 JPG
          </button>
          {busy && <p style={{ marginTop: 8, fontSize: 13, color: C.inkLt }}>{busy}</p>}
          {sliceUrls.length > 0 && (
            <ul style={{ marginTop: 12, listStyle: "none", padding: 0 }}>
              {sliceUrls.map((u, i) => (
                <li key={u} style={{ padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                  <a href={u} target="_blank" style={{ fontSize: 13, fontWeight: 700, color: C.rose, textDecoration: "none" }}>
                    detail_{String(i + 1).padStart(2, "0")}.jpg
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

const C = { rose: "#0071E3", blush: "#EAF3FF", ink: "#1D1D1F", inkMid: "#515154",
  inkLt: "#86868B", border: "#E5E5EA", bg: "#F5F5F7", white: "#FFFFFF" };
const inp = { border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px",
  fontSize: 13, fontFamily: "inherit", outline: "none", background: C.white, color: C.ink };
const btn = { border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13,
  fontWeight: 800 as const, background: C.rose, color: "#fff", cursor: "pointer", marginTop: 10,
  fontFamily: "inherit", boxShadow: "0 4px 12px rgba(0,113,227,.25)" };
const btnS = { border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 10px",
  fontSize: 12, fontWeight: 700 as const, background: C.white, color: C.inkMid, flex: 1,
  textAlign: "center" as const, cursor: "pointer", fontFamily: "inherit" };
const card = { background: C.white, border: "1px solid rgba(0,0,0,.06)", borderRadius: 18,
  padding: "20px 18px", boxShadow: "0 2px 8px rgba(0,0,0,.04)", marginTop: 16 };
const cardTitle = { fontSize: 14, fontWeight: 800 as const, color: C.ink, letterSpacing: "-0.02em" };
const cardSub = { fontSize: 12, color: C.inkLt, marginTop: 2, marginBottom: 12 };
