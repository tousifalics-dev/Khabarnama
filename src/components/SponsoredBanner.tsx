import { MessageCircle, Megaphone, Phone } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdNetworkConfig, DistrictId, LocalAd } from '../types';

interface SponsoredBannerProps {
  localAds: LocalAd[];
  adNetworkConfig: AdNetworkConfig;
  selectedDistrict: DistrictId;
  placementLabel?: string;
  onTrackAd: (ad: LocalAd, eventType: 'impression' | 'click') => void;
}

export function formatTelHref(rawPhone: string): string {
  const clean = rawPhone.replace(/[^+\d]/g, '');
  return clean ? `tel:${clean}` : '#';
}

export function formatWhatsAppHref(rawWhatsapp: string, businessName?: string): string {
  const trimmed = rawWhatsapp.trim();
  if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(trimmed)) {
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '#';
  const fullDigits = digits.length === 10 ? `91${digits}` : digits;
  const textParam = businessName
    ? `?text=${encodeURIComponent(`Hi ${businessName}, saw your ad on Khabar Nama`)}`
    : '';
  return `https://wa.me/${fullDigits}${textParam}`;
}

export function pickLocalAdForDistrict(
  ads: LocalAd[],
  format: LocalAd['format'],
  selectedDistrict: DistrictId
): LocalAd | null {
  const activeMatchingFormat = ads.filter((a) => a.active && a.format === format);
  if (activeMatchingFormat.length === 0) return null;

  const target = String(selectedDistrict).trim().toLowerCase();
  if (target && target !== 'all') {
    const exact = activeMatchingFormat.find((a) => a.district.trim().toLowerCase() === target);
    if (exact) return exact;
  }
  const allBihar = activeMatchingFormat.find(
    (a) => a.district.trim().toUpperCase() === 'ALL BIHAR'
  );
  return allBihar || (target === 'all' ? activeMatchingFormat[0] : null);
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function SponsoredBanner({
  localAds,
  adNetworkConfig,
  selectedDistrict,
  placementLabel = 'Sponsored',
  onTrackAd,
}: SponsoredBannerProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const trackedAdIdsRef = useRef<Set<string>>(new Set());

  const activeBannerAd = useMemo(
    () => pickLocalAdForDistrict(localAds, 'banner', selectedDistrict),
    [localAds, selectedDistrict]
  );

  useEffect(() => {
    setImgFailed(false);
    if (activeBannerAd && !trackedAdIdsRef.current.has(activeBannerAd.id)) {
      trackedAdIdsRef.current.add(activeBannerAd.id);
      onTrackAd(activeBannerAd, 'impression');
    }
  }, [activeBannerAd, onTrackAd]);

  // Inject AdSense script only when enabled and valid publisher ID is configured (and no local sponsor overrides)
  useEffect(() => {
    if (activeBannerAd) return;
    const pubId = adNetworkConfig.adsensePublisherId.trim();
    const slotId = adNetworkConfig.adsenseBannerSlotId.trim();
    if (!adNetworkConfig.enabled || !/^ca-pub-\d{8,}$/.test(pubId) || !slotId) return;

    const scriptId = 'khabarnama-adsense-script';
    if (!document.getElementById(scriptId)) {
      const s = document.createElement('script');
      s.id = scriptId;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
        pubId
      )}`;
      document.head.appendChild(s);
    }

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // Ignore AdSense initialization errors in preview/offline environments
    }
  }, [
    activeBannerAd,
    adNetworkConfig.enabled,
    adNetworkConfig.adsensePublisherId,
    adNetworkConfig.adsenseBannerSlotId,
  ]);

  if (activeBannerAd) {
    const telHref = formatTelHref(activeBannerAd.phone);
    const waHref = formatWhatsAppHref(activeBannerAd.whatsapp, activeBannerAd.businessName);

    return (
      <aside
        aria-label={`Sponsored banner by ${activeBannerAd.businessName}`}
        className="w-full max-w-full min-h-[60px] rounded-xl bg-[#161922] border border-[#F59E0B]/30 px-2.5 py-2 flex items-center justify-between gap-2.5 overflow-hidden shadow-md"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-lg overflow-hidden bg-gradient-to-br from-[#F59E0B]/25 to-[#E63926]/25 border border-white/10 flex items-center justify-center shrink-0">
            {activeBannerAd.mediaUrl &&
            activeBannerAd.mediaType === 'image' &&
            !imgFailed ? (
              <img
                src={activeBannerAd.mediaUrl}
                alt={activeBannerAd.businessName}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <Megaphone className="w-4 h-4 text-[#F59E0B]" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#FDE68A] shrink-0">
                {placementLabel}
              </span>
              <span className="text-[10px] text-zinc-500 shrink-0" aria-hidden="true">
                ·
              </span>
              <span className="text-[10px] text-zinc-400 truncate">
                {activeBannerAd.district}
              </span>
            </div>
            <p className="font-display font-bold text-xs sm:text-[13px] text-white truncate leading-tight">
              {activeBannerAd.businessName}
            </p>
            <p className="text-[10.5px] text-zinc-300 truncate leading-tight">
              {activeBannerAd.tagline}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {telHref !== '#' && (
            <a
              href={telHref}
              onClick={() => onTrackAd(activeBannerAd, 'click')}
              aria-label={`Call ${activeBannerAd.businessName}`}
              className="min-h-[36px] px-2.5 rounded-lg bg-[#E63926] hover:bg-[#D62E1C] text-white text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-colors"
            >
              <Phone className="w-3 h-3 shrink-0" />
              <span>Call</span>
            </a>
          )}
          {waHref !== '#' && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onTrackAd(activeBannerAd, 'click')}
              aria-label={`WhatsApp ${activeBannerAd.businessName}`}
              className="min-h-[36px] px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-colors"
            >
              <MessageCircle className="w-3 h-3 shrink-0" />
              <span className="hidden min-[380px]:inline">WhatsApp</span>
            </a>
          )}
        </div>
      </aside>
    );
  }

  // Fallback to Google AdSense responsive slot when enabled
  if (!adNetworkConfig.enabled) {
    return null;
  }

  const pubId = adNetworkConfig.adsensePublisherId.trim();
  const slotId = adNetworkConfig.adsenseBannerSlotId.trim();
  const hasValidAdSense = /^ca-pub-\d{8,}$/.test(pubId) && slotId.length > 0;

  return (
    <aside
      aria-label="Google AdSense Responsive Banner"
      className="w-full max-w-full min-h-[60px] rounded-xl bg-[#12141A] border border-white/10 px-3 py-2 flex items-center justify-center overflow-hidden"
    >
      {hasValidAdSense ? (
        <ins
          className="adsbygoogle block w-full min-h-[50px]"
          style={{ display: 'block' }}
          data-ad-client={pubId}
          data-ad-slot={slotId}
          data-ad-format="horizontal"
          data-full-width-responsive="true"
        />
      ) : (
        <div className="flex items-center justify-between gap-2 w-full text-[11px] text-zinc-400">
          <span className="truncate">
            Ad Network Enabled · Enter AdSense Publisher &amp; Slot ID in Admin &gt; Ads
          </span>
          <span className="font-mono-tabular text-[10px] text-zinc-500 shrink-0">320×60</span>
        </div>
      )}
    </aside>
  );
}
