// Search and social metadata for the hosted build (dist/index.html), in English and Burmese.
// The site address comes from SITE_URL, or on Vercel from VERCEL_PROJECT_PRODUCTION_URL (set automatically at build time).
// Without either, links stay relative and the sitemap is skipped.

const host = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
export const site = host.replace(/\/+$/, '');
const abs = p => site + p;

const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export const copy = {
  title: 'Yay Kyaw Nights · ရေကျော်ညများ | Free 3D Myanmar night fair game',
  titleAbout: 'About Yay Kyaw Nights · ရေကျော်ညများ ဂိမ်းအကြောင်း',
  description: 'Free 3D Yangon night fair game in your browser: ride the Ferris wheel, eat mohinga, win prizes and watch the fireworks with friends. ရန်ကုန် ညပွဲတော် 3D ဂိမ်း၊ ချားရဟတ်စီး၊ မုန့်ဟင်းခါးစား၊ မီးပန်းကြည့်ပြီး သူငယ်ချင်းတွေနဲ့ အခမဲ့ ကစားပါ။',
  en: 'Yay Kyaw Nights is a free 3D browser game set at a Yangon night street fair. Dress up in a longyi or htamein, ride the Ferris wheel, carousel and pirate ship, play ring toss for tickets, eat mohinga and shwe yin aye, chat in Burmese or English with friends and stay for the fireworks. No download or sign-up.',
  my: 'ရေကျော်ညများ သည် ရန်ကုန် ညဈေးပွဲတော်ကို အခြေခံထားသော အခမဲ့ 3D ဘရောက်ဇာဂိမ်း ဖြစ်ပါသည်။ လုံချည်၊ ထဘီ ဝတ်ပြီး ချားရဟတ်၊ မြင်းချားရဟတ်နဲ့ လှေဒန်း စီးနိုင်ပါတယ်။ ကွင်းပစ်ကစားပြီး လက်မှတ်ရယူ၊ မုန့်ဟင်းခါး၊ ရွှေရင်အေး စားပြီး သူငယ်ချင်းတွေနဲ့ မြန်မာလို စကားပြောရင်း ည ၉ နာရီခွဲ မီးပန်းပွဲကို ကြည့်ပါ။ ဒေါင်းလုဒ်လုပ်စရာ၊ အကောင့်ဖွင့်စရာ မလိုပါ။',
};

const keywords = 'Yay Kyaw Nights, ရေကျော်ညများ, ရေကျော်, Myanmar game, မြန်မာဂိမ်း, Burmese game, Yangon, ရန်ကုန်, night fair, ပွဲတော်, ညဈေး, 3D browser game, online game, အွန်လိုင်းဂိမ်း, multiplayer, Ferris wheel, ချားရဟတ်, mohinga, မုန့်ဟင်းခါး, fireworks, မီးပန်း';

const jsonLd = () => JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'VideoGame',
      name: 'Yay Kyaw Nights',
      alternateName: 'ရေကျော်ညများ',
      description: `${copy.en} ${copy.my}`,
      url: abs('/'),
      image: abs('/og-image.jpg'),
      inLanguage: ['en', 'my'],
      genre: ['Exploration', 'Casual', 'Simulation'],
      gamePlatform: 'Web browser',
      applicationCategory: 'Game',
      operatingSystem: 'Any',
      playMode: ['SinglePlayer', 'MultiPlayer'],
      numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 8 },
      contentLocation: { '@type': 'Place', name: 'Yangon, Myanmar' },
      keywords,
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    },
    { '@type': 'WebSite', name: 'Yay Kyaw Nights', alternateName: 'ရေကျော်ညများ', url: abs('/'), inLanguage: ['en', 'my'] },
  ],
}).replace(/</g, '\\u003c');

// <head> tags for a page at `path` ('/' or '/about/').
export function head(path, title = copy.title) {
  const url = abs(path), img = abs('/og-image.jpg');
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(copy.description)}">`,
    `<meta name="keywords" content="${esc(keywords)}">`,
    `<meta name="robots" content="index,follow,max-image-preview:large">`,
    `<meta name="theme-color" content="#0d0a24">`,
    `<meta http-equiv="content-language" content="en, my">`,
    site && `<link rel="canonical" href="${url}">`,
    ...['en', 'my', 'x-default'].map(l => `<link rel="alternate" hreflang="${l}" href="${url}">`),
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Yay Kyaw Nights · ရေကျော်ညများ">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(copy.description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="Yay Kyaw Nights title screen: a lantern-lit Yangon street fair at night · ရေကျော်ညများ">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:locale:alternate" content="my_MM">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(copy.description)}">`,
    `<meta name="twitter:image" content="${img}">`,
    `<script type="application/ld+json">${jsonLd()}</script>`,
  ].filter(Boolean).join('\n');
}

// Bilingual description for crawlers and screen readers on the game page; the game canvas covers the page visually.
export const gameAbout = `<section id="about-game" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">
<h2>Yay Kyaw Nights: a free 3D Myanmar night fair game</h2>
<p>${copy.en}</p>
<h2 lang="my">ရေကျော်ညများ: ရန်ကုန် ညပွဲတော် 3D ဂိမ်း</h2>
<p lang="my">${copy.my}</p>
<p><a href="/about/">About the game · ဂိမ်းအကြောင်း</a></p>
</section>`;

// A plain, readable landing page at /about/ that search engines can index and people can share.
export const aboutPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${head('/about/', copy.titleAbout)}
<style>
@font-face{font-family:"Pyidaungsu";src:url("/fonts/Pyidaungsu-Regular.ttf") format("truetype");font-weight:400;font-display:swap}
@font-face{font-family:"Pyidaungsu";src:url("/fonts/Pyidaungsu-Bold.ttf") format("truetype");font-weight:700;font-display:swap}
@font-face{font-family:"Brandon Text";src:url("/fonts/BrandonText-Regular.otf") format("opentype");font-weight:400;font-display:swap}
@font-face{font-family:"Brandon Text";src:url("/fonts/BrandonText-Bold.otf") format("opentype");font-weight:700;font-display:swap}
:root{color-scheme:dark;--night:#0d0a24;--panel:#1e143a;--ink:#f7efe0;--muted:#c9bcd9;--gold:#f4b63f;--lantern:#ff5a4e}
body{margin:0;background:var(--night);color:var(--ink);font:17px/1.65 "Brandon Text","Pyidaungsu","Padauk","Myanmar Text",system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:24px 16px 56px}
img{width:100%;height:auto;border-radius:14px;display:block}
h1,h2{color:var(--gold);line-height:1.25}
h1{font-size:clamp(28px,6vw,42px);margin:28px 0 4px}
[lang=my]{font-family:"Pyidaungsu","Padauk","Myanmar Text",sans-serif;line-height:1.9}
.mm-title{font-size:26px;margin:0 0 16px}
.play{display:inline-block;margin:12px 0 8px;padding:12px 26px;border-radius:999px;background:var(--lantern);color:#fff;font-weight:700;text-decoration:none}
section{background:var(--panel);border-radius:14px;padding:4px 20px 12px;margin:20px 0}
li{margin:4px 0}
footer{color:var(--muted);font-size:14px}
</style>
</head>
<body>
<main>
<img src="/og-image.jpg" width="1200" height="630" alt="Yay Kyaw Nights title screen: a lantern-lit Yangon street fair at night">
<h1>Yay Kyaw Nights</h1>
<p class="mm-title" lang="my">ရေကျော်ညများ</p>
<a class="play" href="/">Play now · ယခုကစားမည်</a>
<section>
<h2>A free 3D Myanmar night fair game</h2>
<p>${copy.en}</p>
<ul>
<li>Eight zones to explore: Ferris wheel, carousel, Food Street, pirate ship, game booths, Kids Corner, the music stage and the Finale View</li>
<li>Ride the Ferris wheel, carousel, pirate ship and the mini train</li>
<li>Win tickets at ring toss and balloon darts and trade them for prizes</li>
<li>Buy mohinga, mont lin ma yar and shwe yin aye with kyat</li>
<li>Invite up to eight friends to a private room and chat in Burmese or English</li>
<li>Plays on phones, tablets and computers, with nothing to install</li>
</ul>
</section>
<section lang="my">
<h2>ရန်ကုန် ညပွဲတော် 3D ဂိမ်း (အခမဲ့)</h2>
<p>${copy.my}</p>
<ul>
<li>ချားရဟတ်၊ မြင်းချားရဟတ်၊ စားသောက်တန်း၊ လှေဒန်း၊ ဂိမ်းဆိုင်များ၊ ကလေးကစားကွင်း၊ ဂီတစင်နဲ့ မီးပန်းကြည့်နေရာ စတဲ့ နေရာ ၈ ခု</li>
<li>ချားရဟတ်၊ မြင်းချားရဟတ်၊ လှေဒန်းနဲ့ ရထားလေး စီးနိုင်</li>
<li>ကွင်းပစ်၊ ပူဖောင်းပစ် ကစားပြီး လက်မှတ်ရယူကာ ဆုလက်ဆောင်လဲယူနိုင်</li>
<li>မုန့်ဟင်းခါး၊ မုန့်လင်မယားနဲ့ ရွှေရင်အေးကို ကျပ်ငွေနဲ့ ဝယ်စားနိုင်</li>
<li>သူငယ်ချင်း ၈ ယောက်အထိ ဖိတ်ခေါ်ပြီး မြန်မာလို ဒါမှမဟုတ် အင်္ဂလိပ်လို စကားပြောနိုင်</li>
<li>ဖုန်း၊ တက်ဘလက်၊ ကွန်ပျူတာ အားလုံးမှာ ဘာမှ ထည့်သွင်းစရာမလိုဘဲ ကစားနိုင်</li>
</ul>
</section>
<a class="play" href="/">Enter the fair · ပွဲတော်ထဲ ဝင်မည်</a>
<footer><p>Yay Kyaw Nights · ရေကျော်ညများ, a love letter to Yangon.</p></footer>
</main>
</body>
</html>
`;

export const robots = () => `User-agent: *\nAllow: /\n${site ? `\nSitemap: ${abs('/sitemap.xml')}\n` : ''}`;

export const sitemap = () => site && `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${['/', '/about/'].map(p => `  <url>
    <loc>${abs(p)}</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
${['en', 'my', 'x-default'].map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${abs(p)}"/>`).join('\n')}
  </url>`).join('\n')}
</urlset>
`;
