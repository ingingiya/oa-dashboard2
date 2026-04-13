"use client";
import { useEffect, useState } from "react";
import Dashboard from "../components/Dashboard";

const C = { rose: "#FF6B6B", blush: "#FFF0F0", border: "#E5E7EB", ink: "#1a1a1a", inkMid: "#6B7280", cream: "#FAFAFA" };

function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pw.trim()) return;
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (data.ok) {
        localStorage.setItem("oa_auth", "1");
        onLogin();
      } else {
        setErr(data.error || "비밀번호가 틀렸어요");
        setPw("");
      }
    } catch {
      setErr("네트워크 오류");
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #fff5f5 0%, #fff 60%, #f5f3ff 100%)",
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "40px 36px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.10)", width: "100%", maxWidth: 360,
        border: `1px solid ${C.border}`,
      }}>
        {/* 로고 */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: 16, background: C.rose, marginBottom: 14,
          }}>
            <span style={{ fontSize: 28 }}>OA</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.ink }}>오아 대시보드</div>
          <div style={{ fontSize: 12, color: C.inkMid, marginTop: 4 }}>팀 전용 — 초대받은 분만 접속 가능해요</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="비밀번호 입력"
            autoFocus
            style={{
              width: "100%", fontSize: 15, padding: "12px 14px", borderRadius: 10,
              border: `1.5px solid ${err ? C.rose : C.border}`, outline: "none",
              fontFamily: "inherit", boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
          />
          {err && (
            <div style={{ fontSize: 12, color: C.rose, fontWeight: 700, textAlign: "center" }}>{err}</div>
          )}
          <button
            type="submit"
            disabled={loading || !pw.trim()}
            style={{
              width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
              background: loading || !pw.trim() ? "#e5e7eb" : C.rose,
              color: loading || !pw.trim() ? C.inkMid : "#fff",
              fontSize: 15, fontWeight: 800, cursor: loading || !pw.trim() ? "default" : "pointer",
              fontFamily: "inherit", transition: "background 0.15s",
            }}
          >
            {loading ? "확인 중..." : "입장하기"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Home() {
  const [authed, setAuthed] = useState(null); // null=로딩중

  useEffect(() => {
    setAuthed(localStorage.getItem("oa_auth") === "1");
  }, []);

  if (authed === null) return null; // 깜빡임 방지
  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;
  return <Dashboard />;
}
