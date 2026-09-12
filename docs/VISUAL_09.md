# Studio 09 visual release

2026-09-12. The user prioritized publishing the visual upgrade and explicitly deferred the six-district data upload. This release retains the existing Xuanwu spatial datasets, eight research units and public-source disclosures.

The interface uses a white base, restrained blue actions, larger system typography and translucent glass controls. The map has a light water/green palette, clearer road hierarchy and larger labels. Apple devices use installed SF/PingFang fonts; other systems use appropriate fallbacks. Apple font files are not distributed.

Building, road and polygon selection now supports an inline right-click details card, overlapping object selection and links to the existing record workflow. Missing heights and business records remain unknown; map polygons are not cadastral parcels.

The frontend runtime is built into inspectable UTF-8 text parts with content-hashed filenames. These parts contain only application JavaScript and the existing locked public npm dependencies. No newly collected six-district data is uploaded in this release. Existing spatial files and service packs remain byte-for-byte unchanged.

Build and 52 automated tests pass. On the deployed preview, desktop and 390 × 844 narrow-screen layouts were visually reviewed. The map and study panel loaded successfully; the narrow-screen study panel had equal client/scroll widths with no horizontal overflow. Building search and positioning, building right-click details, overlapping building/research/land selection, opening the matching research record, and road right-click details were exercised successfully. The East Zhongshan-area test road (北京东路, way/776728693) reported its selected segment length as 244.2 m and retained missing attributes as unknown. The SEU auditorium (way/236944775) showed a 1,223.9 m² footprint and unknown height.

This review used the Canvas 2D fallback. Real GPU rendering and native hardware gestures require appropriate devices and were not claimed as verified here. Runtime text parts reconstruct the exact frontend build (SHA-256 d697eb0e9b6cc294c5070fd2611466ac0063ebb59d15f1806ec40de92315f799).
