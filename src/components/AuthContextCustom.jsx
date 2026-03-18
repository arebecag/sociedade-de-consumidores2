import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext(null);

export const useAuthCustom = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthCustom deve ser usado dentro de AuthProviderCustom');
  }
  return context;
};

export const AuthProviderCustom = ({ children }) => {
  const [user, setUser] = useState(null);
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);

  const getToken = () => localStorage.getItem('auth_token');
  const setToken = (token) => localStorage.setItem('auth_token', token);
  const removeToken = () => localStorage.removeItem('auth_token');

  const loadUser = async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await base44.functions.invoke('authMe', { token });
      if (res.data?.user) {
        setUser(res.data.user);
        setPartner(res.data.partner || null);
      } else {
        // Sessão inválida ou expirada
        removeToken();
        setUser(null);
        setPartner(null);
      }
    } catch (error) {
      console.error('[AuthContext] Erro ao carregar usuário:', error);
      // Sessão expirada ou inválida - limpar tudo
      removeToken();
      setUser(null);
      setPartner(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await base44.functions.invoke('authLogin', { email, password });
      if (res.data?.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        setPartner(res.data.partner || null);
        return res.data;
      }
      throw new Error(res.data?.error || 'E-mail ou senha incorretos');
    } catch (error) {
      const msg = error.response?.data?.error || error.response?.data?.message || error.message;
      if (msg && !msg.includes('status code')) throw new Error(msg);
      throw new Error('E-mail ou senha incorretos');
    }
  };

  const logout = async () => {
    const token = getToken();
    if (token) {
      try {
        await base44.functions.invoke('authLogout', { token });
      } catch (error) {
        console.error('[AuthContext] Erro ao fazer logout:', error);
      }
    }
    removeToken();
    setUser(null);
    setPartner(null);
  };

  const register = async (full_name, email, password, referrer_id, referrer_name) => {
    const res = await base44.functions.invoke('authRegister', {
      full_name,
      email,
      password,
      referrer_id,
      referrer_name
    });
    if (res.data?.success) {
      return res.data;
    }
    throw new Error(res.data?.error || 'Erro ao cadastrar');
  };

  const verifyEmail = async (email, code) => {
    const res = await base44.functions.invoke('verifyEmailCode', { email, code });
    if (res.data?.success) {
      // Recarregar usuário após verificação
      await loadUser();
      return res.data;
    }
    throw new Error(res.data?.error || 'Erro ao verificar e-mail');
  };

  const sendVerificationCode = async (email) => {
    const res = await base44.functions.invoke('sendEmailVerificationCode', { email });
    if (res.data?.success) {
      return res.data;
    }
    throw new Error(res.data?.error || 'Erro ao enviar código');
  };

  const requestPasswordReset = async (email) => {
    const res = await base44.functions.invoke('requestPasswordReset', { email });
    if (res.data?.success) {
      return res.data;
    }
    throw new Error(res.data?.error || 'Erro ao solicitar redefinição');
  };

  const resetPassword = async (email, token, newPassword) => {
    const res = await base44.functions.invoke('resetPassword', { email, token, newPassword });
    if (res.data?.success) {
      return res.data;
    }
    throw new Error(res.data?.error || 'Erro ao redefinir senha');
  };

  const isAuthenticated = () => !!user && !!getToken();

  return (
    <AuthContext.Provider
      value={{
        user,
        partner,
        loading,
        login,
        logout,
        register,
        verifyEmail,
        sendVerificationCode,
        requestPasswordReset,
        resetPassword,
        isAuthenticated,
        reloadUser: loadUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};