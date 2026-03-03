import React, { useState } from 'react';
import '../index.css'; 
import UserInput from './UserInput';

const ADMIN_KEY = "GRIDMANAGER25"; 

const AuthPage = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState('user');
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [error, setError] = useState('');

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminKeyInput === ADMIN_KEY) {
      onLogin('admin');
    } else {
      setError('Invalid Admin Key. Please try again.');
    }
  };

  const handleUserLogin = () => {
    onLogin('user');
  };

  return (
    <div className="auth-container">
      <h1 className="auth-title">ZEDF System Access</h1>
      
      <div className="tab-switcher">
        <button 
          className={`tab-button ${activeTab === 'user' ? 'active' : ''}`}
          onClick={() => { setActiveTab('user'); setError(''); }}
        >
          Household User
        </button>
        <button 
          className={`tab-button ${activeTab === 'admin' ? 'active' : ''}`}
          onClick={() => { setActiveTab('admin'); setError(''); }}
        >
          Grid Administrator
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'user' && (
          <div className="auth-card user-card">
            <h3 className="card-heading">Submit Consumption Data</h3>
            <p>Your data improves zonal demand accuracy.</p>
            <button className="submit-button" onClick={handleUserLogin}>
              Proceed to Data Entry
            </button>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="auth-card admin-card">
            <h3 className="card-heading">Admin Login</h3>
            <form onSubmit={handleAdminLogin} className="login-form">
              <input
                type="password"
                placeholder="Enter Admin Key"
                value={adminKeyInput}
                onChange={(e) => { setAdminKeyInput(e.target.value); setError(''); }}
                className="input-field"
              />
              <button type="submit" className="login-button">
                View Forecast Dashboard
              </button>
            </form>
            {error && <p className="error-message">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthPage;