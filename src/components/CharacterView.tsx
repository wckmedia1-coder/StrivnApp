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

  // Day/night cycle: full cycle = 30 minutes = 1800 seconds
  // Returns 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 1 = midnight
  function getDayPhase(): number {
    const ms = Date.now();
    const cycleDuration = 30 * 60 * 1000; // 30 minutes in ms
    return (ms % cycleDuration) / cycleDuration;
  }

  function getSkyColors(phase: number): { top: string; bottom: string; ambientAlpha: number; isNight: boolean } {
    // phase: 0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset, 1=midnight
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const lerpHex = (c1: number[], c2: number[], t: number) =>
      c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
    const toRgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

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
      // midnight → pre-sunrise
      const t = phase / 0.15;
      top = lerpHex(midnight, [40, 20, 60], t);
      bot = lerpHex(midnightBot, [60, 30, 80], t);
      ambientAlpha = 0; isNight = true;
    } else if (phase < 0.25) {
      // sunrise
      const t = (phase - 0.15) / 0.1;
      top = lerpHex([40, 20, 60], sunrise, t);
      bot = lerpHex([60, 30, 80], sunriseBot, t);
      ambientAlpha = t * 0.3; isNight = false;
    } else if (phase < 0.45) {
      // morning → noon
      const t = (phase - 0.25) / 0.2;
      top = lerpHex(sunrise, noon, t);
      bot = lerpHex(sunriseBot, noonBot, t);
      ambientAlpha = 0.3 + t * 0.2; isNight = false;
    } else if (phase < 0.55) {
      // noon
      top = noon; bot = noonBot; ambientAlpha = 0.5; isNight = false;
    } else if (phase < 0.7) {
      // noon → sunset
      const t = (phase - 0.55) / 0.15;
      top = lerpHex(noon, sunset, t);
      bot = lerpHex(noonBot, sunsetBot, t);
      ambientAlpha = 0.5 - t * 0.2; isNight = false;
    } else if (phase < 0.8) {
      // sunset → dusk
      const t = (phase - 0.7) / 0.1;
      top = lerpHex(sunset, [40, 20, 60], t);
      bot = lerpHex(sunsetBot, [30, 15, 50], t);
      ambientAlpha = 0.3 - t * 0.3; isNight = t > 0.5;
    } else {
      // dusk → midnight
      const t = (phase - 0.8) / 0.2;
      top = lerpHex([40, 20, 60], midnight, t);
      bot = lerpHex([30, 15, 50], midnightBot, t);
      ambientAlpha = 0; isNight = true;
    }

    return { top: toRgb(top), bottom: toRgb(bot), ambientAlpha, isNight };
  }

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

    // Sun or moon
    const sunX = W * (0.2 + Math.sin(phase * Math.PI * 2) * 0.3 + 0.3);
    const sunY = groundY * (0.8 - Math.abs(Math.sin(phase * Math.PI)) * 0.7);

    if (isNight) {
      // Moon
      ctx.fillStyle = '#fffde7';
      ctx.beginPath(); ctx.arc(sunX, sunY, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = top;
      ctx.beginPath(); ctx.arc(sunX + 8, sunY - 4, 12, 0, Math.PI * 2); ctx.fill();
    } else {
      // Sun glow
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#ffd600';
      ctx.beginPath(); ctx.arc(sunX, sunY, 28, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff176';
      ctx.beginPath(); ctx.arc(sunX, sunY, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd600';
      ctx.beginPath(); ctx.arc(sunX, sunY, 14, 0, Math.PI * 2); ctx.fill();
    }

    // Stars (visible at night)
    const starAlpha = isNight ? 1 : Math.max(0, 1 - ambientAlpha * 3);
    if (starAlpha > 0.05) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 35; i++) {
        const twinkle = Math.sin(frameRef.current * 0.03 + i) * 0.5 + 0.5;
        ctx.globalAlpha = starAlpha * (0.3 + twinkle * 0.7);
        ctx.fillRect((i * 97 + 13) % W, (i * 61 + 7) % (groundY * 0.85), i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
    }

    // Clouds (visible in daytime)
    if (ambientAlpha > 0.1) {
      ctx.globalAlpha = ambientAlpha * 0.6;
      ctx.fillStyle = '#ffffff';
      const cloudX = (frameRef.current * 0.15) % (W + 100) - 50;
      [[cloudX, groundY * 0.2, 50, 18], [cloudX + 40, groundY * 0.2 - 8, 40, 14],
       [cloudX + W * 0.5, groundY * 0.35, 60, 20], [cloudX + W * 0.5 + 50, groundY * 0.35 - 6, 45, 15]]
        .forEach(([x, y, w, h]) => { ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); ctx.fill(); });
      ctx.globalAlpha = 1;
    }

    // Ground
    const nutritionLevel = getLevel('nutrition');
    const grassDark = nutritionLevel >= 2 ? '#2d5a1b' : nutritionLevel >= 1 ? '#1e3d0f' : '#141f0a';
    const grassLight = nutritionLevel >= 3 ? '#3a7a24' : '#1a2f0d';

    // Ambient light overlay on ground
    if (ambientAlpha > 0) {
      ctx.globalAlpha = ambientAlpha * 0.25;
      ctx.fillStyle = '#ffe082';
      ctx.fillRect(0, groundY, W, H - groundY);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = grassDark; ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = grassLight;
    for (let gx = 0; gx < W; gx += 8) ctx.fillRect(gx, groundY, 3, 4 + (gx % 3));

    // Path
    ctx.fillStyle = '#1c1c2e'; ctx.fillRect(W / 2 - 80, groundY - 4, 160, 8);
    ctx.fillStyle = '#2a2a3e'; ctx.fillRect(W / 2 - 78, groundY - 2, 156, 4);

    // Other category sparkles
    const otherLevel = getLevel('other' as GoalCategory);
    if (otherLevel >= 1) {
      for (let sp = 0; sp < otherLevel * 3; sp++) {
        const t = (frameRef.current * 0.015 + sp * 0.9) % (Math.PI * 2);
        ctx.globalAlpha = Math.sin(t) * 0.4 + 0.2;
        ctx.fillStyle = '#c084fc';
        const sx = (sp * 83 + 20) % W, sy = ((sp * 57 + 15) % (groundY * 0.85));
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawProps(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const groundY = H * 0.65, CX = W / 2;
    const readLevel = getLevel('reading'), creativityLevel = getLevel('creativity');
    const mindLevel = getLevel('mindfulness'), nutritionLevel = getLevel('nutrition');
    const sleepLevel = getLevel('sleep');

    // Bookshelf (reading)
    if (readLevel >= 1) {
      const bx = CX - 140, by = groundY - 90, bw = 72, bh = 88;
      ctx.fillStyle = '#5d3a1a'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#3e2710'; ctx.fillRect(bx + bw - 6, by, 6, bh); ctx.fillRect(bx, by, 6, bh);
      const shelves = readLevel >= 3 ? 3 : readLevel >= 2 ? 2 : 1;
      ctx.fillStyle = '#7a4e2a';
      for (let s = 0; s < shelves; s++) ctx.fillRect(bx + 4, by + 24 + s * 28, bw - 8, 4);
      const bc = ['#e53935','#1e88e5','#43a047','#fdd835','#8e24aa','#f4511e','#00acc1'];
      const bps = Math.min(readLevel * 2, 7);
      for (let s = 0; s < shelves; s++) for (let b = 0; b < bps; b++) {
        const bh2 = 18 + (b % 3) * 3;
        ctx.fillStyle = bc[(s * 7 + b) % bc.length];
        ctx.fillRect(bx + 6 + b * 9, by + 4 + s * 28 + (22 - bh2), 7, bh2);
      }
      // Level 4+: add a reading lamp next to bookshelf
      if (readLevel >= 4) {
        ctx.fillStyle = '#8d6e63'; ctx.fillRect(bx - 10, groundY - 55, 4, 55);
        ctx.fillStyle = '#ffd600'; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(bx - 8, groundY - 56, 10, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.15; ctx.fillStyle = '#ffd600';
        ctx.beginPath(); ctx.arc(bx - 8, groundY - 56, 22, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Easel / art station (creativity)
    if (creativityLevel >= 1) {
      const ex = CX + 80, ey = groundY - 95;
      ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 3;
      [[ex + 20, ey + 85, ex + 5, ey + 20], [ex + 20, ey + 85, ex + 35, ey + 20], [ex + 20, ey + 85, ex + 20, ey + 20]].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });
      ctx.fillStyle = '#fff8e1'; ctx.fillRect(ex, ey + 10, 40, 34);
      ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 2; ctx.strokeRect(ex, ey + 10, 40, 34);
      ctx.fillStyle = '#42a5f5'; ctx.fillRect(ex + 4, ey + 14, 32, 16);
      if (creativityLevel >= 2) {
        ctx.fillStyle = '#66bb6a'; ctx.fillRect(ex + 4, ey + 30, 32, 10);
        ctx.fillStyle = '#ffa726'; ctx.beginPath(); ctx.arc(ex + 20, ey + 22, 5, 0, Math.PI * 2); ctx.fill();
      }
      if (creativityLevel >= 3) {
        const nf = Math.sin(frameRef.current * 0.04) * 4;
        ctx.fillStyle = '#ffd600'; ctx.font = '14px serif'; ctx.fillText('♪', ex + 55, ey + 20 + nf);
      }
      // Level 4+: paint palette on the ground
      if (creativityLevel >= 4) {
        ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.ellipse(ex + 55, groundY - 8, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
        ['#e53935','#1e88e5','#43a047','#fdd835'].forEach((c, i) => {
          ctx.fillStyle = c; ctx.beginPath(); ctx.arc(ex + 48 + i * 6, groundY - 8, 3, 0, Math.PI * 2); ctx.fill();
        });
      }
    }

    // Mindfulness orbs + plants
    if (mindLevel >= 1) {
      for (let o = 0; o < mindLevel; o++) {
        const angle = frameRef.current * 0.015 + (o * Math.PI * 2) / mindLevel;
        const pulse = Math.sin(frameRef.current * 0.05 + o) * 0.3 + 0.7;
        ctx.globalAlpha = 0.25 * pulse;
        ctx.fillStyle = ['#4fc3f7','#81c784','#ce93d8','#fff176','#ffb74d'][o % 5];
        ctx.beginPath(); ctx.arc(CX + Math.cos(angle) * (55 + o * 8), groundY - 80 + Math.sin(angle) * 18, 5 + pulse * 2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (mindLevel >= 2) {
        [CX - 60, ...(mindLevel >= 3 ? [CX + 42] : [])].forEach(x => {
          ctx.fillStyle = '#8d6e63'; ctx.fillRect(x, groundY - 22, 16, 16);
          ctx.fillStyle = '#2e7d32'; ctx.fillRect(x + 6, groundY - 38, 4, 16); ctx.fillRect(x, groundY - 38, 16, 8);
        });
      }
      // Level 4+: meditation mat
      if (mindLevel >= 4) {
        ctx.fillStyle = '#7b1fa2'; ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.ellipse(CX, groundY - 1, 35, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.4; ctx.fillStyle = '#ce93d8';
        ctx.beginPath(); ctx.ellipse(CX, groundY - 1, 28, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Nutrition: food items on ground
    if (nutritionLevel >= 2) {
      ctx.fillStyle = '#4caf50'; ctx.fillRect(CX - 30, groundY - 8, 60, 6);
      ['🍎','🥦','🥕','🫐'].slice(0, nutritionLevel).forEach((f, i) => {
        ctx.font = '12px serif'; ctx.fillText(f, CX - 26 + i * 14, groundY - 6);
      });
    }

    // Sleep level 3+: cozy lamp/moon lamp near path
    if (sleepLevel >= 3) {
      ctx.fillStyle = '#37474f'; ctx.fillRect(CX + 90, groundY - 40, 4, 40);
      ctx.fillStyle = '#b0bec5'; ctx.beginPath(); ctx.arc(CX + 92, groundY - 42, 8, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.2; ctx.fillStyle = '#b3e5fc';
      ctx.beginPath(); ctx.arc(CX + 92, groundY - 42, 18, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawCharacter(ctx: CanvasRenderingContext2D, W: number, H: number, frame: number) {
    const CX = W / 2, groundY = H * 0.65;
    const fitnessLevel = getLevel('fitness'), sleepLevel = getLevel('sleep'), nutritionLevel = getLevel('nutrition');
    const bodyW = 26 + fitnessLevel * 3, bodyH = 38 - fitnessLevel, shoulderW = bodyW + fitnessLevel * 2;
    const breathe = Math.sin(frame * 0.025) * 1.5;
    const feetY = groundY - 4, bodyY = feetY - bodyH - 20, headY = bodyY - 28 - breathe;
    const skin = nutritionLevel >= 3 ? '#f5cba7' : nutritionLevel >= 1 ? '#f0b27a' : '#e59866';
    const walkAngle = Math.sin(frame * 0.04) * (fitnessLevel >= 1 ? 4 : 1);

    // Legs
    ctx.fillStyle = '#3a3a5c';
    ctx.fillRect(CX - 14 + walkAngle, feetY - 20, 12, 20);
    ctx.fillRect(CX + 2 - walkAngle, feetY - 20, 12, 20);

    // Shoes — upgraded with fitness level
    const shoeColor = fitnessLevel >= 3 ? '#f44336' : fitnessLevel >= 1 ? '#ffffff' : '#212121';
    ctx.fillStyle = shoeColor;
    ctx.fillRect(CX - 16 + walkAngle, feetY - 4, 14, 6);
    ctx.fillRect(CX + 2 - walkAngle, feetY - 4, 14, 6);
    if (fitnessLevel >= 1) {
      ctx.fillStyle = '#bdbdbd';
      ctx.fillRect(CX - 16 + walkAngle, feetY + 1, 14, 1);
      ctx.fillRect(CX + 2 - walkAngle, feetY + 1, 14, 1);
    }

    // Shirt
    const crtLevel = getLevel('creativity');
    const shirtColor = ['#455a64','#1565c0','#6a1b9a','#b71c1c','#1b5e20'][Math.min(crtLevel, 4)];
    ctx.fillStyle = shirtColor;
    ctx.fillRect(CX - bodyW / 2, bodyY + breathe, bodyW, bodyH);
    ctx.fillRect(CX - shoulderW / 2, bodyY + breathe, shoulderW, 8);

    // Arms
    const armW = 8 + fitnessLevel, armSwing = Math.sin(frame * 0.04) * (fitnessLevel >= 1 ? 3 : 1);
    ctx.fillStyle = shirtColor;
    ctx.fillRect(CX - shoulderW / 2 - armW + 2, bodyY + breathe + 4 - armSwing, armW, 20);
    ctx.fillRect(CX + shoulderW / 2 - 2, bodyY + breathe + 4 + armSwing, armW, 20);
    ctx.fillStyle = skin;
    ctx.fillRect(CX - shoulderW / 2 - armW + 2, bodyY + breathe + 22 - armSwing, armW, 10);
    ctx.fillRect(CX + shoulderW / 2 - 2, bodyY + breathe + 22 + armSwing, armW, 10);

    // Head
    ctx.fillStyle = skin; ctx.fillRect(CX - 12, headY, 24, 26);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(CX - 14, headY, 28, 8);
    if (sleepLevel >= 3) { ctx.fillRect(CX - 14, headY - 4, 6, 6); ctx.fillRect(CX + 10, headY - 4, 6, 6); }

    // Eyes
    const eyeOpen = sleepLevel >= 2 ? 4 : sleepLevel >= 1 ? 3 : 2;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(CX - 8, headY + 10, 6, eyeOpen + 1); ctx.fillRect(CX + 2, headY + 10, 6, eyeOpen + 1);
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(CX - 7, headY + 11, 4, eyeOpen); ctx.fillRect(CX + 3, headY + 11, 4, eyeOpen);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(CX - 5, headY + 11, 1, 1); ctx.fillRect(CX + 5, headY + 11, 1, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(CX - 1, headY + 16, 3, 2);

    // Mouth / smile
    const mindLevel = getLevel('mindfulness'), smileLevel = Math.min(nutritionLevel + mindLevel, 4);
    ctx.fillStyle = '#c0392b';
    if (smileLevel <= 0) ctx.fillRect(CX - 5, headY + 20, 10, 1);
    else if (smileLevel === 1) ctx.fillRect(CX - 5, headY + 20, 10, 2);
    else { ctx.fillRect(CX - 6, headY + 20, 12, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(CX - 5, headY + 20, 10, 1); }

    // Ears
    ctx.fillStyle = skin; ctx.fillRect(CX - 15, headY + 8, 4, 8); ctx.fillRect(CX + 11, headY + 8, 4, 8);

    // Fitness aura at max level
    if (fitnessLevel >= 5) {
      ctx.globalAlpha = Math.sin(frame * 0.04) * 0.07 + 0.07; ctx.fillStyle = '#f9a825';
      ctx.fillRect(CX - bodyW / 2 - 8, headY - 8, bodyW + 16, feetY - headY + 12); ctx.globalAlpha = 1;
    }

    // Level badge
    const totalLevel = Object.values(traitsRef.current).reduce((s, t) => s + (t?.level ?? 0), 0);
    if (totalLevel > 0) {
      ctx.fillStyle = '#6366f1'; ctx.fillRect(CX + 14, headY - 10, 22, 14);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 9px monospace'; ctx.fillText(`Lv${totalLevel}`, CX + 16, headY + 1);
    }

    // Store positions for items to use
    (drawCharacter as any)._headY = headY;
    (drawCharacter as any)._bodyY = bodyY;
    (drawCharacter as any)._feetY = feetY;
    (drawCharacter as any)._breathe = breathe;
    (drawCharacter as any)._shoulderW = shoulderW;
    (drawCharacter as any)._armW = armW;
    (drawCharacter as any)._armSwing = armSwing;
  }

  function drawCharacterItems(ctx: CanvasRenderingContext2D, W: number, H: number, frame: number) {
    const CX = W / 2, groundY = H * 0.65;
    const fitnessLevel = getLevel('fitness');
    const readLevel = getLevel('reading');
    const nutritionLevel = getLevel('nutrition');
    const creativityLevel = getLevel('creativity');
    const sleepLevel = getLevel('sleep');
    const mindLevel = getLevel('mindfulness');
    const otherLevel = getLevel('other' as GoalCategory);

    const fitnessBodyW = 26 + fitnessLevel * 3;
    const shoulderW = fitnessBodyW + fitnessLevel * 2;
    const armW = 8 + fitnessLevel;
    const breathe = Math.sin(frame * 0.025) * 1.5;
    const bodyH = 38 - fitnessLevel;
    const feetY = groundY - 4;
    const bodyY = feetY - bodyH - 20;
    const headY = bodyY - 28 - breathe;
    const armSwing = Math.sin(frame * 0.04) * (fitnessLevel >= 1 ? 3 : 1);

    // ── FITNESS items ──
    // Level 1: water bottle in hand
    if (fitnessLevel >= 1) {
      const bx = CX + shoulderW / 2 - 2 + armW - 2;
      const by = bodyY + breathe + 22 + armSwing + 4;
      ctx.fillStyle = '#29b6f6'; ctx.fillRect(bx, by, 6, 10);
      ctx.fillStyle = '#0288d1'; ctx.fillRect(bx + 1, by, 4, 3);
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.4; ctx.fillRect(bx + 1, by + 3, 2, 5); ctx.globalAlpha = 1;
    }
    // Level 2: sweatband on head
    if (fitnessLevel >= 2) {
      ctx.fillStyle = '#ef5350';
      ctx.fillRect(CX - 14, headY + 5, 28, 4);
    }
    // Level 3: running shoes already handled (red shoes) + medal
    if (fitnessLevel >= 3) {
      ctx.fillStyle = '#ffd600'; ctx.beginPath(); ctx.arc(CX - shoulderW / 2 - armW + 4, bodyY + breathe + 28 - armSwing, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff6f00'; ctx.font = 'bold 7px monospace'; ctx.fillText('1', CX - shoulderW / 2 - armW + 2, bodyY + breathe + 31 - armSwing);
      ctx.strokeStyle = '#ffa000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(CX - shoulderW / 2 - armW + 4, bodyY + breathe + 34 - armSwing); ctx.lineTo(CX - shoulderW / 2 - armW + 4, bodyY + breathe + 40 - armSwing); ctx.stroke();
    }
    // Level 4: dumbbell in other hand
    if (fitnessLevel >= 4) {
      const dx = CX - shoulderW / 2 - armW + 1;
      const dy = bodyY + breathe + 24 - armSwing;
      ctx.fillStyle = '#424242'; ctx.fillRect(dx - 2, dy + 3, 12, 3);
      ctx.fillStyle = '#757575'; ctx.fillRect(dx - 4, dy, 4, 9); ctx.fillRect(dx + 8, dy, 4, 9);
    }
    // Level 5: fitness halo/crown
    if (fitnessLevel >= 5) {
      ctx.strokeStyle = '#ffd600'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(CX, headY - 4, 16, Math.PI, 0); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const a = Math.PI + (i / 4) * Math.PI;
        ctx.fillStyle = '#ffd600';
        ctx.fillRect(CX + Math.cos(a) * 16 - 1, headY - 4 + Math.sin(a) * 16 - 3, 2, 4);
      }
    }

    // ── READING items ──
    // Level 1: book in hand
    if (readLevel >= 1) {
      const bx = CX - shoulderW / 2 - armW + 1;
      const by = bodyY + breathe + 22 - armSwing + 2;
      ctx.fillStyle = '#1565c0'; ctx.fillRect(bx - 2, by, 10, 13);
      ctx.fillStyle = '#0d47a1'; ctx.fillRect(bx - 2, by, 2, 13);
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.3; ctx.fillRect(bx, by + 2, 6, 1); ctx.fillRect(bx, by + 5, 6, 1); ctx.globalAlpha = 1;
    }
    // Level 2: glasses on face
    if (readLevel >= 2) {
      ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 1.5;
      ctx.strokeRect(CX - 9, headY + 10, 7, 6);
      ctx.strokeRect(CX + 2, headY + 10, 7, 6);
      ctx.beginPath(); ctx.moveTo(CX - 2, headY + 13); ctx.lineTo(CX + 2, headY + 13); ctx.stroke();
    }
    // Level 3: graduation cap
    if (readLevel >= 3) {
      ctx.fillStyle = '#1a1a2e'; ctx.fillRect(CX - 14, headY - 3, 28, 5);
      ctx.fillStyle = '#1a1a2e'; ctx.fillRect(CX - 8, headY - 9, 16, 8);
      ctx.fillStyle = '#ffd600'; ctx.fillRect(CX + 6, headY - 4, 2, 8);
      ctx.fillStyle = '#ffd600'; ctx.beginPath(); ctx.arc(CX + 7, headY + 4, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Level 4+: scroll/diploma floating
    if (readLevel >= 4) {
      const sf = Math.sin(frame * 0.03) * 3;
      ctx.fillStyle = '#fff8e1'; ctx.fillRect(CX + 30, headY - 20 + sf, 18, 14);
      ctx.fillStyle = '#8d6e63'; ctx.fillRect(CX + 29, headY - 21 + sf, 3, 16); ctx.fillRect(CX + 47, headY - 21 + sf, 3, 16);
      ctx.fillStyle = '#bcaaa4'; ctx.fillRect(CX + 32, headY - 17 + sf, 12, 1); ctx.fillRect(CX + 32, headY - 13 + sf, 12, 1);
    }

    // ── NUTRITION items ──
    // Level 1: apple in hand (only if no reading book)
    if (nutritionLevel >= 1 && readLevel < 1) {
      const ax = CX - shoulderW / 2 - armW + 1;
      const ay = bodyY + breathe + 22 - armSwing + 2;
      ctx.font = '12px serif'; ctx.fillText('🍎', ax - 2, ay + 12);
    }
    // Level 2: healthy glow (slight green tint around character)
    if (nutritionLevel >= 2) {
      ctx.globalAlpha = 0.08 + Math.sin(frame * 0.02) * 0.03;
      ctx.fillStyle = '#66bb6a';
      ctx.fillRect(CX - fitnessBodyW / 2 - 10, headY - 5, fitnessBodyW + 20, feetY - headY + 10);
      ctx.globalAlpha = 1;
    }
    // Level 3: chef hat
    if (nutritionLevel >= 3) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(CX - 10, headY - 12, 20, 10);
      ctx.fillStyle = '#eeeeee'; ctx.fillRect(CX - 8, headY - 18, 16, 8);
      ctx.beginPath(); ctx.arc(CX, headY - 18, 8, Math.PI, 0); ctx.fill();
    }
    // Level 4+: floating food emojis
    if (nutritionLevel >= 4) {
      ['🍇','🥑'].forEach((e, i) => {
        const yf = Math.sin(frame * 0.025 + i * 2) * 4;
        ctx.font = '14px serif'; ctx.fillText(e, CX - 40 + i * 70, headY - 15 + yf);
      });
    }

    // ── CREATIVITY items ──
    // Level 1: paintbrush in hand (if no water bottle)
    if (creativityLevel >= 1 && fitnessLevel < 1) {
      const px = CX + shoulderW / 2 - 2 + armW - 4;
      const py = bodyY + breathe + 16 + armSwing;
      ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 2, py + 14); ctx.stroke();
      ctx.fillStyle = '#e53935'; ctx.fillRect(px - 1, py + 11, 4, 5);
    }
    // Level 2: beret on head
    if (creativityLevel >= 2) {
      ctx.fillStyle = '#b71c1c';
      ctx.beginPath(); ctx.ellipse(CX + 4, headY - 2, 14, 7, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c62828';
      ctx.beginPath(); ctx.arc(CX + 14, headY - 5, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Level 3+: color splash particles
    if (creativityLevel >= 3) {
      for (let i = 0; i < 4; i++) {
        const a = (frame * 0.02 + i * 1.57) % (Math.PI * 2);
        const r = 30 + Math.sin(frame * 0.03 + i) * 5;
        ctx.globalAlpha = 0.5; ctx.fillStyle = ['#e53935','#1e88e5','#43a047','#fdd835'][i];
        ctx.beginPath(); ctx.arc(CX + Math.cos(a) * r, bodyY + breathe + 20 + Math.sin(a) * r * 0.4, 3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // ── SLEEP items ──
    // Level 1: pillow held
    if (sleepLevel >= 1) {
      // Zzz floating above head
      const zAlpha = Math.sin(frame * 0.02) * 0.4 + 0.6;
      ctx.globalAlpha = zAlpha; ctx.fillStyle = '#b3e5fc';
      ctx.font = 'bold 10px monospace'; ctx.fillText('z', CX + 18, headY - 5 - Math.sin(frame * 0.015) * 4);
      ctx.font = 'bold 8px monospace'; ctx.fillText('z', CX + 24, headY - 13 - Math.sin(frame * 0.015 + 1) * 3);
      ctx.globalAlpha = 1;
    }
    // Level 2: sleep mask on head when "sleeping" (eyes closed look)
    if (sleepLevel >= 2) {
      ctx.fillStyle = '#1a237e'; ctx.fillRect(CX - 10, headY + 9, 20, 5);
      ctx.fillStyle = '#283593';
      ctx.beginPath(); ctx.arc(CX - 5, headY + 11, 3, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(CX + 5, headY + 11, 3, Math.PI, 0); ctx.fill();
    }
    // Level 3+: moon/stars orbiting
    if (sleepLevel >= 3) {
      for (let i = 0; i < sleepLevel - 1; i++) {
        const a = frame * 0.02 + i * (Math.PI * 2 / (sleepLevel - 1));
        ctx.fillStyle = '#fff9c4'; ctx.globalAlpha = 0.8;
        ctx.font = '10px serif'; ctx.fillText(i % 2 === 0 ? '★' : '☽', CX + Math.cos(a) * 28, headY - 5 + Math.sin(a) * 12);
        ctx.globalAlpha = 1;
      }
    }

    // ── MINDFULNESS items ──
    // Level 1: halo above head
    if (mindLevel >= 1) {
      const haloAlpha = Math.sin(frame * 0.03) * 0.2 + 0.5;
      ctx.globalAlpha = haloAlpha; ctx.strokeStyle = '#fff176'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(CX, headY - 6, 14, 4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Level 2: lotus/flower at feet
    if (mindLevel >= 2) {
      ['#f48fb1','#f06292','#ce93d8'].forEach((c, i) => {
        const a = (i / 3) * Math.PI * 2 + frame * 0.01;
        ctx.fillStyle = c; ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.ellipse(CX + Math.cos(a) * 8, feetY + 3 + Math.sin(a) * 3, 4, 6, a, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });
    }
    // Level 3+: floating mantra text
    if (mindLevel >= 3) {
      const tf = Math.sin(frame * 0.015) * 2;
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#e1bee7';
      ctx.font = '8px serif'; ctx.fillText('☯', CX - 30, headY - 10 + tf);
      ctx.globalAlpha = 1;
    }

    // ── OTHER category ──
    // Makes character look happier/more athletic with increasing level
    if (otherLevel >= 1) {
      // Sparkle on character
      for (let i = 0; i < otherLevel * 2; i++) {
        const a = (frame * 0.03 + i * 1.1) % (Math.PI * 2);
        const r = 20 + i * 4;
        ctx.globalAlpha = Math.sin(frame * 0.04 + i) * 0.3 + 0.3;
        ctx.fillStyle = '#c084fc';
        ctx.fillRect(CX + Math.cos(a) * r - 1, bodyY + breathe + 10 + Math.sin(a) * r * 0.5 - 1, 2, 2);
        ctx.globalAlpha = 1;
      }
    }
    if (otherLevel >= 2) {
      // Cape / flowing element
      ctx.fillStyle = '#7c3aed'; ctx.globalAlpha = 0.7;
      const capeSwing = Math.sin(frame * 0.03) * 5;
      ctx.beginPath();
      ctx.moveTo(CX - 2, bodyY + breathe + 2);
      ctx.lineTo(CX - 14 + capeSwing, feetY - 5);
      ctx.lineTo(CX + 2, feetY - 10);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawParticles(ctx: CanvasRenderingContext2D, W: number, H: number, frame: number) {
    const fitnessLevel = getLevel('fitness'), mindLevel = getLevel('mindfulness');
    const CX = W / 2, groundY = H * 0.65;
    if (fitnessLevel >= 3) {
      for (let p = 0; p < fitnessLevel; p++) {
        const t = (frame * 0.02 + p * 1.3) % 1;
        ctx.globalAlpha = (1 - t) * 0.7; ctx.fillStyle = '#81d4fa';
        ctx.fillRect(CX + 20 + p * 6, groundY - 130 + t * 40, 2, 3); ctx.globalAlpha = 1;
      }
    }
    if (mindLevel >= 4) {
      for (let s = 0; s < 6; s++) {
        const angle = (frame * 0.02 + s * 1.05) % (Math.PI * 2);
        const sx = CX + Math.cos(angle) * (70 + Math.sin(frame * 0.03 + s) * 10);
        const sy = groundY - 80 + Math.sin(angle) * 25;
        ctx.globalAlpha = Math.sin(frame * 0.05 + s) * 0.4 + 0.4; ctx.fillStyle = '#fff9c4';
        ctx.fillRect(sx, sy, 3, 3); ctx.fillRect(sx + 1, sy - 2, 1, 7); ctx.fillRect(sx - 2, sy + 1, 7, 1); ctx.globalAlpha = 1;
      }
    }
  }

  const totalCompletions = Object.values(traits).reduce((s, t) => s + (t?.completions ?? 0), 0);
  const activeCats = displayCategories.filter(c => (traits[c.id as GoalCategory]?.completions ?? 0) > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-[#0f0f1a] rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Your Character</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              {totalCompletions === 0 ? 'Complete goals to evolve your character' : `${totalCompletions} completions · ${activeCats.length} trait${activeCats.length !== 1 ? 's' : ''} unlocked`}
            </p>
          </div>
          <div className="flex gap-2">{activeCats.slice(0, 5).map(c => <span key={c.id} className="text-xl">{c.emoji}</span>)}</div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading character…</div>
        ) : (
          <canvas ref={canvasRef} width={640} height={340} className="w-full" style={{ imageRendering: 'pixelated' }} />
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {displayCategories.map(cat => {
          const trait = traits[cat.id as GoalCategory];
          const completions = trait?.completions ?? 0;
          const { level, progress, completionsInLevel, completionsNeeded } = getProgressToNextLevel(completions);
          const isMaxed = level >= MAX_LEVEL, isUnlocked = completions > 0;
          return (
            <div key={cat.id} className={`rounded-xl border p-4 transition-all ${
              isUnlocked
                ? dark ? 'bg-[#1a1a2e] border-[#2a2a4a]' : 'bg-white border-slate-200 shadow-sm'
                : dark ? 'bg-[#13132a] border-[#1e1e3a] opacity-40' : 'bg-slate-50 border-slate-100 opacity-50'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{cat.emoji}</span>
                  <span className={`font-semibold text-sm ${dark ? 'text-white' : 'text-slate-800'}`}>{cat.label}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isMaxed ? 'bg-yellow-100 text-yellow-700' : dark ? 'bg-[#0d0d1a] text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                  {isMaxed ? 'MAX' : `Lv ${level}`}
                </span>
              </div>
              {isUnlocked ? (
                <>
                  <div className={`rounded-full h-1.5 overflow-hidden mb-1 ${dark ? 'bg-[#0d0d1a]' : 'bg-slate-100'}`}>
                    <div className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${isMaxed ? 100 : progress * 100}%`, background: isMaxed ? 'linear-gradient(90deg,#f9a825,#ffd600)' : 'linear-gradient(90deg,#6366f1,#a855f7)' }} />
                  </div>
                  <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {isMaxed ? `${completions} completions — maxed!` : `${completionsInLevel}/${completionsNeeded} to level ${level + 1}`}
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
