'use client'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const STORAGE_BUCKET = "ad-images";

const headers = () => ({
  "Content-Type": "application/json",
  "apikey": SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
});

export async function getSetting(key) {
  const res = await fetch(`${SUPA_URL}/rest/v1/settings?key=eq.${key}&select=value`, {
    headers: headers(),
  });
  const data = await res.json();
  return data?.[0]?.value ?? null;
}

export async function setSetting(key, value) {
  const res = await fetch(`${SUPA_URL}/rest/v1/settings`, {
    method: "POST",
    headers: { ...headers(), "Prefer": "resolution=merge-duplicates" },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`저장 실패 (${res.status}): ${err}`);
  }
}

export async function getAdImages() {
  const data = await getSetting("adImages");
  return Array.isArray(data) ? data : [];
}

export async function saveAdImagesMeta(images) {
  await setSetting("adImages", images);
}

export async function uploadAdImage(file, baseName) {
  const ext = file.name.split(".").pop().toLowerCase();

  // 파일명: 타임스탬프_랜덤 (한글/특수문자 완전 제거)
  const safeName = baseName
    .replace(/[^a-zA-Z0-9_-]/g, "_")  // 한글·특수문자 → _
    .replace(/_+/g, "_")               // 연속 _ 제거
    .slice(0, 50);                     // 길이 제한
  const path = `${Date.now()}_${safeName}.${ext}`;

  const res = await fetch(
    `${SUPA_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        "apikey": SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Content-Type": file.type || "image/png",
        "x-upsert": "true",
      },
      body: file,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`업로드 실패: ${err}`);
  }

  const publicUrl = `${SUPA_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
  return { url: publicUrl, path, originalName: baseName };
}

export async function deleteAdImageFile(path) {
  await fetch(`${SUPA_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
    method: "DELETE",
    headers: {
      "apikey": SUPA_KEY,
      "Authorization": `Bearer ${SUPA_KEY}`,
    },
  });
}

const SETTLE_BUCKET = "settle-docs";

export async function uploadSettleFile(file, infAccount, docType) {
  const ext = file.name.split(".").pop().toLowerCase();
  const safe = (infAccount || "file").replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").slice(0, 40);
  const path = `${safe}/${docType}_${Date.now()}.${ext}`;
  const buf = await file.arrayBuffer();

  const res = await fetch(
    `${SUPA_URL}/storage/v1/object/${SETTLE_BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        "apikey": SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: buf,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`업로드 실패: ${err}`);
  }

  return `${SUPA_URL}/storage/v1/object/public/${SETTLE_BUCKET}/${path}`;
}
