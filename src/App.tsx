import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, ChevronRight, Phone, MapPin, Calendar, Star, MessageSquare, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import LeadDetails from './pages/LeadDetails';
import Analytics from './pages/Analytics';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'leads' | 'lead-details' | 'analytics'>('dashboard');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const navigateToLeads = () => setCurrentPage('leads');
  const navigateToDashboard = () => setCurrentPage('dashboard');
  const navigateToAnalytics = () => setCurrentPage('analytics');
  const navigateToLeadDetails = (id: string) => {
    setSelectedLeadId(id);
    setCurrentPage('lead-details');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-b md:border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Telecontact
          </h1>
          <p className="text-xs text-slate-400 font-medium tracking-wider uppercase mt-1">Lead Manager</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={navigateToDashboard}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              currentPage === 'dashboard' 
                ? 'bg-blue-50 text-blue-600 font-semibold' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </button>
          
          <button
            onClick={navigateToLeads}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              currentPage === 'leads' || (currentPage === 'lead-details' && selectedLeadId)
                ? 'bg-blue-50 text-blue-600 font-semibold' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <Users size={20} />
            <span>Leads</span>
          </button>

          <button
            onClick={navigateToAnalytics}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              currentPage === 'analytics' 
                ? 'bg-blue-50 text-blue-600 font-semibold' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <BarChart3 size={20} />
            <span>Analytics</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Admin</p>
              <p className="text-xs text-slate-400 truncate">Internal Access</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          {currentPage === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Dashboard onNavigateToLeads={navigateToLeads} onNavigateToLeadDetails={navigateToLeadDetails} />
            </motion.div>
          )}
          
          {currentPage === 'leads' && (
            <motion.div
              key="leads"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Leads onNavigateToLeadDetails={navigateToLeadDetails} />
            </motion.div>
          )}

          {currentPage === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Analytics />
            </motion.div>
          )}

          {currentPage === 'lead-details' && selectedLeadId && (
            <motion.div
              key="lead-details"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <LeadDetails leadId={selectedLeadId} onBack={navigateToLeads} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
