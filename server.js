const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

try {
  require('dotenv').config();
} catch (e) {
  console.log('📝 Using local configuration (no .env file found)');
}

// Fallback to local config if environment variables aren't set
const localConfig = require('./config.local.js');
const MONGO_URI = process.env.MONGO_URI || localConfig.MONGO_URI;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || localConfig.OPENROUTER_API_KEY;

// In-memory storage fallback for demo when MongoDB is not available
let useInMemory = false;
let inMemoryDB = {
  transactions: [],
  alerts: [],
  devices: [],
  accounts: []
};

// In-memory storage helper functions
function initializeInMemoryData() {
  console.log('📊 Initializing demo data...');
  // Add sample devices
  inMemoryDB.devices = [
    { 
      deviceId: 'SM-A515F', 
      linkedAccounts: ['rajesh_kumar_sbi2023', 'priya_sharma_hdfc4589'], 
      ipAddress: '117.200.45.123',
      deviceType: 'Samsung Galaxy A51',
      osVersion: 'Android 12',
      lastSeen: new Date()
    },
    { 
      deviceId: 'SM-M315F', 
      linkedAccounts: ['mohan_reddy_icici7821', 'anitha_nair_axis3214'], 
      ipAddress: '49.36.96.234',
      deviceType: 'Samsung Galaxy M31',
      osVersion: 'Android 13',
      lastSeen: new Date()
    }
  ];
  console.log('✅ Demo data initialized');
}

// In-memory database operations
function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

function matchesQuery(doc, query) {
  if (!query || Object.keys(query).length === 0) return true;
  for (const [key, value] of Object.entries(query)) {
    if (key === '_id' && value && typeof value === 'object' && value.$ne !== undefined) {
      if (doc._id === value.$ne) return false;
      continue;
    }

    const actual = getNestedValue(doc, key);

    if (value && typeof value === 'object' && (value.$gte !== undefined || value.$lte !== undefined || value.$ne !== undefined)) {
      if (value.$ne !== undefined && actual === value.$ne) return false;
      if (value.$gte !== undefined && !(new Date(actual) >= new Date(value.$gte))) return false;
      if (value.$lte !== undefined && !(new Date(actual) <= new Date(value.$lte))) return false;
      continue;
    }

    if (actual !== value) return false;
  }
  return true;
}

function createInMemoryModel(collectionName) {
  return class InMemoryDoc {
    constructor(data = {}) {
      Object.assign(this, data);
      if (!this._id) this._id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      if (!this.createdAt) this.createdAt = new Date();
    }

    async save() {
      const col = inMemoryDB[collectionName];
      const idx = col.findIndex(d => d._id === this._id);
      if (idx >= 0) col[idx] = { ...col[idx], ...this };
      else col.push({ ...this });
      return this;
    }

    toObject() {
      return { ...this };
    }

    static async create(data) {
      const doc = new this(data);
      await doc.save();
      return doc;
    }

    static async find(query = {}) {
      return inMemoryDB[collectionName].filter(d => matchesQuery(d, query)).map(d => new this(d));
    }

    static async findOne(query = {}) {
      const docs = await this.find(query);
      return docs[0] || null;
    }

    static async findById(id) {
      const raw = inMemoryDB[collectionName].find(d => d._id === id);
      return raw ? new this(raw) : null;
    }

    static async countDocuments(query = {}) {
      const docs = await this.find(query);
      return docs.length;
    }

    static async aggregate(pipeline) {
      if (pipeline?.[0]?.$group?._id === null && pipeline?.[0]?.$group?.avg?.$avg === '$riskScore') {
        const txs = inMemoryDB[collectionName];
        const avg = txs.reduce((sum, t) => sum + (t.riskScore || 0), 0) / txs.length || 0;
        return [{ _id: null, avg }];
      }
      return [];
    }
  };
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const AccountSchema = new mongoose.Schema({
  accountId: { type: String, unique: true },
  balance: Number,
  createdAt: { type: Date, default: Date.now },
  riskScore: { type: Number, default: 0 }
});

const DeviceSchema = new mongoose.Schema({
  deviceId: { type: String, unique: true },
  linkedAccounts: [String],
  ipAddress: String
});

const TransactionSchema = new mongoose.Schema({
  fromAccount: String,
  toAccount: String,
  amount: Number,
  channel: { type: String, enum: ['APP', 'ATM', 'UPI', 'WALLET', 'WEB'] },
  timestamp: { type: Date, default: Date.now },
  jurisdiction: String,
  riskScore: { type: Number, default: 0 },
  isFlagged: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'blocked', 'investigating', 'cleared'], default: 'pending' },
  blockedAt: { type: Date },
  investigatingAt: { type: Date },
  clearedAt: { type: Date },
  analystNote: { type: String, default: '' },
  flagReasons: [String],
  metadata: {
    deviceId: String,
    ipAddress: String,
    browser: String
  }
});

const AlertSchema = new mongoose.Schema({
  transactionId: mongoose.Schema.Types.ObjectId,
  accountId: String,
  riskScore: Number,
  reason: String,
  timestamp: { type: Date, default: Date.now }
});

let Account = mongoose.model('Account', AccountSchema);
let Device = mongoose.model('Device', DeviceSchema);
let Transaction = mongoose.model('Transaction', TransactionSchema);
let Alert = mongoose.model('Alert', AlertSchema);

const InMemoryAccount = createInMemoryModel('accounts');
const InMemoryDevice = createInMemoryModel('devices');
const InMemoryTransaction = createInMemoryModel('transactions');
const InMemoryAlert = createInMemoryModel('alerts');

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 3000, // 3 second timeout
  connectTimeoutMS: 3000
})
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    console.log('🔄 Switching to in-memory storage for demo...');
    useInMemory = true;
    Account = InMemoryAccount;
    Device = InMemoryDevice;
    Transaction = InMemoryTransaction;
    Alert = InMemoryAlert;
    // Initialize with sample data
    initializeInMemoryData();
  });

// ─── Enhanced AI Model with Custom Fraud Patterns ────────────────────────

// Custom fraud pattern detection
async function detectCustomPatterns(transaction, existingReasons) {
  const patterns = [];
  let riskIncrease = 0;
  
  // Pattern 1: Round Number Detection (only for very high amounts)
  if (transaction.amount % 1000 === 0 && transaction.amount > 50000) {
    riskIncrease += 0.03;
    patterns.push('🔢 High-value round amount detected');
  }
  
  // Pattern 2: Sequential Account Numbers (only for very close numbers)
  const fromNum = parseInt(transaction.fromAccount.match(/\d+/)?.[0] || '0');
  const toNum = parseInt(transaction.toAccount.match(/\d+/)?.[0] || '0');
  if (Math.abs(fromNum - toNum) < 50 && fromNum > 0 && toNum > 0) {
    riskIncrease += 0.05;
    patterns.push('📝 Very close sequential account pattern');
  }
  
  // Pattern 3: Time-based clustering (only late night hours)
  const hour = new Date(transaction.timestamp).getHours();
  if (hour >= 23 || hour <= 3) {
    riskIncrease += 0.08;
    patterns.push('🌙 Very late night transaction pattern');
  }
  
  // Pattern 4: Amount velocity (only for high frequency similar amounts)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentTxs = useInMemory
    ? inMemoryDB.transactions.filter(t => new Date(t.timestamp) > dayAgo)
    : await Transaction.find({ timestamp: { $gte: dayAgo } });
  const similarAmounts = recentTxs.filter(t =>
    Math.abs(t.amount - transaction.amount) < (transaction.amount * 0.05) &&
    t.fromAccount === transaction.fromAccount &&
    t._id !== transaction._id
  );
  
  if (similarAmounts.length >= 5) {
    riskIncrease += 0.10;
    patterns.push(`💰 High-velocity amount pattern: ${similarAmounts.length + 1} similar amounts`);
  }
  
  // Pattern 5: Cross-channel anomaly (only for highest risk channels)
  const channelRisk = {
    'UPI': 0.2,
    'APP': 0.1,
    'WEB': 0.3,
    'WALLET': 0.4,
    'ATM': 0.5
  };
  
  if (channelRisk[transaction.channel] > 0.4) {
    riskIncrease += channelRisk[transaction.channel] * 0.08;
    patterns.push(`📱 High-risk channel: ${transaction.channel}`);
  }
  
  return { riskIncrease, patterns };
}

// Enhanced AI scoring with custom patterns
async function getEnhancedAIScore(tx, existingReasons) {
  try {
    // Get custom pattern analysis
    const customPatterns = await detectCustomPatterns(tx, existingReasons);
    
    // Build comprehensive prompt
    const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
      model: "google/gemini-2.0-flash-lite-preview-02-05:free",
      messages: [{
        role: "system",
        content: `You are an advanced financial fraud detection AI specializing in Indian mule account patterns.
Analyze the transaction and return a JSON object with:
{
  "risk_score": 0.00-0.30,
  "confidence": 0.00-1.00,
  "pattern_type": "structuring|layering|circular|fan_out|fan_in|normal",
  "indian_context": boolean,
  "recommendation": "monitor|investigate|block"
}

Consider: Indian banking patterns, UPI behavior, regional transaction flows, amount thresholds, and custom fraud indicators.`
      }, {
        role: "user",
        content: `Transaction Analysis Request:
Account: ${tx.fromAccount} → ${tx.toAccount}
Amount: ₹${tx.amount}
Channel: ${tx.channel}
Jurisdiction: ${tx.jurisdiction}
Time: ${new Date(tx.timestamp).toISOString()}
Existing Flags: [${existingReasons.join('; ')}]
Custom Patterns: [${customPatterns.patterns.join('; ')}]

Provide detailed fraud risk assessment with Indian banking context.`
      }]
    }, {
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      }
    });
    
    const result = JSON.parse(response.data.choices[0].message.content.trim());
    const baseScore = Math.min(result.risk_score || 0, 0.30);
    const customScore = Math.min(customPatterns.riskIncrease, 0.20);
    
    return baseScore + customScore;
  } catch (error) {
    console.error("Enhanced AI scoring failed:", error.message);
    // Fallback to basic pattern detection
    const customPatterns = await detectCustomPatterns(tx, existingReasons);
    return Math.min(customPatterns.riskIncrease, 0.15);
  }
}

// Real-time bank account verification
async function verifyBankAccount(accountId) {
  // In production, integrate with actual banking APIs like:
  // - NPCI API for Indian banks
  // - RazorpayX API
  // - Bank-specific APIs
  
  // For demo, simulate realistic verification responses
  const banks = ['SBI', 'HDFC', 'ICICI', 'AXIS', 'PNB', 'BOI', 'UBI', 'KVB', 'IOB', 'CITI', 'SCB', 'DBS', 'YES', 'IDFC'];
  const bankCode = accountId.split('_').pop();
  const bank = banks.find(b => bankCode.toLowerCase().includes(b.toLowerCase())) || 'UNKNOWN';
  
  return {
    isValid: Math.random() > 0.05, // 95% valid accounts
    bank: bank,
    accountType: Math.random() > 0.7 ? 'savings' : 'current',
    kycVerified: Math.random() > 0.15, // 85% KYC verified
    riskCategory: Math.random() > 0.8 ? 'high' : Math.random() > 0.5 ? 'medium' : 'low'
  };
}

// IP Geolocation for Indian IPs
async function getIPLocation(ipAddress) {
  // In production, use services like:
  // - ipapi.co
  // - ipgeolocation.io
  // - MaxMind GeoIP2
  
  // For demo, return realistic Indian locations
  const locations = [
    { city: 'Chennai', state: 'Tamil Nadu', isp: 'Jio', lat: 13.0827, lon: 80.2707 },
    { city: 'Mumbai', state: 'Maharashtra', isp: 'Airtel', lat: 19.0760, lon: 72.8777 },
    { city: 'Bangalore', state: 'Karnataka', isp: 'BSNL', lat: 12.9716, lon: 77.5946 },
    { city: 'Delhi', state: 'Delhi', isp: 'Vodafone', lat: 28.7041, lon: 77.1025 },
    { city: 'Hyderabad', state: 'Telangana', isp: 'ACT Fibernet', lat: 17.3850, lon: 78.4867 }
  ];
  
  return locations[Math.floor(Math.random() * locations.length)];
}

// ─── Fraud Detection Engine ──────────────────────────────────────────────────

async function detectFraud(transaction) {
  let risk = 0;
  let reasons = [];

  const now = transaction.timestamp;
  const from = transaction.fromAccount;
  const to = transaction.toAccount;

  // ── Rule 1: High-Velocity Transfer (< 1 min between txns from same account)
  const recentTxFromSame = useInMemory ? 
    inMemoryDB.transactions.find(tx => 
      tx.fromAccount === from && 
      tx._id !== transaction._id && 
      new Date(tx.timestamp) > new Date(now - 1 * 60 * 1000)
    ) :
    await Transaction.findOne({
      fromAccount: from,
      _id: { $ne: transaction._id },
      timestamp: { $gte: new Date(now - 1 * 60 * 1000) }
    }).sort({ timestamp: -1 });

  if (recentTxFromSame) {
    risk += 0.25;
    reasons.push("⚡ High-Velocity Transfer (< 1 min)");
  }

  // ── Rule 2: Circular Flow — A→B then B→A within 5 mins
  const fiveMinsAgo = new Date(now - 5 * 60 * 1000);
  const circularTx = useInMemory
    ? await Transaction.findOne({ fromAccount: to, toAccount: from, timestamp: { $gte: fiveMinsAgo } })
    : await Transaction.findOne({ fromAccount: to, toAccount: from, timestamp: { $gte: fiveMinsAgo } });

  if (circularTx) {
    risk += 0.45;
    reasons.push("🔄 Circular Money Flow (A↔B detected)");
  }

  // ── Rule 3: Shared Device / IP across different accounts
  if (transaction.metadata && transaction.metadata.deviceId) {
    const sharedDeviceTx = await Transaction.findOne({
      "metadata.deviceId": transaction.metadata.deviceId,
      fromAccount: { $ne: from },
      _id: { $ne: transaction._id }
    });

    if (sharedDeviceTx) {
      risk += 0.3;
      reasons.push(`📱 Shared Device (${transaction.metadata.deviceId}) across accounts`);
    }
  }

  // ── Rule 4: Fan-Out Pattern — same sender → 4+ different receivers in 15 mins
  const fifteenMinsAgo = new Date(now - 15 * 60 * 1000);
  const fanOutDocs = await Transaction.find({
    fromAccount: from,
    _id: { $ne: transaction._id },
    timestamp: { $gte: fifteenMinsAgo }
  });
  const fanOutTxs = [...new Set(fanOutDocs.map(t => t.toAccount))];

  if (fanOutTxs.length >= 3) {
    risk += 0.30;
    reasons.push(`📤 Fan-Out Pattern (1 sender → ${fanOutTxs.length + 1} receivers in 15 mins)`);
  }

  // ── Rule 5: Fan-In Pattern — 4+ different senders → same receiver in 15 mins
  const fanInDocs = await Transaction.find({
    toAccount: to,
    _id: { $ne: transaction._id },
    timestamp: { $gte: fifteenMinsAgo }
  });
  const fanInTxs = [...new Set(fanInDocs.map(t => t.fromAccount))];

  if (fanInTxs.length >= 4) {
    risk += 0.25;
    reasons.push(`📥 Fan-In Pattern (${fanInTxs.length + 1} senders → 1 receiver in 15 mins)`);
  }

  // ── Rule 6: Structuring — amounts just below ₹1L or ₹2L reporting thresholds
  const THRESHOLDS = [100000, 200000];
  const isStructuring = THRESHOLDS.some(t => transaction.amount >= t * 0.95 && transaction.amount < t);
  if (isStructuring) {
    risk += 0.20;
    reasons.push(`💸 Structuring — Amount ₹${transaction.amount.toLocaleString('en-IN')} just below reporting threshold`);
  }

  // ── Rule 7: Repeated Same Amount (smurfing) — same amount from same account in 1 hour
  const oneHourAgo = new Date(now - 60 * 60 * 1000);
  const sameAmountCount = await Transaction.countDocuments({
    fromAccount: from,
    amount: transaction.amount,
    _id: { $ne: transaction._id },
    timestamp: { $gte: oneHourAgo }
  });

  if (sameAmountCount >= 2) {
    risk += 0.20;
    reasons.push(`🔁 Smurfing — Same amount ₹${transaction.amount.toLocaleString('en-IN')} sent ${sameAmountCount + 1}x in 1 hour`);
  }

  // ── Rule 8: Unusual Hour (12 AM – 3 AM IST)
  const hourIST = (now.getUTCHours() + 5.5) % 24;
  if (hourIST >= 0 && hourIST < 3) {
    risk += 0.15;
    reasons.push("🌙 Unusual Hour (12–3 AM IST)");
  }

  // ── Rule 9: Cross-Jurisdiction Rapid Transfer (< 3 mins, different city)
  const threeMinsAgo = new Date(now - 3 * 60 * 1000);
  const crossJurisdictionTx = await Transaction.findOne({
    fromAccount: from,
    jurisdiction: { $ne: transaction.jurisdiction },
    timestamp: { $gte: threeMinsAgo },
    _id: { $ne: transaction._id }
  });

  if (crossJurisdictionTx) {
    risk += 0.20;
    reasons.push(`🌍 Cross-Jurisdiction Transfer (${crossJurisdictionTx.jurisdiction} → ${transaction.jurisdiction} in < 3 mins)`);
  }

  // ── Rule 11: Account Verification Check
  try {
    const fromVerification = await verifyBankAccount(from);
    if (!fromVerification.isValid) {
      risk += 0.25;
      reasons.push(`❌ Invalid Account: ${fromVerification.bank} account verification failed`);
    }
    if (!fromVerification.kycVerified) {
      risk += 0.10;
      reasons.push(`⚠️  KYC Not Verified: ${fromVerification.bank} account`);
    }
    if (fromVerification.riskCategory === 'high') {
      risk += 0.15;
      reasons.push(`🔴 High Risk Account: ${fromVerification.bank} category`);
    }
  } catch (e) {
    console.error("Account verification failed:", e.message);
  }

  // ── Rule 12: IP Geolocation Anomaly
  if (transaction.metadata && transaction.metadata.ipAddress) {
    try {
      const location = await getIPLocation(transaction.metadata.ipAddress);
      if (location.state !== 'Tamil Nadu' && location.state !== 'Karnataka' && location.state !== 'Andhra Pradesh') {
        risk += 0.08;
        reasons.push(`🌍 Cross-State Transaction: ${location.city}, ${location.state}`);
      }
    } catch (e) {
      console.error("IP geolocation failed:", e.message);
    }
  }

  // ── Rule 10: Enhanced AI / Custom Pattern Detection
  if (OPENROUTER_API_KEY) {
    try {
      const enhancedScore = await getEnhancedAIScore(transaction, reasons);
      risk += enhancedScore;
      if (enhancedScore > 0.15) {
        reasons.push(`🤖 Enhanced AI Pattern: +${(enhancedScore * 100).toFixed(0)}%`);
      }
    } catch (e) {
      console.error("Enhanced AI Scoring failed:", e.message);
    }
  }

  const finalRisk = Math.min(risk, 1.0);
  return { risk: finalRisk, reasons };
}

// ─── Live Stats Helper ─────────────────────────────────────────────────────────

async function getStats() {
  try {
    const [totalTransactions, totalFlagged, totalBlocked, totalInvestigating, totalCleared, totalAlerts] = await Promise.all([
      Transaction.countDocuments().catch(() => 0),
      Transaction.countDocuments({ isFlagged: true }).catch(() => 0),
      Transaction.countDocuments({ status: 'blocked' }).catch(() => 0),
      Transaction.countDocuments({ status: 'investigating' }).catch(() => 0),
      Transaction.countDocuments({ status: 'cleared' }).catch(() => 0),
      Alert.countDocuments().catch(() => 0),
    ]);

    let avgRisk = 0;
    try {
      const riskAgg = await Transaction.aggregate([{ $group: { _id: null, avg: { $avg: '$riskScore' } } }]);
      avgRisk = riskAgg[0]?.avg || 0;
    } catch (e) {
      console.error('Risk aggregation failed:', e.message);
      // Fallback: calculate average risk manually
      const transactions = await Transaction.find().select('riskScore').limit(1000);
      if (transactions.length > 0) {
        avgRisk = transactions.reduce((sum, t) => sum + (t.riskScore || 0), 0) / transactions.length;
      }
    }

    return { 
      totalTransactions: totalTransactions || 0, 
      totalFlagged: totalFlagged || 0, 
      totalBlocked: totalBlocked || 0, 
      totalInvestigating: totalInvestigating || 0, 
      totalCleared: totalCleared || 0, 
      totalAlerts: totalAlerts || 0, 
      avgRisk: avgRisk || 0 
    };
  } catch (error) {
    console.error('Stats calculation error:', error);
    return {
      totalTransactions: 0,
      totalFlagged: 0,
      totalBlocked: 0,
      totalInvestigating: 0,
      totalCleared: 0,
      totalAlerts: 0,
      avgRisk: 0
    };
  }
}

async function broadcastStats() {
  try {
    const stats = await getStats();
    console.log('📊 Broadcasting stats:', {
      transactions: stats.totalTransactions,
      flagged: stats.totalFlagged,
      blocked: stats.totalBlocked,
      investigating: stats.totalInvestigating,
      cleared: stats.totalCleared,
      alerts: stats.totalAlerts,
      avgRisk: (stats.avgRisk * 100).toFixed(1) + '%'
    });
    io.emit('statsUpdated', stats);
  } catch (e) {
    console.error('Stats broadcast error:', e.message);
  }
}


async function getAIScore(tx, existingReasons) {
  try {
    const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
      model: "google/gemini-2.0-flash-lite-preview-02-05:free",
      messages: [{
        role: "system",
        content: `You are a financial fraud detection GNN model specialising in mule account detection.
Analyse the transaction and return ONLY a decimal risk score between 0.00 and 0.30.
Return strictly one number, no explanation, no units.
Factors to weigh: amount size, channel risk (ATM > WEB > UPI > APP), account name patterns, and existing flags.`
      }, {
        role: "user",
        content: `Transaction: ${tx.fromAccount} → ${tx.toAccount}, Amount: ₹${tx.amount}, Channel: ${tx.channel}, Jurisdiction: ${tx.jurisdiction}, Existing Flags: [${existingReasons.join('; ')}]`
      }]
    }, {
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      }
    });
    const score = parseFloat(response.data.choices[0].message.content.trim());
    return isNaN(score) ? 0 : Math.min(score, 0.30);
  } catch {
    return 0;
  }
}

// ─── Action API Routes ───────────────────────────────────────────────────────

// GET live stats from MongoDB
app.get('/stats', async (req, res) => {
  try {
    const stats = await getStats();
    console.log('📊 Stats requested:', {
      totalTransactions: stats.totalTransactions,
      totalFlagged: stats.totalFlagged,
      totalBlocked: stats.totalBlocked,
      totalInvestigating: stats.totalInvestigating,
      totalCleared: stats.totalCleared,
      totalAlerts: stats.totalAlerts,
      avgRisk: (stats.avgRisk * 100).toFixed(1) + '%'
    });
    res.json(stats);
  } catch (err) {
    console.error('Stats API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET single transaction with full detail
app.get('/transaction/:id', async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    res.json(tx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BLOCK — flag transaction in DB, create alert if not already
app.patch('/transaction/:id/block', async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    tx.isFlagged = true;
    tx.status = 'blocked';
    tx.blockedAt = new Date();
    if (req.body.analystNote) tx.analystNote = req.body.analystNote;
    await tx.save();

    // Create alert if not already in system
    const existingAlert = await Alert.findOne({ transactionId: tx._id });
    if (!existingAlert) {
      const alert = new Alert({
        transactionId: tx._id,
        accountId: tx.fromAccount,
        riskScore: tx.riskScore,
        reason: (tx.flagReasons || []).join(' | ') || 'Manually blocked by analyst'
      });
      await alert.save();
      io.emit('newAlert', { ...alert.toObject(), transaction: tx });
    }

    io.emit('transactionUpdated', tx);
    await broadcastStats();
    console.log(`🚫 BLOCKED by analyst: ${tx.fromAccount} → ${tx.toAccount} (₹${tx.amount.toLocaleString('en-IN')})`);
    res.json(tx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// INVESTIGATE — mark transaction under investigation
app.patch('/transaction/:id/investigate', async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    tx.status = 'investigating';
    tx.investigatingAt = new Date();
    if (req.body.analystNote) tx.analystNote = req.body.analystNote;
    await tx.save();

    io.emit('transactionUpdated', tx);
    await broadcastStats();
    console.log(`🔍 INVESTIGATING: ${tx.fromAccount} → ${tx.toAccount}`);
    res.json(tx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CLEAR — mark transaction as cleared/false positive
app.patch('/transaction/:id/clear', async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    tx.isFlagged = false;
    tx.status = 'cleared';
    tx.clearedAt = new Date();
    if (req.body.analystNote) tx.analystNote = req.body.analystNote;
    await tx.save();

    io.emit('transactionUpdated', tx);
    await broadcastStats();
    console.log(`✅ CLEARED by analyst: ${tx.fromAccount} → ${tx.toAccount}`);
    res.json(tx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Shared Transaction Executor ─────────────────────────────────────────────

const CHANNELS = ['APP', 'ATM', 'UPI', 'WALLET', 'WEB'];
// Realistic Indian banking account names
const ACCOUNTS = [
  "rajesh_kumar_sbi2023", "priya_sharma_hdfc4589", "mohan_reddy_icici7821",
  "anitha_nair_axis3214", "vijay_kumar_canara9876", "kavita_menon_pnb6543",
  "suresh_babu_boi2345", "lakshmi_devi_ubi8765", "aravind_swamy_kvb1098",
  "meena_rani_iob5432", "karthik_rajan_citi7654", "deepa_patel_scb4321",
  "ramesh_thomas_dbs8901", "shanti_devi_yesbank3456", "balu_gupta_idfc7890"
];
// Realistic Indian jurisdictions with proper coordinates
const JURISDICTIONS = [
  { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { name: 'Coimbatore', lat: 11.0168, lon: 76.9558 },
  { name: 'Madurai', lat: 9.9252, lon: 78.1198 },
  { name: 'Trichy', lat: 10.7905, lon: 78.7047 },
  { name: 'Salem', lat: 11.6643, lon: 78.1460 },
  { name: 'Tirunelveli', lat: 8.7139, lon: 77.7567 },
  { name: 'Erode', lat: 11.3410, lon: 77.7172 },
  { name: 'Vellore', lat: 12.9165, lon: 79.1325 },
  { name: 'Thanjavur', lat: 10.7870, lon: 79.1378 },
  { name: 'Tiruppur', lat: 11.1085, lon: 77.3411 }
];
// Realistic device ID patterns (Indian mobile devices)
const DEVICE_POOL = [
  'SM-A515F', 'SM-M315F', 'RMX2193', 'CPH1937', 'MI 10X 5G',
  'CPH2123', 'SM-A528B', 'RMX3363', 'CPH2389', 'SM-G715F'
];

// Realistic Indian IP ranges (major ISPs)
const IP_POOL = [
  '117.200.45.123', '49.36.96.234', '106.193.67.89', '2401:4900:1f2a::1', '2405:201:3008::1'
];

// Realistic browser/app patterns for Indian users
const BROWSER_POOL = [
  'Chrome/120.0.6099.109 Mobile', 'Safari/605.1.15 Mobile', 'Firefox/121.0',
  'GPay/3.151.1', 'PhonePe/7.8.6', 'Paytm/13.2.0', 'BHIM/USSD2.0',
  'Edge/120.0.2210.61', 'Opera/96.0.4693.101'
];

async function executeTransaction(from, to, amount, overrides = {}) {
  const selectedJurisdiction = overrides.jurisdiction || JURISDICTIONS[Math.floor(Math.random() * JURISDICTIONS.length)];
  const txData = {
    fromAccount: from,
    toAccount: to,
    amount: amount,
    channel: overrides.channel || CHANNELS[Math.floor(Math.random() * CHANNELS.length)],
    jurisdiction: typeof selectedJurisdiction === 'object' ? selectedJurisdiction.name : selectedJurisdiction,
    timestamp: new Date(),
    metadata: {
      deviceId: overrides.deviceId || DEVICE_POOL[Math.floor(Math.random() * DEVICE_POOL.length)],
      ipAddress: IP_POOL[Math.floor(Math.random() * IP_POOL.length)],
      browser: BROWSER_POOL[Math.floor(Math.random() * BROWSER_POOL.length)]
    }
  };

  try {
    const transaction = new Transaction(txData);
    await transaction.save();

    const { risk, reasons } = await detectFraud(transaction);
    transaction.riskScore = risk;
    transaction.flagReasons = reasons;

    if (risk > 0.7) {
      transaction.isFlagged = true;
      const alert = new Alert({
        transactionId: transaction._id,
        accountId: from,
        riskScore: risk,
        reason: reasons.join(" | ")
      });
      await alert.save();
      io.emit('newAlert', { ...alert.toObject(), transaction });
    }

    await transaction.save();
    io.emit('newTransaction', transaction);
    await broadcastStats();

    const flag = risk > 0.7 ? '🚨 FLAGGED' : risk > 0.4 ? '⚠️  SUSPECT' : '✅ CLEAN';
    console.log(`${flag} | ${from} → ${to} | ₹${amount.toLocaleString('en-IN')} | Risk: ${(risk * 100).toFixed(0)}% | ${reasons.slice(0, 2).join(', ') || 'No flags'}`);
  } catch (err) {
    console.error("Executor error:", err.message);
  }
}

// ─── Simulator ───────────────────────────────────────────────────────────────

async function runSimulator() {
  const roll = Math.random();

  // ─ 35%: Normal Transaction (legitimate Indian banking) - Increased from 30%
  if (roll < 0.35) {
    const from = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    let to = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    while (to === from) to = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    
    // Realistic legitimate transaction amounts (₹1,000 - ₹35,000 for normal transactions)
    const amount = randInt(1000, 35000);
    
    // Add some realistic variations for legitimate transactions
    const variations = [
      { amount: amount * 0.8, channel: 'UPI' },      // Lower UPI transactions
      { amount: amount * 1.2, channel: 'APP' },      // Slightly higher app transactions
      { amount: amount, channel: 'WEB' },             // Standard web transactions
    ];
    
    const variation = variations[Math.floor(Math.random() * variations.length)];
    await executeTransaction(from, to, variation.amount, { channel: variation.channel });
    
  // ─ 15%: Small Personal Transfers (very low risk)
  } else if (roll < 0.50) {
    const from = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    let to = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    while (to === from) to = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    
    // Small personal amounts (₹500 - ₹5,000)
    const amount = randInt(500, 5000);
    await executeTransaction(from, to, amount, { channel: 'UPI' });
    
  // ─ 15%: Bill Payments and Merchant Transactions (legitimate)
  } else if (roll < 0.65) {
    const from = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    // Use merchant-like account names
    const merchants = ['paytm_merchant', 'phonepe_vendor', 'amazon_retail', 'flipkart_seller', 'swiggy_partner'];
    const to = merchants[Math.floor(Math.random() * merchants.length)];
    
    // Bill payment amounts (₹200 - ₹15,000)
    const amount = randInt(200, 15000);
    await executeTransaction(from, to, amount, { channel: 'UPI' });

  // ─ 15%: Salary Credits (legitimate incoming)
  } else if (roll < 0.80) {
    // Company accounts to employees
    const companies = ['tcs_payroll', 'infosys_salary', 'wipro_hr', 'hcl_payments'];
    const from = companies[Math.floor(Math.random() * companies.length)];
    const to = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    
    // Salary amounts (₹25,000 - ₹80,000)
    const amount = randInt(25000, 80000);
    await executeTransaction(from, to, amount, { channel: 'APP' });

  // ─ 20%: Mule Ring (Circular) - Reduced from 20% to 20%
  } else if (roll < 0.85) {
    const ring = shuffle(ACCOUNTS).slice(0, 4);
    const sharedDevice = DEVICE_POOL[0]; // Same device for the ring — triggers shared-device rule
    console.log("\n⚔️  ATTACK: Mule Ring (Circular Flow)");
    for (let i = 0; i < ring.length; i++) {
      // Realistic mule transaction amounts (₹20,000 - ₹80,000)
      await executeTransaction(ring[i], ring[(i + 1) % ring.length], randInt(20000, 80000), { deviceId: sharedDevice });
      await delay(600);
    }

  // ─ 10%: Fan-Out (1 → Many) — money layering
  } else if (roll < 0.90) {
    const mule = ACCOUNTS[0];
    const targets = shuffle(ACCOUNTS.slice(1)).slice(0, 4);
    const sharedDevice = DEVICE_POOL[1];
    console.log("\n⚔️  ATTACK: Fan-Out (1 Sender → Many)");
    for (const target of targets) {
      // Realistic layering amounts (₹30,000 - ₹70,000)
      await executeTransaction(mule, target, randInt(30000, 70000), { deviceId: sharedDevice });
      await delay(400);
    }

  // ─ 5%: Fan-In (Many → 1) — aggregation to mule
  } else if (roll < 0.95) {
    const mule = ACCOUNTS[1];
    const sources = shuffle(ACCOUNTS.slice(2)).slice(0, 4);
    const sharedDevice = DEVICE_POOL[2];
    console.log("\n⚔️  ATTACK: Fan-In (Many → 1 Receiver)");
    for (const source of sources) {
      // Realistic aggregation amounts (₹25,000 - ₹60,000)
      await executeTransaction(source, mule, randInt(25000, 60000), { deviceId: sharedDevice });
      await delay(400);
    }

  // ─ 5%: Structuring — amounts just below ₹1L / ₹2L Indian reporting thresholds
  } else {
    const structuringAmounts = [95000, 97000, 98000, 99000, 195000, 197000, 198000, 199000];
    const amount = structuringAmounts[Math.floor(Math.random() * structuringAmounts.length)];
    const from = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    let to = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    while (to === from) to = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    console.log("\n⚔️  ATTACK: Structuring (Below Indian Reporting Threshold)");
    // Send the same structured amount 2-3 times
    for (let i = 0; i < 2; i++) {
      await executeTransaction(from, to, amount);
      await delay(800);
    }
  }

  setTimeout(runSimulator, randInt(3000, 6000));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Comprehensive Reporting System ─────────────────────────────────────

// Generate detailed fraud report
app.get('/report/fraud', async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    const transactions = await Transaction.find({
      timestamp: { $gte: start, $lte: end },
      riskScore: { $gt: 0.5 }
    }).sort({ timestamp: -1 });
    
    const alerts = await Alert.find({
      timestamp: { $gte: start, $lte: end }
    }).sort({ timestamp: -1 });
    
    const report = {
      metadata: {
        generatedAt: new Date(),
        period: { start, end },
        totalTransactions: transactions.length,
        totalAlerts: alerts.length,
        format: format
      },
      summary: {
        avgRiskScore: transactions.reduce((sum, t) => sum + t.riskScore, 0) / transactions.length || 0,
        highRiskCount: transactions.filter(t => t.riskScore > 0.8).length,
        blockedCount: transactions.filter(t => t.status === 'blocked').length,
        investigatingCount: transactions.filter(t => t.status === 'investigating').length
      },
      topRiskAccounts: transactions
        .reduce((acc, t) => {
          const existing = acc.find(a => a.account === t.fromAccount);
          if (existing) {
            existing.count++;
            existing.avgRisk = (existing.avgRisk + t.riskScore) / 2;
          } else {
            acc.push({ account: t.fromAccount, count: 1, avgRisk: t.riskScore });
          }
          return acc;
        }, [])
        .sort((a, b) => b.avgRisk - a.avgRisk)
        .slice(0, 10),
      channelAnalysis: ['UPI', 'APP', 'ATM', 'WALLET', 'WEB'].map(channel => ({
        channel,
        count: transactions.filter(t => t.channel === channel).length,
        avgRisk: transactions.filter(t => t.channel === channel).reduce((sum, t) => sum + t.riskScore, 0) / transactions.filter(t => t.channel === channel).length || 0
      })),
      jurisdictionAnalysis: JURISDICTIONS.map(jur => {
        const jurName = typeof jur === 'object' ? jur.name : jur;
        const jurTransactions = transactions.filter(t => t.jurisdiction === jurName);
        return {
          jurisdiction: jurName,
          count: jurTransactions.length,
          avgRisk: jurTransactions.reduce((sum, t) => sum + t.riskScore, 0) / jurTransactions.length || 0
        };
      }),
      transactions: transactions.map(t => ({
        id: t._id,
        fromAccount: t.fromAccount,
        toAccount: t.toAccount,
        amount: t.amount,
        channel: t.channel,
        jurisdiction: t.jurisdiction,
        riskScore: t.riskScore,
        status: t.status,
        timestamp: t.timestamp,
        flagReasons: t.flagReasons || []
      })),
      alerts: alerts.map(a => ({
        id: a._id,
        accountId: a.accountId,
        riskScore: a.riskScore,
        reason: a.reason,
        timestamp: a.timestamp
      }))
    };
    
    if (format === 'csv') {
      // Convert to CSV format
      const csvData = [
        ['Report Generated', report.metadata.generatedAt.toISOString()],
        ['Period', `${report.metadata.period.start.toISOString()} to ${report.metadata.period.end.toISOString()}`],
        [],
        ['Summary Metrics'],
        ['Average Risk Score', report.summary.avgRiskScore.toFixed(3)],
        ['High Risk Transactions', report.summary.highRiskCount],
        ['Blocked Transactions', report.summary.blockedCount],
        [],
        ['Top Risk Accounts'],
        ['Account', 'Transaction Count', 'Average Risk'],
        ...report.topRiskAccounts.map(a => [a.account, a.count, a.avgRisk.toFixed(3)]),
        [],
        ['Channel Analysis'],
        ['Channel', 'Count', 'Average Risk'],
        ...report.channelAnalysis.map(c => [c.channel, c.count, c.avgRisk.toFixed(3)])
      ].map(row => row.join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="fraud_report_${Date.now()}.csv"`);
      res.send(csvData);
    } else {
      res.json(report);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF report generation (placeholder)
app.get('/report/pdf', async (req, res) => {
  try {
    // In production, use a PDF library like puppeteer or jsPDF
    res.json({ 
      message: 'PDF report generation coming soon',
      suggestion: 'Use /report/fraud?format=csv for CSV export or integrate PDF library'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Multi-User Support ───────────────────────────────────────────────────────

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  role: { type: String, enum: ['admin', 'analyst', 'viewer'], default: 'analyst' },
  permissions: [{ type: String }],
  lastLogin: Date,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const User = useInMemory ? InMemoryModel : mongoose.model('User', UserSchema);

// User authentication endpoints
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Simple authentication (in production, use proper hashing)
    const user = await User.findOne({ username, isActive: true });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Generate simple token (in production, use JWT)
    const token = Buffer.from(`${user.username}:${Date.now()}`).toString('base64');
    
    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      },
      token,
      expiresIn: '24h'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User management
app.get('/users', async (req, res) => {
  try {
    const users = await User.find({ isActive: true }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initialize demo users
async function initUsers() {
  const count = await User.countDocuments();
  if (count === 0 && !useInMemory) {
    await User.create([
      { username: 'admin', email: 'admin@muleguard.com', role: 'admin', permissions: ['all'] },
      { username: 'analyst1', email: 'analyst1@muleguard.com', role: 'analyst', permissions: ['view', 'investigate', 'block'] },
      { username: 'viewer1', email: 'viewer1@muleguard.com', role: 'viewer', permissions: ['view'] }
    ]);
    console.log('👥 Demo users initialized');
  }
}

app.get('/transactions', async (req, res) => {
  const transactions = await Transaction.find().sort({ timestamp: -1 }).limit(50);
  res.json(transactions);
});

app.get('/alerts', async (req, res) => {
  const alerts = await Alert.find().sort({ timestamp: -1 }).limit(50);
  res.json(alerts);
});

app.post('/transaction', async (req, res) => {
  try {
    const txData = req.body;
    const transaction = new Transaction(txData);
    await transaction.save();

    const { risk, reasons } = await detectFraud(transaction);
    transaction.riskScore = risk;
    transaction.flagReasons = reasons;

    if (risk > 0.7) {
      transaction.isFlagged = true;
      const alert = new Alert({
        transactionId: transaction._id,
        accountId: transaction.fromAccount,
        riskScore: risk,
        reason: reasons.join(" | ")
      });
      await alert.save();
      io.emit('newAlert', alert);
    }

    await transaction.save();
    io.emit('newTransaction', transaction);
    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Init & Start ─────────────────────────────────────────────────────────────

async function initData() {
  if (useInMemory) {
    console.log("📱 Using in-memory devices with Indian mobile patterns");
    return;
  }
  
  const count = await Device.countDocuments();
  if (count === 0) {
    await Device.create([
      { 
        deviceId: 'SM-A515F', 
        linkedAccounts: ['rajesh_kumar_sbi2023', 'priya_sharma_hdfc4589'], 
        ipAddress: '117.200.45.123',
        deviceType: 'Samsung Galaxy A51',
        osVersion: 'Android 12',
        lastSeen: new Date()
      },
      { 
        deviceId: 'SM-M315F', 
        linkedAccounts: ['mohan_reddy_icici7821', 'anitha_nair_axis3214'], 
        ipAddress: '49.36.96.234',
        deviceType: 'Samsung Galaxy M31',
        osVersion: 'Android 13',
        lastSeen: new Date()
      },
      { 
        deviceId: 'RMX2193', 
        linkedAccounts: ['vijay_kumar_canara9876'], 
        ipAddress: '106.193.67.89',
        deviceType: 'Realme Narzo 50A',
        osVersion: 'Android 11',
        lastSeen: new Date()
      }
    ]);
    console.log("📱 Realistic devices initialized with Indian mobile patterns");
  }
}

const PORT = process.env.PORT || 5001;
server.listen(PORT, async () => {
  console.log(`\n🚀 MuleGuard server running on port ${PORT}`);
  console.log("─────────────────────────────────────────");
  console.log("🔍 Detection Rules Active:");
  console.log("   1. High-Velocity Transfer  (+25%)");
  console.log("   2. Circular Flow           (+45%)");
  console.log("   3. Shared Device/IP        (+30%)");
  console.log("   4. Fan-Out Pattern         (+30%)");
  console.log("   5. Fan-In Pattern          (+25%)");
  console.log("   6. Structuring             (+20%)");
  console.log("   7. Smurfing (Same Amount)  (+20%)");
  console.log("   8. Unusual Hours (12-3 AM) (+15%)");
  console.log("   9. Cross-Jurisdiction      (+20%)");
  console.log("  10. Account Verification    (+25-60%)");
  console.log("  11. IP Geolocation          (+8%)");
  console.log("  12. AI/GNN Score            (+0-30%)");
  console.log("─────────────────────────────────────────");
  console.log("⚠️  FLAG Threshold: > 70% risk\n");
  await initData();
  runSimulator();
});
