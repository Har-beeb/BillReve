import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AuthLayout from '../components/auth/AuthLayout';
import AuthInput from '../components/auth/AuthInput';
import OAuthButton from '../components/auth/OAuthButton';
import PasswordStrengthMeter, { isPasswordValid } from '../components/auth/PasswordStrengthMeter';

const Register: React.FC = () => {
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!isPasswordValid(password)) {
      setError('Please ensure your password meets all requirements.');
      return;
    }

    setLoading(true);

    try {
      // Check if email already exists
      const { data: emailExists, error: rpcError } = await supabase.rpc('check_email_exists', { p_email: email });
      
      if (rpcError) {
        console.error("RPC Error:", rpcError);
        throw new Error("Unable to verify email availability.");
      }
      
      if (emailExists) {
        // Try to resend OTP. If it succeeds, the account exists but is UNCONFIRMED!
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email,
        });
        
        if (!resendError) {
          // It was an unconfirmed account. The code was resent successfully!
          setShowVerification(true);
          setResendCountdown(60);
          setError('');
          setLoading(false);
          return;
        }
        
        // If resend fails (e.g. user is already confirmed), throw the standard error
        throw new Error("An account with this email already exists.");
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          }
        }
      });
      
      if (signUpError) throw signUpError;
      
      // On success, show OTP verification screen instead of redirecting
      setShowVerification(true);
      setResendCountdown(60); // Start 60s countdown on first send
      setError('');
    } catch (err: any) {
      let errorMsg = err.message || 'Failed to connect to server. Please try again.';
      if (errorMsg.toLowerCase().includes('failed to fetch') || errorMsg.toLowerCase().includes('networkerror')) {
        errorMsg = 'Network error: Please check your internet connection and try again.';
      }
      setError(errorMsg);
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
      // Optional: show a success toast here if you have a toast system
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
      title="Create an account" 
      subtitle="Start managing your invoices offline with our robust platform."
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
        <form onSubmit={handleRegister} className="space-y-3">
        <AuthInput
          label="Business Name (or Full Name for freelancers)"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
          placeholder="John Doe"
        />
        
        <AuthInput
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="Enter your email"
        />

        <div>
          <AuthInput
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="••••••••"
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-xl font-medium transition-all disabled:opacity-70 shadow-md shadow-purple-900/20 mt-1"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
        
        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
          <span className="flex-shrink-0 mx-4 text-slate-400 dark:text-slate-500 text-sm">or sign up with</span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
        </div>

        <OAuthButton provider="google" onClick={handleOAuthLogin} />
      </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Register;
