import { useState, useEffect } from 'react';
import { Users, Building2, TrendingUp, ChevronRight, Phone, MapPin, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { db, collection, query, orderBy, limit, onSnapshot } from '../firebase';

interface DashboardStats {
  totalLeads: number;
  totalBusinesses: number;
  recentLeads: any[];
}

export default function Dashboard({ onNavigateToLeads, onNavigateToLeadDetails }: { 
  onNavigateToLeads: () => void;
  onNavigateToLeadDetails: (id: string) => void;
}) {
  const [stats, setStats] = useState<DashboardStats>({ totalLeads: 0, totalBusinesses: 0, recentLeads: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('DASHBOARD_SUBSCRIBE_START');
    
    // Subscribe to leads count
    const unsubscribeLeads = onSnapshot(collection(db, 'leads'), (snapshot) => {
      console.log('DASHBOARD_SUBSCRIBE_UPDATE', { type: 'leads_count', size: snapshot.size });
      setStats(prev => ({ ...prev, totalLeads: snapshot.size }));
      setLoading(false);
    }, (error) => {
      console.error('REALTIME_SUBSCRIBE_ERROR', { context: 'dashboard_leads_count', error });
    });

    // Subscribe to businesses count
    const unsubscribeBusinesses = onSnapshot(collection(db, 'businesses'), (snapshot) => {
      console.log('DASHBOARD_SUBSCRIBE_UPDATE', { type: 'businesses_count', size: snapshot.size });
      setStats(prev => ({ ...prev, totalBusinesses: snapshot.size }));
    }, (error) => {
      console.error('REALTIME_SUBSCRIBE_ERROR', { context: 'dashboard_businesses_count', error });
    });

    // Subscribe to recent leads
    const recentLeadsQuery = query(collection(db, 'leads'), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribeRecent = onSnapshot(recentLeadsQuery, (snapshot) => {
      console.log('DASHBOARD_SUBSCRIBE_UPDATE', { type: 'recent_leads', size: snapshot.size });
      const recentLeads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStats(prev => ({ ...prev, recentLeads }));
    }, (error) => {
      console.error('REALTIME_SUBSCRIBE_ERROR', { context: 'dashboard_recent_leads', error });
    });

    return () => {
      unsubscribeLeads();
      unsubscribeBusinesses();
      unsubscribeRecent();
    };
  }, []);

  const getScoreColor = (label: string) => {
    if (!label) return 'bg-blue-100 text-blue-700 border-blue-200';
    switch (label) {
      case 'Ultra HOT': return 'bg-red-100 text-red-700 border-red-200';
      case 'Very HOT': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Dashboard Overview</h2>
        <p className="text-slate-500">Welcome back to Telecontact Lead Manager.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Leads</p>
              <h3 className="text-2xl font-bold text-slate-800">{stats.totalLeads}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
            <TrendingUp size={14} />
            <span>Real-time tracking active</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Businesses</p>
              <h3 className="text-2xl font-bold text-slate-800">{stats.totalBusinesses}</h3>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            Across all sectors
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <button 
            onClick={onNavigateToLeads}
            className="w-full py-3 px-4 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            View All Leads
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Recent Leads */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-800">Recent Leads</h3>
          <button 
            onClick={onNavigateToLeads}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            See all
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-white rounded-2xl border border-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (!stats.recentLeads || stats.recentLeads.length === 0) ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <Users size={32} />
            </div>
            <h4 className="text-slate-800 font-bold mb-1">No leads yet</h4>
            <p className="text-slate-500 text-sm">Leads will appear here once WhatsApp messages start coming in.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {stats.recentLeads.map((lead) => (
              <div 
                key={lead.id}
                onClick={() => onNavigateToLeadDetails(lead.id)}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row md:items-center gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-slate-800">{lead.businessName || 'Unknown Business'}</h4>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border ${
                      lead.qualificationMode === 'manual' 
                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {lead.qualificationMode === 'manual' ? 'Manuel' : 'Auto'}
                    </span>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold uppercase tracking-wider ${getScoreColor(lead.scoreLabel)}`}>
                      {lead.scoreLabel || 'HOT'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                      <MapPin size={14} />
                      <span>{lead.city || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Phone size={14} />
                      <span>{lead.visitorPhone || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      <span>{lead.createdAt ? format(new Date(lead.createdAt), 'MMM d, HH:mm') : 'N/A'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right hidden md:block">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Status</p>
                    <p className="text-sm font-bold text-slate-700">{lead.status}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                    <ChevronRight size={20} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
