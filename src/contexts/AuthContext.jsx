import { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem('currentUser');
      return null;
    }
  });
  const [currentProfile, setCurrentProfile] = useState(() => {
    const saved = localStorage.getItem('currentProfile');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem('currentProfile');
      return null;
    }
  });

  const login = useCallback(async (emailOrPhone, password) => {
    try {
      const res = await axios.post('/api/auth/login', { emailOrPhone, password });
      if (res.data.success) {
        setCurrentUser(res.data.user);
        setCurrentProfile(res.data.profile);
        localStorage.setItem('currentUser', JSON.stringify(res.data.user));
        if (res.data.profile) {
          localStorage.setItem('currentProfile', JSON.stringify(res.data.profile));
        } else {
          localStorage.removeItem('currentProfile');
        }
        return { success: true, user: res.data.user };
      }
      return { success: false, message: 'Đăng nhập không thành công' };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Lỗi kết nối đến máy chủ' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (err) {
      console.warn('Logout request failed; clearing local session anyway.', err);
    }
    setCurrentUser(null);
    setCurrentProfile(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentProfile');
  }, []);

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const isRescue = currentUser?.role === 'RESCUE_LEADER' || currentUser?.role === 'RESCUE_MEMBER';
  const isCitizen = currentUser?.role === 'CITIZEN';

  return (
    <AuthContext.Provider value={{
      currentUser,
      currentProfile,
      setCurrentProfile,
      login,
      logout,
      isAdmin,
      isRescue,
      isCitizen,
      isLoggedIn: !!currentUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
