export interface Business {
  id?: string;
  businessName: string;
  city: string;
  sector: string;
  source: 'inbound_whatsapp';
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id?: string;
  businessId?: string;
  businessName?: string;
  city?: string;
  category?: string;
  visitorPhone: string;
  sourceChannel: 'whatsapp';
  initialMessage?: string;
  selectedPrimaryOption?: string;
  selectedPrimaryOptionLabel?: string;
  detectedName?: string;
  hasName: boolean;
  score: number;
  scoreLabel: 'HOT' | 'Very HOT' | 'Ultra HOT';
  status: string;
  conversationState: 'initial' | 'awaiting_primary_choice' | 'awaiting_name' | 'qualified';
  createdAt: string;
  updatedAt: string;
}

export interface LeadMessage {
  id?: string;
  leadId: string;
  direction: 'inbound' | 'outbound';
  senderType: 'visitor' | 'system';
  messageType: 'text' | 'interactive_reply';
  content: string;
  selectedOptionId?: string;
  selectedOptionLabel?: string;
  createdAt: string;
}
