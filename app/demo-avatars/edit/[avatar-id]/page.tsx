"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Select, SelectItem } from "@heroui/select";
import { 
  ArrowLeft, Save, Trash2, Loader2,
  Check, AlertCircle, Link, ExternalLink
} from "lucide-react";
import AvatarImage from "@/components/AvatarImage";

interface Avatar {
  id: string;
  name: string;
  systemPrompt: string;
  description?: string;
  createdBy: string;
  lastEditedBy: string;
  createdAt: string;
  lastEditedAt: string;
  published?: boolean;
  linkedCaseId?: string;
  linkedCourseId?: string;
}

interface LinkedCase {
  id: string;
  courseId: string;
  courseName: string;
  name: string;
  description: string;
  difficulty: string;
  status: string;
}

export default function EditAvatarPage() {
  const params = useParams();
  const router = useRouter();
  const avatarId = params["avatar-id"] as string;

  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [description, setDescription] = useState("");

  // Linked case state
  const [linkedCaseId, setLinkedCaseId] = useState<string>("");
  const [linkedCourseId, setLinkedCourseId] = useState<string>("");
  const [availableCases, setAvailableCases] = useState<LinkedCase[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);

  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Fetch avatar on mount
  useEffect(() => {
    async function fetchAvatar() {
      try {
        const response = await fetch(`/api/demo-avatars/${avatarId}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Failed to fetch avatar");
          return;
        }

        const av = data.avatar;
        setAvatar(av);
        setName(av.name);
        setSystemPrompt(av.systemPrompt);
        setDescription(av.description || "");
        
        // Load linked case data
        if (av.linkedCaseId) setLinkedCaseId(av.linkedCaseId);
        if (av.linkedCourseId) setLinkedCourseId(av.linkedCourseId);
      } catch (err) {
        setError("Failed to fetch avatar");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchAvatar();
  }, [avatarId]);

  // Fetch available cases
  useEffect(() => {
    async function fetchCases() {
      setLoadingCases(true);
      try {
        const response = await fetch("/api/cases");
        const data = await response.json();
        if (response.ok && data.cases) {
          setAvailableCases(data.cases);
        }
      } catch (err) {
        console.error("Failed to fetch cases:", err);
      } finally {
        setLoadingCases(false);
      }
    }
    fetchCases();
  }, []);

  const handleSave = useCallback(async () => {
    if (!avatar) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/demo-avatars/${avatarId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          systemPrompt,
          description,
          lastEditedBy: "Current User",
          linkedCaseId: linkedCaseId || null,
          linkedCourseId: linkedCourseId || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to save avatar");
        return;
      }

      setAvatar(data.avatar);
      setLastSaved(new Date().toISOString());
      setHasUnsavedChanges(false);
    } catch (err) {
      setError("Failed to save avatar");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [avatar, avatarId, name, systemPrompt, description, linkedCaseId, linkedCourseId]);

  // Auto-save on changes
  const triggerAutoSave = useCallback(() => {
    setHasUnsavedChanges(true);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      handleSave();
    }, 3000);
  }, [handleSave]);

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  const handleDelete = async () => {
    if (!avatar) return;
    const confirmed = confirm(`Are you sure you want to delete "${avatar.name}"?`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/demo-avatars/${avatarId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to delete avatar");
        return;
      }
      router.push("/demo-avatars");
    } catch (err) {
      setError("Failed to delete avatar");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!avatar) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Avatar Not Found</h1>
          <Button color="primary" onPress={() => router.push("/demo-avatars")}>Back to Avatars</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-default-200 -mx-6 px-6 py-3 mb-6">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <Button variant="light" isIconOnly onPress={() => router.push("/demo-avatars")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <AvatarImage name={avatar.name} size={40} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{name || avatar.name}</h1>
                <Chip size="sm" variant="flat" color={avatar.published ? "success" : "warning"}>
                  {avatar.published ? "Published" : "Draft"}
                </Chip>
              </div>
              <div className="flex items-center gap-2 text-sm text-default-500">
                {saving ? (
                  <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Saving...</span>
                ) : lastSaved ? (
                  <span className="flex items-center gap-1 text-success"><Check className="w-3 h-3" />Saved</span>
                ) : hasUnsavedChanges ? (
                  <span className="flex items-center gap-1 text-warning"><AlertCircle className="w-3 h-3" />Unsaved</span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="bordered" color="danger" startContent={<Trash2 className="w-4 h-4" />} onPress={handleDelete} isDisabled={deleting}>
              Delete
            </Button>
            <Button color="primary" startContent={<Save className="w-4 h-4" />} onPress={handleSave} isDisabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-4xl mx-auto mb-6 bg-danger-50 border border-danger-200 rounded-lg p-4">
          <p className="text-danger-700">{error}</p>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Avatar Info Card */}
        <Card>
          <CardBody className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Avatar Name</label>
              <Input 
                value={name} 
                onValueChange={(v) => { setName(v); triggerAutoSave(); }} 
                variant="bordered" 
                placeholder="Enter avatar name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">System Prompt</label>
              <Textarea 
                value={systemPrompt} 
                onValueChange={(v) => { setSystemPrompt(v); triggerAutoSave(); }} 
                variant="bordered" 
                minRows={6}
                placeholder="Enter the system prompt that defines this avatar's behavior..."
              />
              <p className="text-xs text-default-400 mt-1">
                This prompt defines how the avatar behaves and responds during conversations.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <Textarea 
                value={description} 
                onValueChange={(v) => { setDescription(v); triggerAutoSave(); }} 
                variant="bordered" 
                minRows={2}
                placeholder="Brief description of this avatar..."
              />
            </div>
          </CardBody>
        </Card>

        {/* Linked Case Card */}
        <Card>
          <CardBody className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Link className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Linked Case</h3>
            </div>
            <p className="text-sm text-default-500 mb-4">
              Link this avatar to a case from the Courses system. The case defines the scenario, learning objectives, and conversation flow.
            </p>
            
            {loadingCases ? (
              <div className="flex items-center gap-2 text-default-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading available cases...
              </div>
            ) : availableCases.length === 0 ? (
              <div className="bg-default-100 rounded-lg p-4 text-center">
                <p className="text-default-500 mb-2">No cases available.</p>
                <p className="text-sm text-default-400 mb-3">Create a case in the Courses section first.</p>
                <Button 
                  size="sm" 
                  color="primary"
                  variant="flat"
                  onPress={() => router.push("/courses")}
                >
                  Go to Courses
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Select
                  label="Select a Case"
                  placeholder="Choose a case to link..."
                  selectedKeys={linkedCaseId ? [`${linkedCourseId}|${linkedCaseId}`] : []}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    if (selected) {
                      const [courseId, caseId] = selected.split("|");
                      setLinkedCourseId(courseId);
                      setLinkedCaseId(caseId);
                    } else {
                      setLinkedCourseId("");
                      setLinkedCaseId("");
                    }
                    triggerAutoSave();
                  }}
                  variant="bordered"
                >
                  {availableCases.map((c) => (
                    <SelectItem 
                      key={`${c.courseId}|${c.id}`}
                      textValue={`${c.courseName} - ${c.name}`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-default-400">
                          {c.courseName} • {c.difficulty} • {c.status}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </Select>
                
                {linkedCaseId && (
                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-primary-700">
                          {availableCases.find(c => c.id === linkedCaseId)?.name || "Linked Case"}
                        </p>
                        <p className="text-sm text-primary-600">
                          {availableCases.find(c => c.id === linkedCaseId)?.courseName}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          startContent={<ExternalLink className="w-4 h-4" />}
                          onPress={() => router.push(`/courses/${linkedCourseId}/cases/${linkedCaseId}`)}
                        >
                          Edit Case
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          color="danger"
                          onPress={() => {
                            setLinkedCaseId("");
                            setLinkedCourseId("");
                            triggerAutoSave();
                          }}
                        >
                          Unlink
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
