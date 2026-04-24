import { MAPBOX_ACCESS_TOKEN } from '../config/env';

interface MatchResult {
  coordinates: [number, number][]; // [lng, lat]
  confidence: number;
}

/**
 * Snap GPS coordinates to the nearest road/path using Mapbox Map Matching API.
 * Accepts up to 100 coordinates per call.
 * Profile: 'walking' for running on sidewalks/paths.
 *
 * Returns null on failure or low-quality match. Caller should fall back to raw GPS.
 */
export async function snapToRoads(
  coordinates: Array<{ latitude: number; longitude: number }>,
): Promise<MatchResult | null> {
  if (coordinates.length < 2 || !MAPBOX_ACCESS_TOKEN) return null;

  // Mapbox expects [lng, lat] format, max 100 coords
  const coords = coordinates.slice(-100);
  const coordStr = coords
    .map((c) => `${c.longitude},${c.latitude}`)
    .join(';');

  try {
    const url =
      `https://api.mapbox.com/matching/v5/mapbox/walking/${coordStr}` +
      `?access_token=${MAPBOX_ACCESS_TOKEN}` +
      `&geometries=geojson&overview=full&tidy=true`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.code !== 'Ok' || !data.matchings?.[0]) return null;

    const matching = data.matchings[0];
    return {
      coordinates: matching.geometry.coordinates, // [[lng, lat], ...]
      confidence: matching.confidence,
    };
  } catch {
    return null;
  }
}
