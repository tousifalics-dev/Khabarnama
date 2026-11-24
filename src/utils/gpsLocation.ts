import { DistrictMeta } from '../types';

interface BigDataCloudResponse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  postcode?: string;
  countryCode?: string;
  localityInfo?: {
    administrative?: Array<{
      name?: string;
      description?: string;
      adminLevel?: number;
    }>;
  };
}

export interface GpsDistrictResult {
  districtName: string;
  stateName: string;
  postcode: string;
  matchedExisting?: DistrictMeta;
}

export class GpsDetectionError extends Error {
  reason: 'denied' | 'unavailable';
  constructor(reason: 'denied' | 'unavailable', message: string) {
    super(message);
    this.reason = reason;
  }
}

const CITY_ALIASES: Record<string, string> = {
  bangalore: 'Bengaluru',
  'bangalore urban': 'Bengaluru',
  'bengaluru urban': 'Bengaluru',
  'new delhi': 'Delhi',
  'central delhi': 'Delhi',
  'south delhi': 'Delhi',
  'north delhi': 'Delhi',
  'east delhi': 'Delhi',
  'west delhi': 'Delhi',
  'south west delhi': 'Delhi',
  'north west delhi': 'Delhi',
  'mumbai suburban': 'Mumbai',
  'mumbai city': 'Mumbai',
  bombay: 'Mumbai',
  madras: 'Chennai',
  pataliputra: 'Patna',
  motihari: 'East Champaran (Motihari)',
  'purbi champaran': 'East Champaran (Motihari)',
  'east champaran': 'East Champaran (Motihari)',
  bhabua: 'Kaimur (Bhabua)',
  kaimur: 'Kaimur (Bhabua)',
  chhapra: 'Saran (Chhapra)',
  chapra: 'Saran (Chhapra)',
  saran: 'Saran (Chhapra)',
  bettiah: 'West Champaran (Bettiah)',
  'pashchim champaran': 'West Champaran (Bettiah)',
  'west champaran': 'West Champaran (Bettiah)',
  arrah: 'Bhojpur',
  ara: 'Bhojpur',
  sasaram: 'Rohtas',
  'bihar sharif': 'Nalanda',
  biharsharif: 'Nalanda',
  rajgir: 'Nalanda',
  hajipur: 'Vaishali',
  purnea: 'Purnia',
  monghyr: 'Munger',
  laheriasarai: 'Darbhanga',
  bodhgaya: 'Gaya',
  'bodh gaya': 'Gaya',
  forbesganj: 'Araria',
  barauni: 'Begusarai',
  jhanjharpur: 'Madhubani',
  dumraon: 'Buxar',
  jhajha: 'Jamui',
};

export function cleanIndianDistrictName(raw: string): string {
  return raw
    .replace(
      /\s+(district|city|tehsil|taluka|subdivision|division|municipal corporation|metropolitan region)$/i,
      ''
    )
    .trim();
}

export function resolveDistrictMatch(
  detectedName: string,
  districts: DistrictMeta[]
): DistrictMeta | undefined {
  const cleaned = cleanIndianDistrictName(detectedName);
  if (!cleaned) return undefined;
  const lower = cleaned.toLowerCase();

  const direct = districts.find((d) => d.id.toLowerCase() === lower);
  if (direct) return direct;

  const aliasTarget = CITY_ALIASES[lower];
  if (aliasTarget) {
    const aliasMatch = districts.find(
      (d) => d.id.toLowerCase() === aliasTarget.toLowerCase()
    );
    if (aliasMatch) return aliasMatch;
  }

  return districts.find((d) => {
    const idLower = d.id.toLowerCase();
    const baseLower = idLower.replace(/\s*\([^)]*\)/g, '').trim();
    return (
      lower.includes(baseLower) ||
      baseLower.includes(lower) ||
      idLower.includes(lower)
    );
  });
}

function requestBrowserPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export async function detectCurrentIndianDistrict(
  districts: DistrictMeta[]
): Promise<GpsDistrictResult> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    throw new GpsDetectionError('unavailable', 'Geolocation not supported');
  }

  let position: GeolocationPosition;
  try {
    position = await requestBrowserPosition({
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 60000,
    });
  } catch (err) {
    const geoErr = err as GeolocationPositionError | undefined;
    if (geoErr && geoErr.code === 1) {
      throw new GpsDetectionError('denied', 'Location permission denied');
    }
    try {
      position = await requestBrowserPosition({
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 120000,
      });
    } catch (fallbackErr) {
      const fb = fallbackErr as GeolocationPositionError | undefined;
      throw new GpsDetectionError(
        fb && fb.code === 1 ? 'denied' : 'unavailable',
        'Location unavailable'
      );
    }
  }

  const lat = position.coords.latitude;
  const lon = position.coords.longitude;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);

  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
      String(lat)
    )}&longitude=${encodeURIComponent(String(lon))}&localityLanguage=en`;

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new GpsDetectionError('unavailable', 'Reverse geocoding failed');
    }

    const data = (await res.json()) as BigDataCloudResponse;
    const adminDistrict =
      data.localityInfo?.administrative?.find(
        (a) =>
          (a.adminLevel === 5 || a.adminLevel === 6) &&
          typeof a.name === 'string' &&
          a.name.trim().length > 0
      )?.name || '';

    const rawCandidate =
      data.city || data.locality || adminDistrict || data.principalSubdivision || '';
    const districtName = cleanIndianDistrictName(rawCandidate);

    if (!districtName) {
      throw new GpsDetectionError('unavailable', 'Could not determine district name');
    }

    const stateName = cleanIndianDistrictName(data.principalSubdivision || 'India') || 'India';
    const matchedExisting =
      resolveDistrictMatch(districtName, districts) ||
      (adminDistrict ? resolveDistrictMatch(adminDistrict, districts) : undefined);

    return {
      districtName: matchedExisting ? matchedExisting.id : districtName,
      stateName: matchedExisting ? matchedExisting.state : stateName,
      postcode: data.postcode || 'IN',
      matchedExisting,
    };
  } catch (err) {
    if (err instanceof GpsDetectionError) throw err;
    throw new GpsDetectionError('unavailable', 'Reverse geocoding unavailable');
  } finally {
    window.clearTimeout(timer);
  }
}
