import { PrismaClient, Role, AuthProvider, CohortMemberStatus } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

/**
 * Hash a password using SHA-512
 */
function hashPassword(password: string): string {
  return crypto.createHash("sha512").update(password).digest("hex");
}

async function main() {
  console.log("🌱 Starting database seed...");

  // ============================================================================
  // CREATE USERS
  // ============================================================================

  // Admin user (for development)
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      passwordHash: hashPassword("admin123"),
      name: "Admin User",
      role: Role.ADMIN,
      authProvider: AuthProvider.EMAIL,
      emailVerified: true,
    },
  });

  // Professors
  const professor1 = await prisma.user.upsert({
    where: { email: "professor.smith@case.edu" },
    update: {},
    create: {
      email: "professor.smith@case.edu",
      passwordHash: hashPassword("prof123"),
      name: "Dr. John Smith",
      role: Role.PROFESSOR,
      authProvider: AuthProvider.EMAIL,
      emailVerified: true,
    },
  });

  const professor2 = await prisma.user.upsert({
    where: { email: "professor.chen@case.edu" },
    update: {},
    create: {
      email: "professor.chen@case.edu",
      passwordHash: hashPassword("prof123"),
      name: "Dr. Wei Chen",
      role: Role.PROFESSOR,
      authProvider: AuthProvider.EMAIL,
      emailVerified: true,
    },
  });

  // Students
  const student1 = await prisma.user.upsert({
    where: { email: "alice.johnson@case.edu" },
    update: {},
    create: {
      email: "alice.johnson@case.edu",
      passwordHash: hashPassword("student123"),
      name: "Alice Johnson",
      role: Role.STUDENT,
      studentNumber: "STU001",
      authProvider: AuthProvider.EMAIL,
      emailVerified: true,
    },
  });

  const student2 = await prisma.user.upsert({
    where: { email: "bob.williams@case.edu" },
    update: {},
    create: {
      email: "bob.williams@case.edu",
      passwordHash: hashPassword("student123"),
      name: "Bob Williams",
      role: Role.STUDENT,
      studentNumber: "STU002",
      authProvider: AuthProvider.EMAIL,
      emailVerified: true,
    },
  });

  const student3 = await prisma.user.upsert({
    where: { email: "carol.davis@case.edu" },
    update: {},
    create: {
      email: "carol.davis@case.edu",
      passwordHash: hashPassword("student123"),
      name: "Carol Davis",
      role: Role.STUDENT,
      studentNumber: "STU003",
      authProvider: AuthProvider.EMAIL,
      emailVerified: true,
    },
  });

  const student4 = await prisma.user.upsert({
    where: { email: "david.lee@case.edu" },
    update: {},
    create: {
      email: "david.lee@case.edu",
      passwordHash: hashPassword("student123"),
      name: "David Lee",
      role: Role.STUDENT,
      studentNumber: "STU004",
      authProvider: AuthProvider.EMAIL,
      emailVerified: true,
    },
  });

  const student5 = await prisma.user.upsert({
    where: { email: "emma.wilson@case.edu" },
    update: {},
    create: {
      email: "emma.wilson@case.edu",
      passwordHash: hashPassword("student123"),
      name: "Emma Wilson",
      role: Role.STUDENT,
      studentNumber: "STU005",
      authProvider: AuthProvider.EMAIL,
      emailVerified: true,
    },
  });

  // Test student (for development)
  const testStudent = await prisma.user.upsert({
    where: { email: "student@case.edu" },
    update: {},
    create: {
      email: "student@case.edu",
      passwordHash: hashPassword("student123"),
      name: "Jane Smith",
      role: Role.STUDENT,
      studentNumber: "jxs456",
      authProvider: AuthProvider.EMAIL,
      emailVerified: true,
    },
  });

  console.log("✅ Created users");

  // ============================================================================
  // CREATE COHORTS
  // ============================================================================

  const cohort1 = await prisma.cohort.upsert({
    where: { code: "MGMT301-F26" },
    update: {},
    create: {
      name: "MGMT 301 - Business Strategy",
      code: "MGMT301-F26",
      description: "Fall 2026 Business Strategy course",
      semester: "Fall",
      year: 2026,
      term: "Full Semester",
      isActive: true,
      creatorId: professor1.id,
    },
  });

  const cohort2 = await prisma.cohort.upsert({
    where: { code: "NEGO201-F26" },
    update: {},
    create: {
      name: "NEGO 201 - Negotiation Skills",
      code: "NEGO201-F26",
      description: "Fall 2026 Negotiation course",
      semester: "Fall",
      year: 2026,
      term: "Full Semester",
      isActive: true,
      creatorId: professor2.id,
    },
  });

  console.log("✅ Created cohorts");

  // ============================================================================
  // ADD STUDENTS TO COHORTS
  // ============================================================================

  await prisma.cohortMember.upsert({
    where: { userId_cohortId: { userId: student1.id, cohortId: cohort1.id } },
    update: {},
    create: { userId: student1.id, cohortId: cohort1.id, status: CohortMemberStatus.JOINED },
  });

  await prisma.cohortMember.upsert({
    where: { userId_cohortId: { userId: student2.id, cohortId: cohort1.id } },
    update: {},
    create: { userId: student2.id, cohortId: cohort1.id, status: CohortMemberStatus.JOINED },
  });

  await prisma.cohortMember.upsert({
    where: { userId_cohortId: { userId: student3.id, cohortId: cohort1.id } },
    update: {},
    create: { userId: student3.id, cohortId: cohort1.id, status: CohortMemberStatus.JOINED },
  });

  await prisma.cohortMember.upsert({
    where: { userId_cohortId: { userId: student1.id, cohortId: cohort2.id } },
    update: {},
    create: { userId: student1.id, cohortId: cohort2.id, status: CohortMemberStatus.JOINED },
  });

  await prisma.cohortMember.upsert({
    where: { userId_cohortId: { userId: student4.id, cohortId: cohort2.id } },
    update: {},
    create: { userId: student4.id, cohortId: cohort2.id, status: CohortMemberStatus.JOINED },
  });

  await prisma.cohortMember.upsert({
    where: { userId_cohortId: { userId: student5.id, cohortId: cohort2.id } },
    update: {},
    create: { userId: student5.id, cohortId: cohort2.id, status: CohortMemberStatus.JOINED },
  });

  console.log("✅ Added students to cohorts");

  // ============================================================================
  // CREATE CASES
  // ============================================================================

  const case1 = await prisma.case.upsert({
    where: { slug: "salary-negotiation" },
    update: {},
    create: {
      slug: "salary-negotiation",
      title: "Salary Negotiation Scenario",
      description: "Practice negotiating a salary increase with your manager",
      isPublished: true,
      difficulty: "intermediate",
      estimatedMins: 20,
      category: "negotiation",
      createdById: professor1.id,
    },
  });

  const case2 = await prisma.case.upsert({
    where: { slug: "customer-complaint" },
    update: {},
    create: {
      slug: "customer-complaint",
      title: "Customer Complaint Resolution",
      description: "Handle a difficult customer complaint professionally",
      isPublished: true,
      difficulty: "beginner",
      estimatedMins: 15,
      category: "conflict",
      createdById: professor1.id,
    },
  });

  const case3 = await prisma.case.upsert({
    where: { slug: "team-conflict" },
    update: {},
    create: {
      slug: "team-conflict",
      title: "Team Conflict Management",
      description: "Resolve a conflict between two team members",
      isPublished: true,
      difficulty: "advanced",
      estimatedMins: 30,
      category: "leadership",
      createdById: professor2.id,
    },
  });

  console.log("✅ Created cases");

  // ============================================================================
  // ASSIGN CASES TO STUDENTS
  // ============================================================================

  // Cohort 1 students get case1 and case2
  for (const student of [student1, student2, student3]) {
    await prisma.caseAssignment.upsert({
      where: { userId_caseId: { userId: student.id, caseId: case1.id } },
      update: {},
      create: { userId: student.id, caseId: case1.id, cohortId: cohort1.id },
    });
    await prisma.caseAssignment.upsert({
      where: { userId_caseId: { userId: student.id, caseId: case2.id } },
      update: {},
      create: { userId: student.id, caseId: case2.id, cohortId: cohort1.id },
    });
  }

  // Cohort 2 students get case1 and case3
  for (const student of [student1, student4, student5]) {
    await prisma.caseAssignment.upsert({
      where: { userId_caseId: { userId: student.id, caseId: case1.id } },
      update: {},
      create: { userId: student.id, caseId: case1.id, cohortId: cohort2.id },
    });
    await prisma.caseAssignment.upsert({
      where: { userId_caseId: { userId: student.id, caseId: case3.id } },
      update: {},
      create: { userId: student.id, caseId: case3.id, cohortId: cohort2.id },
    });
  }

  console.log("✅ Assigned cases to students");

  // ============================================================================
  // CREATE ATTEMPTS (LEARNING RECORDS)
  // ============================================================================

  // Alice's attempts on Salary Negotiation
  await prisma.attempt.upsert({
    where: { userId_caseId_attemptNumber: { userId: student1.id, caseId: case1.id, attemptNumber: 1 } },
    update: {},
    create: {
      userId: student1.id,
      caseId: case1.id,
      attemptNumber: 1,
      score: 72,
      totalMessages: 15,
      totalTimeSeconds: 1200,
      startedAt: new Date("2026-03-15T10:00:00Z"),
      submittedAt: new Date("2026-03-15T10:30:00Z"),
      evalResult: "Good attempt. Student showed understanding of basic negotiation principles but could improve on assertiveness.",
    },
  });

  await prisma.attempt.upsert({
    where: { userId_caseId_attemptNumber: { userId: student1.id, caseId: case1.id, attemptNumber: 2 } },
    update: {},
    create: {
      userId: student1.id,
      caseId: case1.id,
      attemptNumber: 2,
      score: 85,
      totalMessages: 18,
      totalTimeSeconds: 1500,
      startedAt: new Date("2026-03-18T14:00:00Z"),
      submittedAt: new Date("2026-03-18T14:20:00Z"),
      evalResult: "Excellent improvement! Student demonstrated strong negotiation skills and maintained professional composure.",
    },
  });

  // Bob's attempts
  await prisma.attempt.upsert({
    where: { userId_caseId_attemptNumber: { userId: student2.id, caseId: case1.id, attemptNumber: 1 } },
    update: {},
    create: {
      userId: student2.id,
      caseId: case1.id,
      attemptNumber: 1,
      score: 68,
      totalMessages: 12,
      totalTimeSeconds: 900,
      startedAt: new Date("2026-03-16T09:00:00Z"),
      submittedAt: new Date("2026-03-16T09:15:00Z"),
      evalResult: "Needs improvement. Student was too passive during the negotiation.",
    },
  });

  // Carol's attempts
  await prisma.attempt.upsert({
    where: { userId_caseId_attemptNumber: { userId: student3.id, caseId: case2.id, attemptNumber: 1 } },
    update: {},
    create: {
      userId: student3.id,
      caseId: case2.id,
      attemptNumber: 1,
      score: 90,
      totalMessages: 20,
      totalTimeSeconds: 1800,
      startedAt: new Date("2026-03-17T11:15:00Z"),
      submittedAt: new Date("2026-03-17T11:45:00Z"),
      evalResult: "Outstanding performance! Student handled the difficult customer with empathy and professionalism.",
    },
  });

  // David's attempts
  await prisma.attempt.upsert({
    where: { userId_caseId_attemptNumber: { userId: student4.id, caseId: case3.id, attemptNumber: 1 } },
    update: {},
    create: {
      userId: student4.id,
      caseId: case3.id,
      attemptNumber: 1,
      score: 78,
      totalMessages: 16,
      totalTimeSeconds: 1350,
      startedAt: new Date("2026-03-19T14:30:00Z"),
      submittedAt: new Date("2026-03-19T15:00:00Z"),
      evalResult: "Good mediation skills. Could improve on finding win-win solutions.",
    },
  });

  // Emma's attempts
  await prisma.attempt.upsert({
    where: { userId_caseId_attemptNumber: { userId: student5.id, caseId: case1.id, attemptNumber: 1 } },
    update: {},
    create: {
      userId: student5.id,
      caseId: case1.id,
      attemptNumber: 1,
      score: 82,
      totalMessages: 14,
      totalTimeSeconds: 1100,
      startedAt: new Date("2026-03-20T09:40:00Z"),
      submittedAt: new Date("2026-03-20T10:00:00Z"),
      evalResult: "Very good negotiation approach. Student was well-prepared and articulate.",
    },
  });

  await prisma.attempt.upsert({
    where: { userId_caseId_attemptNumber: { userId: student5.id, caseId: case3.id, attemptNumber: 1 } },
    update: {},
    create: {
      userId: student5.id,
      caseId: case3.id,
      attemptNumber: 1,
      score: 88,
      totalMessages: 22,
      totalTimeSeconds: 1650,
      startedAt: new Date("2026-03-21T13:00:00Z"),
      submittedAt: new Date("2026-03-21T13:30:00Z"),
      evalResult: "Excellent conflict resolution skills. Student facilitated a productive discussion between parties.",
    },
  });

  console.log("✅ Created learning attempts");

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log("\n🎉 Database seeded successfully!");
  console.log("\n📊 Summary:");
  console.log("   - 1 Admin (admin@example.com / admin123)");
  console.log("   - 2 Professors (professor.smith@case.edu, professor.chen@case.edu / prof123)");
  console.log("   - 6 Students (alice.johnson@case.edu, etc. / student123)");
  console.log("   - 2 Cohorts");
  console.log("   - 3 Cases");
  console.log("   - 7 Attempts (learning records)");
  console.log("\n🔐 Test Credentials:");
  console.log("   Admin:     admin@example.com / admin123");
  console.log("   Professor: professor.smith@case.edu / prof123");
  console.log("   Student:   student@case.edu / student123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
