// Hand in the makefun-frontend-01 entry (Node 22, standard library only).
// The frontend lives in this directory's app/ folder: plain static files a
// browser opens at app/index.html (ES modules and CSS, no build step),
// reading make.fun's public API at https://make.fun/api. This program
// copies app/ and screenshots/ from beside this file into /output and
// writes /output/dossier.json with the vendored make.fun library, the
// summary the judge reads (the screenshots, the first load's files and
// bytes, and the source). vendor/makefun-frontend.ts stays exactly as the
// kit shipped it: the scorer requires dossier.json to be byte for byte
// what its own copy of the library writes.
//
// Serve the app locally with any static server pointed at app/.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps: only text_max_bytes shapes the bytes; the rest
// refuse an entry the scorer would refuse (more than 3 screenshots or one
// over 256 KiB; more than 993 files and directories in app/ or 16 MiB of
// app files: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 3, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 16777216 }),
);
