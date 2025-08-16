import React from 'react';
import { Link } from 'react-router-dom';

const PaymentSuccessPage: React.FC = () => {
  return (
    <div>
      <h2>Payment Successful!</h2>
      <p>Your subscription is now active.</p>
      <p>You can now access the trading signals dashboard.</p>
      <Link to="/">Go to Dashboard</Link>
    </div>
  );
};

export default PaymentSuccessPage;
