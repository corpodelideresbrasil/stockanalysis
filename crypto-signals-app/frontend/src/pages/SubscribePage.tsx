import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// Make sure to put your publishable key in an environment variable
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_...');

const SubscribePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: session } = await axios.post(
        'http://localhost:3001/api/payments/create-checkout-session',
        {}, // No body needed, user is identified by token
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const stripe = await stripePromise;
      if (stripe) {
        const { error } = await stripe.redirectToCheckout({ sessionId: session.id });
        if (error) {
          setError(error.message || 'An unexpected error occurred.');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start subscription process.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Subscribe to Crypto Signals</h2>
      <p>Get access to daily trading signals by subscribing to our monthly plan.</p>
      <p><strong>Price:</strong> $29.99 / month</p>
      <button onClick={handleClick} disabled={loading}>
        {loading ? 'Redirecting...' : 'Subscribe Now'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default SubscribePage;
