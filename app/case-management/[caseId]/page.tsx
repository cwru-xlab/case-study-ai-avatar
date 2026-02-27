"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Slider } from "@heroui/slider";
import { Chip } from "@heroui/chip";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { ArrowLeft, Plus, Save, Trash2, X, Target, Clock, BarChart3, Brain, User, Search } from "lucide-react";
import { addToast } from "@heroui/toast";
import { title as pageTitle } from "@/components/primitives";
import { useAuth } from "@/lib/auth-context";
import { caseStorage } from "@/lib/case-storage";
import { avatarStorage, type CachedAvatar } from "@/lib/avatar-storage";
import type { CaseStudy, CaseAvatar, LearningObjective, CaseDifficulty, CaseStatus } from "@/types";

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { isOpen: isAvatarModalOpen, onOpen: onAvatarModalOpen, onOpenChange: onAvatarModalOpenChange } = useDisclosure();

  const caseId = params.caseId as string;
  const isNewCase = caseId === "new";

  const [name, setName] = useState("");
  const [backgroundInfo, setBackgroundInfo] = useState("");
  const [avatars, setAvatars] = useState<CaseAvatar[]>([]);
  
  // Available avatars from the system
  const [availableAvatars, setAvailableAvatars] = useState<CachedAvatar[]>([]);
  const [avatarSearchQuery, setAvatarSearchQuery] = useState("");
  const [loadingAvatars, setLoadingAvatars] = useState(false);
  
  // New state for enhanced case authoring
  const [learningObjectives, setLearningObjectives] = useState<LearningObjective[]>([]);
  const [difficulty, setDifficulty] = useState<CaseDifficulty>("beginner");
  const [estimatedDuration, setEstimatedDuration] = useState<number>(30);
  const [status, setStatus] = useState<CaseStatus>("draft");
  const [memoryPrompt, setMemoryPrompt] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [originalValues, setOriginalValues] = useState({
    name: "",
    backgroundInfo: "",
    avatars: "[]",
    learningObjectives: "[]",
    difficulty: "beginner",
    estimatedDuration: 30,
    status: "draft",
    memoryPrompt: "",
  });

  const generatedId = useMemo(() => {
    if (!isNewCase) return caseId;
    if (!name.trim()) return "";
    return name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }, [name, isNewCase, caseId]);

  const hasUnsavedChanges = useMemo(() => {
    return (
      name !== originalValues.name ||
      backgroundInfo !== originalValues.backgroundInfo ||
      JSON.stringify(avatars) !== originalValues.avatars ||
      JSON.stringify(learningObjectives) !== originalValues.learningObjectives ||
      difficulty !== originalValues.difficulty ||
      estimatedDuration !== originalValues.estimatedDuration ||
      status !== originalValues.status ||
      memoryPrompt !== originalValues.memoryPrompt
    );
  }, [name, backgroundInfo, avatars, learningObjectives, difficulty, estimatedDuration, status, memoryPrompt, originalValues]);

  useEffect(() => {
    const loadCase = async () => {
      if (!isNewCase) {
        setIsLoading(true);
        try {
          const caseData = await caseStorage.get(caseId);
          if (caseData) {
            setName(caseData.name);
            setBackgroundInfo(caseData.backgroundInfo);
            setAvatars(caseData.avatars || []);
            setLearningObjectives(caseData.learningObjectives || []);
            setDifficulty(caseData.difficulty || "beginner");
            setEstimatedDuration(caseData.estimatedDuration || 30);
            setStatus(caseData.status || "draft");
            setMemoryPrompt(caseData.memoryPrompt || "");
            setOriginalValues({
              name: caseData.name,
              backgroundInfo: caseData.backgroundInfo,
              avatars: JSON.stringify(caseData.avatars || []),
              learningObjectives: JSON.stringify(caseData.learningObjectives || []),
              difficulty: caseData.difficulty || "beginner",
              estimatedDuration: caseData.estimatedDuration || 30,
              status: caseData.status || "draft",
              memoryPrompt: caseData.memoryPrompt || "",
            });
          } else {
            setErrors({ load: "Case not found" });
          }
        } catch (error) {
          console.error("Failed to load case:", error);
          setErrors({ load: "Failed to load case" });
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadCase();
  }, [caseId, isNewCase]);

  // Load available avatars from the system
  useEffect(() => {
    const loadAvailableAvatars = async () => {
      setLoadingAvatars(true);
      try {
        const allAvatars = await avatarStorage.list();
        setAvailableAvatars(allAvatars);
      } catch (error) {
        console.error("Failed to load avatars:", error);
      } finally {
        setLoadingAvatars(false);
      }
    };
    loadAvailableAvatars();
  }, []);

  // Filter avatars based on search and exclude already added ones
  const filteredAvailableAvatars = useMemo(() => {
    const addedAvatarIds = avatars.map(a => a.id);
    return availableAvatars.filter(avatar => {
      const matchesSearch = avatarSearchQuery === "" || 
        avatar.name.toLowerCase().includes(avatarSearchQuery.toLowerCase()) ||
        (avatar.title?.toLowerCase().includes(avatarSearchQuery.toLowerCase()));
      const notAlreadyAdded = !addedAvatarIds.includes(avatar.id);
      return matchesSearch && notAlreadyAdded;
    });
  }, [availableAvatars, avatars, avatarSearchQuery]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Case name is required";
    } else if (generatedId === "new") {
      newErrors.name = "Case name cannot generate 'new' as ID";
    }

    if (!backgroundInfo.trim()) {
      newErrors.backgroundInfo = "Background information is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const userName = user?.name || "Unknown User";

      if (isNewCase) {
        await caseStorage.add({
          name,
          backgroundInfo,
          avatars,
          learningObjectives,
          difficulty,
          estimatedDuration,
          status,
          memoryPrompt,
          cohortIds: [],
          createdBy: userName,
          lastEditedBy: userName,
        });

        addToast({
          title: "Case Created",
          description: "Your case study has been created successfully.",
          color: "success",
        });
      } else {
        await caseStorage.update(caseId, {
          name,
          backgroundInfo,
          avatars,
          learningObjectives,
          difficulty,
          estimatedDuration,
          status,
          memoryPrompt,
          lastEditedBy: userName,
        });

        addToast({
          title: "Case Updated",
          description: "Your changes have been saved successfully.",
          color: "success",
        });
      }

      router.push("/case-management");
    } catch (error) {
      console.error("Error saving case:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save case";
      setErrors({ save: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== name) {
      setErrors({
        delete: "Please type the exact case name to confirm deletion.",
      });
      return;
    }

    setIsDeleting(true);
    try {
      await caseStorage.delete(caseId);
      addToast({
        title: "Case Deleted",
        description: "The case study has been deleted.",
        color: "success",
      });
      router.push("/case-management");
    } catch (error) {
      console.error("Error deleting case:", error);
      setErrors({ delete: "Failed to delete case. Please try again." });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBack = () => {
    router.push("/case-management");
  };

  const handleAddAvatarFromSystem = (systemAvatar: CachedAvatar) => {
    const newCaseAvatar: CaseAvatar = {
      id: systemAvatar.id,
      name: systemAvatar.name,
      role: systemAvatar.title || "",
      additionalInfo: "",
    };
    setAvatars([...avatars, newCaseAvatar]);
    onAvatarModalOpenChange();
    setAvatarSearchQuery("");
  };

  const handleRemoveAvatar = (avatarId: string) => {
    setAvatars(avatars.filter((a) => a.id !== avatarId));
  };

  const updateAvatar = (avatarId: string, updates: Partial<CaseAvatar>) => {
    setAvatars(
      avatars.map((a) => (a.id === avatarId ? { ...a, ...updates } : a))
    );
  };

  // Learning Objective handlers
  const handleAddObjective = () => {
    const newObjective: LearningObjective = {
      id: `obj-${Date.now()}`,
      text: "",
      type: "knowledge",
      weight: 5,
    };
    setLearningObjectives([...learningObjectives, newObjective]);
  };

  const handleRemoveObjective = (objectiveId: string) => {
    setLearningObjectives(learningObjectives.filter((o) => o.id !== objectiveId));
  };

  const updateObjective = (objectiveId: string, updates: Partial<LearningObjective>) => {
    setLearningObjectives(
      learningObjectives.map((o) => (o.id === objectiveId ? { ...o, ...updates } : o))
    );
  };

  if (isLoading && !isNewCase) {
    return (
      <div className="flex flex-col gap-6 max-w-6xl mx-auto">
        <div className="text-center py-12">
          <p className="text-default-500">Loading case...</p>
        </div>
      </div>
    );
  }

  if (errors.load && !isNewCase) {
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
      <div className="flex items-center gap-4">
        <Button
          isIconOnly
          className="min-w-0"
          variant="light"
          onPress={handleBack}
        >
          <ArrowLeft />
        </Button>
        <h1 className={pageTitle()}>
          {isNewCase ? "Create Case Study" : "Edit Case Study"}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Case Details</h2>
        </CardHeader>
        <CardBody className="space-y-6">
          <div>
            <Input
              isRequired
              errorMessage={errors.name}
              isInvalid={!!errors.name}
              label="Case Name"
              placeholder="Enter case study name"
              value={name}
              onValueChange={setName}
            />
          </div>

          <div>
            <Input
              isReadOnly
              classNames={{ input: "font-mono" }}
              description={
                isNewCase
                  ? "This ID is automatically generated from the name"
                  : "Case ID is permanent and cannot be changed"
              }
              label={isNewCase ? "Case ID (Auto-generated)" : "Case ID"}
              value={generatedId}
            />
          </div>

          <div>
            <Textarea
              isRequired
              description="Provide detailed background information about this case study"
              errorMessage={errors.backgroundInfo}
              isInvalid={!!errors.backgroundInfo}
              label="Background Information"
              maxRows={50}
              minRows={6}
              placeholder="Enter background information..."
              value={backgroundInfo}
              onValueChange={setBackgroundInfo}
            />
          </div>

          {/* Case Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Status"
              placeholder="Select status"
              selectedKeys={[status]}
              startContent={<BarChart3 className="w-4 h-4 text-default-400" />}
              onSelectionChange={(keys) => setStatus(Array.from(keys)[0] as CaseStatus)}
            >
              <SelectItem key="draft">Draft</SelectItem>
              <SelectItem key="published">Published</SelectItem>
              <SelectItem key="archived">Archived</SelectItem>
            </Select>

            <Select
              label="Difficulty"
              placeholder="Select difficulty"
              selectedKeys={[difficulty]}
              onSelectionChange={(keys) => setDifficulty(Array.from(keys)[0] as CaseDifficulty)}
            >
              <SelectItem key="beginner">Beginner</SelectItem>
              <SelectItem key="intermediate">Intermediate</SelectItem>
              <SelectItem key="advanced">Advanced</SelectItem>
            </Select>

            <Input
              label="Estimated Duration (minutes)"
              placeholder="30"
              startContent={<Clock className="w-4 h-4 text-default-400" />}
              type="number"
              value={estimatedDuration.toString()}
              onValueChange={(val) => setEstimatedDuration(parseInt(val) || 0)}
            />
          </div>

          {/* Learning Objectives */}
          <Card className="border border-default-200">
            <CardHeader className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-lg font-semibold">Learning Objectives</h3>
                  <p className="text-sm text-default-500">
                    Define what students should learn from this case
                  </p>
                </div>
              </div>
              <Button
                color="primary"
                size="sm"
                startContent={<Plus className="w-4 h-4" />}
                variant="bordered"
                onPress={handleAddObjective}
              >
                Add Objective
              </Button>
            </CardHeader>
            <CardBody className="space-y-3">
              {learningObjectives.length === 0 && (
                <div className="text-center py-6 text-default-400">
                  <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No learning objectives defined</p>
                  <p className="text-sm">Add objectives to track student progress</p>
                </div>
              )}

              {learningObjectives.map((objective, index) => (
                <Card key={objective.id} className="p-4 bg-default-50">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Chip size="sm" variant="flat" color="primary">
                        #{index + 1}
                      </Chip>
                      <div className="flex-1 space-y-3">
                        <Input
                          label="Objective"
                          placeholder="e.g., Identify key symptoms in patient history"
                          size="sm"
                          value={objective.text}
                          onValueChange={(val) => updateObjective(objective.id, { text: val })}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Select
                            label="Type"
                            placeholder="Select type"
                            selectedKeys={[objective.type]}
                            size="sm"
                            onSelectionChange={(keys) => 
                              updateObjective(objective.id, { type: Array.from(keys)[0] as "knowledge" | "skill" | "attitude" })
                            }
                          >
                            <SelectItem key="knowledge">Knowledge</SelectItem>
                            <SelectItem key="skill">Skill</SelectItem>
                            <SelectItem key="attitude">Attitude</SelectItem>
                          </Select>
                          <div>
                            <label className="text-sm text-default-600 mb-1 block">
                              Weight: {objective.weight}
                            </label>
                            <Slider
                              aria-label="Weight"
                              maxValue={10}
                              minValue={1}
                              size="sm"
                              step={1}
                              value={objective.weight}
                              onChange={(val) => updateObjective(objective.id, { weight: val as number })}
                            />
                          </div>
                        </div>
                      </div>
                      <Button
                        isIconOnly
                        color="danger"
                        size="sm"
                        variant="light"
                        onPress={() => handleRemoveObjective(objective.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </CardBody>
          </Card>

          {/* Memory Prompt (AI Context) */}
          <Card className="border border-default-200">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-secondary" />
                <div>
                  <h3 className="text-lg font-semibold">Memory Prompt</h3>
                  <p className="text-sm text-default-500">
                    Provide context and knowledge for the AI to use during conversations
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <Textarea
                description="This information will be injected into the AI's context. Include facts, guidelines, expected responses, and any domain knowledge the AI should have."
                maxRows={20}
                minRows={8}
                placeholder="Enter the knowledge and context the AI should have for this case...

Example:
- Patient is a 45-year-old male presenting with chest pain
- Key symptoms to look for: shortness of breath, radiating pain
- Correct diagnosis: Acute coronary syndrome
- Student should ask about: onset, duration, severity, associated symptoms"
                value={memoryPrompt}
                onValueChange={setMemoryPrompt}
              />
            </CardBody>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Case Avatars</h3>
                <p className="text-sm text-default-500">
                  Select avatars from your existing avatars to associate with this case
                </p>
              </div>
              <Button
                color="primary"
                size="sm"
                startContent={<Plus className="w-4 h-4" />}
                variant="bordered"
                onPress={onAvatarModalOpen}
              >
                Add Avatar
              </Button>
            </div>

            {avatars.length === 0 && (
              <div className="text-center py-8 text-default-400">
                <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No avatars associated with this case</p>
                <p className="text-sm">
                  Click &quot;Add Avatar&quot; to select from existing avatars
                </p>
              </div>
            )}

            <div className="space-y-3">
              {avatars.map((avatar) => (
                <Card key={avatar.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{avatar.name}</p>
                          <p className="text-sm text-default-500">{avatar.role || "No role specified"}</p>
                        </div>
                        <Chip size="sm" variant="flat" color="primary">
                          {avatar.id}
                        </Chip>
                      </div>
                      <Button
                        isIconOnly
                        className="ml-3"
                        color="danger"
                        size="sm"
                        variant="light"
                        onPress={() => handleRemoveAvatar(avatar.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <Textarea
                      label="Additional Context for this Case"
                      maxRows={8}
                      minRows={2}
                      placeholder="Add specific context or instructions for this avatar in this case..."
                      value={avatar.additionalInfo}
                      onValueChange={(val) =>
                        updateAvatar(avatar.id, { additionalInfo: val })
                      }
                    />
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {errors.save && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded text-danger-700 text-sm">
              {errors.save}
            </div>
          )}

          <div className="flex gap-3 pt-4 flex-wrap">
            <Button
              color="primary"
              isDisabled={!name.trim() || !backgroundInfo.trim() || isLoading}
              isLoading={isSaving}
              startContent={!isSaving ? <Save className="w-4 h-4" /> : null}
              onPress={handleSave}
            >
              {isSaving
                ? "Saving..."
                : isNewCase
                  ? "Create Case"
                  : "Save Changes"}
            </Button>

            {!isNewCase && (
              <Button
                color="danger"
                isDisabled={isSaving || isLoading}
                startContent={<Trash2 className="w-4 h-4" />}
                variant="bordered"
                onPress={onOpen}
              >
                Delete
              </Button>
            )}

            <Button
              isDisabled={isSaving || isLoading}
              variant="bordered"
              onPress={handleBack}
            >
              {hasUnsavedChanges ? "Cancel" : "Back"}
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Case Summary</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div>
              <p className="text-sm font-medium">Case Name:</p>
              <p className="text-sm text-default-600">{name || "—"}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Case ID:</p>
              <p className="text-sm text-default-600 font-mono">
                {generatedId || "—"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm font-medium">Status:</p>
                <Chip 
                  size="sm" 
                  color={status === "published" ? "success" : status === "archived" ? "default" : "warning"}
                  variant="flat"
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Chip>
              </div>
              <div>
                <p className="text-sm font-medium">Difficulty:</p>
                <Chip 
                  size="sm" 
                  color={difficulty === "advanced" ? "danger" : difficulty === "intermediate" ? "warning" : "success"}
                  variant="flat"
                >
                  {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                </Chip>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm font-medium">Duration:</p>
                <p className="text-sm text-default-600">{estimatedDuration} min</p>
              </div>
              <div>
                <p className="text-sm font-medium">Objectives:</p>
                <p className="text-sm text-default-600">{learningObjectives.length}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Number of Avatars:</p>
              <p className="text-sm text-default-600">{avatars.length}</p>
            </div>
          </CardBody>
        </Card>

        {!isNewCase && (
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Quick Actions</h3>
            </CardHeader>
            <CardBody className="space-y-2">
              <Button
                fullWidth
                color="danger"
                variant="flat"
                onPress={onOpen}
              >
                Delete Case
              </Button>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal isDismissable={!isDeleting} isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold">Delete Case</h3>
                <p className="text-sm text-default-500">
                  This action cannot be undone.
                </p>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <p className="text-sm">
                    To confirm deletion, please type the case name:{" "}
                    <span className="font-mono font-semibold">{name}</span>
                  </p>
                  <Input
                    errorMessage={errors.delete}
                    isDisabled={isDeleting}
                    isInvalid={!!errors.delete}
                    label="Case Name"
                    placeholder={`Type "${name}" to confirm`}
                    value={deleteConfirmText}
                    onValueChange={setDeleteConfirmText}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button isDisabled={isDeleting} variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="danger"
                  isDisabled={deleteConfirmText !== name}
                  isLoading={isDeleting}
                  onPress={handleDelete}
                >
                  {isDeleting ? "Deleting..." : "Delete Case"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Avatar Selection Modal */}
      <Modal 
        isOpen={isAvatarModalOpen} 
        onOpenChange={onAvatarModalOpenChange}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold">Select Avatar</h3>
                <p className="text-sm text-default-500">
                  Choose an avatar from your existing avatars to add to this case
                </p>
              </ModalHeader>
              <ModalBody>
                <Input
                  placeholder="Search avatars by name or title..."
                  startContent={<Search className="w-4 h-4 text-default-400" />}
                  value={avatarSearchQuery}
                  onValueChange={setAvatarSearchQuery}
                  className="mb-4"
                />
                
                {loadingAvatars && (
                  <div className="text-center py-8">
                    <p className="text-default-500">Loading avatars...</p>
                  </div>
                )}

                {!loadingAvatars && filteredAvailableAvatars.length === 0 && (
                  <div className="text-center py-8 text-default-400">
                    <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    {avatarSearchQuery ? (
                      <p>No avatars found matching &quot;{avatarSearchQuery}&quot;</p>
                    ) : availableAvatars.length === avatars.length ? (
                      <p>All available avatars have been added to this case</p>
                    ) : (
                      <p>No avatars available. Create avatars in Avatar Management first.</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  {filteredAvailableAvatars.map((avatar) => (
                    <Card 
                      key={avatar.id} 
                      className="p-3 cursor-pointer hover:bg-default-100 transition-colors"
                      isPressable
                      onPress={() => handleAddAvatarFromSystem(avatar)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{avatar.name}</p>
                          <p className="text-sm text-default-500">{avatar.title || "No title"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {avatar.published && (
                            <Chip size="sm" color="success" variant="flat">Published</Chip>
                          )}
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            onPress={() => handleAddAvatarFromSystem(avatar)}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancel
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
