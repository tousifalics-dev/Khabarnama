export type LanguageCode = 'hi' | 'bho' | 'en' | 'mr' | 'ta' | 'bn';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  speechLang: string;
  shortCode: string;
}

export type DistrictId =
  | 'All'
  | 'Muzaffarpur'
  | 'Patna'
  | 'Darbhanga'
  | 'Gaya'
  | 'Delhi'
  | 'Mumbai'
  | 'Bengaluru'
  | 'Chennai'
  | (string & {});

export interface SubtitleCue {
  id: string;
  startSec: number;
  endSec: number;
  text: Record<LanguageCode, string>;
}

export interface SourceVerification {
  dispatchId: string;
  agency: string;
  fieldCorrespondent: string;
  verifiedAt: string;
  coordinates: string;
  corroboratedBy: string[];
  factCheckSummary: Record<LanguageCode, string>;
}

export interface VideoClipItem {
  url: string;
  camTag: string;
}

export type AudioSourceMode = 'ai' | 'video';

export type NewsCategoryFilter =
  | 'All'
  | 'Breaking'
  | 'Crime'
  | 'Weather'
  | 'Education'
  | 'Administration'
  | 'Infrastructure'
  | 'Citizen Dispatch';

export type NewsScope = 'local' | 'national' | 'international';
export type ReelScopeFilter = 'mix' | 'local' | 'national' | 'international';

export interface NewsReel {
  id: string;
  scope?: NewsScope;
  district: Exclude<DistrictId, 'All'>;
  state: string;
  wardOrZone: string;
  category:
    | 'Breaking'
    | 'Crime'
    | 'Administration'
    | 'Weather'
    | 'Education'
    | 'Infrastructure'
    | 'Transit'
    | 'Weather & Civic'
    | 'Environment'
    | 'Clean Energy'
    | 'Citizen Dispatch';
  isBreaking: boolean;
  isLiveFeed?: boolean;
  isVerifiedReporter?: boolean;
  submittedByReporterId?: string;
  sourceName?: string;
  sourceUrl?: string;
  publishedAgo: string;
  imageUrl: string;
  externalVideoUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  videoClips?: VideoClipItem[];
  hasOriginalAudio?: boolean;
  fallbackGradient: string;
  likes: number;
  shares: number;
  isCitizenSubmitted?: boolean;
  reporterHandle: string;
  headline: Record<LanguageCode, string>;
  caption: Record<LanguageCode, string>;
  ticker: Record<LanguageCode, string>;
  subtitles: SubtitleCue[];
  verification: SourceVerification;
}

export interface DistrictMeta {
  id: Exclude<DistrictId, 'All'>;
  state: string;
  hindiName?: string;
  group?: 'bihar' | 'metro' | 'detected';
  pinPrefix: string;
  activeDesks: number;
  topBeat: string;
  summary: Record<LanguageCode, string>;
}

export type NavTab = 'feed' | 'explore' | 'livetv' | 'report' | 'profile' | 'portal';

export type GeminiTtsVoice = 'Kore' | 'Puck' | 'Charon' | 'Aoede' | 'Fenrir' | 'Zephyr';

export type GeminiTtsStatus =
  | 'idle'
  | 'generating'
  | 'playing'
  | 'awaiting_gesture'
  | 'quota_limit'
  | 'error';

export interface VoiceEngineConfig {
  geminiVoice: GeminiTtsVoice;
}

export type ReporterStatus = 'active' | 'pending' | 'suspended';
export type SubmittedStoryStatus = 'pending' | 'approved' | 'rejected';

export interface ReporterAccount {
  id: string;
  name: string;
  name3: string;
  birthYear: string;
  district3: string;
  district: Exclude<DistrictId, 'All'>;
  status: ReporterStatus;
  createdAt: string;
  approvedCount: number;
  perNewsRate?: number;
}

export interface SubmittedStory {
  id: string;
  reporterId: string;
  reporterName: string;
  district: Exclude<DistrictId, 'All'>;
  scope?: NewsScope;
  ward: string;
  category: NewsReel['category'];
  headline: string;
  script: string;
  imageUrl: string;
  videoUrl?: string;
  hasOriginalAudio: boolean;
  status: SubmittedStoryStatus;
  rejectionReason?: string;
  factChecked?: boolean;
  isBreaking?: boolean;
  earnedAmount?: number;
  submittedAt: string;
  reviewedAt?: string;
  publishedReelId?: string;
}

export type PayoutStatus = 'pending' | 'paid';

export interface PayoutRequest {
  id: string;
  reporterId: string;
  reporterName: string;
  district: string;
  upiId: string;
  amount: number;
  status: PayoutStatus;
  requestedAt: string;
  paidAt?: string;
}

export type PortalSession =
  | { role: 'reporter'; reporterId: string }
  | { role: 'admin'; adminId: string }
  | null;

export interface AdminAuthStatus {
  configured: boolean;
  envOverride: boolean;
  lockedUntilMs: number;
  failedAttempts: number;
  maxAttempts: number;
}

export type LiveTvCategory = 'local' | 'national' | 'international';
export type LiveTvStreamType = 'hls' | 'youtube';

export interface LiveTvChannel {
  id: string;
  name: string;
  category: LiveTvCategory;
  district?: string;
  type?: LiveTvStreamType;
  regionLabel: string;
  languageLabel: string;
  youtubeChannelId?: string;
  streamUrl: string;
  backupStreamUrl?: string;
  backupType?: LiveTvStreamType;
  watchUrl: string;
  isCustom?: boolean;
  addedAt?: string;
}

export interface PendingTvChannelSubmission {
  id: string;
  name: string;
  district: string;
  category: LiveTvCategory;
  type: LiveTvStreamType;
  regionLabel: string;
  languageLabel: string;
  youtubeChannelId?: string;
  streamUrl: string;
  backupStreamUrl?: string;
  backupType?: LiveTvStreamType;
  watchUrl: string;
  reporterId: string;
  reporterName: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
}

export type AdFormat = 'banner' | 'reel';

export interface LocalAd {
  id: string;
  district: string;
  format: AdFormat;
  businessName: string;
  tagline: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  phone: string;
  whatsapp: string;
  active: boolean;
  impressions: number;
  clicks: number;
  createdAt: string;
}

export interface AdNetworkConfig {
  enabled: boolean;
  adsensePublisherId: string;
  adsenseBannerSlotId: string;
  admobUnitId: string;
  updatedAt?: string;
}

export interface CloudAudioConfig {
  cloudName: string;
  uploadPreset: string;
  geminiServerConfigured?: boolean;
  updatedAt?: string;
}
