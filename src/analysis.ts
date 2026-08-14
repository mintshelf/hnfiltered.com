import { buildAssessmentInput, getItems, getTopStories } from "./hn";
import { assessStory } from "./openai";
import {
  isEligible,
  PROMPT_VERSION,
  selectFilteredIds,
  shouldAnalyze,
} from "./policy";
import type { Env, FilterManifest, HnItem, StoredVerdict } from "./types";

const MANIFEST_KEY = "manifest:current";
const VERDICT_TTL_SECONDS = 3 * 24 * 60 * 60;

function verdictKey(storyId: number): string {
  return `verdict:${storyId}`;
}

export async function readManifest(env: Env): Promise<FilterManifest> {
  return (
    (await env.VERDICTS.get<FilterManifest>(MANIFEST_KEY, "json")) ?? {
      activeIds: [],
      generatedAt: new Date(0).toISOString(),
      mode: env.FILTER_MODE === "active" ? "active" : "shadow",
      predictedIds: [],
    }
  );
}

export async function runAnalysis(env: Env): Promise<FilterManifest> {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

  const model = env.OPENAI_MODEL ?? "gpt-5.6-luna";
  const maxAnalyses = Math.max(
    1,
    Math.min(20, Number(env.MAX_ANALYSES_PER_RUN ?? 8)),
  );
  const ids = await getTopStories(60);
  const items = await getItems(ids);
  const rankedStories = items
    .map((story, index) => ({ rank: index + 1, story }))
    .filter((entry): entry is { rank: number; story: HnItem } =>
      Boolean(entry.story),
    );

  const existingEntries = await Promise.all(
    rankedStories.map(async ({ story }) => ({
      story,
      verdict: await env.VERDICTS.get<StoredVerdict>(
        verdictKey(story.id),
        "json",
      ),
    })),
  );
  const existingById = new Map(
    existingEntries.map(({ story, verdict }) => [story.id, verdict]),
  );

  const candidates = rankedStories
    .filter(({ rank, story }) => isEligible(story, rank))
    .filter(({ story }) =>
      shouldAnalyze(story, existingById.get(story.id) ?? null, model),
    )
    .slice(0, maxAnalyses);

  for (let index = 0; index < candidates.length; index += 3) {
    await Promise.all(
      candidates.slice(index, index + 3).map(async ({ rank, story }) => {
        const input = await buildAssessmentInput(story, rank);
        if (input.comments.length < 2) return;

        const assessment = await assessStory(input, env.OPENAI_API_KEY!, model);
        const verdict: StoredVerdict = {
          analyzedAt: new Date().toISOString(),
          assessment,
          descendants: story.descendants ?? 0,
          model,
          promptVersion: PROMPT_VERSION,
          score: story.score ?? 0,
          storyId: story.id,
          title: story.title ?? "",
        };
        existingById.set(story.id, verdict);
        await env.VERDICTS.put(verdictKey(story.id), JSON.stringify(verdict), {
          expirationTtl: VERDICT_TTL_SECONDS,
        });
      }),
    );
  }

  const predictedIds = selectFilteredIds(rankedStories, existingById);

  const mode = env.FILTER_MODE === "active" ? "active" : "shadow";
  const storyById = new Map(
    rankedStories.map(({ story }) => [story.id, story]),
  );
  const filteredStories = predictedIds.map((id) => {
    const verdict = existingById.get(id);
    return {
      failureModes: verdict?.assessment.failureModes ?? [],
      id,
      title: verdict?.title ?? storyById.get(id)?.title ?? "Filtered story",
    };
  });
  const manifest: FilterManifest = {
    activeIds: mode === "active" ? predictedIds : [],
    filteredStories,
    generatedAt: new Date().toISOString(),
    mode,
    predictedIds,
  };
  await env.VERDICTS.put(MANIFEST_KEY, JSON.stringify(manifest));
  return manifest;
}
