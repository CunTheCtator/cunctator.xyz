import factionsJson from "@/game/data/factions.json";

export type NavLink = { href: string; label: string };

export const NAV: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/library", label: "The Library" },
  { href: "/game", label: "The Game" },
  { href: "/contact", label: "Contact" },
];

export type Profile = {
  label: "GitHub" | "Reddit" | "Discord" | "itch.io" | "Steam" | "YouTube" | "Twitch" | "Email";
  handle: string;
  href: string | null;
  forWhat?: string;
  primary?: boolean;
};

export const PROFILES: Profile[] = [
  {
    label: "GitHub",
    handle: "@CunTheCtator",
    href: "https://github.com/CunTheCtator",
    forWhat: "Source, issues, and the occasional pull request.",
    primary: true,
  },
  {
    label: "Reddit",
    handle: "u/_TheCunctator_",
    href: "https://www.reddit.com/user/_TheCunctator_/",
    forWhat: "Longer threads and worldbuilding talk.",
    primary: true,
  },
  {
    label: "Discord",
    handle: "theCunctator",
    href: "https://discord.gg/ZK2wsHDu6g",
    forWhat: "The fastest back-and-forth. Join the server or add me directly.",
    primary: true,
  },
  {
    label: "itch.io",
    handle: "cunctator.itch.io",
    href: "https://cunctator.itch.io",
    forWhat: "Where the games live as games.",
  },
  {
    label: "Steam",
    handle: "TheCunctator",
    href: "https://steamcommunity.com/id/TheCunctator/",
    forWhat: "Tactics and strategy, played as much as built.",
  },
  {
    label: "YouTube",
    handle: "@thegloriouscunctator",
    href: "https://www.youtube.com/@thegloriouscunctator",
    forWhat: "The occasional video.",
  },
  {
    label: "Twitch",
    handle: "the_cunctator",
    href: "https://www.twitch.tv/the_cunctator",
    forWhat: "Live, now and then.",
  },
  {
    label: "Email",
    handle: "contact@cunctator.xyz",
    href: "mailto:contact@cunctator.xyz",
  },
];

export const COLOPHON =
  "Named for the general who won the war by refusing to hurry.";

export const STATEMENT =
  "I build systems, fictional worlds, and the rules that govern both.";

export const STATUS = "Open to interesting problems";

export type Project = {
  n: string;
  title: string;
  year: string;
  desc: string;
  tags: string[];
  status: [string, string];
  links: { label: string; href: string; solid?: boolean }[];
};

export const FEATURED_PROJECT = {
  eyebrow: "FEATURED · THE SITE YOU'RE ON",
  title: "cunctator.xyz",
  meta: "2026 · Next.js · TypeScript · Tailwind · SQLite",
  desc:
    "A personal hub with a worldbuilding library that renders client-uploaded HTML in sandboxed iframes, an admin panel with no stored passwords (OAuth only), and a tactics game embedded as a first-class destination. Self-hosted on a box I own.",
  tags: ["Next.js", "TypeScript", "Tailwind", "SQLite", "OAuth", "Nginx"],
  status: ["live", "Live"] as [string, string],
  links: [
    { label: "View source", href: "https://github.com/CunTheCtator/cunctator.xyz" },
    { label: "Live site", href: "https://cunctator.xyz", solid: true },
  ],
  url: "cunctator.xyz",
};

export const PROJECTS: Project[] = [
  {
    n: "02",
    title: "Remnant",
    year: "2026 · playable now",
    desc:
      "A turn-based tactics campaign built from scratch on HTML5 Canvas: A* pathfinding, fog of war with last-known-position AI, a dynamic action-budget economy, deterministic combat with a pre-commit forecast, and five hand-designed 64×64 worlds. No game engine.",
    tags: ["TypeScript", "HTML5 Canvas", "A* pathfinding"],
    status: ["live", "Playable"],
    links: [
      { label: "Play it", href: "/game", solid: true },
      { label: "Source", href: "https://github.com/CunTheCtator/cunctator.xyz/tree/main/game" },
    ],
  },
];

export type Counter = { value: number | string; label: string; sub: string };

export const PUBLIC_FACTION_COUNT = (factionsJson as { id: string }[]).filter(
  (f) => f.id !== "pirates"
).length;
