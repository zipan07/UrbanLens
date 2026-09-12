# Studio 09 visual release

2026-09-12. The user prioritized publishing the visual upgrade and explicitly deferred the six-district data upload. This release retains the existing Xuanwu spatial datasets, eight research units and public-source disclosures.

The interface uses a white base, restrained blue actions, larger system typography and translucent glass controls. The map has a light water/green palette, clearer road hierarchy and larger labels. Apple devices use installed SF/PingFang fonts; other systems use appropriate fallbacks. Apple font files are not distributed.

Building, road and polygon selection now supports an inline right-click details card, overlapping object selection and links to the existing record workflow. Missing heights and business records remain unknown; map polygons are not cadastral parcels.

The frontend runtime is built into inspectable UTF-8 text parts with content-hashed filenames. These parts contain only application JavaScript and the existing locked public npm dependencies. No newly collected six-district data is uploaded in this release. Existing spatial files and service packs remain byte-for-byte unchanged.

Build and 52 automated tests pass. Live desktop and narrow-screen QA will be recorded after deployment. Real GPU rendering and native hardware gestures require appropriate devices; the cloud browser uses the Canvas 2D fallback.
