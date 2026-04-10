import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PUBLIC_PATHS = new Set(['/login'])
const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/api/webhooks/',
  '/_next/static/',
  '/_next/image/',
]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true
  if (/\.(svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname)) return true
  return false
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublicPath(pathname)) return NextResponse.next()

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  })

  if (!token) {
    // API routes → 401 JSON (redirect non funziona per chiamate fetch)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Accesso non autorizzato' } },
        { status: 401 },
      )
    }
    // Pagine → redirect a login
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Session error → force re-login
  if ((token as { error?: string }).error === 'RefreshTokenExpired') {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('expired', '1')
    return NextResponse.redirect(loginUrl)
  }

  // MFA enforcement: se mfaSetupRequired, solo /settings/security è permessa
  const mfaRequired = (token as { mfaSetupRequired?: boolean }).mfaSetupRequired === true
  const isApiRoute = pathname.startsWith('/api/')
  const isSecurityPage = pathname === '/settings/security'

  if (mfaRequired && !isSecurityPage && !isApiRoute) {
    return NextResponse.redirect(new URL('/settings/security', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
