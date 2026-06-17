import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Sparkles, 
  Send, 
  AlertTriangle,
  Award,
  Globe,
  Mail,
  Phone,
  MapPin,
  Tag,
  BookOpen
} from 'lucide-react';

const isEmailSent = (lead) => {
  const status = String(lead['Sent Status'] || '').toLowerCase();
  return status.includes('sent') && !status.includes('not');
};

const isFollowUpSent = (lead) => {
  const status = String(lead['Follow Up Sent Status'] || '').toLowerCase();
  return status.includes('sent') && !status.includes('not');
};

export default function LeadDetailsModal({ 
  lead, 
  onClose, 
  onSaveLeadData, 
  onEnrichSingle, 
  onSendSingle, 
  onDraftSingle,
  isProcessing
}) {
  const [activeTab, setActiveTab] = useState('first-email'); // 'first-email' or 'followup' or 'info'
  
  // Form edit states
  const [businessName, setBusinessName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [industry, setIndustry] = useState('');
  const [notes, setNotes] = useState('');
  
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPage, setContactPage] = useState('');
  
  const [emailSubject, setEmailSubject] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [approvedToSend, setApprovedToSend] = useState(false);
  
  const [followUpSubject, setFollowUpSubject] = useState('');
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [approvedFollowUp, setApprovedFollowUp] = useState(false);

  // Sync state when lead changes
  useEffect(() => {
    if (lead) {
      setBusinessName(lead['Business Name'] || '');
      setWebsiteUrl(lead['Website URL'] || '');
      setAddress(lead['Address'] || '');
      setCity(lead['City'] || '');
      setIndustry(lead['Industry'] || '');
      setNotes(lead['Notes'] || '');
      setPrimaryEmail(lead['Primary Email'] || '');
      setPhone(lead['Phone'] || '');
      setContactPage(lead['Contact Page'] || '');
      
      setEmailSubject(lead['Email Subject'] || '');
      setEmailDraft(lead['Email Draft'] || '');
      setApprovedToSend(lead['Approved To Send'] === true);
      
      setFollowUpSubject(lead['Follow Up Subject'] || '');
      setFollowUpDraft(lead['Follow Up Draft'] || '');
      setApprovedFollowUp(lead['Approved To Send Follow Up'] === true);
    }
  }, [lead]);

  if (!lead) return null;

  const handleSave = async () => {
    const updates = [
      { colName: 'Business Name', value: businessName },
      { colName: 'Website URL', value: websiteUrl },
      { colName: 'Address', value: address },
      { colName: 'City', value: city },
      { colName: 'Industry', value: industry },
      { colName: 'Notes', value: notes },
      { colName: 'Primary Email', value: primaryEmail },
      { colName: 'Phone', value: phone },
      { colName: 'Contact Page', value: contactPage },
      { colName: 'Email Subject', value: emailSubject },
      { colName: 'Email Draft', value: emailDraft },
      { colName: 'Approved To Send', value: approvedToSend },
      { colName: 'Follow Up Subject', value: followUpSubject },
      { colName: 'Follow Up Draft', value: followUpDraft },
      { colName: 'Approved To Send Follow Up', value: approvedFollowUp },
    ];
    
    await onSaveLeadData(lead.rowNumber, updates);
  };

  const getScoreColor = (score) => {
    const num = Number(score || 0);
    if (num >= 80) return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
    if (num >= 60) return 'text-prasha-gold border-prasha-gold/20 bg-prasha-gold/10';
    if (num >= 40) return 'text-amber-500 border-amber-500/20 bg-amber-500/10';
    return 'text-rose-500 border-rose-500/20 bg-rose-500/10';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
      <div 
        className="glass-panel w-full max-w-4xl max-h-[90vh] rounded-2xl border border-prasha-gold/25 shadow-2xl flex flex-col bg-prasha-slate overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-prasha-navy/60">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-white tracking-wide truncate max-w-[400px]">
                {businessName || 'Lead Details'}
              </h2>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-xs">
                Row {lead.rowNumber}
              </span>
            </div>
            {websiteUrl && (
              <a 
                href={websiteUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="text-xs text-prasha-gold hover:underline flex items-center gap-1 mt-1"
              >
                <Globe size={12} />
                {websiteUrl}
              </a>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Lead Info Cards */}
          <div className="space-y-4 lg:col-span-1">
            {/* Score Card */}
            <div className="glass-panel border-slate-800/40 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Score & Quality</span>
                <Award size={18} className="text-prasha-gold" />
              </div>
              <div className="flex items-center gap-3">
                <div className={`border px-3 py-2 rounded-xl text-center ${getScoreColor(lead['Lead Score'])}`}>
                  <div className="text-2xl font-bold">{lead['Lead Score'] || '0'}</div>
                  <div className="text-[9px] uppercase tracking-wider font-semibold">Score</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{lead['Lead Quality'] || 'Unprocessed'}</div>
                  <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2" title={lead['Quality Reason']}>
                    {lead['Quality Reason'] || 'Pending email search and scoring.'}
                  </p>
                </div>
              </div>
            </div>

            {/* General Info Inputs */}
            <div className="glass-panel border-slate-800/40 p-4 rounded-xl space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-prasha-tan border-b border-slate-800 pb-2">Business Data</h3>
              
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Business Name</label>
                  <input 
                    type="text" 
                    value={businessName} 
                    onChange={(e) => setBusinessName(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-prasha-gold/45"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Website URL</label>
                  <input 
                    type="text" 
                    value={websiteUrl} 
                    onChange={(e) => setWebsiteUrl(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-prasha-gold/45"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">City</label>
                    <input 
                      type="text" 
                      value={city} 
                      onChange={(e) => setCity(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-prasha-gold/45"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Industry</label>
                    <input 
                      type="text" 
                      value={industry} 
                      onChange={(e) => setIndustry(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-prasha-gold/45"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Address</label>
                  <input 
                    type="text" 
                    value={address} 
                    onChange={(e) => setAddress(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-prasha-gold/45"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Notes</label>
                  <textarea 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    rows="2"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-prasha-gold/45 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Scraped Info inputs */}
            <div className="glass-panel border-slate-800/40 p-4 rounded-xl space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-prasha-tan border-b border-slate-800 pb-2">Scraped Contact Info</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Primary Email</label>
                  <input 
                    type="text" 
                    value={primaryEmail} 
                    onChange={(e) => setPrimaryEmail(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-prasha-gold/45"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Phone</label>
                  <input 
                    type="text" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-prasha-gold/45"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Contact Page</label>
                  <input 
                    type="text" 
                    value={contactPage} 
                    onChange={(e) => setContactPage(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-prasha-gold/45"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Columns: tabbed Outreach Workspace */}
          <div className="lg:col-span-2 flex flex-col space-y-4">
            
            {/* Tabs Selector */}
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveTab('first-email')}
                className={`flex-1 py-2 rounded-md text-xs font-semibold tracking-wide transition-all ${
                  activeTab === 'first-email' 
                    ? 'bg-prasha-gold text-prasha-navy' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                1st Outreach Email
              </button>
              <button
                onClick={() => setActiveTab('followup')}
                className={`flex-1 py-2 rounded-md text-xs font-semibold tracking-wide transition-all ${
                  activeTab === 'followup' 
                    ? 'bg-prasha-gold text-prasha-navy' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Follow-up Email
              </button>
              <button
                onClick={() => setActiveTab('info')}
                className={`flex-1 py-2 rounded-md text-xs font-semibold tracking-wide transition-all ${
                  activeTab === 'info' 
                    ? 'bg-prasha-gold text-prasha-navy' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Outreach Strategy
              </button>
            </div>

            {/* Tab: First Email */}
            {activeTab === 'first-email' && (
              <div className="glass-panel border-slate-800/40 p-5 rounded-xl flex-1 flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Outreach Email Workspace</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    isEmailSent(lead) 
                      ? 'bg-emerald-500/10 text-emerald-400' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isEmailSent(lead) ? `Sent at ${lead['Sent At'] ? new Date(lead['Sent At']).toLocaleDateString() : ''}` : 'Draft'}
                  </span>
                </div>

                <div className="space-y-4 flex-1 flex flex-col text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Subject Line</label>
                    <input 
                      type="text" 
                      value={emailSubject} 
                      onChange={(e) => setEmailSubject(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white font-medium focus:outline-none focus:border-prasha-gold/45"
                    />
                  </div>
                  <div className="flex-1 flex flex-col">
                    <label className="text-slate-400 block mb-1">Email Body</label>
                    <textarea 
                      value={emailDraft} 
                      onChange={(e) => setEmailDraft(e.target.value)} 
                      rows="12"
                      className="w-full flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-2.5 text-white font-mono leading-relaxed focus:outline-none focus:border-prasha-gold/45 resize-none"
                    />
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-slate-800/60">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={approvedToSend} 
                      onChange={(e) => setApprovedToSend(e.target.checked)}
                      disabled={isEmailSent(lead)}
                      className="rounded bg-slate-900 border-slate-800 text-prasha-gold focus:ring-0 cursor-pointer disabled:opacity-40"
                    />
                    <span className="text-xs font-semibold text-slate-300">Approve to Send First Email</span>
                  </label>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => onDraftSingle(lead.rowNumber, 'first')}
                      disabled={isProcessing}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-xs font-semibold transition-all"
                    >
                      <Sparkles size={12} />
                      Regenerate Draft
                    </button>
                    <button
                      onClick={() => onSendSingle(lead.rowNumber)}
                      disabled={isProcessing || !approvedToSend || isEmailSent(lead) || !primaryEmail}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                    >
                      <Send size={12} />
                      Send Now
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Follow-up Email */}
            {activeTab === 'followup' && (
              <div className="glass-panel border-slate-800/40 p-5 rounded-xl flex-1 flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Follow-up Email Workspace</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    isFollowUpSent(lead) 
                      ? 'bg-emerald-500/10 text-emerald-400' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isFollowUpSent(lead) ? `Sent at ${lead['Follow Up Sent At'] ? new Date(lead['Follow Up Sent At']).toLocaleDateString() : ''}` : 'Draft'}
                  </span>
                </div>

                {/* Warning: first email must be sent */}
                {!isEmailSent(lead) && (
                  <div className="border border-rose-500/25 bg-rose-500/5 p-3 rounded-lg flex items-center gap-2 text-xs text-rose-400">
                    <AlertTriangle size={16} />
                    <span>Warning: The first email has not been sent yet. Follow-up drafts should normally only be sent after the first email.</span>
                  </div>
                )}

                <div className="space-y-4 flex-1 flex flex-col text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Subject Line</label>
                    <input 
                      type="text" 
                      value={followUpSubject} 
                      onChange={(e) => setFollowUpSubject(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white font-medium focus:outline-none focus:border-prasha-gold/45"
                    />
                  </div>
                  <div className="flex-1 flex flex-col">
                    <label className="text-slate-400 block mb-1">Email Body</label>
                    <textarea 
                      value={followUpDraft} 
                      onChange={(e) => setFollowUpDraft(e.target.value)} 
                      rows="12"
                      className="w-full flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-2.5 text-white font-mono leading-relaxed focus:outline-none focus:border-prasha-gold/45 resize-none"
                    />
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-slate-800/60">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={approvedFollowUp} 
                      onChange={(e) => setApprovedFollowUp(e.target.checked)}
                      disabled={isFollowUpSent(lead) || !isEmailSent(lead)}
                      className="rounded bg-slate-900 border-slate-800 text-prasha-gold focus:ring-0 cursor-pointer disabled:opacity-40"
                    />
                    <span className="text-xs font-semibold text-slate-300">Approve to Send Follow-up</span>
                  </label>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => onDraftSingle(lead.rowNumber, 'followup')}
                      disabled={isProcessing || !isEmailSent(lead)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-xs font-semibold transition-all disabled:opacity-45"
                    >
                      <Sparkles size={12} />
                      Regenerate Draft
                    </button>
                    <button
                      onClick={() => onSendSingle(lead.rowNumber)}
                      disabled={isProcessing || !approvedFollowUp || isFollowUpSent(lead) || !primaryEmail}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                    >
                      <Send size={12} />
                      Send Now
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Strategy Info */}
            {activeTab === 'info' && (
              <div className="glass-panel border-slate-800/40 p-5 rounded-xl flex-1 space-y-4 text-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Outreach Personalization Strategy</h3>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-prasha-gold font-semibold">
                      <Tag size={14} />
                      <span>Recommended Outreach Angle</span>
                    </div>
                    <p className="bg-slate-900 p-3 rounded-lg border border-slate-800/80 text-white leading-relaxed font-medium">
                      {lead['Recommended Angle'] || 'No angle generated. Enrich lead to extract industry patterns.'}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-prasha-gold font-semibold">
                      <BookOpen size={14} />
                      <span>Personalization Hook Context</span>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/80 text-white leading-relaxed space-y-2">
                      <p className="font-semibold text-slate-300">I was looking at...</p>
                      <p className="text-slate-100 font-mono italic">"{lead['Personalization Point'] || 'Enrich lead to compile custom personalization details.'}"</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-800/50 pt-3 flex flex-col sm:flex-row justify-between text-[11px] text-slate-500 gap-2">
                    <span>Last Checked: {lead['Last Checked'] ? new Date(lead['Last Checked']).toLocaleString() : 'Never'}</span>
                    <button
                      onClick={() => onEnrichSingle(lead.rowNumber)}
                      disabled={isProcessing || !websiteUrl}
                      className="text-prasha-gold hover:text-white flex items-center gap-1 font-semibold disabled:opacity-40"
                    >
                      <Sparkles size={11} />
                      Scrape Website & Update Strategy
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-prasha-navy/35 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-xs font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-5 py-2 bg-prasha-gold hover:bg-prasha-gold/80 text-prasha-navy rounded-lg text-xs font-bold shadow-lg shadow-prasha-gold/10 transition-all disabled:opacity-40"
          >
            <Save size={13} />
            Save Changes
          </button>
        </div>

      </div>
    </div>
  );
}
