# HNFiltered

Hacker News, unchanged, minus stories whose discussion suggests that clicking the link will be a waste of time.

[hnfiltered.com](https://hnfiltered.com) is a Cloudflare Worker that removes low-value stories from the Hacker News front page. Links, accounts, voting, and comments stay on Hacker News.

An experiment by [Mint Shelf](https://mintshelf.com).

## How it works

Every five minutes, the Worker reads ranks 6 through 30 and assesses every story with at least one top-level comment. `gpt-5.6-luna` scores whether each link looks like a waste of time. A small policy layer protects popular and controversial stories, then stores the result in Workers KV.

Page requests fetch the real HN homepage and remove the selected rows with `HTMLRewriter`. Model calls only happen in the scheduled job.

The top five stories are never removed. The filter targets up to six stories outside the top five; when the strict threshold finds fewer, it only adds stories with an identified failure mode and supporting comments. It never pads the count with unevidenced removals. Stories with at least 50 points require a strict evidence match and can never be added as fallback cleanup. Clearly controversial stories are protected.

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
