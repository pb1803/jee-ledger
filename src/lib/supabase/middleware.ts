import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const STUDENT_ONLY_PREFIXES = [
  "/",
  "/analytics",
  "/daily-log",
  "/questions",
  "/revision",
  "/settings",
];

const VIEWER_ONLY_PREFIXES = ["/parent"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  const matches = (prefixes: string[]) =>
    prefixes.some((p) => path === p || path.startsWith(`${p}/`));

  const isStudentOnly = matches(STUDENT_ONLY_PREFIXES);
  const isViewerOnly = matches(VIEWER_ONLY_PREFIXES);

  if (!user) {
    if (isStudentOnly || isViewerOnly) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  let role: "STUDENT" | "VIEWER" = "STUDENT";
  const { data: profile } = await supabase
    .from("profile")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role === "VIEWER") role = "VIEWER";

  if (role === "VIEWER" && isStudentOnly) {
    const url = request.nextUrl.clone();
    url.pathname = "/parent";
    return NextResponse.redirect(url);
  }

  if (role === "STUDENT" && isViewerOnly) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
