const express = require('express');
const { verifyToken } = require('../middleware/auth');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// POST /api/payments/create-checkout-session
router.post('/create-checkout-session', verifyToken, async (req, res) => {
  const { userId, email } = req.user; // Decoded from JWT by verifyToken middleware

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/payment-cancel`,
      // Pass the user ID to the checkout session so we know who subscribed in the webhook
      client_reference_id: userId,
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Stripe checkout session creation failed:', error);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

// POST /api/payments/webhook - Stripe webhook handler
// This endpoint needs to be configured to receive raw request bodies.
// We will handle that in the main index.js file.
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log('Checkout session was successful!', session);

      const userId = session.client_reference_id;
      const stripeSubscriptionId = session.subscription;

      // We need to retrieve the full subscription object to get the period end date
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

      try {
        // Use a transaction to update both tables safely
        await db.query('BEGIN');

        const updateUser = db.query(
          'UPDATE users SET has_active_subscription = TRUE WHERE id = $1',
          [userId]
        );

        const insertSubscription = db.query(
          `INSERT INTO subscriptions (user_id, stripe_subscription_id, status, current_period_end)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) DO UPDATE SET
             stripe_subscription_id = EXCLUDED.stripe_subscription_id,
             status = EXCLUDED.status,
             current_period_end = EXCLUDED.current_period_end`,
          [userId, stripeSubscriptionId, 'active', currentPeriodEnd]
        );

        await Promise.all([updateUser, insertSubscription]);

        await db.query('COMMIT');
        console.log(`Subscription activated for user ${userId}`);

      } catch (dbError) {
        await db.query('ROLLBACK');
        console.error('Failed to update database for subscription:', dbError);
        // This is a critical error, might need to alert an admin
        return res.status(500).json({ error: "Database update failed." });
      }

      break;
    }
    // TODO: Handle 'customer.subscription.deleted' and 'invoice.payment_failed'
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});


module.exports = router;
