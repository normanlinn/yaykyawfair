# Yay Kyaw Nights

A walkable night street-fair game inspired by Yangon's Yay Kyaw, written in TypeScript and drawn on an HTML canvas.

You dress up as a small icon person and walk through a crowd of families, vendors and bikers. The fair has eight zones: Ferris wheel, carousel, Food Street, pirate ship, game booths, Kids Corner, the music stage and photo booth, and the Finale View. Along the way you can:

- ride the Ferris wheel, carousel, pirate ship and the mini train
- play ring toss and balloon darts to win tickets, then trade them for prizes
- buy mohinga, mont lin ma yar, shwe yin aye and other snacks with kyat
- collect zone postcards, find six hidden secrets and take photos
- watch the fireworks finale at 9:30 PM game time

## Character creator

You can pick a name and a Myanmar-style outfit:

- **Outfit:** longyi with a shirt, htamein with an eingyi, or a taikpon jacket
- **Weave:** plain, checks, stripes or acheik waves
- **Headwear:** gaung baung, padauk flower, bamboo hat or cap
- **Extras:** thanaka, a Shan bag and sunglasses

## Sound

All sound is synthesized with the Web Audio API, so there are no audio files:

- a crowd murmur and quiet tonal, Burmese-like chatter that you can't make out
- a saing waing-style band at the stage
- bicycle bells from the bikers on the main street
- fireworks

## 3D world and controls

The default walking view uses Three.js geometry for the fair, animated Ferris wheel, carousel, pirate ship, mini train, bicycles and visitors. Avatars include woven longyi and htamein, taikpon details, thanaka, hairstyles, headwear and bags. The outfit editor previews the same 3D model used in the world. Visitors turn toward travel and keep personal space.

The bottom dock contains **Your look / ကိုယ့်ပုံစံ**, **Map / မြေပုံ**, **Friends / သူငယ်ချင်း** and **More / နောက်ထပ်**. More contains camera, bag, photo, 2D/3D toggle, sounds and settings. Devices without WebGL automatically use the original 2D view. Ride close-ups, mini-games and saved photos retain their original 2D artwork.

The illustrated map shows landmarks, discoveries, your position and connected friends. Expand it and tap a zone to mark a destination. The dotted line is a direction guide, not an obstacle-aware route. With the map focused, Enter expands/collapses it and number keys 1–8 mark zones. Escape closes the expanded map.

Padauk is bundled and is the primary font throughout the interface and canvas labels, with Pyidaungsu and system Myanmar fonts as fallbacks. Its SIL Open Font License is in `fonts/Padauk-OFL.txt` and is copied into the deployment.

## Multiplayer and Myanmar chat

1. Enter the fair and open **Friends / သူငယ်ချင်း**.
2. Choose **Create room**, then copy the invite link to send to friends.
3. Friends open that link, enter the fair, open Friends and choose **Join**.
4. Up to eight players can see one another, wave, and type Myanmar Unicode or English messages.

Rooms use PeerJS public signaling and browser-to-browser WebRTC data connections. No account, paid backend or environment variable is required. The host relays positions and messages, must keep the tab open, and leaving/reloading ends the room. Some restrictive networks require a TURN relay, which this version does not configure; failed connections display a retry message. Invite trusted friends: anyone with the room link may join. Chat is rendered as text, limited to 240 characters and one message per second, with the latest 50 messages kept only in memory. Names and avatar data are validated before rendering.

Multiplayer shares presence, outfits, waves and chat. Rides, tickets, purchases, discoveries and each player's game clock remain individual. This is a small friend-room experience, not a persistent public world or competitive authoritative server. The original artifact-only room integration has been replaced so friend rooms work on Vercel too.

## Bicycle sounds

Nearby bicycles use a metallic **cling cling**, while the trishaw uses a two-pulse **tee tee** horn. Bicycles slow for pedestrians and stay in opposite lanes. More also includes sound buttons; keyboard shortcuts are **L** for bell and **H** for horn. Master mute applies to both. Sounds are synthesized, not voice recordings.

## Suggested next improvements

- Convert ride close-ups and mini-games to full 3D, with stronger animation and custom landmark models.
- Add a hosted room service with TURN support, reconnects, moderation and shared festival time for reliable public multiplayer.
- Add cooperative quests and shared mini-game rounds after authoritative game-state handling is in place.
- Expand Myanmar dialogue and accessibility; test controls and performance on physical low-end Android and iOS devices.

## Develop

```sh
npm install
npm test            # direction, turning and crowd-spacing regression tests
npm run typecheck   # tsc
npm run build       # dist/index.html (+ dist/fonts) and dist/artifact.html (one self-contained file)
npm run serve       # build, then serve dist/ on http://localhost:8000
```

| Path | What it holds |
| --- | --- |
| `src/main.ts` | world, game loop, rides, mini-games, bikes, avatar creator, multiplayer |
| `src/people.ts` | icon people drawing and avatar types |
| `src/audio.ts` | Web Audio engine |
| `src/util.ts` | math and canvas helpers |
| `src/index.html` | page markup and styles; the build injects the bundled script |
| `fonts/` | Bundled Padauk and license; legacy font assets |

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | walk (Shift to hurry) |
| E / Space | interact |
| P | photo mode |
| C | camera |
| B | bag |
| Q | wave |
| Esc | leave a ride or game |

On touch screens there is an on-screen stick and a GO button.
