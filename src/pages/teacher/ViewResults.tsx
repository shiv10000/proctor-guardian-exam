
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import examService, { Exam, ExamResult } from "@/services/ExamService";

const ViewResults = () => {
  const [searchParams] = useSearchParams();
  const examIdParam = searchParams.get('examId');
  
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [selectedResult, setSelectedResult] = useState<ExamResult | null>(null);
  
  // Load all exams and filter results based on URL param
  useEffect(() => {
    const teacherExams = examService.getAllExams();
    setExams(teacherExams);
    
    if (examIdParam) {
      const exam = teacherExams.find(e => e.id === examIdParam);
      if (exam) {
        setSelectedExam(exam);
        const examResults = examService.getResultsForExam(examIdParam);
        setResults(examResults);
      }
    } else {
      // Load all results for all exams
      const allResults = examService.getAllResults();
      setResults(allResults);
    }
  }, [examIdParam]);
  
  // Get username from user ID
  const getUsernameById = (userId: string) => {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find((u: any) => u.id === userId);
    return user?.username || "Unknown";
  };
  
  // Get exam title from exam ID
  const getExamTitleById = (examId: string) => {
    const exam = exams.find(e => e.id === examId);
    return exam?.title || "Unknown";
  };
  
  // Format violation types for display
  const formatViolationType = (type: string): string => {
    switch (type) {
      case 'tab_switch': return 'Tab Switching';
      case 'browser_minimize': return 'Browser Minimized';
      case 'multiple_people': return 'Multiple People';
      case 'mobile_detected': return 'Mobile Device';
      case 'looking_away': return 'Looking Away';
      default: return 'Other Violation';
    }
  };
  
  return (
    <Layout title="Exam Results">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedExam 
                ? `Results for: ${selectedExam.title}` 
                : "All Exam Results"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="text-center py-6">No results available.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {!selectedExam && <TableHead>Exam</TableHead>}
                    <TableHead>Student</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Violations</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result) => (
                    <TableRow key={result.id}>
                      {!selectedExam && <TableCell>{getExamTitleById(result.examId)}</TableCell>}
                      <TableCell className="font-medium">{getUsernameById(result.studentId)}</TableCell>
                      <TableCell>{result.score} / {result.totalQuestions}</TableCell>
                      <TableCell>
                        <span 
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            result.status === 'completed' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {result.status === 'completed' ? 'Completed' : 'Failed'}
                        </span>
                      </TableCell>
                      <TableCell>{result.violations.length}</TableCell>
                      <TableCell>{new Date(result.endTime).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <button
                          onClick={() => setSelectedResult(result)}
                          className="text-proctor-primary hover:underline text-sm"
                        >
                          View Details
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        
        {selectedResult && (
          <Card>
            <CardHeader>
              <CardTitle>
                Result Details - {getUsernameById(selectedResult.studentId)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded">
                    <div className="text-sm font-medium text-gray-500">Student</div>
                    <div className="mt-1">{getUsernameById(selectedResult.studentId)}</div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded">
                    <div className="text-sm font-medium text-gray-500">Exam</div>
                    <div className="mt-1">{getExamTitleById(selectedResult.examId)}</div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded">
                    <div className="text-sm font-medium text-gray-500">Score</div>
                    <div className="mt-1">
                      {selectedResult.score} out of {selectedResult.totalQuestions} ({((selectedResult.score / selectedResult.totalQuestions) * 100).toFixed(1)}%)
                    </div>
                  </div>
                </div>
                
                {/* Violations */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Violations</h3>
                  {selectedResult.violations.length === 0 ? (
                    <p>No violations recorded.</p>
                  ) : (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedResult.violations.map((violation, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">
                                {formatViolationType(violation.type)}
                              </TableCell>
                              <TableCell>
                                {new Date(violation.timestamp).toLocaleTimeString()}
                              </TableCell>
                              <TableCell>{violation.details || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
                
                {/* Answers */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Answers</h3>
                  <Accordion type="single" collapsible className="w-full">
                    {Object.entries(selectedResult.answers).map(([questionId, answerId]) => {
                      const exam = exams.find(e => e.id === selectedResult.examId);
                      if (!exam) return null;
                      
                      const question = exam.questions.find(q => q.id === questionId);
                      if (!question) return null;
                      
                      const selectedOption = question.options.find(o => o.id === answerId);
                      const correctOption = question.options.find(o => o.id === question.correctOptionId);
                      const isCorrect = answerId === question.correctOptionId;
                      
                      return (
                        <AccordionItem key={questionId} value={questionId}>
                          <AccordionTrigger className={`px-4 py-2 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                            {question.text}
                          </AccordionTrigger>
                          <AccordionContent className="px-4 py-2">
                            <div className="space-y-2">
                              <div>
                                <span className="font-medium">Student's Answer: </span>
                                <span className={isCorrect ? 'text-green-600' : 'text-red-600'}>
                                  {selectedOption?.text || 'Not answered'}
                                </span>
                              </div>
                              {!isCorrect && (
                                <div>
                                  <span className="font-medium">Correct Answer: </span>
                                  <span className="text-green-600">
                                    {correctOption?.text || 'Error: No correct answer defined'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default ViewResults;
