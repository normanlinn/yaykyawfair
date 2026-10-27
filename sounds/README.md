# Crowd voices

Short Burmese lines the fair's visitors and snack sellers say (`say<i>m` / `say<i>f` for a male and a female voice, `call<i>` for vendor calls, `rep<i>m` / `rep<i>f` for what people answer when you talk to them). The text for each index is in `src/voices.ts`.

They were made offline with [eSpeak NG](https://github.com/espeak-ng/espeak-ng) using its Burmese (`my`) voice, then filtered with ffmpeg (high-pass, low-pass, a short echo, loudness normalised, 22 kHz mono MP3). eSpeak NG is a synthetic voice, so it sounds robotic up close; in the game the clips play quietly and muffled with distance, like people talking across a busy street. To use real voices, record new clips with the same file names.
