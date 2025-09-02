// client/src/components/ProtectedRoute.jsx
import React, { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute() {
  const { user, loading, token, isAuthenticated, debugAuthState } = useAuth();
  
  console.log('🛡️ ProtectedRoute - user:', user, 'loading:', loading, 'token:', token ? 'Present' : 'Missing', 'isAuthenticated:', isAuthenticated);

  // Debug auth state on mount
  useEffect(() => {
    debugAuthState();
  }, [debugAuthState]);

  // while auth check ongoing, show loader
  if (loading) {
    console.log('⏳ ProtectedRoute: Still loading, showing loader...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Check if user is authenticated - be more lenient with token check
  if (!isAuthenticated || !user) {
    console.log('❌ ProtectedRoute: Not authenticated, redirecting to login...');
    return <Navigate to="/login" replace />;
  }

  // user exists and is authenticated -> render route children
  console.log('✅ ProtectedRoute: User authenticated, rendering protected content...');
  return <Outlet />;
}
