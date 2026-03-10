"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { title } from "@/components/primitives";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import { Search, X, Users, User } from "lucide-react";
import {
  searchSections,
  searchStudents,
  searchCases,
  TIME_RANGE_OPTIONS,
  type CourseSection,
  type Student,
  type Case,
  type TimeRangeOption,
} from "@/lib/student-history-service";

type ViewMode = "class" | "individual";

interface AutocompleteInputProps<T> {
  label: string;
  placeholder: string;
  value: T | null;
  onSelect: (item: T | null) => void;
  searchFn: (query: string) => Promise<T[]>;
  getDisplayValue: (item: T) => string;
  getKey: (item: T) => string;
  disabled?: boolean;
  dependencyKey?: string;
}

function AutocompleteInput<T>({
  label,
  placeholder,
  value,
  onSelect,
  searchFn,
  getDisplayValue,
  getKey,
  disabled = false,
  dependencyKey,
}: AutocompleteInputProps<T>) {
  const [inputValue, setInputValue] = useState("");
  const [options, setOptions] = useState<T[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value) {
      setInputValue(getDisplayValue(value));
    } else {
      setInputValue("");
    }
  }, [value, getDisplayValue]);

  useEffect(() => {
    setInputValue("");
    onSelect(null);
  }, [dependencyKey]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = useCallback(
    async (query: string) => {
      if (query.length < 1) {
        setOptions([]);
        return;
      }

      setIsLoading(true);
      try {
        const results = await searchFn(query);
        setOptions(results);
      } catch (error) {
        console.error("Search error:", error);
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [searchFn]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);

    if (value && newValue !== getDisplayValue(value)) {
      onSelect(null);
    }

    handleSearch(newValue);
  };

  const handleSelect = (item: T) => {
    onSelect(item);
    setInputValue(getDisplayValue(item));
    setIsOpen(false);
  };

  const handleClear = () => {
    setInputValue("");
    onSelect(null);
    setOptions([]);
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    setIsOpen(true);
    if (inputValue.length >= 1) {
      handleSearch(inputValue);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          label={label}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          disabled={disabled}
          startContent={<Search size={16} className="text-default-400" />}
          endContent={
            inputValue && !disabled ? (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 hover:bg-default-100 rounded-full transition-colors"
              >
                <X size={14} className="text-default-400" />
              </button>
            ) : null
          }
          classNames={{
            inputWrapper: value
              ? "border-success bg-success-50 dark:bg-success-900/20"
              : "",
          }}
        />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-content1 border border-default-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="p-4 flex justify-center">
              <Spinner size="sm" />
            </div>
          ) : options.length > 0 ? (
            <ul className="py-1">
              {options.map((item) => (
                <li
                  key={getKey(item)}
                  onClick={() => handleSelect(item)}
                  className="px-4 py-2 hover:bg-default-100 cursor-pointer transition-colors"
                >
                  {getDisplayValue(item)}
                </li>
              ))}
            </ul>
          ) : inputValue.length >= 1 ? (
            <div className="p-4 text-center text-default-500 text-sm">
              No results found
            </div>
          ) : (
            <div className="p-4 text-center text-default-500 text-sm">
              Type to search...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClassOverviewTab() {
  const router = useRouter();
  const [selectedSection, setSelectedSection] = useState<CourseSection | null>(null);

  const searchSectionsWrapper = useCallback(async (query: string) => {
    return searchSections(query);
  }, []);

  const handleViewClass = () => {
    if (!selectedSection) return;
    router.push(`/teacher/class/${selectedSection.id}`);
  };

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users size={20} className="text-primary" />
          <span className="font-semibold">Class Overview</span>
        </div>
      </CardHeader>
      <CardBody className="gap-6 p-6">
        <p className="text-default-600 text-sm">
          Select a class to view the gradebook and performance overview for all students.
        </p>
        
        <AutocompleteInput
          label="Course / Section"
          placeholder="Search for a course or section..."
          value={selectedSection}
          onSelect={setSelectedSection}
          searchFn={searchSectionsWrapper}
          getDisplayValue={(s) => `${s.code} - ${s.name}`}
          getKey={(s) => s.id}
        />

        <Button
          color="primary"
          size="lg"
          className="w-full"
          isDisabled={!selectedSection}
          onPress={handleViewClass}
        >
          View Class Dashboard
        </Button>

        {!selectedSection && (
          <p className="text-center text-default-400 text-sm">
            Select a class to continue
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function IndividualStudentTab() {
  const router = useRouter();

  const [selectedSection, setSelectedSection] = useState<CourseSection | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRangeOption | null>(null);

  const isFormValid =
    selectedSection && selectedStudent && selectedCase && selectedTimeRange;

  const handleCheck = () => {
    if (!isFormValid) return;

    const url = `/student-history/${selectedSection.id}/${selectedStudent.id}/${selectedCase.id}?range=${selectedTimeRange}`;
    router.push(url);
  };

  const searchSectionsWrapper = useCallback(async (query: string) => {
    return searchSections(query);
  }, []);

  const searchStudentsWrapper = useCallback(
    async (query: string) => {
      return searchStudents(query, selectedSection?.id);
    },
    [selectedSection?.id]
  );

  const searchCasesWrapper = useCallback(
    async (query: string) => {
      return searchCases(query, selectedSection?.id);
    },
    [selectedSection?.id]
  );

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <User size={20} className="text-primary" />
          <span className="font-semibold">Individual Student Lookup</span>
        </div>
      </CardHeader>
      <CardBody className="gap-6 p-6">
        <p className="text-default-600 text-sm">
          Search for a specific student to view their detailed performance history.
        </p>
        
        <div className="space-y-4">
          <AutocompleteInput
            label="Course / Section"
            placeholder="Search for a course or section..."
            value={selectedSection}
            onSelect={setSelectedSection}
            searchFn={searchSectionsWrapper}
            getDisplayValue={(s) => `${s.code} - ${s.name}`}
            getKey={(s) => s.id}
          />

          <AutocompleteInput
            label="Student"
            placeholder={
              selectedSection
                ? "Search for a student..."
                : "Select a course first"
            }
            value={selectedStudent}
            onSelect={setSelectedStudent}
            searchFn={searchStudentsWrapper}
            getDisplayValue={(s) => `${s.name} (${s.studentNumber})`}
            getKey={(s) => s.id}
            disabled={!selectedSection}
            dependencyKey={selectedSection?.id}
          />

          <AutocompleteInput
            label="Case"
            placeholder={
              selectedSection
                ? "Search for a case..."
                : "Select a course first"
            }
            value={selectedCase}
            onSelect={setSelectedCase}
            searchFn={searchCasesWrapper}
            getDisplayValue={(c) => c.name}
            getKey={(c) => c.id}
            disabled={!selectedSection}
            dependencyKey={selectedSection?.id}
          />

          <Select
            label="Time Range"
            placeholder="Select a time range"
            selectedKeys={selectedTimeRange ? [selectedTimeRange] : []}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as TimeRangeOption;
              setSelectedTimeRange(value || null);
            }}
          >
            {TIME_RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value}>{option.label}</SelectItem>
            ))}
          </Select>
        </div>

        <Button
          color="primary"
          size="lg"
          className="w-full"
          isDisabled={!isFormValid}
          onPress={handleCheck}
        >
          View Student History
        </Button>

        {!isFormValid && (
          <p className="text-center text-default-400 text-sm">
            Please fill in all fields to continue
          </p>
        )}
      </CardBody>
    </Card>
  );
}

export default function StudentHistoryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("class");

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h1 className={title()}>Student History</h1>
        <p className="text-default-600 mt-2">
          Review student performance across courses and cases
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-lg bg-default-100 p-1">
          <button
            onClick={() => setViewMode("class")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === "class"
                ? "bg-background text-foreground shadow-sm"
                : "text-default-600 hover:text-foreground"
            }`}
          >
            <Users size={16} />
            <span>Class Overview</span>
          </button>
          <button
            onClick={() => setViewMode("individual")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === "individual"
                ? "bg-background text-foreground shadow-sm"
                : "text-default-600 hover:text-foreground"
            }`}
          >
            <User size={16} />
            <span>Individual Student</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {viewMode === "class" ? <ClassOverviewTab /> : <IndividualStudentTab />}
    </div>
  );
}
