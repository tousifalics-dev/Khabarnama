import { ChevronUp, MapPin, Megaphone, MessageCircle, Phone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { LocalAd } from '../types';
import { formatTelHref, formatWhatsAppHref } from './SponsoredBanner';

interface SponsoredReelCardProps {
  ad: LocalAd;
  isActive: boolean;
  onTrackAd: (ad: LocalAd, eventType: 'impression' | 'click') => void;
  onSwipeNext?: () => void;
}

export function SponsoredReelCard({
  ad,
  isActive,
  onTrackAd,
  onSwipeNext,
}: SponsoredReelCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const impressionSentRef = useRef(false);

  useEffect(() => {
    setImgFailed(false);
  }, [ad.id, ad.mediaUrl]);

  useEffect(() => {
    if (isActive && !impressionSentRef.current) {
      impressionSentRef.current = true;
      onTrackAd(ad, 'impression');
    }
  }, [isActive, ad, onTrackAd]);

  const telHref = formatTelHref(ad.phone);
  const waHref = formatWhatsAppHref(ad.whatsapp, ad.businessName);

  return (
    <article
      aria-label={`Sponsored reel by ${ad.businessName}`}
      className="reel-snap-item relative w-full max-w-full h-full overflow-hidden bg-[#0D1017] select-none"
    >
      {/* Background Media Layer */}
      {ad.mediaUrl && ad.mediaType === 'video' ? (
        <video
          src={ad.mediaUrl}
          autoPlay={isActive}
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      ) : ad.mediaUrl && !imgFailed ? (
        <img
          src={ad.mediaUrl}
          alt={ad.businessName}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#231914] via-[#131722] to-[#0A0B0E] flex items-center justify-center">
          <Megaphone className="w-20 h-20 text-[#F59E0B]/25" />
        </div>
      )}

      {/* High-Contrast Broadcast Scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/60 pointer-events-none" />

      {/* Content Safe Area */}
      <div className="relative z-10 h-full w-full flex flex-col justify-between px-4 pt-[calc(max(10px,env(safe-area-inset-top))+94px)] pb-[calc(4.6rem+env(safe-area-inset-bottom))] lg:pt-6 lg:pb-6">
        {/* Top Sponsor Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/75 border border-[#F59E0B]/50 text-[10.5px] font-bold tracking-wider uppercase text-[#FDE68A]">
            <Megaphone className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
            <span>SPONSORED • LOCAL PARTNER</span>
          </div>

          {onSwipeNext && (
            <button
              type="button"
              onClick={onSwipeNext}
              className="min-h-[34px] px-2.5 py-1 rounded-full bg-black/70 hover:bg-black/90 border border-white/20 text-[11px] font-medium text-zinc-200 inline-flex items-center gap-1 shrink-0 transition-colors"
            >
              <span>Skip Ad</span>
              <ChevronUp className="w-3.5 h-3.5 text-[#F59E0B]" />
            </button>
          )}
        </div>

        {/* Bottom Sponsor CTA Card */}
        <div className="space-y-3.5 rounded-2xl bg-black/75 backdrop-blur-md border border-white/15 p-4 shadow-2xl">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-[#FDE68A] font-medium">
              <MapPin className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
              <span>{ad.district} Local Partner</span>
            </div>
            <h2 className="font-display font-bold text-xl sm:text-2xl text-white leading-snug">
              {ad.businessName}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">{ad.tagline}</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {telHref !== '#' && (
              <a
                href={telHref}
                onClick={() => onTrackAd(ad, 'click')}
                className="min-h-[48px] px-3 py-2.5 rounded-xl bg-[#E63926] hover:bg-[#D62E1C] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#E63926]/25 transition-colors"
              >
                <Phone className="w-4 h-4 shrink-0" />
                <span>📞 Call Now</span>
              </a>
            )}
            {waHref !== '#' && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onTrackAd(ad, 'click')}
                className={`min-h-[48px] px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-colors ${
                  telHref === '#' ? 'col-span-2' : ''
                }`}
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>💬 WhatsApp</span>
              </a>
            )}
          </div>

          <p className="text-[11px] text-zinc-400 text-center">
            Swipe up anytime to continue to the next news bulletin
          </p>
        </div>
      </div>
    </article>
  );
}
