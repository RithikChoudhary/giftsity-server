import { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../api';
import { ScrollText, Shield, KeyRound, Search, ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';

const TABS = [
  { key: 'activity', label: 'Activity', icon: ScrollText },
  { key: 'auth', label: 'Auth', icon: Shield },
  { key: 'otp', label: 'OTP', icon: KeyRound },
];

const formatDate = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function AdminLogs() {
  const [tab, setTab] = useState('activity');
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter1, setFilter1] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      const params = { page, limit: 40 };
      if (from) params.from = from;
      if (to) params.to = to;

      if (tab === 'activity') {
        if (search) params.action = search;
        if (filter1) params.domain = filter1;
        res = await adminAPI.getActivityLogs(params);
      } else if (tab === 'auth') {
        if (search) params.email = search;
        if (filter1) params.action = filter1;
        res = await adminAPI.getAuthLogs(params);
      } else {
        if (search) params.email = search;
        if (filter1) params.event = filter1;
        res = await adminAPI.getOtpLogs(params);
      }
      setLogs(res.data.logs);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [tab, page, search, filter1, from, to]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleTabChange = (key) => {
    setTab(key);
    setPage(1);
    setSearch('');
    setFilter1('');
    setFrom('');
    setTo('');
  };

  const activityDomains = ['order', 'admin', 'seller', 'corporate', 'system'];
  const authActions = ['login_success', 'login_failed', 'logout', 'token_rejected', 'session_revoked'];
  const otpEvents = ['sent', 'verified', 'failed', 'expired', 'rate_limited'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <button onClick={fetchLogs} disabled={loading} className="p-2 rounded-lg hover:bg-inset/50 text-theme-muted">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-inset/30 p-1 rounded-lg w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => handleTabChange(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-card text-amber-400 shadow-sm' : 'text-theme-muted hover:text-theme-primary'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-dim" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={tab === 'activity' ? 'Search by action...' : 'Search by email...'}
            className="w-full pl-9 pr-3 py-2 bg-inset/50 border border-edge/30 rounded-lg text-sm focus:outline-none focus:border-amber-400/50" />
        </div>

        <select value={filter1} onChange={e => { setFilter1(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-inset/50 border border-edge/30 rounded-lg text-sm focus:outline-none">
          <option value="">{tab === 'activity' ? 'All Domains' : tab === 'auth' ? 'All Actions' : 'All Events'}</option>
          {(tab === 'activity' ? activityDomains : tab === 'auth' ? authActions : otpEvents).map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-inset/50 border border-edge/30 rounded-lg text-sm focus:outline-none" />
        <span className="text-theme-dim text-sm">to</span>
        <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-inset/50 border border-edge/30 rounded-lg text-sm focus:outline-none" />

        <span className="text-xs text-theme-dim ml-auto">{total} results</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-theme-dim">No logs found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge/30 text-theme-dim text-left">
                {tab === 'activity' && <>
                  <th className="py-3 px-3 font-medium">Time</th>
                  <th className="py-3 px-3 font-medium">Domain</th>
                  <th className="py-3 px-3 font-medium">Action</th>
                  <th className="py-3 px-3 font-medium">Actor</th>
                  <th className="py-3 px-3 font-medium">Message</th>
                </>}
                {tab === 'auth' && <>
                  <th className="py-3 px-3 font-medium">Time</th>
                  <th className="py-3 px-3 font-medium">Action</th>
                  <th className="py-3 px-3 font-medium">Role</th>
                  <th className="py-3 px-3 font-medium">Email</th>
                  <th className="py-3 px-3 font-medium">IP</th>
                  <th className="py-3 px-3 font-medium">Reason</th>
                </>}
                {tab === 'otp' && <>
                  <th className="py-3 px-3 font-medium">Time</th>
                  <th className="py-3 px-3 font-medium">Event</th>
                  <th className="py-3 px-3 font-medium">Role</th>
                  <th className="py-3 px-3 font-medium">Email</th>
                  <th className="py-3 px-3 font-medium">IP</th>
                </>}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={log._id || i} className="border-b border-edge/10 hover:bg-inset/30">
                  {tab === 'activity' && <>
                    <td className="py-2.5 px-3 text-theme-dim whitespace-nowrap">{formatDate(log.createdAt)}</td>
                    <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded-full text-xs bg-inset">{log.domain}</span></td>
                    <td className="py-2.5 px-3 font-mono text-xs">{log.action}</td>
                    <td className="py-2.5 px-3 text-theme-dim text-xs">{log.actorEmail || log.actorRole}</td>
                    <td className="py-2.5 px-3 text-xs max-w-xs truncate">{log.message}</td>
                  </>}
                  {tab === 'auth' && <>
                    <td className="py-2.5 px-3 text-theme-dim whitespace-nowrap">{formatDate(log.createdAt)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${log.action === 'login_success' ? 'bg-green-500/10 text-green-400' : log.action === 'login_failed' ? 'bg-red-500/10 text-red-400' : 'bg-inset'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs">{log.role}</td>
                    <td className="py-2.5 px-3 font-mono text-xs">{log.email}</td>
                    <td className="py-2.5 px-3 text-theme-dim text-xs font-mono">{log.ipAddress}</td>
                    <td className="py-2.5 px-3 text-xs max-w-xs truncate">{log.reason}</td>
                  </>}
                  {tab === 'otp' && <>
                    <td className="py-2.5 px-3 text-theme-dim whitespace-nowrap">{formatDate(log.createdAt)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${log.event === 'verified' ? 'bg-green-500/10 text-green-400' : log.event === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-inset'}`}>
                        {log.event}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs">{log.role}</td>
                    <td className="py-2.5 px-3 font-mono text-xs">{log.email}</td>
                    <td className="py-2.5 px-3 text-theme-dim text-xs font-mono">{log.ipAddress}</td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-2 rounded-lg hover:bg-inset/50 disabled:opacity-30 text-theme-muted">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-theme-dim">Page {page} of {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
            className="p-2 rounded-lg hover:bg-inset/50 disabled:opacity-30 text-theme-muted">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
