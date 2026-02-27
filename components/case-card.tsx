"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Briefcase, Clock, Target } from "lucide-react";
import type { CaseStudy } from "@/types";

interface CaseCardProps {
  caseStudy: CaseStudy;
  onClick: (caseId: string) => void;
}

export default function CaseCard({ caseStudy, onClick }: CaseCardProps) {
  const handleCardClick = () => {
    onClick(caseStudy.id);
  };

  const statusColor = caseStudy.status === "published" 
    ? "success" 
    : caseStudy.status === "archived" 
      ? "default" 
      : "warning";

  const difficultyColor = caseStudy.difficulty === "advanced" 
    ? "danger" 
    : caseStudy.difficulty === "intermediate" 
      ? "warning" 
      : "success";

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
            <Chip size="sm" color={statusColor} variant="flat">
              {(caseStudy.status || "draft").charAt(0).toUpperCase() + (caseStudy.status || "draft").slice(1)}
            </Chip>
          </div>
          <p className="flex items-center text-small text-default-500 font-mono">
            {caseStudy.id}
          </p>
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        <div className="space-y-3">
          <div>
            <p className="text-sm text-default-600 line-clamp-2">
              {caseStudy.backgroundInfo}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Chip size="sm" color={difficultyColor} variant="bordered">
              {(caseStudy.difficulty || "beginner").charAt(0).toUpperCase() + (caseStudy.difficulty || "beginner").slice(1)}
            </Chip>
            {caseStudy.estimatedDuration > 0 && (
              <Chip size="sm" variant="flat" startContent={<Clock className="w-3 h-3" />}>
                {caseStudy.estimatedDuration} min
              </Chip>
            )}
            {(caseStudy.learningObjectives?.length || 0) > 0 && (
              <Chip size="sm" variant="flat" startContent={<Target className="w-3 h-3" />}>
                {caseStudy.learningObjectives.length} objective{caseStudy.learningObjectives.length !== 1 ? "s" : ""}
              </Chip>
            )}
          </div>

          <div className="text-xs text-default-400">
            {caseStudy.avatars?.length || 0} avatar{(caseStudy.avatars?.length || 0) !== 1 ? "s" : ""}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
