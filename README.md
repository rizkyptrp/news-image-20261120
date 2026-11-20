# The World Today — Friday 20 November 2026

A make.fun `news-image-20261120` entry: a Node program (standard library
only) that draws a 1024×1024 newspaper front page summing up the world's
news of Friday 20 November 2026 and writes it to `/output/entry.png`.

## The day's news

1. **Trump puts the Iran decision off to 2027** — "we'll see what happens
   after January 1", despite Israeli pressure for new strikes (Reuters,
   Axios, Fox).
2. **Cyclone Akvan hits India's east coast** — landfall today, about
   300,000 evacuated (The Hindu, IMD).
3. **Europe ready for talks to end the Ukraine war** — leaders say Europe
   is ready to talk to Russia (BBC).
4. **Voyager 1 crosses one light-day** — NASA confirms; a radio signal now
   takes a full day to reach the probe.
5. **GTA VI makes an estimated $1.84bn in a day** — past the whole cinema
   run of Nolan's *The Odyssey* (Sensor Tower, via Reuters).
6. **Drones damage two embassies in Kyiv** — Dutch and Austrian missions
   hit, one person killed (AFP, Euronews).

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` draws the page with its own PNG writer and its own 5×7 pixel
font — no network, no randomness, no assets. Two runs write byte-identical
output. The image is 1024×1024 and under 1 MiB.

## License

MIT — see [LICENSE](LICENSE).
