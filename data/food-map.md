# Seoul Food Map

The public `#food-map` view uses all 448 stable station IDs from `stations.js` (2026-09-13 snapshot), including the original outlying and restricted-service stations. Transfers remain a single selectable complex; same-name Sinchon and Yangpyeong stations remain separate. Station service warnings and external map links are preserved. This is a schematic station-map foundation, not a restaurant database or travel-routing/service-status tool. No restaurant records, Supabase settings, roulette odds or saved history are changed.

## Topology and Geometry

`subway-topology.js` records 18 ordered runs across ten passenger lines and 508 adjacent-station connections. Source IDs from the Seoul T-DATA snapshot are used, with explicit order for infill stations and branches. It includes the Line 2 circle and Seongsu/Sinjeong branches, Line 1 Gyeongin/Gwangmyeong/Seodongtan branches, Line 5 Macheon branch, Line 6 Eungam loop and Gyeongui Seoul branch. The Eungam loop is drawn as connectivity, not a bidirectional travel instruction. See `stations.md` for the snapshot's source/provenance and service caveats.

`scripts/build-subway-layout.mjs` generates the committed `data/subway-layout.js`. It expands the centre and compresses the suburban tails, uses D3-force 3.0.0 for layout, reserves space around transfer anchors, then evenly spaces stations along horizontal, vertical and 45-degree runs. Positions and distances are deliberately schematic, not geographic or a reproduction of an official map. D3 runs at build time only, not in visitors' browsers. Generation is deterministic and can be repeated with `D3_FORCE_MODULE=/path/to/d3-force/src/index.js node scripts/build-subway-layout.mjs` (D3's ISC license is retained by the installed package).

The original real coordinates remain untouched in `food-map-core.js` for the Seoul extent filter and dataset validation. 447 come from Seoul T-DATA. Dorasan's coordinate override comes from [OSM way 181444733](https://www.openstreetmap.org/way/181444733), retrieved on 2026-09-26 (OpenStreetMap contributors, ODbL); it is used only as a layout seed, not a background map. Roulette IDs and data are not mutated.

## Rendering

Leaflet 1.9.4 (BSD-2-Clause, `vendor/leaflet/LICENSE`) uses `CRS.Simple` for accessible station markers, pan, pinch, keyboard controls and fractional zoom. There are no raster tiles, map API keys, geolocation requests or map-provider runtime calls. Search and selection remain usable from the list if the library cannot load.

The existing Three.js runtime (MIT, `vendor/THREE-LICENSE`) adds lit cylindrical track geometry in an orthographic camera aligned with the SVG map. It renders only on map changes, not continuously. During zoom animation, while WebGL is unavailable, or after context loss, the SVG tracks remain visible and functional. It pauses on hidden views. Station labels and hit targets remain flat and readable; labels avoid other labels and station dots. Reduced-motion users get no animated zoom/hover transitions. There is no free camera rotation.

## Verification

`node tests/subway-layout.mjs` checks all 448 unique positions, complete line membership, connected topology, every geometry endpoint, octilinear segments and branch/infill regressions. `node tests/food-map.mjs` checks original data preservation and search. `DOM_MODULE=/path/to/happy-dom/lib/index.js node tests/food-map-ui.mjs` exercises every marker, filtering, keyboard selection, zoom, lazy loading, lifecycle and renderer failure. Browser QA uses the local-only `tests/entry-preview.mjs`; `?no-gpu#food-map` exercises fallback and `?capture-depth#food-map` retains the test WebGL buffer for pixel checks. Neither flag changes production code. Existing routing, entrance and roulette tests remain regression coverage.
