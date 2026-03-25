export const dynamic = 'force-dynamic';
import crypto from 'crypto';
import https from 'https';

function httpsGet(url, headers) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'GET', headers }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        let data; try { data = JSON.parse(body); } catch { data = { raw: body }; }
        resolve({ ok: res.statusCode < 300, status: res.statusCode, data });
      });
    });
    req.on('error', e => resolve({ ok: false, status: 0, data: { error: e.message } }));
    req.end();
  });
}

function makeAuth(method, path, query = "") {
  const accessKey = (process.env.COUPANG_ACCESS_KEY || "").trim();
  const secretKey = (process.env.COUPANG_SECRET_KEY || "").trim();
  const iso = new Date().toISOString();
  const datetime = iso.slice(2,8) + "T" + iso.slice(11,19) + "Z"; // yyMMddTHHmmssZ

  const message   = datetime + method + path + (query ? "?" + query : "");
  const signature = crypto.createHmac("sha256", secretKey).update(message).digest("hex");

  const headers = {
    Authorization: `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`,
  };
  if (method !== "GET") headers["Content-Type"] = "application/json;charset=UTF-8";
  return headers;
}

async function callCoupang(method, path, query = "") {
  const url = `https://api-gateway.coupang.com${path}${query ? "?" + query : ""}`;
  const res  = await fetch(url, { headers: makeAuth(method, path, query) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

export async function GET(request) {
  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;
  const vendorId  = process.env.COUPANG_VENDOR_ID;

  if (!accessKey || !secretKey || !vendorId) {
    return Response.json({ error: "COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY / COUPANG_VENDOR_ID 없음" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "products";

  try {
    if (type === "product") {
      const id = searchParams.get("id");
      if (!id) return Response.json({ error: "id 파라미터 필요" }, { status: 400 });
      const path = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${id}`;
      const query = `vendorId=${vendorId}`;
      const { ok, status, data } = await callCoupang("GET", path, query);
      if (!ok) return Response.json({ error: data?.message || JSON.stringify(data), raw: data }, { status });
      const p = data.data || data;
      const product = {
        productId: p.sellerProductId,
        name:      p.sellerProductName || p.displayProductName || "—",
        status:    p.statusName || p.status || "—",
        items: (p.items || []).map(item => ({
          itemId:        item.vendorItemId,
          itemName:      item.itemName || "",
          salePrice:     item.salePrice     ? Number(item.salePrice)     : null,
          originalPrice: item.originalPrice ? Number(item.originalPrice) : null,
          stockQuantity: item.maximumBuyCount ?? item.stockQuantity ?? null,
        })),
      };
      return Response.json({ type, product, _raw: data });
    }

    if (type === "orders") {
      const to   = new Date().toISOString().slice(0,19);
      const from = new Date(Date.now() - 7*24*60*60*1000).toISOString().slice(0,19);
      const path  = `/v2/providers/seller_api/apis/api/v1/vendor/${vendorId}/orders`;
      const query = `createdAtFrom=${encodeURIComponent(from)}&createdAtTo=${encodeURIComponent(to)}&status=ACCEPT&maxPerPage=50`;
      const { ok, status, data } = await callCoupang("GET", path, query);
      if (!ok) return Response.json({ error: data?.message || JSON.stringify(data), raw: data }, { status });
      return Response.json({ type, list: data.data || [], _raw: data });
    }

    if (type === "debug") {
      const id = searchParams.get("id") || "TEST_ID";
      const path  = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${id}`;

      // 테스트1: vendorId 포함
      const q1 = `vendorId=${vendorId}`;
      const r1 = await callCoupang("GET", path, q1);

      // 테스트2: vendorId 없이
      const r2 = await callCoupang("GET", path, "");

      const datetime = new Date().toISOString().replace(/[-:T]/g,"").slice(2,12);
      const headers  = makeAuth("GET", path, q1);
      return Response.json({
        message: datetime + "GET" + path + "?" + q1,
        authorization: headers.Authorization,
        vendorIdLen: vendorId.length,
        accessKeyLen: accessKey.length,
        secretKeyLen: secretKey.length,
        secretKeyHasQuotes: secretKey.startsWith('"') || secretKey.startsWith("'"),
        secretKeyHasNewline: secretKey.includes('\n') || secretKey.includes('\r'),
        secretKeyHasSpace: secretKey.includes(' '),
        accessKeyHasQuotes: accessKey.startsWith('"') || accessKey.startsWith("'"),
        test_withVendorId:    { status: r1.status, ok: r1.ok, data: r1.data },
        test_withoutVendorId: { status: r2.status, ok: r2.ok, data: r2.data },
        test_https: await httpsGet(`https://api-gateway.coupang.com${path}?${q1}`, makeAuth("GET", path, q1)),
        test_hex_decoded: await (async () => {
          try {
            const hexKey = Buffer.from(secretKey, 'hex');
            const msg = datetime + "GET" + path + "?" + q1;
            const sig = crypto.createHmac("sha256", hexKey).update(msg).digest("hex");
            const auth = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${sig}`;
            return await httpsGet(`https://api-gateway.coupang.com${path}?${q1}`, { Authorization: auth });
          } catch(e) { return { error: e.message }; }
        })(),
        test_base64_decoded: await (async () => {
          try {
            const b64Key = Buffer.from(secretKey, 'base64');
            const msg = datetime + "GET" + path + "?" + q1;
            const sig = crypto.createHmac("sha256", b64Key).update(msg).digest("hex");
            const auth = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${sig}`;
            return await httpsGet(`https://api-gateway.coupang.com${path}?${q1}`, { Authorization: auth });
          } catch(e) { return { error: e.message }; }
        })(),
        test_kst: await (async () => {
          // KST = UTC+9
          const kstDate = new Date(Date.now() + 9*60*60*1000);
          const kstDatetime = kstDate.toISOString().replace(/[-:T]/g,"").slice(2,12);
          const kstMsg = kstDatetime + "GET" + path + "?" + q1;
          const kstSig = crypto.createHmac("sha256", secretKey).update(kstMsg).digest("hex");
          const kstAuth = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${kstDatetime}, signature=${kstSig}`;
          const url = `https://api-gateway.coupang.com${path}?${q1}`;
          const res = await fetch(url, { headers: { Authorization: kstAuth } });
          const text = await res.text();
          let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
          return { status: res.status, ok: res.ok, data, kstDatetime };
        })(),
      });
    }

    return Response.json({ error: "unknown type" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
