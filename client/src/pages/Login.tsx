import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AuthLayout from '../components/auth/AuthLayout';
import AuthInput from '../components/auth/AuthInput';
import OAuthButton from '../components/auth/OAuthButton';

const Login: React.FC = () => {
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
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
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false
        }
      });
      
      // For signInWithOtp, the error could be something else, but if it succeeds, it sends an email.
      if (!signInError) {
        setShowVerification(true);
        setResendCountdown(60);
        setError('');
      } else {
        throw signInError;
      }
    } catch (err: any) {
      let errorMsg = err.message || '';
      if (errorMsg.toLowerCase().includes('failed to fetch') || errorMsg.toLowerCase().includes('networkerror')) {
        errorMsg = 'Network error: Please check your internet connection and try again.';
      }
      setError(errorMsg || 'Failed to connect to server. Please try again.');
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
        type: 'email'
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

          <div className="flex items-center justify-between pt-1 pb-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500 bg-white dark:bg-slate-800" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Remember me</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white p-3.5 rounded-xl font-medium transition-all disabled:opacity-70 shadow-md shadow-purple-900/20"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 dark:text-slate-500 text-sm">or sign in with</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
          </div>

          <OAuthButton provider="google" onClick={handleOAuthLogin} />
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        Don't have an account?{' '}
        <Link to="/register" className="font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Login;
