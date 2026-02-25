"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { ArrowLeft, Plus, Save, Trash2, X } from "lucide-react";
import { addToast } from "@heroui/toast";
import { title as pageTitle } from "@/components/primitives";
import { useAuth } from "@/lib/auth-context";
import { caseStorage } from "@/lib/case-storage";
import type { CaseStudy, CaseAvatar, VideoAudioProfile } from "@/types";

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const caseId = params.caseId as string;
  const isNewCase = caseId === "new";

  const [name, setName] = useState("");
  const [backgroundInfo, setBackgroundInfo] = useState("");
  const [avatars, setAvatars] = useState<CaseAvatar[]>([]);

  const [availableProfiles, setAvailableProfiles] = useState<VideoAudioProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [originalValues, setOriginalValues] = useState({
    name: "",
    backgroundInfo: "",
    avatars: "[]",
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
      JSON.stringify(avatars) !== originalValues.avatars
    );
  }, [name, backgroundInfo, avatars, originalValues]);

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const response = await fetch("/api/profile/list");
        if (response.ok) {
          const data = await response.json();
          setAvailableProfiles(data.profiles || []);
        }
      } catch (error) {
        console.error("Failed to load profiles:", error);
      }
    };
    loadProfiles();
  }, []);

  useEffect(() => {
    const loadCase = async () => {
      if (!isNewCase) {
        setIsLoading(true);
        try {
          const caseData = await caseStorage.get(caseId);
          if (caseData) {
            setName(caseData.name);
            setBackgroundInfo(caseData.backgroundInfo);
            setAvatars(caseData.avatars);
            setOriginalValues({
              name: caseData.name,
              backgroundInfo: caseData.backgroundInfo,
              avatars: JSON.stringify(caseData.avatars),
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

  const handleAddAvatar = () => {
    const newAvatar: CaseAvatar = {
      id: `avatar-${Date.now()}`,
      name: "",
      role: "",
      additionalInfo: "",
    };
    setAvatars([...avatars, newAvatar]);
  };

  const handleRemoveAvatar = (avatarId: string) => {
    setAvatars(avatars.filter((a) => a.id !== avatarId));
  };

  const updateAvatar = (avatarId: string, updates: Partial<CaseAvatar>) => {
    setAvatars(
      avatars.map((a) => (a.id === avatarId ? { ...a, ...updates } : a))
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

            {avatars.length === 0 && (
              <div className="text-center py-8 text-default-400">
                <p>No avatars associated with this case</p>
                <p className="text-sm">
                  Click &quot;Add Avatar&quot; to add your first avatar
                </p>
              </div>
            )}

            <div className="space-y-3">
              {avatars.map((avatar) => (
                <Card key={avatar.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                          label="Avatar Name"
                          placeholder="e.g., Sarah Chen"
                          size="sm"
                          value={avatar.name}
                          onValueChange={(val) =>
                            updateAvatar(avatar.id, { name: val })
                          }
                        />
                        <Input
                          label="Role"
                          placeholder="e.g., Chief Executive Officer"
                          size="sm"
                          value={avatar.role}
                          onValueChange={(val) =>
                            updateAvatar(avatar.id, { role: val })
                          }
                        />
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

                    <Select
                      label="Avatar Profile"
                      placeholder="Select an avatar profile"
                      description="Links this role to a video/audio avatar profile"
                      selectedKeys={avatar.avatarProfileId ? [avatar.avatarProfileId] : []}
                      onSelectionChange={(keys) => {
                        const profileId = Array.from(keys)[0] as string | undefined;
                        updateAvatar(avatar.id, { avatarProfileId: profileId || undefined });
                      }}
                    >
                      {availableProfiles.map((profile) => (
                        <SelectItem key={profile.id}>
                          {profile.name}
                        </SelectItem>
                      ))}
                    </Select>

                    <Textarea
                      label="Additional Background Information"
                      maxRows={8}
                      minRows={3}
                      placeholder="Add specific context or background for this role in this case..."
                      value={avatar.additionalInfo}
                      onValueChange={(val) =>
                        updateAvatar(avatar.id, { additionalInfo: val })
                      }
                    />

                    <Textarea
                      label="System Prompt"
                      description="The AI persona instructions for this role (used when students chat with this character)"
                      maxRows={12}
                      minRows={4}
                      placeholder="You are [Name], the [Role] of [Company]. You are..."
                      value={avatar.systemPrompt || ""}
                      onValueChange={(val) =>
                        updateAvatar(avatar.id, { systemPrompt: val })
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
    </div>
  );
}
