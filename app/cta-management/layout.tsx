import { ReactNode } from "react";

interface CTAManagementLayoutProps {
  children: ReactNode;
}

export default function CTAManagementLayout({ children }: CTAManagementLayoutProps) {
  return (
    <div className="space-y-6">
      {children}
    </div>
  );
}