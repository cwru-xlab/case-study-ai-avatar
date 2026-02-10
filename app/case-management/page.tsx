"use client";

import { Card, CardBody } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Briefcase } from "lucide-react";
import { useRouter } from "next/navigation";

import { title } from "@/components/primitives";

// Placeholder case data
const cases = [
  { id: "case-1", name: "Case 1" },
  { id: "case-2", name: "Case 2" },
  { id: "case-3", name: "Case 3" },
];

export default function CaseManagementPage() {
  const router = useRouter();

  const handleCaseClick = (caseId: string) => {
    router.push(`/case-management/${caseId}`);
  };

  return (
    <div className="flex flex-col gap-6 w-[70vw]">
      <div>
        <h1 className={title()}>Case Management</h1>
        <p className="text-default-500 mt-2">
          Manage and view case studies for the AI Avatar system
        </p>
      </div>

      <Divider />

      {/* Cases Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cases.map((caseItem) => (
          <Card
            key={caseItem.id}
            isPressable
            className="aspect-square hover:scale-105 transition-transform cursor-pointer"
            onPress={() => handleCaseClick(caseItem.id)}
          >
            <CardBody className="flex flex-col items-center justify-center gap-4">
              <Briefcase className="w-12 h-12 text-primary" />
              <h3 className="text-xl font-semibold">{caseItem.name}</h3>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
