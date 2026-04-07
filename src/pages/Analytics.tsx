import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Users, CheckCircle2, Calendar, Zap, Target, 
  MapPin, Tag, Filter, ChevronDown, Info, BarChart3, MessageSquare, User
} from 'lucide-react';
import { format, subDays, isAfter, startOfDay, endOfDay, eachDayOfInterval, isSameDay } from 'date-fns';
import { db, collection, onSnapshot, query, orderBy } from '../firebase';

const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981'];

interface AnalyticsData {
  leads: any[];
  businesses: any[];
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData>({ leads: [], businesses: [] });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('30d');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    console.log('ANALYTICS_SUBSCRIBE_START');
    
    const unsubscribeLeads = onSnapshot(collection(db, 'leads'), (snapshot) => {
      const leads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(prev => ({ ...prev, leads }));
      setLoading(false);
    });

    const unsubscribeBusinesses = onSnapshot(collection(db, 'businesses'), (snapshot) => {
      const businesses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(prev => ({ ...prev, businesses }));
    });

    return () => {
      unsubscribeLeads();
      unsubscribeBusinesses();
    };
  }, []);

  const filteredLeads = useMemo(() => {
    let filtered = data.leads;

    // Date Filter
    if (dateRange !== 'all') {
      const days = dateRange === '7d' ? 7 : 30;
      const cutoff = subDays(new Date(), days);
      filtered = filtered.filter(lead => lead.createdAt && isAfter(new Date(lead.createdAt), cutoff));
    }

    // City Filter
    if (selectedCity !== 'all') {
      filtered = filtered.filter(lead => lead.city === selectedCity);
    }

    // Category Filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(lead => lead.category === selectedCategory);
    }

    return filtered;
  }, [data.leads, dateRange, selectedCity, selectedCategory]);

  const stats = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const qualifiedAuto = filteredLeads.filter(l => l.status === 'Qualifié automatiquement' || l.status === 'Qualifié').length;
    const qualificationRate = totalLeads > 0 ? (qualifiedAuto / totalLeads) * 100 : 0;
    
    const today = startOfDay(new Date());
    const leadsToday = filteredLeads.filter(l => l.createdAt && isAfter(new Date(l.createdAt), today)).length;
    
    const ultraHotLeads = filteredLeads.filter(l => l.scoreLabel === 'Ultra HOT').length;
    
    const totalScore = filteredLeads.reduce((acc, l) => acc + (l.score || 0), 0);
    const avgScore = totalLeads > 0 ? totalScore / totalLeads : 0;

    return {
      totalLeads,
      qualifiedAuto,
      qualificationRate,
      leadsToday,
      ultraHotLeads,
      avgScore
    };
  }, [filteredLeads]);

  const leadsOverTime = useMemo(() => {
    if (dateRange === 'all') {
      // For 'all', we might want to group by month or just show last 30 days for better visualization
      // Let's default to last 30 days for the chart if 'all' is selected but data is large
      const days = 30;
      const interval = eachDayOfInterval({
        start: subDays(new Date(), days - 1),
        end: new Date()
      });

      return interval.map(day => {
        const count = filteredLeads.filter(l => l.createdAt && isSameDay(new Date(l.createdAt), day)).length;
        return {
          date: format(day, 'MMM d'),
          count
        };
      });
    }

    const days = dateRange === '7d' ? 7 : 30;
    const interval = eachDayOfInterval({
      start: subDays(new Date(), days - 1),
      end: new Date()
    });

    return interval.map(day => {
      const count = filteredLeads.filter(l => l.createdAt && isSameDay(new Date(l.createdAt), day)).length;
      return {
        date: format(day, 'MMM d'),
        count
      };
    });
  }, [filteredLeads, dateRange]);

  const leadsByCity = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredLeads.forEach(l => {
      const city = l.city || 'Unknown';
      counts[city] = (counts[city] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredLeads]);

  const leadsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredLeads.forEach(l => {
      const cat = l.category || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredLeads]);

  const scoreDistribution = useMemo(() => {
    const counts = {
      'HOT': 0,
      'VERY HOT': 0,
      'ULTRA HOT': 0
    };
    filteredLeads.forEach(l => {
      const label = l.scoreLabel?.toUpperCase();
      if (label === 'HOT') counts['HOT']++;
      else if (label === 'VERY HOT') counts['VERY HOT']++;
      else if (label === 'ULTRA HOT') counts['ULTRA HOT']++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredLeads]);

  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredLeads.forEach(l => {
      const status = l.status || 'Nouveau';
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredLeads]);

  const funnelData = useMemo(() => {
    const total = filteredLeads.length;
    const withPrimaryNeed = filteredLeads.filter(l => l.selectedPrimaryOptionLabel).length;
    const withName = filteredLeads.filter(l => l.detectedName).length;
    const qualified = filteredLeads.filter(l => l.status === 'Qualifié automatiquement' || l.status === 'Qualifié').length;

    return [
      { name: 'Initial Message', value: total, Icon: MessageSquare },
      { name: 'Primary Need', value: withPrimaryNeed, Icon: Target },
      { name: 'Name Detected', value: withName, Icon: User },
      { name: 'Qualified', value: qualified, Icon: CheckCircle2 }
    ];
  }, [filteredLeads]);

  const topBusinesses = useMemo(() => {
    const counts: Record<string, { name: string, city: string, count: number }> = {};
    filteredLeads.forEach(l => {
      if (l.businessName) {
        if (!counts[l.businessName]) {
          counts[l.businessName] = { name: l.businessName, city: l.city || 'Unknown', count: 0 };
        }
        counts[l.businessName].count++;
      }
    });
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredLeads]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    data.leads.forEach(l => { if (l.city) set.add(l.city); });
    return Array.from(set).sort();
  }, [data.leads]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    data.leads.forEach(l => { if (l.category) set.add(l.category); });
    return Array.from(set).sort();
  }, [data.leads]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Analytics Insights</h2>
          <p className="text-slate-500 mt-1">Real-time performance metrics for your lead management.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Filter */}
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {(['7d', '30d', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  dateRange === range 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
              </button>
            ))}
          </div>

          {/* City Filter */}
          <div className="relative group">
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2 pr-10 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="all">All Cities</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Category Filter */}
          <div className="relative group">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2 pr-10 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard 
          title="Total Leads" 
          value={stats.totalLeads} 
          icon={<Users className="text-blue-600" size={20} />} 
          color="blue"
        />
        <KPICard 
          title="Qualified Auto" 
          value={stats.qualifiedAuto} 
          icon={<CheckCircle2 className="text-emerald-600" size={20} />} 
          color="emerald"
        />
        <KPICard 
          title="Qualif. Rate" 
          value={`${stats.qualificationRate.toFixed(1)}%`} 
          icon={<Zap className="text-amber-500" size={20} />} 
          color="amber"
        />
        <KPICard 
          title="Leads Today" 
          value={stats.leadsToday} 
          icon={<Calendar className="text-indigo-600" size={20} />} 
          color="indigo"
        />
        <KPICard 
          title="Ultra Hot" 
          value={stats.ultraHotLeads} 
          icon={<TrendingUp className="text-red-600" size={20} />} 
          color="red"
        />
        <KPICard 
          title="Avg. Score" 
          value={stats.avgScore.toFixed(0)} 
          icon={<Target className="text-slate-600" size={20} />} 
          color="slate"
        />
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Leads Over Time */}
        <ChartCard title="Leads Over Time" icon={<TrendingUp size={18} />}>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={leadsOverTime}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Leads by City */}
        <ChartCard title="Leads by City" icon={<MapPin size={18} />}>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadsByCity} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                  width={100}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Score Distribution */}
        <ChartCard title="Score Distribution" icon={<Zap size={18} />}>
          <div className="h-[300px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={scoreDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {scoreDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#3b82f6', '#f59e0b', '#ef4444'][index % 3]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Status Distribution */}
        <ChartCard title="Status Distribution" icon={<BarChart3 size={18} />}>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }} 
                  dy={10}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Conversion Funnel */}
      <ChartCard title="Conversion Funnel" icon={<Target size={18} />}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-8">
          {funnelData.map((step, i) => (
            <div key={i} className="relative flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm ${
                i === 0 ? 'bg-blue-50 text-blue-600' :
                i === 1 ? 'bg-indigo-50 text-indigo-600' :
                i === 2 ? 'bg-violet-50 text-violet-600' :
                'bg-emerald-50 text-emerald-600'
              }`}>
                <step.Icon size={24} />
              </div>
              <h4 className="text-sm font-bold text-slate-800">{step.name}</h4>
              <p className="text-2xl font-black text-slate-900 mt-1">{step.value}</p>
              {i < funnelData.length - 1 && (
                <div className="hidden md:block absolute top-8 -right-4 translate-x-1/2 z-10">
                  <div className="w-8 h-0.5 bg-slate-100" />
                </div>
              )}
              {i > 0 && funnelData[i-1].value > 0 && (
                <span className="text-[10px] font-bold text-slate-400 mt-1">
                  {((step.value / funnelData[i-1].value) * 100).toFixed(0)}% conversion
                </span>
              )}
            </div>
          ))}
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Insights */}
        <div className="lg:col-span-1 space-y-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Zap size={20} className="text-amber-500" />
            Top Insights
          </h3>
          <div className="space-y-4">
            <InsightCard 
              label="Top City" 
              value={leadsByCity[0]?.name || 'N/A'} 
              subValue={`${leadsByCity[0]?.value || 0} leads`}
              icon={<MapPin size={16} />}
            />
            <InsightCard 
              label="Top Category" 
              value={leadsByCategory[0]?.name || 'N/A'} 
              subValue={`${leadsByCategory[0]?.value || 0} leads`}
              icon={<Tag size={16} />}
            />
            <InsightCard 
              label="Auto-Qualif. Rate" 
              value={`${stats.qualificationRate.toFixed(1)}%`} 
              subValue="Efficiency metric"
              icon={<Zap size={16} />}
            />
          </div>
        </div>

        {/* Top Businesses */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Top Businesses by Lead Count</h3>
              <Users size={20} className="text-slate-300" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Business Name</th>
                    <th className="px-6 py-4">City</th>
                    <th className="px-6 py-4 text-center">Leads</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topBusinesses.map((biz, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{biz.name}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{biz.city}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold text-xs">
                          {biz.count}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {topBusinesses.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-slate-400 text-sm">
                        No business data available for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, icon, color }: { title: string, value: string | number, icon: React.ReactNode, color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-50 text-slate-600',
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          {icon}
        </div>
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</h4>
      </div>
      <p className="text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function ChartCard({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <div className="text-blue-600">{icon}</div>
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InsightCard({ label, value, subValue, icon }: { label: string, value: string, subValue: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
        <p className="text-sm font-bold text-slate-800 leading-tight">{value}</p>
        <p className="text-[10px] font-medium text-slate-500">{subValue}</p>
      </div>
    </div>
  );
}
