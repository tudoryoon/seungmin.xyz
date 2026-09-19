# Entrance Particles

The entrance uses procedural Three.js point clouds and three helical paths,
each consisting of a main filament and two finer braided filaments.
The Seoul-facing globe morphs into the Korean peninsula, then approaches
Seoul and the Han River. A bounded radial particle sweep completes the arrival.
There are no building meshes, paid APIs or runtime map-service requests.

`earth-2048.webp` is a 2048-pixel-wide derivative of the NASA Blue Marble
land/ocean/ice texture. The map only assigns land and ocean colors to globe
points; it is not used as a screen-filling image.

Source: [NASA Earth Observatory, Blue Marble](https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_8192.png).

`data/entry-geography-20260919.js` contains only Korea country boundaries,
Seoul's administrative boundary and a clipped section of the Han River.
These are derived from [Natural Earth public-domain data](https://www.naturalearthdata.com/about/terms-of-use/):

- [1:50m country boundaries](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson)
- [1:10m administrative boundaries](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_admin_1_states_provinces.geojson)
- [1:10m rivers](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_rivers_lake_centerlines.geojson)

Rebuild from downloaded source GeoJSON files:

```sh
node scripts/build-entry-geography.mjs countries.geojson admin1.geojson rivers.geojson
```

The script selects both Koreas, Seoul (`KR-11`), and the local Han River.
It reports source hashes for reproducibility. Large global source files are not
shipped. Polygon sampling uses Three.js triangulation. The river is smoothed
for the entrance artwork; this scene is not intended as a precise street map.

All assets are served locally. Failed texture loading retains the point globe.
WebGL-unavailable devices retain the existing illustrated entrance fallback.
