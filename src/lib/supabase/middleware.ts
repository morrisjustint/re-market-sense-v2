import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "@/types/database"

const AUTH_ROUTES = ["/login", "/signup"]
const PROTECTED_PREFIXES = ["/app", "/onboarding"]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not add logic between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  if (user) {
    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()

    const hasOrg = Boolean(membership?.org_id)

    if (isAuthRoute) {
      const url = request.nextUrl.clone()
      url.pathname = hasOrg ? "/app" : "/onboarding"
      url.search = ""
      return NextResponse.redirect(url)
    }

    if (!hasOrg && pathname.startsWith("/app")) {
      const url = request.nextUrl.clone()
      url.pathname = "/onboarding"
      url.search = ""
      return NextResponse.redirect(url)
    }

    if (hasOrg && pathname === "/onboarding") {
      // Allow onboarding wizard after signup; finish step navigates to /app.
      // Users who already completed can still visit — no redirect loop.
    }
  }

  return supabaseResponse
}
