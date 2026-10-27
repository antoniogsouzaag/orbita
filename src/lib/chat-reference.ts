/** Tool names and prose references are labels, not relative application routes. */
export function chatReferenceHref(href?: string): string | null {
  if (!href) return null;
  if (href.startsWith("#")) return href;
  if (href.startsWith("/") && !href.startsWith("//") && !href.includes("\\")) return href;
  try {
    const url = new URL(href);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? href : null;
  } catch {
    return null;
  }
}
