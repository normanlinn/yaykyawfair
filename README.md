# Yay Kyaw Nights

A walkable 3D night street-fair game inspired by Yangon's Yay Kyaw, written in TypeScript with Three.js.

You dress up as a small icon person and walk through a crowd of families, vendors, bicycles and motorbikes. The fair has eleven zones: Ferris wheel, carousel, Food Street, pirate ship, game booths, Kids Corner, the music stage and photo booth, the Finale View, the OC Midway, the Candle Festival (ဆီမီးထွန်းပွဲ) and the Teashop (လက်ဖက်ရည်ဆိုင်). Along the way you can:

- ride the Ferris wheel, carousel, pirate ship, mini train, drop tower and wave swinger, seen first person from your seat (drag to look around, Q to wave)
- run from the bumper cars in the OC Midway, which chase you and spark when they crash, or pay to dodge them for 30 seconds for tickets
- buy a corn dog, funnel cake or turkey leg at the OC food stands
- dance with the Myanmar classical dancers in front of the Live Music stage while the saing waing plays
- light one of 1,000 oil lamps and offer flowers at the Candle Festival
- sit down at a low table in the teashop with a laphet yay while the football plays on the TV
- walk up to people in the crowd and talk to them in Burmese
- play ring toss and balloon darts to win tickets, then trade them for prizes
- buy mohinga, mont lin ma yar, shwe yin aye and other snacks with kyat
- collect zone postcards, find six hidden secrets and take photos
- watch little fireworks shows over the lake from 7 PM (you are asked if you want to watch each time) and the big finale at 9:30 PM game time, with ground fountains along the lake
- make a Thadingyut wish (ဆုတောင်း) at the wish stall by the Finale View: send it up on a paper fire balloon (1,000 Ks) or float it on the pond as a candle lantern (500 Ks)

## Thadingyut wishes

Write a wish in Myanmar or English and it glows over the fair with your name. The sky and pond start with a handful of sample Burmese wishes. Walk near a balloon or lantern to read it, or stand at the west end of the pond and choose **Look up at all the wishes** (also in the wish form) to see them all. The pond has koi, lily pads, lotus flowers and ripples, and nobody can walk into it.

The mini map follows you and shows landmarks, the pond and other players. Tap it or press M for the full map of the fair.

On claude.ai every wish is saved in the artifact's shared store, so everyone sees everyone's wishes and they stay forever (up to 50 per person). On Vercel, wishes are saved in an Upstash Redis database through `api/wishes.js` (see Deploy), so every player shares them too; new wishes show up for others within about 20 seconds. Anywhere without a database (a local file, or Vercel before the database is added) wishes are saved in your browser.

## Character creator

You can pick a name and a Myanmar-style outfit:

- **Body:** male, female or unspecified, each with its own starting look
- **Outfit:** longyi with a shirt, htamein with an eingyi, or a taikpon jacket
- **Weave:** plain, checks, stripes or acheik waves
- **Headwear:** gaung baung, padauk flower, bamboo hat or cap
- **Extras:** thanaka, a Shan bag and sunglasses

## Sound

All sound is synthesized with the Web Audio API, so there are no audio files:

- a crowd murmur, plus people nearby actually saying things in Burmese ("ဒါ ဘယ်လောက်လဲ", "မီးပန်း ဘယ်အချိန်လဲ") with speech bubbles, and snack sellers calling out ("မုန့်ဟင်းခါး ပူပူလေး ရမယ်နော်"). Voices are louder up close, muffled further away, and panned to where the speaker stands. The clips are a synthetic voice (eSpeak NG); see `sounds/README.md`
- an original tune in the style of a Myanmar saing waing ensemble at the Live Music stage: a hne (oboe) melody with slides and turns, the kyi waing gong circle answering it, pat waing drums, the pat ma bass drum, and si and wa keeping time. It is composed and synthesized for the game, not a recording
- bicycles ring a bright "cling cling" bell and motorbikes honk "tee tee" when you are in their way
- fireworks

## Multiplayer

When the game runs as a claude.ai artifact, it uses the artifact `room` capability. Everyone who has the page open at the same time shares the fair and sees each other's characters and names, and they can wave with Q.

Anywhere else (for example the Vercel deployment) everyone who opens the game joins one **public fair** automatically, with no setup: players at the same time see each other walking, waving, dancing and chatting, and the **Online** count in the top bar shows how many are there. Up to 12 players share a public fair; when it is full, newcomers go to the next one (up to four).

The **Players · ကစားသူ** button also opens private rooms:

1. Choose **Create private room** and copy the invite link to send to friends.
2. Friends who open that link join the room straight away.
3. Up to eight players see one another, wave and chat. **Back to the public fair** leaves the room.

Both use PeerJS public signaling and browser-to-browser WebRTC. Whoever holds a fair's id relays everyone's positions and messages; if that player leaves, the others take over automatically within a few seconds. A private room's host must keep the tab open. Some restrictive networks need a TURN relay, which this version does not configure. Rides, tickets, purchases and each player's clock stay individual.

### Chat

Press T (or the Chat button) to talk to the other players in Burmese or English. Messages show as speech bubbles over your head and in the chat log. There are quick Burmese phrases too, such as မင်္ဂလာပါ (hello) and မီးပန်း ကြည့်ရအောင် (let's watch the fireworks). People in the crowd chat to each other in Burmese as you walk past. Chat travels inside each player's presence (in friend rooms, through the host), so view-only members can talk as well.

## Deploy

`vercel.json` builds with `npm run build` and serves `dist/`. `api/wishes.js` runs as a Vercel function.

To share wishes between everyone on Vercel, add a free Upstash Redis database once:

1. In the Vercel dashboard open the project, then **Storage** → **Create Database** → **Upstash for Redis** (free plan is plenty).
2. Connect it to this project for all environments. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` (the `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` names work too).
3. Redeploy. `https://<your-site>/api/wishes` should now answer `{"wishes":[]}`.

The API keeps the newest 5,000 wishes, sends players the newest 1,000, and lets one address make 20 wishes an hour.

The hosted build also writes search and sharing metadata from `seo.mjs`: an English and Burmese title, description, Open Graph and Twitter cards, hreflang links and VideoGame structured data, plus `/about/` (a readable bilingual landing page), `robots.txt` and `sitemap.xml`. Files in `public/` (the share image, favicon and any Search Console verification file) are copied to the site root. The site address defaults to `https://yaykyawfair.vercel.app`; set `SITE_URL`, `GOOGLE_SITE_VERIFICATION` or `BING_SITE_VERIFICATION` in Vercel to change it or verify ownership. Preview deployments are marked noindex. See [SEO-SETUP.md](SEO-SETUP.md) for the Google Search Console steps.

## Develop

```sh
npm install
npm test            # direction, turning and crowd-spacing tests
npm run typecheck   # tsc
npm run build       # dist/index.html (+ dist/fonts) and dist/artifact.html (one self-contained file)
npm run serve       # build, then serve dist/ on http://localhost:8000
```

| Path | What it holds |
| --- | --- |
| `src/main.ts` | game loop, input and camera, rides, mini-games, bikes, avatar creator, multiplayer and chat |
| `src/world3d.ts` | the Three.js scene: rides, stalls, lanterns, Shwedagon skyline, crowd, fireworks |
| `src/layout.ts` | the fair's floor plan and colliders |
| `src/friends.ts` | PeerJS public fair and private rooms used outside claude.ai |
| `src/wishes.ts` | Thadingyut wishes: sample wishes and where wishes are saved |
| `src/voices.ts`, `sounds/` | Burmese crowd lines and vendor calls, and their voice clips |
| `api/wishes.js` | Vercel function that stores wishes in Upstash Redis |
| `src/people.ts` | avatar types (and the 2D icon people used on souvenir photos) |
| `src/audio.ts` | Web Audio engine |
| `src/util.ts` | math and canvas helpers |
| `src/index.html` | page markup and styles; the build injects the bundled script |
| `fonts/` | KhitHaung (Regular, Medium, SemiBold, Bold; the Myanmar font, applied to Myanmar letters only), Pyidaungsu 2.5.3 and Padauk (fallbacks) and Brandon Text (Latin). All three Myanmar fonts are Unicode; Pyidaungsu and Padauk and ship with their SIL Open Font License notices; Pyidaungsu provenance is in `fonts/Pyidaungsu-SOURCE.txt` |

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | walk (Shift to hurry) |
| drag / wheel | look around, zoom |
| T / Enter | chat |
| E / Space | interact |
| P | photo mode |
| C | camera |
| B | bag |
| Q | wave (also on rides) |
| Y / N | answer "watch the fireworks?" |
| Esc | leave a ride or game |

On touch screens there is an on-screen stick and a GO button. Drag anywhere else to look around and pinch to zoom.
