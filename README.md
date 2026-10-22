# Do Re Ski

A small browser game where you ski down a slope and play songs as you go. Each lane is a note of the scale, and passing through a gate plays the note for the lane you're in. Stay on the right lanes and you'll hear the tune. Drift into the wrong one and it sounds off.

Play it at https://parhum.github.io/Do-Re-Ski/

## Controls

Steer with the mouse, or drag on a phone or tablet. The arrow keys (or A and D) move one lane at a time, and Esc or P pauses.

## Songs

- Mary Had a Little Lamb
- Ode to Joy
- Twinkle, Twinkle
- Frère Jacques
- Row, Row, Row Your Boat

You can play any of them in seven keys, at three speeds, with the gates labelled as do re mi, as letter names, or as numbers.

## Running it locally

There's no build step and nothing to install. The scripts are ES modules, which browsers won't load from `file://`, so serve the folder with any static server:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

Tests use Node's built-in test runner (Node 20 or newer):

```sh
npm test
```

## Code layout

```
index.html        markup
styles.css        colors (light and dark) and layout
src/main.js       menus, input and the game loop
src/run.js        timing and scoring for a single run
src/render.js     drawing the slope on a canvas
src/audio.js      sound, using the Web Audio API
src/effects.js    snow particles and floating text
src/music.js      keys, notes and chords
src/songs.js      the song list
tests/            tests for the note and song data
```

## Adding a song

Add an entry to `src/songs.js`. A melody is a list of numbers for the notes of the scale (`1` is do, `8` is the do above it, `L` is the sol below), and `-2` after a note makes it last two beats instead of one:

```js
melody: '3 2 1 2 3 3 3-2',
chords: 'I-4 I-4',
```

`npm test` will tell you if the chords and the melody end up different lengths.

## Credits

The songs are all traditional or old enough to be in the public domain. The fonts are [Grandstander](https://fonts.google.com/specimen/Grandstander) and [Lexend](https://fonts.google.com/specimen/Lexend), loaded from Google Fonts under the SIL Open Font License.

## License

Copyright © 2026 Parhum Farzad. All rights reserved.
