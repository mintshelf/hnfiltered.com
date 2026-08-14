import type { Env, FilterManifest } from "./types";

const HN_HOME = "https://news.ycombinator.com/";
const FILTERED_HOME = "https://hnfiltered.com/";
const CACHE_KEY = new Request("https://hnfiltered.invalid/cache/hn-home");
const SEO_DESCRIPTION =
  "Hacker News, unchanged, minus stories whose discussion provides strong evidence that clicking the link will be a waste of time.";
const SEO_TITLE = "HNFiltered | A more useful Hacker News front page";
const SEO_JSON_LD =
  '{"@context":"https://schema.org","@type":"WebSite","name":"HNFiltered","url":"https://hnfiltered.com/","description":"Hacker News, unchanged, minus stories whose discussion provides strong evidence that clicking the link will be a waste of time.","creator":{"@type":"Organization","name":"Mint Shelf","url":"https://mintshelf.com/"}}';
const DISMISS_SCRIPT =
  'document.addEventListener("focusin",e=>{const p=document.getElementById("hnfiltered-why-popover"),b=document.querySelector(".hnfiltered-why-toggle");p?.matches(":popover-open")&&!p.contains(e.target)&&!b?.contains(e.target)&&p.hidePopover()});';

const MINT_SHELF_MARK = `<svg aria-hidden="true" viewBox="0 0 64 64" width="24" height="24">
  <g fill="#22c55e" transform="translate(32 0) scale(1.0573 1) translate(-32 0) translate(5.5 4) scale(.2994652406) translate(-27 -28)">
    <path d="M31.25 27.807 27 28.115l.008 25.692c.004 14.131.471 28.554 1.039 32.052 1.579 9.734 5.938 18.286 12.833 25.181 7.003 7.003 15.335 11.315 24.967 12.922 3.734.622 14.771.984 25.153.824l18.5-.286.288-27c.301-28.29-.423-36.595-3.871-44.41-4.76-10.787-15.676-20.563-26.295-23.548-3.438-.967-11.534-1.539-24.622-1.741-10.725-.166-21.413-.163-23.75.006Z"/>
    <path d="M178 28c-24.05.491-24.606.55-30.281 3.209-3.18 1.49-8.405 5.211-11.611 8.27-7.012 6.688-11.585 15.812-13.051 26.038-.985 6.877-1.031 38.005-.057 38.651.275.183 10.175.095 22-.194 19.111-.467 22.111-.771 27-2.734 10.196-4.095 20.852-14.826 26.317-26.5C202.351 66.124 204 56.51 204 41.612c0-7.422-.338-13.633-.75-13.803-.412-.17-11.775-.084-25.25.191Z"/>
    <path d="M122.675 119.405c-1.007 2.623-.743 49.065.322 56.6.592 4.196 2.345 10.25 3.982 13.754 5.743 12.293 17.871 21.803 30.907 24.236 2.963.553 14.579 1.005 25.814 1.005h20.427l-.314-31.75-.313-31.75-3.215-6.788c-3.793-8.007-12.214-17.267-19.123-21.027-8.389-4.566-15.643-5.654-37.805-5.67-16.384-.012-20.244.247-20.682 1.39Z"/>
    <path d="M70.293 139.136c-2.863.349-8.194 2.033-11.845 3.742-8.92 4.174-18.947 14.191-23.748 23.725-5.394 10.711-6.868 17.805-7.046 33.897l-.154 14h24.5c21.011 0 25.234-.256 29.656-1.799 7.746-2.703 15.6-8.834 20.265-15.821 6.726-10.072 7.579-14.316 7.579-37.719v-20.339l-17-.161c-9.35-.089-19.343.125-22.207.475Z"/>
  </g>
</svg>`;

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
    const selectors = this.hiddenIds.length
      ? this.hiddenIds
          .flatMap((id) => {
            const story = `tr.athing[id="${id}"]`;
            return [story, `${story} + tr`, `${story} + tr + tr`];
          })
          .join(",") + "{display:none!important}"
      : "";
    element.append(
      `<style>
        ${selectors}
        .hnname{white-space:nowrap}
        .hnfiltered-wordmark{display:inline-block;margin:0 8px 0 4px;padding:1px 3px;border-radius:2px;background:#4a1f44;color:#fff45c;font-family:Georgia,"Times New Roman",serif;font-size:inherit;font-style:italic;font-weight:700;letter-spacing:-.03em;line-height:inherit;transform:rotate(-2deg);transform-origin:center}
        .hnfiltered-status{display:inline-block;white-space:nowrap}
        .hnfiltered-count{padding:1px 3px;border-radius:2px;background:rgba(255,255,255,.3);color:#3f210e;font-style:italic;font-weight:700}
        .hnfiltered-why-toggle{appearance:none;padding:0;border:0;background:none;color:#000;font-family:inherit;font-size:inherit;font-style:normal;font-weight:normal;line-height:inherit;cursor:pointer}
        .hnfiltered-why-panel{position:absolute;z-index:10;top:32px;left:50%;box-sizing:border-box;width:380px;margin:0;padding:10px 12px;transform:translateX(-50%);border:1px solid #ff6600;background:#f6f6ef;box-shadow:0 3px 10px rgba(0,0,0,.16);color:#3c3c3c;font-family:Verdana,Geneva,sans-serif;font-size:10px;font-weight:normal;line-height:1.45;white-space:normal}
        .hnfiltered-why-panel::backdrop{background:transparent}
        .hnfiltered-popover-credit{display:flex;justify-content:flex-end;align-items:center;gap:7px;margin-top:8px;color:#000}
        .hnfiltered-popover-brand{display:inline-flex;align-items:center;gap:6px;color:#1a1c19!important;font-family:"Public Sans",system-ui,sans-serif;font-size:11pt;font-weight:650;letter-spacing:-.01em;text-decoration:none!important}
        .hnfiltered-popover-brand svg{display:block;flex:none;width:24px;height:24px}
        .hnfiltered-footer{display:grid;grid-template-columns:1fr;gap:6px;margin:8px 16px 0;color:#828282;font-size:8pt;line-height:1.45}
        .hnfiltered-quote{width:100%;text-align:center}
        .hnfiltered-credit{display:inline-flex;justify-self:center;align-items:center;gap:7px;white-space:nowrap}
        .hnfiltered-credit-prefix{color:#000;font-family:Verdana,Geneva,sans-serif;font-size:8pt;font-weight:normal}
        .hnfiltered-brand{display:inline-flex;align-items:center;gap:6px;color:#1a1c19!important;font-family:"Public Sans",system-ui,sans-serif;font-size:11pt;font-weight:650;letter-spacing:-.01em;text-decoration:none!important}
        .hnfiltered-brand svg{display:block;flex:none;width:24px;height:24px}
        @media(max-width:700px){
          .hnfiltered-wordmark{margin-right:5px}
          .hnfiltered-status{position:relative;top:2px;margin-top:2px;line-height:1.35}
          .hnfiltered-why-panel{top:62px;right:12px;left:12px;width:auto;transform:none}
          .hnfiltered-popover-credit{justify-content:center}
          .hnfiltered-popover-brand{font-size:10pt}
          .hnfiltered-footer{gap:8px;margin:8px 12px 0}
          .hnfiltered-credit{justify-self:center}
          .hnfiltered-brand{font-size:10pt}
        }
      </style>`,
      { html: true },
    );
    element.append(`<script>${DISMISS_SCRIPT}</script>`, { html: true });
    element.append(
      `<meta name="description" content="${escapeAttribute(SEO_DESCRIPTION)}">
      <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
      <meta name="theme-color" content="#ff6600">
      <link rel="canonical" href="${FILTERED_HOME}">
      <link rel="alternate" type="text/markdown" href="${FILTERED_HOME}llms.txt" title="About HNFiltered">
      <meta property="og:type" content="website">
      <meta property="og:site_name" content="HNFiltered">
      <meta property="og:title" content="${escapeAttribute(SEO_TITLE)}">
      <meta property="og:description" content="${escapeAttribute(SEO_DESCRIPTION)}">
      <meta property="og:url" content="${FILTERED_HOME}">
      <meta name="twitter:card" content="summary">
      <meta name="twitter:title" content="${escapeAttribute(SEO_TITLE)}">
      <meta name="twitter:description" content="${escapeAttribute(SEO_DESCRIPTION)}">
      <script type="application/ld+json">${SEO_JSON_LD}</script>`,
      { html: true },
    );
  }
}

class TitleHandler implements HTMLRewriterElementContentHandlers {
  element(element: Element): void {
    element.setInnerContent(SEO_TITLE);
  }
}

class AttributeHandler implements HTMLRewriterElementContentHandlers {
  constructor(
    private readonly name: string,
    private readonly value: string,
  ) {}

  element(element: Element): void {
    element.setAttribute(this.name, this.value);
  }
}

class RemoveHandler implements HTMLRewriterElementContentHandlers {
  element(element: Element): void {
    element.remove();
  }
}

class MoreLinkHandler implements HTMLRewriterElementContentHandlers {
  element(element: Element): void {
    element.setInnerContent("More stories");
    element.setAttribute("aria-label", "More Hacker News stories");
  }
}

class NameHandler implements HTMLRewriterElementContentHandlers {
  element(element: Element): void {
    element.append('<span class="hnfiltered-wordmark">Filtered</span>', {
      html: true,
    });
  }
}

class HomeLinkHandler implements HTMLRewriterElementContentHandlers {
  constructor(private readonly homeUrl: string) {}

  element(element: Element): void {
    element.setAttribute("href", this.homeUrl);
  }
}

class UpstreamUrlHandler implements HTMLRewriterElementContentHandlers {
  constructor(private readonly attribute: "action" | "href" | "src") {}

  element(element: Element): void {
    const value = element.getAttribute(this.attribute);
    if (value) {
      element.setAttribute(this.attribute, new URL(value, HN_HOME).toString());
    }
  }
}

class NavigationHandler implements HTMLRewriterElementContentHandlers {
  private handled = false;

  constructor(private readonly filteredCount: number) {}

  element(element: Element): void {
    if (this.handled) return;
    this.handled = true;
    const countLabel =
      this.filteredCount === 0 ? "All Clear" : String(this.filteredCount);
    element.append(
      `<span class="hnfiltered-status">&nbsp;| <span class="hnfiltered-count">Auto-Filtered: ${countLabel}</span> | <button class="hnfiltered-why-toggle" type="button" popovertarget="hnfiltered-why-popover">why?</button><span class="hnfiltered-why-panel" id="hnfiltered-why-popover" popover>Hacker News, unchanged, minus stories whose discussion provides strong evidence that clicking the link will be a waste of time.<span class="hnfiltered-popover-credit"><span>An experiment by</span><a class="hnfiltered-popover-brand" href="https://mintshelf.com/" rel="noopener noreferrer">${MINT_SHELF_MARK}<span>Mint Shelf</span></a></span></span></span>`,
      { html: true },
    );
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
    const filterLine =
      count > 0
        ? `<span style="display:block;margin-top:2px">${countText}${showLink}</span>`
        : "";

    element.after(
      `<div class="hnfiltered-footer"${shadowText}>
        <div class="hnfiltered-quote" id="hnfiltered-why">
          <span>Hacker News, unchanged, minus stories whose discussion provides strong evidence that clicking the link will be a waste of time.</span>
          ${filterLine}
        </div>
        <div class="hnfiltered-credit">
          <span class="hnfiltered-credit-prefix">An experiment by</span>
          <a class="hnfiltered-brand" href="https://mintshelf.com/" rel="noopener noreferrer">
            ${MINT_SHELF_MARK}
            <span>Mint Shelf</span>
          </a>
        </div>
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
  const homeUrl = FILTERED_HOME;
  const showAll = requestUrl.searchParams.get("show") === "all";
  const hiddenIds = showAll ? [] : manifest.activeIds;
  const upstream = await getHomepage();
  const transformed = new HTMLRewriter()
    .on("head", new HeadHandler(hiddenIds))
    .on("title", new TitleHandler())
    .on(
      'script[src*="static.cloudflareinsights.com/beacon.min.js"]',
      new RemoveHandler(),
    )
    .on("a[href], link[href]", new UpstreamUrlHandler("href"))
    .on("img[src], script[src]", new UpstreamUrlHandler("src"))
    .on("form[action]", new UpstreamUrlHandler("action"))
    .on("img", new AttributeHandler("alt", ""))
    .on(
      'a[href="https://news.ycombinator.com"] img',
      new AttributeHandler("alt", "HNFiltered home"),
    )
    .on("#bigbox > td > table", new AttributeHandler("role", "main"))
    .on(
      'form[action="//hn.algolia.com/"] input[name="q"]',
      new AttributeHandler("aria-label", "Search Hacker News"),
    )
    .on("a.morelink", new MoreLinkHandler())
    .on(".hnname", new NameHandler())
    .on(".hnname a", new HomeLinkHandler(homeUrl))
    .on('a[href="https://news.ycombinator.com"]', new HomeLinkHandler(homeUrl))
    .on(".pagetop", new NavigationHandler(manifest.activeIds.length))
    .on(".yclinks", new FooterHandler(manifest, homeUrl, showAll))
    .transform(upstream);

  const headers = new Headers(transformed.headers);
  const body = transformed.body?.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("<!doctype html>"));
      },
    }),
  );

  headers.set(
    "Cache-Control",
    "public, max-age=30, stale-while-revalidate=120",
  );
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; base-uri 'self'; form-action https://news.ycombinator.com https://hn.algolia.com; img-src https://news.ycombinator.com https://account.ycombinator.com data:; style-src 'unsafe-inline' https://news.ycombinator.com; script-src 'sha256-NFq79iTywH79TVgamEHAoPyxAuqJgv7dGmHfZwDHvcU=' 'sha256-Khp8DKeMdzG6r5ov2yC8BEh68ZB7jQsWOc2Z+gSveww=' https://news.ycombinator.com https://static.cloudflareinsights.com; connect-src 'self'; frame-ancestors 'none'",
  );
  headers.set("Content-Language", "en");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set(
    "X-Robots-Tag",
    "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
  );
  return new Response(body, {
    headers,
    status: transformed.status,
  });
}
