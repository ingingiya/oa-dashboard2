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

  // 광고 단가 대시보드 — 공유 키(쿼리 ?k= 또는 쿠키)로 열람 허용 (이사님 열람용, 읽기 전용)
  if (pathname.startsWith('/adcost')) {
    const k = request.nextUrl.searchParams.get('k')
    const ok = process.env.ADCOST_KEY && (k === process.env.ADCOST_KEY || request.cookies.get('adcost_key')?.value === process.env.ADCOST_KEY)
    if (ok) {
      const res = NextResponse.next({ request })
      if (k) res.cookies.set('adcost_key', k, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 180, path: '/' })
      return res
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
