import { notFound } from "next/navigation";
import DevRender from "./DevRender";

export default function DevRenderPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DevRender />;
}
