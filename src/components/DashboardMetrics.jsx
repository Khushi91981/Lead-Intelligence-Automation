import React from 'react';
import { 
  Users, 
  CheckCircle2, 
  Mail, 
  MailX, 
  Award, 
  AlertTriangle, 
  FileText, 
  Send, 
  RotateCw,
  FolderOpen
} from 'lucide-react';

export default function DashboardMetrics({ leads, lastSyncMeta, unprocessedCount }) {
  // Compute metrics
  const totalLeads = leads.length;
  const processedLeads = leads.filter(l => l['Last Checked']).length;
  const emailsFound = leads.filter(l => l['Last Checked'] && l['Primary Email']).length;
  const emailsMissing = leads.filter(l => l['Last Checked'] && !l['Primary Email']).length;

  const highQuality = leads.filter(l => l['Lead Quality'] === 'High').length;
  const mediumQuality = leads.filter(l => l['Lead Quality'] === 'Medium').length;
  const lowQuality = leads.filter(l => l['Lead Quality'] === 'Low').length;
  const needsReview = leads.filter(l => l['Lead Quality'] === 'Needs Review').length;

  const firstDrafts = leads.filter(l => l['Email Subject'] && l['Email Draft'] && l['Sent Status'].toLowerCase() !== 'sent').length;
  const firstSent = leads.filter(l => l['Sent Status'].toLowerCase() === 'sent').length;
  const followUpDrafts = leads.filter(l => l['Follow Up Subject'] && l['Follow Up Draft'] && l['Follow Up Sent Status'].toLowerCase() !== 'sent').length;
  const followUpSent = leads.filter(l => l['Follow Up Sent Status'].toLowerCase() === 'sent').length;

  const emailDiscoveryRate = processedLeads > 0 ? Math.round((emailsFound / processedLeads) * 100) : 0;

  const cards = [
    // Database Overview
    {
      group: 'Pipeline Core',
      items: [
        { label: 'Total Leads', value: totalLeads, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Leads Processed', value: processedLeads, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Emails Discovered', value: emailsFound, icon: Mail, color: 'text-teal-400', bg: 'bg-teal-500/10' },
        { label: 'Success Rate', value: `${emailDiscoveryRate}%`, icon: RotateCw, color: 'text-indigo-400', bg: 'bg-indigo-500/10' }
      ]
    },
    // Lead Quality
    {
      group: 'Lead Quality Distribution',
      items: [
        { label: 'High Quality', value: highQuality, icon: Award, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
        { label: 'Medium Quality', value: mediumQuality, icon: Award, color: 'text-prasha-gold', bg: 'bg-prasha-gold/10', border: 'border-prasha-gold/20' },
        { label: 'Low Quality', value: lowQuality, icon: Award, color: 'text-amber-600', bg: 'bg-amber-600/10', border: 'border-amber-600/20' },
        { label: 'Needs Review', value: needsReview, icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' }
      ]
    },
    // Outreach Stats
    {
      group: 'Outreach Pipeline',
      items: [
        { label: 'Emails Drafted', value: firstDrafts, icon: FileText, color: 'text-slate-400', bg: 'bg-slate-500/10' },
        { label: 'Emails Sent', value: firstSent, icon: Send, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Follow-ups Drafted', value: followUpDrafts, icon: FileText, color: 'text-slate-400', bg: 'bg-slate-500/10' },
        { label: 'Follow-ups Sent', value: followUpSent, icon: Send, color: 'text-purple-400', bg: 'bg-purple-500/10' }
      ]
    }
  ];

  return (
    <div className="space-y-6">
      {/* Alert Panel for new, unprocessed leads */}
      {unprocessedCount > 0 && (
        <div className="glass-panel border-prasha-gold/30 bg-prasha-gold/5 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-prasha-gold animate-pulse-gold" size={20} />
            <div>
              <p className="text-sm font-semibold text-white">Unprocessed Leads Detected</p>
              <p className="text-xs text-slate-400">There are {unprocessedCount} leads that have not been enriched yet. Run sync/enrichment to search for emails.</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-prasha-gold/10 text-prasha-gold border border-prasha-gold/20 rounded-md text-xs font-semibold">
            {unprocessedCount} New Row(s)
          </span>
        </div>
      )}

      {/* Metrics Section */}
      <div className="space-y-6">
        {cards.map((section, sIndex) => (
          <div key={sIndex} className="space-y-3">
            <h2 className="text-xs font-bold text-prasha-tan tracking-[2px] uppercase">
              {section.group}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {section.items.map((card, cIndex) => {
                const Icon = card.icon;
                return (
                  <div 
                    key={cIndex} 
                    className={`glass-panel p-4 rounded-xl flex items-center justify-between glass-panel-hover border border-slate-800/40`}
                  >
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-slate-400 block">{card.label}</span>
                      <span className="text-2xl font-bold text-white tracking-tight">{card.value}</span>
                    </div>
                    <div className={`p-3 rounded-lg ${card.bg}`}>
                      <Icon className={card.color} size={20} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
