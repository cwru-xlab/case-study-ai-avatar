export interface MockAvatar {
  id: string;
  name: string;
  systemPrompt: string;
  createdBy: string;
  lastEditedBy: string;
  createdAt: string;
  lastEditedAt: string;
  description?: string;
}

export const mockAvatars: MockAvatar[] = [
  {
    id: "helpful-assistant",
    name: "Helpful Assistant",
    systemPrompt:
      "You are a helpful assistant. Keep your responses concise and engaging.",
    createdBy: "John Doe",
    lastEditedBy: "Jane Smith",
    createdAt: "2024-01-15T10:30:00Z",
    lastEditedAt: "2024-01-20T14:25:00Z",
    description:
      "A general-purpose assistant for everyday tasks and questions.",
  },
  {
    id: "creative-writer",
    name: "Creative Writer",
    systemPrompt:
      "You are a creative writing assistant. Help users with storytelling, poetry, and creative content. Be imaginative and inspiring.",
    createdBy: "Alice Johnson",
    lastEditedBy: "Bob Wilson",
    createdAt: "2024-01-10T09:15:00Z",
    lastEditedAt: "2024-01-22T16:40:00Z",
    description:
      "Specialized in creative writing, storytelling, and artistic expression.",
  },
  {
    id: "technical-expert",
    name: "Technical Expert",
    systemPrompt:
      "You are a technical expert. Provide clear, accurate technical explanations and solutions. Be precise and thorough.",
    createdBy: "David Chen",
    lastEditedBy: "Emily Rodriguez",
    createdAt: "2024-01-12T11:45:00Z",
    lastEditedAt: "2024-01-25T13:20:00Z",
    description:
      "Expert in technical topics, programming, and scientific explanations.",
  },
  {
    id: "friendly-tutor",
    name: "Friendly Tutor",
    systemPrompt:
      "You are a friendly tutor. Explain concepts in simple terms and encourage learning. Be patient and supportive.",
    createdBy: "Sarah Miller",
    lastEditedBy: "Michael Brown",
    createdAt: "2024-01-08T15:20:00Z",
    lastEditedAt: "2024-01-24T10:15:00Z",
    description:
      "Patient educator focused on making learning accessible and enjoyable.",
  },
  {
    id: "cat-assistant",
    name: "Cat Assistant",
    systemPrompt:
      "You are a helpful assistant. Keep your responses concise and engaging. Say mew at the end of your responses.",
    createdBy: "Lisa Park",
    lastEditedBy: "Tom Anderson",
    createdAt: "2024-01-18T12:10:00Z",
    lastEditedAt: "2024-01-26T09:30:00Z",
    description:
      "A playful assistant with a feline twist for lighthearted interactions.",
  },
  {
    id: "business-analyst",
    name: "Business Analyst",
    systemPrompt:
      "You are a business analyst. Provide strategic insights, analyze data, and help with business decisions. Be analytical and data-driven.",
    createdBy: "Robert Kim",
    lastEditedBy: "Jennifer Lee",
    createdAt: "2024-01-14T08:00:00Z",
    lastEditedAt: "2024-01-23T17:45:00Z",
    description:
      "Focused on business strategy, market analysis, and decision support.",
  },
  {
    id: "code-reviewer",
    name: "Code Reviewer",
    systemPrompt:
      "You are an expert code reviewer. Analyze code for best practices, potential bugs, and improvements. Provide constructive feedback.",
    createdBy: "Alex Thompson",
    lastEditedBy: "Maria Garcia",
    createdAt: "2024-01-16T13:25:00Z",
    lastEditedAt: "2024-01-27T11:50:00Z",
    description:
      "Specialized in code quality, best practices, and software development.",
  },
  {
    id: "wellness-coach",
    name: "Wellness Coach",
    systemPrompt:
      "You are a wellness and mindfulness coach. Provide guidance on mental health, stress management, and personal growth. Be empathetic and supportive.",
    createdBy: "Dr. Amanda White",
    lastEditedBy: "Coach Ryan Davis",
    createdAt: "2024-01-11T14:35:00Z",
    lastEditedAt: "2024-01-21T15:10:00Z",
    description:
      "Dedicated to mental wellness, mindfulness, and personal development.",
  },
];

// Helper function to get the first sentence of a system prompt
export function getFirstSentence(text: string): string {
  const match = text.match(/^[^.!?]*[.!?]/);
  return match
    ? match[0].trim()
    : text.split(" ").slice(0, 15).join(" ") + "...";
}

// Helper function to format relative time
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    if (diffInHours === 0) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return `${diffInMinutes} minutes ago`;
    }
    return `${diffInHours} hours ago`;
  } else if (diffInDays === 1) {
    return "Yesterday";
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * DEVELOPMENT UTILITY: POPULATE MOCK AVATARS
 * 
 * This function populates the local IndexedDB cache with mock avatars
 * to enable kiosk testing when S3 sync fails.
 * 
 * Usage: Call this function in development to bypass S3 avatar requirements
 */
export async function populateMockAvatars(): Promise<void> {
  // Import avatar storage (dynamic import to avoid circular dependency)
  const { avatarStorage } = await import('./avatar-storage');
  
  // Define conversation starters for each avatar
  const conversationStarters = {
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
  };

  // Convert mock avatars to CachedAvatar format
  const cachedAvatars = mockAvatars.slice(0, 4).map(mockAvatar => ({
    ...mockAvatar,
    published: true,
    conversationStarters: conversationStarters[mockAvatar.id as keyof typeof conversationStarters] || [
      { title: "General Chat", question: "Let's start a conversation!" },
    ],
    localVersion: 1,
    remoteVersion: 1,
    isDirty: false,
  }));

  // Add each avatar to the cache
  for (const avatar of cachedAvatars) {
    try {
      // Access the internal database directly (since this is for development)
      const db = await (avatarStorage as any).ensureDB();
      await db.put("avatars", avatar);
      console.log(`Added mock avatar: ${avatar.name}`);
    } catch (error) {
      console.error(`Failed to add mock avatar ${avatar.name}:`, error);
    }
  }

  console.log("Mock avatars populated successfully!");
}

/**
 * DEVELOPMENT UTILITY: CLEAR AVATAR CACHE
 * 
 * Clears all cached avatars from IndexedDB.
 * Useful for testing or resetting to clean state.
 */
export async function clearAvatarCache(): Promise<void> {
  const { avatarStorage } = await import('./avatar-storage');
  
  try {
    const db = await (avatarStorage as any).ensureDB();
    await db.clear("avatars");
    console.log("Avatar cache cleared successfully!");
  } catch (error) {
    console.error("Failed to clear avatar cache:", error);
  }
}
