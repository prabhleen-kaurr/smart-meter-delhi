import React from 'react';
import '../index.css'; 


const BASELINE_KWH = 800; 

const UserImpactBox = ({ zoneId, userAvg, zoneDemandStatus }) => {
    const safeUserAvg = userAvg || 0;
    // Calculate the difference and percentage change
    const avgDelta = safeUserAvg - BASELINE_KWH;
    const percentDelta = (avgDelta / BASELINE_KWH) * 100;
    
    // Determine the color class for the percentage display
    const deltaClass = percentDelta > 5 ? 'alert-high' : percentDelta < -5 ? 'alert-low' : 'alert-neutral';
    
    // Determine the descriptive message
    let message = '';
    if (percentDelta > 15) {
        message = 'Critical zonal data deviation detected.';
    } else if (percentDelta > 5) {
        message = 'High usage detected. Essential for accurate forecasting.';
    } else if (percentDelta < -5) {
        message = 'Low usage trend observed. Requires less contingency power.';
    } else {
        message = 'Usage is stable and close to the standard baseline.';
    }

    return (
        <div className="impact-box">
            <h4>User Data Contribution</h4>
            <p className="impact-value">{safeUserAvg.toFixed(1)} kWh/Month</p>
            
            <div style={{marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #cce5ff'}}>
                <p style={{fontSize: '0.9em', color: '#666', fontWeight: 'bold'}}>vs. Aggregate Baseline (800 kWh):</p>
                
                <p className={deltaClass} style={{fontSize: '1.2em'}}>
                    {/* Display the arrow and percentage difference */}
                    {percentDelta >= 0 ? '▲' : '▼'} {Math.abs(percentDelta).toFixed(1)}%
                </p>
                <p style={{color: '#666', marginTop: '5px'}}>{message}</p>
            </div>
            
        </div>
    );
};

export default UserImpactBox;