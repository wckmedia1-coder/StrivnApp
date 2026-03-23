import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  loadCharacterTraits,
  getProgressToNextLevel,
  CATEGORIES,
  MAX_LEVEL,
  type CharacterTrait,
  type GoalCategory,
} from '../lib/gameLogic';

type TraitMap = Partial<Record<GoalCategory, CharacterTrait>>;

export function CharacterView() {
  const { user } = useAuth();
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

  useEffect(() => {
    traitsRef.current = traits;
  }, [traits]);

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
    for (const t of list) map[t.category as GoalCategory] = t;
    setTraits(map);
    traitsRef.current = map;
    setLoading(false);
  };

  const getLevel = (cat: GoalCategory) => traitsRef.current[cat]?.level ?? 0;

  // ─── Canvas drawing ───────────────────────────────────────────────────────

  function startAnimation(ctx: CanvasRenderingContext2D, W: number, H: number) {
    function loop() {
      frameRef.current++;
      ctx.clearRect(0, 0, W, H);
      drawBackground(ctx, W, H);
      drawProps(ctx, W, H);
      drawCharacter(ctx, W, H, frameRef.current);
      drawParticles(ctx, W, H, frameRef.current);
      animRef.current = requestAnimationFrame(loop);
    }
    loop();
  }

  function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const mindLevel = getLevel('mindfulness');
    const sleepLevel = getLevel('sleep');

    // Sky gradient — calmer/more vibrant with mindfulness
    const skyTop = mindLevel >= 3 ? '#1a1a2e' : '#0f0f1a';
    const skyBot = mindLevel >= 2 ? '#16213e' : '#0d0d1a';
    const grad = ctx.createLinearGradient(0, 0, 0, H * 0.65);
    grad.addColorStop(0, skyTop);
    grad.addColorStop(1, skyBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H * 0.65);

    // Stars — more stars with better sleep
    const starCount = 20 + sleepLevel * 15;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < starCount; i++) {
      const sx = ((i * 97 + 13) % W);
      const sy = ((i * 61 + 7) % (H * 0.5));
      const twinkle = Math.sin(frameRef.current * 0.03 + i) * 0.5 + 0.5;
      ctx.globalAlpha = 0.3 + twinkle * 0.7;
      ctx.fillRect(sx, sy, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;

    // Moon
    ctx.fillStyle = '#fffde7';
    ctx.beginPath();
    ctx.arc(W - 60, 40, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skyTop;
    ctx.beginPath();
    ctx.arc(W - 52, 36, 14, 0, Math.PI * 2);
    ctx.fill();

    // Ground
    const groundY = H * 0.65;
    const nutritionLevel = getLevel('nutrition');
    const grassColor = nutritionLevel >= 2 ? '#2d5a1b' : nutritionLevel >= 1 ? '#1e3d0f' : '#141f0a';
    ctx.fillStyle = grassColor;
    ctx.fillRect(0, groundY, W, H - groundY);

    // Grass detail
    ctx.fillStyle = nutritionLevel >= 3 ? '#3a7a24' : '#1a2f0d';
    for (let gx = 0; gx < W; gx += 8) {
      const gh = 4 + (gx % 3);
      ctx.fillRect(gx, groundY, 3, gh);
    }

    // Floor under character
    ctx.fillStyle = '#1c1c2e';
    ctx.fillRect(W / 2 - 80, groundY - 4, 160, 8);
    ctx.fillStyle = '#2a2a3e';
    ctx.fillRect(W / 2 - 78, groundY - 2, 156, 4);
  }

  function drawProps(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const groundY = H * 0.65;
    const CX = W / 2;
    const readLevel = getLevel('reading');
    const creativityLevel = getLevel('creativity');
    const mindLevel = getLevel('mindfulness');
    const nutritionLevel = getLevel('nutrition');

    // ── Bookshelf (reading) ──────────────────────────────
    if (readLevel >= 1) {
      const bx = CX - 140;
      const by = groundY - 90;
      const bw = 72;
      const bh = 88;

      // Shelf frame
      ctx.fillStyle = '#5d3a1a';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#3e2710';
      ctx.fillRect(bx + bw - 6, by, 6, bh);
      ctx.fillRect(bx, by, 6, bh);

      // Shelves
      const shelves = readLevel >= 3 ? 3 : readLevel >= 2 ? 2 : 1;
      ctx.fillStyle = '#7a4e2a';
      for (let s = 0; s < shelves; s++) {
        ctx.fillRect(bx + 4, by + 24 + s * 28, bw - 8, 4);
      }

      // Books per shelf
      const bookColors = ['#e53935','#1e88e5','#43a047','#fdd835','#8e24aa','#f4511e','#00acc1'];
      const booksPerShelf = Math.min(readLevel * 2, 7);
      for (let s = 0; s < shelves; s++) {
        for (let b = 0; b < booksPerShelf; b++) {
          const bookX = bx + 6 + b * 9;
          const bookY = by + 4 + s * 28;
          const bookH = 18 + (b % 3) * 3;
          ctx.fillStyle = bookColors[(s * 7 + b) % bookColors.length];
          ctx.fillRect(bookX, bookY + (22 - bookH), 7, bookH);
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fillRect(bookX + 6, bookY + (22 - bookH), 1, bookH);
        }
      }

      // Glow effect at high level
      if (readLevel >= 4) {
        ctx.fillStyle = 'rgba(253,216,53,0.07)';
        ctx.fillRect(bx - 8, by - 8, bw + 16, bh + 16);
      }
    }

    // ── Art easel (creativity) ───────────────────────────
    if (creativityLevel >= 1) {
      const ex = CX + 80;
      const ey = groundY - 95;

      // Legs
      ctx.strokeStyle = '#8d6e63';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ex + 20, ey + 85); ctx.lineTo(ex + 5, ey + 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex + 20, ey + 85); ctx.lineTo(ex + 35, ey + 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex + 20, ey + 85); ctx.lineTo(ex + 20, ey + 20); ctx.stroke();

      // Canvas on easel
      ctx.fillStyle = '#fff8e1';
      ctx.fillRect(ex, ey + 10, 40, 34);
      ctx.strokeStyle = '#6d4c41';
      ctx.lineWidth = 2;
      ctx.strokeRect(ex, ey + 10, 40, 34);

      // Painting on canvas — evolves with level
      if (creativityLevel >= 1) {
        ctx.fillStyle = '#42a5f5';
        ctx.fillRect(ex + 4, ey + 14, 32, 16);
      }
      if (creativityLevel >= 2) {
        ctx.fillStyle = '#66bb6a';
        ctx.fillRect(ex + 4, ey + 30, 32, 10);
        ctx.fillStyle = '#ffa726';
        ctx.beginPath();
        ctx.arc(ex + 20, ey + 22, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (creativityLevel >= 3) {
        // More detailed painting
        ctx.fillStyle = '#ef5350';
        ctx.fillRect(ex + 4, ey + 14, 10, 10);
        ctx.fillStyle = '#ab47bc';
        ctx.fillRect(ex + 26, ey + 14, 10, 10);
      }
      if (creativityLevel >= 4) {
        // Glow around easel
        ctx.fillStyle = 'rgba(255,167,38,0.1)';
        ctx.fillRect(ex - 6, ey + 4, 52, 46);
      }

      // Paint palette
      if (creativityLevel >= 2) {
        ctx.fillStyle = '#795548';
        ctx.beginPath();
        ctx.ellipse(ex + 50, ey + 60, 14, 10, -0.3, 0, Math.PI * 2);
        ctx.fill();
        const dotColors = ['#f44336','#2196f3','#ffeb3b','#4caf50'];
        dotColors.forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(ex + 44 + (i % 2) * 10, ey + 56 + Math.floor(i / 2) * 8, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Music note floating (creativity 3+)
      if (creativityLevel >= 3) {
        const noteFloat = Math.sin(frameRef.current * 0.04) * 4;
        ctx.fillStyle = '#ffd600';
        ctx.font = '14px serif';
        ctx.fillText('♪', ex + 55, ey + 20 + noteFloat);
        if (creativityLevel >= 5) ctx.fillText('♫', ex + 42, ey + 8 + noteFloat * -1);
      }
    }

    // ── Mindfulness aura / plants ────────────────────────
    if (mindLevel >= 1) {
      // Floating orbs
      const orbCount = mindLevel;
      for (let o = 0; o < orbCount; o++) {
        const angle = (frameRef.current * 0.015) + (o * Math.PI * 2) / orbCount;
        const radius = 55 + o * 8;
        const ox = CX + Math.cos(angle) * radius;
        const oy = groundY - 80 + Math.sin(angle) * 18;
        const pulse = Math.sin(frameRef.current * 0.05 + o) * 0.3 + 0.7;
        ctx.globalAlpha = 0.25 * pulse;
        ctx.fillStyle = ['#4fc3f7','#81c784','#ce93d8','#fff176','#ffb74d'][o % 5];
        ctx.beginPath();
        ctx.arc(ox, oy, 5 + pulse * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Small plant pots (mindfulness level 2+)
      if (mindLevel >= 2) {
        const plants = [
          { x: CX - 60, flip: false },
          { x: CX + 42, flip: true },
        ];
        plants.slice(0, mindLevel >= 3 ? 2 : 1).forEach(({ x }) => {
          ctx.fillStyle = '#8d6e63';
          ctx.fillRect(x, groundY - 22, 16, 16);
          ctx.fillStyle = '#6d4c41';
          ctx.fillRect(x - 2, groundY - 24, 20, 4);
          ctx.fillStyle = '#2e7d32';
          ctx.fillRect(x + 6, groundY - 38, 4, 16);
          ctx.fillRect(x, groundY - 38, 16, 8);
          if (mindLevel >= 4) {
            ctx.fillStyle = '#a5d6a7';
            ctx.fillRect(x - 4, groundY - 44, 10, 8);
            ctx.fillRect(x + 10, groundY - 44, 10, 8);
          }
        });
      }
    }

    // ── Healthy food on a mat (nutrition) ────────────────
    if (nutritionLevel >= 2) {
      const mx = CX - 30;
      const my = groundY - 8;
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(mx, my, 60, 6);
      // Food items
      const foods = ['🍎','🥦','🥕','🫐'];
      foods.slice(0, nutritionLevel).forEach((f, i) => {
        ctx.font = '12px serif';
        ctx.fillText(f, mx + 4 + i * 14, my + 2);
      });
    }
  }

  function drawCharacter(ctx: CanvasRenderingContext2D, W: number, H: number, frame: number) {
    const CX = W / 2;
    const groundY = H * 0.65;
    const fitnessLevel = getLevel('fitness');
    const sleepLevel = getLevel('sleep');
    const nutritionLevel = getLevel('nutrition');

    // Character dimensions scale slightly with fitness
    const bodyW = 26 + fitnessLevel * 3;   // broader with fitness
    const bodyH = 38 - fitnessLevel;        // slightly shorter/stockier
    const shoulderW = bodyW + fitnessLevel * 2;

    // Subtle breathing animation
    const breathe = Math.sin(frame * 0.025) * 1.5;

    const baseY = groundY - 4;
    const feetY = baseY;
    const bodyY = feetY - bodyH - 20; // 20 = leg height
    const headY = bodyY - 28 - breathe;

    // ── Skin tone (nutrition improves it) ────────────────
    const skinBase = nutritionLevel >= 3 ? '#f5cba7' : nutritionLevel >= 1 ? '#f0b27a' : '#e59866';

    // ── Legs ─────────────────────────────────────────────
    const legColor = '#3a3a5c';
    // Slight walk animation
    const walkAngle = Math.sin(frame * 0.04) * (fitnessLevel >= 1 ? 4 : 1);
    ctx.fillStyle = legColor;
    ctx.fillRect(CX - 14 + walkAngle, feetY - 20, 12, 20);
    ctx.fillRect(CX + 2 - walkAngle, feetY - 20, 12, 20);

    // Shoes (better shoes at sleep level 2+)
    ctx.fillStyle = sleepLevel >= 2 ? '#1a237e' : '#212121';
    ctx.fillRect(CX - 16 + walkAngle, feetY - 4, 14, 6);
    ctx.fillRect(CX + 2 - walkAngle, feetY - 4, 14, 6);
    // Shoe sole highlight
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(CX - 16 + walkAngle, feetY + 1, 14, 1);
    ctx.fillRect(CX + 2 - walkAngle, feetY + 1, 14, 1);

    // ── Body ─────────────────────────────────────────────
    const bodyX = CX - bodyW / 2;

    // Shirt colour evolves with creativity
    const creativityLevel = getLevel('creativity');
    const shirtColors = ['#455a64','#1565c0','#6a1b9a','#b71c1c','#1b5e20'];
    const shirtColor = shirtColors[Math.min(creativityLevel, shirtColors.length - 1)];

    ctx.fillStyle = shirtColor;
    ctx.fillRect(bodyX, bodyY + breathe, bodyW, bodyH);

    // Shirt detail — collar
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(CX - 4, bodyY + breathe, 8, 6);

    // Muscle definition at fitness 3+
    if (fitnessLevel >= 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(CX - 1, bodyY + breathe + 8, 2, bodyH - 14);
    }

    // Shoulders (broader with fitness)
    ctx.fillStyle = shirtColor;
    const shoulderX = CX - shoulderW / 2;
    ctx.fillRect(shoulderX, bodyY + breathe, shoulderW, 8);

    // ── Arms ─────────────────────────────────────────────
    const armW = 8 + fitnessLevel;
    const armSwing = Math.sin(frame * 0.04) * (fitnessLevel >= 1 ? 3 : 1);

    // Left arm
    ctx.fillStyle = shirtColor;
    ctx.fillRect(shoulderX - armW + 2, bodyY + breathe + 4 - armSwing, armW, 20);
    ctx.fillStyle = skinBase;
    ctx.fillRect(shoulderX - armW + 2, bodyY + breathe + 22 - armSwing, armW, 10);

    // Right arm
    ctx.fillStyle = shirtColor;
    ctx.fillRect(CX + shoulderW / 2 - 2, bodyY + breathe + 4 + armSwing, armW, 20);
    ctx.fillStyle = skinBase;
    ctx.fillRect(CX + shoulderW / 2 - 2, bodyY + breathe + 22 + armSwing, armW, 10);

    // ── Head ─────────────────────────────────────────────
    const headW = 24;
    const headH = 26;
    const headX = CX - headW / 2;

    ctx.fillStyle = skinBase;
    ctx.fillRect(headX, headY, headW, headH);

    // Hair — gets better styled with sleep
    const hairColor = '#1a1a1a';
    ctx.fillStyle = hairColor;
    ctx.fillRect(headX - 2, headY, headW + 4, 8);
    if (sleepLevel >= 3) {
      // Styled hair
      ctx.fillRect(headX - 2, headY - 4, 6, 6);
      ctx.fillRect(headX + headW - 4, headY - 4, 6, 6);
    }
    if (sleepLevel >= 4) {
      // Very well-groomed
      ctx.fillRect(headX, headY - 6, headW, 4);
    }

    // Eyes — more open/bright with better sleep
    const eyeOpenness = sleepLevel >= 2 ? 4 : sleepLevel >= 1 ? 3 : 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(headX + 4, headY + 10, 6, eyeOpenness + 1);
    ctx.fillRect(headX + headW - 10, headY + 10, 6, eyeOpenness + 1);

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(headX + 5, headY + 11, 4, eyeOpenness);
    ctx.fillRect(headX + headW - 9, headY + 11, 4, eyeOpenness);

    // Eye shine
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(headX + 7, headY + 11, 1, 1);
    ctx.fillRect(headX + headW - 7, headY + 11, 1, 1);

    // Nose
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(CX - 1, headY + 16, 3, 2);

    // Smile — grows with nutrition and mindfulness
    const mindLevel = getLevel('mindfulness');
    const smileLevel = Math.min(nutritionLevel + mindLevel, 4);
    ctx.fillStyle = '#c0392b';
    if (smileLevel === 0) {
      ctx.fillRect(headX + 7, headY + 20, 10, 1); // neutral
    } else if (smileLevel === 1) {
      ctx.fillRect(headX + 7, headY + 20, 10, 2);
      ctx.fillRect(headX + 6, headY + 21, 2, 1);
      ctx.fillRect(headX + 16, headY + 21, 2, 1);
    } else if (smileLevel >= 2) {
      // Big smile
      ctx.fillRect(headX + 6, headY + 20, 12, 2);
      ctx.fillRect(headX + 5, headY + 19, 2, 2);
      ctx.fillRect(headX + 17, headY + 19, 2, 2);
      // Teeth
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(headX + 7, headY + 20, 10, 1);
    }

    // Ears
    ctx.fillStyle = skinBase;
    ctx.fillRect(headX - 3, headY + 8, 4, 8);
    ctx.fillRect(headX + headW - 1, headY + 8, 4, 8);

    // ── Fitness visual upgrades ───────────────────────────
    if (fitnessLevel >= 2) {
      // Defined jawline
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(headX + 2, headY + headH - 4, 4, 3);
      ctx.fillRect(headX + headW - 6, headY + headH - 4, 4, 3);
    }

    if (fitnessLevel >= 4) {
      // Visible neck muscles
      ctx.fillStyle = skinBase;
      ctx.fillRect(CX - 5, bodyY + breathe - 8, 10, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(CX - 2, bodyY + breathe - 8, 2, 8);
      ctx.fillRect(CX + 2, bodyY + breathe - 8, 2, 8);
    }

    if (fitnessLevel >= 5) {
      // Athletic glow / energy aura
      const glowAlpha = Math.sin(frame * 0.04) * 0.07 + 0.07;
      ctx.globalAlpha = glowAlpha;
      ctx.fillStyle = '#f9a825';
      ctx.fillRect(bodyX - 8, headY - 8, bodyW + 16, feetY - headY + 12);
      ctx.globalAlpha = 1;
    }

    // ── Level badge ───────────────────────────────────────
    const totalLevel = Object.values(traitsRef.current).reduce((s, t) => s + (t?.level ?? 0), 0);
    if (totalLevel > 0) {
      ctx.fillStyle = '#ffd600';
      ctx.fillRect(CX + 14, headY - 10, 18, 14);
      ctx.fillStyle = '#1a1a2e';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`Lv${totalLevel}`, CX + 16, headY + 1);
    }
  }

  function drawParticles(ctx: CanvasRenderingContext2D, W: number, H: number, frame: number) {
    const fitnessLevel = getLevel('fitness');
    const mindLevel = getLevel('mindfulness');

    // Sweat drops when working out hard (fitness 3+)
    if (fitnessLevel >= 3) {
      const CX = W / 2;
      const groundY = H * 0.65;
      for (let p = 0; p < fitnessLevel; p++) {
        const t = (frame * 0.02 + p * 1.3) % 1;
        const px = CX + 20 + p * 6;
        const py = groundY - 130 + t * 40;
        ctx.globalAlpha = (1 - t) * 0.7;
        ctx.fillStyle = '#81d4fa';
        ctx.fillRect(px, py, 2, 3);
        ctx.globalAlpha = 1;
      }
    }

    // Sparkles around mindfulness aura (mindfulness 4+)
    if (mindLevel >= 4) {
      const CX = W / 2;
      const groundY = H * 0.65;
      for (let s = 0; s < 6; s++) {
        const angle = (frame * 0.02 + s * 1.05) % (Math.PI * 2);
        const r = 70 + Math.sin(frame * 0.03 + s) * 10;
        const sx = CX + Math.cos(angle) * r;
        const sy = groundY - 80 + Math.sin(angle) * 25;
        const alpha = Math.sin(frame * 0.05 + s) * 0.4 + 0.4;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fff9c4';
        ctx.fillRect(sx, sy, 3, 3);
        ctx.fillRect(sx + 1, sy - 2, 1, 7);
        ctx.fillRect(sx - 2, sy + 1, 7, 1);
        ctx.globalAlpha = 1;
      }
    }
  }

  // ─── Trait progress cards ─────────────────────────────────────────────────

  const totalCompletions = Object.values(traits).reduce((s, t) => s + (t?.completions ?? 0), 0);
  const activeCats = CATEGORIES.filter(c => (traits[c.id]?.completions ?? 0) > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Canvas */}
      <div className="bg-[#0f0f1a] rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Your Character</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              {totalCompletions === 0
                ? 'Complete goals to evolve your character'
                : `${totalCompletions} total completions · ${activeCats.length} trait${activeCats.length !== 1 ? 's' : ''} unlocked`}
            </p>
          </div>
          <div className="flex gap-2">
            {activeCats.slice(0, 4).map(c => (
              <span key={c.id} className="text-xl" title={c.label}>{c.emoji}</span>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
            Loading character...
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={640}
            height={340}
            className="w-full"
            style={{ imageRendering: 'pixelated' }}
          />
        )}
      </div>

      {/* Trait progress */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {CATEGORIES.filter(c => c.id !== 'general').map(cat => {
          const trait = traits[cat.id];
          const completions = trait?.completions ?? 0;
          const { level, progress, completionsInLevel, completionsNeeded } = getProgressToNextLevel(completions);
          const isMaxed = level >= MAX_LEVEL;
          const isUnlocked = completions > 0;

          return (
            <div
              key={cat.id}
              className={`rounded-xl border p-4 transition-all ${
                isUnlocked
                  ? 'bg-white border-slate-200 shadow-sm'
                  : 'bg-slate-50 border-slate-100 opacity-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="font-semibold text-slate-800 text-sm">{cat.label}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  isMaxed
                    ? 'bg-yellow-100 text-yellow-700'
                    : isUnlocked
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {isMaxed ? 'MAX' : `Lv ${level}`}
                </span>
              </div>

              {isUnlocked ? (
                <>
                  <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden mb-1">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${isMaxed ? 100 : progress * 100}%`,
                        background: isMaxed
                          ? 'linear-gradient(90deg, #f9a825, #ffd600)'
                          : 'linear-gradient(90deg, #667eea, #764ba2)',
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    {isMaxed
                      ? `${completions} completions — maxed out!`
                      : `${completionsInLevel}/${completionsNeeded} to level ${level + 1}`}
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-400">{cat.description}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state hint */}
      {totalCompletions === 0 && (
        <div className="text-center py-6 text-slate-400 text-sm">
          <p className="text-3xl mb-2">🎯</p>
          <p>Complete your first goal to start evolving your character.</p>
          <p className="mt-1 text-xs text-slate-300">Each goal category shapes a different part of your character.</p>
        </div>
      )}
    </div>
  );
}
