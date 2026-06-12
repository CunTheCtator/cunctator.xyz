import { getAllDocuments } from "@/lib/db";
import { NAV, PROJECTS, PUBLIC_FACTION_COUNT, type Counter } from "@/lib/site";

export function getSiteCounters(): Counter[] {
  const documents = getAllDocuments();
  return [
    {
      value: documents.length,
      label: "World documents",
      sub: documents.length === 0 ? "archive opening soon" : "lore & chronicles",
    },
    { value: PROJECTS.length + 1, label: "Projects", sub: "built & shipped" },
    { value: PUBLIC_FACTION_COUNT, label: "Game factions", sub: "playable" },
    { value: NAV.length, label: "Sections", sub: "one site" },
  ];
}
