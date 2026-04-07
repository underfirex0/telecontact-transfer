import { useState, useEffect } from 'react';
import { Search, MapPin, Phone, ChevronRight, Users } from 'lucide-react';
import { format } from 'date-fns';
import { db, collection, query, orderBy, onSnapshot } from '../firebase';

export default function Leads({ onNavigateToLeadDetails }: { onNavigateToLeadDetails: (id: string) => void }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    console.log('LEADS_SUBSCRIBE_START');
    const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('LEADS_SUBSCRIBE_UPDATE', { size: snapshot.size });
      const leadsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeads(leadsData);
      setLoading(false);
    }, (error) => {
      console.error('REALTIME_SUBSCRIBE_ERROR', { context: 'leads_list', error });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLeads = leads.filter(lead => 
    (lead.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     lead.visitorPhone?.includes(searchTerm) ||
     lead.city?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getScoreColor = (label: string) => {
    switch (label) {
      case 'Ultra HOT': return 'bg-red-100 text-red-700 border-red-200';
      case 'Very HOT': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Leads Management</h2>
          <p className="text-slate-500">Track and manage all incoming WhatsApp leads.</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full md:w-64 transition-all"
          />
        </div>
      </header>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-12 text-center text-slate-400">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p>Loading leads...</p>
          </div>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
            <Users size={40} />
          </div>
          <h4 className="text-xl font-bold text-slate-800 mb-2">No leads found</h4>
          <p className="text-slate-500 max-w-md mx-auto">
            {searchTerm ? `No results matching "${searchTerm}". Try a different search term.` : "You haven't received any leads yet. They'll show up here automatically."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Business</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Score</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map((lead) => (
                  <tr 
                    key={lead.id}
                    onClick={() => onNavigateToLeadDetails(lead.id)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{lead.businessName || 'Unknown'}</div>
                      <div className="text-xs text-slate-400">{lead.category}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <MapPin size={14} className="text-slate-400" />
                        {lead.city}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <Phone size={14} className="text-slate-400" />
                        {lead.visitorPhone}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600">
                        {format(new Date(lead.createdAt), 'MMM d, yyyy')}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {format(new Date(lead.createdAt), 'HH:mm')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <span className={`text-[9px] w-fit px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border ${
                          lead.qualificationMode === 'manual' 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {lead.qualificationMode === 'manual' ? 'Manuel' : 'Auto'}
                        </span>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                          {lead.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold uppercase tracking-wider ${getScoreColor(lead.scoreLabel)}`}>
                        {lead.scoreLabel}
                      </span>
                      <div className="text-[10px] font-bold text-slate-400 mt-1">{lead.score}/100</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
