// Copies the static site into dist/ (used by Vercel). No dependencies.
import { rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
for (const p of ['index.html', 'src', 'public']) {
  if (!existsSync(p)) throw new Error('Missing ' + p);
  cpSync(p, 'dist/' + p, { recursive: true });
}
// Optional one-off pages (copied only if present)
for (const p of ['import-data.html']) {
  if (existsSync(p)) cpSync(p, 'dist/' + p);
}
console.log('Built dist/');
