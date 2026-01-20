import { title } from "@/components/primitives";
import { get } from "@vercel/edge-config";

export default function AboutPage() {
  return (
    <div className="w-full">
      <h1 className={title()}>About</h1>
      <p>{get("greeting")}</p>
    </div>
  );
}
