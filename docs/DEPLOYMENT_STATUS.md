# Studio 09 deployment checkpoint

2026-09-12. Implementation is complete locally; the public site has NOT been upgraded yet.

- Six-district OSM data and the white/glass map interface are implemented.
- Local build, syntax checks and all 56 automated tests passed.
- Public upload of some compressed map assets was rejected by safety review because the exact opaque payload could not be verified at action level, including after source-ID, field and hash checks.
- This branch is a source checkpoint, not a deployable release. Its packed assets are incomplete; do not merge or copy it to GitHub Pages yet.
- Existing `gh-pages` remains unchanged. Studio 09 desktop/mobile browser QA remains pending.
- Source provenance is recorded in DATA_RELEASE_AUDIT.json and FRONTEND_RELEASE_AUDIT.json. Unknown building heights, non-cadastral polygons, limited terrain and missing business records remain disclosed.

The complete local implementation is committed as `17732a3` plus this status note. The remaining step requires approval for publishing the verified public OSM data packages to the user's public `zipan07/UrbanLens` repository, followed by deployment and live QA. Do not work around a rejected upload.

To regenerate data after approval, use `python scripts/fetch-nanjing.py`, `node scripts/prepare-nanjing.mjs`, then `npm run build`, `npm run check` and `npm test`. A newly fetched OSM snapshot can differ from the audited September 12 snapshot; refresh provenance accordingly.
