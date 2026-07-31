import type { AcademicOpsInput, AcademicOpsViewModel } from "./types";

export function buildAcademicOpsViewModel(input: AcademicOpsInput): AcademicOpsViewModel {
  const books = input.books.filter((book) => !book.archivedAt);
  const activeStudents = input.students.filter((student) => student.status === "active").length;
  const activeClasses = input.classes.filter((course) => course.status === "active").length;
  const pendingGrades = input.assignments.reduce(
    (sum, assignment) => sum + Math.max(0, assignment.submissionCount - assignment.gradedCount),
    0
  );
  const gradedSubmissions = input.assignments.reduce((sum, assignment) => sum + assignment.gradedCount, 0);
  const totalSubmissions = input.assignments.reduce((sum, assignment) => sum + assignment.submissionCount, 0);
  const dueFlashcards = input.flashcards.filter((card) => new Date(card.nextReviewAt).getTime() <= Date.now()).length;
  const studyMinutes = input.studySessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const activeGoals = input.learningGoals.filter((goal) => goal.status === "active");
  const mastery = Math.round(
    activeGoals.reduce((sum, goal) => sum + goal.progress, 0) / Math.max(1, activeGoals.length)
  );

  return {
    metrics: {
      activeBooks: books.length,
      activeStudents,
      activeClasses,
      pendingGrades,
      gradedSubmissions,
      totalSubmissions,
      dueFlashcards,
      studyMinutes,
      activeGoals: activeGoals.length,
      mastery
    },
    books,
    classes: input.classes,
    assignments: input.assignments,
    quizzes: input.quizzes,
    students: input.students,
    goals: input.learningGoals,
    notes: input.learningNotes,
    flashcards: input.flashcards,
    sessions: input.studySessions,
    knowledgeSources: input.knowledgeSources
  };
}
