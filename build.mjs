// Builds the game two ways:
//   dist/index.html     a normal web page that loads fonts from dist/fonts (for hosting, e.g. GitHub Pages)
//   dist/artifact.html  one self-contained file with the fonts inlined (for the claude.ai artifact)
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const minify = process.argv.includes('--minify');
const result = await esbuild.build({
  entryPoints: ['src/main.ts'], bundle: true, format: 'iife', target: 'es2020', minify, write: false, legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const page = fs.readFileSync('src/index.html', 'utf8').replace('<script>/*BUNDLE*/</script>', () => `<script>\n${js}</script>`);

fs.mkdirSync('dist/fonts', { recursive: true });
const fontFiles = fs.existsSync('fonts') ? fs.readdirSync('fonts').filter(f => /^(?:Padauk|Pyidaungsu|BrandonText)-.*\.(ttf|otf|woff2?)$/i.test(f)) : [];
for (const f of ['Padauk-OFL.txt','Pyidaungsu-OFL.txt','Pyidaungsu-SOURCE.txt']) if (fs.existsSync('fonts/'+f)) fs.copyFileSync('fonts/'+f, 'dist/fonts/'+f);
for (const f of fontFiles) fs.copyFileSync(path.join('fonts', f), path.join('dist/fonts', f));

const standalone = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n${page}\n</body>\n</html>\n`;
fs.writeFileSync('dist/index.html', standalone);

const mime = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };
const inlined = page.replace(/url\("fonts\/([^"]+)"\)/g, (m, name) => {
  const file = path.join('fonts', name);
  if (!fs.existsSync(file)) return m;
  const ext = name.split('.').pop().toLowerCase();
  return `url("data:${mime[ext]};base64,${fs.readFileSync(file).toString('base64')}")`;
});
fs.writeFileSync('dist/artifact.html', inlined);
console.log(`built dist/index.html and dist/artifact.html (${(inlined.length / 1024).toFixed(0)} KB, ${fontFiles.length} fonts)`);
