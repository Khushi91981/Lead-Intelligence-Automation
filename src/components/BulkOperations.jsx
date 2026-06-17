import React, { useState } from 'react';
import { 
  Sparkles, 
  Trash2, 
  Mail, 
  Send, 
  Wrench, 
  AlertTriangle,
  Play,
  FileSpreadsheet,
  CheckCircle2,
  FileText
} from 'lucide-react';

export default function BulkOperations({ 
  leads, 
  onRunBulkAction, 
  isProcessing,
  onOpenCsvModal
}) {
  const [activeAction, setActiveAction] = useState(null); // 'enrich' | 'draft' | 'send' | 'dedup' | 'setup'
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [logMsgs, setLogMsgs] = useState([]);

  // Compute counts
  const totalLeads = leads.length;
  const unenrichedCount = leads.filter(l => !l['Last Checked']).length;
  
  const approvedFirstMails = leads.filter(l => l['Approved To Send'] === true && l['Sent Status'].toLowerCase() !== 'sent' && l['Primary Email']).length;
  const approvedFollowUps = leads.filter(l => l['Approved To Send Follow Up'] === true && l['Follow Up Sent Status'].toLowerCase() !== 'sent' && l['Primary Email']).length;

  const undraftedFirstMails = leads.filter(l => l['Last Checked'] && l['Lead Score'] >= 70 && l['Primary Email'] && !l['Email Subject']).length;
  const undraftedFollowUps = leads.filter(l => l['Sent Status'].toLowerCase() === 'sent' && !l['Follow Up Subject']).length;

  // Run chunked process in frontend to prevent Netlify serverless timeouts (chunks of 5)
  const runChunkedAction = async (actionName, targetRows, draftType = null) => {
    if (targetRows.length === 0) return;
    
    setActiveAction(actionName);
    setProgress({ current: 0, total: targetRows.length });
    setLogMsgs([`Starting bulk ${actionName} processing...`]);

    const chunkSize = 5;
    const total = targetRows.length;
    let completed = 0;

    for (let i = 0; i < total; i += chunkSize) {
      const chunk = targetRows.slice(i, i + chunkSize);
      setLogMsgs(prev => [...prev, `Processing chunk ${Math.floor(i / chunkSize) + 1} (${chunk.length} rows)...`]);
      
      try {
        let payload = { rowsToProcess: chunk };
        if (draftType) payload.draftType = draftType;

        const res = await onRunBulkAction(actionName, payload);
        if (!res.success) throw new Error(res.message || 'Operation failed');

        completed += chunk.length;
        setProgress({ current: completed, total });
      } catch (err) {
        setLogMsgs(prev => [...prev, `❌ Error in chunk: ${err.message}`]);
        break;
      }
    }

    setLogMsgs(prev => [...prev, `✅ Bulk ${actionName} completed.`]);
    setTimeout(() => {
      setActiveAction(null);
      setProgress({ current: 0, total: 0 });
      setLogMsgs([]);
    }, 4000);
  };

  // 1. Bulk Scrape/Enrich
  const handleBulkEnrich = () => {
    const targetRows = leads.filter(l => !l['Last Checked']).map(l => l.rowNumber);
    if (targetRows.length === 0) {
      alert('All leads are already enriched!');
      return;
    }
    runChunkedAction('enrichLeads', targetRows);
  };

  // 2. Bulk Draft Emails
  const handleBulkDraft = (type) => {
    const targetRows = type === 'first' 
      ? leads.filter(l => l['Last Checked'] && l['Primary Email'] && !l['Email Subject']).map(l => l.rowNumber)
      : leads.filter(l => l['Sent Status'].toLowerCase() === 'sent' && !l['Follow Up Subject']).map(l => l.rowNumber);

    if (targetRows.length === 0) {
      alert(`No undrafted ${type} leads found!`);
      return;
    }
    runChunkedAction('draftEmails', targetRows, type);
  };

  // 3. Bulk Send Emails
  const handleBulkSend = (type) => {
    const targetRows = type === 'first'
      ? leads.filter(l => l['Approved To Send'] === true && l['Sent Status'].toLowerCase() !== 'sent' && l['Primary Email']).map(l => l.rowNumber)
      : leads.filter(l => l['Approved To Send Follow Up'] === true && l['Follow Up Sent Status'].toLowerCase() !== 'sent' && l['Primary Email']).map(l => l.rowNumber);

    if (targetRows.length === 0) {
      alert(`No approved ${type === 'first' ? 'first' : 'follow-up'} emails ready to send!`);
      return;
    }
    runChunkedAction('sendEmails', targetRows);
  };

  // 4. Setup Sheet
  const handleSetupSheet = async () => {
    if (!confirm('This will verify headers and setup formatting in Google Sheets. Proceed?')) return;
    setActiveAction('setupSheet');
    setLogMsgs(['Initializing sheet database schema...']);
    try {
      const res = await onRunBulkAction('setupSheet', {});
      if (res.success) {
        setLogMsgs(prev => [...prev, '✅ Sheets schema configured successfully!']);
      } else {
        throw new Error(res.message);
      }
    } catch (err) {
      setLogMsgs(prev => [...prev, `❌ Setup failed: ${err.message}`]);
    }
    setTimeout(() => {
      setActiveAction(null);
      setLogMsgs([]);
    }, 3000);
  };

  // 5. Deduplicate
  const handleDeduplicate = async () => {
    if (!confirm('This will delete duplicate rows in the spreadsheet. Proceed?')) return;
    setActiveAction('deleteDuplicates');
    setLogMsgs(['Detecting and removing duplicate rows...']);
    try {
      const res = await onRunBulkAction('deleteDuplicates', {});
      if (res.success) {
        setLogMsgs(prev => [...prev, `✅ Duplicate check complete. Removed ${res.deletedCount || 0} duplicate row(s).`]);
      } else {
        throw new Error(res.message);
      }
    } catch (err) {
      setLogMsgs(prev => [...prev, `❌ Deduplication failed: ${err.message}`]);
    }
    setTimeout(() => {
      setActiveAction(null);
      setLogMsgs([]);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      {/* Active progress indicator overlay */}
      {activeAction && (
        <div className="glass-panel border-prasha-gold/30 bg-slate-900/95 p-6 rounded-xl space-y-4">
          <div className="flex justify-between items-center text-sm font-semibold">
            <span className="text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-prasha-gold animate-ping"></span>
              Running Bulk Operation: {activeAction}
            </span>
            {progress.total > 0 && (
              <span className="text-prasha-gold">{progress.current} / {progress.total} Completed</span>
            )}
          </div>
          
          {progress.total > 0 && (
            <div className="h-2.5 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-prasha-gold transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          )}

          <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 max-h-[120px] overflow-y-auto text-[11px] font-mono text-slate-400 space-y-1">
            {logMsgs.map((msg, i) => (
              <p key={i}>{msg}</p>
            ))}
          </div>
        </div>
      )}

      {/* Grid of Bulk Operations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Import CSV */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800/40 flex flex-col justify-between glass-panel-hover gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-prasha-gold">
              <FileSpreadsheet size={20} />
              <h3 className="font-bold text-white text-sm">Upload Leads (CSV)</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload files or copy-paste raw lead tables directly. Features an interactive columns-mapping selector to automatically map your columns to the database.
            </p>
          </div>
          <button
            onClick={onOpenCsvModal}
            disabled={isProcessing || !!activeAction}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all"
          >
            <span>Launch CSV Importer</span>
          </button>
        </div>

        {/* Card 2: Bulk Enrichment Scrape */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800/40 flex flex-col justify-between glass-panel-hover gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-prasha-gold">
              <Sparkles size={20} />
              <h3 className="font-bold text-white text-sm">Enrich Unprocessed Leads</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Scrapes homepages and contact pages of newly added rows, extracts emails and phone numbers, classifications, lead score rating, and personalization hook angles.
            </p>
            <div className="inline-block px-2.5 py-1 bg-slate-900 border border-slate-800/80 rounded-md text-[10px] text-slate-300 font-medium">
              Target leads found: <span className="font-bold text-prasha-gold">{unenrichedCount}</span>
            </div>
          </div>
          <button
            onClick={handleBulkEnrich}
            disabled={isProcessing || !!activeAction || unenrichedCount === 0}
            className="w-full py-2 bg-prasha-gold hover:bg-prasha-gold/80 text-prasha-navy rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-45"
          >
            <Play size={12} />
            <span>Process Enrichment ({unenrichedCount})</span>
          </button>
        </div>

        {/* Card 3: Bulk Draft Emails */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800/40 flex flex-col justify-between glass-panel-hover gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-prasha-gold">
              <FileText size={20} />
              <h3 className="font-bold text-white text-sm">Bulk Outreach Email Drafting</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Drafts personalized emails using the enriched leads data, recommended industry hooks, and your digital transformation services.
            </p>
            <div className="flex gap-2">
              <div className="px-2.5 py-1 bg-slate-900 border border-slate-800/80 rounded-md text-[10px] text-slate-300 font-medium">
                Undrafted 1st Mails: <span className="font-bold text-prasha-gold">{undraftedFirstMails}</span>
              </div>
              <div className="px-2.5 py-1 bg-slate-900 border border-slate-800/80 rounded-md text-[10px] text-slate-300 font-medium">
                Undrafted Follow-ups: <span className="font-bold text-prasha-gold">{undraftedFollowUps}</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkDraft('first')}
              disabled={isProcessing || !!activeAction || undraftedFirstMails === 0}
              className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            >
              Draft 1st Mails
            </button>
            <button
              onClick={() => handleBulkDraft('followup')}
              disabled={isProcessing || !!activeAction || undraftedFollowUps === 0}
              className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            >
              Draft Follow-ups
            </button>
          </div>
        </div>

        {/* Card 4: Bulk Send Approved Emails */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800/40 flex flex-col justify-between glass-panel-hover gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-prasha-gold">
              <Send size={20} />
              <h3 className="font-bold text-white text-sm">Bulk Send Approved Outreach</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Triggers the Gmail API to send outreach emails on behalf of <span className="text-prasha-gold">sales@prashainfotech.com</span> for all approved lead rows.
            </p>
            <div className="flex gap-2">
              <div className="px-2.5 py-1 bg-slate-900 border border-slate-800/80 rounded-md text-[10px] text-slate-300 font-medium">
                Approved 1st Mails: <span className="font-bold text-emerald-400">{approvedFirstMails}</span>
              </div>
              <div className="px-2.5 py-1 bg-slate-900 border border-slate-800/80 rounded-md text-[10px] text-slate-300 font-medium">
                Approved Follow-ups: <span className="font-bold text-emerald-400">{approvedFollowUps}</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkSend('first')}
              disabled={isProcessing || !!activeAction || approvedFirstMails === 0}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-45"
            >
              Send 1st Mails ({approvedFirstMails})
            </button>
            <button
              onClick={() => handleBulkSend('followup')}
              disabled={isProcessing || !!activeAction || approvedFollowUps === 0}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-45"
            >
              Send Follow-ups ({approvedFollowUps})
            </button>
          </div>
        </div>

        {/* Card 5: Deduplicate Rows */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800/40 flex flex-col justify-between glass-panel-hover gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-prasha-gold">
              <Trash2 size={20} />
              <h3 className="font-bold text-white text-sm">De-duplicate Lead Rows</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Analyzes business name, website URLs, and primary emails to identify duplicate records. Automatically deletes duplicate rows safely from Google Sheets.
            </p>
          </div>
          <button
            onClick={handleDeduplicate}
            disabled={isProcessing || !!activeAction || totalLeads < 2}
            className="w-full py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-rose-400 hover:text-rose-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-45"
          >
            <Trash2 size={12} />
            <span>Remove Duplicate Rows</span>
          </button>
        </div>

        {/* Card 6: Sheets Setup Formatting */}
        <div className="glass-panel p-5 rounded-xl border border-slate-800/40 flex flex-col justify-between glass-panel-hover gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-prasha-gold">
              <Wrench size={20} />
              <h3 className="font-bold text-white text-sm">Sheets Schema Initialization</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Verifies if target spreadsheet has the correct header template. Safe and non-destructive: only appends missing columns, formats headers navy, and adds checkboxes.
            </p>
          </div>
          <button
            onClick={handleSetupSheet}
            disabled={isProcessing || !!activeAction}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-45"
          >
            <Wrench size={12} />
            <span>Run Sheet Setup Schema</span>
          </button>
        </div>

      </div>
    </div>
  );
}
