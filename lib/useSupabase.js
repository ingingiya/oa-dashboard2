'use client'

const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const STORAGE_BUCKET = "ad-images";

function headers(extra = {}) {
  return {
    "apikey":        SUPA_KEY,
    "Authorization": `Bearer ${SUPA_KEY}`,
    "Content-Type":  "application/json",
    ...extra,
  };
}

export async function getSetting(key) {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/settings?key=eq.${encodeURIComponent(key)}&select=value`,
    { headers: headers() }
  );
  const data = await res.json();
  return data?.[0]?.value ?? null;
}

export async function setSetting(key, value) {
  await fetch(`${SUPA_URL}/rest/v1/settings`, {
    method: "POST",
    headers: headers({ "Prefer": "resolution=merge-duplicates" }),
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
}

export async function getAdImages() {
  const data = await getSetting("ad_images");
  return data ?? [];
}

export async function saveAdImagesMeta(images) {
  await setSetting("ad_images", images);
}

export async function uploadAdImage(file, fileName) {
  const ext = file.name.split(".").pop();
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const uploadRes = await fetch(
    `${SUPA_URL}/storage/v1/object/${STORAGE_BUCKET}/${encodeURIComponent(path)}`,
    {
      method: "POST",
      headers: {
        "apikey":        SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Content-Type":  file.type || "image/jpeg",
        "x-upsert":      "true",
      },
      body: file,
    }
  );
  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`업로드 실패: ${err}`);
  }
  const publicUrl = `${SUPA_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${encodeURIComponent(path)}`;
  return { url: publicUrl, path };
}

export async function deleteAdImageFile(path) {
  await fetch(
    `${SUPA_URL}/storage/v1/object/${STORAGE_BUCKET}/${encodeURIComponent(path)}`,
    {
      method: "DELETE",
      headers: {
        "apikey":        SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
      },
    }
  );
}
