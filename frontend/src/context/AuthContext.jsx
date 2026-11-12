import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginApi, getMeApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('gss_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('gss_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      if (token) {
        try {
          const userData = await getMeApi();
          setUser(userData);
          localStorage.setItem('gss_user', JSON.stringify(userData));
        } catch (err) {
          console.error('Session expired or invalid', err);
          logout();
        }
      }
      setLoading(false);
    };
    verifyAuth();
  }, [token]);

  const login = async (email, password) => {
    const res = await loginApi(email, password);
    setToken(res.access_token);
    setUser(res.user);
    localStorage.setItem('gss_token', res.access_token);
    localStorage.setItem('gss_user', JSON.stringify(res.user));
    return res.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('gss_token');
    localStorage.removeItem('gss_user');
  };

  const isCeo = user?.role === 'CEO';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isCeo,
        isAuthenticated: !!token,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
