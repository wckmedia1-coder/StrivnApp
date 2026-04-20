import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  loadCharacterTraits,
  getProgressToNextLevel,
  CATEGORIES,
  MAX_LEVEL,
  type CharacterTrait,
  type GoalCategory,
} from '../lib/gameLogic';

type TraitMap = Partial<Record<GoalCategory, CharacterTrait>>;

const displayCategories = [
  ...CATEGORIES.filter(c => c.id !== 'general'),
  { id: 'other', label: 'Other', emoji: '✨', description: "Goals that don't fit a specific category — they still count!" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lerpHex(c1: number[], c2: number[], t: number) {
  return c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
}
function toRgb(c: number[]) { return `rgb(${c[0]},${c[1]},${c[2]})`; }
function toRgba(c: number[], a: number) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

// Smooth rounded rectangle
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Pill / capsule shape
function pill(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number
) {
  roundRect(ctx, x, y, w, h, Math.min(w, h) / 2);
}

export function CharacterView() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [traits, setTraits] = useState<TraitMap>({});
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();
  const traitsRef = useRef<TraitMap>({});
  const frameRef = useRef(0);

  useEffect(() => {
    if (user) loadTraits();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [user]);

  useEffect(() => { traitsRef.current = traits; }, [traits]);

  useEffect(() => {
    if (loading) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    startAnimation(ctx, canvas.width, canvas.height);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [loading]);

  const loadTraits = async () => {
    if (!user) return;
    const list = await loadCharacterTraits(user.id);
    const map: TraitMap = {};
    for (const t of list) {
      const cat = CATEGORIES.find(c => c.id === t.category) ? t.category as GoalCategory : 'other' as GoalCategory;
      if (map[cat]) {
        map[cat] = {
          ...map[cat]!,
          completions: (map[cat]!.completions ?? 0) + (t.completions ?? 0),
          level: Math.max(map[cat]!.level ?? 0, t.level ?? 0),
        };
      } else {
        map[cat] = { ...t, category: cat };
      }
    }
    setTraits(map); traitsRef.current = map; setLoading(false);
  };

  const getLevel = (cat: GoalCategory) => traitsRef.current[cat]?.level ?? 0;

  // ── Day/night cycle ───────────────────────────────────────────────────────
  function getDayPhase(): number {
    const ms = Date.now();
    const cycleDuration = 30 * 60 * 1000;
    return (ms % cycleDuration) / cycleDuration;
  }

  function getSkyColors(phase: number) {
    const midnight = [13, 13, 26];
    const midnightBot = [10, 10, 20];
    const sunrise = [255, 140, 60];
    const sunriseBot = [255, 100, 50];
    const noon = [30, 120, 220];
    const noonBot = [80, 160, 255];
    const sunset = [220, 80, 40];
    const sunsetBot = [180, 60, 30];

    let top: number[], bot: number[], ambientAlpha: number, isNight: boolean;

    if (phase < 0.15) {
      const t = phase / 0.15;
      top = lerpHex(midnight, [40, 20, 60], t); bot = lerpHex(midnightBot, [60, 30, 80], t);
      ambientAlpha = 0; isNight = true;
    } else if (phase < 0.25) {
      const t = (phase - 0.15) / 0.1;
      top = lerpHex([40, 20, 60], sunrise, t); bot = lerpHex([60, 30, 80], sunriseBot, t);
      ambientAlpha = t * 0.3; isNight = false;
    } else if (phase < 0.45) {
      const t = (phase - 0.25) / 0.2;
      top = lerpHex(sunrise, noon, t); bot = lerpHex(sunriseBot, noonBot, t);
      ambientAlpha = 0.3 + t * 0.2; isNight = false;
    } else if (phase < 0.55) {
      top = noon; bot = noonBot; ambientAlpha = 0.5; isNight = false;
    } else if (phase < 0.7) {
      const t = (phase - 0.55) / 0.15;
      top = lerpHex(noon, sunset, t); bot = lerpHex(noonBot, sunsetBot, t);
      ambientAlpha = 0.5 - t * 0.2; isNight = false;
    } else if (phase < 0.8) {
      const t = (phase - 0.7) / 0.1;
      top = lerpHex(sunset, [40, 20, 60], t); bot = lerpHex(sunsetBot, [30, 15, 50], t);
      ambientAlpha = 0.3 - t * 0.3; isNight = t > 0.5;
    } else {
      const t = (phase - 0.8) / 0.2;
      top = lerpHex([40, 20, 60], midnight, t); bot = lerpHex([30, 15, 50], midnightBot, t);
      ambientAlpha = 0; isNight = true;
    }
    return { top: toRgb(top), bottom: toRgb(bot), ambientAlpha, isNight };
  }

  // ── Main loop ─────────────────────────────────────────────────────────────
  function startAnimation(ctx: CanvasRenderingContext2D, W: number, H: number) {
    function loop() {
      frameRef.current++;
      ctx.clearRect(0, 0, W, H);
      drawBackground(ctx, W, H);
      drawProps(ctx, W, H);
      drawCharacter(ctx, W, H, frameRef.current);
      drawCharacterItems(ctx, W, H, frameRef.current);
      drawParticles(ctx, W, H, frameRef.current);
      animRef.current = requestAnimationFrame(loop);
    }
    loop();
  }

  // ── BACKGROUND ────────────────────────────────────────────────────────────
  function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const phase = getDayPhase();
    const { top, bottom, ambientAlpha, isNight } = getSkyColors(phase);
    const groundY = H * 0.65;

    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, groundY);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, groundY);

    // Horizon atmospheric glow
    if (ambientAlpha > 0.1) {
      const hGrad = ctx.createLinearGradient(0, groundY * 0.7, 0, groundY);
      hGrad.addColorStop(0, `rgba(255,200,100,0)`);
      hGrad.addColorStop(1, `rgba(255,200,100,${ambientAlpha * 0.3})`);
      ctx.fillStyle = hGrad;
      ctx.fillRect(0, groundY * 0.7, W, groundY * 0.3);
    }

    // Sun / Moon
    const sunX = W * (0.2 + Math.sin(phase * Math.PI * 2) * 0.3 + 0.3);
    const sunY = groundY * (0.8 - Math.abs(Math.sin(phase * Math.PI)) * 0.7);

    if (isNight) {
      // Moon with glow
      const moonGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 40);
      moonGlow.addColorStop(0, 'rgba(255,253,231,0.18)');
      moonGlow.addColorStop(1, 'rgba(255,253,231,0)');
      ctx.fillStyle = moonGlow;
      ctx.beginPath(); ctx.arc(sunX, sunY, 40, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fffde7';
      ctx.beginPath(); ctx.arc(sunX, sunY, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = top; // shadow to make crescent
      ctx.beginPath(); ctx.arc(sunX + 7, sunY - 3, 12, 0, Math.PI * 2); ctx.fill();
    } else {
      // Sun with layered glow
      for (const [r, a] of [[50, 0.06], [36, 0.1], [26, 0.18]] as [number, number][]) {
        const g = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, r);
        g.addColorStop(0, `rgba(255,220,0,${a})`);
        g.addColorStop(1, 'rgba(255,220,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sunX, sunY, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#fff9c4';
      ctx.beginPath(); ctx.arc(sunX, sunY, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd600';
      ctx.beginPath(); ctx.arc(sunX, sunY, 13, 0, Math.PI * 2); ctx.fill();
    }

    // Stars
    const starAlpha = isNight ? 1 : Math.max(0, 1 - ambientAlpha * 3);
    if (starAlpha > 0.05) {
      for (let i = 0; i < 40; i++) {
        const twinkle = Math.sin(frameRef.current * 0.025 + i * 1.7) * 0.5 + 0.5;
        const size = i % 5 === 0 ? 2.5 : i % 3 === 0 ? 2 : 1.5;
        const gx = (i * 97 + 13) % W;
        const gy = (i * 61 + 7) % (groundY * 0.85);
        ctx.globalAlpha = starAlpha * (0.25 + twinkle * 0.75);
        ctx.fillStyle = i % 4 === 0 ? '#cce8ff' : '#ffffff';
        ctx.beginPath(); ctx.arc(gx, gy, size * twinkle * 0.5 + size * 0.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Clouds — multiple layers, parallax-like speeds
    if (ambientAlpha > 0.08) {
      const drawCloud = (x: number, y: number, scale: number, alpha: number) => {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        for (const [ox, oy, rx, ry] of [
          [0, 0, 30 * scale, 14 * scale],
          [25 * scale, -8 * scale, 22 * scale, 12 * scale],
          [-18 * scale, -4 * scale, 18 * scale, 10 * scale],
        ] as [number, number, number, number][]) {
          ctx.beginPath(); ctx.ellipse(x + ox, y + oy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      };
      const f = frameRef.current;
      drawCloud((f * 0.12 + 60) % (W + 120) - 60, groundY * 0.22, 1.1, ambientAlpha * 0.55);
      drawCloud((f * 0.08 + 300) % (W + 120) - 60, groundY * 0.34, 0.75, ambientAlpha * 0.4);
      drawCloud((f * 0.16 + 180) % (W + 120) - 60, groundY * 0.15, 0.85, ambientAlpha * 0.45);
    }

    // Ground
    const nutritionLevel = getLevel('nutrition');
    const grassBase = nutritionLevel >= 3 ? [45, 90, 27] : nutritionLevel >= 1 ? [30, 60, 18] : [20, 31, 10];
    const grassMid  = nutritionLevel >= 3 ? [58, 122, 35] : nutritionLevel >= 1 ? [38, 78, 22] : [26, 47, 13];

    // Ambient tint on ground
    if (ambientAlpha > 0) {
      ctx.globalAlpha = ambientAlpha * 0.2;
      ctx.fillStyle = '#ffe082';
      ctx.fillRect(0, groundY, W, H - groundY);
      ctx.globalAlpha = 1;
    }

    // Main ground gradient
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
    groundGrad.addColorStop(0, toRgb(grassMid));
    groundGrad.addColorStop(0.3, toRgb(grassBase));
    groundGrad.addColorStop(1, toRgb(lerpHex(grassBase, [8, 12, 4], 0.6)));
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, W, H - groundY);

    // Grass tufts — smooth arcs
    ctx.strokeStyle = toRgb(lerpHex(grassMid, [200, 255, 150], 0.2));
    ctx.lineWidth = 1.5;
    for (let gx = 4; gx < W; gx += 7) {
      const h2 = 5 + (gx % 11 === 0 ? 4 : gx % 7 === 0 ? 2 : 0);
      ctx.globalAlpha = 0.5 + (gx % 3) * 0.15;
      ctx.beginPath();
      ctx.moveTo(gx, groundY);
      ctx.quadraticCurveTo(gx + 2, groundY - h2, gx + 4, groundY);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Ground edge highlight
    const edgeGrad = ctx.createLinearGradient(0, groundY - 2, 0, groundY + 4);
    edgeGrad.addColorStop(0, toRgba([150, 255, 80], 0.3));
    edgeGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, groundY - 2, W, 6);

    // Path — with subtle reflection gloss
    const pathGrad = ctx.createLinearGradient(0, groundY - 3, 0, groundY + 3);
    pathGrad.addColorStop(0, '#2e2e48');
    pathGrad.addColorStop(0.5, '#3a3a5c');
    pathGrad.addColorStop(1, '#252538');
    ctx.fillStyle = pathGrad;
    roundRect(ctx, W / 2 - 78, groundY - 5, 156, 9, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, W / 2 - 74, groundY - 4, 148, 3, 2);
    ctx.fill();

    // Other category sparkles
    const otherLevel = getLevel('other' as GoalCategory);
    if (otherLevel >= 1) {
      for (let sp = 0; sp < otherLevel * 3; sp++) {
        const t = (frameRef.current * 0.012 + sp * 0.9) % (Math.PI * 2);
        const fade = Math.sin(t) * 0.4 + 0.3;
        ctx.globalAlpha = fade;
        ctx.fillStyle = sp % 2 === 0 ? '#c084fc' : '#a78bfa';
        const sx = (sp * 83 + 20) % W, sy = (sp * 57 + 15) % (groundY * 0.85);
        const sr = 1.5 + Math.sin(t * 2) * 0.5;
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ── PROPS ─────────────────────────────────────────────────────────────────
  function drawProps(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const groundY = H * 0.65, CX = W / 2;
    const readLevel = getLevel('reading'), creativityLevel = getLevel('creativity');
    const mindLevel = getLevel('mindfulness'), nutritionLevel = getLevel('nutrition');
    const sleepLevel = getLevel('sleep');

    // ── Bookshelf ──
    if (readLevel >= 1) {
      const bx = CX - 140, by = groundY - 92, bw = 74, bh = 90;
      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
      const woodGrad = ctx.createLinearGradient(bx, by, bx + bw, by);
      woodGrad.addColorStop(0, '#6d4c41'); woodGrad.addColorStop(1, '#4e342e');
      ctx.fillStyle = woodGrad;
      roundRect(ctx, bx, by, bw, bh, 4); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

      ctx.fillStyle = '#3e2710'; ctx.fillRect(bx + bw - 7, by + 2, 5, bh - 4);
      ctx.fillRect(bx + 2, by + 2, 5, bh - 4);

      const shelves = readLevel >= 3 ? 3 : readLevel >= 2 ? 2 : 1;
      for (let s = 0; s < shelves; s++) {
        const shelfGrad = ctx.createLinearGradient(bx + 4, by + 26 + s * 28, bx + bw - 8, by + 26 + s * 28);
        shelfGrad.addColorStop(0, '#8d6e63'); shelfGrad.addColorStop(1, '#6d4c41');
        ctx.fillStyle = shelfGrad;
        roundRect(ctx, bx + 4, by + 24 + s * 28, bw - 8, 5, 2); ctx.fill();
      }
      const bc = ['#e53935','#1e88e5','#43a047','#fdd835','#8e24aa','#f4511e','#00acc1'];
      const bps = Math.min(readLevel * 2, 7);
      for (let s = 0; s < shelves; s++) {
        for (let b = 0; b < bps; b++) {
          const bh2 = 18 + (b % 3) * 4;
          const col = bc[(s * 7 + b) % bc.length];
          const bg = ctx.createLinearGradient(bx + 6 + b * 9, 0, bx + 12 + b * 9, 0);
          bg.addColorStop(0, col); bg.addColorStop(1, col + '99');
          ctx.fillStyle = bg;
          roundRect(ctx, bx + 6 + b * 9, by + 5 + s * 28 + (22 - bh2), 7, bh2, 1); ctx.fill();
        }
      }

      if (readLevel >= 4) {
        ctx.fillStyle = '#8d6e63'; roundRect(ctx, bx - 10, groundY - 56, 5, 56, 2); ctx.fill();
        const lampGlow = ctx.createRadialGradient(bx - 8, groundY - 58, 0, bx - 8, groundY - 58, 28);
        lampGlow.addColorStop(0, 'rgba(255,214,0,0.6)');
        lampGlow.addColorStop(0.4, 'rgba(255,214,0,0.15)');
        lampGlow.addColorStop(1, 'rgba(255,214,0,0)');
        ctx.fillStyle = lampGlow;
        ctx.beginPath(); ctx.arc(bx - 8, groundY - 58, 28, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff9c4';
        ctx.beginPath(); ctx.arc(bx - 8, groundY - 58, 8, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ── Easel / art station ──
    if (creativityLevel >= 1) {
      const ex = CX + 80, ey = groundY - 98;
      ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 6;
      ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      [[ex + 20, ey + 88, ex + 4, ey + 22], [ex + 20, ey + 88, ex + 36, ey + 22], [ex + 20, ey + 88, ex + 20, ey + 22]].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });
      ctx.shadowBlur = 0;
      // Canvas on easel
      ctx.fillStyle = '#fff8e1'; roundRect(ctx, ex, ey + 8, 40, 36, 3); ctx.fill();
      ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 2; roundRect(ctx, ex, ey + 8, 40, 36, 3); ctx.stroke();
      // Painting
      const canvasGrad = ctx.createLinearGradient(ex + 4, ey + 12, ex + 36, ey + 40);
      canvasGrad.addColorStop(0, '#42a5f5'); canvasGrad.addColorStop(1, '#1565c0');
      ctx.fillStyle = canvasGrad; roundRect(ctx, ex + 4, ey + 12, 32, 28, 2); ctx.fill();
      if (creativityLevel >= 2) {
        ctx.fillStyle = '#66bb6a'; roundRect(ctx, ex + 4, ey + 26, 32, 14, 2); ctx.fill();
        const shine = ctx.createRadialGradient(ex + 16, ey + 21, 0, ex + 16, ey + 21, 7);
        shine.addColorStop(0, 'rgba(255,200,0,0.9)'); shine.addColorStop(1, 'rgba(255,150,0,0)');
        ctx.fillStyle = shine; ctx.beginPath(); ctx.arc(ex + 16, ey + 21, 7, 0, Math.PI * 2); ctx.fill();
      }
      if (creativityLevel >= 3) {
        const nf = Math.sin(frameRef.current * 0.04) * 5;
        ctx.font = '16px serif'; ctx.globalAlpha = 0.8 + Math.sin(frameRef.current * 0.04) * 0.2;
        ctx.fillStyle = '#ffd600'; ctx.fillText('♪', ex + 54, ey + 20 + nf);
        ctx.globalAlpha = 1;
      }
      if (creativityLevel >= 4) {
        // Palette with glow
        ctx.shadowColor = 'rgba(150,100,50,0.4)'; ctx.shadowBlur = 6;
        ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.ellipse(ex + 55, groundY - 8, 15, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ['#e53935','#1e88e5','#43a047','#fdd835'].forEach((c, i) => {
          ctx.fillStyle = c; ctx.beginPath(); ctx.arc(ex + 48 + i * 6, groundY - 8, 3.5, 0, Math.PI * 2); ctx.fill();
        });
      }
    }

    // ── Mindfulness orbs + plants ──
    if (mindLevel >= 1) {
      for (let o = 0; o < mindLevel; o++) {
        const angle = frameRef.current * 0.013 + (o * Math.PI * 2) / mindLevel;
        const pulse = Math.sin(frameRef.current * 0.045 + o) * 0.3 + 0.7;
        const col = ['#4fc3f7','#81c784','#ce93d8','#fff176','#ffb74d'][o % 5];
        const orbX = CX + Math.cos(angle) * (55 + o * 8);
        const orbY = groundY - 80 + Math.sin(angle) * 18;
        const orbR = 5 + pulse * 3;
        const orbGrad = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, orbR * 2);
        orbGrad.addColorStop(0, col + 'cc');
        orbGrad.addColorStop(0.5, col + '44');
        orbGrad.addColorStop(1, col + '00');
        ctx.fillStyle = orbGrad;
        ctx.beginPath(); ctx.arc(orbX, orbY, orbR * 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = col + '99';
        ctx.beginPath(); ctx.arc(orbX, orbY, orbR * 0.5, 0, Math.PI * 2); ctx.fill();
      }
      if (mindLevel >= 2) {
        const plantXs = [CX - 60, ...(mindLevel >= 3 ? [CX + 42] : [])];
        plantXs.forEach(x => {
          ctx.fillStyle = '#6d4c41'; roundRect(ctx, x, groundY - 22, 18, 18, 3); ctx.fill();
          // Pot shine
          ctx.fillStyle = 'rgba(255,255,255,0.1)'; roundRect(ctx, x + 2, groundY - 20, 5, 10, 2); ctx.fill();
          ctx.fillStyle = '#2e7d32'; roundRect(ctx, x + 5, groundY - 40, 8, 20, 4); ctx.fill();
          ctx.fillStyle = '#388e3c'; ctx.beginPath(); ctx.ellipse(x + 9, groundY - 40, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#1b5e20'; ctx.beginPath(); ctx.ellipse(x + 9, groundY - 40, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
        });
      }
      if (mindLevel >= 4) {
        const matGrad = ctx.createRadialGradient(CX, groundY, 0, CX, groundY, 38);
        matGrad.addColorStop(0, 'rgba(123,31,162,0.8)');
        matGrad.addColorStop(0.6, 'rgba(123,31,162,0.4)');
        matGrad.addColorStop(1, 'rgba(123,31,162,0)');
        ctx.fillStyle = matGrad;
        ctx.beginPath(); ctx.ellipse(CX, groundY - 1, 40, 7, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ── Nutrition: food items ──
    if (nutritionLevel >= 2) {
      ctx.fillStyle = 'rgba(76,175,80,0.3)'; roundRect(ctx, CX - 32, groundY - 10, 64, 8, 4); ctx.fill();
      ['🍎','🥦','🥕','🫐'].slice(0, nutritionLevel).forEach((f, i) => {
        ctx.font = '13px serif'; ctx.fillText(f, CX - 28 + i * 16, groundY - 4);
      });
    }

    // ── Sleep lamp ──
    if (sleepLevel >= 3) {
      ctx.fillStyle = '#455a64'; roundRect(ctx, CX + 88, groundY - 42, 6, 42, 3); ctx.fill();
      const lampGlow = ctx.createRadialGradient(CX + 91, groundY - 44, 0, CX + 91, groundY - 44, 24);
      lampGlow.addColorStop(0, 'rgba(179,229,252,0.5)');
      lampGlow.addColorStop(1, 'rgba(179,229,252,0)');
      ctx.fillStyle = lampGlow; ctx.beginPath(); ctx.arc(CX + 91, groundY - 44, 24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#eceff1'; ctx.beginPath(); ctx.arc(CX + 91, groundY - 44, 9, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── CHARACTER ─────────────────────────────────────────────────────────────
  function drawCharacter(ctx: CanvasRenderingContext2D, W: number, H: number, frame: number) {
    const CX = W / 2, groundY = H * 0.65;
    const fitnessLevel = getLevel('fitness'), sleepLevel = getLevel('sleep');
    const nutritionLevel = getLevel('nutrition'), crtLevel = getLevel('creativity');
    const mindLevel = getLevel('mindfulness');

    // Breathing / idle bob
    const breathe = Math.sin(frame * 0.025) * 1.5;
    const bob = Math.sin(frame * 0.04) * (fitnessLevel >= 1 ? 1.5 : 0.5);

    // Body proportions — slightly rounder
    const bodyW = 28 + fitnessLevel * 3;
    const bodyH = 40 - fitnessLevel;
    const shoulderW = bodyW + fitnessLevel * 2 + 4;
    const feetY = groundY - 4;
    const bodyY = feetY - bodyH - 22 + bob;
    const headY = bodyY - 30 - breathe;
    const headR = 14;
    const armW = 9 + fitnessLevel;
    const walkAngle = Math.sin(frame * 0.04) * (fitnessLevel >= 1 ? 5 : 1.5);
    const armSwing = Math.sin(frame * 0.04) * (fitnessLevel >= 1 ? 4 : 1.5);

    // Skin tone
    const skin = nutritionLevel >= 3 ? '#f5cba7' : nutritionLevel >= 1 ? '#f0b27a' : '#e59866';
    const skinDark = nutritionLevel >= 3 ? '#e8b88a' : nutritionLevel >= 1 ? '#d9935a' : '#c97a46';

    // Shirt color by creativity
    const shirtColors = [['#546e7a','#37474f'], ['#1565c0','#0d47a1'], ['#6a1b9a','#4a148c'], ['#b71c1c','#7f0000'], ['#1b5e20','#003300']];
    const [shirtLight, shirtDark] = shirtColors[Math.min(crtLevel, 4)];

    // ── Shadow under character ──
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(CX, groundY - 2, 24, 5, 0, 0, Math.PI * 2); ctx.fill();

    // ── Legs (pill-shaped) ──
    const legGrad1 = ctx.createLinearGradient(CX - 14 + walkAngle, feetY - 22, CX - 2 + walkAngle, feetY - 22);
    legGrad1.addColorStop(0, '#4a4a70'); legGrad1.addColorStop(1, '#2e2e4e');
    ctx.fillStyle = legGrad1;
    pill(ctx, CX - 16 + walkAngle, feetY - 22, 13, 22); ctx.fill();

    const legGrad2 = ctx.createLinearGradient(CX + 3 - walkAngle, feetY - 22, CX + 15 - walkAngle, feetY - 22);
    legGrad2.addColorStop(0, '#4a4a70'); legGrad2.addColorStop(1, '#2e2e4e');
    ctx.fillStyle = legGrad2;
    pill(ctx, CX + 3 - walkAngle, feetY - 22, 13, 22); ctx.fill();

    // Leg highlights
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(CX - 15 + walkAngle, feetY - 20, 4, 10);
    ctx.fillRect(CX + 4 - walkAngle, feetY - 20, 4, 10);

    // ── Shoes ──
    const shoeColor = fitnessLevel >= 3 ? '#f44336' : fitnessLevel >= 1 ? '#eeeeee' : '#212121';
    const shoeAccent = fitnessLevel >= 3 ? '#b71c1c' : fitnessLevel >= 1 ? '#9e9e9e' : '#424242';
    const shoeGrad1 = ctx.createLinearGradient(CX - 16 + walkAngle, feetY, CX - 2 + walkAngle, feetY + 7);
    shoeGrad1.addColorStop(0, shoeColor); shoeGrad1.addColorStop(1, shoeAccent);
    ctx.fillStyle = shoeGrad1;
    roundRect(ctx, CX - 18 + walkAngle, feetY - 2, 15, 7, 3); ctx.fill();
    const shoeGrad2 = ctx.createLinearGradient(CX + 3 - walkAngle, feetY, CX + 17 - walkAngle, feetY + 7);
    shoeGrad2.addColorStop(0, shoeColor); shoeGrad2.addColorStop(1, shoeAccent);
    ctx.fillStyle = shoeGrad2;
    roundRect(ctx, CX + 3 - walkAngle, feetY - 2, 15, 7, 3); ctx.fill();
    if (fitnessLevel >= 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(CX - 16 + walkAngle, feetY, 13, 1.5);
      ctx.fillRect(CX + 4 - walkAngle, feetY, 13, 1.5);
    }

    // ── Shirt / Torso ──
    const torsoGrad = ctx.createLinearGradient(CX - bodyW / 2, bodyY + breathe, CX + bodyW / 2, bodyY + bodyH + breathe);
    torsoGrad.addColorStop(0, shirtLight); torsoGrad.addColorStop(1, shirtDark);
    ctx.fillStyle = torsoGrad;
    roundRect(ctx, CX - bodyW / 2, bodyY + breathe, bodyW, bodyH, 6); ctx.fill();
    // Torso highlight
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    roundRect(ctx, CX - bodyW / 2 + 3, bodyY + breathe + 3, bodyW / 2 - 2, bodyH / 2, 4); ctx.fill();

    // Collar
    const collarGrad = ctx.createLinearGradient(CX - shoulderW / 2, bodyY + breathe, CX + shoulderW / 2, bodyY + breathe + 9);
    collarGrad.addColorStop(0, shirtLight); collarGrad.addColorStop(1, shirtDark);
    ctx.fillStyle = collarGrad;
    roundRect(ctx, CX - shoulderW / 2, bodyY + breathe, shoulderW, 9, 4); ctx.fill();

    // ── Arms (rounded pill) ──
    const armLen = 22;
    // Left arm
    const la = ctx.createLinearGradient(CX - shoulderW / 2 - armW, bodyY + breathe + 4, CX - shoulderW / 2, bodyY + breathe + 4);
    la.addColorStop(0, shirtLight); la.addColorStop(1, shirtDark);
    ctx.fillStyle = la;
    pill(ctx, CX - shoulderW / 2 - armW + 2, bodyY + breathe + 4 - armSwing, armW, armLen); ctx.fill();
    // Right arm
    const ra = ctx.createLinearGradient(CX + shoulderW / 2, bodyY + breathe + 4, CX + shoulderW / 2 + armW, bodyY + breathe + 4);
    ra.addColorStop(0, shirtDark); ra.addColorStop(1, shirtLight);
    ctx.fillStyle = ra;
    pill(ctx, CX + shoulderW / 2 - 2, bodyY + breathe + 4 + armSwing, armW, armLen); ctx.fill();
    // Hands
    const handGrad = (x: number, y: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, armW / 2 + 1);
      g.addColorStop(0, skin); g.addColorStop(1, skinDark); return g;
    };
    ctx.fillStyle = handGrad(CX - shoulderW / 2 - armW / 2 + 2, bodyY + breathe + 28 - armSwing);
    ctx.beginPath(); ctx.arc(CX - shoulderW / 2 - armW / 2 + 2, bodyY + breathe + 28 - armSwing, armW / 2 + 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = handGrad(CX + shoulderW / 2 + armW / 2 - 2, bodyY + breathe + 28 + armSwing);
    ctx.beginPath(); ctx.arc(CX + shoulderW / 2 + armW / 2 - 2, bodyY + breathe + 28 + armSwing, armW / 2 + 1, 0, Math.PI * 2); ctx.fill();

    // ── Head ──
    const headGrad = ctx.createRadialGradient(CX - 3, headY + 10, 2, CX, headY + 13, headR + 4);
    headGrad.addColorStop(0, skin); headGrad.addColorStop(1, skinDark);
    ctx.fillStyle = headGrad;
    ctx.beginPath(); ctx.arc(CX, headY + 13, headR + 2, 0, Math.PI * 2); ctx.fill();
    // Subtle cheek highlights
    ctx.fillStyle = 'rgba(255,160,120,0.2)';
    ctx.beginPath(); ctx.arc(CX - 9, headY + 17, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(CX + 9, headY + 17, 5, 0, Math.PI * 2); ctx.fill();

    // ── Hair ──
    const hairGrad = ctx.createLinearGradient(CX - 14, headY, CX + 14, headY + 8);
    hairGrad.addColorStop(0, '#2a2a2a'); hairGrad.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = hairGrad;
    // Hair as rounded arc across top of head
    ctx.beginPath();
    ctx.arc(CX, headY + 8, headR + 3, Math.PI * 0.85, Math.PI * 0.1, false);
    ctx.lineTo(CX + 13, headY + 8);
    ctx.arc(CX, headY + 8, headR - 2, Math.PI * 0.1, Math.PI * 0.85, true);
    ctx.closePath(); ctx.fill();
    // Hair highlight
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.arc(CX - 3, headY + 5, 6, Math.PI * 0.9, Math.PI * 0.05, false); ctx.arc(CX - 3, headY + 5, 3, Math.PI * 0.05, Math.PI * 0.9, true); ctx.closePath(); ctx.fill();

    // Sleep ears
    if (sleepLevel >= 3) {
      ctx.fillStyle = '#2a2a2a'; roundRect(ctx, CX - 14, headY, 6, 7, 2); ctx.fill();
      roundRect(ctx, CX + 8, headY, 6, 7, 2); ctx.fill();
    }

    // ── Eyes ──
    const eyeOpen = sleepLevel >= 2 ? 5 : sleepLevel >= 1 ? 3.5 : 2.5;
    // Eye whites
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, CX - 9, headY + 11, 7, eyeOpen + 1, 2); ctx.fill();
    roundRect(ctx, CX + 2, headY + 11, 7, eyeOpen + 1, 2); ctx.fill();
    // Irises
    const eyeCol = fitnessLevel >= 3 ? '#1565c0' : crtLevel >= 2 ? '#6a1b9a' : '#263238';
    ctx.fillStyle = eyeCol;
    roundRect(ctx, CX - 8.5, headY + 11.5, 5.5, eyeOpen - 0.5, 1.5); ctx.fill();
    roundRect(ctx, CX + 3, headY + 11.5, 5.5, eyeOpen - 0.5, 1.5); ctx.fill();
    // Eye shine
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(CX - 6, headY + 12.5, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(CX + 5.5, headY + 12.5, 1.2, 0, Math.PI * 2); ctx.fill();

    // Nose
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.arc(CX, headY + 17, 1.5, 0, Math.PI * 2); ctx.fill();

    // ── Smile / Mouth ──
    const smileLevel = Math.min(getLevel('mindfulness') + nutritionLevel, 4);
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    if (smileLevel <= 0) {
      ctx.beginPath(); ctx.moveTo(CX - 4, headY + 21); ctx.lineTo(CX + 4, headY + 21); ctx.stroke();
    } else {
      const smileAmt = smileLevel * 2.5;
      ctx.beginPath();
      ctx.moveTo(CX - 5, headY + 20);
      ctx.quadraticCurveTo(CX, headY + 20 + smileAmt, CX + 5, headY + 20);
      ctx.stroke();
    }

    // ── Ears ──
    ctx.fillStyle = skinDark;
    ctx.beginPath(); ctx.arc(CX - (headR + 2), headY + 12, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(CX + (headR + 2), headY + 12, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(CX - (headR + 2), headY + 12, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(CX + (headR + 2), headY + 12, 2.5, 0, Math.PI * 2); ctx.fill();

    // ── Fitness aura at max level ──
    if (fitnessLevel >= 5) {
      const auraSize = Math.sin(frame * 0.04) * 6 + 10;
      const aura = ctx.createRadialGradient(CX, bodyY + bodyH / 2 + breathe, 0, CX, bodyY + bodyH / 2 + breathe, bodyW + auraSize);
      aura.addColorStop(0, 'rgba(249,168,37,0)');
      aura.addColorStop(0.7, 'rgba(249,168,37,0.1)');
      aura.addColorStop(1, 'rgba(249,168,37,0)');
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.arc(CX, bodyY + bodyH / 2 + breathe, bodyW + auraSize, 0, Math.PI * 2); ctx.fill();
    }

    // ── Level badge ──
    const totalLevel = Object.values(traitsRef.current).reduce((s, t) => s + (t?.level ?? 0), 0);
    if (totalLevel > 0) {
      ctx.shadowColor = 'rgba(99,102,241,0.6)'; ctx.shadowBlur = 10;
      const badgeGrad = ctx.createLinearGradient(CX + 14, headY - 12, CX + 38, headY + 4);
      badgeGrad.addColorStop(0, '#818cf8'); badgeGrad.addColorStop(1, '#4f46e5');
      ctx.fillStyle = badgeGrad;
      roundRect(ctx, CX + 14, headY - 12, 24, 15, 7); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 9px monospace';
      ctx.fillText(`Lv${totalLevel}`, CX + 16, headY - 1);
    }

    // Store positions for items
    (drawCharacter as any)._headY = headY;
    (drawCharacter as any)._bodyY = bodyY;
    (drawCharacter as any)._feetY = feetY;
    (drawCharacter as any)._breathe = breathe;
    (drawCharacter as any)._shoulderW = shoulderW;
    (drawCharacter as any)._armW = armW;
    (drawCharacter as any)._armSwing = armSwing;
  }

  // ── CHARACTER ITEMS ───────────────────────────────────────────────────────
  function drawCharacterItems(ctx: CanvasRenderingContext2D, W: number, H: number, frame: number) {
    const CX = W / 2, groundY = H * 0.65;
    const fitnessLevel = getLevel('fitness');
    const readLevel = getLevel('reading');
    const nutritionLevel = getLevel('nutrition');
    const creativityLevel = getLevel('creativity');
    const sleepLevel = getLevel('sleep');
    const mindLevel = getLevel('mindfulness');
    const otherLevel = getLevel('other' as GoalCategory);

    const bodyW = 28 + fitnessLevel * 3;
    const shoulderW = bodyW + fitnessLevel * 2 + 4;
    const armW = 9 + fitnessLevel;
    const breathe = Math.sin(frame * 0.025) * 1.5;
    const bob = Math.sin(frame * 0.04) * (fitnessLevel >= 1 ? 1.5 : 0.5);
    const bodyH = 40 - fitnessLevel;
    const feetY = groundY - 4;
    const bodyY = feetY - bodyH - 22 + bob;
    const headY = bodyY - 30 - breathe;
    const armSwing = Math.sin(frame * 0.04) * (fitnessLevel >= 1 ? 4 : 1.5);

    // ── FITNESS ──
    if (fitnessLevel >= 1) {
      const bx = CX + shoulderW / 2 + armW - 3;
      const by = bodyY + breathe + 22 + armSwing;
      const bg = ctx.createLinearGradient(bx, by, bx + 7, by + 12);
      bg.addColorStop(0, '#4fc3f7'); bg.addColorStop(1, '#0288d1');
      ctx.fillStyle = bg; roundRect(ctx, bx, by, 7, 12, 3); ctx.fill();
      ctx.fillStyle = '#01579b'; roundRect(ctx, bx + 1, by, 5, 3, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(bx + 1.5, by + 4, 2, 5);
    }
    if (fitnessLevel >= 2) {
      const sbGrad = ctx.createLinearGradient(CX - 14, headY + 6, CX + 14, headY + 10);
      sbGrad.addColorStop(0, '#ef5350'); sbGrad.addColorStop(1, '#b71c1c');
      ctx.fillStyle = sbGrad; roundRect(ctx, CX - 15, headY + 6, 30, 4, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(CX - 12, headY + 7, 8, 1.5);
    }
    if (fitnessLevel >= 3) {
      const mx = CX - shoulderW / 2 - armW + 3, my = bodyY + breathe + 26 - armSwing;
      const medalGlow = ctx.createRadialGradient(mx, my, 0, mx, my, 10);
      medalGlow.addColorStop(0, 'rgba(255,214,0,0.6)'); medalGlow.addColorStop(1, 'rgba(255,214,0,0)');
      ctx.fillStyle = medalGlow; ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.fill();
      const medalGrad = ctx.createRadialGradient(mx - 1, my - 1, 0, mx, my, 7);
      medalGrad.addColorStop(0, '#fff9c4'); medalGrad.addColorStop(1, '#f9a825');
      ctx.fillStyle = medalGrad; ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e65100'; ctx.font = 'bold 8px monospace'; ctx.fillText('1', mx - 2.5, my + 3);
      ctx.strokeStyle = '#ffa000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(mx, my + 7); ctx.lineTo(mx, my + 14); ctx.stroke();
    }
    if (fitnessLevel >= 4) {
      const dx = CX - shoulderW / 2 - armW + 1, dy = bodyY + breathe + 24 - armSwing;
      ctx.fillStyle = '#616161'; roundRect(ctx, dx - 1, dy + 3, 14, 4, 2); ctx.fill();
      const plateGrad = ctx.createLinearGradient(dx - 4, dy, dx, dy + 9);
      plateGrad.addColorStop(0, '#9e9e9e'); plateGrad.addColorStop(1, '#424242');
      ctx.fillStyle = plateGrad; roundRect(ctx, dx - 5, dy, 5, 10, 2); ctx.fill();
      roundRect(ctx, dx + 9, dy, 5, 10, 2); ctx.fill();
    }
    if (fitnessLevel >= 5) {
      ctx.strokeStyle = '#ffd600'; ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(255,214,0,0.7)'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(CX, headY - 5, 17, Math.PI * 1.1, Math.PI * -0.1, false); ctx.stroke();
      ctx.shadowBlur = 0;
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * 1.1 + (i / 4) * Math.PI * 1.0;
        ctx.fillStyle = '#ffd600'; ctx.shadowColor = 'rgba(255,214,0,0.5)'; ctx.shadowBlur = 4;
        ctx.beginPath(); ctx.arc(CX + Math.cos(a) * 17, headY - 5 + Math.sin(a) * 17, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    // ── READING ──
    if (readLevel >= 1) {
      const bx = CX - shoulderW / 2 - armW + 1, by = bodyY + breathe + 20 - armSwing;
      const bookGrad = ctx.createLinearGradient(bx - 2, by, bx + 8, by + 14);
      bookGrad.addColorStop(0, '#1976d2'); bookGrad.addColorStop(1, '#0d47a1');
      ctx.fillStyle = bookGrad; roundRect(ctx, bx - 3, by, 11, 14, 2); ctx.fill();
      ctx.fillStyle = '#0a3880'; roundRect(ctx, bx - 3, by, 2.5, 14, 1); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(bx - 0.5, by + 3, 7, 1.5); ctx.fillRect(bx - 0.5, by + 6.5, 7, 1.5); ctx.fillRect(bx - 0.5, by + 10, 5, 1.5);
    }
    if (readLevel >= 2) {
      ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 1.5;
      roundRect(ctx, CX - 10, headY + 10, 7.5, 6, 2); ctx.stroke();
      roundRect(ctx, CX + 2.5, headY + 10, 7.5, 6, 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(CX - 2.5, headY + 13); ctx.lineTo(CX + 2.5, headY + 13); ctx.stroke();
      // Lens glare
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath(); ctx.arc(CX - 7.5, headY + 11.5, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(CX + 4, headY + 11.5, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    if (readLevel >= 3) {
      ctx.fillStyle = '#1a1a2e';
      roundRect(ctx, CX - 15, headY - 5, 30, 6, 2); ctx.fill();
      roundRect(ctx, CX - 9, headY - 12, 18, 9, 3); ctx.fill();
      ctx.beginPath(); ctx.arc(CX, headY - 12, 9, Math.PI, 0); ctx.fill();
      const tassel = ctx.createLinearGradient(CX + 7, headY - 4, CX + 9, headY + 6);
      tassel.addColorStop(0, '#ffd600'); tassel.addColorStop(1, '#ff8f00');
      ctx.fillStyle = tassel; ctx.fillRect(CX + 7, headY - 4, 2.5, 10);
      ctx.fillStyle = '#ffd600'; ctx.beginPath(); ctx.arc(CX + 8.5, headY + 6, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    if (readLevel >= 4) {
      const sf = Math.sin(frame * 0.025) * 4;
      ctx.shadowColor = 'rgba(255,248,225,0.5)'; ctx.shadowBlur = 6;
      ctx.fillStyle = '#fff8e1'; roundRect(ctx, CX + 28, headY - 22 + sf, 20, 15, 3); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#8d6e63'; roundRect(ctx, CX + 27, headY - 23 + sf, 3.5, 17, 2); ctx.fill();
      roundRect(ctx, CX + 47, headY - 23 + sf, 3.5, 17, 2); ctx.fill();
      ctx.fillStyle = '#bcaaa4';
      ctx.fillRect(CX + 31, headY - 18 + sf, 14, 1.5); ctx.fillRect(CX + 31, headY - 13 + sf, 14, 1.5);
    }

    // ── NUTRITION ──
    if (nutritionLevel >= 1 && readLevel < 1) {
      ctx.font = '14px serif';
      ctx.fillText('🍎', CX - shoulderW / 2 - armW - 2, bodyY + breathe + 31 - armSwing);
    }
    if (nutritionLevel >= 2) {
      const gGrad = ctx.createRadialGradient(CX, bodyY + bodyH / 2 + breathe, 0, CX, bodyY + bodyH / 2 + breathe, bodyW + 14);
      gGrad.addColorStop(0, 'rgba(102,187,106,0)');
      gGrad.addColorStop(0.6, `rgba(102,187,106,${0.05 + Math.sin(frame * 0.02) * 0.02})`);
      gGrad.addColorStop(1, 'rgba(102,187,106,0)');
      ctx.fillStyle = gGrad;
      ctx.beginPath(); ctx.arc(CX, bodyY + bodyH / 2 + breathe, bodyW + 14, 0, Math.PI * 2); ctx.fill();
    }
    if (nutritionLevel >= 3) {
      ctx.fillStyle = '#ffffff'; roundRect(ctx, CX - 11, headY - 14, 22, 11, 3); ctx.fill();
      ctx.fillStyle = '#eeeeee'; roundRect(ctx, CX - 9, headY - 20, 18, 9, 4); ctx.fill();
      ctx.beginPath(); ctx.arc(CX, headY - 20, 9, Math.PI, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(CX - 7, headY - 18, 4, 3);
    }
    if (nutritionLevel >= 4) {
      ['🍇','🥑'].forEach((e, i) => {
        const yf = Math.sin(frame * 0.025 + i * 2) * 5;
        ctx.globalAlpha = 0.9; ctx.font = '15px serif';
        ctx.fillText(e, CX - 42 + i * 74, headY - 16 + yf);
        ctx.globalAlpha = 1;
      });
    }

    // ── CREATIVITY ──
    if (creativityLevel >= 1 && fitnessLevel < 1) {
      const px = CX + shoulderW / 2 + armW - 5, py = bodyY + breathe + 14 + armSwing;
      ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 3, py + 16); ctx.stroke();
      const tipGrad = ctx.createLinearGradient(px - 1, py + 12, px + 4, py + 18);
      tipGrad.addColorStop(0, '#ef9a9a'); tipGrad.addColorStop(1, '#e53935');
      ctx.fillStyle = tipGrad; roundRect(ctx, px - 1, py + 12, 5, 7, 2); ctx.fill();
    }
    if (creativityLevel >= 2) {
      const beretGrad = ctx.createRadialGradient(CX + 4, headY - 3, 0, CX + 4, headY - 3, 16);
      beretGrad.addColorStop(0, '#c62828'); beretGrad.addColorStop(1, '#8d1515');
      ctx.fillStyle = beretGrad;
      ctx.beginPath(); ctx.ellipse(CX + 4, headY - 3, 15, 8, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ef5350'; ctx.beginPath(); ctx.arc(CX + 15, headY - 6, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.ellipse(CX - 3, headY - 4, 6, 3, -0.3, 0, Math.PI * 2); ctx.fill();
    }
    if (creativityLevel >= 3) {
      const cols = ['#e53935','#1e88e5','#43a047','#fdd835'];
      for (let i = 0; i < 4; i++) {
        const a = (frame * 0.018 + i * 1.57) % (Math.PI * 2);
        const r = 32 + Math.sin(frame * 0.03 + i) * 6;
        const pGrad = ctx.createRadialGradient(CX + Math.cos(a) * r, bodyY + breathe + 20 + Math.sin(a) * r * 0.4, 0, CX + Math.cos(a) * r, bodyY + breathe + 20 + Math.sin(a) * r * 0.4, 5);
        pGrad.addColorStop(0, cols[i] + 'cc'); pGrad.addColorStop(1, cols[i] + '00');
        ctx.fillStyle = pGrad;
        ctx.beginPath(); ctx.arc(CX + Math.cos(a) * r, bodyY + breathe + 20 + Math.sin(a) * r * 0.4, 5, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ── SLEEP ──
    if (sleepLevel >= 1) {
      const zSizes = [10, 8, 7];
      zSizes.forEach((size, i) => {
        const t = (frame * 0.018 + i * 0.8) % (Math.PI * 2);
        const alpha = (Math.sin(t) * 0.4 + 0.6) * (1 - i * 0.2);
        const zy = headY - 8 - i * 9 - Math.sin(frame * 0.015 + i) * 3;
        ctx.globalAlpha = alpha;
        const zGrad = ctx.createLinearGradient(CX + 16, zy, CX + 28, zy);
        zGrad.addColorStop(0, '#81d4fa'); zGrad.addColorStop(1, '#b3e5fc');
        ctx.fillStyle = zGrad; ctx.font = `bold ${size}px monospace`; ctx.fillText('z', CX + 17 + i * 4, zy);
        ctx.globalAlpha = 1;
      });
    }
    if (sleepLevel >= 2) {
      const maskGrad = ctx.createLinearGradient(CX - 11, headY + 9, CX + 11, headY + 15);
      maskGrad.addColorStop(0, '#283593'); maskGrad.addColorStop(1, '#1a237e');
      ctx.fillStyle = maskGrad; roundRect(ctx, CX - 11, headY + 9, 22, 6, 3); ctx.fill();
      ctx.fillStyle = '#3949ab';
      ctx.beginPath(); ctx.ellipse(CX - 5, headY + 11, 3.5, 2.5, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(CX + 5, headY + 11, 3.5, 2.5, 0, Math.PI, 0); ctx.fill();
    }
    if (sleepLevel >= 3) {
      for (let i = 0; i < sleepLevel - 1; i++) {
        const a = frame * 0.018 + i * (Math.PI * 2 / (sleepLevel - 1));
        const sx = CX + Math.cos(a) * 30, sy = headY - 6 + Math.sin(a) * 13;
        ctx.globalAlpha = 0.7 + Math.sin(frame * 0.04 + i) * 0.3;
        ctx.font = '11px serif'; ctx.fillStyle = '#fff9c4';
        ctx.fillText(i % 2 === 0 ? '★' : '☽', sx, sy);
        ctx.globalAlpha = 1;
      }
    }

    // ── MINDFULNESS ──
    if (mindLevel >= 1) {
      const haloAlpha = Math.sin(frame * 0.025) * 0.25 + 0.45;
      const haloGrad = ctx.createRadialGradient(CX, headY - 7, 8, CX, headY - 7, 18);
      haloGrad.addColorStop(0, `rgba(255,241,118,${haloAlpha})`);
      haloGrad.addColorStop(1, 'rgba(255,241,118,0)');
      ctx.fillStyle = haloGrad; ctx.beginPath(); ctx.arc(CX, headY - 7, 18, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,241,118,${haloAlpha + 0.1})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(CX, headY - 7, 15, 4.5, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (mindLevel >= 2) {
      const petalCols = ['#f48fb1','#f06292','#ce93d8'];
      petalCols.forEach((c, i) => {
        const a = (i / 3) * Math.PI * 2 + frame * 0.008;
        const px2 = CX + Math.cos(a) * 9, py2 = feetY + 4 + Math.sin(a) * 3.5;
        const pGrad = ctx.createRadialGradient(px2, py2, 0, px2, py2, 6);
        pGrad.addColorStop(0, c + 'cc'); pGrad.addColorStop(1, c + '00');
        ctx.fillStyle = pGrad; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.ellipse(px2, py2, 5, 7, a, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });
    }
    if (mindLevel >= 3) {
      const tf = Math.sin(frame * 0.012) * 3;
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#e1bee7';
      ctx.font = '11px serif'; ctx.fillText('☯', CX - 32, headY - 9 + tf);
      ctx.globalAlpha = 1;
    }

    // ── OTHER ──
    if (otherLevel >= 1) {
      for (let i = 0; i < otherLevel * 2; i++) {
        const a = (frame * 0.025 + i * 1.1) % (Math.PI * 2);
        const r = 22 + i * 5;
        const alpha = Math.sin(frame * 0.035 + i) * 0.3 + 0.35;
        const pGrad = ctx.createRadialGradient(CX + Math.cos(a) * r, bodyY + breathe + 12 + Math.sin(a) * r * 0.5, 0, CX + Math.cos(a) * r, bodyY + breathe + 12 + Math.sin(a) * r * 0.5, 5);
        pGrad.addColorStop(0, `rgba(192,132,252,${alpha + 0.2})`);
        pGrad.addColorStop(1, 'rgba(192,132,252,0)');
        ctx.fillStyle = pGrad;
        ctx.beginPath(); ctx.arc(CX + Math.cos(a) * r, bodyY + breathe + 12 + Math.sin(a) * r * 0.5, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (otherLevel >= 2) {
      ctx.fillStyle = '#7c3aed'; ctx.globalAlpha = 0.6;
      const capeSwing = Math.sin(frame * 0.025) * 6;
      ctx.shadowColor = 'rgba(124,58,237,0.4)'; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(CX - 3, bodyY + breathe + 3);
      ctx.bezierCurveTo(CX - 8, bodyY + breathe + 20, CX - 16 + capeSwing, feetY - 20, CX - 14 + capeSwing, feetY - 5);
      ctx.lineTo(CX + 3, feetY - 8);
      ctx.bezierCurveTo(CX - 2, feetY - 20, CX - 3, bodyY + breathe + 20, CX - 1, bodyY + breathe + 3);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
  }

  // ── PARTICLES ─────────────────────────────────────────────────────────────
  function drawParticles(ctx: CanvasRenderingContext2D, W: number, H: number, frame: number) {
    const fitnessLevel = getLevel('fitness'), mindLevel = getLevel('mindfulness');
    const CX = W / 2, groundY = H * 0.65;

    if (fitnessLevel >= 3) {
      for (let p = 0; p < fitnessLevel + 2; p++) {
        const t = (frame * 0.018 + p * 1.1) % 1;
        const eased = 1 - Math.pow(1 - t, 2);
        const px = CX + 18 + p * 5 + Math.sin(t * Math.PI * 2 + p) * 4;
        const py = groundY - 100 - eased * 60;
        const pGrad = ctx.createRadialGradient(px, py, 0, px, py, 3.5);
        pGrad.addColorStop(0, `rgba(129,212,250,${(1 - t) * 0.85})`);
        pGrad.addColorStop(1, 'rgba(129,212,250,0)');
        ctx.fillStyle = pGrad;
        ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    if (mindLevel >= 4) {
      for (let s = 0; s < 8; s++) {
        const angle = (frame * 0.016 + s * 0.785) % (Math.PI * 2);
        const drift = Math.sin(frame * 0.025 + s * 1.3) * 12;
        const sx = CX + Math.cos(angle) * (72 + drift);
        const sy = groundY - 80 + Math.sin(angle) * 26;
        const alpha = Math.sin(frame * 0.04 + s) * 0.4 + 0.5;
        // Starburst
        ctx.strokeStyle = `rgba(255,249,196,${alpha})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sx, sy - 4); ctx.lineTo(sx, sy + 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx - 4, sy); ctx.lineTo(sx + 4, sy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx - 2.8, sy - 2.8); ctx.lineTo(sx + 2.8, sy + 2.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx + 2.8, sy - 2.8); ctx.lineTo(sx - 2.8, sy + 2.8); ctx.stroke();
      }
    }
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  const totalCompletions = Object.values(traits).reduce((s, t) => s + (t?.completions ?? 0), 0);
  const activeCats = displayCategories.filter(c => (traits[c.id as GoalCategory]?.completions ?? 0) > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-[#0a0a16] rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/5">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Your Character</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              {totalCompletions === 0
                ? 'Complete goals to evolve your character'
                : `${totalCompletions} completions · ${activeCats.length} trait${activeCats.length !== 1 ? 's' : ''} unlocked`}
            </p>
          </div>
          <div className="flex gap-2">
            {activeCats.slice(0, 5).map(c => (
              <span key={c.id} className="text-xl drop-shadow-lg">{c.emoji}</span>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading character…</div>
        ) : (
          <canvas
            ref={canvasRef}
            width={640}
            height={340}
            className="w-full"
            style={{ imageRendering: 'auto' }}
          />
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {displayCategories.map(cat => {
          const trait = traits[cat.id as GoalCategory];
          const completions = trait?.completions ?? 0;
          const { level, progress, completionsInLevel, completionsNeeded } = getProgressToNextLevel(completions);
          const isMaxed = level >= MAX_LEVEL, isUnlocked = completions > 0;
          return (
            <div
              key={cat.id}
              className={`rounded-xl border p-4 transition-all duration-300 ${
                isUnlocked
                  ? dark
                    ? 'bg-[#12122a] border-[#2a2a50] shadow-lg shadow-indigo-950/30'
                    : 'bg-white border-slate-200 shadow-sm'
                  : dark
                  ? 'bg-[#0d0d1f] border-[#1a1a30] opacity-40'
                  : 'bg-slate-50 border-slate-100 opacity-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{cat.emoji}</span>
                  <span className={`font-semibold text-sm ${dark ? 'text-white' : 'text-slate-800'}`}>{cat.label}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  isMaxed
                    ? 'bg-yellow-100 text-yellow-700'
                    : dark
                    ? 'bg-[#0a0a1a] text-slate-400 ring-1 ring-white/10'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {isMaxed ? 'MAX' : `Lv ${level}`}
                </span>
              </div>
              {isUnlocked ? (
                <>
                  <div className={`rounded-full h-1.5 overflow-hidden mb-1.5 ${dark ? 'bg-[#0a0a1a]' : 'bg-slate-100'}`}>
                    <div
                      className="h-1.5 rounded-full transition-all duration-700"
                      style={{
                        width: `${isMaxed ? 100 : progress * 100}%`,
                        background: isMaxed
                          ? 'linear-gradient(90deg,#f9a825,#ffd600,#ffee58)'
                          : 'linear-gradient(90deg,#6366f1,#8b5cf6,#a855f7)',
                        boxShadow: isMaxed ? '0 0 8px rgba(249,168,37,0.6)' : '0 0 8px rgba(139,92,246,0.5)',
                      }}
                    />
                  </div>
                  <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {isMaxed
                      ? `${completions} completions — maxed!`
                      : `${completionsInLevel}/${completionsNeeded} to level ${level + 1}`}
                  </p>
                </>
              ) : (
                <p className={`text-xs ${dark ? 'text-slate-600' : 'text-slate-400'}`}>{cat.description}</p>
              )}
            </div>
          );
        })}
      </div>

      {totalCompletions === 0 && (
        <div className={`text-center py-6 text-sm ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          <p className="text-3xl mb-2">🌱</p>
          <p>Complete your first goal to start evolving your character.</p>
        </div>
      )}
    </div>
  );
}
