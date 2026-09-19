import { NextRequest } from "next/server";
import { handle } from "@/server/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
async function route(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return handle(req, (await params).path);
}
export { route as GET, route as POST, route as PATCH, route as DELETE };
