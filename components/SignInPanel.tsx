"use client";

import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

const PROVIDERS = [
  { id: "discord", label: "Discord" },
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
];

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "That account is not the configured operator. Access denied.",
  OAuthSignin: "The provider refused the handshake. Try again.",
  OAuthCallback: "The provider callback failed. Try again.",
  Default: "Sign-in failed. Try again.",
};

export default function SignInPanel() {
  const params = useSearchParams();
  const error = params.get("error");
  const callbackUrl = params.get("callbackUrl") ?? "/admin";

  return (
    <div className="si-panel">
      {error && (
        <p className="si-panel__error" role="alert">
          {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default}
        </p>
      )}
      <div className="st-404__cta">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="sys-btn sys-btn--solid"
            onClick={() => signIn(p.id, { callbackUrl })}
          >
            Sign in with {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
