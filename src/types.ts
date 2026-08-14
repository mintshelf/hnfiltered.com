export interface Env {
  FILTER_MODE?: "active" | "shadow";
  MAX_ANALYSES_PER_RUN?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  VERDICTS: KVNamespace;
}

export interface HnItem {
  by?: string;
  dead?: boolean;
  deleted?: boolean;
  descendants?: number;
  id: number;
  kids?: number[];
  score?: number;
  text?: string;
  time?: number;
  title?: string;
  type?: "comment" | "job" | "poll" | "pollopt" | "story";
  url?: string;
}

export const FAILURE_MODES = [
  "broken_or_inaccessible",
  "fabricated_or_unsupported",
  "misleading_title",
  "nonfunctional_project",
  "plagiarized_or_copied",
  "spam_or_bait",
  "thin_or_no_substance",
] as const;

export type FailureMode = (typeof FAILURE_MODES)[number];

export interface Assessment {
  artifactFailureProbability: number;
  controversyProbability: number;
  failureModes: FailureMode[];
  independentEvidenceThreads: number;
  rationale: string;
  supportingCommentIds: number[];
}

export interface StoryForAssessment {
  comments: Array<{ id: number; text: string }>;
  descendants: number;
  domain: string | null;
  id: number;
  rank: number;
  score: number;
  text: string | null;
  title: string;
}

export interface StoredVerdict {
  analyzedAt: string;
  assessment: Assessment;
  descendants: number;
  model: string;
  promptVersion: number;
  score: number;
  storyId: number;
  title: string;
}

export interface FilterManifest {
  activeIds: number[];
  generatedAt: string;
  mode: "active" | "shadow";
  predictedIds: number[];
}
