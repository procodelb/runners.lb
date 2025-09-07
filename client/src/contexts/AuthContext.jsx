// client/src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

const safeLocalGet = (k) => {
  try { return localStorage.getItem(k); } catch (e) { return null; }
};
const safeLocalSet = (k, v) => { try { localStorage.setItem(k, v); } catch(e){} };
const safeLocalRemove = (k) => { try { localStorage.removeItem(k); } catch(e){} };

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => safeLocalGet("token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Start with true to check auth on mount
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // fetch current user using token or cookies
  const fetchMe = async (tkn) => {
    console.log('🔄 fetchMe: Fetching user...');
    
    try {
      const headers = { "Content-Type": "application/json" };
      if (tkn) {
        headers.Authorization = `Bearer ${tkn}`;
      }
      
      const apiBase = 'https://soufiam-erp-backend.onrender.com';
      console.log('🌐 fetchMe: Using API base:', apiBase);
      
      const res = await fetch(`${apiBase}/api/auth/me`, {
        headers,
        credentials: 'include', // Include cookies
      });
      
      console.log('📡 fetchMe: Response status:', res.status);
      
      if (!res.ok) {
        console.log('❌ fetchMe: Response not ok');
        if (res.status === 401) {
          console.log('🔒 fetchMe: Unauthorized - clearing auth state');
          // Clear invalid authentication state
          safeLocalRemove("token");
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
        }
        return null;
      }
      
      const responseData = await res.json();
      console.log('📦 fetchMe: Raw response:', responseData);
      
      // Handle the nested response structure from server
      const data = responseData.data || responseData;
      const user = data.user || data || null;
      
      console.log('👤 fetchMe: Extracted user:', user);
      return user;
    } catch (err) {
      console.error("❌ fetchMe error:", err);
      return null;
    }
  };

  // On startup, check for existing auth (token or cookies)
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      
      try {
        // Try to fetch user with existing token or cookies
        const me = await fetchMe(token);
        
        if (mounted) {
          if (me) {
            setUser(me);
            setIsAuthenticated(true);
            console.log('✅ AuthContext: User authenticated on startup');
            // If we have a user but no token in localStorage, try to get it from cookies
            if (!token) {
              console.log('🔄 AuthContext: User found via cookies, checking for token...');
              // The token will be automatically included in subsequent requests via cookies
            }
          } else {
            // No user found and no valid authentication
            console.log('🔄 AuthContext: No user found, user needs to login');
            setUser(null);
            setIsAuthenticated(false);
            // Clear any invalid tokens
            safeLocalRemove("token");
            setToken(null);
          }
        }
      } catch (error) {
        console.error('❌ AuthContext: Error during startup auth check:', error);
        if (mounted) {
          setUser(null);
          setIsAuthenticated(false);
          safeLocalRemove("token");
          setToken(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => { mounted = false; };
  }, []); // Remove token dependency to avoid infinite loop

  // Update isAuthenticated whenever user or token changes
  useEffect(() => {
    const authenticated = !!(user && (token || true)); // Allow cookie-based auth
    console.log('🔐 AuthContext: Updating isAuthenticated:', authenticated, 'user:', !!user, 'token:', !!token);
    setIsAuthenticated(authenticated);
  }, [user, token]);

  // login: returns { token, user } and does not return until user fetched
  const login = async (email, password) => {
    console.log('🔐 AuthContext: Starting login process...');
    setLoading(true);
    try {
      const apiBase = 'https://soufiam-erp-backend.onrender.com';
      console.log('🌐 AuthContext: Using API base:', apiBase);
      
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Include cookies if using httpOnly
      });
      
      console.log('📡 AuthContext: Server response status:', res.status);
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('❌ AuthContext: Server error:', err);
        throw new Error(err.message || "Login failed");
      }
      
      const responseData = await res.json();
      console.log('📦 AuthContext: Raw server response:', responseData);
      
      // Handle the nested response structure from server
      const data = responseData.data || responseData;
      console.log('🔍 AuthContext: Extracted data:', data);
      
      const newToken = data.token;
      let newUser = data.user || null;
      
      console.log('🎫 AuthContext: Token:', newToken ? 'Present' : 'Missing');
      console.log('👤 AuthContext: User from response:', newUser);

      if (newToken) {
        console.log('💾 AuthContext: Saving token to localStorage...');
        safeLocalSet("token", newToken);
        setToken(newToken);

        // if server didn't return user, fetch it using token
        if (!newUser) {
          console.log('🔄 AuthContext: No user in response, fetching user data...');
          newUser = await fetchMe(newToken);
          console.log('👤 AuthContext: Fetched user:', newUser);
        }
        
        if (newUser) {
          console.log('👤 AuthContext: Setting user in state:', newUser);
          setUser(newUser);
          setIsAuthenticated(true);
        } else {
          throw new Error('Failed to load user data after login');
        }
      } else {
        console.log('❌ AuthContext: No token received, clearing state...');
        // ensure state consistent
        safeLocalRemove("token");
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
      }

      const result = { token: newToken, user: newUser };
      console.log('✅ AuthContext: Login completed, returning:', result);
      return result;
    } catch (error) {
      console.error('❌ AuthContext: Login error:', error);
      // Clear any invalid state
      safeLocalRemove("token");
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      throw error;
    } finally {
      console.log('🏁 AuthContext: Setting loading to false...');
      setLoading(false);
    }
  };

  // signup: same guarantee as login
  const signup = async (payload) => {
    setLoading(true);
    try {
      const apiBase = 'https://soufiam-erp-backend.onrender.com';
      const res = await fetch(`${apiBase}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Signup failed");
      }

      const responseData = await res.json();
      
      // Handle the nested response structure from server
      const data = responseData.data || responseData;
      const newToken = data.token;
      let newUser = data.user || null;

      if (newToken) {
        safeLocalSet("token", newToken);
        setToken(newToken);
        if (!newUser) newUser = await fetchMe(newToken);
        setUser(newUser);
        setIsAuthenticated(true);
      }

      return { token: newToken, user: newUser };
    } catch (error) {
      console.error('❌ AuthContext: Signup error:', error);
      // Clear any invalid state
      safeLocalRemove("token");
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    console.log('🚪 AuthContext: Logging out...');
    
    try {
      // Call logout endpoint to clear server-side cookies
      const apiBase = 'https://soufiam-erp-backend.onrender.com';
      await fetch(`${apiBase}/api/auth/logout`, {
        method: "POST",
        credentials: 'include',
      });
    } catch (error) {
      console.error('❌ Logout API call failed:', error);
    }
    
    // Clear client-side state
    safeLocalRemove("token");
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setLoading(false);
  };

  // Debug function to check current state
  const debugAuthState = () => {
    console.log('🔍 AuthContext Debug State:', {
      token: token ? 'Present' : 'Missing',
      user: user ? 'Present' : 'Missing',
      loading,
      isAuthenticated,
      localStorageToken: safeLocalGet("token") ? 'Present' : 'Missing'
    });
  };

  return (
    <AuthContext.Provider value={{ 
      token, 
      user, 
      loading, 
      isAuthenticated,
      login, 
      signup, 
      logout, 
      setUser,
      debugAuthState 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export default AuthContext;

