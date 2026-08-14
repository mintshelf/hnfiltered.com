import type { Env, FilterManifest } from "./types";

const HN_HOME = "https://news.ycombinator.com/";
const CACHE_KEY = new Request("https://hnfiltered.invalid/cache/hn-home");

function escapeAttribute(value: string): string {
  return value.replace(/[&"<>]/g, (character) => {
    return { "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" }[
      character
    ]!;
  });
}

async function getHomepage(): Promise<Response> {
  const cache = (caches as CacheStorage & { default: Cache }).default;
  const cached = await cache.match(CACHE_KEY);
  if (cached) return cached;

  const upstream = await fetch(HN_HOME, {
    headers: { "User-Agent": "HNFiltered.com/0.1 (+https://hnfiltered.com)" },
  });
  if (!upstream.ok) throw new Error(`Hacker News returned ${upstream.status}`);

  const headers = new Headers(upstream.headers);
  headers.set("Cache-Control", "public, max-age=30");
  const cacheable = new Response(upstream.body, {
    headers,
    status: upstream.status,
    statusText: upstream.statusText,
  });
  await cache.put(CACHE_KEY, cacheable.clone());
  return cacheable;
}

class HeadHandler implements HTMLRewriterElementContentHandlers {
  constructor(private readonly hiddenIds: number[]) {}

  element(element: Element): void {
    element.prepend('<base href="https://news.ycombinator.com/">', {
      html: true,
    });
    if (this.hiddenIds.length === 0) return;

    const selectors = this.hiddenIds
      .flatMap((id) => {
        const story = `tr.athing[id="${id}"]`;
        return [story, `${story} + tr`, `${story} + tr + tr`];
      })
      .join(",");
    element.append(`<style>${selectors}{display:none!important}</style>`, {
      html: true,
    });
  }
}

class FooterHandler implements HTMLRewriterElementContentHandlers {
  constructor(
    private readonly manifest: FilterManifest,
    private readonly homeUrl: string,
    private readonly showAll: boolean,
  ) {}

  element(element: Element): void {
    const count = this.manifest.activeIds.length;
    const countText = `${count} ${count === 1 ? "story" : "stories"} filtered`;
    const showLink =
      count > 0 && !this.showAll
        ? ` &nbsp;|&nbsp; <a href="${escapeAttribute(this.homeUrl)}?show=all">show unfiltered</a>`
        : "";
    const shadowText =
      this.manifest.mode === "shadow" && this.manifest.predictedIds.length > 0
        ? ` data-shadow-count="${this.manifest.predictedIds.length}"`
        : "";

    element.after(
      `<div class="hnfiltered-note"${shadowText} style="color:#828282;font-size:8pt;line-height:1.5;margin-top:6px">
        <span>${countText}</span>${showLink}
        &nbsp;|&nbsp;
        <details style="display:inline">
          <summary style="cursor:pointer;display:inline">why?</summary>
          <span style="display:block;margin:4px auto 0;max-width:620px">Hacker News, unchanged, minus stories whose discussion provides strong evidence that clicking the link will be a waste of time.</span>
        </details>
        <span style="display:block;margin-top:2px"><a href="https://mintshelf.com/" rel="noopener noreferrer">an experiment by Mint Shelf</a></span>
      </div>`,
      { html: true },
    );
  }
}

export async function renderHomepage(
  request: Request,
  _env: Env,
  manifest: FilterManifest,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const showAll = requestUrl.searchParams.get("show") === "all";
  const hiddenIds = showAll ? [] : manifest.activeIds;
  const upstream = await getHomepage();
  const transformed = new HTMLRewriter()
    .on("head", new HeadHandler(hiddenIds))
    .on(
      ".yclinks",
      new FooterHandler(manifest, requestUrl.origin + "/", showAll),
    )
    .transform(upstream);

  const headers = new Headers(transformed.headers);
  headers.set(
    "Cache-Control",
    "public, max-age=30, stale-while-revalidate=120",
  );
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; base-uri https://news.ycombinator.com/; form-action https://news.ycombinator.com/; img-src https://news.ycombinator.com https://account.ycombinator.com data:; style-src 'unsafe-inline' https://news.ycombinator.com; frame-ancestors 'none'",
  );
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(transformed.body, {
    headers,
    status: transformed.status,
  });
}
