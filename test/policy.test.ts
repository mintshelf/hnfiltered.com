import { describe, expect, it } from "vitest";

import {
  isEligible,
  PROMPT_VERSION,
  selectFilteredIds,
  shouldAnalyze,
  shouldFilter,
} from "../src/policy";
import type { Assessment, HnItem, StoredVerdict } from "../src/types";

const assessment: Assessment = {
  basis: "discussion",
  failureModes: ["thin_or_no_substance"],
  rationale: "A commenter who opened it found no substance.",
  supportingCommentIds: [1],
  verdict: "filter",
};

const story: HnItem = {
  descendants: 1,
  id: 100,
  kids: [1],
  score: 40,
  title: "Example",
  type: "story",
};

function stored(storyId: number, value = assessment): StoredVerdict {
  return {
    analyzedAt: new Date().toISOString(),
    assessment: value,
    descendants: 1,
    model: "gpt-5.6-luna",
    promptVersion: PROMPT_VERSION,
    score: 40,
    storyId,
    title: "Example",
  };
}

describe("filter policy", () => {
  it("considers stories throughout the first three pages", () => {
    expect(isEligible(story, 1)).toBe(true);
    expect(isEligible({ ...story, descendants: 0, kids: [] }, 90)).toBe(true);
    expect(isEligible(story, 91)).toBe(false);
  });

  it("does not use points or rank as protection", () => {
    expect(shouldFilter({ descendants: 50, score: 500 }, 1, assessment)).toBe(
      true,
    );
    expect(shouldFilter({ descendants: 1, score: 0 }, 90, assessment)).toBe(
      true,
    );
  });

  it("requires a cited comment for discussion-based filtering", () => {
    expect(
      shouldFilter(story, 20, {
        ...assessment,
        supportingCommentIds: [],
      }),
    ).toBe(false);
  });

  it("allows sparse stories to be filtered from the post itself", () => {
    expect(
      shouldFilter(story, 20, {
        ...assessment,
        basis: "post",
        supportingCommentIds: [],
      }),
    ).toBe(true);
  });

  it("does not let post metadata overrule an established discussion", () => {
    expect(
      shouldFilter({ ...story, descendants: 3 }, 20, {
        ...assessment,
        basis: "post",
        supportingCommentIds: [],
      }),
    ).toBe(false);
  });

  it("requires an explicit filter verdict and failure mode", () => {
    expect(shouldFilter(story, 20, { ...assessment, verdict: "keep" })).toBe(
      false,
    );
    expect(shouldFilter(story, 20, { ...assessment, failureModes: [] })).toBe(
      false,
    );
  });

  it("reanalyzes only after material discussion growth", () => {
    const existing = stored(story.id);
    existing.analyzedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    existing.descendants = 10;

    expect(
      shouldAnalyze({ ...story, descendants: 14 }, existing, existing.model),
    ).toBe(false);
    expect(
      shouldAnalyze({ ...story, descendants: 15 }, existing, existing.model),
    ).toBe(true);
  });

  it("reanalyzes sparse stories when their first comments arrive", () => {
    const existing = stored(story.id);
    existing.analyzedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    existing.descendants = 0;

    expect(
      shouldAnalyze({ ...story, descendants: 1 }, existing, existing.model),
    ).toBe(true);
  });

  it("selects supported verdicts across all 90 ranks", () => {
    const rankedStories = [
      { rank: 2, story: { ...story, id: 200 } },
      { rank: 67, story: { ...story, id: 201 } },
      { rank: 91, story: { ...story, id: 202 } },
    ];

    expect(
      selectFilteredIds(
        rankedStories,
        new Map([
          [200, stored(200)],
          [201, stored(201)],
          [202, stored(202)],
        ]),
      ),
    ).toEqual([200, 201]);
  });

  it("never pads the filter count", () => {
    const rankedStories = Array.from({ length: 90 }, (_, index) => ({
      rank: index + 1,
      story: { ...story, id: index + 1 },
    }));

    expect(selectFilteredIds(rankedStories, new Map())).toEqual([]);
  });
});
