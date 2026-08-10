import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AuthLayout from '../components/auth/AuthLayout';
import AuthInput from '../components/auth/AuthInput';
import OAuthButton from '../components/auth/OAuthButton';

const Login: React.FC = () => {
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [otp, setOtp] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendCountdown > 0) {
      interval = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendCountdown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (signInError) throw signInError;
      
      navigate('/dashboard'); // Redirect to dashboard on success
    } catch (err: any) {
      const errorMsg = err.message || '';
      if (errorMsg.toLowerCase().includes('email not confirmed')) {
        // Auto trigger a resend and show the screen
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email,
        });
        
        if (!resendError) {
          setShowVerification(true);
          setResendCountdown(60);
          setError('');
        } else {
          setError('Email not confirmed. Failed to send verification code.');
        }
      } else {
        setError(errorMsg || 'Failed to connect to server. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'signup'
      });
      
      if (verifyError) throw verifyError;
      
      navigate('/dashboard'); // Verified successfully
    } catch (err: any) {
      setError(err.message || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      if (resendCountdown > 0) return;
      setLoading(true);
      setError('');
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (resendError) throw resendError;
      setResendCountdown(60); // Restart countdown on resend
    } catch (err: any) {
      setError(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || `Failed to authenticate with Google.`);
    }
  };

  return (
    <AuthLayout 
      title="Welcome back" 
      subtitle="Please enter your details to sign in."
    >
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
          <span className="block w-1.5 h-full rounded-full bg-red-600"></span>
          {error}
        </div>
      )}

      {showVerification ? (
        <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fade-in">
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-800 mb-4">
            We've sent a 6-digit verification code to <strong>{email}</strong>. Please enter it below to confirm your account.
          </div>
          
          <AuthInput
            label="Verification Code"
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
            maxLength={6}
            placeholder="123456"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-xl font-medium transition-all disabled:opacity-70 shadow-md shadow-purple-900/20 mt-2"
          >
            {loading ? 'Verifying...' : 'Verify Account'}
          </button>
          
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={loading || resendCountdown > 0}
            className="w-full text-center text-sm text-purple-600 hover:text-purple-700 font-medium mt-4 disabled:opacity-70"
          >
            {resendCountdown > 0 ? `Didn't receive code? Resend in ${resendCountdown}s` : "Didn't receive code? Resend Code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <AuthInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="Enter your email"
          />

          <AuthInput
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="•••••••••"
          />

          <div className="flex items-center justify-between pt-1 pb-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 bg-white" />
              <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Remember me</span>
            </label>
            <Link to="/forgot-password" className="text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors">Forgot password?</Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white p-3.5 rounded-xl font-medium transition-all disabled:opacity-70 shadow-md shadow-purple-900/20"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-sm">or sign in with</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <OAuthButton provider="google" onClick={handleOAuthLogin} />
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-600">
        Don't have an account?{' '}
        <Link to="/register" className="font-semibold text-purple-600 hover:text-purple-700 transition-colors">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Login;
