import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "../supabase/server";
import { isStudioAdmin } from "./admin";

/** for studio pages and actions: the signed-in master account, or a plain "not found" for anyone else */
export async function requireStudioAdmin() {
  const { user } = await requireUser();
  if (!user || !isStudioAdmin(user)) notFound();
  return user;
}
