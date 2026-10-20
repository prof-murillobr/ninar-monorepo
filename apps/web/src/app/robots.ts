import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://ninar-app.com/sitemap.xml",
    host: "https://ninar-app.com",
  };
}
