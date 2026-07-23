import { AppError } from '../../lib/errors';

interface NominatimResult {
  lat: string;
  lon: string;
}

export async function geocodeAddress(query: string): Promise<{ latitude: number; longitude: number } | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query.trim());

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new AppError('El servicio de geocodificación no está disponible.', 'GEOCODING_FAILED');
  }
  const [first] = (await response.json()) as NominatimResult[];
  if (!first) return null;
  return { latitude: Number(first.lat), longitude: Number(first.lon) };
}
