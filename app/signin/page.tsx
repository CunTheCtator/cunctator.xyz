import type { Metadata } from "next";
import { Suspense } from "react";
import SysBar from "@/components/sys/SysBar";
import SysFooter from "@/components/sys/SysFooter";
import SignInPanel from "@/components/SignInPanel";

export const metadata: Metadata = {
  title: "Sign in | cunctator",
  description: "Operator authentication. Admin access only.",
  robots: { index: false },
};

export default function SignInPage() {
  return (
    <div className="sys">
      <SysBar status="PERSONAL SYSTEM">
        <span className="lock">RESTRICTED</span>
      </SysBar>

      <div className="st-404">
        <div className="st-404__grid" />
        <div className="st-404__in">
          <div className="st-404__kicker">
            <span className="d" />
            OPERATOR AUTHENTICATION
          </div>
          <h2 className="st-404__title">This door has one key.</h2>
          <p className="st-404__lead">
            The admin console is for the site&apos;s owner. Sign-in works only for the
            single configured account. No registrations, no passwords stored.
          </p>
          <Suspense fallback={null}>
            <SignInPanel />
          </Suspense>
        </div>
      </div>

      <SysFooter />
    </div>
  );
}
