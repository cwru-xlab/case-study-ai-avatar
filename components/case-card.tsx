"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Briefcase, ImageIcon } from "lucide-react";
import Image from "next/image";
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
      className="h-full cursor-pointer hover:shadow-lg transition-shadow duration-200 overflow-hidden"
      isPressable
      onPress={handleCardClick}
    >
      {/* Cover Image */}
      {caseStudy.coverImage ? (
        <div className="relative w-full h-40 bg-default-100">
          <Image
            src={caseStudy.coverImage}
            alt={caseStudy.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center">
          <ImageIcon className="w-12 h-12 text-primary-300" />
        </div>
      )}
      
      <CardHeader className="flex gap-3 pt-4">
        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Briefcase className="w-5 h-5 text-primary" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <p className="text-md font-semibold truncate">{caseStudy.name}</p>
          <p className="text-xs text-default-400 font-mono truncate">
            {caseStudy.id}
          </p>
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        <div className="space-y-3">
          <p className="text-sm text-default-600 line-clamp-2">
            {caseStudy.backgroundInfo}
          </p>
          <div className="text-xs text-default-400">
            {caseStudy.avatars.length} avatar{caseStudy.avatars.length !== 1 ? "s" : ""}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
