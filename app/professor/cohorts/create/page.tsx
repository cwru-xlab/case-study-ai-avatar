"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Checkbox } from "@heroui/checkbox";
import { Select, SelectItem } from "@heroui/select";
import { Slider } from "@heroui/slider";
import { Chip } from "@heroui/chip";
import { Progress } from "@heroui/progress";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  DollarSign,
  Calendar,
  Users,
  Settings,
  Upload,
} from "lucide-react";
import { addToast } from "@heroui/toast";
import { title } from "@/components/primitives";
import { cohortStorage } from "@/lib/cohort-storage";
import type {
  CohortMode,
  EnabledModes,
  CohortStudent,
  CohortCreateInput,
} from "@/types/cohort";
import { PRICING, COHORT_MODE_LABELS, COHORT_MODE_DESCRIPTIONS } from "@/types/cohort";

const STEPS = [
  { id: 1, title: "Configure Budget", icon: DollarSign },
  { id: 2, title: "Set Timeline", icon: Calendar },
  { id: 3, title: "Add Students", icon: Users },
  { id: 4, title: "Cohort Mode", icon: Settings },
];

export default function CreateCohortPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Budget Configuration
  const [name, setName] = useState("");
  const [caseId, setCaseId] = useState("");
  const [budgetPerStudent, setBudgetPerStudent] = useState(10);
  const [enabledModes, setEnabledModes] = useState<EnabledModes>({
    video: true,
    voice: true,
    text: true,
  });
  const [bonusUnlock, setBonusUnlock] = useState(false);
  const [maxDays, setMaxDays] = useState(30);

  // Step 2: Timeline
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [latePenaltyRule, setLatePenaltyRule] = useState("");

  // Step 3: Students
  const [emailsText, setEmailsText] = useState("");
  const [students, setStudents] = useState<CohortStudent[]>([]);
  const [accessCode, setAccessCode] = useState("");
  const [joinLink, setJoinLink] = useState("");

  // Step 4: Mode
  const [cohortMode, setCohortMode] = useState<CohortMode>("practice");

  // Cases for selection
  const [cases, setCases] = useState<any[]>([]);

  // Generate access code on mount
  useEffect(() => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAccessCode(code);
    setJoinLink(`${window.location.origin}/join/${code}`);
  }, []);

  // Load cases
  useEffect(() => {
    fetch("/api/case")
      .then((res) => res.json())
      .then((data) => setCases(data))
      .catch(console.error);
  }, []);

  // Set default dates
  useEffect(() => {
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    setStartDate(today.toISOString().split("T")[0]);
    setEndDate(nextMonth.toISOString().split("T")[0]);
  }, []);

  // Parse emails from textarea
  const parseEmails = () => {
    const emails = emailsText
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && e.includes("@"));

    const uniqueEmails = [...new Set(emails)];
    const newStudents: CohortStudent[] = uniqueEmails.map((email) => ({
      email,
      status: "invited",
    }));

    setStudents(newStudents);
    return newStudents;
  };

  // Handle CSV upload
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n");
      const emails: string[] = [];

      lines.forEach((line) => {
        const parts = line.split(",");
        parts.forEach((part) => {
          const trimmed = part.trim().toLowerCase();
          if (trimmed.includes("@")) {
            emails.push(trimmed);
          }
        });
      });

      const uniqueEmails = [...new Set(emails)];
      setEmailsText(uniqueEmails.join("\n"));
      setStudents(
        uniqueEmails.map((email) => ({ email, status: "invited" }))
      );

      addToast({
        title: "CSV Imported",
        description: `Found ${uniqueEmails.length} email addresses`,
        color: "success",
      });
    };
    reader.readAsText(file);
  };

  // Copy join link
  const copyJoinLink = () => {
    navigator.clipboard.writeText(joinLink);
    addToast({
      title: "Copied",
      description: "Join link copied to clipboard",
      color: "success",
    });
  };

  // Validate current step
  const validateStep = (): boolean => {
    switch (currentStep) {
      case 1:
        if (!name.trim()) {
          addToast({
            title: "Validation Error",
            description: "Please enter a cohort name",
            color: "danger",
          });
          return false;
        }
        if (!caseId) {
          addToast({
            title: "Validation Error",
            description: "Please select a case",
            color: "danger",
          });
          return false;
        }
        if (!enabledModes.video && !enabledModes.voice && !enabledModes.text) {
          addToast({
            title: "Validation Error",
            description: "Please enable at least one interaction mode",
            color: "danger",
          });
          return false;
        }
        return true;

      case 2:
        if (!startDate || !endDate) {
          addToast({
            title: "Validation Error",
            description: "Please set start and end dates",
            color: "danger",
          });
          return false;
        }
        if (new Date(endDate) <= new Date(startDate)) {
          addToast({
            title: "Validation Error",
            description: "End date must be after start date",
            color: "danger",
          });
          return false;
        }
        return true;

      case 3:
        parseEmails();
        return true;

      case 4:
        return true;

      default:
        return true;
    }
  };

  // Navigate steps
  const nextStep = () => {
    if (validateStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Calculate estimated cost
  const calculateEstimatedCost = () => {
    const studentCount = students.length || 1;
    return studentCount * budgetPerStudent;
  };

  // Submit cohort
  const handleSubmit = async () => {
    if (!validateStep()) return;

    setSaving(true);

    try {
      const input: CohortCreateInput = {
        caseId,
        professorId: "current-user",
        name: name.trim(),
        budgetPerStudent,
        enabledModes,
        maxDays,
        startDate,
        endDate,
        students: parseEmails(),
        cohortMode,
        bonusUnlock: bonusUnlock || undefined,
        latePenaltyRule: latePenaltyRule.trim() || undefined,
      };

      await cohortStorage.add(input);

      addToast({
        title: "Success",
        description: "Cohort created successfully",
        color: "success",
      });

      router.push("/professor/cohorts");
    } catch (error) {
      console.error("Error creating cohort:", error);
      addToast({
        title: "Error",
        description: "Failed to create cohort",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="light"
          startContent={<ArrowLeft className="w-4 h-4" />}
          onPress={() => router.push("/professor/cohorts")}
        >
          Back
        </Button>
        <h1 className={title()}>Create Cohort</h1>
      </div>

      {/* Progress */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center ${
                  index < STEPS.length - 1 ? "flex-1" : ""
                }`}
              >
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    currentStep >= step.id
                      ? "bg-primary border-primary text-white"
                      : "border-default-300 text-default-400"
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={`ml-2 text-sm hidden sm:block ${
                    currentStep >= step.id
                      ? "text-foreground font-medium"
                      : "text-default-400"
                  }`}
                >
                  {step.title}
                </span>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-4 ${
                      currentStep > step.id ? "bg-primary" : "bg-default-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <Progress
            value={(currentStep / 4) * 100}
            color="primary"
            size="sm"
          />
        </CardBody>
      </Card>

      {/* Step Content */}
      <Card>
        <CardBody className="space-y-6">
          {/* Step 1: Configure Budget */}
          {currentStep === 1 && (
            <>
              <h2 className="text-xl font-semibold">Configure Budget</h2>

              <Input
                label="Cohort Name"
                placeholder="e.g., Fall 2024 MBA Section A"
                value={name}
                onValueChange={setName}
                isRequired
              />

              <Select
                label="Select Case"
                placeholder="Choose a case study"
                selectedKeys={caseId ? [caseId] : []}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  setCaseId(selected);
                }}
                isRequired
              >
                {cases.map((c) => (
                  <SelectItem key={c.id}>{c.name}</SelectItem>
                ))}
              </Select>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Budget per Student: ${budgetPerStudent}
                </label>
                <Slider
                  step={5}
                  minValue={5}
                  maxValue={100}
                  value={budgetPerStudent}
                  onChange={(value) =>
                    setBudgetPerStudent(value as number)
                  }
                  className="max-w-md"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-3 block">
                  Enabled Interaction Modes
                </label>
                <div className="space-y-3">
                  <Checkbox
                    isSelected={enabledModes.video}
                    onValueChange={(checked) =>
                      setEnabledModes({ ...enabledModes, video: checked })
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span>Video</span>
                      <Chip size="sm" variant="flat">
                        {PRICING.video.label}
                      </Chip>
                    </div>
                  </Checkbox>
                  <Checkbox
                    isSelected={enabledModes.voice}
                    onValueChange={(checked) =>
                      setEnabledModes({ ...enabledModes, voice: checked })
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span>Voice</span>
                      <Chip size="sm" variant="flat">
                        {PRICING.voice.label}
                      </Chip>
                    </div>
                  </Checkbox>
                  <Checkbox
                    isSelected={enabledModes.text}
                    onValueChange={(checked) =>
                      setEnabledModes({ ...enabledModes, text: checked })
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span>Text</span>
                      <Chip size="sm" variant="flat">
                        {PRICING.text.label}
                      </Chip>
                    </div>
                  </Checkbox>
                </div>
              </div>

              <Checkbox
                isSelected={bonusUnlock}
                onValueChange={setBonusUnlock}
              >
                Enable bonus unlock for high performers
              </Checkbox>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Max Days: {maxDays}
                </label>
                <Slider
                  step={1}
                  minValue={1}
                  maxValue={90}
                  value={maxDays}
                  onChange={(value) => setMaxDays(value as number)}
                  className="max-w-md"
                />
              </div>
            </>
          )}

          {/* Step 2: Set Timeline */}
          {currentStep === 2 && (
            <>
              <h2 className="text-xl font-semibold">Set Timeline</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="date"
                  label="Start Date"
                  value={startDate}
                  onValueChange={setStartDate}
                  isRequired
                />
                <Input
                  type="date"
                  label="End Date"
                  value={endDate}
                  onValueChange={setEndDate}
                  isRequired
                />
              </div>

              <Textarea
                label="Late Penalty Rule (Optional)"
                placeholder="e.g., 10% deduction per day late, max 3 days"
                value={latePenaltyRule}
                onValueChange={setLatePenaltyRule}
                minRows={2}
              />

              <Card className="bg-default-50">
                <CardBody>
                  <h3 className="font-medium mb-2">Timeline Summary</h3>
                  <p className="text-sm text-default-600">
                    Duration:{" "}
                    {startDate && endDate
                      ? Math.ceil(
                          (new Date(endDate).getTime() -
                            new Date(startDate).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )
                      : 0}{" "}
                    days
                  </p>
                  <p className="text-sm text-default-600">
                    Max interaction days per student: {maxDays}
                  </p>
                </CardBody>
              </Card>
            </>
          )}

          {/* Step 3: Add Students */}
          {currentStep === 3 && (
            <>
              <h2 className="text-xl font-semibold">Add Students</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Textarea
                    label="Student Emails"
                    placeholder="Enter email addresses (one per line, or comma-separated)"
                    value={emailsText}
                    onValueChange={(value) => {
                      setEmailsText(value);
                    }}
                    onBlur={parseEmails}
                    minRows={8}
                  />

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Or upload CSV
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Button
                        as="span"
                        variant="bordered"
                        startContent={<Upload className="w-4 h-4" />}
                      >
                        Upload CSV
                      </Button>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleCsvUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <Card className="bg-default-50">
                    <CardBody>
                      <h3 className="font-medium mb-2">Access Code</h3>
                      <div className="flex items-center gap-2">
                        <code className="text-2xl font-mono font-bold text-primary">
                          {accessCode}
                        </code>
                      </div>
                      <p className="text-sm text-default-500 mt-2">
                        Students can use this code to join the cohort
                      </p>
                    </CardBody>
                  </Card>

                  <Card className="bg-default-50">
                    <CardBody>
                      <h3 className="font-medium mb-2">Join Link</h3>
                      <div className="flex items-center gap-2">
                        <Input
                          value={joinLink}
                          isReadOnly
                          size="sm"
                          classNames={{
                            input: "text-xs",
                          }}
                        />
                        <Button
                          isIconOnly
                          variant="flat"
                          onPress={copyJoinLink}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardBody>
                  </Card>

                  <Card className="bg-default-50">
                    <CardBody>
                      <h3 className="font-medium mb-2">Students Added</h3>
                      <p className="text-3xl font-bold text-primary">
                        {students.length}
                      </p>
                      <p className="text-sm text-default-500">
                        Estimated cost: ${calculateEstimatedCost()}
                      </p>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </>
          )}

          {/* Step 4: Cohort Mode */}
          {currentStep === 4 && (
            <>
              <h2 className="text-xl font-semibold">Select Cohort Mode</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(
                  Object.keys(COHORT_MODE_LABELS) as CohortMode[]
                ).map((mode) => (
                  <Card
                    key={mode}
                    isPressable
                    onPress={() => setCohortMode(mode)}
                    className={`cursor-pointer transition-all ${
                      cohortMode === mode
                        ? "border-2 border-primary bg-primary/5"
                        : "border-2 border-transparent"
                    }`}
                  >
                    <CardBody>
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            cohortMode === mode
                              ? "border-primary bg-primary"
                              : "border-default-300"
                          }`}
                        >
                          {cohortMode === mode && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold">
                            {COHORT_MODE_LABELS[mode]}
                          </h3>
                          <p className="text-sm text-default-500 mt-1">
                            {COHORT_MODE_DESCRIPTIONS[mode]}
                          </p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>

              {/* Summary */}
              <Card className="bg-primary/5 border border-primary/20">
                <CardHeader>
                  <h3 className="font-semibold">Cohort Summary</h3>
                </CardHeader>
                <CardBody className="pt-0">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-default-500">Name:</span>
                      <p className="font-medium">{name}</p>
                    </div>
                    <div>
                      <span className="text-default-500">Access Code:</span>
                      <p className="font-medium font-mono">{accessCode}</p>
                    </div>
                    <div>
                      <span className="text-default-500">Budget:</span>
                      <p className="font-medium">${budgetPerStudent}/student</p>
                    </div>
                    <div>
                      <span className="text-default-500">Students:</span>
                      <p className="font-medium">{students.length}</p>
                    </div>
                    <div>
                      <span className="text-default-500">Timeline:</span>
                      <p className="font-medium">
                        {startDate} to {endDate}
                      </p>
                    </div>
                    <div>
                      <span className="text-default-500">Mode:</span>
                      <p className="font-medium">
                        {COHORT_MODE_LABELS[cohortMode]}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="flat"
              startContent={<ArrowLeft className="w-4 h-4" />}
              onPress={prevStep}
              isDisabled={currentStep === 1}
            >
              Previous
            </Button>

            {currentStep < 4 ? (
              <Button
                color="primary"
                endContent={<ArrowRight className="w-4 h-4" />}
                onPress={nextStep}
              >
                Next
              </Button>
            ) : (
              <Button
                color="primary"
                endContent={<Check className="w-4 h-4" />}
                onPress={handleSubmit}
                isLoading={saving}
              >
                Publish Cohort
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
