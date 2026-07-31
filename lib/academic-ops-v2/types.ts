import type {
  Assignment,
  BookRecord,
  CourseClass,
  Flashcard,
  KnowledgeSource,
  LearningGoal,
  LearningNote,
  Quiz,
  Student,
  StudySession
} from "@/types/domain";

export type AcademicOpsMetric = {
  label: string;
  value: string;
  note: string;
  tone?: "default" | "success" | "warning" | "info";
};

export type AcademicOpsViewModel = {
  metrics: {
    activeBooks: number;
    activeStudents: number;
    activeClasses: number;
    pendingGrades: number;
    gradedSubmissions: number;
    totalSubmissions: number;
    dueFlashcards: number;
    studyMinutes: number;
    activeGoals: number;
    mastery: number;
  };
  books: BookRecord[];
  classes: CourseClass[];
  assignments: Assignment[];
  quizzes: Quiz[];
  students: Student[];
  goals: LearningGoal[];
  notes: LearningNote[];
  flashcards: Flashcard[];
  sessions: StudySession[];
  knowledgeSources: KnowledgeSource[];
};

export type AcademicOpsInput = {
  books: BookRecord[];
  classes: CourseClass[];
  assignments: Assignment[];
  quizzes: Quiz[];
  students: Student[];
  learningGoals: LearningGoal[];
  learningNotes: LearningNote[];
  flashcards: Flashcard[];
  studySessions: StudySession[];
  knowledgeSources: KnowledgeSource[];
};

export type AcademicOpsEventName =
  | "academic_dashboard_opened"
  | "academic_goal_created"
  | "academic_assignment_created"
  | "academic_assignment_graded"
  | "academic_class_created"
  | "academic_quiz_created"
  | "academic_flashcard_reviewed"
  | "academic_library_opened"
  | "academic_knowledge_source_created"
  | "academic_automation_toggled"
  | "academic_class_matrix_opened"
  | "academic_feedback_resolved"
  | "academic_processing_job_created"
  | "academic_review_status_changed"
  | "academic_student_access_opened";
