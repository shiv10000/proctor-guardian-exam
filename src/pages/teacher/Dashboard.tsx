
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import examService, { Exam, ExamResult } from "@/services/ExamService";

const TeacherDashboard = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  
  useEffect(() => {
    if (currentUser) {
      // Fetch exams created by this teacher
      const teacherExams = examService.getExamsByTeacher(currentUser.id);
      setExams(teacherExams);
      
      // Fetch all results for this teacher's exams
      const allResults = examService.getAllResults();
      const teacherResults = allResults.filter(result => 
        teacherExams.some(exam => exam.id === result.examId)
      );
      setResults(teacherResults);
    }
  }, [currentUser]);

  return (
    <Layout title="Teacher Dashboard">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Your Exams</h2>
          <Button 
            onClick={() => navigate('/teacher/create-exam')}
            className="bg-proctor-primary hover:bg-proctor-secondary"
          >
            Create New Exam
          </Button>
        </div>
        
        {exams.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-6">
                <p>You haven't created any exams yet.</p>
                <Button 
                  variant="link" 
                  onClick={() => navigate('/teacher/create-exam')}
                  className="mt-2 text-proctor-primary"
                >
                  Create your first exam
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Your Exams</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Questions</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exams.map((exam) => (
                      <TableRow key={exam.id}>
                        <TableCell className="font-medium">{exam.title}</TableCell>
                        <TableCell>{exam.description.substring(0, 50)}...</TableCell>
                        <TableCell>{exam.questions.length}</TableCell>
                        <TableCell>{new Date(exam.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/teacher/results?examId=${exam.id}`)}
                          >
                            Results
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Recent Results</CardTitle>
              </CardHeader>
              <CardContent>
                {results.length === 0 ? (
                  <p className="text-center py-4">No exam results yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Exam</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Violations</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.slice(0, 5).map((result) => {
                        // Find exam for this result
                        const exam = exams.find(e => e.id === result.examId);
                        // Find student (fetching username)
                        const users = JSON.parse(localStorage.getItem('users') || '[]');
                        const student = users.find((u: any) => u.id === result.studentId);
                        
                        return (
                          <TableRow key={result.id}>
                            <TableCell className="font-medium">{exam?.title || "Unknown"}</TableCell>
                            <TableCell>{student?.username || "Unknown"}</TableCell>
                            <TableCell>
                              {result.score} / {result.totalQuestions}
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
                            <TableCell>{result.violations.length}</TableCell>
                            <TableCell className="text-right">
                              {new Date(result.endTime).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
                
                {results.length > 0 && (
                  <div className="mt-4 flex justify-end">
                    <Button 
                      variant="outline" 
                      onClick={() => navigate('/teacher/results')}
                    >
                      View All Results
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TeacherDashboard;
