import React from 'react';
import { Link } from 'react-router-dom';

const PaymentCancelPage: React.FC = () => {
  return (
    <div>
      <h2>Payment Canceled</h2>
      <p>Your payment process was canceled.</p>
      <p>You can try subscribing again whenever you're ready.</p>
      <Link to="/subscribe">Try Again</Link>
      <br />
      <Link to="/">Go to Homepage</Link>
    </div>
  );
};

export default PaymentCancelPage;
