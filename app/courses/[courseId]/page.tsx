"use client";

import { useState, useEffect, useCallback, use } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Chip } from "@heroui/chip";
import { Select, SelectItem } from "@heroui/select";
import { Slider } from "@heroui/slider";
import { 
  Plus, 
  ArrowLeft,
  Loader2, 
  Search,
  FileText,
  Clock,
  BarChart3,
  ChevronRight,
  Pencil,
  Trash2,
  Globe,
  Archive,
  Play,
  Settings,
  Users
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { Course, Case } from "@/types";

interface Avatar {
  id: string;
  name: string;
}

export default function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published" | "archived">("all");
  
  // Create case modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newCase, setNewCase] = useState({
    name: "",
    description: "",
    difficulty: "intermediate" as Case["difficulty"],
    estimatedDuration: 15,
    avatarId: "",
  });

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<Case | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit course modal state
  const [isEditCourseOpen, setIsEditCourseOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(false);
  const [editCourseData, setEditCourseData] = useState({
    name: "",
    code: "",
    semester: "",
    description: "",
  });

  const fetchCourseData = useCallback(async () => {
    try {
      const [courseRes, avatarsRes] = await Promise.all([
        fetch(`/api/courses/${courseId}`),
        fetch("/api/demo-avatars"),
      ]);
      
      const courseData = await courseRes.json();
      const avatarsData = await avatarsRes.json();

      if (!courseRes.ok) {
        setError(courseData.error || "Failed to fetch course");
        return;
      }

      setCourse(courseData.course);
      setCases(courseData.cases || []);
      setAvatars(avatarsData.avatars || []);
      setEditCourseData({
        name: courseData.course.name,
        code: courseData.course.code,
        semester: courseData.course.semester,
        description: courseData.course.description || "",
      });
    } catch (err) {
      setError("Failed to fetch course data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourseData();
  }, [fetchCourseData]);

  const handleCreateCase = async () => {
    if (!newCase.name.trim() || !newCase.description.trim() || !newCase.avatarId) {
      setCreateError("Name, Description, and Avatar are required");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch(`/api/courses/${courseId}/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newCase,
          createdBy: user?.id || "unknown",
          createdByName: user?.name || "Unknown",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setCreateError(data.error || "Failed to create case");
        return;
      }

      setNewCase({
        name: "",
        description: "",
        difficulty: "intermediate",
        estimatedDuration: 15,
        avatarId: "",
      });
      setIsCreateModalOpen(false);
      
      // Navigate to the case editor
      router.push(`/courses/${courseId}/cases/${data.case.id}`);
    } catch (err) {
      setCreateError("Failed to create case");
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCase = async () => {
    if (!deleteConfirm) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/cases/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to delete case");
        return;
      }

      setDeleteConfirm(null);
      await fetchCourseData();
    } catch (err) {
      setError("Failed to delete case");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateCourse = async () => {
    setEditingCourse(true);
    try {
      const response = await fetch(`/api/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editCourseData),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to update course");
        return;
      }

      setIsEditCourseOpen(false);
      await fetchCourseData();
    } catch (err) {
      setError("Failed to update course");
      console.error(err);
    } finally {
      setEditingCourse(false);
    }
  };

  const filteredCases = cases.filter((c) => {
    const matchesSearch = searchQuery === "" ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: Case["status"]) => {
    switch (status) {
      case "published": return "success";
      case "draft": return "warning";
      case "archived": return "default";
    }
  };

  const getStatusIcon = (status: Case["status"]) => {
    switch (status) {
      case "published": return <Globe className="w-3 h-3" />;
      case "draft": return <FileText className="w-3 h-3" />;
      case "archived": return <Archive className="w-3 h-3" />;
    }
  };

  const getDifficultyColor = (difficulty: Case["difficulty"]) => {
    switch (difficulty) {
      case "beginner": return "success";
      case "intermediate": return "warning";
      case "advanced": return "danger";
    }
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-default-600">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Course not found</h2>
          <Button color="primary" onPress={() => router.push("/courses")}>
            Back to Courses
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <Button
          variant="light"
          startContent={<ArrowLeft className="w-4 h-4" />}
          onPress={() => router.push("/courses")}
          className="mb-4"
        >
          Back to Courses
        </Button>

        {/* Course Header */}
        <Card className="mb-8">
          <CardBody className="p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Chip size="sm" variant="flat" color="primary">
                    {course.code}
                  </Chip>
                  <Chip size="sm" variant="bordered">
                    {course.semester}
                  </Chip>
                </div>
                <h1 className="text-2xl font-bold mb-2">{course.name}</h1>
                {course.description && (
                  <p className="text-default-600 mb-4">{course.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-default-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {course.professorName}
                  </span>
                  <span>•</span>
                  <span>{cases.length} case{cases.length !== 1 ? "s" : ""}</span>
                  <span>•</span>
                  <span>Updated {getRelativeTime(course.updatedAt)}</span>
                </div>
              </div>
              <Button
                variant="bordered"
                startContent={<Settings className="w-4 h-4" />}
                onPress={() => setIsEditCourseOpen(true)}
              >
                Edit Course
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Error display */}
        {error && (
          <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 mb-6">
            <p className="text-danger-700 dark:text-danger-400">{error}</p>
            <Button size="sm" variant="light" color="danger" className="mt-2" onPress={() => setError(null)}>
              Dismiss
            </Button>
          </div>
        )}

        {/* Cases Section */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Training Cases</h2>
          
          {/* Actions Bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Input
              classNames={{
                base: "flex-1 max-w-md",
                inputWrapper: "bg-white dark:bg-gray-800 shadow-sm",
              }}
              placeholder="Search cases..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              startContent={<Search className="w-4 h-4 text-default-400" />}
            />
            <div className="flex gap-2">
              <Select
                className="w-40"
                selectedKeys={[statusFilter]}
                onSelectionChange={(keys) => setStatusFilter(Array.from(keys)[0] as any)}
                size="sm"
              >
                <SelectItem key="all">All Status</SelectItem>
                <SelectItem key="draft">Draft</SelectItem>
                <SelectItem key="published">Published</SelectItem>
                <SelectItem key="archived">Archived</SelectItem>
              </Select>
              <Button
                color="primary"
                startContent={<Plus className="w-5 h-5" />}
                onPress={() => setIsCreateModalOpen(true)}
              >
                Create Case
              </Button>
            </div>
          </div>

          {/* Cases Grid */}
          {filteredCases.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <FileText className="w-16 h-16 text-default-300" />
                <div>
                  <h3 className="text-xl font-semibold mb-2">
                    {searchQuery || statusFilter !== "all" ? "No cases found" : "No cases yet"}
                  </h3>
                  <p className="text-default-500 mb-4">
                    {searchQuery || statusFilter !== "all"
                      ? "Try adjusting your filters"
                      : "Create your first training case for this course."}
                  </p>
                  {!searchQuery && statusFilter === "all" && (
                    <Button color="primary" onPress={() => setIsCreateModalOpen(true)}>
                      Create Your First Case
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCases.map((caseItem) => (
                <Card
                  key={caseItem.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer group"
                  isPressable
                  onPress={() => router.push(`/courses/${courseId}/cases/${caseItem.id}`)}
                >
                  <CardHeader className="flex justify-between items-start pb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Chip 
                          size="sm" 
                          variant="flat" 
                          color={getStatusColor(caseItem.status)}
                          startContent={getStatusIcon(caseItem.status)}
                        >
                          {caseItem.status}
                        </Chip>
                        <Chip 
                          size="sm" 
                          variant="bordered" 
                          color={getDifficultyColor(caseItem.difficulty)}
                        >
                          {caseItem.difficulty}
                        </Chip>
                      </div>
                      <h3 className="text-lg font-semibold line-clamp-2">{caseItem.name}</h3>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(caseItem);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardBody className="pt-0">
                    <p className="text-sm text-default-500 line-clamp-2 mb-4">
                      {caseItem.description}
                    </p>
                    
                    <div className="flex items-center gap-4 text-sm text-default-500 mb-4">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {caseItem.estimatedDuration} min
                      </span>
                      <span className="flex items-center gap-1">
                        <BarChart3 className="w-4 h-4" />
                        {caseItem.learningObjectives.length} objectives
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-default-200">
                      <span className="text-xs text-default-400">
                        Updated {getRelativeTime(caseItem.updatedAt)}
                      </span>
                      <div className="flex items-center gap-2">
                        {caseItem.status === "published" && (
                          <Button
                            size="sm"
                            variant="flat"
                            color="success"
                            startContent={<Play className="w-3 h-3" />}
                            onPress={(e) => {
                              e.stopPropagation();
                              router.push(`/courses/${courseId}/cases/${caseItem.id}/preview`);
                            }}
                          >
                            Preview
                          </Button>
                        )}
                        <ChevronRight className="w-5 h-5 text-default-400 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Case Modal */}
      <Modal 
        isOpen={isCreateModalOpen} 
        onOpenChange={setIsCreateModalOpen}
        size="2xl"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-6 h-6 text-primary" />
                  Create New Case
                </div>
              </ModalHeader>
              <ModalBody>
                {createError && (
                  <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-3 mb-4">
                    <p className="text-danger-700 dark:text-danger-400 text-sm">{createError}</p>
                  </div>
                )}
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Case Name <span className="text-danger">*</span>
                    </label>
                    <Input
                      value={newCase.name}
                      onValueChange={(v) => setNewCase({ ...newCase, name: v })}
                      placeholder="e.g., Patient Consultation - Chest Pain"
                      variant="bordered"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Description <span className="text-danger">*</span>
                    </label>
                    <Textarea
                      value={newCase.description}
                      onValueChange={(v) => setNewCase({ ...newCase, description: v })}
                      placeholder="Describe the scenario and learning goals..."
                      variant="bordered"
                      minRows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Avatar <span className="text-danger">*</span>
                    </label>
                    <Select
                      selectedKeys={newCase.avatarId ? [newCase.avatarId] : []}
                      onSelectionChange={(keys) => setNewCase({ ...newCase, avatarId: Array.from(keys)[0] as string })}
                      placeholder="Select an avatar for this case"
                      variant="bordered"
                    >
                      {avatars.map((avatar) => (
                        <SelectItem key={avatar.id}>{avatar.name}</SelectItem>
                      ))}
                    </Select>
                    <p className="text-xs text-default-400 mt-1">
                      The avatar will be the face of this training scenario
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Difficulty
                      </label>
                      <Select
                        selectedKeys={[newCase.difficulty]}
                        onSelectionChange={(keys) => setNewCase({ ...newCase, difficulty: Array.from(keys)[0] as Case["difficulty"] })}
                        variant="bordered"
                      >
                        <SelectItem key="beginner">Beginner</SelectItem>
                        <SelectItem key="intermediate">Intermediate</SelectItem>
                        <SelectItem key="advanced">Advanced</SelectItem>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Estimated Duration: {newCase.estimatedDuration} min
                      </label>
                      <Slider
                        size="sm"
                        step={5}
                        minValue={5}
                        maxValue={60}
                        value={newCase.estimatedDuration}
                        onChange={(v) => setNewCase({ ...newCase, estimatedDuration: v as number })}
                        className="mt-4"
                      />
                    </div>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} isDisabled={creating}>
                  Cancel
                </Button>
                <Button 
                  color="primary" 
                  onPress={handleCreateCase}
                  isDisabled={creating || !newCase.name.trim() || !newCase.description.trim() || !newCase.avatarId}
                  startContent={creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                >
                  {creating ? "Creating..." : "Create & Edit Case"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Edit Course Modal */}
      <Modal 
        isOpen={isEditCourseOpen} 
        onOpenChange={setIsEditCourseOpen}
        size="2xl"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Edit Course</ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Course Name</label>
                      <Input
                        value={editCourseData.name}
                        onValueChange={(v) => setEditCourseData({ ...editCourseData, name: v })}
                        variant="bordered"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Course Code</label>
                      <Input
                        value={editCourseData.code}
                        onValueChange={(v) => setEditCourseData({ ...editCourseData, code: v })}
                        variant="bordered"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Semester</label>
                    <Input
                      value={editCourseData.semester}
                      onValueChange={(v) => setEditCourseData({ ...editCourseData, semester: v })}
                      variant="bordered"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <Textarea
                      value={editCourseData.description}
                      onValueChange={(v) => setEditCourseData({ ...editCourseData, description: v })}
                      variant="bordered"
                      minRows={3}
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} isDisabled={editingCourse}>
                  Cancel
                </Button>
                <Button 
                  color="primary" 
                  onPress={handleUpdateCourse}
                  isDisabled={editingCourse}
                  startContent={editingCourse ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                >
                  {editingCourse ? "Saving..." : "Save Changes"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Delete Case</ModalHeader>
              <ModalBody>
                <p>
                  Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
                </p>
                <p className="text-sm text-danger mt-2">
                  This action cannot be undone.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} isDisabled={deleting}>
                  Cancel
                </Button>
                <Button 
                  color="danger" 
                  onPress={handleDeleteCase}
                  isDisabled={deleting}
                  startContent={deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                >
                  {deleting ? "Deleting..." : "Delete Case"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
