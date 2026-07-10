import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authReady, setAuthReady] = useState(false);
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

  const clearLocalSession = useCallback(() => {
    setCurrentUser(null);
    setCurrentProfile(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentProfile');
  }, []);

  useEffect(() => {
    let active = true;

    axios.get('/api/auth/session')
      .then(res => {
        if (!active) return;
        const { user, profile } = res.data;
        setCurrentUser(user);
        setCurrentProfile(profile || null);
        localStorage.setItem('currentUser', JSON.stringify(user));
        if (profile) localStorage.setItem('currentProfile', JSON.stringify(profile));
        else localStorage.removeItem('currentProfile');
      })
      .catch(err => {
        if (!active) return;
        clearLocalSession();
        if (err.response?.status !== 401) {
          console.warn('Không thể xác thực phiên đăng nhập với máy chủ.', err);
        }
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });

    return () => { active = false; };
  }, [clearLocalSession]);

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
        window.dispatchEvent(new Event('auth:session-changed'));
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
    clearLocalSession();
    window.dispatchEvent(new Event('auth:session-changed'));
  }, [clearLocalSession]);

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
      authReady,
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
