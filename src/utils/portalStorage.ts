import muzaffarpurBridgeImg from '../assets/images/reel_muzaffarpur_bridge_1795283609462.jpg';
import muzaffarpurOrchardImg from '../assets/images/news_muzaffarpur_orchard_1795289274953.jpg';
import {
  AdNetworkConfig,
  LiveTvChannel,
  LocalAd,
  NewsReel,
  PayoutRequest,
  PendingTvChannelSubmission,
  PortalSession,
  ReporterAccount,
  SubmittedStory,
} from '../types';

const STORAGE_KEYS = {
  REPORTERS: 'khabarnama_portal_reporters_v1',
  SUBMISSIONS: 'khabarnama_portal_submissions_v1',
  APPROVED_REELS: 'khabarnama_portal_approved_reels_v1',
  LIVE_CITIZEN_REELS: 'khabarnama_live_citizen_reels_v1',
  LIVE_TV_CHANNELS: 'khabarnama_live_tv_channels_v1',
  PENDING_TV_CHANNELS: 'khabarnama_pending_tv_channels_v1',
  LOCAL_ADS: 'khabarnama_local_ads_v1',
  AD_NETWORK_CONFIG: 'khabarnama_ad_network_config_v1',
  DEFAULT_NEWS_RATE: 'khabarnama_default_news_rate_v1',
  PAYOUT_REQUESTS: 'khabarnama_payout_requests_v1',
  DELETED_IDS: 'khabarnama_portal_deleted_ids_v1',
  BREAKING_OVERRIDES: 'khabarnama_portal_breaking_overrides_v1',
  SESSION: 'khabarnama_portal_session_v1',
  SELECTED_DISTRICT: 'khabarnama_selected_district_v1',
} as const;

export const EARNINGS_PER_APPROVED_REEL = 50;
export const DEFAULT_PER_NEWS_RATE = 50;

export const REPORTER_BROLL_CLIPS = [
  {
    id: 'broll-muz-bridge',
    label: 'Muzaffarpur Bridge',
    imageUrl: '/src/assets/images/reel_muzaffarpur_bridge_1795283609462.jpg',
    videoUrl: '/videos/reel_muzaffarpur.mp4',
  },
  {
    id: 'broll-muz-orchard',
    label: 'Muzaffarpur Orchard',
    imageUrl: '/src/assets/images/news_muzaffarpur_orchard_1795289274953.jpg',
    videoUrl: '/videos/reel_muzaffarpur_orchard.mp4',
  },
  {
    id: 'broll-pat-metro',
    label: 'Patna Metro Corridor',
    imageUrl: '/src/assets/images/reel_patna_metro_1795283609144.jpg',
    videoUrl: '/videos/reel_patna.mp4',
  },
  {
    id: 'broll-pat-river',
    label: 'Patna Ganga Marine Drive',
    imageUrl: '/src/assets/images/news_patna_riverfront_1795289274314.jpg',
    videoUrl: '/videos/reel_patna_riverfront.mp4',
  },
  {
    id: 'broll-blr-metro',
    label: 'Urban Transit Hub',
    imageUrl: '/src/assets/images/news_bengaluru_metro_1795289274541.jpg',
    videoUrl: '/videos/reel_bengaluru_metro.mp4',
  },
  {
    id: 'broll-mum-ebus',
    label: 'City Roadway Dispatch',
    imageUrl: '/src/assets/images/news_mumbai_ebus_1795289274352.jpg',
    videoUrl: '/videos/reel_mumbai_ebus.mp4',
  },
] as const;

export function deriveReporterName3(fullName: string): string {
  return fullName.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
}

export function deriveDistrictCode3(districtName: string): string {
  return districtName.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
}

export const DEFAULT_REPORTERS: ReporterAccount[] = [
  {
    id: 'REP-RAH1998',
    name: 'Rahul Thakur',
    name3: 'RAH',
    birthYear: '1998',
    district3: 'MUZ',
    district: 'Muzaffarpur',
    status: 'active',
    createdAt: '2026-10-12T08:30:00.000Z',
    approvedCount: 3,
  },
  {
    id: 'REP-PRI2000',
    name: 'Priya Verma',
    name3: 'PRI',
    birthYear: '2000',
    district3: 'PAT',
    district: 'Patna',
    status: 'active',
    createdAt: '2026-10-15T09:15:00.000Z',
    approvedCount: 4,
  },
  {
    id: 'REP-SAU1995',
    name: 'Saurabh Mishra',
    name3: 'SAU',
    birthYear: '1995',
    district3: 'DAR',
    district: 'Darbhanga',
    status: 'active',
    createdAt: '2026-10-20T10:00:00.000Z',
    approvedCount: 2,
  },
  {
    id: 'REP-NEH1999',
    name: 'Neha Sinha',
    name3: 'NEH',
    birthYear: '1999',
    district3: 'GAY',
    district: 'Gaya',
    status: 'pending',
    createdAt: '2026-11-20T14:20:00.000Z',
    approvedCount: 0,
  },
];

export const DEFAULT_SUBMISSIONS: SubmittedStory[] = [
  {
    id: 'sub-demo-muz-01',
    reporterId: 'REP-RAH1998',
    reporterName: 'Rahul Thakur',
    district: 'Muzaffarpur',
    ward: 'Motijheel · Ward 12',
    category: 'Administration',
    headline: 'मुज़फ़्फ़रपुर नगर निगम ने मोतीझील बाजार में रात की सफाई व नई स्ट्रीट लाइट अभियान शुरू किया',
    script:
      'नमस्कार, मुज़फ़्फ़रपुर के मोतीझील और कल्याणी चौक इलाके से बड़ी प्रशासनिक खबर। नगर निगम की विशेष टीम ने व्यापारियों के साथ बैठक के बाद रात दस बजे के बाद नियमित कचरा उठाव और बयालीस नई एलईडी स्ट्रीट लाइटें लगाने का काम शुरू कर दिया है। दुकानदारों ने बताया कि शाम के समय रोशनी बढ़ने से ग्राहकों की आवाजाही सुरक्षित हुई है।',
    imageUrl: '/src/assets/images/reel_muzaffarpur_bridge_1795283609462.jpg',
    videoUrl: '/videos/reel_muzaffarpur.mp4',
    hasOriginalAudio: false,
    status: 'pending',
    isBreaking: true,
    submittedAt: '2026-11-22T06:50:00.000Z',
  },
];

function safeReadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadPortalReporters(): ReporterAccount[] {
  const stored = safeReadJson<Array<Partial<ReporterAccount> & { pin?: string }> | null>(
    STORAGE_KEYS.REPORTERS,
    null
  );
  if (Array.isArray(stored) && stored.length > 0) {
    let migrated = false;
    const normalized: ReporterAccount[] = stored.map((r, idx) => {
      if (r.id === 'REP-MUZ' || (!r.birthYear && r.district === 'Muzaffarpur')) {
        migrated = true;
        return {
          ...DEFAULT_REPORTERS[0],
          approvedCount: typeof r.approvedCount === 'number' ? r.approvedCount : 3,
          status: r.status || 'active',
        };
      }
      if (r.id === 'REP-PAT' || (!r.birthYear && r.district === 'Patna')) {
        migrated = true;
        return {
          ...DEFAULT_REPORTERS[1],
          approvedCount: typeof r.approvedCount === 'number' ? r.approvedCount : 4,
          status: r.status || 'active',
        };
      }
      const cleanName =
        typeof r.name === 'string' && r.name.trim() ? r.name.trim() : `Reporter ${idx + 1}`;
      const derivedName3 =
        typeof r.name3 === 'string' && /^[A-Z]{3}$/.test(r.name3.trim().toUpperCase())
          ? r.name3.trim().toUpperCase()
          : deriveReporterName3(cleanName).padEnd(3, 'X');
      const cleanYear =
        typeof r.birthYear === 'string' && /^\d{4}$/.test(r.birthYear.trim())
          ? r.birthYear.trim()
          : '1995';
      const cleanDistrict = r.district || 'Muzaffarpur';
      const derivedDist3 =
        typeof r.district3 === 'string' && /^[A-Z]{3}$/.test(r.district3.trim().toUpperCase())
          ? r.district3.trim().toUpperCase()
          : deriveDistrictCode3(String(cleanDistrict)).padEnd(3, 'X');
      if (r.pin !== undefined || !r.name3 || !r.birthYear || !r.district3) {
        migrated = true;
      }
      return {
        id: r.id || `REP-${derivedName3}${cleanYear}`,
        name: cleanName,
        name3: derivedName3,
        birthYear: cleanYear,
        district3: derivedDist3,
        district: cleanDistrict,
        status: r.status || 'pending',
        createdAt: r.createdAt || new Date().toISOString(),
        approvedCount: typeof r.approvedCount === 'number' ? r.approvedCount : 0,
        ...(typeof r.perNewsRate === 'number' && Number.isFinite(r.perNewsRate) && r.perNewsRate >= 0
          ? { perNewsRate: Math.round(r.perNewsRate) }
          : {}),
      };
    });
    if (migrated) {
      safeWriteJson(STORAGE_KEYS.REPORTERS, normalized);
    }
    return normalized;
  }
  safeWriteJson(STORAGE_KEYS.REPORTERS, DEFAULT_REPORTERS);
  return DEFAULT_REPORTERS;
}

export function savePortalReporters(reporters: ReporterAccount[]): boolean {
  const sanitized: ReporterAccount[] = reporters.map((r) => ({
    id: r.id,
    name: r.name,
    name3: r.name3,
    birthYear: r.birthYear,
    district3: r.district3 || deriveDistrictCode3(String(r.district)),
    district: r.district,
    status: r.status,
    createdAt: r.createdAt,
    approvedCount: r.approvedCount,
    ...(typeof r.perNewsRate === 'number' && Number.isFinite(r.perNewsRate) && r.perNewsRate >= 0
      ? { perNewsRate: Math.round(r.perNewsRate) }
      : {}),
  }));
  return safeWriteJson(STORAGE_KEYS.REPORTERS, sanitized);
}

export function loadPortalSubmissions(): SubmittedStory[] {
  const stored = safeReadJson<SubmittedStory[] | null>(STORAGE_KEYS.SUBMISSIONS, null);
  if (Array.isArray(stored)) return stored;
  safeWriteJson(STORAGE_KEYS.SUBMISSIONS, DEFAULT_SUBMISSIONS);
  return DEFAULT_SUBMISSIONS;
}

export function savePortalSubmissions(submissions: SubmittedStory[]): boolean {
  return safeWriteJson(STORAGE_KEYS.SUBMISSIONS, submissions);
}

export function loadApprovedPortalReels(): NewsReel[] {
  const stored = safeReadJson<NewsReel[] | null>(STORAGE_KEYS.APPROVED_REELS, null);
  if (!Array.isArray(stored)) return [];
  // Drop stale blob: URLs that cannot survive page reloads, falling back to B-roll poster/clip
  return stored.map((r) => {
    const hasDeadBlob = r.videoUrl?.startsWith('blob:');
    const fallbackVideo = hasDeadBlob ? '/videos/reel_muzaffarpur.mp4' : r.videoUrl;
    const cleanClips = r.videoClips?.map((c) =>
      c.url.startsWith('blob:') ? { ...c, url: '/videos/reel_muzaffarpur.mp4' } : c
    );
    return {
      ...r,
      videoUrl: fallbackVideo,
      videoClips: cleanClips,
    };
  });
}

export function saveApprovedPortalReels(reels: NewsReel[]): boolean {
  return safeWriteJson(STORAGE_KEYS.APPROVED_REELS, reels);
}

export function loadDeletedReelIds(): string[] {
  const stored = safeReadJson<string[] | null>(STORAGE_KEYS.DELETED_IDS, null);
  return Array.isArray(stored) ? stored : [];
}

export function saveDeletedReelIds(ids: string[]): boolean {
  return safeWriteJson(STORAGE_KEYS.DELETED_IDS, ids);
}

export function loadBreakingOverrides(): Record<string, boolean> {
  const stored = safeReadJson<Record<string, boolean> | null>(STORAGE_KEYS.BREAKING_OVERRIDES, null);
  return stored && typeof stored === 'object' ? stored : {};
}

export function saveBreakingOverrides(overrides: Record<string, boolean>): boolean {
  return safeWriteJson(STORAGE_KEYS.BREAKING_OVERRIDES, overrides);
}

export function loadPortalSession(): PortalSession {
  const stored = safeReadJson<PortalSession>(STORAGE_KEYS.SESSION, null);
  // Admin sessions must remain strictly in memory with a valid server Bearer token
  if (stored?.role === 'admin') {
    safeWriteJson(STORAGE_KEYS.SESSION, null);
    return null;
  }
  return stored;
}

export function savePortalSession(session: PortalSession): boolean {
  if (session?.role === 'admin') {
    return safeWriteJson(STORAGE_KEYS.SESSION, null);
  }
  return safeWriteJson(STORAGE_KEYS.SESSION, session);
}

export function hasStoredSelectedDistrict(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const val = window.localStorage.getItem(STORAGE_KEYS.SELECTED_DISTRICT);
    return Boolean(val && val.trim().length > 0);
  } catch {
    return false;
  }
}

export function loadSelectedDistrict(): string {
  if (typeof window === 'undefined') return 'Muzaffarpur';
  try {
    const val = window.localStorage.getItem(STORAGE_KEYS.SELECTED_DISTRICT);
    return val && val.trim().length > 0 ? val.trim() : 'Muzaffarpur';
  } catch {
    return 'Muzaffarpur';
  }
}

export function saveSelectedDistrict(district: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEYS.SELECTED_DISTRICT, district);
    return true;
  } catch {
    return false;
  }
}

export function loadLiveCitizenReels(): NewsReel[] {
  const stored = safeReadJson<NewsReel[] | null>(STORAGE_KEYS.LIVE_CITIZEN_REELS, null);
  if (!Array.isArray(stored)) return [];
  return stored.map((r) => {
    const hasDeadBlob = r.videoUrl?.startsWith('blob:');
    const fallbackVideo = hasDeadBlob ? '/videos/reel_muzaffarpur.mp4' : r.videoUrl;
    const cleanClips = r.videoClips?.map((c) =>
      c.url.startsWith('blob:') ? { ...c, url: '/videos/reel_muzaffarpur.mp4' } : c
    );
    return {
      ...r,
      videoUrl: fallbackVideo,
      videoClips: cleanClips,
    };
  });
}

export function saveLiveCitizenReels(reels: NewsReel[]): boolean {
  return safeWriteJson(STORAGE_KEYS.LIVE_CITIZEN_REELS, reels);
}

export function loadLiveTvChannels(): LiveTvChannel[] {
  const stored = safeReadJson<LiveTvChannel[] | null>(STORAGE_KEYS.LIVE_TV_CHANNELS, null);
  return Array.isArray(stored) ? stored : [];
}

export function saveLiveTvChannels(channels: LiveTvChannel[]): boolean {
  return safeWriteJson(STORAGE_KEYS.LIVE_TV_CHANNELS, channels);
}

export function loadPendingTvChannels(): PendingTvChannelSubmission[] {
  const stored = safeReadJson<PendingTvChannelSubmission[] | null>(
    STORAGE_KEYS.PENDING_TV_CHANNELS,
    null
  );
  return Array.isArray(stored) ? stored : [];
}

export function savePendingTvChannels(submissions: PendingTvChannelSubmission[]): boolean {
  return safeWriteJson(STORAGE_KEYS.PENDING_TV_CHANNELS, submissions);
}

export const DEFAULT_LOCAL_ADS: LocalAd[] = [
  {
    id: 'ad-muz-apex-reel',
    district: 'Muzaffarpur',
    format: 'reel',
    businessName: 'Apex Coaching Muzaffarpur',
    tagline: 'JEE, NEET & Bihar Board Foundation Batches · 25% Scholarship Test Open',
    mediaUrl: muzaffarpurOrchardImg,
    mediaType: 'image',
    phone: '+919835011223',
    whatsapp: '919835011223',
    active: true,
    impressions: 124,
    clicks: 18,
    createdAt: '2026-11-20T09:00:00.000Z',
  },
  {
    id: 'ad-muz-tirhut-banner',
    district: 'Muzaffarpur',
    format: 'banner',
    businessName: 'Tirhut Diagnostics & Polyclinic',
    tagline: 'Full Body Checkup ₹499 · Motijheel Chowk, Muzaffarpur',
    mediaUrl: muzaffarpurBridgeImg,
    mediaType: 'image',
    phone: '+919431022445',
    whatsapp: '919431022445',
    active: true,
    impressions: 310,
    clicks: 42,
    createdAt: '2026-11-20T09:30:00.000Z',
  },
];

export const DEFAULT_AD_NETWORK_CONFIG: AdNetworkConfig = {
  enabled: false,
  adsensePublisherId: '',
  adsenseBannerSlotId: '',
  admobUnitId: '',
};

export function loadLocalAds(): LocalAd[] {
  const stored = safeReadJson<LocalAd[] | null>(STORAGE_KEYS.LOCAL_ADS, null);
  if (Array.isArray(stored)) return stored;
  safeWriteJson(STORAGE_KEYS.LOCAL_ADS, DEFAULT_LOCAL_ADS);
  return DEFAULT_LOCAL_ADS;
}

export function saveLocalAds(ads: LocalAd[]): boolean {
  return safeWriteJson(STORAGE_KEYS.LOCAL_ADS, ads);
}

export function loadAdNetworkConfig(): AdNetworkConfig {
  const stored = safeReadJson<Partial<AdNetworkConfig> | null>(
    STORAGE_KEYS.AD_NETWORK_CONFIG,
    null
  );
  if (stored && typeof stored === 'object') {
    return {
      enabled: Boolean(stored.enabled),
      adsensePublisherId:
        typeof stored.adsensePublisherId === 'string' ? stored.adsensePublisherId : '',
      adsenseBannerSlotId:
        typeof stored.adsenseBannerSlotId === 'string' ? stored.adsenseBannerSlotId : '',
      admobUnitId: typeof stored.admobUnitId === 'string' ? stored.admobUnitId : '',
      updatedAt: stored.updatedAt,
    };
  }
  return DEFAULT_AD_NETWORK_CONFIG;
}

export function saveAdNetworkConfig(config: AdNetworkConfig): boolean {
  return safeWriteJson(STORAGE_KEYS.AD_NETWORK_CONFIG, config);
}

export function loadDefaultNewsRate(): number {
  const stored = safeReadJson<unknown>(STORAGE_KEYS.DEFAULT_NEWS_RATE, DEFAULT_PER_NEWS_RATE);
  if (typeof stored === 'number' && Number.isFinite(stored) && stored >= 0) {
    return Math.round(stored);
  }
  return DEFAULT_PER_NEWS_RATE;
}

export function saveDefaultNewsRate(rate: number): boolean {
  const clean = Number.isFinite(rate) && rate >= 0 ? Math.round(rate) : DEFAULT_PER_NEWS_RATE;
  return safeWriteJson(STORAGE_KEYS.DEFAULT_NEWS_RATE, clean);
}

export function loadPayoutRequests(): PayoutRequest[] {
  const stored = safeReadJson<PayoutRequest[] | null>(STORAGE_KEYS.PAYOUT_REQUESTS, null);
  return Array.isArray(stored) ? stored : [];
}

export function savePayoutRequests(requests: PayoutRequest[]): boolean {
  return safeWriteJson(STORAGE_KEYS.PAYOUT_REQUESTS, requests);
}

export function getEffectiveReporterRate(
  reporter: Pick<ReporterAccount, 'perNewsRate'> | undefined | null,
  defaultNewsRate: number
): number {
  if (
    reporter &&
    typeof reporter.perNewsRate === 'number' &&
    Number.isFinite(reporter.perNewsRate) &&
    reporter.perNewsRate >= 0
  ) {
    return Math.round(reporter.perNewsRate);
  }
  return Number.isFinite(defaultNewsRate) && defaultNewsRate >= 0
    ? Math.round(defaultNewsRate)
    : DEFAULT_PER_NEWS_RATE;
}

export interface ReporterWalletSummary {
  activeRate: number;
  hasCustomRate: boolean;
  approvedStoriesCount: number;
  totalEarned: number;
  totalPaid: number;
  pendingPayoutAmount: number;
  availableBalance: number;
  withdrawableBalance: number;
}

export function calculateReporterWallet(
  reporter: ReporterAccount | undefined | null,
  submissions: SubmittedStory[],
  payoutRequests: PayoutRequest[],
  defaultNewsRate: number
): ReporterWalletSummary {
  const activeRate = getEffectiveReporterRate(reporter, defaultNewsRate);
  const hasCustomRate = Boolean(
    reporter &&
      typeof reporter.perNewsRate === 'number' &&
      Number.isFinite(reporter.perNewsRate) &&
      reporter.perNewsRate >= 0
  );

  if (!reporter) {
    return {
      activeRate,
      hasCustomRate: false,
      approvedStoriesCount: 0,
      totalEarned: 0,
      totalPaid: 0,
      pendingPayoutAmount: 0,
      availableBalance: 0,
      withdrawableBalance: 0,
    };
  }

  const targetId = reporter.id.toLowerCase();
  const approvedSubs = submissions.filter(
    (s) => s.reporterId.toLowerCase() === targetId && s.status === 'approved'
  );
  const approvedSubEarnings = approvedSubs.reduce((sum, s) => {
    const amt =
      typeof s.earnedAmount === 'number' && Number.isFinite(s.earnedAmount) && s.earnedAmount >= 0
        ? Math.round(s.earnedAmount)
        : activeRate;
    return sum + amt;
  }, 0);

  // Include legacy/seeded approvedCount stories that predate submission records
  const extraSeedApproved = Math.max(0, reporter.approvedCount - approvedSubs.length);
  const totalEarned = approvedSubEarnings + extraSeedApproved * activeRate;
  const approvedStoriesCount = Math.max(reporter.approvedCount, approvedSubs.length);

  const reporterPayouts = payoutRequests.filter(
    (p) => p.reporterId.toLowerCase() === targetId
  );
  const totalPaid = reporterPayouts
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Math.max(0, Math.round(p.amount)), 0);
  const pendingPayoutAmount = reporterPayouts
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + Math.max(0, Math.round(p.amount)), 0);

  const availableBalance = Math.max(0, totalEarned - totalPaid);
  const withdrawableBalance = Math.max(0, availableBalance - pendingPayoutAmount);

  return {
    activeRate,
    hasCustomRate,
    approvedStoriesCount,
    totalEarned,
    totalPaid,
    pendingPayoutAmount,
    availableBalance,
    withdrawableBalance,
  };
}

