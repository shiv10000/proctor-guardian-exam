
// This service manages the exam data

export interface Option {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  text: string;
  options: Option[];
  correctOptionId: string;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  questions: Question[];
  timeLimit: number; // in minutes
  createdAt: number;
}

export interface ExamResult {
  id: string;
  examId: string;
  studentId: string;
  score: number;
  totalQuestions: number;
  answers: { [questionId: string]: string };
  violations: {
    type: string;
    timestamp: number;
    details?: string;
  }[];
  startTime: number;
  endTime: number;
  status: 'completed' | 'failed' | 'in-progress';
}

const EXAMS_STORAGE_KEY = 'proctorAppExams';
const RESULTS_STORAGE_KEY = 'proctorAppResults';

class ExamService {
  // Get all exams
  getAllExams(): Exam[] {
    const examsData = localStorage.getItem(EXAMS_STORAGE_KEY);
    return examsData ? JSON.parse(examsData) : [];
  }

  // Get exams by teacher ID
  getExamsByTeacher(teacherId: string): Exam[] {
    const allExams = this.getAllExams();
    return allExams.filter(exam => exam.teacherId === teacherId);
  }

  // Get available exams for students
  getAvailableExamsForStudent(): Exam[] {
    return this.getAllExams();
  }

  // Get a single exam by ID
  getExamById(examId: string): Exam | null {
    const allExams = this.getAllExams();
    return allExams.find(exam => exam.id === examId) || null;
  }

  // Create a new exam
  createExam(exam: Omit<Exam, 'id' | 'createdAt'>): Exam {
    const allExams = this.getAllExams();
    
    const newExam: Exam = {
      ...exam,
      id: Date.now().toString(),
      createdAt: Date.now()
    };
    
    allExams.push(newExam);
    localStorage.setItem(EXAMS_STORAGE_KEY, JSON.stringify(allExams));
    
    return newExam;
  }

  // Update an exam
  updateExam(examId: string, updates: Partial<Exam>): Exam | null {
    const allExams = this.getAllExams();
    const examIndex = allExams.findIndex(exam => exam.id === examId);
    
    if (examIndex === -1) return null;
    
    const updatedExam = { ...allExams[examIndex], ...updates };
    allExams[examIndex] = updatedExam;
    
    localStorage.setItem(EXAMS_STORAGE_KEY, JSON.stringify(allExams));
    return updatedExam;
  }

  // Delete an exam
  deleteExam(examId: string): boolean {
    const allExams = this.getAllExams();
    const filteredExams = allExams.filter(exam => exam.id !== examId);
    
    if (filteredExams.length === allExams.length) return false;
    
    localStorage.setItem(EXAMS_STORAGE_KEY, JSON.stringify(filteredExams));
    return true;
  }

  // Get all exam results
  getAllResults(): ExamResult[] {
    const resultsData = localStorage.getItem(RESULTS_STORAGE_KEY);
    return resultsData ? JSON.parse(resultsData) : [];
  }

  // Get results for a specific exam
  getResultsForExam(examId: string): ExamResult[] {
    const allResults = this.getAllResults();
    return allResults.filter(result => result.examId === examId);
  }

  // Get results for a specific student
  getResultsForStudent(studentId: string): ExamResult[] {
    const allResults = this.getAllResults();
    return allResults.filter(result => result.studentId === studentId);
  }

  // Save an exam result
  saveExamResult(result: Omit<ExamResult, 'id'>): ExamResult {
    const allResults = this.getAllResults();
    
    const newResult: ExamResult = {
      ...result,
      id: Date.now().toString()
    };
    
    allResults.push(newResult);
    localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(allResults));
    
    return newResult;
  }

  // Check if student has already taken an exam
  hasStudentTakenExam(studentId: string, examId: string): boolean {
    const allResults = this.getAllResults();
    return allResults.some(
      result => result.studentId === studentId && 
      result.examId === examId
    );
  }

  // Get a single result by ID
  getResultById(resultId: string): ExamResult | null {
    const allResults = this.getAllResults();
    return allResults.find(result => result.id === resultId) || null;
  }
}

// Create a singleton instance
const examService = new ExamService();
export default examService;
