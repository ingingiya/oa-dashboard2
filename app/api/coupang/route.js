export const dynamic = 'force-dynamic';
import crypto from 'crypto';

function makeAuth(method, path, query = "") {
  const accessKey = (process.env.COUPANG_ACCESS_KEY || "").trim();
  const secretKey = (process.env.COUPANG_SECRET_KEY || "").trim();
  const datetime  = new Date().toISOString().replace(/[-:T]/g,"").slice(2,12); // yyMMddHHmm UTC

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
      const query = `vendorId=${vendorId}`;
      const datetime = new Date().toISOString().replace(/[-:T]/g,"").slice(2,12);
      const message  = datetime + "GET" + path + "?" + query;
      const headers  = makeAuth("GET", path, query);
      return Response.json({
        message,
        authorization: headers.Authorization,
        vendorIdLen: vendorId.length,
        accessKeyLen: accessKey.length,
        secretKeyLen: secretKey.length,
        secretKeyFirstChar: secretKey[0],
        secretKeyLastChar:  secretKey[secretKey.length-1],
      });
    }

    return Response.json({ error: "unknown type" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
