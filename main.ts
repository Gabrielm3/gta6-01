// Entrypoint: copies game/ and screenshots/ into the output directory and
// writes dossier.json there with the vendored make.fun dossier builder.
// Run with `node main.ts`; MAKEFUN_OUTPUT_DIR overrides the default /output.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

for (const dir of ['game', 'screenshots']) {
  const src = join(root, dir);
  if (!existsSync(src)) throw new Error(`missing ${dir}/ next to main.ts`);
  const dest = join(out, dir);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

const dossier = buildDossier(out, caps);
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`dossier.json written to ${out} (${dossier.length} bytes)`);
