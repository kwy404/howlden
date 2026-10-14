// Checks every internal link and image in the site pages (docs/, except the
// app, which has its own tests): the target file must exist, and a #fragment
// must match an id on the target page. Rooted links (/howlden/...) are how the
// 404 page links, so they map to docs/.
// Usage: node scripts/site/check-links.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const docs = join(root, 'docs');

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'app' && dir === docs ? [] : walk(p);
    return n.endsWith('.html') ? [p] : [];
  });
}

const pages = walk(docs);
const ids = new Map();
const idsOf = (file) => {
  if (!ids.has(file)) {
    const html = existsSync(file) ? readFileSync(file, 'utf8') : '';
    ids.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return ids.get(file);
};

const problems = [];
let checked = 0;
for (const page of pages) {
  const html = readFileSync(page, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|data:)/.test(url) || url.startsWith(':')) continue;
    checked++;
    const [path, frag] = url.split('#');
    let target;
    if (!path) target = page;
    else if (path.startsWith('/howlden/')) target = join(docs, path.slice('/howlden/'.length));
    else if (path.startsWith('/')) {
      problems.push(`${relative(root, page)}: rooted link outside the site ${url}`);
      continue;
    } else target = resolve(dirname(page), path);
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
    if (!existsSync(target)) {
      problems.push(`${relative(root, page)}: broken link ${url}`);
      continue;
    }
    if (frag && target.endsWith('.html') && !idsOf(target).has(frag)) problems.push(`${relative(root, page)}: missing anchor ${url}`);
  }
}

if (problems.length) {
  console.error([...new Set(problems)].join('\n'));
  process.exit(1);
}
console.log(`links: ${checked} internal links in ${pages.length} pages are fine`);
