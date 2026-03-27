"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Briefcase } from "lucide-react";
import type { CaseStudy } from "@/types";

interface CaseCardProps {
  caseStudy: CaseStudy;
  onClick: (caseId: string) => void;
}

export default function CaseCard({ caseStudy, onClick }: CaseCardProps) {
  const handleCardClick = () => {
    onClick(caseStudy.id);
  };

  return (
    <Card
      className="h-full cursor-pointer hover:shadow-lg transition-shadow duration-200"
      isPressable
      onPress={handleCardClick}
    >
      <CardHeader className="flex gap-3">
        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
          <Briefcase className="w-6 h-6 text-primary" />
        </div>
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-md font-semibold">{caseStudy.name}</p>
          </div>
          <p className="flex items-center text-small text-default-500 font-mono">
            {caseStudy.id}
          </p>
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        <div className="space-y-3">
          <div>
            <p className="text-sm text-default-600 line-clamp-3">
              {caseStudy.backgroundInfo}
            </p>
          </div>
          <div className="text-xs text-default-400">
            {caseStudy.avatars.length} avatar{caseStudy.avatars.length !== 1 ? "s" : ""}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
