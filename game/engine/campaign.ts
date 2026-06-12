import type { CampaignDef, CampaignState, MissionDef, MapData } from "./types";

const CAMPAIGN_SEQUENCES: Record<string, { mapId: string; missionKey: string }[]> = {
  covenant: [
    { mapId: "helvyn",      missionKey: "covenant_m1" },
    { mapId: "helvyn",      missionKey: "covenant_m2" },
    { mapId: "helvyn",      missionKey: "covenant_m3" },
  ],
  syndicate: [
    { mapId: "karadun",     missionKey: "syndicate_m1" },
    { mapId: "saren-volyn", missionKey: "syndicate_m2" },
    { mapId: "saren-volyn", missionKey: "syndicate_m3" },
  ],
  vrath: [
    { mapId: "yelvar",  missionKey: "vrath_m1" },
    { mapId: "ac-411",  missionKey: "vrath_m2" },
    { mapId: "ac-411",  missionKey: "vrath_m3" },
  ],
  pirates: [
    { mapId: "karadun",     missionKey: "pirates_m1" },
    { mapId: "saren-volyn", missionKey: "pirates_m2" },
    { mapId: "helvyn",      missionKey: "pirates_m3" },
  ],
};

export function getCampaignDef(factionId: string, maps: MapData[]): CampaignDef | null {
  const sequence = CAMPAIGN_SEQUENCES[factionId];
  if (!sequence) return null;

  const missions: MissionDef[] = [];
  for (const { mapId, missionKey } of sequence) {
    const map = maps.find((m) => m.id === mapId);
    if (!map) continue;
    const override = map.missionOverrides[missionKey];
    if (!override) continue;
    missions.push({
      mapId,
      enemyFaction: override.enemyFaction,
      objectiveLabel: override.objectiveLabel,
      missionKey,
    });
  }

  return { factionId, missions };
}

export function getCurrentMission(campaign: CampaignDef, missionIndex: number): MissionDef | null {
  return campaign.missions[missionIndex] ?? null;
}

export function getMissionAt(campaign: CampaignDef, index: number): MissionDef | null {
  return campaign.missions[index] ?? null;
}

export function initCampaignState(factionId: string, commanderId: string, consequenceVarId: string): CampaignState {
  return {
    factionId,
    commanderId,
    missionIndex: 0,
    consequenceVariable: { id: consequenceVarId, value: 0 },
    extraVariables: {},
    choiceHistory: {},
  };
}

export function advanceMission(
  campaignState: CampaignState,
  consequenceDelta: number
): CampaignState {
  return {
    ...campaignState,
    missionIndex: campaignState.missionIndex + 1,
    consequenceVariable: {
      ...campaignState.consequenceVariable,
      value: campaignState.consequenceVariable.value + consequenceDelta,
    },
  };
}

export function isCampaignComplete(campaign: CampaignDef, missionIndex: number): boolean {
  return missionIndex >= campaign.missions.length;
}
