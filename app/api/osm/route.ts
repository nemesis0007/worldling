type OverpassElement = {
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
};

type WorldPoint = { x: number; z: number };

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const RADIUS_METERS = 260;
const WORLD_SCALE = 0.052;

function finiteCoordinate(value: string | null, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function heightFor(element: OverpassElement) {
  const explicit = Number.parseFloat(element.tags?.height ?? "");
  if (Number.isFinite(explicit) && explicit > 1) return Math.min(explicit, 65) * WORLD_SCALE;
  const levels = Number.parseFloat(element.tags?.["building:levels"] ?? "");
  if (Number.isFinite(levels) && levels > 0) return Math.min(levels * 3.1, 65) * WORLD_SCALE;
  return (8 + (element.id % 13)) * WORLD_SCALE;
}

function project(points: Array<{ lat: number; lon: number }>, latitude: number, longitude: number): WorldPoint[] {
  const longitudeScale = 111_320 * Math.cos(latitude * Math.PI / 180);
  return points.map((point) => ({
    x: (point.lon - longitude) * longitudeScale * WORLD_SCALE,
    z: -(point.lat - latitude) * 110_540 * WORLD_SCALE,
  }));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latitude = finiteCoordinate(url.searchParams.get("lat"), -85, 85);
  const longitude = finiteCoordinate(url.searchParams.get("lon"), -180, 180);

  if (latitude === null || longitude === null) {
    return Response.json({ error: "Valid lat and lon query parameters are required." }, { status: 400 });
  }

  const query = `[out:json][timeout:18];(
    way(around:${RADIUS_METERS},${latitude},${longitude})["highway"~"primary|secondary|tertiary|residential|living_street|pedestrian|service"];
    way(around:${RADIUS_METERS},${latitude},${longitude})["building"];
    way(around:${RADIUS_METERS},${latitude},${longitude})["landuse"];
    way(around:${RADIUS_METERS},${latitude},${longitude})["leisure"];
    way(around:${RADIUS_METERS},${latitude},${longitude})["natural"];
    node(around:${RADIUS_METERS},${latitude},${longitude})["natural"="tree"];
    node(around:${RADIUS_METERS},${latitude},${longitude})["amenity"~"bench|waste_basket|bicycle_parking"];
    node(around:${RADIUS_METERS},${latitude},${longitude})["highway"="street_lamp"];
  );out body geom;>;out skel qt;`;

  try {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "Worldling/0.1 (https://github.com/nemesis0007/worldling)",
      },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
    const payload = await response.json() as { elements?: OverpassElement[] };
    const elements = payload.elements ?? [];
    const roads = elements
      .filter((element) => element.tags?.highway && (element.geometry?.length ?? 0) > 1)
      .slice(0, 90)
      .map((element) => ({ id: element.id, kind: element.tags?.highway, points: project(element.geometry!, latitude, longitude) }));
    const buildings = elements
      .filter((element) => element.tags?.building && (element.geometry?.length ?? 0) > 3)
      .slice(0, 180)
      .map((element) => ({ id: element.id, height: heightFor(element), points: project(element.geometry!, latitude, longitude) }));

    return Response.json(
      { roads, buildings, osm: JSON.stringify({ version: 0.6, generator: "Worldling via Overpass", elements }), center: { latitude, longitude }, radius: RADIUS_METERS },
      { headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "OpenStreetMap neighborhood unavailable." },
      { status: 502, headers: { "Cache-Control": "public, max-age=120" } },
    );
  }
}
