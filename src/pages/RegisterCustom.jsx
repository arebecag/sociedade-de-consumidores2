import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthCustom } from '@/components/AuthContextCustom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function RegisterCustom() {
  const navigate = useNavigate();
  const { register: authRegister, isAuthenticated } = useAuthCustom();
  const [referrerCode, setReferrerCode] = useState('');
  const [referrerName, setReferrerName] = useState('');
  const [referrerPartnerId, setReferrerPartnerId] = useState(null);
  const [loadingReferrer, setLoadingReferrer] = useState(true);
  const [invalidReferrer, setInvalidReferrer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState({ valid: false, message: '' });
  const [cadastroSucesso, setCadastroSucesso] = useState(false);
  const [nomeRegistrado, setNomeRegistrado] = useState('');

  const DEFAULT_REFERRER_CODE = 'WKK321P5';

  // Se já está logado, redirecionar
  useEffect(() => {
    if (isAuthenticated()) {
      navigate(createPageUrl('Dashboard'));
    }
    checkReferrer();
  }, [isAuthenticated, navigate]);

  const checkReferrer = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('ref');
      
      if (code) {
        setReferrerCode(code);
        loadReferrer(code);
      } else {
        loadReferrer(DEFAULT_REFERRER_CODE);
      }
    } catch (error) {
      console.error('Erro ao verificar indicador:', error);
      setLoadingReferrer(false);
    }
  };

  const loadReferrer = async (code) => {
    try {
      const normalizedCode = code.trim().toUpperCase();
      const partners = await base44.entities.Partner.filter({ unique_code: normalizedCode });

      if (partners.length > 0) {
        setReferrerName(partners[0].display_name || partners[0].full_name);
        setReferrerPartnerId(partners[0].id);
        setInvalidReferrer(false);
      } else {
        setInvalidReferrer(true);
      }
    } catch (error) {
      console.error('Erro ao carregar indicador:', error);
      setInvalidReferrer(true);
    } finally {
      setLoadingReferrer(false);
    }
  };

  const validatePassword = (password) => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const isLongEnough = password.length >= 8;

    if (!isLongEnough) return { valid: false, message: 'Mínimo 8 caracteres' };
    if (!hasUpperCase) return { valid: false, message: 'Precisa ter letra maiúscula' };
    if (!hasLowerCase) return { valid: false, message: 'Precisa ter letra minúscula' };
    if (!hasNumber) return { valid: false, message: 'Precisa ter um número' };
    return { valid: true, message: 'Senha válida ✓' };
  };

  const handleChange = (field, value) => {
    if (field === 'password') {
      setPasswordStrength(validatePassword(value));
    }
    setFormData({ ...formData, [field]: value });
    setErrors({ ...errors, [field]: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    if (!formData.full_name.trim()) newErrors.full_name = 'Nome completo é obrigatório';
    if (!formData.email) {
      newErrors.email = 'E-mail é obrigatório';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'E-mail inválido';
    }
    if (!passwordStrength.valid) newErrors.password = passwordStrength.message || 'Senha inválida';
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'As senhas não coincidem';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Por favor, corrija os campos destacados');
      return;
    }

    setLoading(true);
    try {
      await authRegister(
        formData.full_name,
        formData.email,
        formData.password,
        referrerPartnerId,
        referrerName
      );

      setNomeRegistrado(formData.full_name.split(' ')[0]);
      setCadastroSucesso(true);
    } catch (error) {
      console.error('[Register] Erro:', error);
      const msg = error.message || '';
      if (msg.toLowerCase().includes('já cadastrado') || msg.toLowerCase().includes('already')) {
        toast.error('Este e-mail já está cadastrado');
        setErrors(prev => ({ ...prev, email: 'E-mail já cadastrado' }));
      } else {
        toast.error(msg || 'Erro ao cadastrar');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loadingReferrer) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (invalidReferrer) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <AlertCircle className="w-14 h-14 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Link Inválido</h2>
          <p className="text-gray-400 text-sm">
            O código de indicação não foi encontrado. Verifique o link e tente novamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <span className="text-4xl font-black text-white tracking-tight">3X3</span>
            <span className="text-4xl font-black text-orange-500 tracking-tight"> SC</span>
          </div>
          <p className="text-gray-400 text-sm">Sociedade de Consumidores</p>
        </div>

        <Card className="bg-zinc-900 border-zinc-800 shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">Criar conta</CardTitle>
            <button
              type="button"
              onClick={() => navigate(createPageUrl('LoginCustom'))}
              className="text-orange-500 hover:text-orange-400 text-sm font-medium hover:underline transition-colors text-left"
            >
              Já tem uma conta? Faça login →
            </button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {referrerPartnerId && (
                <div className="p-3 bg-zinc-800 rounded-lg border border-zinc-700 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-400 text-xs font-bold">{referrerName[0]}</span>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Indicado por</p>
                    <p className="text-white font-semibold text-sm">{referrerName}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="full_name" className="text-gray-300 text-sm">Nome Completo *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white focus:border-orange-500"
                  placeholder="Seu nome completo"
                  disabled={loading}
                />
                {errors.full_name && <p className="text-red-400 text-xs">{errors.full_name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-gray-300 text-sm">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white focus:border-orange-500"
                  placeholder="seu@email.com"
                  disabled={loading}
                />
                {errors.email && <p className="text-red-400 text-xs">{errors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-gray-300 text-sm">Senha *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white focus:border-orange-500 pr-10"
                    placeholder="Mín. 8 caracteres, maiúscula e número"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {formData.password && (
                  <p className={`text-xs ${passwordStrength.valid ? 'text-green-500' : 'text-yellow-500'}`}>
                    {passwordStrength.message}
                  </p>
                )}
                {errors.password && <p className="text-red-400 text-xs">{errors.password}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-gray-300 text-sm">Repetir Senha *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white focus:border-orange-500 pr-10"
                    placeholder="Digite a senha novamente"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {formData.confirmPassword && formData.password === formData.confirmPassword && (
                  <p className="text-green-500 text-xs">✓ Senhas coincidem</p>
                )}
                {errors.confirmPassword && <p className="text-red-400 text-xs">{errors.confirmPassword}</p>}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 text-base"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Cadastrando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Criar Conta
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}