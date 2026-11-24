import {
  Camera,
  CheckCircle2,
  Clock,
  Link2,
  Sparkles,
  Square,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DISTRICTS, buildCitizenReel, estimateNarrationDurationSec } from '../data/newsReels';
import { DistrictMeta, NewsReel } from '../types';

interface CitizenReporterModalProps {
  isOpen: boolean;
  defaultDistrict: DistrictMeta['id'];
  districts?: DistrictMeta[];
  initialSourceTab?: VideoSourceTab;
  onClose: () => void;
  onPublishReel: (reel: NewsReel) => void;
}

export type VideoSourceTab = 'upload' | 'url' | 'record';

const CATEGORIES: NewsReel['category'][] = [
  'Citizen Dispatch',
  'Infrastructure',
  'Transit',
  'Weather & Civic',
  'Education',
  'Environment',
  'Clean Energy',
];

const SAMPLE_CLIPS = [
  {
    label: 'Muzaffarpur Orchard',
    imageUrl: '/src/assets/images/news_muzaffarpur_orchard_1795289274953.jpg',
    videoUrl: '/videos/reel_muzaffarpur_orchard.mp4',
  },
  {
    label: 'Patna Riverfront',
    imageUrl: '/src/assets/images/news_patna_riverfront_1795289274314.jpg',
    videoUrl: '/videos/reel_patna_riverfront.mp4',
  },
  {
    label: 'Mumbai E-Bus',
    imageUrl: '/src/assets/images/news_mumbai_ebus_1795289274352.jpg',
    videoUrl: '/videos/reel_mumbai_ebus.mp4',
  },
  {
    label: 'Bengaluru Metro',
    imageUrl: '/src/assets/images/news_bengaluru_metro_1795289274541.jpg',
    videoUrl: '/videos/reel_bengaluru_metro.mp4',
  },
];

function formatDurationBadge(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
}

export function CitizenReporterModal({
  isOpen,
  defaultDistrict,
  districts = DISTRICTS,
  initialSourceTab = 'upload',
  onClose,
  onPublishReel,
}: CitizenReporterModalProps) {
  const [district, setDistrict] = useState<DistrictMeta['id']>(defaultDistrict);
  const [category, setCategory] = useState<NewsReel['category']>('Citizen Dispatch');
  const [ward, setWard] = useState('Main Chowk · Ward 1');
  const [reporterName, setReporterName] = useState('Aarav Kumar');
  const [headline, setHeadline] = useState('');
  const [script, setScript] = useState('');
  const [isLiveBreaking, setIsLiveBreaking] = useState(true);
  const [sourceTab, setSourceTab] = useState<VideoSourceTab>(initialSourceTab);
  const [remoteVideoInput, setRemoteVideoInput] = useState('');
  const [imageUrl, setImageUrl] = useState<string>(SAMPLE_CLIPS[0].imageUrl);
  const [videoUrl, setVideoUrl] = useState<string | undefined>(SAMPLE_CLIPS[0].videoUrl);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [probedDurationSec, setProbedDurationSec] = useState<number | null>(null);
  const [isProbingDuration, setIsProbingDuration] = useState(false);
  const [hasOriginalAudio, setHasOriginalAudio] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [cameraError, setCameraError] = useState('');
  const [error, setError] = useState('');

  const livePreviewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recordStartTimeRef = useRef<number>(0);

  const liveNarrationMetrics = useMemo(() => {
    const combined = [headline.trim(), script.trim()].filter(Boolean).join('. ');
    return estimateNarrationDurationSec(combined);
  }, [headline, script]);

  useEffect(() => {
    if (isOpen) {
      setDistrict(defaultDistrict);
      setSourceTab(initialSourceTab);
    }
  }, [isOpen, defaultDistrict, initialSourceTab]);

  const probeVideoDuration = useCallback((src: string) => {
    setIsProbingDuration(true);
    setProbedDurationSec(null);
    const probeEl = document.createElement('video');
    probeEl.preload = 'metadata';

    const cleanup = () => {
      probeEl.onloadedmetadata = null;
      probeEl.onerror = null;
      probeEl.src = '';
      setIsProbingDuration(false);
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
    }, 4500);

    probeEl.onloadedmetadata = () => {
      window.clearTimeout(timeoutId);
      const dur = probeEl.duration;
      if (Number.isFinite(dur) && dur > 0) {
        setProbedDurationSec(Math.round(dur));
      }
      cleanup();
    };

    probeEl.onerror = () => {
      window.clearTimeout(timeoutId);
      cleanup();
    };

    probeEl.src = src;
  }, []);

  const stopCameraResources = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore stop errors
      }
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (livePreviewVideoRef.current) {
      livePreviewVideoRef.current.srcObject = null;
    }
    setIsRecording(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (!headline.trim()) {
        setDistrict(defaultDistrict);
      }
    } else {
      stopCameraResources();
    }
    return () => {
      stopCameraResources();
    };
  }, [isOpen, defaultDistrict, headline, stopCameraResources]);

  if (!isOpen) return null;

  const handleMediaUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setError('');

    if (file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name)) {
      const objectUrl = URL.createObjectURL(file);
      setVideoUrl(objectUrl);
      setImageUrl(SAMPLE_CLIPS[0].imageUrl);
      setHasOriginalAudio(true);
      probeVideoDuration(objectUrl);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
        setVideoUrl(undefined);
        setProbedDurationSec(null);
        setHasOriginalAudio(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStartRecording = async () => {
    setCameraError('');
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setCameraError(
        'Camera recording is not supported in this browser. Use Upload Video or Video URL instead.'
      );
      return;
    }

    try {
      stopCameraResources();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      });
      mediaStreamRef.current = stream;

      if (livePreviewVideoRef.current) {
        livePreviewVideoRef.current.srcObject = stream;
        void livePreviewVideoRef.current.play().catch(() => {});
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        const elapsedSec = Math.max(
          1,
          Math.round((Date.now() - recordStartTimeRef.current) / 1000)
        );
        const blob = new Blob(recordedChunksRef.current, {
          type: mimeType || 'video/webm',
        });
        if (blob.size > 0) {
          const clipUrl = URL.createObjectURL(blob);
          setVideoUrl(clipUrl);
          setHasOriginalAudio(true);
          setProbedDurationSec(elapsedSec);
          setUploadedFileName(`Live Camera Report (${elapsedSec}s)`);
        }
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
        if (livePreviewVideoRef.current) {
          livePreviewVideoRef.current.srcObject = null;
        }
        setIsRecording(false);
      };

      mediaRecorderRef.current = recorder;
      recordStartTimeRef.current = Date.now();
      recorder.start(250);
      setIsRecording(true);
      setRecordSeconds(0);

      timerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setCameraError(
        'Camera access denied or unavailable. Select an .MP4/.WebM file or paste a direct video URL.'
      );
    }
  };

  const handleStopRecording = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleApplyVideoUrl = () => {
    const trimmed = remoteVideoInput.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed)) {
      setError('Please enter a valid http:// or https:// .mp4/.webm video URL.');
      return;
    }
    setError('');
    setVideoUrl(trimmed);
    setHasOriginalAudio(true);
    setUploadedFileName('Direct Video Stream URL');
    probeVideoDuration(trimmed);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!headline.trim()) {
      setError('Please enter a news headline to publish your video bulletin.');
      return;
    }

    stopCameraResources();

    const scriptLines = script
      .split(/\n+|(?<=[.।!?])\s+/)
      .map((l) => l.trim())
      .filter(Boolean);

    const safeLine2 =
      scriptLines[0] || `Live field video dispatch recorded in ${ward || district}.`;
    const safeLine3 =
      scriptLines[1] ||
      `Verified community coverage filed via Khabar Nama ${district} Desk.`;

    const newReel = buildCitizenReel({
      district,
      ward,
      category,
      isBreaking: isLiveBreaking,
      isLiveFeed: true,
      hasOriginalAudio: hasOriginalAudio && Boolean(videoUrl),
      line1: headline,
      line2: safeLine2,
      line3: safeLine3,
      script,
      imageUrl,
      videoUrl,
      reporterName,
    });

    setError('');
    setHeadline('');
    setScript('');
    setUploadedFileName('');
    setRemoteVideoInput('');
    setProbedDurationSec(null);
    onPublishReel(newReel);
  };

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={() => {
        stopCameraResources();
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Post News Bulletin"
    >
      <div
        className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto bg-[#14161C] border border-white/12 rounded-t-3xl sm:rounded-3xl p-5 pb-7 sm:p-6 shadow-2xl newsroom-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E63926]/20 border border-[#E63926]/45 text-[10px] font-bold tracking-wider uppercase text-red-200 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E63926] animate-ping" />
              <span>LIVE REPORTING • {district}</span>
            </div>
            <h2 className="font-display font-bold text-lg text-white">
              Go Live / File City &amp; District Report
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Record live camera video or upload a clip for {district}. Broadcasts immediately with Gemini AI narration.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCameraResources();
              onClose();
            }}
            aria-label="Close modal"
            className="min-w-[40px] min-h-[40px] rounded-full bg-white/8 hover:bg-white/15 text-zinc-300 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source Mode Selector */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-black/45 border border-white/10 mb-4">
          <button
            type="button"
            onClick={() => {
              stopCameraResources();
              setSourceTab('upload');
            }}
            className={`min-h-[40px] px-2 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              sourceTab === 'upload'
                ? 'bg-white text-black'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Video</span>
          </button>
          <button
            type="button"
            onClick={() => {
              stopCameraResources();
              setSourceTab('url');
            }}
            className={`min-h-[40px] px-2 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              sourceTab === 'url'
                ? 'bg-[#F59E0B] text-black'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Paste URL</span>
          </button>
          <button
            type="button"
            onClick={() => setSourceTab('record')}
            className={`min-h-[40px] px-2 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              sourceTab === 'record'
                ? 'bg-[#E63926] text-white'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Record Live</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 9:16 Live Preview + Media Source Controls + Duration Verification Badge */}
          <div className="grid grid-cols-[96px_1fr] gap-3.5 items-start">
            <div className="aspect-[9/16] w-24 rounded-xl overflow-hidden bg-black/50 border border-white/15 relative shrink-0">
              {isRecording ? (
                <video
                  ref={livePreviewVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : videoUrl ? (
                <video
                  key={videoUrl}
                  src={videoUrl}
                  poster={imageUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={imageUrl}
                  alt="Citizen report preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              )}
              <span className="absolute bottom-1.5 inset-x-1.5 text-[9px] text-center font-semibold bg-black/80 text-white py-0.5 rounded flex items-center justify-center gap-1">
                {(isRecording || videoUrl) && (
                  <Video className="w-2.5 h-2.5 text-[#E63926]" />
                )}
                <span>
                  {isRecording
                    ? `REC ${recordSeconds}s`
                    : probedDurationSec !== null
                    ? formatDurationBadge(probedDurationSec)
                    : videoUrl
                    ? 'Video Ready'
                    : 'Photo'}
                </span>
              </span>
            </div>

            <div className="space-y-2.5 min-w-0">
              {sourceTab === 'upload' && (
                <>
                  <label className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-medium text-white flex items-center justify-center gap-2 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-[#F59E0B] shrink-0" />
                    <span className="truncate">
                      {uploadedFileName
                        ? uploadedFileName
                        : 'Choose .MP4 / .WebM / .MOV'}
                    </span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/*,image/*"
                      onChange={handleMediaUpload}
                      className="sr-only"
                    />
                  </label>

                  <div>
                    <p className="text-[11px] text-zinc-400 mb-1.5 flex items-center gap-1">
                      <Camera className="w-3 h-3" /> Or pick a field news clip:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {SAMPLE_CLIPS.map((sample) => (
                        <button
                          key={sample.label}
                          type="button"
                          onClick={() => {
                            setImageUrl(sample.imageUrl);
                            setVideoUrl(sample.videoUrl);
                            setUploadedFileName('');
                            setProbedDurationSec(null);
                            setHasOriginalAudio(false);
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors ${
                            videoUrl === sample.videoUrl && !uploadedFileName
                              ? 'bg-[#E63926]/20 border-[#E63926] text-white'
                              : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                          }`}
                        >
                          {sample.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {sourceTab === 'url' && (
                <div className="space-y-2">
                  <input
                    type="url"
                    value={remoteVideoInput}
                    onChange={(e) => setRemoteVideoInput(e.target.value)}
                    placeholder="https://.../field-report-75s.mp4"
                    className="w-full min-h-[42px] px-3 rounded-xl bg-black/45 border border-white/12 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyVideoUrl}
                    className="w-full min-h-[38px] px-3 rounded-xl bg-white/12 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
                  >
                    Load & Check Duration
                  </button>
                </div>
              )}

              {sourceTab === 'record' && (
                <div className="space-y-2">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={() => void handleStartRecording()}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#E63926] hover:bg-[#D62E1C] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      <Video className="w-4 h-4" />
                      <span>Start Camera Recording</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopRecording}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      <Square className="w-3.5 h-3.5 fill-white" />
                      <span>Stop & Use Clip ({recordSeconds}s)</span>
                    </button>
                  )}
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    Records video + microphone reporter audio directly for instant broadcast.
                  </p>
                  {cameraError && (
                    <p className="text-[11px] text-amber-300 leading-snug">{cameraError}</p>
                  )}
                </div>
              )}

              {/* Detected Video Clip Info Pill */}
              {(isProbingDuration || probedDurationSec !== null) && (
                <div className="rounded-xl px-2.5 py-2 border bg-[#16A34A]/15 border-[#16A34A]/45 text-emerald-200 text-[11px] flex items-center gap-2">
                  {isProbingDuration ? (
                    <>
                      <Clock className="w-3.5 h-3.5 shrink-0 animate-spin" />
                      <span>Checking video clip...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                      <span>
                        Clip <strong>{formatDurationBadge(probedDurationSec!)}</strong> · Loops seamlessly while anchor narrates
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* District, Category & Ward */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">District</label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value as DistrictMeta['id'])}
                className="w-full min-h-[42px] px-3 rounded-xl bg-black/45 border border-white/12 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#E63926]"
              >
                <optgroup label="BIHAR (All 38 Districts)" className="bg-[#14161C]">
                  {districts
                    .filter((d) => d.group === 'bihar' || (!d.group && d.state === 'Bihar'))
                    .sort((a, b) => a.id.localeCompare(b.id))
                    .map((d) => (
                      <option key={d.id} value={d.id} className="bg-[#14161C]">
                        {d.id}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Major Metros" className="bg-[#14161C]">
                  {districts
                    .filter((d) => d.group === 'metro' || (!d.group && d.state !== 'Bihar' && d.group !== 'detected'))
                    .map((d) => (
                      <option key={d.id} value={d.id} className="bg-[#14161C]">
                        {d.id}
                      </option>
                    ))}
                </optgroup>
                {districts.some((d) => d.group === 'detected') && (
                  <optgroup label="GPS Detected" className="bg-[#14161C]">
                    {districts
                      .filter((d) => d.group === 'detected')
                      .map((d) => (
                        <option key={d.id} value={d.id} className="bg-[#14161C]">
                          {d.id}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as NewsReel['category'])}
                className="w-full min-h-[42px] px-3 rounded-xl bg-black/45 border border-white/12 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#E63926]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-[#14161C]">
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Ward / Locality</label>
              <input
                type="text"
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                placeholder="Motijheel · Ward 12"
                className="w-full min-h-[42px] px-3 rounded-xl bg-black/45 border border-white/12 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E63926]"
              />
            </div>
          </div>

          {/* Headline + Full News Script */}
          <div className="space-y-2.5">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Headline (Required)
              </label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="New solar streetlamps lit along Motijheel market stretch"
                className="w-full min-h-[42px] px-3 rounded-xl bg-black/45 border border-white/12 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E63926]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                News Script / Field Notes (Generates Synced Subtitles & AI Dubbing)
              </label>
              <textarea
                rows={3}
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Evening commuters report brighter crossings after 7 PM. Municipal engineers confirmed 18 additional poles near the main junction."
                className="w-full p-3 rounded-xl bg-black/45 border border-white/12 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E63926] resize-none"
              />
              {/* Live Text-to-Duration Preview Badge */}
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-xs text-[#FDE68A] font-medium">
                <Clock className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                <span className="font-mono-tabular">
                  Exact Narration Time: ~{liveNarrationMetrics.durationSec} sec ({liveNarrationMetrics.wordCount} {liveNarrationMetrics.wordCount === 1 ? 'word' : 'words'})
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Reporter / Bureau Name
              </label>
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl bg-black/45 border border-white/12 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#E63926]"
              />
            </div>

            <label className="min-h-[42px] sm:mt-5 px-3 py-2 rounded-xl bg-[#E63926]/12 border border-[#E63926]/35 flex items-center gap-2 cursor-pointer text-xs font-semibold text-white shrink-0">
              <input
                type="checkbox"
                checked={isLiveBreaking}
                onChange={(e) => setIsLiveBreaking(e.target.checked)}
                className="accent-[#E63926] w-4 h-4"
              />
              <span>🔴 Breaking Live</span>
            </label>
          </div>

          {error && <p className="text-xs text-[#FCA5A5] font-medium">{error}</p>}

          <button
            type="submit"
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#E63926] hover:bg-[#D62E1C] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[#E63926]/25"
          >
            <Sparkles className="w-4 h-4" />
            <span>Go Live in {district} Now</span>
          </button>
        </form>
      </div>
    </div>
  );
}
