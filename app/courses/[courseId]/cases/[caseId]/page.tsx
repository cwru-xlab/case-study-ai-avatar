"use client";

import { useState, useEffect, useCallback, use, useRef } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Select, SelectItem } from "@heroui/select";
import { Slider } from "@heroui/slider";
import { Switch } from "@heroui/switch";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { 
  ArrowLeft, Loader2, Save, Play, Globe, Settings, Target, 
  MessageSquare, Shield, Plus, Trash2, GripVertical, Check,
  AlertCircle, X, Pencil
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { Case, ScenarioNode, ScenarioEdge, LearningObjective } from "@/types";
import ScenarioBuilder from "@/components/case-editor/ScenarioBuilder";

// Custom Tab Button component
function TabButton({ 
  isActive, 
  onClick, 
  children 
}: { 
  isActive: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        isActive 
          ? "bg-primary text-white" 
          : "bg-default-100 text-default-600 hover:bg-default-200"
      }`}
    >
      {children}
    </button>
  );
}

export default function CaseEditorPage({ 
  params 
}: { 
  params: Promise<{ courseId: string; caseId: string }> 
}) {
  const { courseId, caseId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("scenario");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Auto-save timer
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchCase = useCallback(async () => {
    try {
      const response = await fetch(`/api/courses/${courseId}/cases/${caseId}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to fetch case");
        return;
      }

      setCaseData(data.case);
    } catch (err) {
      setError("Failed to fetch case");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [courseId, caseId]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  // Auto-save functionality
  const saveCase = useCallback(async (data: Case) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          lastEditedBy: user?.id || "unknown",
          lastEditedByName: user?.name || "Unknown",
        }),
      });

      const result = await response.json();
      if (response.ok) {
        setLastSaved(result.savedAt);
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      console.error("Auto-save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [courseId, caseId, user]);

  const handleCaseUpdate = useCallback((updates: Partial<Case>) => {
    if (!caseData) return;
    
    const updated = { ...caseData, ...updates };
    setCaseData(updated);
    setHasUnsavedChanges(true);

    // Debounced auto-save
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }
    autoSaveTimer.current = setTimeout(() => {
      saveCase(updated);
    }, 2000);
  }, [caseData, saveCase]);

  const handleManualSave = async () => {
    if (!caseData) return;
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }
    await saveCase(caseData);
  };

  const handlePublish = async () => {
    if (!caseData) return;
    
    try {
      const response = await fetch(`/api/courses/${courseId}/cases/${caseId}/publish`, {
        method: "POST",
      });

      const data = await response.json();
      
      if (!response.ok) {
        setError(data.validationErrors?.join(", ") || data.error || "Failed to publish");
        return;
      }

      setCaseData(data.case);
    } catch (err) {
      setError("Failed to publish case");
      console.error(err);
    }
  };

  // Cleanup auto-save timer
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-default-600">Loading case editor...</p>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Case not found</h2>
          <Button color="primary" onPress={() => router.push(`/courses/${courseId}`)}>
            Back to Course
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-default-200 -mx-6 px-6 py-3 mb-6">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="light"
              isIconOnly
              onPress={() => router.push(`/courses/${courseId}`)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{caseData.name}</h1>
                <Chip 
                  size="sm" 
                  variant="flat" 
                  color={caseData.status === "published" ? "success" : caseData.status === "draft" ? "warning" : "default"}
                >
                  {caseData.status}
                </Chip>
              </div>
              <div className="flex items-center gap-2 text-sm text-default-500">
                {saving ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Saving...
                  </span>
                ) : lastSaved ? (
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3 text-success" />
                    Saved {new Date(lastSaved).toLocaleTimeString()}
                  </span>
                ) : hasUnsavedChanges ? (
                  <span className="flex items-center gap-1 text-warning">
                    <AlertCircle className="w-3 h-3" />
                    Unsaved changes
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="bordered"
              startContent={<Save className="w-4 h-4" />}
              onPress={handleManualSave}
              isDisabled={saving || !hasUnsavedChanges}
            >
              Save
            </Button>
            <Button
              variant="bordered"
              startContent={<Play className="w-4 h-4" />}
              onPress={() => router.push(`/courses/${courseId}/cases/${caseId}/preview`)}
            >
              Preview
            </Button>
            {caseData.status === "draft" && (
              <Button
                color="success"
                startContent={<Globe className="w-4 h-4" />}
                onPress={handlePublish}
              >
                Publish
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 flex items-start justify-between">
            <p className="text-danger-700 dark:text-danger-400">{error}</p>
            <Button size="sm" isIconOnly variant="light" onPress={() => setError(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        {/* Custom Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <TabButton isActive={activeTab === "scenario"} onClick={() => setActiveTab("scenario")}>
            <MessageSquare className="w-4 h-4" />
            Scenario Builder
          </TabButton>
          <TabButton isActive={activeTab === "objectives"} onClick={() => setActiveTab("objectives")}>
            <Target className="w-4 h-4" />
            Learning Objectives
          </TabButton>
          <TabButton isActive={activeTab === "settings"} onClick={() => setActiveTab("settings")}>
            <Settings className="w-4 h-4" />
            Case Settings
          </TabButton>
          <TabButton isActive={activeTab === "guardrails"} onClick={() => setActiveTab("guardrails")}>
            <Shield className="w-4 h-4" />
            Guardrails
          </TabButton>
        </div>

        {/* Tab Content */}
        {activeTab === "scenario" && (
          <ScenarioBuilder
            nodes={caseData.nodes}
            edges={caseData.edges}
            startNodeId={caseData.startNodeId}
            onNodesChange={(nodes) => handleCaseUpdate({ nodes })}
            onEdgesChange={(edges) => handleCaseUpdate({ edges })}
            onStartNodeChange={(startNodeId) => handleCaseUpdate({ startNodeId })}
          />
        )}

        {activeTab === "objectives" && (
          <LearningObjectivesEditor
            objectives={caseData.learningObjectives}
            onChange={(objectives) => handleCaseUpdate({ learningObjectives: objectives })}
          />
        )}

        {activeTab === "settings" && (
          <CaseSettingsEditor
            caseData={caseData}
            onChange={handleCaseUpdate}
          />
        )}

        {activeTab === "guardrails" && (
          <GuardrailsEditor
            guardrails={caseData.guardrails}
            onChange={(guardrails) => handleCaseUpdate({ guardrails })}
          />
        )}
      </div>
    </div>
  );
}

// Learning Objectives Editor Component
function LearningObjectivesEditor({
  objectives,
  onChange,
}: {
  objectives: LearningObjective[];
  onChange: (objectives: LearningObjective[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const addObjective = () => {
    const newObjective: LearningObjective = {
      id: `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: "New Objective",
      description: "",
      type: "knowledge",
      weight: 5,
    };
    onChange([...objectives, newObjective]);
    setEditingId(newObjective.id);
  };

  const updateObjective = (id: string, updates: Partial<LearningObjective>) => {
    onChange(objectives.map(obj => obj.id === id ? { ...obj, ...updates } : obj));
  };

  const deleteObjective = (id: string) => {
    onChange(objectives.filter(obj => obj.id !== id));
  };

  return (
    <Card>
      <CardHeader className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Learning Objectives</h3>
          <p className="text-sm text-default-500">Define what students should learn from this case</p>
        </div>
        <Button color="primary" size="sm" startContent={<Plus className="w-4 h-4" />} onPress={addObjective}>
          Add Objective
        </Button>
      </CardHeader>
      <CardBody>
        {objectives.length === 0 ? (
          <div className="text-center py-8 text-default-500">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No learning objectives defined yet.</p>
            <p className="text-sm">Add objectives to track student progress.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {objectives.map((obj, index) => (
              <Card key={obj.id} className="bg-default-50">
                <CardBody className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center gap-2 text-default-400">
                      <GripVertical className="w-4 h-4" />
                      <span className="font-mono text-sm">{index + 1}</span>
                    </div>
                    <div className="flex-1 space-y-3">
                      <Input
                        value={obj.title}
                        onValueChange={(v) => updateObjective(obj.id, { title: v })}
                        placeholder="Objective title"
                        variant="bordered"
                        size="sm"
                      />
                      <Textarea
                        value={obj.description}
                        onValueChange={(v) => updateObjective(obj.id, { description: v })}
                        placeholder="Describe what the student should learn..."
                        variant="bordered"
                        size="sm"
                        minRows={2}
                      />
                      <div className="flex gap-4">
                        <Select
                          selectedKeys={[obj.type]}
                          onSelectionChange={(keys) => updateObjective(obj.id, { type: Array.from(keys)[0] as any })}
                          size="sm"
                          variant="bordered"
                          className="w-40"
                          label="Type"
                        >
                          <SelectItem key="knowledge">Knowledge</SelectItem>
                          <SelectItem key="skill">Skill</SelectItem>
                          <SelectItem key="attitude">Attitude</SelectItem>
                        </Select>
                        <div className="flex-1">
                          <label className="text-xs text-default-500">Weight: {obj.weight}</label>
                          <Slider
                            size="sm"
                            step={1}
                            minValue={1}
                            maxValue={10}
                            value={obj.weight}
                            onChange={(v) => updateObjective(obj.id, { weight: v as number })}
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={() => deleteObjective(obj.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// Case Settings Editor Component
function CaseSettingsEditor({
  caseData,
  onChange,
}: {
  caseData: Case;
  onChange: (updates: Partial<Case>) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Basic Information</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Case Name</label>
            <Input
              value={caseData.name}
              onValueChange={(v) => onChange({ name: v })}
              variant="bordered"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <Textarea
              value={caseData.description}
              onValueChange={(v) => onChange({ description: v })}
              variant="bordered"
              minRows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Difficulty</label>
              <Select
                selectedKeys={[caseData.difficulty]}
                onSelectionChange={(keys) => onChange({ difficulty: Array.from(keys)[0] as Case["difficulty"] })}
                variant="bordered"
              >
                <SelectItem key="beginner">Beginner</SelectItem>
                <SelectItem key="intermediate">Intermediate</SelectItem>
                <SelectItem key="advanced">Advanced</SelectItem>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Duration: {caseData.estimatedDuration} min
              </label>
              <Slider
                size="sm"
                step={5}
                minValue={5}
                maxValue={60}
                value={caseData.estimatedDuration}
                onChange={(v) => onChange({ estimatedDuration: v as number })}
                className="mt-4"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Avatar Personality</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Case-Specific Context</label>
            <Textarea
              value={caseData.avatarConfig.caseContext}
              onValueChange={(v) => onChange({ 
                avatarConfig: { ...caseData.avatarConfig, caseContext: v } 
              })}
              placeholder="Additional context for the avatar in this scenario..."
              variant="bordered"
              minRows={3}
            />
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">
                Formality: {caseData.avatarConfig.personalityTraits.formality}/10
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-default-400">Casual</span>
                <Slider
                  size="sm"
                  step={1}
                  minValue={1}
                  maxValue={10}
                  value={caseData.avatarConfig.personalityTraits.formality}
                  onChange={(v) => onChange({
                    avatarConfig: {
                      ...caseData.avatarConfig,
                      personalityTraits: { ...caseData.avatarConfig.personalityTraits, formality: v as number }
                    }
                  })}
                  className="flex-1"
                />
                <span className="text-xs text-default-400">Formal</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">
                Patience: {caseData.avatarConfig.personalityTraits.patience}/10
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-default-400">Quick</span>
                <Slider
                  size="sm"
                  step={1}
                  minValue={1}
                  maxValue={10}
                  value={caseData.avatarConfig.personalityTraits.patience}
                  onChange={(v) => onChange({
                    avatarConfig: {
                      ...caseData.avatarConfig,
                      personalityTraits: { ...caseData.avatarConfig.personalityTraits, patience: v as number }
                    }
                  })}
                  className="flex-1"
                />
                <span className="text-xs text-default-400">Patient</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">
                Empathy: {caseData.avatarConfig.personalityTraits.empathy}/10
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-default-400">Neutral</span>
                <Slider
                  size="sm"
                  step={1}
                  minValue={1}
                  maxValue={10}
                  value={caseData.avatarConfig.personalityTraits.empathy}
                  onChange={(v) => onChange({
                    avatarConfig: {
                      ...caseData.avatarConfig,
                      personalityTraits: { ...caseData.avatarConfig.personalityTraits, empathy: v as number }
                    }
                  })}
                  className="flex-1"
                />
                <span className="text-xs text-default-400">Empathetic</span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Guardrails Editor Component
function GuardrailsEditor({
  guardrails,
  onChange,
}: {
  guardrails: Case["guardrails"];
  onChange: (guardrails: Case["guardrails"]) => void;
}) {
  const [newTopic, setNewTopic] = useState("");

  const addBlockedTopic = () => {
    if (newTopic.trim()) {
      onChange({
        ...guardrails,
        blockedTopics: [...guardrails.blockedTopics, newTopic.trim()],
      });
      setNewTopic("");
    }
  };

  const removeBlockedTopic = (topic: string) => {
    onChange({
      ...guardrails,
      blockedTopics: guardrails.blockedTopics.filter(t => t !== topic),
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Content Filtering</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Blocked Topics</label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newTopic}
                onValueChange={setNewTopic}
                placeholder="Add a topic to block..."
                variant="bordered"
                size="sm"
                onKeyDown={(e) => e.key === "Enter" && addBlockedTopic()}
              />
              <Button size="sm" color="primary" onPress={addBlockedTopic}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {guardrails.blockedTopics.map((topic) => (
                <Chip
                  key={topic}
                  onClose={() => removeBlockedTopic(topic)}
                  variant="flat"
                  color="danger"
                >
                  {topic}
                </Chip>
              ))}
              {guardrails.blockedTopics.length === 0 && (
                <span className="text-sm text-default-400">No blocked topics</span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Off-Topic Response</label>
            <Textarea
              value={guardrails.offTopicResponse}
              onValueChange={(v) => onChange({ ...guardrails, offTopicResponse: v })}
              placeholder="Response when user asks about blocked topics..."
              variant="bordered"
              minRows={2}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Response Settings</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Max Response Length: {guardrails.maxResponseLength} characters
            </label>
            <Slider
              size="sm"
              step={50}
              minValue={100}
              maxValue={1000}
              value={guardrails.maxResponseLength}
              onChange={(v) => onChange({ ...guardrails, maxResponseLength: v as number })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Require Fact Checking</p>
              <p className="text-sm text-default-500">Validate responses against knowledge base</p>
            </div>
            <Switch
              isSelected={guardrails.requireFactCheck}
              onValueChange={(v) => onChange({ ...guardrails, requireFactCheck: v })}
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
