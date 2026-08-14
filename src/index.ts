import { readManifest, runAnalysis } from "./analysis";
import { renderHomepage } from "./rewrite";
import { TAGLINE } from "./site";
import type { Env } from "./types";

function textResponse(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function redirectToHackerNews(url: URL): Response {
  const destination = new URL(
    url.pathname + url.search,
    "https://news.ycombinator.com",
  );
  return Response.redirect(destination.toString(), 302);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/robots.txt") {
      return textResponse(
        "User-agent: *\nAllow: /\nDisallow: /health\nSitemap: https://hnfiltered.com/sitemap.xml\n",
        "text/plain; charset=utf-8",
      );
    }

    if (url.pathname === "/sitemap.xml") {
      return textResponse(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://hnfiltered.com/</loc><changefreq>hourly</changefreq></url></urlset>\n',
        "application/xml; charset=utf-8",
      );
    }

    if (url.pathname === "/llms.txt") {
      return textResponse(
        `# HNFiltered\n\n> ${TAGLINE}\n\nHNFiltered removes stories when their Hacker News discussion suggests the link is not worth opening. Popular, controversial, and merely unpopular stories are protected from ordinary negative sentiment.\n\nAn experiment by Mint Shelf.\n\n- Homepage: https://hnfiltered.com/\n- Source: https://github.com/mintshelf/hnfiltered.com\n- Creator: https://mintshelf.com/\n`,
        "text/markdown; charset=utf-8",
      );
    }

    if (url.pathname === "/health") {
      const manifest = await readManifest(env);
      return Response.json(
        {
          filtered: manifest.activeIds.length,
          generatedAt: manifest.generatedAt,
          mode: manifest.mode,
          predicted: manifest.predictedIds.length,
          status: "ok",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (url.pathname !== "/") return redirectToHackerNews(url);
    const page = Number.parseInt(url.searchParams.get("p") ?? "1", 10);
    if (!Number.isInteger(page) || page < 1 || page > 3) {
      return redirectToHackerNews(url);
    }

    try {
      return await renderHomepage(request, env, await readManifest(env));
    } catch (error) {
      console.error("Unable to render filtered homepage", error);
      return redirectToHackerNews(url);
    }
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      runAnalysis(env).catch((error) => {
        console.error("Scheduled analysis failed", error);
      }),
    );
  },
} satisfies ExportedHandler<Env>;
