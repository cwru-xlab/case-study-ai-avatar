"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { Select, SelectItem } from "@heroui/select";
import { Slider } from "@heroui/slider";
import { Switch } from "@heroui/switch";
import { 
  ArrowLeft, Save, Trash2, Globe, FileText, Loader2, Play,
  MessageSquare, Target, Settings, Shield, Plus, GripVertical,
  Check, AlertCircle
} from "lucide-react";
import AvatarImage from "@/components/AvatarImage";
import ScenarioBuilder from "@/components/case-editor/ScenarioBuilder";
import type { ScenarioNode, ScenarioEdge, LearningObjective } from "@/types";

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
  // Case authoring fields
  scenarioNodes?: ScenarioNode[];
  scenarioEdges?: ScenarioEdge[];
  startNodeId?: string;
  learningObjectives?: LearningObjective[];
  difficulty?: "beginner" | "intermediate" | "advanced";
  estimatedDuration?: number;
  caseContext?: string;
  personalityTraits?: {
    formality: number;
    patience: number;
    empathy: number;
    directness: number;
  };
  guardrails?: {
    blockedTopics: string[];
    offTopicResponse: string;
    maxResponseLength: number;
    requireFactCheck: boolean;
  };
}

// Tab Button component
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

export default function EditAvatarPage() {
  const params = useParams();
  const router = useRouter();
  const avatarId = params["avatar-id"] as string;

  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("basic");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [description, setDescription] = useState("");
  
  // Case authoring state
  const [scenarioNodes, setScenarioNodes] = useState<ScenarioNode[]>([]);
  const [scenarioEdges, setScenarioEdges] = useState<ScenarioEdge[]>([]);
  const [startNodeId, setStartNodeId] = useState("");
  const [learningObjectives, setLearningObjectives] = useState<LearningObjective[]>([]);
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [estimatedDuration, setEstimatedDuration] = useState(15);
  const [caseContext, setCaseContext] = useState("");
  const [personalityTraits, setPersonalityTraits] = useState({
    formality: 5,
    patience: 5,
    empathy: 5,
    directness: 5,
  });
  const [guardrails, setGuardrails] = useState({
    blockedTopics: [] as string[],
    offTopicResponse: "I'm sorry, but I can only discuss topics related to this scenario.",
    maxResponseLength: 500,
    requireFactCheck: false,
  });

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
        
        // Load case authoring data
        if (av.scenarioNodes) setScenarioNodes(av.scenarioNodes);
        if (av.scenarioEdges) setScenarioEdges(av.scenarioEdges);
        if (av.startNodeId) setStartNodeId(av.startNodeId);
        if (av.learningObjectives) setLearningObjectives(av.learningObjectives);
        if (av.difficulty) setDifficulty(av.difficulty);
        if (av.estimatedDuration) setEstimatedDuration(av.estimatedDuration);
        if (av.caseContext) setCaseContext(av.caseContext);
        if (av.personalityTraits) setPersonalityTraits(av.personalityTraits);
        if (av.guardrails) setGuardrails(av.guardrails);
        
        // Initialize default nodes if none exist
        if (!av.scenarioNodes || av.scenarioNodes.length === 0) {
          const openingId = `node_${Date.now()}_opening`;
          const endingId = `node_${Date.now()}_ending`;
          const defaultNodes: ScenarioNode[] = [
            {
              id: openingId,
              type: "opening",
              label: "Opening",
              content: "Hello! How can I help you today?",
              position: { x: 250, y: 50 },
              config: {},
            },
            {
              id: endingId,
              type: "ending",
              label: "Ending",
              content: "Thank you for the conversation!",
              position: { x: 250, y: 300 },
              config: {},
            },
          ];
          const defaultEdges: ScenarioEdge[] = [
            { id: `edge_${Date.now()}`, sourceNodeId: openingId, targetNodeId: endingId },
          ];
          setScenarioNodes(defaultNodes);
          setScenarioEdges(defaultEdges);
          setStartNodeId(openingId);
        }
      } catch (err) {
        setError("Failed to fetch avatar");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchAvatar();
  }, [avatarId]);

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
          // Case authoring fields
          scenarioNodes,
          scenarioEdges,
          startNodeId,
          learningObjectives,
          difficulty,
          estimatedDuration,
          caseContext,
          personalityTraits,
          guardrails,
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
  }, [avatar, avatarId, name, systemPrompt, description, scenarioNodes, scenarioEdges, startNodeId, learningObjectives, difficulty, estimatedDuration, caseContext, personalityTraits, guardrails]);

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
        <div className="flex items-center justify-between max-w-7xl mx-auto">
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
        <div className="max-w-7xl mx-auto mb-6 bg-danger-50 border border-danger-200 rounded-lg p-4">
          <p className="text-danger-700">{error}</p>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <TabButton isActive={activeTab === "basic"} onClick={() => setActiveTab("basic")}>
            <Settings className="w-4 h-4" />Basic Info
          </TabButton>
          <TabButton isActive={activeTab === "scenario"} onClick={() => setActiveTab("scenario")}>
            <MessageSquare className="w-4 h-4" />Scenario Builder
          </TabButton>
          <TabButton isActive={activeTab === "objectives"} onClick={() => setActiveTab("objectives")}>
            <Target className="w-4 h-4" />Learning Objectives
          </TabButton>
          <TabButton isActive={activeTab === "personality"} onClick={() => setActiveTab("personality")}>
            <Settings className="w-4 h-4" />Personality
          </TabButton>
          <TabButton isActive={activeTab === "guardrails"} onClick={() => setActiveTab("guardrails")}>
            <Shield className="w-4 h-4" />Guardrails
          </TabButton>
        </div>

        {/* Basic Info Tab */}
        {activeTab === "basic" && (
          <Card>
            <CardBody className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Avatar Name</label>
                <Input value={name} onValueChange={(v) => { setName(v); triggerAutoSave(); }} variant="bordered" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">System Prompt</label>
                <Textarea value={systemPrompt} onValueChange={(v) => { setSystemPrompt(v); triggerAutoSave(); }} variant="bordered" minRows={4} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea value={description} onValueChange={(v) => { setDescription(v); triggerAutoSave(); }} variant="bordered" minRows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Difficulty</label>
                  <Select selectedKeys={[difficulty]} onSelectionChange={(k) => { setDifficulty(Array.from(k)[0] as any); triggerAutoSave(); }} variant="bordered">
                    <SelectItem key="beginner">Beginner</SelectItem>
                    <SelectItem key="intermediate">Intermediate</SelectItem>
                    <SelectItem key="advanced">Advanced</SelectItem>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Duration: {estimatedDuration} min</label>
                  <Slider size="sm" step={5} minValue={5} maxValue={60} value={estimatedDuration} onChange={(v) => { setEstimatedDuration(v as number); triggerAutoSave(); }} className="mt-4" />
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Scenario Builder Tab */}
        {activeTab === "scenario" && (
          <ScenarioBuilder
            nodes={scenarioNodes}
            edges={scenarioEdges}
            startNodeId={startNodeId}
            onNodesChange={(n) => { setScenarioNodes(n); triggerAutoSave(); }}
            onEdgesChange={(e) => { setScenarioEdges(e); triggerAutoSave(); }}
            onStartNodeChange={(id) => { setStartNodeId(id); triggerAutoSave(); }}
          />
        )}

        {/* Learning Objectives Tab */}
        {activeTab === "objectives" && (
          <LearningObjectivesEditor
            objectives={learningObjectives}
            onChange={(o) => { setLearningObjectives(o); triggerAutoSave(); }}
          />
        )}

        {/* Personality Tab */}
        {activeTab === "personality" && (
          <Card>
            <CardHeader><h3 className="text-lg font-semibold">Avatar Personality</h3></CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Case-Specific Context</label>
                <Textarea value={caseContext} onValueChange={(v) => { setCaseContext(v); triggerAutoSave(); }} placeholder="Additional context for this scenario..." variant="bordered" minRows={3} />
              </div>
              {["formality", "patience", "empathy", "directness"].map((trait) => (
                <div key={trait}>
                  <label className="text-sm font-medium capitalize">{trait}: {personalityTraits[trait as keyof typeof personalityTraits]}/10</label>
                  <Slider size="sm" step={1} minValue={1} maxValue={10} value={personalityTraits[trait as keyof typeof personalityTraits]} onChange={(v) => { setPersonalityTraits({ ...personalityTraits, [trait]: v as number }); triggerAutoSave(); }} />
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        {/* Guardrails Tab */}
        {activeTab === "guardrails" && (
          <GuardrailsEditor guardrails={guardrails} onChange={(g) => { setGuardrails(g); triggerAutoSave(); }} />
        )}
      </div>
    </div>
  );
}

// Learning Objectives Editor
function LearningObjectivesEditor({ objectives, onChange }: { objectives: LearningObjective[]; onChange: (o: LearningObjective[]) => void }) {
  const addObjective = () => {
    onChange([...objectives, { id: `obj_${Date.now()}`, title: "New Objective", description: "", type: "knowledge", weight: 5 }]);
  };
  return (
    <Card>
      <CardHeader className="flex justify-between">
        <div><h3 className="text-lg font-semibold">Learning Objectives</h3></div>
        <Button size="sm" color="primary" startContent={<Plus className="w-4 h-4" />} onPress={addObjective}>Add</Button>
      </CardHeader>
      <CardBody>
        {objectives.length === 0 ? (
          <p className="text-center text-default-500 py-8">No objectives yet. Add one to track student progress.</p>
        ) : (
          <div className="space-y-4">
            {objectives.map((obj, i) => (
              <Card key={obj.id} className="bg-default-50">
                <CardBody className="p-4">
                  <div className="flex gap-4">
                    <span className="text-default-400">{i + 1}</span>
                    <div className="flex-1 space-y-2">
                      <Input size="sm" value={obj.title} onValueChange={(v) => onChange(objectives.map(o => o.id === obj.id ? { ...o, title: v } : o))} variant="bordered" />
                      <Textarea size="sm" value={obj.description} onValueChange={(v) => onChange(objectives.map(o => o.id === obj.id ? { ...o, description: v } : o))} variant="bordered" minRows={2} />
                    </div>
                    <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => onChange(objectives.filter(o => o.id !== obj.id))}>
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

// Guardrails Editor
function GuardrailsEditor({ guardrails, onChange }: { guardrails: Avatar["guardrails"]; onChange: (g: NonNullable<Avatar["guardrails"]>) => void }) {
  const [newTopic, setNewTopic] = useState("");
  if (!guardrails) return null;
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><h3 className="text-lg font-semibold">Blocked Topics</h3></CardHeader>
        <CardBody className="space-y-4">
          <div className="flex gap-2">
            <Input size="sm" value={newTopic} onValueChange={setNewTopic} placeholder="Add topic..." variant="bordered" onKeyDown={(e) => { if (e.key === "Enter" && newTopic.trim()) { onChange({ ...guardrails, blockedTopics: [...guardrails.blockedTopics, newTopic.trim()] }); setNewTopic(""); }}} />
            <Button size="sm" onPress={() => { if (newTopic.trim()) { onChange({ ...guardrails, blockedTopics: [...guardrails.blockedTopics, newTopic.trim()] }); setNewTopic(""); }}}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {guardrails.blockedTopics.map((t) => (
              <Chip key={t} onClose={() => onChange({ ...guardrails, blockedTopics: guardrails.blockedTopics.filter(x => x !== t) })} variant="flat" color="danger">{t}</Chip>
            ))}
          </div>
          <Textarea value={guardrails.offTopicResponse} onValueChange={(v) => onChange({ ...guardrails, offTopicResponse: v })} label="Off-topic Response" variant="bordered" />
        </CardBody>
      </Card>
      <Card>
        <CardHeader><h3 className="text-lg font-semibold">Response Settings</h3></CardHeader>
        <CardBody className="space-y-4">
          <div>
            <label className="text-sm">Max Length: {guardrails.maxResponseLength}</label>
            <Slider size="sm" step={50} minValue={100} maxValue={1000} value={guardrails.maxResponseLength} onChange={(v) => onChange({ ...guardrails, maxResponseLength: v as number })} />
          </div>
          <div className="flex justify-between items-center">
            <span>Require Fact Check</span>
            <Switch isSelected={guardrails.requireFactCheck} onValueChange={(v) => onChange({ ...guardrails, requireFactCheck: v })} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
