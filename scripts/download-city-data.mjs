import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const radius = 260;
const worldScale = 0.052;
const outputDirectory = path.resolve("public/city-data");
const cities = [
  ["new-york", 40.7580, -73.9855],
  ["beijing", 39.9163, 116.3972],
  ["delhi", 28.6129, 77.2295],
  ["madrid", 40.4200, -3.6880],
  ["paris", 48.8584, 2.2945],
  ["cairo", 29.9792, 31.1342],
  ["dhaka", 23.8103, 90.4125],
  ["sao-paulo", -23.5614, -46.6559],
  ["moscow", 55.7525, 37.6231],
  ["lahore", 31.5925, 74.3095],
  ["mumbai", 18.9220, 72.8347],
  ["bengaluru", 12.9796, 77.5907],
];
const mirrors = [
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

function queries(latitude, longitude, radiusMeters) {
  return [
    `[out:json][timeout:25];way(around:${radiusMeters},${latitude},${longitude})["highway"~"primary|secondary|tertiary|residential|living_street|pedestrian|service"];out geom;`,
    `[out:json][timeout:25];way(around:${radiusMeters},${latitude},${longitude})["building"];out geom;`,
  ];
}

async function downloadQuery(overpassQuery) {
  let lastError;
  for (const mirror of mirrors) {
    try {
      const response = await fetch(mirror, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": "Worldling/0.1" },
        body: new URLSearchParams({ data: overpassQuery }),
        signal: AbortSignal.timeout(55_000),
      });
      if (!response.ok) throw new Error(`${mirror} returned ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.elements)) throw new Error(`${mirror} returned no elements`);
      return payload;
    } catch (error) {
      lastError = error;
      console.warn(`${mirror}: ${error instanceof Error ? error.message : error}`);
    }
  }
  throw lastError;
}

async function download(latitude, longitude, radiusMeters) {
  try {
    const payloads = [];
    for (const overpassQuery of queries(latitude, longitude, radiusMeters)) payloads.push(await downloadQuery(overpassQuery));
    return { version: 0.6, generator: "Worldling bundled OpenStreetMap district", elements: payloads.flatMap((payload) => payload.elements) };
  } catch (error) {
    console.warn(`Overpass mirrors exhausted; using the OpenStreetMap map export: ${error instanceof Error ? error.message : error}`);
    return downloadMapExport(latitude, longitude, radiusMeters);
  }
}

async function downloadMapExport(latitude, longitude, radiusMeters) {
  const latDelta = radiusMeters / 110_540;
  const lonDelta = radiusMeters / (111_320 * Math.cos(latitude * Math.PI / 180));
  const bbox = [longitude - lonDelta, latitude - latDelta, longitude + lonDelta, latitude + latDelta].join(",");
  const response = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${bbox}`, {
    headers: { "User-Agent": "Worldling/0.1" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`OpenStreetMap map export returned ${response.status}`);
  const xml = await response.text();
  const nodes = new Map();
  for (const match of xml.matchAll(/<node\s+[^>]*id="(\d+)"[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>/g)) {
    nodes.set(match[1], { lat: Number(match[2]), lon: Number(match[3]) });
  }
  const elements = [];
  for (const match of xml.matchAll(/<way\s+[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
    const body = match[2];
    const tags = {};
    for (const tag of body.matchAll(/<tag\s+k="([^"]+)"\s+v="([^"]*)"\s*\/>/g)) tags[tag[1]] = tag[2];
    if (!tags.building && !tags.highway) continue;
    const geometry = [...body.matchAll(/<nd\s+ref="(\d+)"\s*\/>/g)].map((nd) => nodes.get(nd[1])).filter(Boolean);
    if (geometry.length > 1) elements.push({ type: "way", id: Number(match[1]), tags, geometry });
  }
  return { version: 0.6, generator: "Worldling bundled OpenStreetMap map export", elements };
}

function project(points, latitude, longitude) {
  const longitudeScale = 111_320 * Math.cos(latitude * Math.PI / 180);
  return points.map((point) => ({
    x: (point.lon - longitude) * longitudeScale * worldScale,
    z: -(point.lat - latitude) * 110_540 * worldScale,
  }));
}

function heightFor(element) {
  const explicit = Number.parseFloat(element.tags?.height ?? "");
  if (Number.isFinite(explicit) && explicit > 1) return Math.min(explicit, 65) * worldScale;
  const levels = Number.parseFloat(element.tags?.["building:levels"] ?? "");
  if (Number.isFinite(levels) && levels > 0) return Math.min(levels * 3.1, 65) * worldScale;
  return (8 + (element.id % 13)) * worldScale;
}

await mkdir(outputDirectory, { recursive: true });
for (const [slug, latitude, longitude] of cities) {
  const outputPath = path.join(outputDirectory, `${slug}.json`);
  try {
    await access(outputPath);
    console.log(`${slug}: already downloaded`);
    continue;
  } catch {}
  const cityRadius = slug === "bengaluru" ? 140 : radius;
  const payload = await download(latitude, longitude, cityRadius);
  const elements = payload.elements;
  const roads = elements
    .filter((element) => element.tags?.highway && element.geometry?.length > 1)
    .slice(0, 90)
    .map((element) => ({ id: element.id, kind: element.tags.highway, points: project(element.geometry, latitude, longitude) }));
  const buildings = elements
    .filter((element) => element.tags?.building && element.geometry?.length > 3)
    .slice(0, 180)
    .map((element) => ({ id: element.id, height: heightFor(element), points: project(element.geometry, latitude, longitude) }));
  if (!roads.length && !buildings.length) throw new Error(`${slug} returned no usable geometry`);
  const result = {
    source: "OpenStreetMap",
    downloadedAt: new Date().toISOString(),
    center: { latitude, longitude },
    radius: cityRadius,
    roads,
    buildings,
  };
  await writeFile(outputPath, JSON.stringify(result));
  console.log(`${slug}: ${roads.length} roads, ${buildings.length} buildings`);
  await new Promise((resolve) => setTimeout(resolve, 1_200));
}
