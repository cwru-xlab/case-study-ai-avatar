"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { title } from "@/components/primitives";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import {
  ArrowLeft,
  BookOpen,
  Users,
  Briefcase,
  ChevronRight,
} from "lucide-react";
import {
  getSectionById,
  getCasesBySection,
  getStudentsBySection,
  type CourseSection,
  type Case,
} from "@/lib/student-history-service";

interface PageProps {
  params: Promise<{
    classId: string;
  }>;
}

export default function ClassDashboardPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { classId } = resolvedParams;

  const [section, setSection] = useState<CourseSection | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [studentCount, setStudentCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [sectionData, casesData, studentsData] = await Promise.all([
          getSectionById(classId),
          getCasesBySection(classId),
          getStudentsBySection(classId),
        ]);

        if (!sectionData) {
          setError("Class not found");
          return;
        }

        setSection(sectionData);
        setCases(casesData);
        setStudentCount(studentsData.length);
      } catch (err) {
        setError("Failed to load class data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [classId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Spinner size="lg" label="Loading class dashboard..." />
      </div>
    );
  }

  if (error || !section) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-danger text-lg">{error || "Class not found"}</p>
        <Button
          color="primary"
          variant="flat"
          startContent={<ArrowLeft size={16} />}
          onPress={() => router.push("/student-history")}
        >
          Back to Student History
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="light"
            startContent={<ArrowLeft size={16} />}
            onPress={() => router.push("/student-history")}
          >
            Back
          </Button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className={title({ size: "sm" })}>Class Dashboard</h1>
            <div className="flex items-center gap-2 mt-2">
              <BookOpen size={18} className="text-default-400" />
              <span className="text-lg font-medium">{section.code}</span>
              <span className="text-default-500">-</span>
              <span className="text-default-600">{section.name}</span>
            </div>
            <p className="text-default-500 mt-1">
              {section.semester} {section.year}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Chip
              startContent={<Users size={14} />}
              variant="flat"
              color="primary"
            >
              {studentCount} Students
            </Chip>
            <Chip
              startContent={<Briefcase size={14} />}
              variant="flat"
              color="secondary"
            >
              {cases.length} Cases
            </Chip>
          </div>
        </div>
      </div>

      {/* Cases List */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Assigned Cases</h2>

        {cases.length === 0 ? (
          <Card>
            <CardBody className="py-12 text-center">
              <Briefcase
                size={48}
                className="mx-auto text-default-300 mb-4"
              />
              <p className="text-default-500 text-lg">
                No cases assigned to this class yet.
              </p>
              <p className="text-default-400 text-sm mt-2">
                Cases will appear here once they are assigned to this section.
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cases.map((caseItem) => (
              <Card
                key={caseItem.id}
                isPressable
                onPress={() =>
                  router.push(`/teacher/class/${classId}/case/${caseItem.id}`)
                }
                className="hover:scale-[1.02] transition-transform"
              >
                <CardHeader className="flex gap-3 pb-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Briefcase size={24} />
                  </div>
                  <div className="flex flex-col flex-1">
                    <p className="text-md font-semibold">{caseItem.name}</p>
                    <p className="text-small text-default-400">{caseItem.id}</p>
                  </div>
                  <ChevronRight
                    size={20}
                    className="text-default-400 self-center"
                  />
                </CardHeader>
                <CardBody className="pt-0">
                  <p className="text-sm text-default-600 line-clamp-2">
                    {caseItem.description}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
