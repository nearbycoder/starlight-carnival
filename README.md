# Starlight Carnival

The midway has gone dark. Send a pearl through the orange suns, wake the performers’ powers and light the carnival one attraction at a time.

**[Play Adventure](https://nearbycoder.github.io/starlight-carnival/play/index.html?mode=adventure)** · **[Visit the carnival](https://nearbycoder.github.io/starlight-carnival/)** · **[Watch the gameplay trailer](https://nearbycoder.github.io/starlight-carnival/assets/midway/opening-night.mp4)**

## At the booth

| Ticket           | What you play                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Adventure        | Forty authored boards across eight worlds. Each cleared mission opens the next. Score and performance medals are optional. Finish each world to restore its attraction and collect its illustrated postcard. |
| Free Play        | Pick any board and any of the eight performers. Switch on unlimited practice pearls at character selection.                                                                                                  |
| Score Attack     | Start with six pearls on any board. Basket catches and 2,500-point shots earn more. Each board keeps its five best local runs.                                                                               |
| Seeded Challenge | Choose a numbered target arrangement on an authored board. Copy the link from the pause menu or results to share the board, performer and seed.                                                              |

Each lit peg scores once per shot. Green diamonds release your performer’s power. Watch the moving basket for a save. The last sun opens five scoring pockets, and every pearl still on stage gets to finish. Select the score to see its receipt. The pause menu and results let you watch the last shot again.

## Controls

| Input        | Action                                                                      |
| ------------ | --------------------------------------------------------------------------- |
| Mouse        | Move to aim, click to fire.                                                 |
| Touch or pen | Drag to aim, lift, then tap **Fire**.                                       |
| Left / Right | Adjust aim. Hold **Shift** for smaller turns.                               |
| Space        | Fire.                                                                       |
| F            | Toggle double speed for the current shot.                                   |
| I            | Read the aim angle and predicted contacts, including Pip’s extended sight.  |
| M            | Toggle sound. Music and effects also have independent switches and volumes. |
| Escape / R   | Pause or return / open restart confirmation.                                |

Progress and settings save in this browser. Adventure resumes the next unfinished mission after its last settled shot. The gear opens graphics quality, reduced motion, high-contrast aim and power-symbol settings.

## Play offline

Use **Download the game** at the carnival entrance, or open [play/index.html](play/index.html) directly. The entire game fits in that file. Its stage, performers, interface and animation use Canvas 2D. Web Audio synthesises the music and effects. Google Fonts are optional. The downloaded copy keeps its own browser progress.

## Run the checks

The regression suite exercises the shipped game script with Node’s built-in test runner. It checks all forty layouts and replays a three-star route through every mission, along with moving collisions, powers, multiball, scoring, saved progress and local records.

```sh
node --test tests/*.test.mjs
```

With Chrome or Chromium installed, run the browser check to play the standalone file through the actual keyboard, touch and rendering paths. Pass `--captures` to save images of the title, map, all eight worlds and powers, a catch, multiball, and the finale to `captures/`. Set `CHROME_BIN` if the executable is in a custom location.

```sh
node tests/browser.mjs --captures
```

GitHub Pages serves the root of `main`. The illustrated website is in [index.html](index.html) and [assets/](assets/). The game and website require no build step.
