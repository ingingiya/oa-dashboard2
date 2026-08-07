"use client";
// app/detail/page.tsx
// 상세페이지 생성기 — 원스톱 UI
// 흐름: ① 제품 정보 입력 → ② 컷 생성(Comfy Cloud 나노바나나2 + 실사 앵커) + 미리보기/재생성 → ③ 상세페이지 렌더 → 분할 JPG 링크
// 실사 업로드 슬롯은 브라우저에서 배경제거(@imgly/background-removal) 후 Supabase 업로드
// 설치: npm i @imgly/background-removal @supabase/supabase-js

import { useEffect, useState } from "react";
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
  const [tab, setTab] = useState<"gen" | "refs" | "hist">("gen");
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

  // ── 템플릿 레퍼런스 (따라하고 싶은 상세페이지 캡쳐 → AI가 디자인 모사 HTML 템플릿 생성) ──
  const [styleFiles, setStyleFiles] = useState<{ url: string; media_type: string }[]>([]);
  const [styleBusy, setStyleBusy] = useState("");
  const [styleActive, setStyleActive] = useState(false);
  useEffect(() => {
    fetch("/api/detail/style").then((r) => r.json())
      .then((res) => setStyleActive(!!res.active)).catch(() => {});
  }, []);

  async function addStyleFiles(list: FileList | File[]) {
    setStyleBusy("업로드 중…");
    const out: { url: string; media_type: string }[] = [];
    try {
      for (const file of Array.from(list)) {
        if (!file.type.startsWith("image/")) continue;
        const img = await createImageBitmap(file);
        // 통짜 긴 캡쳐는 AI가 읽을 수 있게 세로로 잘라서 업로드 (폭 860, 조각 높이 폭×2.2)
        const w = Math.min(img.width, 860);
        const scale = w / img.width;
        const h = Math.round(img.height * scale);
        const chunk = Math.round(w * 2.2);
        for (let y = 0; y < h && styleFiles.length + out.length < 8; y += chunk) {
          const ch = Math.min(chunk, h - y);
          if (ch < 100) break;
          const cv = document.createElement("canvas");
          cv.width = w; cv.height = ch;
          cv.getContext("2d")!.drawImage(img, 0, y / scale, img.width, ch / scale, 0, 0, w, ch);
          const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, "image/jpeg", 0.85));
          if (!blob) continue;
          const fd = new FormData();
          fd.append("file", new File([blob], "style.jpg", { type: "image/jpeg" }));
          const res = await fetch("/api/detail/copy-upload", { method: "POST", body: fd }).then((r) => r.json());
          if (!res.ok) throw new Error(res.error);
          out.push({ url: res.url, media_type: "image/jpeg" });
        }
      }
      setStyleFiles((p) => [...p, ...out].slice(0, 8));
      setStyleBusy("");
    } catch (e: any) {
      setStyleBusy("업로드 실패: " + e.message);
    }
  }

  async function applyStyle() {
    if (!styleFiles.length) return alert("따라할 상세페이지 캡쳐를 먼저 첨부하세요");
    setStyleBusy("디자인 분석 중… (1~2분)");
    try {
      const res = await fetch("/api/detail/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: styleFiles }),
      }).then((r) => r.json());
      if (!res.ok) throw new Error(res.error);
      setStyleActive(true);
      setStyleBusy("적용 완료 — 이제 최종 렌더가 이 스타일로 나와요");
    } catch (e: any) {
      setStyleBusy("실패: " + e.message);
    }
  }

  async function resetStyle() {
    await fetch("/api/detail/style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset: true }),
    });
    setStyleActive(false);
    setStyleFiles([]);
    setStyleBusy("해제됨 — 기본 템플릿으로 렌더돼요");
  }

  // ── 카피 생성 폼 ──
  const [form, setForm] = useState({
    raw: "",
    productName: "",
    category: "",
    specs: "",
    points: ["", "", ""],
    tagline: "현명한 당신, 오아하시네요",
  });
  const [copyBusy, setCopyBusy] = useState(false);
  // 첨부 자료 (제품정보 캡쳐/PDF) — Storage에 올리고 URL만 API로 전달 (Vercel 4.5MB 요청 한도 회피)
  const [copyFiles, setCopyFiles] = useState<{ name: string; media_type: string; url: string }[]>([]);

  async function addCopyFiles(list: FileList | File[]) {
    const out: { name: string; media_type: string; url: string }[] = [];
    for (const file of Array.from(list)) {
      let blob: Blob | null = null, mt = "", ext = "";
      if (file.type === "application/pdf") {
        blob = file; mt = "application/pdf"; ext = "pdf";
      } else if (file.type.startsWith("image/")) {
        // 캡쳐가 커도 되게 1600px로 축소
        const img = await createImageBitmap(file);
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
        blob = await new Promise<Blob | null>((res) => cv.toBlob(res, "image/jpeg", 0.85));
        mt = "image/jpeg"; ext = "jpg";
      }
      if (!blob) continue;
      // 서버 경유 업로드 (클라이언트 anon 키는 Storage RLS에 막힘)
      const fd = new FormData();
      fd.append("file", new File([blob], file.name, { type: mt }));
      const res = await fetch("/api/detail/copy-upload", { method: "POST", body: fd }).then((r) => r.json());
      if (!res.ok) { alert("첨부 업로드 실패: " + res.error); continue; }
      out.push({ name: file.name, media_type: mt, url: res.url });
    }
    setCopyFiles((p) => [...p, ...out].slice(0, 5));
  }

  async function generateCopy() {
    if (!form.productName && !form.raw && !copyFiles.length)
      return alert("제품 정보를 붙여넣거나 캡쳐/파일을 첨부하세요");
    setCopyBusy(true);
    try {
      const resp = await fetch("/api/detail/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, files: copyFiles.map(({ name, ...f }) => f) }),
      });
      const txt = await resp.text();
      let res: any;
      try { res = JSON.parse(txt); } catch { throw new Error("서버 응답 오류: " + txt.slice(0, 120)); }
      if (!res.ok) throw new Error(res.error || "카피 생성 실패");
      setProductJson(JSON.stringify(res.product, null, 2));
      // 통붙여넣기에서 추출된 제품명/카테고리 폼에 역반영
      setForm((f) => ({
        ...f,
        productName: f.productName || res.product.productName || "",
        category: f.category || res.product.category || "",
      }));
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
    loadHistory();
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

  // ── 사진 일괄 업로드 → AI 자동 배치 ──
  const [bulkBusy, setBulkBusy] = useState("");

  async function downscale(file: File, max = 1600): Promise<Blob> {
    const bmp = await createImageBitmap(file);
    const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * r);
    canvas.height = Math.round(bmp.height * r);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.87));
  }

  async function bulkUpload(files: FileList) {
    try {
      setBulkBusy(`업로드 중… (0/${files.length})`);
      const sign = await fetch("/api/detail/upload-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, files: Array.from(files).map((f) => f.name) }),
      }).then((r) => r.json());
      if (!sign.ok) throw new Error(sign.error);

      for (let i = 0; i < files.length; i++) {
        const blob = await downscale(files[i]);
        const { error } = await supabase.storage
          .from("detail-assets")
          .uploadToSignedUrl(sign.files[i].path, sign.files[i].token, blob, {
            contentType: "image/jpeg",
          });
        if (error) throw new Error(error.message);
        setBulkBusy(`업로드 중… (${i + 1}/${files.length})`);
      }

      setBulkBusy("AI 분석 중… (10~30초)");
      const res = await fetch("/api/detail/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productSlug: slug,
          urls: sign.files.map((f: any) => f.publicUrl),
        }),
      }).then((r) => r.json());
      if (!res.ok) throw new Error(res.error);

      setCuts((p) =>
        p.map((c) => {
          const hit = res.cuts.find((r: any) => r.file === c.file);
          return hit ? { ...c, url: hit.url + "?t=" + Date.now() } : c;
        })
      );
      if (res.anchorUrl) setAnchorUrl(res.anchorUrl);
      const placed = res.cuts.map((c: any) => c.file.replace(".png", "")).join(", ");
      setBulkBusy(
        `배치 완료 — ${placed || "없음"}${res.anchorUrl ? " + 앵커" : ""} (나머지 슬롯은 AI 생성)`
      );
      loadHistory();
    } catch (e: any) {
      setBulkBusy("실패: " + e.message);
    }
  }

  // ── 모션 레퍼런스 (와디즈 가전 상세페이지 수집분) ──
  type MotionRef = { id: string; category: "typo" | "graph" | "real"; label: string;
    url: string; product: string; keyword: string; source: string };
  const [motionRefs, setMotionRefs] = useState<MotionRef[]>([]);
  // GIF 조각: 섹션 N 뒤에 원본 GIF/영상을 캡처 없이 그대로 끼워넣기 (디자이너 저장 방식)
  const [gifRows, setGifRows] = useState<{ after: string; url: string }[]>([]);
  const [refCat, setRefCat] = useState<"all" | "typo" | "graph" | "real">("all");
  useEffect(() => {
    fetch("/api/detail/motion-refs").then((r) => r.json())
      .then((res) => { if (res.ok) setMotionRefs(res.items); }).catch(() => {});
  }, []);

  // ── 생성 기록 ──
  type HistItem = { id: string; at: string; type: string; slug: string; urls: string[]; deleted?: boolean };
  const [history, setHistory] = useState<HistItem[]>([]);
  const [histBusy, setHistBusy] = useState("");

  async function loadHistory() {
    const res = await fetch("/api/detail/history").then((r) => r.json());
    if (res.ok) setHistory(res.items);
  }
  useEffect(() => { loadHistory(); }, []);

  async function deleteHistory(id: string) {
    if (!confirm("스토리지 파일을 삭제할까요? (기록은 남습니다)")) return;
    setHistBusy(id);
    const res = await fetch("/api/detail/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).then((r) => r.json());
    if (!res.ok) alert("삭제 실패: " + res.error);
    await loadHistory();
    setHistBusy("");
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
    product.slug = slug; // 저장 폴더명 (한글 제품명 대신 기본설정 슬러그 사용)
    product.gifs = gifRows
      .map((r) => ({ after: Number(r.after) || 0, url: r.url.trim() }))
      .filter((g) => g.after > 0 && g.url);

    const res = await fetch("/api/detail/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    }).then((r) => r.json());
    setSliceUrls(res.urls || []);
    setBusy(res.ok ? "" : "실패: " + res.error);
    loadHistory();
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

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {([["gen", "생성기"], ["refs", "모션 레퍼런스"], ["hist", "생성 기록"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => { setTab(k); if (k === "hist") loadHistory(); }}
              style={{ border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 13,
                fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                background: tab === k ? C.rose : C.white, color: tab === k ? "#fff" : C.inkMid,
                boxShadow: tab === k ? "0 4px 12px rgba(0,113,227,.25)" : `inset 0 0 0 1px ${C.border}` }}>
              {label}
            </button>
          ))}
        </div>

        {tab === "gen" && (<>
        <div style={card}>
          <div style={cardTitle}>기본 설정</div>
          <div style={cardSub}>슬러그는 저장 폴더명 · 앵커는 제품 실사 공개 URL(나노바나나가 이 이미지 그대로 그려요)</div>
          <div style={{ display: "flex", gap: 12 }}>
            <input value={slug}
              onChange={(e) => {
                const v = e.target.value.trim();
                setSlug(v);
                // 슬러그 바꾸면 앵커 URL도 자동 추적 (표준 anchor.jpg 패턴일 때만 — 커스텀 URL은 안 건드림)
                if (v) setAnchorUrl((a) =>
                  /detail-assets\/[^/]+\/anchor\.(jpg|png)$/.test(a)
                    ? a.replace(/detail-assets\/[^/]+\//, `detail-assets/${v}/`)
                    : a);
              }}
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
          <div style={cardTitle}>템플릿 레퍼런스
            {styleActive && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, color: "#fff",
              background: "#34C759", borderRadius: 6, padding: "3px 8px" }}>적용 중</span>}
          </div>
          <div style={cardSub}>따라하고 싶은 상세페이지 캡쳐를 넣으면 AI가 디자인(컬러·타이포·섹션 구조)을 분석해 렌더 템플릿으로 만들어요 — 피그마 동기화 템플릿이 있으면 그게 우선</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ ...btnS, cursor: "pointer" }}>
              + 캡쳐 첨부 (통짜여도 OK)
              <input type="file" accept="image/*" multiple hidden
                onChange={(e) => { if (e.target.files?.length) addStyleFiles(e.target.files); e.target.value = ""; }} />
            </label>
            {styleFiles.length > 0 && (
              <span style={{ fontSize: 12, fontWeight: 700, color: C.inkMid }}>조각 {styleFiles.length}/8</span>
            )}
            <button onClick={applyStyle} disabled={!!styleBusy && styleBusy.includes("중")}
              style={{ ...btnS, background: C.rose, color: "#fff" }}>디자인 분석 → 템플릿 적용</button>
            {styleActive && <button onClick={resetStyle} style={btnS}>해제</button>}
          </div>
          {styleBusy && <p style={{ marginTop: 8, fontSize: 13, color: styleBusy.startsWith("실패") || styleBusy.startsWith("업로드 실패") ? "#D70015" : C.inkMid }}>{styleBusy}</p>}
        </div>

        <div style={card}>
          <div style={cardTitle}>① 제품 정보 → 카피 생성</div>
          <div style={cardSub}>제품 소개서·스펙표 아무거나 통째로 붙여넣으면 제품명·카테고리·스펙·USP 전부 자동 추출 — 아래 칸들은 비워도 돼요</div>
          <textarea value={form.raw}
            onChange={(e) => setForm((f) => ({ ...f, raw: e.target.value }))}
            placeholder={"제품 정보 통째로 붙여넣기 (소개서/스펙표/기획안 텍스트 아무거나)\n여기만 채우고 바로 카피 생성 눌러도 돼요"}
            style={{ ...inp, width: "100%", height: 120, marginBottom: 10, resize: "vertical" as const }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <label style={{ ...btnS, cursor: "pointer" }}>
              + 캡쳐/PDF 첨부 (자동 분석)
              <input type="file" accept="image/*,.pdf" multiple hidden
                onChange={(e) => { if (e.target.files?.length) addCopyFiles(e.target.files); e.target.value = ""; }} />
            </label>
            {copyFiles.map((f, i) => (
              <span key={i} style={{ fontSize: 12, fontWeight: 700, color: C.inkMid, background: "#eceef0",
                borderRadius: 8, padding: "5px 10px" }}>
                {f.name}
                <span onClick={() => setCopyFiles((p) => p.filter((_, j) => j !== i))}
                  style={{ marginLeft: 6, cursor: "pointer", color: "#D70015" }}>✕</span>
              </span>
            ))}
          </div>
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
              placeholder={`핵심 소구점 ${i + 1} (선택 — 비우면 스펙에서 자동 분석)`}
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
              <div style={cardSub}>사진을 한번에 올리면 AI가 분석해 슬롯에 자동 배치 — 빈 슬롯은 나노바나나 생성으로 채워요</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <label style={{ ...btn, marginTop: 0, background: C.ink, boxShadow: "none", cursor: "pointer" }}>
                사진 일괄 업로드
                <input type="file" accept="image/*" multiple hidden
                  onChange={(e) => e.target.files?.length && bulkUpload(e.target.files)} />
              </label>
              <button onClick={() => generateCuts(cuts.map((_, i) => i))} style={{ ...btn, marginTop: 0 }}>
                전체 컷 생성
              </button>
            </div>
          </div>
          {bulkBusy && <p style={{ fontSize: 13, color: bulkBusy.startsWith("실패") ? "#D70015" : C.inkMid, marginBottom: 8 }}>{bulkBusy}</p>}
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
          <div style={cardSub}>서버에서 860px 상세페이지를 렌더해 섹션 경계 기준 분할 JPG로 업로드 — GIF 조각은 캡처하지 않고 원본 그대로 사이에 끼워요</div>
          {gifRows.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input value={r.after} placeholder="섹션#"
                onChange={(e) => setGifRows((rs) => rs.map((x, j) => j === i ? { ...x, after: e.target.value } : x))}
                style={{ ...inp, width: 70 }} />
              <input value={r.url} placeholder="GIF/영상 URL (모션 레퍼런스에서 URL 복사)"
                onChange={(e) => setGifRows((rs) => rs.map((x, j) => j === i ? { ...x, url: e.target.value } : x))}
                style={{ ...inp, flex: 1 }} />
              <button onClick={() => setGifRows((rs) => rs.filter((_, j) => j !== i))} style={btnS}>삭제</button>
            </div>
          ))}
          <button onClick={() => setGifRows((rs) => [...rs, { after: "", url: "" }])}
            style={{ ...btnS, marginBottom: 4 }}>+ GIF 조각 (섹션 N 뒤에 삽입)</button>
          <br />
          <button onClick={renderPage} style={btn}>
            상세페이지 렌더 → 분할 JPG
          </button>
          {busy && <p style={{ marginTop: 8, fontSize: 13, color: C.inkLt }}>{busy}</p>}
          {sliceUrls.length > 0 && (
            <ul style={{ marginTop: 12, listStyle: "none", padding: 0 }}>
              {sliceUrls.map((u, i) => (
                <li key={u} style={{ padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                  <a href={u} target="_blank" style={{ fontSize: 13, fontWeight: 700, color: C.rose, textDecoration: "none" }}>
                    {u.split("/").pop()}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        </>)}

        {tab === "refs" && (
          <div style={card}>
            <div style={cardTitle}>모션 레퍼런스 갤러리 <span style={{ color: C.inkMid, fontWeight: 400, fontSize: 12 }}>와디즈 가전 상세페이지 수집 {motionRefs.length}개</span></div>
            <div style={cardSub}>GIF는 자동 재생 · 영상은 마우스 올리면 재생 — 컷 연출·수치 표현 참고용</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {([["all", "전체"], ["typo", "타이포"], ["graph", "그래프·수치"], ["real", "실사"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setRefCat(k)}
                  style={{ border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                    background: refCat === k ? C.ink : "#f0f0f2", color: refCat === k ? "#fff" : C.inkMid }}>
                  {label} {k === "all" ? motionRefs.length : motionRefs.filter((m) => m.category === k).length}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
              {motionRefs.filter((m) => refCat === "all" || m.category === refCat).map((m) => (
                <div key={m.id} style={{ background: "#f7f7f8", borderRadius: 12, overflow: "hidden",
                  border: `1px solid ${C.border}` }}>
                  {m.url.endsWith(".mp4") ? (
                    <video src={m.url} muted loop playsInline preload="metadata" controls={false}
                      onMouseOver={(e) => e.currentTarget.play()} onMouseOut={(e) => e.currentTarget.pause()}
                      onClick={(e) => { const v = e.currentTarget; v.paused ? v.play() : v.pause(); }}
                      style={{ width: "100%", display: "block", background: "#000", cursor: "pointer" }} />
                  ) : (
                    <img src={m.url} loading="lazy" alt={m.label}
                      style={{ width: "100%", display: "block", background: "#000" }} />
                  )}
                  <div style={{ padding: "9px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, lineHeight: 1.35 }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: C.inkMid, marginTop: 2 }}>{m.product}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <a href={m.source} target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: "#0071E3", textDecoration: "none" }}>
                        {m.keyword} · 와디즈 원본 ↗
                      </a>
                      <button onClick={(e) => { navigator.clipboard.writeText(m.url);
                          const b = e.currentTarget; b.textContent = "복사됨"; setTimeout(() => { b.textContent = "URL 복사"; }, 1200); }}
                        style={{ border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700,
                          cursor: "pointer", fontFamily: "inherit", background: "#eceef0", color: C.inkMid }}>
                        URL 복사
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "hist" && (
        <div style={card}>
          <div style={cardTitle}>생성 기록</div>
          <div style={cardSub}>모든 컷/렌더 결과가 남아요 — 삭제해도 기록은 보존되고 파일만 지워져요</div>
          {history.length === 0 && <p style={{ fontSize: 13, color: C.inkLt }}>기록 없음</p>}
          {history.map((h) => (
            <div key={h.id} style={{ borderTop: `1px solid ${C.border}`, padding: "12px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", borderRadius: 6,
                  padding: "3px 8px", background: h.type === "render" ? C.rose : C.inkMid }}>
                  {h.type === "render" ? "렌더" : "컷"}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{h.slug}</span>
                <span style={{ fontSize: 12, color: C.inkLt }}>
                  {new Date(h.at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · {h.urls.length}장
                </span>
                {h.deleted ? (
                  <span style={{ fontSize: 12, color: "#D70015", fontWeight: 700, marginLeft: "auto" }}>파일 삭제됨</span>
                ) : (
                  <button onClick={() => deleteHistory(h.id)} disabled={histBusy === h.id}
                    style={{ ...btnS, flex: "none", marginLeft: "auto", color: "#D70015" }}>
                    {histBusy === h.id ? "삭제 중…" : "파일 삭제"}
                  </button>
                )}
              </div>
              {!h.deleted && (
                <div style={{ display: "flex", gap: 8, marginTop: 8, overflowX: "auto" }}>
                  {h.urls.map((u) => (
                    <a key={u} href={u} target="_blank">
                      <img src={u} style={{ height: 90, borderRadius: 8, border: `1px solid ${C.border}` }} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        )}
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
