import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Get all cohorts
    const cohorts = await s3Storage.listCohorts();

    console.log(`[Student Cases API] Looking for cohorts for email: ${normalizedEmail}`);
    console.log(`[Student Cases API] Total cohorts found: ${cohorts.length}`);

    // Find cohorts where this student is a member
    const studentCohorts = cohorts.filter((cohort) => {
      if (!cohort.isActive) {
        console.log(`[Student Cases API] Cohort ${cohort.name} is inactive`);
        return false;
      }

      // Check availability
      if (cohort.availableDate) {
        const now = new Date();
        const availDate = new Date(cohort.availableDate);
        if (now < availDate) {
          console.log(`[Student Cases API] Cohort ${cohort.name} not yet available`);
          return false;
        }
      }

      // Check expiration
      if (cohort.expirationDate) {
        const now = new Date();
        const expDate = new Date(cohort.expirationDate);
        if (now > expDate) {
          console.log(`[Student Cases API] Cohort ${cohort.name} has expired`);
          return false;
        }
      }

      // Check if student is in this cohort
      const studentEmails = cohort.students?.map(s => s.email.toLowerCase()) || [];
      console.log(`[Student Cases API] Cohort ${cohort.name} students: ${JSON.stringify(studentEmails)}`);
      
      const isInCohort = cohort.students?.some(
        (s) => s.email.toLowerCase() === normalizedEmail && s.status === "joined"
      );

      console.log(`[Student Cases API] Is ${normalizedEmail} in cohort ${cohort.name}? ${isInCohort}`);

      return isInCohort;
    });

    // Collect all assigned case IDs from student's cohorts
    const assignedCaseIds = new Set<string>();
    const cohortInfo: Record<string, { cohortId: string; cohortName: string }> = {};

    for (const cohort of studentCohorts) {
      const caseIds = cohort.assignedCaseIds || [];
      for (const caseId of caseIds) {
        assignedCaseIds.add(caseId);
        cohortInfo[caseId] = {
          cohortId: cohort.id,
          cohortName: cohort.name,
        };
      }
    }

    // Fetch the actual case details
    const cases = [];
    for (const caseId of assignedCaseIds) {
      const caseData = await s3Storage.getCase(caseId);
      if (caseData) {
        cases.push({
          ...caseData,
          cohortId: cohortInfo[caseId]?.cohortId,
          cohortName: cohortInfo[caseId]?.cohortName,
        });
      }
    }

    return NextResponse.json({
      success: true,
      cases,
      cohorts: studentCohorts.map((c) => ({
        id: c.id,
        name: c.name,
        assignedCaseIds: c.assignedCaseIds || [],
      })),
    });
  } catch (error) {
    console.error("Error fetching student cases:", error);
    return NextResponse.json(
      { error: "Failed to fetch cases" },
      { status: 500 }
    );
  }
}
