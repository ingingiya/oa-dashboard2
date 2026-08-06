"use client";
// app/detail/page.tsx
// 상세페이지 생성기 — 원스톱 UI
// 흐름: ① 제품 정보 입력 → ② 컷 생성(RunPod) + 미리보기/재생성 → ③ 상세페이지 렌더 → 분할 JPG 링크
// 실사 업로드 슬롯은 브라우저에서 배경제거(@imgly/background-removal) 후 Supabase 업로드
// 설치: npm i @imgly/background-removal @supabase/supabase-js

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DEFAULT_CUTS = [
  { file: "hook.png", label: "후킹(문제제기)", prompt: "" },
  { file: "usp1.png", label: "USP 1", prompt: "" },
  { file: "usp2.png", label: "USP 2", prompt: "" },
  { file: "usp3.png", label: "USP 3", prompt: "" },
  { file: "scene1.png", label: "사용씬 1", prompt: "" },
  { file: "scene2.png", label: "사용씬 2", prompt: "" },
  { file: "cert.png", label: "인증/실험", prompt: "" },
  { file: "packshot.png", label: "팩샷(CTA)", prompt: "" },
];

export default function DetailBuilder() {
  const [slug, setSlug] = useState("cleanswingP");
  const [trigger, setTrigger] = useState("cleanswingP");
  const [cuts, setCuts] = useState(
    DEFAULT_CUTS.map((c) => ({ ...c, url: "", loading: false }))
  );
  const [productJson, setProductJson] = useState("");
  const [sliceUrls, setSliceUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState("");

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
      body: JSON.stringify({ productSlug: slug, cuts: targets }),
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
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>상세페이지 생성기</h1>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <input value={slug} onChange={(e) => setSlug(e.target.value)}
          placeholder="제품 슬러그" style={inp} />
        <input value={trigger} onChange={(e) => setTrigger(e.target.value)}
          placeholder="LoRA 트리거워드" style={inp} />
      </div>

      <h2 style={h2}>① 제품 정보 → 카피 생성</h2>
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
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
        style={{ ...inp, width: "100%", height: 90, marginTop: 12 }} />
      {form.points.map((p, i) => (
        <input key={i} value={p}
          onChange={(e) =>
            setForm((f) => ({ ...f, points: f.points.map((x, j) => (j === i ? e.target.value : x)) }))}
          placeholder={`핵심 소구점 ${i + 1}`}
          style={{ ...inp, width: "100%", marginTop: 8 }} />
      ))}
      <button onClick={generateCopy} disabled={copyBusy} style={btn}>
        {copyBusy ? "카피 생성 중… (10~20초)" : "카피 생성 (Claude)"}
      </button>

      <textarea value={productJson} onChange={(e) => setProductJson(e.target.value)}
        placeholder="카피 생성 결과 JSON (직접 수정 가능 / 붙여넣기도 가능)"
        style={{ ...inp, width: "100%", height: 160, marginTop: 12, fontFamily: "monospace" }} />

      <h2 style={h2}>② 컷 생성 / 재생성</h2>
      <button onClick={() => generateCuts(cuts.map((_, i) => i))} style={btn}>
        전체 컷 생성
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 12 }}>
        {cuts.map((c, i) => (
          <div key={c.file} style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{c.label}</div>
            <input value={c.prompt} placeholder="컷 프롬프트"
              onChange={(e) =>
                setCuts((p) => p.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))
              }
              style={{ ...inp, width: "100%", fontSize: 12, marginTop: 6 }} />
            <div style={{ marginTop: 8, aspectRatio: "1", background: "#f5f5f5", borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {c.loading ? "생성중…" : c.url
                ? <img src={c.url} style={{ width: "100%" }} />
                : <span style={{ fontSize: 12, color: "#aaa" }}>미생성</span>}
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

      <h2 style={h2}>③ 최종 렌더</h2>
      <button onClick={renderPage} style={{ ...btn, background: "#222", color: "#fff" }}>
        상세페이지 렌더 → 분할 JPG
      </button>
      {busy && <p style={{ marginTop: 8, color: "#888" }}>{busy}</p>}
      {sliceUrls.length > 0 && (
        <ul style={{ marginTop: 12 }}>
          {sliceUrls.map((u, i) => (
            <li key={u}><a href={u} target="_blank">detail_{String(i + 1).padStart(2, "0")}.jpg</a></li>
          ))}
        </ul>
      )}
    </div>
  );
}

const inp = { border: "1px solid #ddd", borderRadius: 8, padding: "8px 12px", fontSize: 14 };
const btn = { border: "1px solid #222", borderRadius: 8, padding: "10px 20px",
  fontSize: 14, fontWeight: 700, background: "#fff", cursor: "pointer", marginTop: 8 };
const btnS = { border: "1px solid #ddd", borderRadius: 6, padding: "4px 10px",
  fontSize: 12, background: "#fff", flex: 1, textAlign: "center" as const };
const h2 = { fontSize: 18, fontWeight: 800, marginTop: 28 };
