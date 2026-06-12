const COOKIE_UNLOCKED   = "pirates_unlocked";
const COOKIE_FLAG_COV   = "pirate_flag_covenant";
const COOKIE_FLAG_SYN   = "pirate_flag_syndicate";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? (match.split("=")[1] ?? null) : null;
}

function setCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

export function isPirateUnlocked(): boolean {
  return getCookie(COOKIE_UNLOCKED) === "1";
}

export function unlockPirates(): void {
  setCookie(COOKIE_UNLOCKED, "1");
}

export function setPirateFlag(campaign: "covenant" | "syndicate"): void {
  const key = campaign === "covenant" ? COOKIE_FLAG_COV : COOKIE_FLAG_SYN;
  setCookie(key, "1");
}

export function getPirateFlag(campaign: "covenant" | "syndicate"): boolean {
  const key = campaign === "covenant" ? COOKIE_FLAG_COV : COOKIE_FLAG_SYN;
  return getCookie(key) === "1";
}

export function checkCovenantCondition(h: Record<string, string>): boolean {
  return (
    h["covenant_m1_c1"] === "C" &&
    h["covenant_m1_c2"] === "C" &&
    h["covenant_m2_c1"] === "A" &&
    h["covenant_m2_c2"] === "D" &&
    h["covenant_m2_c3"] === "A"
  );
}

export function checkSyndicateCondition(h: Record<string, string>): boolean {
  return (
    h["syndicate_m1_c1"] === "B" &&
    h["syndicate_m1_c2"] === "B" &&
    h["syndicate_m2_c1"] === "C" &&
    h["syndicate_m2_c2"] === "E" &&
    h["syndicate_m2_c3"] === "D"
  );
}

export const VRATH_THRESHOLD = 85;

export function checkVrathCondition(consequenceValue: number): boolean {
  return consequenceValue >= VRATH_THRESHOLD;
}

export function checkAllPirateConditions(
  factionId: string,
  missionIndex: number,
  consequenceValue: number
): boolean {
  if (factionId !== "vrath" || missionIndex !== 2) return false;
  if (!getPirateFlag("covenant")) return false;
  if (!getPirateFlag("syndicate")) return false;
  return checkVrathCondition(consequenceValue);
}
