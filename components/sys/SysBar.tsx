import type { ReactNode } from "react";

type Props = {
  status: string;
  children: ReactNode;
};

export default function SysBar({ status, children }: Props) {
  return (
    <div className="sys-bar mono">
      <div>
        CUNCTATOR <b>//</b> {status}
      </div>
      <div className="sys-bar__right">{children}</div>
    </div>
  );
}
