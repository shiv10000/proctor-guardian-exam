import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import examService from "@/services/ExamService";
import type { Exam as ExamType, Question } from "@/services/ExamService";
import proctorService, { ViolationEvent } from "@/services/ProctorService";
import { AlertCircle, Camera, ShieldAlert } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const Exam = () => {
  const { examId } = useParams<{ examId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [exam, setExam] = useState<ExamType | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [questionId: string]: string }>({});
  const [remainingTime, setRemainingTime] = useState(0);
  const [examStarted, setExamStarted] = useState(false);
  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const [examFailed, setExamFailed] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (examId) {
      const loadedExam = examService.getExamById(examId);
      
      if (!loadedExam) {
        toast({
          title: "Exam Not Found",
          description: "The requested exam could not be found.",
          variant: "destructive"
        });
        navigate('/student/dashboard');
        return;
      }
      
      setExam(loadedExam);
      setRemainingTime(loadedExam.timeLimit * 60);
    }
  }, [examId, navigate]);
  
  useEffect(() => {
    const setupCameraPreview = async () => {
      if (!videoRef.current) return;
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user"
          },
          audio: false
        });
        
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.style.transform = 'scaleX(-1)';
        
        await videoRef.current.play();
        console.log("Camera preview initialized");
        
        return () => {
          stream.getTracks().forEach(track => track.stop());
        };
      } catch (err) {
        console.error("Error in camera preview:", err);
      }
    };
    
    if (!examStarted) {
      setupCameraPreview();
    }
  }, [examStarted]);
  
  useEffect(() => {
    if (currentUser && exam) {
      const alreadyTaken = examService.hasStudentTakenExam(currentUser.id, exam.id);
      
      if (alreadyTaken) {
        toast({
          title: "Exam Already Taken",
          description: "You have already taken this exam.",
          variant: "destructive"
        });
        navigate('/student/dashboard');
      }
    }
  }, [currentUser, exam, navigate]);
  
  useEffect(() => {
    if (!examStarted || remainingTime <= 0 || examFailed) return;
    
    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleExamEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [examStarted, remainingTime, examFailed]);
  
  useEffect(() => {
    return () => {
      proctorService.stop();
    };
  }, []);
  
  const handleStartExam = async () => {
    if (!videoRef.current) {
      toast({
        title: "Camera Error",
        description: "Unable to access webcam. Camera access is required for the exam.",
        variant: "destructive"
      });
      return;
    }
    
    if (videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    const proctorInitialized = await proctorService.initialize(
      videoRef.current,
      handleViolation
    );
    
    if (!proctorInitialized) {
      toast({
        title: "Proctor Initialization Failed",
        description: "Unable to start the proctoring system. Please allow camera access.",
        variant: "destructive"
      });
      return;
    }
    
    setCameraActive(true);
    setExamStarted(true);
    startTimeRef.current = Date.now();
    
    toast({
      title: "Exam Started",
      description: "Your webcam is now being monitored. Do not switch tabs or leave the exam.",
    });
  };
  
  const handleViolation = (event: ViolationEvent) => {
    setViolations(prev => [...prev, event]);
    
    let violationDescription = "Cheating behavior detected.";
    
    switch(event.type) {
      case 'tab_switch':
        violationDescription = "You switched tabs or minimized the browser.";
        break;
      case 'browser_minimize':
        violationDescription = "You switched to another application.";
        break;
      case 'multiple_people':
        violationDescription = "Multiple people detected in camera view.";
        break;
      case 'mobile_detected':
        violationDescription = "Mobile device usage detected.";
        break;
      case 'looking_away':
        violationDescription = "Looking away from screen detected.";
        break;
      default:
        violationDescription = "Suspicious behavior detected.";
    }
    
    toast({
      title: "Violation Detected",
      description: violationDescription,
      variant: "destructive",
    });
    
    if (!examFailed) {
      setExamFailed(true);
      setTimeout(() => {
        handleExamEnd();
      }, 2000);
    }
  };
  
  const handleExamEnd = () => {
    if (!currentUser || !exam) return;
    
    proctorService.stop();
    setCameraActive(false);
    
    let score = 0;
    if (!examFailed) {
      exam.questions.forEach(question => {
        if (answers[question.id] === question.correctOptionId) {
          score++;
        }
      });
    }
    
    const examResult = examService.saveExamResult({
      examId: exam.id,
      studentId: currentUser.id,
      score: examFailed ? 0 : score,
      totalQuestions: exam.questions.length,
      answers,
      violations: [...violations, ...proctorService.getViolations()],
      startTime: startTimeRef.current || Date.now(),
      endTime: Date.now(),
      status: examFailed ? 'failed' : 'completed'
    });
    
    if (examFailed) {
      toast({
        title: "Exam Failed",
        description: "Your exam was terminated due to detected violations.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Exam Completed",
        description: `Your score: ${score}/${exam.questions.length}`,
      });
    }
    
    setTimeout(() => {
      navigate('/student/results');
    }, 2000);
  };
  
  const handleAnswerChange = (questionId: string, optionId: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionId
    }));
  };
  
  const goToNextQuestion = () => {
    if (!exam) return;
    setCurrentQuestionIndex(prev => Math.min(prev + 1, exam.questions.length - 1));
  };
  
  const goToPreviousQuestion = () => {
    setCurrentQuestionIndex(prev => Math.max(prev - 1, 0));
  };
  
  const currentQuestion = exam?.questions[currentQuestionIndex];
  
  return (
    <Layout title={`Exam: ${exam?.title || 'Loading...'}`} showLogout={false}>
      <div className="space-y-6 pb-10">
        {examFailed && (
          <Alert variant="destructive" className="mb-4 animate-pulse">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Exam Failed</AlertTitle>
            <AlertDescription>
              Cheating behavior has been detected. The exam has been terminated.
            </AlertDescription>
          </Alert>
        )}
        
        {!examStarted ? (
          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="text-center">Ready to Begin?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {exam && (
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">Exam: {exam.title}</h2>
                  <p>{exam.description}</p>
                  
                  <div className="space-y-1">
                    <p><strong>Time Limit:</strong> {exam.timeLimit} minutes</p>
                    <p><strong>Questions:</strong> {exam.questions.length}</p>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
                    <h3 className="font-medium text-yellow-800 mb-2">⚠️ AI Proctoring Warning</h3>
                    <p className="text-sm text-yellow-700">
                      This exam is proctored by AI. The following actions will result in immediate exam termination:
                    </p>
                    <ul className="list-disc list-inside text-sm text-yellow-700 mt-2 space-y-1">
                      <li>Switching browser tabs or windows</li>
                      <li>Minimizing the browser</li>
                      <li>Having multiple people in camera view</li>
                      <li>Using mobile phones or other devices</li>
                      <li>Looking away from the screen repeatedly</li>
                    </ul>
                  </div>
                  
                  <div className="border p-4 rounded-md">
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <Camera className="h-4 w-4" /> Camera Preview
                    </h3>
                    <div className="relative aspect-video bg-slate-100 overflow-hidden rounded">
                      <video 
                        ref={videoRef} 
                        className="absolute inset-0 w-full h-full object-cover"
                        autoPlay
                        playsInline
                        muted
                        style={{ transform: 'scaleX(-1)' }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Camera access is required. Please allow camera permissions when prompted.
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex justify-center pt-4">
                <Button
                  onClick={handleStartExam}
                  className="bg-proctor-primary hover:bg-proctor-secondary"
                  size="lg"
                >
                  Start Exam
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="relative">
            {/* Timer and Progress */}
            <div className="bg-white sticky top-0 z-10 p-4 border-b mb-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <span className="font-medium">Question {currentQuestionIndex + 1} of {exam?.questions.length}</span>
                </div>
                <div className={`font-mono text-lg font-bold ${remainingTime < 60 ? 'text-red-600' : 'text-gray-700'}`}>
                  {formatTime(remainingTime)}
                </div>
              </div>
              <Progress value={(currentQuestionIndex + 1) / (exam?.questions.length || 1) * 100} />
            </div>
            
            {/* Question */}
            {currentQuestion && (
              <Card className="max-w-3xl mx-auto mb-4">
                <CardContent className="pt-6 pb-6">
                  <h2 className="text-xl font-medium mb-6">{currentQuestion.text}</h2>
                  
                  <RadioGroup
                    value={answers[currentQuestion.id] || ""}
                    onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                    className="space-y-3"
                  >
                    {currentQuestion.options.map((option) => (
                      <div key={option.id} className="flex items-center space-x-2 border p-3 rounded-md hover:bg-slate-50">
                        <RadioGroupItem value={option.id} id={option.id} />
                        <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                          {option.text}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
            )}
            
            {/* Navigation buttons */}
            <div className="flex justify-between max-w-3xl mx-auto">
              <Button
                variant="outline"
                onClick={goToPreviousQuestion}
                disabled={currentQuestionIndex === 0}
              >
                Previous
              </Button>
              
              {currentQuestionIndex === (exam?.questions.length || 0) - 1 ? (
                <Button 
                  onClick={handleExamEnd}
                  className="bg-proctor-success hover:bg-green-700"
                >
                  Submit Exam
                </Button>
              ) : (
                <Button
                  className="bg-proctor-primary hover:bg-proctor-secondary"
                  onClick={goToNextQuestion}
                >
                  Next
                </Button>
              )}
            </div>
            
            {/* Webcam monitor */}
            {cameraActive && (
              <div className="fixed bottom-4 right-4 w-64 rounded-md overflow-hidden border-2 border-proctor-primary shadow-lg">
                <div className="bg-proctor-primary text-white px-2 py-1 text-xs font-medium flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" /> Proctoring Active
                  </span>
                  <span className="animate-pulse">●</span>
                </div>
                <video 
                  ref={videoRef}
                  className="w-full aspect-video object-cover bg-black"
                  autoPlay
                  playsInline
                  muted
                  style={{ transform: 'scaleX(-1)' }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Exam;
