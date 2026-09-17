import { useEffect, useRef } from 'react';
import type { AudioEngine } from '../audio/AudioEngine';
import type { BeatEvent, RhythmLayer } from '../audio/types';
import { withAlpha } from '../audio/layerDefaults';

const FLASH_DURATION = 0.5;
const ACCENT_FLASH_DURATION = 0.7;
const PADDING = 28;

interface VertexFlash {
  time: number;
  isAccent: boolean;
}

interface Props {
  engine: AudioEngine;
  layers: RhythmLayer[];
}

export function RhythmCanvas({ engine, layers }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layersRef = useRef(layers);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  const vertexFlashRef = useRef<Map<string, VertexFlash>>(new Map());
  const lastAccentTimeRef = useRef<number>(-Infinity);

  useEffect(() => {
    const unsubscribe = engine.onBeat((events: BeatEvent[]) => {
      for (const e of events) {
        vertexFlashRef.current.set(`${e.layerId}:${e.vertexIndex}`, {
          time: e.time,
          isAccent: e.isAccent,
        });
        if (e.isAccent) {
          lastAccentTimeRef.current = Math.max(lastAccentTimeRef.current, e.time);
        }
      }
    });
    return unsubscribe;
  }, [engine]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    let raf = 0;
    let size = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      size = Math.max(160, Math.min(rect.width, rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    resize();

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const currentLayers = layersRef.current;
      const now = engine.getAudioTime();
      const phase = engine.getPhase();
      const cx = size / 2;
      const cy = size / 2;
      const radius = size / 2 - PADDING;

      ctx2d.clearRect(0, 0, size, size);

      const accentElapsed = now - lastAccentTimeRef.current;
      if (accentElapsed >= 0 && accentElapsed < ACCENT_FLASH_DURATION) {
        const t = 1 - accentElapsed / ACCENT_FLASH_DURATION;
        const grad = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.15);
        grad.addColorStop(0, `rgba(255, 255, 255, ${0.18 * t})`);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx2d.fillStyle = grad;
        ctx2d.fillRect(0, 0, size, size);
      }

      ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx2d.stroke();

      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const x = cx + radius * Math.cos(a);
        const y = cy + radius * Math.sin(a);
        ctx2d.beginPath();
        ctx2d.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx2d.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx2d.fill();
      }

      for (const layer of currentLayers) {
        if (layer.hidden) continue;
        const n = Math.max(1, layer.n);
        const points: [number, number][] = [];
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 - Math.PI / 2;
          points.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
        }

        ctx2d.beginPath();
        points.forEach(([x, y], idx) => {
          if (idx === 0) ctx2d.moveTo(x, y);
          else ctx2d.lineTo(x, y);
        });
        if (n > 1) ctx2d.closePath();
        ctx2d.strokeStyle = withAlpha(layer.color, layer.muted ? 0.22 : 0.55);
        ctx2d.lineWidth = 2;
        ctx2d.stroke();
        if (n > 2) {
          ctx2d.fillStyle = withAlpha(layer.color, 0.05);
          ctx2d.fill();
        }

        points.forEach(([x, y], k) => {
          const flash = vertexFlashRef.current.get(`${layer.id}:${k}`);
          let glow = 0;
          let isAccent = false;
          if (flash) {
            const elapsed = now - flash.time;
            const duration = flash.isAccent ? ACCENT_FLASH_DURATION : FLASH_DURATION;
            if (elapsed >= 0 && elapsed < duration) {
              glow = 1 - elapsed / duration;
              isAccent = flash.isAccent;
            }
          }
          const r = 4 + glow * (isAccent ? 9 : 6);
          ctx2d.beginPath();
          ctx2d.arc(x, y, r, 0, Math.PI * 2);
          ctx2d.fillStyle = withAlpha(layer.color, layer.muted ? 0.3 : 0.65 + glow * 0.35);
          ctx2d.shadowColor = layer.color;
          ctx2d.shadowBlur = 4 + glow * (isAccent ? 24 : 16);
          ctx2d.fill();
          ctx2d.shadowBlur = 0;
        });
      }

      const sweepAngle = phase * Math.PI * 2 - Math.PI / 2;
      const sx = cx + radius * Math.cos(sweepAngle);
      const sy = cy + radius * Math.sin(sweepAngle);
      ctx2d.beginPath();
      ctx2d.moveTo(cx, cy);
      ctx2d.lineTo(sx, sy);
      ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx2d.lineWidth = 1.5;
      ctx2d.stroke();
      ctx2d.beginPath();
      ctx2d.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx2d.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx2d.fill();

      ctx2d.beginPath();
      ctx2d.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx2d.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx2d.fill();
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [engine]);

  return (
    <div className="rhythm-canvas-wrap">
      <canvas ref={canvasRef} />
    </div>
  );
}
