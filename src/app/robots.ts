import type { MetadataRoute } from "next";

// Recruiting pages must never be indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
