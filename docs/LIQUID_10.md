# Studio 10 — Liquid surfaces and motion

2026-09-12. This release follows the approved visual and interaction plan. The existing Xuanwu datasets, eight research units and evidence rules remain unchanged. Six-district data expansion remains deferred.

## Interface

Map search, tools, navigation and object details use translucent white surfaces, static edge highlights and soft shadows. Research text and reports keep solid white backgrounds. Apple devices use installed system SF/PingFang typography; other devices use local fallbacks. No Apple font files or map assets are distributed.

Buttons respond in 140 ms, selected tab backgrounds slide in 220 ms, and menus and dialogs enter in roughly 180–280 ms. The narrow-screen inspector opens in 300 ms with CSS-controlled transitions. Quick repeated actions cancel previous reveal animations. The motion layer preserves application state, input values, focus and scrolling.

Mobile search occupies its own row, with map tools below it. Primary touch controls and form text are larger. Map movement temporarily replaces background blur with an opaque surface; compact devices use less blur and shorter animation distances. Reduced motion, reduced transparency and missing backdrop-filter support have explicit fallbacks.

## Map interaction

Object focus uses a distance-dependent 450–800 ms flight. View presets use 700 ms, restoring a saved view uses 650 ms, and overview uses 750 ms. Pointer, wheel and relevant keyboard input stop an active camera flight immediately. Canvas 2D uses interpolated geographic camera movement and shortest-arc bearing changes. WebGL layer visibility fades over approximately 200 ms without reloading all sources; Canvas changes visibility immediately.

Object details expand around the selected point and remain within map bounds. Existing building/road/land details, overlapping object selection and full research records remain available. Missing attributes stay unknown.

## Validation

Source syntax checks and all 57 automated tests pass, including camera interpolation, interruption, replacement flights, reduced motion, invalid camera inputs and asymmetric fit bounds. Browser preview checks and final publication are recorded below after verification.

Frontend JavaScript is published as inspectable UTF-8 parts with content-hashed filenames. Existing spatial data and compressed service packs are unchanged. The browser available for this review uses Canvas 2D; native GPU effects and hardware gestures require suitable devices and are not claimed as verified.
