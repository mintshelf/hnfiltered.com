# HNFiltered

Hacker News, unchanged, minus stories whose discussion suggests that clicking the link will be a waste of time.

[hnfiltered.com](https://hnfiltered.com) is a Cloudflare Worker that removes low-value stories from the first three pages of Hacker News. Links, accounts, voting, and comments stay on Hacker News.

An experiment by [Mint Shelf](https://mintshelf.com).

## How it works

Every five minutes, the Worker gives `gpt-5.6-luna` the top 90 stories, including their titles, URLs, story text, and a few top-level comments. It asks which ones look like low-quality slop or a wasted click, then stores Luna's short list in Workers KV. Stories with little or no discussion are still included.

Page requests fetch the corresponding HN page and remove selected rows with `HTMLRewriter`. The first two "More stories" links stay on HNFiltered; everything else points to Hacker News. Model calls only happen in the scheduled job.

There are no point thresholds, popularity exceptions, confidence scores, failure-mode labels, per-story classifiers, or minimum number of removals.

## Local development

```sh
bun install
cp .dev.vars.example .dev.vars
bun run dev
```

Add an OpenAI key to `.dev.vars`. Run the checks with:

```sh
bun run check
```

## Deployment

```sh
bunx wrangler secret put OPENAI_API_KEY
bun run deploy
```

## License

[MIT](LICENSE.md), with an optional beerware note.
