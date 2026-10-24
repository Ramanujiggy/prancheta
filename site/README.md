# Sales page

The one-page site for prancheta.app. Plain HTML, no build step. The app itself lives in `app/`.

## Before launch

At the bottom of `index.html`, set:

- `CHECKOUT_URL`: the Lemon Squeezy checkout link. Until it's set, the buy buttons scroll to the price.
- `SUPPORT_EMAIL`: the address shown in the footer.

## Deploy

Recommended: a Cloudflare Pages project with Root directory `site`, no build command, output `.`. Netlify reads `site/netlify.toml` (Base directory `site`). See [HOSTING.md](../HOSTING.md).

On Railway: add a second service from this repo and set its **Root Directory** to `site`. It serves the folder as-is on Railway's `PORT`. Then add `prancheta.app` as its custom domain, and `app.prancheta.app` on the app's service.

## Preview locally

```bash
cd site
npx serve .
```

The screenshots in `img/` are taken from the app at a 390 × 844 phone size; retake them when the app's look changes.
