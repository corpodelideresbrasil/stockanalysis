import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

// Define shapes
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

interface User {
    id: number;
    email: string;
    is_admin: boolean;
    has_active_subscription: boolean;
    created_at: string;
}

const initialFormState = {
  asset: '',
  type: 'Compra' as 'Compra' | 'Venda' | 'Espera',
  entry_price: '',
  target_price: '',
  stop_loss: '',
  status: 'active' as 'active' | 'triggered' | 'closed',
};

const AdminDashboardPage: React.FC = () => {
  // State for signals
  const [signals, setSignals] = useState<Signal[]>([]);
  const [formData, setFormData] = useState(initialFormState);
  const [editingSignalId, setEditingSignalId] = useState<number | null>(null);

  // State for users
  const [users, setUsers] = useState<User[]>([]);

  // Generic state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  // Fetching logic for both signals and users
  const fetchSignals = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/signals', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSignals(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch signals.');
    }
  };

  const fetchUsers = async () => {
    try {
        const response = await axios.get('http://localhost:3001/api/users', {
            headers: { Authorization: `Bearer ${token}` },
        });
        setUsers(response.data);
    } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch users.');
    }
  };

  useEffect(() => {
    if (token) {
      setIsLoading(true);
      Promise.all([fetchSignals(), fetchUsers()]).finally(() => setIsLoading(false));
    }
  }, [token]);

  // Handlers for Signals
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditClick = (signal: Signal) => {
    setEditingSignalId(signal.id);
    setFormData({
        asset: signal.asset,
        type: signal.type,
        entry_price: String(signal.entry_price || ''),
        target_price: String(signal.target_price || ''),
        stop_loss: String(signal.stop_loss || ''),
        status: signal.status,
    });
  };

  const handleCancelEdit = () => {
    setEditingSignalId(null);
    setFormData(initialFormState);
  };

  const handleDeleteSignal = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this signal?')) {
      try {
        await axios.delete(`http://localhost:3001/api/signals/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        fetchSignals();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to delete signal.');
      }
    }
  };

  const handleSignalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const url = editingSignalId ? `/api/signals/${editingSignalId}` : '/api/signals';
    const method = editingSignalId ? 'put' : 'post';
    const payload = {
      ...formData,
      entry_price: formData.entry_price ? parseFloat(formData.entry_price) : null,
      target_price: formData.target_price ? parseFloat(formData.target_price) : null,
      stop_loss: formData.stop_loss ? parseFloat(formData.stop_loss) : null,
    };
    try {
      await axios[method](`http://localhost:3001${url}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      handleCancelEdit();
      fetchSignals();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${editingSignalId ? 'update' : 'create'} signal.`);
    }
  };

  // Handler for User Activation
  const handleActivateSubscription = async (userId: number) => {
    if (window.confirm('Are you sure you want to manually activate this user\'s subscription for 30 days?')) {
        try {
            await axios.post(`http://localhost:3001/api/users/${userId}/activate-subscription`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchUsers(); // Refresh the user list
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to activate subscription.');
        }
    }
  };

  return (
    <div>
      <h1>Admin Dashboard</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Signal Management Section */}
      <section>
        <h2>Manage Signals</h2>
        <form onSubmit={handleSignalSubmit}>
          <h3>{editingSignalId ? 'Edit Signal' : 'Create New Signal'}</h3>
          <input name="asset" value={formData.asset} onChange={handleInputChange} placeholder="Asset (e.g., BTC/USD)" required />
          <select name="type" value={formData.type} onChange={handleInputChange}>
            <option value="Compra">Compra</option>
            <option value="Venda">Venda</option>
            <option value="Espera">Espera</option>
          </select>
          <input name="entry_price" type="number" step="any" value={formData.entry_price} onChange={handleInputChange} placeholder="Entry Price" />
          <input name="target_price" type="number" step="any" value={formData.target_price} onChange={handleInputChange} placeholder="Target Price" />
          <input name="stop_loss" type="number" step="any" value={formData.stop_loss} onChange={handleInputChange} placeholder="Stop Loss" />
          {editingSignalId && (
              <select name="status" value={formData.status} onChange={handleInputChange}>
                  <option value="active">Active</option>
                  <option value="triggered">Triggered</option>
                  <option value="closed">Closed</option>
              </select>
          )}
          <button type="submit">{editingSignalId ? 'Update Signal' : 'Create Signal'}</button>
          {editingSignalId && <button type="button" onClick={handleCancelEdit}>Cancel Edit</button>}
        </form>
        <h3>Existing Signals</h3>
        {isLoading && <p>Loading signals...</p>}
        <table border={1} style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
          <thead>
            <tr>
              <th>Asset</th><th>Type</th><th>Entry Price</th><th>Target Price</th><th>Stop Loss</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((signal) => (
              <tr key={signal.id}>
                <td>{signal.asset}</td><td>{signal.type}</td><td>{signal.entry_price}</td><td>{signal.target_price}</td><td>{signal.stop_loss}</td><td>{signal.status}</td>
                <td>
                  <button onClick={() => handleEditClick(signal)}>Edit</button>
                  <button onClick={() => handleDeleteSignal(signal.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <hr />

      {/* User Management Section */}
      <section>
        <h2>Manage Users</h2>
        {isLoading && <p>Loading users...</p>}
        <table border={1} style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
                <tr>
                    <th>Email</th><th>Is Admin?</th><th>Subscription Active?</th><th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {users.map((user) => (
                    <tr key={user.id}>
                        <td>{user.email}</td>
                        <td>{user.is_admin ? 'Yes' : 'No'}</td>
                        <td>{user.has_active_subscription ? 'Yes' : 'No'}</td>
                        <td>
                            {!user.has_active_subscription && (
                                <button onClick={() => handleActivateSubscription(user.id)}>Activate Subscription</button>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </section>
    </div>
  );
};

export default AdminDashboardPage;
