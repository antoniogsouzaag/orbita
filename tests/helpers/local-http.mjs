/** HTTP-only local smoke-test session; does not start a browser or persist credentials. */
const decode = (value) => value.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

export async function loginLocal(baseUrl, password) {
  const base = new URL(baseUrl);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("This helper accepts local test servers only");
  const login = await fetch(new URL("/login", base), { signal: AbortSignal.timeout(120_000) });
  const html = await login.text();
  const formHtml = html.match(/<form\b[^>]*>([\s\S]*?)<\/form>/i)?.[1];
  if (!formHtml) throw new Error(`Login form not found (HTTP ${login.status})`);
  const form = new FormData();
  for (const input of formHtml.matchAll(/<input\b[^>]*>/gi)) {
    const attributes = Object.fromEntries([...input[0].matchAll(/([\w$:-]+)="([^"]*)"/g)].map((attribute) => [attribute[1], decode(attribute[2])]));
    if (attributes.type === "hidden" && attributes.name) form.append(attributes.name, attributes.value ?? "");
  }
  form.set("password", password);
  form.set("next", "/agenda");
  const response = await fetch(new URL("/login", base), { method: "POST", headers: { origin: base.origin }, body: form, redirect: "manual", signal: AbortSignal.timeout(120_000) });
  const cookie = response.headers.getSetCookie().map((item) => item.split(";")[0]).join("; ");
  if (!cookie || response.status !== 303) throw new Error(`Local login failed (HTTP ${response.status})`);
  return {
    async get(path) {
      const url = new URL(path, base);
      if (url.origin !== base.origin) throw new Error("Cross-origin request refused");
      const page = await fetch(url, { headers: { cookie }, redirect: "manual", signal: AbortSignal.timeout(120_000) });
      return { status: page.status, location: page.headers.get("location"), html: await page.text() };
    },
  };
}
