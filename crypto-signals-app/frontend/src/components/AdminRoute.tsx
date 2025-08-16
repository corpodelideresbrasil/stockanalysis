import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminRoute: React.FC = () => {
  const { user, token, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>; // Or a spinner component
  }

  // First, check for token to see if user is logged in at all
  if (!token) {
    return <Navigate to="/login" />;
  }

  // Then, check if the logged-in user is an admin
  return user && user.isAdmin ? <Outlet /> : <Navigate to="/" />;
};

export default AdminRoute;
