import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

const ALLOWED_EMAILS = [
  'kkeim9803@gmail.com',
  'yeongseo010622@gmail.com',
  'qwt0124@gmail.com',
  'sunup94321kr@gmail.com',
  'thdwldnjs321@gmail.com',
  '120312yss@gmail.com',
]

export async function middleware(request) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/oa-claude-code-guide')
  ) {
    return NextResponse.next()
  }

  // 게스트 공유 링크: /detail?guest=이름:PIN — PIN을 크레딧 API로 검증 후 쿠키 발급 (구글 로그인 없이 /detail만 허용)
  if (pathname.startsWith('/detail')) {
    if (request.cookies.get('oa_detail_guest')?.value === '1') return NextResponse.next()
    const g = request.nextUrl.searchParams.get('guest')
    if (g && g.includes(':')) {
      const idx = g.indexOf(':')
      try {
        const r = await fetch(new URL('/api/detail/credits', request.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login: { name: g.slice(0, idx), pin: g.slice(idx + 1) } }),
        }).then((x) => x.json())
        if (r.ok) {
          const res = NextResponse.next({ request })
          res.cookies.set('oa_detail_guest', '1', { maxAge: 60 * 60 * 24 * 7, path: '/detail' })
          return res
        }
      } catch {}
    }
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (!ALLOWED_EMAILS.includes(session.user.email)) {
    return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|oa-claude-code-guide|screenshot-|event|.*\.png$|.*\.jpg$|.*\.webp$|.*\.html$).*)'],
}
