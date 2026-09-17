# Entrance Particles

The entrance uses procedural Three.js point clouds and three helical paths,
each consisting of a main filament and two finer braided filaments.
The layered galaxy has four arms with bounded scatter and a sparse dust field.
There are no building meshes, paid APIs or runtime map-service requests.

`earth-2048.webp` is a 2048-pixel-wide derivative of the NASA Blue Marble
land/ocean/ice texture. The map only assigns land and ocean colors to globe
points; it is not used as a screen-filling image.

Source: NASA Earth Observatory, Blue Marble.
https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_8192.png

All assets are served locally. Failed texture loading retains the point globe.
WebGL-unavailable devices retain the existing illustrated entrance fallback.
