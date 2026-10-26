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

## Multiplayer

When the game runs as a claude.ai artifact, it uses the artifact `room` capability. Everyone who has the page open at the same time shares the fair and sees each other's characters and names, and they can wave with Q. Run anywhere else, the game is single-player.

## Develop

```sh
npm install
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
| `fonts/` | Z06-Walone (Myanmar) and Brandon Text (Latin) |

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
