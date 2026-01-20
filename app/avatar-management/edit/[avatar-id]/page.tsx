"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
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
  Globe,
  FileText,
  Plus,
  X,
  Video,
  AudioLines,
  Image as ImageIcon,
} from "lucide-react";
import { addToast } from "@heroui/toast";
import { title as pageTitle } from "@/components/primitives";
import { useAuth } from "@/lib/auth-context";
import { avatarStorage, type CachedAvatar } from "@/lib/avatar-storage";
import {
  type ConversationStarter,
  type StartAvatarRequest,
  VoiceEmotion,
} from "@/types";
import { siteConfig } from "@/config/site";
import PreviewChatSmall from "@/components/preview-chat-small";
import PreviewChatFull from "@/components/preview-chat-full";
import InteractiveAvatarWrapper from "@/components/HeyGenAvatar/InteractiveAvatar";
import DocumentUpload, {
  type PendingDocument,
  type PendingDeletion,
} from "@/components/document-upload";
import SpeechPatternUpload from "@/components/speech-pattern-upload";
import type { SpeechPatternAnalysis } from "@/lib/speech-analysis";
import ImageUploadCrop from "@/components/ImageUploadCrop";
import AvatarImage from "@/components/AvatarImage";

const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: "low", // High="high", Medium="medium", Low="low"
  avatarName: "Ann_Therapist_public", // text field with no validation.
  knowledgeId: undefined, // leave undefined for default, in the UI, lock this
  voice: {
    rate: 1.1, // 0.5 - 2.0 use heroui slider, step 0.1, default 1.1
    voiceId: "df6420135ba44094b85874084b45c410", // text field with no validation.
    emotion: undefined, // optional - no emotion selected by default
  },
  language: "en", // leave this as a text filed, validate as two lower case letters, add a note saying only en, zh, ko, vi, fr, de, ja are well supported.
};

export default function AvatarEditPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const avatarId = params["avatar-id"] as string;
  const isNewAvatar = avatarId === "new";

  // Form state
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [title, setTitle] = useState(""); // Professional title of the avatar
  const [conversationStarters, setConversationStarters] = useState<
    ConversationStarter[]
  >([]);
  const [published, setPublished] = useState(false);
  const [portrait, setPortrait] = useState<string>("");
  const [avatarSettings, setAvatarSettings] =
    useState<StartAvatarRequest>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [existingAvatar, setExistingAvatar] = useState<CachedAvatar | null>(
    null
  );
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>(
    []
  );
  const [pendingDeletions, setPendingDeletions] = useState<PendingDeletion[]>(
    []
  );
  const documentUploadRef = useRef<any>(null);

  // Speech pattern analysis state
  const [speechAnalysis, setSpeechAnalysis] =
    useState<SpeechPatternAnalysis | null>(null);
  const [speechPromptAddition, setSpeechPromptAddition] = useState<string>("");
  const [speechSourceFiles, setSpeechSourceFiles] = useState<
    Array<{
      name: string;
      type: "audio" | "transcript" | "pdf";
      uploadedAt: string;
    }>
  >([]);
  const [useSpeechPatterns, setUseSpeechPatterns] = useState(false);

  // Track original values for change detection
  const [originalValues, setOriginalValues] = useState({
    name: "",
    systemPrompt: "",
    title: "",
    conversationStarters: [] as ConversationStarter[],
    published: false,
    portrait: "",
    avatarSettings: DEFAULT_CONFIG,
  });

  // Unsaved changes modal
  const [isUnsavedModalOpen, setIsUnsavedModalOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);
  const [isDiscarding, setIsDiscarding] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<
    Array<{
      role: "user" | "assistant";
      content: string;
      timestamp: number;
    }>
  >([]);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  // Video preview state
  const [isVideoPreviewModalOpen, setIsVideoPreviewModalOpen] = useState(false);

  // Image upload modal state
  const [isImageUploadModalOpen, setIsImageUploadModalOpen] = useState(false);

  // Auto-generate ID from name (only for new avatars)
  const generatedId = useMemo(() => {
    if (!isNewAvatar) {
      // For existing avatars, use the current avatarId (immutable)
      return avatarId;
    }

    if (!name.trim()) return "";

    return name
      .toLowerCase()
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/[^a-z0-9-]/g, "") // Remove anything that's not a letter, number, or hyphen
      .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
  }, [name, isNewAvatar, avatarId]);

  // Check if there are actual changes from original values
  const hasUnsavedChanges = useMemo(() => {
    const startersChanged =
      JSON.stringify(conversationStarters) !==
      JSON.stringify(originalValues.conversationStarters);
    const settingsChanged =
      JSON.stringify(avatarSettings) !==
      JSON.stringify(originalValues.avatarSettings);

    return (
      name !== originalValues.name ||
      title !== originalValues.title ||
      systemPrompt !== originalValues.systemPrompt ||
      startersChanged ||
      published !== originalValues.published ||
      portrait !== originalValues.portrait ||
      settingsChanged ||
      pendingDocuments.length > 0 ||
      pendingDeletions.length > 0 ||
      speechAnalysis !== null || // Speech analysis data exists
      speechPromptAddition !== "" || // Speech prompt addition exists
      speechSourceFiles.length > 0 // Speech source files exist
    );
  }, [
    name,
    title,
    systemPrompt,
    conversationStarters,
    published,
    portrait,
    avatarSettings,
    originalValues,
    pendingDocuments,
    pendingDeletions,
    speechAnalysis,
    speechPromptAddition,
    speechSourceFiles,
  ]);

  // Validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Avatar name is required";
    } else if (generatedId === "new") {
      newErrors.name =
        "Avatar name cannot generate 'new' as ID (conflicts with add URL)";
    }

    if (!title.trim()) {
      newErrors.title = "Title is required";
    }

    if (!systemPrompt.trim()) {
      newErrors.systemPrompt = "System prompt is required";
    }

    // Validate conversation starters
    if (conversationStarters.length > 0) {
      const hasInvalidStarters = conversationStarters.some(
        (starter) => !starter.title.trim() || !starter.question.trim()
      );

      if (hasInvalidStarters) {
        newErrors.conversationStarters =
          "All conversation starters must have both a title and question";
      }
    }

    // Validate avatar settings
    if (!avatarSettings.avatarName.trim()) {
      newErrors.avatarName = "Avatar name (API) is required";
    }

    if (!avatarSettings.voice.voiceId.trim()) {
      newErrors.voiceId = "Voice ID is required";
    }

    if (!avatarSettings.language.trim()) {
      newErrors.language = "Language is required";
    } else if (!/^[a-z]{2}$/.test(avatarSettings.language)) {
      newErrors.language =
        "Language must be exactly two lowercase letters (e.g., 'en', 'zh', 'ko')";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Load existing avatar data if editing, or restore draft if adding
  useEffect(() => {
    const loadAvatar = async () => {
      if (!isNewAvatar) {
        setIsLoading(true);
        try {
          const avatar = await avatarStorage.get(avatarId);
          if (avatar) {
            console.log("🔍 Loading avatar data:", {
              name: avatar.name,
              systemPrompt: avatar.systemPrompt
                ? avatar.systemPrompt.substring(0, 200) + "..."
                : "empty",
              systemPromptLength: avatar.systemPrompt?.length || 0,
              speechAnalysis: avatar.speechAnalysis ? "present" : "null",
              speechPromptAddition: avatar.speechPromptAddition
                ? avatar.speechPromptAddition.substring(0, 100) + "..."
                : "empty",
              speechSourceFiles: avatar.speechSourceFiles || [],
              conversationStartersCount:
                avatar.conversationStarters?.length || 0,
            });

            setExistingAvatar(avatar);
            setName(avatar.name);
            setTitle(avatar.title || "");
            setSystemPrompt(avatar.systemPrompt);
            setConversationStarters(avatar.conversationStarters || []);
            setPublished(avatar.published || false);
            setPortrait(avatar.portrait || "");
            setAvatarSettings(avatar.settings || DEFAULT_CONFIG);

            // Load speech analysis data if available
            if (avatar.speechAnalysis) {
              console.log("🔍 Loading speech analysis data:", {
                analysis: avatar.speechAnalysis,
                promptAddition: avatar.speechPromptAddition,
                sourceFiles: avatar.speechSourceFiles,
              });

              setSpeechAnalysis(avatar.speechAnalysis);
              setSpeechPromptAddition(avatar.speechPromptAddition || "");
              setSpeechSourceFiles(avatar.speechSourceFiles || []);
              setUseSpeechPatterns(true);
            } else {
              console.log("🔍 No speech analysis data found in avatar");
            }

            // Set original values for change detection
            setOriginalValues({
              name: avatar.name,
              title: avatar.title || "",
              systemPrompt: avatar.systemPrompt,
              conversationStarters: avatar.conversationStarters || [],
              published: avatar.published || false,
              portrait: avatar.portrait || "",
              avatarSettings: avatar.settings || DEFAULT_CONFIG,
            });
          }
        } catch (error) {
          console.error("Failed to load avatar:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        // For new avatars, try to restore from local storage
        try {
          const draftData = localStorage.getItem(
            siteConfig.localCache.addAvatarDraftLocalStorageKey
          );
          if (draftData) {
            const draft = JSON.parse(draftData);

            setName(draft.name || "");
            setTitle(draft.title || "");
            setSystemPrompt(draft.systemPrompt || "");
            setConversationStarters(draft.conversationStarters || []);
            setPublished(draft.published || false);
            setPortrait(draft.portrait || "");
            setAvatarSettings(draft.avatarSettings || DEFAULT_CONFIG);

            // Show toast notification
            addToast({
              title: "Draft Restored",
              description: "Continue where you left off!",
              color: "primary",
              icon: "✨",
            });
          }
        } catch (error) {
          console.error("Failed to restore draft:", error);
          // If there's an error, clear the invalid draft
          localStorage.removeItem(
            siteConfig.localCache.addAvatarDraftLocalStorageKey
          );
        }
      }
    };

    loadAvatar();
  }, [avatarId, isNewAvatar]);

  // Load chat messages when avatar changes
  useEffect(() => {
    loadChatMessages();
  }, [avatarId, isNewAvatar]);

  // Real-time local updates for editing mode (only when there are actual changes)
  useEffect(() => {
    if (!isNewAvatar && existingAvatar && hasUnsavedChanges) {
      const updateLocal = async () => {
        try {
          await avatarStorage.updateLocal(avatarId, {
            name,
            title,
            systemPrompt,
            conversationStarters,
            published,
            portrait,
            settings: avatarSettings,
            lastEditedBy: user?.name || "Unknown User",
            speechAnalysis: speechAnalysis || undefined,
            speechPromptAddition,
            speechSourceFiles,
          });
        } catch (error) {
          console.error("Failed to update local cache:", error);
        }
      };

      // Debounce the update to avoid too many calls
      const timeoutId = setTimeout(updateLocal, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [
    name,
    title,
    systemPrompt,
    conversationStarters,
    published,
    portrait,
    avatarSettings,
    avatarId,
    isNewAvatar,
    existingAvatar,
    hasUnsavedChanges,
    user?.name,
  ]);

  const handleSave = async () => {
    if (!validateForm()) return;

    console.log("🔍 Starting save process with data:", {
      isNewAvatar,
      name,
      systemPrompt: systemPrompt.substring(0, 200) + "...",
      systemPromptLength: systemPrompt.length,
      speechAnalysis: speechAnalysis ? "present" : "null",
      speechPromptAddition: speechPromptAddition
        ? speechPromptAddition.substring(0, 100) + "..."
        : "empty",
      speechSourceFiles,
      conversationStarters: conversationStarters.length,
    });

    setIsSaving(true);

    // Capture if there are document changes before processing
    const hadDocumentChanges =
      pendingDocuments.length > 0 || pendingDeletions.length > 0;

    try {
      // First save the avatar
      if (isNewAvatar) {
        // Create new avatar
        const avatarData = {
          name,
          title,
          systemPrompt,
          conversationStarters,
          published,
          portrait,
          settings: avatarSettings,
          createdBy: user?.name || "Unknown User",
          lastEditedBy: user?.name || "Unknown User",
          speechAnalysis: speechAnalysis || undefined,
          speechPromptAddition,
          speechSourceFiles: speechAnalysis
            ? speechAnalysis.metadata.sourceFiles.map((fileName) => ({
                name: fileName,
                type: "transcript" as "audio" | "transcript" | "pdf", // Default type since we don't track it in metadata
                uploadedAt: new Date().toISOString(),
              }))
            : undefined,
        };

        console.log("🔍 Creating new avatar with data:", avatarData);
        await avatarStorage.add(avatarData);
        console.log("🔍 New avatar created successfully");

        // Clear the draft since avatar was successfully created
        localStorage.removeItem(
          siteConfig.localCache.addAvatarDraftLocalStorageKey
        );
      } else {
        // Update existing avatar with all current data including speech analysis
        const updateData = {
          name,
          systemPrompt,
          conversationStarters,
          published,
          settings: avatarSettings,
          lastEditedBy: user?.name || "Unknown User",
          speechAnalysis: speechAnalysis || undefined,
          speechPromptAddition,
          speechSourceFiles,
        };

        console.log("🔍 Updating existing avatar with data:", {
          ...updateData,
          systemPrompt: updateData.systemPrompt.substring(0, 200) + "...",
          speechAnalysis: updateData.speechAnalysis ? "present" : "null",
        });

        await avatarStorage.updateLocal(avatarId, updateData);
        console.log("🔍 Local update completed");

        // Save existing avatar
        await avatarStorage.save(avatarId);
        console.log("🔍 Remote save completed");
      }

      // Process pending deletions if any
      if (pendingDeletions.length > 0) {
        console.log(
          `Processing ${pendingDeletions.length} pending deletions...`
        );

        for (const deletion of pendingDeletions) {
          try {
            const response = await fetch("/api/documents/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sourceId: deletion.sourceId,
                avatarId: isNewAvatar ? generatedId : avatarId,
              }),
            });

            if (!response.ok) {
              throw new Error(`Failed to delete ${deletion.title}`);
            }

            console.log(`Successfully deleted: ${deletion.title}`);
          } catch (deleteError) {
            console.error(
              `Failed to delete document ${deletion.title}:`,
              deleteError
            );
            // Continue with other deletions even if one fails
          }
        }

        // Clear pending deletions after successful processing
        setPendingDeletions([]);
      }

      // Process pending documents if any
      if (pendingDocuments.length > 0) {
        console.log(
          `Processing ${pendingDocuments.length} pending documents...`
        );

        for (const doc of pendingDocuments) {
          try {
            if (doc.source === "file" && doc.file) {
              // Process file
              const formData = new FormData();
              formData.append("file", doc.file);
              formData.append("title", doc.title);
              formData.append("avatarId", isNewAvatar ? generatedId : avatarId);
              formData.append("isShared", "false");

              const response = await fetch("/api/documents/upload", {
                method: "POST",
                body: formData,
              });

              if (!response.ok) {
                throw new Error(`Failed to upload ${doc.title}`);
              }

              // File uploaded successfully
            }
          } catch (docError) {
            console.error(`Failed to process document ${doc.title}:`, docError);
            // Continue with other documents even if one fails
          }
        }

        // Clear pending documents after successful processing
        setPendingDocuments([]);
      }

      // Show success toast if there were document changes
      if (hadDocumentChanges) {
        addToast({
          title: "Documents Updated",
          description: "All document changes have been saved successfully",
          color: "success",
        });
      }

      // Navigate back to avatar management
      router.push("/avatar-management");
    } catch (error) {
      console.error("Error saving avatar:", error);
      // Check if this is a conflict error
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.toLowerCase().includes("conflict")) {
        setErrors({
          save: "Failed to save avatar. Someone else has edited this avatar while you were editing, causing a conflict. Please copy and paste your current version from the text boxes above and save it somewhere else. We'll get the latest version to override your edits, and you can manually merge the changes. Please click the back button below when you are ready to have your changes overridden.",
        });
      } else {
        setErrors({ save: "Failed to save avatar. Please try again." });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishToggle = async () => {
    if (isNewAvatar) {
      // For new avatars, just toggle the local state
      setPublished(!published);
      return;
    }

    setIsPublishing(true);

    try {
      await avatarStorage.togglePublish(avatarId, !published);
      setPublished(!published);
    } catch (error) {
      console.error("Error updating publish status:", error);
      setErrors({
        publish: "Failed to update publish status. Please try again.",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== name) {
      setErrors({
        delete: "Please type the exact avatar name to confirm deletion.",
      });
      return;
    }

    setIsDeleting(true);

    try {
      await avatarStorage.delete(avatarId);
      router.push("/avatar-management");
    } catch (error) {
      console.error("Error deleting avatar:", error);
      setErrors({ delete: "Failed to delete avatar. Please try again." });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      setPendingNavigation(() => () => router.push("/avatar-management"));
      setIsUnsavedModalOpen(true);
    } else {
      router.push("/avatar-management");
    }
  };

  const handleNavigationConfirm = async (action: "stash" | "discard") => {
    if (action === "discard") {
      if (isNewAvatar) {
        // For new avatars, just clear the form and local storage
        setName("");
        setTitle("");
        setSystemPrompt("");
        setConversationStarters([]);
        setPublished(false);
        setPortrait("");
        setAvatarSettings(DEFAULT_CONFIG);
        setOriginalValues({
          name: "",
          title: "",
          systemPrompt: "",
          conversationStarters: [],
          published: false,
          portrait: "",
          avatarSettings: DEFAULT_CONFIG,
        });
        localStorage.removeItem(
          siteConfig.localCache.addAvatarDraftLocalStorageKey
        );
        setPendingDocuments([]);
        setPendingDeletions([]);

        // Restore any pending deletions back to the document list
        if (documentUploadRef.current) {
          documentUploadRef.current.restorePendingDeletions();
        }

        // Show info toast
        addToast({
          title: "Draft Discarded",
          description: "All changes have been cleared.",
          color: "warning",
        });
      } else {
        setIsDiscarding(true);
        // Restore from clean remote version for existing avatars
        try {
          const remoteAvatar = await avatarStorage.getRemoteVersion(avatarId);
          if (remoteAvatar) {
            setName(remoteAvatar.name);
            setTitle(remoteAvatar.title || "");
            setSystemPrompt(remoteAvatar.systemPrompt);
            setConversationStarters(remoteAvatar.conversationStarters || []);
            setPublished(remoteAvatar.published || false);
            setPortrait(remoteAvatar.portrait || "");
            setAvatarSettings(remoteAvatar.settings || DEFAULT_CONFIG);
            setOriginalValues({
              name: remoteAvatar.name,
              title: remoteAvatar.title || "",
              systemPrompt: remoteAvatar.systemPrompt,
              conversationStarters: remoteAvatar.conversationStarters || [],
              published: remoteAvatar.published || false,
              portrait: remoteAvatar.portrait || "",
              avatarSettings: remoteAvatar.settings || DEFAULT_CONFIG,
            });
            setExistingAvatar(remoteAvatar);
            setPendingDocuments([]);
            setPendingDeletions([]);

            // Restore any pending deletions back to the document list
            if (documentUploadRef.current) {
              documentUploadRef.current.restorePendingDeletions();
            }
          }
        } catch (error) {
          console.error("Failed to restore from remote:", error);
          setErrors({
            save: "Failed to restore from remote version. Please try again.",
          });
          setIsDiscarding(false);
          return; // Don't close modal or navigate on error
        } finally {
          setIsDiscarding(false);
        }
      }
    } else if (action === "stash") {
      if (isNewAvatar) {
        // For new avatars, save to local storage
        const draftData = {
          name,
          title,
          systemPrompt,
          conversationStarters,
          published,
          portrait,
          avatarSettings,
          timestamp: Date.now(),
        };
        localStorage.setItem(
          siteConfig.localCache.addAvatarDraftLocalStorageKey,
          JSON.stringify(draftData)
        );

        // Show success toast
        addToast({
          title: "Draft Saved",
          description: "Your progress has been saved locally.",
          color: "success",
        });
      }
      // For existing avatars, changes are already in IndexedDB cache
    }

    setIsUnsavedModalOpen(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  const currentUser = user?.name || "Unknown User";

  // Chat functions
  const getChatStorageKey = () =>
    `${siteConfig.localCache.avatarPreviewChatLocalStorageKeyPrefix}${avatarId}`;

  const loadChatMessages = () => {
    if (isNewAvatar) return;
    try {
      const saved = localStorage.getItem(getChatStorageKey());
      if (saved) {
        setChatMessages(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Failed to load chat messages:", error);
    }
  };

  const saveChatMessages = (messages: typeof chatMessages) => {
    if (isNewAvatar) return;
    try {
      localStorage.setItem(getChatStorageKey(), JSON.stringify(messages));
      setChatMessages(messages);
    } catch (error) {
      console.error("Failed to save chat messages:", error);
    }
  };

  const openChatModal = () => {
    setIsChatModalOpen(true);
  };

  const closeChatModal = () => {
    setIsChatModalOpen(false);
  };

  const openVideoPreviewModal = () => {
    setIsVideoPreviewModalOpen(true);
  };

  const closeVideoPreviewModal = () => {
    setIsVideoPreviewModalOpen(false);
  };

  // Speech pattern analysis functions
  const handleSpeechAnalysisComplete = (
    analysis: SpeechPatternAnalysis,
    promptAddition: string
  ) => {
    console.log("🔍 Speech analysis completed:", {
      analysis,
      promptAddition,
      promptAdditionLength: promptAddition.length,
    });

    setSpeechAnalysis(analysis);
    setSpeechPromptAddition(promptAddition);
    setUseSpeechPatterns(true);

    // Set speech source files from analysis metadata
    setSpeechSourceFiles(
      analysis.metadata.sourceFiles.map((fileName) => ({
        name: fileName,
        type: "transcript" as "audio" | "transcript" | "pdf", // Default since we don't track original type
        uploadedAt: new Date().toISOString(),
      }))
    );

    // Actually apply the speech analysis to the system prompt
    setSystemPrompt((prev) => {
      console.log("🔍 Updating system prompt:", {
        previousPrompt: prev,
        promptAddition,
        promptAdditionLength: promptAddition.length,
      });

      const basePrompt = prev.replace(
        /\n\n## Speech Pattern Enhancement:[\s\S]*$/,
        ""
      );
      const newPrompt = `${basePrompt}\n\n## Speech Pattern Enhancement:\n${promptAddition}`;

      console.log("🔍 New system prompt:", {
        basePrompt,
        newPrompt,
        newPromptLength: newPrompt.length,
      });

      return newPrompt;
    });

    // Generate conversation starters based on speech patterns
    const generatedStarters =
      generateConversationStartersFromAnalysis(analysis);
    setConversationStarters((prev) => [...prev, ...generatedStarters]);

    addToast({
      title: "Speech Patterns Applied",
      description:
        "System prompt and conversation starters updated with analyzed speech patterns.",
      color: "success",
    });
  };

  // Generate conversation starters from speech analysis
  const generateConversationStartersFromAnalysis = (
    analysis: SpeechPatternAnalysis
  ): ConversationStarter[] => {
    const starters: ConversationStarter[] = [];

    // Generate starters based on communication style
    if (analysis.personality.communicationStyle === "conversational") {
      starters.push({
        title: "General Chat",
        question: "What's on your mind today?",
      });
    } else if (analysis.personality.communicationStyle === "professional") {
      starters.push({
        title: "Professional Assistance",
        question: "How can I assist you today?",
      });
    }

    // Generate starters based on primary tone
    if (analysis.tone.primary === "supportive") {
      starters.push({
        title: "Support",
        question:
          "I'm here to help you work through any challenges you're facing.",
      });
    } else if (analysis.tone.primary === "enthusiastic") {
      starters.push({
        title: "Explore Together",
        question:
          "I'm excited to explore this topic with you! What would you like to discuss?",
      });
    }

    // Generate starters based on common phrases
    if (analysis.patterns.commonPhrases.length > 0) {
      const commonPhrase = analysis.patterns.commonPhrases[0];
      starters.push({
        title: "Deep Dive",
        question: `Let's explore ${commonPhrase.toLowerCase()} in more detail.`,
      });
    }

    return starters.slice(0, 3); // Limit to 3 new starters
  };

  // Compute the final system prompt with speech patterns
  const finalSystemPrompt = useMemo(() => {
    if (useSpeechPatterns && speechPromptAddition) {
      return systemPrompt + speechPromptAddition;
    }
    return systemPrompt;
  }, [systemPrompt, speechPromptAddition, useSpeechPatterns]);

  if (isLoading && !isNewAvatar) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center py-12">
          <p className="text-default-500">Loading avatar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          isIconOnly
          className="min-w-0"
          variant="light"
          onPress={handleBack}
        >
          <ArrowLeft />
        </Button>
        <div className="flex items-center gap-4">
          <h1 className={pageTitle()}>
            {isNewAvatar
              ? "Create New Avatar"
              : `Edit ${existingAvatar?.name || "Avatar"}`}
          </h1>
          {!isNewAvatar && (
            <Chip
              color={published ? "success" : "default"}
              startContent={
                published ? (
                  <Globe className="w-3 h-3" />
                ) : (
                  <FileText className="w-3 h-3" />
                )
              }
              variant={published ? "solid" : "bordered"}
            >
              {published ? "Published" : "Draft"}
            </Chip>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Avatar Details</h2>
            </CardHeader>
            <CardBody className="space-y-6">
              {/* Avatar Name */}
              <div>
                <Input
                  isRequired
                  errorMessage={errors.name}
                  isInvalid={!!errors.name}
                  label="Avatar Name"
                  placeholder="Enter a descriptive name for your avatar"
                  value={name}
                  onValueChange={setName}
                />
              </div>

              {/* Auto-generated ID */}
              <div>
                <Input
                  isReadOnly
                  classNames={{
                    input: "font-mono",
                  }}
                  color={generatedId === "new" ? "danger" : "default"}
                  description={
                    isNewAvatar
                      ? "This ID is automatically generated from the name and will be used in URLs"
                      : "Avatar ID is permanent and cannot be changed after creation, even if the name is modified"
                  }
                  label={
                    isNewAvatar
                      ? "Avatar ID (Auto-generated)"
                      : "Avatar ID (Immutable)"
                  }
                  value={generatedId}
                />
                {generatedId === "new" && (
                  <div className="flex items-center gap-2 mt-2 text-danger text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>
                      This name generates a reserved ID. Please choose a
                      different name.
                    </span>
                  </div>
                )}
              </div>

              {/* Avatar Title */}
              <div>
                <Input
                  isRequired
                  errorMessage={errors.title}
                  isInvalid={!!errors.title}
                  label="Professional Title"
                  placeholder="Enter a professional title for your avatar (e.g., 'Professor, Organizational Behavior')"
                  value={title}
                  onValueChange={setTitle}
                />
              </div>

              {/* System Prompt */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">System Prompt</h3>
                    {speechAnalysis && (
                      <div className="flex items-center gap-2">
                        <Chip
                          size="sm"
                          color={useSpeechPatterns ? "success" : "default"}
                          variant={useSpeechPatterns ? "solid" : "bordered"}
                        >
                          Speech Patterns{" "}
                          {useSpeechPatterns ? "Applied" : "Available"}
                        </Chip>
                        <Button
                          size="sm"
                          color={useSpeechPatterns ? "danger" : "success"}
                          variant="flat"
                          onPress={() =>
                            setUseSpeechPatterns(!useSpeechPatterns)
                          }
                        >
                          {useSpeechPatterns ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    )}
                  </div>
                  <Textarea
                    isRequired
                    description={`Be specific about the avatar's role, tone, and any special behaviors. This can be very detailed.${speechAnalysis ? " Speech patterns will be automatically appended when enabled." : ""}`}
                    errorMessage={errors.systemPrompt}
                    isInvalid={!!errors.systemPrompt}
                    label="Base System Prompt"
                    maxRows={50}
                    minRows={8}
                    placeholder="Describe how this avatar should behave, its personality, expertise, and any specific instructions..."
                    value={systemPrompt}
                    onValueChange={setSystemPrompt}
                  />
                </div>

                {/* Speech Pattern Preview */}
                {speechAnalysis && useSpeechPatterns && (
                  <Card className="border-success-200 bg-success-50">
                    <CardBody className="p-4">
                      <div className="flex items-start gap-3">
                        <AudioLines
                          className="text-success-600 mt-0.5"
                          size={20}
                        />
                        <div className="flex-1">
                          <h4 className="font-medium text-success-800 mb-2">
                            Speech Pattern Enhancement Active
                          </h4>
                          <p className="text-sm text-success-700 mb-3">
                            The avatar will embody these analyzed
                            characteristics:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Chip size="sm" color="success" variant="flat">
                              {speechAnalysis.tone.primary} tone
                            </Chip>
                            <Chip size="sm" color="success" variant="flat">
                              {speechAnalysis.personality.communicationStyle}{" "}
                              style
                            </Chip>
                            <Chip size="sm" color="success" variant="flat">
                              {speechAnalysis.personality.formalityLevel}{" "}
                              formality
                            </Chip>
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                )}
              </div>

              {/* Conversation Starters */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      Conversation Starters
                    </h3>
                    <p className="text-sm text-default-500">
                      Add up to 5 conversation starters to help users begin
                      conversations
                    </p>
                  </div>
                  {conversationStarters.length < 5 && (
                    <Button
                      color="primary"
                      size="sm"
                      startContent={<Plus className="w-4 h-4" />}
                      variant="bordered"
                      onPress={() => {
                        setConversationStarters([
                          ...conversationStarters,
                          { title: "", question: "", openingRemarks: undefined },
                        ]);
                      }}
                    >
                      Add Starter
                    </Button>
                  )}
                </div>

                {conversationStarters.length === 0 && (
                  <div className="text-center py-8 text-default-400">
                    <p>No conversation starters yet</p>
                    <p className="text-sm">
                      Click &quot;Add Starter&quot; to create your first one
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {conversationStarters.map((starter, index) => (
                    <Card key={index} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Starter {index + 1}</h4>
                          <Button
                            isIconOnly
                            color="danger"
                            size="sm"
                            variant="light"
                            onPress={() => {
                              const newStarters = conversationStarters.filter(
                                (_, i) => i !== index
                              );

                              setConversationStarters(newStarters);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="space-y-3">
                          <Input
                            isRequired
                            label="Title"
                            placeholder="Brief, catchy title (e.g., 'Get Started', 'Ask About...')"
                            value={starter.title}
                            onValueChange={(value) => {
                              const newStarters = [...conversationStarters];

                              newStarters[index] = { ...starter, title: value };
                              setConversationStarters(newStarters);
                            }}
                          />

                          <Textarea
                            isRequired
                            label="Question"
                            maxRows={4}
                            minRows={2}
                            placeholder="The actual question that will be sent to the AI (e.g., 'Tell me about your background and expertise')"
                            value={starter.question}
                            onValueChange={(value) => {
                              const newStarters = [...conversationStarters];

                              newStarters[index] = {
                                ...starter,
                                question: value,
                              };
                              setConversationStarters(newStarters);
                            }}
                          />

                          <Textarea
                            description="Optional: Pre-written response for instant avatar reply (skips AI call for faster first interaction)"
                            label="Opening Remarks (Optional)"
                            maxRows={6}
                            minRows={3}
                            placeholder="Enter a pre-written response that the avatar will speak immediately when this starter is selected..."
                            value={starter.openingRemarks || ""}
                            onValueChange={(value) => {
                              const newStarters = [...conversationStarters];

                              newStarters[index] = {
                                ...starter,
                                openingRemarks: value || undefined,
                              };
                              setConversationStarters(newStarters);
                            }}
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {errors.conversationStarters && (
                  <div className="text-danger text-sm">
                    {errors.conversationStarters}
                  </div>
                )}
              </div>

              {/* Speech Pattern Upload */}
              <div className="space-y-4">
                {speechAnalysis && (
                  <Card className="border-success-200 bg-success-50">
                    <CardBody className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-success-500 flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-success-800">
                            Speech Pattern Analysis Complete
                          </h4>
                          <p className="text-sm text-success-700">
                            Analyzed{" "}
                            {speechAnalysis.metadata.sourceFiles.length} file(s)
                            • Communication Style:{" "}
                            {speechAnalysis.personality.communicationStyle} •
                            Primary Tone: {speechAnalysis.tone.primary}
                          </p>
                          {speechSourceFiles.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {speechSourceFiles.map((file, index) => (
                                <Chip
                                  key={index}
                                  size="sm"
                                  variant="flat"
                                  color="success"
                                >
                                  {file.name}
                                </Chip>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                )}
                <SpeechPatternUpload
                  avatarId={isNewAvatar ? generatedId : avatarId}
                  onAnalysisComplete={handleSpeechAnalysisComplete}
                  disabled={!name.trim() || generatedId === "new"}
                />
              </div>

              {/* Document Upload */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Document Upload</h3>
                  <p className="text-sm text-default-500">
                    Upload documents to help the avatar answer questions
                  </p>
                </div>
                <DocumentUpload
                  ref={documentUploadRef}
                  avatarId={isNewAvatar ? generatedId : avatarId}
                  isShared={false}
                  onDocumentAdded={(document) => {
                    console.log("Document added:", document);
                  }}
                  onDocumentDeleted={(documentId) => {
                    console.log("Document deleted:", documentId);
                  }}
                  onPendingDocumentsChange={setPendingDocuments}
                  onPendingDeletionsChange={setPendingDeletions}
                />
              </div>

              {/* Error Messages */}
              {errors.save && (
                <div className="p-3 bg-danger-50 border border-danger-200 rounded text-danger-700 text-sm">
                  {errors.save}
                </div>
              )}
              {errors.publish && (
                <div className="p-3 bg-danger-50 border border-danger-200 rounded text-danger-700 text-sm">
                  {errors.publish}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 flex-wrap">
                <Button
                  color="primary"
                  isDisabled={
                    !name.trim() ||
                    !title.trim() ||
                    !systemPrompt.trim() ||
                    generatedId === "new" ||
                    !avatarSettings.avatarName.trim() ||
                    !avatarSettings.voice.voiceId.trim() ||
                    !avatarSettings.language.trim() ||
                    isLoading
                  }
                  isLoading={isSaving}
                  startContent={!isSaving ? <Save className="w-4 h-4" /> : null}
                  onPress={handleSave}
                >
                  {isSaving
                    ? "Saving..."
                    : isNewAvatar
                      ? "Create Avatar"
                      : "Save Changes"}
                </Button>

                {!isNewAvatar && (
                  <Button
                    color={published ? "warning" : "success"}
                    isDisabled={isLoading || isSaving}
                    isLoading={isPublishing}
                    startContent={
                      published ? (
                        <FileText className="w-4 h-4" />
                      ) : (
                        <Globe className="w-4 h-4" />
                      )
                    }
                    variant="bordered"
                    onPress={handlePublishToggle}
                  >
                    {published ? "Unpublish" : "Publish"}
                  </Button>
                )}

                {!isNewAvatar && (
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
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Avatar Preview */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Preview</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <AvatarImage
                    name={name || "Preview"}
                    portrait={portrait}
                    size={48}
                  />
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    className="absolute -bottom-1 -right-1 min-w-6 w-6 h-6 bg-background border border-default-200"
                    onPress={() => setIsImageUploadModalOpen(true)}
                    isDisabled={!generatedId || generatedId === "new"}
                  >
                    <ImageIcon size={12} />
                  </Button>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{name || "Avatar Name"}</p>
                    <Chip
                      color={published ? "success" : "default"}
                      size="sm"
                      startContent={
                        published ? (
                          <Globe className="w-3 h-3" />
                        ) : (
                          <FileText className="w-3 h-3" />
                        )
                      }
                      variant={published ? "solid" : "bordered"}
                    >
                      {published ? "Published" : "Draft"}
                    </Chip>
                  </div>
                  <p className="text-sm text-default-500 font-mono">
                    {generatedId || "avatar-id"}
                  </p>
                </div>
              </div>

              <PreviewChatSmall
                disabled={isNewAvatar}
                messages={chatMessages}
                onOpenFullChat={openChatModal}
              />

              <div className="space-y-2">
                <Button
                  fullWidth
                  color="secondary"
                  disabled={
                    isNewAvatar ||
                    !avatarSettings.avatarName.trim() ||
                    !avatarSettings.voice.voiceId.trim() ||
                    !avatarSettings.language.trim() ||
                    !/^[a-z]{2}$/.test(avatarSettings.language)
                  }
                  size="lg"
                  variant="shadow"
                  onPress={openVideoPreviewModal}
                >
                  <Video />
                  Video/Audio Preview
                  <AudioLines />
                </Button>
                {isNewAvatar && (
                  <p className="text-xs text-default-400 text-center">
                    Save avatar to test video preview
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Avatar Settings */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Avatar Settings</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              {/* Quality Setting */}
              <div>
                <Select
                  isRequired
                  description="Quality of the avatar's video rendering"
                  label="Quality"
                  placeholder="Select quality level"
                  selectedKeys={[avatarSettings.quality]}
                  onSelectionChange={(keys) => {
                    const quality = Array.from(keys)[0] as
                      | "low"
                      | "medium"
                      | "high";

                    setAvatarSettings((prev) => ({ ...prev, quality }));
                  }}
                >
                  <SelectItem key="low">Low</SelectItem>
                  <SelectItem key="medium">Medium</SelectItem>
                  <SelectItem key="high">High</SelectItem>
                </Select>
              </div>

              {/* Avatar Name for API */}
              <div>
                <Input
                  isRequired
                  description="This name is used for API calls and can be different from the display name above"
                  errorMessage={errors.avatarName}
                  isInvalid={!!errors.avatarName}
                  label="Avatar Name (API)"
                  placeholder="Enter avatar name for API calls"
                  value={avatarSettings.avatarName}
                  onValueChange={(value) =>
                    setAvatarSettings((prev) => ({
                      ...prev,
                      avatarName: value,
                    }))
                  }
                />
              </div>

              {/* Knowledge ID */}
              <div>
                <Input
                  isReadOnly
                  classNames={{
                    input: "bg-default-100",
                  }}
                  description="This field is not in use yet, please ignore it"
                  label="Knowledge ID"
                  placeholder="Leave empty for default knowledge base"
                  value={avatarSettings.knowledgeId || ""}
                  onValueChange={(value) =>
                    setAvatarSettings((prev) => ({
                      ...prev,
                      knowledgeId: value || undefined,
                    }))
                  }
                />
              </div>

              {/* Voice Settings */}
              <div className="space-y-4">
                <h4 className="text-medium font-semibold">
                  Voice Configuration
                </h4>

                {/* Voice Rate */}
                <div>
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
                    value={avatarSettings.voice.rate}
                    onChange={(value) =>
                      setAvatarSettings((prev) => ({
                        ...prev,
                        voice: {
                          ...prev.voice,
                          rate: Array.isArray(value) ? value[0] : value,
                        },
                      }))
                    }
                  />
                </div>

                {/* Voice ID */}
                <div>
                  <Input
                    isRequired
                    description="Voice identifier for speech synthesis"
                    errorMessage={errors.voiceId}
                    isInvalid={!!errors.voiceId}
                    label="Voice ID"
                    placeholder="Enter voice identifier"
                    value={avatarSettings.voice.voiceId}
                    onValueChange={(value) =>
                      setAvatarSettings((prev) => ({
                        ...prev,
                        voice: { ...prev.voice, voiceId: value },
                      }))
                    }
                  />
                </div>

                {/* Language Setting */}
                <div>
                  <Input
                    isRequired
                    description="Two lowercase letters only. Well supported: en, zh, ko, vi, fr, de, ja"
                    errorMessage={errors.language}
                    isInvalid={!!errors.language}
                    label="Language"
                    maxLength={2}
                    placeholder="en"
                    value={avatarSettings.language}
                    onValueChange={(value) =>
                      setAvatarSettings((prev) => ({
                        ...prev,
                        language: value,
                      }))
                    }
                  />
                </div>

                {/* Voice Emotion */}
                <div>
                  <Select
                    disallowEmptySelection={false}
                    label="Voice Emotion"
                    placeholder="Select voice emotion (optional)"
                    selectedKeys={
                      avatarSettings.voice.emotion
                        ? [avatarSettings.voice.emotion]
                        : []
                    }
                    selectionMode="single"
                    onSelectionChange={(keys) => {
                      const keysArray = Array.from(keys);
                      const emotion =
                        keysArray.length > 0
                          ? (keysArray[0] as VoiceEmotion)
                          : undefined;

                      setAvatarSettings((prev) => ({
                        ...prev,
                        voice: { ...prev.voice, emotion },
                      }));
                    }}
                  >
                    <SelectItem key={VoiceEmotion.EXCITED}>Excited</SelectItem>
                    <SelectItem key={VoiceEmotion.SERIOUS}>Serious</SelectItem>
                    <SelectItem key={VoiceEmotion.FRIENDLY}>
                      Friendly
                    </SelectItem>
                    <SelectItem key={VoiceEmotion.SOOTHING}>
                      Soothing
                    </SelectItem>
                    <SelectItem key={VoiceEmotion.BROADCASTER}>
                      Broadcaster
                    </SelectItem>
                  </Select>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Metadata</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              <div>
                <p className="text-sm font-medium">Created by:</p>
                <p className="text-sm text-default-600">
                  {isNewAvatar
                    ? currentUser
                    : existingAvatar?.createdBy || "Unknown"}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium">Last edited by:</p>
                <p className="text-sm text-default-600">{currentUser}</p>
              </div>

              {existingAvatar && (
                <div>
                  <p className="text-sm font-medium">Created:</p>
                  <p className="text-sm text-default-600">
                    {new Date(existingAvatar.createdAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isDismissable={!isDeleting}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold">Delete Avatar</h3>
                <p className="text-sm text-default-500">
                  This action cannot be undone. This will permanently delete the
                  avatar.
                </p>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <p className="text-sm">
                    To confirm deletion, please type the avatar name:{" "}
                    <span className="font-mono font-semibold">{name}</span>
                  </p>
                  <Input
                    errorMessage={errors.delete}
                    isDisabled={isDeleting}
                    isInvalid={!!errors.delete}
                    label="Avatar Name"
                    placeholder={`Type "${name}" to confirm`}
                    value={deleteConfirmText}
                    onValueChange={setDeleteConfirmText}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  isDisabled={isDeleting}
                  variant="light"
                  onPress={onClose}
                >
                  Cancel
                </Button>
                <Button
                  color="danger"
                  isDisabled={deleteConfirmText !== name}
                  isLoading={isDeleting}
                  onPress={handleDelete}
                >
                  {isDeleting ? "Deleting..." : "Delete Avatar"}
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
        size="xl"
        onOpenChange={setIsUnsavedModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold">Unsaved Changes</h3>
                <p className="text-sm text-default-500">
                  You have unsaved changes. What would you like to do?
                </p>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <div className="p-4 bg-warning-50 border border-warning-200 rounded">
                    <h4 className="font-medium text-warning-800 mb-2">
                      Stash Changes
                    </h4>
                    <p className="text-sm text-warning-700">
                      {isNewAvatar
                        ? "Save your progress locally. You can continue creating this avatar later."
                        : "Keep your changes in local cache to continue editing later."}
                      {!isNewAvatar && (
                        <strong className="block mt-1">
                          Warning: Others might edit this avatar and create
                          version conflicts.
                        </strong>
                      )}
                    </p>
                  </div>

                  <div className="p-4 bg-danger-50 border border-danger-200 rounded">
                    <h4 className="font-medium text-danger-800 mb-2">
                      Discard Changes
                    </h4>
                    <p className="text-sm text-danger-700">
                      {isNewAvatar
                        ? "Clear all your input and start fresh. This cannot be undone."
                        : "Discard all your changes and restore to the latest remote version. This cannot be undone."}
                    </p>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  isDisabled={isDiscarding}
                  variant="light"
                  onPress={onClose}
                >
                  Stay and Continue Editing
                </Button>
                <Button
                  color="warning"
                  isDisabled={isDiscarding}
                  variant="bordered"
                  onPress={() => handleNavigationConfirm("stash")}
                >
                  Stash Changes
                </Button>
                <Button
                  color="danger"
                  isDisabled={isDiscarding}
                  isLoading={isDiscarding}
                  onPress={() => handleNavigationConfirm("discard")}
                >
                  {isDiscarding ? "Discarding..." : "Discard Changes"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Video Preview Modal */}
      <Modal
        isDismissable={false}
        isKeyboardDismissDisabled={true}
        isOpen={isVideoPreviewModalOpen}
        scrollBehavior="inside"
        size="5xl"
        onOpenChange={setIsVideoPreviewModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold">Video Preview</h3>
                <p className="text-sm text-default-500">
                  Test your avatar configuration with real-time video
                </p>
              </ModalHeader>
              <ModalBody className="p-6">
                <div className="w-full max-w-3xl mx-auto">
                  <InteractiveAvatarWrapper
                    autoStart={false}
                    config={avatarSettings}
                    showHistory={false}
                  />
                </div>
                <div className="mt-4 p-4 bg-default-50 rounded-lg">
                  <h4 className="font-medium mb-2">Current Configuration:</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Quality:</span>{" "}
                      {avatarSettings.quality}
                    </div>
                    <div>
                      <span className="font-medium">Avatar:</span>{" "}
                      {avatarSettings.avatarName}
                    </div>
                    <div>
                      <span className="font-medium">Voice ID:</span>{" "}
                      {avatarSettings.voice.voiceId}
                    </div>
                    <div>
                      <span className="font-medium">Language:</span>{" "}
                      {avatarSettings.language}
                    </div>
                    <div>
                      <span className="font-medium">Voice Rate:</span>{" "}
                      {avatarSettings.voice.rate}x
                    </div>
                    <div>
                      <span className="font-medium">Emotion:</span>{" "}
                      {avatarSettings.voice.emotion || "None"}
                    </div>
                  </div>
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Image Upload Modal */}
      <Modal
        isDismissable={true}
        isOpen={isImageUploadModalOpen}
        size="2xl"
        onOpenChange={setIsImageUploadModalOpen}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold">Change Avatar Image</h3>
                <p className="text-sm text-default-500">
                  Upload and crop a custom image for your avatar
                </p>
              </ModalHeader>
              <ModalBody className="pb-6">
                <ImageUploadCrop
                  avatarId={isNewAvatar ? generatedId : avatarId}
                  avatarName={name || "Avatar"}
                  currentPortrait={portrait}
                  disabled={!generatedId || generatedId === "new"}
                  onImageUploaded={(portraitUrl) => {
                    setPortrait(portraitUrl);
                    setIsImageUploadModalOpen(false);
                  }}
                  onImageDeleted={() => {
                    setPortrait("");
                    setIsImageUploadModalOpen(false);
                  }}
                />
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Preview Chat Modal */}
      <PreviewChatFull
        avatarId={avatarId}
        avatarName={name || "Avatar"}
        conversationStarters={conversationStarters}
        isOpen={isChatModalOpen}
        messages={chatMessages}
        systemPrompt={finalSystemPrompt}
        onClose={closeChatModal}
        onMessagesUpdate={saveChatMessages}
      />
    </div>
  );
}
