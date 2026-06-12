import { NAV } from "@/lib/site";

const BUILD_TAG = "BUILD 2026.06";

export default function SystemBar() {
  const sectionsLabel = String(NAV.length).padStart(2, "0");
  return (
    <div className="vb-bar vb-mono">
      <div>
        CUNCTATOR <b>//</b> PERSONAL SYSTEM
      </div>
      <div className="vb-bar__right">
        <span>
          STATUS: <b>ONLINE</b>
        </span>
        <span>SECTIONS: {sectionsLabel}</span>
        <span>{BUILD_TAG}</span>
      </div>
    </div>
  );
}
