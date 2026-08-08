import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditLogsApi, usersApi } from '../api/services';
import { PageHeader, SearchInput, Pagination, LoadingSpinner, EmptyState } from '../components/common';
import { HiOutlineShieldCheck, HiOutlineFunnel, HiOutlineChevronDown, HiOutlineChevronUp } from 'react-icons/hi2';

const MODULE_COLORS: Record<string, string> = {
  AUTH: 'bg-blue-100 text-blue-700', USERS: 'bg-purple-100 text-purple-700',
  PROJECTS: 'bg-green-100 text-green-700', EXPENSES: 'bg-orange-100 text-orange-700',
  INVENTORY: 'bg-yellow-100 text-yellow-700', PURCHASE_ORDERS: 'bg-pink-100 text-pink-700',
  DAILY_REPORTS: 'bg-teal-100 text-teal-700', SYSTEM: 'bg-gray-100 text-gray-700',
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'text-green-600', UPDATE: 'text-blue-600', DELETE: 'text-red-600',
  APPROVE: 'text-purple-600', REJECT: 'text-orange-600', LOGIN: 'text-teal-600',
};

type AuditLog = {
  id: string; createdAt: string; action: string; module: string;
  recordId?: string; ipAddress?: string;
  user?: { firstName: string; lastName: string; email: string };
  oldData?: object; newData?: object;
};

// Turns a camelCase/snake_case key into a readable label, e.g.
// "progress" -> "Progress", "dailyWage" -> "Daily Wage"
const formatFieldName = (key: string) =>
  key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, c => c.toUpperCase())
    .trim();

// Formats a single value for display — dates, booleans, and objects get
// special handling so they don't show up as [object Object] or raw ISO strings.
const formatFieldValue = (val: unknown) => {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
    const d = new Date(val);
    return isNaN(d.getTime()) ? val : d.toLocaleDateString('en-IN');
  }
  if (typeof val === 'number') return val.toLocaleString('en-IN');
  return String(val);
};

const AuditLogsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [userFilter, setUserFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, userFilter, moduleFilter, dateFrom, dateTo],
    queryFn: () => auditLogsApi.list({
      page, pageSize: 20, userId: userFilter || undefined,
      module: moduleFilter || undefined,
      startDate: dateFrom || undefined,
      endDate: dateTo || undefined,
    }),
  });
  const { data: usersData } = useQuery({ queryKey: ['users-select'], queryFn: () => usersApi.list({ pageSize: 100 }) });

  const logs = data?.data?.data || [];
  const meta = data?.data?.meta;
  const users = usersData?.data?.data || [];

  const getActionColor = (action: string) => {
    for (const [key, color] of Object.entries(ACTION_COLORS)) {
      if (action.includes(key)) return color;
    }
    return 'text-gray-600';
  };

  const getModuleStyle = (module: string) => MODULE_COLORS[module] || 'bg-gray-100 text-gray-700';

  // Shared before/after diff block — same markup used inside the expanded
  // desktop table row and the expanded mobile card. Renders a simple list of
  // only the fields that actually changed, "Field: old → new", instead of
  // two raw JSON dumps.
  const renderDiff = (log: AuditLog) => {
    const before = (log.oldData || {}) as Record<string, unknown>;
    const after = (log.newData || {}) as Record<string, unknown>;
    const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    const changedKeys = allKeys.filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]));

    if (changedKeys.length === 0) {
      return <p className="text-xs text-gray-400 italic">No field-level changes recorded.</p>;
    }

    return (
      <div className="space-y-1.5">
        {changedKeys.map(key => (
          <div key={key} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="font-medium text-gray-600 dark:text-gray-400 min-w-[100px]">{formatFieldName(key)}:</span>
            {key in before && (
              <span className="text-red-600 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded line-through decoration-red-400">
                {formatFieldValue(before[key])}
              </span>
            )}
            {key in before && key in after && <span className="text-gray-400">→</span>}
            {key in after && (
              <span className="text-green-700 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded font-medium">
                {formatFieldValue(after[key])}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Audit Logs"
        subtitle="Complete record of all system actions and data changes"
      />

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:items-end">
          <div className="col-span-2 sm:flex-1 sm:min-w-40">
            <label className="label text-xs">User</label>
            <select className="select w-full" value={userFilter} onChange={e => { setUserFilter(e.target.value); setPage(1); }}>
              <option value="">All Users</option>
              {Array.isArray(users) && users.map((u: { id: string; firstName: string; lastName: string }) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:flex-1 sm:min-w-40">
            <label className="label text-xs">Module</label>
            <select className="select w-full" value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setPage(1); }}>
              <option value="">All Modules</option>
              {Object.keys(MODULE_COLORS).map(m => <option key={m} value={m}>{m.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input w-full sm:w-36" />
          </div>
          <div>
            <label className="label text-xs">To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input w-full sm:w-36" />
          </div>
          <button onClick={() => { setUserFilter(''); setModuleFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}
            className="btn-secondary text-xs col-span-2 sm:col-span-1">Clear Filters</button>
        </div>
      </div>

      {/* Stats */}
      {meta && (
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="card p-3 sm:p-4 text-center">
            <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{meta.total}</div>
            <div className="text-[10px] sm:text-xs text-gray-500 mt-1">Total Events</div>
          </div>
          <div className="card p-3 sm:p-4 text-center">
            <div className="text-lg sm:text-2xl font-bold text-blue-600">{meta.totalPages}</div>
            <div className="text-[10px] sm:text-xs text-gray-500 mt-1">Pages</div>
          </div>
          <div className="card p-3 sm:p-4 text-center">
            <div className="text-lg sm:text-2xl font-bold text-green-600">{Array.isArray(logs) ? logs.length : 0}</div>
            <div className="text-[10px] sm:text-xs text-gray-500 mt-1">Showing</div>
          </div>
        </div>
      )}

      {isLoading ? <LoadingSpinner className="py-12" /> : (
        <>
          {/* ══════════════ DESKTOP: real table, sm and up ══════════════ */}
          <div className="hidden sm:block table-container">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Module</th><th>Record ID</th><th>IP Address</th><th>Details</th></tr>
                </thead>
                <tbody>
                  {Array.isArray(logs) && logs.map((log: AuditLog) => (
                    <React.Fragment key={log.id}>
                      <tr className="cursor-pointer" onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                        <td className="text-xs text-gray-500 whitespace-nowrap">
                          <div>{new Date(log.createdAt).toLocaleDateString('en-IN')}</div>
                          <div className="text-gray-400">{new Date(log.createdAt).toLocaleTimeString('en-IN')}</div>
                        </td>
                        <td className="whitespace-nowrap">
                          {log.user ? (
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{log.user.firstName} {log.user.lastName}</div>
                              <div className="text-xs text-gray-400">{log.user.email}</div>
                            </div>
                          ) : <span className="text-xs text-gray-400">System</span>}
                        </td>
                        <td className="whitespace-nowrap">
                          <span className={`text-xs font-bold ${getActionColor(log.action)}`}>{log.action}</span>
                        </td>
                        <td className="whitespace-nowrap">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getModuleStyle(log.module)}`}>
                            {log.module}
                          </span>
                        </td>
                        <td className="font-mono text-xs text-gray-400 max-w-[100px] truncate">{log.recordId || '—'}</td>
                        <td className="text-xs text-gray-400 font-mono whitespace-nowrap">{log.ipAddress || '—'}</td>
                        <td className="whitespace-nowrap">
                          {(log.oldData || log.newData) && (
                            <button className="text-xs text-primary-600 hover:underline">
                              {expandedId === log.id ? 'Hide' : 'View'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedId === log.id && (log.oldData || log.newData) && (
                        <tr className="bg-gray-50 dark:bg-gray-800/30">
                          <td colSpan={7} className="px-4 py-3">
                            {renderDiff(log)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {(!logs || logs.length === 0) && (
                    <tr><td colSpan={7}>
                      <EmptyState icon={<HiOutlineShieldCheck className="w-8 h-8" />} title="No audit logs" description="System actions will appear here." />
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ══════════════ MOBILE: card list, below sm ══════════════ */}
          <div className="sm:hidden space-y-3">
            {Array.isArray(logs) && logs.length > 0 ? logs.map((log: AuditLog) => {
              const isExpanded = expandedId === log.id;
              const hasDiff = !!(log.oldData || log.newData);
              return (
                <div key={log.id} className="card p-4">
                  {/* Row 1: action + module badge */}
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-xs font-bold ${getActionColor(log.action)}`}>{log.action}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${getModuleStyle(log.module)}`}>
                      {log.module}
                    </span>
                  </div>

                  {/* Row 2: user */}
                  <div className="mt-2">
                    {log.user ? (
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{log.user.firstName} {log.user.lastName}</div>
                        <div className="text-xs text-gray-400 truncate">{log.user.email}</div>
                      </div>
                    ) : <span className="text-xs text-gray-400">System</span>}
                  </div>

                  {/* Row 3: timestamp / record id / ip mini-grid */}
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div>
                      <div className="text-gray-400">Time</div>
                      <div className="text-gray-700 dark:text-gray-300">
                        {new Date(log.createdAt).toLocaleDateString('en-IN')}<br />
                        <span className="text-gray-400">{new Date(log.createdAt).toLocaleTimeString('en-IN')}</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-gray-400">Record ID</div>
                      <div className="font-mono text-gray-500 truncate">{log.recordId || '—'}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-gray-400">IP</div>
                      <div className="font-mono text-gray-500 truncate">{log.ipAddress || '—'}</div>
                    </div>
                  </div>

                  {/* Row 4: expand toggle + diff */}
                  {hasDiff && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="flex items-center gap-1 text-xs text-primary-600 font-medium"
                      >
                        {isExpanded ? <HiOutlineChevronUp className="w-3.5 h-3.5" /> : <HiOutlineChevronDown className="w-3.5 h-3.5" />}
                        {isExpanded ? 'Hide details' : 'View details'}
                      </button>
                      {isExpanded && <div className="mt-2">{renderDiff(log)}</div>}
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="card">
                <EmptyState icon={<HiOutlineShieldCheck className="w-8 h-8" />} title="No audit logs" description="System actions will appear here." />
              </div>
            )}
          </div>

          {meta && (
            <div className="card overflow-hidden">
              <Pagination page={page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
};
export default AuditLogsPage;