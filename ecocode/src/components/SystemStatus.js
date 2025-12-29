import React, { useState, useEffect } from 'react';
import '../index.css'; 

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:5000';

const SystemStatus = () => {
    const [status, setStatus] = useState('offline');
    const [statusMessage, setStatusMessage] = useState('Checking...');
    const [dataTime, setDataTime] = useState('');

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await fetch(`${BACKEND_URL}/`);
                if (response.ok) {
                    const data = await response.json();
                    setStatus('online');
                    setStatusMessage(`API Ready. Models Loaded: ${data.models_loaded ? '✅' : '❌'}`);
                    setDataTime(new Date().toLocaleTimeString());
                } else {
                    setStatus('error');
                    setStatusMessage(`API Error (Status ${response.status})`);
                }
            } catch (error) {
                setStatus('offline');
                setStatusMessage('Backend Unreachable');
            }
        };

        // Check immediately and then poll every 10 seconds
        checkStatus();
        const interval = setInterval(checkStatus, 10000); 
        
        return () => clearInterval(interval);
    }, []);

    const indicatorColor = 
        status === 'online' ? '#28A745' :
        status === 'error' ? '#FFC107' :
        '#DC3545';

    return (
        <div className="system-status-bar">
            <div className="status-item">
                <span className="status-indicator" style={{ backgroundColor: indicatorColor }}></span>
                System Status: <strong style={{ color: indicatorColor }}>{status.toUpperCase()}</strong>
            </div>
            <div className="status-item">
                {statusMessage}
            </div>
            <div className="status-item data-timestamp">
                Data Fetch Time: {dataTime}
            </div>
        </div>
    );
};

export default SystemStatus;