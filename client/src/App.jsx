import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import ForceGraph2D from 'react-force-graph-2d';
import AdvancedAnalytics from './components/AdvancedAnalytics';
import {
  AlertTriangle, Activity, ShieldCheck, Download,
  LayoutDashboard, Settings, Network, Sun, Moon, Bell,
  Sliders, Shield, ToggleLeft, ToggleRight, Clock,
  X, Ban, Search, CheckCircle, Smartphone, Globe, Monitor,
  MapPin, Hash, TrendingUp, User, CreditCard, Info, Menu,
  Volume2, VolumeX, Filter, BarChart3, Users, Lock, Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'http://localhost:5001';
const socket = io(API);

// Sound alert for fraud detection
const playAlertSound = () => {
  const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
  audio.play().catch(e => console.log('Audio play failed:', e));
};

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(ts) {
  return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ─── Investigation Modal ──────────────────────────────────────────────────────
function InvestigateModal({ tx, onClose, onAction }) {
  const [note, setNote] = useState(tx.analystNote || '');
  const [loading, setLoading] = useState('');

  const doAction = async (action) => {
    setLoading(action);
    try {
      const res = await axios.patch(`${API}/transaction/${tx._id}/${action}`, { analystNote: note });
      onAction(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading('');
    }
  };

  const riskColor = tx.riskScore > 0.7 ? '#ef4444' : tx.riskScore > 0.4 ? '#f59e0b' : '#10b981';
  const statusLabel = {
    blocked: { label: '🚫 BLOCKED', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    investigating: { label: '🔍 INVESTIGATING', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    cleared: { label: '✅ CLEARED', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    pending: { label: '⏳ PENDING', color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' },
  }[tx.status || 'pending'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-box"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(59,130,246,0.15)', borderRadius: '10px', padding: '8px' }}>
              <Search size={20} color="#3b82f6" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Transaction Investigation</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                ID: {tx._id}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, background: statusLabel.bg, color: statusLabel.color }}>
              {statusLabel.label}
            </span>
            <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Risk Score Big Display */}
          <div className="modal-risk-banner" style={{ borderColor: riskColor }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>FRAUD RISK SCORE</div>
                <div style={{ fontSize: '2.8rem', fontWeight: 800, color: riskColor, lineHeight: 1 }}>
                  {(tx.riskScore * 100).toFixed(0)}%
                </div>
              </div>
              <div style={{ width: '100px', height: '100px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--risk-track)" strokeWidth="8" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke={riskColor} strokeWidth="8"
                    strokeDasharray={`${tx.riskScore * 251.2} 251.2`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)" />
                </svg>
                <TrendingUp size={22} color={riskColor} style={{ position: 'absolute' }} />
              </div>
            </div>
            <div style={{ marginTop: '10px', width: '100%', height: '6px', background: 'var(--risk-track)', borderRadius: '3px' }}>
              <div style={{ height: '100%', width: `${tx.riskScore * 100}%`, background: riskColor, borderRadius: '3px', transition: 'width 0.6s ease' }} />
            </div>
          </div>

          {/* 2-column detail grid */}
          <div className="modal-grid">
            {/* Left: Transaction Details */}
            <div className="modal-section">
              <div className="modal-section-title"><CreditCard size={14} /> Transaction Details</div>
              <div className="detail-row"><span className="detail-label">From Account</span><span className="detail-value highlight-red">{tx.fromAccount}</span></div>
              <div className="detail-row"><span className="detail-label">To Account</span><span className="detail-value">{tx.toAccount}</span></div>
              <div className="detail-row">
                <span className="detail-label">Amount</span>
                <span className="detail-value" style={{ color: tx.amount > 50000 ? '#f59e0b' : 'var(--text-primary)', fontWeight: 700 }}>
                  ₹{tx.amount.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="detail-row"><span className="detail-label">Channel</span><span className={`badge badge-channel badge-${tx.channel?.toLowerCase()}`}>{tx.channel}</span></div>
              <div className="detail-row"><span className="detail-label">Jurisdiction</span><span className="detail-value"><MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />{tx.jurisdiction}</span></div>
              <div className="detail-row"><span className="detail-label">Timestamp</span>
                <span className="detail-value">
                  <div>{formatTime(tx.timestamp)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{formatDate(tx.timestamp)}</div>
                </span>
              </div>
              {tx.blockedAt && <div className="detail-row"><span className="detail-label">Blocked At</span><span className="detail-value" style={{ color: '#ef4444' }}>{formatDateTime(tx.blockedAt)}</span></div>}
              {tx.investigatingAt && <div className="detail-row"><span className="detail-label">Investigation Started</span><span className="detail-value" style={{ color: '#f59e0b' }}>{formatDateTime(tx.investigatingAt)}</span></div>}
              {tx.clearedAt && <div className="detail-row"><span className="detail-label">Cleared At</span><span className="detail-value" style={{ color: '#10b981' }}>{formatDateTime(tx.clearedAt)}</span></div>}
            </div>

            {/* Right: Device Metadata */}
            <div className="modal-section">
              <div className="modal-section-title"><Smartphone size={14} /> Device & Network Metadata</div>
              <div className="detail-row"><span className="detail-label">Device ID</span><span className="detail-value" style={{ fontFamily: 'monospace', color: '#a78bfa' }}>{tx.metadata?.deviceId || '—'}</span></div>
              <div className="detail-row"><span className="detail-label">IP Address</span><span className="detail-value" style={{ fontFamily: 'monospace' }}><Globe size={12} style={{ display: 'inline', marginRight: '4px' }} />{tx.metadata?.ipAddress || '—'}</span></div>
              <div className="detail-row"><span className="detail-label">Browser / App</span><span className="detail-value"><Monitor size={12} style={{ display: 'inline', marginRight: '4px' }} />{tx.metadata?.browser || '—'}</span></div>
              <div className="detail-row"><span className="detail-label">Transaction ID</span><span className="detail-value" style={{ fontFamily: 'monospace', fontSize: '0.72rem', opacity: 0.6 }}>{tx._id}</span></div>

              {/* Flag Reasons */}
              {tx.flagReasons && tx.flagReasons.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div className="modal-section-title" style={{ marginBottom: '8px' }}><AlertTriangle size={14} color="#ef4444" /> Fraud Signals Detected</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {tx.flagReasons.map((r, i) => (
                      <div key={i} style={{ fontSize: '0.8rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '6px 10px', color: '#fca5a5', lineHeight: '1.4' }}>
                        {r}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Analyst Note */}
          <div style={{ marginTop: '1rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              <Info size={13} style={{ display: 'inline', marginRight: '4px' }} />
              Analyst Note (optional — saved with action)
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Confirmed mule ring involving Murugan_Rajan_IndianBank — escalating to RBI..."
              className="analyst-textarea"
              rows={3}
            />
          </div>
        </div>

        {/* Action Footer */}
        <div className="modal-footer">
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Actions persist to MongoDB and notify all connected clients
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="action-btn action-btn-clear"
              onClick={() => doAction('clear')}
              disabled={!!loading || tx.status === 'cleared'}
            >
              {loading === 'clear' ? '...' : <><CheckCircle size={15} /> Clear (False Positive)</>}
            </button>
            <button
              className="action-btn action-btn-investigate"
              onClick={() => doAction('investigate')}
              disabled={!!loading || tx.status === 'investigating'}
            >
              {loading === 'investigate' ? '...' : <><Search size={15} /> Mark Investigating</>}
            </button>
            <button
              className="action-btn action-btn-block"
              onClick={() => doAction('block')}
              disabled={!!loading || tx.status === 'blocked'}
            >
              {loading === 'block' ? '...' : <><Ban size={15} /> Block Account</>}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
const socket_io = socket;

function App() {
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState('dark');
  const [investigateTx, setInvestigateTx] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState([]);
  const [showSoundAlert, setShowSoundAlert] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [user, setUser] = useState({ role: 'analyst', name: 'Security Analyst' });
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const searchInputRef = useRef(null);
  
  // Live DB stats — sourced from server, not local state
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalFlagged: 0,
    totalBlocked: 0,
    totalInvestigating: 0,
    totalCleared: 0,
    totalAlerts: 0,
    avgRisk: 0,
  });
  const [settings, setSettings] = useState({
    flagThreshold: 70,
    notifications: true,
    autoExport: false,
  });

  const [threshold, setThreshold] = useState(5000);

  // Theme persistence
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.body.setAttribute('data-theme', savedTheme);
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl/Cmd + K for search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Ctrl/Cmd + / for shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowKeyboardShortcuts(!showKeyboardShortcuts);
      }
      // 1-4 for tabs
      if (e.key >= '1' && e.key <= '4') {
        const tabs = ['dashboard', 'alerts', 'graph', 'settings'];
        setActiveTab(tabs[parseInt(e.key) - 1]);
      }
      // S for sound toggle
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
        setSoundEnabled(!soundEnabled);
      }
      // M for mobile menu
      if (e.key === 'm' && !e.ctrlKey && !e.metaKey) {
        setSidebarOpen(!sidebarOpen);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showKeyboardShortcuts, soundEnabled, sidebarOpen]);

  // Browser notifications
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Show browser notification for high-risk alerts
  const showNotification = (title, body, risk) => {
    if (settings.notifications && Notification.permission === 'granted' && risk > 0.7) {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'fraud-alert',
        requireInteraction: true
      });
    }
  };

  // Update a single transaction in state by id
  const patchTxInState = useCallback((updated) => {
    setTransactions(prev => prev.map(t => t._id === updated._id ? updated : t));
    // If the investigate modal is open for this tx, update it too
    setInvestigateTx(prev => prev && prev._id === updated._id ? updated : prev);
  }, []);

  useEffect(() => {
    // Fetch initial data + DB stats
    axios.get(`${API}/transactions`).then(res => {
      setTransactions(res.data);
      updateGraph(res.data);
    });
    axios.get(`${API}/alerts`).then(res => setAlerts(res.data));
    axios.get(`${API}/stats`).then(res => setStats(res.data)).catch(() => { });

    socket_io.on('newTransaction', (tx) => {
      setTransactions(prev => [tx, ...prev].slice(0, 50));
      updateGraph([tx]);
      
      // Sound and visual alerts for high-risk transactions
      if (tx.riskScore > 0.7 && soundEnabled) {
        playAlertSound();
        setShowSoundAlert(true);
        setTimeout(() => setShowSoundAlert(false), 3000);
      }
      
      // Browser notification
      if (tx.riskScore > 0.7) {
        showNotification(
          '🚨 High-Risk Transaction Detected',
          `${tx.fromAccount} → ${tx.toAccount}: ₹${tx.amount.toLocaleString('en-IN')} (${(tx.riskScore * 100).toFixed(0)}% risk)`,
          tx.riskScore
        );
      }
      
      // Add to notifications list
      setNotifications(prev => [{
        id: Date.now(),
        type: tx.riskScore > 0.7 ? 'alert' : 'info',
        message: `${tx.riskScore > 0.7 ? '🚨' : 'ℹ️'} ${tx.fromAccount} → ${tx.toAccount}`,
        timestamp: new Date(),
        risk: tx.riskScore
      }, ...prev.slice(0, 9)]);
    });
    socket_io.on('newAlert', (alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 50));
      if (soundEnabled) {
        playAlertSound();
        setShowSoundAlert(true);
        setTimeout(() => setShowSoundAlert(false), 3000);
      }
    });
    socket_io.on('transactionUpdated', (tx) => {
      patchTxInState(tx);
    });
    // This is the key event — DB counts pushed from server after every change
    socket_io.on('statsUpdated', (newStats) => {
      setStats(newStats);
    });

    return () => {
      socket_io.off('newTransaction');
      socket_io.off('newAlert');
      socket_io.off('transactionUpdated');
      socket_io.off('statsUpdated');
    };
  }, [patchTxInState]);

  const updateGraph = (newTxs) => {
    setGraphData(prev => {
      const nodes = [...prev.nodes];
      const links = [...prev.links];
      newTxs.forEach(tx => {
        if (!nodes.find(n => n.id === tx.fromAccount))
          nodes.push({ id: tx.fromAccount, type: 'account', label: tx.fromAccount });
        if (!nodes.find(n => n.id === tx.toAccount))
          nodes.push({ id: tx.toAccount, type: 'account', label: tx.toAccount });
        links.push({ source: tx.fromAccount, target: tx.toAccount, flagged: tx.isFlagged });
      });
      return { nodes, links };
    });
  };

  // Block directly from table (no modal)
  const handleDirectBlock = async (tx, e) => {
    e.stopPropagation();
    if (tx.status === 'blocked') return;
    try {
      const res = await axios.patch(`${API}/transaction/${tx._id}/block`, {});
      patchTxInState(res.data);
    } catch (err) {
      console.error('Block failed:', err);
    }
  };

  const exportReport = () => {
    const data = alerts.map(a => ({
      ID: a._id, Account: a.accountId,
      Risk: (a.riskScore * 100).toFixed(0) + '%',
      Reason: `"${a.reason}"`,
      Date: new Date(a.timestamp).toLocaleString('en-IN')
    }));
    const csv = "data:text/csv;charset=utf-8,"
      + ["ID,Account,Risk,Reason,Date", ...data.map(r => Object.values(r).join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", "muleguard_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter transactions based on search and filters
  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = searchTerm === '' || 
      tx.fromAccount.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.toAccount.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.amount.toString().includes(searchTerm);
    
    const matchesFilters = activeFilters.length === 0 || activeFilters.every(filter => {
      switch(filter) {
        case 'flagged': return tx.isFlagged || tx.riskScore > 0.7;
        case 'high-risk': return tx.riskScore > 0.6;
        case 'blocked': return tx.status === 'blocked';
        case 'investigating': return tx.status === 'investigating';
        default: return true;
      }
    });
    
    return matchesSearch && matchesFilters;
  });

  const toggleFilter = (filter) => {
    setActiveFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  // ── Stat card helper: animated number display
  const fmtNum = (n) => Number(n).toLocaleString('en-IN');

  const statusBadge = (tx) => {
    const s = tx.status || (tx.isFlagged ? 'blocked' : 'pending');
    if (s === 'blocked') return <span className="status-badge status-block">🚫 BLOCKED</span>;
    if (s === 'investigating') return <span className="status-badge status-investigate">🔍 WATCH</span>;
    if (s === 'cleared') return <span className="status-badge status-clean">✅ CLEARED</span>;
    if (tx.riskScore > 0.4) return <span className="status-badge status-watch">⚠️ SUSPECT</span>;
    return <span className="status-badge status-clean">✅ CLEAN</span>;
  };

  return (
    <div className="dashboard-container">
      {/* Mobile Menu Toggle */}
      <button 
        className="mobile-menu-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <Menu size={20} />
      </button>

      {/* Keyboard Shortcuts Help */}
      <AnimatePresence>
        {showKeyboardShortcuts && (
          <motion.div 
            className="keyboard-shortcuts"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div><kbd>Ctrl+K</kbd> Search</div>
            <div><kbd>1-4</kbd> Tabs</div>
            <div><kbd>S</kbd> Sound</div>
            <div><kbd>M</kbd> Menu</div>
            <div><kbd>Ctrl+/</kbd> Help</div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ── Sidebar ── */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <ShieldCheck color="#3b82f6" size={30} />
          <h2 style={{ letterSpacing: '1px' }}>MuleGuard</h2>
        </div>
        <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginBottom: '1.6rem' }}>
          Tamil Nadu Fraud Intelligence Platform
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            { id: 'dashboard', icon: <LayoutDashboard size={17} />, label: 'Dashboard' },
            { id: 'alerts', icon: <AlertTriangle size={17} />, label: `Alerts (${fmtNum(stats.totalAlerts)})` },
            { id: 'graph', icon: <Network size={17} />, label: 'Identity Graph' },
            { id: 'analytics', icon: <BarChart3 size={17} />, label: 'Analytics' },
            { id: 'settings', icon: <Settings size={17} />, label: 'Settings' },
          ].map(item => (
            <button 
              key={item.id} 
              className={`nav-btn ${activeTab === item.id ? 'nav-btn-active' : ''}`} 
              onClick={() => {
                setActiveTab(item.id);
                setSidebarOpen(false);
              }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </span>
            <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className="theme-toggle-btn">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              🔊 Sound Alerts
            </span>
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="theme-toggle-btn">
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
          </div>
          
          <div style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            🟢 Live · {fmtNum(stats.totalTransactions)} Tx · {fmtNum(stats.totalFlagged)} Flagged
          </div>
          
          <div style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            👤 {user.name} · {user.role}
          </div>
        </div>
      </div>

        {/* ── Main ── */}
      <div className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.7rem' }}>
              {activeTab === 'dashboard' && 'Network Surveillance'}
              {activeTab === 'alerts' && 'Fraud Alerts'}
              {activeTab === 'graph' && 'Identity Graph'}
              {activeTab === 'analytics' && 'Advanced Analytics'}
              {activeTab === 'settings' && 'Settings'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.88rem' }}>
              Real-time Tamil Nadu cross-channel monitoring
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              className="theme-toggle-btn-header" 
              onClick={() => setShowKeyboardShortcuts(!showKeyboardShortcuts)}
              title="Keyboard shortcuts (Ctrl+/)"
            >
              ⌨️ Shortcuts
            </button>
            <button className="theme-toggle-btn-header" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
            <button className="btn btn-primary" onClick={exportReport}>
              <Download size={16} /> Export CSV
            </button>
          </div>
        </header>

        {/* Search and Filters */}
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="search-container">
            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              placeholder="Search transactions by account, amount... (Ctrl+K)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="search-icon" size={16} />
          </div>
          
          <div className="filter-tags">
            {['flagged', 'high-risk', 'blocked', 'investigating'].map(filter => (
              <button
                key={filter}
                className={`filter-tag ${activeFilters.includes(filter) ? 'active' : ''}`}
                onClick={() => toggleFilter(filter)}
              >
                {filter === 'flagged' && '� Flagged'}
                {filter === 'high-risk' && '⚠️ High Risk'}
                {filter === 'blocked' && '🚫 Blocked'}
                {filter === 'investigating' && '🔍 Investigating'}
              </button>
            ))}
          </div>
        </div>

        {/* ── DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <>
            <div className="grid-3">
              {[
                {
                  label: 'Total Transactions',
                  val: fmtNum(stats.totalTransactions),
                  sub: `Last 50 shown below`,
                  icon: <Activity size={18} color="#10b981" />,
                  color: '#10b981'
                },
                {
                  label: 'Flagged / Blocked',
                  val: fmtNum(stats.totalFlagged),
                  sub: `🚫 ${fmtNum(stats.totalBlocked)} Blocked · 🔍 ${fmtNum(stats.totalInvestigating)} Investigating`,
                  icon: <AlertTriangle size={18} color="#ef4444" />,
                  color: '#ef4444'
                },
                {
                  label: 'Avg Network Risk',
                  val: (stats.avgRisk * 100).toFixed(1) + '%',
                  sub: stats.avgRisk > 0.4 ? '🔴 Network Critical' : '🟢 Network Stable',
                  icon: <TrendingUp size={18} color="#3b82f6" />,
                  color: stats.avgRisk > 0.4 ? '#ef4444' : '#3b82f6'
                },
              ].map((c, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="card">
                  <div style={{ color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>{c.label}{c.icon}</div>
                  <div className="stat-value" style={{ color: c.color }}>{c.val}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '6px' }}>{c.sub}</div>
                </motion.div>
              ))}
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>Live Network Activity Monitor</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn" style={{ fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }} onClick={() => setTransactions([])}>Clear</button>
                  <button className="btn btn-primary" style={{ fontSize: '0.8rem' }}>Auto-Actions: ON</button>
                </div>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>TX ID</th>
                      <th>Account Path</th>
                      <th>Amount</th>
                      <th>Channel</th>
                      <th>Timestamp</th>
                      <th>Risk Score</th>
                      <th>Status</th>
                      <th style={{ minWidth: '180px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filteredTransactions.map((tx) => {
                        const st = tx.status || (tx.isFlagged ? 'blocked' : 'pending');
                        return (
                          <motion.tr
                            key={tx._id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={st === 'blocked' ? 'mule-row' : st === 'investigating' ? 'investigating-row' : tx.riskScore > 0.4 ? 'suspect-row' : ''}
                          >
                            <td style={{ fontSize: '0.75rem', opacity: 0.55, fontFamily: 'monospace' }}>#{tx._id.slice(-6)}</td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{tx.fromAccount} → {tx.toAccount}</span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>📍 {tx.jurisdiction}</span>
                              </div>
                            </td>
                            <td style={{ fontWeight: 700, color: tx.amount > 50000 ? '#f59e0b' : 'var(--text-primary)' }}>
                              ₹{tx.amount.toLocaleString('en-IN')}
                            </td>
                            <td>
                              <span className={`badge badge-channel badge-${tx.channel?.toLowerCase()}`}>{tx.channel}</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{formatTime(tx.timestamp)}</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{formatDate(tx.timestamp)}</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ height: '5px', width: '64px', background: 'var(--risk-track)', borderRadius: '3px' }}>
                                    <div style={{
                                      height: '100%', borderRadius: '3px', transition: 'width 0.5s ease',
                                      width: `${tx.riskScore * 100}%`,
                                      background: tx.riskScore > threshold ? '#ef4444' : tx.riskScore > 0.4 ? '#f59e0b' : '#10b981'
                                    }} />
                                  </div>
                                  <span style={{ fontWeight: 700, fontSize: '0.82rem', color: tx.riskScore > threshold ? '#ef4444' : tx.riskScore > 0.4 ? '#f59e0b' : '#10b981' }}>
                                    {(tx.riskScore * 100).toFixed(0)}%
                                  </span>
                                </div>
                                {tx.flagReasons?.length > 0 && (
                                  <div style={{ fontSize: '0.62rem', color: '#f87171', maxWidth: '180px', lineHeight: 1.4 }}>
                                    {tx.flagReasons.slice(0, 2).join(' • ')}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className={`status-badge status-${st}`}>
                                {st === 'blocked' ? '🚫 Blocked' : st === 'investigating' ? '🔍 Investigating' : '✅ Cleared'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                <button className="action-btn" onClick={() => setInvestigateTx(tx)}>🔍</button>
                                <button className="action-btn action-btn-block" onClick={() => handleAction(tx._id, 'block')} disabled={st !== 'pending'}>🚫</button>
                                <button className="action-btn action-btn-clear" onClick={() => handleAction(tx._id, 'clear')} disabled={st === 'cleared'}>✅</button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── ALERTS ── */}
        {activeTab === 'alerts' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>🚨 Fraud Alerts Repository</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{alerts.length} alerts</span>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Alert ID</th>
                    <th>Suspect Account</th>
                    <th>Risk Score</th>
                    <th>Detection Signals</th>
                    <th>Timestamp</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <tr key={alert._id} className="mule-row">
                      <td style={{ fontSize: '0.75rem', opacity: 0.55, fontFamily: 'monospace' }}>#{alert._id.slice(-8)}</td>
                      <td style={{ color: '#ef4444', fontWeight: 700 }}>{alert.accountId}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '64px', height: '5px', background: 'var(--risk-track)', borderRadius: '3px' }}>
                            <div style={{ width: `${alert.riskScore * 100}%`, height: '100%', background: '#ef4444', borderRadius: '3px' }} />
                          </div>
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>{(alert.riskScore * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', maxWidth: '280px', lineHeight: '1.5' }}>{alert.reason}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{formatTime(alert.timestamp)}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{formatDate(alert.timestamp)}</span>
                        </div>
                      </td>
                      <td>
                        <button
                          className="action-btn-sm action-btn-sm-investigate"
                          onClick={() => {
                            const tx = transactions.find(t => t._id === alert.transactionId || t._id === String(alert.transactionId));
                            if (tx) setInvestigateTx(tx);
                            else axios.get(`${API}/transaction/${alert.transactionId}`).then(r => setInvestigateTx(r.data));
                          }}
                        >
                          <Search size={13} /> Investigate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {activeTab === 'analytics' && (
          <AdvancedAnalytics />
        )}

        {/* ── GRAPH ── */}
        {activeTab === 'graph' && (
          <motion.div 
            className="card" 
            style={{ padding: 0 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Network size={20} color="#3b82f6" />
                    Network Intelligence Graph
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
                    Real-time mule cluster detection · Animated transaction flows
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    className="btn" 
                    style={{ fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)' }}
                    onClick={() => setGraphData({ nodes: [], links: [] })}
                  >
                    Clear Graph
                  </button>
                  <button 
                    className="btn btn-primary" 
                    style={{ fontSize: '0.8rem' }}
                  >
                    🎯 Auto-Focus: ON
                  </button>
                </div>
              </div>
            </div>
            <div className="graph-container" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', position: 'relative' }}>
              {/* Graph Stats Overlay */}
              <div style={{ 
                position: 'absolute', 
                top: '20px', 
                left: '20px', 
                background: 'rgba(15, 23, 42, 0.9)', 
                backdropFilter: 'blur(10px)',
                padding: '15px',
                borderRadius: '12px',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                zIndex: 10
              }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px' }}>Network Statistics</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                    <span style={{ fontSize: '0.75rem', color: '#e2e8f0' }}>Nodes: {graphData.nodes.length}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                    <span style={{ fontSize: '0.75rem', color: '#e2e8f0' }}>Edges: {graphData.links.length}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                    <span style={{ fontSize: '0.75rem', color: '#e2e8f0' }}>Flagged: {graphData.links.filter(l => l.flagged).length}</span>
                  </div>
                </div>
              </div>
              
              {/* Legend */}
              <div style={{ 
                position: 'absolute', 
                top: '20px', 
                right: '20px', 
                background: 'rgba(15, 23, 42, 0.9)', 
                backdropFilter: 'blur(10px)',
                padding: '15px',
                borderRadius: '12px',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                zIndex: 10
              }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px' }}>Legend</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '20px', height: '2px', background: '#10b981' }} />
                    <span style={{ fontSize: '0.75rem', color: '#e2e8f0' }}>Normal Flow</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '20px', height: '2px', background: '#ef4444' }} />
                    <span style={{ fontSize: '0.75rem', color: '#e2e8f0' }}>Flagged Flow</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#3b82f6' }} />
                    <span style={{ fontSize: '0.75rem', color: '#e2e8f0' }}>Account Node</span>
                  </div>
                </div>
              </div>

              <ForceGraph2D
                graphData={graphData}
                nodeAutoColorBy="type"
                nodeLabel={(node) => {
                  const parts = (node.label || '').split('_');
                  return parts[0] + (parts[1] ? ' ' + parts[1][0] + '.' : '');
                }}
                linkDirectionalArrowLength={8}
                linkDirectionalArrowRelPos={0.95}
                linkColor={(link) => {
                  if (link.flagged) return '#ef4444';
                  return `rgba(59, 130, 246, ${0.3 + Math.random() * 0.3})`;
                }}
                linkWidth={(link) => link.flagged ? 3 : 2}
                backgroundColor="transparent"
                width={900}
                height={500}
                enableNodeDrag={true}
                enableZoomInteraction={true}
                enablePanInteraction={true}
                cooldownTicks={100}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
                nodeCanvasObject={(node, ctx, globalScale) => {
                  const parts = (node.label || '').split('_');
                  const short = parts[0] + (parts[1] ? ' ' + parts[1][0] + '.' : '');
                  const fontSize = Math.max(12 / globalScale, 8);
                  
                  // Node glow effect
                  if (node.flagged) {
                    ctx.shadowColor = '#ef4444';
                    ctx.shadowBlur = 10;
                  } else {
                    ctx.shadowColor = '#3b82f6';
                    ctx.shadowBlur = 5;
                  }
                  
                  // Node background
                  ctx.fillStyle = node.flagged ? 'rgba(239, 68, 68, 0.9)' : 'rgba(59, 130, 246, 0.9)';
                  ctx.strokeStyle = node.flagged ? '#ef4444' : '#3b82f6';
                  ctx.lineWidth = 2;
                  
                  // Draw node circle
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI);
                  ctx.fill();
                  ctx.stroke();
                  
                  // Reset shadow for text
                  ctx.shadowColor = 'transparent';
                  ctx.shadowBlur = 0;
                  
                  // Text background
                  ctx.font = `bold ${fontSize}px Inter`;
                  const tw = ctx.measureText(short).width;
                  const pad = 6;
                  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                  ctx.strokeStyle = node.flagged ? '#ef4444' : '#3b82f6';
                  ctx.lineWidth = 1;
                  
                  // Rounded rectangle for text
                  const rx = 6;
                  const ry = 4;
                  const x = node.x - tw / 2 - pad;
                  const y = node.y - fontSize / 2 - pad - 15;
                  const w = tw + pad * 2;
                  const h = fontSize + pad * 2;
                  
                  ctx.beginPath();
                  ctx.moveTo(x + rx, y);
                  ctx.lineTo(x + w - rx, y);
                  ctx.quadraticCurveTo(x + w, y, x + w, y + ry);
                  ctx.lineTo(x + w, y + h - ry);
                  ctx.quadraticCurveTo(x + w, y + h, x + w - rx, y + h);
                  ctx.lineTo(x + rx, y + h);
                  ctx.quadraticCurveTo(x, y + h, x, y + h - ry);
                  ctx.lineTo(x, y + ry);
                  ctx.quadraticCurveTo(x, y, x + rx, y);
                  ctx.closePath();
                  ctx.fill();
                  ctx.stroke();
                  
                  // Text
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillStyle = '#e2e8f0';
                  ctx.fillText(short, node.x, node.y - 15);
                }}
                onNodeClick={(node) => {
                  // Find transactions for this account
                  const accountTransactions = transactions.filter(t => 
                    t.fromAccount === node.id || t.toAccount === node.id
                  );
                  console.log(`Account ${node.id}: ${accountTransactions.length} transactions`);
                }}
                onLinkClick={(link) => {
                  // Find transaction for this link
                  const transaction = transactions.find(t => 
                    t.fromAccount === link.source.id && t.toAccount === link.target.id
                  );
                  if (transaction) {
                    setInvestigateTx(transaction);
                    setActiveTab('dashboard');
                  }
                }}
              />
            </div>
          </motion.div>
        )}

        {/* ── ANALYTICS ── */}
        {activeTab === 'analytics' && (
          <AdvancedAnalytics />
        )}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem', maxWidth: '700px' }}>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.2rem' }}><Sun size={20} color="#f59e0b" /><h3>Appearance</h3></div>
              <div className="settings-row">
                <div>
                  <div style={{ fontWeight: 600 }}>Theme</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Switch interface between dark and light</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className={`theme-chip ${theme === 'dark' ? 'theme-chip-active' : ''}`} onClick={() => setTheme('dark')}>🌙 Dark</button>
                  <button className={`theme-chip ${theme === 'light' ? 'theme-chip-active' : ''}`} onClick={() => setTheme('light')}>☀️ Light</button>
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.2rem' }}><Sliders size={20} color="#3b82f6" /><h3>Detection Thresholds</h3></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ fontWeight: 600 }}>Fraud Flag Threshold</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Transactions above this score are flagged</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input type="range" min={50} max={95} step={5} value={settings.flagThreshold} onChange={e => setSettings(s => ({ ...s, flagThreshold: Number(e.target.value) }))} style={{ flex: 1, accentColor: '#3b82f6' }} />
                  <span style={{ fontWeight: 800, fontSize: '1.1rem', color: settings.flagThreshold < 65 ? '#ef4444' : settings.flagThreshold < 80 ? '#f59e0b' : '#10b981', minWidth: '48px', textAlign: 'right' }}>{settings.flagThreshold}%</span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  {settings.flagThreshold < 65 ? '⚠️ Very sensitive — higher false positive rate' : settings.flagThreshold < 80 ? '✅ Balanced — recommended' : '🔒 Strict — only catches very high-confidence fraud'}
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.2rem' }}><Bell size={20} color="#10b981" /><h3>Notifications</h3></div>
              {[
                { key: 'notifications', label: 'Alert Notifications', desc: 'Show badge count on Alerts tab' },
                { key: 'autoExport', label: 'Auto-Export on Block', desc: 'Auto-download CSV when a transaction is blocked' },
              ].map(item => (
                <div key={item.key} className="settings-row" style={{ marginBottom: '1rem' }}>
                  <div><div style={{ fontWeight: 600 }}>{item.label}</div><div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.desc}</div></div>
                  <button className={`toggle-btn ${settings[item.key] ? 'toggle-on' : 'toggle-off'}`} onClick={() => setSettings(s => ({ ...s, [item.key]: !s[item.key] }))}>
                    {settings[item.key] ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
                  </button>
                </div>
              ))}
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.2rem' }}><Shield size={20} color="#8b5cf6" /><h3>System Info</h3></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {[
                  { label: 'Attack Patterns', value: '5 types', color: '#ef4444' },
                  { label: 'Detection Rules', value: '10 active', color: '#f59e0b' },
                  { label: 'Tx Interval', value: '3–6 sec', color: '#3b82f6' },
                  { label: 'AI Model', value: 'Gemini Flash', color: '#10b981' },
                ].map(c => (
                  <div key={c.label} style={{ background: 'var(--stats-bg)', borderRadius: '10px', padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.label}</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: c.color, marginTop: '4px' }}>{c.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(59,130,246,0.07)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                📍 <strong>Jurisdictions:</strong> Chennai · Coimbatore · Madurai · Trichy · Salem · Tirunelveli · Erode · Vellore · Thanjavur · Tiruppur<br />
                🏦 <strong>Banks:</strong> Indian Bank · HDFC · SBI · Axis · ICICI · CUB · KVB · IOB · Canara · UCO
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Investigation Modal ── */}
      <AnimatePresence>
        {investigateTx && (
          <InvestigateModal
            tx={investigateTx}
            onClose={() => setInvestigateTx(null)}
            onAction={(updated) => {
              patchTxInState(updated);
              setInvestigateTx(updated); // keep modal open with updated data
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
