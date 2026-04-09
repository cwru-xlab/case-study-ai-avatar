"use client";

import { Card, CardBody } from "@heroui/card";
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
      className="h-full cursor-pointer hover:shadow-lg transition-all duration-200 overflow-hidden group"
      isPressable
      onPress={handleCardClick}
    >
      {/* Background Cover Image */}
      <div 
        className="relative h-52 bg-gradient-to-br from-primary-500 to-primary-700"
        style={caseStudy.coverImage ? {
          backgroundImage: `url(${caseStudy.coverImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      >
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        
        {/* Case name on the image */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-white font-semibold text-lg truncate drop-shadow-md">
              {caseStudy.name}
            </h3>
          </div>
        </div>
      </div>
      
      <CardBody className="pt-3">
        <div className="space-y-2">
          <p className="text-xs text-default-400 font-mono truncate">
            {caseStudy.id}
          </p>
          <p className="text-sm text-default-600 line-clamp-2">
            {caseStudy.backgroundInfo}
          </p>
          <div className="text-xs text-default-400 pt-1">
            {caseStudy.avatars.length} avatar{caseStudy.avatars.length !== 1 ? "s" : ""}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
