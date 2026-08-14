export interface Env {
  FILTER_MODE?: "active" | "shadow";
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

export interface StoryForReview {
  comments: Array<{ id: number; text: string }>;
  descendants: number;
  domain: string | null;
  id: number;
  rank: number;
  score: number;
  text: string | null;
  title: string;
  url: string | null;
}

export interface SelectedStory {
  id: number;
  reason: string;
}

export interface FilterManifest {
  activeIds: number[];
  filteredStories?: FilteredStorySummary[];
  generatedAt: string;
  mode: "active" | "shadow";
  predictedIds: number[];
}

export interface FilteredStorySummary {
  id: number;
  rank?: number;
  reason?: string;
  title: string;
}
