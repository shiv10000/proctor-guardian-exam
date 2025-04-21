
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  showLogout?: boolean;
}

const Layout = ({ children, title, showLogout = true }: LayoutProps) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-proctor-primary">{title}</h1>
          <div className="flex items-center space-x-4">
            {currentUser && (
              <span className="text-sm font-medium text-gray-700">
                {currentUser.username} ({currentUser.role})
              </span>
            )}
            {showLogout && currentUser && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleLogout}
              >
                Logout
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            AI Proctor Mode &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
