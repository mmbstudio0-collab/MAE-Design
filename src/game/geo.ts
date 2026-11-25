import { GeoOrigin } from './types';

export const EARTH_RADIUS_M = 6378137;
export const METERS_PER_DEG_LAT = (Math.PI * EARTH_RADIUS_M) / 180; // ~111319.4908

export function metersPerDegLng(originLat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180);
}

/**
 * Exact Web Mercator scale (pixels per meter) at a given latitude & Google Maps zoom level.
 * Matches Google Maps tile projection with zero drift across zoom 12..21.
 */
export function googleMapsPixelsPerMeter(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  const worldPixels = 256 * Math.pow(2, zoom);
  const metersPerWorldAtLat = 2 * Math.PI * EARTH_RADIUS_M * Math.cos(latRad);
  return worldPixels / Math.max(1e-6, metersPerWorldAtLat);
}

/**
 * Inverse Web Mercator zoom from pixels-per-meter at a given latitude.
 */
export function pixelsPerMeterToGoogleZoom(lat: number, ppm: number): number {
  const latRad = (lat * Math.PI) / 180;
  const metersPerWorldAtLat = 2 * Math.PI * EARTH_RADIUS_M * Math.cos(latRad);
  const worldPixels = ppm * metersPerWorldAtLat;
  return Math.log2(Math.max(1e-6, worldPixels / 256));
}

/**
 * Converts geographic lat/lng to local tactical meters relative to origin using Web Mercator tangent scaling.
 * +x = East, +y = South (matching screen canvas & Google Maps pixel projection).
 */
export function latLngToMeters(lat: number, lng: number, origin: GeoOrigin): { x: number; y: number } {
  const cosOrigin = Math.cos((origin.lat * Math.PI) / 180);
  const x = ((lng - origin.lng) * Math.PI / 180) * EARTH_RADIUS_M * cosOrigin;
  const mercY = (deg: number) => {
    const rad = Math.max(-85, Math.min(85, deg)) * (Math.PI / 180);
    return Math.log(Math.tan(Math.PI / 4 + rad / 2));
  };
  const y = (mercY(origin.lat) - mercY(lat)) * EARTH_RADIUS_M * cosOrigin;
  return { x, y };
}

/**
 * Converts local tactical meters (+x East, +y South) back to geographic lat/lng.
 */
export function metersToLatLng(x: number, y: number, origin: GeoOrigin): { lat: number; lng: number } {
  const cosOrigin = Math.cos((origin.lat * Math.PI) / 180);
  const lng = origin.lng + ((x / (EARTH_RADIUS_M * cosOrigin)) * 180) / Math.PI;
  const originRad = Math.max(-85, Math.min(85, origin.lat)) * (Math.PI / 180);
  const originMerc = Math.log(Math.tan(Math.PI / 4 + originRad / 2));
  const targetMerc = originMerc - y / (EARTH_RADIUS_M * cosOrigin);
  const latRad = 2 * Math.atan(Math.exp(targetMerc)) - Math.PI / 2;
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}

export function getSectorLatLngBounds(
  origin: GeoOrigin,
  halfSizeMeters: number
): { north: number; south: number; east: number; west: number } {
  const nw = metersToLatLng(-halfSizeMeters, -halfSizeMeters, origin);
  const se = metersToLatLng(halfSizeMeters, halfSizeMeters, origin);
  return {
    north: nw.lat,
    south: se.lat,
    east: se.lng,
    west: nw.lng,
  };
}
