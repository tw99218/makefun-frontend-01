# make.fun frontend — makefun-frontend-01

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/tw99218/makefun-frontend-01/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/tw99218/makefun-frontend-01/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A fast, read-only frontend for [make.fun](https://make.fun/bounty/makefun-frontend-01), built from static files with no build step. It reads make.fun's public API alone and shows the live bounty board, a bounty's page with its live rewards, its leaderboard and an account's public profile — each reachable by a link and by its own hash route (`#/`, `#/bounty/<slug>`, `#/bounty/<slug>/leaderboard`, `#/u/<handle>`).

## Why it is fast

- First load is five small files: one HTML page, one stylesheet, three small ES modules. No framework, no webfonts.
- API answers are cached in memory and revalidated with their ETag, so a view you revisit costs zero requests while fresh and one cheap `304` after that; identical concurrent requests share one fetch.
- Long lists are paginated (leaderboard, 25 a page) and filtered in place, so typing never rebuilds the page; time-left labels tick without a re-render.

## Run it

```sh
# serve app/ with any static server, then open http://localhost:8080
python3 -m http.server 8080 --directory app
```

Or build the submission output:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Requires Node.js 22.18+. The program copies `app/` and `screenshots/` to the output directory and writes `dossier.json` there.

## License

MIT — see LICENSE.
