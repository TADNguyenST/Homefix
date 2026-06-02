// ============================================================
// HOMEFIX AI — Auth Context
// Login, Logout, Register, JWT management
// ============================================================

import { createContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/authApi';
import { message } from 'antd';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('homefix_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem('homefix_token');
    if (token) {
      authApi.getMe()
        .then((res) => {
          const userData = res.data;
          setUser(userData);
          localStorage.setItem('homefix_user', JSON.stringify(userData));
        })
        .catch(() => {
          localStorage.removeItem('homefix_token');
          localStorage.removeItem('homefix_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ email, password });
    const { token, user: userData } = res.data;
    localStorage.setItem('homefix_token', token);
    localStorage.setItem('homefix_user', JSON.stringify(userData));
    setUser(userData);
    message.success(`Chào mừng ${userData.full_name}!`);
    return userData;
  }, []);

  const register = useCallback(async (data) => {
    const res = await authApi.register(data);
    return res;
  }, []);

  const verifyOtp = useCallback(async (email, otp_code) => {
    const res = await authApi.verifyOtp({ email, otp_code });
    return res;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('homefix_token');
    localStorage.removeItem('homefix_user');
    setUser(null);
    message.info('Đã đăng xuất');
  }, []);

  const updateUser = useCallback((newData) => {
    const updated = { ...user, ...newData };
    setUser(updated);
    localStorage.setItem('homefix_user', JSON.stringify(updated));
  }, [user]);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isCustomer: user?.role === 'CUSTOMER',
    isTechnician: user?.role === 'TECHNICIAN',
    isAdmin: user?.role === 'ADMIN',
    login,
    register,
    verifyOtp,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
