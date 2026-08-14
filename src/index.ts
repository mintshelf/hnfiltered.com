import { readManifest, runAnalysis } from "./analysis";
import { renderHomepage } from "./rewrite";
import type { Env } from "./types";

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
