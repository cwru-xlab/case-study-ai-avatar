import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@/lib/email-service";
import { s3Storage } from "@/lib/s3-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cohortId, emails } = body;

    if (!cohortId) {
      return NextResponse.json(
        { error: "cohortId is required" },
        { status: 400 }
      );
    }

    const cohort = await s3Storage.getCohort(cohortId);
    if (!cohort) {
      return NextResponse.json(
        { error: "Cohort not found" },
        { status: 404 }
      );
    }

    // Determine which emails to send to
    const targetEmails: string[] = emails ||
      cohort.students
        ?.filter((s) => s.status === "invited")
        .map((s) => s.email) || [];

    if (targetEmails.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No emails to send",
        sentCount: 0,
      });
    }

    const joinLink = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/join/${cohort.accessCode}`;

    const results: Array<{ email: string; success: boolean; error?: string }> = [];

    for (const email of targetEmails) {
      const subject = `You've been invited to join "${cohort.name}"`;
      const textContent = `Hello,

You have been invited to join the cohort "${cohort.name}" for a case study exercise.

To join, click the link below or use the access code:

Join Link: ${joinLink}
Access Code: ${cohort.accessCode}

Please use your email address (${email}) when joining.

If you have any questions, please contact your instructor.

Best regards,
AI Case Study Platform`;

      const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #003071; color: white; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 20px;">Case Study Invitation</h1>
  </div>
  <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 8px 8px;">
    <p>Hello,</p>
    <p>You have been invited to join the cohort <strong>"${cohort.name}"</strong> for a case study exercise.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${joinLink}" style="background: #003071; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">Join Now</a>
    </div>
    <p style="text-align: center; color: #666;">Or use access code: <strong style="font-family: monospace; font-size: 18px; color: #003071;">${cohort.accessCode}</strong></p>
    <p style="font-size: 13px; color: #999;">Please use your email address (${email}) when joining.</p>
  </div>
</body>
</html>`;

      const result = await emailService.sendEmail({
        to: [email],
        subject,
        htmlContent,
        textContent,
      });

      results.push({
        email,
        success: result.success,
        error: result.error,
      });
    }

    const sentCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Sent ${sentCount} invitation(s)${failedCount > 0 ? `, ${failedCount} failed` : ""}`,
      sentCount,
      failedCount,
      results,
    });
  } catch (error) {
    console.error("Error sending invitations:", error);
    return NextResponse.json(
      { error: "Failed to send invitations" },
      { status: 500 }
    );
  }
}
