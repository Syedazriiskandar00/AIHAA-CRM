import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { SkeletonCard } from '../components/Skeleton';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get('/api/stats')
      .then((res) => res.data.success && setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const peratusan = stats?.peratusan || 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Selamat Datang ke Aihaa CRM</h2>
        <p className="text-sm text-gray-500 mt-1">Ringkasan data enrichment anda</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              label="Jumlah Contacts"
              value={stats?.total?.toLocaleString() || '0'}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
              color="primary"
            />
            <StatCard
              label="Lengkap"
              value={stats?.lengkap?.toLocaleString() || '0'}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              color="success"
            />
            <StatCard
              label="Tidak Lengkap"
              value={stats?.tidakLengkap?.toLocaleString() || '0'}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>}
              color="warning"
            />
            <StatCard
              label="% Completion"
              value={`${peratusan}%`}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>}
              color="primary"
            />
          </>
        )}
      </div>

      {/* Progress Bar */}
      {!loading && stats && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Progress Enrichment</h3>
            <span className="text-sm font-bold text-primary">{peratusan}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${peratusan}%`,
                background: 'linear-gradient(90deg, #c8553a, #e8854a)',
              }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>{stats.lengkap?.toLocaleString()} lengkap</span>
            <span>{stats.tidakLengkap?.toLocaleString()} belum lengkap</span>
          </div>
        </div>
      )}

      {/* Quick Actions + Negeri Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Tindakan Pantas</h3>
          <div className="space-y-2">
            <Link
              to="/import"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-primary/30 hover:bg-primary-50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center group-hover:bg-primary/10">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Import Data</p>
                <p className="text-xs text-gray-400">Sambung ke Google Sheet</p>
              </div>
            </Link>
            <Link
              to="/contacts"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-primary/30 hover:bg-primary-50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center group-hover:bg-primary/10">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Lihat Senarai</p>
                <p className="text-xs text-gray-400">Lihat & edit semua contacts</p>
              </div>
            </Link>
            <Link
              to="/export"
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-primary/30 hover:bg-primary-50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center group-hover:bg-primary/10">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Export Data</p>
                <p className="text-xs text-gray-400">Sync balik ke Google Sheet</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Negeri Breakdown */}
        {!loading && stats?.byNegeri && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Mengikut Negeri</h3>
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-2">
              {stats.byNegeri.slice(0, 15).map((item) => (
                <div key={item.negeri} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700 truncate">{item.negeri}</span>
                      <span className="text-xs text-gray-400 ml-2">{item.total}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${stats.total ? (item.total / stats.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  const colorStyles = {
    primary: { bg: 'bg-primary-50', icon: 'text-primary', border: 'border-primary/10' },
    success: { bg: 'bg-success-light', icon: 'text-success', border: 'border-success/10' },
    warning: { bg: 'bg-warning-light', icon: 'text-warning', border: 'border-warning/10' },
  };
  const s = colorStyles[color] || colorStyles.primary;

  return (
    <div className={`bg-white rounded-xl border ${s.border} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center ${s.icon}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
