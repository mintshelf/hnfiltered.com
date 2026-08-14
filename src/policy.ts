import type { Assessment, HnItem, StoredVerdict } from "./types";

export const PROMPT_VERSION = 1;
export const MIN_DESCENDANTS = 6;
export const MIN_TOP_LEVEL_THREADS = 2;
export const MIN_FILTERED_STORIES = 3;

export function isEligible(story: HnItem, rank: number): boolean {
  return (
    rank > 5 &&
    story.type === "story" &&
    !story.dead &&
    !story.deleted &&
    Boolean(story.title) &&
    (story.descendants ?? 0) >= MIN_DESCENDANTS &&
    (story.kids?.length ?? 0) >= MIN_TOP_LEVEL_THREADS
  );
}

export function shouldAnalyze(
  story: HnItem,
  existing: StoredVerdict | null,
  model: string,
  now = Date.now(),
): boolean {
  if (!existing) return true;
  if (existing.model !== model || existing.promptVersion !== PROMPT_VERSION)
    return true;

  const lastRun = Date.parse(existing.analyzedAt);
  if (!Number.isFinite(lastRun) || now - lastRun < 20 * 60 * 1000) return false;

  const descendants = story.descendants ?? 0;
  const added = descendants - existing.descendants;
  return added >= 5 && descendants >= Math.ceil(existing.descendants * 1.4);
}

export function shouldFilter(
  story: Pick<HnItem, "score">,
  rank: number,
  assessment: Assessment,
): boolean {
  if (rank <= 5) return false;

  let probabilityThreshold = rank <= 15 ? 0.98 : 0.92;
  let threadThreshold = rank <= 15 ? 3 : 2;

  if ((story.score ?? 0) >= 200) {
    probabilityThreshold = 0.99;
    threadThreshold = 3;
  }

  return (
    assessment.artifactFailureProbability >= probabilityThreshold &&
    assessment.independentEvidenceThreads >= threadThreshold &&
    assessment.supportingCommentIds.length >= threadThreshold &&
    assessment.failureModes.length > 0
  );
}

export function selectFilteredIds(
  rankedStories: Array<{ rank: number; story: HnItem }>,
  verdicts: ReadonlyMap<number, StoredVerdict | null>,
): number[] {
  const strictMatches = rankedStories
    .filter(({ rank, story }) => {
      if (rank > 30) return false;
      const verdict = verdicts.get(story.id);
      return verdict ? shouldFilter(story, rank, verdict.assessment) : false;
    })
    .map(({ story }) => story.id);
  if (strictMatches.length >= MIN_FILTERED_STORIES) return strictMatches;

  const visibleFallbacks = rankedStories.filter(
    ({ rank }) => rank > 5 && rank <= 30,
  );
  const assessedFallbacks = visibleFallbacks
    .map((entry) => ({ ...entry, verdict: verdicts.get(entry.story.id) }))
    .filter((entry): entry is typeof entry & { verdict: StoredVerdict } =>
      Boolean(entry.verdict),
    )
    .sort((left, right) => {
      const risk = (entry: typeof left) => {
        const assessment = entry.verdict.assessment;
        return (
          assessment.artifactFailureProbability +
          Math.min(assessment.independentEvidenceThreads, 4) * 0.08 +
          Math.min(assessment.supportingCommentIds.length, 4) * 0.03 -
          assessment.controversyProbability * 0.15 +
          entry.rank * 0.002
        );
      };
      return risk(right) - risk(left);
    });

  const selected = new Set(strictMatches);
  for (const fallback of assessedFallbacks) {
    if (selected.size >= MIN_FILTERED_STORIES) break;
    selected.add(fallback.story.id);
  }

  for (const fallback of visibleFallbacks.toReversed()) {
    if (selected.size >= MIN_FILTERED_STORIES) break;
    selected.add(fallback.story.id);
  }

  return [...selected];
}
