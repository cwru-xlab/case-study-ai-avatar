"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { ArrowLeft, Plus, Save, X } from "lucide-react";
import { title as pageTitle } from "@/components/primitives";

// Hardcoded case data with avatars
const casesData: Record<
  string,
  {
    id: string;
    name: string;
    backgroundInfo: string;
    avatars: Array<{
      id: string;
      name: string;
      role: string;
      additionalInfo: string;
    }>;
  }
> = {
  "tech-startup-expansion": {
    id: "tech-startup-expansion",
    name: "Tech Startup Expansion",
    backgroundInfo:
      "A fast-growing software startup looking to expand into new markets. The company needs to decide between scaling vertically with new product features or expanding horizontally into adjacent markets. Key considerations include resource allocation, competitive positioning, and long-term sustainability.",
    avatars: [
      {
        id: "avatar-1",
        name: "Sarah Chen - CEO",
        role: "Chief Executive Officer",
        additionalInfo:
          "Visionary leader with 15 years of experience in tech startups. Previously founded and sold two successful companies. Known for bold decision-making and strong focus on company culture.",
      },
      {
        id: "avatar-2",
        name: "Marcus Rodriguez - CFO",
        role: "Chief Financial Officer",
        additionalInfo:
          "Conservative financial strategist with deep expertise in venture capital and IPO preparations. Advocates for sustainable growth and careful cash management.",
      },
      {
        id: "avatar-3",
        name: "Dr. Emily Watson - CTO",
        role: "Chief Technology Officer",
        additionalInfo:
          "Technical innovator with PhD in Computer Science. Passionate about product excellence and engineering best practices. Concerned about technical debt from rapid growth.",
      },
    ],
  },
  "retail-digital-transformation": {
    id: "retail-digital-transformation",
    name: "Retail Digital Transformation",
    backgroundInfo:
      "A traditional brick-and-mortar retail chain facing declining foot traffic and increased competition from e-commerce. The business must transform digitally while maintaining its physical presence and loyal customer base. Critical challenges include legacy systems, employee training, and customer experience consistency.",
    avatars: [
      {
        id: "avatar-4",
        name: "James Mitchell - CEO",
        role: "Chief Executive Officer",
        additionalInfo:
          "Third-generation leader of the family business. Balances tradition with innovation, deeply committed to employee welfare and community roots.",
      },
      {
        id: "avatar-5",
        name: "Priya Patel - Chief Digital Officer",
        role: "Chief Digital Officer",
        additionalInfo:
          "E-commerce veteran hired to lead digital transformation. Brings experience from major online retailers but learning the unique challenges of physical retail.",
      },
      {
        id: "avatar-6",
        name: "Robert Hayes - VP Operations",
        role: "VP of Operations",
        additionalInfo:
          "30-year veteran of the company with deep knowledge of store operations and staff relationships. Skeptical of rapid change but open to necessary evolution.",
      },
      {
        id: "avatar-7",
        name: "Lisa Thompson - Customer Experience Director",
        role: "Customer Experience Director",
        additionalInfo:
          "Former consultant specializing in omnichannel retail experiences. Focused on creating seamless integration between online and offline touchpoints.",
      },
    ],
  },
  "healthcare-operational-efficiency": {
    id: "healthcare-operational-efficiency",
    name: "Healthcare Operational Efficiency",
    backgroundInfo:
      "A regional healthcare provider struggling with operational inefficiencies and rising costs. The organization needs to improve patient care quality while reducing wait times and administrative overhead. Key factors include regulatory compliance, staff burnout, and technology integration.",
    avatars: [
      {
        id: "avatar-8",
        name: "Dr. Michael Chang - Medical Director",
        role: "Medical Director",
        additionalInfo:
          "Experienced physician-administrator focused on patient outcomes. Concerned about maintaining care quality while improving efficiency.",
      },
      {
        id: "avatar-9",
        name: "Jennifer Brooks - COO",
        role: "Chief Operating Officer",
        additionalInfo:
          "Healthcare operations expert with background in process improvement and lean management. Advocates for systematic approach to efficiency gains.",
      },
    ],
  },
  "manufacturing-sustainability": {
    id: "manufacturing-sustainability",
    name: "Manufacturing Sustainability Initiative",
    backgroundInfo:
      "A mid-sized manufacturing company seeking to implement sustainable practices without compromising profitability. The business faces pressure from customers, regulators, and investors to reduce environmental impact. Major concerns include supply chain transformation, capital investment, and competitive advantage.",
    avatars: [
      {
        id: "avatar-10",
        name: "David Anderson - CEO",
        role: "Chief Executive Officer",
        additionalInfo:
          "Pragmatic leader balancing sustainability goals with financial realities. Believes in green practices as a competitive advantage, not just compliance.",
      },
      {
        id: "avatar-11",
        name: "Maria Santos - Sustainability Director",
        role: "Sustainability Director",
        additionalInfo:
          "Environmental engineer passionate about reducing industrial carbon footprint. Sometimes clashes with finance over investment priorities.",
      },
      {
        id: "avatar-12",
        name: "Thomas Klein - VP Manufacturing",
        role: "VP of Manufacturing",
        additionalInfo:
          "Operations-focused executive concerned about production disruptions during transition. Values practical, incremental changes over dramatic shifts.",
      },
      {
        id: "avatar-13",
        name: "Rachel Foster - CFO",
        role: "Chief Financial Officer",
        additionalInfo:
          "Financial guardian ensuring sustainability investments deliver ROI. Supports green initiatives that make business sense.",
      },
      {
        id: "avatar-14",
        name: "Kevin Park - Supply Chain Director",
        role: "Supply Chain Director",
        additionalInfo:
          "Logistics expert managing complex supplier relationships. Navigating the challenge of transforming supply chain to meet sustainability goals.",
      },
    ],
  },
  "fintech-market-entry": {
    id: "fintech-market-entry",
    name: "FinTech Market Entry Strategy",
    backgroundInfo:
      "An established financial services firm considering entry into the fintech space through innovation or acquisition. The company must navigate regulatory requirements, technological disruption, and changing customer expectations. Strategic decisions involve build-vs-buy, partnerships, and timeline considerations.",
    avatars: [
      {
        id: "avatar-15",
        name: "Victoria Grant - CEO",
        role: "Chief Executive Officer",
        additionalInfo:
          "Traditional banking executive recognizing need for digital transformation. Cautious about disrupting existing profitable business lines.",
      },
      {
        id: "avatar-16",
        name: "Alex Kim - Chief Innovation Officer",
        role: "Chief Innovation Officer",
        additionalInfo:
          "Former fintech entrepreneur brought in to drive innovation. Advocates for aggressive market entry and acquisition strategy.",
      },
      {
        id: "avatar-17",
        name: "Patricia Monroe - Chief Compliance Officer",
        role: "Chief Compliance Officer",
        additionalInfo:
          "Regulatory expert ensuring any fintech initiatives meet strict financial services compliance requirements. Often seen as roadblock but protecting firm from risks.",
      },
    ],
  },
  "education-hybrid-model": {
    id: "education-hybrid-model",
    name: "Education Hybrid Learning Model",
    backgroundInfo:
      "A private educational institution developing a hybrid learning model combining online and in-person instruction. The school must balance educational quality, accessibility, and financial viability. Key challenges include technology infrastructure, faculty development, and student engagement.",
    avatars: [
      {
        id: "avatar-18",
        name: "Dr. Helen Morrison - Principal",
        role: "School Principal",
        additionalInfo:
          "Veteran educator committed to academic excellence. Concerned about maintaining educational standards in hybrid environment.",
      },
      {
        id: "avatar-19",
        name: "Nathan Cooper - Technology Director",
        role: "Technology Director",
        additionalInfo:
          "EdTech specialist excited about possibilities of hybrid learning. Sometimes underestimates pedagogical challenges of technology integration.",
      },
      {
        id: "avatar-20",
        name: "Amanda Lewis - Faculty Representative",
        role: "Faculty Representative",
        additionalInfo:
          "Experienced teacher representing faculty concerns about workload, training needs, and student interaction in hybrid model.",
      },
      {
        id: "avatar-21",
        name: "Brian Foster - Finance Director",
        role: "Finance Director",
        additionalInfo:
          "Managing tight education budgets while funding necessary technology investments. Seeking financially sustainable hybrid model.",
      },
    ],
  },
};

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.caseId as string;

  const [caseData, setCaseData] = useState(casesData[caseId]);

  const handleBack = () => {
    router.push("/case-management");
  };

  const handleAddAvatar = () => {
    console.log("Add avatar clicked - functionality not implemented");
  };

  const handleSave = () => {
    console.log("Save clicked - functionality not implemented");
  };

  const updateAvatarInfo = (avatarId: string, newInfo: string) => {
    if (!caseData) return;

    const updatedAvatars = caseData.avatars.map((avatar) =>
      avatar.id === avatarId ? { ...avatar, additionalInfo: newInfo } : avatar
    );

    setCaseData({ ...caseData, avatars: updatedAvatars });
  };

  if (!caseData) {
    return (
      <div className="flex flex-col gap-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-4">
          <Button isIconOnly variant="light" onPress={handleBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className={pageTitle()}>Case Not Found</h1>
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
    <div className="w-full px-4 md:px-8 lg:px-12 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          isIconOnly
          className="min-w-0"
          variant="light"
          onPress={handleBack}
        >
          <ArrowLeft />
        </Button>
        <h1 className={pageTitle()}>Edit Case Study</h1>
      </div>

      {/* Main Form */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Case Details</h2>
        </CardHeader>
        <CardBody className="space-y-6">
              {/* Case Name */}
              <div>
                <Input
                  isRequired
                  label="Case Name"
                  placeholder="Enter case study name"
                  value={caseData.name}
                  onValueChange={(value) =>
                    setCaseData({ ...caseData, name: value })
                  }
                />
              </div>

              {/* Case ID */}
              <div>
                <Input
                  isReadOnly
                  classNames={{
                    input: "font-mono",
                  }}
                  description="Case ID is permanent and cannot be changed"
                  label="Case ID"
                  value={caseData.id}
                />
              </div>

              {/* Background Info */}
              <div>
                <Textarea
                  isRequired
                  description="Provide detailed background information about this case study"
                  label="Background Information"
                  maxRows={50}
                  minRows={6}
                  placeholder="Enter background information..."
                  value={caseData.backgroundInfo}
                  onValueChange={(value) =>
                    setCaseData({ ...caseData, backgroundInfo: value })
                  }
                />
              </div>

              {/* Avatars Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Case Avatars</h3>
                    <p className="text-sm text-default-500">
                      Manage avatars associated with this case study
                    </p>
                  </div>
                  <Button
                    color="primary"
                    size="sm"
                    startContent={<Plus className="w-4 h-4" />}
                    variant="bordered"
                    onPress={handleAddAvatar}
                  >
                    Add Avatar
                  </Button>
                </div>

                {caseData.avatars.length === 0 && (
                  <div className="text-center py-8 text-default-400">
                    <p>No avatars associated with this case</p>
                    <p className="text-sm">
                      Click &quot;Add Avatar&quot; to add your first avatar
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {caseData.avatars.map((avatar) => (
                    <Card key={avatar.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-lg">
                              {avatar.name}
                            </h4>
                            <p className="text-sm text-default-500">
                              {avatar.role}
                            </p>
                          </div>
                          <Button
                            isIconOnly
                            color="danger"
                            size="sm"
                            variant="light"
                            onPress={() => {
                              console.log("Remove avatar:", avatar.id);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Additional Background Information
                          </label>
                          <Textarea
                            placeholder="Add specific context or background for this avatar in this case..."
                            maxRows={8}
                            minRows={3}
                            value={avatar.additionalInfo}
                            onValueChange={(value) =>
                              updateAvatarInfo(avatar.id, value)
                            }
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 flex-wrap">
                <Button
                  color="primary"
                  startContent={<Save className="w-4 h-4" />}
                  onPress={handleSave}
                >
                  Save Changes
                </Button>

                <Button variant="bordered" onPress={handleBack}>
                  Cancel
                </Button>
              </div>
            </CardBody>
          </Card>

      {/* Sidebar Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Case Summary */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Case Summary</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div>
              <p className="text-sm font-medium">Case Name:</p>
              <p className="text-sm text-default-600">{caseData.name}</p>
            </div>

            <div>
              <p className="text-sm font-medium">Case ID:</p>
              <p className="text-sm text-default-600 font-mono">
                {caseData.id}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium">Number of Avatars:</p>
              <p className="text-sm text-default-600">
                {caseData.avatars.length}
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Quick Actions</h3>
          </CardHeader>
          <CardBody className="space-y-2">
            <Button
              fullWidth
              color="secondary"
              variant="flat"
              onPress={() => console.log("Preview case")}
            >
              Preview Case
            </Button>
            <Button
              fullWidth
              color="default"
              variant="flat"
              onPress={() => console.log("Export case")}
            >
              Export Case
            </Button>
            <Button
              fullWidth
              color="danger"
              variant="flat"
              onPress={() => console.log("Delete case")}
            >
              Delete Case
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
