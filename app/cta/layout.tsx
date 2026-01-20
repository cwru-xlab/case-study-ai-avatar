import { ReactNode } from "react";

interface CTALayoutProps {
  children: ReactNode;
}

export default function CTALayout({ children }: CTALayoutProps) {
  return <div className="min-h-screen">{children}</div>;
}
