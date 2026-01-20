"use client";

import { Card, CardBody } from "@heroui/card";

interface XLabLogoProps {
  className?: string;
  variant?: "fixed" | "inline";
  bottom?: string;
  left?: string;
}

export const XLabLogo = ({
  className = "h-12 w-auto object-contain",
  variant = "fixed",
  bottom = "bottom-4",
  left = "left-4",
}: XLabLogoProps) => {
  if (variant === "inline") {
    return (
      <img
        src="/xLab_logo.png"
        alt="xLab - Building Digital Intelligence @ Weatherhead School of Management"
        className={className}
      />
    );
  }

  return (
    <div className={`fixed ${bottom} ${left} z-50`}>
      <Card className="shadow-medium items-start">
        <p className="text-sm text-gray-700 pl-2">Powered by</p>
        <CardBody className="p-1">
          <img
            src="/xLab_logo.png"
            alt="xLab - Building Digital Intelligence @ Weatherhead School of Management"
            className={className}
          />
        </CardBody>
      </Card>
    </div>
  );
};

