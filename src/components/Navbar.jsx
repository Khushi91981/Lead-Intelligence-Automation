import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut, 
  RefreshCw, 
  FileSpreadsheet, 
  Send, 
  Play,
  MailCheck
} from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  userInfo, 
  onLogout, 
  onManualSync, 
  isSyncing,
  lastSyncMeta
}) {
  return (
    <nav className="glass-panel border-b border-prasha-gold/20 sticky top-0 z-40 bg-prasha-navy/85 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
      {/* Brand Header */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center justify-center bg-prasha-navy border border-prasha-gold px-3 py-1.5 rounded-md shadow-lg shadow-prasha-gold/5">
          <span className="text-[#caa13d] text-xs font-semibold tracking-[4px] leading-tight">PRASHA</span>
          <span className="text-[#caa13d] text-[8px] font-light tracking-[5px] leading-none mt-0.5">INFOTECH</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            Lead Intelligence <span className="text-prasha-gold">Dashboard</span>
          </h1>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap justify-center items-center gap-1 bg-prasha-slate/60 p-1 rounded-lg border border-slate-800">
        {[
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'leads', label: 'Lead Board', icon: Users },
          { id: 'sent', label: 'Sent Leads', icon: MailCheck },
          { id: 'bulk', label: 'Bulk Actions', icon: Play },
          { id: 'settings', label: 'Settings', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-prasha-gold text-prasha-navy font-semibold shadow-md shadow-prasha-gold/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Sync Status & User Account Controls */}
      <div className="flex items-center gap-4">
        {/* Sync Controls */}
        {userInfo?.activeSpreadsheet && (
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex flex-col items-end">
              <div className="flex items-center gap-1 text-xs text-slate-300">
                <FileSpreadsheet size={13} className="text-emerald-500" />
                <span className="font-medium truncate max-w-[150px]">{userInfo.activeSpreadsheet.name}</span>
              </div>
              {lastSyncMeta?.lastSyncTime && (
                <span className="text-[10px] text-slate-500">
                  Last Sync: {new Date(lastSyncMeta.lastSyncTime).toLocaleTimeString()}
                </span>
              )}
            </div>
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-prasha-gold/30 text-prasha-gold bg-prasha-gold/5 hover:bg-prasha-gold/15 transition-all duration-200 ${
                isSyncing ? 'cursor-not-allowed opacity-60' : ''
              }`}
            >
              <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        )}

        {/* User Badge */}
        {userInfo && (
          <div className="flex items-center gap-3 border-l border-slate-800 pl-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-200">{userInfo.name || 'User'}</span>
              <span className="text-[9px] text-slate-500 truncate max-w-[120px]">{userInfo.email}</span>
            </div>
            <button
              onClick={onLogout}
              title="Logout"
              className="p-2 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
