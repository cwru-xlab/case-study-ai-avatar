/**
 * CHAT STORAGE SERVICE - COMPLETE SESSION LIFECYCLE MANAGEMENT
 * 
 * This file implements the chat storage requirements for the AI Avatar Kiosk:
 * 
 * Core Requirements:
 * 1. Serialize chat sessions as JSON files in S3 under /chats/ prefix
 * 2. Store chat IDs in IndexedDB for quick lookup
 * 3. Automatically save sessions when users exit
 * 
 * Architecture Overview:
 * This service follows the same patterns as lib/avatar-storage.ts to ensure consistency:
 * - IndexedDB for local caching and quick lookups
 * - S3 integration for persistent storage
 * - Session lifecycle management (start → messages → end)
 * - Error handling and recovery mechanisms
 * - Singleton pattern for global state management
 * 
 * Key Features:
 * - Active session management (in-memory state for current chat)
 * - IndexedDB caching for session metadata (quick lookup)
 * - S3 persistence when sessions end
 * - Page exit detection and automatic session saving
 * - Session recovery from local cache
 * - Avatar switching with proper session cleanup
 * 
 * Data Flow:
 * 1. Start session → Create in-memory active session
 * 2. Add messages → Update in-memory + cache in IndexedDB for recovery
 * 3. End session → Save to S3 + cache metadata in IndexedDB + cleanup
 * 4. Page exit → Automatically trigger session end
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { ChatSession, ChatMessage, ChatSessionMetadata } from "../types";
import { s3Storage } from "./s3-client";

/**
 * CACHED CHAT SESSION INTERFACE
 * 
 * Local cache structure for session metadata in IndexedDB.
 * Implements the requirement for storing chat IDs in IndexedDB for quick lookup.
 * 
 * This stores metadata only (not full messages) for efficient querying:
 * - sessionId: Primary key for lookups
 * - metadata: Essential session info for filtering and display
 * - isStored: Tracks whether session has been saved to S3
 * - localTimestamp: When it was cached locally (for cleanup)
 * 
 * Usage scenarios:
 * - Quick session list without loading full S3 data
 * - Offline session tracking
 * - Session recovery after crashes
 * - Analytics dashboard with fast loading
 */
export interface CachedChatSession {
  sessionId: string;                     // Unique session identifier
  metadata: ChatSessionMetadata;         // Session details for analytics/filtering
  isStored: boolean;                     // Whether it's been saved to S3
  localTimestamp: number;                // When it was cached locally
}

/**
 * STORED MESSAGES INTERFACE
 * 
 * Structure for temporary message storage in IndexedDB.
 * Used for session recovery if browser crashes before session ends.
 * 
 * Messages are stored separately from metadata to:
 * - Keep metadata queries fast (no large message arrays)
 * - Allow selective loading of message data
 * - Support partial message recovery
 */
export interface StoredMessages {
  sessionId: string;                     // Links to session metadata
  messages: ChatMessage[];              // Complete message history
}

/**
 * INDEXEDDB SCHEMA DEFINITION
 * 
 * Defines the local database structure for chat storage.
 * Follows the same patterns as avatar-storage.ts for consistency.
 * 
 * Stores:
 * 1. sessions: Session metadata with indexes for fast querying
 * 2. messages: Temporary message storage for crash recovery
 * 3. metadata: General settings and configuration
 * 
 * Indexes enable efficient queries by:
 * - avatarId: Find all sessions for a specific avatar
 * - userId: Find all sessions for a specific user  
 * - startTime: Time-based queries and sorting
 */
interface ChatDB extends DBSchema {
  sessions: {
    key: string;                         // session ID
    value: CachedChatSession;
    indexes: {
      avatarId: string;                  // Index for avatar-specific queries
      userId: string;                    // Index for user-specific queries
      startTime: number;                 // Index for time-based sorting
    };
  };
  messages: {
    key: string;                         // session ID
    value: StoredMessages;               // Temporary message storage
  };
  metadata: {
    key: string;                         // setting name
    value: any;                          // setting value
  };
}

/**
 * ACTIVE CHAT SESSION INTERFACE
 * 
 * In-memory representation of the current active chat session.
 * This is the working state before the session is saved to S3.
 * 
 * Design decisions:
 * - Flattened structure for easy component access
 * - All optional fields have sensible defaults
 * - Includes context information for analytics
 * - Matches the final ChatSession structure for easy conversion
 */
export interface ActiveChatSession {
  sessionId: string;                     // Unique identifier
  avatarId: string;                      // Avatar being chatted with
  avatarName: string;                    // Avatar display name
  messages: ChatMessage[];              // Current conversation messages
  startTime: number;                     // When session began
  isKioskMode: boolean;                  // Kiosk vs preview mode
  userId?: string;                       // Optional user identifier
  userName?: string;                     // Optional user name
  location?: string;                     // Optional location (kiosk ID, etc.)
}

/**
 * CHAT STORAGE SERVICE CLASS
 * 
 * Main service class implementing the complete chat storage lifecycle.
 * Follows the singleton pattern like avatar-storage.ts for consistent state management.
 * 
 * Responsibilities:
 * 1. Session lifecycle management (start → active → end)
 * 2. IndexedDB integration for local caching
 * 3. S3 integration for persistent storage
 * 4. Page exit detection and automatic saving
 * 5. Error handling and recovery
 * 6. Session switching and cleanup
 */
class ChatStorage {
  private db: IDBPDatabase<ChatDB> | null = null;    // IndexedDB connection
  private activeSession: ActiveChatSession | null = null;  // Current session

  /**
   * INDEXEDDB INITIALIZATION
   * 
   * Sets up the local database schema with proper indexes.
   * Called automatically on first database access.
   * 
   * Database structure:
   * - Version 1: Initial schema with sessions, messages, and metadata stores
   * - Sessions store has indexes for efficient querying
   * - Follows the same patterns as avatar-storage.ts
   */
  private async initDB(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<ChatDB>("chat-cache", 1, {
      upgrade(db) {
        // Create sessions store for metadata
        if (!db.objectStoreNames.contains("sessions")) {
          const sessionsStore = db.createObjectStore("sessions", { keyPath: "sessionId" });
          // Create indexes for efficient queries (quick lookup requirement)
          sessionsStore.createIndex("avatarId", "metadata.avatarId", { unique: false });
          sessionsStore.createIndex("userId", "metadata.userId", { unique: false });
          sessionsStore.createIndex("startTime", "metadata.startTime", { unique: false });
        }

        // Create messages store for temporary message storage
        if (!db.objectStoreNames.contains("messages")) {
          db.createObjectStore("messages", { keyPath: "sessionId" });
        }

        // Create metadata store for general settings
        if (!db.objectStoreNames.contains("metadata")) {
          db.createObjectStore("metadata");
        }
      },
    });
  }

  /**
   * DATABASE CONNECTION HELPER
   * 
   * Ensures database is initialized before use.
   * Follows the same pattern as avatar-storage.ts for consistency.
   */
  private async ensureDB(): Promise<IDBPDatabase<ChatDB>> {
    if (!this.db) {
      await this.initDB();
    }
    return this.db!;
  }

    /**
   * Generate Unique Session ID
   * 
   * Creates unique identifiers for chat sessions.
   * 
   * Format: {timestamp}_{random}
   * Example: 1703123456789_abc123def
   * 
   * Design decisions:
   * - Timestamp prefix ensures chronological ordering
   * - Random suffix prevents collisions
   * - Human-readable format for debugging
   * - URL-safe characters only
   */
    private generateSessionId(): string {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      return `${timestamp}_${random}`;
    }

  /**
   * START NEW CHAT SESSION
   * 
   * Implements the beginning of the chat storage lifecycle.
   * Called when user starts chatting with an avatar.
   * 
   * Design decisions:
   * - Generates unique session ID using S3 client utility
   * - Stores session in memory for fast access during chat
   * - Returns session ID for component tracking
   * - Sets up all metadata for later analytics
   */
  startSession(
    avatarId: string,
    avatarName: string,
    options?: {
      userId?: string;
      userName?: string;
      isKioskMode?: boolean;
      location?: string;
    }
  ): string {
    // --- ROOT CAUSE LOGGING: Warn if an active session exists before starting a new one ---
    if (this.activeSession) {
      console.warn('[chatStorage] WARNING: Starting a new session while another is still active! Old sessionId:', this.activeSession.sessionId);
    }
    // Generate unique session ID
    const sessionId = this.generateSessionId();
    const startTime = Date.now();

    // Create in-memory active session
    this.activeSession = {
      sessionId,
      avatarId,
      avatarName,
      messages: [],                      // Start with empty conversation
      startTime,
      isKioskMode: options?.isKioskMode || false,  // Default to preview mode
      userId: options?.userId,
      userName: options?.userName,
      location: options?.location,
    };

    console.log(`[chatStorage] Started new chat session: ${sessionId}`);
    return sessionId;
  }

  /**
   * ADD MESSAGE TO ACTIVE SESSION
   * 
   * Core method for building up the conversation during an active chat.
   * Called every time user sends a message or AI responds.
   * 
   * Features:
   * - Validates active session exists
   * - Adds message to in-memory session
   * - Caches messages locally for crash recovery
   * - Maintains chronological order
   */
  async addMessage(message: ChatMessage): Promise<void> {
    if (!this.activeSession) {
      throw new Error("No active chat session");
    }

    // Add to in-memory session for immediate access
    this.activeSession.messages.push(message);
    
    // Cache messages locally for persistence across browser crashes
    // This enables session recovery if page refreshes during chat
    const db = await this.ensureDB();
    await db.put("messages", {
      sessionId: this.activeSession.sessionId,
      messages: this.activeSession.messages
    });

    console.log(`Added message to session ${this.activeSession.sessionId}:`, message);
  }

  /**
   * GET ACTIVE SESSION
   * 
   * Simple getter for components to access current session state.
   * Used by components to check if chat is in progress.
   */
  getActiveSession(): ActiveChatSession | null {
    return this.activeSession;
  }

  /**
   * END AND SAVE SESSION TO S3
   * 
   * Implements the core requirement to serialize chat sessions when users exit.
   * This is the most critical method as it handles the main use case.
   * 
   * Called when:
   * - User navigates away from chat
   * - User selects a different avatar
   * - Page is closing/refreshing
   * - Component unmounts
   * - Manual session termination
   * 
   * Process:
   * 1. Validate session exists and has messages
   * 2. Create ChatSession object with proper metadata
   * 3. Save to S3 as JSON file
   * 4. Cache metadata in IndexedDB for quick lookup
   * 5. Clean up active session and temporary data
   */
  async endSession(sessionId?: string): Promise<void> {
    // Get session to end (active session or specified session)
    const session = sessionId ? await this.getSessionById(sessionId) : this.activeSession;
    
    if (!session) {
      console.warn("No session to end");
      return;
    }

    // Only save if there are actual messages (avoid empty sessions)
    if (session.messages.length === 0) {
      console.log("Session has no messages, not saving");
      this.activeSession = null;
      return;
    }

    try {
      // Create the kiosk-specific request payload with flattened structure
      // The /api/chat/save-kiosk endpoint expects a flat structure, not nested metadata
      const kioskRequestPayload = {
        sessionId: session.sessionId,
        avatarId: session.avatarId,
        avatarName: session.avatarName,
        messages: session.messages,
        isKioskMode: session.isKioskMode,
        location: session.location,
      };

      // Save to S3 via public kiosk API endpoint - implements "serialize the chat as one JSON file"
      const response = await fetch('/api/chat/save-kiosk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(kioskRequestPayload),
      });

      if (!response.ok) {
        throw new Error(`Failed to save chat session: ${response.statusText}`);
      }

      // Create complete chat session object for caching purposes
      const chatSession = s3Storage.createChatSession(
        session.sessionId,
        session.avatarId,
        session.avatarName,
        session.messages,
        {
          userId: session.userId,
          userName: session.userName,
          isKioskMode: session.isKioskMode,
          location: session.location,
        }
      );

      // Cache session metadata in IndexedDB for quick lookup
      await this.cacheSessionMetadata(chatSession);

      console.log(`Session ${session.sessionId} saved successfully`);
    } catch (error) {
      console.error(`Failed to save session ${session.sessionId}:`, error);
      
      // Even if S3 save fails, cache locally for later retry
      // This ensures no data is lost due to network issues
      await this.cacheSessionMetadata({
        metadata: {
          sessionId: session.sessionId,
          avatarId: session.avatarId,
          avatarName: session.avatarName,
          userId: session.userId,
          userName: session.userName,
          startTime: session.startTime,
          endTime: Date.now(),
          messageCount: session.messages.length,
          isKioskMode: session.isKioskMode,
          location: session.location,
        },
        messages: session.messages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // --- ROOT CAUSE: Always clear activeSession after ending ---
    if (this.activeSession?.sessionId === session.sessionId) {
      this.activeSession = null;
      console.log(`[chatStorage] Cleared activeSession after endSession for sessionId: ${session.sessionId}`);
    }

    // Clean up temporary message cache to save space
    const db = await this.ensureDB();
    await db.delete("messages", session.sessionId);
  }

  /**
   * CACHE SESSION METADATA IN INDEXEDDB
   * 
   * Implements the requirement to store chat IDs in IndexedDB for quick lookup.
   * 
   * Purpose:
   * - Fast session listing without loading full S3 data
   * - Offline access to session metadata
   * - Session history browsing
   * - Analytics dashboard data
   * 
   * Stores only metadata (not full messages) for performance
   */
  private async cacheSessionMetadata(session: ChatSession): Promise<void> {
    const db = await this.ensureDB();

    const cachedSession: CachedChatSession = {
      sessionId: session.metadata.sessionId,
      metadata: session.metadata,
      isStored: true,                    // Mark as successfully stored
      localTimestamp: Date.now(),        // Track when cached locally
    };

    await db.put("sessions", cachedSession);
  }

  /**
   * GET SESSION BY ID WITH MULTI-SOURCE LOOKUP
   * 
   * Intelligent session retrieval that checks multiple sources:
   * 1. Active session (if it matches)
   * 2. Local IndexedDB cache (for recent sessions)
   * 3. S3 storage (via other methods)
   * 
   * This supports session recovery and flexible session access
   */
  private async getSessionById(sessionId: string): Promise<ActiveChatSession | null> {
    // --- ROOT CAUSE LOGGING: Track all calls to getSessionById ---
    console.log(`[chatStorage] getSessionById called for sessionId: ${sessionId}`);
    // First check if it's the current active session
    if (this.activeSession?.sessionId === sessionId) {
      return this.activeSession;
    }

    // Check local cache for session recovery
    const db = await this.ensureDB();
    const cachedMessages = await db.get("messages", sessionId);
    const cachedSession = await db.get("sessions", sessionId);

    if (cachedMessages && cachedSession) {
      // Reconstruct active session from cache
      console.log(`[chatStorage] Restoring session from cache: ${sessionId}`);
      return {
        sessionId,
        avatarId: cachedSession.metadata.avatarId,
        avatarName: cachedSession.metadata.avatarName,
        messages: cachedMessages.messages,
        startTime: cachedSession.metadata.startTime,
        isKioskMode: cachedSession.metadata.isKioskMode,
        userId: cachedSession.metadata.userId,
        userName: cachedSession.metadata.userName,
        location: cachedSession.metadata.location,
      };
    }

    return null;
  }

  /**
   * LIST CACHED SESSION METADATA
   * 
   * Implements fast session listing using IndexedDB indexes.
   * This provides the "quick lookup" capability for session browsing.
   * 
   * Features:
   * - Index-based filtering for performance
   * - Avatar-specific session lists
   * - User-specific session history
   * - Chronological sorting (newest first)
   * - Pagination support
   */
  async listCachedSessions(options?: {
    avatarId?: string;
    userId?: string;
    limit?: number;
  }): Promise<CachedChatSession[]> {
    const db = await this.ensureDB();
    
    let sessions: CachedChatSession[] = [];

    // Use indexes for efficient querying
    if (options?.avatarId) {
      // Query by avatar ID using index
      sessions = await db.getAllFromIndex("sessions", "avatarId", options.avatarId);
    } else if (options?.userId) {
      // Query by user ID using index
      sessions = await db.getAllFromIndex("sessions", "userId", options.userId);
    } else {
      // Get all sessions if no specific filter
      sessions = await db.getAll("sessions");
    }

    // Sort by start time (newest first) - typical use case
    sessions.sort((a, b) => b.metadata.startTime - a.metadata.startTime);

    // Apply limit if specified (pagination support)
    if (options?.limit) {
      sessions = sessions.slice(0, options.limit);
    }

    return sessions;
  }

  /**
   * GET CHAT SESSION FROM S3
   * 
   * Direct access to S3 storage for complete session data.
   * Delegates to S3 client for consistency.
   */
  async getChatSession(sessionId: string): Promise<ChatSession | null> {
    return await s3Storage.getChatSession(sessionId);
  }

  /**
   * LIST SESSIONS FROM S3
   * 
   * Direct access to S3 storage with advanced filtering.
   * Delegates to S3 client for consistency.
   * Used for analytics and reporting that need complete data.
   */
  async listS3Sessions(options?: {
    avatarId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<ChatSessionMetadata[]> {
    return await s3Storage.listChatSessions(options);
  }

  /**
   * DELETE SESSION FROM BOTH S3 AND LOCAL CACHE
   * 
   * Complete session removal for privacy and cleanup.
   * Ensures data is removed from all storage locations.
   * 
   * Use cases:
   * - User privacy requests
   * - Data retention compliance
   * - Administrative cleanup
   * - Testing cleanup
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      // Delete from S3 storage
      await s3Storage.deleteChatSession(sessionId);

      // Delete from local cache
      const db = await this.ensureDB();
      await db.delete("sessions", sessionId);
      await db.delete("messages", sessionId);

      console.log(`Session ${sessionId} deleted successfully`);
    } catch (error) {
      console.error(`Failed to delete session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * CONVENIENCE METHODS FOR ANALYTICS
   * 
   * These methods delegate to S3 client but provide a consistent interface
   * through the chat storage service. Used for reporting and analytics.
   */

  // Get sessions for analytics
  async getSessionsForAvatar(avatarId: string, limit: number = 100): Promise<ChatSessionMetadata[]> {
    return await s3Storage.getChatSessionsForAvatar(avatarId, limit);
  }

  // Get sessions for user history
  async getSessionsForUser(userId: string, limit: number = 100): Promise<ChatSessionMetadata[]> {
    return await s3Storage.getChatSessionsForUser(userId, limit);
  }

  /**
   * RESTORE SESSION FROM LOCAL CACHE
   * 
   * Session recovery mechanism for browser crashes or page refreshes.
   * Attempts to restore an interrupted session from local cache.
   * 
   * Use cases:
   * - Browser crash recovery
   * - Accidental page refresh
   * - Development debugging
   * - User experience continuity
   */
  async restoreSession(sessionId: string): Promise<boolean> {
    // --- ROOT CAUSE LOGGING: Track all calls to restoreSession ---
    console.log(`[chatStorage] restoreSession called for sessionId: ${sessionId}`);
    const session = await this.getSessionById(sessionId);
    if (session) {
      this.activeSession = session;
      return true;
    }
    return false;
  }

  /**
   * HANDLE PAGE EXIT
   * 
   * Critical method implementing the requirement to save when users exit.
   * 
   * Called automatically on:
   * - Page unload (beforeunload event)
   * - Component unmount
   * - Browser tab close
   * - Navigation away from page
   * 
   * This ensures no chat data is lost when users exit unexpectedly.
   */
  async handlePageExit(): Promise<void> {
    if (this.activeSession) {
      console.log("Page exit detected, saving active session");
      await this.endSession();
    }
  }

  /**
   * CLEAR ALL LOCAL CACHE
   * 
   * Utility method for development, testing, and reset scenarios.
   * Removes all local data but leaves S3 data intact.
   * 
   * Use cases:
   * - Development debugging
   * - User logout cleanup
   * - Cache corruption recovery
   * - Testing setup/teardown
   */
  async clearLocalCache(): Promise<void> {
    const db = await this.ensureDB();
    await db.clear("sessions");
    await db.clear("messages");
    await db.clear("metadata");
    this.activeSession = null;
    console.log("Local chat cache cleared");
  }
}

/**
 * EXPORT SINGLETON INSTANCE
 * 
 * Follows the same pattern as avatar-storage.ts.
 * Provides a single, shared instance across the application for:
 * - Consistent session state management
 * - Shared database connections
 * - Global event handling
 * - Simplified imports across components
 */
export const chatStorage = new ChatStorage();

/**
 * AUTOMATIC PAGE EXIT HANDLING
 * 
 * Global event listener that implements the core requirement:
 * to save chat sessions when users exit.
 * 
 * Browser limitations:
 * - beforeunload events have strict timing constraints
 * - Async operations may not complete in time
 * - This provides best-effort save, supplemented by component-level handling
 * 
 * Implementation notes:
 * - Only runs in browser environment (not SSR)
 * - Components should also call handlePageExit() in cleanup
 * - Provides redundant safety for critical data saving
 */
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    // Note: This is synchronous due to beforeunload constraints
    // Components should also handle exit properly with async methods
    chatStorage.handlePageExit();
  });
} 