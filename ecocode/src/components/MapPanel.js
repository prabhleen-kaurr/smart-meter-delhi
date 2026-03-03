import React, { useState, useEffect, useMemo } from 'react';
import { fetchForecast } from '../api';
import ZoneMapDisplay from './ZoneMapDisplay'; 
import '../index.css'; 

const ZONES = [
  { id: 'Zone_A', name: 'West Delhi', color: '#007BFF' },
  { id: 'Zone_B', name: 'South Delhi', color: '#28A745' },
  { id: 'Zone_C', name: 'North Delhi', color: '#DC3545' },
];

const MapPanel = ({ setForecastData, setZoneId, forecastData }) => {
  const [loading, setLoading] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const [viewMode, setViewMode] = useState('buttons'); 

  const handleForecastFetch = async (zoneId) => {
    setLoading(true);
    setSelectedZone(zoneId);
    setZoneId(zoneId);
    setForecastData(null); 

    try {
      const apiResponse = await fetchForecast(zoneId);
      
      if (!apiResponse.error) {
        setForecastData(apiResponse);
      } else {
        console.error(`Backend Error for ${zoneId}:`, apiResponse.details);
        setForecastData({ error: true, message: apiResponse.details || "Backend crash, check server terminal." });
      }
    } catch (e) {
      console.error(`Fatal Network Failure: ${e.message}`);
      setForecastData({ error: true, message: e.message || "Network connection failed." });
    } finally {
      setLoading(false);
    }
  };

  const getDemandStatus = () => {
    if (forecastData && forecastData.predictions) {
      const avgLoad = forecastData.predictions.reduce((sum, p) => sum + p.load_mw, 0) / forecastData.predictions.length;
      if (avgLoad > 1400) return 'CRITICAL';
      if (avgLoad > 1000) return 'HIGH';
      return 'MEDIUM';
    }
    return 'STANDBY';
  };
  
  const currentStatus = getDemandStatus();


  const renderContent = () => {
    if (viewMode === 'map') {
      return (
        <ZoneMapDisplay
          onZoneSelect={handleForecastFetch}
          loading={loading}
          forecastData={forecastData}
          selectedZoneId={selectedZone}
        />
      );
    }
    
    return (
      <div className="zone-container">
        <p className="panel-subtext">Click a button to generate the 24-hour prediction:</p>
        {ZONES.map((zone) => (
          <button
            key={zone.id}
            onClick={() => handleForecastFetch(zone.id)}
            disabled={loading}
            className={`zone-button ${selectedZone === zone.id ? 'active' : ''}`}
            style={{
              backgroundColor: zone.color,
              border: selectedZone === zone.id ? '3px solid #FFC107' : 'transparent',
            }}
          >
            {loading && selectedZone === zone.id ? 'ANALYZING...' : zone.name}
          </button>
        ))}
      </div>
    );
  };


  return (
    <div className="panel map-panel">
      <h3 className="panel-heading">
        {viewMode === 'map' ? 'Geospatial Load Map' : 'Direct Zone Selection'}
      </h3>
      
      <div className="view-switcher">
        <button 
            className="switcher-button" 
            onClick={() => setViewMode(viewMode === 'buttons' ? 'map' : 'buttons')}
        >
            {viewMode === 'buttons' ? 'VIEW MAP' : 'VIEW BUTTONS'}
        </button>
      </div>

      {renderContent()}
      
      <div className="bottom-status">
        <p style={{ fontWeight: 'bold' }}>Current Demand Status:</p>
        <span className={`status-tag ${currentStatus.toLowerCase()}`}>
            {currentStatus}
        </span>
      </div>

      {loading && (
        <div className="loading-box">
          <div className="spinner"></div>
          <p className="loading-text">Executing core ensemble prediction...</p>
        </div>
      )}
    </div>
  );
};

export default MapPanel;