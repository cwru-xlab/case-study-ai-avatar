"use client";

import { Card, CardBody } from "@heroui/card";

interface WeatherheadLogoProps {
  className?: string;
  variant?: "fixed" | "inline";
}

export const WeatherheadLogo = ({
  className = "h-12 w-auto object-contain",
  variant = "fixed",
}: WeatherheadLogoProps) => {
  if (variant === "inline") {
    return (
      <img
        src="/cwru_wsom_logo.png"
        alt="Weatherhead School of Management"
        className={className}
      />
    );
  }

  return (
    <div className="fixed top-4 left-4 z-50">
      <Card className="shadow-medium">
        <CardBody className="p-3">
          <img
            src="/cwru_wsom_logo.png"
            alt="Weatherhead School of Management"
            className={className}
          />
        </CardBody>
      </Card>
    </div>
  );
};
