import { useState, useEffect, useRef, FormEvent } from 'react';
import axios from 'axios';
import { ArrowLeft, Phone, MapPin, Clock, Building2, Tag, CheckCircle2, User, Send, AlertCircle, CheckCircle, Zap, Info } from 'lucide-react';
import { format } from 'date-fns';
import { db, doc, collection, query, orderBy, onSnapshot, updateDoc } from '../firebase';

export default function LeadDetails({ leadId, onBack }: { leadId: string; onBack: () => void }) {
  const [lead, setLead] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [manualName, setManualName] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = (force = false) => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
      
      if (force || isNearBottom) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  };

  useEffect(() => {
    console.log('LEAD_DETAILS_SUBSCRIBE_START', { leadId });
    const leadRef = doc(db, 'leads', leadId);
    
    const unsubscribeLead = onSnapshot(leadRef, (docSnap) => {
      if (docSnap.exists()) {
        console.log('LEAD_DETAILS_SUBSCRIBE_UPDATE', { leadId });
        setLead({ id: docSnap.id, ...docSnap.data() });
        setLoading(false);
      } else {
        setLoading(false);
      }
    }, (error) => {
      console.error('REALTIME_SUBSCRIBE_ERROR', { context: 'lead_details', leadId, error });
    });

    console.log('LEAD_MESSAGES_SUBSCRIBE_START', { leadId });
    const messagesRef = collection(db, 'leads', leadId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      console.log('LEAD_MESSAGES_SUBSCRIBE_UPDATE', { leadId, size: snapshot.size });
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setTimeout(() => scrollToBottom(), 100);
    }, (error) => {
      console.error('REALTIME_SUBSCRIBE_ERROR', { context: 'lead_messages', leadId, error });
    });

    return () => {
      unsubscribeLead();
      unsubscribeMessages();
    };
  }, [leadId]);

  const handleSendReply = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!replyMessage.trim() || isSending) return;

    setIsSending(true);
    setSendError(null);
    setSendSuccess(false);

    try {
      const response = await axios.post(`/api/leads/${leadId}/reply`, {
        message: replyMessage
      });

      if (response.data.success) {
        setReplyMessage('');
        setSendSuccess(true);
        setTimeout(() => {
          setSendSuccess(false);
          scrollToBottom(true);
        }, 100);
        setTimeout(() => setSendSuccess(false), 3000);
        inputRef.current?.focus();
      }
    } catch (err: any) {
      setSendError(err.response?.data?.error || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const calculateManualScore = (currentLead: any, newNeed?: string, newName?: string) => {
    let score = 40; // Base for manual
    const need = newNeed || currentLead.selectedPrimaryOption;
    const name = newName || currentLead.detectedName;

    if (need === 'price') score += 30;
    else if (need === 'infos') score += 20;
    else if (need === 'callback') score += 10;

    if (name && name.trim().length > 0) score += 30;

    return Math.min(score, 100);
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'Ultra HOT';
    if (score >= 40) return 'Very HOT';
    return 'HOT';
  };

  const handleManualQualify = async (choice: 'price' | 'infos' | 'callback') => {
    if (!lead || isUpdating) return;
    setIsUpdating(true);

    const labels = { price: 'Prix', infos: 'Infos / Détails', callback: 'Être rappelé' };
    const newScore = calculateManualScore(lead, choice);
    const newLabel = getScoreLabel(newScore);

    const updates: any = {
      selectedPrimaryOption: choice,
      selectedPrimaryOptionLabel: labels[choice],
      score: newScore,
      scoreLabel: newLabel,
      updatedAt: new Date().toISOString()
    };

    // Check if fully qualified
    if (lead.detectedName || manualName) {
      updates.status = 'Qualifié manuellement';
      console.log('MANUAL_LEAD_QUALIFIED', leadId);
    }

    try {
      await updateDoc(doc(db, 'leads', leadId), updates);
      console.log('MANUAL_QUALIFICATION_SELECTED', { choice });
      console.log('MANUAL_SCORE_RECALCULATED', { newScore });
    } catch (err) {
      console.error('MANUAL_QUALIFY_ERROR', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmName = async () => {
    if (!lead || !manualName.trim() || isUpdating) return;
    setIsUpdating(true);

    const newScore = calculateManualScore(lead, undefined, manualName);
    const newLabel = getScoreLabel(newScore);

    const updates: any = {
      detectedName: manualName,
      hasName: true,
      score: newScore,
      scoreLabel: newLabel,
      updatedAt: new Date().toISOString()
    };

    // Check if fully qualified
    if (lead.selectedPrimaryOption) {
      updates.status = 'Qualifié manuellement';
      console.log('MANUAL_LEAD_QUALIFIED', leadId);
    }

    try {
      await updateDoc(doc(db, 'leads', leadId), updates);
      console.log('MANUAL_NAME_CONFIRMED', { name: manualName });
      console.log('MANUAL_SCORE_RECALCULATED', { newScore });
      setManualName('');
    } catch (err) {
      console.error('MANUAL_NAME_CONFIRM_ERROR', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const quickReplies = [
    "Bonjour, merci pour votre message.",
    "Nous revenons vers vous rapidement.",
    "Pouvez-vous nous donner plus de détails ?",
    "Êtes-vous disponible pour un appel ?"
  ];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Lead not found.</p>
        <button onClick={onBack} className="mt-4 text-blue-600 font-bold">Go back</button>
      </div>
    );
  }

  const getScoreColor = (label: string) => {
    switch (label) {
      case 'Ultra HOT': return 'bg-red-100 text-red-700 border-red-200';
      case 'Very HOT': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-all mb-8 font-semibold group"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        Back to Leads Management
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Info */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <span className={`text-[10px] px-2.5 py-1 rounded-full border font-bold uppercase tracking-wider ${getScoreColor(lead.scoreLabel)}`}>
                {lead.scoreLabel}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Business</label>
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <Building2 size={16} className="text-blue-500" />
                  {lead.businessName}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Location</label>
                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin size={16} className="text-slate-400" />
                  {lead.city}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Visitor Phone</label>
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone size={16} className="text-slate-400" />
                  {lead.visitorPhone}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Category</label>
                <div className="flex items-center gap-2 text-slate-700">
                  <Tag size={16} className="text-slate-400" />
                  {lead.category}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Detected Name</label>
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <User size={16} className="text-indigo-500" />
                  {lead.detectedName || 'Not captured yet'}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Primary Need</label>
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  {lead.selectedPrimaryOptionLabel || 'Awaiting choice'}
                </div>
              </div>
            </div>
          </div>

          {/* Manual Qualification Panel */}
          {lead.qualificationMode === 'manual' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
              <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Zap size={16} className="text-amber-500" />
                Qualification manuelle
              </h4>
              
              <div className="space-y-6">
                {/* Need Selection */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Besoin du client</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'price', label: 'Prix' },
                      { id: 'infos', label: 'Infos / Détails' },
                      { id: 'callback', label: 'Être rappelé' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => handleManualQualify(opt.id as any)}
                        disabled={isUpdating}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all border text-left flex items-center justify-between ${
                          lead.selectedPrimaryOption === opt.id
                            ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                        {lead.selectedPrimaryOption === opt.id && <CheckCircle2 size={14} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name Confirmation */}
                <div className="pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Identification</label>
                  {lead.detectedName ? (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-slate-400" />
                        <span className="text-sm font-bold text-slate-700">{lead.detectedName}</span>
                      </div>
                      <CheckCircle2 size={14} className="text-emerald-500" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input 
                        type="text"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        placeholder="Nom du client..."
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                      />
                      <button
                        onClick={handleConfirmName}
                        disabled={isUpdating || !manualName.trim()}
                        className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        Confirmer le nom
                      </button>
                    </div>
                  )}
                </div>

                {/* Status Help */}
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-start gap-3">
                  <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-blue-700 leading-relaxed">
                    Sélectionnez un besoin et confirmez le nom pour qualifier ce lead manuellement.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Clock size={16} className="text-slate-400" />
              Lead Status
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Current Status</span>
                <span className="font-bold text-blue-600">{lead.status}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Automation State</span>
                <span className="font-medium text-slate-700">{lead.conversationState}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Created</span>
                <span className="text-slate-700">{format(new Date(lead.createdAt), 'MMM d, HH:mm')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Conversation */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg flex flex-col h-[700px] overflow-hidden">
            {/* WhatsApp Header */}
            <div className="p-4 bg-[#f0f2f5] border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-300 rounded-full flex items-center justify-center text-slate-600 font-bold">
                  {lead.detectedName ? lead.detectedName.charAt(0).toUpperCase() : lead.visitorPhone.slice(-2)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 leading-tight">
                    {lead.detectedName || lead.visitorPhone}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">WhatsApp Channel</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold border border-blue-200">
                  {lead.conversationState}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {lead.status}
                </span>
              </div>
            </div>

            {/* Conversation History (WhatsApp Style) */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#e5ddd5] relative"
              style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat' }}
            >
              {messages.map((msg: any) => {
                const isInbound = msg.direction === 'inbound';
                return (
                  <div 
                    key={msg.id}
                    className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[85%] relative group`}>
                      <div className={`px-3 py-2 rounded-lg shadow-sm relative ${
                        isInbound 
                          ? 'bg-white text-slate-800 rounded-tl-none' 
                          : 'bg-[#dcf8c6] text-slate-800 rounded-tr-none'
                      }`}>
                        {/* Sender Label */}
                        <div className={`text-[10px] font-bold mb-1 ${isInbound ? 'text-blue-600' : 'text-emerald-600'}`}>
                          {isInbound ? 'Visiteur' : 'Telecontact'}
                        </div>
                        
                        <p className="text-sm whitespace-pre-wrap pr-12">{msg.content}</p>
                        
                        {/* Selected Option Badge */}
                        {msg.selectedOptionLabel && (
                          <div className={`mt-2 inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/5 text-slate-600 border border-black/5`}>
                            Choix: {msg.selectedOptionLabel}
                          </div>
                        )}

                        {/* Timestamp inside bubble */}
                        <div className="absolute bottom-1 right-2 flex items-center gap-1">
                          <span className="text-[9px] text-slate-400 font-medium">
                            {format(new Date(msg.createdAt), 'HH:mm')}
                          </span>
                          {!isInbound && (
                            <CheckCircle2 size={10} className="text-blue-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {(!messages || messages.length === 0) && (
                <div className="h-full flex items-center justify-center">
                  <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full text-slate-500 text-xs font-medium shadow-sm border border-white/50">
                    Aucun message enregistré pour le moment.
                  </div>
                </div>
              )}
            </div>

            {/* Reply Composer */}
            <div className="p-4 bg-[#f0f2f5] border-t border-slate-200">
            {/* Quick Replies */}
            <div className="flex flex-wrap gap-2 mb-3">
              {quickReplies.map((text, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setReplyMessage(text);
                    inputRef.current?.focus();
                  }}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                >
                  {text}
                </button>
              ))}
            </div>

              <form onSubmit={handleSendReply} className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder={lead.visitorPhone ? "Écrire une réponse WhatsApp..." : "Numéro de téléphone manquant"}
                    disabled={isSending || !lead.visitorPhone}
                    rows={1}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none max-h-32 disabled:bg-slate-100 disabled:text-slate-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                  />
                  {sendError && (
                    <div className="absolute -top-10 left-0 right-0 bg-red-50 text-red-600 text-[10px] p-2 rounded-lg border border-red-100 flex items-center gap-2 shadow-sm">
                      <AlertCircle size={12} />
                      {sendError}
                    </div>
                  )}
                  {sendSuccess && (
                    <div className="absolute -top-10 left-0 right-0 bg-emerald-50 text-emerald-600 text-[10px] p-2 rounded-lg border border-emerald-100 flex items-center gap-2 shadow-sm">
                      <CheckCircle size={12} />
                      Message envoyé avec succès !
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSending || !replyMessage.trim() || !lead.visitorPhone}
                  className={`p-3 rounded-full transition-all shadow-md ${
                    isSending || !replyMessage.trim() || !lead.visitorPhone
                      ? 'bg-slate-300 text-white cursor-not-allowed'
                      : 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95'
                  }`}
                >
                  {isSending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send size={20} />
                  )}
                </button>
              </form>
              {!lead.visitorPhone && (
                <p className="text-[10px] text-red-500 mt-2 font-bold text-center">
                  Impossible de répondre : Numéro de téléphone du visiteur manquant.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
