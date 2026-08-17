# City data pipeline

## Goal

Worldling needs recognisable, walkable districts that load quickly in a browser. It does not attempt to download an entire city or reproduce Google Street View.

## Standard districts

`scripts/download-city-data.mjs` requests a small area around each configured city centre from the OpenStreetMap Overpass API. The response is reduced to roads and building footprints, projected from latitude/longitude into local game coordinates, and saved under `public/city-data/<city-id>.json`.

At runtime:

1. `World3D` loads the cached JSON.
2. Building footprints are ranked and normalized around a consistent playable street corridor.
3. Three.js draws the avenue, sidewalks, crossings, and extruded local building forms.
4. City-themed props, atmosphere, NPCs, and a stylised landmark are added.
5. If the JSON is missing or invalid, a small licensed fallback street loads instead.

The in-game status badge describes which path is active: downloaded district, live OSM district, official NYC street, or designed fallback.

## Height rules

Building height is selected in this order:

1. explicit OpenStreetMap `height`
2. `building:levels × 3.1 m`
3. deterministic estimate based on the OSM feature id

Values are capped to keep browser scenes stable.

## New York detail pack

`scripts/download-nyc-detail.mjs` combines OpenStreetMap roads with NYC Open Data building footprints and roof heights near Times Square. The current New York level arranges a subset of those real building forms into a deliberately playable street canyon. It is visually grounded in official data but does not preserve exact placement.

## Refreshing data

Run the city download script from the repository root:

```bash
node scripts/download-city-data.mjs
```

Refresh the NYC detail pack separately:

```bash
node scripts/download-nyc-detail.mjs
```

Review generated file sizes and feature counts before committing. An area with very few buildings should be moved to a denser nearby centre rather than accepted as a mostly empty level.

## Data quality checklist

- at least 40 useful building footprints where that city has dense mapping
- a connected road or pedestrian network around the player start
- no building footprint crossing the spawn area
- known landmark and NPC positions remain reachable
- acceptable load time on a mid-range mobile device
- correct OpenStreetMap attribution remains visible

## Licensing boundaries

OpenStreetMap data is licensed under ODbL and requires attribution. Google Maps and Street View tiles are not downloaded or repackaged. External 3D assets must include a licence that permits redistribution; a publicly viewable repository without a license is not sufficient by itself.
