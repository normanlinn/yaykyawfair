# Yay Kyaw Nights

A walkable 3D night street-fair game inspired by Yangon's Yay Kyaw, written in TypeScript with Three.js.

You dress up as a small icon person and walk through a crowd of families, vendors, bicycles and motorbikes. The fair has eight zones: Ferris wheel, carousel, Food Street, pirate ship, game booths, Kids Corner, the music stage and photo booth, and the Finale View. Along the way you can:

- ride the Ferris wheel, carousel, pirate ship and the mini train
- play ring toss and balloon darts to win tickets, then trade them for prizes
- buy mohinga, mont lin ma yar, shwe yin aye and other snacks with kyat
- collect zone postcards, find six hidden secrets and take photos
- watch the fireworks finale at 9:30 PM game time
- make a Thadingyut wish (ဆုတောင်း) at the wish stall by the Finale View: send it up on a paper fire balloon (1,000 Ks) or float it on the pond as a candle lantern (500 Ks)

## Thadingyut wishes

Write a wish in Myanmar or English and it glows over the fair with your name. The sky and pond start with a handful of sample Burmese wishes. Walk near a balloon or lantern to read it.

On claude.ai every wish is saved in the artifact's shared store, so everyone sees everyone's wishes and they stay forever (up to 50 per person). Elsewhere (for example on Vercel) wishes are saved in your browser.

## Character creator

You can pick a name and a Myanmar-style outfit:

- **Body:** male, female or unspecified, each with its own starting look
- **Outfit:** longyi with a shirt, htamein with an eingyi, or a taikpon jacket
- **Weave:** plain, checks, stripes or acheik waves
- **Headwear:** gaung baung, padauk flower, bamboo hat or cap
- **Extras:** thanaka, a Shan bag and sunglasses

## Sound

All sound is synthesized with the Web Audio API, so there are no audio files:

- a crowd murmur and quiet tonal, Burmese-like chatter that you can't make out
- a saing waing-style band at the stage
- bicycles ring a bright "cling cling" bell and motorbikes honk "tee tee" when you are in their way
- fireworks

## Multiplayer

When the game runs as a claude.ai artifact, it uses the artifact `room` capability. Everyone who has the page open at the same time shares the fair and sees each other's characters and names, and they can wave with Q.

Anywhere else (for example the Vercel deployment) the **Friends · သူငယ်ချင်း** button opens invitation-only friend rooms:

1. Choose **Create room** and copy the invite link to send to friends.
2. Friends open that link, enter the fair, open Friends and choose **Join**.
3. Up to eight players see one another, wave and chat.

Friend rooms use PeerJS public signaling and browser-to-browser WebRTC. The host relays positions and messages and must keep the tab open. Some restrictive networks need a TURN relay, which this version does not configure. Rides, tickets, purchases and each player's clock stay individual.

### Chat

Press T (or the Chat button) to talk to the other players in Burmese or English. Messages show as speech bubbles over your head and in the chat log. There are quick Burmese phrases too, such as မင်္ဂလာပါ (hello) and မီးပန်း ကြည့်ရအောင် (let's watch the fireworks). People in the crowd chat to each other in Burmese as you walk past. Chat travels inside each player's presence (in friend rooms, through the host), so view-only members can talk as well.

## Deploy

`vercel.json` builds with `npm run build` and serves `dist/`.

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
| `src/friends.ts` | PeerJS friend rooms used outside claude.ai |
| `src/wishes.ts` | Thadingyut wishes: sample wishes and where wishes are saved |
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
| Q | wave |
| Esc | leave a ride or game |

On touch screens there is an on-screen stick and a GO button. Drag anywhere else to look around and pinch to zoom.
