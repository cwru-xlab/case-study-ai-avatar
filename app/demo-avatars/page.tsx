"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Globe, FileText, User, MessageCircle, Pencil, Search, X, GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@heroui/input";
import { mockAvatars, getFirstSentence, getRelativeTime } from "@/lib/mock-avatars";
import type { CachedAvatar } from "@/lib/avatar-storage";
import AvatarImage from "@/components/AvatarImage";

// Convert mock avatars to CachedAvatar format with additional fields
const initialAvatars: CachedAvatar[] = mockAvatars.map((avatar, index) => ({
  ...avatar,
  published: index < 6, // First 6 are published
  portrait: undefined, // Will use boring-avatars fallback
  title: getTitleForAvatar(avatar.id),
  conversationStarters: getConversationStartersForAvatar(avatar.id),
  localVersion: 1,
  remoteVersion: 1,
  isDirty: false,
}));

function getTitleForAvatar(id: string): string {
  const titles: Record<string, string> = {
    "helpful-assistant": "General Purpose AI Assistant",
    "creative-writer": "Creative Writing Specialist",
    "technical-expert": "Senior Technical Consultant",
    "friendly-tutor": "Educational Coach",
    "cat-assistant": "Feline Companion Assistant",
    "business-analyst": "Strategic Business Advisor",
    "code-reviewer": "Software Quality Engineer",
    "wellness-coach": "Mental Health & Wellness Guide",
  };
  return titles[id] || "AI Assistant";
}

function getConversationStartersForAvatar(id: string): Array<{ title: string; question: string }> {
  const starters: Record<string, Array<{ title: string; question: string }>> = {
    "helpful-assistant": [
      { title: "General Help", question: "How can you help me today?" },
      { title: "Quick Question", question: "I have a quick question about something." },
      { title: "Problem Solving", question: "I need help solving a problem." },
    ],
    "creative-writer": [
      { title: "Story Ideas", question: "Help me brainstorm some creative story ideas." },
      { title: "Writing Tips", question: "What are some tips for better creative writing?" },
      { title: "Character Development", question: "How do I create compelling characters?" },
    ],
    "technical-expert": [
      { title: "Technical Question", question: "I have a technical question about programming." },
      { title: "Code Review", question: "Can you help me review some code?" },
      { title: "Architecture", question: "I need advice on system architecture." },
    ],
    "friendly-tutor": [
      { title: "Learning Help", question: "I need help understanding a concept." },
      { title: "Study Tips", question: "What are some effective study strategies?" },
      { title: "Explain Simply", question: "Can you explain something in simple terms?" },
    ],
    "cat-assistant": [
      { title: "Cat Chat", question: "Tell me something interesting, mew!" },
      { title: "Fun Facts", question: "Share a fun fact with me!" },
      { title: "Playful Help", question: "Can you help me with something fun?" },
    ],
    "business-analyst": [
      { title: "Market Analysis", question: "Help me analyze market trends." },
      { title: "Strategy", question: "I need help with business strategy." },
      { title: "Data Insights", question: "Can you help me interpret this data?" },
    ],
    "code-reviewer": [
      { title: "Code Quality", question: "Review my code for best practices." },
      { title: "Bug Hunt", question: "Help me find potential bugs in my code." },
      { title: "Optimization", question: "How can I optimize this code?" },
    ],
    "wellness-coach": [
      { title: "Stress Relief", question: "I'm feeling stressed. Can you help?" },
      { title: "Mindfulness", question: "Guide me through a mindfulness exercise." },
      { title: "Personal Growth", question: "How can I work on personal development?" },
    ],
  };
  return starters[id] || [{ title: "Start Chat", question: "Let's have a conversation!" }];
}

export default function DemoAvatarsPage() {
  const router = useRouter();
  const [avatars, setAvatars] = useState<CachedAvatar[]>(initialAvatars);
  const [selectedAvatar, setSelectedAvatar] = useState<CachedAvatar | null>(null);
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Drag and drop state
  const [draggedAvatar, setDraggedAvatar] = useState<CachedAvatar | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);
  
  // Auto-scroll state
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mouseYRef = useRef<number>(0);

  // Auto-scroll configuration
  const SCROLL_ZONE_HEIGHT = 100; // pixels from edge to trigger scroll
  const SCROLL_SPEED = 15; // pixels per frame

  // Auto-scroll function
  const handleAutoScroll = useCallback(() => {
    const y = mouseYRef.current;
    const windowHeight = window.innerHeight;
    
    if (y < SCROLL_ZONE_HEIGHT) {
      // Near top - scroll up
      const intensity = 1 - (y / SCROLL_ZONE_HEIGHT);
      window.scrollBy(0, -SCROLL_SPEED * intensity);
    } else if (y > windowHeight - SCROLL_ZONE_HEIGHT) {
      // Near bottom - scroll down
      const intensity = (y - (windowHeight - SCROLL_ZONE_HEIGHT)) / SCROLL_ZONE_HEIGHT;
      window.scrollBy(0, SCROLL_SPEED * intensity);
    }
  }, []);

  // Start auto-scroll interval when dragging
  useEffect(() => {
    if (draggedAvatar) {
      scrollIntervalRef.current = setInterval(handleAutoScroll, 16); // ~60fps
    } else {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    }
    
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, [draggedAvatar, handleAutoScroll]);

  // Track mouse position during drag
  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.clientY !== 0) { // clientY is 0 at the end of drag
      mouseYRef.current = e.clientY;
    }
  }, []);

  const filteredAvatars = avatars.filter((avatar) => {
    // Apply search filter
    const matchesSearch = searchQuery === "" || 
      avatar.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Apply status filter
    const matchesFilter = 
      filter === "all" ||
      (filter === "published" && avatar.published) ||
      (filter === "draft" && !avatar.published);
    
    return matchesSearch && matchesFilter;
  });

  // Check if drag and drop should be disabled (when filtering/searching)
  const isDragDisabled = filter !== "all" || searchQuery !== "";

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, avatar: CachedAvatar) => {
    if (isDragDisabled) return;
    
    setDraggedAvatar(avatar);
    dragNodeRef.current = e.currentTarget;
    
    // Set drag image and effect
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", avatar.id);
    
    // Add dragging class after a small delay to avoid flickering
    setTimeout(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.style.opacity = "0.5";
      }
    }, 0);
  };

  const handleDragEnd = () => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = "1";
    }
    setDraggedAvatar(null);
    setDragOverId(null);
    dragNodeRef.current = null;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, avatar: CachedAvatar) => {
    e.preventDefault();
    if (isDragDisabled || !draggedAvatar || draggedAvatar.id === avatar.id) return;
    
    setDragOverId(avatar.id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetAvatar: CachedAvatar) => {
    e.preventDefault();
    if (isDragDisabled || !draggedAvatar || draggedAvatar.id === targetAvatar.id) return;

    const newAvatars = [...avatars];
    const draggedIndex = newAvatars.findIndex((a) => a.id === draggedAvatar.id);
    const targetIndex = newAvatars.findIndex((a) => a.id === targetAvatar.id);

    // Remove dragged item and insert at new position
    const [removed] = newAvatars.splice(draggedIndex, 1);
    newAvatars.splice(targetIndex, 0, removed);

    setAvatars(newAvatars);
    setDraggedAvatar(null);
    setDragOverId(null);
  };

  const handleAvatarClick = (avatar: CachedAvatar) => {
    setSelectedAvatar(avatar);
  };

  const handleEditClick = (e: React.MouseEvent, avatarId: string) => {
    e.stopPropagation(); // Prevent card click
    router.push(`/demo-avatars/edit/${avatarId}`);
  };

  const handleBack = () => {
    setSelectedAvatar(null);
  };

  // Selected avatar detail view
  if (selectedAvatar) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="light"
            onPress={handleBack}
            className="mb-6"
          >
            ← Back to Avatars
          </Button>

          <Card className="mb-8">
            <CardHeader className="flex gap-6 p-6">
              <AvatarImage
                name={selectedAvatar.name}
                portrait={selectedAvatar.portrait}
                size={120}
              />
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold">{selectedAvatar.name}</h1>
                  <Chip
                    size="md"
                    color={selectedAvatar.published ? "success" : "default"}
                    variant={selectedAvatar.published ? "solid" : "bordered"}
                    startContent={
                      selectedAvatar.published ? (
                        <Globe className="w-4 h-4" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )
                    }
                  >
                    {selectedAvatar.published ? "Published" : "Draft"}
                  </Chip>
                </div>
                <p className="text-lg text-default-600">{selectedAvatar.title}</p>
                <p className="text-sm text-default-400 font-mono mt-1">ID: {selectedAvatar.id}</p>
              </div>
            </CardHeader>
            <CardBody className="p-6 pt-0">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">System Prompt</h3>
                  <p className="text-default-600 bg-default-100 p-4 rounded-lg">
                    {selectedAvatar.systemPrompt}
                  </p>
                </div>

                {selectedAvatar.description && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Description</h3>
                    <p className="text-default-600">{selectedAvatar.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-default-400" />
                    <span className="text-sm text-default-500">Created by:</span>
                    <span className="text-sm font-medium">{selectedAvatar.createdBy}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-default-400" />
                    <span className="text-sm text-default-500">Last edited by:</span>
                    <span className="text-sm font-medium">{selectedAvatar.lastEditedBy}</span>
                  </div>
                </div>

                <div className="text-sm text-default-400">
                  Last edited {getRelativeTime(selectedAvatar.lastEditedAt)}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Conversation Starters */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Conversation Starters
            </h2>
            <div className="grid gap-4">
              {selectedAvatar.conversationStarters?.map((starter, idx) => (
                <Card
                  key={idx}
                  isPressable
                  className="hover:shadow-md transition-shadow"
                >
                  <CardBody className="p-4">
                    <p className="font-medium text-primary mb-1">{starter.title}</p>
                    <p className="text-default-600">&quot;{starter.question}&quot;</p>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Your Avatars</h1>
          <p className="text-default-600 text-lg">
            Browse and select from our collection of AI avatars (Mock Data - No S3 Required)
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex justify-center mb-6">
          <Input
            classNames={{
              base: "max-w-md",
              inputWrapper: "bg-white dark:bg-gray-800 shadow-sm",
            }}
            placeholder="Search avatars by name..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            startContent={<Search className="w-4 h-4 text-default-400" />}
            endContent={
              searchQuery && (
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => setSearchQuery("")}
                  className="min-w-unit-6 w-unit-6 h-unit-6"
                >
                  <X className="w-4 h-4 text-default-400" />
                </Button>
              )
            }
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex justify-center gap-2 mb-8">
          <Button
            variant={filter === "all" ? "solid" : "bordered"}
            color="primary"
            onPress={() => setFilter("all")}
          >
            All ({avatars.length})
          </Button>
          <Button
            variant={filter === "published" ? "solid" : "bordered"}
            color="success"
            onPress={() => setFilter("published")}
          >
            Published ({avatars.filter((a) => a.published).length})
          </Button>
          <Button
            variant={filter === "draft" ? "solid" : "bordered"}
            color="default"
            onPress={() => setFilter("draft")}
          >
            Drafts ({avatars.filter((a) => !a.published).length})
          </Button>
        </div>

        {/* Drag hint */}
        {!isDragDisabled && (
          <div className="text-center mb-4">
            <p className="text-sm text-default-400 flex items-center justify-center gap-2">
              <GripVertical className="w-4 h-4" />
              Drag cards to reorder avatars
            </p>
          </div>
        )}

        {/* Avatar Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAvatars.map((avatar) => (
            <div
              key={avatar.id}
              draggable={!isDragDisabled}
              onDragStart={(e) => handleDragStart(e, avatar)}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, avatar)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, avatar)}
              className={`transition-all duration-200 ${
                dragOverId === avatar.id ? "scale-105" : ""
              } ${draggedAvatar?.id === avatar.id ? "opacity-50" : ""}`}
            >
              <Card
                className={`h-full cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] relative ${
                  dragOverId === avatar.id
                    ? "ring-2 ring-primary ring-offset-2"
                    : ""
                } ${!isDragDisabled ? "cursor-grab active:cursor-grabbing" : ""}`}
                isPressable
                onPress={() => handleAvatarClick(avatar)}
              >
                {/* Drag Handle */}
                {!isDragDisabled && (
                  <div className="absolute top-2 left-2 z-10 text-default-400 hover:text-default-600">
                    <GripVertical className="w-5 h-5" />
                  </div>
                )}
                {/* Edit Button */}
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  color="primary"
                  className="absolute top-2 right-2 z-10"
                  onPress={(e) => handleEditClick(e as unknown as React.MouseEvent, avatar.id)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <CardHeader className={`flex gap-3 pb-0 pr-12 ${!isDragDisabled ? "pl-10" : ""}`}>
                <AvatarImage name={avatar.name} portrait={avatar.portrait} size={48} />
                <div className="flex flex-col flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-md font-semibold">{avatar.name}</p>
                    <Chip
                      size="sm"
                      color={avatar.published ? "success" : "default"}
                      variant={avatar.published ? "solid" : "bordered"}
                      startContent={
                        avatar.published ? (
                          <Globe className="w-3 h-3" />
                        ) : (
                          <FileText className="w-3 h-3" />
                        )
                      }
                    >
                      {avatar.published ? "Published" : "Draft"}
                    </Chip>
                  </div>
                  <p className="text-xs text-default-400">{avatar.title}</p>
                </div>
              </CardHeader>
              <CardBody className="pt-3">
                <div className="space-y-3">
                  {/* First sentence of system prompt */}
                  <p className="text-sm text-default-600">
                    {getFirstSentence(avatar.systemPrompt)}
                  </p>

                  {/* Creator info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-default-500">Created by:</span>
                      <span className="text-xs font-medium">{avatar.createdBy}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-default-500">Last edited by:</span>
                      <span className="text-xs font-medium">{avatar.lastEditedBy}</span>
                    </div>
                  </div>

                  {/* Last edit time */}
                  <div className="pt-2 border-t border-default-200">
                    <p className="text-xs text-default-400">
                      Last edited {getRelativeTime(avatar.lastEditedAt)}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {filteredAvatars.length === 0 && (
          <div className="text-center py-12">
            <p className="text-default-500 text-lg">
              {searchQuery 
                ? `No avatars found matching "${searchQuery}"${filter !== "all" ? ` in ${filter} avatars` : ""}.`
                : "No avatars found with the selected filter."}
            </p>
            {(searchQuery || filter !== "all") && (
              <Button
                variant="light"
                color="primary"
                className="mt-4"
                onPress={() => {
                  setSearchQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
