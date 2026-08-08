import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { authApi } from '../api/services';
import { useAuthStore } from '../store/authStore';
import { Modal, FormField, Badge } from '../components/common';
import { useForm } from 'react-hook-form';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import { HiOutlinePencil, HiOutlineKey, HiOutlineUser, HiOutlineEnvelope, HiOutlinePhone, HiOutlineShieldCheck, HiOutlineClock } from 'react-icons/hi2';

// Only two roles exist in this system.
const ROLE_DESCRIPTIONS: Record<string, string> = {
  SUPER_ADMIN: 'Full system access — all projects, user management, and system administration.',
  PROJECT_MANAGER: 'Daily reports, expenses, material usage, truck entries, tasks, labour, and site photos for assigned projects.',
};

const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuthStore();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const { data: profileData, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
  });

  const profile = profileData?.data?.data || user;

  const { register: regProfile, handleSubmit: handleProfileSub, setValue } = useForm();
  const { register: regPass, handleSubmit: handlePassSub, watch, reset: resetPass, formState: { errors: passErrors } } = useForm();
  const newPass = watch('newPassword');

  React.useEffect(() => {
    if (profile) {
      setValue('firstName', profile.firstName);
      setValue('lastName', profile.lastName);
      setValue('phone', profile.phone || '');
    }
  }, [profile, setValue]);

  const updateProfileMutation = useMutation({
    mutationFn: (d: object) => authApi.updateProfile(d),
    onSuccess: (res) => {
      updateUser(res.data.data);
      refetch();
      toast.success('Profile updated!');
      setShowEditProfile(false);
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (d: object) => authApi.changePassword(d),
    onSuccess: () => {
      toast.success('Password changed successfully!');
      setShowChangePassword(false);
      resetPass();
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const isAdmin = profile?.role === 'SUPER_ADMIN';
  const assignedProjects = (profile?.projects || []) as { project: { id: string; name: string; projectCode: string; status: string }; role: string }[];

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="page-title">My Profile</h1>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <button onClick={() => setShowChangePassword(true)} className="btn-secondary text-sm justify-center">
            <HiOutlineKey className="w-4 h-4" /> <span className="hidden xs:inline">Change </span>Password
          </button>
          <button onClick={() => setShowEditProfile(true)} className="btn-primary text-sm justify-center">
            <HiOutlinePencil className="w-4 h-4" /> Edit Profile
          </button>
        </div>
      </div>

      {/* Profile Card */}
      <div className="card p-4 sm:p-6">
        <div className="flex flex-col xs:flex-row items-center xs:items-start gap-4 sm:gap-6 text-center xs:text-left">
          {/* Avatar */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl sm:text-3xl font-bold text-primary-700 dark:text-primary-400">
              {profile?.firstName?.[0]}{profile?.lastName?.[0]}
            </span>
          </div>

          <div className="flex-1 min-w-0 w-full">
            <div className="flex items-center justify-center xs:justify-start gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                {profile?.firstName} {profile?.lastName}
              </h2>
              <Badge variant={profile?.isActive ? 'success' : 'danger'}>
                {profile?.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-center xs:justify-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <HiOutlineEnvelope className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="truncate">{profile?.email}</span>
              </div>
              {profile?.phone && (
                <div className="flex items-center justify-center xs:justify-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <HiOutlinePhone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>{profile.phone}</span>
                </div>
              )}
              <div className="flex items-center justify-center xs:justify-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <HiOutlineShieldCheck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="font-medium">{isAdmin ? 'Super Admin' : 'Project Manager'}</span>
              </div>
              {profile?.lastLoginAt && (
                <div className="flex items-center justify-center xs:justify-start gap-2 text-sm text-gray-500 dark:text-gray-500">
                  <HiOutlineClock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">Last login: {new Date(profile.lastLoginAt).toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Role Permissions */}
      <div className="card p-4 sm:p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm sm:text-base">Role & Permissions</h3>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
            <HiOutlineShieldCheck className="w-5 h-5 text-primary-600" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 dark:text-white">{isAdmin ? 'Super Admin' : 'Project Manager'}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {ROLE_DESCRIPTIONS[profile?.role || ''] || 'Standard access level.'}
            </p>
          </div>
        </div>
      </div>

      {/* Assigned Projects — only meaningful for a PM; an Admin sees everything by definition */}
      {!isAdmin && (
        <div className="card p-4 sm:p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm sm:text-base">Assigned Projects</h3>
          {assignedProjects.length > 0 ? (
            <div className="space-y-2">
              {assignedProjects.map((pm) => (
                <div key={pm.project.id} className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{pm.project.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{pm.project.projectCode}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="info">{pm.role.replace(/_/g,' ')}</Badge>
                    <Badge variant={pm.project.status === 'ACTIVE' ? 'success' : 'neutral'}>{pm.project.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No projects assigned yet. Contact your admin.</p>
          )}
        </div>
      )}

      {/* Account Info */}
      <div className="card p-4 sm:p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm sm:text-base">Account Information</h3>
        <div className="space-y-2 text-sm">
          {[
            ['Account ID', profile?.id],
            ['Member Since', profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '—'],
            ['Last Login', profile?.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString('en-IN') : 'Never'],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex flex-col xs:flex-row xs:justify-between gap-0.5 xs:gap-2 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-900 dark:text-white font-mono text-xs break-all xs:text-right">{String(value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal isOpen={showEditProfile} onClose={() => setShowEditProfile(false)} title="Edit Profile" size="sm">
        <form onSubmit={handleProfileSub(d => updateProfileMutation.mutate(d))} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="First Name" required>
              <input {...regProfile('firstName', { required: true })} className="input" />
            </FormField>
            <FormField label="Last Name" required>
              <input {...regProfile('lastName', { required: true })} className="input" />
            </FormField>
          </div>
          <FormField label="Phone">
            <input {...regProfile('phone')} className="input" placeholder="9876543210" />
          </FormField>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => setShowEditProfile(false)} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={updateProfileMutation.isPending} className="btn-primary w-full sm:w-auto">
              {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Change Password Modal */}
      <Modal isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} title="Change Password" size="sm">
        <form onSubmit={handlePassSub(d => changePasswordMutation.mutate(d))} className="p-4 sm:p-6 space-y-4">
          <FormField label="Current Password" required error={passErrors.currentPassword?.message as string}>
            <input {...regPass('currentPassword', { required: 'Current password is required' })}
              type="password" className="input" placeholder="Your current password" />
          </FormField>
          <FormField label="New Password" required error={passErrors.newPassword?.message as string}>
            <input {...regPass('newPassword', {
              required: 'New password is required',
              minLength: { value: 8, message: 'Minimum 8 characters' },
            })} type="password" className="input" placeholder="Min 8 characters" />
          </FormField>
          <FormField label="Confirm New Password" required error={passErrors.confirmPassword?.message as string}>
            <input {...regPass('confirmPassword', {
              required: 'Please confirm your password',
              validate: (v) => v === newPass || 'Passwords do not match',
            })} type="password" className="input" placeholder="Repeat new password" />
          </FormField>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-xs text-blue-700 dark:text-blue-300">
            💡 After changing your password, you will be logged out from all other devices.
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => setShowChangePassword(false)} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={changePasswordMutation.isPending} className="btn-primary w-full sm:w-auto">
              {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default ProfilePage;