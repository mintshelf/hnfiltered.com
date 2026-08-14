# HNFiltered

Hacker News, unchanged, minus stories whose discussion suggests that clicking the link will be a waste of time.

[hnfiltered.com](https://hnfiltered.com) is a Cloudflare Worker that removes low-value stories from the first three pages of Hacker News. Links, accounts, voting, and comments stay on Hacker News.

An experiment by [Mint Shelf](https://mintshelf.com).

## How it works

Every five minutes, the Worker reads the top 90 stories. `gpt-5.6-luna` makes a plain keep-or-filter decision from the title, URL, story text, and up to 12 top-level comments, then stores the result in Workers KV. Stories with little or no discussion are still considered, but a lack of comments is not itself a reason to filter.

Page requests fetch the corresponding HN page and remove selected rows with `HTMLRewriter`. The first two "More stories" links stay on HNFiltered; everything else points to Hacker News. Model calls only happen in the scheduled job.

There are no point thresholds, popularity exceptions, confidence scores, or minimum number of removals. Discussion-based decisions must cite at least one supplied comment. Sparse-discussion stories can only be filtered when the post metadata itself gives Luna enough reason. Ambiguous stories stay visible.

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
