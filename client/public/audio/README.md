# Audio assets

Royalty-free SFX dropped here are loaded lazily by `client/src/services/sound.js`
via Howler. The client tolerates a missing file (logs one warning per missing
key and stops trying), so games run silently with this folder empty.

## Expected filenames

Each event in the casino-wide registry (see `SoundProvider.jsx`) maps to a
single mp3 in this folder.

| Filename            | Event key       | When it plays                                          |
| ------------------- | --------------- | ------------------------------------------------------ |
| `bet.mp3`           | `bet`           | Player clicks "Place bet" (any game)                   |
| `cashout.mp3`       | `cashout`       | Player clicks Cashout (Crash, Plinko-auto, etc.)       |
| `win-small.mp3`     | `win-small`     | Win multiplier >= 2x                                   |
| `win-big.mp3`       | `win-big`       | Win multiplier >= 10x                                  |
| `win-jackpot.mp3`   | `win-jackpot`   | Win multiplier >= 50x — full-screen confetti tier      |
| `lose.mp3`          | `lose`          | Loss / bust sting                                      |
| `spin-tick.mp3`     | `spin-tick`     | Wheel / Roulette ticker pass                           |
| `card-flip.mp3`     | `card-flip`     | Blackjack card deal / flip                             |
| `chip-drop.mp3`     | `chip-drop`     | Roulette / Blackjack chip placement                    |
| `crash-bust.mp3`    | `crash-bust`    | Crash rocket bust                                      |
| `pin-hit.mp3`       | `pin-hit`       | Plinko ball-pin collision                              |
| `gem-reveal.mp3`    | `gem-reveal`    | Landmines safe-tile reveal                             |
| `mine-boom.mp3`     | `mine-boom`     | Landmines mine reveal                                  |

(The Phase 0 implementation also keeps backward compatibility with the earlier
short-name registry from the previous design — those files may still appear
here as `win.mp3`, `loss.mp3`, `tick.mp3`, `drumroll.mp3`, `big_win.mp3`,
`ambient.mp3`. They are not required and may be removed when the new sprite
set is delivered.)

## Format

- MP3, mono, 44.1 kHz
- < 100 KB each (lobby ambient may be larger if necessary)
- Normalised to -3 dBFS peak so the in-game per-event volume mix stays sane

## Royalty-free sources

- https://pixabay.com/sound-effects/ (CC0)
- https://freesound.org/ (filter for CC0 / Attribution NC)
- https://opengameart.org/

## Behaviour without assets

The audio service in `client/src/services/sound.js` is defensive: any 404 or
load error is caught, logs **one** warning per missing key, and stops trying
to play that SFX. Game UI works normally even with this folder empty — players
just hear silence.
