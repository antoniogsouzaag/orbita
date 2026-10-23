import type { MetadataRoute } from "next";

/** App pessoal: nada deve ser indexado. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
