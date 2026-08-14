import { buildReviewInput, getItems, getTopStories } from "./hn";
import { selectStories } from "./openai";
import type { Env, FilterManifest, HnItem, StoryForReview } from "./types";

const MANIFEST_KEY = "manifest:current";

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

  const ids = await getTopStories(90);
  const items = await getItems(ids);
  const rankedStories = items
    .map((story, index) => ({ rank: index + 1, story }))
    .filter(
      (entry): entry is { rank: number; story: HnItem } =>
        entry.story?.type === "story" &&
        !entry.story.dead &&
        !entry.story.deleted &&
        Boolean(entry.story.title),
    );

  const inputs: StoryForReview[] = [];
  for (let index = 0; index < rankedStories.length; index += 10) {
    inputs.push(
      ...(await Promise.all(
        rankedStories
          .slice(index, index + 10)
          .map(({ rank, story }) => buildReviewInput(story, rank)),
      )),
    );
  }

  const selected = await selectStories(
    inputs,
    env.OPENAI_API_KEY,
    env.OPENAI_MODEL ?? "gpt-5.6-luna",
  );
  const selectedById = new Map(selected.map((story) => [story.id, story]));
  const filteredStories = rankedStories
    .filter(({ story }) => selectedById.has(story.id))
    .map(({ rank, story }) => ({
      id: story.id,
      rank,
      reason: selectedById.get(story.id)!.reason,
      title: story.title ?? "Filtered story",
    }));
  const predictedIds = filteredStories.map(({ id }) => id);
  const mode = env.FILTER_MODE === "active" ? "active" : "shadow";
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
