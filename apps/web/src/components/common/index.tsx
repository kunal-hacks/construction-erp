import React from 'react';
import { HiOutlineXMark, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import { clsx } from 'clsx';

// ==================== MODAL ====================
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx(
        'relative bg-white dark:bg-gray-900 shadow-2xl w-full animate-slide-up',
        'rounded-t-2xl sm:rounded-2xl',
        'max-h-[92vh] sm:max-h-[85vh] flex flex-col',
        sizeClasses[size]
      )}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white pr-2">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors flex-shrink-0"
          >
            <HiOutlineXMark className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};

// ==================== CONFIRM DIALOG ====================
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', isLoading
}) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
    <div className="p-6">
      <div className="flex gap-4">
        <div className={clsx(
          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
          variant === 'danger' && 'bg-red-100 dark:bg-red-900/20',
          variant === 'warning' && 'bg-yellow-100 dark:bg-yellow-900/20',
        )}>
          <HiOutlineExclamationTriangle className={clsx(
            'w-5 h-5',
            variant === 'danger' && 'text-red-600',
            variant === 'warning' && 'text-yellow-600',
          )} />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{message}</p>
      </div>
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 mt-6">
        <button onClick={onClose} className="btn-secondary w-full sm:w-auto">Cancel</button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className={clsx(
            'btn-primary w-full sm:w-auto',
            variant === 'danger' && 'bg-red-600 hover:bg-red-700',
            variant === 'warning' && 'bg-yellow-600 hover:bg-yellow-700',
          )}
        >
          {isLoading ? 'Processing...' : confirmLabel}
        </button>
      </div>
    </div>
  </Modal>
);

// ==================== BADGE ====================
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className }) => {
  const variantClasses: Record<BadgeVariant, string> = {
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  };

  return (
    <span className={clsx('badge', variantClasses[variant], className)}>
      {children}
    </span>
  );
};

// ==================== STAT CARD ====================
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg?: string;
  trend?: { value: number; label: string };
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, iconBg = 'bg-primary-100 dark:bg-primary-900/30', trend }) => (
  <div className="card p-4 sm:p-6">
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <div className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</div>
        <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-1 truncate">{value}</div>
        {subtitle && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{subtitle}</div>}
        {trend && (
          <div className={clsx(
            'text-xs font-medium mt-2 flex items-center gap-1',
            trend.value >= 0 ? 'text-green-600' : 'text-red-500'
          )}>
            <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
            <span className="text-gray-400 truncate">{trend.label}</span>
          </div>
        )}
      </div>
      <div className={clsx('w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
        {icon}
      </div>
    </div>
  </div>
);

// ==================== LOADING SPINNER ====================
export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md', className
}) => {
  const sizeClasses = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className={clsx('flex items-center justify-center', className)}>
      <div className={clsx('animate-spin rounded-full border-2 border-gray-200 dark:border-gray-700 border-t-primary-600', sizeClasses[size])} />
    </div>
  );
};

// ==================== EMPTY STATE ====================
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center">
    {icon && <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4 text-gray-400">{icon}</div>}
    <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
    {description && <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// ==================== SEARCH INPUT ====================
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, placeholder = 'Search...', className }) => (
  <div className={clsx('relative', className)}>
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="input pl-9 w-full"
    />
  </div>
);

// ==================== PAGINATION ====================
interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, total, pageSize, onPageChange }) => {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-800">
      <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 order-2 sm:order-1">
        Showing <span className="font-medium text-gray-900 dark:text-white">{start}–{end}</span> of <span className="font-medium text-gray-900 dark:text-white">{total}</span> results
      </div>
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          Prev
        </button>
        <div className="hidden xs:flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = page <= 3 ? i + 1 : page + i - 2;
            if (p < 1 || p > totalPages) return null;
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={clsx(
                  'w-8 h-8 text-sm rounded-lg',
                  p === page
                    ? 'bg-primary-600 text-white font-medium'
                    : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                )}
              >
                {p}
              </button>
            );
          })}
        </div>
        <span className="xs:hidden text-xs text-gray-500 px-2 whitespace-nowrap">{page} / {totalPages}</span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          Next
        </button>
      </div>
    </div>
  );
};

// ==================== FORM FIELD ====================
interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ label, error, required, children, className }) => (
  <div className={className}>
    <label className="label">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

// ==================== PAGE HEADER ====================
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, action, breadcrumb }) => (
  <div className="mb-6">
    {breadcrumb && (
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2 overflow-x-auto no-scrollbar">
        {breadcrumb.map((item, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span>/</span>}
            {item.href ? (
              <a href={item.href} className="hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap">{item.label}</a>
            ) : (
              <span className="text-gray-900 dark:text-white font-medium whitespace-nowrap">{item.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>
    )}
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
      <div className="min-w-0">
        <h1 className="page-title truncate sm:whitespace-normal">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  </div>
);

// ==================== STATUS BADGE HELPER ====================
export const statusBadge = (status: string): JSX.Element => {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    ACTIVE: { variant: 'success', label: 'Active' },
    COMPLETED: { variant: 'info', label: 'Completed' },
    PLANNING: { variant: 'purple', label: 'Planning' },
    ON_HOLD: { variant: 'warning', label: 'On Hold' },
    CANCELLED: { variant: 'danger', label: 'Cancelled' },
    APPROVED: { variant: 'success', label: 'Approved' },
    PENDING: { variant: 'warning', label: 'Pending' },
    REJECTED: { variant: 'danger', label: 'Rejected' },
    DRAFT: { variant: 'neutral', label: 'Draft' },
    SUBMITTED: { variant: 'info', label: 'Submitted' },
    PAID: { variant: 'success', label: 'Paid' },
    PROCESSED: { variant: 'info', label: 'Processed' },
    TODO: { variant: 'neutral', label: 'To Do' },
    IN_PROGRESS: { variant: 'info', label: 'In Progress' },
    REVIEW: { variant: 'purple', label: 'Review' },
    DONE: { variant: 'success', label: 'Done' },
    BLOCKED: { variant: 'danger', label: 'Blocked' },
  };
  const config = map[status] || { variant: 'neutral' as BadgeVariant, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};