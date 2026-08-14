import type { Assessment, HnItem, StoredVerdict } from "./types";

export const PROMPT_VERSION = 6;
const MAX_POST_ONLY_DISCUSSION = 2;

export function isEligible(story: HnItem, rank: number): boolean {
  return (
    rank <= 90 &&
    story.type === "story" &&
    !story.dead &&
    !story.deleted &&
    Boolean(story.title)
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
  if (existing.descendants < 5 && added > 0) return true;
  return added >= 5 && descendants >= Math.ceil(existing.descendants * 1.4);
}

export function shouldFilter(
  story: Pick<HnItem, "descendants" | "score">,
  _rank: number,
  assessment: Assessment,
): boolean {
  return (
    assessment.verdict === "filter" &&
    assessment.failureModes.length > 0 &&
    ((assessment.basis === "post" &&
      (story.descendants ?? 0) <= MAX_POST_ONLY_DISCUSSION) ||
      (assessment.basis === "discussion" &&
        assessment.supportingCommentIds.length > 0))
  );
}

export function selectFilteredIds(
  rankedStories: Array<{ rank: number; story: HnItem }>,
  verdicts: ReadonlyMap<number, StoredVerdict | null>,
): number[] {
  const strictMatches = rankedStories
    .filter(({ rank, story }) => {
      if (rank > 90) return false;
      const verdict = verdicts.get(story.id);
      return verdict ? shouldFilter(story, rank, verdict.assessment) : false;
    })
    .map(({ story }) => story.id);
  return strictMatches;
}
