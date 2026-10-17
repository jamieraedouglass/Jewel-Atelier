import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "../supabase/server";
import { isStudioAdmin } from "./admin";

export async function requireStudioAdmin() {
  const { user } = await requireUser();
  if (!user || !isStudioAdmin(user)) notFound();
  return user;
}
