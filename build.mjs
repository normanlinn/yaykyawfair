// Builds the game two ways:
//   dist/index.html     a normal web page that loads fonts from dist/fonts (for hosting, e.g. GitHub Pages)
//   dist/artifact.html  one self-contained file with the fonts inlined (for the claude.ai artifact)
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import * as seo from './seo.mjs';
import { execSync } from 'node:child_process';

// which version this is: players with an older copy open are told an update is ready (see dist/version.json)
const sh = (c) => { try { return execSync(c, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
const BUILD = (process.env.VERCEL_GIT_COMMIT_SHA || sh('git rev-parse HEAD') || String(Date.now())).slice(0, 12);
const NOTES = (process.env.VERCEL_GIT_COMMIT_MESSAGE || sh('git log -1 --format=%B')).split('\n')[0].slice(0, 160);

const minify = process.argv.includes('--minify');
const result = await esbuild.build({
  entryPoints: ['src/main.ts'], bundle: true, format: 'iife', target: 'es2020', minify, write: false, legalComments: 'none', loader: { '.mp3': 'dataurl' }, define: { __BUILD__: JSON.stringify(BUILD) },
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const page = fs.readFileSync('src/index.html', 'utf8').replace('<script>/*BUNDLE*/</script>', () => `<script>\n${js}</script>`);

fs.mkdirSync('dist/fonts', { recursive: true });
const fontFiles = fs.existsSync('fonts') ? fs.readdirSync('fonts').filter(f => /^(?:Padauk|Pyidaungsu|BrandonText|KhitHaung)-.*\.(ttf|otf|woff2?)$/i.test(f)) : [];
for (const f of ['Padauk-OFL.txt','Pyidaungsu-OFL.txt','Pyidaungsu-SOURCE.txt']) if (fs.existsSync('fonts/'+f)) fs.copyFileSync('fonts/'+f, 'dist/fonts/'+f);
for (const f of fontFiles) fs.copyFileSync(path.join('fonts', f), path.join('dist/fonts', f));

const standalone = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${seo.head('/')}\n</head>\n<body>\n${page.replace(/<title>[\s\S]*?<\/title>\s*/, '')}\n${seo.gameAbout}\n</body>\n</html>\n`;
fs.writeFileSync('dist/index.html', standalone);

// search engines and link previews: the /about/ landing page, robots.txt, sitemap.xml and the files in public/
fs.mkdirSync('dist/about', { recursive: true });
fs.writeFileSync('dist/about/index.html', seo.aboutPage);
fs.writeFileSync('dist/robots.txt', seo.robots());
fs.writeFileSync('dist/version.json', JSON.stringify({ v: BUILD, notes: NOTES }) + '\n');
fs.writeFileSync('dist/sitemap.xml', seo.sitemap());
for (const f of fs.existsSync('public') ? fs.readdirSync('public') : []) fs.copyFileSync(path.join('public', f), path.join('dist', f));

const mime = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };
const inlined = page.replace(/url\("fonts\/([^"]+)"\)/g, (m, name) => {
  const file = path.join('fonts', name);
  if (!fs.existsSync(file)) return m;
  const ext = name.split('.').pop().toLowerCase();
  return `url("data:${mime[ext]};base64,${fs.readFileSync(file).toString('base64')}")`;
});
fs.writeFileSync('dist/artifact.html', inlined);
console.log(`built dist/index.html and dist/artifact.html (${(inlined.length / 1024).toFixed(0)} KB, ${fontFiles.length} fonts)`);
