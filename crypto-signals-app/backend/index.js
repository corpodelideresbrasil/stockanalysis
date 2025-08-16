require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const signalRoutes = require('./routes/signals');
const paymentRoutes = require('./routes/payments');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// Webhook endpoint needs raw body
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
    // This is a bit of a workaround to use the router but with a special body parser.
    // We find the webhook route in our payments router and call it manually.
    const webhookRoute = paymentRoutes.stack.find(
        (r) => r.route && r.route.path === '/webhook' && r.route.methods.post
    );
    if (webhookRoute) {
        webhookRoute.handle(req, res, next);
    } else {
        next();
    }
});

// All other routes can use the JSON parser
app.use(express.json());

// Main routes
app.get('/', (req, res) => {
  res.send('Hello from the Crypto Signals Backend!');
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/signals', signalRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
