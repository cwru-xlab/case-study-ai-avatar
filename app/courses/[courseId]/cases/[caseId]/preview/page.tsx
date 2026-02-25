"use client";

import { useState, useEffect, useCallback, use, useRef } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { 
  ArrowLeft, Loader2, Send, RotateCcw, MessageSquare, 
  User, Bot, Play, Pause, ChevronRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { Case, ScenarioNode, ChatMessage } from "@/types";

interface PreviewMessage extends ChatMessage {
  nodeId?: string;
}

export default function CasePreviewPage({ 
  params 
}: { 
  params: Promise<{ courseId: string; caseId: string }> 
}) {
  const { courseId, caseId } = use(params);
  const router = useRouter();
  
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Preview state
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [userInput, setUserInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [visitedNodes, setVisitedNodes] = useState<string[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getNode = (nodeId: string): ScenarioNode | undefined => {
    return caseData?.nodes.find(n => n.id === nodeId);
  };

  const getNextNode = (currentId: string): ScenarioNode | undefined => {
    const edge = caseData?.edges.find(e => e.sourceNodeId === currentId);
    if (edge) {
      return getNode(edge.targetNodeId);
    }
    return undefined;
  };

  const processNode = async (node: ScenarioNode) => {
    setCurrentNodeId(node.id);
    setVisitedNodes(prev => [...prev, node.id]);

    switch (node.type) {
      case "opening":
      case "dialogue":
      case "feedback":
        // Avatar speaks
        setMessages(prev => [...prev, {
          role: "assistant",
          content: node.content,
          timestamp: Date.now(),
          nodeId: node.id,
        }]);
        
        // Auto-advance to next node after a delay
        setTimeout(() => {
          const nextNode = getNextNode(node.id);
          if (nextNode) {
            processNode(nextNode);
          }
        }, 1500);
        break;

      case "question":
        // Avatar asks a question
        setMessages(prev => [...prev, {
          role: "assistant",
          content: node.content,
          timestamp: Date.now(),
          nodeId: node.id,
        }]);
        // Wait for user input (handled by handleSendMessage)
        break;

      case "listen":
        // Just wait for user input
        break;

      case "branch":
        // For preview, just go to first connected node
        const nextNode = getNextNode(node.id);
        if (nextNode) {
          processNode(nextNode);
        }
        break;

      case "checkpoint":
        // Show checkpoint message
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `[Checkpoint: ${node.label}] ${node.content}`,
          timestamp: Date.now(),
          nodeId: node.id,
        }]);
        
        // Auto-advance
        setTimeout(() => {
          const next = getNextNode(node.id);
          if (next) {
            processNode(next);
          }
        }, 1000);
        break;

      case "ending":
        // Show ending message
        setMessages(prev => [...prev, {
          role: "assistant",
          content: node.content,
          timestamp: Date.now(),
          nodeId: node.id,
        }]);
        break;
    }
  };

  const startSession = () => {
    if (!caseData) return;
    
    setSessionStarted(true);
    setMessages([]);
    setVisitedNodes([]);
    
    const startNode = getNode(caseData.startNodeId);
    if (startNode) {
      processNode(startNode);
    }
  };

  const resetSession = () => {
    setSessionStarted(false);
    setMessages([]);
    setCurrentNodeId(null);
    setVisitedNodes([]);
    setUserInput("");
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || !currentNodeId || !caseData) return;

    const input = userInput.trim();
    setUserInput("");
    setIsProcessing(true);

    // Add user message
    setMessages(prev => [...prev, {
      role: "user",
      content: input,
      timestamp: Date.now(),
    }]);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find next node based on current node type
    const currentNode = getNode(currentNodeId);
    if (currentNode) {
      const nextNode = getNextNode(currentNodeId);
      if (nextNode) {
        processNode(nextNode);
      }
    }

    setIsProcessing(false);
  };

  const getCurrentNodeType = (): string => {
    if (!currentNodeId) return "";
    const node = getNode(currentNodeId);
    return node?.type || "";
  };

  const shouldShowInput = (): boolean => {
    const nodeType = getCurrentNodeType();
    return sessionStarted && 
           (nodeType === "question" || nodeType === "listen") && 
           nodeType !== "ending";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-default-600">Loading preview...</p>
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="light"
              isIconOnly
              onPress={() => router.push(`/courses/${courseId}/cases/${caseId}`)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Preview: {caseData.name}</h1>
              <p className="text-sm text-default-500">Test the conversation flow</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Chip variant="flat" color="warning">Preview Mode</Chip>
            {sessionStarted && (
              <Button
                variant="bordered"
                startContent={<RotateCcw className="w-4 h-4" />}
                onPress={resetSession}
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat Area */}
          <div className="lg:col-span-2">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="border-b border-default-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">AI Avatar</p>
                    <p className="text-xs text-default-500">
                      {sessionStarted ? "In conversation" : "Ready to start"}
                    </p>
                  </div>
                </div>
              </CardHeader>
              
              <CardBody className="flex-1 overflow-y-auto p-4">
                {!sessionStarted ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <Play className="w-16 h-16 mx-auto mb-4 text-primary opacity-50" />
                      <h3 className="text-lg font-semibold mb-2">Ready to Preview</h3>
                      <p className="text-default-500 mb-4">
                        Start a test conversation to see how the case flows
                      </p>
                      <Button color="primary" size="lg" onPress={startSession}>
                        Start Conversation
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            msg.role === "user"
                              ? "bg-primary text-white"
                              : "bg-default-100"
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          {msg.nodeId && (
                            <p className="text-xs opacity-60 mt-1">
                              Node: {getNode(msg.nodeId)?.label}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {isProcessing && (
                      <div className="flex justify-start">
                        <div className="bg-default-100 rounded-lg px-4 py-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </CardBody>

              {/* Input Area */}
              {shouldShowInput() && (
                <div className="p-4 border-t border-default-200">
                  <div className="flex gap-2">
                    <Input
                      value={userInput}
                      onValueChange={setUserInput}
                      placeholder="Type your response..."
                      variant="bordered"
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      isDisabled={isProcessing}
                    />
                    <Button
                      color="primary"
                      isIconOnly
                      onPress={handleSendMessage}
                      isDisabled={!userInput.trim() || isProcessing}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Flow Tracker */}
          <div className="lg:col-span-1">
            <Card className="h-[600px]">
              <CardHeader className="border-b border-default-200">
                <h3 className="font-semibold">Scenario Flow</h3>
              </CardHeader>
              <CardBody className="overflow-y-auto">
                <div className="space-y-2">
                  {caseData.nodes.map((node) => {
                    const isVisited = visitedNodes.includes(node.id);
                    const isCurrent = currentNodeId === node.id;
                    
                    return (
                      <div
                        key={node.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          isCurrent
                            ? "border-primary bg-primary/10"
                            : isVisited
                            ? "border-success bg-success/10"
                            : "border-default-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isCurrent && <ChevronRight className="w-4 h-4 text-primary" />}
                            <span className={`text-sm font-medium ${
                              isCurrent ? "text-primary" : isVisited ? "text-success" : ""
                            }`}>
                              {node.label}
                            </span>
                          </div>
                          <Chip size="sm" variant="flat">
                            {node.type}
                          </Chip>
                        </div>
                        <p className="text-xs text-default-500 mt-1 line-clamp-2">
                          {node.content || "No content"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
