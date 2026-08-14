# HNFiltered

Hacker News, unchanged, minus stories whose discussion provides strong evidence that clicking the link will be a waste of time.

HNFiltered is a deliberately small Cloudflare Worker at [hnfiltered.com](https://hnfiltered.com). It fetches the Hacker News homepage, removes conservatively classified low-value stories, and sends every click to the original Hacker News site. It does not reproduce article pages, accounts, voting, or comments.

An experiment by [Mint Shelf](https://mintshelf.com).

## How it works

1. A scheduled Worker reads current stories and ranked comments from the official Hacker News API.
2. Eligible stories are assessed by `gpt-5.6-luna` using a strict quality-failure rubric.
3. A deterministic policy applies popularity protection and requires independent evidence before filtering.
4. Verdicts are stored in Cloudflare KV.
5. Homepage requests stream the real HN HTML through `HTMLRewriter`, hiding only matching story rows.

No AI request happens during a visitor request. Cost follows the number of analyzed stories, not page views.

## Filtering policy

The classifier looks for evidence that the linked artifact itself is not worth opening, including materially misleading titles, unsupported or fabricated claims, thin or spam-like material, plagiarism, broken links, and nonfunctional projects.

It is explicitly instructed not to treat disagreement, controversy, politics, criticism of a company, corrections, sarcasm, or an unpopular conclusion as evidence of low quality.

The final decision is deterministic:

- The top five stories are never filtered.
- Ranks 6 through 15 require at least `0.98` artifact-failure probability and three independent top-level threads.
- Lower-ranked stories require at least `0.92` probability and two independent top-level threads.
- Stories with 200 or more points require at least `0.99` probability and three independent threads.
- Stories with fewer than six comments or fewer than two top-level threads are not analyzed.
- Any failure or uncertainty keeps the story.

## Development

```sh
bun install
cp .dev.vars.example .dev.vars
bun run dev
```

Put the local OpenAI key in `.dev.vars`. Never commit that file.

Useful commands:

```sh
bun run check
bun run test
bun run dev:scheduled
```

`FILTER_MODE` defaults to `shadow`. Shadow mode records predictions but does not remove stories. Change it to `active` only after reviewing representative verdicts.

## Deployment

The production KV namespace is configured in `wrangler.jsonc`. Add the OpenAI key as a Worker secret before deploying a new Worker environment:

```sh
bunx wrangler secret put OPENAI_API_KEY
bun run deploy
```

Cloudflare owns the runtime secret. The repository and `mise` configuration contain no encrypted or plaintext credentials.
