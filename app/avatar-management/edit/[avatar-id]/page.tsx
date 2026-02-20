"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Slider } from "@heroui/slider";
import { Select, SelectItem } from "@heroui/select";
import { ArrowLeft, Save, Volume2, Image as ImageIcon } from "lucide-react";
import { addToast } from "@heroui/toast";
import { title as pageTitle } from "@/components/primitives";
import {
  getPersona,
  createPersona,
  updatePersona,
  uploadPersonaImage,
  deletePersonaImage,
} from "@/lib/persona-storage";
import type { Persona } from "@/types";
import { VoiceEmotion } from "@/types";
import AvatarImage from "@/components/AvatarImage";

const VOICE_EMOTIONS = [
  { key: "none", label: "None" },
  { key: VoiceEmotion.EXCITED, label: "Excited" },
  { key: VoiceEmotion.SERIOUS, label: "Serious" },
  { key: VoiceEmotion.FRIENDLY, label: "Friendly" },
  { key: VoiceEmotion.SOOTHING, label: "Soothing" },
  { key: VoiceEmotion.BROADCASTER, label: "Broadcaster" },
];

export default function PersonaEditPage() {
  const params = useParams();
  const router = useRouter();
  const personaId = params["avatar-id"] as string;
  const isNew = personaId === "new";

  const [name, setName] = useState("");
  const [professionalTitle, setProfessionalTitle] = useState("");
  const [avatarImageUrl, setAvatarImageUrl] = useState("");
  const [language, setLanguage] = useState("en");
  const [voiceId, setVoiceId] = useState("");
  const [voiceRate, setVoiceRate] = useState(1.0);
  const [voiceEmotion, setVoiceEmotion] = useState<string>("none");
  const [animationSet, setAnimationSet] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existing, setExisting] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const generatedId = useMemo(() => {
    if (!isNew) return personaId;
    if (!name.trim()) return "";
    return name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }, [name, isNew, personaId]);

  const previewImageUrl = avatarImageUrl || (imageFile ? URL.createObjectURL(imageFile) : undefined);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (!professionalTitle.trim()) e.professionalTitle = "Professional title is required";
    if (generatedId === "new") e.name = "Name cannot generate id 'new'";
    if (!voiceId.trim()) e.voiceId = "Voice ID is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  useEffect(() => {
    if (!isNew) {
      getPersona(personaId)
        .then((p) => {
          if (p) {
            setExisting(p);
            setName(p.name);
            setProfessionalTitle(p.professionalTitle);
            setAvatarImageUrl(p.avatarImageUrl || "");
            setLanguage(p.language || "en");
            setVoiceId(p.voiceId);
            setVoiceRate(p.voiceRate ?? 1.0);
            setVoiceEmotion(p.voiceEmotion || "none");
            setAnimationSet(p.animationSet || "");
          }
        })
        .catch((err) => {
          addToast({ title: "Error", description: err.message, color: "danger" });
          setErrors({ load: err.message });
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [personaId, isNew]);

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    setErrors({});

    try {
      if (isNew) {
        const created = await createPersona({
          name: name.trim(),
          professionalTitle: professionalTitle.trim(),
          voiceId: voiceId.trim(),
          voiceRate,
          language: language.trim() || "en",
          voiceEmotion: voiceEmotion && voiceEmotion !== "none" ? voiceEmotion.trim() : undefined,
          animationSet: animationSet.trim() || undefined,
        });
        if (imageFile) {
          setUploadingImage(true);
          try {
            const url = await uploadPersonaImage(created.id, imageFile);
            await updatePersona(created.id, { avatarImageUrl: url });
          } finally {
            setUploadingImage(false);
          }
        }
        addToast({ title: "Persona created", color: "success" });
        router.push("/avatar-management");
      } else {
        await updatePersona(personaId, {
          name: name.trim(),
          professionalTitle: professionalTitle.trim(),
          voiceId: voiceId.trim(),
          voiceRate,
          language: language.trim() || "en",
          voiceEmotion: voiceEmotion && voiceEmotion !== "none" ? voiceEmotion.trim() : undefined,
          animationSet: animationSet.trim() || undefined,
          avatarImageUrl: avatarImageUrl || undefined,
        });
        addToast({ title: "Persona saved", color: "success" });
        router.push("/avatar-management");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setErrors({ save: msg });
      addToast({ title: "Save failed", description: msg, color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
  };

  const handleUploadImage = async () => {
    if (!existing || !imageFile) return;
    setUploadingImage(true);
    try {
      const url = await uploadPersonaImage(existing.id, imageFile);
      // Persist the new avatarImageUrl to the server
      await updatePersona(existing.id, { avatarImageUrl: url });
      setAvatarImageUrl(url);
      setImageFile(null);
      addToast({ title: "Image uploaded", color: "success" });
    } catch (err) {
      addToast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Failed",
        color: "danger",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!existing || !existing.avatarImageUrl) return;
    try {
      await deletePersonaImage(existing.id);
      // Persist the removal of avatarImageUrl to the server
      await updatePersona(existing.id, { avatarImageUrl: undefined });
      setAvatarImageUrl("");
      addToast({ title: "Image removed", color: "success" });
    } catch (err) {
      addToast({
        title: "Remove failed",
        description: err instanceof Error ? err.message : "Failed",
        color: "danger",
      });
    }
  };

  const handleBack = () => router.push("/avatar-management");
  const handleVoicePreview = () => {
    addToast({
      title: "Voice Preview",
      description: "Preview would use current voice settings (integration TBD).",
      color: "primary",
    });
  };

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
          {isNew ? "Create Persona" : "Edit Persona"}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Persona Details */}
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Persona Details</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                isRequired
                errorMessage={errors.name}
                isInvalid={!!errors.name}
                label="Name"
                placeholder="e.g. Sarah Chen"
                value={name}
                onValueChange={setName}
              />
              {isNew && (
                <Input
                  isReadOnly
                  label="ID (auto-generated)"
                  value={generatedId}
                  classNames={{ input: "font-mono" }}
                  description="Generated from name"
                />
              )}
              <Input
                isRequired
                errorMessage={errors.professionalTitle}
                isInvalid={!!errors.professionalTitle}
                label="Professional Title"
                placeholder="e.g. Chief Executive Officer"
                value={professionalTitle}
                onValueChange={setProfessionalTitle}
              />
              <div>
                <p className="text-sm font-medium mb-2">Avatar Image (optional)</p>
                {!isNew && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <AvatarImage
                      name={name || "Persona"}
                      portrait={previewImageUrl || avatarImageUrl}
                      size={64}
                    />
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      className="hidden"
                      id="persona-image"
                      onChange={handleImageChange}
                    />
                    <label htmlFor="persona-image">
                      <Button as="span" size="sm" variant="bordered" startContent={<ImageIcon className="w-4 h-4" />}>
                        Choose image
                      </Button>
                    </label>
                    {imageFile && (
                      <Button
                        size="sm"
                        color="primary"
                        isLoading={uploadingImage}
                        onPress={handleUploadImage}
                      >
                        Upload
                      </Button>
                    )}
                    {avatarImageUrl && (
                      <Button size="sm" color="danger" variant="flat" onPress={handleRemoveImage}>
                        Remove image
                      </Button>
                    )}
                  </div>
                )}
                {isNew && (
                  <p className="text-sm text-default-500">
                    Save the persona first, then you can add an image.
                  </p>
                )}
              </div>
              <Input
                label="Language"
                description="Default: en"
                value={language}
                onValueChange={setLanguage}
                placeholder="en"
              />
            </CardBody>
          </Card>

          {/* Section 2: Voice Configuration */}
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Voice Configuration</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                isRequired
                errorMessage={errors.voiceId}
                isInvalid={!!errors.voiceId}
                label="Voice ID"
                placeholder="Voice identifier"
                value={voiceId}
                onValueChange={setVoiceId}
              />
              <div>
                <Slider
                  label="Voice Rate"
                  step={0.1}
                  minValue={0.5}
                  maxValue={2}
                  value={voiceRate}
                  onChange={(v) => setVoiceRate(Array.isArray(v) ? v[0] : v)}
                  className="max-w-md"
                />
              </div>
              <Select
                label="Voice Emotion (optional)"
                placeholder="None"
                selectedKeys={voiceEmotion ? [voiceEmotion] : ["none"]}
                onSelectionChange={(keys) => setVoiceEmotion((Array.from(keys)[0] as string) || "none")}
              >
                {VOICE_EMOTIONS.map((e) => (
                  <SelectItem key={e.key} textValue={e.label}>
                    {e.label}
                  </SelectItem>
                ))}
              </Select>
              <Input
                label="Animation Set (optional)"
                placeholder="e.g. default"
                value={animationSet}
                onValueChange={setAnimationSet}
              />
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
              isDisabled={
                !name.trim() ||
                !professionalTitle.trim() ||
                !voiceId.trim() ||
                generatedId === "new"
              }
              isLoading={saving}
              startContent={!saving ? <Save className="w-4 h-4" /> : null}
              onPress={handleSave}
            >
              {saving ? "Saving..." : isNew ? "Create Persona" : "Save"}
            </Button>
            <Button variant="bordered" onPress={handleBack}>
              Cancel
            </Button>
          </div>
        </div>

        {/* Section 3: Preview Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Preview</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex flex-col items-center gap-3">
                <AvatarImage
                  name={name || "Persona"}
                  portrait={previewImageUrl}
                  size={80}
                />
                <div className="text-center">
                  <p className="font-semibold">{name || "Name"}</p>
                  <p className="text-sm text-default-500">{professionalTitle || "Title"}</p>
                </div>
                <Button
                  fullWidth
                  variant="bordered"
                  startContent={<Volume2 className="w-4 h-4" />}
                  onPress={handleVoicePreview}
                >
                  Voice Preview
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
