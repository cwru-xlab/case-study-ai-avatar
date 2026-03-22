import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Create Users (Students and Professors)
  const professor1 = await prisma.user.upsert({
    where: { email: "professor.smith@case.edu" },
    update: {},
    create: {
      email: "professor.smith@case.edu",
      name: "Dr. John Smith",
      role: "professor",
    },
  });

  const professor2 = await prisma.user.upsert({
    where: { email: "professor.chen@case.edu" },
    update: {},
    create: {
      email: "professor.chen@case.edu",
      name: "Dr. Wei Chen",
      role: "professor",
    },
  });

  const student1 = await prisma.user.upsert({
    where: { email: "alice.johnson@case.edu" },
    update: {},
    create: {
      email: "alice.johnson@case.edu",
      name: "Alice Johnson",
      role: "student",
      studentNumber: "STU001",
    },
  });

  const student2 = await prisma.user.upsert({
    where: { email: "bob.williams@case.edu" },
    update: {},
    create: {
      email: "bob.williams@case.edu",
      name: "Bob Williams",
      role: "student",
      studentNumber: "STU002",
    },
  });

  const student3 = await prisma.user.upsert({
    where: { email: "carol.davis@case.edu" },
    update: {},
    create: {
      email: "carol.davis@case.edu",
      name: "Carol Davis",
      role: "student",
      studentNumber: "STU003",
    },
  });

  const student4 = await prisma.user.upsert({
    where: { email: "david.lee@case.edu" },
    update: {},
    create: {
      email: "david.lee@case.edu",
      name: "David Lee",
      role: "student",
      studentNumber: "STU004",
    },
  });

  const student5 = await prisma.user.upsert({
    where: { email: "emma.wilson@case.edu" },
    update: {},
    create: {
      email: "emma.wilson@case.edu",
      name: "Emma Wilson",
      role: "student",
      studentNumber: "STU005",
    },
  });

  console.log("✅ Created users");

  // Create Cohorts
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

  // Add students to cohorts
  await prisma.cohortMember.upsert({
    where: { userId_cohortId: { userId: student1.id, cohortId: cohort1.id } },
    update: {},
    create: { userId: student1.id, cohortId: cohort1.id, status: "joined" },
  });

  await prisma.cohortMember.upsert({
    where: { userId_cohortId: { userId: student2.id, cohortId: cohort1.id } },
    update: {},
    create: { userId: student2.id, cohortId: cohort1.id, status: "joined" },
  });

  await prisma.cohortMember.upsert({
    where: { userId_cohortId: { userId: student3.id, cohortId: cohort1.id } },
    update: {},
    create: { userId: student3.id, cohortId: cohort1.id, status: "joined" },
  });

  await prisma.cohortMember.upsert({
    where: { userId_cohortId: { userId: student1.id, cohortId: cohort2.id } },
    update: {},
    create: { userId: student1.id, cohortId: cohort2.id, status: "joined" },
  });

  await prisma.cohortMember.upsert({
    where: { userId_cohortId: { userId: student4.id, cohortId: cohort2.id } },
    update: {},
    create: { userId: student4.id, cohortId: cohort2.id, status: "joined" },
  });

  await prisma.cohortMember.upsert({
    where: { userId_cohortId: { userId: student5.id, cohortId: cohort2.id } },
    update: {},
    create: { userId: student5.id, cohortId: cohort2.id, status: "joined" },
  });

  console.log("✅ Added students to cohorts");

  // Create Cases
  const case1 = await prisma.case.upsert({
    where: { slug: "salary-negotiation" },
    update: {},
    create: {
      slug: "salary-negotiation",
      title: "Salary Negotiation Scenario",
      description: "Practice negotiating a salary increase with your manager",
      isPublished: true,
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
    },
  });

  console.log("✅ Created cases");

  // Assign cases to cohorts and students
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

  // Create some attempts (learning records)
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
      submittedAt: new Date("2026-03-21T13:30:00Z"),
      evalResult: "Excellent conflict resolution skills. Student facilitated a productive discussion between parties.",
    },
  });

  console.log("✅ Created learning attempts");

  console.log("\n🎉 Database seeded successfully!");
  console.log("\n📊 Summary:");
  console.log("   - 2 Professors");
  console.log("   - 5 Students");
  console.log("   - 2 Cohorts");
  console.log("   - 3 Cases");
  console.log("   - 7 Attempts (learning records)");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
