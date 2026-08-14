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
  artifactFailureProbability: 0.99,
  controversyProbability: 0.2,
  failureModes: ["thin_or_no_substance"],
  independentEvidenceThreads: 3,
  interestCommentIds: [],
  interestProbability: 0.1,
  rationale: "Independent comments identify a lack of substance.",
  supportingCommentIds: [1, 2, 3],
};

const story: HnItem = {
  descendants: 12,
  id: 100,
  kids: [1, 2, 3],
  score: 40,
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
        artifactFailureProbability: 0.29,
      }),
    ).toBe(false);
    expect(
      shouldFilter(story, 10, {
        ...assessment,
        artifactFailureProbability: 0.3,
      }),
    ).toBe(true);
  });

  it("only filters popular stories with a strict evidence match", () => {
    expect(
      shouldFilter({ score: 50 }, 20, {
        ...assessment,
        artifactFailureProbability: 0.98,
        independentEvidenceThreads: 1,
        supportingCommentIds: [1],
      }),
    ).toBe(false);
    expect(
      shouldFilter({ score: 50 }, 20, {
        ...assessment,
        artifactFailureProbability: 0.3,
      }),
    ).toBe(true);
    expect(shouldFilter({ score: 49 }, 20, assessment)).toBe(true);
  });

  it("protects clearly controversial stories", () => {
    expect(
      shouldFilter(story, 20, {
        ...assessment,
        controversyProbability: 0.7,
      }),
    ).toBe(false);
  });

  it("requires waste-of-time evidence to outweigh genuine interest", () => {
    expect(
      shouldFilter(story, 20, {
        ...assessment,
        artifactFailureProbability: 0.6,
        interestCommentIds: [4, 5, 6],
        interestProbability: 0.5,
      }),
    ).toBe(false);
    expect(
      shouldFilter(story, 20, {
        ...assessment,
        artifactFailureProbability: 0.65,
        interestCommentIds: [4, 5, 6],
        interestProbability: 0.5,
      }),
    ).toBe(true);
  });

  it("requires enough discussion before analysis", () => {
    expect(isEligible(story, 6)).toBe(true);
    expect(isEligible({ ...story, descendants: 1, kids: [1] }, 6)).toBe(true);
    expect(isEligible({ ...story, descendants: 0 }, 6)).toBe(false);
    expect(isEligible({ ...story, kids: [] }, 6)).toBe(false);
  });

  it("reanalyzes only after material discussion growth", () => {
    const existing: StoredVerdict = {
      analyzedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      assessment,
      descendants: 10,
      model: "gpt-5.6-luna",
      promptVersion: PROMPT_VERSION,
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

  it("only supplements strict matches with evidence-backed assessments", () => {
    const moderateVerdict: StoredVerdict = {
      analyzedAt: new Date().toISOString(),
      assessment: {
        ...assessment,
        artifactFailureProbability: 0.62,
      },
      descendants: 10,
      model: "gpt-5.6-luna",
      promptVersion: 1,
      score: 20,
      storyId: 200,
      title: "Moderate risk",
    };
    const lowVerdict: StoredVerdict = {
      ...moderateVerdict,
      assessment: {
        ...moderateVerdict.assessment,
        artifactFailureProbability: 0.08,
        independentEvidenceThreads: 0,
        supportingCommentIds: [],
      },
      storyId: 201,
      title: "Low risk",
    };
    const rankedStories = Array.from({ length: 6 }, (_, index) => ({
      rank: index + 9,
      story: { ...story, id: 200 + index },
    }));

    expect(
      selectFilteredIds(
        rankedStories,
        new Map([
          [200, moderateVerdict],
          [201, lowVerdict],
        ]),
      ),
    ).toEqual([200]);
  });

  it("does not pad the filter count before assessments exist", () => {
    const rankedStories = Array.from({ length: 30 }, (_, index) => ({
      rank: index + 1,
      story: { ...story, id: index + 1 },
    }));

    expect(selectFilteredIds(rankedStories, new Map())).toEqual([]);
  });
});
