
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";

const Index = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  return (
    <Layout title="AI Proctor Mode" showLogout={!!currentUser}>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)]">
        <div className="w-full max-w-3xl text-center space-y-6">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Welcome to AI Proctor Mode
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            An advanced online examination system with AI-powered proctoring to maintain academic integrity during remote exams.
          </p>
          
          {currentUser ? (
            <div className="mt-10 flex justify-center gap-4">
              {currentUser.role === 'teacher' ? (
                <Button 
                  onClick={() => navigate('/teacher/dashboard')}
                  className="bg-proctor-primary hover:bg-proctor-secondary"
                  size="lg"
                >
                  Teacher Dashboard
                </Button>
              ) : (
                <Button 
                  onClick={() => navigate('/student/dashboard')}
                  className="bg-proctor-primary hover:bg-proctor-secondary"
                  size="lg"
                >
                  Student Dashboard
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-10 flex justify-center flex-wrap gap-4">
              <Button 
                onClick={() => navigate('/login')}
                className="bg-proctor-primary hover:bg-proctor-secondary"
                size="lg"
              >
                Login
              </Button>
              <Button 
                onClick={() => navigate('/register')}
                variant="outline"
                size="lg"
              >
                Register
              </Button>
            </div>
          )}
        </div>
        
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
          <Card>
            <CardHeader>
              <CardTitle>For Teachers</CardTitle>
              <CardDescription>Create and manage examinations</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Create custom question papers, view student results, and track cheating incidents.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>For Students</CardTitle>
              <CardDescription>Take exams with AI monitoring</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Access your exams and get results instantly after completion.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>AI Proctoring</CardTitle>
              <CardDescription>Advanced monitoring features</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Detects tab switching, multiple people, mobile devices, and suspicious movements.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Index;
