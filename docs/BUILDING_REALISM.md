> Current GitHub release: core geometry and procedural facades only. Photographs and scanned materials are deferred; the asset manifest has no external image payloads. The full material implementation described below remains available in the prior source revision.

# Building realism · Studio 16.1

Use the visible **精细建筑** button beside 2D/3D, or **地图图层 → 实景立面与精细屋顶**. Enabling it also enables buildings and returns a flat view to 3D. The layer is off by default; no photo or material request is made until it is enabled. **实景地标 · 材质来源** jumps to the relevant building and lists author, license and source. Day, night and drawing themes remain available.

The 3,845 buildings in the existing Xuanwu snapshot use their original OSM polygons and courtyard holes. Recorded heights remain unchanged. Display-only height assumptions fill missing values; none of these visual properties replace assessment source records. Up to 4,000 visible buildings / 650,000 vertices are admitted atomically. Closer views add roof edges and deterministic rooftop details. Surface normal/roughness maps use 512-pixel texture arrays; sufficiently capable desktop views use 1,024-pixel albedo arrays (512 on smaller/mobile views), with mipmaps and bounded anisotropy; CPU image caches survive toggles, while GPU resources are released when the layer is removed. A query-only extrusion preserves building selection.

Six correctly matched footprints receive portions of attributed reference photographs:

| Building | OSM footprint | Image license |
| --- | --- | --- |
| Southeast University auditorium | way/236944775 | CC BY-SA 3.0 |
| Nanjing Library | way/94327966 | CC BY 2.0 |
| Presidential Palace gate | way/321096461 | CC BY 2.0 |
| Nanjing Railway Station, south hall | way/88507214 | CC BY-SA 4.0 |
| Nanjing International Exhibition Center | way/91203399 | CC BY-SA 3.0 |
| Nanjing Museum, old main hall | way/319998729 | CC0 |

`dist/data/building-materials.json` is the authoritative asset manifest: source pages, original authors and license links, local files, selected image corners, facade bearing, and shape references. `dist/THIRD_PARTY_NOTICES.txt` repeats asset notices. Images are resized JPEGs; perspective correction/cropping occurs in runtime UV coordinates, retaining original image files for inspection. Map PNG exports carry photo authors, source pages and licenses.

Five Poly Haven CC0 scanned materials provide albedo, OpenGL normal and roughness maps: grey roof tiles, clay roof tiles, concrete, brick and stone. Their appearance is generic and is not evidence of materials on an actual Nanjing building. Additional procedural landmark details include the auditorium dome, library light court, palace front parapet, station curved roof, museum hipped roof, art museum skylights and Linggu Pagoda eaves.

## Limits

This is an architectural visualization, not citywide photogrammetry. Historic photographs are not a guarantee of current conditions. Only selected front-wall patches are photographic; unseen sides, heights, roof details, lighting, cast shadows and rooftop services are approximate. Original photographs can include minor foreground occlusions or old banners. Ground shadows use building-center terrain elevation rather than a full terrain shadow map. No commercially restricted aerial tiles or 3D models are bundled; the research found no suitably licensed, verifiable complete landmark models or useful high-resolution open orthophotography for this implementation. Unmatched observatory buildings are not assigned invented identities.

## Verification

Node tests cover all snapshot buildings, unchanged recorded heights, finite geometry, polygon winding and courtyard preservation, source-to-wall homography, atomic mesh budgets, asset attribution, lazy loading, picking and layer cleanup. Native EGL renders compile the actual shader sources and display the actual meshes/textures for six landmarks from their front and oblique views. This is native GPU-path inspection, not browser end-to-end testing.

## Ordinary building variation

Eight seeded facade families vary opening proportions, framing, mullions, spandrels, blinds, glass tint and floor/bay pitch. They are visual assumptions derived from building category and stable OSM identity, not surveyed windows. Near views add projecting balcony slabs/rails, floor bands and roof service volumes. Low/mid-rise mixed buildings may receive gabled or hipped demonstration roofs when OSM does not specify a roof. Hipped planes are clipped analytically to the original triangulated footprint and courtyards. Ordinary decoration uses a separate bounded buffer; complete base meshes have priority, so detail cannot displace buildings. The same 3,845-building snapshot is retained at both detail settings.
