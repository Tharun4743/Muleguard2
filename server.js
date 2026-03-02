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

const MONGO_URI = "mongodb+srv://Mule_detection:GOAT123@cluster0.3vpptcx.mongodb.net/mule_detection?appName=Cluster0";
const OPENROUTER_API_KEY = "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";

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

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

const Account = mongoose.model('Account', AccountSchema);
const Device = mongoose.model('Device', DeviceSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);
const Alert = mongoose.model('Alert', AlertSchema);

// ─── Fraud Detection Engine ──────────────────────────────────────────────────

async function detectFraud(transaction) {
  let risk = 0;
  let reasons = [];

  const now = transaction.timestamp;
  const from = transaction.fromAccount;
  const to = transaction.toAccount;

  // ── Rule 1: High-Velocity Transfer (< 2 mins between txns from same account)
  const recentTxFromSame = await Transaction.findOne({
    fromAccount: from,
    _id: { $ne: transaction._id },
    timestamp: { $gte: new Date(now - 2 * 60 * 1000) }
  }).sort({ timestamp: -1 });

  if (recentTxFromSame) {
    risk += 0.35;
    reasons.push("⚡ High-Velocity Transfer (< 2 mins)");
  }

  // ── Rule 2: Circular Flow — A→B then B→A within 5 mins
  const fiveMinsAgo = new Date(now - 5 * 60 * 1000);
  const circularTx = await Transaction.findOne({
    fromAccount: to,
    toAccount: from,
    timestamp: { $gte: fiveMinsAgo }
  });

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

  // ── Rule 4: Fan-Out Pattern — same sender → 3+ different receivers in 10 mins
  const tenMinsAgo = new Date(now - 10 * 60 * 1000);
  const fanOutTxs = await Transaction.find({
    fromAccount: from,
    _id: { $ne: transaction._id },
    timestamp: { $gte: tenMinsAgo }
  }).distinct('toAccount');

  if (fanOutTxs.length >= 2) {
    risk += 0.40;
    reasons.push(`📤 Fan-Out Pattern (1 sender → ${fanOutTxs.length + 1} receivers in 10 mins)`);
  }

  // ── Rule 5: Fan-In Pattern — 3+ different senders → same receiver in 10 mins
  const fanInTxs = await Transaction.find({
    toAccount: to,
    _id: { $ne: transaction._id },
    timestamp: { $gte: tenMinsAgo }
  }).distinct('fromAccount');

  if (fanInTxs.length >= 2) {
    risk += 0.40;
    reasons.push(`📥 Fan-In Pattern (${fanInTxs.length + 1} senders → 1 receiver in 10 mins)`);
  }

  // ── Rule 6: Structuring — amounts just below ₹50K or ₹1L reporting thresholds
  const THRESHOLDS = [50000, 100000, 200000];
  const isStructuring = THRESHOLDS.some(t => transaction.amount >= t * 0.9 && transaction.amount < t);
  if (isStructuring) {
    risk += 0.35;
    reasons.push(`💸 Structuring — Amount ₹${transaction.amount.toLocaleString('en-IN')} just below reporting threshold`);
  }

  // ── Rule 7: Repeated Same Amount (smurfing) — same amount from same account in 30 mins
  const thirtyMinsAgo = new Date(now - 30 * 60 * 1000);
  const sameAmountCount = await Transaction.countDocuments({
    fromAccount: from,
    amount: transaction.amount,
    _id: { $ne: transaction._id },
    timestamp: { $gte: thirtyMinsAgo }
  });

  if (sameAmountCount >= 1) {
    risk += 0.30;
    reasons.push(`🔁 Smurfing — Same amount ₹${transaction.amount.toLocaleString('en-IN')} sent ${sameAmountCount + 1}x in 30 mins`);
  }

  // ── Rule 8: Unusual Hour (1 AM – 4 AM IST)
  const hourIST = (now.getUTCHours() + 5.5) % 24;
  if (hourIST >= 1 && hourIST < 4) {
    risk += 0.20;
    reasons.push("🌙 Unusual Hour (1–4 AM IST)");
  }

  // ── Rule 9: Cross-Jurisdiction Rapid Transfer (< 5 mins, different city)
  const crossJurisdictionTx = await Transaction.findOne({
    fromAccount: from,
    jurisdiction: { $ne: transaction.jurisdiction },
    timestamp: { $gte: fiveMinsAgo },
    _id: { $ne: transaction._id }
  });

  if (crossJurisdictionTx) {
    risk += 0.25;
    reasons.push(`🌍 Cross-Jurisdiction Transfer (${crossJurisdictionTx.jurisdiction} → ${transaction.jurisdiction} in < 5 mins)`);
  }

  // ── Rule 10: AI / GNN Score via OpenRouter
  if (OPENROUTER_API_KEY) {
    try {
      const gnnScore = await getAIScore(transaction, reasons);
      risk += gnnScore;
      if (gnnScore > 0.15) reasons.push(`🤖 AI-GNN Anomaly Score: +${(gnnScore * 100).toFixed(0)}%`);
    } catch (e) {
      console.error("AI Scoring failed:", e.message);
    }
  }

  const finalRisk = Math.min(risk, 1.0);
  return { risk: finalRisk, reasons };
}

// ─── Live Stats Helper ─────────────────────────────────────────────────────────

async function getStats() {
  const [totalTransactions, totalFlagged, totalBlocked, totalInvestigating, totalCleared, totalAlerts] = await Promise.all([
    Transaction.countDocuments(),
    Transaction.countDocuments({ isFlagged: true }),
    Transaction.countDocuments({ status: 'blocked' }),
    Transaction.countDocuments({ status: 'investigating' }),
    Transaction.countDocuments({ status: 'cleared' }),
    Alert.countDocuments(),
  ]);

  const riskAgg = await Transaction.aggregate([{ $group: { _id: null, avg: { $avg: '$riskScore' } } }]);
  const avgRisk = riskAgg[0]?.avg || 0;

  return { totalTransactions, totalFlagged, totalBlocked, totalInvestigating, totalCleared, totalAlerts, avgRisk };
}

async function broadcastStats() {
  try {
    const stats = await getStats();
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
    res.json(await getStats());
  } catch (err) {
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
const ACCOUNTS = [
  "Murugan_Rajan_IndianBank", "Kavitha_Sundar_HDFC",
  "Senthil_Kumar_SBI", "Priya_Nataraj_Axis",
  "Arumugam_Pillai_ICICI", "Lakshmi_Devi_CUB",
  "Karthik_Raja_KVB", "Vijaya_Rangarajan_IOB",
  "Selvam_Muthu_Canara", "Meena_Suresh_UCO"
];
const JURISDICTIONS = ['Chennai', 'Coimbatore', 'Madurai', 'Trichy', 'Salem', 'Tirunelveli', 'Erode', 'Vellore', 'Thanjavur', 'Tiruppur'];
const DEVICE_POOL = ['DEV-X882', 'DEV-Q119', 'DEV-Z554', 'DEV-P002', 'DEV-M771'];
const IP_POOL = ['103.21.144.12', '192.168.1.45', '45.112.32.201', '59.1.4.150', '117.96.0.10'];
const BROWSER_POOL = ['Chrome/122.0.0', 'Safari/17.4', 'Firefox/123.0', 'Mobile/UPI-App', 'Edge/120.0'];

async function executeTransaction(from, to, amount, overrides = {}) {
  const txData = {
    fromAccount: from,
    toAccount: to,
    amount: amount,
    channel: overrides.channel || CHANNELS[Math.floor(Math.random() * CHANNELS.length)],
    jurisdiction: overrides.jurisdiction || JURISDICTIONS[Math.floor(Math.random() * JURISDICTIONS.length)],
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

  // ─ 20%: Mule Ring (Circular)
  if (roll < 0.20) {
    const ring = shuffle(ACCOUNTS).slice(0, 4);
    const sharedDevice = DEVICE_POOL[0]; // Same device for the ring — triggers shared-device rule
    console.log("\n⚔️  ATTACK: Mule Ring (Circular Flow)");
    for (let i = 0; i < ring.length; i++) {
      await executeTransaction(ring[i], ring[(i + 1) % ring.length], randInt(20000, 80000), { deviceId: sharedDevice });
      await delay(600);
    }

    // ─ 15%: Fan-Out (1 → Many) — money layering
  } else if (roll < 0.35) {
    const mule = ACCOUNTS[0];
    const targets = shuffle(ACCOUNTS.slice(1)).slice(0, 4);
    const sharedDevice = DEVICE_POOL[1];
    console.log("\n⚔️  ATTACK: Fan-Out (1 Sender → Many)");
    for (const target of targets) {
      await executeTransaction(mule, target, randInt(30000, 70000), { deviceId: sharedDevice });
      await delay(400);
    }

    // ─ 15%: Fan-In (Many → 1) — aggregation to mule
  } else if (roll < 0.50) {
    const mule = ACCOUNTS[1];
    const sources = shuffle(ACCOUNTS.slice(2)).slice(0, 4);
    const sharedDevice = DEVICE_POOL[2];
    console.log("\n⚔️  ATTACK: Fan-In (Many → 1 Receiver)");
    for (const source of sources) {
      await executeTransaction(source, mule, randInt(25000, 60000), { deviceId: sharedDevice });
      await delay(400);
    }

    // ─ 10%: Structuring — amounts just below ₹50K / ₹1L
  } else if (roll < 0.60) {
    const structuringAmounts = [49500, 49750, 99200, 99800, 199500];
    const amount = structuringAmounts[Math.floor(Math.random() * structuringAmounts.length)];
    const from = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    let to = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    while (to === from) to = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    console.log("\n⚔️  ATTACK: Structuring (Below Threshold)");
    // Send the same structured amount 2-3 times
    for (let i = 0; i < 2; i++) {
      await executeTransaction(from, to, amount);
      await delay(800);
    }

    // ─ 10%: Layering — A→B→C→D chain
  } else if (roll < 0.70) {
    const chain = shuffle(ACCOUNTS).slice(0, 4);
    console.log("\n⚔️  ATTACK: Layering Chain (A→B→C→D)");
    let prevJurisdiction = JURISDICTIONS[0];
    for (let i = 0; i < chain.length - 1; i++) {
      const nextJurisdiction = JURISDICTIONS[(JURISDICTIONS.indexOf(prevJurisdiction) + 2) % JURISDICTIONS.length];
      await executeTransaction(chain[i], chain[i + 1], randInt(40000, 90000), { jurisdiction: nextJurisdiction });
      prevJurisdiction = nextJurisdiction;
      await delay(300); // Very fast — triggers velocity rule
    }

    // ─ 30%: Normal Transaction (legitimate)
  } else {
    const from = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    let to = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    while (to === from) to = ACCOUNTS[Math.floor(Math.random() * ACCOUNTS.length)];
    await executeTransaction(from, to, randInt(500, 15000)); // Small normal amounts
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

// ─── API Routes ───────────────────────────────────────────────────────────────

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
  const count = await Device.countDocuments();
  if (count === 0) {
    await Device.create([
      { deviceId: 'DEV-X882', linkedAccounts: ['Rohan_Sharma_ICICI', 'Anjali_Verma_HDFC'], ipAddress: '103.21.144.12' },
      { deviceId: 'DEV-Q119', linkedAccounts: ['Vikram_Singh_SBI', 'Priya_Patel_Axis'], ipAddress: '192.168.1.45' }
    ]);
    console.log("📱 Devices initialized");
  }
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`\n🚀 MuleGuard server running on port ${PORT}`);
  console.log("─────────────────────────────────────────");
  console.log("🔍 Detection Rules Active:");
  console.log("   1. High-Velocity Transfer  (+35%)");
  console.log("   2. Circular Flow           (+45%)");
  console.log("   3. Shared Device/IP        (+30%)");
  console.log("   4. Fan-Out Pattern         (+40%)");
  console.log("   5. Fan-In Pattern          (+40%)");
  console.log("   6. Structuring             (+35%)");
  console.log("   7. Smurfing (Same Amount)  (+30%)");
  console.log("   8. Unusual Hours (1-4 AM)  (+20%)");
  console.log("   9. Cross-Jurisdiction      (+25%)");
  console.log("  10. AI/GNN Score            (+0-30%)");
  console.log("─────────────────────────────────────────");
  console.log("⚠️  FLAG Threshold: > 70% risk\n");
  await initData();
  runSimulator();
});
