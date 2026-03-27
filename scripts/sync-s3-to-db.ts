/**
 * Sync S3 Data to PostgreSQL
 * 
 * This script syncs real data from S3 to PostgreSQL database:
 * - Cases from S3 → Case table
 * - Cohorts from S3 → Cohort table + User table (students)
 * - Interactions from S3 → Attempt table
 */

import { PrismaClient, Role, AuthProvider, CohortMemberStatus } from "@prisma/client";
import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;

async function getJson(key: string): Promise<any> {
  try {
    const result = await s3.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));
    return JSON.parse(await result.Body?.transformToString() || "{}");
  } catch (error) {
    console.error(`Failed to get ${key}:`, error);
    return null;
  }
}

async function clearTestData() {
  console.log("🗑️  Clearing test data from database...");
  
  // Delete in order to respect foreign keys
  await prisma.auditLog.deleteMany({});
  await prisma.attempt.deleteMany({});
  await prisma.caseAssignment.deleteMany({});
  await prisma.cohortMember.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.case.deleteMany({});
  await prisma.cohort.deleteMany({});
  await prisma.user.deleteMany({});
  
  console.log("✅ Test data cleared");
}

async function createAdminUser() {
  console.log("\n👤 Creating admin user...");
  
  const crypto = await import("crypto");
  const hashPassword = (password: string) => 
    crypto.createHash("sha512").update(password).digest("hex");
  
  await prisma.user.upsert({
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
  
  console.log("✅ Admin user created (admin@example.com / admin123)");
}

async function syncCases() {
  console.log("\n📋 Syncing Cases from S3...");
  
  const caseIndex = await getJson("cases/index.json");
  if (!caseIndex || !Array.isArray(caseIndex)) {
    console.log("   No cases found in S3");
    return;
  }
  
  for (const caseInfo of caseIndex) {
    // Get full case data
    let fullCase = await getJson(`cases/${caseInfo.id}.json`);
    if (!fullCase) {
      console.log(`   ⚠️ Could not load case: ${caseInfo.id}`);
      continue;
    }
    
    // Create case in database
    await prisma.case.upsert({
      where: { slug: caseInfo.id },
      update: {
        title: fullCase.name || caseInfo.name,
        description: fullCase.description || null,
        isPublished: true,
        updatedAt: new Date(),
      },
      create: {
        slug: caseInfo.id,
        title: fullCase.name || caseInfo.name,
        description: fullCase.description || null,
        isPublished: true,
        difficulty: fullCase.difficulty || null,
        category: fullCase.category || null,
      },
    });
    
    console.log(`   ✅ ${fullCase.name || caseInfo.name}`);
  }
}

async function syncCohorts() {
  console.log("\n📚 Syncing Cohorts from S3...");
  
  const cohortIndex = await getJson("cohorts/index.json");
  if (!cohortIndex || !Array.isArray(cohortIndex)) {
    console.log("   No cohorts found in S3");
    return;
  }
  
  const crypto = await import("crypto");
  const hashPassword = (password: string) => 
    crypto.createHash("sha512").update(password).digest("hex");
  
  for (const cohortInfo of cohortIndex) {
    const fullCohort = await getJson(`cohorts/${cohortInfo.id}.json`);
    if (!fullCohort) {
      console.log(`   ⚠️ Could not load cohort: ${cohortInfo.id}`);
      continue;
    }
    
    // Create or find professor
    let professorId: string | null = null;
    if (fullCohort.professorId) {
      // Try to create professor user if email exists
      const profEmail = fullCohort.professorEmail || `professor-${fullCohort.professorId}@case.edu`;
      const professor = await prisma.user.upsert({
        where: { email: profEmail },
        update: {},
        create: {
          email: profEmail,
          name: fullCohort.professorName || "Professor",
          role: Role.PROFESSOR,
          authProvider: AuthProvider.CWRU_SSO,
          emailVerified: true,
        },
      });
      professorId = professor.id;
    }
    
    // Create cohort
    const cohort = await prisma.cohort.upsert({
      where: { code: fullCohort.accessCode },
      update: {
        name: fullCohort.name,
        description: fullCohort.description || null,
        isActive: fullCohort.isActive !== false,
        updatedAt: new Date(),
      },
      create: {
        name: fullCohort.name,
        code: fullCohort.accessCode,
        description: fullCohort.description || null,
        isActive: fullCohort.isActive !== false,
        creatorId: professorId,
      },
    });
    
    console.log(`   ✅ ${fullCohort.name} (code: ${fullCohort.accessCode})`);
    
    // Sync students
    if (fullCohort.students && Array.isArray(fullCohort.students)) {
      for (const student of fullCohort.students) {
        if (!student.email) continue;
        
        // Create student user
        const studentUser = await prisma.user.upsert({
          where: { email: student.email.toLowerCase() },
          update: {
            name: student.name || undefined,
          },
          create: {
            email: student.email.toLowerCase(),
            name: student.name || null,
            role: Role.STUDENT,
            authProvider: AuthProvider.CWRU_SSO,
            emailVerified: true,
          },
        });
        
        // Add to cohort
        await prisma.cohortMember.upsert({
          where: {
            userId_cohortId: {
              userId: studentUser.id,
              cohortId: cohort.id,
            },
          },
          update: {
            status: student.status === "joined" ? CohortMemberStatus.JOINED : CohortMemberStatus.INVITED,
          },
          create: {
            userId: studentUser.id,
            cohortId: cohort.id,
            status: student.status === "joined" ? CohortMemberStatus.JOINED : CohortMemberStatus.INVITED,
          },
        });
      }
      console.log(`      → ${fullCohort.students.length} students synced`);
    }
    
    // Sync case assignments
    if (fullCohort.assignedCaseIds && Array.isArray(fullCohort.assignedCaseIds)) {
      for (const caseId of fullCohort.assignedCaseIds) {
        // Find case by slug
        const caseRecord = await prisma.case.findUnique({
          where: { slug: caseId },
        });
        
        if (caseRecord && fullCohort.students) {
          // Assign case to all students in cohort
          for (const student of fullCohort.students) {
            if (!student.email) continue;
            
            const studentUser = await prisma.user.findUnique({
              where: { email: student.email.toLowerCase() },
            });
            
            if (studentUser) {
              await prisma.caseAssignment.upsert({
                where: {
                  userId_caseId: {
                    userId: studentUser.id,
                    caseId: caseRecord.id,
                  },
                },
                update: {},
                create: {
                  userId: studentUser.id,
                  caseId: caseRecord.id,
                  cohortId: cohort.id,
                },
              });
            }
          }
        }
      }
      console.log(`      → ${fullCohort.assignedCaseIds.length} cases assigned`);
    }
  }
}

async function syncInteractions() {
  console.log("\n💬 Syncing Interactions from S3...");
  
  // List all interaction folders
  const result = await s3.send(new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: "interactions/",
    Delimiter: "/",
  }));
  
  const studentPrefixes = result.CommonPrefixes || [];
  
  for (const prefix of studentPrefixes) {
    const studentEmail = prefix.Prefix?.replace("interactions/", "").replace("/", "");
    if (!studentEmail) continue;
    
    // Find or create student
    let student = await prisma.user.findUnique({
      where: { email: studentEmail },
    });
    
    if (!student) {
      student = await prisma.user.create({
        data: {
          email: studentEmail,
          role: Role.STUDENT,
          authProvider: AuthProvider.CWRU_SSO,
          emailVerified: true,
        },
      });
    }
    
    // List cases for this student
    const casesResult = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `interactions/${studentEmail}/`,
      Delimiter: "/",
    }));
    
    const casePrefixes = casesResult.CommonPrefixes || [];
    
    for (const casePrefix of casePrefixes) {
      const caseSlug = casePrefix.Prefix?.split("/")[2];
      if (!caseSlug) continue;
      
      // Find case
      const caseRecord = await prisma.case.findUnique({
        where: { slug: caseSlug },
      });
      
      if (!caseRecord) continue;
      
      // List interaction files
      const interactionsResult = await s3.send(new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: `interactions/${studentEmail}/${caseSlug}/`,
      }));
      
      const files = (interactionsResult.Contents || [])
        .filter(f => f.Key?.endsWith(".json") && !f.Key?.endsWith("index.json"));
      
      let attemptNumber = 0;
      for (const file of files) {
        attemptNumber++;
        
        try {
          const interaction = await getJson(file.Key!);
          if (!interaction) continue;
          
          // Check if attempt already exists
          const existing = await prisma.attempt.findUnique({
            where: {
              userId_caseId_attemptNumber: {
                userId: student.id,
                caseId: caseRecord.id,
                attemptNumber,
              },
            },
          });
          
          if (!existing) {
            await prisma.attempt.create({
              data: {
                userId: student.id,
                caseId: caseRecord.id,
                attemptNumber,
                score: interaction.evalScore || null,
                totalMessages: interaction.messages?.length || 0,
                totalTimeSeconds: interaction.totalTimeSeconds || null,
                startedAt: interaction.startedAt ? new Date(interaction.startedAt) : new Date(),
                submittedAt: interaction.completedAt ? new Date(interaction.completedAt) : null,
                evalResult: interaction.evalFeedback || null,
                interactionLogS3Key: file.Key,
              },
            });
          }
        } catch (e) {
          console.log(`      ⚠️ Error processing ${file.Key}`);
        }
      }
      
      if (files.length > 0) {
        console.log(`   ✅ ${studentEmail} → ${caseSlug}: ${files.length} attempts`);
      }
    }
  }
}

async function main() {
  console.log("🚀 Starting S3 → PostgreSQL sync...\n");
  
  await clearTestData();
  await createAdminUser();
  await syncCases();
  await syncCohorts();
  await syncInteractions();
  
  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 SYNC COMPLETE - Summary:");
  console.log("=".repeat(50));
  
  const userCount = await prisma.user.count();
  const cohortCount = await prisma.cohort.count();
  const caseCount = await prisma.case.count();
  const attemptCount = await prisma.attempt.count();
  const assignmentCount = await prisma.caseAssignment.count();
  
  console.log(`   Users: ${userCount}`);
  console.log(`   Cohorts: ${cohortCount}`);
  console.log(`   Cases: ${caseCount}`);
  console.log(`   Attempts: ${attemptCount}`);
  console.log(`   Case Assignments: ${assignmentCount}`);
  
  console.log("\n🎉 Done!");
}

main()
  .catch((e) => {
    console.error("❌ Sync failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
