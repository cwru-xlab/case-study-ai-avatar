"use client";

import { Card, CardBody } from "@heroui/card";
import { Spinner } from "@heroui/spinner";

interface ThinkingIndicatorProps {
  isVisible?: boolean;
  className?: string;
}

export const ThinkingIndicator = ({
  isVisible = false,
  className = "",
}: ThinkingIndicatorProps) => {
  if (!isVisible) return null;

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 ${className}`}>
      <Card className="shadow-medium bg-white/90 backdrop-blur-sm">
        <CardBody className="p-4 flex flex-row items-center gap-3">
          <Spinner size="md" color="primary" />
          <span className="text-base font-medium text-gray-700">Thinking...</span>
        </CardBody>
      </Card>
    </div>
  );
};
