import { useState, useEffect } from 'react';
import { Gem, AlertCircle, Wrench } from 'lucide-react';
import { supabase, City, Building } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { buildingTypes, repairCity } from '../lib/gameLogic';

const GRID_SIZE = 8;

export function CityView() {
  const { user, profile, refreshProfile } = useAuth();
  const [city, setCity] = useState<City | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);

  useEffect(() => {
    if (user) {
      loadCity();
    }
  }, [user]);

  const loadCity = async () => {
    const { data: cityData } = await supabase
      .from('cities')
      .select('*')
      .eq('user_id', user?.id)
      .maybeSingle();

    if (cityData) {
      setCity(cityData);

      const { data: buildingsData } = await supabase
        .from('buildings')
        .select('*')
        .eq('city_id', cityData.id);

      if (buildingsData) {
        setBuildings(buildingsData);
      }
    }

    setLoading(false);
  };

  const handleCellClick = async (x: number, y: number) => {
    if (!selectedType || !city || !profile) return;

    const existingBuilding = buildings.find(
      (b) => b.position_x === x && b.position_y === y
    );
    if (existingBuilding) return;

    const buildingType = buildingTypes.find((t) => t.id === selectedType);
    if (!buildingType) return;

    if (profile.gem_balance < buildingType.cost) {
      alert(`Not enough gems! Need ${buildingType.cost} gems.`);
      return;
    }

    const { data: newBuilding, error } = await supabase
      .from('buildings')
      .insert({
        city_id: city.id,
        building_type: selectedType,
        position_x: x,
        position_y: y,
        level: 1,
        is_damaged: false,
        repair_cost: 0,
      })
      .select()
      .single();

    if (newBuilding && !error) {
      setBuildings([...buildings, newBuilding]);

      await supabase
        .from('profiles')
        .update({
          gem_balance: profile.gem_balance - buildingType.cost,
        })
        .eq('id', user?.id);

      await supabase
        .from('cities')
        .update({
          total_gems_spent: city.total_gems_spent + buildingType.cost,
        })
        .eq('id', city.id);

      await refreshProfile();
      await loadCity();
    }
  };

  const handleRepair = async () => {
    if (!user || !profile) return;

    setRepairing(true);
    const result = await repairCity(user.id);

    if (result.success) {
      await loadCity();
      await refreshProfile();
    } else {
      alert(`Not enough gems! Need ${result.cost} gems to repair.`);
    }

    setRepairing(false);
  };

  const getWorldUnlockThreshold = (level: number): number => {
    if (level === 1) return 0;
    if (level === 2) return 50;
    return 50 + (level - 2) * 25;
  };

  const canUnlockNextWorld = city && city.total_gems_spent >= getWorldUnlockThreshold(city.world_level + 1);

  const unlockNextWorld = async () => {
    if (!city || !canUnlockNextWorld) return;

    await supabase
      .from('cities')
      .update({
        world_level: city.world_level + 1,
      })
      .eq('id', city.id);

    await loadCity();
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-600">Loading...</div>;
  }

  if (!city) {
    return <div className="text-center py-8 text-slate-600">City not found</div>;
  }

  const damagedBuildings = buildings.filter((b) => b.is_damaged);
  const totalRepairCost = damagedBuildings.reduce((sum, b) => sum + b.repair_cost, 0);

  return (
    <div className="max-w-4xl mx-auto">
      {city.is_decayed && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 mb-1">City in Decay!</h3>
            <p className="text-red-700 text-sm mb-3">
              You missed a day. Your buildings are damaged and need repairs.
            </p>
            <button
              onClick={handleRepair}
              disabled={repairing || (profile && profile.gem_balance < totalRepairCost)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Wrench className="w-4 h-4" />
              <span>Repair City ({totalRepairCost} gems)</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Your City</h2>
            <p className="text-slate-600 text-sm">World {city.world_level}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-600">Total Invested</div>
            <div className="text-2xl font-bold text-slate-900">{city.total_gems_spent} gems</div>
          </div>
        </div>

        <div
          className="grid gap-1 mb-6 bg-slate-100 p-4 rounded-lg"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
            const x = i % GRID_SIZE;
            const y = Math.floor(i / GRID_SIZE);
            const building = buildings.find((b) => b.position_x === x && b.position_y === y);
            const buildingType = building ? buildingTypes.find((t) => t.id === building.building_type) : null;

            return (
              <button
                key={i}
                onClick={() => handleCellClick(x, y)}
                className={`aspect-square flex items-center justify-center text-3xl rounded-lg transition-all ${
                  building
                    ? building.is_damaged
                      ? 'bg-red-100 opacity-50'
                      : 'bg-white'
                    : selectedType
                    ? 'bg-slate-200 hover:bg-slate-300 cursor-pointer'
                    : 'bg-white cursor-default'
                }`}
                disabled={!selectedType || !!building}
              >
                {buildingType ? buildingType.emoji : ''}
              </button>
            );
          })}
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-3">Place Buildings</h3>
          <div className="grid grid-cols-3 gap-2">
            {buildingTypes.map((type) => {
              const canAfford = profile && profile.gem_balance >= type.cost;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(selectedType === type.id ? null : type.id)}
                  disabled={!canAfford}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedType === type.id
                      ? 'border-slate-900 bg-slate-50'
                      : canAfford
                      ? 'border-slate-200 hover:border-slate-300 bg-white'
                      : 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="text-2xl mb-1">{type.emoji}</div>
                  <div className="text-sm font-medium text-slate-900">{type.name}</div>
                  <div className="text-xs text-slate-600 flex items-center justify-center gap-1">
                    <Gem className="w-3 h-3" />
                    {type.cost}
                  </div>
                </button>
              );
            })}
          </div>
          {selectedType && (
            <p className="text-sm text-slate-600 mt-3 text-center">
              Click an empty cell to place your building
            </p>
          )}
        </div>
      </div>

      {canUnlockNextWorld && (
        <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-xl p-6 text-center">
          <h3 className="text-xl font-bold text-slate-900 mb-2">Ready to Expand!</h3>
          <p className="text-slate-600 mb-4">
            You've invested enough to unlock World {city.world_level + 1}
          </p>
          <button
            onClick={unlockNextWorld}
            className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-green-700 transition-all"
          >
            Unlock World {city.world_level + 1}
          </button>
        </div>
      )}
    </div>
  );
}
