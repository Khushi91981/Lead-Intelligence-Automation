import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Search, 
  ArrowRight, 
  AlertCircle,
  Link2
} from 'lucide-react';

export default function SheetSelector({ files, onSelectSheet, isConnecting }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [manualId, setManualId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Filter Drive Files
  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Extract ID from URL if pasted
  const handleManualConnect = () => {
    let cleanId = manualId.trim();
    if (cleanId.includes('/spreadsheets/d/')) {
      const match = cleanId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        cleanId = match[1];
      }
    }

    if (!cleanId) {
      setErrorMsg('Please enter a valid Spreadsheet ID or Paste a Google Sheets URL.');
      return;
    }

    setErrorMsg('');
    onSelectSheet(cleanId, 'Manually Connected Spreadsheet');
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Overview Intro */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-white tracking-wide">Connect Google Sheet Database</h2>
        <p className="text-sm text-slate-400 max-w-sm mx-auto">
          The dashboard will read and write leads data directly to your selected sheet, acting as the database.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 border border-rose-500/20 bg-rose-500/5 text-xs text-rose-400 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Manual Input Form */}
      <div className="glass-panel p-5 rounded-xl border border-slate-800/40 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-prasha-tan flex items-center gap-1.5">
          <Link2 size={14} />
          <span>Paste Spreadsheet Link or ID</span>
        </h3>
        
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            className="flex-grow bg-slate-900 border border-slate-800 focus:border-prasha-gold/45 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-0"
          />
          <button
            onClick={handleManualConnect}
            disabled={isConnecting}
            className="px-4 py-2 bg-prasha-gold hover:bg-prasha-gold/80 text-prasha-navy font-bold rounded-lg text-xs flex items-center gap-1 transition-colors disabled:opacity-40"
          >
            <span>Connect</span>
            <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* Drive Spreadsheets List */}
      <div className="glass-panel p-5 rounded-xl border border-slate-800/40 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-prasha-tan flex items-center gap-1.5">
          <FileSpreadsheet size={14} />
          <span>Select from Google Drive</span>
        </h3>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-prasha-gold/45 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white focus:outline-none focus:ring-0"
          />
        </div>

        {/* File List */}
        <div className="max-h-[200px] overflow-y-auto space-y-1.5 pr-1">
          {filteredFiles.length > 0 ? (
            filteredFiles.map((file) => (
              <button
                key={file.id}
                onClick={() => onSelectSheet(file.id, file.name)}
                disabled={isConnecting}
                className="w-full p-3 bg-slate-900 hover:bg-slate-800/60 border border-slate-800/80 hover:border-slate-700 rounded-lg flex items-center justify-between text-left transition-all disabled:opacity-45"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-emerald-500/10 rounded-md">
                    <FileSpreadsheet className="text-emerald-500" size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate max-w-[250px]">{file.name}</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Modified: {new Date(file.modifiedTime).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-prasha-gold uppercase tracking-wider">Connect</span>
              </button>
            ))
          ) : (
            <p className="text-center py-4 text-xs text-slate-500">
              {files.length === 0 ? 'No spreadsheets found in your Google Drive.' : 'No matching files.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
