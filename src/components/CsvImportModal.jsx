import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Check, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';

const REQUIRED_MAPPING_FIELDS = [
  'Business Name',
  'Website URL',
  'Address',
  'City',
  'Industry',
  'Notes'
];

const AUTO_MAPPING_RULES = {
  'Business Name': ['business name', 'company', 'company name', 'client', 'client name', 'name', 'business'],
  'Website URL': ['website url', 'url', 'website', 'site', 'domain', 'web'],
  'Address': ['address', 'street address', 'location', 'full address'],
  'City': ['city', 'town', 'locality'],
  'Industry': ['industry', 'category', 'business type', 'type', 'niche', 'sector'],
  'Notes': ['notes', 'note', 'description', 'remarks', 'details']
};

export default function CsvImportModal({ onClose, onImportSubmit, isImporting }) {
  const [csvText, setCsvText] = useState('');
  const [csvData, setCsvData] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [mappings, setMappings] = useState({});
  const [step, setStep] = useState(1); // 1: input, 2: mapping, 3: preview
  const [errorMsg, setErrorMsg] = useState('');

  // Handle CSV file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      parseCsvString(event.target.result);
    };
    reader.readAsText(file);
  };

  // Parse CSV text
  const parseCsvString = (text) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setErrorMsg(`Failed to parse CSV: ${results.errors[0].message}`);
          return;
        }
        
        if (results.data.length === 0) {
          setErrorMsg('CSV contains no data.');
          return;
        }

        const headers = Object.keys(results.data[0]);
        setCsvHeaders(headers);
        setCsvData(results.data);
        autoMapHeaders(headers);
        setErrorMsg('');
        setStep(2);
      },
      error: (err) => {
        setErrorMsg(`Parser error: ${err.message}`);
      }
    });
  };

  // Automatically map source headers to template fields based on rules
  const autoMapHeaders = (headers) => {
    const initialMappings = {};
    REQUIRED_MAPPING_FIELDS.forEach(field => {
      const aliases = AUTO_MAPPING_RULES[field];
      const match = headers.find(h => {
        const normalized = h.toLowerCase().trim().replace(/[_-]+/g, ' ');
        return aliases.includes(normalized);
      });
      initialMappings[field] = match || '';
    });
    setMappings(initialMappings);
  };

  // Handle map change
  const handleMapChange = (field, csvHeader) => {
    setMappings(prev => ({
      ...prev,
      [field]: csvHeader
    }));
  };

  // Convert mapped data to template objects
  const getMappedLeads = () => {
    if (!csvData) return [];
    return csvData.map(row => {
      const lead = {};
      REQUIRED_MAPPING_FIELDS.forEach(field => {
        const csvHeader = mappings[field];
        lead[field] = csvHeader ? String(row[csvHeader] || '').trim() : '';
      });
      return lead;
    });
  };

  const handleSubmit = () => {
    // Validate mapping (must map Business Name or Website URL)
    if (!mappings['Business Name'] && !mappings['Website URL']) {
      setErrorMsg('You must map at least "Business Name" or "Website URL" to import leads.');
      return;
    }

    const mappedLeads = getMappedLeads();
    onImportSubmit(mappedLeads);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-prasha-gold/25 shadow-2xl flex flex-col bg-prasha-slate overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-prasha-navy/60">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-prasha-gold" size={20} />
            <h2 className="text-md font-bold text-white tracking-wide">Import Leads from CSV</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error panel */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 border border-rose-500/20 bg-rose-500/5 text-xs text-rose-400 rounded-lg flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 1: Paste / Upload Input */}
        {step === 1 && (
          <div className="p-6 space-y-4">
            <div className="border-2 border-dashed border-slate-800 hover:border-prasha-gold/40 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="text-prasha-gold/60 mb-3" size={32} />
              <p className="text-sm font-semibold text-white">Click or drag CSV file here</p>
              <p className="text-xs text-slate-500 mt-1">Upload a standard CSV file with headers in the first row.</p>
            </div>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">Or</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400">Paste Raw CSV Text</label>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Business Name,Website URL,City,Industry,Notes&#10;Prasha Infotech,https://prashainfotech.com,Vadodara,IT Support,Client note"
                rows="6"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-prasha-gold/45"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => csvText.trim() ? parseCsvString(csvText) : setErrorMsg('Please paste CSV data first.')}
                className="px-5 py-2 bg-prasha-gold hover:bg-prasha-gold/80 text-prasha-navy font-bold rounded-lg text-xs transition-colors"
              >
                Parse Data
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 2 && (
          <div className="p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white">Map CSV Columns</h3>
              <p className="text-xs text-slate-400 mt-0.5">Link your CSV fields to our target spreadsheet fields.</p>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {REQUIRED_MAPPING_FIELDS.map((field) => (
                <div key={field} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800 gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white">{field}</span>
                    {(field === 'Business Name' || field === 'Website URL') && (
                      <span className="text-[10px] text-rose-500 font-bold">*</span>
                    )}
                  </div>
                  <select
                    value={mappings[field]}
                    onChange={(e) => handleMapChange(field, e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded px-2 py-1.5 sm:w-56 focus:outline-none focus:border-prasha-gold/40"
                  >
                    <option value="">-- Skip Column --</option>
                    {csvHeaders.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-800/60">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-semibold"
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (!mappings['Business Name'] && !mappings['Website URL']) {
                    setErrorMsg('You must map "Business Name" or "Website URL"');
                  } else {
                    setErrorMsg('');
                    setStep(3);
                  }
                }}
                className="px-5 py-2 bg-prasha-gold hover:bg-prasha-gold/80 text-prasha-navy font-bold rounded-lg text-xs"
              >
                Review Import
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview Mapped Leads */}
        {step === 3 && csvData && (
          <div className="p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white">Review Lead Import</h3>
              <p className="text-xs text-slate-400 mt-0.5">Review the first few records before appending them to Google Sheets.</p>
            </div>

            <div className="border border-slate-800 rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
              <table className="w-full border-collapse text-left text-[11px]">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400">
                    <th className="p-2.5 font-bold uppercase">Business Name</th>
                    <th className="p-2.5 font-bold uppercase">Website URL</th>
                    <th className="p-2.5 font-bold uppercase">City</th>
                    <th className="p-2.5 font-bold uppercase">Industry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {getMappedLeads().slice(0, 5).map((lead, i) => (
                    <tr key={i} className="text-slate-300">
                      <td className="p-2.5 font-semibold text-white truncate max-w-[120px]">{lead['Business Name'] || '—'}</td>
                      <td className="p-2.5 truncate max-w-[150px] text-prasha-gold">{lead['Website URL'] || '—'}</td>
                      <td className="p-2.5">{lead['City'] || '—'}</td>
                      <td className="p-2.5">{lead['Industry'] || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg">
              <Check size={16} />
              <span>Ready to import {csvData.length} leads directly into the spreadsheet.</span>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-800/60">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-semibold"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isImporting}
                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-xs disabled:opacity-40 transition-colors"
              >
                {isImporting ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
