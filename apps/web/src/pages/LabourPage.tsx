import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { labourApi, projectsApi } from '../api/services';
import { PageHeader, Modal, FormField, SearchInput, Pagination, LoadingSpinner, EmptyState, Badge } from '../components/common';
import { useForm } from 'react-hook-form';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineUserGroup, HiOutlineCheckCircle } from 'react-icons/hi2';

const ATTENDANCE_STATUS = ['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE'];
const STATUS_COLORS: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-700 border-green-200',
  ABSENT: 'bg-red-100 text-red-700 border-red-200',
  HALF_DAY: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  ON_LEAVE: 'bg-blue-100 text-blue-700 border-blue-200',
  '': 'bg-gray-100 text-gray-500 border-gray-200',
};

const today = new Date().toISOString().split('T')[0];

const LabourPage: React.FC = () => {
  const [tab, setTab] = useState<'workers' | 'contractors'>('workers');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [showAddLabour, setShowAddLabour] = useState(false);
  const [showAddContractor, setShowAddContractor] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<Record<string, string>>({});
  const qc = useQueryClient();

  const { data: projectsData } = useQuery({ queryKey: ['projects-select'], queryFn: () => projectsApi.list({ pageSize: 100 }) });
  const projects = projectsData?.data?.data || [];

  const { data: labourData, isLoading } = useQuery({
    queryKey: ['labour', page, search, projectFilter],
    queryFn: () => labourApi.list({ page, pageSize: 15, search: search || undefined, projectId: projectFilter || undefined }),
  });
  const { data: contractorsData } = useQuery({ queryKey: ['contractors', projectFilter], queryFn: () => labourApi.getContractors() });

  const labour = labourData?.data?.data || [];
  const meta = labourData?.data?.meta;
  const contractors = contractorsData?.data?.data || [];

  const presentToday = Object.values(todayAttendance).filter(s => s === 'PRESENT' || s === 'HALF_DAY').length;

  const { register: regL, handleSubmit: handleL, reset: resetL } = useForm();
  const { register: regC, handleSubmit: handleC, reset: resetC } = useForm();

  const addLabourMutation = useMutation({
    mutationFn: (d: object) => labourApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['labour'] });
      toast.success('Worker added!');
      setShowAddLabour(false); resetL();
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const addContractorMutation = useMutation({
    mutationFn: (d: object) => labourApi.createContractor(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contractors'] });
      toast.success('Contractor added!');
      setShowAddContractor(false); resetC();
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const attendanceMutation = useMutation({
    mutationFn: (d: object) => labourApi.recordAttendance(d),
    onError: (e) => toast.error(formatError(e)),
  });

  const handleAttendance = (workerId: string, workerName: string, status: string) => {
    if (!status) return;
    setTodayAttendance(prev => ({ ...prev, [workerId]: status }));
    attendanceMutation.mutate({
      labourId: workerId,
      date: today,
      status,
    });
    toast.success(`${workerName}: ${status.replace('_', ' ')}`);
  };

  // Shared attendance <select> — same markup/behavior used in both the
  // desktop table cell and the mobile card, so there's one source of truth.
  const renderAttendanceSelect = (l: any) => {
    const currentStatus = todayAttendance[l.id] || '';
    return (
      <select
        value={currentStatus}
        onChange={e => handleAttendance(l.id, l.name, e.target.value)}
        onClick={e => e.stopPropagation()}
        className={`text-xs font-medium px-2 py-1 rounded-lg border cursor-pointer outline-none transition-colors ${STATUS_COLORS[currentStatus]}`}
      >
        <option value="">— Mark —</option>
        {ATTENDANCE_STATUS.map(s => (
          <option key={s} value={s}>{s.replace('_', ' ')}</option>
        ))}
      </select>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Labour Management"
        subtitle="Workers, contractors and attendance tracking — scoped to your projects"
        action={
          <div className="grid grid-cols-2 sm:flex gap-2">
            <button onClick={() => setShowAddContractor(true)} className="btn-secondary text-xs justify-center">
              <HiOutlinePlus className="w-3.5 h-3.5" /> Contractor
            </button>
            <button onClick={() => setShowAddLabour(true)} className="btn-primary justify-center">
              <HiOutlinePlus className="w-4 h-4" /> Add Worker
            </button>
          </div>
        }
      />

      {/* Summary Strip */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="card p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{meta?.total || 0}</div>
          <div className="text-[10px] sm:text-xs text-gray-500 mt-1">Total Workers</div>
        </div>
        <div className="card p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-2xl font-bold text-primary-600">{Array.isArray(contractors) ? contractors.length : 0}</div>
          <div className="text-[10px] sm:text-xs text-gray-500 mt-1">Contractors</div>
        </div>
        <div className="card p-3 sm:p-4 text-center">
          <div className="text-lg sm:text-2xl font-bold text-green-600">{presentToday}</div>
          <div className="text-[10px] sm:text-xs text-gray-500 mt-1">Present Today</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-full sm:w-fit gap-1">
          {(['workers', 'contractors'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'workers' && (
          <select className="select w-full sm:w-52 text-xs" value={projectFilter} onChange={e => { setProjectFilter(e.target.value); setPage(1); }}>
            <option value="">All My Projects</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* Workers Tab */}
      {tab === 'workers' && (
        <>
          <div className="flex flex-wrap gap-3">
            <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search workers..." className="flex-1 sm:max-w-xs" />
          </div>

          {isLoading ? <LoadingSpinner className="py-12" /> : (
            <>
              {/* ══════════════ DESKTOP: real table, sm and up ══════════════ */}
              <div className="hidden sm:block table-container">
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Worker</th>
                        <th>Project</th>
                        <th>Phone</th>
                        <th>Skill</th>
                        <th>Daily Wage</th>
                        <th>Status</th>
                        <th>Contractor</th>
                        <th>Today's Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(labour) && labour.map((l: any) => (
                        <tr key={l.id}>
                          <td className="font-medium text-sm text-gray-900 dark:text-white whitespace-nowrap">{l.name}</td>
                          <td className="text-sm text-gray-500 whitespace-nowrap">{l.project?.name || <span className="text-xs text-gray-300 italic">Unassigned</span>}</td>
                          <td className="text-sm text-gray-500 whitespace-nowrap">{l.phone || '—'}</td>
                          <td className="text-sm whitespace-nowrap">{l.skill || '—'}</td>
                          <td className="font-medium text-sm whitespace-nowrap">₹{Number(l.dailyWage).toLocaleString('en-IN')}/day</td>
                          <td className="whitespace-nowrap">{l.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Inactive</Badge>}</td>
                          <td className="text-sm text-gray-500 whitespace-nowrap">{l.contractor?.name || <span className="text-xs text-gray-300 italic">Independent</span>}</td>
                          <td className="whitespace-nowrap">{renderAttendanceSelect(l)}</td>
                        </tr>
                      ))}
                      {(!labour || labour.length === 0) && (
                        <tr><td colSpan={8}>
                          <EmptyState icon={<HiOutlineUserGroup className="w-8 h-8" />} title="No workers" description="Add workers to track attendance and wages." />
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ══════════════ MOBILE: card list, below sm ══════════════ */}
              <div className="sm:hidden space-y-3">
                {Array.isArray(labour) && labour.length > 0 ? labour.map((l: any) => (
                  <div key={l.id} className="card p-4">
                    {/* Row 1: name + active status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{l.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5 truncate">
                          {l.project?.name || <span className="italic text-gray-300">Unassigned</span>}
                        </div>
                      </div>
                      {l.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Inactive</Badge>}
                    </div>

                    {/* Row 2: phone / skill / wage mini-grid */}
                    <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                      <div>
                        <div className="text-gray-400">Phone</div>
                        <div className="text-gray-700 dark:text-gray-300 truncate">{l.phone || '—'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Skill</div>
                        <div className="text-gray-700 dark:text-gray-300 truncate">{l.skill || '—'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Daily Wage</div>
                        <div className="font-bold text-gray-900 dark:text-white">₹{Number(l.dailyWage).toLocaleString('en-IN')}</div>
                      </div>
                    </div>

                    {/* Row 3: contractor */}
                    <div className="mt-2 text-xs text-gray-400 truncate">
                      Contractor: {l.contractor?.name || <span className="italic text-gray-300">Independent</span>}
                    </div>

                    {/* Row 4: attendance — the primary daily action, given its own full-width row */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <span className="text-xs text-gray-500">Today's Attendance</span>
                      {renderAttendanceSelect(l)}
                    </div>
                  </div>
                )) : (
                  <div className="card">
                    <EmptyState icon={<HiOutlineUserGroup className="w-8 h-8" />} title="No workers" description="Add workers to track attendance and wages." />
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

          {/* Today's attendance summary */}
          {Object.keys(todayAttendance).length > 0 && (
            <div className="card p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-3">Today's Summary — {new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</div>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {(['PRESENT', 'HALF_DAY', 'ABSENT', 'ON_LEAVE'] as const).map(s => {
                  const count = Object.values(todayAttendance).filter(v => v === s).length;
                  return count > 0 ? (
                    <div key={s} className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${STATUS_COLORS[s]}`}>
                      {s.replace('_', ' ')}: {count}
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Contractors Tab — already a responsive card grid, no change needed */}
      {tab === 'contractors' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.isArray(contractors) && contractors.map((c: any) => (
            <div key={c.id} className="card p-4 sm:p-5">
              <div className="font-semibold text-gray-900 dark:text-white">{c.name}</div>
              <div className="text-sm text-gray-500 mt-1">📞 {c.phone}</div>
              {c.specialty && <div className="text-sm text-gray-500">🔧 {c.specialty}</div>}
              {c.gstNumber && <div className="text-xs font-mono text-gray-400 mt-1">GST: {c.gstNumber}</div>}
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
                {c._count?.labours || 0} worker{c._count?.labours === 1 ? '' : 's'}
              </div>
            </div>
          ))}
          {(!contractors || contractors.length === 0) && (
            <div className="col-span-1 sm:col-span-2 lg:col-span-3"><EmptyState title="No contractors" description="Add contractors to assign workers." /></div>
          )}
        </div>
      )}

      {/* Add Worker Modal */}
      <Modal isOpen={showAddLabour} onClose={() => setShowAddLabour(false)} title="Add Worker" size="md">
        <form onSubmit={handleL(d => addLabourMutation.mutate(d))} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Worker Name" required className="sm:col-span-2">
              <input {...regL('name', { required: true })} className="input" placeholder="Ramesh Kumar" />
            </FormField>
            <FormField label="Project" required className="sm:col-span-2">
              <select {...regL('projectId', { required: true })} className="select">
                <option value="">Select Project</option>
                {Array.isArray(projects) && projects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Phone">
              <input {...regL('phone')} className="input" placeholder="9876543210" />
            </FormField>
            <FormField label="Aadhaar Number">
              <input {...regL('aadharNumber')} className="input" placeholder="XXXX XXXX XXXX" />
            </FormField>
            <FormField label="Skill">
              <select {...regL('skill')} className="select">
                <option value="">Select Skill</option>
                {['Mason', 'Concrete Worker', 'Steel Fixer', 'Carpenter', 'Electrician', 'Plumber', 'Painter', 'Helper', 'Driver', 'Crane Operator', 'Welder'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Daily Wage (₹)" required>
              <input {...regL('dailyWage', { required: true, min: 0 })} type="number" className="input" placeholder="600" />
            </FormField>
            <FormField label="Contractor (Optional)" className="sm:col-span-2">
              <select {...regL('contractorId')} className="select">
                <option value="">Independent (No Contractor)</option>
                {Array.isArray(contractors) && contractors.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Address" className="sm:col-span-2">
              <input {...regL('address')} className="input" placeholder="Home address" />
            </FormField>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => setShowAddLabour(false)} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={addLabourMutation.isPending} className="btn-primary w-full sm:w-auto">
              {addLabourMutation.isPending ? 'Adding...' : 'Add Worker'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Contractor Modal */}
      <Modal isOpen={showAddContractor} onClose={() => setShowAddContractor(false)} title="Add Contractor" size="sm">
        <form onSubmit={handleC(d => addContractorMutation.mutate(d))} className="p-4 sm:p-6 space-y-4">
          <FormField label="Contractor Name" required>
            <input {...regC('name', { required: true })} className="input" placeholder="Sharma Construction Co" />
          </FormField>
          <FormField label="Phone" required>
            <input {...regC('phone', { required: true })} className="input" placeholder="9988776655" />
          </FormField>
          <FormField label="Specialty">
            <input {...regC('specialty')} className="input" placeholder="Civil, Electrical, Plumbing..." />
          </FormField>
          <FormField label="GST Number">
            <input {...regC('gstNumber')} className="input" placeholder="27AABCS5432E1Z1" />
          </FormField>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => setShowAddContractor(false)} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={addContractorMutation.isPending} className="btn-primary w-full sm:w-auto">
              {addContractorMutation.isPending ? 'Adding...' : 'Add Contractor'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LabourPage;