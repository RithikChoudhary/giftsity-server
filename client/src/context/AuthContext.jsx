import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('giftsity_token');
    if (token) {
      authAPI.me()
        .then(res => setUser(res.data.user))
        .catch(() => {
          localStorage.removeItem('giftsity_token');
          localStorage.removeItem('giftsity_user');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const sendOtp = async (email) => {
    const res = await authAPI.sendOtp(email);
    return res.data;
  };

  const verifyOtp = async (email, otp) => {
    const res = await authAPI.verifyOtp(email, otp);
    localStorage.setItem('giftsity_token', res.data.token);
    localStorage.setItem('giftsity_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const login = (token, userData) => {
    if (token) {
      localStorage.setItem('giftsity_token', token);
    }
    if (userData) {
      localStorage.setItem('giftsity_user', JSON.stringify(userData));
      setUser(userData);
    }
  };

  const logout = () => {
    localStorage.removeItem('giftsity_token');
    localStorage.removeItem('giftsity_user');
    setUser(null);
  };

  const updateProfile = async (data) => {
    await authAPI.updateProfile(data);
    // Refresh full user from /me to get all fields
    const meRes = await authAPI.me();
    setUser(meRes.data.user);
    localStorage.setItem('giftsity_user', JSON.stringify(meRes.data.user));
    return meRes.data;
  };

  const refreshUser = async () => {
    try {
      const res = await authAPI.me();
      setUser(res.data.user);
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, sendOtp, verifyOtp, logout, updateProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
