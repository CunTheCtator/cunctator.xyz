export type TileType = "plains" | "mountain" | "structure" | "objective" | "open" | "ruins" | "water" | "resource";

export type Tile = {
  type: TileType;
  passable: boolean;
  moveCost: number;
  blocksVision?: boolean;
  destructible?: boolean;
};

export type StatusEffect = {
  id: string;
  duration: number;
  modifier: Partial<UnitStats>;
};

export type ArmyEffect = {
  id: string;
  effectId: string;
  type: string;
  magnitude: number;
  duration: number;
  sourceCommander?: number;
};

export type UnitStats = {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  moveRange: number;
  attackRange: number;
  visionRange: number;
};

export type TraitEffect = {
  type: string;
  target: string;
  magnitude: number;
  duration: number;
  condition: string | null;
};

export type UnitTrait = {
  id: string;
  name: string;
  description: string;
  effect: TraitEffect;
};

export type Unit = UnitStats & {
  id: number;
  unitDataId: string;
  faction: string;
  type: string;
  name: string;
  role: string;
  x: number;
  y: number;
  isBuilder: boolean;
  isCommander: boolean;
  isExtractor: boolean;
  unkillable: boolean;
  extractorLevel: number;
  xp: number;
  kills: number;
  aiMode: "attack" | "defend";
  hasMoved: boolean;
  hasActed: boolean;
  movedTiles: number;
  repositionMoves: number;
  usedTraits: string[];
  statusEffects: StatusEffect[];
  traits: UnitTrait[];
};

export type Structure = {
  id: string;
  structureDefId: string;
  name: string;
  x: number;
  y: number;
  factionId: string;
  builtBy: string;
  hp: number;
  maxHp: number;
  currencyCost: number;
};

export type StructureDef = {
  id: string;
  name: string;
  faction: string;
  category: string;
  currencyCost: number;
  durability: number;
  repairCostPerPoint: number;
  description: string;
  upgradeFrom?: string;
  upgradeCost?: number;
  effect: Record<string, unknown>;
};

export type AbilityDef = {
  id: string;
  unitId: string;
  slot: number;
  name: string;
  description: string;
  xpUnlock: number;
  currencyCost: number;
  cooldown: number;
  oncePer?: string;
  effect: Record<string, unknown>;
};

export type EconomyData = {
  xp: {
    milestones: { statIncrease: number; secondTrait: number; ability1Unlock: number; ability2Unlock: number };
    statIncreaseAmount: number;
    statIncreasePlayerChoice: boolean;
    statIncreaseOptions: string[];
    system: {
      killBonus: number;
      damageShareFormula: string;
      killerReceivesDamageShare: boolean;
      carryOverSamePlanet: boolean;
      carryOverDifferentPlanet: boolean;
      globalCurrencyCarriesOverAlways: boolean;
    };
  };
  resourceTiles: {
    baseOutputPerTurn: number;
    relayPostBonus: number;
    supplyCacheBonusPerTurn: number;
    extractorUpgrades: { level: number; cost: number; outputMultiplier: number; label: string }[];
  };
  unitReplacementCosts: Record<string, number | string>;
  structureCosts: Record<string, number | string>;
  structureRepair: {
    actionCostPerRepair: number;
    durabilityRestoredPerAction: number;
    currencyCostPerPoint: number;
    requiresAdjacentBuilder: boolean;
    cannotExceedBaseDurability: boolean;
  };
};

export type EffectContext = {
  armyEffects?: ArmyEffect[];
  allUnits?: Unit[];
  structures?: Structure[];
  structureDefs?: StructureDef[];
};

export type PuzzleNodeMapDef = {
  id: string;
  label: string;
  row: number;
  col: number;
  activationRange: number;
  reward: { effectId: string };
};

export type PuzzleNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  activationRange: number;
  reward: { effectId: string };
  activated: boolean;
};

export type CipherPuzzle = {
  nodeId: string;
  key: string[];
  encoded: number[];
  answer: string[];
  fragment: { id: string; text: string } | null;
  showingFragment: boolean;
};

export type PendingReinforcement = {
  turn: number;
  label: string;
  tiles: SpawnPoint[];
  units: Unit[];
  spawned: boolean;
};

export type XpMilestones = {
  statIncrease: number;
  secondTrait: number;
  ability1Unlock: number;
  ability2Unlock: number;
};

export type PendingMove = {
  unitId: number;
  fromX: number;
  fromY: number;
  movedTiles: number;
};

export type Difficulty = "standard" | "easy";

export type GameState = {
  phase: "player-turn" | "enemy-turn" | "win" | "loss";
  mapId: string;
  grid: Tile[][];
  units: Unit[];
  structures: Structure[];
  structureDefs: StructureDef[];
  globalCurrency: number;
  enemyGlobalCurrency: number;
  playerFaction: string;
  enemyFaction: string;
  turn: number;
  actionBudget: number;
  selectedUnitId: number | null;
  reachableTiles: { x: number; y: number }[] | null;
  fog: boolean[][];
  lastKnownPositions: Record<number, { x: number; y: number }>;
  puzzleNodes: PuzzleNode[];
  playerSpawnCenter: { x: number; y: number };
  enemySpawnCenter: { x: number; y: number };
  armyEffects: ArmyEffect[];
  enemyArmyEffects: ArmyEffect[];
  markedUnits: Record<number, number>;
  activePuzzle: CipherPuzzle | null;
  consequenceVariable: { id: string; value: number };
  fragmentPool: { id: string; text: string; used: boolean }[];
  puzzleDef: {
    symbols: { id: string; glyph: string; label: string }[];
    encodedLength: number;
    fragmentDisplayDuration: number;
  };
  pendingMilestones: { unitId: number; type: "stat_choice" }[];
  abilityDefs: AbilityDef[];
  missionKey: string;
  firedTriggers: string[];
  enemyCountAtStart: number;
  events: GameEvent[];
  objectiveTiles: { x: number; y: number; label: string }[];
  pendingReinforcements: PendingReinforcement[];
  xpMilestones: XpMilestones;
  lockedSecondTraits: Record<number, UnitTrait>;
  pendingMove: PendingMove | null;
  difficulty: Difficulty;
};

export type GameEvent = {
  id: number;
  turn: number;
  kind: "sys" | "you" | "atk" | "ok";
  text: string;
};

export type GameAction =
  | { type: "SELECT_UNIT"; unitId: number }
  | { type: "MOVE_UNIT"; unitId: number; to: { x: number; y: number } }
  | { type: "ATTACK"; attackerId: number; targetId: number }
  | { type: "BUILD"; unitId: number; at: { x: number; y: number }; structureDefId: string }
  | { type: "DEMOLISH"; unitId: number; at: { x: number; y: number } }
  | { type: "USE_ABILITY"; unitId: number; traitId: string; targetUnitId?: number; targetTile?: { x: number; y: number } }
  | { type: "END_TURN" }
  | { type: "DESELECT" }
  | { type: "PUZZLE_SUBMIT"; answer: string[] }
  | { type: "PUZZLE_SKIP" }
  | { type: "CONSEQUENCE_DELTA"; delta: number }
  | { type: "CHOOSE_STAT"; unitId: number; stat: "attack" | "defense" | "hp" | "moveRange" }
  | { type: "UPGRADE_EXTRACTOR"; unitId: number; extractorId: number }
  | { type: "REPAIR_STRUCTURE"; unitId: number; at: { x: number; y: number } }
  | { type: "UNDO_MOVE" };

export type AnimFrame = {
  state: GameState;
  flashTiles?: { x: number; y: number }[];
  duration: number;
};

export type UnitDataStats = {
  health: number;
  attack: number;
  defense: number;
  movementRange: number;
  visionRange: number;
  actionCost: number;
};

export type UnitData = {
  id: string;
  factionId: string;
  name: string;
  role: string;
  isBuilder: boolean;
  isExtractor?: boolean;
  unkillable?: boolean;
  stats: UnitDataStats;
  traits: UnitTrait[];
};

export type PassiveEffect = {
  type: string;
  target: string;
  magnitude: number;
  condition: string | null;
};

export type CommanderData = {
  id: string;
  factionId: string;
  name: string;
  passiveLabel: string;
  passiveDescription: string;
  passiveEffect: PassiveEffect;
  stats: UnitDataStats;
  traits: UnitTrait[];
};

export type ConsequenceVariable = {
  id: string;
  label: string;
  description: string;
  lowThreshold: number;
  highThreshold: number;
};

export type FactionData = {
  id: string;
  name: string;
  species: string;
  color: string;
  playStyle: string;
  remnantRelation: string;
  amplificationType: string;
  consequenceVariable: ConsequenceVariable;
};

export type StatusEffectDef = {
  id: string;
  name: string;
  level: "unit" | "army";
  description: string;
  duration: number;
  type: string;
  magnitude: number;
  stackable: boolean;
  curable: boolean;
  source: string;
};

export type SpawnPoint = { row: number; col: number };

export type SpawnZoneRect = { rows: [number, number]; cols: [number, number] };

export type ReinforcementWaveDef = { turn: number; label: string; tiles: SpawnPoint[] };

export type RosterEntry = {
  unitId: string;
  count: number;
  spawnZone: number;
  commander: boolean;
  designNote?: string;
};

export type StartingRosters = {
  player: RosterEntry[];
  enemy: RosterEntry[];
  reinforcements: RosterEntry[];
};

export type DesignedRoute = { label: string; kind: string; waypoints: SpawnPoint[] };

export type ObjectiveTileDef = { row: number; col: number; label: string };

export type MissionOverride = {
  objectiveLabel: string;
  enemyFaction: string;
  spawnOverride: { player: SpawnPoint[]; enemy: SpawnPoint[] } | null;
  ambushStart?: boolean;
  reinforcements?: ReinforcementWaveDef[];
  objectiveTiles?: ObjectiveTileDef[];
  designedRoutes?: DesignedRoute[];
  startingRosters?: StartingRosters | null;
  economyNotes?: { player: string; enemy: string } | null;
  spawnZoneRects?: { player: SpawnZoneRect[]; enemy: SpawnZoneRect[] };
  conditionalElements?: { condition: string; element: string }[];
};

export type RenderType = "open" | "ruins" | "mountain" | "spire_wall" | "spire_floor";

export type RGB = [number, number, number];

export type RuinsPerturbConfig = {
  regions: { rows: [number, number]; cols: [number, number] }[];
  erodeProb: number;
  expandProb: number;
};

export type RenderTypeOverrideRegion = {
  rows: [number, number];
  cols: [number, number];
  renderType: RenderType;
  label?: string;
};

export type FractalLayerConfig = {
  baseScale: number;
  octaves: number;
  seedOffset: number;
};

export type MapTerrainConfig = {
  seed: number;
  warpStrength: number;
  palette: Record<RenderType, RGB>;
  amplitude: Record<RenderType, number>;
  blockingRenderTypes: RenderType[];
  renderTypeOverrides: RenderTypeOverrideRegion[];
  structureRenderType: RenderType;
  decorations: {
    boulder: { row: number; col: number }[];
    crevasse: { row: number; col: number }[];
  };
  ruinsPerturb: RuinsPerturbConfig;
  spriteAssets: Partial<Record<"boulder" | "crevasse" | "resource" | "puzzle", string>>;
  resourceAlphaScale: number;
  fractal: {
    fine: FractalLayerConfig;
    medium: FractalLayerConfig;
    warpX: FractalLayerConfig;
    warpY: FractalLayerConfig;
    fineMediumMix: [number, number];
  };
  boundaryAntiAliasStrength: number;
  rotationHash: [number, number];
  paintedImage?: string;
  paintedTiles?: Partial<Record<RenderType, string>>;
  paintedBlurSigma?: Partial<Record<RenderType, number>>;
  paintedOutputSize?: number;
};

export type FlatTextGridRef = { format: "flat-text"; source: string };

export type MapData = {
  id: string;
  name: string;
  world: string;
  description: string;
  grid: null | TileType[][] | FlatTextGridRef | object;
  defaultSpawnZones: {
    player: SpawnPoint[];
    enemy: SpawnPoint[];
  };
  resourceTiles?: { row: number; col: number }[];
  puzzleNodes: PuzzleNodeMapDef[];
  missionOverrides: Record<string, MissionOverride>;
  terrain?: MapTerrainConfig | null;
};

export type MissionDef = {
  mapId: string;
  enemyFaction: string;
  objectiveLabel: string;
  missionKey: string;
};

export type CampaignDef = {
  factionId: string;
  missions: MissionDef[];
};

export type CampaignState = {
  factionId: string;
  commanderId: string;
  missionIndex: number;
  consequenceVariable: { id: string; value: number };
  extraVariables: Record<string, number>;
  choiceHistory: Record<string, string>;
};

export type PuzzleFragmentsDef = {
  symbols: { id: string; glyph: string; label: string }[];
  encodedLength: number;
  keySize: number;
  mechanics: {
    activationRange: number;
    timeLimit: number | null;
    penaltyOnFailure: boolean;
    nodeDeactivatesOnSkip: boolean;
    fragmentDisplayDuration: number;
  };
  fragments: { id: string; text: string; used: boolean }[];
};
