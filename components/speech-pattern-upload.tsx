"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  Upload,
  File,
  X,
  Mic,
  FileText,
  Wand2,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { addToast } from "@heroui/toast";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Textarea } from "@heroui/input";
import type { SpeechPatternAnalysis } from "@/lib/speech-analysis";

interface SpeechPatternUploadProps {
  avatarId?: string;
  onAnalysisComplete?: (
    analysis: SpeechPatternAnalysis,
    systemPromptAddition: string,
  ) => void;
  disabled?: boolean;
}

interface UploadedFile {
  id: string;
  file: File;
  type: "transcript" | "audio" | "pdf";
  status: "pending" | "processing" | "complete" | "error";
}

export default function SpeechPatternUpload({
  avatarId,
  onAnalysisComplete,
  disabled = false,
}: SpeechPatternUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<SpeechPatternAnalysis | null>(null);
  const [systemPromptAddition, setSystemPromptAddition] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isOpen: isPreviewOpen,
    onOpen: onPreviewOpen,
    onOpenChange: onPreviewOpenChange,
  } = useDisclosure();

  const handleFileUpload = useCallback((files: FileList) => {
    for (const file of Array.from(files)) {
      const isAudioFile = file.type.startsWith("audio/");
      const isTextFile =
        file.type === "text/plain" || file.name.endsWith(".txt");
      const isPdfFile = 
        file.type === "application/pdf" || file.name.endsWith(".pdf");

      if (!isAudioFile && !isTextFile && !isPdfFile) {
        addToast({
          title: "Unsupported File Type",
          description: `${file.name}: Only audio files (mp3, wav, m4a), text files (.txt), and PDF files are supported.`,
          color: "danger",
        });
        continue;
      }

      // Check file size limits
      const maxSize = isAudioFile ? 100 * 1024 * 1024 : 10 * 1024 * 1024; // 100MB for audio, 10MB for text/PDF
      if (file.size > maxSize) {
        addToast({
          title: "File Too Large",
          description: `${file.name} exceeds the ${isAudioFile ? "100MB" : "10MB"} limit.`,
          color: "danger",
        });
        continue;
      }

      const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const uploadedFile: UploadedFile = {
        id: fileId,
        file,
        type: isAudioFile ? "audio" : isPdfFile ? "pdf" : "transcript",
        status: "pending",
      };

      setUploadedFiles((prev) => [...prev, uploadedFile]);
    }
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

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

  const analyzeFiles = useCallback(async () => {
    if (!avatarId || uploadedFiles.length === 0) {
      addToast({
        title: "Cannot Analyze",
        description: "Avatar ID and files are required for analysis.",
        color: "danger",
      });
      return;
    }

    setIsAnalyzing(true);
    setUploadedFiles((prev) =>
      prev.map((f) => ({ ...f, status: "processing" })),
    );

    try {
      const formData = new FormData();
      formData.append("avatarId", avatarId);

      // Add all files to form data
      uploadedFiles.forEach(({ file }) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/speech-analysis/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Analysis failed");
      }

      const result = await response.json();

      setAnalysis(result.analysis);
      setSystemPromptAddition(result.systemPromptAddition);
      setUploadedFiles((prev) =>
        prev.map((f) => ({ ...f, status: "complete" })),
      );

      addToast({
        title: "Analysis Complete",
        description: `Successfully analyzed ${uploadedFiles.length} file(s) for speech patterns.`,
        color: "success",
      });

      // Notify parent component
      if (onAnalysisComplete) {
        onAnalysisComplete(result.analysis, result.systemPromptAddition);
      }
    } catch (error) {
      console.error("Speech analysis failed:", error);
      setUploadedFiles((prev) => prev.map((f) => ({ ...f, status: "error" })));

      addToast({
        title: "Analysis Failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        color: "danger",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [avatarId, uploadedFiles, onAnalysisComplete]);

  const clearAll = useCallback(() => {
    setUploadedFiles([]);
    setAnalysis(null);
    setSystemPromptAddition("");
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (type: "transcript" | "audio" | "pdf") => {
    if (type === "audio") return <Mic size={16} />;
    if (type === "pdf") return <File size={16} />;
    return <FileText size={16} />;
  };

  const getStatusColor = (status: UploadedFile["status"]) => {
    switch (status) {
      case "pending":
        return "default";
      case "processing":
        return "primary";
      case "complete":
        return "success";
      case "error":
        return "danger";
      default:
        return "default";
    }
  };

  const getStatusIcon = (status: UploadedFile["status"]) => {
    switch (status) {
      case "processing":
        return <Loader2 size={14} className="animate-spin" />;
      case "complete":
        return <CheckCircle size={14} />;
      case "error":
        return <AlertCircle size={14} />;
      default:
        return null;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <div>
            <h3 className="text-lg font-semibold">Speech Pattern Analysis</h3>
            <p className="text-sm text-default-500">
              Upload transcripts, audio files, or PDF documents to analyze speech patterns and
              automatically enhance the avatar&apos;s communication style
            </p>
          </div>
          {analysis && (
            <Button
              size="sm"
              color="secondary"
              variant="flat"
              startContent={<Wand2 size={16} />}
              onPress={onPreviewOpen}
            >
              Preview Analysis
            </Button>
          )}
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        {/* File Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/10"
              : "border-default-300 hover:border-default-400"
          } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto mb-4 text-default-400" size={48} />
          <p className="text-lg font-medium mb-2">
            Drop files here or click to upload
          </p>
          <p className="text-sm text-default-500 mb-4">
            Supported formats: Audio files (MP3, WAV, M4A), Text files (.txt), and PDF files
            <br />
            Max size: 100MB for audio, 10MB for text/PDF
          </p>
          <Button
            color="primary"
            variant="flat"
            isDisabled={disabled}
            onPress={() => fileInputRef.current?.click()}
          >
            <File size={16} />
            Choose Files
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,.txt,text/plain,.pdf,application/pdf"
            onChange={(e) => {
              if (e.target.files) {
                handleFileUpload(e.target.files);
              }
            }}
            className="hidden"
          />
        </div>

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">
                Uploaded Files ({uploadedFiles.length})
              </h4>
              <Button
                size="sm"
                variant="light"
                color="danger"
                onPress={clearAll}
                isDisabled={isAnalyzing}
              >
                Clear All
              </Button>
            </div>

            <div className="space-y-2">
              {uploadedFiles.map((uploadedFile) => (
                <Card key={uploadedFile.id} className="p-3">
                  <div className="flex items-center gap-3">
                    {getFileIcon(uploadedFile.type)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {uploadedFile.file.name}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-default-500">
                        <span>{formatFileSize(uploadedFile.file.size)}</span>
                        <Chip
                          size="sm"
                          color={getStatusColor(uploadedFile.status)}
                          variant="flat"
                          startContent={getStatusIcon(uploadedFile.status)}
                        >
                          {uploadedFile.status}
                        </Chip>
                        <Chip size="sm" variant="bordered">
                          {uploadedFile.type}
                        </Chip>
                      </div>
                    </div>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="danger"
                      isDisabled={isAnalyzing}
                      onPress={() => removeFile(uploadedFile.id)}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Analysis Status and Actions */}
        {uploadedFiles.length > 0 && (
          <div className="flex gap-3 pt-4 border-t">
            <Button
              color="primary"
              startContent={
                isAnalyzing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Wand2 size={16} />
                )
              }
              isLoading={isAnalyzing}
              isDisabled={disabled || !avatarId}
              onPress={analyzeFiles}
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Speech Patterns"}
            </Button>

            {analysis && (
              <Button
                color="success"
                variant="flat"
                startContent={<CheckCircle size={16} />}
                onPress={onPreviewOpen}
              >
                View Results
              </Button>
            )}
          </div>
        )}

        {/* Analysis Success Summary */}
        {analysis && (
          <Card className="border-success-200 bg-success-50">
            <CardBody className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="text-success-600 mt-0.5" size={20} />
                <div className="flex-1">
                  <h4 className="font-medium text-success-800 mb-1">
                    Speech Pattern Analysis Complete
                  </h4>
                  <p className="text-sm text-success-700 mb-3">
                    Analyzed {analysis.metadata.sourceFiles.length} file(s) and
                    identified key speech patterns including:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Chip size="sm" color="success" variant="flat">
                      {analysis.tone.primary} tone
                    </Chip>
                    <Chip size="sm" color="success" variant="flat">
                      {analysis.vocabulary.complexity} vocabulary
                    </Chip>
                    <Chip size="sm" color="success" variant="flat">
                      {analysis.personality.formalityLevel} style
                    </Chip>
                    <Chip size="sm" color="success" variant="flat">
                      {Math.round(analysis.metadata.confidence * 100)}%
                      confidence
                    </Chip>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </CardBody>

      {/* Analysis Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onOpenChange={onPreviewOpenChange}
        size="3xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                <h3 className="text-xl font-semibold">
                  Speech Pattern Analysis Results
                </h3>
              </ModalHeader>
              <ModalBody>
                {analysis && (
                  <div className="space-y-6">
                    {/* Analysis Overview */}
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardBody className="p-4">
                          <h4 className="font-medium mb-2">Primary Tone</h4>
                          <p className="text-lg capitalize">
                            {analysis.tone.primary}
                          </p>
                          <div className="flex gap-1 mt-2">
                            {analysis.tone.secondary.map((tone, i) => (
                              <Chip key={i} size="sm" variant="flat">
                                {tone}
                              </Chip>
                            ))}
                          </div>
                        </CardBody>
                      </Card>

                      <Card>
                        <CardBody className="p-4">
                          <h4 className="font-medium mb-2">
                            Communication Style
                          </h4>
                          <p className="text-lg capitalize">
                            {analysis.personality.communicationStyle}
                          </p>
                          <p className="text-sm text-default-500 mt-1">
                            {analysis.personality.formalityLevel} formality
                          </p>
                        </CardBody>
                      </Card>
                    </div>

                    {/* Personality Traits */}
                    <div>
                      <h4 className="font-medium mb-3">Personality Traits</h4>
                      <div className="flex flex-wrap gap-2">
                        {analysis.personality.traits.map((trait, i) => (
                          <Chip key={i} color="secondary" variant="flat">
                            {trait}
                          </Chip>
                        ))}
                      </div>
                    </div>

                    {/* Vocabulary Insights */}
                    {analysis.vocabulary.preferredWords.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3">
                          Preferred Expressions
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {analysis.vocabulary.preferredWords
                            .slice(0, 10)
                            .map((word, i) => (
                              <Chip key={i} size="sm" variant="bordered">
                                &quot;{word}&quot;
                              </Chip>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* System Prompt Addition */}
                    <div>
                      <h4 className="font-medium mb-3">
                        Generated System Prompt Addition
                      </h4>
                      <Textarea
                        value={systemPromptAddition}
                        readOnly
                        minRows={8}
                        maxRows={15}
                        className="font-mono text-sm"
                      />
                    </div>

                    {/* Analysis Metadata */}
                    <div className="text-sm text-default-500 space-y-1">
                      <p>
                        <strong>Analysis ID:</strong>{" "}
                        {analysis.metadata.analysisId}
                      </p>
                      <p>
                        <strong>Processed:</strong>{" "}
                        {new Date(
                          analysis.metadata.processedAt,
                        ).toLocaleString()}
                      </p>
                      <p>
                        <strong>Source Files:</strong>{" "}
                        {analysis.metadata.sourceFiles.join(", ")}
                      </p>
                      <p>
                        <strong>Confidence:</strong>{" "}
                        {Math.round(analysis.metadata.confidence * 100)}%
                      </p>
                    </div>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </Card>
  );
}
