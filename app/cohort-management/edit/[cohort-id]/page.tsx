"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Checkbox } from "@heroui/checkbox";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import {
  ArrowLeft,
  Save,
  Trash2,
  Copy,
  Users,
  Calendar,
  Upload,
  Check,
  Link as LinkIcon,
  BookOpen,
  Plus,
  X,
} from "lucide-react";
import { Chip } from "@heroui/chip";
import { addToast } from "@heroui/toast";
import { title as pageTitle } from "@/components/primitives";
import { cohortStorage } from "@/lib/cohort-storage";
import { caseStorage } from "@/lib/case-storage";
import type {
  AccessMode,
  CohortStudent,
  CohortCreateInput,
  CachedCohort,
} from "@/types/cohort";
import { ACCESS_MODE_LABELS } from "@/types/cohort";
import type { CaseStudy } from "@/types";

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
  const [availableDate, setAvailableDate] = useState<string | null>(null); // null = Now
  const [expirationDate, setExpirationDate] = useState<string | null>(null); // null = Never
  const [availableNow, setAvailableNow] = useState(true);
  const [neverExpires, setNeverExpires] = useState(true);
  const [emailsText, setEmailsText] = useState("");
  const [students, setStudents] = useState<CohortStudent[]>([]);
  const [accessMode, setAccessMode] = useState<AccessMode>("anyone");
  const [isActive, setIsActive] = useState(true);

  // Case assignment state (following Alfred's schema pattern)
  const [availableCases, setAvailableCases] = useState<CaseStudy[]>([]);
  const [assignedCaseIds, setAssignedCaseIds] = useState<string[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);

  // Modal state for showing access code after creation
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdAccessCode, setCreatedAccessCode] = useState("");
  const [createdJoinLink, setCreatedJoinLink] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});

  // For existing cohorts, compute join link
  const joinLink = useMemo(() => {
    if (!existing?.accessCode) return "";
    if (typeof window !== "undefined") {
      return `${window.location.origin}/join/${existing.accessCode}`;
    }
    return `/join/${existing.accessCode}`;
  }, [existing?.accessCode]);

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
            setAccessMode(cohort.accessMode);
            setIsActive(cohort.isActive);
            setStudents(cohort.students || []);
            setEmailsText(cohort.students?.map((s) => s.email).join("\n") || "");
            setAssignedCaseIds(cohort.assignedCaseIds || []);

            // Handle available date
            if (cohort.availableDate) {
              setAvailableNow(false);
              setAvailableDate(cohort.availableDate);
            } else {
              setAvailableNow(true);
              setAvailableDate(null);
            }

            // Handle expiration date
            if (cohort.expirationDate) {
              setNeverExpires(false);
              setExpirationDate(cohort.expirationDate);
            } else {
              setNeverExpires(true);
              setExpirationDate(null);
            }
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

  // Load available cases
  useEffect(() => {
    caseStorage
      .list()
      .then((cases) => {
        setAvailableCases(cases);
      })
      .catch((err) => {
        console.error("Failed to load cases:", err);
      })
      .finally(() => setLoadingCases(false));
  }, []);

  const toggleCaseAssignment = (caseId: string) => {
    setAssignedCaseIds((prev) =>
      prev.includes(caseId)
        ? prev.filter((id) => id !== caseId)
        : [...prev, caseId]
    );
  };

  const getAssignedCases = () => {
    return availableCases.filter((c) => assignedCaseIds.includes(c.id));
  };

  const getUnassignedCases = () => {
    return availableCases.filter((c) => !assignedCaseIds.includes(c.id));
  };

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

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          addToast({
            title: "Copied",
            description: successMessage,
            color: "success",
          });
        })
        .catch((err) => {
          console.error("Clipboard API failed:", err);
          fallbackCopy(text, successMessage);
        });
    } else {
      fallbackCopy(text, successMessage);
    }
  };

  const fallbackCopy = (text: string, successMessage: string) => {
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

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Cohort name is required";

    if (!availableNow && !availableDate) {
      e.availableDate = "Please select an available date or check 'Available Now'";
    }

    if (!neverExpires && !expirationDate) {
      e.expirationDate = "Please select an expiration date or check 'Never Expires'";
    }

    if (!neverExpires && !availableNow && availableDate && expirationDate) {
      if (new Date(expirationDate) <= new Date(availableDate)) {
        e.expirationDate = "Expiration date must be after available date";
      }
    }

    if (accessMode === "specific" && parseEmails().length === 0) {
      e.emails = "Please add at least one learner email for restricted access mode";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    setErrors({});

    try {
      const parsedStudents = accessMode === "specific" ? parseEmails() : [];

      if (isNew) {
        const input: CohortCreateInput = {
          name: name.trim(),
          description: description.trim() || undefined,
          professorId: "current-user",
          professorName: "Current User",
          accessMode,
          availableDate: availableNow ? null : availableDate,
          expirationDate: neverExpires ? null : expirationDate,
          assignedCaseIds,
          students: parsedStudents,
        };

        const created = await cohortStorage.add(input);

        // Show success modal with access code
        const link =
          typeof window !== "undefined"
            ? `${window.location.origin}/join/${created.accessCode}`
            : `/join/${created.accessCode}`;
        setCreatedAccessCode(created.accessCode);
        setCreatedJoinLink(link);
        setShowSuccessModal(true);
      } else {
        await cohortStorage.update(cohortId, {
          name: name.trim(),
          description: description.trim() || undefined,
          accessMode,
          availableDate: availableNow ? null : availableDate,
          expirationDate: neverExpires ? null : expirationDate,
          assignedCaseIds,
          students: parsedStudents,
          isActive,
        });
        addToast({ title: "Cohort saved", color: "success" });
        router.push("/cohort-management");
      }
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

  const handleModalClose = () => {
    setShowSuccessModal(false);
    router.push("/cohort-management");
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-default-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button isIconOnly variant="light" onPress={handleBack}>
          <ArrowLeft />
        </Button>
        <h1 className={pageTitle()}>
          {isNew ? "Create Cohort" : "Edit Cohort"}
        </h1>
      </div>

      <div className="space-y-6">
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
          <CardBody className="space-y-6">
            {/* Available Date */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Available Date</label>
                <Checkbox
                  isSelected={availableNow}
                  onValueChange={(checked) => {
                    setAvailableNow(checked);
                    if (checked) setAvailableDate(null);
                  }}
                >
                  Available Now
                </Checkbox>
              </div>
              {!availableNow && (
                <Input
                  type="date"
                  label="Select available date"
                  value={availableDate || ""}
                  onValueChange={setAvailableDate}
                  errorMessage={errors.availableDate}
                  isInvalid={!!errors.availableDate}
                />
              )}
              <p className="text-xs text-default-400">
                When learners can start accessing this cohort
              </p>
            </div>

            {/* Expiration Date */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Expiration Date</label>
                <Checkbox
                  isSelected={neverExpires}
                  onValueChange={(checked) => {
                    setNeverExpires(checked);
                    if (checked) setExpirationDate(null);
                  }}
                >
                  Never Expires
                </Checkbox>
              </div>
              {!neverExpires && (
                <Input
                  type="date"
                  label="Select expiration date"
                  value={expirationDate || ""}
                  onValueChange={setExpirationDate}
                  errorMessage={errors.expirationDate}
                  isInvalid={!!errors.expirationDate}
                />
              )}
              <p className="text-xs text-default-400">
                When learners will lose access to this cohort
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Learners */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <h2 className="text-xl font-semibold">Learners</h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {/* Access Mode Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Access Mode</label>
              <div className="space-y-2">
                {(Object.keys(ACCESS_MODE_LABELS) as AccessMode[]).map(
                  (mode) => (
                    <div
                      key={mode}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        accessMode === mode
                          ? "border-primary bg-primary/5"
                          : "border-default-200 hover:border-default-300"
                      }`}
                      onClick={() => setAccessMode(mode)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            accessMode === mode
                              ? "border-primary bg-primary"
                              : "border-default-300"
                          }`}
                        >
                          {accessMode === mode && (
                            <Check className="w-2.5 h-2.5 text-white" />
                          )}
                        </div>
                        <span className="text-sm">
                          {ACCESS_MODE_LABELS[mode]}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Email input - only enabled for specific learners mode */}
            {accessMode === "specific" && (
              <div className="space-y-4 pt-4 border-t">
                <Textarea
                  label="Learner Emails"
                  placeholder="Enter email addresses (one per line, or comma-separated)"
                  value={emailsText}
                  onValueChange={setEmailsText}
                  onBlur={() => setStudents(parseEmails())}
                  minRows={6}
                  errorMessage={errors.emails}
                  isInvalid={!!errors.emails}
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
                    {students.length} learner{students.length !== 1 ? "s" : ""}{" "}
                    added
                  </span>
                </div>
              </div>
            )}

            {accessMode === "anyone" && (
              <p className="text-sm text-default-500 pt-2">
                Anyone with the access code will be able to join this cohort.
                You&apos;ll receive the access code after creating the cohort.
              </p>
            )}
          </CardBody>
        </Card>

        {/* Case Assignment - Following Alfred's schema pattern */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              <h2 className="text-xl font-semibold">Assigned Cases</h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-default-500">
              Select which case studies learners in this cohort will have access to.
            </p>

            {loadingCases ? (
              <p className="text-default-400 text-sm">Loading cases...</p>
            ) : availableCases.length === 0 ? (
              <div className="text-center py-6 text-default-400">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No cases available</p>
                <p className="text-xs mt-1">Create cases in Case Management first</p>
              </div>
            ) : (
              <>
                {/* Assigned Cases */}
                {assignedCaseIds.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-default-700">
                      Assigned ({assignedCaseIds.length})
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {getAssignedCases().map((caseItem) => (
                        <Chip
                          key={caseItem.id}
                          color="primary"
                          variant="flat"
                          onClose={() => toggleCaseAssignment(caseItem.id)}
                          classNames={{
                            base: "max-w-full",
                            content: "truncate",
                          }}
                        >
                          {caseItem.name}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}

                {/* Available Cases to Add */}
                {getUnassignedCases().length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <label className="text-sm font-medium text-default-700">
                      Available Cases
                    </label>
                    <div className="grid gap-2">
                      {getUnassignedCases().map((caseItem) => (
                        <div
                          key={caseItem.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-default-200 hover:border-primary hover:bg-primary/5 cursor-pointer transition-all"
                          onClick={() => toggleCaseAssignment(caseItem.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {caseItem.name}
                            </p>
                            {caseItem.avatars && caseItem.avatars.length > 0 && (
                              <p className="text-xs text-default-400">
                                {caseItem.avatars.length} avatar{caseItem.avatars.length !== 1 ? "s" : ""}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="light"
                            color="primary"
                            isIconOnly
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {assignedCaseIds.length === 0 && (
                  <p className="text-sm text-warning-600 bg-warning-50 p-3 rounded-lg">
                    No cases assigned. Learners won&apos;t see any case studies until you assign at least one.
                  </p>
                )}
              </>
            )}
          </CardBody>
        </Card>

        {/* Existing cohort: Show access code and active status */}
        {!isNew && existing && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5" />
                <h2 className="text-xl font-semibold">Access</h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-default-100 rounded-lg">
                <div>
                  <p className="text-sm text-default-500">Access Code</p>
                  <code className="text-2xl font-mono font-bold text-primary">
                    {existing.accessCode}
                  </code>
                </div>
                <Button
                  variant="bordered"
                  size="sm"
                  startContent={<Copy className="w-4 h-4" />}
                  onPress={() =>
                    copyToClipboard(
                      existing.accessCode,
                      "Access code copied to clipboard"
                    )
                  }
                >
                  Copy
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-default-100 rounded-lg">
                <div className="flex-1 mr-4">
                  <p className="text-sm text-default-500">Join Link</p>
                  <p className="text-sm font-mono truncate">{joinLink}</p>
                </div>
                <Button
                  variant="bordered"
                  size="sm"
                  startContent={<Copy className="w-4 h-4" />}
                  onPress={() =>
                    copyToClipboard(joinLink, "Join link copied to clipboard")
                  }
                >
                  Copy
                </Button>
              </div>

              <Checkbox isSelected={isActive} onValueChange={setIsActive}>
                Cohort is active
              </Checkbox>
            </CardBody>
          </Card>
        )}

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
            {saving ? "Saving..." : isNew ? "Create Cohort" : "Save Changes"}
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

      {/* Success Modal - shown after creating a new cohort */}
      <Modal isOpen={showSuccessModal} onClose={handleModalClose} size="md">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Check className="w-6 h-6 text-success" />
              <span>Cohort Created!</span>
            </div>
          </ModalHeader>
          <ModalBody className="space-y-4">
            <p className="text-default-600">
              Your cohort <strong>{name}</strong> has been created successfully.
              Share the access code or link with your learners.
            </p>

            <div className="p-4 bg-default-100 rounded-lg text-center">
              <p className="text-sm text-default-500 mb-2">Access Code</p>
              <code className="text-3xl font-mono font-bold text-primary">
                {createdAccessCode}
              </code>
            </div>

            <div className="flex gap-2">
              <Button
                fullWidth
                variant="bordered"
                startContent={<Copy className="w-4 h-4" />}
                onPress={() =>
                  copyToClipboard(
                    createdAccessCode,
                    "Access code copied to clipboard"
                  )
                }
              >
                Copy Code
              </Button>
              <Button
                fullWidth
                variant="bordered"
                startContent={<LinkIcon className="w-4 h-4" />}
                onPress={() =>
                  copyToClipboard(
                    createdJoinLink,
                    "Join link copied to clipboard"
                  )
                }
              >
                Copy Link
              </Button>
            </div>

            <div className="p-3 bg-default-50 rounded-lg">
              <p className="text-xs text-default-500 break-all">
                {createdJoinLink}
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onPress={handleModalClose}>
              Done
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
