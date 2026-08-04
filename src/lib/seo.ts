export interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterCard?: "summary" | "summary_large_image";
  noindex?: boolean;
}

export function pageMeta({
  title,
  description,
  path,
  ogTitle,
  ogDescription,
  twitterCard = "summary_large_image",
  noindex,
}: PageMetaInput) {
  const fullTitle = path === "/" ? `Course Compass — ${title}` : `${title} — Course Compass`;
  const meta = [
    { title: fullTitle },
    { name: "description", content: description },
    { property: "og:title", content: ogTitle ?? fullTitle },
    { property: "og:description", content: ogDescription ?? description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: path },
    { name: "twitter:card", content: twitterCard },
  ];

  if (noindex) {
    meta.push({ name: "robots", content: "noindex" });
  }

  return {
    meta,
    links: [{ rel: "canonical", href: path }],
  };
}
