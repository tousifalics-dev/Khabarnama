import { memo, useEffect, useRef } from 'react';

interface NewsStudioCanvasProps {
  district: string;
  category: string;
  isPlaying: boolean;
}

export const NewsStudioCanvas = memo(function NewsStudioCanvas({
  district,
  category,
  isPlaying,
}: NewsStudioCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId = 0;
    let phase = 0;
    let lastDrawAt = 0;
    let cachedGrad: CanvasGradient | null = null;
    let cachedW = 0;
    let cachedH = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const pw = parent.clientWidth;
      const ph = parent.clientHeight;
      canvas.width = Math.round(pw * dpr);
      canvas.height = Math.round(ph * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cachedGrad = null;
      cachedW = 0;
      cachedH = 0;
    };

    resize();
    window.addEventListener('resize', resize);

    const drawFrame = (now: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) {
        if (isPlaying) animId = requestAnimationFrame(drawFrame);
        return;
      }

      if (isPlaying && lastDrawAt !== 0 && now - lastDrawAt < 42) {
        animId = requestAnimationFrame(drawFrame);
        return;
      }
      lastDrawAt = now;

      if (isPlaying) {
        phase += 0.045;
      }

      if (!cachedGrad || cachedW !== w || cachedH !== h) {
        const bgGrad = ctx.createLinearGradient(0, 0, w, h);
        bgGrad.addColorStop(0, '#0B1020');
        bgGrad.addColorStop(0.5, '#14192A');
        bgGrad.addColorStop(1, '#1A0B10');
        cachedGrad = bgGrad;
        cachedW = w;
        cachedH = h;
      }

      ctx.fillStyle = cachedGrad;
      ctx.fillRect(0, 0, w, h);

      // Sweeping live newsroom spotlight beams
      for (let b = 0; b < 2; b++) {
        const sweepX = w * (0.25 + b * 0.5) + Math.sin(phase * (0.7 + b * 0.35) + b * 1.8) * (w * 0.18);
        const beamGrad = ctx.createLinearGradient(sweepX, 0, sweepX + (b === 0 ? 70 : -70), h * 0.72);
        beamGrad.addColorStop(
          0,
          b === 0 ? 'rgba(230, 57, 38, 0.16)' : 'rgba(245, 158, 11, 0.13)'
        );
        beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(sweepX - 28, 0);
        ctx.lineTo(sweepX + 28, 0);
        ctx.lineTo(sweepX + (b === 0 ? 150 : 90), h * 0.72);
        ctx.lineTo(sweepX - (b === 0 ? 90 : 150), h * 0.72);
        ctx.closePath();
        ctx.fill();
      }

      const horizonY = h * 0.56;
      ctx.strokeStyle = 'rgba(230, 57, 38, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -8; i <= 8; i++) {
        ctx.moveTo(w / 2 + i * 16, horizonY);
        ctx.lineTo(w / 2 + i * 96, h);
      }
      ctx.stroke();

      for (let row = 0; row < 10; row++) {
        const offset = (row + ((phase * 1.4) % 1)) / 10;
        const y = horizonY + Math.pow(offset, 1.8) * (h - horizonY);
        ctx.strokeStyle = `rgba(245, 158, 11, ${0.06 + offset * 0.16})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const cx = w * 0.5;
      const cy = h * 0.36;
      const baseR = Math.min(w, h) * 0.22;
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.arc(
          cx,
          cy,
          baseR * r * 0.48,
          phase * (r % 2 === 0 ? 1 : -1),
          phase * (r % 2 === 0 ? 1 : -1) + Math.PI * 1.35
        );
        ctx.strokeStyle = r === 2 ? 'rgba(245, 158, 11, 0.35)' : 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y =
          horizonY -
          24 +
          Math.sin(x * 0.025 + phase * 2.5) * 14 +
          Math.cos(x * 0.05 - phase * 1.5) * 8;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(230, 57, 38, 0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.font = '700 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(district.toUpperCase(), cx, cy + 6);
      ctx.font = '600 11px monospace';
      ctx.fillStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.fillText(`KHABAR NAMA STUDIO · ${category.toUpperCase()}`, cx, cy + 28);

      if (isPlaying) {
        animId = requestAnimationFrame(drawFrame);
      }
    };

    animId = requestAnimationFrame(drawFrame);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [district, category, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="w-full h-full block"
    />
  );
});
