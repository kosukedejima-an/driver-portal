import type { MetadataRoute } from "next";

// 社内専用のため、検索エンジンにはどの画面も見に来ないように伝える
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
