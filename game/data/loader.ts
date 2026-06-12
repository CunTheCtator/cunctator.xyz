import type { FactionData, UnitData, CommanderData, StatusEffectDef, PuzzleFragmentsDef, MapData, StructureDef, AbilityDef, EconomyData } from "../engine/types";
import type { NarrativeData } from "../engine/narrative";

import factionsRaw from "./factions.json";
import unitsRaw from "./units.json";
import commandersRaw from "./commanders.json";
import statusEffectsRaw from "./status-effects.json";
import puzzleFragmentsRaw from "./puzzle-fragments.json";
import structuresRaw from "./structures.json";
import abilitiesRaw from "./abilities.json";
import economyRaw from "./economy.json";
import narrativeRaw from "./narrative.json";

import helvyn from "./maps/helvyn.json";
import karadun from "./maps/karadun.json";
import sarenVolyn from "./maps/saren-volyn.json";
import yelvar from "./maps/yelvar.json";
import ac411 from "./maps/ac-411.json";

export const factions = factionsRaw as FactionData[];
export const units = unitsRaw as UnitData[];
export const commanders = commandersRaw as CommanderData[];
export const statusEffects = statusEffectsRaw as StatusEffectDef[];
export const puzzleFragments = puzzleFragmentsRaw as PuzzleFragmentsDef;
export const structures = structuresRaw as StructureDef[];
export const abilities = abilitiesRaw as AbilityDef[];
export const economy = economyRaw as EconomyData;
export const maps = [helvyn, karadun, sarenVolyn, yelvar, ac411] as unknown as MapData[];
export const narrativeData = narrativeRaw as NarrativeData;

export type GameDataBundle = {
  factions: FactionData[];
  units: UnitData[];
  commanders: CommanderData[];
  statusEffects: StatusEffectDef[];
  puzzleFragments: PuzzleFragmentsDef;
  maps: MapData[];
  structures: StructureDef[];
  abilities: AbilityDef[];
  economy: EconomyData;
  narrativeData: NarrativeData;
};

export const gameData: GameDataBundle = {
  factions,
  units,
  commanders,
  statusEffects,
  puzzleFragments,
  maps,
  structures,
  abilities,
  economy,
  narrativeData,
};
