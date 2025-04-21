
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/components/ui/use-toast';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: 'teacher' | 'student';
}

const ProtectedRoute = ({ children, allowedRole }: ProtectedRouteProps) => {
  const { currentUser, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (!currentUser) {
        toast({
          title: "Authentication Required",
          description: "Please log in to access this page",
          variant: "destructive",
        });
        navigate('/login');
      } else if (currentUser.role !== allowedRole) {
        toast({
          title: "Access Denied",
          description: `This page is only accessible to ${allowedRole}s`,
          variant: "destructive",
        });
        navigate('/');
      }
    }
  }, [currentUser, navigate, allowedRole, isLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-proctor-primary"></div>
      </div>
    );
  }

  // If user is authenticated and authorized, render children
  if (currentUser && currentUser.role === allowedRole) {
    return <>{children}</>;
  }

  // This will briefly show while redirecting
  return null;
};

export default ProtectedRoute;
