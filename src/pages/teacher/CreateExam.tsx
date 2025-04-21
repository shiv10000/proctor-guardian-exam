
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Question, Option } from "@/services/ExamService";
import { Trash } from "lucide-react";
import examService from "@/services/ExamService";

const CreateExam = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeLimit, setTimeLimit] = useState(30); // Default 30 minutes
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: "1",
      text: "",
      options: [
        { id: "1", text: "" },
        { id: "2", text: "" },
        { id: "3", text: "" },
        { id: "4", text: "" }
      ],
      correctOptionId: "1"
    }
  ]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const addQuestion = () => {
    const newQuestionId = (questions.length + 1).toString();
    setQuestions([
      ...questions,
      {
        id: newQuestionId,
        text: "",
        options: [
          { id: `${newQuestionId}-1`, text: "" },
          { id: `${newQuestionId}-2`, text: "" },
          { id: `${newQuestionId}-3`, text: "" },
          { id: `${newQuestionId}-4`, text: "" }
        ],
        correctOptionId: `${newQuestionId}-1`
      }
    ]);
  };
  
  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    } else {
      toast({
        title: "Cannot Remove",
        description: "An exam must have at least one question.",
        variant: "destructive"
      });
    }
  };
  
  const updateQuestionText = (index: number, text: string) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index].text = text;
    setQuestions(updatedQuestions);
  };
  
  const updateOptionText = (questionIndex: number, optionIndex: number, text: string) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].options[optionIndex].text = text;
    setQuestions(updatedQuestions);
  };
  
  const setCorrectOption = (questionIndex: number, optionId: string) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].correctOptionId = optionId;
    setQuestions(updatedQuestions);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate the exam
    if (!title) {
      toast({
        title: "Missing Title",
        description: "Please provide a title for your exam.",
        variant: "destructive"
      });
      return;
    }
    
    if (!description) {
      toast({
        title: "Missing Description",
        description: "Please provide a description for your exam.",
        variant: "destructive"
      });
      return;
    }
    
    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      if (!question.text) {
        toast({
          title: "Incomplete Question",
          description: `Question ${i + 1} is missing text.`,
          variant: "destructive"
        });
        return;
      }
      
      // Validate each option
      for (let j = 0; j < question.options.length; j++) {
        if (!question.options[j].text) {
          toast({
            title: "Incomplete Options",
            description: `Option ${j + 1} for Question ${i + 1} is missing text.`,
            variant: "destructive"
          });
          return;
        }
      }
    }
    
    setIsSubmitting(true);
    
    try {
      if (!currentUser) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to create an exam.",
          variant: "destructive"
        });
        return;
      }
      
      // Create the exam
      const newExam = examService.createExam({
        title,
        description,
        teacherId: currentUser.id,
        questions,
        timeLimit
      });
      
      toast({
        title: "Exam Created",
        description: "Your exam has been created successfully."
      });
      
      navigate('/teacher/dashboard');
    } catch (error) {
      console.error("Error creating exam:", error);
      toast({
        title: "Error",
        description: "Failed to create the exam. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Layout title="Create Exam">
      <div className="space-y-6 pb-10">
        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Exam Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Exam Title</Label>
                <Input
                  id="title"
                  placeholder="Enter exam title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this exam is about"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
                <Input
                  id="timeLimit"
                  type="number"
                  min="5"
                  max="180"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                  required
                />
              </div>
            </CardContent>
          </Card>
          
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Questions</h2>
              <Button 
                type="button" 
                onClick={addQuestion}
                variant="outline"
              >
                Add Question
              </Button>
            </div>
            
            {questions.map((question, qIndex) => (
              <Card key={question.id} className="question-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg">Question {qIndex + 1}</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestion(qIndex)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`question-${qIndex}`}>Question Text</Label>
                    <Textarea
                      id={`question-${qIndex}`}
                      placeholder="Enter your question"
                      value={question.text}
                      onChange={(e) => updateQuestionText(qIndex, e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <Label>Options (Select the correct answer)</Label>
                    {question.options.map((option, oIndex) => (
                      <div key={option.id} className="flex gap-2 items-center">
                        <input
                          type="radio"
                          id={`option-${qIndex}-${oIndex}`}
                          name={`correct-${qIndex}`}
                          checked={question.correctOptionId === option.id}
                          onChange={() => setCorrectOption(qIndex, option.id)}
                          className="w-4 h-4"
                          required
                        />
                        <Input
                          placeholder={`Option ${oIndex + 1}`}
                          value={option.text}
                          onChange={(e) => updateOptionText(qIndex, oIndex, e.target.value)}
                          className={question.correctOptionId === option.id ? "border-proctor-primary" : ""}
                          required
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            <CardFooter className="flex justify-end space-x-4 pt-6">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => navigate('/teacher/dashboard')}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-proctor-primary hover:bg-proctor-secondary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create Exam"}
              </Button>
            </CardFooter>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default CreateExam;
