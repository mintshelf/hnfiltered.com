# Security

Report vulnerabilities privately through the [Mint Shelf security policy](https://github.com/mintshelf/.github/security/policy).

## Secrets

Production credentials belong in Cloudflare Worker secrets. Local credentials belong in `.dev.vars`, which is ignored by Git. CI uses mocked inference and does not require an OpenAI credential.

Never commit API keys, Wrangler state, copied environment files, model responses containing unreviewed user content, or exported Cloudflare configuration.
