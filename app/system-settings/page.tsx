"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { addToast } from "@heroui/toast";
import { Plus, X, Shield, MessageSquare, Heart } from "lucide-react";

import { title } from "@/components/primitives";
import DocumentUpload, { type PendingDocument, type ProcessingDocument } from "@/components/document-upload";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_GUARDRAILS_CONFIG } from "@/lib/guardrails-storage";

export default function SystemSettingsPage() {
  const documentUploadRef = useRef<any>(null);
  const activePollingRef = useRef<Set<string>>(new Set());
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const { user } = useAuth();

  // Guardrails state - initialized with shared default configuration
  const [blockedTopics, setBlockedTopics] = useState<string[]>(DEFAULT_GUARDRAILS_CONFIG.blockedTopics);
  const [mentalHealthTopics, setMentalHealthTopics] = useState<string[]>(DEFAULT_GUARDRAILS_CONFIG.mentalHealthTopics);
  const [blockedResponses, setBlockedResponses] = useState<string[]>(DEFAULT_GUARDRAILS_CONFIG.blockedResponses);
  const [mentalHealthResources, setMentalHealthResources] = useState(DEFAULT_GUARDRAILS_CONFIG.mentalHealthResources);
  const [newTopic, setNewTopic] = useState("");
  const [newMentalHealthTopic, setNewMentalHealthTopic] = useState("");
  const [newResponse, setNewResponse] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function to cancel all active polling
  const cleanupPolling = useCallback(() => {
    // Clear all active timeouts
    timeoutRefs.current.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    timeoutRefs.current.clear();
    activePollingRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanupPolling;
  }, [cleanupPolling]);

  const pollDocumentStatus = useCallback(async (processingId: string) => {
    // Prevent duplicate polling for the same processing ID
    if (activePollingRef.current.has(processingId)) {
      return;
    }
    
    activePollingRef.current.add(processingId);
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5 second intervals)
    
    const poll = async () => {
      // Check if polling was cancelled
      if (!activePollingRef.current.has(processingId)) {
        return;
      }

      try {
        const response = await fetch(`/api/documents/status?processingId=${processingId}`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.status?.status === "completed") {
            // Update processing document status to completed
            if (documentUploadRef.current?.updateProcessingDocumentStatus) {
              documentUploadRef.current.updateProcessingDocumentStatus(processingId, "completed");
            }
            
            addToast({
              title: "Processing Complete",
              description: "Document has been added to the global knowledge base. Refresh to see it in Current Documents.",
              color: "success",
            });
            
            // Cleanup this polling instance
            activePollingRef.current.delete(processingId);
            timeoutRefs.current.delete(processingId);
            return;
          } else if (data.status?.status === "failed") {
            // Remove from processing documents
            if (documentUploadRef.current?.removeProcessingDocument) {
              documentUploadRef.current.removeProcessingDocument(processingId);
            }
            
            addToast({
              title: "Processing Failed",
              description: data.status?.error || "Failed to process document",
              color: "danger",
            });
            
            // Cleanup this polling instance
            activePollingRef.current.delete(processingId);
            timeoutRefs.current.delete(processingId);
            return;
          }
          
          // Still processing, continue polling
          attempts++;
          if (attempts < maxAttempts && activePollingRef.current.has(processingId)) {
            const timeoutId = setTimeout(poll, 5000); // Poll every 5 seconds
            timeoutRefs.current.set(processingId, timeoutId);
          } else {
            // Remove from processing documents on timeout
            if (documentUploadRef.current?.removeProcessingDocument) {
              documentUploadRef.current.removeProcessingDocument(processingId);
            }
            
            addToast({
              title: "Processing Timeout",
              description: "Document processing is taking longer than expected",
              color: "warning",
            });
            
            // Cleanup this polling instance
            activePollingRef.current.delete(processingId);
            timeoutRefs.current.delete(processingId);
          }
        }
      } catch (error) {
        console.error("Error polling document status:", error);
        // Cleanup on error
        activePollingRef.current.delete(processingId);
        timeoutRefs.current.delete(processingId);
      }
    };
    
    // Start polling after a brief delay
    const initialTimeoutId = setTimeout(poll, 2000);
    timeoutRefs.current.set(processingId, initialTimeoutId);
  }, []);

  // Guardrails helper functions
  const addBlockedTopic = () => {
    if (newTopic.trim() && !blockedTopics.includes(newTopic.trim())) {
      setBlockedTopics([...blockedTopics, newTopic.trim()]);
      setNewTopic("");
    }
  };

  const removeBlockedTopic = (topic: string) => {
    setBlockedTopics(blockedTopics.filter(t => t !== topic));
  };

  const addMentalHealthTopic = () => {
    if (newMentalHealthTopic.trim() && !mentalHealthTopics.includes(newMentalHealthTopic.trim())) {
      setMentalHealthTopics([...mentalHealthTopics, newMentalHealthTopic.trim()]);
      setNewMentalHealthTopic("");
    }
  };

  const removeMentalHealthTopic = (topic: string) => {
    setMentalHealthTopics(mentalHealthTopics.filter(t => t !== topic));
  };

  const addBlockedResponse = () => {
    if (newResponse.trim() && !blockedResponses.includes(newResponse.trim())) {
      setBlockedResponses([...blockedResponses, newResponse.trim()]);
      setNewResponse("");
    }
  };

  const removeBlockedResponse = (index: number) => {
    setBlockedResponses(blockedResponses.filter((_, i) => i !== index));
  };

  // Load guardrails configuration
  const loadGuardrails = async () => {
    try {
      const response = await fetch("/api/guardrails");
      if (response.ok) {
        const config = await response.json();
        setBlockedTopics(config.blockedTopics || DEFAULT_GUARDRAILS_CONFIG.blockedTopics);
        setMentalHealthTopics(config.mentalHealthTopics || DEFAULT_GUARDRAILS_CONFIG.mentalHealthTopics);
        setBlockedResponses(config.blockedResponses || DEFAULT_GUARDRAILS_CONFIG.blockedResponses);
        setMentalHealthResources(config.mentalHealthResources || DEFAULT_GUARDRAILS_CONFIG.mentalHealthResources);
      }
    } catch (error) {
      console.error("Failed to load guardrails config:", error);
      addToast({
        title: "Load Failed",
        description: "Failed to load guardrails configuration",
        color: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  };


  // Autosave function with debouncing
  const triggerAutosave = useCallback(() => {
    // Clear existing timeout
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    // Set unsaved changes flag
    setHasUnsavedChanges(true);
    setSaveStatus('idle');

    // Set new timeout for autosave (2 seconds after last change)
    autosaveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      setHasUnsavedChanges(false);
      
      try {
        const response = await fetch("/api/guardrails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            blockedTopics,
            mentalHealthTopics,
            blockedResponses,
            mentalHealthResources,
            updatedBy: user?.name || "Unknown Admin",
          }),
        });

        if (response.ok) {
          setSaveStatus('saved');
          // Reset to idle after 2 seconds
          setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
          throw new Error("Autosave failed");
        }
      } catch (error) {
        console.error("Autosave error:", error);
        setSaveStatus('error');
        setHasUnsavedChanges(true);
        // Reset to idle after 3 seconds
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    }, 2000);
  }, [blockedTopics, mentalHealthTopics, blockedResponses, mentalHealthResources, user?.name]);

  // Trigger autosave when data changes
  useEffect(() => {
    if (!isLoading) {
      triggerAutosave();
    }
  }, [blockedTopics, mentalHealthTopics, blockedResponses, mentalHealthResources, triggerAutosave, isLoading]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  // Load configuration on mount
  useEffect(() => {
    loadGuardrails();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-[70vw]">
      <div>
        <h1 className={title()}>System Settings</h1>
        <p className="text-default-500 mt-2">
          Manage global system configuration and shared knowledge base
        </p>
      </div>

      <Divider />

      {/* Global Knowledge Base */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Global Knowledge Base</h2>
          <p className="text-default-600">
            Upload PDF documents that will be available to all
            avatars. This includes general information about Weatherhead School,
            policies, and other shared resources.
          </p>
        </div>

        <DocumentUpload
          ref={documentUploadRef}
          isShared={true}
          onDocumentAdded={async (document: PendingDocument) => {
            // For global documents, upload immediately
            if (document.file) {
              try {
                const formData = new FormData();
                formData.append("file", document.file);
                formData.append("title", document.title);
                formData.append("isShared", "true");

                const response = await fetch("/api/documents/upload", {
                  method: "POST",
                  body: formData,
                });

                if (response.ok) {
                  const data = await response.json();
                  
                  // Remove from pending and add to processing
                  if (documentUploadRef.current?.removePendingDocument) {
                    documentUploadRef.current.removePendingDocument(document.id);
                  }
                  
                  if (data.processingId && documentUploadRef.current?.addProcessingDocument) {
                    const processingDoc: ProcessingDocument = {
                      id: document.id,
                      title: document.title,
                      processingId: data.processingId,
                      startTime: new Date().toISOString(),
                      status: "processing",
                    };
                    documentUploadRef.current.addProcessingDocument(processingDoc);
                  }
                  
                  addToast({
                    title: "Upload Started",
                    description: `Processing ${document.title}...`,
                    color: "primary",
                  });
                  
                  // Start polling for completion
                  if (data.processingId) {
                    pollDocumentStatus(data.processingId);
                  }
                } else {
                  const errorData = await response.json();
                  
                  addToast({
                    title: "Upload Failed",
                    description: errorData.error || "Failed to upload document",
                    color: "danger",
                  });
                }
              } catch (error) {
                
                addToast({
                  title: "Upload Error",
                  description: "An error occurred while uploading the document",
                  color: "danger",
                });
              }
            }
          }}
          onDocumentDeleted={(documentId: string) => {
            // Document deleted handler
          }}
        />
      </div>

      <Divider />

      {/* Content Guardrails */}
      <div className="space-y-4">
        <div className="flex flex-col items-center text-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Content Guardrails</h2>
            <p className="text-default-600">
              Configure content filtering and response guidelines for avatar interactions
            </p>
            
            {/* Save Status Indicator */}
            <div className="mt-2">
              {saveStatus === 'saving' && (
                <Chip color="primary" variant="flat" size="sm">
                  Saving...
                </Chip>
              )}
              {saveStatus === 'saved' && (
                <Chip color="success" variant="flat" size="sm">
                  ✓ Saved
                </Chip>
              )}
              {saveStatus === 'error' && (
                <Chip color="danger" variant="flat" size="sm">
                  ✗ Save failed
                </Chip>
              )}
              {hasUnsavedChanges && saveStatus === 'idle' && (
                <Chip color="warning" variant="flat" size="sm">
                  Unsaved changes
                </Chip>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardBody className="text-center py-8">
              <p className="text-default-500">Loading guardrails configuration...</p>
            </CardBody>
          </Card>
        ) : (
          <>
        

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Blocked Topics */}
          <Card>
            <CardHeader className="flex items-center gap-2">
              <X className="w-5 h-5 text-danger" />
              <h3 className="text-lg font-semibold">Blocked Topics</h3>
            </CardHeader>
            <CardBody className="flex flex-col space-y-4">
              <p className="text-sm text-default-600">
                Keywords that will trigger a polite redirect response
              </p>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Add blocked topic..."
                  value={newTopic}
                  onValueChange={setNewTopic}
                  onKeyDown={(e) => e.key === 'Enter' && addBlockedTopic()}
                />
                <Button
                  isIconOnly
                  color="primary"
                  onPress={addBlockedTopic}
                  isDisabled={!newTopic.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 flex-1 overflow-y-auto p-2 bg-default-50 rounded-lg">
                {blockedTopics.map((topic, index) => (
                  <Chip
                    key={index}
                    color="danger"
                    variant="flat"
                    onClose={() => removeBlockedTopic(topic)}
                  >
                    {topic}
                  </Chip>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Mental Health Topics */}
          <Card>
            <CardHeader className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-success" />
              <h3 className="text-lg font-semibold">Mental Health Support</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-sm text-default-600">
                Topics that trigger helpful resource information
              </p>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Add mental health topic..."
                  value={newMentalHealthTopic}
                  onValueChange={setNewMentalHealthTopic}
                  onKeyDown={(e) => e.key === 'Enter' && addMentalHealthTopic()}
                />
                <Button
                  isIconOnly
                  color="success"
                  onPress={addMentalHealthTopic}
                  isDisabled={!newMentalHealthTopic.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {mentalHealthTopics.map((topic, index) => (
                  <Chip
                    key={index}
                    color="success"
                    variant="flat"
                    onClose={() => removeMentalHealthTopic(topic)}
                  >
                    {topic}
                  </Chip>
                ))}
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="font-medium text-sm">Campus Resources</h4>
                <Input
                  label="Counseling Services Phone"
                  value={mentalHealthResources.counselingPhone}
                  onValueChange={(value) => 
                    setMentalHealthResources({...mentalHealthResources, counselingPhone: value})
                  }
                />
                <Input
                  label="Crisis Lifeline"
                  value={mentalHealthResources.crisisLine}
                  onValueChange={(value) => 
                    setMentalHealthResources({...mentalHealthResources, crisisLine: value})
                  }
                />
                <Textarea
                  label="Additional Information"
                  value={mentalHealthResources.additionalInfo}
                  onValueChange={(value) => 
                    setMentalHealthResources({...mentalHealthResources, additionalInfo: value})
                  }
                  maxRows={3}
                />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Blocked Response Templates */}
        <Card>
          <CardHeader className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Blocked Content Responses</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-default-600">
              Template responses shown when blocked content is detected (one is chosen randomly)
            </p>
            
            <div className="flex gap-2">
              <Textarea
                placeholder="Add response template..."
                value={newResponse}
                onValueChange={setNewResponse}
                maxRows={3}
              />
              <Button
                color="primary"
                onPress={addBlockedResponse}
                isDisabled={!newResponse.trim()}
                className="self-end"
              >
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {blockedResponses.map((response, index) => (
                <div key={index} className="flex items-start gap-2 p-3 bg-default-50 rounded-lg">
                  <p className="text-sm flex-1">{response}</p>
                  <Button
                    isIconOnly
                    size="sm"
                    color="danger"
                    variant="light"
                    onPress={() => removeBlockedResponse(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        </>
        )}
      </div>

      <Divider />

      {/* System Status */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">System Status</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">RAG System Status</span>
              <span className="text-sm text-success">Active</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Vector Database</span>
              <span className="text-sm text-success">Connected</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Document Processing</span>
              <span className="text-sm text-success">Ready</span>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
