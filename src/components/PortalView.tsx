import {
  AlertCircle,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Film,
  IndianRupee,
  KeyRound,
  Lock,
  LogOut,
  MapPin,
  Megaphone,
  MessageCircle,
  Pause,
  Pencil,
  Phone,
  Play,
  PlusCircle,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Square,
  Trash2,
  Tv,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  Video,
  Volume2,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import Hls from 'hls.js';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { inferLiveTvStreamType, resolveLiveTvStreamSource } from '../data/liveTvChannels';
import { estimateNarrationDurationSec } from '../data/newsReels';
import {
  AdFormat,
  AdNetworkConfig,
  AdminAuthStatus,
  DistrictId,
  DistrictMeta,
  LiveTvCategory,
  LiveTvChannel,
  LiveTvStreamType,
  LocalAd,
  NewsReel,
  NewsScope,
  PayoutRequest,
  PendingTvChannelSubmission,
  PortalSession,
  ReporterAccount,
  ReporterStatus,
  SubmittedStory,
} from '../types';
import {
  REPORTER_BROLL_CLIPS,
  calculateReporterWallet,
  deriveDistrictCode3,
  deriveReporterName3,
  getEffectiveReporterRate,
} from '../utils/portalStorage';

interface PortalViewProps {
  districts: DistrictMeta[];
  reels: NewsReel[];
  session: PortalSession;
  adminAuthStatus: AdminAuthStatus | null;
  reporters: ReporterAccount[];
  submissions: SubmittedStory[];
  isTestingNarration: boolean;
  onLoginReporter: (districtLoginId: string, loginPassword: string) => { ok: boolean; error?: string };
  onRegisterReporter: (payload: {
    name: string;
    district: Exclude<DistrictId, 'All'>;
    birthYear: string;
  }) => { ok: boolean; error?: string; district3?: string; loginPassword?: string };
  onSetupAdmin: (
    adminId: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onLoginAdmin: (
    adminId: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onChangeAdminCredentials: (
    currentPassword: string,
    newAdminId: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string; adminId?: string }>;
  onRefreshAdminAuthStatus: () => Promise<void>;
  onLogout: () => void;
  onSubmitStory: (payload: {
    headline: string;
    script: string;
    category: NewsReel['category'];
    scope: NewsScope;
    ward: string;
    imageUrl: string;
    videoUrl?: string;
    hasOriginalAudio: boolean;
  }) => void;
  onApproveStory: (
    storyId: string,
    edits: { headline: string; script: string; isBreaking: boolean; scope: NewsScope }
  ) => void;
  onRejectStory: (storyId: string, reason: string) => void;
  onToggleReelBreaking: (reelId: string) => void;
  onDeleteReel: (reelId: string) => void;
  onPublishQuickReel?: (payload: {
    scope: NewsScope;
    district: string;
    category: NewsReel['category'];
    ward: string;
    headline: string;
    script: string;
    isBreaking: boolean;
  }) => void;
  onUpdateReporterStatus: (reporterId: string, status: ReporterStatus) => void;
  onPreviewSpeech: (text: string) => void;
  onStopPreviewSpeech: () => void;
  onWatchDistrictFeed: (district: DistrictId) => void;
  liveTvChannels: LiveTvChannel[];
  pendingTvSubmissions: PendingTvChannelSubmission[];
  onSubmitTvChannel: (payload: {
    name: string;
    category: LiveTvCategory;
    district: string;
    type?: LiveTvStreamType;
    youtubeChannelId?: string;
    streamUrl: string;
    backupStreamUrl?: string;
    backupType?: LiveTvStreamType;
    watchUrl: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onApproveTvSubmission: (sub: PendingTvChannelSubmission) => Promise<void>;
  onRejectTvSubmission: (subId: string) => Promise<void>;
  onAddLiveTvChannel: (payload: {
    name: string;
    category: LiveTvCategory;
    district?: string;
    type?: LiveTvStreamType;
    youtubeChannelId?: string;
    streamUrl: string;
    backupStreamUrl?: string;
    backupType?: LiveTvStreamType;
    watchUrl: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onDeleteLiveTvChannel: (channelId: string, district?: string) => Promise<void>;
  localAds: LocalAd[];
  adNetworkConfig: AdNetworkConfig;
  onAddLocalAd: (payload: {
    district: string;
    format: AdFormat;
    businessName: string;
    tagline: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    phone: string;
    whatsapp: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onToggleLocalAd: (ad: LocalAd) => Promise<void>;
  onDeleteLocalAd: (ad: LocalAd) => Promise<void>;
  onSaveAdNetworkConfig: (config: AdNetworkConfig) => Promise<{ ok: boolean; error?: string }>;
  defaultNewsRate: number;
  payoutRequests: PayoutRequest[];
  onSaveDefaultNewsRate: (rate: number) => Promise<{ ok: boolean; error?: string }>;
  onUpdateReporterRate: (
    reporterId: string,
    perNewsRate: number | null
  ) => Promise<{ ok: boolean; error?: string }>;
  onRequestUpiPayout: (payload: {
    reporterId: string;
    reporterName: string;
    district: string;
    upiId: string;
    amount: number;
  }) => Promise<{ ok: boolean; error?: string; payout?: PayoutRequest }>;
  onMarkPayoutPaid: (payoutId: string) => Promise<{ ok: boolean; error?: string }>;
}

const REPORTER_CATEGORIES: NewsReel['category'][] = [
  'Breaking',
  'Crime',
  'Administration',
  'Weather',
  'Education',
];

export function PortalView({
  districts,
  reels,
  session,
  adminAuthStatus,
  reporters,
  submissions,
  isTestingNarration,
  onLoginReporter,
  onRegisterReporter,
  onSetupAdmin,
  onLoginAdmin,
  onChangeAdminCredentials,
  onRefreshAdminAuthStatus,
  onLogout,
  onSubmitStory,
  onApproveStory,
  onRejectStory,
  onToggleReelBreaking,
  onDeleteReel,
  onPublishQuickReel,
  onUpdateReporterStatus,
  onPreviewSpeech,
  onStopPreviewSpeech,
  onWatchDistrictFeed,
  liveTvChannels,
  pendingTvSubmissions,
  onSubmitTvChannel,
  onApproveTvSubmission,
  onRejectTvSubmission,
  onAddLiveTvChannel,
  onDeleteLiveTvChannel,
  localAds,
  adNetworkConfig,
  onAddLocalAd,
  onToggleLocalAd,
  onDeleteLocalAd,
  onSaveAdNetworkConfig,
  defaultNewsRate,
  payoutRequests,
  onSaveDefaultNewsRate,
  onUpdateReporterRate,
  onRequestUpiPayout,
  onMarkPayoutPaid,
}: PortalViewProps) {
  // Login / Register state
  const [loginRoleTab, setLoginRoleTab] = useState<'reporter' | 'admin'>('reporter');
  const [loginDistrictId, setLoginDistrictId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showReporterPassword, setShowReporterPassword] = useState(false);

  const [adminIdInput, setAdminIdInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState(0);

  // First-run owner Admin setup state (when no Admin credentials exist yet)
  const [setupAdminId, setSetupAdminId] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [showSetupPassword, setShowSetupPassword] = useState(false);
  const [showSetupConfirmPassword, setShowSetupConfirmPassword] = useState(false);

  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Registration form state (Full Name + District + Birth Year)
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [regName, setRegName] = useState('');
  const [regDistrict, setRegDistrict] = useState<Exclude<DistrictId, 'All'>>('Muzaffarpur');
  const [regBirthYear, setRegBirthYear] = useState('');

  // Reporter submission studio state
  const [headlineInput, setHeadlineInput] = useState('');
  const [scriptInput, setScriptInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<NewsReel['category']>('Breaking');
  const [storyScopeInput, setStoryScopeInput] = useState<NewsScope>('local');
  const [wardInput, setWardInput] = useState('Station Road · Ward 8');
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string>(
    REPORTER_BROLL_CLIPS[0].videoUrl
  );
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>(
    REPORTER_BROLL_CLIPS[0].imageUrl
  );
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [hasOriginalAudio, setHasOriginalAudio] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Reporter Local Cable / YouTube Live submission state
  const [repTvName, setRepTvName] = useState('');
  const [repTvStreamUrl, setRepTvStreamUrl] = useState('');
  const [repTvError, setRepTvError] = useState('');
  const [repTvSuccess, setRepTvSuccess] = useState('');
  const [isSubmittingRepTv, setIsSubmittingRepTv] = useState(false);

  // Admin dashboard state
  const [adminTab, setAdminTab] = useState<
    'pending' | 'live' | 'livetv' | 'ads' | 'reporters' | 'security'
  >('pending');
  const [liveDistrictFilter, setLiveDistrictFilter] = useState<DistrictId>('All');
  const [previewingStoryId, setPreviewingStoryId] = useState<string | null>(null);
  const [editMap, setEditMap] = useState<
    Record<
      string,
      {
        headline: string;
        script: string;
        factChecked: boolean;
        isBreaking: boolean;
        scope: NewsScope;
      }
    >
  >({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [adminActionToast, setAdminActionToast] = useState('');

  // Admin Quick Scope Reel publisher state
  const [quickScope, setQuickScope] = useState<NewsScope>('national');
  const [quickDistrict, setQuickDistrict] = useState<string>('Muzaffarpur');
  const [quickCategory, setQuickCategory] = useState<NewsReel['category']>('Breaking');
  const [quickWard, setQuickWard] = useState('India Desk');
  const [quickHeadline, setQuickHeadline] = useState('');
  const [quickScript, setQuickScript] = useState('');
  const [quickBreaking, setQuickBreaking] = useState(true);
  const [quickError, setQuickError] = useState('');

  // Admin Live TV Channel Manager + Dual-Engine Stream Tester state
  const [tvChannelName, setTvChannelName] = useState('');
  const [tvCategory, setTvCategory] = useState<LiveTvCategory>('local');
  const [tvTargetDistrict, setTvTargetDistrict] = useState<string>('ALL_BIHAR');
  const [tvStreamInput, setTvStreamInput] = useState('');
  const [tvBackupInput, setTvBackupInput] = useState('');
  const [tvFormError, setTvFormError] = useState('');
  const [tvFormSuccess, setTvFormSuccess] = useState('');
  const [isSavingTvChannel, setIsSavingTvChannel] = useState(false);
  const [isTestingTvStream, setIsTestingTvStream] = useState(false);
  const [tvTestStatus, setTvTestStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [tvTestError, setTvTestError] = useState('');
  const tvTestVideoRef = useRef<HTMLVideoElement | null>(null);
  const tvTestHlsRef = useRef<Hls | null>(null);

  // Admin Ads Manager state
  const [adDistrict, setAdDistrict] = useState<string>('Muzaffarpur');
  const [adFormat, setAdFormat] = useState<AdFormat>('banner');
  const [adBusinessName, setAdBusinessName] = useState('');
  const [adTagline, setAdTagline] = useState('');
  const [adMediaUrl, setAdMediaUrl] = useState('');
  const [adPhone, setAdPhone] = useState('');
  const [adWhatsapp, setAdWhatsapp] = useState('');
  const [adFormError, setAdFormError] = useState('');
  const [adFormSuccess, setAdFormSuccess] = useState('');
  const [isSavingLocalAd, setIsSavingLocalAd] = useState(false);

  const [adNetEnabled, setAdNetEnabled] = useState(adNetworkConfig.enabled);
  const [adsensePublisherId, setAdsensePublisherId] = useState(
    adNetworkConfig.adsensePublisherId
  );
  const [adsenseBannerSlotId, setAdsenseBannerSlotId] = useState(
    adNetworkConfig.adsenseBannerSlotId
  );
  const [admobUnitId, setAdmobUnitId] = useState(adNetworkConfig.admobUnitId);
  const [adNetError, setAdNetError] = useState('');
  const [adNetSuccess, setAdNetSuccess] = useState('');
  const [isSavingAdConfig, setIsSavingAdConfig] = useState(false);

  // Admin Security tab credential rotation state
  const [secCurrentPassword, setSecCurrentPassword] = useState('');
  const [secNewAdminId, setSecNewAdminId] = useState(
    session?.role === 'admin' ? session.adminId : ''
  );
  const [secNewPassword, setSecNewPassword] = useState('');
  const [secConfirmPassword, setSecConfirmPassword] = useState('');
  const [showSecCurrent, setShowSecCurrent] = useState(false);
  const [showSecNew, setShowSecNew] = useState(false);
  const [showSecConfirm, setShowSecConfirm] = useState(false);
  const [secError, setSecError] = useState('');
  const [secSuccess, setSecSuccess] = useState('');
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);

  // Reporter UPI payout withdrawal modal state
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawUpiInput, setWithdrawUpiInput] = useState('');
  const [withdrawAmountInput, setWithdrawAmountInput] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);

  // Admin Per-News Payout Rate & Settlement controls state
  const [defaultRateInput, setDefaultRateInput] = useState(String(defaultNewsRate));
  const [isSavingDefaultRate, setIsSavingDefaultRate] = useState(false);
  const [editingReporterId, setEditingReporterId] = useState<string | null>(null);
  const [editingRateValue, setEditingRateValue] = useState('');
  const [savingReporterRateId, setSavingReporterRateId] = useState<string | null>(null);
  const [markingPayoutId, setMarkingPayoutId] = useState<string | null>(null);

  const biharDistricts = useMemo(
    () =>
      districts
        .filter((d) => d.group === 'bihar' || (!d.group && d.state === 'Bihar'))
        .sort((a, b) => a.id.localeCompare(b.id)),
    [districts]
  );

  const metroDistricts = useMemo(
    () =>
      districts.filter(
        (d) => d.group === 'metro' || (!d.group && d.state !== 'Bihar' && d.group !== 'detected')
      ),
    [districts]
  );

  const activeReporter = useMemo(
    () =>
      session?.role === 'reporter'
        ? reporters.find((r) => r.id.toLowerCase() === session.reporterId.toLowerCase()) || null
        : null,
    [session, reporters]
  );

  const liveNarrationMetrics = useMemo(() => {
    const combined = [headlineInput.trim(), scriptInput.trim()].filter(Boolean).join('. ');
    return estimateNarrationDurationSec(combined);
  }, [headlineInput, scriptInput]);

  const pendingSubmissions = useMemo(
    () => submissions.filter((s) => s.status === 'pending'),
    [submissions]
  );

  const reporterSubmissions = useMemo(() => {
    if (!activeReporter) return [];
    return submissions.filter(
      (s) => s.reporterId.toLowerCase() === activeReporter.id.toLowerCase()
    );
  }, [activeReporter, submissions]);

  const filteredLiveReels = useMemo(() => {
    if (liveDistrictFilter === 'All') return reels;
    return reels.filter(
      (r) => r.district.toLowerCase() === String(liveDistrictFilter).toLowerCase()
    );
  }, [reels, liveDistrictFilter]);

  useEffect(() => {
    return () => {
      onStopPreviewSpeech();
    };
  }, [onStopPreviewSpeech]);

  useEffect(() => {
    if (session?.role === 'admin') {
      setSecNewAdminId(session.adminId);
    }
  }, [session]);

  useEffect(() => {
    setAdNetEnabled(adNetworkConfig.enabled);
    setAdsensePublisherId(adNetworkConfig.adsensePublisherId);
    setAdsenseBannerSlotId(adNetworkConfig.adsenseBannerSlotId);
    setAdmobUnitId(adNetworkConfig.admobUnitId);
  }, [adNetworkConfig]);

  useEffect(() => {
    setDefaultRateInput(String(defaultNewsRate));
  }, [defaultNewsRate]);

  useEffect(() => {
    const lockedUntil = adminAuthStatus?.lockedUntilMs || 0;
    if (lockedUntil <= Date.now()) {
      setLockoutRemainingSec(0);
      return;
    }

    const syncCountdown = () => {
      const rem = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setLockoutRemainingSec(rem);
      if (rem === 0) {
        void onRefreshAdminAuthStatus();
      }
    };

    syncCountdown();
    const timer = window.setInterval(syncCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [adminAuthStatus?.lockedUntilMs, onRefreshAdminAuthStatus]);

  const getStoryDraft = (story: SubmittedStory) => {
    return (
      editMap[story.id] || {
        headline: story.headline,
        script: story.script,
        factChecked: Boolean(story.factChecked),
        isBreaking: story.isBreaking ?? story.category === 'Breaking',
        scope: story.scope || 'local',
      }
    );
  };

  const updateStoryDraft = (
    story: SubmittedStory,
    patch: Partial<{
      headline: string;
      script: string;
      factChecked: boolean;
      isBreaking: boolean;
      scope: NewsScope;
    }>
  ) => {
    const current = getStoryDraft(story);
    setEditMap((prev) => ({
      ...prev,
      [story.id]: { ...current, ...patch },
    }));
  };

  const handleReporterLoginSubmit = (e: FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    const res = onLoginReporter(loginDistrictId.trim(), loginPassword.trim());
    if (!res.ok) {
      setAuthError(
        res.error ||
          'Invalid District Login ID (first 3 letters of district) or Password (NAME3 + YYYY).'
      );
    }
  };

  const handleAdminSetupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (!setupAdminId.trim()) {
      setAuthError('Enter a Unique Admin ID (4–32 characters, e.g. CHIEF-BIHAR-01).');
      return;
    }
    if (setupPassword.length < 8) {
      setAuthError('Admin Password must be at least 8 characters long.');
      return;
    }
    if (setupPassword !== setupConfirmPassword) {
      setAuthError('Admin Password and Confirm Password do not match.');
      return;
    }

    setIsAdminSubmitting(true);
    const res = await onSetupAdmin(setupAdminId.trim().toUpperCase(), setupPassword);
    setIsAdminSubmitting(false);

    if (!res.ok) {
      setAuthError(res.error || 'Unable to set up Chief Editor credentials.');
      return;
    }
    setSetupPassword('');
    setSetupConfirmPassword('');
  };

  const handleAdminLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (lockoutRemainingSec > 0) return;

    setAuthError('');
    setAuthSuccess('');

    if (!adminIdInput.trim() || !adminPasswordInput) {
      setAuthError('Enter both your Unique Admin ID and Admin Password.');
      return;
    }

    setIsAdminSubmitting(true);
    const res = await onLoginAdmin(adminIdInput.trim(), adminPasswordInput);
    setIsAdminSubmitting(false);

    if (!res.ok) {
      setAuthError(res.error || 'Invalid Unique Admin ID or Password.');
      setAdminPasswordInput('');
      return;
    }
    setAdminPasswordInput('');
  };

  const handleSecurityUpdateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSecError('');
    setSecSuccess('');

    if (!secCurrentPassword) {
      setSecError('Enter your current Admin Password to verify changes.');
      return;
    }
    if (!secNewAdminId.trim()) {
      setSecError('Enter a valid Unique Admin ID.');
      return;
    }
    if (secNewPassword.length < 8) {
      setSecError('New Admin Password must be at least 8 characters long.');
      return;
    }
    if (secNewPassword !== secConfirmPassword) {
      setSecError('New Password and Confirm Password do not match.');
      return;
    }

    setIsSavingSecurity(true);
    const res = await onChangeAdminCredentials(
      secCurrentPassword,
      secNewAdminId.trim().toUpperCase(),
      secNewPassword
    );
    setIsSavingSecurity(false);

    if (!res.ok) {
      setSecError(res.error || 'Failed to update security credentials.');
      return;
    }

    setSecCurrentPassword('');
    setSecNewPassword('');
    setSecConfirmPassword('');
    setSecSuccess(`Updated Chief Editor credentials (Active ID: ${res.adminId}).`);
    setAdminActionToast(`Security credentials updated for ${res.adminId}.`);
  };

  const liveTvStreamPreview = useMemo(() => {
    if (!tvStreamInput.trim()) return null;
    return resolveLiveTvStreamSource(tvStreamInput);
  }, [tvStreamInput]);

  const reporterTvStreamPreview = useMemo(() => {
    if (!repTvStreamUrl.trim()) return null;
    return resolveLiveTvStreamSource(repTvStreamUrl);
  }, [repTvStreamUrl]);

  // Dual-Engine inline Stream Tester effect for Chief Editor
  useEffect(() => {
    if (tvTestHlsRef.current) {
      tvTestHlsRef.current.destroy();
      tvTestHlsRef.current = null;
    }

    if (!isTestingTvStream || !liveTvStreamPreview?.ok || !liveTvStreamPreview.streamUrl) {
      return;
    }

    setTvTestStatus('loading');
    setTvTestError('');

    if (liveTvStreamPreview.type !== 'hls') {
      return;
    }

    const videoEl = tvTestVideoRef.current;
    if (!videoEl) return;

    const markPlaying = () => {
      setTvTestStatus('playing');
      setTvTestError('');
    };
    const markFailed = (reason: string) => {
      setTvTestStatus('error');
      setTvTestError(reason);
    };

    const handleCanPlay = () => {
      markPlaying();
      void videoEl.play().catch(() => {});
    };
    const handleErr = () => markFailed('Stream URL failed to load in test player.');

    videoEl.addEventListener('playing', markPlaying);
    videoEl.addEventListener('canplay', handleCanPlay);
    videoEl.addEventListener('error', handleErr);

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      tvTestHlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        markPlaying();
        void videoEl.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_ev, data) => {
        if (!data.fatal) return;
        markFailed('HLS stream returned a fatal playback or CORS error.');
      });
      hls.loadSource(liveTvStreamPreview.streamUrl);
      hls.attachMedia(videoEl);
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = liveTvStreamPreview.streamUrl;
      videoEl.load();
    } else {
      markFailed('HLS playback is not supported in this browser.');
    }

    return () => {
      videoEl.removeEventListener('playing', markPlaying);
      videoEl.removeEventListener('canplay', handleCanPlay);
      videoEl.removeEventListener('error', handleErr);
      if (tvTestHlsRef.current) {
        tvTestHlsRef.current.destroy();
        tvTestHlsRef.current = null;
      }
      videoEl.removeAttribute('src');
    };
  }, [isTestingTvStream, liveTvStreamPreview]);

  const handleTvTargetChange = (nextTarget: string) => {
    setTvTargetDistrict(nextTarget);
    if (nextTarget === 'NATIONAL') {
      setTvCategory('national');
    } else if (nextTarget === 'INTERNATIONAL') {
      setTvCategory('international');
    } else {
      setTvCategory('local');
    }
  };

  const handleAddLiveTvSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTvFormError('');
    setTvFormSuccess('');

    const cleanName = tvChannelName.trim();
    if (cleanName.length < 2) {
      setTvFormError('Enter a valid TV channel name (at least 2 characters).');
      return;
    }

    const resolved = resolveLiveTvStreamSource(tvStreamInput);
    if (!resolved.ok || !resolved.streamUrl || !resolved.watchUrl) {
      setTvFormError(
        resolved.error ||
          'Enter a valid HLS (.m3u8) URL or YouTube link (youtube.com/watch?v=... or youtu.be/...).'
      );
      return;
    }

    let backupStreamUrl: string | undefined;
    let backupType: LiveTvStreamType | undefined;
    if (tvBackupInput.trim()) {
      const resolvedBackup = resolveLiveTvStreamSource(tvBackupInput);
      if (!resolvedBackup.ok || !resolvedBackup.streamUrl) {
        setTvFormError(resolvedBackup.error || 'Backup stream URL is invalid.');
        return;
      }
      backupStreamUrl = resolvedBackup.streamUrl;
      backupType = resolvedBackup.type;
    }

    const resolvedCategory: LiveTvCategory =
      tvTargetDistrict === 'NATIONAL'
        ? 'national'
        : tvTargetDistrict === 'INTERNATIONAL'
        ? 'international'
        : tvCategory;
    const resolvedDistrict =
      resolvedCategory === 'local' ? tvTargetDistrict || 'ALL_BIHAR' : tvTargetDistrict;

    setIsSavingTvChannel(true);
    const res = await onAddLiveTvChannel({
      name: cleanName,
      category: resolvedCategory,
      district: resolvedDistrict,
      type: resolved.type,
      youtubeChannelId: resolved.youtubeChannelId,
      streamUrl: resolved.streamUrl,
      backupStreamUrl,
      backupType,
      watchUrl: resolved.watchUrl,
    });
    setIsSavingTvChannel(false);

    if (!res.ok) {
      setTvFormError(res.error || 'Unable to save Live TV channel.');
      return;
    }

    setTvChannelName('');
    setTvStreamInput('');
    setTvBackupInput('');
    setIsTestingTvStream(false);
    setTvFormSuccess(
      `Added "${cleanName}" (${resolved.type === 'hls' ? 'HLS .m3u8' : 'YouTube Embed'}) for ${resolvedDistrict}.`
    );
    setAdminActionToast(`Live TV channel "${cleanName}" published and synced.`);
  };

  const handleReporterTvSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeReporter) return;
    setRepTvError('');
    setRepTvSuccess('');

    const cleanName = repTvName.trim();
    if (cleanName.length < 2) {
      setRepTvError('Enter a valid Channel / Cable Name.');
      return;
    }

    const resolved = resolveLiveTvStreamSource(repTvStreamUrl);
    if (!resolved.ok || !resolved.streamUrl || !resolved.watchUrl) {
      setRepTvError(
        resolved.error ||
          'Enter a valid HLS (.m3u8) URL or YouTube Live link (youtube.com/live/..., watch?v=..., youtu.be/...).'
      );
      return;
    }

    setIsSubmittingRepTv(true);
    const res = await onSubmitTvChannel({
      name: cleanName,
      category: 'local',
      district: String(activeReporter.district),
      type: resolved.type,
      youtubeChannelId: resolved.youtubeChannelId,
      streamUrl: resolved.streamUrl,
      watchUrl: resolved.watchUrl,
    });
    setIsSubmittingRepTv(false);

    if (!res.ok) {
      setRepTvError(res.error || 'Unable to submit Live TV link.');
      return;
    }

    setRepTvName('');
    setRepTvStreamUrl('');
    setRepTvSuccess(
      `Submitted "${cleanName}" for ${activeReporter.district}. Chief Editor can approve it with 1 tap.`
    );
  };

  const handleQuickScopePublish = (e: FormEvent) => {
    e.preventDefault();
    setQuickError('');
    if (!onPublishQuickReel) return;

    if (quickHeadline.trim().length < 5) {
      setQuickError('Headline must be at least 5 characters.');
      return;
    }
    if (quickScript.trim().length < 15) {
      setQuickError('Script must be at least 15 characters for Gemini AI voice.');
      return;
    }

    const targetDistrict =
      quickScope === 'local'
        ? quickDistrict
        : quickScope === 'national'
        ? 'Patna'
        : 'New Delhi';

    onPublishQuickReel({
      scope: quickScope,
      district: targetDistrict,
      category: quickCategory,
      ward:
        quickWard.trim() ||
        (quickScope === 'national'
          ? 'India National Desk'
          : quickScope === 'international'
          ? 'Global World Desk'
          : `${targetDistrict} Bureau`),
      headline: quickHeadline.trim(),
      script: quickScript.trim(),
      isBreaking: quickBreaking,
    });

    setQuickHeadline('');
    setQuickScript('');
    setAdminActionToast(
      `Published instant ${quickScope.toUpperCase()} reel live to main Reels feed.`
    );
  };

  const handleAddLocalAdSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAdFormError('');
    setAdFormSuccess('');

    const cleanBusiness = adBusinessName.trim();
    const cleanTagline = adTagline.trim();
    const cleanMedia = adMediaUrl.trim();
    const cleanPhone = adPhone.trim();
    const cleanWhatsapp = adWhatsapp.trim();

    if (cleanBusiness.length < 2) {
      setAdFormError('Enter a Business Name (at least 2 characters).');
      return;
    }
    if (!cleanPhone && !cleanWhatsapp) {
      setAdFormError('Provide at least a Call Now Phone Number or WhatsApp Inquiry Number.');
      return;
    }
    if (cleanMedia && !/^(\/|https?:\/\/)/i.test(cleanMedia)) {
      setAdFormError('Media URL must start with https:// or /videos/...');
      return;
    }

    const mediaType: 'image' | 'video' = /\.(mp4|webm|mov)(\?.*)?$/i.test(cleanMedia)
      ? 'video'
      : 'image';

    setIsSavingLocalAd(true);
    const res = await onAddLocalAd({
      district: adDistrict,
      format: adFormat,
      businessName: cleanBusiness,
      tagline: cleanTagline || `Special Offer from ${cleanBusiness}`,
      mediaUrl: cleanMedia,
      mediaType,
      phone: cleanPhone,
      whatsapp: cleanWhatsapp,
    });
    setIsSavingLocalAd(false);

    if (!res.ok) {
      setAdFormError(res.error || 'Unable to save local business ad.');
      return;
    }

    setAdBusinessName('');
    setAdTagline('');
    setAdMediaUrl('');
    setAdPhone('');
    setAdWhatsapp('');
    setAdFormSuccess(`Published ${adFormat === 'reel' ? 'Sponsored Reel Card' : 'Banner Ad'} for ${adDistrict}.`);
    setAdminActionToast(`Local sponsor "${cleanBusiness}" is live for ${adDistrict}.`);
  };

  const handleSaveAdNetworkSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAdNetError('');
    setAdNetSuccess('');

    const pubId = adsensePublisherId.trim();
    const slotId = adsenseBannerSlotId.trim();
    const unitId = admobUnitId.trim();

    if (adNetEnabled && pubId && !/^ca-pub-\d{8,}$/.test(pubId)) {
      setAdNetError('AdSense Publisher ID should start with ca-pub- followed by digits.');
      return;
    }

    setIsSavingAdConfig(true);
    const res = await onSaveAdNetworkConfig({
      enabled: adNetEnabled,
      adsensePublisherId: pubId,
      adsenseBannerSlotId: slotId,
      admobUnitId: unitId,
    });
    setIsSavingAdConfig(false);

    if (!res.ok) {
      setAdNetError(res.error || 'Unable to save Google AdSense / AdMob configuration.');
      return;
    }

    setAdNetSuccess('Saved Google AdSense / AdMob configuration to Firebase RTDB.');
    setAdminActionToast('Google AdSense / AdMob settings synced.');
  };

  const handleQuickDemoReporter = (districtLoginId: string, password: string) => {
    setAuthError('');
    setAuthSuccess('');
    const res = onLoginReporter(districtLoginId, password);
    if (!res.ok) {
      setAuthError(res.error || 'Unable to log in with demo account.');
    }
  };

  const handleRegisterSubmit = (e: FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    const derivedName3 = deriveReporterName3(regName);
    const derivedDist3 = deriveDistrictCode3(String(regDistrict));
    const cleanYear = regBirthYear.trim();
    const yearNum = Number(cleanYear);

    if (!regName.trim() || derivedName3.length < 3) {
      setAuthError('Enter your Full Name (at least 3 English letters to derive NAME3).');
      return;
    }
    if (!/^\d{4}$/.test(cleanYear) || yearNum < 1960 || yearNum > 2008) {
      setAuthError('Enter a valid 4-digit Year of Birth between 1960 and 2008.');
      return;
    }

    const res = onRegisterReporter({
      name: regName.trim(),
      district: regDistrict,
      birthYear: cleanYear,
    });
    if (!res.ok) {
      setAuthError(res.error || 'Could not register District Reporter.');
      return;
    }
    const generatedDist3 = res.district3 || derivedDist3;
    const generatedPass = res.loginPassword || `${derivedName3}${cleanYear}`;
    setAuthSuccess(
      `Registered ${regName.trim()} for ${regDistrict}. Login ID: ${generatedDist3} · Password: ${generatedPass} (Status: Pending Chief Editor approval).`
    );
    setLoginDistrictId(generatedDist3);
    setLoginPassword(generatedPass);
    setShowRegisterForm(false);
    setRegName('');
    setRegBirthYear('');
  };

  const handleReporterVideoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setSubmitError('');

    if (file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name)) {
      if (file.size <= 1_400_000) {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setSelectedVideoUrl(reader.result);
            setHasOriginalAudio(true);
          }
        };
        reader.readAsDataURL(file);
      } else {
        setSelectedVideoUrl(URL.createObjectURL(file));
        setHasOriginalAudio(true);
      }
      return;
    }
    setSubmitError('Please choose a valid .mp4, .webm, or .mov video file.');
  };

  const handleStoryFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitMessage('');
    if (headlineInput.trim().length < 5) {
      setSubmitError('News headline must be at least 5 characters long.');
      return;
    }
    if (scriptInput.trim().length < 15 || scriptInput.trim().split(/\s+/).length < 4) {
      setSubmitError('Full News Script must be at least 15 characters for AI narration.');
      return;
    }

    onSubmitStory({
      headline: headlineInput.trim(),
      script: scriptInput.trim(),
      category: categoryInput,
      scope: storyScopeInput,
      ward: wardInput.trim() || 'District Headquarters',
      imageUrl: selectedImageUrl,
      videoUrl: selectedVideoUrl,
      hasOriginalAudio,
    });

    setHeadlineInput('');
    setScriptInput('');
    setUploadedFileName('');
    setSubmitMessage(
      'Story sent to Chief Editor Moderation Queue! Status: Pending Review.'
    );
  };

  const handleToggleStoryPreview = (story: SubmittedStory) => {
    const draft = getStoryDraft(story);
    if (previewingStoryId === story.id) {
      setPreviewingStoryId(null);
      onStopPreviewSpeech();
    } else {
      setPreviewingStoryId(story.id);
      onPreviewSpeech(`${draft.headline}. ${draft.script}`);
    }
  };

  const handleAdminApprove = (story: SubmittedStory) => {
    const draft = getStoryDraft(story);
    if (!draft.factChecked) {
      setAdminActionToast(
        'Check "Fact-Checked & Verified" before publishing to live district feed.'
      );
      return;
    }
    if (previewingStoryId === story.id) {
      setPreviewingStoryId(null);
      onStopPreviewSpeech();
    }
    const storyReporter = reporters.find(
      (r) => r.id.toLowerCase() === story.reporterId.toLowerCase()
    );
    const creditRate = getEffectiveReporterRate(storyReporter, defaultNewsRate);
    onApproveStory(story.id, {
      headline: draft.headline.trim() || story.headline,
      script: draft.script.trim() || story.script,
      isBreaking: draft.isBreaking,
      scope: draft.scope,
    });
    setAdminActionToast(
      `Published live (${draft.scope.toUpperCase()}) to ${story.district} feed · Credited ₹${creditRate} to ${story.reporterName}.`
    );
  };

  const handleSaveGlobalRateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(defaultRateInput);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 50000) {
      setAdminActionToast('Default Per-News Rate must be between ₹0 and ₹50,000.');
      return;
    }
    setIsSavingDefaultRate(true);
    const res = await onSaveDefaultNewsRate(Math.round(parsed));
    setIsSavingDefaultRate(false);
    if (!res.ok) {
      setAdminActionToast(res.error || 'Failed to save default per-news rate.');
      return;
    }
    setAdminActionToast(
      `Saved global Default Per-News Rate: ₹${Math.round(parsed)} per approved news.`
    );
  };

  const handleSaveCustomReporterRate = async (
    reporter: ReporterAccount,
    customValue: number | null
  ) => {
    setSavingReporterRateId(reporter.id);
    const res = await onUpdateReporterRate(reporter.id, customValue);
    setSavingReporterRateId(null);
    if (!res.ok) {
      setAdminActionToast(res.error || `Failed to update rate for ${reporter.name}.`);
      return;
    }
    setEditingReporterId(null);
    setEditingRateValue('');
    setAdminActionToast(
      customValue === null
        ? `Reset ${reporter.name} to global default rate (₹${defaultNewsRate}/news).`
        : `Updated ${reporter.name}'s custom rate to ₹${Math.round(customValue)} per approved news.`
    );
  };

  const handleAdminMarkPayoutPaid = async (payout: PayoutRequest) => {
    setMarkingPayoutId(payout.id);
    const res = await onMarkPayoutPaid(payout.id);
    setMarkingPayoutId(null);
    if (!res.ok) {
      setAdminActionToast(res.error || 'Could not mark UPI payout as paid.');
      return;
    }
    setAdminActionToast(
      `Marked ₹${payout.amount} UPI payout to ${payout.reporterName} (${payout.upiId}) as Paid.`
    );
  };

  // ============================================================================
  // 1. LOGGED IN AS DISTRICT REPORTER
  // ============================================================================
  if (session?.role === 'reporter' && activeReporter) {
    const wallet = calculateReporterWallet(
      activeReporter,
      submissions,
      payoutRequests,
      defaultNewsRate
    );
    const reporterPayouts = payoutRequests.filter(
      (p) => p.reporterId.toLowerCase() === activeReporter.id.toLowerCase()
    );

    const handleOpenWithdrawModal = () => {
      setWithdrawError('');
      setWithdrawSuccess('');
      setWithdrawAmountInput(
        wallet.withdrawableBalance > 0 ? String(wallet.withdrawableBalance) : ''
      );
      setIsWithdrawModalOpen(true);
    };

    const handleSubmitWithdrawRequest = async (e: FormEvent) => {
      e.preventDefault();
      setWithdrawError('');
      setWithdrawSuccess('');

      const cleanUpi = withdrawUpiInput.trim();
      const parsedAmount = Number(withdrawAmountInput);
      if (!/^[a-zA-Z0-9._-]{2,}@[a-zA-Z0-9]{2,}$/.test(cleanUpi)) {
        setWithdrawError('Enter a valid UPI ID (e.g. rahul@upi or 98350xxxxx@ybl).');
        return;
      }
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        setWithdrawError('Enter a withdrawal amount greater than ₹0.');
        return;
      }
      if (parsedAmount > wallet.withdrawableBalance) {
        setWithdrawError(
          wallet.pendingPayoutAmount > 0
            ? `Amount exceeds withdrawable balance ₹${wallet.withdrawableBalance} (₹${wallet.pendingPayoutAmount} pending).`
            : `Amount cannot exceed your Available Wallet Balance (₹${wallet.availableBalance}).`
        );
        return;
      }

      setIsSubmittingWithdraw(true);
      const res = await onRequestUpiPayout({
        reporterId: activeReporter.id,
        reporterName: activeReporter.name,
        district: activeReporter.district,
        upiId: cleanUpi,
        amount: Math.round(parsedAmount),
      });
      setIsSubmittingWithdraw(false);

      if (!res.ok) {
        setWithdrawError(res.error || 'Could not submit UPI payout request.');
        return;
      }

      setWithdrawSuccess(
        `UPI payout request for ₹${Math.round(parsedAmount)} to ${cleanUpi} submitted for Chief Editor payment!`
      );
      setWithdrawUpiInput('');
      setWithdrawAmountInput('');
      setIsWithdrawModalOpen(false);
    };

    return (
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-24 lg:pt-24 lg:pb-12 space-y-5 overflow-x-hidden">
        {/* Reporter Press Card Badge */}
        <section className="rounded-2xl bg-[#14161C] border border-white/12 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-[#E63926]/20 border border-[#E63926]/45 text-[#E63926] flex items-center justify-center shrink-0">
                <BadgeCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display font-bold text-lg text-white truncate">
                    {activeReporter.name}
                  </h1>
                  <span className="font-mono-tabular text-[11px] font-bold px-2 py-0.5 rounded bg-white/10 text-amber-200 border border-white/15">
                    ID: {activeReporter.district3 || deriveDistrictCode3(String(activeReporter.district))} · Pass:{' '}
                    {activeReporter.name3}
                    {activeReporter.birthYear}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#E63926] shrink-0" />
                  <span>Press Card · Assigned District: {activeReporter.district}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="min-h-[40px] px-3.5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/12 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </section>

        {/* Reporter Earnings & Rate Card */}
        <section className="rounded-2xl bg-[#14161C] border border-emerald-500/30 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>💳 Reporter Earnings &amp; Rate Card</span>
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
                  {wallet.hasCustomRate ? 'Custom Rate' : 'Standard Rate'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Total Earned: <strong className="text-zinc-200">₹{wallet.totalEarned}</strong> ·
                Paid: <strong className="text-zinc-200">₹{wallet.totalPaid}</strong>
                {wallet.pendingPayoutAmount > 0 && (
                  <>
                    {' '}
                    · Pending UPI:{' '}
                    <strong className="text-amber-300">₹{wallet.pendingPayoutAmount}</strong>
                  </>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenWithdrawModal}
              className="min-h-[42px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <IndianRupee className="w-3.5 h-3.5 shrink-0" />
              <span>Withdraw via UPI</span>
            </button>
          </div>

          {withdrawSuccess && (
            <div className="rounded-xl bg-emerald-950/50 border border-emerald-500/40 px-3.5 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{withdrawSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="rounded-xl bg-black/45 border border-white/10 p-3">
              <p className="text-[11px] text-zinc-400">Your Per-News Rate</p>
              <p className="font-mono-tabular font-bold text-base text-[#FDE68A] mt-0.5">
                ₹{wallet.activeRate} <span className="text-xs font-medium text-zinc-400">/ Approved News</span>
              </p>
            </div>
            <div className="rounded-xl bg-black/45 border border-white/10 p-3">
              <p className="text-[11px] text-zinc-400">Approved Stories</p>
              <p className="font-mono-tabular font-bold text-base text-white mt-0.5">
                {wallet.approvedStoriesCount}{' '}
                <span className="text-xs font-medium text-zinc-400">Live Stories</span>
              </p>
            </div>
            <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/35 p-3">
              <p className="text-[11px] text-emerald-200/80">Available Wallet Balance</p>
              <p className="font-mono-tabular font-extrabold text-lg text-emerald-400 flex items-center gap-0.5 mt-0.5">
                <IndianRupee className="w-4 h-4 shrink-0" />
                <span>{wallet.availableBalance}</span>
              </p>
            </div>
          </div>

          {reporterPayouts.length > 0 && (
            <div className="pt-2 border-t border-white/10 space-y-2">
              <p className="text-[11px] font-semibold text-zinc-400">
                Recent UPI Payout Requests ({reporterPayouts.length})
              </p>
              <div className="space-y-1.5">
                {reporterPayouts.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl bg-black/40 border border-white/8 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-mono-tabular font-semibold text-white truncate">
                        ₹{p.amount} · {p.upiId}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {new Date(p.requestedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        p.status === 'paid'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                          : 'bg-amber-500/20 text-amber-200 border border-amber-500/35'
                      }`}
                    >
                      {p.status === 'paid' ? '🟢 Paid' : '🟡 Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* UPI Withdraw Modal (Strictly 100dvh mobile-safe) */}
        {isWithdrawModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-[#14161C] border border-white/15 p-5 space-y-4 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    <span>Withdraw Earnings via UPI</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Available Balance:{' '}
                    <strong className="font-mono-tabular text-emerald-400">
                      ₹{wallet.availableBalance}
                    </strong>{' '}
                    · Withdrawable Now:{' '}
                    <strong className="font-mono-tabular text-white">
                      ₹{wallet.withdrawableBalance}
                    </strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  aria-label="Close UPI withdrawal modal"
                  className="p-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-zinc-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {withdrawError && (
                <div className="rounded-xl bg-red-950/50 border border-red-500/40 px-3 py-2 text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{withdrawError}</span>
                </div>
              )}

              {wallet.withdrawableBalance <= 0 ? (
                <div className="rounded-xl bg-black/50 border border-white/10 p-4 text-xs text-zinc-300 space-y-2">
                  <p>
                    {wallet.pendingPayoutAmount > 0
                      ? `Your available balance (₹${wallet.availableBalance}) is currently queued in pending UPI requests (₹${wallet.pendingPayoutAmount}).`
                      : `Your withdrawable wallet balance is currently ₹0. File and get local news approved at ₹${wallet.activeRate}/story to build earnings.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsWithdrawModalOpen(false)}
                    className="min-h-[40px] w-full rounded-xl bg-white/10 text-white font-semibold"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitWithdrawRequest} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Your UPI ID
                    </label>
                    <input
                      type="text"
                      value={withdrawUpiInput}
                      onChange={(e) => setWithdrawUpiInput(e.target.value)}
                      placeholder="rahul@upi or 98350xxxxx@ybl"
                      className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white font-mono-tabular placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-[11px] font-medium text-zinc-400">
                        Amount to Withdraw (₹)
                      </label>
                      <button
                        type="button"
                        onClick={() => setWithdrawAmountInput(String(wallet.withdrawableBalance))}
                        className="text-[11px] font-bold text-emerald-300 hover:text-emerald-200"
                      >
                        Max ₹{wallet.withdrawableBalance}
                      </button>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={wallet.withdrawableBalance}
                      value={withdrawAmountInput}
                      onChange={(e) => setWithdrawAmountInput(e.target.value)}
                      placeholder={String(wallet.withdrawableBalance)}
                      className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white font-mono-tabular placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSubmittingWithdraw}
                      className="flex-1 min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs sm:text-sm font-bold transition-colors"
                    >
                      {isSubmittingWithdraw ? 'Submitting Request...' : 'Request UPI Payout'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsWithdrawModalOpen(false)}
                      className="min-h-[44px] px-4 rounded-xl bg-white/10 text-zinc-200 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Submit News Form (Strictly Locked to Reporter's Assigned District) */}
        <section className="rounded-2xl bg-[#14161C] border border-white/12 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="font-display font-bold text-base text-white">
                District Reporter Studio
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Stories enter the Chief Editor moderation queue before publishing live.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-200 bg-[#F59E0B]/15 border border-[#F59E0B]/35 px-2.5 py-1 rounded-lg">
              <Lock className="w-3 h-3 text-[#F59E0B]" />
              <span>Locked: {activeReporter.district}</span>
            </span>
          </div>

          <form onSubmit={handleStoryFormSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Assigned District (Locked)
                </label>
                <input
                  type="text"
                  value={activeReporter.district}
                  readOnly
                  disabled
                  className="w-full min-h-[44px] px-3 rounded-xl bg-black/60 border border-white/10 text-xs sm:text-sm text-zinc-300 font-semibold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  News Scope
                </label>
                <select
                  value={storyScopeInput}
                  onChange={(e) => setStoryScopeInput(e.target.value as NewsScope)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#E63926]"
                >
                  <option value="local" className="bg-[#14161C]">
                    📍 Local ({activeReporter.district})
                  </option>
                  <option value="national" className="bg-[#14161C]">
                    🇮🇳 National (India)
                  </option>
                  <option value="international" className="bg-[#14161C]">
                    🌍 World (International)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Category
                </label>
                <select
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value as NewsReel['category'])}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#E63926]"
                >
                  {REPORTER_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#14161C]">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Ward / Block
                </label>
                <input
                  type="text"
                  value={wardInput}
                  onChange={(e) => setWardInput(e.target.value)}
                  placeholder="Ward / Chowk"
                  className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E63926]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                News Headline
              </label>
              <input
                type="text"
                value={headlineInput}
                onChange={(e) => setHeadlineInput(e.target.value)}
                placeholder={`${activeReporter.district} में शाम से नई ट्रैफिक व नागरिक सुविधा लागू...`}
                className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E63926]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="block text-[11px] font-medium text-zinc-400">
                  Full News Script (AI Anchor Readout)
                </label>
                <span className="font-mono-tabular text-[11px] font-semibold text-[#FDE68A] inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#F59E0B]" />
                  <span>~{liveNarrationMetrics.durationSec} sec</span>
                </span>
              </div>
              <textarea
                rows={3}
                value={scriptInput}
                onChange={(e) => setScriptInput(e.target.value)}
                placeholder="Write complete verified field details here. Reel runtime & Gemini AI narration automatically scale to script length..."
                className="w-full p-3 rounded-xl bg-black/45 border border-white/12 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E63926] resize-none"
              />
            </div>

            {/* Video Source Picker */}
            <div className="grid grid-cols-[88px_1fr] gap-3 items-start pt-1">
              <div className="aspect-[9/16] w-[88px] rounded-xl overflow-hidden bg-black/60 border border-white/12 relative shrink-0">
                <video
                  key={selectedVideoUrl}
                  src={selectedVideoUrl}
                  poster={selectedImageUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 inset-x-1 text-[9px] font-semibold text-center bg-black/75 text-white rounded py-0.5">
                  Preview
                </span>
              </div>

              <div className="space-y-2 min-w-0">
                <label className="min-h-[44px] px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-medium text-white flex items-center justify-center gap-2 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-[#F59E0B] shrink-0" />
                  <span className="truncate">
                    {uploadedFileName || 'Upload Local .MP4 / .WebM Clip'}
                  </span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/*"
                    onChange={handleReporterVideoUpload}
                    className="sr-only"
                  />
                </label>

                <p className="text-[11px] text-zinc-400">Or pick broadcast news B-roll:</p>
                <div className="flex flex-wrap gap-1.5">
                  {REPORTER_BROLL_CLIPS.map((clip) => (
                    <button
                      key={clip.id}
                      type="button"
                      onClick={() => {
                        setSelectedVideoUrl(clip.videoUrl);
                        setSelectedImageUrl(clip.imageUrl);
                        setUploadedFileName('');
                        setHasOriginalAudio(false);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition-colors ${
                        selectedVideoUrl === clip.videoUrl && !uploadedFileName
                          ? 'bg-[#E63926]/20 border-[#E63926] text-white'
                          : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      {clip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {submitError && (
              <p className="text-xs text-[#FCA5A5] font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{submitError}</span>
              </p>
            )}
            {submitMessage && (
              <p className="text-xs text-emerald-300 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{submitMessage}</span>
              </p>
            )}

            <button
              type="submit"
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#E63926] hover:bg-[#D62E1C] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[#E63926]/25"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Submit Story for Chief Editor Approval</span>
            </button>
          </form>
        </section>

        {/* Submit District Local Cable / YouTube Live TV Stream */}
        <section className="rounded-2xl bg-[#14161C] border border-white/12 p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#F59E0B]" />
                <span>📡 Submit Local Cable / YouTube Live Link</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Link a {activeReporter.district} cable TV HLS (.m3u8) or YouTube Live stream to the Live TV tab (1-tap Chief Editor approval).
              </p>
            </div>
            <span className="font-mono-tabular text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/8 text-amber-200 border border-white/10">
              {activeReporter.district}
            </span>
          </div>

          {repTvError && (
            <p className="text-xs text-[#FCA5A5] font-medium flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{repTvError}</span>
            </p>
          )}
          {repTvSuccess && (
            <p className="text-xs text-emerald-300 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{repTvSuccess}</span>
            </p>
          )}

          <form onSubmit={handleReporterTvSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Local Cable / Web TV Name
                </label>
                <input
                  type="text"
                  value={repTvName}
                  onChange={(e) => setRepTvName(e.target.value)}
                  placeholder={`e.g. ${activeReporter.district} City Cable Live`}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-[11px] font-medium text-zinc-400">
                    HLS (.m3u8) or YouTube Live URL
                  </label>
                  {reporterTvStreamPreview && reporterTvStreamPreview.ok && (
                    <span className="font-mono-tabular text-[10px] font-bold text-emerald-300">
                      {reporterTvStreamPreview.type === 'hls' ? 'HLS' : 'YT Ready'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={repTvStreamUrl}
                  onChange={(e) => setRepTvStreamUrl(e.target.value)}
                  placeholder="https://youtube.com/live/... or .m3u8"
                  className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-xs sm:text-sm text-white font-mono-tabular placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingRepTv}
              className="min-h-[42px] px-4 rounded-xl bg-[#F59E0B] hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-bold inline-flex items-center gap-2 transition-colors"
            >
              <Tv className="w-4 h-4 shrink-0" />
              <span>
                {isSubmittingRepTv
                  ? 'Submitting Live Link...'
                  : `Submit ${activeReporter.district} Live TV Link`}
              </span>
            </button>
          </form>
        </section>

        {/* Reporter's Submitted Queue & Status History */}
        <section className="rounded-2xl bg-[#14161C] border border-white/12 p-4 sm:p-5 space-y-3">
          <h2 className="font-display font-bold text-base text-white">
            My Submitted Dispatches ({reporterSubmissions.length})
          </h2>

          {reporterSubmissions.length === 0 ? (
            <p className="text-xs text-zinc-400">
              No stories submitted yet. File your first {activeReporter.district} report above.
            </p>
          ) : (
            <div className="space-y-2.5">
              {reporterSubmissions.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-black/40 border border-white/10 p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white leading-snug">
                        {item.headline}
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        {item.district} · {item.category} · {item.ward}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap shrink-0 ${
                        item.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                          : item.status === 'rejected'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/35'
                          : 'bg-amber-500/20 text-amber-200 border border-amber-500/35'
                      }`}
                    >
                      {item.status === 'approved'
                        ? `🟢 Approved • +₹${
                            typeof item.earnedAmount === 'number'
                              ? item.earnedAmount
                              : wallet.activeRate
                          } Credited`
                        : item.status === 'rejected'
                        ? '🔴 Rejected • ₹0'
                        : `🟡 Pending • ₹${wallet.activeRate} on approval`}
                    </span>
                  </div>

                  {item.status === 'rejected' && item.rejectionReason && (
                    <p className="text-[11px] text-red-300 bg-red-950/40 border border-red-500/25 rounded-lg px-2.5 py-1.5">
                      Editor Note: {item.rejectionReason}
                    </p>
                  )}

                  {item.status === 'approved' && (
                    <button
                      type="button"
                      onClick={() => onWatchDistrictFeed(item.district)}
                      className="min-h-[36px] px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white inline-flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 text-[#F59E0B]" />
                      <span>Watch Live in {item.district}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ============================================================================
  // 2. LOGGED IN AS CHIEF EDITOR / ADMIN
  // ============================================================================
  if (session?.role === 'admin') {
    const activeReportersCount = reporters.filter((r) => r.status === 'active').length;
    const pendingReportersCount = reporters.filter((r) => r.status === 'pending').length;

    return (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-24 lg:pt-24 lg:pb-12 space-y-5 overflow-x-hidden">
        {/* Control Room Header */}
        <section className="rounded-2xl bg-[#14161C] border border-white/12 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display font-bold text-lg text-white truncate">
                  Chief Editor Control Room
                </h1>
                <p className="text-xs text-zinc-400 mt-0.5 truncate">
                  ID: <span className="font-mono-tabular text-emerald-300">{session.adminId}</span> ·
                  38 Bihar Districts
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onStopPreviewSpeech();
                onLogout();
              }}
              className="min-h-[40px] px-3.5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/12 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-white/10">
            <div className="rounded-xl bg-black/40 border border-white/8 p-3">
              <p className="text-[11px] text-zinc-400">Pending Queue</p>
              <p className="font-mono-tabular font-bold text-base text-[#FDE68A] mt-0.5">
                {pendingSubmissions.length}
              </p>
            </div>
            <div className="rounded-xl bg-black/40 border border-white/8 p-3">
              <p className="text-[11px] text-zinc-400">Live Reels</p>
              <p className="font-mono-tabular font-bold text-base text-white mt-0.5">
                {reels.length}
              </p>
            </div>
            <div className="rounded-xl bg-black/40 border border-white/8 p-3">
              <p className="text-[11px] text-zinc-400">Reporters</p>
              <p className="font-mono-tabular font-bold text-base text-emerald-400 mt-0.5">
                {activeReportersCount}
                {pendingReportersCount > 0 ? ` (+${pendingReportersCount})` : ''}
              </p>
            </div>
          </div>
        </section>

        {/* 6 Admin Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 p-1 rounded-2xl bg-[#14161C] border border-white/12">
          <button
            type="button"
            onClick={() => setAdminTab('pending')}
            className={`min-h-[44px] px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
              adminTab === 'pending'
                ? 'bg-[#E63926] text-white'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Pending ({pendingSubmissions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('live')}
            className={`min-h-[44px] px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
              adminTab === 'live'
                ? 'bg-[#F59E0B] text-black'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5 shrink-0" />
            <span>Live Reels</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAdminTab('livetv');
              setTvFormError('');
              setTvFormSuccess('');
            }}
            className={`min-h-[44px] px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
              adminTab === 'livetv'
                ? 'bg-[#E63926] text-white'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Tv className="w-3.5 h-3.5 shrink-0" />
            <span>
              Live TV ({liveTvChannels.length}
              {pendingTvSubmissions.length > 0 ? ` +${pendingTvSubmissions.length}` : ''})
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAdminTab('ads');
              setAdFormError('');
              setAdFormSuccess('');
              setAdNetError('');
              setAdNetSuccess('');
            }}
            className={`min-h-[44px] px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
              adminTab === 'ads'
                ? 'bg-[#F59E0B] text-black'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5 shrink-0" />
            <span>💰 Ads ({localAds.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('reporters')}
            className={`min-h-[44px] px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
              adminTab === 'reporters'
                ? 'bg-emerald-500 text-black'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span>Reporters ({reporters.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAdminTab('security');
              setSecError('');
              setSecSuccess('');
            }}
            className={`min-h-[44px] px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
              adminTab === 'security'
                ? 'bg-white text-black'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 shrink-0" />
            <span>Security</span>
          </button>
        </div>

        {adminActionToast && (
          <div className="rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 px-3.5 py-2.5 text-xs text-[#FDE68A] font-medium flex items-center justify-between gap-2">
            <span>{adminActionToast}</span>
            <button
              type="button"
              onClick={() => setAdminActionToast('')}
              className="text-zinc-300 hover:text-white text-xs font-semibold shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: PENDING MODERATION QUEUE */}
        {adminTab === 'pending' && (
          <section className="space-y-4">
            {pendingSubmissions.length === 0 ? (
              <div className="rounded-2xl bg-[#14161C] border border-white/10 p-6 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="font-display font-bold text-base text-white">
                  Moderation Queue Clear
                </p>
                <p className="text-xs text-zinc-400">
                  All district reporter dispatches have been reviewed. New submissions will appear here immediately.
                </p>
              </div>
            ) : (
              pendingSubmissions.map((story) => {
                const draft = getStoryDraft(story);
                const est = estimateNarrationDurationSec(
                  `${draft.headline}. ${draft.script}`
                );
                const isPreviewing = previewingStoryId === story.id;
                const isRejectOpen = rejectingId === story.id;

                return (
                  <article
                    key={story.id}
                    className="rounded-2xl bg-[#14161C] border border-white/12 p-4 sm:p-5 space-y-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-bold text-white">{story.district}</span>
                        <span className="text-zinc-500">·</span>
                        <span className="text-amber-200 font-semibold">{story.category}</span>
                        <span className="text-zinc-500">·</span>
                        <span className="font-mono-tabular text-zinc-300">{story.reporterId}</span>
                        <span className="text-zinc-500">·</span>
                        <span className="font-mono-tabular text-zinc-400">~{est.durationSec}s</span>
                        <span className="font-mono-tabular text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          ₹
                          {getEffectiveReporterRate(
                            reporters.find(
                              (r) => r.id.toLowerCase() === story.reporterId.toLowerCase()
                            ),
                            defaultNewsRate
                          )}{' '}
                          on approval
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleStoryPreview(story)}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                          isPreviewing
                            ? 'bg-[#E63926] text-white'
                            : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
                        }`}
                      >
                        {isPreviewing && isTestingNarration ? (
                          <Square className="w-3.5 h-3.5 fill-white" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5 text-[#F59E0B]" />
                        )}
                        <span>
                          {isPreviewing ? 'Stop Video + Voice Preview' : '1-Tap Video + Voice Preview'}
                        </span>
                      </button>
                    </div>

                    {isPreviewing && (
                      <div className="rounded-xl bg-black/60 border border-white/12 p-3 flex flex-col sm:flex-row gap-3 items-center">
                        <div className="aspect-[9/16] w-28 rounded-xl overflow-hidden bg-black border border-white/15 shrink-0">
                          {story.videoUrl ? (
                            <video
                              src={story.videoUrl}
                              poster={story.imageUrl}
                              autoPlay
                              loop
                              muted
                              playsInline
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img
                              src={story.imageUrl}
                              alt={draft.headline}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#FDE68A] flex items-center gap-1.5">
                            <Video className="w-3.5 h-3.5 text-[#E63926]" />
                            <span>
                              {isTestingNarration
                                ? 'Live Narration Playing...'
                                : 'Visual Preview Active'}
                            </span>
                          </p>
                          <p className="text-xs text-white font-semibold leading-snug">
                            {draft.headline}
                          </p>
                          <p className="text-[11px] text-zinc-300 leading-relaxed">
                            {draft.script}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                          Headline (Editor Editable)
                        </label>
                        <input
                          type="text"
                          value={draft.headline}
                          onChange={(e) =>
                            updateStoryDraft(story, { headline: e.target.value })
                          }
                          className="w-full min-h-[42px] px-3 rounded-xl bg-black/45 border border-white/12 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#E63926]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                          Full Script (Editor Editable)
                        </label>
                        <textarea
                          rows={3}
                          value={draft.script}
                          onChange={(e) =>
                            updateStoryDraft(story, { script: e.target.value })
                          }
                          className="w-full p-3 rounded-xl bg-black/45 border border-white/12 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#E63926] resize-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-medium text-zinc-400">Scope:</label>
                        <select
                          value={draft.scope}
                          onChange={(e) =>
                            updateStoryDraft(story, { scope: e.target.value as NewsScope })
                          }
                          className="min-h-[34px] px-2.5 rounded-lg bg-black/50 border border-white/15 text-xs text-white"
                        >
                          <option value="local" className="bg-[#14161C]">
                            📍 Local ({story.district})
                          </option>
                          <option value="national" className="bg-[#14161C]">
                            🇮🇳 National (India)
                          </option>
                          <option value="international" className="bg-[#14161C]">
                            🌍 World (Global)
                          </option>
                        </select>
                      </div>

                      <label className="inline-flex items-center gap-2 text-xs text-zinc-200 cursor-pointer min-h-[36px]">
                        <input
                          type="checkbox"
                          checked={draft.factChecked}
                          onChange={(e) =>
                            updateStoryDraft(story, { factChecked: e.target.checked })
                          }
                          className="w-4 h-4 accent-emerald-500 rounded"
                        />
                        <span>Fact-Checked & Verified</span>
                      </label>

                      <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer min-h-[36px]">
                        <input
                          type="checkbox"
                          checked={draft.isBreaking}
                          onChange={(e) =>
                            updateStoryDraft(story, { isBreaking: e.target.checked })
                          }
                          className="w-4 h-4 accent-[#E63926] rounded"
                        />
                        <span>Breaking Ticker Priority</span>
                      </label>
                    </div>

                    {isRejectOpen && (
                      <div className="rounded-xl bg-red-950/35 border border-red-500/30 p-3 space-y-2">
                        <label className="block text-[11px] font-medium text-red-200">
                          Rejection Reason (Sent to Reporter)
                        </label>
                        <input
                          type="text"
                          value={rejectReasonInput}
                          onChange={(e) => setRejectReasonInput(e.target.value)}
                          placeholder="e.g., Needs corroboration from district administration / clearer script"
                          className="w-full min-h-[40px] px-3 rounded-xl bg-black/50 border border-white/15 text-xs text-white"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (previewingStoryId === story.id) {
                                setPreviewingStoryId(null);
                                onStopPreviewSpeech();
                              }
                              onRejectStory(
                                story.id,
                                rejectReasonInput.trim() ||
                                  'Did not meet Chief Editor verification criteria.'
                              );
                              setRejectingId(null);
                              setRejectReasonInput('');
                              setAdminActionToast(`Rejected submission from ${story.reporterId}.`);
                            }}
                            className="min-h-[38px] px-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
                          >
                            Confirm Rejection
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(null);
                              setRejectReasonInput('');
                            }}
                            className="min-h-[38px] px-3 rounded-xl bg-white/10 text-zinc-200 text-xs font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleAdminApprove(story)}
                        className="min-h-[46px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <Check className="w-4 h-4 shrink-0" />
                        <span>APPROVE & GO LIVE</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingId(story.id);
                          setRejectReasonInput('');
                        }}
                        className="min-h-[46px] px-4 rounded-xl bg-red-600/20 hover:bg-red-600/35 border border-red-500/45 text-red-200 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <XCircle className="w-4 h-4 shrink-0" />
                        <span>REJECT</span>
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        )}

        {/* TAB 2: LIVE REELS MANAGER */}
        {adminTab === 'live' && (
          <section className="space-y-3.5">
            {onPublishQuickReel && (
              <div className="rounded-2xl bg-[#14161C] border border-white/12 p-4 sm:p-5 space-y-3">
                <div>
                  <h2 className="font-display font-bold text-sm sm:text-base text-white">
                    ⚡ Publish Instant Scope Reel (Local / National / World)
                  </h2>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Publish a breaking Local, India National, or World bulletin straight to the swipeable Reels feed with Gemini AI voice.
                  </p>
                </div>

                {quickError && (
                  <p className="text-xs text-red-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{quickError}</span>
                  </p>
                )}

                <form onSubmit={handleQuickScopePublish} className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <select
                      value={quickScope}
                      onChange={(e) => setQuickScope(e.target.value as NewsScope)}
                      className="min-h-[42px] px-3 rounded-xl bg-black/50 border border-white/15 text-xs sm:text-sm text-white"
                    >
                      <option value="local" className="bg-[#14161C]">
                        📍 Local (District)
                      </option>
                      <option value="national" className="bg-[#14161C]">
                        🇮🇳 India National
                      </option>
                      <option value="international" className="bg-[#14161C]">
                        🌍 World International
                      </option>
                    </select>

                    {quickScope === 'local' ? (
                      <select
                        value={quickDistrict}
                        onChange={(e) => setQuickDistrict(e.target.value)}
                        className="min-h-[42px] px-3 rounded-xl bg-black/50 border border-white/15 text-xs sm:text-sm text-white"
                      >
                        <optgroup label="BIHAR (All 38 Districts)" className="bg-[#14161C]">
                          {biharDistricts.map((d) => (
                            <option key={d.id} value={d.id} className="bg-[#14161C]">
                              {d.id}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={quickWard}
                        onChange={(e) => setQuickWard(e.target.value)}
                        placeholder={quickScope === 'national' ? 'India Desk' : 'World Desk'}
                        className="min-h-[42px] px-3 rounded-xl bg-black/50 border border-white/15 text-xs sm:text-sm text-white"
                      />
                    )}

                    <select
                      value={quickCategory}
                      onChange={(e) => setQuickCategory(e.target.value as NewsReel['category'])}
                      className="min-h-[42px] px-3 rounded-xl bg-black/50 border border-white/15 text-xs sm:text-sm text-white"
                    >
                      {REPORTER_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat} className="bg-[#14161C]">
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="text"
                    value={quickHeadline}
                    onChange={(e) => setQuickHeadline(e.target.value)}
                    placeholder="Breaking Headline..."
                    className="w-full min-h-[42px] px-3 rounded-xl bg-black/45 border border-white/12 text-xs sm:text-sm text-white placeholder:text-zinc-500"
                  />

                  <textarea
                    rows={2}
                    value={quickScript}
                    onChange={(e) => setQuickScript(e.target.value)}
                    placeholder="Write complete broadcast narration script..."
                    className="w-full p-3 rounded-xl bg-black/45 border border-white/12 text-xs sm:text-sm text-white placeholder:text-zinc-500 resize-none"
                  />

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="inline-flex items-center gap-2 text-xs text-zinc-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={quickBreaking}
                        onChange={(e) => setQuickBreaking(e.target.checked)}
                        className="w-4 h-4 accent-[#E63926]"
                      />
                      <span>Mark Breaking Ticker</span>
                    </label>
                    <button
                      type="submit"
                      className="min-h-[40px] px-4 rounded-xl bg-[#E63926] hover:bg-[#D62E1C] text-white text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Publish Reel Live</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="rounded-2xl bg-[#14161C] border border-white/12 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-bold text-sm text-white">
                  Filter Live Reels by District
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Showing {filteredLiveReels.length} active reels
                </p>
              </div>

              <select
                value={liveDistrictFilter}
                onChange={(e) => setLiveDistrictFilter(e.target.value as DistrictId)}
                className="min-h-[42px] px-3 rounded-xl bg-black/50 border border-white/15 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
              >
                <option value="All" className="bg-[#14161C]">
                  All Districts ({reels.length})
                </option>
                <optgroup label="BIHAR (All 38 Districts)" className="bg-[#14161C]">
                  {biharDistricts.map((d) => (
                    <option key={d.id} value={d.id} className="bg-[#14161C]">
                      {d.id}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Major Metros" className="bg-[#14161C]">
                  {metroDistricts.map((d) => (
                    <option key={d.id} value={d.id} className="bg-[#14161C]">
                      {d.id}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {filteredLiveReels.length === 0 ? (
              <div className="rounded-2xl bg-[#14161C] border border-white/10 p-6 text-center text-xs text-zinc-400">
                No cached live reels currently loaded for {liveDistrictFilter}. Switch to this district in the main feed to fetch its live RSS bulletins.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredLiveReels.map((reel) => (
                  <div
                    key={reel.id}
                    className="rounded-2xl bg-[#14161C] border border-white/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            reel.scope === 'national'
                              ? 'bg-amber-500/20 text-amber-200'
                              : reel.scope === 'international'
                              ? 'bg-indigo-500/25 text-indigo-200'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {reel.scope === 'national'
                            ? 'NATIONAL'
                            : reel.scope === 'international'
                            ? 'WORLD'
                            : 'LOCAL'}
                        </span>
                        <span className="font-bold text-amber-200">{reel.district}</span>
                        <span className="text-zinc-500">·</span>
                        <span className="text-zinc-300">{reel.category}</span>
                        {reel.isVerifiedReporter && (
                          <>
                            <span className="text-zinc-500">·</span>
                            <span className="text-emerald-300 font-semibold">
                              Verified Reporter
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-white line-clamp-2">
                        {reel.headline.hi || reel.headline.en}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onToggleReelBreaking(reel.id)}
                        className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold border transition-colors ${
                          reel.isBreaking
                            ? 'bg-[#E63926] border-[#E63926] text-white'
                            : 'bg-white/8 border-white/12 text-zinc-300 hover:bg-white/15'
                        }`}
                      >
                        {reel.isBreaking ? 'Breaking On' : 'Set Breaking'}
                      </button>

                      <button
                        type="button"
                        onClick={() => onWatchDistrictFeed(reel.district)}
                        className="min-h-[38px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white"
                      >
                        Watch
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onDeleteReel(reel.id);
                          setAdminActionToast(`Deleted reel from ${reel.district}.`);
                        }}
                        aria-label={`Delete reel ${reel.id}`}
                        className="min-h-[38px] px-3 rounded-xl bg-red-600/20 hover:bg-red-600/35 border border-red-500/40 text-red-200 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: REPORTERS DIRECTORY, PER-NEWS PAYOUT RATES & UPI SETTLEMENT */}
        {adminTab === 'reporters' && (
          <section className="space-y-4">
            {/* Global Default Per-News Rate Bar */}
            <div className="rounded-2xl bg-[#14161C] border border-emerald-500/30 p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-sm sm:text-base text-white flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>💰 Default Per-News Rate (₹)</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Global payout credited per approved news story unless overridden for an individual reporter.
                  </p>
                </div>

                <form onSubmit={handleSaveGlobalRateSubmit} className="flex items-center gap-2 shrink-0">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={50000}
                      value={defaultRateInput}
                      onChange={(e) => setDefaultRateInput(e.target.value)}
                      aria-label="Default Per-News Rate in Rupees"
                      className="w-28 min-h-[42px] pl-7 pr-2.5 rounded-xl bg-black/50 border border-white/15 text-sm font-mono-tabular font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSavingDefaultRate}
                    className="min-h-[42px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-bold whitespace-nowrap transition-colors"
                  >
                    {isSavingDefaultRate ? 'Saving...' : 'Save Rate'}
                  </button>
                </form>
              </div>
            </div>

            {/* Reporters Directory with Inline Custom Rate Override */}
            <div className="space-y-2.5">
              {reporters.map((rep) => {
                const repWallet = calculateReporterWallet(
                  rep,
                  submissions,
                  payoutRequests,
                  defaultNewsRate
                );
                const isEditingRate = editingReporterId === rep.id;

                return (
                  <div
                    key={rep.id}
                    className="rounded-2xl bg-[#14161C] border border-white/10 p-4 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display font-bold text-sm text-white">
                            {rep.name}
                          </span>
                          <span className="font-mono-tabular text-[11px] font-bold px-2 py-0.5 rounded bg-white/10 text-amber-200">
                            ID: {rep.district3 || deriveDistrictCode3(String(rep.district))} ·{' '}
                            {rep.name3}
                            {rep.birthYear}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              rep.status === 'active'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : rep.status === 'pending'
                                ? 'bg-amber-500/20 text-amber-200'
                                : 'bg-red-500/20 text-red-300'
                            }`}
                          >
                            {rep.status === 'active'
                              ? 'Active'
                              : rep.status === 'pending'
                              ? 'Pending Approval'
                              : 'Suspended'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span>
                            District: <strong className="text-zinc-200">{rep.district}</strong>
                          </span>
                          <span>·</span>
                          <span>
                            Approved:{' '}
                            <span className="font-mono-tabular text-zinc-200">
                              {repWallet.approvedStoriesCount}
                            </span>
                          </span>
                          <span>·</span>
                          <span>
                            Earned:{' '}
                            <span className="font-mono-tabular text-[#FDE68A]">
                              ₹{repWallet.totalEarned}
                            </span>
                          </span>
                          <span>·</span>
                          <span>
                            Paid:{' '}
                            <span className="font-mono-tabular text-zinc-200">
                              ₹{repWallet.totalPaid}
                            </span>
                          </span>
                          <span>·</span>
                          <span>
                            Balance:{' '}
                            <span className="font-mono-tabular font-bold text-emerald-400">
                              ₹{repWallet.availableBalance}
                            </span>
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        {!isEditingRate ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingReporterId(rep.id);
                              setEditingRateValue(String(repWallet.activeRate));
                            }}
                            className={`min-h-[38px] px-3 rounded-xl border text-xs font-mono-tabular font-bold inline-flex items-center gap-1.5 transition-colors ${
                              repWallet.hasCustomRate
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 hover:bg-amber-500/25'
                                : 'bg-white/8 border-white/15 text-zinc-200 hover:bg-white/15'
                            }`}
                          >
                            <span>Rate: ₹{repWallet.activeRate}</span>
                            <Pencil className="w-3 h-3" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-emerald-400">
                                ₹
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={50000}
                                value={editingRateValue}
                                onChange={(e) => setEditingRateValue(e.target.value)}
                                aria-label={`Custom per-news rate for ${rep.name}`}
                                className="w-24 min-h-[38px] pl-6 pr-2 rounded-xl bg-black/60 border border-emerald-500/50 text-xs font-mono-tabular text-white"
                              />
                            </div>
                            <button
                              type="button"
                              disabled={savingReporterRateId === rep.id}
                              onClick={() => {
                                const val = Number(editingRateValue);
                                if (!Number.isFinite(val) || val < 0 || val > 50000) {
                                  setAdminActionToast('Enter a valid rate between ₹0 and ₹50,000.');
                                  return;
                                }
                                void handleSaveCustomReporterRate(rep, Math.round(val));
                              }}
                              className="min-h-[38px] px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold"
                            >
                              Save
                            </button>
                            {repWallet.hasCustomRate && (
                              <button
                                type="button"
                                disabled={savingReporterRateId === rep.id}
                                onClick={() => void handleSaveCustomReporterRate(rep, null)}
                                className="min-h-[38px] px-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-[11px] font-semibold"
                              >
                                Default
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingReporterId(null);
                                setEditingRateValue('');
                              }}
                              className="min-h-[38px] px-2.5 rounded-xl bg-white/8 text-zinc-400 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        )}

                        {rep.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateReporterStatus(rep.id, 'active');
                              setAdminActionToast(
                                `Approved reporter ${rep.id} (${rep.district}).`
                              );
                            }}
                            className="min-h-[38px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        )}

                        {rep.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateReporterStatus(rep.id, 'suspended');
                              setAdminActionToast(`Suspended reporter ${rep.id}.`);
                            }}
                            className="min-h-[38px] px-3 rounded-xl bg-red-600/20 hover:bg-red-600/35 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center gap-1.5"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Suspend</span>
                          </button>
                        ) : rep.status === 'suspended' ? (
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateReporterStatus(rep.id, 'active');
                              setAdminActionToast(`Reactivated reporter ${rep.id}.`);
                            }}
                            className="min-h-[38px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold"
                          >
                            Reactivate
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reporter UPI Payout Requests Queue */}
            <div className="rounded-2xl bg-[#14161C] border border-white/12 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h2 className="font-display font-bold text-sm sm:text-base text-white flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#F59E0B] shrink-0" />
                    <span>💳 UPI Payout Requests ({payoutRequests.length})</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Review reporter withdrawal requests and mark settled once transferred via UPI.
                  </p>
                </div>
                <span className="font-mono-tabular text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-200 border border-amber-500/35">
                  Pending: {payoutRequests.filter((p) => p.status === 'pending').length}
                </span>
              </div>

              {payoutRequests.length === 0 ? (
                <p className="text-xs text-zinc-400 py-2">
                  No reporter UPI payout requests yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {payoutRequests.map((payout) => (
                    <div
                      key={payout.id}
                      className="rounded-xl bg-black/45 border border-white/10 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display font-bold text-sm text-white">
                            {payout.reporterName}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-amber-200">
                            {payout.district}
                          </span>
                          <span className="font-mono-tabular font-bold text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ₹{payout.amount}
                          </span>
                        </div>
                        <p className="font-mono-tabular text-xs text-zinc-300 truncate">
                          UPI: {payout.upiId} · Requested{' '}
                          {new Date(payout.requestedAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {payout.status === 'pending' ? (
                          <button
                            type="button"
                            disabled={markingPayoutId === payout.id}
                            onClick={() => void handleAdminMarkPayoutPaid(payout)}
                            className="min-h-[38px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>
                              {markingPayoutId === payout.id ? 'Updating...' : '✅ Mark Paid'}
                            </span>
                          </button>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-bold">
                            🟢 Paid
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
        {/* TAB 3: LIVE TV CHANNEL MANAGER + DISTRICT CABLE + STREAM TESTER */}
        {adminTab === 'livetv' && (
          <section className="space-y-4">
            <div className="rounded-2xl bg-[#14161C] border border-white/12 p-4 sm:p-5 space-y-4">
              <div>
                <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
                  <Tv className="w-4 h-4 text-[#E63926]" />
                  <span>Add District Cable / Live TV News Channel</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Publish District Cable (.m3u8 / YouTube Live), State-Wide Bihar, National, or International 24x7 streams with live stream verification before saving.
                </p>
              </div>

              {tvFormError && (
                <div className="rounded-xl bg-red-950/50 border border-red-500/40 px-3.5 py-2.5 text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{tvFormError}</span>
                </div>
              )}

              {tvFormSuccess && (
                <div className="rounded-xl bg-emerald-950/50 border border-emerald-500/40 px-3.5 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{tvFormSuccess}</span>
                </div>
              )}

              <form onSubmit={handleAddLiveTvSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Channel Name
                    </label>
                    <input
                      type="text"
                      value={tvChannelName}
                      onChange={(e) => setTvChannelName(e.target.value)}
                      placeholder="e.g. Muzaffarpur Tirhut Cable Live"
                      className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E63926]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Target Scope / Bihar District
                    </label>
                    <select
                      value={tvTargetDistrict}
                      onChange={(e) => handleTvTargetChange(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#E63926]"
                    >
                      <option value="ALL_BIHAR" className="bg-[#14161C]">
                        ALL_BIHAR (Statewide Local Desk)
                      </option>
                      <option value="NATIONAL" className="bg-[#14161C]">
                        NATIONAL (India 24x7)
                      </option>
                      <option value="INTERNATIONAL" className="bg-[#14161C]">
                        INTERNATIONAL (World News)
                      </option>
                      <optgroup label="BIHAR (All 38 Districts)" className="bg-[#14161C]">
                        {biharDistricts.map((d) => (
                          <option key={d.id} value={d.id} className="bg-[#14161C]">
                            📍 {d.id} (District Cable / YT)
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Major Metros" className="bg-[#14161C]">
                        {metroDistricts.map((d) => (
                          <option key={d.id} value={d.id} className="bg-[#14161C]">
                            📍 {d.id}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="block text-[11px] font-medium text-zinc-400">
                      HLS (.m3u8) Stream URL or YouTube Link (live/ / watch?v= / youtu.be/ / UC...)
                    </label>
                    {liveTvStreamPreview && liveTvStreamPreview.ok && (
                      <span className="font-mono-tabular text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 shrink-0">
                        {liveTvStreamPreview.type === 'hls'
                          ? 'Detected: HLS (.m3u8)'
                          : liveTvStreamPreview.youtubeVideoId
                          ? `Detected: YouTube ID (${liveTvStreamPreview.youtubeVideoId})`
                          : 'Detected: YouTube Channel'}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={tvStreamInput}
                    onChange={(e) => {
                      setTvStreamInput(e.target.value);
                      setIsTestingTvStream(false);
                    }}
                    placeholder="https://.../index.m3u8 or https://youtube.com/live/... or https://youtu.be/..."
                    className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white font-mono-tabular placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E63926]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Backup Stream URL (optional — auto-offered if primary stalls)
                  </label>
                  <input
                    type="text"
                    value={tvBackupInput}
                    onChange={(e) => setTvBackupInput(e.target.value)}
                    placeholder="Optional fallback .m3u8 or YouTube link"
                    className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white font-mono-tabular placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E63926]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={!liveTvStreamPreview?.ok}
                    onClick={() => setIsTestingTvStream((v) => !v)}
                    className="min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/18 disabled:opacity-40 border border-white/15 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 text-[#F59E0B] fill-current" />
                    <span>
                      {isTestingTvStream ? 'Close Stream Preview' : '▶️ Test Stream Before Saving'}
                    </span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingTvChannel}
                    className="min-h-[44px] px-5 rounded-xl bg-[#E63926] hover:bg-[#D62E1C] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                  >
                    <PlusCircle className="w-4 h-4 shrink-0" />
                    <span>{isSavingTvChannel ? 'Publishing Channel...' : 'Save Live TV Channel'}</span>
                  </button>
                </div>

                {isTestingTvStream && liveTvStreamPreview?.ok && liveTvStreamPreview.streamUrl && (
                  <div className="rounded-2xl bg-black/80 border border-[#F59E0B]/40 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#FDE68A]">
                        Live Stream Tester ({liveTvStreamPreview.type === 'hls' ? 'HLS.js' : 'YouTube Embed'}) ·{' '}
                        {tvTestStatus === 'playing'
                          ? '🟢 Stream Active'
                          : tvTestStatus === 'error'
                          ? '🔴 Load Failed'
                          : '🟡 Connecting...'}
                      </span>
                      {liveTvStreamPreview.watchUrl && (
                        <a
                          href={liveTvStreamPreview.watchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-white hover:text-[#FDE68A] inline-flex items-center gap-1"
                        >
                          <span>Open Live ↗</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="w-full max-w-md aspect-video rounded-xl overflow-hidden bg-black border border-white/15">
                      {liveTvStreamPreview.type === 'hls' ? (
                        <video
                          ref={tvTestVideoRef}
                          controls
                          autoPlay
                          playsInline
                          className="w-full h-full object-contain bg-black"
                        />
                      ) : (
                        <iframe
                          src={liveTvStreamPreview.streamUrl}
                          title="Stream Tester Preview"
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          referrerPolicy="strict-origin-when-cross-origin"
                          onLoad={() => {
                            setTvTestStatus('playing');
                            setTvTestError('');
                          }}
                          onError={() => {
                            setTvTestStatus('error');
                            setTvTestError('YouTube preview blocked in iframe.');
                          }}
                        />
                      )}
                    </div>

                    {tvTestError && <p className="text-[11px] text-red-300">{tvTestError}</p>}
                  </div>
                )}
              </form>
            </div>

            {pendingTvSubmissions.length > 0 && (
              <div className="rounded-2xl bg-[#14161C] border border-[#F59E0B]/35 p-4 space-y-3">
                <p className="text-xs font-bold text-[#FDE68A]">
                  Pending Reporter TV Submissions ({pendingTvSubmissions.length})
                </p>
                <div className="space-y-2">
                  {pendingTvSubmissions.map((sub) => (
                    <div
                      key={sub.id}
                      className="rounded-xl bg-black/45 border border-white/10 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display font-bold text-sm text-white">
                            {sub.name}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                            📍 {sub.district}
                          </span>
                          <span className="text-[10px] font-mono-tabular px-1.5 py-0.5 rounded bg-white/10 text-amber-200">
                            {sub.type.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          Submitted by {sub.reporterName} ({sub.reporterId}) · {sub.streamUrl}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            void onApproveTvSubmission(sub);
                            setAdminActionToast(`Approved "${sub.name}" for ${sub.district}.`);
                          }}
                          className="min-h-[36px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void onRejectTvSubmission(sub.id);
                            setAdminActionToast(`Rejected TV link "${sub.name}".`);
                          }}
                          className="min-h-[36px] px-3 rounded-lg bg-red-600/20 hover:bg-red-600/35 border border-red-500/40 text-red-200 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-400 px-1">
                Active Broadcast Channels ({liveTvChannels.length})
              </p>
              {liveTvChannels.map((ch) => {
                const streamKind = inferLiveTvStreamType(ch.streamUrl, ch.type);
                return (
                <div
                  key={ch.id}
                  className="rounded-xl bg-[#14161C] border border-white/10 p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="font-display font-bold text-sm text-white truncate">
                        {ch.name}
                      </span>
                      <span className="text-[10px] font-mono-tabular font-bold px-1.5 py-0.5 rounded bg-white/10 text-emerald-300 shrink-0">
                        {streamKind === 'hls' ? 'HLS' : 'YT'}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-200 shrink-0">
                        {ch.district ||
                          (ch.category === 'local'
                            ? 'ALL_BIHAR'
                            : ch.category === 'national'
                            ? 'NATIONAL'
                            : 'INTERNATIONAL')}
                      </span>
                    </div>
                    <p className="font-mono-tabular text-[11px] text-zinc-400 truncate mt-0.5">
                      {ch.streamUrl}
                    </p>
                  </div>

                  {ch.isCustom ? (
                    <button
                      type="button"
                      onClick={() => {
                        void onDeleteLiveTvChannel(ch.id, ch.district);
                        setAdminActionToast(`Removed custom channel "${ch.name}".`);
                      }}
                      className="min-h-[38px] px-3 rounded-xl bg-red-600/20 hover:bg-red-600/35 border border-red-500/40 text-xs font-semibold text-red-200 inline-flex items-center gap-1.5 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-zinc-500 shrink-0">Default</span>
                  )}
                </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 4: MONETIZATION & ADS MANAGER */}
        {adminTab === 'ads' && (
          <section className="space-y-4">
            {/* Section A: Create Local Business Sponsor Ad */}
            <div className="rounded-2xl bg-[#14161C] border border-white/12 p-4 sm:p-5 space-y-4">
              <div>
                <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-[#F59E0B]" />
                  <span>Section A · Create Local Business Sponsor Ad</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Target any of the 38 Bihar districts (or ALL BIHAR) with a 320x60 banner or full-screen Sponsored Reel card synced to Firebase RTDB.
                </p>
              </div>

              {adFormError && (
                <div className="rounded-xl bg-red-950/50 border border-red-500/40 px-3.5 py-2.5 text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{adFormError}</span>
                </div>
              )}

              {adFormSuccess && (
                <div className="rounded-xl bg-emerald-950/50 border border-emerald-500/40 px-3.5 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{adFormSuccess}</span>
                </div>
              )}

              <form onSubmit={handleAddLocalAdSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Target District
                    </label>
                    <select
                      value={adDistrict}
                      onChange={(e) => setAdDistrict(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                    >
                      <option value="ALL BIHAR" className="bg-[#14161C]">
                        ALL BIHAR (Statewide Network)
                      </option>
                      <optgroup label="BIHAR (All 38 Districts)" className="bg-[#14161C]">
                        {biharDistricts.map((d) => (
                          <option key={d.id} value={d.id} className="bg-[#14161C]">
                            {d.id}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Major Metros" className="bg-[#14161C]">
                        {metroDistricts.map((d) => (
                          <option key={d.id} value={d.id} className="bg-[#14161C]">
                            {d.id}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Ad Format
                    </label>
                    <select
                      value={adFormat}
                      onChange={(e) => setAdFormat(e.target.value as AdFormat)}
                      className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                    >
                      <option value="banner" className="bg-[#14161C]">
                        Banner Ad (Zila &amp; Live TV Tab)
                      </option>
                      <option value="reel" className="bg-[#14161C]">
                        Sponsored Full-Screen Reel Card (Every 5th Reel)
                      </option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Business Name
                    </label>
                    <input
                      type="text"
                      value={adBusinessName}
                      onChange={(e) => setAdBusinessName(e.target.value)}
                      placeholder="e.g. Apex Coaching Muzaffarpur"
                      className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Offer Tagline
                    </label>
                    <input
                      type="text"
                      value={adTagline}
                      onChange={(e) => setAdTagline(e.target.value)}
                      placeholder="e.g. Admissions Open · 25% Scholarship"
                      className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Banner Image URL or Vertical Promo Video URL (optional)
                  </label>
                  <input
                    type="text"
                    value={adMediaUrl}
                    onChange={(e) => setAdMediaUrl(e.target.value)}
                    placeholder="https://...jpg or /videos/reel_muzaffarpur.mp4"
                    className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white font-mono-tabular placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Call Now Phone Number (tel:)
                    </label>
                    <input
                      type="tel"
                      value={adPhone}
                      onChange={(e) => setAdPhone(e.target.value)}
                      placeholder="+919835011223"
                      className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white font-mono-tabular placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      WhatsApp Inquiry Number (wa.me/)
                    </label>
                    <input
                      type="text"
                      value={adWhatsapp}
                      onChange={(e) => setAdWhatsapp(e.target.value)}
                      placeholder="919835011223"
                      className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white font-mono-tabular placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingLocalAd}
                  className="min-h-[44px] px-5 rounded-xl bg-[#F59E0B] hover:bg-amber-400 disabled:opacity-50 text-black text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors"
                >
                  <PlusCircle className="w-4 h-4 shrink-0" />
                  <span>{isSavingLocalAd ? 'Publishing Sponsor Ad...' : 'Publish Local Sponsor Ad'}</span>
                </button>
              </form>
            </div>

            {/* Active / Paused Local Ads Inventory & Live Analytics */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-zinc-400 px-1">
                Local Business Sponsor Campaigns ({localAds.length})
              </p>
              {localAds.length === 0 ? (
                <div className="rounded-2xl bg-[#14161C] border border-white/10 p-6 text-center text-xs text-zinc-400">
                  No local sponsor ads configured yet. Create your first district campaign above.
                </div>
              ) : (
                localAds.map((ad) => (
                  <div
                    key={ad.id}
                    className="rounded-2xl bg-[#14161C] border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-sm text-white truncate">
                          {ad.businessName}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/35">
                          {ad.district}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white/10 text-zinc-200">
                          {ad.format === 'reel' ? 'Reel Card (Every 5th)' : 'Banner 320×60'}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            ad.active
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                              : 'bg-zinc-700/40 text-zinc-300 border border-white/10'
                          }`}
                        >
                          {ad.active ? 'Active' : 'Paused'}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 truncate">{ad.tagline}</p>

                      <div className="flex items-center gap-3 flex-wrap text-[11px] text-zinc-300 pt-0.5">
                        <span className="font-mono-tabular inline-flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5 text-[#F59E0B]" />
                          <strong>{ad.impressions}</strong> Views
                        </span>
                        <span className="font-mono-tabular inline-flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <strong>{ad.clicks}</strong> Clicks
                        </span>
                        {ad.whatsapp && (
                          <span className="font-mono-tabular text-zinc-400 inline-flex items-center gap-1">
                            <MessageCircle className="w-3 h-3 text-emerald-400" />
                            <span>{ad.whatsapp}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          void onToggleLocalAd(ad);
                          setAdminActionToast(
                            `${ad.active ? 'Paused' : 'Activated'} "${ad.businessName}".`
                          );
                        }}
                        className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors ${
                          ad.active
                            ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-200'
                            : 'bg-emerald-600/20 hover:bg-emerald-600/35 border-emerald-500/40 text-emerald-200'
                        }`}
                      >
                        {ad.active ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Activate</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void onDeleteLocalAd(ad);
                          setAdminActionToast(`Deleted sponsor ad "${ad.businessName}".`);
                        }}
                        className="min-h-[38px] px-3 rounded-xl bg-red-600/20 hover:bg-red-600/35 border border-red-500/40 text-xs font-semibold text-red-200 inline-flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Section B: Google AdSense / AdMob Config */}
            <div className="rounded-2xl bg-[#14161C] border border-white/12 p-4 sm:p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-base text-white">
                    Section B · Google AdSense / AdMob Config
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Displayed automatically in Zila &amp; Live TV banner slots when no active local business sponsor matches the district.
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={adNetEnabled}
                  aria-label="Enable Google Ads"
                  onClick={() => setAdNetEnabled((v) => !v)}
                  className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold border shrink-0 transition-colors ${
                    adNetEnabled
                      ? 'bg-emerald-500 text-black border-emerald-400'
                      : 'bg-white/8 text-zinc-300 border-white/15'
                  }`}
                >
                  {adNetEnabled ? 'Google Ads: ON' : 'Google Ads: OFF'}
                </button>
              </div>

              {adNetError && (
                <div className="rounded-xl bg-red-950/50 border border-red-500/40 px-3.5 py-2.5 text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{adNetError}</span>
                </div>
              )}

              {adNetSuccess && (
                <div className="rounded-xl bg-emerald-950/50 border border-emerald-500/40 px-3.5 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{adNetSuccess}</span>
                </div>
              )}

              <form onSubmit={handleSaveAdNetworkSubmit} className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      AdSense Publisher ID
                    </label>
                    <input
                      type="text"
                      value={adsensePublisherId}
                      onChange={(e) => setAdsensePublisherId(e.target.value)}
                      placeholder="ca-pub-XXXXXXXXXXXXXXXX"
                      className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white font-mono-tabular placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Banner Ad Slot ID
                    </label>
                    <input
                      type="text"
                      value={adsenseBannerSlotId}
                      onChange={(e) => setAdsenseBannerSlotId(e.target.value)}
                      placeholder="1234567890"
                      className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white font-mono-tabular placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      AdMob App / Banner Unit ID
                    </label>
                    <input
                      type="text"
                      value={admobUnitId}
                      onChange={(e) => setAdmobUnitId(e.target.value)}
                      placeholder="ca-app-pub-XXXX/YYYY"
                      className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white font-mono-tabular placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingAdConfig}
                  className="min-h-[44px] px-5 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-50 text-black text-xs sm:text-sm font-bold transition-colors"
                >
                  {isSavingAdConfig
                    ? 'Saving Ad Network Config...'
                    : 'Save Google AdSense / AdMob Config'}
                </button>
              </form>
            </div>
          </section>
        )}

        {/* TAB 5: SECURITY & CREDENTIALS */}
        {adminTab === 'security' && (
          <section className="rounded-2xl bg-[#14161C] border border-white/12 p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display font-bold text-base text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#F59E0B]" />
                  <span>Chief Editor Security &amp; Credentials</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Rotate your Unique Admin ID and Password. Credentials are salted and hashed on the server and never exposed in browser storage.
                </p>
              </div>
              <span className="font-mono-tabular text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 shrink-0">
                {session.adminId}
              </span>
            </div>

            {adminAuthStatus?.envOverride && (
              <div className="rounded-xl bg-amber-950/40 border border-amber-500/40 px-3.5 py-2.5 text-xs text-amber-200">
                Admin credentials are currently enforced via server environment variables (`ADMIN_ID` / `ADMIN_PASSWORD`). Update them in Settings &gt; Secrets to rotate.
              </div>
            )}

            {secError && (
              <div className="rounded-xl bg-red-950/50 border border-red-500/40 px-3.5 py-2.5 text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{secError}</span>
              </div>
            )}

            {secSuccess && (
              <div className="rounded-xl bg-emerald-950/50 border border-emerald-500/40 px-3.5 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{secSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSecurityUpdateSubmit} className="space-y-3 pt-2 border-t border-white/10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Current Admin Password
                  </label>
                  <div className="relative">
                    <input
                      type={showSecCurrent ? 'text' : 'password'}
                      value={secCurrentPassword}
                      onChange={(e) => setSecCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      autoComplete="current-password"
                      disabled={Boolean(adminAuthStatus?.envOverride)}
                      className="w-full min-h-[44px] pl-3 pr-10 rounded-xl bg-black/45 border border-white/12 text-sm text-white placeholder:text-zinc-500 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecCurrent((v) => !v)}
                      aria-label={showSecCurrent ? 'Hide current password' : 'Show current password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                    >
                      {showSecCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    New Unique Admin ID
                  </label>
                  <input
                    type="text"
                    value={secNewAdminId}
                    onChange={(e) => setSecNewAdminId(e.target.value.toUpperCase())}
                    placeholder="CHIEF-BIHAR-01"
                    disabled={Boolean(adminAuthStatus?.envOverride)}
                    className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white font-mono-tabular placeholder:text-zinc-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    New Admin Password (min 8 chars)
                  </label>
                  <div className="relative">
                    <input
                      type={showSecNew ? 'text' : 'password'}
                      value={secNewPassword}
                      onChange={(e) => setSecNewPassword(e.target.value)}
                      placeholder="Create strong password"
                      autoComplete="new-password"
                      disabled={Boolean(adminAuthStatus?.envOverride)}
                      className="w-full min-h-[44px] pl-3 pr-10 rounded-xl bg-black/45 border border-white/12 text-sm text-white placeholder:text-zinc-500 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecNew((v) => !v)}
                      aria-label={showSecNew ? 'Hide new password' : 'Show new password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                    >
                      {showSecNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showSecConfirm ? 'text' : 'password'}
                      value={secConfirmPassword}
                      onChange={(e) => setSecConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                      disabled={Boolean(adminAuthStatus?.envOverride)}
                      className="w-full min-h-[44px] pl-3 pr-10 rounded-xl bg-black/45 border border-white/12 text-sm text-white placeholder:text-zinc-500 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecConfirm((v) => !v)}
                      aria-label={showSecConfirm ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                    >
                      {showSecConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingSecurity || Boolean(adminAuthStatus?.envOverride)}
                className="min-h-[44px] px-5 rounded-xl bg-[#F59E0B] hover:bg-amber-400 disabled:opacity-50 text-black text-xs sm:text-sm font-bold transition-colors"
              >
                {isSavingSecurity ? 'Updating Credentials...' : 'Update Admin ID & Password'}
              </button>
            </form>
          </section>
        )}
      </div>
    );
  }

  // ============================================================================
  // 3. ROLE SWITCHER & LOGIN PORTAL SCREEN
  // ============================================================================
  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 pt-20 pb-24 lg:pt-24 lg:pb-12 space-y-5 overflow-x-hidden">
      <div className="rounded-2xl bg-[#14161C] border border-white/12 p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-xl text-white">
              Khabar Nama Newsroom Portal
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Sign in as a District Reporter to file local dispatches or as Chief Editor to moderate live Bihar feeds.
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#E63926]/15 border border-[#E63926]/40 text-[#E63926] flex items-center justify-center shrink-0">
            <BadgeCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Role Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-black/50 border border-white/10">
          <button
            type="button"
            onClick={() => {
              setLoginRoleTab('reporter');
              setAuthError('');
              setAuthSuccess('');
            }}
            className={`min-h-[44px] px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
              loginRoleTab === 'reporter'
                ? 'bg-[#E63926] text-white'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <BadgeCheck className="w-4 h-4 shrink-0" />
            <span>District Reporter</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginRoleTab('admin');
              setAuthError('');
              setAuthSuccess('');
            }}
            className={`min-h-[44px] px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
              loginRoleTab === 'admin'
                ? 'bg-[#F59E0B] text-black'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Chief Editor / Admin</span>
          </button>
        </div>

        {authError && (
          <div className="rounded-xl bg-red-950/50 border border-red-500/40 px-3.5 py-2.5 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{authError}</span>
          </div>
        )}

        {authSuccess && (
          <div className="rounded-xl bg-emerald-950/50 border border-emerald-500/40 px-3.5 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{authSuccess}</span>
          </div>
        )}

        {loginRoleTab === 'reporter' ? (
          <div className="space-y-4">
            {/* 1-Tap Demo Reporter Buttons */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-zinc-400">
                1-Tap Demo Reporter Login
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemoReporter('MUZ', 'RAH1998')}
                  className="min-h-[46px] px-3.5 py-2.5 rounded-xl bg-white/8 hover:bg-white/14 border border-white/12 text-left transition-colors"
                >
                  <p className="text-xs font-bold text-white">Muzaffarpur Reporter</p>
                  <p className="font-mono-tabular text-[11px] text-[#FDE68A]">
                    Login ID: MUZ · Password: RAH1998
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoReporter('PAT', 'PRI2000')}
                  className="min-h-[46px] px-3.5 py-2.5 rounded-xl bg-white/8 hover:bg-white/14 border border-white/12 text-left transition-colors"
                >
                  <p className="text-xs font-bold text-white">Patna Reporter</p>
                  <p className="font-mono-tabular text-[11px] text-[#FDE68A]">
                    Login ID: PAT · Password: PRI2000
                  </p>
                </button>
              </div>
            </div>

            {!showRegisterForm ? (
              <form onSubmit={handleReporterLoginSubmit} className="space-y-3 pt-2 border-t border-white/10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Login ID (First 3 Letters of District)
                    </label>
                    <input
                      type="text"
                      maxLength={3}
                      value={loginDistrictId}
                      onChange={(e) =>
                        setLoginDistrictId(
                          e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase()
                        )
                      }
                      placeholder="MUZ"
                      autoComplete="username"
                      className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white placeholder:text-zinc-500 font-mono-tabular uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-[#E63926]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Login Password (Name3 + Birth Year)
                    </label>
                    <div className="relative">
                      <input
                        type={showReporterPassword ? 'text' : 'password'}
                        maxLength={7}
                        value={loginPassword}
                        onChange={(e) =>
                          setLoginPassword(
                            e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 7).toUpperCase()
                          )
                        }
                        placeholder="RAH1998"
                        autoComplete="current-password"
                        className="w-full min-h-[44px] pl-3 pr-10 rounded-xl bg-black/45 border border-white/12 text-sm text-white placeholder:text-zinc-500 font-mono-tabular uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[#E63926]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowReporterPassword((v) => !v)}
                        aria-label={
                          showReporterPassword ? 'Hide reporter password' : 'Show reporter password'
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                      >
                        {showReporterPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[46px] rounded-xl bg-[#E63926] hover:bg-[#D62E1C] text-white text-sm font-semibold transition-colors"
                >
                  Login as District Reporter
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowRegisterForm(true);
                    setAuthError('');
                    setAuthSuccess('');
                  }}
                  className="w-full min-h-[44px] rounded-xl bg-white/6 hover:bg-white/12 border border-white/12 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <UserPlus className="w-4 h-4 text-[#F59E0B]" />
                  <span>Register New District Reporter (38 Bihar Districts)</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display font-bold text-sm text-white">
                    New District Reporter Registration
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowRegisterForm(false)}
                    className="text-xs text-zinc-400 hover:text-white font-medium"
                  >
                    Back to Login
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Rahul Thakur"
                      autoComplete="name"
                      className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white placeholder:text-zinc-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Assigned Bihar District
                    </label>
                    <select
                      value={regDistrict}
                      onChange={(e) =>
                        setRegDistrict(e.target.value as Exclude<DistrictId, 'All'>)
                      }
                      className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white"
                    >
                      <optgroup label="BIHAR (All 38 Districts)" className="bg-[#14161C]">
                        {biharDistricts.map((d) => (
                          <option key={d.id} value={d.id} className="bg-[#14161C]">
                            {d.id}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Major Metros" className="bg-[#14161C]">
                        {metroDistricts.map((d) => (
                          <option key={d.id} value={d.id} className="bg-[#14161C]">
                            {d.id}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Year of Birth (YYYY)
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1960}
                      max={2008}
                      value={regBirthYear}
                      onChange={(e) =>
                        setRegBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))
                      }
                      placeholder="1998"
                      autoComplete="bday-year"
                      className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white font-mono-tabular placeholder:text-zinc-500"
                    />
                  </div>
                </div>

                {/* Live Derived Login ID & Password Preview Badge */}
                <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/35 px-3.5 py-2.5 text-xs text-emerald-100 flex items-center justify-between gap-2 flex-wrap">
                  <span>
                    Login ID:{' '}
                    <strong className="font-mono-tabular text-[#FDE68A]">
                      {deriveDistrictCode3(String(regDistrict))}
                    </strong>{' '}
                    · Password:{' '}
                    <strong className="font-mono-tabular text-[#FDE68A]">
                      {(deriveReporterName3(regName) || 'NAME3') + (regBirthYear || 'YYYY')}
                    </strong>
                  </span>
                  <span className="font-mono-tabular text-[11px] px-2 py-0.5 rounded bg-black/45 text-emerald-300 border border-emerald-400/25">
                    {deriveDistrictCode3(String(regDistrict))} /{' '}
                    {deriveReporterName3(regName) && regBirthYear
                      ? `${deriveReporterName3(regName)}${regBirthYear}`
                      : 'RAH1998'}
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[46px] rounded-xl bg-[#F59E0B] hover:bg-amber-400 text-black text-sm font-bold transition-colors"
                >
                  Submit Reporter Registration
                </button>
              </form>
            )}
          </div>
        ) : adminAuthStatus && !adminAuthStatus.configured ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-950/35 border border-amber-500/35 px-3.5 py-2.5 text-xs text-amber-100 space-y-1">
              <p className="font-semibold text-[#FDE68A] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>First-Run Chief Editor Setup</span>
              </p>
              <p className="text-zinc-300 leading-relaxed">
                No Chief Editor account is claimed yet. Create your Unique Admin ID and a strong password to lock down editorial controls.
              </p>
            </div>

            <form onSubmit={handleAdminSetupSubmit} className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Choose Unique Admin ID
                </label>
                <input
                  type="text"
                  value={setupAdminId}
                  onChange={(e) => setSetupAdminId(e.target.value.toUpperCase())}
                  placeholder="CHIEF-BIHAR-01"
                  autoComplete="username"
                  className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white font-mono-tabular placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Create Admin Password (min 8 chars)
                  </label>
                  <div className="relative">
                    <input
                      type={showSetupPassword ? 'text' : 'password'}
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      placeholder="Strong password"
                      autoComplete="new-password"
                      className="w-full min-h-[44px] pl-3 pr-10 rounded-xl bg-black/45 border border-white/12 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetupPassword((v) => !v)}
                      aria-label={showSetupPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                    >
                      {showSetupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Confirm Admin Password
                  </label>
                  <div className="relative">
                    <input
                      type={showSetupConfirmPassword ? 'text' : 'password'}
                      value={setupConfirmPassword}
                      onChange={(e) => setSetupConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      className="w-full min-h-[44px] pl-3 pr-10 rounded-xl bg-black/45 border border-white/12 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetupConfirmPassword((v) => !v)}
                      aria-label={showSetupConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                    >
                      {showSetupConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAdminSubmitting}
                className="w-full min-h-[46px] rounded-xl bg-[#F59E0B] hover:bg-amber-400 disabled:opacity-50 text-black text-sm font-bold transition-colors"
              >
                {isAdminSubmitting
                  ? 'Initializing Chief Editor Desk...'
                  : 'Claim & Open Chief Editor Desk'}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>Restricted Editorial Access</span>
              </span>
              {adminAuthStatus && adminAuthStatus.failedAttempts > 0 && lockoutRemainingSec === 0 && (
                <span className="font-mono-tabular text-amber-300">
                  Failed attempts: {adminAuthStatus.failedAttempts}/{adminAuthStatus.maxAttempts}
                </span>
              )}
            </div>

            {lockoutRemainingSec > 0 && (
              <div className="rounded-xl bg-red-950/60 border border-red-500/50 px-3.5 py-2.5 text-xs font-semibold text-red-200 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
                <span>Too many failed attempts. Locked for {lockoutRemainingSec}s</span>
              </div>
            )}

            <form onSubmit={handleAdminLoginSubmit} className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Unique Admin ID
                  </label>
                  <input
                    type="text"
                    value={adminIdInput}
                    onChange={(e) => setAdminIdInput(e.target.value.toUpperCase())}
                    placeholder="CHIEF-ADMIN-01"
                    autoComplete="username"
                    disabled={lockoutRemainingSec > 0 || isAdminSubmitting}
                    className="w-full min-h-[44px] px-3 rounded-xl bg-black/45 border border-white/12 text-sm text-white font-mono-tabular placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F59E0B] disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Admin Password
                  </label>
                  <div className="relative">
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      value={adminPasswordInput}
                      onChange={(e) => setAdminPasswordInput(e.target.value)}
                      placeholder="Enter Admin Password"
                      autoComplete="current-password"
                      disabled={lockoutRemainingSec > 0 || isAdminSubmitting}
                      className="w-full min-h-[44px] pl-3 pr-10 rounded-xl bg-black/45 border border-white/12 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F59E0B] disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword((v) => !v)}
                      aria-label={showAdminPassword ? 'Hide admin password' : 'Show admin password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                    >
                      {showAdminPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={lockoutRemainingSec > 0 || isAdminSubmitting}
                className="w-full min-h-[46px] rounded-xl bg-white text-black hover:bg-zinc-200 disabled:opacity-45 disabled:cursor-not-allowed text-sm font-bold transition-colors"
              >
                {lockoutRemainingSec > 0
                  ? `Too many failed attempts. Locked for ${lockoutRemainingSec}s`
                  : isAdminSubmitting
                  ? 'Verifying Credentials...'
                  : 'Open Chief Editor Control Room'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
