"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Chip } from "@heroui/chip";
import { 
  Plus, Trash2, MessageSquare, HelpCircle, Ear, GitBranch, 
  ThumbsUp, Flag, CheckCircle, X, Play, GripVertical, Link2
} from "lucide-react";
import type { ScenarioNode, ScenarioEdge, ScenarioNodeType } from "@/types";

interface ScenarioBuilderProps {
  nodes: ScenarioNode[];
  edges: ScenarioEdge[];
  startNodeId: string;
  onNodesChange: (nodes: ScenarioNode[]) => void;
  onEdgesChange: (edges: ScenarioEdge[]) => void;
  onStartNodeChange: (startNodeId: string) => void;
}

const NODE_TYPES: { type: ScenarioNodeType; label: string; icon: any; color: string }[] = [
  { type: "opening", label: "Opening", icon: Play, color: "bg-green-500" },
  { type: "dialogue", label: "Dialogue", icon: MessageSquare, color: "bg-blue-500" },
  { type: "question", label: "Question", icon: HelpCircle, color: "bg-purple-500" },
  { type: "listen", label: "Listen", icon: Ear, color: "bg-yellow-500" },
  { type: "branch", label: "Branch", icon: GitBranch, color: "bg-orange-500" },
  { type: "feedback", label: "Feedback", icon: ThumbsUp, color: "bg-pink-500" },
  { type: "checkpoint", label: "Checkpoint", icon: Flag, color: "bg-cyan-500" },
  { type: "ending", label: "Ending", icon: CheckCircle, color: "bg-red-500" },
];

function generateId(prefix: string = "node"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default function ScenarioBuilder({
  nodes,
  edges,
  startNodeId,
  onNodesChange,
  onEdgesChange,
  onStartNodeChange,
}: ScenarioBuilderProps) {
  const [selectedNode, setSelectedNode] = useState<ScenarioNode | null>(null);
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const getNodeTypeInfo = (type: ScenarioNodeType) => {
    return NODE_TYPES.find(t => t.type === type) || NODE_TYPES[0];
  };

  const addNode = (type: ScenarioNodeType) => {
    const typeInfo = getNodeTypeInfo(type);
    const newNode: ScenarioNode = {
      id: generateId(),
      type,
      label: typeInfo.label,
      content: "",
      position: { x: 250, y: nodes.length * 120 + 50 },
      config: {},
    };
    
    onNodesChange([...nodes, newNode]);
    setIsAddNodeOpen(false);
    setSelectedNode(newNode);
  };

  const updateNode = (nodeId: string, updates: Partial<ScenarioNode>) => {
    onNodesChange(nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n));
    if (selectedNode?.id === nodeId) {
      setSelectedNode({ ...selectedNode, ...updates });
    }
  };

  const deleteNode = (nodeId: string) => {
    if (nodeId === startNodeId) {
      return; // Can't delete start node
    }
    onNodesChange(nodes.filter(n => n.id !== nodeId));
    onEdgesChange(edges.filter(e => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  };

  const addEdge = (sourceId: string, targetId: string) => {
    // Check if edge already exists
    const exists = edges.some(e => e.sourceNodeId === sourceId && e.targetNodeId === targetId);
    if (exists || sourceId === targetId) return;

    const newEdge: ScenarioEdge = {
      id: generateId("edge"),
      sourceNodeId: sourceId,
      targetNodeId: targetId,
    };
    onEdgesChange([...edges, newEdge]);
  };

  const deleteEdge = (edgeId: string) => {
    onEdgesChange(edges.filter(e => e.id !== edgeId));
  };

  const handleNodeDragStart = (e: React.MouseEvent, node: ScenarioNode) => {
    if ((e.target as HTMLElement).closest('.node-actions')) return;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
    setSelectedNode(node);
  };

  const handleNodeDrag = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !selectedNode || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const newX = e.clientX - canvasRect.left - dragOffset.x;
    const newY = e.clientY - canvasRect.top - dragOffset.y;

    updateNode(selectedNode.id, {
      position: {
        x: Math.max(0, Math.min(newX, canvasRect.width - 200)),
        y: Math.max(0, Math.min(newY, canvasRect.height - 100)),
      },
    });
  }, [isDragging, selectedNode, dragOffset]);

  const handleNodeDragEnd = () => {
    setIsDragging(false);
  };

  const handleConnectClick = (nodeId: string) => {
    if (connectingFrom === null) {
      setConnectingFrom(nodeId);
    } else if (connectingFrom !== nodeId) {
      addEdge(connectingFrom, nodeId);
      setConnectingFrom(null);
    } else {
      setConnectingFrom(null);
    }
  };

  // Get edges for a node
  const getOutgoingEdges = (nodeId: string) => edges.filter(e => e.sourceNodeId === nodeId);
  const getIncomingEdges = (nodeId: string) => edges.filter(e => e.targetNodeId === nodeId);

  return (
    <div className="flex gap-6 h-[600px]">
      {/* Canvas */}
      <div className="flex-1 relative">
        <Card className="h-full">
          <CardBody className="p-0 overflow-hidden">
            {/* Toolbar */}
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              <Button
                size="sm"
                color="primary"
                startContent={<Plus className="w-4 h-4" />}
                onPress={() => setIsAddNodeOpen(true)}
              >
                Add Node
              </Button>
              {connectingFrom && (
                <Chip color="warning" onClose={() => setConnectingFrom(null)}>
                  Connecting from node... Click target
                </Chip>
              )}
            </div>

            {/* Canvas Area */}
            <div
              ref={canvasRef}
              className="w-full h-full bg-default-50 relative overflow-auto"
              onMouseMove={handleNodeDrag}
              onMouseUp={handleNodeDragEnd}
              onMouseLeave={handleNodeDragEnd}
              style={{ 
                backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            >
              {/* SVG for edges */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minHeight: '100%', minWidth: '100%' }}>
                {edges.map((edge) => {
                  const sourceNode = nodes.find(n => n.id === edge.sourceNodeId);
                  const targetNode = nodes.find(n => n.id === edge.targetNodeId);
                  if (!sourceNode || !targetNode) return null;

                  const x1 = sourceNode.position.x + 100;
                  const y1 = sourceNode.position.y + 40;
                  const x2 = targetNode.position.x + 100;
                  const y2 = targetNode.position.y;

                  return (
                    <g key={edge.id}>
                      <path
                        d={`M ${x1} ${y1} C ${x1} ${y1 + 50}, ${x2} ${y2 - 50}, ${x2} ${y2}`}
                        stroke="#6366f1"
                        strokeWidth="2"
                        fill="none"
                        markerEnd="url(#arrowhead)"
                      />
                    </g>
                  );
                })}
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
                  </marker>
                </defs>
              </svg>

              {/* Nodes */}
              {nodes.map((node) => {
                const typeInfo = getNodeTypeInfo(node.type);
                const Icon = typeInfo.icon;
                const isStart = node.id === startNodeId;
                const isSelected = selectedNode?.id === node.id;
                const isConnecting = connectingFrom === node.id;

                return (
                  <div
                    key={node.id}
                    className={`absolute w-[200px] rounded-lg shadow-md cursor-move transition-shadow ${
                      isSelected ? 'ring-2 ring-primary shadow-lg' : ''
                    } ${isConnecting ? 'ring-2 ring-warning' : ''}`}
                    style={{
                      left: node.position.x,
                      top: node.position.y,
                      backgroundColor: 'white',
                    }}
                    onMouseDown={(e) => handleNodeDragStart(e, node)}
                    onClick={() => setSelectedNode(node)}
                  >
                    {/* Node Header */}
                    <div className={`${typeInfo.color} text-white px-3 py-2 rounded-t-lg flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{node.label}</span>
                      </div>
                      {isStart && (
                        <Chip size="sm" variant="flat" className="bg-white/20 text-white text-xs">
                          Start
                        </Chip>
                      )}
                    </div>
                    
                    {/* Node Content */}
                    <div className="p-3">
                      <p className="text-xs text-default-600 line-clamp-2">
                        {node.content || "No content"}
                      </p>
                    </div>

                    {/* Node Actions */}
                    <div className="node-actions px-3 pb-2 flex justify-between items-center">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="flat"
                          isIconOnly
                          className="w-6 h-6 min-w-0"
                          onPress={() => handleConnectClick(node.id)}
                        >
                          <Link2 className="w-3 h-3" />
                        </Button>
                      </div>
                      {!isStart && (
                        <Button
                          size="sm"
                          variant="flat"
                          color="danger"
                          isIconOnly
                          className="w-6 h-6 min-w-0"
                          onPress={() => deleteNode(node.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Properties Panel */}
      <div className="w-80">
        <Card className="h-full">
          <CardBody className="p-4">
            {selectedNode ? (
              <NodePropertiesPanel
                node={selectedNode}
                isStartNode={selectedNode.id === startNodeId}
                outgoingEdges={getOutgoingEdges(selectedNode.id)}
                nodes={nodes}
                onUpdate={(updates) => updateNode(selectedNode.id, updates)}
                onSetAsStart={() => onStartNodeChange(selectedNode.id)}
                onDeleteEdge={deleteEdge}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-center text-default-400">
                <div>
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a node to edit its properties</p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Add Node Modal */}
      <Modal isOpen={isAddNodeOpen} onOpenChange={setIsAddNodeOpen}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Add Node</ModalHeader>
              <ModalBody>
                <div className="grid grid-cols-2 gap-3">
                  {NODE_TYPES.map((nodeType) => {
                    const Icon = nodeType.icon;
                    return (
                      <Button
                        key={nodeType.type}
                        variant="bordered"
                        className="h-auto py-4 flex-col gap-2"
                        onPress={() => addNode(nodeType.type)}
                      >
                        <div className={`${nodeType.color} p-2 rounded-lg`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <span>{nodeType.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Cancel</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

// Node Properties Panel Component
function NodePropertiesPanel({
  node,
  isStartNode,
  outgoingEdges,
  nodes,
  onUpdate,
  onSetAsStart,
  onDeleteEdge,
}: {
  node: ScenarioNode;
  isStartNode: boolean;
  outgoingEdges: ScenarioEdge[];
  nodes: ScenarioNode[];
  onUpdate: (updates: Partial<ScenarioNode>) => void;
  onSetAsStart: () => void;
  onDeleteEdge: (edgeId: string) => void;
}) {
  const typeInfo = NODE_TYPES.find(t => t.type === node.type);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`${typeInfo?.color} p-2 rounded-lg`}>
            {typeInfo && <typeInfo.icon className="w-4 h-4 text-white" />}
          </div>
          <span className="font-semibold">{typeInfo?.label}</span>
        </div>
        {!isStartNode && node.type === "opening" && (
          <Button size="sm" variant="flat" onPress={onSetAsStart}>
            Set as Start
          </Button>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Label</label>
        <Input
          size="sm"
          value={node.label}
          onValueChange={(v) => onUpdate({ label: v })}
          variant="bordered"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Content</label>
        <Textarea
          size="sm"
          value={node.content}
          onValueChange={(v) => onUpdate({ content: v })}
          placeholder={getContentPlaceholder(node.type)}
          variant="bordered"
          minRows={4}
        />
      </div>

      {/* Type-specific config */}
      {node.type === "listen" && (
        <div>
          <label className="block text-sm font-medium mb-1">Timeout (seconds)</label>
          <Input
            size="sm"
            type="number"
            value={String(node.config.timeout || 30)}
            onValueChange={(v) => onUpdate({ config: { ...node.config, timeout: parseInt(v) || 30 } })}
            variant="bordered"
          />
        </div>
      )}

      {node.type === "question" && (
        <div>
          <label className="block text-sm font-medium mb-1">Expected Patterns (one per line)</label>
          <Textarea
            size="sm"
            value={(node.config.expectedPatterns || []).join("\n")}
            onValueChange={(v) => onUpdate({ 
              config: { ...node.config, expectedPatterns: v.split("\n").filter(Boolean) } 
            })}
            placeholder="chest pain&#10;shortness of breath"
            variant="bordered"
            minRows={3}
          />
        </div>
      )}

      {node.type === "feedback" && (
        <div>
          <label className="block text-sm font-medium mb-1">Feedback Type</label>
          <Select
            size="sm"
            selectedKeys={[node.config.feedbackType || "neutral"]}
            onSelectionChange={(keys) => onUpdate({ 
              config: { ...node.config, feedbackType: Array.from(keys)[0] as any } 
            })}
            variant="bordered"
          >
            <SelectItem key="positive">Positive</SelectItem>
            <SelectItem key="neutral">Neutral</SelectItem>
            <SelectItem key="negative">Negative</SelectItem>
          </Select>
        </div>
      )}

      {/* Connections */}
      <div>
        <label className="block text-sm font-medium mb-2">Connections</label>
        {outgoingEdges.length === 0 ? (
          <p className="text-sm text-default-400">No outgoing connections</p>
        ) : (
          <div className="space-y-2">
            {outgoingEdges.map((edge) => {
              const targetNode = nodes.find(n => n.id === edge.targetNodeId);
              return (
                <div key={edge.id} className="flex items-center justify-between bg-default-100 rounded-lg px-3 py-2">
                  <span className="text-sm">→ {targetNode?.label || "Unknown"}</span>
                  <Button
                    size="sm"
                    isIconOnly
                    variant="light"
                    color="danger"
                    onPress={() => onDeleteEdge(edge.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function getContentPlaceholder(type: ScenarioNodeType): string {
  switch (type) {
    case "opening": return "Hello! How can I help you today?";
    case "dialogue": return "Avatar's dialogue text...";
    case "question": return "What symptoms are you experiencing?";
    case "listen": return "Waiting for student response...";
    case "branch": return "Branching logic description...";
    case "feedback": return "Great job identifying that symptom!";
    case "checkpoint": return "Scoring criteria...";
    case "ending": return "Thank you for the conversation!";
    default: return "Enter content...";
  }
}
