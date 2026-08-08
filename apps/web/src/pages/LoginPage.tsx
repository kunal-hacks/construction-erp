import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/services';
import { useAuthStore } from '../store/authStore';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import { HiOutlineEye, HiOutlineEyeSlash, HiOutlineBuildingOffice2 } from 'react-icons/hi2';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: 'admin@erp.com', password: 'Admin@123' },
  });

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (res) => {
      const { user, accessToken, refreshToken } = res.data.data;
      // Wipe any cached data from a previous session in this browser tab —
      // otherwise a second person logging in on the same device/tab could
      // briefly see stale data cached under the previous user's session.
      qc.clear();
      setAuth(user as never, accessToken, refreshToken);
      toast.success(`Welcome back, ${(user as { firstName: string }).firstName}!`);
      navigate('/');
    },
    onError: (err) => {
      toast.error(formatError(err));
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-white/20 backdrop-blur rounded-2xl mb-4">
            <HiOutlineBuildingOffice2 className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Construction ERP</h1>
          <p className="text-primary-200 mt-2 text-sm sm:text-base">Complete Project Management System</p>
        </div>

        {/* Login Card */}
<div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-5 sm:p-8 min-h-[430px] flex flex-col justify-center">          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-7">
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit((d) => loginMutation.mutate(d))} className="space-y-4 sm:space-y-5">
            <div>
              <label className="label">Email address</label>
              <input
                {...register('email')}
                type="email"
                className="input"
                placeholder="admin@erp.com"
                autoComplete="email"
                inputMode="email"
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showPassword ? <HiOutlineEyeSlash className="w-4 h-4" /> : <HiOutlineEye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {loginMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          {/* <div className="mt-5 sm:mt-6 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Demo Credentials:</p>
            <div className="space-y-1 text-[11px] sm:text-xs text-gray-600 dark:text-gray-400">
              <div className="flex justify-between gap-2"><span className="flex-shrink-0">Super Admin:</span><span className="font-mono truncate">superadmin@erp.com</span></div>
              <div className="flex justify-between gap-2"><span className="flex-shrink-0">Admin:</span><span className="font-mono truncate">admin@erp.com</span></div>
              <div className="flex justify-between gap-2"><span className="flex-shrink-0">Project Manager:</span><span className="font-mono truncate">pm@erp.com</span></div>
              <div className="flex justify-between gap-2"><span className="flex-shrink-0">Password:</span><span className="font-mono font-bold">Admin@123</span></div>
            </div>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;