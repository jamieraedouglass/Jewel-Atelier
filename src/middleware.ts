import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isOpenPath } from "@/lib/access";
import { BRAND } from "@/lib/brand";

const gate = (request: NextRequest, signedIn: boolean, response: NextResponse) => {
  const path = request.nextUrl.pathname;
  if (!BRAND.private || signedIn || isOpenPath(path)) return response;
  if (path.startsWith("/api/")) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = path === "/" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return gate(request, false, response);
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  return gate(request, !!data.user, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)"],
};
