import { CheckCircle2, MapPin, ShieldCheck, X } from 'lucide-react';
import { LanguageCode, NewsReel } from '../types';

interface VerifySourceModalProps {
  reel: NewsReel | null;
  language: LanguageCode;
  onClose: () => void;
}

export function VerifySourceModal({ reel, language, onClose }: VerifySourceModalProps) {
  if (!reel) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Verify Source"
    >
      <div
        className="w-full sm:max-w-md bg-[#14161C] border border-white/12 rounded-t-3xl sm:rounded-3xl p-5 pb-7 sm:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 flex items-center justify-center text-[#F59E0B]">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-display font-bold text-base text-white">Source Verification</h3>
              <p className="font-mono-tabular text-xs text-zinc-400">{reel.verification.dispatchId}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close verification"
            className="min-w-[40px] min-h-[40px] rounded-full bg-white/8 hover:bg-white/15 text-zinc-300 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-zinc-200 leading-relaxed mb-4">
          {reel.verification.factCheckSummary[language]}
        </p>

        <div className="space-y-3 border-t border-white/10 pt-4 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-zinc-400">Primary Agency</span>
            <span className="text-white font-medium text-right">{reel.verification.agency}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-400">Correspondent</span>
            <span className="text-white font-medium text-right">
              {reel.verification.fieldCorrespondent}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-400">Verified Time</span>
            <span className="text-white font-medium text-right">{reel.verification.verifiedAt}</span>
          </div>
          <div className="flex justify-between gap-4 items-center">
            <span className="text-zinc-400">Coordinates</span>
            <span className="font-mono-tabular text-zinc-200 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#E63926]" />
              {reel.verification.coordinates}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-[11px] font-medium text-zinc-400 mb-2">Corroborated Records</p>
          <div className="space-y-1.5">
            {reel.verification.corroboratedBy.map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
