# MongoDB Setup Guide for MuleGuard

## Option 1: MongoDB Atlas (Recommended - Cloud)

### 1. Create Free MongoDB Atlas Account
1. Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up for a free account
3. Create a new cluster (free tier is sufficient)

### 2. Configure Cluster
1. Choose cloud provider and region (select closest to you)
2. Cluster name: `muleguard-cluster`
3. Click "Create Cluster"

### 3. Get Connection String
1. Go to Database → Connect
2. Choose "Connect your application"
3. Select Node.js driver
4. Copy the connection string

### 4. Update Environment
Create `.env` file:
```bash
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/mule_detection?retryWrites=true&w=majority
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
PORT=5000
```

## Option 2: Local MongoDB Installation

### Windows Installation
1. Download MongoDB Community Server from [https://www.mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
2. Run the installer
3. Choose "Complete" installation
4. Install MongoDB Compass (GUI tool)

### Start MongoDB Service
```powershell
# Start MongoDB service
net start MongoDB

# Check status
netstat -an | findstr 27017
```

### Update Connection String
```bash
MONGO_URI=mongodb://localhost:27017/mule_detection
```

## Option 3: Docker MongoDB (Easiest Local Setup)

### Install Docker Desktop
1. Download Docker Desktop from [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
2. Install and start Docker Desktop

### Run MongoDB Container
```powershell
docker run --name muleguard-mongo -p 27017:27017 -d mongo:latest
```

### Update Connection String
```bash
MONGO_URI=mongodb://localhost:27017/mule_detection
```

## Verify Connection

After setup, test the connection:

```powershell
# If using MongoDB Compass, connect with your string
# Or test with Node.js
node -e "const mongoose = require('mongoose'); mongoose.connect('your-connection-string').then(() => console.log('Connected!')).catch(console.error)"
```

## Security Notes

1. **Never commit credentials to Git**
2. **Use environment variables** for sensitive data
3. **Enable IP whitelisting** for MongoDB Atlas
4. **Use strong passwords** for database users

## Troubleshooting

### Common Issues
- **Connection timeout**: Check firewall settings
- **Authentication failed**: Verify username/password
- **Network unreachable**: Ensure MongoDB service is running

### Debug Connection
Add this to your server.js for debugging:
```javascript
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Error:', err.message));
```

---

**Choose Option 1 (Atlas) for production or easy cloud setup**
**Choose Option 3 (Docker) for quick local development**
