import type { HnItem, StoryForAssessment } from "./types";

const API_ROOT = "https://hacker-news.firebaseio.com/v0";
const USER_AGENT = "HNFiltered.com/0.1 (+https://hnfiltered.com)";

const ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"',
};

export function plainText(value: string | undefined): string {
  if (!value) return "";

  return value
    .replace(/<p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
      const normalized = entity.toLowerCase();
      if (normalized.startsWith("#x")) {
        return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
      }
      if (normalized.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
      }
      return ENTITIES[normalized] ?? `&${entity};`;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n +/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_ROOT}/${path}.json`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok)
    throw new Error(`HN API returned ${response.status} for ${path}`);
  return response.json<T>();
}

export async function getTopStories(limit = 60): Promise<number[]> {
  const ids = await fetchJson<number[]>("topstories");
  return ids.slice(0, limit);
}

export async function getItem(id: number): Promise<HnItem | null> {
  return fetchJson<HnItem | null>(`item/${id}`);
}

export async function getItems(ids: number[]): Promise<Array<HnItem | null>> {
  const results: Array<HnItem | null> = [];
  for (let index = 0; index < ids.length; index += 20) {
    results.push(
      ...(await Promise.all(ids.slice(index, index + 20).map(getItem))),
    );
  }
  return results;
}

export async function buildAssessmentInput(
  story: HnItem,
  rank: number,
): Promise<StoryForAssessment> {
  const commentItems = await getItems((story.kids ?? []).slice(0, 12));
  const comments = commentItems
    .filter(
      (comment): comment is HnItem =>
        Boolean(comment?.text) && !comment?.dead && !comment?.deleted,
    )
    .map((comment) => ({
      id: comment.id,
      text: plainText(comment.text).slice(0, 4_000),
    }))
    .filter((comment) => comment.text.length > 0);

  let domain: string | null = null;
  if (story.url) {
    try {
      domain = new URL(story.url).hostname;
    } catch {
      domain = null;
    }
  }

  return {
    comments,
    descendants: story.descendants ?? 0,
    domain,
    id: story.id,
    rank,
    score: story.score ?? 0,
    text: plainText(story.text).slice(0, 4_000) || null,
    title: plainText(story.title),
  };
}
