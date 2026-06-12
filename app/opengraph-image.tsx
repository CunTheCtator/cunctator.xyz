import { ImageResponse } from "next/og";
import { NAV } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt =
  "cunctator. I build systems, fictional worlds, and the rules that govern both.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#1f86b0";
const OK = "#3fb950";
const FG = "#e6edf3";
const MUTED = "#8b949e";
const DIM = "#5c6672";
const LINE = "rgba(230,237,243,0.08)";
const LINE_STRONG = "rgba(230,237,243,0.16)";
const RED = "#c63d2e";

type Font = {
  name: string;
  data: ArrayBuffer;
  weight: 300 | 600 | 700;
  style: "normal";
};

async function loadFont(family: string, weight: 300 | 600 | 700): Promise<Font | null> {
  try {
    const api = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`;
    const css = await (await fetch(api)).text();
    const url = css.match(/src:\s*url\((https:[^)]+)\)/)?.[1];
    if (!url) return null;
    const data = await (await fetch(url)).arrayBuffer();
    return { name: family, data, weight, style: "normal" };
  } catch (err) {
    console.error(`[og] failed to load font ${family} ${weight}:`, err);
    return null;
  }
}

const ACCENT_CELLS = new Set([7, 19, 31, 56, 88, 102]);
const RED_CELLS = new Set([44, 117]);
const DIM_CELLS = new Set([20, 33, 45, 57, 69, 81, 93]);

function Battlefield() {
  const cells = [];
  for (let i = 0; i < 144; i++) {
    let background = LINE_STRONG;
    let boxShadow: string | undefined;
    if (ACCENT_CELLS.has(i)) {
      background = ACCENT;
      boxShadow = `0 0 12px ${ACCENT}`;
    } else if (RED_CELLS.has(i)) {
      background = RED;
    } else if (DIM_CELLS.has(i)) {
      background = DIM;
    }
    cells.push(
      <div
        key={i}
        style={{ width: 28, height: 28, borderRadius: 3, background, ...(boxShadow ? { boxShadow } : {}) }}
      />
    );
  }
  return (
    <div
      style={{
        position: "absolute",
        top: -56,
        right: -72,
        width: 380,
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        transform: "rotate(-8deg)",
        opacity: 0.5,
      }}
    >
      {cells}
    </div>
  );
}

export default async function OpengraphImage() {
  const fonts = (
    await Promise.all([
      loadFont("Oxanium", 700),
      loadFont("Nunito Sans", 300),
      loadFont("Nunito Sans", 600),
    ])
  ).filter((f): f is Font => f !== null);

  const sections = String(NAV.length).padStart(2, "0");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          backgroundColor: "#0D1117",
          backgroundImage:
            "radial-gradient(circle at 78% 42%, rgba(31,134,176,0.20), transparent 55%)",
          color: FG,
          fontFamily: "Nunito Sans",
          overflow: "hidden",
        }}
      >
        <Battlefield />

        <div
          style={{
            height: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 48px",
            borderBottom: `1px solid ${LINE}`,
            backgroundColor: "#0b1016",
            fontSize: 16,
            letterSpacing: 1.5,
            color: DIM,
          }}
        >
          <div style={{ display: "flex" }}>
            <span>CUNCTATOR </span>
            <span style={{ color: ACCENT }}>//</span>
            <span> PERSONAL SYSTEM</span>
          </div>
          <div style={{ display: "flex", gap: 30 }}>
            <span style={{ display: "flex" }}>
              STATUS: <span style={{ color: OK }}>&nbsp;ONLINE</span>
            </span>
            <span>SECTIONS: {sections}</span>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "64px 64px 56px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              color: ACCENT,
              fontSize: 17,
              letterSpacing: 5,
              textTransform: "uppercase",
              marginBottom: 26,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 4, background: ACCENT, marginRight: 12 }} />
            Operator Profile
          </div>

          <div
            style={{
              display: "flex",
              fontFamily: "Oxanium",
              fontWeight: 700,
              fontSize: 150,
              lineHeight: 1,
              letterSpacing: -6,
              marginBottom: 26,
            }}
          >
            <span>cunctator</span>
            <span style={{ color: ACCENT }}>.</span>
          </div>

          <div style={{ display: "flex", fontSize: 33, fontWeight: 300, lineHeight: 1.32, color: FG, maxWidth: 760 }}>
            I build systems, fictional worlds, and the rules that govern both.
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 12 }}>
              {["Programmer", "Worldbuilder", "Game Master"].map((role) => (
                <div
                  key={role}
                  style={{
                    display: "flex",
                    fontFamily: "Oxanium",
                    fontWeight: 600,
                    fontSize: 18,
                    letterSpacing: 1,
                    color: MUTED,
                    border: `1px solid ${LINE_STRONG}`,
                    borderRadius: 999,
                    padding: "9px 22px",
                  }}
                >
                  {role}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", fontSize: 20, letterSpacing: 1, color: DIM }}>
              <span style={{ color: FG }}>cunctator.xyz</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
