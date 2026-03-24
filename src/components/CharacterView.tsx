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
    for (const t of list) map[t.category as GoalCategory] = t;
    setTraits(map); traitsRef.current = map; setLoading(false);
  };

  const getLevel = (cat: GoalCategory) => traitsRef.current[cat]?.level ?? 0;

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
    const mindLevel = getLevel('mindfulness'), sleepLevel = getLevel('sleep');
    const skyTop = mindLevel >= 3 ? '#1a1a2e' : '#0f0f1a';
    const grad = ctx.createLinearGradient(0, 0, 0, H * 0.65);
    grad.addColorStop(0, skyTop); grad.addColorStop(1, mindLevel >= 2 ? '#16213e' : '#0d0d1a');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H * 0.65);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 20 + sleepLevel * 15; i++) {
      const twinkle = Math.sin(frameRef.current * 0.03 + i) * 0.5 + 0.5;
      ctx.globalAlpha = 0.3 + twinkle * 0.7;
      ctx.fillRect((i * 97 + 13) % W, (i * 61 + 7) % (H * 0.5), i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fffde7'; ctx.beginPath(); ctx.arc(W - 60, 40, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skyTop; ctx.beginPath(); ctx.arc(W - 52, 36, 14, 0, Math.PI * 2); ctx.fill();
    const groundY = H * 0.65, nutritionLevel = getLevel('nutrition');
    ctx.fillStyle = nutritionLevel >= 2 ? '#2d5a1b' : nutritionLevel >= 1 ? '#1e3d0f' : '#141f0a';
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = nutritionLevel >= 3 ? '#3a7a24' : '#1a2f0d';
    for (let gx = 0; gx < W; gx += 8) ctx.fillRect(gx, groundY, 3, 4 + (gx % 3));
    ctx.fillStyle = '#1c1c2e'; ctx.fillRect(W / 2 - 80, groundY - 4, 160, 8);
    ctx.fillStyle = '#2a2a3e'; ctx.fillRect(W / 2 - 78, groundY - 2, 156, 4);
  }

  function drawProps(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const groundY = H * 0.65, CX = W / 2;
    const readLevel = getLevel('reading'), creativityLevel = getLevel('creativity');
    const mindLevel = getLevel('mindfulness'), nutritionLevel = getLevel('nutrition');

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
    }

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
    }

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
    }

    if (nutritionLevel >= 2) {
      ctx.fillStyle = '#4caf50'; ctx.fillRect(CX - 30, groundY - 8, 60, 6);
      ['🍎','🥦','🥕','🫐'].slice(0, nutritionLevel).forEach((f, i) => {
        ctx.font = '12px serif'; ctx.fillText(f, CX - 26 + i * 14, groundY - 6);
      });
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
    ctx.fillStyle = '#3a3a5c';
    ctx.fillRect(CX - 14 + walkAngle, feetY - 20, 12, 20); ctx.fillRect(CX + 2 - walkAngle, feetY - 20, 12, 20);
    ctx.fillStyle = sleepLevel >= 2 ? '#1a237e' : '#212121';
    ctx.fillRect(CX - 16 + walkAngle, feetY - 4, 14, 6); ctx.fillRect(CX + 2 - walkAngle, feetY - 4, 14, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(CX - 16 + walkAngle, feetY + 1, 14, 1); ctx.fillRect(CX + 2 - walkAngle, feetY + 1, 14, 1);
    const crtLevel = getLevel('creativity');
    const shirtColor = ['#455a64','#1565c0','#6a1b9a','#b71c1c','#1b5e20'][Math.min(crtLevel, 4)];
    ctx.fillStyle = shirtColor; ctx.fillRect(CX - bodyW / 2, bodyY + breathe, bodyW, bodyH);
    ctx.fillStyle = shirtColor; ctx.fillRect(CX - shoulderW / 2, bodyY + breathe, shoulderW, 8);
    const armW = 8 + fitnessLevel, armSwing = Math.sin(frame * 0.04) * (fitnessLevel >= 1 ? 3 : 1);
    ctx.fillStyle = shirtColor;
    ctx.fillRect(CX - shoulderW / 2 - armW + 2, bodyY + breathe + 4 - armSwing, armW, 20);
    ctx.fillRect(CX + shoulderW / 2 - 2, bodyY + breathe + 4 + armSwing, armW, 20);
    ctx.fillStyle = skin;
    ctx.fillRect(CX - shoulderW / 2 - armW + 2, bodyY + breathe + 22 - armSwing, armW, 10);
    ctx.fillRect(CX + shoulderW / 2 - 2, bodyY + breathe + 22 + armSwing, armW, 10);
    ctx.fillStyle = skin; ctx.fillRect(CX - 12, headY, 24, 26);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(CX - 14, headY, 28, 8);
    if (sleepLevel >= 3) { ctx.fillRect(CX - 14, headY - 4, 6, 6); ctx.fillRect(CX + 10, headY - 4, 6, 6); }
    const eyeOpen = sleepLevel >= 2 ? 4 : sleepLevel >= 1 ? 3 : 2;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(CX - 8, headY + 10, 6, eyeOpen + 1); ctx.fillRect(CX + 2, headY + 10, 6, eyeOpen + 1);
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(CX - 7, headY + 11, 4, eyeOpen); ctx.fillRect(CX + 3, headY + 11, 4, eyeOpen);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(CX - 5, headY + 11, 1, 1); ctx.fillRect(CX + 5, headY + 11, 1, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(CX - 1, headY + 16, 3, 2);
    const mindLevel = getLevel('mindfulness'), smileLevel = Math.min(nutritionLevel + mindLevel, 4);
    ctx.fillStyle = '#c0392b';
    if (smileLevel <= 0) ctx.fillRect(CX - 5, headY + 20, 10, 1);
    else if (smileLevel === 1) ctx.fillRect(CX - 5, headY + 20, 10, 2);
    else { ctx.fillRect(CX - 6, headY + 20, 12, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(CX - 5, headY + 20, 10, 1); }
    ctx.fillStyle = skin; ctx.fillRect(CX - 15, headY + 8, 4, 8); ctx.fillRect(CX + 11, headY + 8, 4, 8);
    if (fitnessLevel >= 5) {
      ctx.globalAlpha = Math.sin(frame * 0.04) * 0.07 + 0.07; ctx.fillStyle = '#f9a825';
      ctx.fillRect(CX - bodyW / 2 - 8, headY - 8, bodyW + 16, feetY - headY + 12); ctx.globalAlpha = 1;
    }
    const totalLevel = Object.values(traitsRef.current).reduce((s, t) => s + (t?.level ?? 0), 0);
    if (totalLevel > 0) {
      ctx.fillStyle = '#ffd600'; ctx.fillRect(CX + 14, headY - 10, 18, 14);
      ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 9px monospace'; ctx.fillText(`Lv${totalLevel}`, CX + 16, headY + 1);
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
  const activeCats = CATEGORIES.filter(c => (traits[c.id]?.completions ?? 0) > 0);

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
          <div className="flex gap-2">{activeCats.slice(0, 4).map(c => <span key={c.id} className="text-xl">{c.emoji}</span>)}</div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading character...</div>
        ) : (
          <canvas ref={canvasRef} width={640} height={340} className="w-full" style={{ imageRendering: 'pixelated' }} />
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {CATEGORIES.filter(c => c.id !== 'general').map(cat => {
          const trait = traits[cat.id];
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
                      style={{ width: `${isMaxed ? 100 : progress * 100}%`, background: isMaxed ? 'linear-gradient(90deg,#f9a825,#ffd600)' : 'linear-gradient(90deg,#a855f7,#ec4899)' }} />
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
          <p className="text-3xl mb-2">🎯</p>
          <p>Complete your first goal to start evolving your character.</p>
        </div>
      )}
    </div>
  );
}
