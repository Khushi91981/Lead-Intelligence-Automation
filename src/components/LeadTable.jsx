import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Eye, 
  Sparkles, 
  Send, 
  ArrowUpDown, 
  Check, 
  AlertCircle,
  Clock,
  Filter,
  Trash2,
  CheckSquare,
  Square
} from 'lucide-react';

export default function LeadTable({ 
  leads, 
  viewType = 'all', // 'all' or 'sent'
  onRowClick, 
  onEnrichSingle, 
  onSendSingle,
  onUpdateCheckbox,
  isProcessingRow
}) {
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [scoreFilter, setScoreFilter] = useState(0);
  const [emailStatusFilter, setEmailStatusFilter] = useState('');

  // Sorting States
  const [sortField, setSortField] = useState('rowNumber');
  const [sortDirection, setSortDirection] = useState('asc');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Get unique options for filter dropdowns
  const uniqueIndustries = useMemo(() => {
    return [...new Set(leads.map(l => l['Industry']).filter(Boolean))].sort();
  }, [leads]);

  const uniqueCities = useMemo(() => {
    return [...new Set(leads.map(l => l['City']).filter(Boolean))].sort();
  }, [leads]);

  // Handle Sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter Leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // 1. Tab-specific filtering
      if (viewType === 'sent') {
        const isSent = lead['Sent Status'].toLowerCase() === 'sent' || lead['Follow Up Sent Status'].toLowerCase() === 'sent';
        if (!isSent) return false;
      }

      // 2. Search Text
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = !searchTerm || 
        (lead['Business Name'] || '').toLowerCase().includes(searchLower) ||
        (lead['Website URL'] || '').toLowerCase().includes(searchLower) ||
        (lead['Primary Email'] || '').toLowerCase().includes(searchLower) ||
        (lead['Notes'] || '').toLowerCase().includes(searchLower);

      // 3. Quality Filter
      const matchQuality = !qualityFilter || lead['Lead Quality'] === qualityFilter;

      // 4. Industry Filter
      const matchIndustry = !industryFilter || lead['Industry'] === industryFilter;

      // 5. City Filter
      const matchCity = !cityFilter || lead['City'] === cityFilter;

      // 6. Score Filter
      const matchScore = Number(lead['Lead Score'] || 0) >= scoreFilter;

      // 7. Email Status Filter
      let matchEmailStatus = true;
      if (emailStatusFilter) {
        const sent = lead['Sent Status'].toLowerCase() === 'sent';
        const approved = lead['Approved To Send'] === true;
        const drafted = !!lead['Email Subject'] && !!lead['Email Draft'];

        if (emailStatusFilter === 'sent') matchEmailStatus = sent;
        else if (emailStatusFilter === 'approved') matchEmailStatus = approved && !sent;
        else if (emailStatusFilter === 'drafted') matchEmailStatus = drafted && !approved && !sent;
        else if (emailStatusFilter === 'unprocessed') matchEmailStatus = !drafted && !sent;
      }

      return matchSearch && matchQuality && matchIndustry && matchCity && matchScore && matchEmailStatus;
    });
  }, [leads, viewType, searchTerm, qualityFilter, industryFilter, cityFilter, scoreFilter, emailStatusFilter]);

  // Sort Leads
  const sortedLeads = useMemo(() => {
    const sorted = [...filteredLeads];
    sorted.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Convert to number if numeric
      if (sortField === 'Lead Score' || sortField === 'rowNumber') {
        valA = Number(valA || 0);
        valB = Number(valB || 0);
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredLeads, sortField, sortDirection]);

  // Paginated Leads
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedLeads.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedLeads, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedLeads.length / itemsPerPage);

  const getQualityBadge = (quality) => {
    switch (quality) {
      case 'High':
        return <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-bold">High</span>;
      case 'Medium':
        return <span className="px-2 py-1 bg-prasha-gold/10 text-prasha-gold border border-prasha-gold/20 rounded-md text-[10px] font-bold">Medium</span>;
      case 'Low':
        return <span className="px-2 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-md text-[10px] font-bold">Low</span>;
      case 'Needs Review':
        return <span className="px-2 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md text-[10px] font-bold">Needs Review</span>;
      default:
        return <span className="px-2 py-1 bg-slate-800 text-slate-400 rounded-md text-[10px] font-bold">Unprocessed</span>;
    }
  };

  const getEmailStatusIcon = (lead) => {
    const isSent = lead['Sent Status'].toLowerCase() === 'sent';
    const isApproved = lead['Approved To Send'] === true;
    const isDrafted = lead['Email Subject'] && lead['Email Draft'];

    if (isSent) {
      return (
        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
          <Check size={14} />
          <span>Sent</span>
        </span>
      );
    }
    if (isApproved) {
      return (
        <span className="flex items-center gap-1.5 text-xs text-prasha-gold">
          <Clock size={14} />
          <span>Approved</span>
        </span>
      );
    }
    if (isDrafted) {
      return (
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock size={14} className="text-slate-500" />
          <span>Drafted</span>
        </span>
      );
    }
    return <span className="text-xs text-slate-600">—</span>;
  };

  const getFollowUpStatusIcon = (lead) => {
    const isSent = lead['Follow Up Sent Status'].toLowerCase() === 'sent';
    const isApproved = lead['Approved To Send Follow Up'] === true;
    const isDrafted = lead['Follow Up Subject'] && lead['Follow Up Draft'];

    if (isSent) {
      return (
        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
          <Check size={14} />
          <span>Sent</span>
        </span>
      );
    }
    if (isApproved) {
      return (
        <span className="flex items-center gap-1.5 text-xs text-prasha-gold">
          <Clock size={14} />
          <span>Approved</span>
        </span>
      );
    }
    if (isDrafted) {
      return (
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock size={14} className="text-slate-500" />
          <span>Drafted</span>
        </span>
      );
    }
    return <span className="text-xs text-slate-600">—</span>;
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="glass-panel p-5 rounded-xl border border-slate-800/40 space-y-4">
        {/* Filter Toggle Header */}
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Filter size={16} className="text-prasha-gold" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Filters & Search</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search bar */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search Business, Web, Email..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-900 border border-slate-800 focus:border-prasha-gold/50 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none transition-all"
            />
          </div>

          {/* Quality Filter */}
          <div>
            <select
              value={qualityFilter}
              onChange={(e) => { setQualityFilter(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-900 border border-slate-800 focus:border-prasha-gold/50 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none transition-all"
            >
              <option value="">All Qualities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Needs Review">Needs Review</option>
              <option value="Unprocessed">Unprocessed</option>
            </select>
          </div>

          {/* Industry Filter */}
          <div>
            <select
              value={industryFilter}
              onChange={(e) => { setIndustryFilter(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-900 border border-slate-800 focus:border-prasha-gold/50 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none transition-all truncate"
            >
              <option value="">All Industries</option>
              {uniqueIndustries.map((ind, i) => (
                <option key={i} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          {/* Email Status Filter */}
          <div>
            <select
              value={emailStatusFilter}
              onChange={(e) => { setEmailStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-900 border border-slate-800 focus:border-prasha-gold/50 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none transition-all"
            >
              <option value="">All Email Statuses</option>
              <option value="sent">Sent</option>
              <option value="approved">Approved</option>
              <option value="drafted">Drafted</option>
              <option value="unprocessed">Unprocessed</option>
            </select>
          </div>
        </div>

        {/* Slider for Min Lead Score */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
          <div className="flex items-center gap-2 min-w-[150px]">
            <span className="text-xs text-slate-400">Min Score:</span>
            <span className="text-sm font-bold text-prasha-gold">{scoreFilter}</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={scoreFilter}
            onChange={(e) => { setScoreFilter(Number(e.target.value)); setCurrentPage(1); }}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-prasha-gold"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="glass-panel rounded-xl border border-slate-800/40 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-prasha-navy border-b border-slate-800">
                <th className="p-4 text-xs font-bold text-prasha-tan tracking-[1px] uppercase w-12 text-center">Row</th>
                <th onClick={() => handleSort('Business Name')} className="p-4 text-xs font-bold text-prasha-tan tracking-[1px] uppercase cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>Business</span>
                    <ArrowUpDown size={12} className="text-slate-500" />
                  </div>
                </th>
                <th onClick={() => handleSort('City')} className="p-4 text-xs font-bold text-prasha-tan tracking-[1px] uppercase cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>City / Industry</span>
                    <ArrowUpDown size={12} className="text-slate-500" />
                  </div>
                </th>
                <th onClick={() => handleSort('Primary Email')} className="p-4 text-xs font-bold text-prasha-tan tracking-[1px] uppercase cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>Primary Contact</span>
                    <ArrowUpDown size={12} className="text-slate-500" />
                  </div>
                </th>
                <th onClick={() => handleSort('Lead Score')} className="p-4 text-xs font-bold text-prasha-tan tracking-[1px] uppercase cursor-pointer hover:text-white text-center transition-colors">
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Score</span>
                    <ArrowUpDown size={12} className="text-slate-500" />
                  </div>
                </th>
                <th onClick={() => handleSort('Lead Quality')} className="p-4 text-xs font-bold text-prasha-tan tracking-[1px] uppercase cursor-pointer hover:text-white transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>Quality</span>
                    <ArrowUpDown size={12} className="text-slate-500" />
                  </div>
                </th>
                {/* Checkbox columns */}
                <th className="p-4 text-xs font-bold text-prasha-tan tracking-[1px] uppercase text-center w-28">Email Appr.</th>
                <th className="p-4 text-xs font-bold text-prasha-tan tracking-[1px] uppercase text-center w-28">Follow-Up Appr.</th>
                <th className="p-4 text-xs font-bold text-prasha-tan tracking-[1px] uppercase text-center">Outreach</th>
                <th className="p-4 text-xs font-bold text-prasha-tan tracking-[1px] uppercase text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {paginatedLeads.length > 0 ? (
                paginatedLeads.map((lead) => {
                  const isRowProcessing = isProcessingRow(lead.rowNumber);
                  
                  return (
                    <tr 
                      key={lead.rowNumber} 
                      className={`hover:bg-slate-900/45 transition-colors border-b border-slate-900/40 ${
                        isRowProcessing ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      {/* Row # */}
                      <td className="p-4 text-xs font-semibold text-slate-500 text-center">{lead.rowNumber}</td>
                      
                      {/* Business Name & URL */}
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white truncate max-w-[200px]">{lead['Business Name'] || 'No Name'}</span>
                          {lead['Website URL'] ? (
                            <a 
                              href={lead['Website URL']} 
                              target="_blank" 
                              rel="noreferrer" 
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] text-prasha-gold hover:underline truncate max-w-[200px] mt-0.5"
                            >
                              {lead['Website URL'].replace(/^https?:\/\//i, '').replace(/^www\./i, '')}
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-600">No website</span>
                          )}
                        </div>
                      </td>

                      {/* City & Industry */}
                      <td className="p-4">
                        <div className="flex flex-col text-xs text-slate-300">
                          <span>{lead['City'] || '—'}</span>
                          <span className="text-[10px] text-slate-500 truncate max-w-[150px]">{lead['Industry'] || '—'}</span>
                        </div>
                      </td>

                      {/* Primary Contact Details */}
                      <td className="p-4">
                        <div className="flex flex-col text-xs text-slate-300">
                          {lead['Primary Email'] ? (
                            <span className="font-medium text-slate-200">{lead['Primary Email']}</span>
                          ) : (
                            <span className="text-slate-600">No Email Found</span>
                          )}
                          <span className="text-[10px] text-slate-500 mt-0.5">{lead['Phone'] || 'No Phone'}</span>
                        </div>
                      </td>

                      {/* Lead Score */}
                      <td className="p-4 text-center">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          Number(lead['Lead Score'] || 0) >= 80 ? 'text-emerald-400 bg-emerald-500/10' :
                          Number(lead['Lead Score'] || 0) >= 60 ? 'text-prasha-gold bg-prasha-gold/10' :
                          Number(lead['Lead Score'] || 0) >= 40 ? 'text-amber-500 bg-amber-500/10' : 'text-slate-500'
                        }`}>
                          {lead['Lead Score'] || '0'}
                        </span>
                      </td>

                      {/* Lead Quality */}
                      <td className="p-4">{getQualityBadge(lead['Lead Quality'])}</td>

                      {/* Email Approved checkbox */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => onUpdateCheckbox(lead.rowNumber, 'Approved To Send', !lead['Approved To Send'])}
                          className="focus:outline-none"
                          disabled={lead['Sent Status'].toLowerCase() === 'sent'}
                        >
                          {lead['Approved To Send'] ? (
                            <CheckSquare className="text-prasha-gold mx-auto hover:text-prasha-gold/80 transition-colors" size={18} />
                          ) : (
                            <Square className="text-slate-700 mx-auto hover:text-slate-500 transition-colors" size={18} />
                          )}
                        </button>
                      </td>

                      {/* Follow up Approved checkbox */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => onUpdateCheckbox(lead.rowNumber, 'Approved To Send Follow Up', !lead['Approved To Send Follow Up'])}
                          className="focus:outline-none"
                          disabled={lead['Follow Up Sent Status'].toLowerCase() === 'sent' || lead['Sent Status'].toLowerCase() !== 'sent'}
                        >
                          {lead['Approved To Send Follow Up'] ? (
                            <CheckSquare className="text-prasha-gold mx-auto hover:text-prasha-gold/80 transition-colors" size={18} />
                          ) : (
                            <Square className="text-slate-700 mx-auto hover:text-slate-500 transition-colors" size={18} />
                          )}
                        </button>
                      </td>

                      {/* Outreach Funnel status icons */}
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          {getEmailStatusIcon(lead)}
                          {getFollowUpStatusIcon(lead) !== <span className="text-xs text-slate-600">—</span> && (
                            <div className="text-[10px] text-purple-400 border-t border-slate-800/40 pt-0.5 mt-0.5">
                              FU: {getFollowUpStatusIcon(lead)}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* View details */}
                          <button
                            onClick={() => onRowClick(lead)}
                            title="View / Edit Draft"
                            className="p-1.5 bg-slate-800 text-slate-300 hover:text-prasha-gold hover:bg-prasha-gold/10 rounded-md border border-slate-700/50 transition-all duration-200"
                          >
                            <Eye size={13} />
                          </button>

                          {/* Enrich Single Lead */}
                          <button
                            onClick={() => onEnrichSingle(lead.rowNumber)}
                            title="Enrich Lead Info"
                            disabled={!lead['Website URL']}
                            className="p-1.5 bg-slate-800 text-slate-300 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md border border-slate-700/50 transition-all duration-200 disabled:opacity-30 disabled:hover:bg-slate-800 disabled:hover:text-slate-300"
                          >
                            <Sparkles size={13} />
                          </button>

                          {/* Send Email Directly */}
                          <button
                            onClick={() => onSendSingle(lead.rowNumber)}
                            title="Send Approved Mail"
                            disabled={
                              (!lead['Approved To Send'] && !lead['Approved To Send Follow Up']) ||
                              (lead['Sent Status'].toLowerCase() === 'sent' && lead['Follow Up Sent Status'].toLowerCase() === 'sent') ||
                              !lead['Primary Email']
                            }
                            className="p-1.5 bg-slate-800 text-slate-300 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md border border-slate-700/50 transition-all duration-200 disabled:opacity-30"
                          >
                            <Send size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="10" className="p-8 text-center text-sm text-slate-500">
                    No leads found matching current criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {sortedLeads.length > 0 && (
          <div className="bg-prasha-navy/50 border-t border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-xs text-slate-400 font-medium">
              Showing <span className="font-semibold text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-semibold text-white">
                {Math.min(currentPage * itemsPerPage, sortedLeads.length)}
              </span>{' '}
              of <span className="font-semibold text-white">{sortedLeads.length}</span> leads
            </div>

            <div className="flex items-center gap-4">
              {/* Items per page selector */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Show:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white focus:outline-none"
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </div>

              {/* Page buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs bg-slate-900 border border-slate-800 text-slate-400 rounded-md hover:bg-slate-800 hover:text-white transition-all disabled:opacity-40"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 text-slate-400 rounded-md hover:bg-slate-800 hover:text-white transition-all disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-xs text-slate-400 px-2">
                  Page <span className="font-bold text-white">{currentPage}</span> of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 text-slate-400 rounded-md hover:bg-slate-800 hover:text-white transition-all disabled:opacity-40"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs bg-slate-900 border border-slate-800 text-slate-400 rounded-md hover:bg-slate-800 hover:text-white transition-all disabled:opacity-40"
                >
                  Last
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
