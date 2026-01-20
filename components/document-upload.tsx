"use client";

import { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  Upload,
  File,
  X,
  Download,
  Check,
} from "lucide-react";
import { addToast } from "@heroui/toast";
import { downloadFile } from "@/lib/download-utils";
import { getDownloadFilename } from "@/lib/filename-utils";

// Simple cache for document lists to avoid repeated API calls
const documentCache = new Map<string, { documents: any[], timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

interface DocumentUploadProps {
  avatarId?: string;
  isShared?: boolean;
  onDocumentAdded?: (document: PendingDocument) => void;
  onDocumentDeleted?: (documentId: string) => void;
  onPendingDocumentsChange?: (documents: PendingDocument[]) => void;
  onPendingDeletionsChange?: (deletions: PendingDeletion[]) => void;
  onDocumentUploaded?: (document: ExistingDocument) => void;
  onProcessingDocumentsChange?: (documents: ProcessingDocument[]) => void;
}

export interface PendingDocument {
  id: string;
  title: string;
  source: "file";
  uploadDate: string;
  file: File;
}

export interface ProcessingDocument {
  id: string;
  title: string;
  processingId: string;
  startTime: string;
  status?: "processing" | "completed";
}

export interface PendingDeletion {
  id: string;
  sourceId: string;
  title: string;
}

interface ExistingDocument {
  id: string;
  title: string;
  source: "file";
  sourceId: string;
  uploadDate: string;
  chunkCount: number;
  filename?: string;
}

const DocumentUpload = forwardRef<any, DocumentUploadProps>(function DocumentUpload({
  avatarId,
  isShared = false,
  onDocumentAdded,
  onDocumentDeleted,
  onPendingDocumentsChange,
  onPendingDeletionsChange,
  onDocumentUploaded,
  onProcessingDocumentsChange,
}, ref) {
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [existingDocuments, setExistingDocuments] = useState<ExistingDocument[]>([]);
  const [pendingDeletions, setPendingDeletions] = useState<PendingDeletion[]>([]);
  const [processingDocuments, setProcessingDocuments] = useState<ProcessingDocument[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Memoized cache key
  const cacheKey = useMemo(() => {
    return `${avatarId || 'shared'}_${isShared}`;
  }, [avatarId, isShared]);

  // Handle file upload - just add to pending list
  const handleFileUpload = useCallback(
    (files: FileList) => {
      for (const file of Array.from(files)) {
        const supportedTypes = ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
        if (!supportedTypes.includes(file.type)) {
          addToast({
            title: "Unsupported File Type",
            description: `Only PDF, TXT, and DOCX files are supported. Please upload supported file types only.`,
            color: "danger",
          });
          continue;
        }

        if (file.size > 10 * 1024 * 1024) {
          // 10MB limit
          addToast({
            title: "File Too Large",
            description: `File ${file.name} is too large. Please upload files smaller than 10MB.`,
            color: "danger",
          });
          continue;
        }

        const docId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const newDoc: PendingDocument = {
          id: docId,
          title: file.name,
          source: "file",
          uploadDate: new Date().toISOString(),
          file,
        };

        setPendingDocuments((prev) => [...prev, newDoc]);

        if (onDocumentAdded) {
          onDocumentAdded(newDoc);
        }
      }
    },
    [onDocumentAdded],
  );


  // Remove pending document
  const removePendingDocument = useCallback((docId: string) => {
    setPendingDocuments((prev) => prev.filter((doc) => doc.id !== docId));
    if (onDocumentDeleted) {
      onDocumentDeleted(docId);
    }
  }, [onDocumentDeleted]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload(files);
      }
    },
    [handleFileUpload],
  );

  // Stage document for deletion (only for avatar documents)
  const stageDocumentForDeletion = useCallback((docId: string) => {
    if (isShared) {
      // For shared documents, delete immediately (no save button)
      deleteDocumentImmediately(docId);
      return;
    }

    // For avatar documents, stage for deletion
    const doc = existingDocuments.find(d => d.id === docId);
    if (doc) {
      setPendingDeletions(prev => [...prev, { id: doc.id, sourceId: doc.sourceId, title: doc.title }]);
      setExistingDocuments(prev => prev.filter(d => d.id !== docId));
    }
  }, [isShared, existingDocuments]);

  // Handle document viewing/download
  const handleViewDocument = useCallback(async (docId: string) => {
    try {
      const doc = existingDocuments.find(d => d.id === docId);
      if (!doc) {
        throw new Error("Document not found");
      }

      // Create download URL
      let downloadUrl = `/api/documents/download?sourceId=${encodeURIComponent(doc.sourceId)}`;
      if (avatarId) {
        downloadUrl += `&avatarId=${encodeURIComponent(avatarId)}`;
      }

      // Sanitize the filename, preferring the original filename over title
      const safeFilename = getDownloadFilename(doc.title, doc.filename);

      // Trigger download using proper fetch-based approach
      await downloadFile({
        url: downloadUrl,
        filename: safeFilename
      });
    } catch (error) {
      console.error("View document error:", error);
      addToast({
        title: "View Failed",
        description: "Failed to open document",
        color: "danger",
      });
    }
  }, [existingDocuments, avatarId]);

  // Delete document immediately (for shared documents)
  const deleteDocumentImmediately = useCallback(async (docId: string) => {
    try {
      // Find the document to get its sourceId
      const doc = existingDocuments.find(d => d.id === docId);
      if (!doc) {
        throw new Error("Document not found");
      }

      const response = await fetch("/api/documents/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: doc.sourceId, avatarId }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      setExistingDocuments((prev) => prev.filter((doc) => doc.id !== docId));

      // Invalidate cache
      documentCache.delete(cacheKey);

      if (onDocumentDeleted) {
        onDocumentDeleted(docId);
      }

      addToast({
        title: "Document Deleted",
        description: "Document removed successfully",
        color: "success",
      });
    } catch (error) {
      console.error("Delete error:", error);
      addToast({
        title: "Delete Failed",
        description: "Failed to delete document",
        color: "danger",
      });
    }
  }, [avatarId, onDocumentDeleted, cacheKey, existingDocuments]);

  // Load existing documents when component mounts or avatarId changes
  useEffect(() => {
    const loadExistingDocuments = async () => {
      // For shared documents, no avatarId is needed
      // For avatar documents, avatarId must exist and not be "new"
      if (!isShared && (!avatarId || avatarId === "new")) return;

      // Check cache first
      const cached = documentCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        setExistingDocuments(cached.documents);
        return;
      }

      setIsLoadingDocuments(true);
      try {
        let url = `/api/documents/list?isShared=${isShared}`;
        if (avatarId && avatarId !== "new") {
          url += `&avatarId=${avatarId}`;
        }

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          const documents = data.documents || [];
          setExistingDocuments(documents);

          // Cache the result
          documentCache.set(cacheKey, {
            documents,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error("Failed to load existing documents:", error);
        addToast({
          title: "Loading Error",
          description: "Failed to load existing documents",
          color: "danger",
        });
      } finally {
        setIsLoadingDocuments(false);
      }
    };

    loadExistingDocuments();
  }, [avatarId, isShared, cacheKey]);

  // Notify parent of pending documents changes
  useEffect(() => {
    if (onPendingDocumentsChange) {
      onPendingDocumentsChange(pendingDocuments);
    }
  }, [pendingDocuments, onPendingDocumentsChange]);

  // Notify parent of pending deletions changes
  useEffect(() => {
    if (onPendingDeletionsChange) {
      onPendingDeletionsChange(pendingDeletions);
    }
  }, [pendingDeletions, onPendingDeletionsChange]);

  // Notify parent of processing documents changes
  useEffect(() => {
    if (onProcessingDocumentsChange) {
      onProcessingDocumentsChange(processingDocuments);
    }
  }, [processingDocuments, onProcessingDocumentsChange]);

  // Expose refresh and remove functions to parent
  useImperativeHandle(ref, () => ({
    refreshDocuments: () => {
      // Invalidate cache and reload documents
      documentCache.delete(cacheKey);
      setIsLoadingDocuments(true);
      // The useEffect will handle the reload
    },
    removePendingDocument: (docId: string) => {
      setPendingDocuments((prev) => prev.filter((doc) => doc.id !== docId));
    },
    clearPendingDeletions: () => {
      setPendingDeletions([]);
    },
    restorePendingDeletions: () => {
      // Move pending deletions back to existing documents
      const restoredDocs = pendingDeletions.map(deletion => ({
        id: deletion.id,
        sourceId: deletion.sourceId,
        title: deletion.title,
        source: "file" as const,
        uploadDate: new Date().toISOString(),
        chunkCount: 0, // This will be updated when we refresh
      }));
      setExistingDocuments(prev => [...prev, ...restoredDocs]);
      setPendingDeletions([]);
    },
    addProcessingDocument: (processingDoc: ProcessingDocument) => {
      setProcessingDocuments(prev => [...prev, processingDoc]);
    },
    removeProcessingDocument: (processingId: string) => {
      setProcessingDocuments(prev => prev.filter(doc => doc.processingId !== processingId));
    },
    updateProcessingDocumentStatus: (processingId: string, status: "processing" | "completed") => {
      setProcessingDocuments(prev =>
        prev.map(doc =>
          doc.processingId === processingId
            ? { ...doc, status }
            : doc
        )
      );
    }
  }), [cacheKey, pendingDeletions]);


  return (
    <Card className="w-full">
      <CardBody className="space-y-4">
        {/* File Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isDragging
              ? "border-primary bg-primary/10"
              : "border-default-300 hover:border-default-400"
            }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto mb-4 text-default-400" size={48} />
          <p className="text-lg font-medium mb-2">
            Drop files here or click to upload
          </p>
          <p className="text-sm text-default-500 mb-4">
            Supported formats: PDF, TXT, DOCX (max 10MB)
          </p>
          <Button
            color="primary"
            variant="flat"
            onPress={() => fileInputRef.current?.click()}
          >
            <File size={16} />
            Choose Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.docx"
            onChange={(e) => {
              if (e.target.files) {
                handleFileUpload(e.target.files);
              }
            }}
            className="hidden"
          />
        </div>


        {/* Documents List */}
        {(isLoadingDocuments || existingDocuments.length > 0 || pendingDocuments.length > 0 || pendingDeletions.length > 0 || processingDocuments.length > 0) && (
          <div className="space-y-4">

            {/* Existing Documents */}
            {(isLoadingDocuments || existingDocuments.length > 0) && (
              <div className="space-y-2">
                <h4 className="font-medium">Current Documents</h4>
                {isLoadingDocuments ? (
                  // Loading skeleton
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <Card key={i} className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 bg-default-200 rounded animate-pulse" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-default-200 rounded animate-pulse w-3/4" />
                            <div className="h-3 bg-default-100 rounded animate-pulse w-1/2" />
                          </div>
                          <div className="w-8 h-8 bg-default-200 rounded animate-pulse" />
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  existingDocuments.map((doc) => (
                    <Card key={doc.id} className="p-3">
                      <div className="flex items-center gap-3">
                        <File size={16} className="flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{doc.title}</p>
                          <div className="flex items-center gap-2 text-sm text-default-500">
                            <Chip size="sm" color="success" variant="flat">
                              {doc.chunkCount} chunks
                            </Chip>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onPress={() => handleViewDocument(doc.id)}
                            className="text-default-500 hover:text-primary"
                          >
                            <Download size={16} />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onPress={() => stageDocumentForDeletion(doc.id)}
                            className="text-default-500 hover:text-danger"
                          >
                            <X size={16} />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* Pending Documents */}
            {pendingDocuments.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Ready to Upload</h4>
                {pendingDocuments.map((doc) => (
                  <Card key={doc.id} className="p-3">
                    <div className="flex items-center gap-3">
                      <File size={16} className="flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.title}</p>
                        <div className="flex items-center gap-2 text-sm text-default-500">
                          <Chip size="sm" color="warning" variant="flat">
                            pending
                          </Chip>
                        </div>
                      </div>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        className="flex-shrink-0"
                        onPress={() => removePendingDocument(doc.id)}
                      >
                        <X size={16} />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Processing Documents */}
            {processingDocuments.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Processing</h4>
                {processingDocuments.map((doc) => {
                  const isCompleted = doc.status === "completed";
                  return (
                    <Card
                      key={doc.id}
                      className={`p-3 ${isCompleted
                          ? "border-success-200 bg-success-50"
                          : "border-primary-200 bg-primary-50"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <File
                          size={16}
                          className={`flex-shrink-0 ${isCompleted ? "text-success-500" : "text-primary-500"
                            }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${isCompleted ? "text-success-700" : "text-primary-700"
                            }`}>
                            {doc.title}
                          </p>
                          <div className="flex items-center gap-2 text-sm">
                            <Chip
                              size="sm"
                              color={isCompleted ? "success" : "primary"}
                              variant="flat"
                            >
                              {isCompleted ? "completed" : "processing..."}
                            </Chip>
                          </div>
                        </div>
                        {isCompleted ? (
                          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                            <div className="w-6 h-6 bg-success-500 rounded-full flex items-center justify-center">
                              <Check size={20} />
                            </div>
                          </div>
                        ) : (
                          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Pending Deletions */}
            {pendingDeletions.length > 0 && !isShared && (
              <div className="space-y-2">
                <h4 className="font-medium">Ready to Delete</h4>
                {pendingDeletions.map((deletion) => (
                  <Card key={deletion.id} className="p-3 border-danger-200 bg-danger-50">
                    <div className="flex items-center gap-3">
                      <File size={16} className="flex-shrink-0 text-danger-500" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-danger-700">{deletion.title}</p>
                        <div className="flex items-center gap-2 text-sm text-danger-600">
                          <Chip size="sm" color="danger" variant="flat">
                            pending deletion
                          </Chip>
                        </div>
                      </div>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        className="flex-shrink-0 text-danger-500"
                        onPress={() => {
                          // Restore document (remove from pending deletions)
                          const restoredDoc = {
                            id: deletion.id,
                            sourceId: deletion.sourceId,
                            title: deletion.title,
                            source: "file" as const,
                            uploadDate: new Date().toISOString(),
                            chunkCount: 0, // Will be updated on refresh
                          };
                          setExistingDocuments(prev => [...prev, restoredDoc]);
                          setPendingDeletions(prev => prev.filter(d => d.id !== deletion.id));
                        }}
                      >
                        <X size={16} />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
});

export default DocumentUpload;