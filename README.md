# comuns-ai.github.io

The landing page for Comuns at https://comuns-ai.github.io/. It tells the story of the proposal in one page and points to the repository, the documents and the pitch deck. The deck itself is served from the `Comuns-ai/comuns` repository at https://comuns-ai.github.io/comuns/ and is not part of this site.

## What it is

A static site: plain HTML, CSS and JavaScript with no build step, no framework, no package manager and no dependencies. GitHub Pages serves the files as they are. `.nojekyll` turns Jekyll off so nothing is transformed.

| File | Purpose |
|---|---|
| `index.html` | The page. |
| `404.html` | Served for unknown addresses; links home and to the deck. |
| `assets/style.css` | All styles, with a dark theme through `prefers-color-scheme`. |
| `assets/main.js` | Scroll reveals and the hero animation. The page reads without it. |
| `assets/mark.svg` | The favicon and the wordmark mark. |
| `.nojekyll` | Disables Jekyll on GitHub Pages. |
| `LICENSE` | Apache-2.0, the same text as in the `comuns` repository. |

The page loads nothing from third parties: no web fonts, scripts, images, analytics or cookies. A Content-Security-Policy meta tag in each HTML file enforces this, so styles and scripts must stay in the external files and never inline. The only external links are plain anchors to `github.com/Comuns-ai/comuns`.

## How to edit it

1. Edit the files directly and preview them through a local server at the site root: `python3 -m http.server` from the repository root, then open http://127.0.0.1:8000/. Do not open the files straight from disk: the deck link `/comuns/` and the root-absolute `/assets/` paths in `404.html` resolve only against a server rooted at this directory.
2. Keep every style in `assets/style.css` and every script in `assets/main.js`. An inline `style` attribute or `<script>` block is blocked by the CSP and will not run.
3. Keep the total under about 120 KB uncompressed and add no libraries.
4. Check the page at 375 px wide, in light and dark themes, and with reduced motion enabled. `prefers-reduced-motion` must leave every piece of text visible.
5. Open a pull request. Commits use the DCO (`git commit -s`), as in the `comuns` repository.

## The honesty rule

Every factual sentence on the page must come from a document in the `Comuns-ai/comuns` repository, in its current wording. The page must never claim:

- a running network or service, or a mainnet date;
- an audit, a grant, a partnership or existing users;
- a price lower than hosted APIs;
- a launch, a waitlist, a sign-up or a way to "join the network";
- that it runs on any laptop (CPU-only participation is "to be validated").

The status is stated plainly: a draft proposal; no protocol implementation runs; nothing is deployed; no maintainers are seated. On privacy, standard mode hides who asked, not what was asked, and the chosen node reads the prompt; attested mode is opt-in. Contact is through GitHub issues and CIP comments only; the page names no other channel.

When a document changes, change the page to match, not the other way round.

## Licence

Apache-2.0, as in the `comuns` repository.
