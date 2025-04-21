
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
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

const Results = () => {
  const { currentUser } = useAuth();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedResult, setSelectedResult] = useState<ExamResult | null>(null);
  
  useEffect(() => {
    if (currentUser) {
      const userResults = examService.getResultsForStudent(currentUser.id);
      setResults(userResults);
      
      const allExams = examService.getAllExams();
      setExams(allExams);
    }
  }, [currentUser]);
  
  // Get exam title from ID
  const getExamTitle = (examId: string): string => {
    const exam = exams.find(e => e.id === examId);
    return exam?.title || "Unknown Exam";
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
    <Layout title="Your Results">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Exam Results</CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="text-center py-6">You haven't taken any exams yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date Taken</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell className="font-medium">{getExamTitle(result.examId)}</TableCell>
                      <TableCell>
                        {result.score} / {result.totalQuestions} ({((result.score / result.totalQuestions) * 100).toFixed(1)}%)
                      </TableCell>
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
                      <TableCell>{new Date(result.endTime).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <button 
                          className="text-proctor-primary hover:underline text-sm"
                          onClick={() => setSelectedResult(result)}
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
                Result Details - {getExamTitle(selectedResult.examId)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded">
                    <div className="text-sm font-medium text-gray-500">Exam</div>
                    <div className="mt-1">{getExamTitle(selectedResult.examId)}</div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded">
                    <div className="text-sm font-medium text-gray-500">Date Taken</div>
                    <div className="mt-1">{new Date(selectedResult.endTime).toLocaleDateString()}</div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded">
                    <div className="text-sm font-medium text-gray-500">Score</div>
                    <div className="mt-1">
                      {selectedResult.score} out of {selectedResult.totalQuestions} ({((selectedResult.score / selectedResult.totalQuestions) * 100).toFixed(1)}%)
                    </div>
                  </div>
                </div>
                
                {/* Status info */}
                <div className="p-4 rounded-md border">
                  <h3 className="text-lg font-medium mb-2">Exam Status</h3>
                  {selectedResult.status === 'completed' ? (
                    <div className="text-green-600">
                      <p>You completed this exam successfully.</p>
                    </div>
                  ) : (
                    <div className="text-red-600">
                      <p>This exam was failed due to detected violations.</p>
                      {selectedResult.violations.length > 0 && (
                        <div className="mt-2">
                          <h4 className="font-medium">Violations:</h4>
                          <ul className="list-disc list-inside mt-1">
                            {selectedResult.violations.map((violation, index) => (
                              <li key={index}>
                                {formatViolationType(violation.type)} at {new Date(violation.timestamp).toLocaleTimeString()}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Answers */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Your Answers</h3>
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
                                <span className="font-medium">Your Answer: </span>
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

export default Results;
