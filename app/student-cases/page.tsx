"use client";

import { useState, useMemo } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { Briefcase, Plus, Calendar, User } from "lucide-react";

import { title } from "@/components/primitives";
import { useAuth } from "@/lib/auth-context";

interface StudentCase {
  id: string;
  name: string;
  code: string;
  instructor: string;
  description: string;
  dueDate: string;
  status: "not_started" | "in_progress" | "completed";
}

const mockCases: StudentCase[] = [
  {
    id: "case-001",
    name: "Digital Transformation at RetailCo",
    code: "MGMT-401-A",
    instructor: "Dr. Sarah Chen",
    description:
      "Analyze the digital transformation strategy of a major retail company and propose recommendations for improving their e-commerce presence.",
    dueDate: "2024-03-15",
    status: "in_progress",
  },
  {
    id: "case-002",
    name: "Supply Chain Optimization",
    code: "OPMT-350-B",
    instructor: "Prof. Michael Torres",
    description:
      "Evaluate the supply chain challenges faced by a manufacturing firm and develop a comprehensive optimization plan.",
    dueDate: "2024-03-22",
    status: "not_started",
  },
  {
    id: "case-003",
    name: "Marketing Strategy for TechStart",
    code: "MKTG-420-A",
    instructor: "Dr. Emily Watson",
    description:
      "Develop a go-to-market strategy for a B2B SaaS startup entering the enterprise market.",
    dueDate: "2024-02-28",
    status: "completed",
  },
];

const statusConfig = {
  not_started: { label: "Not Started", color: "default" as const },
  in_progress: { label: "In Progress", color: "primary" as const },
  completed: { label: "Completed", color: "success" as const },
};

export default function StudentCasesPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState<StudentCase[]>(mockCases);
  const [caseCode, setCaseCode] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const uniqueCourses = useMemo(() => {
    const codes = [...new Set(cases.map((c) => c.code))];
    return codes.sort();
  }, [cases]);

  const filteredCases = useMemo(() => {
    let result = [...cases];

    if (courseFilter !== "all") {
      result = result.filter((c) => c.code === courseFilter);
    }

    result.sort((a, b) => {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [cases, courseFilter, sortOrder]);

  const handleAddCase = () => {
    if (!caseCode.trim()) return;

    setIsAdding(true);

    setTimeout(() => {
      const newCase: StudentCase = {
        id: `case-${Date.now()}`,
        name: "New Assigned Case",
        code: caseCode.toUpperCase(),
        instructor: "TBD",
        description: "Case details will be loaded from the system.",
        dueDate: "2024-04-01",
        status: "not_started",
      };

      setCases([newCase, ...cases]);
      setCaseCode("");
      setIsAdding(false);
    }, 500);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className={title()}>
          {user?.name ? `${user.name}'s Cases` : "My Cases"}
        </h1>
        <p className="text-default-500">
          View your assigned cases and add new ones using a case code.
        </p>
      </div>

      <Card className="bg-default-50">
        <CardBody className="gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              className="flex-1"
              placeholder="Enter case code or link (e.g., MGMT-401-A)"
              value={caseCode}
              onChange={(e) => setCaseCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCase()}
            />
            <Button
              color="primary"
              isLoading={isAdding}
              startContent={!isAdding && <Plus size={18} />}
              onPress={handleAddCase}
            >
              Add Case
            </Button>
          </div>
          <div className="flex gap-2">
            <Select
              aria-label="Filter by course"
              className="w-40"
              size="sm"
              selectedKeys={[courseFilter]}
              onChange={(e) => setCourseFilter(e.target.value || "all")}
            >
              <SelectItem key="all">All Courses</SelectItem>
              {uniqueCourses.map((code) => (
                <SelectItem key={code}>{code}</SelectItem>
              ))}
            </Select>
            <Select
              aria-label="Sort order"
              className="w-36"
              size="sm"
              selectedKeys={[sortOrder]}
              onChange={(e) =>
                setSortOrder((e.target.value as "newest" | "oldest") || "newest")
              }
            >
              <SelectItem key="newest">Newest First</SelectItem>
              <SelectItem key="oldest">Oldest First</SelectItem>
            </Select>
          </div>
        </CardBody>
      </Card>

      {filteredCases.length === 0 ? (
        <Card className="bg-default-50">
          <CardBody className="py-12 text-center">
            <Briefcase className="mx-auto mb-4 text-default-300" size={48} />
            <p className="text-default-500">
              {cases.length === 0
                ? "No cases assigned yet. Add a case using the code above."
                : "No cases match your filters."}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCases.map((caseItem) => (
            <Card
              key={caseItem.id}
              isPressable
              className="hover:shadow-lg transition-shadow"
            >
              <CardHeader className="flex gap-3 pb-0">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                  <Briefcase className="text-primary" size={20} />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {caseItem.name}
                  </p>
                  <p className="text-xs text-default-500 font-mono">
                    {caseItem.code}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full bg-${statusConfig[caseItem.status].color}/10 text-${statusConfig[caseItem.status].color}`}
                >
                  {statusConfig[caseItem.status].label}
                </span>
              </CardHeader>
              <CardBody className="pt-3">
                <p className="text-sm text-default-600 line-clamp-2 mb-4">
                  {caseItem.description}
                </p>
                <div className="flex flex-col gap-2 text-xs text-default-400">
                  <div className="flex items-center gap-2">
                    <User size={14} />
                    <span>{caseItem.instructor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    <span>Due: {caseItem.dueDate}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
