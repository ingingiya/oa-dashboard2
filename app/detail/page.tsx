"use client";
// app/detail/page.tsx
// 상세페이지 생성기 — 원스톱 UI
// 흐름: ① 제품 정보 → 카피 생성 → ② 연출 컨셉 추천/선택 → ③ 컷 생성(Comfy Cloud 나노바나나2 + 멀티 앵커 자동 매칭) → ④ 최종 렌더(섹션 분할 JPG + GIF 조각)
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
  const [tab, setTab] = useState<"gen" | "renders" | "refs" | "hist">("gen");
  const [slug, setSlug] = useState("cleanswingP");
  const [trigger, setTrigger] = useState("cleanswingP");
  // 앵커 실사 여러 장(여러 각도) — 컷마다 어울리는 각도를 AI가 자동 선택
  const [anchors, setAnchors] = useState<string[]>([
    "https://lugqeflqusqsyotdiaxg.supabase.co/storage/v1/object/public/detail-assets/cleanswingP/anchor.jpg",
  ]);
  const [anchorInput, setAnchorInput] = useState("");
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
  type StyleTpl = { id: string; name: string; thumb: string | null; createdAt: string };
  const [styleLib, setStyleLib] = useState<{ items: StyleTpl[]; activeId: string | null }>({ items: [], activeId: null });
  const styleActive = !!styleLib.activeId;
  useEffect(() => {
    fetch("/api/detail/style").then((r) => r.json())
      .then((res) => res.ok && setStyleLib({ items: res.items || [], activeId: res.activeId || null }))
      .catch(() => {});
  }, []);

  async function styleAction(bodyObj: object, doneMsg: string) {
    const res = await fetch("/api/detail/style", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyObj),
    }).then((r) => r.json());
    if (res.ok) { setStyleLib({ items: res.items || [], activeId: res.activeId || null }); setStyleBusy(doneMsg); }
    else setStyleBusy("실패: " + res.error);
  }

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

  const [styleUrl, setStyleUrl] = useState("");
  async function applyStyle() {
    let imgs = styleFiles;
    try {
      // 캡쳐 첨부 없이 URL만 있으면 서버가 직접 접속해서 캡쳐
      if (!imgs.length) {
        if (!styleUrl.trim()) return alert("레퍼런스 URL을 넣거나 캡쳐를 첨부하세요");
        setStyleBusy("페이지 접속해서 자동 캡쳐 중… (~1분)");
        const cap = await fetch("/api/detail/style-capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: styleUrl.trim() }),
        }).then((r) => r.json());
        if (!cap.ok) throw new Error(cap.error);
        imgs = cap.files;
        setStyleFiles(imgs);
      }
      setStyleBusy("디자인 분석 중… (2~4분, 최고 성능 모델)");
      const res = await fetch("/api/detail/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: imgs, refUrl: styleUrl.trim() }),
      }).then((r) => r.json());
      if (!res.ok) throw new Error(res.error);
      setStyleLib({ items: res.items || [], activeId: res.activeId || null });
      setStyleFiles([]);
      setStyleBusy("저장 + 적용 완료 — 이제 최종 렌더가 이 스타일로 나와요");
    } catch (e: any) {
      setStyleBusy("실패: " + e.message);
    }
  }

  const resetStyle = () => styleAction({ reset: true }, "해제됨 — 기본 템플릿으로 렌더돼요");

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

  // ── 연출 컨셉 추천 ──
  type Concept = { title: string; desc: string; styleBlock: string };
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selConcept, setSelConcept] = useState(-1);
  const [conceptBusy, setConceptBusy] = useState(false);

  async function recommendConcepts() {
    setConceptBusy(true);
    try {
      const res = await fetch("/api/detail/concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: form.productName || trigger,
          category: form.category,
          raw: form.raw,
          anchorUrl: anchors[0] || "",
        }),
      }).then((r) => r.json());
      if (!res.ok) throw new Error(res.error);
      setConcepts(res.concepts);
      setSelConcept(-1);
    } catch (e: any) {
      alert("컨셉 추천 실패: " + e.message);
    } finally {
      setConceptBusy(false);
    }
  }

  // ── 위저드 스텝 (카피 → 컨셉 → 컷 → 렌더 페이지 넘김) ──
  const [step, setStep] = useState(0);
  function nextStep() {
    if (step === 0 && !productJson &&
      !confirm("아직 카피를 만들지 않았어요. 카피 없이 다음으로 갈까요?")) return;
    if (step === 1 && selConcept < 0 && !preset &&
      !confirm("생성 컨셉을 선택하지 않았어요. 기본 연출로 진행할까요?")) return;
    if (step === 2 && !cuts.some((c) => c.url) &&
      !confirm("생성된 컷이 없어요. 그래도 최종 렌더로 갈까요?")) return;
    setStep((s) => Math.min(3, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── 컷 이미지 사이즈 (많이 쓰는 비율 프리셋) ──
  const [aspect, setAspect] = useState("1:1");

  // ── 생성 컨셉 프리셋 (AI 추천과 별개: 깔끔 누끼 / 컬러 배경) ──
  const [preset, setPreset] = useState<"" | "nukki" | "color">("");
  const [presetColor, setPresetColor] = useState("#EAF3FF");
  const presetStyleBlock = () => {
    if (preset === "nukki")
      return "Pure seamless white background (#FFFFFF), clean cutout-style e-commerce packshot, soft even studio lighting, only a faint natural contact shadow directly under the product, no props, no gradient, no environment.";
    if (preset === "color")
      return `Solid seamless ${presetColor} studio background filling the entire frame, clean cutout-style product shot, soft even studio lighting, gentle contact shadow under the product, no props, minimal premium e-commerce look.`;
    return "";
  };

  // ── 컷 생성 (개별/전체 동일 라우트) ──
  async function generateCuts(indices: number[]) {
    if (!anchors.length) return alert("제품 실사(앵커)를 최소 1장 넣어주세요");
    setCuts((p) => p.map((c, i) => (indices.includes(i) ? { ...c, loading: true } : c)));
    const targets = indices.map((i) => ({
      file: cuts[i].file,
      prompt: `${trigger}, ${cuts[i].prompt}`,
    }));
    const res = await fetch("/api/detail/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productSlug: slug,
        cuts: targets,
        anchorUrls: anchors,
        aspectRatio: aspect,
        styleBlock: presetStyleBlock() || (selConcept >= 0 ? concepts[selConcept]?.styleBlock : ""),
      }),
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
      if (res.anchorUrl) setAnchors((p) => (p.includes(res.anchorUrl) ? p : [...p, res.anchorUrl]));
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
  type HistItem = { id: string; at: string; type: string; slug: string; urls: string[]; htmlUrl?: string; deleted?: boolean };
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

  // ── 렌더 결과 다운로드 (개별 전체 / 합친 HTML) ──
  const [dlBusy, setDlBusy] = useState("");
  function saveBlob(blob: Blob, filename: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function downloadAll(h: HistItem) {
    setDlBusy(h.id);
    try {
      for (let i = 0; i < h.urls.length; i++) {
        const blob = await fetch(h.urls[i]).then((r) => r.blob());
        const name = h.urls[i].split("/").pop()?.split("?")[0] || `${h.slug}_${i + 1}.jpg`;
        saveBlob(blob, `${h.slug}_${String(i + 1).padStart(2, "0")}_${name}`);
        await new Promise((r) => setTimeout(r, 300)); // 브라우저 연속 다운로드 차단 방지
      }
    } catch (e: any) {
      alert("다운로드 실패: " + e.message);
    }
    setDlBusy("");
  }
  function downloadHtml(h: HistItem) {
    const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${h.slug} 상세페이지</title>
<style>body{margin:0;background:#fff}img{display:block;width:100%;max-width:860px;margin:0 auto}</style>
</head><body>
${h.urls.map((u) => `<img src="${u}" alt="">`).join("\n")}
</body></html>`;
    saveBlob(new Blob([html], { type: "text/html" }), `${h.slug}_detail.html`);
  }

  // 피그마로 복사: 조각을 세로로 이어붙인 PNG 한 장을 클립보드에 → 피그마 캔버스에 Cmd+V
  async function copyToFigma(h: HistItem) {
    setDlBusy("figma_" + h.id);
    try {
      const imgs = await Promise.all(
        h.urls.map((u) => new Promise<HTMLImageElement>((res, rej) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => res(img);
          img.onerror = () => rej(new Error("이미지 로드 실패: " + u.split("/").pop()));
          img.src = u;
        }))
      );
      const width = Math.max(...imgs.map((m) => m.naturalWidth));
      const heights = imgs.map((m) => Math.round(m.naturalHeight * (width / m.naturalWidth)));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = heights.reduce((a, b) => a + b, 0);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      let y = 0;
      imgs.forEach((m, i) => { ctx.drawImage(m, 0, y, width, heights[i]); y += heights[i]; });
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("PNG 변환 실패"))), "image/png"));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      alert("복사 완료 — 피그마 캔버스에서 Cmd+V 붙여넣기 하세요 (GIF 조각은 첫 프레임으로 들어가요)");
    } catch (e: any) {
      alert("복사 실패: " + e.message);
    }
    setDlBusy("");
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
          {([["gen", "생성기"], ["renders", "최종 렌더 모음"], ["refs", "모션 레퍼런스"], ["hist", "생성 기록"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => { setTab(k); if (k === "hist" || k === "renders") loadHistory(); }}
              style={{ border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 13,
                fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                background: tab === k ? C.rose : C.white, color: tab === k ? "#fff" : C.inkMid,
                boxShadow: tab === k ? "0 4px 12px rgba(0,113,227,.25)" : `inset 0 0 0 1px ${C.border}` }}>
              {label}
            </button>
          ))}
        </div>

        {tab === "gen" && (<>
        {/* 스텝 내비 — 클릭하면 그 단계 페이지로 이동 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "18px 0 4px", flexWrap: "wrap" }}>
          {([
            ["카피 생성", !!productJson, "제품 정보를 넣고 카피를 만들어요"],
            ["생성 컨셉", selConcept >= 0 || !!preset, "(선택) 누끼/컬러/AI 추천 중 고르기"],
            ["컷 생성", cuts.some((c) => c.url), "실사 앵커로 연출컷 생성"],
            ["최종 렌더", sliceUrls.length > 0, "분할 JPG/GIF로 저장"],
          ] as [string, boolean, string][]).map(([label, done, tip], i, arr) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }} title={tip}>
              <div onClick={() => setStep(i)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: "pointer",
                background: step === i ? C.rose : done ? "#E8F8EE" : C.white,
                color: step === i ? "#fff" : done ? "#1F9D55" : C.inkMid,
                border: `1px solid ${step === i ? C.rose : done ? "#B7E4C7" : C.border}` }}>
                <span style={{ width: 17, height: 17, borderRadius: "50%", display: "inline-flex",
                  alignItems: "center", justifyContent: "center", fontSize: 11,
                  background: done ? "#34C759" : step === i ? "rgba(255,255,255,.35)" : C.border,
                  color: "#fff" }}>{done ? "✓" : i + 1}</span>
                {label}
              </div>
              {i < arr.length - 1 && <span style={{ color: C.border, fontSize: 14 }}>→</span>}
            </div>
          ))}
        </div>

        {step === 0 && (<>
        <div style={card}>
          <div style={cardTitle}>기본 설정</div>
          <div style={cardSub}>제품 폴더명(영어)과 제품 실사를 넣어요 — 실사는 정면·옆·뒷면 등 여러 각도로 넣을수록 컷이 정확해져요 (컷마다 맞는 각도를 AI가 자동 선택)</div>
          <div style={{ display: "flex", gap: 12 }}>
            <input value={slug}
              onChange={(e) => {
                const v = e.target.value.trim();
                setSlug(v);
                // 슬러그 바꾸면 표준 패턴 앵커 URL도 자동 추적 (커스텀 URL은 안 건드림)
                if (v) setAnchors((arr) => arr.map((a) =>
                  /detail-assets\/[^/]+\/anchor[\w-]*\.(jpg|png)$/.test(a)
                    ? a.replace(/detail-assets\/[^/]+\//, `detail-assets/${v}/`)
                    : a));
              }}
              placeholder="제품 폴더명 (영어, 예: airstraight)" style={{ ...inp, flex: 1 }} />
            <input value={trigger} onChange={(e) => setTrigger(e.target.value)}
              placeholder="제품명(프롬프트 접두어)" style={{ ...inp, flex: 1 }} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
            {anchors.map((a, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={a} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10,
                  border: `1px solid ${C.border}`, background: "#fff" }} />
                <span onClick={() => setAnchors((p) => p.filter((_, j) => j !== i))}
                  style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, lineHeight: "17px",
                    textAlign: "center", fontSize: 11, fontWeight: 800, color: "#fff", background: "#D70015",
                    borderRadius: "50%", cursor: "pointer" }}>✕</span>
              </div>
            ))}
            <label style={{ ...btnS, cursor: "pointer" }}>
              + 실사 사진 추가
              <input type="file" accept="image/*" multiple hidden
                onChange={async (e) => {
                  if (!e.target.files?.length) return;
                  for (const file of Array.from(e.target.files)) {
                    const fd = new FormData();
                    fd.append("file", file);
                    const res = await fetch("/api/detail/copy-upload", { method: "POST", body: fd }).then((r) => r.json());
                    if (res.ok) setAnchors((p) => [...p, res.url]);
                    else alert("업로드 실패: " + res.error);
                  }
                  e.target.value = "";
                }} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input value={anchorInput} onChange={(e) => setAnchorInput(e.target.value)}
              placeholder="또는 실사 이미지 URL 붙여넣기" style={{ ...inp, flex: 1 }} />
            <button onClick={() => { if (anchorInput.trim()) { setAnchors((p) => [...p, anchorInput.trim()]); setAnchorInput(""); } }}
              style={btnS}>추가</button>
          </div>
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
          <div style={cardSub}>따라하고 싶은 상세페이지 캡쳐를 넣으면 AI가 디자인(컬러·타이포·섹션 구조)을 분석해 렌더 템플릿으로 만들어요 — 만든 템플릿은 아래에 저장돼서 클릭 한 번으로 골라 쓸 수 있어요</div>
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
          <input value={styleUrl} onChange={(e) => setStyleUrl(e.target.value)}
            placeholder="레퍼런스 페이지 URL — 이것만 넣고 분석 눌러도 서버가 알아서 캡쳐+HTML까지 긁어와요"
            style={{ ...inp, width: "100%", marginTop: 10 }} />
          {styleLib.items.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              {styleLib.items.map((t) => {
                const on = t.id === styleLib.activeId;
                return (
                  <div key={t.id} style={{ width: 128, borderRadius: 12, overflow: "hidden", cursor: "pointer",
                    border: `2px solid ${on ? "#34C759" : C.border}`, background: C.white, position: "relative" }}
                    onClick={() => styleAction(on ? { reset: true } : { activate: t.id },
                      on ? "해제됨 — 기본 템플릿으로 렌더돼요" : `"${t.name}" 적용 — 최종 렌더가 이 스타일로 나와요`)}>
                    {t.thumb ? (
                      <img src={t.thumb} alt={t.name} style={{ width: "100%", height: 110, objectFit: "cover", objectPosition: "top", display: "block" }} />
                    ) : (
                      <div style={{ width: "100%", height: 110, display: "flex", alignItems: "center", justifyContent: "center",
                        background: "#eceef0", fontSize: 12, color: C.inkMid }}>미리보기 없음</div>
                    )}
                    {on && <span style={{ position: "absolute", top: 6, left: 6, fontSize: 10, fontWeight: 800,
                      background: "#34C759", color: "#fff", borderRadius: 6, padding: "2px 7px" }}>적용 중</span>}
                    <span onClick={(e) => { e.stopPropagation(); if (confirm(`"${t.name}" 템플릿을 삭제할까요?`)) styleAction({ remove: t.id }, "삭제됨"); }}
                      style={{ position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: "50%",
                        background: "rgba(0,0,0,.5)", color: "#fff", fontSize: 11, display: "flex",
                        alignItems: "center", justifyContent: "center" }}>✕</span>
                    <div title="클릭해서 이름 변경"
                      onClick={(e) => {
                        e.stopPropagation();
                        const name = prompt("템플릿 이름", t.name)?.trim();
                        if (name && name !== t.name) styleAction({ rename: t.id, name }, "이름 변경됨");
                      }}
                      style={{ padding: "6px 8px", fontSize: 11, fontWeight: 700, color: C.ink,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name} ✎</div>
                  </div>
                );
              })}
            </div>
          )}
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
          {productJson && <p style={{ marginTop: 10, fontSize: 13, color: "#34C759", fontWeight: 700 }}>✓ 카피 준비 완료 — 아래에서 컷을 만들고 최종 렌더를 누르면 돼요</p>}
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 12.5, color: C.inkMid, cursor: "pointer" }}>고급: 카피 JSON 직접 보기/수정</summary>
            <textarea value={productJson} onChange={(e) => setProductJson(e.target.value)}
              placeholder="카피 생성 결과 JSON (직접 수정 가능 / 붙여넣기도 가능)"
              style={{ ...inp, width: "100%", height: 160, marginTop: 8, fontFamily: "monospace", fontSize: 12 }} />
          </details>
        </div>
        </>)}

        {step === 1 && (
        <div style={card}>
          <div style={cardTitle}>② 생성 컨셉 <span style={{ color: C.inkMid, fontWeight: 400, fontSize: 12 }}>(선택)</span></div>
          <div style={cardSub}>기본 스타일을 고르거나, AI 추천을 받아보세요 — 고르면 모든 컷이 그 방향으로 생성돼요 (안 고르면 기본 연출)</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <div onClick={() => { setPreset(preset === "nukki" ? "" : "nukki"); setSelConcept(-1); }}
              style={{ padding: "9px 16px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 800,
                border: preset === "nukki" ? `2px solid ${C.rose}` : `1px solid ${C.border}`,
                background: preset === "nukki" ? "#f0f7ff" : "#fff", color: C.ink }}>
              {preset === "nukki" ? "✓ " : ""}깔끔한 누끼형 <span style={{ fontWeight: 400, color: C.inkMid }}>— 흰 배경 + 은은한 그림자</span>
            </div>
            <div onClick={() => { setPreset(preset === "color" ? "" : "color"); setSelConcept(-1); }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 10,
                cursor: "pointer", fontSize: 13, fontWeight: 800,
                border: preset === "color" ? `2px solid ${C.rose}` : `1px solid ${C.border}`,
                background: preset === "color" ? "#f0f7ff" : "#fff", color: C.ink }}>
              {preset === "color" ? "✓ " : ""}컬러 배경형
              <input type="color" value={presetColor}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => { setPresetColor(e.target.value); setPreset("color"); setSelConcept(-1); }}
                style={{ width: 30, height: 26, border: "none", background: "none", cursor: "pointer", padding: 0 }} />
              <span style={{ fontWeight: 400, color: C.inkMid }}>{presetColor}</span>
            </div>
          </div>
          <button onClick={recommendConcepts} disabled={conceptBusy} style={{ ...btnS, opacity: conceptBusy ? 0.6 : 1 }}>
            {conceptBusy ? "추천 중…" : "AI 컨셉 추천받기"}
          </button>
          {concepts.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10, marginTop: 12 }}>
              {concepts.map((c, i) => (
                <div key={i} onClick={() => { setSelConcept(selConcept === i ? -1 : i); setPreset(""); }}
                  style={{ padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                    border: selConcept === i ? `2px solid ${C.rose}` : `1px solid ${C.border}`,
                    background: selConcept === i ? "#f0f7ff" : "#fff" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>
                    {selConcept === i ? "✓ " : ""}{c.title}
                  </div>
                  <div style={{ fontSize: 12.5, color: C.inkMid, marginTop: 4, lineHeight: 1.4 }}>{c.desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {step === 2 && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={cardTitle}>③ 컷 생성 / 재생성</div>
              <div style={cardSub}>사진을 한번에 올리면 AI가 분석해 슬롯에 자동 배치 — 빈 슬롯은 나노바나나 생성으로 채워요</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select value={aspect} onChange={(e) => setAspect(e.target.value)}
                title="컷 이미지 비율"
                style={{ ...inp, padding: "9px 10px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                <option value="1:1">1:1 정방형 (기본)</option>
                <option value="4:5">4:5 세로 (피드형)</option>
                <option value="3:4">3:4 세로</option>
                <option value="9:16">9:16 세로 풀</option>
                <option value="16:9">16:9 가로</option>
                <option value="4:3">4:3 가로</option>
              </select>
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
                <div style={{ marginTop: 8, aspectRatio: aspect.replace(":", "/"), background: C.bg, borderRadius: 10,
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
        )}

        {step === 3 && (
        <div style={card}>
          <div style={cardTitle}>④ 최종 렌더</div>
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
        )}

        {/* 위저드 하단 이전/다음 내비 */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          <button onClick={() => { setStep((s) => Math.max(0, s - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            disabled={step === 0}
            style={{ ...btnS, opacity: step === 0 ? 0.4 : 1, padding: "11px 22px" }}>← 이전</button>
          {step < 3 ? (
            <button onClick={nextStep} style={{ ...btn, marginTop: 0, padding: "11px 26px" }}>다음 →</button>
          ) : (
            <button onClick={() => { setTab("renders"); loadHistory(); window.scrollTo({ top: 0 }); }}
              style={{ ...btn, marginTop: 0, padding: "11px 26px" }}>최종 렌더 모음 보기 →</button>
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

        {tab === "renders" && (
        <div style={card}>
          <div style={cardTitle}>최종 렌더 모음</div>
          <div style={cardSub}>렌더가 끝나면 자동으로 여기 쌓여요 — 조각을 클릭하면 원본이 열려요</div>
          {history.filter((h) => h.type === "render" && !h.deleted).length === 0 && (
            <p style={{ fontSize: 13, color: C.inkLt }}>아직 렌더 결과가 없어요 — 생성기 탭에서 최종 렌더를 눌러보세요</p>
          )}
          {history.filter((h) => h.type === "render" && !h.deleted).map((h) => (
            <div key={h.id} style={{ borderTop: `1px solid ${C.border}`, padding: "14px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{h.slug}</span>
                <span style={{ fontSize: 12, color: C.inkLt }}>
                  {new Date(h.at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · 조각 {h.urls.length}장
                </span>
                <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                  <button onClick={() => copyToFigma(h)} disabled={dlBusy === "figma_" + h.id}
                    title="조각을 이어붙인 PNG 한 장을 클립보드에 복사 — 피그마에 Cmd+V"
                    style={{ ...btnS, flex: "none", opacity: dlBusy === "figma_" + h.id ? 0.6 : 1 }}>
                    {dlBusy === "figma_" + h.id ? "복사 중…" : "피그마로 복사"}
                  </button>
                  {h.htmlUrl && (
                    <button onClick={() => {
                        navigator.clipboard.writeText(h.htmlUrl!);
                        alert("HTML 링크 복사됨!\n\n피그마에서 수정 가능하게 가져오는 법:\n1. 피그마에서 html.to.design 플러그인 실행 (무료)\n2. URL 붙여넣기 → Import\n3. 텍스트·이미지가 전부 편집 가능한 레이어로 들어와요");
                      }}
                      title="html.to.design 플러그인으로 열면 텍스트/이미지가 편집 가능한 레이어로 임포트돼요"
                      style={{ ...btnS, flex: "none" }}>
                      피그마 편집용 링크
                    </button>
                  )}
                  <button onClick={() => downloadAll(h)} disabled={dlBusy === h.id}
                    style={{ ...btnS, flex: "none", opacity: dlBusy === h.id ? 0.6 : 1 }}>
                    {dlBusy === h.id ? "다운로드 중…" : "전체 다운로드"}
                  </button>
                  <button onClick={() => downloadHtml(h)}
                    style={{ ...btnS, flex: "none", background: C.rose, color: "#fff" }}>
                    HTML 다운로드
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                {h.urls.map((u, i) => (
                  <a key={u} href={u} target="_blank" style={{ flex: "none", textAlign: "center", textDecoration: "none" }}>
                    <img src={u} style={{ height: 150, borderRadius: 8, border: `1px solid ${C.border}`, display: "block" }} />
                    <span style={{ fontSize: 11, color: C.inkLt }}>{String(i + 1).padStart(2, "0")}</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
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
