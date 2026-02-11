import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availableRoles, setAvailableRoles] = useState([]);

  const fetchAvailableRoles = async () => {
    try {
      const res = await authAPI.getAvailableRoles();
      setAvailableRoles(res.data.roles || []);
    } catch {
      setAvailableRoles([]);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('giftsity_token');
    if (token) {
      authAPI.me()
        .then(res => {
          setUser(res.data.user);
          return fetchAvailableRoles();
        })
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
    await fetchAvailableRoles();
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
    fetchAvailableRoles();
  };

  const logout = () => {
    localStorage.removeItem('giftsity_token');
    localStorage.removeItem('giftsity_user');
    setUser(null);
    setAvailableRoles([]);
  };

  const switchRole = async (role) => {
    const res = await authAPI.switchRole(role);
    localStorage.setItem('giftsity_token', res.data.token);
    localStorage.setItem('giftsity_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    // Roles stay the same (same email), no need to re-fetch
    return res.data.user;
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
    <AuthContext.Provider value={{ user, loading, login, sendOtp, verifyOtp, logout, updateProfile, refreshUser, availableRoles, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
