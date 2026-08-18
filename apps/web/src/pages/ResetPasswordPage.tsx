import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/services';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import { HiOutlineEye, HiOutlineEyeSlash, HiOutlineBuildingOffice2, HiOutlineCheckCircle } from 'react-icons/hi2';

const resetSchema = z
  .object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ResetForm = z.infer<typeof resetSchema>;

const ResetPasswordPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const { register, handleSubmit, formState: { errors } } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const resetMutation = useMutation({
    mutationFn: (newPassword: string) => authApi.resetPassword({ token: token as string, newPassword }),
    onSuccess: () => {
      setSuccess(true);
      toast.success('Password set successfully!');
    },
    onError: (err) => toast.error(formatError(err)),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-white/20 backdrop-blur rounded-2xl mb-4">
            <HiOutlineBuildingOffice2 className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Construction ERP</h1>
          <p className="text-primary-200 mt-2 text-sm sm:text-base">Set your password to get started</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-5 sm:p-8 min-h-[430px] flex flex-col justify-center">
          {!token ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-red-500">This link is invalid or missing a token.</p>
              <button onClick={() => navigate('/login')} className="btn-primary w-full justify-center py-3">
                Go to Login
              </button>
            </div>
          ) : success ? (
            <div className="text-center space-y-4">
              <HiOutlineCheckCircle className="w-14 h-14 text-green-500 mx-auto" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Password set!</h2>
              <p className="text-sm text-gray-500">You can now sign in with your new password.</p>
              <button onClick={() => navigate('/login')} className="btn-primary w-full justify-center py-3">
                Go to Login
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-7">
                Set your password
              </h2>

              <form
                onSubmit={handleSubmit((d) => resetMutation.mutate(d.newPassword))}
                className="space-y-4 sm:space-y-5"
              >
                <div>
                  <label className="label">New Password</label>
                  <div className="relative">
                    <input
                      {...register('newPassword')}
                      type={showPassword ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="Min 8 characters"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    >
                      {showPassword ? <HiOutlineEyeSlash className="w-4 h-4" /> : <HiOutlineEye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.newPassword && <p className="mt-1 text-xs text-red-500">{errors.newPassword.message}</p>}
                </div>

                <div>
                  <label className="label">Confirm Password</label>
                  <div className="relative">
                    <input
                      {...register('confirmPassword')}
                      type={showConfirm ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    >
                      {showConfirm ? <HiOutlineEyeSlash className="w-4 h-4" /> : <HiOutlineEye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={resetMutation.isPending}
                  className="btn-primary w-full justify-center py-3 text-base"
                >
                  {resetMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Setting password...
                    </span>
                  ) : 'Set Password'}
                </button>

                <p className="text-center text-xs text-gray-400">
                  <Link to="/login" className="text-primary-600 hover:underline">Back to login</Link>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;