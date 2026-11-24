import { Check, Copy, ExternalLink, MessageCircle, X } from 'lucide-react';
import { useState } from 'react';
import { LanguageCode, NewsReel } from '../types';

interface WhatsAppShareSheetProps {
  reel: NewsReel | null;
  language: LanguageCode;
  onClose: () => void;
  onShared: (reelId: string) => void;
}

export function WhatsAppShareSheet({ reel, language, onClose, onShared }: WhatsAppShareSheetProps) {
  const [copied, setCopied] = useState(false);

  if (!reel) return null;

  const shareText = `Khabar Nama (${reel.district} · ${reel.wardOrZone})\n${reel.headline[language]}\n\n${reel.caption[language]}\n\nVerified Dispatch: ${reel.verification.dispatchId}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      onShared(reel.id);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share on WhatsApp"
    >
      <div
        className="w-full sm:max-w-md bg-[#14161C] border border-white/12 rounded-t-3xl sm:rounded-3xl p-5 pb-7 sm:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#16A34A]/20 border border-[#16A34A]/40 flex items-center justify-center text-emerald-400">
              <MessageCircle className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-display font-bold text-base text-white">Share Local Dispatch</h3>
              <p className="text-xs text-zinc-400">Formatted for WhatsApp groups</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share sheet"
            className="min-w-[40px] min-h-[40px] rounded-full bg-white/8 hover:bg-white/15 text-zinc-300 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-2xl bg-black/45 border border-white/10 p-3.5 text-xs text-zinc-200 whitespace-pre-line leading-relaxed mb-4">
          {shareText}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Copy Message'}</span>
          </button>

          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onShared(reel.id)}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <span>Open WhatsApp</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
