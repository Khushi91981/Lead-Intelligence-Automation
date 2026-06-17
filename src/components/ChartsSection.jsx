import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  BarChart,
  Bar
} from 'recharts';

export default function ChartsSection({ leads }) {
  // 1. Data Prep: Lead Quality Distribution
  const qualityCounts = leads.reduce((acc, lead) => {
    const q = lead['Lead Quality'] || 'Unprocessed';
    acc[q] = (acc[q] || 0) + 1;
    return acc;
  }, {});

  const qualityData = [
    { name: 'High Quality', value: qualityCounts['High'] || 0, color: '#10b981' }, // Emerald
    { name: 'Medium Quality', value: qualityCounts['Medium'] || 0, color: '#caa13d' }, // Gold
    { name: 'Low Quality', value: qualityCounts['Low'] || 0, color: '#f97316' }, // Orange
    { name: 'Needs Review', value: qualityCounts['Needs Review'] || 0, color: '#f43f5e' } // Rose
  ].filter(item => item.value > 0);

  // 2. Data Prep: Processed & Email Success Over Time
  // Group by date of Last Checked
  const dateMap = {};
  leads.forEach(lead => {
    if (!lead['Last Checked']) return;
    const dateStr = new Date(lead['Last Checked']).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (!dateMap[dateStr]) {
      dateMap[dateStr] = { date: dateStr, processed: 0, withEmail: 0 };
    }
    dateMap[dateStr].processed += 1;
    if (lead['Primary Email']) {
      dateMap[dateStr].withEmail += 1;
    }
  });

  // Sort dates chronologically
  const timeData = Object.values(dateMap).sort((a, b) => new Date(a.date) - new Date(b.date));

  // If empty, generate mock data placeholders
  const timeDataFilled = timeData.length > 0 ? timeData : [
    { date: 'No Data', processed: 0, withEmail: 0 }
  ];

  // Calculate success rates
  const successTrendData = timeDataFilled.map(d => ({
    date: d.date,
    rate: d.processed > 0 ? Math.round((d.withEmail / d.processed) * 100) : 0
  }));

  // 3. Data Prep: Top Industries
  const industryCounts = leads.reduce((acc, lead) => {
    const ind = lead['Industry'] || 'Unknown';
    acc[ind] = (acc[ind] || 0) + 1;
    return acc;
  }, {});

  const industryData = Object.entries(industryCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5); // top 5

  // 4. Data Prep: Outreach Funnel
  const total = leads.length;
  const enriched = leads.filter(l => l['Last Checked']).length;
  const isSent = (lead) => {
    const status = String(lead['Sent Status'] || '').toLowerCase();
    return status.includes('sent') && !status.includes('not');
  };
  const drafted = leads.filter(l => l['Email Subject'] || isSent(l)).length;
  const sent = leads.filter(l => isSent(l)).length;

  const funnelData = [
    { stage: 'Imported', count: total, percentage: 100, color: '#3b82f6' },
    { stage: 'Enriched', count: enriched, percentage: total > 0 ? Math.round((enriched / total) * 100) : 0, color: '#8b5cf6' },
    { stage: 'Drafted', count: drafted, percentage: total > 0 ? Math.round((draftd => drafted / total) * 100) : 0, color: '#eab308' }, // Adjusted inline below
    { stage: 'Sent', count: sent, percentage: total > 0 ? Math.round((sent / total) * 100) : 0, color: '#10b981' }
  ];
  
  // Quick override for percentage calculation to avoid nesting bug
  funnelData[2].percentage = total > 0 ? Math.round((drafted / total) * 100) : 0;

  // Custom tooltips to blend with theme
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-prasha-navy border border-prasha-gold/30 p-3 rounded-lg shadow-xl backdrop-blur-md">
          <p className="text-xs font-semibold text-slate-300">{label}</p>
          {payload.map((p, i) => (
            <p key={i} className="text-sm font-bold mt-1" style={{ color: p.color || p.payload.color || '#caa13d' }}>
              {p.name}: {p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Lead Quality Distribution */}
      <div className="glass-panel p-5 rounded-xl border border-slate-800/40">
        <h3 className="text-sm font-bold text-prasha-tan tracking-[1px] uppercase mb-4">Lead Quality Distribution</h3>
        <div className="h-[250px] flex items-center justify-center">
          {qualityData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={qualityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {qualityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle" 
                  formatter={(value) => <span className="text-xs text-slate-300">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <span className="text-sm text-slate-500">No enriched lead data available</span>
          )}
        </div>
      </div>

      {/* 2. Outreach Funnel Progression */}
      <div className="glass-panel p-5 rounded-xl border border-slate-800/40">
        <h3 className="text-sm font-bold text-prasha-tan tracking-[1px] uppercase mb-4">Outreach Funnel</h3>
        <div className="h-[250px] flex flex-col justify-center gap-4 px-2">
          {funnelData.map((step, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-300">
                <span>{step.stage}</span>
                <span>{step.count} leads ({step.percentage}%)</span>
              </div>
              <div className="h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${step.percentage}%`, 
                    backgroundColor: step.color,
                    boxShadow: `0 0 10px ${step.color}33`
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Leads Processed Over Time */}
      <div className="glass-panel p-5 rounded-xl border border-slate-800/40">
        <h3 className="text-sm font-bold text-prasha-tan tracking-[1px] uppercase mb-4">Leads Processed Over Time</h3>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeDataFilled}>
              <defs>
                <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#caa13d" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#caa13d" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="processed" name="Leads Processed" stroke="#caa13d" fillOpacity={1} fill="url(#goldGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Email Discovery Success Rate Trends */}
      <div className="glass-panel p-5 rounded-xl border border-slate-800/40">
        <h3 className="text-sm font-bold text-prasha-tan tracking-[1px] uppercase mb-4">Email Discovery Success Rate Trends</h3>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={successTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="rate" name="Success Rate" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. Industry-wise Distribution */}
      <div className="glass-panel p-5 rounded-xl border border-slate-800/40 lg:col-span-2">
        <h3 className="text-sm font-bold text-prasha-tan tracking-[1px] uppercase mb-4">Top Lead Industries</h3>
        <div className="h-[250px]">
          {industryData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={industryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" stroke="#64748b" fontSize={10} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={120} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Leads Count" fill="#caa13d" radius={[0, 4, 4, 0]}>
                  {industryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#caa13d' : '#d4c5a9'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-500">No industry details available</div>
          )}
        </div>
      </div>
    </div>
  );
}
