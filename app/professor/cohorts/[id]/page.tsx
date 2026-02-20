"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Checkbox } from "@heroui/checkbox";
import { Slider } from "@heroui/slider";
import { Divider } from "@heroui/divider";
import {
  ArrowLeft,
  Save,
  Trash2,
  Copy,
  Users,
  Calendar,
  DollarSign,
  Settings,
  Plus,
  X,
  RefreshCw,
} from "lucide-react";
import { addToast } from "@heroui/toast";
import { title } from "@/components/primitives";
import { cohortStorage } from "@/lib/cohort-storage";
import type { CachedCohort, CohortMode, EnabledModes } from "@/types/cohort";
import { COHORT_MODE_LABELS, PRICING } from "@/types/cohort";

export default function CohortDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cohortId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cohort, setCohort] = useState<CachedCohort | null>(null);

  // Editable fields
  const [name, setName] = useState("");
  const [budgetPerStudent, setBudgetPerStudent] = useState(10);
  const [enabledModes, setEnabledModes] = useState<EnabledModes>({
    video: true,
    voice: true,
    text: true,
  });
  const [maxDays, setMaxDays] = useState(30);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [latePenaltyRule, setLatePenaltyRule] = useState("");
  const [cohortMode, setCohortMode] = useState<CohortMode>("practice");
  const [bonusUnlock, setBonusUnlock] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    loadCohort();
  }, [cohortId]);

  const loadCohort = async () => {
    try {
      const data = await cohortStorage.get(cohortId);
      if (!data) {
        addToast({
          title: "Error",
          description: "Cohort not found",
          color: "danger",
        });
        router.push("/professor/cohorts");
        return;
      }

      setCohort(data);
      setName(data.name);
      setBudgetPerStudent(data.budgetPerStudent);
      setEnabledModes(data.enabledModes);
      setMaxDays(data.maxDays);
      setStartDate(data.startDate);
      setEndDate(data.endDate);
      setLatePenaltyRule(data.latePenaltyRule || "");
      setCohortMode(data.cohortMode);
      setBonusUnlock(data.bonusUnlock || false);
    } catch (error) {
      console.error("Error loading cohort:", error);
      addToast({
        title: "Error",
        description: "Failed to load cohort",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!cohort) return;

    setSaving(true);

    try {
      await cohortStorage.updateLocal(cohortId, {
        name,
        budgetPerStudent,
        enabledModes,
        maxDays,
        startDate,
        endDate,
        latePenaltyRule: latePenaltyRule || undefined,
        cohortMode,
        bonusUnlock: bonusUnlock || undefined,
      });

      await cohortStorage.save(cohortId);

      addToast({
        title: "Success",
        description: "Cohort updated successfully",
        color: "success",
      });

      loadCohort();
    } catch (error) {
      console.error("Error saving cohort:", error);
      addToast({
        title: "Error",
        description: "Failed to save cohort",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this cohort?")) {
      return;
    }

    setDeleting(true);

    try {
      await cohortStorage.delete(cohortId);

      addToast({
        title: "Success",
        description: "Cohort deleted successfully",
        color: "success",
      });

      router.push("/professor/cohorts");
    } catch (error) {
      console.error("Error deleting cohort:", error);
      addToast({
        title: "Error",
        description: "Failed to delete cohort",
        color: "danger",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleAddStudent = async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) {
      addToast({
        title: "Error",
        description: "Please enter a valid email address",
        color: "danger",
      });
      return;
    }

    try {
      await cohortStorage.addStudent(cohortId, newEmail.trim().toLowerCase());
      await cohortStorage.save(cohortId);
      setNewEmail("");
      loadCohort();

      addToast({
        title: "Success",
        description: "Student added successfully",
        color: "success",
      });
    } catch (error) {
      console.error("Error adding student:", error);
      addToast({
        title: "Error",
        description: "Failed to add student",
        color: "danger",
      });
    }
  };

  const handleRemoveStudent = async (email: string) => {
    if (!confirm(`Remove ${email} from this cohort?`)) {
      return;
    }

    try {
      await cohortStorage.removeStudent(cohortId, email);
      await cohortStorage.save(cohortId);
      loadCohort();

      addToast({
        title: "Success",
        description: "Student removed successfully",
        color: "success",
      });
    } catch (error) {
      console.error("Error removing student:", error);
      addToast({
        title: "Error",
        description: "Failed to remove student",
        color: "danger",
      });
    }
  };

  const copyAccessCode = () => {
    if (cohort) {
      navigator.clipboard.writeText(cohort.accessCode);
      addToast({
        title: "Copied",
        description: "Access code copied to clipboard",
        color: "success",
      });
    }
  };

  const copyJoinLink = () => {
    if (cohort) {
      const link = cohortStorage.getJoinLink(cohort.accessCode);
      navigator.clipboard.writeText(link);
      addToast({
        title: "Copied",
        description: "Join link copied to clipboard",
        color: "success",
      });
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case "practice":
        return "default";
      case "graded":
        return "primary";
      case "competitive":
        return "warning";
      case "simulation":
        return "danger";
      default:
        return "default";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-default-500">Loading cohort...</p>
        </div>
      </div>
    );
  }

  if (!cohort) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="light"
            startContent={<ArrowLeft className="w-4 h-4" />}
            onPress={() => router.push("/professor/cohorts")}
          >
            Back
          </Button>
          <div>
            <h1 className={title()}>{cohort.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Chip size="sm" color={getModeColor(cohort.cohortMode)}>
                {COHORT_MODE_LABELS[cohort.cohortMode]}
              </Chip>
              <span className="text-default-500">
                Code: {cohort.accessCode}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="bordered"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={loadCohort}
          >
            Refresh
          </Button>
          <Button
            color="danger"
            variant="flat"
            startContent={<Trash2 className="w-4 h-4" />}
            onPress={handleDelete}
            isLoading={deleting}
          >
            Delete
          </Button>
          <Button
            color="primary"
            startContent={<Save className="w-4 h-4" />}
            onPress={handleSave}
            isLoading={saving}
          >
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Cohort Settings</h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                label="Cohort Name"
                value={name}
                onValueChange={setName}
                isRequired
              />

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Budget per Student: ${budgetPerStudent}
                </label>
                <Slider
                  step={5}
                  minValue={5}
                  maxValue={100}
                  value={budgetPerStudent}
                  onChange={(value) => setBudgetPerStudent(value as number)}
                  className="max-w-md"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-3 block">
                  Enabled Interaction Modes
                </label>
                <div className="flex flex-wrap gap-4">
                  <Checkbox
                    isSelected={enabledModes.video}
                    onValueChange={(checked) =>
                      setEnabledModes({ ...enabledModes, video: checked })
                    }
                  >
                    Video ({PRICING.video.label})
                  </Checkbox>
                  <Checkbox
                    isSelected={enabledModes.voice}
                    onValueChange={(checked) =>
                      setEnabledModes({ ...enabledModes, voice: checked })
                    }
                  >
                    Voice ({PRICING.voice.label})
                  </Checkbox>
                  <Checkbox
                    isSelected={enabledModes.text}
                    onValueChange={(checked) =>
                      setEnabledModes({ ...enabledModes, text: checked })
                    }
                  >
                    Text ({PRICING.text.label})
                  </Checkbox>
                </div>
              </div>

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

              <Checkbox
                isSelected={bonusUnlock}
                onValueChange={setBonusUnlock}
              >
                Enable bonus unlock for high performers
              </Checkbox>
            </CardBody>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Timeline</h2>
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
                placeholder="e.g., 10% deduction per day late"
                value={latePenaltyRule}
                onValueChange={setLatePenaltyRule}
                minRows={2}
              />
            </CardBody>
          </Card>

          {/* Students */}
          <Card>
            <CardHeader className="flex justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                <h2 className="text-lg font-semibold">
                  Students ({cohort.students.length})
                </h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {/* Add Student */}
              <div className="flex gap-2">
                <Input
                  placeholder="Enter student email"
                  value={newEmail}
                  onValueChange={setNewEmail}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddStudent();
                    }
                  }}
                />
                <Button
                  color="primary"
                  startContent={<Plus className="w-4 h-4" />}
                  onPress={handleAddStudent}
                >
                  Add
                </Button>
              </div>

              <Divider />

              {/* Student List */}
              {cohort.students.length === 0 ? (
                <p className="text-center text-default-500 py-4">
                  No students added yet
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {cohort.students.map((student, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded-lg bg-default-50 hover:bg-default-100"
                    >
                      <div className="flex items-center gap-2">
                        <span>{student.email}</span>
                        {student.status && (
                          <Chip
                            size="sm"
                            variant="flat"
                            color={
                              student.status === "active"
                                ? "success"
                                : student.status === "joined"
                                ? "primary"
                                : "default"
                            }
                          >
                            {student.status}
                          </Chip>
                        )}
                      </div>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => handleRemoveStudent(student.email)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right Column - Quick Info */}
        <div className="space-y-6">
          {/* Access Info */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Access Information</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label className="text-sm text-default-500">Access Code</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-2xl font-mono font-bold text-primary">
                    {cohort.accessCode}
                  </code>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    onPress={copyAccessCode}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm text-default-500">Join Link</label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={cohortStorage.getJoinLink(cohort.accessCode)}
                    isReadOnly
                    size="sm"
                  />
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    onPress={copyJoinLink}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Statistics</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-default-500">Total Students</span>
                <span className="font-semibold">{cohort.students.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-default-500">Budget per Student</span>
                <span className="font-semibold">${cohort.budgetPerStudent}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-default-500">Total Budget</span>
                <span className="font-semibold">
                  ${cohort.students.length * cohort.budgetPerStudent}
                </span>
              </div>
              <Divider />
              <div className="flex items-center justify-between">
                <span className="text-default-500">Created</span>
                <span className="text-sm">
                  {new Date(cohort.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-default-500">Last Updated</span>
                <span className="text-sm">
                  {new Date(cohort.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </CardBody>
          </Card>

          {/* Mode Selection */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Cohort Mode</h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-2">
                {(Object.keys(COHORT_MODE_LABELS) as CohortMode[]).map(
                  (mode) => (
                    <div
                      key={mode}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        cohortMode === mode
                          ? "bg-primary/10 border-2 border-primary"
                          : "bg-default-50 border-2 border-transparent hover:bg-default-100"
                      }`}
                      onClick={() => setCohortMode(mode)}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full border-2 ${
                            cohortMode === mode
                              ? "border-primary bg-primary"
                              : "border-default-300"
                          }`}
                        />
                        <span className="font-medium">
                          {COHORT_MODE_LABELS[mode]}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
