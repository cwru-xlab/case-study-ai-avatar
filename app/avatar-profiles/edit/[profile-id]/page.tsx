"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Slider } from "@heroui/slider";
import { Select, SelectItem } from "@heroui/select";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import {
  ArrowLeft,
  Save,
  AlertCircle,
  Trash2,
  Video,
  AudioLines,
} from "lucide-react";
import { addToast } from "@heroui/toast";
import { title as pageTitle } from "@/components/primitives";
import { useAuth } from "@/lib/auth-context";
import {
  videoAudioProfileStorage,
  DEFAULT_PROFILE_CONFIG,
} from "@/lib/video-audio-profile-storage";
import { type CachedVideoAudioProfile, VoiceEmotion } from "@/types";

export default function AvatarProfileEditPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const profileId = params["profile-id"] as string;
  const isNewProfile = profileId === "new";

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quality, setQuality] = useState<"low" | "medium" | "high">(
    DEFAULT_PROFILE_CONFIG.quality
  );
  const [avatarName, setAvatarName] = useState(DEFAULT_PROFILE_CONFIG.avatarName);
  const [language, setLanguage] = useState(DEFAULT_PROFILE_CONFIG.language);
  const [voiceRate, setVoiceRate] = useState(DEFAULT_PROFILE_CONFIG.voice.rate);
  const [voiceId, setVoiceId] = useState(DEFAULT_PROFILE_CONFIG.voice.voiceId);
  const [voiceEmotion, setVoiceEmotion] = useState<VoiceEmotion | undefined>(
    DEFAULT_PROFILE_CONFIG.voice.emotion
  );
  const [knowledgeId, setKnowledgeId] = useState(
    DEFAULT_PROFILE_CONFIG.knowledgeId || ""
  );

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [existingProfile, setExistingProfile] =
    useState<CachedVideoAudioProfile | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Track original values for change detection
  const [originalValues, setOriginalValues] = useState({
    name: "",
    description: "",
    quality: DEFAULT_PROFILE_CONFIG.quality,
    avatarName: DEFAULT_PROFILE_CONFIG.avatarName,
    language: DEFAULT_PROFILE_CONFIG.language,
    voiceRate: DEFAULT_PROFILE_CONFIG.voice.rate,
    voiceId: DEFAULT_PROFILE_CONFIG.voice.voiceId,
    voiceEmotion: DEFAULT_PROFILE_CONFIG.voice.emotion,
    knowledgeId: "",
  });

  // Unsaved changes modal
  const [isUnsavedModalOpen, setIsUnsavedModalOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(
    null
  );

  // Auto-generate ID from name (only for new profiles)
  const generatedId = useMemo(() => {
    if (!isNewProfile) return profileId;
    if (!name.trim()) return "";

    return name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }, [name, isNewProfile, profileId]);

  // Check if there are actual changes from original values
  const hasUnsavedChanges = useMemo(() => {
    return (
      name !== originalValues.name ||
      description !== originalValues.description ||
      quality !== originalValues.quality ||
      avatarName !== originalValues.avatarName ||
      language !== originalValues.language ||
      voiceRate !== originalValues.voiceRate ||
      voiceId !== originalValues.voiceId ||
      voiceEmotion !== originalValues.voiceEmotion ||
      knowledgeId !== originalValues.knowledgeId
    );
  }, [
    name,
    description,
    quality,
    avatarName,
    language,
    voiceRate,
    voiceId,
    voiceEmotion,
    knowledgeId,
    originalValues,
  ]);

  // Validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Profile name is required";
    } else if (generatedId === "new") {
      newErrors.name =
        "Profile name cannot generate 'new' as ID (conflicts with add URL)";
    }

    if (!avatarName.trim()) {
      newErrors.avatarName = "Avatar name (API) is required";
    }

    if (!voiceId.trim()) {
      newErrors.voiceId = "Voice ID is required";
    }

    if (!language.trim()) {
      newErrors.language = "Language is required";
    } else if (!/^[a-z]{2}$/.test(language)) {
      newErrors.language =
        "Language must be exactly two lowercase letters (e.g., 'en', 'zh', 'ko')";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Load existing profile data if editing
  useEffect(() => {
    const loadProfile = async () => {
      if (!isNewProfile) {
        setIsLoading(true);
        try {
          const profile = await videoAudioProfileStorage.get(profileId);
          if (profile) {
            setExistingProfile(profile);
            setName(profile.name);
            setDescription(profile.description || "");
            setQuality(profile.quality);
            setAvatarName(profile.avatarName);
            setLanguage(profile.language);
            setVoiceRate(profile.voice.rate);
            setVoiceId(profile.voice.voiceId);
            setVoiceEmotion(profile.voice.emotion);
            setKnowledgeId(profile.knowledgeId || "");

            // Set original values for change detection
            setOriginalValues({
              name: profile.name,
              description: profile.description || "",
              quality: profile.quality,
              avatarName: profile.avatarName,
              language: profile.language,
              voiceRate: profile.voice.rate,
              voiceId: profile.voice.voiceId,
              voiceEmotion: profile.voice.emotion,
              knowledgeId: profile.knowledgeId || "",
            });
          }
        } catch (error) {
          console.error("Failed to load profile:", error);
          setErrors({ load: "Failed to load profile" });
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadProfile();
  }, [profileId, isNewProfile]);

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);

    try {
      if (isNewProfile) {
        await videoAudioProfileStorage.add({
          name,
          description: description || undefined,
          quality,
          avatarName,
          language,
          voice: {
            rate: voiceRate,
            voiceId,
            emotion: voiceEmotion,
          },
          knowledgeId: knowledgeId || undefined,
          createdBy: user?.name || "Unknown User",
          lastEditedBy: user?.name || "Unknown User",
        });

        addToast({
          title: "Profile Created",
          description: "Your avatar profile has been created successfully.",
          color: "success",
        });
      } else {
        await videoAudioProfileStorage.updateLocal(profileId, {
          name,
          description: description || undefined,
          quality,
          avatarName,
          language,
          voice: {
            rate: voiceRate,
            voiceId,
            emotion: voiceEmotion,
          },
          knowledgeId: knowledgeId || undefined,
          lastEditedBy: user?.name || "Unknown User",
        });

        await videoAudioProfileStorage.save(profileId);

        addToast({
          title: "Profile Updated",
          description: "Your changes have been saved successfully.",
          color: "success",
        });
      }

      router.push("/avatar-profiles");
    } catch (error) {
      console.error("Error saving profile:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save profile";
      setErrors({ save: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== name) {
      setErrors({
        delete: "Please type the exact profile name to confirm deletion.",
      });
      return;
    }

    setIsDeleting(true);

    try {
      await videoAudioProfileStorage.delete(profileId);
      addToast({
        title: "Profile Deleted",
        description: "The avatar profile has been deleted.",
        color: "success",
      });
      router.push("/avatar-profiles");
    } catch (error) {
      console.error("Error deleting profile:", error);
      setErrors({ delete: "Failed to delete profile. Please try again." });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      setPendingNavigation(() => () => router.push("/avatar-profiles"));
      setIsUnsavedModalOpen(true);
    } else {
      router.push("/avatar-profiles");
    }
  };

  const handleNavigationConfirm = (action: "discard") => {
    setIsUnsavedModalOpen(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  const currentUser = user?.name || "Unknown User";

  if (isLoading && !isNewProfile) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center py-12">
          <p className="text-default-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button isIconOnly className="min-w-0" variant="light" onPress={handleBack}>
          <ArrowLeft />
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-linear-to-br from-primary-100 to-secondary-100">
            <Video className="w-5 h-5 text-primary-600" />
          </div>
          <h1 className={pageTitle()}>
            {isNewProfile
              ? "Create Avatar Profile"
              : `Edit ${existingProfile?.name || "Profile"}`}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Profile Details</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                isRequired
                errorMessage={errors.name}
                isInvalid={!!errors.name}
                label="Profile Name"
                placeholder="Enter a name for this profile"
                value={name}
                onValueChange={setName}
              />

              <Input
                isReadOnly
                classNames={{ input: "font-mono" }}
                color={generatedId === "new" ? "danger" : "default"}
                description={
                  isNewProfile
                    ? "This ID is automatically generated from the name"
                    : "Profile ID is permanent and cannot be changed"
                }
                label={isNewProfile ? "Profile ID (Auto-generated)" : "Profile ID"}
                value={generatedId}
              />
              {generatedId === "new" && (
                <div className="flex items-center gap-2 text-danger text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>This name generates a reserved ID. Please choose a different name.</span>
                </div>
              )}

              <Textarea
                description="Optional description for this profile"
                label="Description"
                maxRows={4}
                minRows={2}
                placeholder="Describe what this profile is for..."
                value={description}
                onValueChange={setDescription}
              />
            </CardBody>
          </Card>

          {/* Video Settings Card */}
          <Card>
            <CardHeader className="flex gap-2">
              <Video className="w-5 h-5 text-primary-600" />
              <h2 className="text-xl font-semibold">Video Settings</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <Select
                isRequired
                description="Quality of the avatar's video rendering"
                label="Quality"
                placeholder="Select quality level"
                selectedKeys={[quality]}
                onSelectionChange={(keys) => {
                  const q = Array.from(keys)[0] as "low" | "medium" | "high";
                  setQuality(q);
                }}
              >
                <SelectItem key="low">Low</SelectItem>
                <SelectItem key="medium">Medium</SelectItem>
                <SelectItem key="high">High</SelectItem>
              </Select>

              <Input
                isRequired
                description="HeyGen avatar model identifier"
                errorMessage={errors.avatarName}
                isInvalid={!!errors.avatarName}
                label="Avatar Name (API)"
                placeholder="Enter avatar name for API calls"
                value={avatarName}
                onValueChange={setAvatarName}
              />

              <Input
                isRequired
                description="Two lowercase letters only. Well supported: en, zh, ko, vi, fr, de, ja"
                errorMessage={errors.language}
                isInvalid={!!errors.language}
                label="Language"
                maxLength={2}
                placeholder="en"
                value={language}
                onValueChange={setLanguage}
              />

              <Input
                classNames={{ input: "bg-default-100" }}
                description="Optional HeyGen knowledge base ID (not in use yet)"
                isReadOnly
                label="Knowledge ID"
                placeholder="Leave empty for default"
                value={knowledgeId}
                onValueChange={setKnowledgeId}
              />
            </CardBody>
          </Card>

          {/* Audio Settings Card */}
          <Card>
            <CardHeader className="flex gap-2">
              <AudioLines className="w-5 h-5 text-primary-600" />
              <h2 className="text-xl font-semibold">Audio Settings</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <Slider
                className="max-w-md"
                formatOptions={{
                  style: "decimal",
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }}
                label="Voice Rate *"
                maxValue={1.5}
                minValue={0.5}
                step={0.1}
                value={voiceRate}
                onChange={(value) =>
                  setVoiceRate(Array.isArray(value) ? value[0] : value)
                }
              />

              <Input
                isRequired
                description="Voice identifier for speech synthesis"
                errorMessage={errors.voiceId}
                isInvalid={!!errors.voiceId}
                label="Voice ID"
                placeholder="Enter voice identifier"
                value={voiceId}
                onValueChange={setVoiceId}
              />

              <Select
                disallowEmptySelection={false}
                label="Voice Emotion"
                placeholder="Select voice emotion (optional)"
                selectedKeys={voiceEmotion ? [voiceEmotion] : []}
                selectionMode="single"
                onSelectionChange={(keys) => {
                  const keysArray = Array.from(keys);
                  const emotion =
                    keysArray.length > 0 ? (keysArray[0] as VoiceEmotion) : undefined;
                  setVoiceEmotion(emotion);
                }}
              >
                <SelectItem key={VoiceEmotion.EXCITED}>Excited</SelectItem>
                <SelectItem key={VoiceEmotion.SERIOUS}>Serious</SelectItem>
                <SelectItem key={VoiceEmotion.FRIENDLY}>Friendly</SelectItem>
                <SelectItem key={VoiceEmotion.SOOTHING}>Soothing</SelectItem>
                <SelectItem key={VoiceEmotion.BROADCASTER}>Broadcaster</SelectItem>
              </Select>
            </CardBody>
          </Card>

          {/* Error Messages */}
          {errors.save && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded text-danger-700 text-sm">
              {errors.save}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 flex-wrap">
            <Button
              color="primary"
              isDisabled={
                !name.trim() ||
                generatedId === "new" ||
                !avatarName.trim() ||
                !voiceId.trim() ||
                !language.trim() ||
                isLoading
              }
              isLoading={isSaving}
              startContent={!isSaving ? <Save className="w-4 h-4" /> : null}
              onPress={handleSave}
            >
              {isSaving
                ? "Saving..."
                : isNewProfile
                  ? "Create Profile"
                  : "Save Changes"}
            </Button>

            {!isNewProfile && (
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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Preview Card */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Preview</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-linear-to-br from-primary-100 to-secondary-100">
                  <Video className="w-6 h-6 text-primary-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{name || "Profile Name"}</p>
                  <p className="text-sm text-default-500 font-mono">
                    {generatedId || "profile-id"}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-default-500">Quality:</span>
                  <span className="font-medium capitalize">{quality}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-default-500">Language:</span>
                  <span className="font-medium uppercase">{language}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-default-500">Voice Rate:</span>
                  <span className="font-medium">{voiceRate}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-default-500">Emotion:</span>
                  <span className="font-medium capitalize">
                    {voiceEmotion || "None"}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Metadata Card */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Metadata</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              <div>
                <p className="text-sm font-medium">Created by:</p>
                <p className="text-sm text-default-600">
                  {isNewProfile ? currentUser : existingProfile?.createdBy || "Unknown"}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium">Last edited by:</p>
                <p className="text-sm text-default-600">{currentUser}</p>
              </div>

              {existingProfile && (
                <div>
                  <p className="text-sm font-medium">Created:</p>
                  <p className="text-sm text-default-600">
                    {new Date(existingProfile.createdAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal isDismissable={!isDeleting} isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold">Delete Profile</h3>
                <p className="text-sm text-default-500">
                  This action cannot be undone.
                </p>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <p className="text-sm">
                    To confirm deletion, please type the profile name:{" "}
                    <span className="font-mono font-semibold">{name}</span>
                  </p>
                  <Input
                    errorMessage={errors.delete}
                    isDisabled={isDeleting}
                    isInvalid={!!errors.delete}
                    label="Profile Name"
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
                  {isDeleting ? "Deleting..." : "Delete Profile"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Unsaved Changes Modal */}
      <Modal
        isDismissable={false}
        isOpen={isUnsavedModalOpen}
        onOpenChange={setIsUnsavedModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold">Unsaved Changes</h3>
                <p className="text-sm text-default-500">
                  You have unsaved changes. Are you sure you want to leave?
                </p>
              </ModalHeader>
              <ModalBody>
                <div className="p-4 bg-danger-50 border border-danger-200 rounded">
                  <p className="text-sm text-danger-700">
                    Your changes will be lost if you leave without saving.
                  </p>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Stay and Continue Editing
                </Button>
                <Button
                  color="danger"
                  onPress={() => handleNavigationConfirm("discard")}
                >
                  Discard Changes
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
