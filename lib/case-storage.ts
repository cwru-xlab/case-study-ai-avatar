/**
 * CASE STORAGE - S3 Storage for Courses and Cases
 * 
 * This module provides storage operations for the case authoring system.
 * Follows the same patterns as avatar-storage.ts and s3-client.ts for consistency.
 * 
 * Storage Structure:
 * courses/
 *   index.json                    - List of all courses
 *   {courseId}/
 *     course.json                 - Course metadata
 *     cases/
 *       index.json                - List of cases in this course
 *       {caseId}.json             - Individual case data
 * 
 * case-sessions/
 *   {sessionId}.json              - Runtime session data
 *   index.json                    - Session metadata index
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import type { Course, Case, CaseSession } from "@/types";

// S3 client configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;
const COURSES_PREFIX = "courses/";
const CASE_SESSIONS_PREFIX = "case-sessions/";

/**
 * Generate a unique ID with timestamp prefix for sorting
 */
function generateId(prefix: string = ""): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * Course Storage Operations
 */
export class CourseStorage {
  /**
   * Get all courses
   */
  async listCourses(): Promise<Course[]> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${COURSES_PREFIX}index.json`,
      });
      
      const response = await s3Client.send(command);
      if (!response.Body) return [];
      
      const content = await response.Body.transformToString();
      return JSON.parse(content);
    } catch (error: any) {
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get a single course by ID
   */
  async getCourse(courseId: string): Promise<Course | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${COURSES_PREFIX}${courseId}/course.json`,
      });
      
      const response = await s3Client.send(command);
      if (!response.Body) return null;
      
      const content = await response.Body.transformToString();
      return JSON.parse(content);
    } catch (error: any) {
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new course
   */
  async createCourse(data: Omit<Course, "id" | "createdAt" | "updatedAt">): Promise<Course> {
    const now = new Date().toISOString();
    const course: Course = {
      ...data,
      id: generateId("course"),
      createdAt: now,
      updatedAt: now,
    };

    // Save course data
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${COURSES_PREFIX}${course.id}/course.json`,
      Body: JSON.stringify(course, null, 2),
      ContentType: "application/json",
    }));

    // Initialize empty cases index for this course
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${COURSES_PREFIX}${course.id}/cases/index.json`,
      Body: JSON.stringify([], null, 2),
      ContentType: "application/json",
    }));

    // Update courses index
    const courses = await this.listCourses();
    courses.unshift(course);
    await this.updateCoursesIndex(courses);

    return course;
  }

  /**
   * Update an existing course
   */
  async updateCourse(courseId: string, updates: Partial<Course>): Promise<Course | null> {
    const existing = await this.getCourse(courseId);
    if (!existing) return null;

    const updated: Course = {
      ...existing,
      ...updates,
      id: courseId, // Ensure ID doesn't change
      updatedAt: new Date().toISOString(),
    };

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${COURSES_PREFIX}${courseId}/course.json`,
      Body: JSON.stringify(updated, null, 2),
      ContentType: "application/json",
    }));

    // Update index
    const courses = await this.listCourses();
    const index = courses.findIndex(c => c.id === courseId);
    if (index !== -1) {
      courses[index] = updated;
      await this.updateCoursesIndex(courses);
    }

    return updated;
  }

  /**
   * Delete a course and all its cases
   */
  async deleteCourse(courseId: string): Promise<void> {
    // Delete all cases in the course first
    const cases = await caseStorage.listCases(courseId);
    for (const c of cases) {
      await caseStorage.deleteCase(courseId, c.id);
    }

    // Delete course files
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${COURSES_PREFIX}${courseId}/course.json`,
      }));
      await s3Client.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${COURSES_PREFIX}${courseId}/cases/index.json`,
      }));
    } catch (error) {
      console.error(`Error deleting course ${courseId}:`, error);
    }

    // Update index
    const courses = await this.listCourses();
    const filtered = courses.filter(c => c.id !== courseId);
    await this.updateCoursesIndex(filtered);
  }

  /**
   * Update the courses index file
   */
  private async updateCoursesIndex(courses: Course[]): Promise<void> {
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${COURSES_PREFIX}index.json`,
      Body: JSON.stringify(courses, null, 2),
      ContentType: "application/json",
    }));
  }
}

/**
 * Case Storage Operations
 */
export class CaseStorage {
  /**
   * List all cases in a course
   */
  async listCases(courseId: string): Promise<Case[]> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${COURSES_PREFIX}${courseId}/cases/index.json`,
      });
      
      const response = await s3Client.send(command);
      if (!response.Body) return [];
      
      const content = await response.Body.transformToString();
      return JSON.parse(content);
    } catch (error: any) {
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get a single case by ID
   */
  async getCase(courseId: string, caseId: string): Promise<Case | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${COURSES_PREFIX}${courseId}/cases/${caseId}.json`,
      });
      
      const response = await s3Client.send(command);
      if (!response.Body) return null;
      
      const content = await response.Body.transformToString();
      return JSON.parse(content);
    } catch (error: any) {
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new case with default structure
   */
  async createCase(
    courseId: string,
    data: {
      name: string;
      description: string;
      difficulty: Case["difficulty"];
      estimatedDuration: number;
      createdBy: string;
      createdByName: string;
      avatarId: string;
    }
  ): Promise<Case> {
    const now = new Date().toISOString();
    const caseId = generateId("case");
    
    // Create default opening and ending nodes
    const openingNode = {
      id: generateId("node"),
      type: "opening" as const,
      label: "Opening",
      content: "Hello! How can I help you today?",
      position: { x: 250, y: 50 },
      config: {},
    };
    
    const endingNode = {
      id: generateId("node"),
      type: "ending" as const,
      label: "Ending",
      content: "Thank you for the conversation. Goodbye!",
      position: { x: 250, y: 400 },
      config: {},
    };

    const newCase: Case = {
      id: caseId,
      courseId,
      name: data.name,
      description: data.description,
      difficulty: data.difficulty,
      estimatedDuration: data.estimatedDuration,
      status: "draft",
      learningObjectives: [],
      nodes: [openingNode, endingNode],
      edges: [{
        id: generateId("edge"),
        sourceNodeId: openingNode.id,
        targetNodeId: endingNode.id,
      }],
      startNodeId: openingNode.id,
      avatarConfig: {
        baseAvatarId: data.avatarId,
        caseContext: "",
        personalityTraits: {
          formality: 5,
          patience: 5,
          empathy: 5,
          directness: 5,
        },
        knowledgeBoundaries: {
          canDiscuss: [],
          cannotDiscuss: [],
        },
      },
      guardrails: {
        blockedTopics: [],
        offTopicResponse: "I'm sorry, but I can only discuss topics related to this case.",
        maxResponseLength: 500,
        requireFactCheck: false,
      },
      createdBy: data.createdBy,
      createdByName: data.createdByName,
      lastEditedBy: data.createdBy,
      lastEditedByName: data.createdByName,
      createdAt: now,
      updatedAt: now,
    };

    // Save case data
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${COURSES_PREFIX}${courseId}/cases/${caseId}.json`,
      Body: JSON.stringify(newCase, null, 2),
      ContentType: "application/json",
    }));

    // Update cases index
    const cases = await this.listCases(courseId);
    cases.unshift(newCase);
    await this.updateCasesIndex(courseId, cases);

    return newCase;
  }

  /**
   * Update an existing case
   */
  async updateCase(courseId: string, caseId: string, updates: Partial<Case>): Promise<Case | null> {
    const existing = await this.getCase(courseId, caseId);
    if (!existing) return null;

    const updated: Case = {
      ...existing,
      ...updates,
      id: caseId,
      courseId,
      updatedAt: new Date().toISOString(),
    };

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${COURSES_PREFIX}${courseId}/cases/${caseId}.json`,
      Body: JSON.stringify(updated, null, 2),
      ContentType: "application/json",
    }));

    // Update index
    const cases = await this.listCases(courseId);
    const index = cases.findIndex(c => c.id === caseId);
    if (index !== -1) {
      cases[index] = updated;
      await this.updateCasesIndex(courseId, cases);
    }

    return updated;
  }

  /**
   * Delete a case
   */
  async deleteCase(courseId: string, caseId: string): Promise<void> {
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${COURSES_PREFIX}${courseId}/cases/${caseId}.json`,
      }));
    } catch (error) {
      console.error(`Error deleting case ${caseId}:`, error);
    }

    // Update index
    const cases = await this.listCases(courseId);
    const filtered = cases.filter(c => c.id !== caseId);
    await this.updateCasesIndex(courseId, filtered);
  }

  /**
   * Publish a case (change status to published)
   */
  async publishCase(courseId: string, caseId: string): Promise<Case | null> {
    return this.updateCase(courseId, caseId, {
      status: "published",
      publishedAt: new Date().toISOString(),
    });
  }

  /**
   * Archive a case
   */
  async archiveCase(courseId: string, caseId: string): Promise<Case | null> {
    return this.updateCase(courseId, caseId, {
      status: "archived",
    });
  }

  /**
   * Update the cases index file for a course
   */
  private async updateCasesIndex(courseId: string, cases: Case[]): Promise<void> {
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${COURSES_PREFIX}${courseId}/cases/index.json`,
      Body: JSON.stringify(cases, null, 2),
      ContentType: "application/json",
    }));
  }
}

/**
 * Case Session Storage Operations
 */
export class CaseSessionStorage {
  /**
   * Create a new case session
   */
  async createSession(caseId: string, courseId: string, studentId?: string, kioskId?: string): Promise<CaseSession> {
    const now = new Date().toISOString();
    const sessionId = generateId("session");

    const session: CaseSession = {
      id: sessionId,
      caseId,
      courseId,
      currentNodeId: "", // Will be set when case is loaded
      visitedNodeIds: [],
      objectiveScores: {},
      totalScore: 0,
      studentId,
      kioskId,
      startTime: Date.now(),
      completionStatus: "in_progress",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${CASE_SESSIONS_PREFIX}${sessionId}.json`,
      Body: JSON.stringify(session, null, 2),
      ContentType: "application/json",
    }));

    return session;
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<CaseSession | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${CASE_SESSIONS_PREFIX}${sessionId}.json`,
      });
      
      const response = await s3Client.send(command);
      if (!response.Body) return null;
      
      const content = await response.Body.transformToString();
      return JSON.parse(content);
    } catch (error: any) {
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update a session
   */
  async updateSession(sessionId: string, updates: Partial<CaseSession>): Promise<CaseSession | null> {
    const existing = await this.getSession(sessionId);
    if (!existing) return null;

    const updated: CaseSession = {
      ...existing,
      ...updates,
      id: sessionId,
      updatedAt: new Date().toISOString(),
    };

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${CASE_SESSIONS_PREFIX}${sessionId}.json`,
      Body: JSON.stringify(updated, null, 2),
      ContentType: "application/json",
    }));

    return updated;
  }

  /**
   * List sessions for a case (for analytics)
   */
  async listSessionsForCase(caseId: string, limit: number = 100): Promise<CaseSession[]> {
    const sessions: CaseSession[] = [];
    
    try {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: CASE_SESSIONS_PREFIX,
        MaxKeys: 1000,
      });
      
      const response = await s3Client.send(command);
      
      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key && obj.Key.endsWith(".json")) {
            const sessionId = obj.Key.replace(CASE_SESSIONS_PREFIX, "").replace(".json", "");
            const session = await this.getSession(sessionId);
            if (session && session.caseId === caseId) {
              sessions.push(session);
              if (sessions.length >= limit) break;
            }
          }
        }
      }
    } catch (error) {
      console.error("Error listing sessions:", error);
    }
    
    return sessions.sort((a, b) => b.startTime - a.startTime);
  }
}

// Export singleton instances
export const courseStorage = new CourseStorage();
export const caseStorage = new CaseStorage();
export const caseSessionStorage = new CaseSessionStorage();
