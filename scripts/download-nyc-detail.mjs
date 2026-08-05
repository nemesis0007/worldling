import { readFile, writeFile } from "node:fs/promises";

const latitude = 40.7580;
const longitude = -73.9855;
const worldScale = 0.052;
const bounds = { north: 40.76035, west: -73.98860, south: 40.75565, east: -73.98240 };
const target = new URL("https://data.cityofnewyork.us/resource/5zhs-2jue.json");
target.searchParams.set("$limit", "500");
target.searchParams.set("$where", `within_box(the_geom,${bounds.north},${bounds.west},${bounds.south},${bounds.east})`);

function project(points) {
  const longitudeScale = 111_320 * Math.cos(latitude * Math.PI / 180);
  return points.map(([lon, lat]) => ({
    x: (lon - longitude) * longitudeScale * worldScale,
    z: -(lat - latitude) * 110_540 * worldScale,
  }));
}

const response = await fetch(target, {
  headers: { "User-Agent": "Worldling/0.1 (NYC detail pack)" },
  signal: AbortSignal.timeout(60_000),
});
if (!response.ok) throw new Error(`NYC Open Data returned ${response.status}`);
const records = await response.json();
const current = JSON.parse(await readFile("public/city-data/new-york.json", "utf8"));
const buildings = records.flatMap((record) => {
  const geometry = record.the_geom;
  const polygons = geometry?.type === "MultiPolygon" ? geometry.coordinates : geometry?.type === "Polygon" ? [geometry.coordinates] : [];
  return polygons.flatMap((polygon, part) => {
    const ring = polygon[0];
    if (!Array.isArray(ring) || ring.length < 4) return [];
    const heightFeet = Number.parseFloat(record.height_roof ?? "");
    const heightMeters = Number.isFinite(heightFeet) && heightFeet > 6 ? heightFeet * 0.3048 : 12 + (Number(record.objectid) % 28);
    return [{
      id: Number(record.objectid) * 10 + part,
      bin: record.bin,
      year: Number.parseInt(record.construction_year ?? "", 10) || null,
      featureCode: record.feature_code,
      height: Math.min(heightMeters, 260) * worldScale,
      heightMeters: Math.round(heightMeters * 10) / 10,
      points: project(ring),
    }];
  });
});

const detailed = {
  ...current,
  source: "NYC Open Data BUILDING + OpenStreetMap roads",
  downloadedAt: new Date().toISOString(),
  detailLevel: "nyc-official",
  bounds,
  buildings,
};
await writeFile("public/city-data/new-york.json", JSON.stringify(detailed));
console.log(`New York detail pack: ${current.roads.length} roads, ${buildings.length} official buildings`);
