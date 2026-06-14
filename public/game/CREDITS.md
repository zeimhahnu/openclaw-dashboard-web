# Game Scene Credits

## Art: 100% original Phaser vector pixel art

The cozy farm scene in `src/components/PixelGuild.tsx` is drawn at runtime using
Phaser `Graphics` primitives. **No external pixel art assets are used.**

This was an intentional design decision in the 2026-06-15 Stardew redesign:

- **License simplicity** — Zero asset-pack attribution requirements, no risk
  of accidental commercial-use violations. The dashboard may be embedded in
  screenshots, blog posts, and shared client links.
- **Frame-geometry consistency** — All art shares the same 1px pixel grid and
  the same 16-color earthy palette, so the new villager sprites, the chicken
  coop, the workstations, and the chore-board seed packets all feel like one
  artist's hand.
- **Live wiring** — The scene consumes `session_active`, `health`, and
  `completed_today` fields (Phase 1, Lil Claw) directly. Vector art makes it
  trivial to add new states (e.g. new tools, new workstations) without
  re-cutting sprite sheets.

### What was considered and rejected

- **Sprout Lands (Cup Nooble)** — Premium asset pack on itch.io. The basic
  tier is non-commercial only, and the premium tier requires payment. The
  download flow is also gated behind an interactive button, making it awkward
  to bake into our deploy pipeline. License uncertainty → dropped.
- **Generic CC0 packs** — Available, but the existing earthy palette and the
  need for held-in-hand tool poses (watering can, hammer, quill) made finding
  a single drop-in pack impractical. Vector drawing wins on consistency.

### What was retired (kept on disk for archaeology)

The following PNGs in `public/game/` were used by the prior `PixelGuild.tsx`
recolored-blob sprite sheets and `GuildWorld.tsx` (now removed):

- `char-*.png` (lil-claw / goop / mason / unnamed) — same blob recolored.
- `props.png`, `plants.png` — generic RPG Maker tile set, scatter-placed.
- `fences.png`, `grass.png`, `hills.png`, `water.png` — terrain pieces for
  the deleted GuildWorld battlefield scene.
- `house.png` — generic placeholder house.

If you want to restore any of them, they're in git history (commit `d0319f7`).
The current scene does not need them.

### Cozy palette reference

Used throughout the new scene for consistency with the dashboard CSS:

| Token       | Hex      | Used for                              |
|-------------|----------|----------------------------------------|
| `grass`     | `#7aad5a` | ground base, foliage                   |
| `grass-dk`  | `#5a8a3a` | grass tufts, fence posts               |
| `soil`      | `#5a3a1a` | tilled plot soil                       |
| `wood`      | `#6a3a18` | hut planks, fence rails, sign posts    |
| `wood-lt`   | `#8a5a2a` | wood highlights                        |
| `roof-red`  | `#c44a2a` | hut + coop roofs, scarecrow shirt      |
| `roof-dk`   | `#8a2a14` | roof shadow, scarecrow hat            |
| `stone`     | `#6a6058` | well, anvil base, forge stone          |
| `gold`      | `#ffd040` | forge glow, candle flame               |
| `sky-warm`  | `#dfeac4` | sky/background base                    |
| `sun`       | `#fff0a0` | soft sun in upper-right                |
| `water`     | `#4a7a9a` | well water                             |
| `wheat`     | `#e8c860` | straw, scarecrow hands                 |
| `pumpkin`   | `#ff8a3a` | scarecrow head                         |
