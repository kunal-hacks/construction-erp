import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { truckEntriesApi, projectsApi, vendorsApi, getFileViewUrl, viewSecureFile } from '../api/services';
import {
  PageHeader, Modal, FormField, SearchInput, Pagination,
  LoadingSpinner, EmptyState, ConfirmDialog
} from '../components/common';
import ReceiptUploadField from '../components/common/ReceiptUploadField';
import { useForm } from 'react-hook-form';
import { formatError } from '../api/client';
import toast from 'react-hot-toast';
import {
  HiOutlinePlus, HiOutlineTruck, HiOutlinePencil, HiOutlineTrash, HiOutlineArrowDownTray,
  HiOutlineArrowUpTray, HiOutlineDocumentArrowDown,
} from 'react-icons/hi2';

const MODULE = 'truck-entries';

const todayDateStr = () => new Date().toISOString().split('T')[0];

const pad2 = (n: number) => String(n).padStart(2, '0');
const nowLocalDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
// 12-hour defaults for the "now" prefill
const nowLocal12h = () => {
  const d = new Date();
  let h = d.getHours();
  h = h % 12;
  if (h === 0) h = 12;

  return {
    hour: pad2(h),
    minute: pad2(d.getMinutes()),
  };
};

// Combines separate date + 12-hour time + AM/PM fields into a real Date,
// stored as ISO — this is the single place 12-hour input gets converted to
// the 24-hour value the database actually stores.
const combineLocalDateTime12h = (dateStr?: string, hourStr?: string, minuteStr?: string, ampm?: string): string | null => {
  if (!dateStr || !hourStr || !minuteStr || !ampm) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  let h = Number(hourStr);
  const min = Number(minuteStr);
  if (!y || !m || !d || isNaN(h) || isNaN(min) || h < 1 || h > 12) return null;
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  const combined = new Date(y, m - 1, d, h, min);
  return isNaN(combined.getTime()) ? null : combined.toISOString();
};

// Splits a stored ISO datetime back into local date + 12-hour time + AM/PM,
// for prefilling the edit form.
const splitToLocal12h = (iso?: string | null): { date: string; hour: string; minute: string; ampm: 'AM' | 'PM' } | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  let h = d.getHours();
  const ampm: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    hour: pad2(h),
    minute: pad2(d.getMinutes()),
    ampm,
  };
};

// Always renders in 12-hour format with AM/PM — consistent for every
// entry regardless of whether it came from the manual form or an Excel
// import (imported times with no AM/PM marker are treated as a plain
// 24-hour value and simply displayed in 12-hour form here).
const formatEntryTime = (
  entryTime: string,
  hasAmPm?: boolean
) => {
  if (!entryTime) return '—';

  const d = new Date(entryTime);
  if (isNaN(d.getTime())) return '—';

  const date = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });

  let hour = d.getHours();
  const minute = String(d.getMinutes()).padStart(2, '0');
  const ampm = hour >= 12 ? 'PM' : 'AM';

  hour = hour % 12 || 12;

  const time = `${String(hour).padStart(2, '0')}:${minute}`;

  return `${date}, ${time}${hasAmPm ? ` ${ampm}` : ''}`;
};

const HOURS_12 = Array.from({ length: 12 }, (_, i) => pad2(i + 1));
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => pad2(i));

interface AddVendorFormProps {
  onClose: () => void;
  onSuccess: (vendorId: string) => void;
}

const AddVendorForm: React.FC<AddVendorFormProps> = ({ onClose, onSuccess }) => {
  const qc = useQueryClient();
  const { register, handleSubmit } = useForm();

  const createVendorMutation = useMutation({
    mutationFn: (data: { name: string; phone?: string }) => vendorsApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['vendors-select'] });
      toast.success('Vendor added!');
      const newId = res.data?.data?.id || res.data?.id;
      onSuccess(newId);
      onClose();
    },
    onError: (e: any) => toast.error(formatError(e) || 'Failed to add vendor'),
  });

  return (
    <form onSubmit={handleSubmit((d: any) => createVendorMutation.mutate({ name: d.vendorName, phone: d.vendorPhone }))} className="p-4 sm:p-6 space-y-4">
      <FormField label="Vendor Name" required>
        <input {...register('vendorName', { required: true })} className="input" placeholder="Company or Vendor Name" />
      </FormField>
      <FormField label="Phone Number">
        <input {...register('vendorPhone')} className="input" placeholder="9876543210" />
      </FormField>
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
        <button type="button" onClick={onClose} className="btn-secondary w-full sm:w-auto">Cancel</button>
        <button type="submit" disabled={createVendorMutation.isPending} className="btn-primary w-full sm:w-auto">
          {createVendorMutation.isPending ? 'Adding...' : 'Add Vendor'}
        </button>
      </div>
    </form>
  );
};

const TruckEntriesPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [projectFilter, setProjectFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currentSlip, setCurrentSlip] = useState<{ id: string; originalName: string } | null>(null);

  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['truck-entries', page, projectFilter, search, dateFrom, dateTo],
    queryFn: () => truckEntriesApi.list({
      page, pageSize: 15,
      projectId: projectFilter || undefined,
      vehicleNo: search || undefined,
      startDate: dateFrom || undefined,
      endDate: dateTo || undefined,
    }),
  });

  const { data: summaryData } = useQuery({
    queryKey: ['truck-summary', projectFilter],
    queryFn: () => truckEntriesApi.getSummary({ projectId: projectFilter || undefined }),
  });

  const { data: projectsData } = useQuery({ queryKey: ['projects-select'], queryFn: () => projectsApi.list({ pageSize: 100 }) });
  const { data: vendorsData } = useQuery({ queryKey: ['vendors-select'], queryFn: () => vendorsApi.list({ pageSize: 100 }) });

  const entries = data?.data?.data || [];
  const meta = data?.data?.meta;
  const projects = projectsData?.data?.data || [];
  const vendors = vendorsData?.data?.data || [];
  const summary = summaryData?.data?.data?.summary || summaryData?.data?.data;
  const costInfo = summaryData?.data?.data?.costInfo || { totalCost: 0, transferred: 0, pending: 0 };

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();
  const isEditing = !!editingEntry;

  const {
    register: regTransfer, handleSubmit: handleTransferSub, reset: resetTransfer,
    watch: watchTransfer, setValue: setTransferValue,
    formState: { errors: transferErrors },
  } = useForm({
    defaultValues: { projectId: projectFilter || '', amount: '', date: '' },
  });

  const transferProjectId = watchTransfer('projectId');

  const { data: transferSummaryData } = useQuery({
    queryKey: ['truck-summary-for-transfer', transferProjectId],
    queryFn: () => truckEntriesApi.getSummary({ projectId: transferProjectId }),
    enabled: !!transferProjectId,
  });
  const transferPending = transferSummaryData?.data?.data?.costInfo?.pending ?? 0;

  useEffect(() => {
    if (transferProjectId && transferSummaryData) {
      setTransferValue('amount', transferPending > 0 ? transferPending : '');
    }
  }, [transferProjectId, transferSummaryData]);

  const saveMutation = useMutation({
    mutationFn: (formData: any) => {
      const payload = {
        projectId: formData.projectId,
        vehicleNo: formData.vehicleNo || null, // blank → backend defaults to 'N/A'
        driverName: formData.driverName,
        material: formData.material,
        netWeight: Number(formData.netWeight) / 1000, // form is in kg, backend stores tonnes
        vendorId: formData.vendorId || null,
        entryTime: combineLocalDateTime12h(
  formData.entryDate,
  formData.entryHour,
  formData.entryMinute,
  formData.entryAmPm
) || new Date().toISOString(),

entryTimeHasAmPm:
  formData.entryAmPm === 'AM' ||
  formData.entryAmPm === 'PM',

exitTime: combineLocalDateTime12h(
  formData.exitDate,
  formData.exitHour,
  formData.exitMinute,
  formData.exitAmPm
),

exitTimeHasAmPm:
  formData.exitAmPm === 'AM' ||
  formData.exitAmPm === 'PM',
        slipNo: formData.slipNo || null,
        slipUrl: currentSlip ? getFileViewUrl(currentSlip.id) : (isEditing ? editingEntry.slipUrl || null : null),
        notes: formData.notes || null,
        ratePerTrip: formData.ratePerTrip !== '' ? Number(formData.ratePerTrip) : null,
      };
      return isEditing
        ? truckEntriesApi.update(editingEntry.id, payload)
        : truckEntriesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['truck-entries'] });
      qc.invalidateQueries({ queryKey: ['truck-summary'] });
      toast.success(isEditing ? 'Entry updated!' : 'Entry recorded!');
      setShowCreate(false); setEditingEntry(null); setCurrentSlip(null); reset();
    },
    onError: (e: any) => toast.error(formatError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => truckEntriesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['truck-entries'] });
      qc.invalidateQueries({ queryKey: ['truck-summary'] });
      toast.success('Entry deleted');
      setDeleteId(null);
    },
    onError: (e) => toast.error(formatError(e)),
  });

  const transferMutation = useMutation({
    mutationFn: (data: { projectId: string; amount: number; date?: string }) => truckEntriesApi.transferToExpense(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['truck-summary'] });
      qc.invalidateQueries({ queryKey: ['truck-summary-for-transfer'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Payment recorded!');
      setShowTransfer(false); resetTransfer();
    },
    onError: (e: any) => toast.error(formatError(e) || 'Failed to record payment'),
  });

  const openTransfer = () => {
    resetTransfer({ projectId: projectFilter || '', amount: '', date: '' });
    setShowTransfer(true);
  };

  // ── Excel import ─────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResults, setImportResults] = useState<{
    created: number;
    totalRows: number;
    skipped: { row: number; reason: string }[];
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const importMutation = useMutation({
    mutationFn: (entries: any[]) => truckEntriesApi.import(entries),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['truck-entries'] });
      qc.invalidateQueries({ queryKey: ['truck-summary'] });
    },
    onError: (e: any) => toast.error(formatError(e) || 'Import failed'),
  });

  const handleDownloadTemplate = () => {
    const sample = [{
      'Date': '14-05-2026',
      'Project Name': projects[0]?.name || 'Fedra Palm Villa',
      'Material': 'Quarry Waste',
      'State': 'Gujarat',
      'Purchased From': 'Bapa Sitaram Weigh Bridge',
      'Net Weight (KG)': 41570,
      'Truck No. (Last 4)': '2904',
      'Time': '12:49',
      'Driver Name': '',
      'Slip No': '',
      'Rate per Trip': '',
    }];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Truck Entries');
    XLSX.writeFile(wb, 'truck-entries-import-template.xlsx');
  };

  const excelSerialToUTCDate = (serial: number): Date => {
    return new Date(Math.round((serial - 25569) * 86400 * 1000));
  };

  const parseDateCell = (val: any): { year: number; month: number; day: number } | null => {
    if (val === '' || val === null || val === undefined) return null;
    if (val instanceof Date && !isNaN(val.getTime())) {
      return { year: val.getUTCFullYear(), month: val.getUTCMonth() + 1, day: val.getUTCDate() };
    }
    if (typeof val === 'number') {
      const d = excelSerialToUTCDate(val);
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
    }
    const match = String(val).trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (match) {
      const [, dd, mm, yyRaw] = match;
      const yyyy = yyRaw.length === 2 ? Number(`20${yyRaw}`) : Number(yyRaw);
      return { year: yyyy, month: Number(mm), day: Number(dd) };
    }
    return null;
  };

  // Sheet Time values have no AM/PM marker — treated as-is on a 24-hour
  // clock (standard convention for ambiguous spreadsheet times), and just
  // *displayed* in 12-hour form later via formatEntryTime.
  const parseTimeCell = (
  val: any
): {
  hours: number;
  minutes: number;
  hasAmPm: boolean;
  ampm: 'AM' | 'PM' | '';
} => {
  if (val === '' || val === null || val === undefined) {
    return {
      hours: 0,
      minutes: 0,
      hasAmPm: false,
      ampm: '',
    };
  }

  if (val instanceof Date && !isNaN(val.getTime())) {
    return {
      hours: val.getUTCHours(),
      minutes: val.getUTCMinutes(),
      hasAmPm: false,
      ampm: '',
    };
  }

  if (typeof val === 'number') {
    const totalMinutes = Math.round((val % 1) * 24 * 60);

    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
      hasAmPm: false,
      ampm: '',
    };
  }

  const raw = String(val).trim();

  const ampmMatch = raw.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  );

  if (ampmMatch) {
    return {
      hours: Number(ampmMatch[1]),
      minutes: Number(ampmMatch[2]),
      hasAmPm: true,
      ampm: ampmMatch[3].toUpperCase() as 'AM' | 'PM',
    };
  }

  const match = raw.match(/^(\d{1,2}):(\d{2})$/);

  return match
    ? {
        hours: Number(match[1]),
        minutes: Number(match[2]),
        hasAmPm: false,
        ampm: '',
      }
    : {
        hours: 0,
        minutes: 0,
        hasAmPm: false,
        ampm: '',
      };
};

  const combineDateTime = (
  dateVal: any,
  timeVal: any
): {
  iso: string | null;
  hasAmPm: boolean;
} => {
  const dateParts = parseDateCell(dateVal);

  if (!dateParts) {
    return { iso: null, hasAmPm: false };
  }

  const {
    hours,
    minutes,
    hasAmPm,
    ampm,
  } = parseTimeCell(timeVal);

  let finalHours = hours;

  if (hasAmPm) {
    if (ampm === 'PM' && finalHours !== 12) {
      finalHours += 12;
    }

    if (ampm === 'AM' && finalHours === 12) {
      finalHours = 0;
    }
  }

  const combined = new Date(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    finalHours,
    minutes
  );

  return {
    iso: isNaN(combined.getTime())
      ? null
      : combined.toISOString(),
    hasAmPm,
  };
};

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    let rows: any[] = [];
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } catch (err) {
      toast.error("Could not read that file — make sure it's a valid .xlsx, .xls, or .csv");
      return;
    }

    if (rows.length === 0) {
      toast.error('The selected file has no rows');
      return;
    }
    if (rows.length > 500) {
      toast.error('Import is limited to 500 rows per file');
      return;
    }

    setIsImporting(true);
    try {
      const vendorNameToId: Record<string, string> = {};
      vendors.forEach((v: any) => { vendorNameToId[v.name.trim().toLowerCase()] = v.id; });

      const sheetVendorNames = Array.from(new Set(
        rows.map((r: any) => String(r['Purchased From'] || '').trim()).filter(Boolean)
      ));
      const newVendorNames = sheetVendorNames.filter((name) => !vendorNameToId[name.toLowerCase()]);

      for (const name of newVendorNames) {
        try {
          const res = await vendorsApi.create({ name, phone: '' });
          const newId = res.data?.data?.id || res.data?.id;
          if (newId) vendorNameToId[name.toLowerCase()] = newId;
        } catch (err: any) {
          console.error(`Failed to auto-create vendor "${name}"`, err);
        }
      }
      if (newVendorNames.length > 0) {
        qc.invalidateQueries({ queryKey: ['vendors-select'] });
      }

      const clientSkipped: { row: number; reason: string }[] = [];
      const entries: any[] = [];

      rows.forEach((row, idx) => {
        const rowNum = idx + 2;
        const projectName = String(row['Project Name'] || '').trim();
        // Vehicle No is optional now — blank stays blank here, backend
        // defaults it to 'N/A'.
        const vehicleNo = String(row['Truck No. (Last 4)'] ?? row['Vehicle No'] ?? '').trim();
        const material = String(row['Material'] || '').trim();
        const netWeightKg = row['Net Weight (KG)'] !== undefined ? row['Net Weight (KG)'] : row['Net Weight (kg)'];
        const vendorName = String(row['Purchased From'] || '').trim();
        const state = String(row['State'] || '').trim();
        const driverName = String(row['Driver Name'] || '').trim(); // blank stays blank, backend → 'N/A'

        // Only Project Name, Material, and Net Weight are genuinely required.
        if (!projectName || !material || netWeightKg === '' || netWeightKg === undefined) {
          clientSkipped.push({ row: rowNum, reason: 'Missing a required column (Project Name, Material, or Net Weight)' });
          return;
        }

        const project = projects.find((p: any) => p.name.trim().toLowerCase() === projectName.toLowerCase());
        if (!project) {
          clientSkipped.push({ row: rowNum, reason: `Project "${projectName}" was not found` });
          return;
        }

        const weight = Number(netWeightKg);
        if (isNaN(weight) || weight <= 0) {
          clientSkipped.push({ row: rowNum, reason: 'Net Weight (KG) must be a positive number' });
          return;
        }

        const parsedEntryTime = combineDateTime(
  row['Date'],
  row['Time']
);

if (!parsedEntryTime.iso) {
          clientSkipped.push({ row: rowNum, reason: 'Could not read the Date column (expected DD-MM-YYYY)' });
          return;
        }
        if (new Date(parsedEntryTime.iso) > new Date()) {
          clientSkipped.push({ row: rowNum, reason: 'Entry date/time is in the future' });
          return;
        }

        entries.push({
          projectId: project.id,
          vehicleNo: vehicleNo ? vehicleNo.toUpperCase() : null,
          driverName: driverName || null,
          material,
          netWeight: weight / 1000,
          vendorId: vendorName ? vendorNameToId[vendorName.toLowerCase()] || null : null,
          entryTime: parsedEntryTime.iso,
entryTimeHasAmPm: parsedEntryTime.hasAmPm,
exitTime: null,
exitTimeHasAmPm: false,
          slipNo: String(row['Slip No'] || '').trim() || null,
          ratePerTrip: row['Rate per Trip'] !== '' && row['Rate per Trip'] !== undefined ? Number(row['Rate per Trip']) : null,
          notes: state ? `State: ${state}` : null,
        });
      });

      if (entries.length === 0) {
        setImportResults({ created: 0, totalRows: rows.length, skipped: clientSkipped });
        return;
      }

      const res = await importMutation.mutateAsync(entries);
      const result = res.data?.data || res.data;
      setImportResults({
        created: result.created,
        totalRows: rows.length,
        skipped: [...clientSkipped, ...(result.skipped || [])],
      });
    } catch {
      // importMutation's onError already showed a toast for API failures
    } finally {
      setIsImporting(false);
    }
  };

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    setCurrentSlip(null);
    setValue('projectId', entry.projectId);
    setValue('vehicleNo', entry.vehicleNo === 'N/A' ? '' : entry.vehicleNo);
    setValue('driverName', entry.driverName === 'N/A' ? '' : entry.driverName);
    setValue('material', entry.material);
    setValue('vendorId', entry.vendorId || '');
    setValue('netWeight', Number(entry.netWeight) * 1000);
    setValue('slipNo', entry.slipNo || '');
    setValue('notes', entry.notes || '');
    setValue('ratePerTrip', entry.ratePerTrip ?? '');
    if (entry.entryTime) {
      const parts = splitToLocal12h(entry.entryTime);
      if (parts) {
        setValue('entryDate', parts.date);
        setValue('entryHour', parts.hour);
        setValue('entryMinute', parts.minute);
        setValue(
  'entryAmPm',
  entry.entryTimeHasAmPm ? parts.ampm : ''
);
      }
    }
    if (entry.exitTime) {
      const parts = splitToLocal12h(entry.exitTime);
      if (parts) {
        setValue('exitDate', parts.date);
        setValue('exitHour', parts.hour);
        setValue('exitMinute', parts.minute);
        setValue(
  'exitAmPm',
  entry.exitTimeHasAmPm ? parts.ampm : ''
);
      }
    }
    setShowCreate(true);
  };

  const closeCreate = () => {
    setShowCreate(false); setEditingEntry(null); setCurrentSlip(null); reset();
  };

  const [openingSlip, setOpeningSlip] = useState<string | null>(null);

  const handleViewSlip = async (slipUrl: string, entryId: string) => {
    setOpeningSlip(entryId);
    try {
      await viewSecureFile(slipUrl);
    } catch (e: any) {
      toast.error(formatError(e) || 'Failed to open file');
    } finally {
      setOpeningSlip(null);
    }
  };

  const nowDefaults = nowLocal12h();

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <PageHeader
        title="Truck Entry Management"
        subtitle="Vehicle weighment, material delivery and trip cost tracking"
        action={
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button onClick={handleDownloadTemplate} className="btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto text-sm">
              <HiOutlineDocumentArrowDown className="w-4 h-4" /> Template
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting || importMutation.isPending}
              className="btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto text-sm"
            >
              <HiOutlineArrowUpTray className="w-4 h-4" /> {(isImporting || importMutation.isPending) ? 'Importing...' : 'Import Excel'}
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
            <button onClick={() => { setEditingEntry(null); setCurrentSlip(null); setShowCreate(true); }} className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
              <HiOutlinePlus className="w-4 h-4" /> New Entry
            </button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
          <span className="text-xl sm:text-2xl flex-shrink-0">🚚</span>
          <div className="min-w-0">
            <div className="font-bold text-base sm:text-xl text-gray-900 dark:text-white truncate">{summary?._count?.id || 0}</div>
            <div className="text-xs text-gray-500 truncate">Total Trips</div>
          </div>
        </div>

        <div className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
          <span className="text-xl sm:text-2xl flex-shrink-0">✅</span>
          <div className="min-w-0">
            <div className="font-bold text-base sm:text-xl text-gray-900 dark:text-white truncate">{Number(summary?._sum?.netWeight || 0).toFixed(1)} MT</div>
            <div className="text-xs text-gray-500 truncate">Net Weight</div>
          </div>
        </div>

        {costInfo.pending > 0 ? (
          <button
            onClick={openTransfer}
            className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3 text-left hover:shadow-card-hover transition-shadow"
          >
            <span className="text-xl sm:text-2xl flex-shrink-0">⏳</span>
            <div className="min-w-0">
              <div className="font-bold text-base sm:text-xl text-gray-900 dark:text-white truncate">₹{costInfo.pending.toLocaleString('en-IN')}</div>
              <div className="text-xs text-gray-500 truncate">Pending Payment</div>
              <div className="text-[10px] text-primary-600 font-medium mt-0.5">Tap to settle →</div>
            </div>
          </button>
        ) : (
          <div className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <span className="text-xl sm:text-2xl flex-shrink-0">⏳</span>
            <div className="min-w-0">
              <div className="font-bold text-base sm:text-xl text-gray-900 dark:text-white truncate">₹0</div>
              <div className="text-xs text-gray-500 truncate">Pending Payment</div>
            </div>
          </div>
        )}

        <div className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
          <span className="text-xl sm:text-2xl flex-shrink-0">💰</span>
          <div className="min-w-0">
            <div className="font-bold text-base sm:text-xl text-gray-900 dark:text-white truncate">₹{costInfo.transferred.toLocaleString('en-IN')}</div>
            <div className="text-xs text-gray-500 truncate">Paid Till Now</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search vehicle number..." className="flex-1 sm:min-w-60" />
        <select className="select w-full sm:w-52" value={projectFilter} onChange={e => { setProjectFilter(e.target.value); setPage(1); }}>
          <option value="">All Projects</option>
          {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input flex-1 sm:w-40 text-xs" />
          <span className="text-gray-400 text-sm flex-shrink-0">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input flex-1 sm:w-40 text-xs" />
        </div>
      </div>

      {isLoading ? <LoadingSpinner className="py-20" /> : (
        <>
          <div className="hidden sm:block card">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Entry Time</th><th>Vehicle No</th><th>Driver</th><th>Material</th>
                    <th>Vendor</th><th>Net Weight</th><th>Rate</th><th>Project</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e: any) => (
                    <tr key={e.id}>
                      <td className="text-xs text-gray-500 whitespace-nowrap">
  {formatEntryTime(
    e.entryTime,
    e.entryTimeHasAmPm
  )}
</td>
                      <td className="font-mono font-bold whitespace-nowrap">{e.vehicleNo}</td>
                      <td className="whitespace-nowrap">{e.driverName}</td>
                      <td className="whitespace-nowrap">{e.material || '—'}</td>
                      <td className="whitespace-nowrap">{e.Vendor?.name || e.vendor?.name || '—'}</td>
                      <td className="font-bold text-green-600 whitespace-nowrap">{Number(e.netWeight).toFixed(2)} MT</td>
                      <td className="text-sm whitespace-nowrap">{e.ratePerTrip ? `₹${Number(e.ratePerTrip).toLocaleString('en-IN')}` : '—'}</td>
                      <td className="text-sm text-gray-500 whitespace-nowrap">{e.Project?.name || e.project?.name}</td>
                      <td>
                        <div className="flex gap-2">
                          {e.slipUrl && (
                            <button
                              onClick={() => handleViewSlip(e.slipUrl, e.id)}
                              disabled={openingSlip === e.id}
                              className="icon-button text-blue-600"
                              title="Slip / Document"
                            >
                              <HiOutlineArrowDownTray className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => handleEdit(e)} className="icon-button text-amber-600" title="Edit">
                            <HiOutlinePencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteId(e.id)} className="icon-button text-red-500" title="Delete">
                            <HiOutlineTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr><td colSpan={9} className="py-12 text-center">
                      <EmptyState icon={<HiOutlineTruck className="w-10 h-10" />} title="No truck entries" description="Record your first weighment" />
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="sm:hidden space-y-3">
            {entries.length > 0 ? entries.map((e: any) => (
              <div key={e.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-sm text-gray-900 dark:text-white">{e.vehicleNo}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
  {formatEntryTime(
    e.entryTime,
    e.entryTimeHasAmPm
  )}
</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-green-600 text-sm">{Number(e.netWeight).toFixed(2)} MT</div>
                    <div className="text-xs text-gray-400">net weight</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div>
                    <div className="text-gray-400">Driver</div>
                    <div className="text-gray-700 dark:text-gray-300 truncate">{e.driverName || '—'}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Material</div>
                    <div className="text-gray-700 dark:text-gray-300 truncate">{e.material || '—'}</div>
                  </div>
                </div>

                {e.ratePerTrip && (
                  <div className="mt-2 text-xs text-gray-500">
                    Rate: <span className="font-medium text-gray-700 dark:text-gray-300">₹{Number(e.ratePerTrip).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-1 truncate">
                  📁 {e.Project?.name || e.project?.name || '—'}
                  {(e.Vendor?.name || e.vendor?.name) && <> · {e.Vendor?.name || e.vendor?.name}</>}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                  <button onClick={() => handleEdit(e)} className="btn-secondary flex-1 justify-center text-xs py-1.5 text-amber-600">
                    <HiOutlinePencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  {e.slipUrl && (
                    <button
                      onClick={() => handleViewSlip(e.slipUrl, e.id)}
                      disabled={openingSlip === e.id}
                      className="btn-secondary flex-1 justify-center text-xs py-1.5 text-blue-600"
                    >
                      <HiOutlineArrowDownTray className="w-3.5 h-3.5" /> Slip
                    </button>
                  )}
                  <button onClick={() => setDeleteId(e.id)} className="btn-secondary flex-1 justify-center text-xs py-1.5 text-red-500">
                    <HiOutlineTrash className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            )) : (
              <div className="card">
                <EmptyState icon={<HiOutlineTruck className="w-10 h-10" />} title="No truck entries" description="Record your first weighment" />
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

      {/* Create / Edit Modal */}
      <Modal isOpen={showCreate} onClose={closeCreate}
        title={isEditing ? 'Edit Truck Entry' : 'New Truck Entry'} size="lg">
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Project" required>
              <select {...register('projectId', { required: true })} className="select">
                <option value="">Select Project</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>

            <FormField label="Entry Date" required>
              <input
                type="date"
                {...register('entryDate', { required: true })}
                max={nowLocalDateStr()}
                defaultValue={nowLocalDateStr()}
                className="input"
              />
            </FormField>

            <FormField label="Entry Time" required className="sm:col-span-2">
              <div className="flex gap-2">
                <select {...register('entryHour', { required: true })} defaultValue={nowDefaults.hour} className="select flex-1">
                  {HOURS_12.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="self-center text-gray-400">:</span>
                <select {...register('entryMinute', { required: true })} defaultValue={nowDefaults.minute} className="select flex-1">
                  {MINUTES_60.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select
  {...register('entryAmPm')}
  defaultValue=""
  className="select w-24"
>
  <option value="">Select</option>
  <option value="AM">AM</option>
  <option value="PM">PM</option>
</select>
              </div>
            </FormField>

            <FormField label="Vehicle Number">
              <input
                {...register('vehicleNo')}
                className="input uppercase"
                placeholder="PB10-CE-3456 (optional)"
                onChange={(e) => {
                  const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  let formatted = raw;
                  if (raw.length > 4) formatted = raw.slice(0, 4) + '-' + raw.slice(4);
                  if (raw.length > 6) formatted = raw.slice(0, 4) + '-' + raw.slice(4, 6) + '-' + raw.slice(6, 10);
                  setValue('vehicleNo', formatted);
                }}
              />
            </FormField>

            <FormField label="Driver Name">
              <input {...register('driverName')} className="input" placeholder="Driver Name (optional)" />
            </FormField>

            <FormField label="Material" required>
              <input {...register('material', { required: true })} className="input" placeholder="e.g. Sand, Cement, Gravel" />
            </FormField>

            <FormField label="Slip No">
              <input {...register('slipNo')} className="input" placeholder="WB-001" />
            </FormField>

            <FormField label="Vendor">
              <div className="flex gap-2">
                <select {...register('vendorId')} className="select flex-1">
                  <option value="">Select Vendor</option>
                  {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowVendorModal(true)} className="btn-secondary px-3 text-sm whitespace-nowrap flex-shrink-0">
                  + Add
                </button>
              </div>
            </FormField>

            <FormField label="Rate per Trip (₹)">
              <input type="number" step="0.01" {...register('ratePerTrip')} className="input" placeholder="3000" />
            </FormField>

            <FormField label="Exit Date">
              <input
                type="date"
                {...register('exitDate')}
                max={nowLocalDateStr()}
                className="input"
              />
            </FormField>

            <FormField label="Exit Time" className="sm:col-span-2">
              <div className="flex gap-2">
                <select {...register('exitHour')} className="select flex-1">
                  <option value="">--</option>
                  {HOURS_12.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="self-center text-gray-400">:</span>
                <select {...register('exitMinute')} className="select flex-1">
                  <option value="">--</option>
                  {MINUTES_60.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select {...register('exitAmPm')} className="select w-24">
                  <option value="">--</option>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </FormField>

            <FormField label="Net Weight (kg)" required className="sm:col-span-2">
              <input type="number" step="1" {...register('netWeight', { required: true, min: 1 })} className="input" placeholder="18300" />
            </FormField>

            <FormField label="" className="sm:col-span-2">
              <ReceiptUploadField
                label="Delivery Slip / Document"
                projectId={undefined}
                requireProject={false}
                module={MODULE}
                value={currentSlip}
                onChange={setCurrentSlip}
              />
              {!currentSlip && isEditing && editingEntry?.slipUrl && (
                <p className="text-xs text-gray-400 mt-1">
                  Existing file attached —{' '}
                  <button
                    type="button"
                    onClick={() => handleViewSlip(editingEntry.slipUrl, editingEntry.id)}
                    className="text-primary-600 hover:underline"
                  >
                    view it
                  </button>, or upload a new one to replace it.
                </p>
              )}
            </FormField>
          </div>

          <FormField label="Notes">
            <textarea {...register('notes')} className="input" rows={2} placeholder="Optional notes..." />
          </FormField>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4">
            <button type="button" onClick={closeCreate} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={saveMutation.isPending} className="btn-primary w-full sm:w-auto sm:min-w-[140px]">
              {saveMutation.isPending ? 'Saving...' : isEditing ? 'Update Entry' : 'Save Entry'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showVendorModal} onClose={() => setShowVendorModal(false)} title="Add New Vendor" size="md">
        <AddVendorForm onClose={() => setShowVendorModal(false)} onSuccess={(vendorId) => setValue('vendorId', vendorId)} />
      </Modal>

      <Modal isOpen={showTransfer} onClose={() => setShowTransfer(false)} title="Record Payment" size="sm">
        <form onSubmit={handleTransferSub(d => {
          transferMutation.mutate({
            projectId: d.projectId,
            amount: Number(d.amount),
            date: d.date || undefined,
          });
        })} className="p-4 sm:p-6 space-y-4">
          <FormField label="Project" required>
            <select {...regTransfer('projectId', { required: true })} className="select">
              <option value="">Select Project</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>

          {transferProjectId && (
            <p className="text-sm text-gray-500">
              Pending balance: <span className="font-bold text-amber-600">₹{transferPending.toLocaleString('en-IN')}</span>
            </p>
          )}

          <FormField label="Amount Paid (₹)" required>
            <input type="number" step="0.01" {...regTransfer('amount', { required: true, min: 0.01 })} className="input" placeholder="20000" />
            <p className="text-xs text-gray-400 mt-1">Auto-filled with the pending balance — edit if paying a partial amount.</p>
          </FormField>

          <FormField label="Payment Date (Optional)">
            <input
              type="date"
              {...regTransfer('date', {
                validate: (v) => !v || new Date(v) <= new Date() || 'Payment date cannot be in the future',
              })}
              max={todayDateStr()}
              className="input"
            />
            {transferErrors.date && <p className="text-xs text-red-500 mt-1">{transferErrors.date.message as string}</p>}
            <p className="text-xs text-gray-400 mt-1">Leave blank to use today's date. Set this if you're logging a payment made earlier.</p>
          </FormField>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => setShowTransfer(false)} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={transferMutation.isPending} className="btn-primary w-full sm:w-auto">
              {transferMutation.isPending ? 'Saving...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Truck Entry" message="Are you sure you want to delete this entry? This cannot be undone."
        confirmLabel="Delete" variant="danger" isLoading={deleteMutation.isPending} />

      <Modal isOpen={!!importResults} onClose={() => setImportResults(null)} title="Import Results" size="md">
        {importResults && (
          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{importResults.created}</div>
                <div className="text-xs text-gray-500">Imported</div>
              </div>
              <div className="card p-3 text-center">
                <div className="text-2xl font-bold text-amber-600">{importResults.skipped.length}</div>
                <div className="text-xs text-gray-500">Skipped</div>
              </div>
              <div className="card p-3 text-center">
                <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{importResults.totalRows}</div>
                <div className="text-xs text-gray-500">Total Rows</div>
              </div>
            </div>

            {importResults.skipped.length > 0 && (
              <div className="max-h-56 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                {importResults.skipped.map((s, i) => (
                  <div key={i} className="p-2.5 text-xs">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Row {s.row}:</span>{' '}
                    <span className="text-red-500">{s.reason}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={() => setImportResults(null)} className="btn-primary">Done</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TruckEntriesPage;