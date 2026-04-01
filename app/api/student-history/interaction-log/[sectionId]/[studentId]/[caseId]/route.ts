import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { s3Storage } from "@/lib/s3-client";

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ sectionId: string; studentId: string; caseId: string }>;
  }
) {
  const { studentId, caseId } = await params;
  const attemptNumber = request.nextUrl.searchParams.get("attemptNumber");

  try {
    const user = await prisma.user.findUnique({ where: { id: studentId } });
    if (!user) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const logs = await s3Storage.listInteractionLogs(user.email, caseId);

    if (attemptNumber) {
      const logMeta = logs.find(
        (l) => l.attemptNumber === parseInt(attemptNumber)
      );
      if (!logMeta) {
        return NextResponse.json(
          { error: "Attempt not found" },
          { status: 404 }
        );
      }
      const log = await s3Storage.getInteractionLog(
        user.email,
        caseId,
        logMeta.id
      );
      return NextResponse.json({ log });
    }

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Error fetching interaction log:", error);
    return NextResponse.json(
      { error: "Failed to fetch interaction log" },
      { status: 500 }
    );
  }
}
