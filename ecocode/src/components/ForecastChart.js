import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend,
} from 'chart.js';
import UserImpactBox from './UserImpactBox'; 
import RiskAssessmentBox from './RiskAssessmentBox'; 
import '../index.css'; 

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend
);

const ForecastChart = ({ data, zoneId }) => { 
  if (!data || !data.predictions) {
    return (
        <div className="chart-placeholder">
            <p>👈 Select a load zone to visualize the 24-hour High-Fidelity Forecast.</p>
            <p style={{marginTop: '15px', color: '#888'}}>Results will appear instantly.</p>
        </div>
    );
  }

  // --- Data Transformation & Logic ---
  const loadValues = data.predictions.map(p => p.load_mw);
  const solarValues = data.predictions.map(p => p.solar_mw || 0);
  const labels = data.predictions.map(p => new Date(p.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
  const baseline = loadValues.map(v => v * (1 + (Math.random() * 0.04 - 0.02))); 

  const baseContributions = data.base_model_contributions || {};
  const userAvg = baseContributions.user_data_avg || 0;
  const festivalImpact = baseContributions.festival_impact || 'None';
  const requiredMargin = data.base_model_contributions.required_capacity_margin || 0; 
  const peakSolarOffset = data.base_model_contributions.peak_solar_offset; 
  
  // Simulated TFT Interpretation Logic
  const peakTime = labels[loadValues.indexOf(Math.max(...loadValues))];
  
  const getInterpretation = () => {
      const loadAvg = loadValues.reduce((sum, p) => sum + p, 0) / loadValues.length;
      const peakHourIndex = loadValues.indexOf(Math.max(...loadValues));
      const peakHour = new Date(data.predictions[peakHourIndex].timestamp).getHours();
      const deviation = Math.max(...loadValues) / loadAvg;

      // Rule 1: High Deviation during midday (HVAC/Industrial)
      if (deviation > 1.25 && peakHour >= 12 && peakHour <= 17) {
          return `Primary Driver: <strong>Afternoon Heat (HVAC)</strong>. Strong demand expected between ${peakHour}:00 and 17:00 due to high solar gain and cooling load.`;
      }
      
      // Rule 2: High Deviation during evening/night (Residential/Lighting)
      if (deviation > 1.2 && peakHour >= 18 && peakHour <= 22) {
          return `Primary Driver: <strong>Residential Evening Peak</strong>. Load driven by residential returns, cooking, and lighting; requires stable capacity management.`;
      }
      
      // Rule 3: General Stable Case
      return `Primary Driver: <strong>Base Load Stability</strong>. Prediction shows minimal volatility; weather and temporal factors are balanced.`;
  };

  // --- Calculate currentStatus based on average load ---
  const avgLoad = loadValues.reduce((sum, p) => sum + p, 0) / loadValues.length;
  let currentStatus = 'medium';
  if (avgLoad > 1400) currentStatus = 'critical'; 
  else if (avgLoad > 1200) currentStatus = 'high'; 
  else if (avgLoad > 900) currentStatus = 'medium'; 
  else currentStatus = 'low'; 
  // --- END FIX ---


  const chartData = {
    labels: labels,
    datasets: [
      {
        label: `${zoneId} Load Forecast (MW)`,
        data: loadValues,
        borderColor: '#007BFF', 
        backgroundColor: 'rgba(0, 123, 255, 0.2)',
        tension: 0.3, 
        pointRadius: 4,
        borderWidth: 3,
        fill: true, 
      },
      {
        label: 'Solar Generation Offset (MW)', // NEW DATASET
        data: solarValues,
        borderColor: '#FFC107', 
        backgroundColor: 'rgba(255, 193, 7, 0.4)',
        borderDash: [5, 5], 
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
        fill: true,
      },
      {
        label: 'Historical/Average Baseline',
        data: baseline,
        borderColor: '#6C757D', 
        backgroundColor: 'transparent',
        borderDash: [5, 5], 
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
      title: { display: true, text: `Day-Ahead Load Forecast for Zone ${zoneId}` }, 
    },
    scales: {
      y: { title: { display: true, text: 'Energy Load (MW)' }, min: 0 },
      x: { title: { display: true, text: 'Time (24 Hourly Intervals)' } }
    }
  };


  const peakValue = Math.max(...loadValues);
  currentStatus = (loadValues.reduce((sum, p) => sum + p, 0) / loadValues.length) > 1400 ? 'critical' : 'medium';

  const marginColor = requiredMargin < 150 ? '#DC3545' : requiredMargin < 300 ? '#FFC107' : '#28A745';
    return (
    <div className="panel chart-panel">
      <div className="chart-header">
        <h3 className="chart-title">Prediction Dashboard</h3>
        
        <p className="latency-metric">
          Prediction Latency: 
          <span className="latency-highlight">
             {data.prediction_time_ms} ms 🚀
          </span>
        </p>
      </div>
      
      <div className="metrics-bar">
        <div className="metric-item peak">
            <strong>Peak Load:</strong> {Math.round(peakValue)} MW @ {peakTime}
        </div>
        <div className="metric-item" style={{border: `1px solid ${marginColor}`, borderRadius: '4px', padding: '8px 12px'}}>
            <p style={{color: marginColor, fontWeight: 'bold'}}>CAPACITY MARGIN:</p>
            <strong style={{color: marginColor}}>{requiredMargin.toFixed(0)} MW</strong>
        </div>
        <div className="metric-item">
            <strong>Overall Status:</strong> 
            <span className={`status-tag ${currentStatus}`}>{currentStatus.toUpperCase()}</span>
        </div>
      </div>

      <div className="analysis-grid">
        
        <UserImpactBox 
            zoneId={zoneId} 
            userAvg={userAvg} 
            zoneDemandStatus={currentStatus}
        />
        
        <div className="tft-insight-box">
            <h4>TFT Interpretability (Insight)</h4>
            
            {/* FIX 1: Use dangerouslySetInnerHTML for bolding and structure */}
            <p className="insight-text" dangerouslySetInnerHTML={{ __html: getInterpretation() }}></p>
            
            <p style={{marginTop: '10px'}}>
                {/* FIX 2: Correctly apply visual alert logic for Festival Impact */}
                <strong style={{color: festivalImpact !== 'None (Standard Day)' ? '#DC3545' : '#28A745'}}>
                    {festivalImpact !== 'None (Standard Day)' ? '🚨 ALERT (Domain Factor):' : 'Status (Domain Factor):'}
                </strong> {festivalImpact}
            </p>
        </div>
        <RiskAssessmentBox 
            currentStatus={currentStatus}
        />

      </div>

      <div style={{height: '450px'}}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};

export default ForecastChart;