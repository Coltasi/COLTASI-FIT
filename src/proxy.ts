import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icons|brand|manifest.json|sw.js|offline.html|.*\\.(?:svg|png|ico|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
