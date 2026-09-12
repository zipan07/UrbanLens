# Studio 10.1 — translucent glass and identity

2026-09-12. A small visual refinement following the approved Studio 10 release.

- Floating map controls transmit more of the map: white fill is 56%, with restrained static edge highlights and 18 px blur. Detail/layer cards keep 70% white fill. Mobile uses 68% fill and 12 px blur. Reading panes remain white; reduced transparency still gives solid surfaces.
- Creator credit is now “制作者：蔡子攀｜东南大学建筑学院 · 东南大学城市规划设计研究院”. It is shared across the interface, roadshow, map image/object exports and generated research reports. The manifest change is limited to creator metadata.
- The original monochrome UrbanLens mark combines the letter U with an optical lens. It is used in navigation, the mobile wordmark, roadshow, About, demo and browser icons. `dist/assets/urbanlens-mark.png` preserves the generated transparent PNG without image processing.

The mark was made with the built-in image generation tool. Design prompt: one original premium UrbanLens symbol; a bold near-black rounded open U integrated into a circular lens contour; generous negative space; precise optical proportions; flat monochrome; crisp vector-like edges; no wordmark, literal buildings, magnifying-glass handle or background; a centered transparent production asset. References were the simplicity and finish of major technology identities, without reproducing their marks.

No geometry or evidence datasets are added. Source syntax, CSS parsing and the production build pass. The runtime parts reconstruct the exact 1,254,774-byte frontend build (SHA-256 `edff26e651178bce1c2bc35983537b2ea9700d54101168a542da994d91dc758b`).

The deployed desktop and 390 × 844 preview loaded the map and the transparent logo successfully. Light/dark map glass and the two-affiliation footer were visually reviewed. The mobile inspector has matching content/scroll widths of 379 px; the new footer is approximately 97 px high. The desktop roadshow identity and map controls do not overlap. Dark-theme secondary text was then strengthened to maintain readability through the lighter glass. Browser review used Canvas 2D; no claim is made about native GPU or hardware-gesture verification.
