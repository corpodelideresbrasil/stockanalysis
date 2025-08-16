import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import SubscribePage from './pages/SubscribePage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentCancelPage from './pages/PaymentCancelPage';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import { useAuth } from './context/AuthContext';
import './App.css';

// Define the shape of a signal
interface Signal {
  id: number;
  asset: string;
  type: 'Compra' | 'Venda' | 'Espera';
  entry_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  status: 'active' | 'triggered' | 'closed';
  created_at: string;
}

function SignalDashboard() {
  const { user, token } = useAuth();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSignals = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await axios.get('http://localhost:3001/api/signals', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSignals(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch signals.');
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchSignals();
    }
  }, [token]);

  if (isLoading) {
    return <div>Loading signals...</div>;
  }

  if (error) {
    return (
        <div>
            <h1>Welcome, {user?.email}</h1>
            <p style={{ color: 'red' }}>Error: {error}</p>
            <p>You may not have an active subscription. Please subscribe to view the signals.</p>
            <Link to="/subscribe">Subscribe Now</Link>
        </div>
    );
  }

  return (
    <div>
      <h1>Trading Signals</h1>
      <p>Welcome, {user?.email}. Here are the latest signals.</p>
      <table border={1} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Type</th>
            <th>Entry Price</th>
            <th>Target Price</th>
            <th>Stop Loss</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((signal) => (
            <tr key={signal.id}>
              <td>{signal.asset}</td>
              <td>{signal.type}</td>
              <td>{signal.entry_price}</td>
              <td>{signal.target_price}</td>
              <td>{signal.stop_loss}</td>
              <td>{new Date(signal.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


function App() {
  const { user, logout } = useAuth();

  return (
    <div>
      <nav>
        <ul>
          <li>
            <Link to="/">Home</Link>
          </li>
          {user && user.isAdmin && (
            <li>
              <Link to="/admin">Admin Dashboard</Link>
            </li>
          )}
          {user ? (
            <li>
              <button onClick={logout}>Logout</button>
            </li>
          ) : (
            <>
              <li>
                <Link to="/login">Login</Link>
              </li>
              <li>
                <Link to="/register">Register</Link>
              </li>
            </>
          )}
        </ul>
      </nav>

      <hr />

      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/payment-success" element={<PaymentSuccessPage />} />
        <Route path="/payment-cancel" element={<PaymentCancelPage />} />

        {/* Protected routes */}
        <Route path="/" element={<ProtectedRoute />}>
          <Route index element={<SignalDashboard />} />
          <Route path="subscribe" element={<SubscribePage />} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin" element={<AdminRoute />}>
          <Route index element={<AdminDashboardPage />} />
        </Route>

        {/* Redirect any other path to home */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

export default App;
