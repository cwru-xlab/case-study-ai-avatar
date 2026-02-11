"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Plus, RefreshCw } from "lucide-react";
import { title } from "@/components/primitives";
import CaseCard from "@/components/case-card";

// Hardcoded case study data
const casesData = [
  {
    id: "tech-startup-expansion",
    name: "Tech Startup Expansion",
    backgroundInfo: "A fast-growing software startup looking to expand into new markets. The company needs to decide between scaling vertically with new product features or expanding horizontally into adjacent markets. Key considerations include resource allocation, competitive positioning, and long-term sustainability.",
    avatarCount: 3,
  },
  {
    id: "retail-digital-transformation",
    name: "Retail Digital Transformation",
    backgroundInfo: "A traditional brick-and-mortar retail chain facing declining foot traffic and increased competition from e-commerce. The business must transform digitally while maintaining its physical presence and loyal customer base. Critical challenges include legacy systems, employee training, and customer experience consistency.",
    avatarCount: 4,
  },
  {
    id: "healthcare-operational-efficiency",
    name: "Healthcare Operational Efficiency",
    backgroundInfo: "A regional healthcare provider struggling with operational inefficiencies and rising costs. The organization needs to improve patient care quality while reducing wait times and administrative overhead. Key factors include regulatory compliance, staff burnout, and technology integration.",
    avatarCount: 2,
  },
  {
    id: "manufacturing-sustainability",
    name: "Manufacturing Sustainability Initiative",
    backgroundInfo: "A mid-sized manufacturing company seeking to implement sustainable practices without compromising profitability. The business faces pressure from customers, regulators, and investors to reduce environmental impact. Major concerns include supply chain transformation, capital investment, and competitive advantage.",
    avatarCount: 5,
  },
  {
    id: "fintech-market-entry",
    name: "FinTech Market Entry Strategy",
    backgroundInfo: "An established financial services firm considering entry into the fintech space through innovation or acquisition. The company must navigate regulatory requirements, technological disruption, and changing customer expectations. Strategic decisions involve build-vs-buy, partnerships, and timeline considerations.",
    avatarCount: 3,
  },
  {
    id: "education-hybrid-model",
    name: "Education Hybrid Learning Model",
    backgroundInfo: "A private educational institution developing a hybrid learning model combining online and in-person instruction. The school must balance educational quality, accessibility, and financial viability. Key challenges include technology infrastructure, faculty development, and student engagement.",
    avatarCount: 4,
  },
];

export default function CaseManagementPage() {
  const router = useRouter();
  const [cases, setCases] = useState(casesData);
  const [loading, setLoading] = useState(false);

  const handleCaseClick = (caseId: string) => {
    router.push(`/case-management/${caseId}`);
  };

  const handleSync = () => {
    setLoading(true);
    // Simulate sync operation
    setTimeout(() => {
      setCases([...casesData]);
      setLoading(false);
    }, 500);
  };

  const handleAddCase = () => {
    // Placeholder for add case functionality
    console.log("Add case clicked");
  };

  return (
    <div className="space-y-6">
      {/* Header with title and buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className={title()}>Case Management</h1>
        <div className="flex gap-2">
          <Button
            variant="bordered"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={handleSync}
            isLoading={loading}
            className="self-start sm:self-auto"
          >
            {loading ? "Syncing..." : "Sync"}
          </Button>
          <Button
            color="primary"
            variant="solid"
            startContent={<Plus className="w-4 h-4" />}
            onPress={handleAddCase}
            className="self-start sm:self-auto"
          >
            Add Case
          </Button>
        </div>
      </div>

      {/* Cases grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {cases.map((caseStudy) => (
          <CaseCard
            key={caseStudy.id}
            caseStudy={caseStudy}
            onClick={handleCaseClick}
          />
        ))}
      </div>

      {/* Empty state if no cases */}
      {cases.length === 0 && (
        <div className="text-center py-12">
          <p className="text-default-500 mb-4">No cases found</p>
          <Button
            color="primary"
            variant="bordered"
            startContent={<Plus className="w-4 h-4" />}
            onPress={handleAddCase}
          >
            Create your first case
          </Button>
        </div>
      )}
    </div>
  );
}
