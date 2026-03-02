# MuleGuard - Tamil Nadu Fraud Intelligence Platform

A real-time full-stack fraud detection system specializing in mule account identification for Tamil Nadu banking networks.

## 🚀 Features

### Real-Time Detection
- **12 Advanced Fraud Detection Rules** including AI-powered analysis
- **Live Transaction Monitoring** with WebSocket updates
- **Cross-Jurisdiction Tracking** across Tamil Nadu cities
- **Device & IP Intelligence** for pattern recognition

### Banking Integration
- **Account Verification** with Indian banking APIs
- **KYC Status Monitoring** 
- **Risk Category Assessment**
- **Real-time Geolocation** tracking

### Interactive Dashboard
- **Live Network Surveillance** with real-time updates
- **Knowledge Graph Visualization** of transaction flows
- **Investigation Tools** for analyst workflow
- **Alert Management** with automated notifications

## 🛠️ Tech Stack

### Backend
- **Node.js + Express** - REST API server
- **MongoDB** - Transaction storage & analytics
- **Socket.io** - Real-time WebSocket communication
- **Mongoose** - MongoDB object modeling
- **OpenRouter AI** - GNN-based fraud analysis

### Frontend
- **React 19** - Modern UI framework
- **Framer Motion** - Smooth animations
- **Force Graph** - Network visualization
- **Lucide React** - Icon system
- **Axios** - HTTP client

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB 5.0+ (local or Atlas)
- OpenRouter API key (for AI detection)

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone <repository-url>
cd MULE
npm install
cd client && npm install
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/mule_detection
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
PORT=5000
```

### 3. Start Services
```bash
# Start both server and client
npm start

# Or start individually
npm run server  # Backend on port 5000
npm run client  # Frontend on port 5173
```

### 4. Access Application
- **Dashboard**: http://localhost:5173
- **API**: http://localhost:5000
- **Live Demo**: Watch real-time fraud detection in action

## 🔍 Detection Rules

### Core Fraud Patterns
1. **High-Velocity Transfer** - Multiple transactions within 2 minutes (+35%)
2. **Circular Flow** - A→B then B→A within 5 minutes (+45%)
3. **Shared Device/IP** - Same device across different accounts (+30%)
4. **Fan-Out Pattern** - 1 sender → 3+ receivers (+40%)
5. **Fan-In Pattern** - 3+ senders → 1 receiver (+40%)

### Behavioral Analysis
6. **Structuring** - Amounts below reporting thresholds (+35%)
7. **Smurfing** - Repeated same amounts (+30%)
8. **Unusual Hours** - 1-4 AM transactions (+20%)
9. **Cross-Jurisdiction** - Rapid city changes (+25%)

### Advanced Intelligence
10. **Account Verification** - Invalid/KYC issues (+25-60%)
11. **IP Geolocation** - Cross-state detection (+10%)
12. **AI/GNN Analysis** - Machine learning anomaly detection (+0-30%)

## 📊 Realistic Data

### Indian Banking Context
- **Account Names**: `rajesh_kumar_sbi2023`, `priya_sharma_hdfc4589`
- **Transaction Amounts**: ₹500 - ₹2,00,000 (realistic Indian ranges)
- **Jurisdictions**: Chennai, Coimbatore, Madurai, Trichy, etc.
- **Device IDs**: Samsung, Realme, Xiaomi Indian models
- **IP Addresses**: Real Indian ISP ranges (Jio, Airtel, BSNL)
- **Payment Apps**: GPay, PhonePe, Paytm, BHIM

### Reporting Thresholds
- **₹50,000** - Standard reporting limit
- **₹1,00,000** - Enhanced monitoring
- **₹2,00,000** - High-value transaction alerts

## 🔧 Configuration

### Environment Variables
```bash
# Database
MONGO_URI=mongodb://localhost:27017/mule_detection

# AI Services
OPENROUTER_API_KEY=sk-or-v1-your-key

# Server
PORT=5000
NODE_ENV=development

# Optional Banking APIs
BANKING_API_KEY=your-banking-api-key
IPGEO_API_KEY=your-geolocation-api-key
```

### Detection Thresholds
- **Flag Threshold**: 70% risk score (configurable)
- **Investigation Threshold**: 40% risk score
- **AI Weight**: 0-30% additional risk

## 📱 API Endpoints

### Transactions
- `GET /transactions` - List recent transactions
- `GET /transaction/:id` - Get transaction details
- `POST /transaction` - Create new transaction
- `PATCH /transaction/:id/block` - Block transaction
- `PATCH /transaction/:id/investigate` - Mark for investigation
- `PATCH /transaction/:id/clear` - Clear as false positive

### Analytics
- `GET /stats` - Live dashboard statistics
- `GET /alerts` - Fraud alerts repository

### WebSocket Events
- `newTransaction` - Real-time transaction updates
- `newAlert` - Fraud alert notifications
- `transactionUpdated` - Status changes
- `statsUpdated` - Live statistics

## 🎯 Use Cases

### Banking Security Teams
- Monitor real-time transaction patterns
- Identify coordinated mule account networks
- Investigate high-risk transaction clusters

### Regulatory Compliance
- Automated suspicious activity reporting
- Cross-jurisdiction monitoring
- Audit trail for regulatory reviews

### Law Enforcement
- Evidence collection for financial crime
- Network analysis for money laundering
- Pattern recognition for fraud rings

## 🔒 Security Features

### Data Protection
- Encrypted API communications
- Secure MongoDB connections
- Environment-based configuration

### Privacy Controls
- No sensitive financial data storage
- Anonymized account identifiers
- GDPR-compliant data handling

## 🚀 Production Deployment

### Docker Setup
```bash
# Build and deploy
docker-compose up -d

# View logs
docker-compose logs -f
```

### Scaling Considerations
- **MongoDB Sharding** for high transaction volumes
- **Redis Cache** for real-time analytics
- **Load Balancer** for multi-instance deployment
- **Monitoring** with Prometheus + Grafana

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the API reference

## 🎯 Roadmap

### v2.0 Features
- [ ] Machine Learning model training
- [ ] Multi-bank API integration
- [ ] Advanced visualization tools
- [ ] Mobile application
- [ ] International expansion

### v1.5 Updates
- [ ] Enhanced AI models
- [ ] Real-time collaboration
- [ ] Advanced reporting
- [ ] Performance optimizations

---

**Built with ❤️ for Tamil Nadu's financial security**
