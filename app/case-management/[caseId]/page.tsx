"use client";

import { useParams, useRouter } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { ArrowLeft, Briefcase } from "lucide-react";

import { title } from "@/components/primitives";

// Placeholder case data (same as parent page for consistency)
const casesData: Record<string, { id: string; name: string }> = {
  "case-1": { id: "case-1", name: "Case 1" },
  "case-2": { id: "case-2", name: "Case 2" },
  "case-3": { id: "case-3", name: "Case 3" },
};

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.caseId as string;
  
  const caseData = casesData[caseId];

  const handleBack = () => {
    router.push("/case-management");
  };

  if (!caseData) {
    return (
      <div className="flex flex-col gap-6 w-[70vw]">
        <div className="flex items-center gap-4">
          <Button
            isIconOnly
            variant="light"
            onPress={handleBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className={title()}>Case Not Found</h1>
        </div>
        <Card>
          <CardBody className="text-center py-8">
            <p className="text-default-500">
              The requested case could not be found.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-[70vw]">
      <div className="flex items-center gap-4">
        <Button
          isIconOnly
          variant="light"
          onPress={handleBack}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className={title()}>{caseData.name}</h1>
          <p className="text-default-500 mt-2">
            Case detail page - content coming soon
          </p>
        </div>
      </div>

      <Divider />

      {/* Placeholder content */}
      <Card>
        <CardBody className="flex flex-col items-center justify-center gap-4 py-12">
          <Briefcase className="w-16 h-16 text-primary opacity-50" />
          <h3 className="text-xl font-semibold text-default-600">
            {caseData.name} Details
          </h3>
          <p className="text-default-500 text-center max-w-md">
            This is a placeholder for the case detail content. 
            Additional information and functionality will be added here.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
