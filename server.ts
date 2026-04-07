import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import admin from 'firebase-admin';
import axios from 'axios';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config manually to avoid 'assert' syntax issues in production
const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

dotenv.config();

import { getFirestore } from 'firebase-admin/firestore';

console.log('SERVER_STARTING');

const PORT = process.env.PORT || 8080;
console.log('PORT_VALUE', PORT);

// Initialize Firebase Admin
console.log('FIREBASE_INIT_START');
if (!admin.apps.length) {
  console.log('INITIALIZING_FIREBASE_ADMIN', { 
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId 
  });
  
  try {
    // Try initializing with config
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log('FIREBASE_INIT_SUCCESS');
  } catch (err: any) {
    console.error('FIREBASE_INIT_ERROR', err.message);
    console.warn('FIREBASE_ADMIN_INIT_WITH_CONFIG_FAILED, trying default init', err);
    // Fallback to default initialization (uses ambient credentials)
    try {
      admin.initializeApp();
      console.log('FIREBASE_INIT_SUCCESS_FALLBACK');
    } catch (fallbackErr: any) {
      console.error('FIREBASE_INIT_FATAL_ERROR', fallbackErr.message);
    }
  }
}

// Use the specific database ID if provided, but fallback to default if it fails
let dbInstance: admin.firestore.Firestore;
try {
  dbInstance = firebaseConfig.firestoreDatabaseId 
    ? getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId)
    : getFirestore();
} catch (err) {
  console.error('FIRESTORE_INIT_WITH_DB_ID_FAILED, falling back to default database', err);
  dbInstance = getFirestore();
}

// Test connection silently (Removed to avoid PERMISSION_DENIED logs in preview)

const app = express();
app.use(express.json());

// --- WhatsApp Logic ---

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

async function sendWhatsAppMessage(to: string, text: string, buttons?: any[]) {
  if (!PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.error('WHATSAPP_SEND_ERROR: Missing credentials');
    return;
  }

  const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
  
  let data: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "text",
    text: { body: text }
  };

  if (buttons && buttons.length > 0) {
    data = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: text },
        action: {
          buttons: buttons.map((b, i) => ({
            type: "reply",
            reply: { id: b.id, title: b.title }
          }))
        }
      }
    };
  }

  try {
    console.log('WHATSAPP_SEND_START', { to, text });
    const response = await axios.post(url, data, {
      headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}` }
    });
    console.log('WHATSAPP_SEND_SUCCESS', response.data);
    return response.data;
  } catch (error: any) {
    console.error('WHATSAPP_SEND_ERROR', error.response?.data || error.message);
    throw error;
  }
}

function calculateScore(lead: any) {
  let score = 40; // Initial
  if (lead.selectedPrimaryOption === 'price') score += 30;
  else if (lead.selectedPrimaryOption === 'infos') score += 20;
  else if (lead.selectedPrimaryOption === 'callback') score += 10;

  if (lead.hasName) score += 30;

  score = Math.min(score, 100);
  
  let label: 'HOT' | 'Very HOT' | 'Ultra HOT' = 'HOT';
  if (score >= 70) label = 'Ultra HOT';
  else if (score >= 40) label = 'Very HOT';

  return { score, scoreLabel: label };
}

// --- Webhook Routes ---

app.get('/api/webhooks/whatsapp', (req, res) => {
  console.log('WEBHOOK_GET_HIT');
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFY_SUCCESS');
    res.status(200).send(challenge);
  } else {
    console.error('WEBHOOK_VERIFY_FAILED');
    res.sendStatus(403);
  }
});

app.post('/api/webhooks/whatsapp', async (req, res) => {
  console.log('WEBHOOK_POST_HIT');
  const body = req.body;
  console.log('WEBHOOK_BODY_RECEIVED', JSON.stringify(body, null, 2));

  if (body.object !== 'whatsapp_business_account') {
    return res.sendStatus(404);
  }

  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    console.log('MESSAGE_EVENT_FOUND', { from: message.from, type: message.type });

    const visitorPhone = message.from;
    const messageType = message.type;
    let content = '';
    let selectedOptionId = '';
    let selectedOptionLabel = '';

    if (messageType === 'text') {
      content = message.text?.body;
    } else if (messageType === 'interactive') {
      content = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title;
      selectedOptionId = message.interactive?.button_reply?.id || message.interactive?.list_reply?.id;
      selectedOptionLabel = content;
    }

    if (!content && !selectedOptionId) {
      return res.sendStatus(200);
    }

    // Find active lead
    const leadsRef = dbInstance.collection('leads');
    const activeLeads = await leadsRef
      .where('visitorPhone', '==', visitorPhone)
      .where('status', '!=', 'Archivé')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    let leadDoc = activeLeads.empty ? null : activeLeads.docs[0];
    let leadData = leadDoc ? leadDoc.data() : null;

    // STEP 1: INITIAL MESSAGE
    const initialRegex = /Bonjour, je vous contacte via Telecontact au sujet de (.*), (.*) à (.*)\./i;
    const match = content.match(initialRegex);

    if (match) {
      console.log('INITIAL_MESSAGE_DETECTED');
      const businessName = match[1].trim();
      const activity = match[2].trim();
      const city = match[3].trim();
      console.log('INITIAL_MESSAGE_PARSED', { businessName, activity, city });

      // Match or Create Business
      const businessesRef = dbInstance.collection('businesses');
      const existingBusiness = await businessesRef
        .where('businessName', '==', businessName)
        .where('city', '==', city)
        .limit(1)
        .get();

      let businessId = '';
      if (!existingBusiness.empty) {
        console.log('BUSINESS_MATCHED');
        businessId = existingBusiness.docs[0].id;
      } else {
        console.log('BUSINESS_CREATED');
        const newBusiness = await businessesRef.add({
          businessName,
          city,
          sector: activity,
          source: 'inbound_whatsapp',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        businessId = newBusiness.id;
      }

      // Create Lead
      const newLeadData: any = {
        businessId,
        businessName,
        city,
        category: activity,
        visitorPhone,
        sourceChannel: 'whatsapp',
        initialMessage: content,
        score: 40,
        scoreLabel: 'Very HOT',
        status: 'Nouveau',
        qualificationMode: 'auto',
        conversationState: 'awaiting_primary_choice',
        hasName: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const newLead = await leadsRef.add(newLeadData);
      console.log('LEAD_CREATED', newLead.id);
      
      const newLeadDoc = await newLead.get();
      leadDoc = newLeadDoc as any;
      leadData = newLeadDoc.data();

      // Save Message
      await dbInstance.collection('leads').doc(newLead.id).collection('messages').add({
        leadId: newLead.id,
        direction: 'inbound',
        senderType: 'visitor',
        messageType: 'text',
        content,
        createdAt: new Date().toISOString()
      });

      // Send First Auto-Reply
      const firstReply = `Bonjour 👋
Merci pour votre message.
Dites-nous en 1 clic ce dont vous avez besoin :
1️⃣ Prix
2️⃣ Infos
3️⃣ Être rappelé

مرحبًا 👋
شكرًا على رسالتكم.
أخبرونا بنقرة واحدة بما تحتاجونه:
1️⃣ السعر
2️⃣ المعلومات
3️⃣ أريد أن يتم الاتصال بي

En poursuivant cette conversation, vous acceptez d’être recontacté dans le cadre de votre demande.`;

      const buttons = [
        { id: 'price', title: 'Prix / السعر' },
        { id: 'infos', title: 'Infos / المعلومات' },
        { id: 'callback', title: 'Rappel / اتصال' }
      ];

      try {
        console.log('FIRST_AUTOREPLY_START');
        await sendWhatsAppMessage(visitorPhone, firstReply, buttons);
        console.log('FIRST_AUTOREPLY_SUCCESS');
        
        await dbInstance.collection('leads').doc(newLead.id).collection('messages').add({
          leadId: newLead.id,
          direction: 'outbound',
          senderType: 'system',
          messageType: 'interactive_reply',
          content: firstReply,
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        console.error('FIRST_AUTOREPLY_ERROR', err);
      }

      return res.sendStatus(200);
    } else if (!leadDoc || !leadData) {
      // MANUAL PATH START
      console.log('MANUAL_LEAD_DETECTED', { from: visitorPhone });
      
      const newLeadData: any = {
        visitorPhone,
        sourceChannel: 'whatsapp',
        initialMessage: content,
        score: 40,
        scoreLabel: 'Very HOT',
        status: 'À qualifier manuellement',
        qualificationMode: 'manual',
        conversationState: 'manual_pending',
        hasName: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const newLead = await leadsRef.add(newLeadData);
      console.log('LEAD_CREATED_MANUAL', newLead.id);

      // Save Message
      await dbInstance.collection('leads').doc(newLead.id).collection('messages').add({
        leadId: newLead.id,
        direction: 'inbound',
        senderType: 'visitor',
        messageType: 'text',
        content,
        createdAt: new Date().toISOString()
      });

      // Send Manual Auto-Reply
      const manualReply = `Bonjour 👋
Merci de nous avoir contactés.
Pouvez-vous nous donner plus de détails sur votre besoin ?

مرحبًا 👋
شكرًا لتواصلكم معنا.
هل يمكنكم تزويدنا بمزيد من التفاصيل حول طلبكم؟`;

      try {
        await sendWhatsAppMessage(visitorPhone, manualReply);
        console.log('MANUAL_LEAD_AUTOREPLY_SENT', { to: visitorPhone });
        
        await dbInstance.collection('leads').doc(newLead.id).collection('messages').add({
          leadId: newLead.id,
          direction: 'outbound',
          senderType: 'system',
          messageType: 'text',
          content: manualReply,
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        console.error('MANUAL_AUTOREPLY_ERROR', err);
      }

      return res.sendStatus(200);
    }

    // Save Inbound Message
    await dbInstance.collection('leads').doc(leadDoc.id).collection('messages').add({
      leadId: leadDoc.id,
      direction: 'inbound',
      senderType: 'visitor',
      messageType: messageType === 'interactive' ? 'interactive_reply' : 'text',
      content,
      selectedOptionId,
      selectedOptionLabel,
      createdAt: new Date().toISOString()
    });

    // STEP 3: PRIMARY CHOICE
    if (leadData.conversationState === 'awaiting_primary_choice') {
      let choice = '';
      let source = '';

      // Check Interactive Reply first
      if (selectedOptionId) {
        if (['price', 'infos', 'callback'].includes(selectedOptionId)) {
          choice = selectedOptionId;
          source = 'interactive_reply';
        }
      }

      // Fallback to text matching
      if (!choice) {
        const lowerContent = content.toLowerCase();
        if (lowerContent.includes('prix') || lowerContent.includes('price') || lowerContent.includes('السعر') || content.includes('1️⃣')) {
          choice = 'price';
        } else if (lowerContent.includes('info') || lowerContent.includes('information') || lowerContent.includes('المعلومات') || content.includes('2️⃣')) {
          choice = 'infos';
        } else if (lowerContent.includes('rappeler') || lowerContent.includes('rappel') || lowerContent.includes('اتصال') || content.includes('3️⃣')) {
          choice = 'callback';
        }
        if (choice) source = 'text_fallback';
      }

      if (choice) {
        console.log('PRIMARY_OPTION_DETECTED', { choice, source });
        const choiceLabels: any = { price: 'Prix', infos: 'Infos', callback: 'Être rappelé' };
        
        const updatedLead: any = {
          ...leadData,
          selectedPrimaryOption: choice,
          selectedPrimaryOptionLabel: choiceLabels[choice],
          conversationState: 'awaiting_name',
          updatedAt: new Date().toISOString()
        };
        
        const { score, scoreLabel } = calculateScore(updatedLead);
        updatedLead.score = score;
        updatedLead.scoreLabel = scoreLabel;

        await dbInstance.collection('leads').doc(leadDoc.id).update(updatedLead);
        console.log('PRIMARY_OPTION_SAVED');

        // Send Second Auto-Reply
        const secondReply = `Merci ! On traite votre demande très vite.
Pouvez-vous nous communiquer votre nom et prénom ?

شكرًا! نحن نعالج طلبكم بسرعة.
هل يمكنكم تزويدنا بالاسم الشخصي والعائلي؟`;

        try {
          console.log('SECOND_AUTOREPLY_START');
          await sendWhatsAppMessage(visitorPhone, secondReply);
          console.log('SECOND_AUTOREPLY_SUCCESS');
          
          await dbInstance.collection('leads').doc(leadDoc.id).collection('messages').add({
            leadId: leadDoc.id,
            direction: 'outbound',
            senderType: 'system',
            messageType: 'text',
            content: secondReply,
            createdAt: new Date().toISOString()
          });
        } catch (err) {
          console.error('SECOND_AUTOREPLY_ERROR', err);
        }
      }
    } 
    // STEP 5: RECEIVE NAME
    else if (leadData.conversationState === 'awaiting_name') {
      console.log('NAME_RECEIVED', { name: content });
      
      const updatedLead: any = {
        ...leadData,
        detectedName: content,
        hasName: true,
        conversationState: 'qualified',
        status: 'Qualifié automatiquement',
        updatedAt: new Date().toISOString()
      };

      const { score, scoreLabel } = calculateScore(updatedLead);
      updatedLead.score = score;
      updatedLead.scoreLabel = scoreLabel;

      await dbInstance.collection('leads').doc(leadDoc.id).update(updatedLead);
      console.log('LEAD_QUALIFIED', leadDoc.id);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('WEBHOOK_AUTOMATION_ERROR', error);
    res.sendStatus(200); // Always return 200 to Meta
  }
});

// --- API Routes for UI (Removed failing server-side paths, now handled client-side) ---

app.get('/api/config', (req, res) => {
  // Log and return public config for debugging
  console.log('CLIENT_REQUESTING_CONFIG', { 
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId 
  });
  res.json({
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId
  });
});

app.post('/api/leads/:leadId/reply', async (req, res) => {
  const { leadId } = req.params;
  const { message } = req.body;

  console.log('MANUAL_REPLY_REQUEST', { leadId, messageLength: message?.length });

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  try {
    const leadDoc = await dbInstance.collection('leads').doc(leadId).get();
    
    if (!leadDoc.exists) {
      console.error('MANUAL_REPLY_ERROR: Lead not found', leadId);
      return res.status(404).json({ error: 'Lead not found' });
    }

    const leadData = leadDoc.data();
    const visitorPhone = leadData?.visitorPhone;

    if (!visitorPhone) {
      console.error('MANUAL_REPLY_ERROR: Visitor phone missing', leadId);
      return res.status(400).json({ error: 'Visitor phone number is missing for this lead' });
    }

    console.log('MANUAL_REPLY_LEAD_FOUND', { leadId, visitorPhone });
    console.log('MANUAL_REPLY_SEND_START', { visitorPhone });

    // Send via WhatsApp
    await sendWhatsAppMessage(visitorPhone, message);
    console.log('MANUAL_REPLY_SEND_SUCCESS', { leadId });

    // Save to Firestore
    const outboundMessage = {
      leadId,
      direction: 'outbound',
      senderType: 'system',
      messageType: 'text',
      content: message,
      createdAt: new Date().toISOString()
    };

    await dbInstance.collection('leads').doc(leadId).collection('messages').add(outboundMessage);
    console.log('MANUAL_REPLY_MESSAGE_SAVED', { leadId });

    res.json({ success: true, message: outboundMessage });
  } catch (error: any) {
    console.error('MANUAL_REPLY_SEND_ERROR', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to send WhatsApp message', details: error.message });
  }
});

// --- Vite Setup ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log('SERVER_LISTENING');
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('STARTUP_FATAL_ERROR', err.message);
  process.exit(1);
});
