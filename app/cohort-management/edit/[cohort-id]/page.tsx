"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Checkbox } from "@heroui/checkbox";
import {
  ArrowLeft,
  Save,
  Trash2,
  Copy,
  Users,
  Calendar,
  Settings,
  Upload,
  Check,
} from "lucide-react";
import { addToast } from "@heroui/toast";
import { title as pageTitle } from "@/components/primitives";
import { cohortStorage } from "@/lib/cohort-storage";
import type {
  CohortMode,
  CohortStudent,
  CohortCreateInput,
  CachedCohort,
} from "@/types/cohort";
import { COHORT_MODE_LABELS, COHORT_MODE_DESCRIPTIONS } from "@/types/cohort";

export default function CohortEditPage() {
  const params = useParams();
  const router = useRouter();
  const cohortId = params["cohort-id"] as string;
  const isNew = cohortId === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [existing, setExisting] = useState<CachedCohort | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [caseId, setCaseId] = useState("");
  const [caseName, setCaseName] = useState("");
  const [maxDays, setMaxDays] = useState(30);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [emailsText, setEmailsText] = useState("");
  const [students, setStudents] = useState<CohortStudent[]>([]);
  const [accessCode, setAccessCode] = useState("");
  const [cohortMode, setCohortMode] = useState<CohortMode>("practice");
  const [isActive, setIsActive] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const joinLink = useMemo(() => {
    if (!accessCode) return "";
    if (typeof window !== "undefined") {
      return `${window.location.origin}/join/${accessCode}`;
    }
    return `/join/${accessCode}`;
  }, [accessCode]);

  // Generate access code on mount for new cohorts
  useEffect(() => {
    if (isNew && !accessCode) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setAccessCode(code);
    }
  }, [isNew, accessCode]);

  // Set default dates for new cohorts
  useEffect(() => {
    if (isNew && !startDate) {
      const today = new Date();
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setStartDate(today.toISOString().split("T")[0]);
      setEndDate(nextMonth.toISOString().split("T")[0]);
    }
  }, [isNew, startDate]);

  // Load existing cohort
  useEffect(() => {
    if (!isNew) {
      cohortStorage
        .get(cohortId)
        .then((cohort) => {
          if (cohort) {
            setExisting(cohort);
            setName(cohort.name);
            setDescription(cohort.description || "");
            setCaseId(cohort.caseId || "");
            setCaseName(cohort.caseName || "");
            setMaxDays(cohort.maxDays);
            setStartDate(cohort.startDate);
            setEndDate(cohort.endDate);
            setStudents(cohort.students || []);
            setAccessCode(cohort.accessCode);
            setCohortMode(cohort.cohortMode);
            setIsActive(cohort.isActive);
            setEmailsText(cohort.students?.map((s) => s.email).join("\n") || "");
          }
        })
        .catch((err) => {
          addToast({ title: "Error", description: err.message, color: "danger" });
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [cohortId, isNew]);

  const parseEmails = (): CohortStudent[] => {
    const emails = emailsText
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && e.includes("@"));

    const uniqueEmails = [...new Set(emails)];
    return uniqueEmails.map((email) => {
      const existingStudent = students.find((s) => s.email === email);
      return existingStudent || { email, status: "invited" as const };
    });
  };

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
      setStudents(uniqueEmails.map((email) => ({ email, status: "invited" })));

      addToast({
        title: "CSV Imported",
        description: `Found ${uniqueEmails.length} email addresses`,
        color: "success",
      });
    };
    reader.readAsText(file);
  };

  const copyToClipboard = (text: string, successMessage: string) => {
    if (!text) return;
    
    // Try modern clipboard API first
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        addToast({
          title: "Copied",
          description: successMessage,
          color: "success",
        });
      }).catch((err) => {
        console.error("Clipboard API failed:", err);
        fallbackCopy(text, successMessage);
      });
    } else {
      fallbackCopy(text, successMessage);
    }
  };

  const fallbackCopy = (text: string, successMessage: string) => {
    // Fallback for older browsers or non-HTTPS contexts
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand("copy");
      addToast({
        title: "Copied",
        description: successMessage,
        color: "success",
      });
    } catch (err) {
      console.error("Fallback copy failed:", err);
      addToast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        color: "danger",
      });
    }
    
    document.body.removeChild(textArea);
  };

  const copyJoinLink = () => {
    copyToClipboard(joinLink, "Join link copied to clipboard");
  };

  const copyAccessCode = () => {
    copyToClipboard(accessCode, "Access code copied to clipboard");
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Cohort name is required";
    if (!startDate) e.startDate = "Start date is required";
    if (!endDate) e.endDate = "End date is required";
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      e.endDate = "End date must be after start date";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    setErrors({});

    try {
      const parsedStudents = parseEmails();

      if (isNew) {
        const input: CohortCreateInput = {
          name: name.trim(),
          description: description.trim() || undefined,
          caseId: caseId || undefined,
          caseName: caseName || undefined,
          professorId: "current-user",
          professorName: "Current User",
          maxDays,
          startDate,
          endDate,
          students: parsedStudents,
          cohortMode,
        };

        await cohortStorage.add(input);
        addToast({ title: "Cohort created", color: "success" });
      } else {
        await cohortStorage.update(cohortId, {
          name: name.trim(),
          description: description.trim() || undefined,
          caseId: caseId || undefined,
          caseName: caseName || undefined,
          maxDays,
          startDate,
          endDate,
          students: parsedStudents,
          cohortMode,
          isActive,
        });
        addToast({ title: "Cohort saved", color: "success" });
      }

      router.push("/cohort-management");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setErrors({ save: msg });
      addToast({ title: "Save failed", description: msg, color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${existing.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await cohortStorage.delete(cohortId);
      addToast({ title: "Cohort deleted", color: "success" });
      router.push("/cohort-management");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      addToast({ title: "Delete failed", description: msg, color: "danger" });
    } finally {
      setDeleting(false);
    }
  };

  const handleBack = () => router.push("/cohort-management");

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <p className="text-default-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button isIconOnly variant="light" onPress={handleBack}>
          <ArrowLeft />
        </Button>
        <h1 className={pageTitle()}>
          {isNew ? "Create Cohort" : "Edit Cohort"}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Basic Information</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                isRequired
                errorMessage={errors.name}
                isInvalid={!!errors.name}
                label="Cohort Name"
                placeholder="e.g., Fall 2024 MBA Section A"
                value={name}
                onValueChange={setName}
              />
              <Textarea
                label="Description (optional)"
                placeholder="Brief description of this cohort"
                value={description}
                onValueChange={setDescription}
                minRows={2}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Case ID (optional)"
                  placeholder="e.g., tech-startup-expansion"
                  value={caseId}
                  onValueChange={setCaseId}
                />
                <Input
                  label="Case Name (optional)"
                  placeholder="e.g., Tech Startup Expansion"
                  value={caseName}
                  onValueChange={setCaseName}
                />
              </div>
              <Input
                type="number"
                label="Max Days"
                description="Maximum number of days students can interact"
                value={String(maxDays)}
                onValueChange={(v) => setMaxDays(parseInt(v) || 30)}
                min={1}
                max={365}
              />
            </CardBody>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <h2 className="text-xl font-semibold">Timeline</h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="date"
                  label="Start Date"
                  value={startDate}
                  onValueChange={setStartDate}
                  isRequired
                  errorMessage={errors.startDate}
                  isInvalid={!!errors.startDate}
                />
                <Input
                  type="date"
                  label="End Date"
                  value={endDate}
                  onValueChange={setEndDate}
                  isRequired
                  errorMessage={errors.endDate}
                  isInvalid={!!errors.endDate}
                />
              </div>
            </CardBody>
          </Card>

          {/* Students */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <h2 className="text-xl font-semibold">Students</h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <Textarea
                label="Student Emails"
                placeholder="Enter email addresses (one per line, or comma-separated)"
                value={emailsText}
                onValueChange={setEmailsText}
                onBlur={() => setStudents(parseEmails())}
                minRows={6}
              />
              <div className="flex items-center gap-4">
                <label className="cursor-pointer">
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
                <span className="text-sm text-default-500">
                  {students.length} student{students.length !== 1 ? "s" : ""} added
                </span>
              </div>
            </CardBody>
          </Card>

          {/* Cohort Mode */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                <h2 className="text-xl font-semibold">Cohort Mode</h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(Object.keys(COHORT_MODE_LABELS) as CohortMode[]).map((mode) => (
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

              {!isNew && (
                <Checkbox isSelected={isActive} onValueChange={setIsActive}>
                  Cohort is active
                </Checkbox>
              )}
            </CardBody>
          </Card>

          {errors.save && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded text-danger-700 text-sm">
              {errors.save}
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <Button
              color="primary"
              isDisabled={!name.trim()}
              isLoading={saving}
              startContent={!saving ? <Save className="w-4 h-4" /> : null}
              onPress={handleSave}
            >
              {saving ? "Saving..." : isNew ? "Create Cohort" : "Save"}
            </Button>
            <Button variant="bordered" onPress={handleBack}>
              Cancel
            </Button>
            {!isNew && existing && (
              <Button
                color="danger"
                variant="flat"
                isLoading={deleting}
                startContent={!deleting ? <Trash2 className="w-4 h-4" /> : null}
                onPress={handleDelete}
              >
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Access Code Card */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Access Code</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="text-center">
                <code className="text-3xl font-mono font-bold text-primary">
                  {accessCode}
                </code>
              </div>
              <Button
                fullWidth
                variant="bordered"
                startContent={<Copy className="w-4 h-4" />}
                onPress={copyAccessCode}
              >
                Copy Code
              </Button>
              <p className="text-sm text-default-500 text-center">
                Students use this code to join the cohort
              </p>
            </CardBody>
          </Card>

          {/* Join Link Card */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Join Link</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input value={joinLink} isReadOnly size="sm" />
              <Button
                fullWidth
                variant="bordered"
                startContent={<Copy className="w-4 h-4" />}
                onPress={copyJoinLink}
              >
                Copy Link
              </Button>
              <p className="text-sm text-default-500 text-center">
                Share this link with students to join
              </p>
            </CardBody>
          </Card>

          {/* Summary Card */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Summary</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-default-500">Students:</span>
                <span className="font-medium">{students.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-default-500">Duration:</span>
                <span className="font-medium">
                  {startDate && endDate
                    ? Math.ceil(
                        (new Date(endDate).getTime() -
                          new Date(startDate).getTime()) /
                          (1000 * 60 * 60 * 24)
                      )
                    : 0}{" "}
                  days
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-default-500">Max Days:</span>
                <span className="font-medium">{maxDays}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-default-500">Mode:</span>
                <span className="font-medium">
                  {COHORT_MODE_LABELS[cohortMode]}
                </span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
