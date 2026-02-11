import { createContext, useContext, useState, useEffect } from 'react';
import { CorporateAPI } from '../api';

const CorporateAuthContext = createContext();

export function CorporateAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('giftsity_corporate_token');
    const saved = localStorage.getItem('giftsity_corporate_user');
    if (token && saved) {
      try {
        setUser(JSON.parse(saved));
      } catch { /* ignore */ }
      CorporateAPI.get('/auth/me')
        .then(res => {
          setUser(res.data.user);
          localStorage.setItem('giftsity_corporate_user', JSON.stringify(res.data.user));
        })
        .catch(() => {
          localStorage.removeItem('giftsity_corporate_token');
          localStorage.removeItem('giftsity_corporate_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('giftsity_corporate_token', token);
    localStorage.setItem('giftsity_corporate_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('giftsity_corporate_token');
    localStorage.removeItem('giftsity_corporate_user');
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('giftsity_corporate_user', JSON.stringify(userData));
  };

  return (
    <CorporateAuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </CorporateAuthContext.Provider>
  );
}

export function useCorporateAuth() {
  const ctx = useContext(CorporateAuthContext);
  if (!ctx) throw new Error('useCorporateAuth must be used within CorporateAuthProvider');
  return ctx;
}
