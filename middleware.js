import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

const ALLOWED_EMAILS = [
  'kkeim9803@gmail.com',
  'yeongseo010622@gmail.com',
  'qwt0124@gmail.com',
  'sunup94321kr@gmail.com',
  'thdwldnjs321@gmail.com',
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|oa-claude-code-guide|screenshot-|.*\.png$|.*\.jpg$|.*\.webp$).*)'],
}
