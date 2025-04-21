
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import examService, { Exam, ExamResult } from "@/services/ExamService";

const StudentDashboard = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [availableExams, setAvailableExams] = useState<Exam[]>([]);
  const [takenExams, setTakenExams] = useState<ExamResult[]>([]);
  
  useEffect(() => {
    if (currentUser) {
      // Get all available exams
      const exams = examService.getAvailableExamsForStudent();
      setAvailableExams(exams);
      
      // Get exams this student has taken
      const results = examService.getResultsForStudent(currentUser.id);
      setTakenExams(results);
    }
  }, [currentUser]);
  
  // Filter exams that haven't been taken yet
  const examsToBeTaken = availableExams.filter(exam => 
    !takenExams.some(result => result.examId === exam.id)
  );

  // Get exam title by ID
  const getExamTitle = (examId: string) => {
    const exam = availableExams.find(e => e.id === examId);
    return exam?.title || "Unknown Exam";
  };
  
  return (
    <Layout title="Student Dashboard">
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Available Exams</h2>
        
        {examsToBeTaken.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-6">
                <p>No new exams available right now.</p>
                <p className="text-sm text-gray-500 mt-1">
                  Check back later for new exams.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {examsToBeTaken.map((exam) => (
              <Card key={exam.id} className="flex flex-col justify-between">
                <CardHeader>
                  <CardTitle>{exam.title}</CardTitle>
                  <CardDescription>
                    Time limit: {exam.timeLimit} minutes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    {exam.description}
                  </p>
                  <p className="text-sm mt-2 font-medium">
                    {exam.questions.length} questions
                  </p>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full bg-proctor-primary hover:bg-proctor-secondary"
                    onClick={() => navigate(`/student/exam/${exam.id}`)}
                  >
                    Start Exam
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
        
        <div className="mt-10">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Your Results</h2>
            <Button
              variant="outline"
              onClick={() => navigate('/student/results')}
            >
              View All Results
            </Button>
          </div>
          
          {takenExams.length === 0 ? (
            <Card className="mt-4">
              <CardContent className="pt-6">
                <div className="text-center py-6">
                  <p>You haven't taken any exams yet.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 mt-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {takenExams.slice(0, 3).map((result) => (
                      <div
                        key={result.id}
                        className="flex justify-between items-center p-4 border rounded-md"
                      >
                        <div>
                          <h3 className="font-medium">{getExamTitle(result.examId)}</h3>
                          <p className="text-sm text-gray-600">
                            Taken on {new Date(result.endTime).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            result.status === 'completed' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {result.status === 'completed' ? 'Completed' : 'Failed'}
                          </span>
                          <span className="font-medium">
                            {result.score}/{result.totalQuestions}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {takenExams.length > 3 && (
                    <div className="flex justify-center mt-4">
                      <Button 
                        variant="link" 
                        className="text-proctor-primary"
                        onClick={() => navigate('/student/results')}
                      >
                        View all {takenExams.length} results
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default StudentDashboard;
