"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Chip } from "@heroui/chip";
import { 
  Plus, 
  BookOpen, 
  Calendar, 
  User, 
  Loader2, 
  Search, 
  GraduationCap,
  ChevronRight,
  Pencil,
  Trash2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { Course } from "@/types";

export default function CoursesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newCourse, setNewCourse] = useState({
    name: "",
    code: "",
    semester: "",
    description: "",
  });

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      const response = await fetch("/api/courses");
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to fetch courses");
        return;
      }

      setCourses(data.courses);
    } catch (err) {
      setError("Failed to fetch courses");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleCreateCourse = async () => {
    if (!newCourse.name.trim() || !newCourse.code.trim() || !newCourse.semester.trim()) {
      setCreateError("Name, Code, and Semester are required");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newCourse,
          professorId: user?.id || "unknown",
          professorName: user?.name || "Unknown Professor",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setCreateError(data.error || "Failed to create course");
        return;
      }

      setNewCourse({ name: "", code: "", semester: "", description: "" });
      setIsCreateModalOpen(false);
      await fetchCourses();
    } catch (err) {
      setCreateError("Failed to create course");
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!deleteConfirm) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/courses/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to delete course");
        return;
      }

      setDeleteConfirm(null);
      await fetchCourses();
    } catch (err) {
      setError("Failed to delete course");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const filteredCourses = courses.filter((course) =>
    searchQuery === "" ||
    course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <p className="text-default-600">Loading courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <GraduationCap className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">My Courses</h1>
          </div>
          <p className="text-default-600">
            Create and manage your courses. Each course can contain multiple training cases.
          </p>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 mb-6">
            <p className="text-danger-700 dark:text-danger-400">{error}</p>
            <Button size="sm" variant="light" color="danger" className="mt-2" onPress={() => setError(null)}>
              Dismiss
            </Button>
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Input
            classNames={{
              base: "flex-1 max-w-md",
              inputWrapper: "bg-white dark:bg-gray-800 shadow-sm",
            }}
            placeholder="Search courses..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            startContent={<Search className="w-4 h-4 text-default-400" />}
          />
          <Button
            color="primary"
            startContent={<Plus className="w-5 h-5" />}
            onPress={() => setIsCreateModalOpen(true)}
          >
            Create Course
          </Button>
        </div>

        {/* Courses Grid */}
        {filteredCourses.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <BookOpen className="w-16 h-16 text-default-300" />
              <div>
                <h3 className="text-xl font-semibold mb-2">
                  {searchQuery ? "No courses found" : "No courses yet"}
                </h3>
                <p className="text-default-500 mb-4">
                  {searchQuery 
                    ? `No courses match "${searchQuery}"`
                    : "Create your first course to start building training cases."}
                </p>
                {!searchQuery && (
                  <Button color="primary" onPress={() => setIsCreateModalOpen(true)}>
                    Create Your First Course
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => (
              <Card
                key={course.id}
                className="hover:shadow-lg transition-shadow cursor-pointer group"
                isPressable
                onPress={() => router.push(`/courses/${course.id}`)}
              >
                <CardHeader className="flex justify-between items-start pb-2">
                  <div className="flex-1">
                    <Chip size="sm" variant="flat" color="primary" className="mb-2">
                      {course.code}
                    </Chip>
                    <h3 className="text-lg font-semibold line-clamp-2">{course.name}</h3>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push(`/courses/${course.id}`);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(course);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardBody className="pt-0">
                  {course.description && (
                    <p className="text-sm text-default-500 line-clamp-2 mb-4">
                      {course.description}
                    </p>
                  )}
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-default-500">
                      <Calendar className="w-4 h-4" />
                      <span>{course.semester}</span>
                    </div>
                    <div className="flex items-center gap-2 text-default-500">
                      <User className="w-4 h-4" />
                      <span>{course.professorName}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-default-200">
                    <span className="text-xs text-default-400">
                      Updated {getRelativeTime(course.updatedAt)}
                    </span>
                    <ChevronRight className="w-5 h-5 text-default-400 group-hover:text-primary transition-colors" />
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Course Modal */}
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
                  <GraduationCap className="w-6 h-6 text-primary" />
                  Create New Course
                </div>
              </ModalHeader>
              <ModalBody>
                {createError && (
                  <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-3 mb-4">
                    <p className="text-danger-700 dark:text-danger-400 text-sm">{createError}</p>
                  </div>
                )}
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Course Name <span className="text-danger">*</span>
                      </label>
                      <Input
                        value={newCourse.name}
                        onValueChange={(v) => setNewCourse({ ...newCourse, name: v })}
                        placeholder="e.g., Business Ethics"
                        variant="bordered"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Course Code <span className="text-danger">*</span>
                      </label>
                      <Input
                        value={newCourse.code}
                        onValueChange={(v) => setNewCourse({ ...newCourse, code: v })}
                        placeholder="e.g., MGMT 301"
                        variant="bordered"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Semester <span className="text-danger">*</span>
                    </label>
                    <Input
                      value={newCourse.semester}
                      onValueChange={(v) => setNewCourse({ ...newCourse, semester: v })}
                      placeholder="e.g., Spring 2026"
                      variant="bordered"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Description (optional)
                    </label>
                    <Textarea
                      value={newCourse.description}
                      onValueChange={(v) => setNewCourse({ ...newCourse, description: v })}
                      placeholder="Brief description of the course..."
                      variant="bordered"
                      minRows={3}
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} isDisabled={creating}>
                  Cancel
                </Button>
                <Button 
                  color="primary" 
                  onPress={handleCreateCourse}
                  isDisabled={creating || !newCourse.name.trim() || !newCourse.code.trim() || !newCourse.semester.trim()}
                  startContent={creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                >
                  {creating ? "Creating..." : "Create Course"}
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
              <ModalHeader>Delete Course</ModalHeader>
              <ModalBody>
                <p>
                  Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
                </p>
                <p className="text-sm text-danger mt-2">
                  This will also delete all cases within this course. This action cannot be undone.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} isDisabled={deleting}>
                  Cancel
                </Button>
                <Button 
                  color="danger" 
                  onPress={handleDeleteCourse}
                  isDisabled={deleting}
                  startContent={deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                >
                  {deleting ? "Deleting..." : "Delete Course"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
