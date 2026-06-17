import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar.jsx';
import DashboardMetrics from './components/DashboardMetrics.jsx';
import ChartsSection from './components/ChartsSection.jsx';
import LeadTable from './components/LeadTable.jsx';
import LeadDetailsModal from './components/LeadDetailsModal.jsx';
import CsvImportModal from './components/CsvImportModal.jsx';
import SheetSelector from './components/SheetSelector.jsx';
import BulkOperations from './components/BulkOperations.jsx';
import { 
  FileSpreadsheet, 
  HelpCircle, 
  LogIn, 
  ShieldAlert,
  ArrowRight,
  FileText
} from 'lucide-react';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('lead_jwt_token') || '');
  const [userInfo, setUserInfo] = useState(null);
  const [leads, setLeads] = useState([]);
  const [files, setFiles] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSyncMeta, setLastSyncMeta] = useState(null);
  
  // Modal states
  const [activeLead, setActiveLead] = useState(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  
  // Row processing tracking
  const [processingRows, setProcessingRows] = useState(new Set());
  const [errorMsg, setErrorMsg] = useState('');
  const [authError, setAuthError] = useState('');

  // Extract URL parameters (JWT token or error) on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const urlError = params.get('error');

    if (urlToken) {
      localStorage.setItem('lead_jwt_token', urlToken);
      setToken(urlToken);
      // Clean query params from URL
      window.history.replaceState({}, document.title, '/');
    }

    if (urlError) {
      if (urlError === 'unauthorized') {
        setAuthError('Access denied: Your Google email is not authorized to access this dashboard.');
      } else {
        setAuthError(`Authentication failed: ${urlError.replace(/_/g, ' ')}`);
      }
      window.history.replaceState({}, document.title, '/');
    }
  }, []);

  // API helper with JWT headers
  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    if (response.status === 401) {
      // Session expired or invalid
      localStorage.removeItem('lead_jwt_token');
      setToken('');
      setUserInfo(null);
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }, [token]);

  // Load user session and spreadsheet metadata
  const loadSession = useCallback(async () => {
    if (!token) return;
    setIsProcessing(true);
    try {
      const data = await apiFetch('/.netlify/functions/user-info');
      setUserInfo(data);
      
      // If a spreadsheet is connected, load leads
      if (data.activeSpreadsheet) {
        await loadLeads();
      }
      
      // Load available spreadsheets list
      const driveData = await apiFetch('/.netlify/functions/spreadsheets');
      setFiles(driveData.files || []);
      setErrorMsg('');
    } catch (err) {
      console.error('Session load error:', err);
      setErrorMsg(err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [token, apiFetch]);

  // Load leads database rows
  const loadLeads = async () => {
    try {
      const data = await apiFetch('/.netlify/functions/leads');
      setLeads(data.leads || []);
      
      // Read local storage/metadata for last sync metadata
      // Since it's stored in Netlify Blobs, we can extract last check status
      const syncResponse = await fetch('/.netlify/functions/user-info', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const syncData = await syncResponse.json().catch(() => ({}));
      // Netlify Blobs sync metadata can be extracted in background if implemented,
      // here we fallback to dates in sheet
      const lastCheckedTimes = (data.leads || [])
        .map(l => l['Last Checked'])
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a));
      
      setLastSyncMeta({
        lastSyncTime: lastCheckedTimes[0] || null
      });
    } catch (err) {
      console.error('Leads load error:', err);
      setErrorMsg(`Failed to load leads: ${err.message}`);
    }
  };

  // Reload session on token state changes
  useEffect(() => {
    if (token) {
      loadSession();
    }
  }, [token, loadSession]);

  // 60-Second Auto Refresh Loop for metrics & active lead list
  useEffect(() => {
    if (!token || !userInfo?.activeSpreadsheet) return;

    const interval = setInterval(() => {
      console.log('Auto-refreshing lead metrics...');
      loadLeads();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [token, userInfo]);

  // Login handler
  const handleLogin = async () => {
    try {
      setIsProcessing(true);
      const data = await apiFetch('/.netlify/functions/auth');
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      setAuthError(`Failed to initialize login: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('lead_jwt_token');
    setToken('');
    setUserInfo(null);
    setLeads([]);
    setFiles([]);
    setActiveTab('overview');
  };

  // Spreadsheet selector
  const handleSelectSheet = async (spreadsheetId, name) => {
    setIsProcessing(true);
    try {
      const data = await apiFetch('/.netlify/functions/spreadsheets', {
        method: 'POST',
        body: JSON.stringify({ spreadsheetId, name })
      });
      if (data.success) {
        // Refresh session
        loadSession();
      }
    } catch (err) {
      setErrorMsg(`Failed to connect sheet: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Manual Trigger Sync Button
  const handleManualSync = async () => {
    const unenriched = leads.filter(l => !l['Last Checked']);
    if (unenriched.length === 0) {
      alert('No new unprocessed leads found. Dashboard is fully synchronized.');
      return;
    }
    
    setIsSyncing(true);
    setErrorMsg('');
    
    try {
      const rowsToProcess = unenriched.slice(0, 5).map(l => l.rowNumber); // sync 5 in chunk
      const res = await apiFetch('/.netlify/functions/leads', {
        method: 'POST',
        body: JSON.stringify({
          action: 'enrichLeads',
          payload: { rowsToProcess }
        })
      });
      if (res.success) {
        await loadLeads();
        alert(`Successfully enriched a chunk of ${rowsToProcess.length} leads.`);
      }
    } catch (err) {
      setErrorMsg(`Manual sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Update check box toggles instantly for snappy experience
  const handleUpdateCheckbox = async (rowNumber, colName, value) => {
    // 1. Snappy Local State Update
    setLeads(prevLeads => 
      prevLeads.map(lead => {
        if (lead.rowNumber === rowNumber) {
          return { ...lead, [colName]: value };
        }
        return lead;
      })
    );

    // 2. Perform write back to sheets in background
    try {
      await apiFetch('/.netlify/functions/leads', {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateCells',
          payload: {
            updates: [{ rowNumber, colName, value }]
          }
        })
      });
    } catch (err) {
      console.error('Failed to sync checkbox state with Google Sheet:', err);
      // Revert state
      setLeads(prevLeads => 
        prevLeads.map(lead => {
          if (lead.rowNumber === rowNumber) {
            return { ...lead, [colName]: !value };
          }
          return lead;
        })
      );
      setErrorMsg(`Failed to update sheet cell: ${err.message}`);
    }
  };

  // Edit details inside modal
  const handleSaveLeadData = async (rowNumber, updates) => {
    setIsProcessing(true);
    try {
      const res = await apiFetch('/.netlify/functions/leads', {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateCells',
          payload: { updates }
        })
      });
      if (res.success) {
        await loadLeads();
        // Update active lead modal display
        const updatedLead = leads.find(l => l.rowNumber === rowNumber);
        if (updatedLead) {
          updates.forEach(u => {
            updatedLead[u.colName] = u.value;
          });
          setActiveLead({ ...updatedLead });
        }
        setActiveLead(null); // Close modal on save
      }
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Single-row Manual Enrichment
  const handleEnrichSingle = async (rowNumber) => {
    setProcessingRows(prev => new Set([...prev, rowNumber]));
    try {
      const res = await apiFetch('/.netlify/functions/leads', {
        method: 'POST',
        body: JSON.stringify({
          action: 'enrichLeads',
          payload: { rowsToProcess: [rowNumber] }
        })
      });
      if (res.success) {
        await loadLeads();
        const updated = leads.find(l => l.rowNumber === rowNumber);
        if (activeLead && activeLead.rowNumber === rowNumber && updated) {
          setActiveLead(updated);
        }
      }
    } catch (err) {
      alert(`Enrichment failed: ${err.message}`);
    } finally {
      setProcessingRows(prev => {
        const next = new Set(prev);
        next.delete(rowNumber);
        return next;
      });
    }
  };

  // Single-row Manual Drafting
  const handleDraftSingle = async (rowNumber, draftType) => {
    setProcessingRows(prev => new Set([...prev, rowNumber]));
    try {
      const res = await apiFetch('/.netlify/functions/leads', {
        method: 'POST',
        body: JSON.stringify({
          action: 'draftEmails',
          payload: { rowsToProcess: [rowNumber], draftType }
        })
      });
      if (res.success) {
        await loadLeads();
        const updated = leads.find(l => l.rowNumber === rowNumber);
        if (activeLead && activeLead.rowNumber === rowNumber && updated) {
          setActiveLead(updated);
        }
        alert('Draft generated successfully!');
      }
    } catch (err) {
      alert(`Draft generation failed: ${err.message}`);
    } finally {
      setProcessingRows(prev => {
        const next = new Set(prev);
        next.delete(rowNumber);
        return next;
      });
    }
  };

  // Single-row Manual Send
  const handleSendSingle = async (rowNumber) => {
    if (!confirm('Send this email immediately via Gmail API?')) return;
    setProcessingRows(prev => new Set([...prev, rowNumber]));
    try {
      const res = await apiFetch('/.netlify/functions/leads', {
        method: 'POST',
        body: JSON.stringify({
          action: 'sendEmails',
          payload: { rowsToProcess: [rowNumber] }
        })
      });
      if (res.success && res.results[0]?.status === 'success') {
        await loadLeads();
        setActiveLead(null);
        alert('Email sent successfully!');
      } else {
        throw new Error(res.results[0]?.error || 'Send failed');
      }
    } catch (err) {
      alert(`Failed to send email: ${err.message}`);
    } finally {
      setProcessingRows(prev => {
        const next = new Set(prev);
        next.delete(rowNumber);
        return next;
      });
    }
  };

  // Bulk operation triggers
  const handleRunBulkAction = async (action, payload) => {
    try {
      const data = await apiFetch('/.netlify/functions/leads', {
        method: 'POST',
        body: JSON.stringify({ action, payload })
      });
      if (data.success) {
        await loadLeads();
      }
      return data;
    } catch (err) {
      console.error(`Bulk action ${action} failed:`, err);
      return { success: false, message: err.message };
    }
  };

  // CSV Lead Upload
  const handleImportCsvSubmit = async (leadsToImport) => {
    setIsProcessing(true);
    try {
      const res = await apiFetch('/.netlify/functions/leads', {
        method: 'POST',
        body: JSON.stringify({
          action: 'importCsv',
          payload: { leads: leadsToImport }
        })
      });
      if (res.success) {
        await loadLeads();
        setCsvModalOpen(false);
        alert(`Successfully imported ${res.importedCount} leads!`);
      }
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper row processing verification
  const isRowProcessing = (rowNumber) => processingRows.has(rowNumber);

  // Compute stats helper
  const unprocessedCount = leads.filter(l => !l['Last Checked']).length;

  return (
    <div className="min-h-screen flex flex-col bg-prasha-slate text-prasha-light">
      
      {/* 1. Login View (Unauthorized) */}
      {!token ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-prasha-slate via-prasha-navy/80 to-prasha-slate">
          <div className="glass-panel w-full max-w-md p-8 rounded-2xl border border-prasha-gold/20 shadow-2xl text-center space-y-6">
            <div className="flex flex-col items-center gap-3">
              {/* Logo block */}
              <div className="flex flex-col items-center justify-center bg-prasha-navy border border-prasha-gold/80 px-4 py-2.5 rounded-md shadow-lg shadow-prasha-gold/10">
                <span className="text-[#caa13d] text-base font-extrabold tracking-[6px] leading-tight">PRASHA</span>
                <span className="text-[#caa13d] text-[10px] font-light tracking-[8px] leading-none mt-1">INFOTECH</span>
              </div>
              <h2 className="text-xl font-extrabold text-white tracking-wide mt-2">Lead Intelligence Dashboard</h2>
              <p className="text-xs text-slate-400">
                Automated lead enrichment, duplicate checking, custom hook scoring, and Gmail alias email outreach control panel.
              </p>
            </div>

            {authError && (
              <div className="p-3 border border-rose-500/25 bg-rose-500/5 text-xs text-rose-400 rounded-lg flex items-center justify-center gap-2">
                <ShieldAlert size={16} className="flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={isProcessing}
              className="w-full py-3 bg-[#caa13d] hover:bg-[#d4af37] text-[#0d1b2a] font-bold rounded-lg text-sm flex items-center justify-center gap-2 shadow-lg shadow-prasha-gold/10 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <LogIn size={18} />
              <span>Connect Google Account</span>
            </button>

            <div className="border-t border-slate-800/60 pt-4 text-[10px] text-slate-500 flex justify-center items-center gap-1.5">
              <span>Secure Single-Sign-On</span>
              <span>•</span>
              <span>100% Free Service Stack</span>
            </div>
          </div>
        </div>
      ) : (
        /* 2. Main Dashboard Layout */
        <>
          <Navbar 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            userInfo={userInfo}
            onLogout={handleLogout}
            onManualSync={handleManualSync}
            isSyncing={isSyncing}
            lastSyncMeta={lastSyncMeta}
          />

          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
            
            {/* Global Errors */}
            {errorMsg && (
              <div className="p-4 border border-rose-500/20 bg-rose-500/5 text-xs text-rose-400 rounded-lg flex items-center gap-3">
                <ShieldAlert size={18} />
                <div className="flex-1">
                  <p className="font-semibold">Operation Error</p>
                  <p className="text-slate-400 mt-0.5">{errorMsg}</p>
                </div>
                <button onClick={() => setErrorMsg('')} className="hover:text-white font-bold">Dismiss</button>
              </div>
            )}

            {/* View State Router */}
            {isProcessing && leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-4 border-prasha-gold border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-slate-400">Loading database data from Google Sheets...</p>
              </div>
            ) : !userInfo?.activeSpreadsheet ? (
              /* No Spreadsheet Connected */
              <SheetSelector 
                files={files} 
                onSelectSheet={handleSelectSheet} 
                isConnecting={isProcessing} 
              />
            ) : (
              /* Tab Routing */
              <>
                {/* 1. Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-6 animate-fade-in">
                    <DashboardMetrics 
                      leads={leads} 
                      lastSyncMeta={lastSyncMeta} 
                      unprocessedCount={unprocessedCount} 
                    />
                    <ChartsSection leads={leads} />
                  </div>
                )}

                {/* 2. Lead Board Tab */}
                {activeTab === 'leads' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-md font-bold text-white uppercase tracking-wider">Leads Database Board</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Manage details, checkboxes approval, and run outreach checks.</p>
                      </div>
                      <button
                        onClick={() => setCsvModalOpen(true)}
                        className="px-3.5 py-1.5 bg-prasha-gold hover:bg-prasha-gold/80 text-prasha-navy font-bold rounded-lg text-xs transition-colors"
                      >
                        Upload Leads CSV
                      </button>
                    </div>
                    
                    <LeadTable 
                      leads={leads} 
                      viewType="all"
                      onRowClick={setActiveLead} 
                      onEnrichSingle={handleEnrichSingle}
                      onSendSingle={handleSendSingle}
                      onUpdateCheckbox={handleUpdateCheckbox}
                      isProcessingRow={isRowProcessing}
                    />
                  </div>
                )}

                {/* 3. Sent Leads Tab */}
                {activeTab === 'sent' && (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <h2 className="text-md font-bold text-white uppercase tracking-wider">Sent Outreach Outbox</h2>
                      <p className="text-xs text-slate-400 mt-0.5">List of leads where first outreach or follow-up email has been sent.</p>
                    </div>
                    
                    <LeadTable 
                      leads={leads} 
                      viewType="sent"
                      onRowClick={setActiveLead} 
                      onEnrichSingle={handleEnrichSingle}
                      onSendSingle={handleSendSingle}
                      onUpdateCheckbox={handleUpdateCheckbox}
                      isProcessingRow={isRowProcessing}
                    />
                  </div>
                )}

                {/* 4. Bulk Operations Tab */}
                {activeTab === 'bulk' && (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <h2 className="text-md font-bold text-white uppercase tracking-wider">Bulk Controls Center</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Execute large operations safely in chunks without timeouts.</p>
                    </div>
                    
                    <BulkOperations 
                      leads={leads}
                      onRunBulkAction={handleRunBulkAction}
                      isProcessing={isProcessing}
                      onOpenCsvModal={() => setCsvModalOpen(true)}
                    />
                  </div>
                )}

                {/* 5. Settings Tab */}
                {activeTab === 'settings' && (
                  <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
                    <div className="glass-panel p-6 rounded-xl border border-slate-800/40 space-y-4">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2.5">
                        Active Database Settings
                      </h3>
                      
                      <div className="space-y-4 text-xs">
                        <div className="flex justify-between p-3 bg-slate-900 border border-slate-800 rounded-lg">
                          <span className="text-slate-400">Sheet Name:</span>
                          <span className="font-semibold text-white">{userInfo.activeSpreadsheet.name}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-slate-900 border border-slate-800 rounded-lg">
                          <span className="text-slate-400">Spreadsheet ID:</span>
                          <span className="font-mono text-slate-300">{userInfo.activeSpreadsheet.spreadsheetId}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-slate-900 border border-slate-800 rounded-lg">
                          <span className="text-slate-400">Linked Account:</span>
                          <span className="font-semibold text-white">{userInfo.email}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-slate-900 border border-slate-800 rounded-lg">
                          <span className="text-slate-400">Outreach Email Sender Alias:</span>
                          <span className="font-semibold text-prasha-gold">sales@prashainfotech.com</span>
                        </div>
                      </div>
                    </div>

                    {/* Change Spreadsheet picker */}
                    <SheetSelector 
                      files={files} 
                      onSelectSheet={handleSelectSheet} 
                      isConnecting={isProcessing} 
                    />
                  </div>
                )}
              </>
            )}

          </main>

          {/* Details modal */}
          {activeLead && (
            <LeadDetailsModal 
              lead={activeLead} 
              onClose={() => setActiveLead(null)} 
              onSaveLeadData={handleSaveLeadData}
              onEnrichSingle={handleEnrichSingle}
              onSendSingle={handleSendSingle}
              onDraftSingle={handleDraftSingle}
              isProcessing={isRowProcessing(activeLead.rowNumber)}
            />
          )}

          {/* CSV Import modal */}
          {csvModalOpen && (
            <CsvImportModal 
              onClose={() => setCsvModalOpen(false)} 
              onImportSubmit={handleImportCsvSubmit}
              isImporting={isProcessing}
            />
          )}

          {/* Footer branding */}
          <footer className="py-6 border-t border-slate-800/60 bg-prasha-navy/10 text-center text-[10px] text-slate-500 flex flex-col items-center justify-center gap-1">
            <p>© {new Date().getFullYear()} Prasha Infotech. All rights reserved.</p>
            <p className="text-slate-600">Lead Automation Systems Platform. Hosted securely on Netlify Serverless.</p>
          </footer>
        </>
      )}

    </div>
  );
}
