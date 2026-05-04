'use client'
import { createClient } from '../../lib/supabase'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 20,
        padding: '48px 40px',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxWidth: 400,
        width: '90%',
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>💄</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', marginBottom: 4 }}>OA 뷰티 대시보드</h1>
        <p style={{ fontSize: 14, color: '#888', marginBottom: 24 }}>팀원 전용 — 구글 계정으로 로그인</p>
        {error === 'unauthorized' && (
          <div style={{
            background: '#fff0f0',
            border: '1px solid #ffcccc',
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 20,
            fontSize: 13,
            color: '#e94560',
          }}>
            ⚠️ 접근 권한이 없는 계정입니다. 관리자에게 문의하세요.
          </div>
        )}
        <button
          onClick={signInWithGoogle}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: '#fff',
            border: '2px solid #e0e0e0',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
          onMouseOver={e => e.currentTarget.style.borderColor = '#e94560'}
          onMouseOut={e => e.currentTarget.style.borderColor = '#e0e0e0'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google로 로그인
        </button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
