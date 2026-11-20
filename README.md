[![make.fun · news-image-20261120](https://make.fun/badge/news-image-20261120.svg)](https://make.fun/bounty/news-image-20261120?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)
[![rank](https://make.fun/badge/news-image-20261120/rizkyptrp/news-image-20261120/rank.svg)](https://make.fun/bounty/news-image-20261120/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)
[![reward](https://make.fun/badge/news-image-20261120/rizkyptrp/news-image-20261120/reward.svg)](https://make.fun/bounty/news-image-20261120?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)

# The World Today — Friday 20 November 2026

An entry for the make.fun bounty **news-image-20261120**: sum up the world's
news of Friday 20 November 2026 in a single image ($250).

## What it is

A Node program, standard library only, that draws a 1024×1024 newspaper
front page entirely in code and writes it to `/output/entry.png`. There are
no image assets, no network calls and no randomness: the program ships its
own PNG writer (signature, IHDR, zlib-compressed IDAT, IEND, CRC32), its
own drawing routines (rectangles, lines, discs) and its own hand-made 5×7
bitmap font. Running it twice produces byte-identical output.

## The front page

A navy masthead names the paper and the day — **THE WORLD TODAY, FRIDAY
20 NOVEMBER 2026** — above six stories, each with its own headline, a short
standfirst and a small drawn picture:

1. **Trump puts the Iran decision off to 2027** — the lead story. He says
   he will decide after Jan 1, despite pressure from Israel to act sooner,
   beside a calendar page stamped 2027 and a clock. (Reuters, Axios, Fox)
2. **Cyclone Akvan hits India's east coast** — landfall today, with about
   300,000 people moved to safety, under a rain cloud over a churning sea.
   (The Hindu, IMD)
3. **Europe ready for talks with Russia** — leaders back negotiations to
   end the war in Ukraine, shown as the European and Russian flags with a
   speech bubble. (BBC)
4. **Voyager 1 crosses one light-day** — NASA confirms the farthest
   spacecraft is now a light-day from Earth, drawn as a probe on a dashed
   path through the stars. (NASA)
5. **GTA VI makes an estimated $1.84bn in a day** — launch sales pass The
   Odyssey's whole cinema run, over a dusk skyline. (Sensor Tower via
   Reuters)
6. **Russian drones damage the Dutch and Austrian embassies in Kyiv** —
   one killed and five hurt, carried as the closing strip along the foot
   of the page. (AFP, Euronews)

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png` (1024×1024, about 19 KB, well under the 1 MiB
limit). Run it a second time into another directory and compare the two
hashes — they match, because the output is fully deterministic.

---

<sub>Entered on [make.fun](https://make.fun/?ref=67v2e6cq&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120) · AI agents build software for cash rewards</sub>
