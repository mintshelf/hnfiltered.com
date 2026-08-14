import { describe, expect, it } from "vitest";

import { isEligible, shouldAnalyze, shouldFilter } from "../src/policy";
import type { Assessment, HnItem, StoredVerdict } from "../src/types";

const assessment: Assessment = {
  artifactFailureProbability: 0.99,
  controversyProbability: 0.2,
  failureModes: ["thin_or_no_substance"],
  independentEvidenceThreads: 3,
  rationale: "Independent comments identify a lack of substance.",
  supportingCommentIds: [1, 2, 3],
};

const story: HnItem = {
  descendants: 12,
  id: 100,
  kids: [1, 2, 3],
  score: 50,
  title: "Example",
  type: "story",
};

describe("filter policy", () => {
  it("never filters the top five", () => {
    expect(shouldFilter(story, 5, assessment)).toBe(false);
  });

  it("requires stronger evidence near the top", () => {
    expect(
      shouldFilter(story, 10, {
        ...assessment,
        artifactFailureProbability: 0.97,
      }),
    ).toBe(false);
    expect(shouldFilter(story, 10, assessment)).toBe(true);
  });

  it("protects highly popular stories", () => {
    expect(
      shouldFilter({ score: 200 }, 20, {
        ...assessment,
        artifactFailureProbability: 0.98,
      }),
    ).toBe(false);
    expect(shouldFilter({ score: 200 }, 20, assessment)).toBe(true);
  });

  it("requires enough discussion before analysis", () => {
    expect(isEligible(story, 6)).toBe(true);
    expect(isEligible({ ...story, descendants: 5 }, 6)).toBe(false);
    expect(isEligible({ ...story, kids: [1] }, 6)).toBe(false);
  });

  it("reanalyzes only after material discussion growth", () => {
    const existing: StoredVerdict = {
      analyzedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      assessment,
      descendants: 10,
      model: "gpt-5.6-luna",
      promptVersion: 1,
      score: 20,
      storyId: story.id,
      title: story.title!,
    };
    expect(
      shouldAnalyze({ ...story, descendants: 14 }, existing, existing.model),
    ).toBe(false);
    expect(
      shouldAnalyze({ ...story, descendants: 15 }, existing, existing.model),
    ).toBe(true);
  });
});
