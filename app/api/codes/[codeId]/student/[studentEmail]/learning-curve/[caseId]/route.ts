import { NextRequest, NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";

interface AttemptData {
  attemptNumber: number;
  score: number | null;
  date: string;
  change: number | null;
  percentChange: number | null;
}

interface LearningInsight {
  type: "strength" | "improvement" | "pattern";
  title: string;
  description: string;
}

function calculateTrend(scores: number[]): { trend: "improving" | "stable" | "declining"; strength: "strong" | "moderate" | "weak" } {
  if (scores.length < 2) return { trend: "stable", strength: "weak" };

  const firstHalf = scores.slice(0, Math.ceil(scores.length / 2));
  const secondHalf = scores.slice(Math.floor(scores.length / 2));

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const diff = secondAvg - firstAvg;
  const percentDiff = (diff / Math.max(firstAvg, 1)) * 100;

  let trend: "improving" | "stable" | "declining";
  let strength: "strong" | "moderate" | "weak";

  if (percentDiff > 15) {
    trend = "improving";
    strength = "strong";
  } else if (percentDiff > 5) {
    trend = "improving";
    strength = "moderate";
  } else if (percentDiff > 0) {
    trend = "improving";
    strength = "weak";
  } else if (percentDiff < -15) {
    trend = "declining";
    strength = "strong";
  } else if (percentDiff < -5) {
    trend = "declining";
    strength = "moderate";
  } else if (percentDiff < 0) {
    trend = "declining";
    strength = "weak";
  } else {
    trend = "stable";
    strength = "moderate";
  }

  return { trend, strength };
}

function generateInsights(attempts: AttemptData[], trend: string, scores: number[]): LearningInsight[] {
  const insights: LearningInsight[] = [];

  if (scores.length === 0) return insights;

  const improvements = attempts
    .filter((a) => a.change !== null && a.change > 0)
    .map((a) => a.change!);

  if (improvements.length > 0) {
    const maxImprovement = Math.max(...improvements);
    if (maxImprovement >= 10) {
      insights.push({
        type: "strength",
        title: "Strong Learning Ability",
        description: `Showed significant improvement of ${maxImprovement} points between attempts, indicating good learning capacity.`,
      });
    }
  }

  const lastScore = scores[scores.length - 1];
  const bestScore = Math.max(...scores);
  if (lastScore >= 70) {
    insights.push({
      type: "strength",
      title: "Passing Performance",
      description: "Currently meeting the passing threshold. Keep up the good work!",
    });
  } else if (bestScore >= 70 && lastScore < 70) {
    insights.push({
      type: "improvement",
      title: "Inconsistent Performance",
      description: "Has achieved passing scores before but recent performance dropped. Review previous successful strategies.",
    });
  }

  if (trend === "improving" && scores.length >= 3) {
    insights.push({
      type: "pattern",
      title: "Positive Learning Trajectory",
      description: "Scores are consistently improving over time. This indicates effective learning and practice.",
    });
  }

  if (scores.length >= 2) {
    const stdDev = Math.sqrt(
      scores.reduce((sum, s) => sum + Math.pow(s - (scores.reduce((a, b) => a + b, 0) / scores.length), 2), 0) / scores.length
    );
    if (stdDev < 5) {
      insights.push({
        type: "pattern",
        title: "Consistent Performance",
        description: "Scores are very consistent across attempts, showing stable understanding of the material.",
      });
    } else if (stdDev > 15) {
      insights.push({
        type: "improvement",
        title: "Variable Performance",
        description: "Scores vary significantly between attempts. Consider identifying factors that affect performance.",
      });
    }
  }

  if (lastScore < 70 && trend !== "improving") {
    insights.push({
      type: "improvement",
      title: "Additional Practice Recommended",
      description: "Consider reviewing case materials and practicing more to improve scores.",
    });
  }

  return insights.slice(0, 4);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codeId: string; studentEmail: string; caseId: string }> }
) {
  try {
    const { codeId, studentEmail, caseId } = await params;
    const email = decodeURIComponent(studentEmail).toLowerCase();

    const cohort = await s3Storage.getCohort(codeId);
    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 });
    }

    const student = cohort.students?.find(
      (s) => s.email.toLowerCase() === email
    );
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const caseData = await s3Storage.getCase(caseId);
    const caseName = caseData?.name || `Case ${caseId}`;

    const logs = await s3Storage.listInteractionLogs(email, caseId);
    const assessedLogs = logs.filter((l) => l.mode === "assessed");

    const sortedLogs = [...assessedLogs].sort((a, b) => a.attemptNumber - b.attemptNumber);

    const attempts: AttemptData[] = [];
    let prevScore: number | null = null;

    for (const log of sortedLogs) {
      const score = log.evalScore ?? null;
      let change: number | null = null;
      let percentChange: number | null = null;

      if (prevScore !== null && score !== null) {
        change = score - prevScore;
        percentChange = (change / Math.max(prevScore, 1)) * 100;
      }

      attempts.push({
        attemptNumber: log.attemptNumber,
        score,
        date: new Date(log.startedAt).toISOString(),
        change,
        percentChange,
      });

      if (score !== null) {
        prevScore = score;
      }
    }

    const scores = attempts.map((a) => a.score).filter((s): s is number => s !== null);

    const { trend, strength: trendStrength } = calculateTrend(scores);

    const firstScore = scores.length > 0 ? scores[0] : null;
    const lastScore = scores.length > 0 ? scores[scores.length - 1] : null;
    const bestScore = scores.length > 0 ? Math.max(...scores) : null;
    const worstScore = scores.length > 0 ? Math.min(...scores) : null;
    const totalImprovement = firstScore !== null && lastScore !== null ? lastScore - firstScore : null;

    const changes = attempts
      .filter((a) => a.change !== null)
      .map((a) => a.change!);
    const avgImprovement = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : null;

    let consistencyScore: number | null = null;
    if (scores.length >= 2) {
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
      const stdDev = Math.sqrt(variance);
      consistencyScore = Math.max(0, Math.round(100 - stdDev * 2));
    }

    let projectedNextScore: number | null = null;
    if (scores.length >= 2 && avgImprovement !== null) {
      const projected = lastScore! + avgImprovement;
      projectedNextScore = Math.min(100, Math.max(0, Math.round(projected)));
    }

    const insights = generateInsights(attempts, trend, scores);

    return NextResponse.json({
      studentEmail: student.email,
      studentName: student.name || student.email.split("@")[0],
      caseId,
      caseName,
      cohortName: cohort.name,
      trend,
      trendStrength,
      attempts,
      firstScore,
      lastScore,
      bestScore,
      worstScore,
      totalImprovement,
      avgImprovement: avgImprovement !== null ? Math.round(avgImprovement * 10) / 10 : null,
      consistencyScore,
      insights,
      projectedNextScore,
    });
  } catch (error) {
    console.error("Error fetching learning curve details:", error);
    return NextResponse.json(
      { error: "Failed to fetch learning curve details" },
      { status: 500 }
    );
  }
}
