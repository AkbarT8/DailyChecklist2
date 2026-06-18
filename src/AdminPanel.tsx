import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Users, ClipboardList, FileSpreadsheet, Settings, BarChart3,
  CheckCircle2, XCircle, Clock, Search, Download, Trash2,
  ChevronDown, ChevronUp, Eye, RefreshCw, Bell, LogOut,
  Shield, Activity, UserCheck, UserX, X, Save,
  Upload, Pencil, Menu, Home, Send,
  ShoppingCart, CreditCard, MessageCircle,
  PackageSearch, AlertCircle,
} from 'lucide-react';
import { supabase } from './lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  clampQtyInput,
  computeAddQty,
  MAX_STOCK_MESSAGE,
  normalizeSearchTerm,
  searchPartsCatalog,
} from './lib/catalogHelpers';
import { PartStockBadge } from './components/PartStockBadge';
import { ClientSearchPicker } from './components/ClientSearchPicker';
import { resolveUnavailableClientName } from './lib/unavailableSearch';
import { importExcelAuto } from './lib/excelCatalogImport';
import {
  deleteClientPriceListFile,
  fetchClientCatalogStoredFiles,
  type ClientCatalogStoredFile,
  uploadClientPriceList,
} from './lib/clientPriceList';
import { sendClientFile } from './lib/sendClientFile';
import { deleteUserAccount, isDeletedUserProfile } from './lib/deleteUser';
import { createSalesmanAccount } from './lib/createSalesman';
import { openWhatsApp } from './lib/openWhatsApp';
import { BrandLogoBadge } from './lib/brandLogo';
import { CatalogQtyInput } from './components/CatalogQtyInput';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  full_name: string;
  company_name: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  email: string;
  is_admin: boolean;
  registration_status: string;
  rejection_reason?: string | null;
  created_at: string;
}

interface UserRequest {
  id: string;
  user_id: string;
  type: string;
  query: string;
  file_url: string | null;
  admin_note: string | null;
  status: string;
  created_at: string;
  profiles?: { full_name: string; company_name: string; email: string; registration_status?: string } | null;
}

interface AdminLog {
  id: string;
  action: string;
  target_type: string;
  details: string;
  created_at: string;
}

interface Stats {
  totalUsers: number;
  pendingRegistrations: number;
  newRequests: number;
  activeRequests: number;
}

type AdminTab = 'dashboard' | 'registrations' | 'users' | 'requests' | 'catalog' | 'files' | 'unavailable' | 'salesmen' | 'logs' | 'settings';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const REQUEST_TYPE_LABELS: Record<string, string> = {
  catalog_search: 'Catalog Search',
  catalog_request: 'Catalog Request',
  excel_request: 'Excel Request',
  pricelist_request: 'Price List',
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  processed: 'Completed',
};

const REQUEST_TYPE_HELP: Record<string, string> = {
  catalog_search: 'Client searched the catalog',
  catalog_request: 'Client asked for catalog access',
  excel_request: 'Client uploaded an Excel parts list',
  pricelist_request: 'Client requested a price list by brand',
};

const CLIENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  processed: 'bg-green-100 text-green-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

function Badge({ status, label }: { status: string; label?: string }) {
  const display = label || status.replace('_', ' ');
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}`}>
      {display}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-black text-gray-900">{value}</p>
        <p className="text-sm font-semibold text-gray-600">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl max-w-sm text-sm font-medium ${styles[type]}`}
      style={{ animation: 'slideInUp 0.3s ease' }}
    >
      {type === 'success' ? <CheckCircle2 size={16} className="flex-shrink-0" /> : type === 'error' ? <XCircle size={16} className="flex-shrink-0" /> : <Bell size={16} className="flex-shrink-0" />}
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity"><X size={14} /></button>
    </div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-bold text-papco-navy text-lg">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab({ stats, requests, users, onNavigate }: {
  stats: Stats; requests: UserRequest[]; users: Profile[];
  onNavigate: (tab: AdminTab) => void;
}) {
  const recentRequests = requests.slice(0, 6);
  const pendingUsers = users.filter(u => !u.is_admin && u.registration_status === 'pending').slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button onClick={() => onNavigate('users')} className="text-left">
          <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="bg-papco-navy" />
        </button>
        <button onClick={() => onNavigate('registrations')} className="text-left">
          <StatCard icon={Clock} label="Pending Approvals" value={stats.pendingRegistrations} sub="awaiting review" color="bg-amber-500" />
        </button>
        <button onClick={() => onNavigate('requests')} className="text-left">
          <StatCard icon={Bell} label="New Requests" value={stats.newRequests} sub="unprocessed" color="bg-papco-red" />
        </button>
        <button onClick={() => onNavigate('requests')} className="text-left">
          <StatCard icon={Activity} label="In Progress" value={stats.activeRequests} sub="being handled" color="bg-blue-500" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-papco-navy text-sm">Latest Requests</h3>
            <button onClick={() => onNavigate('requests')} className="text-xs text-papco-red hover:underline font-medium">View all</button>
          </div>
          <div className="divide-y divide-gray-50">
            {recentRequests.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No requests yet</p>}
            {recentRequests.map(r => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{REQUEST_TYPE_LABELS[r.type] || r.type}</p>
                  <p className="text-xs text-gray-400 truncate">{r.profiles?.company_name || '—'}</p>
                </div>
                <Badge status={r.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-papco-navy text-sm">Pending Registrations</h3>
            <button onClick={() => onNavigate('registrations')} className="text-xs text-papco-red hover:underline font-medium">View all</button>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingUsers.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No pending registrations</p>}
            {pendingUsers.map(u => (
              <div key={u.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{u.full_name}</p>
                  <p className="text-xs text-gray-400">{u.company_name} · {u.country}</p>
                </div>
                <Badge status="pending" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Users Tab ─────────────────────────────────────────────────────────────────

async function callApproveUser(userId: string, action: 'approve' | 'reject', reason = '') {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const params = new URLSearchParams({ userId, action });
  if (reason) params.set('reason', reason);
  try {
    await fetch(`${supabaseUrl}/functions/v1/approve-user?${params.toString()}`, {
      headers: { Authorization: `Bearer ${supabaseAnonKey}` },
    });
  } catch {
    // non-critical — DB update is the source of truth
  }
}

function UsersTab({ users, onRefresh, logAction }: {
  users: Profile[];
  onRefresh: () => void;
  logAction: (action: string, targetType: string, targetId: string, details: string) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [rejectModal, setRejectModal] = useState<Profile | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const filtered = users.filter(u => {
    if (u.is_admin) return false;
    const matchSearch = !search || [u.full_name, u.company_name, u.email, u.country]
      .some(f => f?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = filterStatus === 'all' || u.registration_status === filterStatus;
    return matchSearch && matchStatus;
  });

  const updateStatus = async (userId: string, status: 'approved' | 'rejected', reason = '') => {
    const updatePayload: Record<string, string | null> = { registration_status: status };
    if (status === 'rejected') updatePayload.rejection_reason = reason || null;
    if (status === 'approved') updatePayload.rejection_reason = null;

    const { error } = await supabase.from('profiles').update(updatePayload).eq('id', userId);
    if (!error) {
      await logAction(status === 'approved' ? 'approve_user' : 'reject_user', 'user', userId, `Registration ${status}${reason ? `: ${reason}` : ''}`);
      await callApproveUser(userId, status === 'approved' ? 'approve' : 'reject', reason);
      setToast({ message: `User ${status} — notification email sent`, type: 'success' });
      setSelectedUser(null);
      setRejectModal(null);
      setRejectReason('');
      onRefresh();
    } else {
      setToast({ message: 'Failed to update status', type: 'error' });
    }
  };

  const saveEdit = async () => {
    if (!editUser) return;
    const { error } = await supabase.from('profiles').update({
      full_name: editUser.full_name, company_name: editUser.company_name,
      phone: editUser.phone, country: editUser.country, city: editUser.city, address: editUser.address,
    }).eq('id', editUser.id);
    if (!error) {
      await logAction('edit_user', 'user', editUser.id, `Edited profile: ${editUser.full_name}`);
      setToast({ message: 'User updated', type: 'success' });
      setEditUser(null);
      onRefresh();
    } else {
      setToast({ message: 'Failed to update', type: 'error' });
    }
  };

  const deleteUser = async (u: Profile) => {
    if (!confirm(`Delete user "${u.full_name}" completely? This action cannot be undone.`)) return;
    const result = await deleteUserAccount(u.id);
    if (!result.ok) {
      setToast({ message: result.error || 'Failed to delete user', type: 'error' });
      return;
    }
    await logAction('delete_user', 'user', u.id, `Deleted user: ${u.full_name} (${u.email})`);
    if (selectedUser?.id === u.id) setSelectedUser(null);
    if (editUser?.id === u.id) setEditUser(null);
    if (rejectModal?.id === u.id) {
      setRejectModal(null);
      setRejectReason('');
    }
    setToast({ message: 'User deleted', type: 'success' });
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, company, email..."
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-papco-navy/20 focus:border-papco-navy transition-all" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-papco-navy/20 focus:border-papco-navy">
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">No users found</td></tr>
              )}
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900 text-sm">{u.full_name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-600 text-sm">{u.company_name}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">{u.city}, {u.country}</td>
                  <td className="px-4 py-3"><Badge status={u.registration_status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSelectedUser(u)} title="View"
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"><Eye size={15} /></button>
                      <button onClick={() => setEditUser({ ...u })} title="Edit"
                        className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500 transition-colors"><Pencil size={15} /></button>
                      {u.registration_status === 'pending' && (<>
                        <button onClick={() => updateStatus(u.id, 'approved')} title="Approve"
                          className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"><UserCheck size={15} /></button>
                        <button onClick={() => { setRejectModal(u); setRejectReason(''); }} title="Reject"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"><UserX size={15} /></button>
                      </>)}
                      {u.registration_status === 'approved' && (
                        <button onClick={() => { setRejectModal(u); setRejectReason(''); }} title="Revoke access"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"><UserX size={15} /></button>
                      )}
                      <button onClick={() => deleteUser(u)} title="Delete user"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUser && (
        <Modal title="User Details" onClose={() => setSelectedUser(null)}>
          <div className="space-y-0 divide-y divide-gray-50">
            {[
              ['Full Name', selectedUser.full_name],
              ['Company', selectedUser.company_name],
              ['Email', selectedUser.email],
              ['Phone', selectedUser.phone],
              ['Country', selectedUser.country],
              ['City', selectedUser.city],
              ['Address', selectedUser.address],
              ['Registered', new Date(selectedUser.created_at).toLocaleDateString()],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">{label}</span>
                <span className="text-sm text-gray-800 text-right">{value}</span>
              </div>
            ))}
            <div className="flex justify-between py-3 items-center">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</span>
              <Badge status={selectedUser.registration_status} />
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            {selectedUser.registration_status !== 'approved' && (
              <button onClick={() => updateStatus(selectedUser.id, 'approved')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
                <CheckCircle2 size={15} /> Approve
              </button>
            )}
            {selectedUser.registration_status !== 'rejected' && (
              <button onClick={() => { setRejectModal(selectedUser); setSelectedUser(null); setRejectReason(''); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">
                <XCircle size={15} /> Reject
              </button>
            )}
          </div>
        </Modal>
      )}

      {editUser && (
        <Modal title="Edit User" onClose={() => setEditUser(null)}>
          <div className="space-y-3">
            {(['full_name', 'company_name', 'phone', 'country', 'city', 'address'] as const).map(field => (
              <div key={field} className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{field.replace('_', ' ')}</label>
                <input value={editUser[field]}
                  onChange={e => setEditUser(u => u ? { ...u, [field]: e.target.value } : u)}
                  className="px-3 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-papco-navy/20 focus:border-papco-navy transition-all" />
              </div>
            ))}
            <button onClick={saveEdit}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-papco-navy text-white text-sm font-semibold hover:bg-papco-navy-dark transition-colors mt-2">
              <Save size={15} /> Save Changes
            </button>
          </div>
        </Modal>
      )}

      {rejectModal && (
        <Modal title="Reject Registration" onClose={() => { setRejectModal(null); setRejectReason(''); }}>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-red-50 border border-red-100">
              <p className="text-sm font-semibold text-gray-800">{rejectModal.full_name}</p>
              <p className="text-xs text-gray-500">{rejectModal.company_name} · {rejectModal.email}</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason for rejection (optional)</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                placeholder="e.g. Incomplete information, duplicate account, etc."
                className="px-3 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 resize-none transition-all"
              />
              <p className="text-xs text-gray-400">This reason will be included in the rejection email sent to the user.</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => updateStatus(rejectModal.id, 'rejected', rejectReason)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">
                <XCircle size={15} /> Confirm Rejection
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Requests Tab ──────────────────────────────────────────────────────────────

function RequestsTab({ requests, onRefresh, logAction }: {
  requests: UserRequest[];
  onRefresh: () => void;
  logAction: (action: string, targetType: string, targetId: string, details: string) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<UserRequest | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const filtered = requests
    .filter(r => {
      const matchSearch = !search || [r.query, r.profiles?.full_name, r.profiles?.company_name, r.profiles?.email]
        .some(f => f?.toLowerCase().includes(search.toLowerCase()));
      const matchType = filterType === 'all' || r.type === filterType;
      const matchStatus = filterStatus === 'all' || r.status === filterStatus;
      return matchSearch && matchType && matchStatus;
    })
    .sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortAsc ? diff : -diff;
    });

  const updateStatus = async (reqId: string, status: string) => {
    const { error } = await supabase.from('user_requests').update({ status }).eq('id', reqId);
    if (!error) {
      await logAction('update_request_status', 'request', reqId, `Status → ${status}`);
      setToast({ message: `Marked as "${status.replace('_', ' ')}"`, type: 'success' });
      onRefresh();
    } else {
      setToast({ message: 'Failed to update', type: 'error' });
    }
  };

  const saveNote = async () => {
    if (!selectedRequest) return;
    const { error } = await supabase.from('user_requests').update({ admin_note: noteInput }).eq('id', selectedRequest.id);
    if (!error) {
      await logAction('add_admin_note', 'request', selectedRequest.id, 'Admin note saved');
      setToast({ message: 'Note saved', type: 'success' });
      onRefresh();
    } else {
      setToast({ message: error.message || 'Failed to save note', type: 'error' });
    }
  };

  const deleteRequest = async (reqId: string) => {
    if (!confirm('Delete this request?')) return;
    const { error } = await supabase.from('user_requests').delete().eq('id', reqId);
    if (!error) {
      await logAction('delete_request', 'request', reqId, 'Request deleted by admin');
      setToast({ message: 'Request deleted', type: 'info' });
      setSelectedRequest(null);
      onRefresh();
    } else {
      setToast({ message: error.message || 'Failed to delete', type: 'error' });
    }
  };

  const markProcessed = async (reqId: string) => {
    await updateStatus(reqId, 'processed');
    setSelectedRequest(null);
  };

  const clearAllRequests = async () => {
    if (!confirm('Delete ALL requests? This cannot be undone.')) return;
    const { error } = await supabase.from('user_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (!error) {
      setToast({ message: 'All requests cleared', type: 'info' });
      onRefresh();
    } else {
      setToast({ message: 'Failed to clear', type: 'error' });
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const inProgressCount = requests.filter(r => r.status === 'in_progress').length;
  const doneCount = requests.filter(r => r.status === 'processed').length;

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
        <h3 className="font-bold text-papco-navy text-base">Client Requests</h3>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          This section lists every request submitted by clients from the platform: price lists, Excel uploads, and catalog inquiries.
          Use it to track who needs a response and what they asked for.
        </p>
        <ul className="mt-3 text-xs text-gray-500 space-y-1 list-disc list-inside">
          <li><strong>Pending</strong> — new, needs your action</li>
          <li><strong>In Progress</strong> — you are working on it</li>
          <li><strong>Completed</strong> — finished (e.g. file sent in File Management)</li>
        </ul>
        <div className="flex flex-wrap gap-3 mt-4">
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">Pending: {pendingCount}</span>
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">In progress: {inProgressCount}</span>
          <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-bold">Completed: {doneCount}</span>
          <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-bold">Total: {requests.length}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search requests..."
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-papco-navy/20 focus:border-papco-navy transition-all" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-papco-navy/20">
          <option value="all">All types</option>
          {Object.entries(REQUEST_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-papco-navy/20">
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="processed">Processed</option>
        </select>
        <button onClick={() => setSortAsc(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          {sortAsc ? <ChevronUp size={15} /> : <ChevronDown size={15} />} Date
        </button>
        {requests.length > 0 && (
          <button onClick={clearAllRequests}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 bg-white text-sm text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={14} /> Clear All
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Request</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Account</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden xl:table-cell">Details</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Workflow</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date / Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No client requests yet</td></tr>
              )}
              {filtered.map(req => (
                <tr key={req.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-papco-navy text-xs">{REQUEST_TYPE_LABELS[req.type] || req.type}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 max-w-[140px]">{REQUEST_TYPE_HELP[req.type] || ''}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="font-medium text-gray-800 text-xs">{req.profiles?.full_name || '—'}</p>
                    <p className="text-gray-400 text-xs">{req.profiles?.company_name}</p>
                    <p className="text-gray-400 text-[10px]">{req.profiles?.email}</p>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <Badge
                      status={req.profiles?.registration_status || 'pending'}
                      label={CLIENT_STATUS_LABELS[req.profiles?.registration_status || ''] || req.profiles?.registration_status || '—'}
                    />
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell text-gray-600 text-xs max-w-[200px]">
                    <p className="line-clamp-2">{req.query || '—'}</p>
                    {req.file_url && <p className="text-[10px] text-papco-navy mt-1">Has attachment</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={req.status} label={REQUEST_STATUS_LABELS[req.status] || req.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    <p>{new Date(req.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <p className="text-gray-400">{new Date(req.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setSelectedRequest(req); setNoteInput(req.admin_note || ''); }} title="View"
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors"><Eye size={15} /></button>
                      {req.status === 'pending' && (
                        <button onClick={() => updateStatus(req.id, 'in_progress')} title="Start"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"><Activity size={15} /></button>
                      )}
                      {req.status !== 'processed' && (
                        <button onClick={() => updateStatus(req.id, 'processed')} title="Complete"
                          className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"><CheckCircle2 size={15} /></button>
                      )}
                      <button onClick={() => deleteRequest(req.id)} title="Delete"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRequest && (
        <Modal title="Client Request — Details" onClose={() => setSelectedRequest(null)}>
          <div className="divide-y divide-gray-50">
            {[
              ['Request type', REQUEST_TYPE_LABELS[selectedRequest.type] || selectedRequest.type],
              ['Purpose', REQUEST_TYPE_HELP[selectedRequest.type] || '—'],
              ['Client name', selectedRequest.profiles?.full_name || '—'],
              ['Company', selectedRequest.profiles?.company_name || '—'],
              ['Client account status', CLIENT_STATUS_LABELS[selectedRequest.profiles?.registration_status || ''] || selectedRequest.profiles?.registration_status || '—'],
              ['Email', selectedRequest.profiles?.email || '—'],
              ['Request details', selectedRequest.query || '—'],
              ['Submitted', new Date(selectedRequest.created_at).toLocaleString()],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">{label}</span>
                <span className="text-sm text-gray-800 text-right break-all">{value}</span>
              </div>
            ))}
            {selectedRequest.file_url && (
              <div className="py-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Client attachment</span>
                <a href={selectedRequest.file_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-papco-navy hover:underline">
                  <Download size={14} /> Open client file
                </a>
              </div>
            )}
            <div className="flex justify-between py-3 items-center">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</span>
              <select defaultValue={selectedRequest.status} onChange={e => updateStatus(selectedRequest.id, e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 outline-none bg-white font-semibold">
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="processed">Processed</option>
              </select>
            </div>
            {selectedRequest.admin_note && (
              <div className="py-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Previous Note</span>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{selectedRequest.admin_note}</p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 pt-3">
            <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              To send a price list: go to <strong>Files</strong> → upload Excel → select this client in &quot;Link to Client&quot;
              → optionally link this request → client will see it under <strong>My Requests</strong>.
            </p>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin Note</label>
            <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)}
              rows={3} placeholder="Add internal note..."
              className="px-3 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-papco-navy/20 focus:border-papco-navy resize-none transition-all" />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={saveNote}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-papco-navy text-white text-sm font-semibold hover:bg-papco-navy-dark transition-colors">
                <Save size={14} /> Save Note
              </button>
              {selectedRequest.status !== 'processed' && (
                <button onClick={() => markProcessed(selectedRequest.id)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
                  <CheckCircle2 size={14} /> Mark Completed
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Registrations Tab ────────────────────────────────────────────────────────

function RegistrationsTab({ users, onRefresh, logAction }: {
  users: Profile[];
  onRefresh: () => void;
  logAction: (action: string, targetType: string, targetId: string, details: string) => Promise<void>;
}) {
  const [filterStatus, setFilterStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [rejectModal, setRejectModal] = useState<Profile | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const registrants = users.filter(u => !u.is_admin);

  const counts = {
    pending: registrants.filter(u => u.registration_status === 'pending').length,
    approved: registrants.filter(u => u.registration_status === 'approved').length,
    rejected: registrants.filter(u => u.registration_status === 'rejected').length,
  };

  const filtered = registrants.filter(u => {
    const matchStatus = filterStatus === 'all' || u.registration_status === filterStatus;
    const matchSearch = !search || [u.full_name, u.company_name, u.email, u.country, u.city]
      .some(f => f?.toLowerCase().includes(search.toLowerCase()));
    return matchStatus && matchSearch;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const updateStatus = async (userId: string, status: 'approved' | 'rejected', reason = '') => {
    const updatePayload: Record<string, string | null> = { registration_status: status };
    if (status === 'rejected') updatePayload.rejection_reason = reason || null;
    if (status === 'approved') updatePayload.rejection_reason = null;

    const { error } = await supabase.from('profiles').update(updatePayload).eq('id', userId);
    if (!error) {
      await logAction(
        status === 'approved' ? 'approve_user' : 'reject_user',
        'user', userId,
        `Registration ${status}${reason ? `: ${reason}` : ''}`
      );
      await callApproveUser(userId, status === 'approved' ? 'approve' : 'reject', reason);
      setToast({ message: `Registration ${status} — email sent to user`, type: 'success' });
      setSelectedUser(null);
      setRejectModal(null);
      setRejectReason('');
      onRefresh();
    } else {
      setToast({ message: 'Failed to update', type: 'error' });
    }
  };

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'pending', label: 'Pending', count: counts.pending, activeColor: 'bg-amber-500 text-white shadow-amber-200', dotColor: 'bg-amber-400' },
          { key: 'approved', label: 'Approved', count: counts.approved, activeColor: 'bg-green-600 text-white shadow-green-200', dotColor: 'bg-green-400' },
          { key: 'rejected', label: 'Rejected', count: counts.rejected, activeColor: 'bg-red-500 text-white shadow-red-200', dotColor: 'bg-red-400' },
          { key: 'all', label: 'All', count: registrants.length, activeColor: 'bg-papco-navy text-white shadow-papco-navy/20', dotColor: 'bg-gray-400' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm
              ${filterStatus === tab.key ? tab.activeColor + ' shadow-md' : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'}`}
          >
            {filterStatus !== tab.key && <span className={`w-2 h-2 rounded-full ${tab.dotColor}`} />}
            {tab.label}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${filterStatus === tab.key ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search registrations..."
          className="w-full pl-8 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-papco-navy/20 focus:border-papco-navy transition-all" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Applicant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Registered</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400 text-sm">
                    <UserCheck size={28} className="mx-auto mb-2 opacity-30" />
                    No {filterStatus === 'all' ? '' : filterStatus} registrations found
                  </td>
                </tr>
              )}
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-gray-900 text-sm">{u.full_name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell text-sm text-gray-600">{u.company_name}</td>
                  <td className="px-4 py-3.5 hidden lg:table-cell text-xs text-gray-500">{u.city}, {u.country}</td>
                  <td className="px-4 py-3.5 hidden sm:table-cell text-xs text-gray-400 whitespace-nowrap">
                    {new Date(u.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge status={u.registration_status} />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSelectedUser(u)} title="View details"
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors">
                        <Eye size={15} />
                      </button>
                      {u.registration_status !== 'approved' && (
                        <button onClick={() => updateStatus(u.id, 'approved')} title="Approve"
                          className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors">
                          <UserCheck size={15} />
                        </button>
                      )}
                      {u.registration_status !== 'rejected' && (
                        <button onClick={() => { setRejectModal(u); setRejectReason(''); }} title="Reject"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                          <UserX size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View details modal */}
      {selectedUser && (
        <Modal title="Registration Details" onClose={() => setSelectedUser(null)}>
          <div className="divide-y divide-gray-50">
            {[
              ['Full Name', selectedUser.full_name],
              ['Company', selectedUser.company_name],
              ['Email', selectedUser.email],
              ['Phone', selectedUser.phone],
              ['Country', selectedUser.country],
              ['City', selectedUser.city],
              ['Address', selectedUser.address],
              ['Registered', new Date(selectedUser.created_at).toLocaleString('en-GB')],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">{label}</span>
                <span className="text-sm text-gray-800 text-right break-all">{value}</span>
              </div>
            ))}
            <div className="flex justify-between py-3 items-center">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</span>
              <Badge status={selectedUser.registration_status} />
            </div>
            {selectedUser.rejection_reason && (
              <div className="py-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Rejection Reason</span>
                <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{selectedUser.rejection_reason}</p>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-4">
            {selectedUser.registration_status !== 'approved' && (
              <button onClick={() => updateStatus(selectedUser.id, 'approved')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
                <CheckCircle2 size={15} /> Approve
              </button>
            )}
            {selectedUser.registration_status !== 'rejected' && (
              <button onClick={() => { setRejectModal(selectedUser); setSelectedUser(null); setRejectReason(''); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">
                <XCircle size={15} /> Reject
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Reject with reason modal */}
      {rejectModal && (
        <Modal title="Reject Registration" onClose={() => { setRejectModal(null); setRejectReason(''); }}>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 space-y-0.5">
              <p className="text-sm font-bold text-gray-900">{rejectModal.full_name}</p>
              <p className="text-xs text-gray-500">{rejectModal.company_name}</p>
              <p className="text-xs text-gray-400">{rejectModal.email}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Reason for rejection <span className="text-gray-400 font-normal normal-case">(optional — sent to user)</span>
              </label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                rows={4} placeholder="e.g. Incomplete information, duplicate account, unable to verify company..."
                className="px-3 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 resize-none transition-all" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => updateStatus(rejectModal.id, 'rejected', rejectReason)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">
                <XCircle size={15} /> Confirm Rejection
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Files Tab ─────────────────────────────────────────────────────────────────

function FilesTab({ adminUserId, users, logAction }: {
  adminUserId: string;
  users: Profile[];
  logAction: (action: string, targetType: string, targetId: string, details: string) => Promise<void>;
}) {
  const [files, setFiles] = useState<ClientCatalogStoredFile[]>([]);
  const [uploadingCatalog, setUploadingCatalog] = useState(false);
  const [sendingFile, setSendingFile] = useState(false);
  const [linkedUserId, setLinkedUserId] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [storedSearch, setStoredSearch] = useState('');
  const catalogInputRef = useRef<HTMLInputElement>(null);
  const sendFileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    const rows = await fetchClientCatalogStoredFiles();
    const missingProfileIds = rows
      .filter(r => !r.profiles?.full_name)
      .map(r => r.user_id);
    if (missingProfileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, company_name')
        .in('id', missingProfileIds);
      const map = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
      setFiles(rows.map(r => ({
        ...r,
        profiles: r.profiles ?? (map[r.user_id]
          ? { full_name: map[r.user_id].full_name, company_name: map[r.user_id].company_name }
          : null),
      })));
      return;
    }
    setFiles(rows);
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  useEffect(() => {
    if (!linkedUserId) {
      return;
    }
  }, [linkedUserId, files]);

  const handleCatalogUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    if (!linkedUserId) {
      setToast({ message: 'Select a client before uploading a price list', type: 'error' });
      if (catalogInputRef.current) catalogInputRef.current.value = '';
      return;
    }
    setUploadingCatalog(true);
    try {
      let successCount = 0;
      let importedTotal = 0;
      for (const file of selected) {
        const result = await uploadClientPriceList(file, linkedUserId, adminUserId);
        if (!result.success) {
          throw new Error(result.error || `Upload failed: ${file.name}`);
        }
        successCount += 1;
        importedTotal += result.inserted ?? 0;
        await logAction(
          'upload_client_catalog',
          'file',
          result.fileId ?? '',
          `Client catalog: ${file.name} (${result.inserted ?? 0} parts)`,
        );
      }
      setToast({
        message: successCount === 1
          ? `Price list imported — ${importedTotal} parts in client catalog`
          : `${successCount} price lists imported — ${importedTotal} parts in client catalog`,
        type: 'success',
      });
      if (catalogInputRef.current) catalogInputRef.current.value = '';
      await loadFiles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setToast({ message: msg, type: 'error' });
    } finally {
      setUploadingCatalog(false);
    }
  };

  const handleSendFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!linkedUserId) {
      setToast({ message: 'Select a client before sending a file', type: 'error' });
      if (sendFileInputRef.current) sendFileInputRef.current.value = '';
      return;
    }
    setSendingFile(true);
    try {
      const sent = await sendClientFile(file, linkedUserId, null);
      if (!sent.success) throw new Error(sent.error || 'Send failed');
      await logAction('send_file', 'file', sent.id ?? sent.file_path ?? '', `Sent to client: ${file.name}`);
      setToast({ message: 'File sent — client can download it in My Requests', type: 'success' });
      if (sendFileInputRef.current) sendFileInputRef.current.value = '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Send failed';
      setToast({ message: msg, type: 'error' });
    } finally {
      setSendingFile(false);
    }
  };

  const handleDelete = async (file: ClientCatalogStoredFile) => {
    if (!confirm(`Delete "${file.filename}"? The client will search the general catalog again.`)) return;
    await deleteClientPriceListFile(file);
    await logAction('delete_file', 'file', file.id, `Deleted client catalog: ${file.filename}`);
    setToast({ message: 'Client price list deleted', type: 'success' });
    loadFiles();
  };

  const filteredStored = files.filter(f =>
    !storedSearch || [f.filename, f.profiles?.full_name, f.profiles?.company_name]
      .some(v => v?.toLowerCase().includes(storedSearch.toLowerCase()))
  );

  const nonAdminUsers = users.filter(u => !u.is_admin);

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Client + actions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <h3 className="font-bold text-papco-navy mb-1">File Management</h3>
          <p className="text-xs text-gray-400">
            Select a client, then send a file to My Requests or upload a price list into their catalog.
          </p>
        </div>

        <ClientSearchPicker
          clients={nonAdminUsers.map(u => ({
            id: u.id,
            full_name: u.full_name,
            company_name: u.company_name,
            email: u.email,
            registration_status: u.registration_status,
          }))}
          value={linkedUserId}
          onChange={setLinkedUserId}
          required
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Send file to client (My Requests) */}
          <div className="rounded-xl border border-gray-100 p-5 space-y-4 bg-gray-50/50">
            <div>
              <h4 className="text-sm font-bold text-papco-navy">Send File to Client</h4>
              <p className="text-xs text-gray-400 mt-1">Excel, PDF, Word — client downloads from My Requests</p>
            </div>
            <label
              className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all
                ${sendingFile || !linkedUserId ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60' : 'border-gray-200 hover:border-papco-navy/40 hover:bg-white'}`}
            >
              <input
                ref={sendFileInputRef}
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv,.pdf,.doc,.docx"
                onChange={handleSendFile}
                disabled={sendingFile || !linkedUserId}
              />
              {sendingFile ? (
                <span className="w-7 h-7 border-2 border-papco-navy/20 border-t-papco-navy rounded-full animate-spin" />
              ) : (
                <>
                  <Send size={20} className="text-papco-navy" />
                  <p className="text-xs font-semibold text-gray-600 text-center">Click to send file</p>
                </>
              )}
            </label>
          </div>

          {/* Upload client catalog price list */}
          <div className="rounded-xl border border-papco-navy/15 p-5 space-y-4 bg-blue-50/30">
            <div>
              <h4 className="text-sm font-bold text-papco-navy">Client Catalog Price List</h4>
              <p className="text-xs text-gray-400 mt-1">Excel/CSV — parts appear only in this client&apos;s catalog search</p>
            </div>
            <label
              className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all
                ${uploadingCatalog || !linkedUserId ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60' : 'border-papco-navy/30 hover:border-papco-navy/50 hover:bg-white'}`}
            >
              <input
                ref={catalogInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".xlsx,.xls,.csv"
                onChange={handleCatalogUpload}
                disabled={uploadingCatalog || !linkedUserId}
              />
              {uploadingCatalog ? (
                <span className="w-7 h-7 border-2 border-papco-navy/20 border-t-papco-navy rounded-full animate-spin" />
              ) : (
                <>
                  <Upload size={20} className="text-papco-navy" />
                  <p className="text-xs font-semibold text-gray-600 text-center">Click to upload price list</p>
                </>
              )}
            </label>
          </div>
        </div>
      </div>

      {/* Stored Files — client catalog price lists only */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <h3 className="font-bold text-papco-navy text-sm">Stored Files ({filteredStored.length})</h3>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={storedSearch} onChange={e => setStoredSearch(e.target.value)} placeholder="Search files..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 outline-none focus:ring-1 focus:ring-papco-navy/20 focus:border-papco-navy w-44" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Filename</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Size</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredStored.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No client catalog price lists yet</td></tr>
              )}
              {filteredStored.map(f => (
                <tr key={f.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet size={15} className="text-green-500 flex-shrink-0" />
                      <span className="font-medium text-gray-800 text-xs truncate max-w-[160px]">{f.filename}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {f.profiles ? (
                      <div>
                        <p className="text-xs font-medium text-gray-700">{f.profiles.full_name}</p>
                        <p className="text-xs text-gray-400">{f.profiles.company_name}</p>
                      </div>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                      Active
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">{formatBytes(f.file_size)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{new Date(f.uploaded_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDelete(f)} title="Delete"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Logs Tab ──────────────────────────────────────────────────────────────────

function LogsTab({ logs }: { logs: AdminLog[] }) {
  const [search, setSearch] = useState('');
  const filtered = logs.filter(l =>
    !search || [l.action, l.target_type, l.details].some(f => f?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <h3 className="font-bold text-papco-navy text-sm">Activity Log ({logs.length})</h3>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter logs..."
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 outline-none focus:ring-1 focus:ring-papco-navy/20 focus:border-papco-navy w-40" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Target</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Details</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="text-center py-10 text-gray-400 text-sm">No activity logged yet</td></tr>
            )}
            {filtered.map(log => (
              <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-800 text-xs capitalize">{log.action.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{log.target_type}</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-gray-400 text-xs max-w-[250px] truncate">{log.details}</td>
                <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Catalog shared types & utils ─────────────────────────────────────────────

interface PartResult {
  id: string;
  part_number: string;
  brand: string | null;
  description: string | null;
  category: string | null;
  price: number | null;
  stock: number | null;
  coo: string | null;
  extra: Record<string, unknown> | null;
  source_file?: string | null;
}

interface CartItem {
  part: PartResult;
  qty: number;
}

const USD_TO_AED = 3.65;

function convertPrice(priceAed: number | null, currency: 'AED' | 'USD'): string {
  if (priceAed == null) return '—';
  if (currency === 'AED') return `${priceAed.toFixed(2)} AED`;
  return `$${(priceAed / USD_TO_AED).toFixed(2)}`;
}

async function exportCartToExcel(items: CartItem[], filename: string, currency: 'AED' | 'USD') {
  const XLSX = await import('xlsx-js-style');
  const sym = currency === 'AED' ? 'AED' : 'USD';

  const total = items.reduce((sum, item) => {
    if (item.part.price == null) return sum;
    return sum + (currency === 'AED' ? item.part.price : item.part.price / USD_TO_AED) * item.qty;
  }, 0);

  const border = {
    top:    { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left:   { style: 'thin', color: { rgb: '000000' } },
    right:  { style: 'thin', color: { rgb: '000000' } },
  };

  const hStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
    fill: { patternType: 'solid', fgColor: { rgb: '1B4332' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    border,
  };

  const COLS = 6;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ws: any = {};

  ['Part Number', 'Brand', 'Description', `Price (${sym})`, 'Qty', `Total (${sym})`].forEach((h, c) => {
    ws[XLSX.utils.encode_cell({ r: 0, c })] = { v: h, t: 's', s: hStyle };
  });

  items.forEach((item, i) => {
    const r = i + 1;
    const bg = r % 2 === 0 ? 'EAF4EE' : 'FFFFFF';
    const st = {
      font: { sz: 10 },
      fill: { patternType: 'solid', fgColor: { rgb: bg } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border,
    };
    const unitPrice = item.part.price != null
      ? +(currency === 'AED' ? item.part.price : item.part.price / USD_TO_AED).toFixed(2)
      : null;
    const rowTotal = unitPrice != null ? +(unitPrice * item.qty).toFixed(2) : null;
    const vals: (string | number)[] = [item.part.part_number, item.part.brand || '', item.part.description || '', unitPrice ?? '', item.qty, rowTotal ?? ''];
    vals.forEach((v, c) => {
      ws[XLSX.utils.encode_cell({ r, c })] = {
        v, t: typeof v === 'number' ? 'n' : 's',
        z: (c === 3 || c === 5) && typeof v === 'number' ? '#,##0.00' : undefined,
        s: st,
      };
    });
  });

  const totalR = items.length + 1;
  const totalSt = {
    font: { bold: true, sz: 11 },
    fill: { patternType: 'solid', fgColor: { rgb: 'D1FAE5' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border,
  };
  for (let c = 0; c < COLS; c++) {
    const v = c === COLS - 2 ? 'TOTAL' : c === COLS - 1 ? +total.toFixed(2) : '';
    ws[XLSX.utils.encode_cell({ r: totalR, c })] = {
      v, t: c === COLS - 1 ? 'n' : 's',
      z: c === COLS - 1 ? '#,##0.00' : undefined,
      s: totalSt,
    };
  }

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalR, c: COLS - 1 } });
  ws['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 40 }, { wch: 14 }, { wch: 8 }, { wch: 14 }];
  ws['!rows'] = Array.from({ length: totalR + 1 }, (_, i) => ({ hpt: i === 0 ? 22 : 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Order');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Catalog Tab ───────────────────────────────────────────────────────────────

interface CatalogUpload {
  id: string;
  filename: string;
  row_count: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

function CatalogTab({ adminUserId: _adminUserId }: { adminUserId: string }) {
  // ── Search & cart state (same as client view) ──
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PartResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [catalogEmpty, setCatalogEmpty] = useState(false);
  const [selectedPart, setSelectedPart] = useState<PartResult | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartQtyDrafts, setCartQtyDrafts] = useState<Record<string, string>>({});
  const [showCart, setShowCart] = useState(false);
  const [currency, setCurrency] = useState<'AED' | 'USD'>('AED');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);

  const [cardQtys, setCardQtys] = useState<Record<string, string>>({});

  // ── Upload management state ──
  const [showUploadSection, setShowUploadSection] = useState(false);
  const [uploads, setUploads] = useState<CatalogUpload[]>([]);
  const [catalogCount, setCatalogCount] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ file: string; status: 'pending' | 'processing' | 'done' | 'error'; message?: string }[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Duplicate file detection
  const [duplicateModal, setDuplicateModal] = useState<{
    pendingFiles: File[];
    duplicates: string[];
  } | null>(null);

  const countGeneralCatalogParts = useCallback(async (): Promise<number> => {
    const { count } = await supabase
      .from('parts_catalog')
      .select('id', { count: 'exact', head: true })
      .or('source_file.is.null,source_file.not.like.client:%');
    return count ?? 0;
  }, []);

  const loadUploadData = useCallback(async () => {
    const [{ data: uploadData }, { count }] = await Promise.all([
      supabase.from('catalog_uploads').select('*').order('created_at', { ascending: false }).limit(20),
      supabase
        .from('parts_catalog')
        .select('id', { count: 'exact', head: true })
        .or('source_file.is.null,source_file.not.like.client:%'),
    ]);
    if (uploadData) setUploads(uploadData);
    setCatalogCount(count ?? 0);
  }, []);

  useEffect(() => {
    countGeneralCatalogParts().then(count => {
      setCatalogEmpty(count === 0);
      setCatalogCount(count);
    });
  }, [countGeneralCatalogParts]);

  // ── Search logic ──
  const doSearch = useCallback(async (q: string) => {
    const term = normalizeSearchTerm(q);
    if (!term) return;
    setSearching(true);
    setSearched(false);
    try {
      const { data, error } = await searchPartsCatalog(term, 100);
      if (error) {
        setToast({ message: error, type: 'error' });
        setResults([]);
      } else {
        setResults(data ?? []);
      }
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await doSearch(query);
  };

  // ── Cart helpers ──
  const addToCart = (part: PartResult, qty = 1) => {
    const existing = cart.find(i => i.part.id === part.id);
    const { qty: newQty, blocked, atMax, max } = computeAddQty(part.stock, existing?.qty ?? 0, qty);
    if (blocked || newQty < 1) {
      setToast({ message: max === 0 ? 'Out of stock' : MAX_STOCK_MESSAGE(max as number), type: 'error' });
      return;
    }
    setCart(prev => {
      const ex = prev.find(i => i.part.id === part.id);
      if (ex) return prev.map(i => (i.part.id === part.id ? { ...i, qty: newQty } : i));
      return [...prev, { part, qty: newQty }];
    });
    setToast({
      message: atMax && max !== Infinity ? MAX_STOCK_MESSAGE(max as number) : `${part.part_number} added to cart`,
      type: atMax && max !== Infinity ? 'info' : 'success',
    });
  };

  const setCartItemQty = (partId: string, qty: number) => {
    setCart(prev => prev.map(i => {
      if (i.part.id !== partId) return i;
      const maxQty = i.part.stock ?? Infinity;
      return { ...i, qty: Math.min(Math.max(qty, 1), maxQty) };
    }));
  };

  const removeFromCart = (partId: string) => {
    setCart(prev => prev.filter(i => i.part.id !== partId));
    setCartQtyDrafts(prev => {
      const next = { ...prev };
      delete next[partId];
      return next;
    });
  };

  const cartTotal = cart.reduce((sum, item) => {
    if (item.part.price == null) return sum;
    return sum + (currency === 'AED' ? item.part.price : item.part.price / USD_TO_AED) * item.qty;
  }, 0);
  const cartTax = cartTotal * 0.05;
  const cartAmount = cartTotal + cartTax;

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const handleExport = async () => {
    await exportCartToExcel(cart, exportFilename.trim() || 'PAPCO_Cart', currency);
    setShowExportModal(false);
    setExportFilename('');
  };

  // ── Upload logic ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    // Check for duplicates against already-uploaded filenames
    const existingFilenames = new Set(uploads.map(u => u.filename));
    const dupes = selected.map(f => f.name).filter(n => existingFilenames.has(n));
    if (dupes.length > 0) {
      setDuplicateModal({ pendingFiles: selected, duplicates: dupes });
    } else {
      setFiles(selected);
      setProgress(selected.map(f => ({ file: f.name, status: 'pending' as const })));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDuplicateReplace = () => {
    if (!duplicateModal) return;
    setReplaceExisting(true);
    setFiles(duplicateModal.pendingFiles);
    setProgress(duplicateModal.pendingFiles.map(f => ({ file: f.name, status: 'pending' as const })));
    setDuplicateModal(null);
  };

  const handleDuplicateAddNew = () => {
    if (!duplicateModal) return;
    setReplaceExisting(false);
    setFiles(duplicateModal.pendingFiles);
    setProgress(duplicateModal.pendingFiles.map(f => ({ file: f.name, status: 'pending' as const })));
    setDuplicateModal(null);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    let okCount = 0;
    let errCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'processing' } : p));
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || !session.access_token) throw new Error('Not authenticated');

        const result = await importExcelAuto(
          supabase,
          file,
          session.user.id,
          replaceExisting,
          session.access_token,
        );

        if (!result.success || result.error) {
          errCount++;
          const detail = result.lastInsertError ? ` — ${result.lastInsertError}` : '';
          setProgress(prev => prev.map((p, idx) => idx === i ? {
            ...p, status: 'error', message: (result.error || 'Upload failed') + detail,
          } : p));
        } else {
          okCount++;
          const stockCol = result.detectedColumns?.stockCol as string | undefined;
          const codeCols = (result.detectedColumns?.codeColumns as string[] | undefined)?.join(', ')
            || (result.detectedColumns?.partNumberCol as string) || '—';
          const stockNote = stockCol ? ` · Stock: "${stockCol}"` : '';
          const skipped = result.skippedEmpty ?? 0;
          const failed = result.failed ?? 0;
          const via = result.via === 'edge' ? 'server' : 'browser';
          setProgress(prev => prev.map((p, idx) => idx === i ? {
            ...p,
            status: 'done',
            message: `Imported ${result.inserted}/${result.totalRows} parts via ${via} (${skipped} skipped, ${failed} failed) · ${codeCols}${stockNote}`,
          } : p));
        }
      } catch (err) {
        errCount++;
        setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'error', message: String(err) } : p));
      }
    }
    setUploading(false);
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await loadUploadData();
    if (okCount > 0) {
      setCatalogEmpty(false);
      setToast({
        message: errCount > 0 ? 'Import finished with some errors — see details below' : 'Catalog import complete',
        type: errCount > 0 ? 'info' : 'success',
      });
    } else if (errCount > 0) {
      setToast({ message: 'Import failed — check errors below', type: 'error' });
    }
  };

  const handleDeleteFile = async (filename: string) => {
    if (!confirm(`Delete all parts from "${filename}"?`)) return;
    const { error } = await supabase.from('parts_catalog').delete().eq('source_file', filename);
    if (!error) {
      await supabase.from('catalog_uploads').delete().eq('filename', filename);
      setToast({ message: `Deleted all parts from ${filename}`, type: 'success' });
      await loadUploadData();
    } else {
      setToast({ message: 'Delete failed', type: 'error' });
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Delete ALL parts from the catalog? This cannot be undone.')) return;
    const { error } = await supabase.from('parts_catalog').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (!error) {
      await supabase.from('catalog_uploads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      setToast({ message: 'Catalog cleared', type: 'info' });
      await loadUploadData();
      setCatalogEmpty(true);
    }
  };

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Duplicate File Modal ── */}
      {duplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={18} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">File Already Exists</h3>
                <p className="text-xs text-gray-500">This file was uploaded before</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1">
              {duplicateModal.duplicates.map(name => (
                <p key={name} className="text-sm font-mono font-semibold text-papco-navy truncate">{name}</p>
              ))}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              How do you want to proceed?
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={handleDuplicateReplace}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-papco-red text-white text-sm font-bold hover:opacity-90 transition-all">
                Replace previous file
              </button>
              <button onClick={handleDuplicateAddNew}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-papco-navy text-white text-sm font-bold hover:bg-papco-navy-dark transition-all">
                Add as separate file
              </button>
              <button onClick={() => setDuplicateModal(null)}
                className="py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Catalog Search (same as client view) ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-7 space-y-5">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-papco-navy/10 flex items-center justify-center flex-shrink-0">
              <PackageSearch size={20} className="text-papco-navy" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-papco-navy">Search</h2>
              <p className="text-xs text-gray-500">Search by part number, brand number, engine number or description</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Currency toggle */}
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {(['AED', 'USD'] as const).map(c => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all
                    ${currency === c ? 'bg-white text-papco-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {c}
                </button>
              ))}
            </div>
            {/* Cart button */}
            <button onClick={() => setShowCart(true)}
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl bg-papco-navy text-white text-xs font-semibold hover:bg-papco-navy-dark transition-colors shadow-md">
              <ShoppingCart size={15} />
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-papco-red text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {catalogEmpty && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-amber-800">The catalog is empty. Upload an Excel file below to add parts.</p>
          </div>
        )}

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={query}
              onChange={e => { setQuery(e.target.value); if (searched) setSearched(false); }}
              placeholder="Enter part number, brand, or description…"
              className="w-full pl-9 pr-4 py-3 text-sm rounded-xl border border-gray-200 bg-gray-50 outline-none
                focus:ring-2 focus:ring-papco-navy/20 focus:border-papco-navy focus:bg-white transition-all" />
          </div>
          <button type="submit" disabled={searching || !query.trim()}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-white text-sm
              bg-papco-navy hover:bg-papco-navy-dark active:scale-[0.98] transition-all
              shadow-lg shadow-papco-navy/20 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
            {searching ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={15} />}
            Search
          </button>
        </form>

        {searching && (
          <div className="flex items-center justify-center py-10 gap-3 text-gray-400 text-sm">
            <span className="w-5 h-5 border-2 border-gray-200 border-t-papco-navy rounded-full animate-spin" />
            Searching catalog…
          </div>
        )}

        {searched && !searching && (
          results.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                <PackageSearch size={26} className="text-gray-400" />
              </div>
              <div>
                <p className="font-bold text-gray-700">No results found</p>
                <p className="text-sm text-gray-400 mt-1">Part "<em>{query}</em>" is not in the catalog.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 font-medium">
                {results.length} result{results.length !== 1 ? 's' : ''} for "<em>{query}</em>"
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.map(part => {
                  const inCart = cart.some(i => i.part.id === part.id);
                  const cardQtyRaw = cardQtys[part.id] ?? '';
                  const maxStock = part.stock ?? null;
                  const { num: cardQtyNum, overStock } = clampQtyInput(cardQtyRaw, maxStock);
                  const cartLine = cart.find(i => i.part.id === part.id);
                  const atCartMax = maxStock !== null && (cartLine?.qty ?? 0) >= maxStock;
                  const qtyMissing = cardQtyRaw.trim() === '';
                  return (
                    <div key={part.id}
                      className="bg-gray-50 rounded-2xl border border-gray-100 hover:shadow-md hover:border-papco-navy/20 transition-all flex flex-col overflow-hidden">
                      <div className="px-4 pt-4 pb-3 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <PartStockBadge stock={part.stock} />
                          {part.brand && (
                            <BrandLogoBadge brand={part.brand} />
                          )}
                        </div>
                        <p className="font-part-num font-bold text-papco-navy text-base leading-tight mb-2">{part.part_number}</p>
                        {part.description && <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mb-2">{part.description}</p>}
                        {part.category && <p className="text-[10px] text-gray-400 font-medium">{part.category}</p>}
                      </div>
                      <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            {part.price != null
                              ? <p className="font-bold text-papco-navy text-base tabular-nums">{convertPrice(part.price, currency)}</p>
                              : <p className="text-xs text-gray-400 italic">Price on request</p>}
                          </div>
                          <button onClick={() => setSelectedPart(part)}
                            className="text-xs text-gray-400 hover:text-papco-navy font-medium transition-colors underline underline-offset-2">
                            Details
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <CatalogQtyInput
                              value={cardQtyRaw}
                              overStock={overStock}
                              onChange={value => {
                                const { value: next } = clampQtyInput(value, maxStock);
                                setCardQtys(prev => ({ ...prev, [part.id]: next }));
                              }}
                            />
                          </div>
                          <button onClick={() => addToCart(part, cardQtyNum)} disabled={qtyMissing || part.stock === 0 || atCartMax}
                            className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                              ${inCart ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                                qtyMissing || part.stock === 0 || atCartMax ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                                'bg-papco-navy text-white hover:bg-papco-navy-dark shadow-sm'}`}>
                            <ShoppingCart size={12} />
                            {atCartMax ? 'Max' : inCart ? 'Added' : 'Add'}
                          </button>
                        </div>
                        {(overStock || atCartMax) && maxStock !== null && (
                          <p className="text-[10px] text-red-600 font-semibold">{MAX_STOCK_MESSAGE(maxStock)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>

      {/* ── Upload Management (collapsible) ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => { setShowUploadSection(v => !v); if (!showUploadSection) loadUploadData(); }}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-papco-navy/10 flex items-center justify-center">
              <Upload size={16} className="text-papco-navy" />
            </div>
            <div className="text-left">
              <p className="font-bold text-papco-navy text-sm">Upload Management</p>
              <p className="text-xs text-gray-400">{catalogCount.toLocaleString()} parts in catalog</p>
            </div>
          </div>
          {showUploadSection ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>

        {showUploadSection && (
          <div className="px-6 pb-6 border-t border-gray-100 space-y-5 pt-5">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-papco-navy flex items-center justify-center">
                  <FileSpreadsheet size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-xl font-black text-gray-900">{catalogCount.toLocaleString()}</p>
                  <p className="text-xs font-semibold text-gray-500">Total Parts</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-600 flex items-center justify-center">
                  <Upload size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-xl font-black text-gray-900">{uploads.filter(u => u.status === 'completed').length}</p>
                  <p className="text-xs font-semibold text-gray-500">Files Uploaded</p>
                </div>
              </div>
            </div>

            {/* Drop zone */}
            <label className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all
              ${files.length > 0 ? 'border-papco-navy/50 bg-blue-50/50' : 'border-gray-200 bg-gray-50 hover:border-papco-navy/40 hover:bg-blue-50/30'}`}>
              <input ref={fileInputRef} type="file" multiple accept=".xlsx,.xls,.csv"
                className="hidden" onChange={handleFileChange} />
              {files.length > 0 ? (
                <>
                  <CheckCircle2 size={32} className="text-papco-navy" />
                  <div className="text-center">
                    <p className="font-bold text-papco-navy text-sm">{files.length} file{files.length !== 1 ? 's' : ''} selected</p>
                    <p className="text-xs text-gray-500 mt-0.5">{files.map(f => f.name).join(', ')}</p>
                  </div>
                  <span className="text-xs text-papco-navy font-medium">Click to change selection</span>
                </>
              ) : (
                <>
                  <Upload size={32} className="text-gray-300" />
                  <div className="text-center">
                    <p className="font-semibold text-gray-600 text-sm">Drop Excel files here or click to browse</p>
                    <p className="text-xs text-gray-400 mt-1">Supports .xlsx, .xls, .csv — multiple files allowed</p>
                    <p className="text-xs text-gray-400">Each file can contain 10,000+ part codes</p>
                  </div>
                </>
              )}
            </label>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-800">
              <p className="font-semibold mb-1">Auto-detected columns (English &amp; Russian):</p>
              <p><strong>Codes:</strong> Item Code, Part Number, Original Code, Alternative Code, OEM, SKU, reference</p>
              <p><strong>Brand:</strong> brand, manufacturer, make · <strong>Description:</strong> description, name, title</p>
              <p><strong>Price:</strong> price, cost, unitprice · <strong>Stock:</strong> stock, qty, quantity, balance</p>
              <p><strong>COO:</strong> coo, country, origin · All other columns saved as extra data</p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-600">
              <input type="checkbox" checked={replaceExisting} onChange={e => setReplaceExisting(e.target.checked)}
                className="rounded border-gray-300 text-papco-red focus:ring-papco-red" />
              Replace existing data from same filename (re-import)
            </label>

            <button onClick={handleUpload} disabled={uploading || files.length === 0}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-white text-sm
                bg-papco-navy hover:bg-papco-navy-dark active:scale-[0.98] transition-all
                shadow-lg shadow-papco-navy/20 disabled:opacity-50 disabled:cursor-not-allowed">
              {uploading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing…</>
                : <><Upload size={15} /> Import PriceList </>}
            </button>

            {progress.length > 0 && (
              <div className="space-y-2">
                {progress.map((p, i) => (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                    ${p.status === 'done' ? 'bg-green-50 border border-green-200' :
                      p.status === 'error' ? 'bg-red-50 border border-red-200' :
                      p.status === 'processing' ? 'bg-blue-50 border border-blue-200' :
                      'bg-gray-50 border border-gray-200'}`}>
                    {p.status === 'done' && <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />}
                    {p.status === 'error' && <XCircle size={16} className="text-red-500 flex-shrink-0" />}
                    {p.status === 'processing' && <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin flex-shrink-0" />}
                    {p.status === 'pending' && <Clock size={16} className="text-gray-400 flex-shrink-0" />}
                    <span className="font-medium truncate flex-1">{p.file}</span>
                    {p.message && <span className={`text-xs flex-shrink-0 ${p.status === 'error' ? 'text-red-600' : 'text-green-700'}`}>{p.message}</span>}
                  </div>
                ))}
              </div>
            )}

            {uploads.length > 0 && (
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <p className="font-bold text-papco-navy text-xs">Import History</p>
                  <button onClick={handleClearAll}
                    className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 transition-colors">
                    <Trash2 size={12} /> Clear All
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Filename</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Parts</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Date</th>
                        <th className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {uploads.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50/60">
                          <td className="px-4 py-3 font-medium text-gray-800 text-sm max-w-[200px] truncate">{u.filename}</td>
                          <td className="px-4 py-3 font-mono text-sm text-gray-600">{u.row_count.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                              ${u.status === 'completed' ? 'bg-green-100 text-green-700' :
                                u.status === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'}`}>
                              {u.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 hidden sm:table-cell whitespace-nowrap">
                            {new Date(u.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleDeleteFile(u.filename)} title="Delete"
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Cart Drawer ── */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100"
              style={{ background: 'linear-gradient(90deg,#1a1f6e,#252d8a)' }}>
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-white" />
                <h3 className="font-bold text-white">Cart ({cartCount})</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5">
                  {(['AED', 'USD'] as const).map(c => (
                    <button key={c} onClick={() => setCurrency(c)}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all
                        ${currency === c ? 'bg-white text-papco-navy' : 'text-white/70 hover:text-white'}`}>
                      {c}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowCart(false)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                  <ShoppingCart size={40} strokeWidth={1.5} />
                  <p className="text-sm font-medium">Your cart is empty</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.part.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-part-num font-bold text-papco-navy text-sm truncate">{item.part.part_number}</p>
                      {item.part.brand && (
                        <BrandLogoBadge brand={item.part.brand} size="sm" />
                      )}
                      {item.part.price != null && (
                        <p className="text-xs font-bold text-gray-700 mt-0.5">{convertPrice(item.part.price, currency)}</p>
                      )}
                    </div>
                    <input
                      type="number" min="1" max={item.part.stock ?? undefined}
                      value={cartQtyDrafts[item.part.id] ?? String(item.qty)}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        setCartQtyDrafts(prev => ({ ...prev, [item.part.id]: raw }));
                        if (!raw) return;
                        const parsed = parseInt(raw, 10);
                        setCartItemQty(item.part.id, parsed);
                        setCartQtyDrafts(prev => ({ ...prev, [item.part.id]: String(parsed) }));
                      }}
                      onBlur={() => {
                        setCartQtyDrafts(prev => ({ ...prev, [item.part.id]: String(item.qty) }));
                      }}
                      className="w-14 px-2 py-1 text-sm font-bold text-center rounded-lg border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-papco-navy/20 focus:border-papco-navy transition-all"
                    />
                    {item.part.price != null && (
                      <p className="text-xs font-black text-papco-navy w-16 text-right flex-shrink-0">
                        {currency === 'AED'
                          ? `${(item.part.price * item.qty).toFixed(2)} AED`
                          : `$${(item.part.price / USD_TO_AED * item.qty).toFixed(2)}`}
                      </p>
                    )}
                    <button onClick={() => removeFromCart(item.part.id)}
                      className="p-1 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="px-4 py-4 border-t border-gray-100 space-y-3 bg-white">
                {cartTotal > 0 && (
                  <div className="px-3 py-2.5 bg-papco-navy/5 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-600">Total</span>
                      <span className="font-black text-papco-navy text-base">
                        {currency === 'AED' ? `${cartTotal.toFixed(2)} AED` : `$${cartTotal.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-600">Tax (+5%)</span>
                      <span className="font-black text-papco-navy text-base">
                        {currency === 'AED' ? `${cartTax.toFixed(2)} AED` : `$${cartTax.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-papco-navy/10">
                      <span className="text-sm font-semibold text-gray-700">Amount</span>
                      <span className="font-black text-papco-navy text-base">
                        {currency === 'AED' ? `${cartAmount.toFixed(2)} AED` : `$${cartAmount.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setShowExportModal(true)}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors shadow-sm">
                    <Download size={14} /> Create Excel
                  </button>
                  <button onClick={() => setShowPayModal(true)}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-papco-red text-white text-sm font-bold transition-colors shadow-sm hover:opacity-90">
                    <CreditCard size={14} /> Pay
                  </button>
                </div>
                <button onClick={() => setCart([])}
                  className="w-full py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors font-medium">
                  Clear Cart
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Part Detail Modal ── */}
      {selectedPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-papco-navy">Part Details</h3>
              <button onClick={() => setSelectedPart(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-3">
              <div className="bg-papco-navy/5 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Part Number</p>
                <p className="font-part-num font-black text-papco-navy text-xl">{selectedPart.part_number}</p>
              </div>
              {[
                ['Brand', selectedPart.brand],
                ['Description', selectedPart.description],
                ['Category', selectedPart.category],
                ['Price', convertPrice(selectedPart.price, currency)],
              ].filter(([, v]) => v && v !== '—').map(([label, value]) => (
                <div key={label} className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
                  <span className={`text-sm text-right ml-4 ${label === 'Price' ? 'font-black text-papco-navy' : 'text-gray-800'}`}>{value}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Stock</span>
                <span className={`text-sm font-bold text-right ml-4 ${selectedPart.stock != null && selectedPart.stock > 0 ? 'text-green-600' : selectedPart.stock === 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {selectedPart.stock != null ? (selectedPart.stock > 0 ? `${selectedPart.stock} pcs` : 'Out of stock') : '—'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">COO</span>
                <span className="text-sm text-gray-800 text-right ml-4">{selectedPart.coo || '—'}</span>
              </div>
              {Object.entries(selectedPart.extra || {}).filter(([, v]) => v !== '' && v != null).map(([key, value]) => (
                <div key={key} className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{key}</span>
                  <span className="text-sm text-gray-800 text-right ml-4">{String(value)}</span>
                </div>
              ))}
            </div>
            {(() => {
              const detailQty = cardQtys[selectedPart.id] ?? '';
              const detailQtyNum = Math.max(1, parseInt(detailQty) || 1);
              const maxDetailStock = selectedPart.stock ?? null;
              const overDetailStock = maxDetailStock !== null && detailQtyNum > maxDetailStock;
              const detailQtyMissing = detailQty.trim() === '';
              return (
                <div className="px-6 py-4 border-t border-gray-100 space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">Qty</label>
                    <input
                      type="number" min={1} max={maxDetailStock ?? undefined}
                      value={detailQty}
                      onChange={e => {
                        const { value } = clampQtyInput(e.target.value, maxDetailStock);
                        setCardQtys(prev => ({ ...prev, [selectedPart.id]: value }));
                      }}
                      className={`w-20 px-2 py-1.5 text-sm font-bold text-center rounded-lg border outline-none transition-all tabular-nums
                        ${overDetailStock
                          ? 'border-red-300 bg-red-50 text-red-700 focus:ring-2 focus:ring-red-200'
                          : 'border-gray-200 bg-gray-50 focus:ring-2 focus:ring-papco-navy/20 focus:border-papco-navy'}`}
                    />
                    {overDetailStock && maxDetailStock !== null && (
                      <p className="text-[11px] text-red-600 font-semibold">{MAX_STOCK_MESSAGE(maxDetailStock)}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => { if (!overDetailStock && !detailQtyMissing) { addToCart(selectedPart, detailQtyNum); setSelectedPart(null); } }}
                      disabled={detailQtyMissing || overDetailStock || selectedPart.stock === 0}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm
                        ${detailQtyMissing || overDetailStock || selectedPart.stock === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-papco-navy text-white hover:bg-papco-navy-dark'}`}>
                      <ShoppingCart size={13} /> Add to Cart
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Excel Export Modal ── */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Download size={18} className="text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Create Excel File</h3>
                <p className="text-xs text-gray-500">{cart.length} item{cart.length !== 1 ? 's' : ''} in cart</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">File Name</label>
              <input type="text" value={exportFilename}
                onChange={e => setExportFilename(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleExport()}
                placeholder="e.g. My_Parts_Order"
                autoFocus
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 outline-none
                  focus:ring-2 focus:ring-green-200 focus:border-green-400 focus:bg-white transition-all" />
              <p className="text-[11px] text-gray-400 mt-1">Will be saved as .csv (opens in Excel)</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowExportModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleExport}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors shadow-sm">
                <Download size={14} /> Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pay Modal ── */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
              <CreditCard size={26} className="text-papco-navy" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Payment</h3>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                For accurate payment confirmation, please verify the pay method with your manager before proceeding.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPayModal(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                OK
              </button>
              <button
                type="button"
                onClick={() => {
                  openWhatsApp();
                  setShowPayModal(false);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold transition-colors shadow-sm">
                <MessageCircle size={15} /> Manager
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Unavailable Searches Tab ──────────────────────────────────────────────────

interface UnavailableSearch {
  id: string;
  user_id: string | null;
  search_query: string;
  searched_at: string;
  client_name: string;
}

async function exportUnavailablePartsToExcel(items: UnavailableSearch[], filename: string) {
  const XLSX = await import('xlsx-js-style');

  const queryCounts: Record<string, number> = {};
  items.forEach(s => { queryCounts[s.search_query] = (queryCounts[s.search_query] || 0) + 1; });

  const border = {
    top:    { style: 'thin', color: { rgb: 'C5CAE8' } },
    bottom: { style: 'thin', color: { rgb: 'C5CAE8' } },
    left:   { style: 'thin', color: { rgb: 'C5CAE8' } },
    right:  { style: 'thin', color: { rgb: 'C5CAE8' } },
  };

  const titleStyle = {
    font: { bold: true, sz: 14, color: { rgb: '1A1F6E' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  };

  const metaStyle = {
    font: { sz: 10, color: { rgb: '4A5099' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  };

  const hStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
    fill: { patternType: 'solid', fgColor: { rgb: '1A1F6E' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border,
  };

  const COLS = 5;
  const HEADER_ROW = 2;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ws: any = {};

  ws[XLSX.utils.encode_cell({ r: 0, c: 0 })] = {
    v: 'Unavailable Parts Report',
    t: 's',
    s: titleStyle,
  };
  ws[XLSX.utils.encode_cell({ r: 1, c: 0 })] = {
    v: `Generated: ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${items.length} record${items.length !== 1 ? 's' : ''}`,
    t: 's',
    s: metaStyle,
  };

  ['Part Code', 'Client Name', 'Date', 'Time', 'Times Searched'].forEach((h, c) => {
    ws[XLSX.utils.encode_cell({ r: HEADER_ROW, c })] = { v: h, t: 's', s: hStyle };
  });

  items.forEach((s, i) => {
    const r = HEADER_ROW + 1 + i;
    const bg = i % 2 === 0 ? 'FFFFFF' : 'E8EBF5';
    const rowFill = { patternType: 'solid', fgColor: { rgb: bg } };
    const dt = new Date(s.searched_at);
    const dateStr = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const vals: (string | number)[] = [
      s.search_query,
      s.client_name,
      dateStr,
      timeStr,
      queryCounts[s.search_query] || 1,
    ];
    vals.forEach((v, c) => {
      ws[XLSX.utils.encode_cell({ r, c })] = {
        v,
        t: typeof v === 'number' ? 'n' : 's',
        s: {
          fill: rowFill,
          border,
          alignment: {
            horizontal: c === 1 ? 'left' : 'center',
            vertical: 'center',
            wrapText: c === 1,
          },
          font: {
            sz: 10,
            bold: c === 0,
            color: { rgb: c === 0 ? '1A1F6E' : '111827' },
          },
        },
      };
    });
  });

  const lastRow = HEADER_ROW + items.length;
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: COLS - 1 } });
  ws['!cols'] = [{ wch: 22 }, { wch: 32 }, { wch: 14 }, { wch: 10 }, { wch: 16 }];
  ws['!rows'] = [
    { hpt: 24 },
    { hpt: 18 },
    { hpt: 22 },
    ...Array.from({ length: items.length }, () => ({ hpt: 18 })),
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Unavailable Parts');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

function UnavailableSearchesTab() {
  const [searches, setSearches] = useState<UnavailableSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState('');
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const load = async () => {
    setLoading(true);
    let rows: {
      id: string;
      user_id: string | null;
      search_query: string;
      searched_at: string;
      client_name?: string | null;
    }[] = [];

    const primary = await supabase
      .from('unavailable_searches')
      .select('id, user_id, search_query, searched_code, searched_at, client_name')
      .order('searched_at', { ascending: false })
      .limit(500);

    if (primary.error) {
      const fallback = await supabase
        .from('unavailable_searches')
        .select('id, user_id, search_query, searched_at')
        .order('searched_at', { ascending: false })
        .limit(500);
      if (fallback.error) {
        setToast({ message: fallback.error.message, type: 'error' });
        setSearches([]);
        setLoading(false);
        return;
      }
      rows = (fallback.data ?? []).map(s => ({ ...s, client_name: null }));
    } else {
      rows = primary.data ?? [];
    }

    const userIds = [...new Set(rows.map(s => s.user_id).filter(Boolean))] as string[];
    const profileMap: Record<string, { full_name: string; company_name: string; email: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, company_name, email')
        .in('id', userIds);
      if (profiles) {
        for (const p of profiles) {
          profileMap[p.id] = p;
        }
      }
    }

    setSearches(
      rows.map(s => ({
        id: s.id,
        user_id: s.user_id,
        search_query: (s as { searched_code?: string }).searched_code?.trim() || s.search_query,
        searched_at: s.searched_at,
        client_name: resolveUnavailableClientName(s.client_name, s.user_id ? profileMap[s.user_id] : null),
      })),
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('unavailable_searches').delete().eq('id', id);
    if (error) {
      setToast({ message: error.message, type: 'error' });
      return;
    }
    setSearches(prev => prev.filter(s => s.id !== id));
    setToast({ message: 'Entry deleted', type: 'info' });
  };

  const handleClearAll = async () => {
    if (!confirm('Delete all unavailable search records?')) return;
    const { error } = await supabase.from('unavailable_searches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      setToast({ message: error.message, type: 'error' });
      return;
    }
    setSearches([]);
    setToast({ message: 'All records cleared', type: 'info' });
  };

  const filtered = searches.filter(s =>
    !filterQuery
    || s.search_query.toLowerCase().includes(filterQuery.toLowerCase())
    || s.client_name.toLowerCase().includes(filterQuery.toLowerCase()),
  );

  const queryCounts: Record<string, number> = {};
  filtered.forEach(s => { queryCounts[s.search_query] = (queryCounts[s.search_query] || 0) + 1; });

  const handleExport = async () => {
    if (searches.length === 0) return;
    setExporting(true);
    try {
      await exportUnavailablePartsToExcel(searches, exportFilename.trim() || 'Unavailable_Parts');
      setShowExportModal(false);
      setExportFilename('');
      setToast({ message: 'Excel file downloaded', type: 'success' });
    } catch {
      setToast({ message: 'Failed to create Excel file', type: 'error' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
            <Search size={22} className="text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{searches.length}</p>
            <p className="text-sm font-semibold text-gray-500">Total Searches</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
            <Users size={22} className="text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{Object.keys(queryCounts).length}</p>
            <p className="text-sm font-semibold text-gray-500">Unique Codes</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-papco-navy text-sm">Unavailable Parts</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Auto-saved when a client search returns no results</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={filterQuery} onChange={e => setFilterQuery(e.target.value)}
                placeholder="Filter by code or client…"
                className="pl-7 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 outline-none focus:border-papco-navy focus:bg-white transition-all w-40" />
            </div>
            {searches.length > 0 && (
              <button onClick={() => setShowExportModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors shadow-sm">
                <Download size={13} /> Create Excel
              </button>
            )}
            {searches.length > 0 && (
              <button onClick={handleClearAll}
                className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 transition-colors">
                <Trash2 size={13} /> Clear All
              </button>
            )}
            <button onClick={load} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <RefreshCw size={13} className="text-gray-400" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400 text-sm">
            <span className="w-4 h-4 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            {searches.length === 0 ? 'No missing part searches yet' : 'No results match your filter'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Part code searched</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & time</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Times</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <span className="font-part-num font-bold text-papco-navy text-sm">{s.search_query}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-800">{s.client_name}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      <p>{new Date(s.searched_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      <p className="text-gray-400">{new Date(s.searched_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                        ${(queryCounts[s.search_query] || 1) > 2 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {queryCounts[s.search_query] || 1}×
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(s.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Download size={18} className="text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Create Excel File</h3>
                <p className="text-xs text-gray-500">{searches.length} record{searches.length !== 1 ? 's' : ''} · all codes in this section</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">File Name</label>
              <input type="text" value={exportFilename}
                onChange={e => setExportFilename(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !exporting && handleExport()}
                placeholder="e.g. Unavailable_Parts_May"
                autoFocus
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 outline-none
                  focus:ring-2 focus:ring-green-200 focus:border-green-400 focus:bg-white transition-all" />
              <p className="text-[11px] text-gray-400 mt-1">Will be saved as .xlsx</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setShowExportModal(false); setExportFilename(''); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleExport} disabled={exporting}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors shadow-sm disabled:opacity-50">
                {exporting
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Download size={14} />}
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Salesmen Tab ───────────────────────────────────────────────────────────────

interface SalesmanProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  notes: string;
  created_at: string;
}

const MAX_SALESMEN = 10;

function SalesmenTab() {
  const [salesmen, setSalesmen] = useState<SalesmanProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<SalesmanProfile | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('salesman_profiles').select('*').order('created_at');
    setSalesmen((data ?? []) as SalesmanProfile[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditItem(null);
    setForm({ full_name: '', email: '', phone: '', password: '', notes: '' });
    setShowForm(true);
  };

  const openEdit = (s: SalesmanProfile) => {
    setEditItem(s);
    setForm({ full_name: s.full_name, email: s.email, phone: s.phone, password: '', notes: s.notes });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      if (editItem) {
        // Update existing
        const { error } = await supabase.from('salesman_profiles').update({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          notes: form.notes.trim(),
        }).eq('id', editItem.id);
        if (error) throw error;
        setToast({ message: 'Salesman updated', type: 'success' });
      } else {
        if (!form.password || form.password.length < 6) {
          setToast({ message: 'Password must be at least 6 characters', type: 'error' });
          setSaving(false);
          return;
        }
        if (salesmen.length >= MAX_SALESMEN) {
          setToast({ message: `Maximum ${MAX_SALESMEN} salesman accounts allowed`, type: 'error' });
          setSaving(false);
          return;
        }
        await createSalesmanAccount({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
          notes: form.notes.trim(),
        });
        setToast({ message: 'Salesman account created', type: 'success' });
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Error saving', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: SalesmanProfile) => {
    await supabase.from('salesman_profiles').update({ is_active: !s.is_active }).eq('id', s.id);
    setSalesmen(prev => prev.map(p => p.id === s.id ? { ...p, is_active: !p.is_active } : p));
  };

  const handleDelete = async (s: SalesmanProfile) => {
    if (!confirm(`Delete salesman account "${s.full_name}"? This cannot be undone.`)) return;
    await supabase.from('salesman_profiles').delete().eq('id', s.id);
    setSalesmen(prev => prev.filter(p => p.id !== s.id));
    setToast({ message: 'Account deleted', type: 'info' });
  };

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-papco-navy flex items-center justify-center">
              <UserCheck size={18} className="text-white" />
            </div>
            <div>
              <p className="text-xl font-black text-gray-900">{salesmen.length} / {MAX_SALESMEN}</p>
              <p className="text-xs font-semibold text-gray-500">Salesman Accounts</p>
            </div>
          </div>
        </div>
        {salesmen.length < MAX_SALESMEN && (
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-papco-navy text-white text-sm font-bold hover:bg-papco-navy-dark transition-colors shadow-md">
            <UserCheck size={15} /> Add Salesman
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-gray-400 text-sm">
          <span className="w-4 h-4 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" /> Loading…
        </div>
      ) : salesmen.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-12 text-center">
          <p className="text-gray-400 text-sm">No salesman accounts yet. Add up to {MAX_SALESMEN}.</p>
          <button onClick={openAdd}
            className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 rounded-xl bg-papco-navy text-white text-sm font-bold hover:bg-papco-navy-dark transition-colors">
            <UserCheck size={14} /> Add First Salesman
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {salesmen.map(s => (
            <div key={s.id} className={`bg-white rounded-2xl border shadow-sm p-5 transition-all
              ${s.is_active ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm
                    ${s.is_active ? 'bg-papco-navy text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {s.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{s.full_name}</p>
                    <p className="text-xs text-gray-500">{s.email}</p>
                    {s.phone && <p className="text-xs text-gray-400">{s.phone}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => toggleActive(s)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors
                      ${s.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-papco-navy transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(s)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {s.notes && <p className="text-xs text-gray-400 mt-3 border-t border-gray-50 pt-2">{s.notes}</p>}
            </div>
          ))}
          {/* Empty slots */}
          {Array.from({ length: MAX_SALESMEN - salesmen.length }).map((_, i) => (
            <div key={`empty-${i}`}
              className="bg-white rounded-2xl border border-dashed border-gray-200 p-5 flex items-center justify-center cursor-pointer hover:border-papco-navy/40 hover:bg-blue-50/20 transition-all group"
              onClick={openAdd}>
              <div className="text-center">
                <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-papco-navy/10 flex items-center justify-center mx-auto mb-2 transition-colors">
                  <UserCheck size={18} className="text-gray-300 group-hover:text-papco-navy transition-colors" />
                </div>
                <p className="text-xs text-gray-400 font-medium">Empty Slot</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form modal */}
      {showForm && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-papco-navy">{editItem ? 'Edit Salesman' : 'Add Salesman'}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              {[
                { field: 'full_name', label: 'Full Name *', type: 'text', placeholder: 'Ahmed Al-Rashid' },
                { field: 'email', label: 'Email *', type: 'email', placeholder: 'ahmed@papco.com' },
                { field: 'phone', label: 'Phone', type: 'text', placeholder: '+971 50 000 0000' },
                ...(!editItem ? [{ field: 'password', label: 'Password *', type: 'password', placeholder: 'Min. 6 characters' }] : []),
                { field: 'notes', label: 'Notes', type: 'text', placeholder: 'Area, specialization…' },
              ].map(({ field, label, type, placeholder }) => (
                <div key={field}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">{label}</label>
                  <input type={type} value={form[field as keyof typeof form]}
                    onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder={placeholder} required={label.includes('*')}
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 outline-none
                      focus:ring-2 focus:ring-papco-navy/20 focus:border-papco-navy focus:bg-white transition-all" />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-papco-navy text-white text-sm font-bold hover:bg-papco-navy-dark transition-colors shadow-sm disabled:opacity-50">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                  {editItem ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { setToast({ message: 'Min. 6 characters', type: 'error' }); return; }
    if (newPassword !== confirmPassword) { setToast({ message: 'Passwords do not match', type: 'error' }); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (!error) {
      setToast({ message: 'Password updated successfully', type: 'success' });
      setNewPassword(''); setConfirmPassword('');
    } else {
      setToast({ message: error.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-papco-navy mb-1">Admin Account</h3>
        <p className="text-xs text-gray-400 mb-5">Super administrator credentials</p>
        <div className="p-4 rounded-xl mb-5 space-y-2" style={{ background: '#f8faff', border: '1px solid #dce3ff' }}>
          {[['Login', 'Online-Admin'], ['Email', 'papcorasul@gmail.com'], ['Phone', '+971 54 771 3447'], ['Role', 'Super Administrator']].map(([k, v]) => (
            <div key={k} className="flex gap-4 text-xs">
              <span className="text-gray-400 w-16 flex-shrink-0">{k}</span>
              <span className="font-semibold text-gray-700">{v}</span>
            </div>
          ))}
        </div>

        <form onSubmit={changePassword} className="space-y-3">
          <h4 className="text-sm font-bold text-gray-700">Change Password</h4>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">New Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 characters"
              className="px-3 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-papco-navy/20 focus:border-papco-navy transition-all" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password"
              className="px-3 py-2.5 text-sm rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-papco-navy/20 focus:border-papco-navy transition-all" />
          </div>
          <button type="submit" disabled={loading || !newPassword || !confirmPassword}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-papco-navy text-white text-sm font-semibold hover:bg-papco-navy-dark transition-colors disabled:opacity-50">
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
            Update Password
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-papco-navy mb-4">Platform Info</h3>
        <div className="divide-y divide-gray-50">
          {[['Platform', 'PAPCO Online Platform'], ['Version', '1.0.0'], ['Database', 'Supabase PostgreSQL'], ['Storage', 'Supabase Storage'], ['Auth', 'Supabase Email/Password']].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2.5 text-xs">
              <span className="text-gray-400 font-medium">{k}</span>
              <span className="text-gray-700 font-semibold">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main AdminPanel ───────────────────────────────────────────────────────────

export default function AdminPanel({ user, onSignOut, onGoHome }: { user: SupabaseUser; onSignOut: () => void; onGoHome?: () => void }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [users, setUsers] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, pendingRegistrations: 0, newRequests: 0, activeRequests: 0 });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const logAction = useCallback(async (action: string, targetType: string, targetId: string, details: string) => {
    await supabase.from('admin_logs').insert({ admin_id: user.id, action, target_type: targetType, target_id: targetId, details });
    const { data } = await supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (data) setLogs(data);
  }, [user.id]);

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) {
      setUsers(data.filter(u => !isDeletedUserProfile(u)));
    }
  };
  const loadRequests = async () => {
    const { data } = await supabase
      .from('user_requests')
      .select('*, profiles(full_name, company_name, email, registration_status)')
      .order('created_at', { ascending: false });
    if (data) setRequests(data);
  };
  const loadLogs = async () => {
    const { data } = await supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (data) setLogs(data);
  };

  const refreshAll = useCallback(async () => {
    await Promise.all([loadUsers(), loadRequests(), loadLogs()]);
  }, []);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  useEffect(() => {
    const nonAdmin = users.filter(u => !u.is_admin);
    setStats({
      totalUsers: nonAdmin.length,
      pendingRegistrations: nonAdmin.filter(u => u.registration_status === 'pending').length,
      newRequests: requests.filter(r => r.status === 'pending').length,
      activeRequests: requests.filter(r => r.status === 'in_progress').length,
    });
  }, [users, requests]);

  const navItems: { id: AdminTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'registrations', label: 'Registrations', icon: UserCheck, badge: stats.pendingRegistrations || undefined },
    { id: 'users', label: 'All Users', icon: Users },
    { id: 'requests', label: 'Client Requests', icon: ClipboardList, badge: stats.newRequests || undefined },
    { id: 'catalog', label: 'Parts Catalog', icon: Upload },
    { id: 'unavailable', label: 'Unavailable Parts', icon: Search },
    { id: 'salesmen', label: 'Salesmen', icon: UserCheck },
    { id: 'files', label: 'Files', icon: FileSpreadsheet },
    { id: 'logs', label: 'Activity Log', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const navigateTo = (tab: AdminTab) => {
    setActiveTab(tab);
    setMobileSidebarOpen(false);
  };

  const tabTitles: Record<AdminTab, string> = {
    dashboard: 'Dashboard',
    registrations: 'Registration Requests',
    users: 'All Users',
    requests: 'Client Requests',
    catalog: 'Parts Catalog',
    unavailable: 'Unavailable Parts',
    salesmen: 'Salesman Accounts',
    files: 'File Management',
    logs: 'Activity Log',
    settings: 'Settings',
  };

  const tabSubtitles: Record<AdminTab, string> = {
    dashboard: 'Platform overview',
    registrations: `${stats.pendingRegistrations} pending approval`,
    users: `${users.filter(u => !u.is_admin).length} registered clients`,
    requests: `${requests.length} total requests`,
    catalog: 'Upload Excel files to populate catalog',
    unavailable: 'Parts searched but not found in catalog',
    salesmen: 'Manage 10 salesman accounts',
    files: 'Manage uploaded files',
    logs: `${logs.length} logged actions`,
    settings: 'System configuration',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 z-30 relative flex-shrink-0"
        style={{ background: 'linear-gradient(90deg, #1a1f6e 0%, #13175a 100%)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileSidebarOpen(v => !v)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors lg:hidden">
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-red-400" />
            <span className="font-black text-white text-sm tracking-wider uppercase hidden sm:inline">PAPCO Admin</span>
            <span className="font-black text-white text-sm tracking-wider uppercase sm:hidden">Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={refreshAll} title="Refresh"
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
            <RefreshCw size={15} />
          </button>
          <div className="hidden sm:block text-right">
            <p className="text-white text-xs font-semibold leading-tight">Online-Admin</p>
            <p className="text-blue-200 text-xs">Super Admin</p>
          </div>
          <button onClick={onSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors">
            <LogOut size={13} /> <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`
          flex-shrink-0 bg-white border-r border-gray-100 shadow-sm flex flex-col z-30
          fixed lg:static top-0 bottom-0 transition-transform duration-300
          w-60 lg:w-56 lg:translate-x-0
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `} style={{ paddingTop: mobileSidebarOpen ? '52px' : undefined }}>
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button key={item.id} onClick={() => navigateTo(item.id)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                    ${active ? 'bg-papco-navy text-white shadow-md shadow-papco-navy/20' : 'text-gray-600 hover:bg-gray-50 hover:text-papco-navy'}`}>
                  <div className="flex items-center gap-3">
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge != null && item.badge > 0 && (
                    <span className={`text-xs rounded-full px-2 py-0.5 font-bold ${active ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="p-3 border-t border-gray-100 flex-shrink-0 space-y-2">
            {onGoHome && (
              <button onClick={onGoHome}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-papco-navy transition-colors border border-gray-200">
                <Home size={15} />
                <span>Home</span>
              </button>
            )}
            <div className="flex items-center gap-2 px-2 pt-1">
              <div className="w-8 h-8 rounded-full bg-papco-navy flex items-center justify-center flex-shrink-0">
                <Shield size={14} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-800 truncate">Online-Admin</p>
                <p className="text-xs text-gray-400">Super Admin</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:pl-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-papco-navy">{tabTitles[activeTab]}</h1>
                <p className="text-gray-400 text-xs sm:text-sm mt-0.5">{tabSubtitles[activeTab]}</p>
              </div>
              <button onClick={refreshAll}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {activeTab === 'dashboard' && <DashboardTab stats={stats} requests={requests} users={users} onNavigate={navigateTo} />}
            {activeTab === 'registrations' && <RegistrationsTab users={users} onRefresh={refreshAll} logAction={logAction} />}
            {activeTab === 'users' && <UsersTab users={users} onRefresh={refreshAll} logAction={logAction} />}
            {activeTab === 'requests' && <RequestsTab requests={requests} onRefresh={refreshAll} logAction={logAction} />}
            {activeTab === 'catalog' && <CatalogTab adminUserId={user.id} />}
            {activeTab === 'unavailable' && <UnavailableSearchesTab />}
            {activeTab === 'salesmen' && <SalesmenTab />}
            {activeTab === 'files' && <FilesTab adminUserId={user.id} users={users} logAction={logAction} />}
            {activeTab === 'logs' && <LogsTab logs={logs} />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        </main>
      </div>

      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}