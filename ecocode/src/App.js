import React, { useState } from 'react';
import MapPanel from './components/MapPanel'; 
import ForecastChart from './components/ForecastChart';
import UserInput from './components/UserInput';
import AuthPage from './components/AuthPage'; 
import SystemStatus from './components/SystemStatus';
import './index.css'; 

const App = () => {
  const [forecastData, setForecastData] = useState(null);
  const [zoneId, setZoneId] = useState(null);
  // User state: 'unauthenticated', 'user_input', 'admin_dashboard'
  const [authState, setAuthState] = useState('unauthenticated'); 

  const handleLogin = (role) => {
    if (role === 'admin') {
      setAuthState('admin_dashboard');
    } else {
      setAuthState('user_input');
    }
  };
  
  // RENDER LOGIC
  if (authState === 'unauthenticated') {
    return <AuthPage onLogin={handleLogin} />;
  }

  if (authState === 'user_input') {
    // After user submits data, they return to the AuthPage
    return <UserInput onSubmissionSuccess={() => setAuthState('unauthenticated')} />;
  }

  // Admin Dashboard View (authState === 'admin_dashboard')
  return (
    <div className="app-container">
      <header className="main-header">
        <h1 className="main-title">ZEDF Grid Administrator Dashboard</h1>
        <p className="main-subtitle">
          Deep Learning Ensemble Forecasting for Grid Stability in Delhi | 
          <span style={{color: '#FFC107', marginLeft: '10px', fontWeight: 'bold', cursor: 'pointer'}} 
                onClick={() => setAuthState('unauthenticated')}>
            (Logout)
          </span>
        </p>
      </header>
      <SystemStatus />
      <div className="main-content">
        
        <MapPanel 
          setForecastData={setForecastData} 
          setZoneId={setZoneId}
        />
        
        <ForecastChart 
          data={forecastData} 
          zoneId={zoneId}
        />
        
      </div>

      <footer className="app-footer">
        <p>© Hackathon Prototype | Architecture: LSTM + BiLSTM + TFT Stacking with Groq AI Inference</p>
      </footer>
    </div>
  );
};

export default App;