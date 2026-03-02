import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, TrendingDown, Activity, Users, 
  Clock, MapPin, Smartphone, Globe, AlertTriangle, Shield,
  Calendar, Filter, Download, RefreshCw, Eye, EyeOff
} from 'lucide-react';
import axios from 'axios';

const API = 'http://localhost:5001';

const AdvancedAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('30d');
  const [showComparison, setShowComparison] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch real analytics data from MongoDB
  const fetchAnalyticsData = async (selectedDateRange = dateRange) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${API}/analytics?dateRange=${selectedDateRange}`);
      setData(response.data);
      
    } catch (err) {
      console.error('Failed to fetch analytics data:', err);
      setError('Failed to load analytics data. Please try again.');
      
      // Fallback to empty data structure
      setData({
        timeSeries: [],
        channelDistribution: [],
        geographicDistribution: [],
        riskDistribution: [],
        hourlyPatterns: [],
        deviceAnalytics: []
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData(dateRange);
  }, [dateRange]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalyticsData(dateRange).finally(() => {
      setRefreshing(false);
    });
  };

  const exportData = () => {
    if (!data || !data.timeSeries) return;
    
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Date,Transactions,Flagged,Blocked,Risk Score\n" +
      data.timeSeries.map(row => 
        `${row.date},${row.transactions},${row.flagged},${row.blocked},${row.riskScore}`
      ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "analytics_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate summary statistics from real data
  const summaryStats = useMemo(() => {
    if (!data || !data.timeSeries || data.timeSeries.length === 0) return null;
    
    const totalTransactions = data.timeSeries.reduce((sum, day) => sum + day.transactions, 0);
    const totalFlagged = data.timeSeries.reduce((sum, day) => sum + day.flagged, 0);
    const avgRisk = data.timeSeries.reduce((sum, day) => sum + parseFloat(day.riskScore), 0) / data.timeSeries.length;
    const fraudRate = totalTransactions > 0 ? (totalFlagged / totalTransactions * 100).toFixed(2) : '0.00';
    
    return {
      totalTransactions,
      totalFlagged,
      avgRisk: avgRisk.toFixed(3),
      fraudRate,
      trend: Math.random() > 0.5 ? 'up' : 'down'
    };
  }, [data]);

  if (loading) {
    return (
      <div className="analytics-loading">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Activity size={40} />
        </motion.div>
        <p>Loading Analytics from Database...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-loading">
        <AlertTriangle size={40} />
        <p>{error}</p>
        <button onClick={handleRefresh} className="analytics-btn">
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="advanced-analytics">
      {/* Header */}
      <div className="analytics-header">
        <div className="analytics-title">
          <BarChart3 size={28} />
          <div>
            <h2>Advanced Analytics</h2>
            <p>Real-time fraud detection insights from database</p>
          </div>
        </div>
        
        <div className="analytics-controls">
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            className="analytics-select"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>
          
          <button 
            onClick={() => setShowComparison(!showComparison)}
            className={`analytics-btn ${showComparison ? 'active' : ''}`}
          >
            {showComparison ? <EyeOff size={16} /> : <Eye size={16} />}
            Comparison
          </button>
          
          <button 
            onClick={handleRefresh}
            className={`analytics-btn ${refreshing ? 'refreshing' : ''}`}
          >
            <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
            Refresh
          </button>
          
          <button onClick={exportData} className="analytics-btn">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="analytics-grid">
        {/* Time Series Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="analytics-chart-container"
        >
          <div className="analytics-chart-header">
            <h3>Transaction Trends</h3>
            <div className="chart-legend">
              <span className="legend-item">
                <span className="legend-color" style={{ background: '#3b82f6' }}></span>
                Transactions
              </span>
              <span className="legend-item">
                <span className="legend-color" style={{ background: '#ef4444' }}></span>
                Flagged
              </span>
            </div>
          </div>
          <div className="analytics-chart-content">
            <div className="time-series-chart">
              {data.timeSeries && data.timeSeries.length > 0 ? (
                data.timeSeries.map((day, i) => (
                  <div key={i} className="time-series-bar">
                    <div 
                      className="bar transactions-bar"
                      style={{ height: `${Math.max((day.transactions / Math.max(...data.timeSeries.map(d => d.transactions))) * 100, 5)}%` }}
                    />
                    <div 
                      className="bar flagged-bar"
                      style={{ height: `${Math.max((day.flagged / Math.max(...data.timeSeries.map(d => d.flagged))) * 100, 5)}%` }}
                    />
                    <div className="bar-label">
                      {new Date(day.date).getDate()}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                  No data available for selected period
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Channel Distribution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="analytics-chart-container"
        >
          <div className="analytics-chart-header">
            <h3>Channel Distribution</h3>
            <Smartphone size={16} />
          </div>
          <div className="analytics-chart-content">
            <div className="channel-chart">
              {data.channelDistribution && data.channelDistribution.length > 0 ? (
                data.channelDistribution.map((channel, i) => (
                  <div key={i} className="channel-item">
                    <div className="channel-info">
                      <span className="channel-name">{channel.channel}</span>
                      <span className="channel-count">{channel.transactions.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="channel-bar-container">
                      <div 
                        className="channel-bar"
                        style={{ 
                          width: `${Math.max((channel.transactions / Math.max(...data.channelDistribution.map(c => c.transactions))) * 100, 5)}%`,
                          background: channel.risk > 0.15 ? '#ef4444' : '#10b981'
                        }}
                      />
                      <span className="channel-risk">{(channel.risk * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                  No channel data available
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Geographic Distribution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="analytics-chart-container"
        >
          <div className="analytics-chart-header">
            <h3>Geographic Distribution</h3>
            <MapPin size={16} />
          </div>
          <div className="analytics-chart-content">
            <div className="geo-chart">
              {data.geographicDistribution && data.geographicDistribution.length > 0 ? (
                data.geographicDistribution.map((city, i) => (
                  <div key={i} className="geo-item">
                    <div className="geo-info">
                      <span className="geo-name">{city.city}</span>
                      <span className="geo-count">{city.transactions.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="geo-bar-container">
                      <div 
                        className="geo-bar"
                        style={{ 
                          width: `${Math.max((city.transactions / Math.max(...data.geographicDistribution.map(c => c.transactions))) * 100, 5)}%`,
                          background: city.risk > 0.15 ? '#ef4444' : '#3b82f6'
                        }}
                      />
                      <span className="geo-risk">{(city.risk * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                  No geographic data available
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Risk Distribution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="analytics-chart-container"
        >
          <div className="analytics-chart-header">
            <h3>Risk Score Distribution</h3>
            <AlertTriangle size={16} />
          </div>
          <div className="analytics-chart-content">
            <div className="risk-distribution">
              {data.riskDistribution && data.riskDistribution.length > 0 ? (
                data.riskDistribution.map((range, i) => (
                  <div key={i} className="risk-item">
                    <div className="risk-label">{range.range}</div>
                    <div className="risk-bar-container">
                      <div 
                        className="risk-bar"
                        style={{ 
                          width: `${range.percentage}%`,
                          background: range.range.includes('81-100') ? '#ef4444' : 
                                     range.range.includes('61-80') ? '#f59e0b' : '#10b981'
                        }}
                      />
                    </div>
                    <div className="risk-stats">
                      <span className="risk-count">{range.count.toLocaleString('en-IN')}</span>
                      <span className="risk-percentage">{range.percentage}%</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                  No risk data available
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Hourly Patterns */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="analytics-chart-container full-width"
        >
          <div className="analytics-chart-header">
            <h3>Hourly Transaction Patterns</h3>
            <Clock size={16} />
          </div>
          <div className="analytics-chart-content">
            <div className="hourly-chart">
              {data.hourlyPatterns && data.hourlyPatterns.length > 0 ? (
                data.hourlyPatterns.map((hour, i) => (
                  <div key={i} className="hourly-bar">
                    <div 
                      className="hourly-transactions-bar"
                      style={{ 
                        height: `${Math.max((hour.transactions / Math.max(...data.hourlyPatterns.map(h => h.transactions))) * 100, 5)}%`,
                        background: '#3b82f6'
                      }}
                    />
                    <div 
                      className="hourly-flagged-bar"
                      style={{ 
                        height: `${Math.max((hour.flagged / Math.max(...data.hourlyPatterns.map(h => h.flagged))) * 100, 5)}%`,
                        background: '#ef4444'
                      }}
                    />
                    <div className="hourly-label">{hour.hour}:00</div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                  No hourly data available
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Device Analytics */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="analytics-chart-container"
        >
          <div className="analytics-chart-header">
            <h3>Device Analytics</h3>
            <Smartphone size={16} />
          </div>
          <div className="analytics-chart-content">
            <div className="device-analytics">
              {data.deviceAnalytics && data.deviceAnalytics.length > 0 ? (
                data.deviceAnalytics.map((device, i) => (
                  <div key={i} className="device-item">
                    <div className="device-info">
                      <span className="device-type">{device.type}</span>
                      <span className="device-count">{device.count.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="device-risk">
                      <span className="risk-score">{(device.risk * 100).toFixed(1)}%</span>
                    </div>
                    <div className="device-bar">
                      <div 
                        className="device-risk-bar"
                        style={{ 
                          width: `${Math.max((device.count / Math.max(...data.deviceAnalytics.map(d => d.count))) * 100, 5)}%`,
                          background: device.risk > 0.15 ? '#ef4444' : '#10b981'
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                  No device data available
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Comparison View */}
      {showComparison && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="analytics-comparison"
        >
          <div className="comparison-header">
            <h3>Period Comparison</h3>
            <p>Compare current period with previous period</p>
          </div>
          <div className="comparison-grid">
            <div className="comparison-item">
              <span className="comparison-label">Transaction Volume</span>
              <span className="comparison-current">
                {summaryStats ? summaryStats.totalTransactions.toLocaleString('en-IN') : '0'}
              </span>
              <span className="comparison-previous">N/A</span>
              <span className="comparison-change positive">Real Data</span>
            </div>
            <div className="comparison-item">
              <span className="comparison-label">Avg Risk Score</span>
              <span className="comparison-current">
                {summaryStats ? (summaryStats.avgRisk * 100).toFixed(1) + '%' : '0%'}
              </span>
              <span className="comparison-previous">N/A</span>
              <span className="comparison-change negative">Live</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AdvancedAnalytics;
