import { useState, useEffect, useRef } from 'react';
import { Gem, AlertCircle, Wrench } from 'lucide-react';
import { supabase, City, Building } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { repairCity, getAvailableBuildings, getRemainingAllowed, getTotalSlotsForWorld, BuildingType } from '../lib/gameLogic';
import { checkAndAwardAchievements } from '../lib/achievements';

export function CityView() {
  const { user, profile, refreshProfile } = useAuth();
  const [city, setCity] = useState<City | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [newAchievement, setNewAchievement] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const carsRef = useRef([
    { x: -120, speed: 2.2, color: '#e53935', color2: '#b71c1c', dir: 1 },
    { x: 724,  speed: 1.8, color: '#1e88e5', color2: '#0d47a1', dir: -1 },
    { x: -300, speed: 2.8, color: '#43a047', color2: '#1b5e20', dir: 1 },
    { x: 924,  speed: 2.0, color: '#fdd835', color2: '#f57f17', dir: -1 },
  ]);
  const animRef = useRef<number>();
  const buildingsRef = useRef<{ type: string; x: number }[]>([]);

  const SLOTS = [
    {x:20},{x:88},{x:162},{x:235},
    {x:295},{x:362},{x:432},{x:495},
    {x:542},{x:570},{x:595},{x:615},
    {x:50},{x:130},{x:210},{x:290},
    {x:370},{x:450},{x:530},{x:610},
    {x:35},{x:115},{x:195},{x:275},
    {x:355},{x:435},{x:515},{x:595},
  ];

  useEffect(() => {
    if (user) loadCity();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [user]);

  useEffect(() => {
    buildingsRef.current = buildings.map((b, i) => ({
      type: b.building_type,
      x: SLOTS[i]?.x ?? 0,
    }));
  }, [buildings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    const GROUND_Y = H * 0.52;
    const PAVEMENT_H = 38;
    const KERB_H = 4;
    const ROAD_Y = GROUND_Y + PAVEMENT_H + KERB_H;
    const ROAD_H = 100;
    const LANE_H = ROAD_H / 2;
    const LANE1_Y = ROAD_Y + 10;
    const LANE2_Y = ROAD_Y + LANE_H + 8;

    function drawSky() {
      const grad = ctx.createLinearGradient(0,0,0,GROUND_Y);
      grad.addColorStop(0,'#5b8fd4'); grad.addColorStop(1,'#b8d8f0');
      ctx.fillStyle=grad; ctx.fillRect(0,0,W,GROUND_Y);
      drawCloud(60,25,1); drawCloud(240,18,0.85); drawCloud(450,28,1.1);
    }
    function drawCloud(x:number,y:number,s:number) {
      ctx.fillStyle='#ffffff';
      [[0,8],[8,4],[16,0],[28,0],[36,4],[44,8],[48,12],[0,12]].forEach(([dx,dy])=>ctx.fillRect(x+dx*s,y+dy*s,8*s,8*s));
    }
    function drawBackgroundSkyline() {
      const bgs=[{x:10,w:50,h:155},{x:68,w:60,h:195},{x:138,w:45,h:125},{x:193,w:72,h:215},{x:275,w:55,h:170},{x:340,w:82,h:235},{x:432,w:58,h:180},{x:500,w:50,h:150},{x:558,w:68,h:205}];
      bgs.forEach(b=>{
        ctx.fillStyle='#90a4ae'; ctx.fillRect(b.x,GROUND_Y-b.h,b.w,b.h);
        ctx.fillStyle='#78909c'; ctx.fillRect(b.x+b.w-8,GROUND_Y-b.h,8,b.h);
        ctx.fillStyle='#b0bec5';
        for(let r=0;r<Math.floor(b.h/12);r++) for(let c=0;c<Math.floor((b.w-8)/12);c++) if((r+c)%3!==0) ctx.fillRect(b.x+4+c*12,GROUND_Y-b.h+6+r*11,6,7);
        ctx.fillStyle='#607d8b'; ctx.fillRect(b.x+b.w/2-4,GROUND_Y-b.h-10,8,10);
      });
    }
    function drawGround() {
      ctx.fillStyle='#bdbdbd'; ctx.fillRect(0,GROUND_Y,W,PAVEMENT_H);
      ctx.fillStyle='#9e9e9e';
      for(let x=0;x<W;x+=32) ctx.fillRect(x,GROUND_Y,2,PAVEMENT_H);
      for(let y=GROUND_Y;y<GROUND_Y+PAVEMENT_H;y+=19) ctx.fillRect(0,y,W,2);
      ctx.fillStyle='#757575'; ctx.fillRect(0,GROUND_Y+PAVEMENT_H,W,KERB_H);
      ctx.fillStyle='#37474f'; ctx.fillRect(0,ROAD_Y,W,ROAD_H);
      ctx.fillStyle='#ffee58';
      ctx.fillRect(0,ROAD_Y+LANE_H-1,W,3); ctx.fillRect(0,ROAD_Y+2,W,3); ctx.fillRect(0,ROAD_Y+ROAD_H-4,W,3);
      ctx.fillStyle='#ffffff';
      for(let x=0;x<W;x+=60){ ctx.fillRect(x,ROAD_Y+LANE_H/2-2,40,4); ctx.fillRect(x,ROAD_Y+LANE_H+LANE_H/2-2,40,4); }
    }
    function drawLamp(x:number) {
      ctx.fillStyle='#424242'; ctx.fillRect(x,GROUND_Y-58,5,58); ctx.fillRect(x-10,GROUND_Y-58,22,5);
      ctx.fillStyle='#fff9c4'; ctx.fillRect(x-8,GROUND_Y-64,18,9);
      ctx.fillStyle='#fff176'; ctx.fillRect(x-6,GROUND_Y-62,14,5);
    }
    function drawTree(x:number) {
      const base=GROUND_Y-2;
      ctx.fillStyle='#6d4c41'; ctx.fillRect(x+18,base-32,12,32);
      ctx.fillStyle='#1b5e20'; ctx.fillRect(x+6,base-72,36,22);
      ctx.fillStyle='#2e7d32'; ctx.fillRect(x+2,base-56,44,24);
      ctx.fillStyle='#388e3c'; ctx.fillRect(x-2,base-40,52,20);
      ctx.fillStyle='#4caf50'; ctx.fillRect(x+4,base-70,10,8); ctx.fillRect(x,base-54,8,8);
    }
    function drawHouse(x:number) {
      const base=GROUND_Y,w=64,h=62;
      ctx.fillStyle='#bf360c'; ctx.fillRect(x,base-h,w,h);
      ctx.fillStyle='#8d2500'; ctx.fillRect(x+w-10,base-h,10,h);
      ctx.fillStyle='#37474f'; ctx.beginPath(); ctx.moveTo(x-4,base-h); ctx.lineTo(x+w/2,base-h-32); ctx.lineTo(x+w+4,base-h); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#5d4037'; ctx.fillRect(x+w-20,base-h-26,10,22);
      ctx.fillStyle='#90caf9'; ctx.fillRect(x+6,base-h+14,18,16); ctx.fillRect(x+40,base-h+14,18,16);
      ctx.fillStyle='#fff'; ctx.fillRect(x+14,base-h+14,2,16); ctx.fillRect(x+6,base-h+21,18,2); ctx.fillRect(x+48,base-h+14,2,16); ctx.fillRect(x+40,base-h+21,18,2);
      ctx.fillStyle='#4e342e'; ctx.fillRect(x+24,base-28,16,28);
      ctx.fillStyle='#ff8f00'; ctx.fillRect(x+36,base-16,4,4);
    }
    function drawShop(x:number) {
      const base=GROUND_Y,w=72,h=68;
      ctx.fillStyle='#e8a020'; ctx.fillRect(x,base-h,w,h);
      ctx.fillStyle='#b8780a'; ctx.fillRect(x+w-10,base-h,10,h);
      ctx.fillStyle='#c0392b'; ctx.fillRect(x-4,base-h-8,w+8,12); ctx.fillRect(x+4,base-h+10,w-14,18);
      ctx.fillStyle='#ffffff'; ctx.fillRect(x+8,base-h+14,w-22,10);
      ctx.fillStyle='#c0392b'; ctx.font='bold 7px Courier New'; ctx.fillText('SHOP',x+18,base-h+22);
      ctx.fillStyle='#90caf9'; ctx.fillRect(x+4,base-40,28,22); ctx.fillRect(x+40,base-40,28,22);
      ctx.fillStyle='#4e342e'; ctx.fillRect(x+28,base-28,16,28);
      ctx.fillStyle='#90caf9'; ctx.fillRect(x+30,base-26,12,18);
    }
    function drawApartment(x:number) {
      const base=GROUND_Y,w=80,h=105;
      ctx.fillStyle='#546e7a'; ctx.fillRect(x,base-h,w,h);
      ctx.fillStyle='#37474f'; ctx.fillRect(x+w-10,base-h,10,h);
      ctx.fillStyle='#263238'; ctx.fillRect(x-2,base-h-6,w+4,10);
      ctx.fillStyle='#90caf9';
      for(let r=0;r<5;r++) for(let c=0;c<3;c++){
        ctx.fillRect(x+8+c*22,base-h+10+r*18,14,12);
        ctx.fillStyle='#fff'; ctx.fillRect(x+14+c*22,base-h+10+r*18,2,12); ctx.fillRect(x+8+c*22,base-h+15+r*18,14,2);
        ctx.fillStyle='#90caf9';
      }
      ctx.fillStyle='#1a237e'; ctx.fillRect(x+32,base-30,16,30);
      ctx.fillStyle='#90caf9'; ctx.fillRect(x+34,base-28,12,18);
    }
    function drawTower(x:number) {
      const base=GROUND_Y,w=72,h=155;
      ctx.fillStyle='#455a64'; ctx.fillRect(x,base-h,w,h);
      ctx.fillStyle='#263238'; ctx.fillRect(x+w-12,base-h,12,h);
      ctx.fillStyle='#37474f'; ctx.fillRect(x+w/2-6,base-h-32,12,32);
      ctx.fillStyle='#ff1744'; ctx.fillRect(x+w/2-2,base-h-40,4,8);
      for(let r=0;r<10;r++) for(let c=0;c<4;c++){ ctx.fillStyle=(r+c)%2===0?'#f9a825':'#90caf9'; ctx.fillRect(x+6+c*15,base-h+10+r*14,10,10); }
      ctx.fillStyle='#212121'; ctx.fillRect(x+28,base-32,16,32);
      ctx.fillStyle='#546e7a'; ctx.fillRect(x+30,base-30,12,20);
    }
    function drawFountain(x:number) {
      const base=GROUND_Y;
      ctx.fillStyle='#0077b6'; ctx.beginPath(); ctx.ellipse(x+28,base-12,20,10,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#90e0ef'; ctx.beginPath(); ctx.ellipse(x+28,base-14,16,8,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#caf0f8'; ctx.fillRect(x+25,base-34,6,20);
      ctx.fillStyle='#90e0ef'; ctx.fillRect(x+17,base-36,4,4); ctx.fillRect(x+35,base-36,4,4); ctx.fillRect(x+25,base-40,4,4);
    }
    function drawSchool(x:number) {
      const base=GROUND_Y,w=80,h=72;
      ctx.fillStyle='#f9a825'; ctx.fillRect(x,base-h,w,h);
      ctx.fillStyle='#f57f17'; ctx.fillRect(x+w-10,base-h,10,h);
      ctx.fillStyle='#b71c1c'; ctx.fillRect(x-4,base-h-8,w+8,12);
      ctx.fillStyle='#fff'; ctx.fillRect(x+8,base-h+10,w-20,14);
      ctx.fillStyle='#b71c1c'; ctx.font='bold 7px Courier New'; ctx.fillText('SCHOOL',x+12,base-h+21);
      ctx.fillStyle='#90caf9'; ctx.fillRect(x+6,base-42,20,18); ctx.fillRect(x+54,base-42,20,18);
      ctx.fillStyle='#4e342e'; ctx.fillRect(x+32,base-28,16,28);
      ctx.fillStyle='#b71c1c'; ctx.fillRect(x+w/2-4,base-h-20,8,14);
    }
    function drawHospital(x:number) {
      const base=GROUND_Y,w=80,h=90;
      ctx.fillStyle='#ffffff'; ctx.fillRect(x,base-h,w,h);
      ctx.fillStyle='#e0e0e0'; ctx.fillRect(x+w-10,base-h,10,h);
      ctx.fillStyle='#1565c0'; ctx.fillRect(x-4,base-h-8,w+8,12);
      ctx.fillStyle='#e53935';
      ctx.fillRect(x+w/2-12,base-h+14,24,8);
      ctx.fillRect(x+w/2-4,base-h+8,8,20);
      ctx.fillStyle='#90caf9'; ctx.fillRect(x+6,base-52,18,16); ctx.fillRect(x+56,base-52,18,16); ctx.fillRect(x+6,base-30,18,16); ctx.fillRect(x+56,base-30,18,16);
      ctx.fillStyle='#1565c0'; ctx.fillRect(x+32,base-28,16,28);
    }
    function drawBridge(x:number) {
      const base=GROUND_Y;
      ctx.fillStyle='#78909c'; ctx.fillRect(x,base-20,80,10);
      ctx.fillStyle='#607d8b';
      ctx.fillRect(x+5,base-40,8,20); ctx.fillRect(x+67,base-40,8,20);
      ctx.fillRect(x+25,base-32,8,12); ctx.fillRect(x+47,base-32,8,12);
      ctx.fillStyle='#90a4ae';
      ctx.beginPath(); ctx.moveTo(x+9,base-40); ctx.lineTo(x+29,base-32); ctx.strokeStyle='#90a4ae'; ctx.lineWidth=2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+71,base-40); ctx.lineTo(x+51,base-32); ctx.stroke();
      ctx.fillStyle='#546e7a'; ctx.fillRect(x,base-12,80,12);
    }
    function drawTheatre(x:number) {
      const base=GROUND_Y,w=80,h=80;
      ctx.fillStyle='#6a1b9a'; ctx.fillRect(x,base-h,w,h);
      ctx.fillStyle='#4a148c'; ctx.fillRect(x+w-10,base-h,10,h);
      ctx.fillStyle='#ffd600'; ctx.fillRect(x-4,base-h-8,w+8,12);
      ctx.fillStyle='#ffd600';
      ctx.beginPath(); ctx.arc(x+w/2,base-h,20,Math.PI,0); ctx.fill();
      ctx.fillStyle='#6a1b9a'; ctx.fillRect(x+10,base-h-8,w-20,10);
      ctx.fillStyle='#f3e5f5'; ctx.fillRect(x+8,base-52,18,18); ctx.fillRect(x+54,base-52,18,18);
      ctx.fillStyle='#e53935'; ctx.fillRect(x+28,base-28,24,28);
      ctx.fillStyle='#ffd600'; ctx.font='bold 6px Courier New'; ctx.fillText('THEATRE',x+10,base-h+22);
    }
    function drawBank(x:number) {
      const base=GROUND_Y,w=80,h=85;
      ctx.fillStyle='#37474f'; ctx.fillRect(x,base-h,w,h);
      ctx.fillStyle='#263238'; ctx.fillRect(x+w-10,base-h,10,h);
      for(let c=0;c<5;c++){ ctx.fillStyle='#90a4ae'; ctx.fillRect(x+6+c*14,base-h,8,h); }
      ctx.fillStyle='#ffd600'; ctx.fillRect(x-4,base-h-8,w+8,12);
      ctx.fillStyle='#ffd600'; ctx.font='bold 6px Courier New'; ctx.fillText('BANK',x+28,base-h+22);
      ctx.fillStyle='#212121'; ctx.fillRect(x+30,base-30,20,30);
      ctx.fillStyle='#ffd600'; ctx.fillRect(x+36,base-18,8,8);
    }

    function drawBuilding(type:string, x:number) {
      if(type==='tree') drawTree(x);
      else if(type==='house') drawHouse(x);
      else if(type==='shop') drawShop(x);
      else if(type==='apartment') drawApartment(x);
      else if(type==='tower') drawTower(x);
      else if(type==='fountain') drawFountain(x);
      else if(type==='school') drawSchool(x);
      else if(type==='hospital') drawHospital(x);
      else if(type==='bridge') drawBridge(x);
      else if(type==='theatre') drawTheatre(x);
      else if(type==='bank') drawBank(x);
    }

    function drawCar(car:any) {
      const laneY=car.dir===1?LANE1_Y:LANE2_Y,cx=car.x,cw=58,ch=24;
      if(car.dir===1){
        ctx.fillStyle=car.color; ctx.fillRect(cx,laneY,cw,ch);
        ctx.fillStyle=car.color2; ctx.fillRect(cx,laneY,cw,4);
        ctx.fillStyle=car.color; ctx.fillRect(cx+10,laneY-13,34,15);
        ctx.fillStyle='#b3e5fc'; ctx.fillRect(cx+13,laneY-11,13,9); ctx.fillRect(cx+28,laneY-11,13,9);
        ctx.fillStyle='#212121'; ctx.beginPath(); ctx.arc(cx+12,laneY+ch,8,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(cx+cw-12,laneY+ch,8,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#616161'; ctx.beginPath(); ctx.arc(cx+12,laneY+ch,3,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(cx+cw-12,laneY+ch,3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#fff9c4'; ctx.fillRect(cx+cw-4,laneY+6,4,8);
        ctx.fillStyle='#e53935'; ctx.fillRect(cx,laneY+6,4,8);
      } else {
        ctx.fillStyle=car.color; ctx.fillRect(cx-cw,laneY,cw,ch);
        ctx.fillStyle=car.color2; ctx.fillRect(cx-cw,laneY,cw,4);
        ctx.fillStyle=car.color; ctx.fillRect(cx-cw+10,laneY-13,34,15);
        ctx.fillStyle='#b3e5fc'; ctx.fillRect(cx-cw+13,laneY-11,13,9); ctx.fillRect(cx-cw+28,laneY-11,13,9);
        ctx.fillStyle='#212121'; ctx.beginPath(); ctx.arc(cx-cw+12,laneY+ch,8,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(cx-12,laneY+ch,8,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#616161'; ctx.beginPath(); ctx.arc(cx-cw+12,laneY+ch,3,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(cx-12,laneY+ch,3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#fff9c4'; ctx.fillRect(cx-cw,laneY+6,4,8);
        ctx.fillStyle='#e53935'; ctx.fillRect(cx-4,laneY+6,4,8);
      }
    }

    function loop() {
      ctx.clearRect(0,0,W,H);
      drawSky(); drawBackgroundSkyline();
      [55,185,325,465,595].forEach(x=>drawLamp(x));
      drawGround();
      buildingsRef.current.forEach(b=>drawBuilding(b.type,b.x));
      carsRef.current.forEach(car=>{
        drawCar(car);
        car.x+=car.speed*car.dir;
        if(car.dir===1&&car.x>W+120) car.x=-120;
        if(car.dir===-1&&car.x<-120) car.x=W+120;
      });
      animRef.current=requestAnimationFrame(loop);
    }
    loop();
  }, [loading]);

  const loadCity = async () => {
    const { data: cityData } = await supabase.from('cities').select('*').eq('user_id', user?.id).maybeSingle();
    if (cityData) {
      setCity(cityData);
      const { data: buildingsData } = await supabase.from('buildings').select('*').eq('city_id', cityData.id).order('created_at', { ascending: true });
      if (buildingsData) setBuildings(buildingsData);
    }
    setLoading(false);
  };

  const handlePlace = async (typeId: string) => {
    if (!city || !profile) return;
    const availableTypes = getAvailableBuildings(city.world_level);
    const buildingType = availableTypes.find(t => t.id === typeId);
    if (!buildingType) return;

    if (profile.gem_balance < buildingType.cost) {
      alert(`Not enough gems! Need ${buildingType.cost} gems.`);
      return;
    }

    const totalSlots = getTotalSlotsForWorld(city.world_level);
    if (buildings.length >= totalSlots) {
      alert('Your city is full for this world!');
      return;
    }

    const remaining = getRemainingAllowed(typeId, city.world_level, buildings);
    if (remaining <= 0) {
      alert(`You've reached the max ${buildingType.name}s for this world!`);
      return;
    }

    const slot = SLOTS[buildings.length];
    const { data: newBuilding, error } = await supabase.from('buildings').insert({
      city_id: city.id, building_type: typeId,
      position_x: slot.x, position_y: 0,
      level: 1, is_damaged: false, repair_cost: 0,
    }).select().single();

    if (newBuilding && !error) {
      await supabase.from('profiles').update({ gem_balance: profile.gem_balance - buildingType.cost }).eq('id', user?.id);
      await supabase.from('cities').update({ total_gems_spent: city.total_gems_spent + buildingType.cost }).eq('id', city.id);
      await refreshProfile();
      await loadCity();
      const earned = await checkAndAwardAchievements(user!.id);
      if (earned.length > 0) {
        setNewAchievement(`🏆 Achievement unlocked: ${earned[0].title} ${earned[0].emoji}`);
        setTimeout(() => setNewAchievement(null), 4000);
      }
    }
  };

  const handleRepair = async () => {
    if (!user || !profile) return;
    setRepairing(true);
    const result = await repairCity(user.id);
    if (result.success) { await loadCity(); await refreshProfile(); }
    else alert(`Not enough gems! Need ${result.cost} gems to repair.`);
    setRepairing(false);
  };

  if (loading) return <div className="text-center py-8 text-slate-600">Loading...</div>;
  if (!city) return <div className="text-center py-8 text-slate-600">City not found</div>;

  const damagedBuildings = buildings.filter(b => b.is_damaged);
  const totalRepairCost = damagedBuildings.reduce((sum, b) => sum + b.repair_cost, 0);
  const availableTypes = getAvailableBuildings(city.world_level);
  const totalSlots = getTotalSlotsForWorld(city.world_level);

  return (
    <div className="max-w-4xl mx-auto">
      {newAchievement && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-yellow-400 text-slate-900 font-semibold px-6 py-3 rounded-full shadow-lg animate-bounce">
          {newAchievement}
        </div>
      )}

      {city.is_decayed && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 mb-1">City in Decay!</h3>
            <p className="text-red-700 text-sm mb-3">You missed a day. Your buildings need repairs.</p>
            <button onClick={handleRepair} disabled={repairing || (!!profile && profile.gem_balance < totalRepairCost)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              <span>Repair City ({totalRepairCost} gems)</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-[#1a1a2e] rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="flex items-center justify-between p-4">
          <div>
            <h2 className="text-xl font-bold text-white">Your City</h2>
            <p className="text-slate-400 text-sm">World {city.world_level}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Buildings</div>
            <div className="text-lg font-bold text-white">{buildings.length}/{totalSlots}</div>
          </div>
        </div>
        <canvas ref={canvasRef} width={640} height={380} className="w-full" style={{ imageRendering: 'pixelated' }} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-1">Place a Building</h3>
        <p className="text-slate-500 text-sm mb-4">World {city.world_level} limits apply</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {availableTypes.map(type => {
            const canAfford = profile && profile.gem_balance >= type.cost;
            const remaining = getRemainingAllowed(type.id, city.world_level, buildings);
            const isFull = buildings.length >= totalSlots;
            const isMaxed = remaining <= 0;
            const disabled = !canAfford || isFull || isMaxed;

            return (
              <button key={type.id} onClick={() => handlePlace(type.id)} disabled={disabled}
                className={`p-3 rounded-lg border-2 transition-all text-center ${
                  disabled
                    ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                    : 'border-slate-200 hover:border-slate-900 hover:bg-slate-900 hover:text-white bg-white'
                }`}>
                <div className="text-2xl mb-1">{type.emoji}</div>
                <div className="text-sm font-medium">{type.name}</div>
                <div className="text-xs flex items-center justify-center gap-1 mt-1">
                  <Gem className="w-3 h-3 text-blue-500" />
                  <span>{type.cost}</span>
                </div>
                <div className={`text-xs mt-1 font-medium ${isMaxed ? 'text-red-500' : 'text-slate-400'}`}>
                  {isMaxed ? 'Maxed out' : `${remaining} left`}
                </div>
              </button>
            );
          })}
        </div>
        {buildings.length >= totalSlots && (
          <p className="text-center text-slate-500 text-sm mt-4">
            🎉 City complete! Defeat the boss to unlock the next world.
          </p>
        )}
      </div>
    </div>
  );
}
