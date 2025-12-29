import React from 'react';
import '../index.css'; 

const RISK_FACTORS = [
    { name: "Transformer Burnouts", threshold: 'critical' },
    { name: "Cable Bursts and Underground Faults", threshold: 'high' },
    { name: "Feeder Overload and Tripping", threshold: 'high' },
    { name: "Grid Instability due to Demand Surges", threshold: 'critical' },
];

const RiskAssessmentBox = ({ currentStatus }) => {
    // Determine overall risk level (High, Medium, or Low)
    const isCritical = currentStatus === 'critical';
    const isHigh = currentStatus === 'high';

    const getRiskLevel = (factorThreshold) => {
        if (factorThreshold === 'critical' && isCritical) return 'High Risk';
        if (factorThreshold === 'high' && (isCritical || isHigh)) return 'Medium Risk';
        return 'Low Risk';
    };

    const getRiskColor = (riskLevel) => {
        if (riskLevel === 'High Risk') return '#DC3545'; // Red
        if (riskLevel === 'Medium Risk') return '#FFC107'; // Yellow
        return '#28A745'; // Green
    };

    return (
        <div className="risk-assessment-box">
            <h4>Proactive Risk Assessment</h4>
            <ul style={styles.ul}>
                {RISK_FACTORS.map((factor, index) => {
                    const riskLevel = getRiskLevel(factor.threshold);
                    const riskColor = getRiskColor(riskLevel);

                    return (
                        <li key={index} style={styles.li}>
                            <span style={{ ...styles.indicator, backgroundColor: riskColor }}></span>
                            <span style={styles.riskName}>{factor.name}</span>
                            <span style={{ ...styles.riskTag, color: riskColor, borderColor: riskColor }}>{riskLevel}</span>
                        </li>
                    );
                })}
            </ul>
            <p style={styles.note}>
                *Risk level is dynamically simulated based on current forecast demand status.
            </p>
        </div>
    );
};

const styles = {
    ul: {
        listStyle: 'none',
        padding: 0,
        margin: '10px 0 0 0',
    },
    li: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '5px 0',
        borderBottom: '1px dotted #eee',
    },
    indicator: {
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        marginRight: '10px',
    },
    riskName: {
        flexGrow: 1,
        fontSize: '0.9em',
    },
    riskTag: {
        padding: '2px 6px',
        fontSize: '0.75em',
        borderRadius: '3px',
        border: '1px solid',
        fontWeight: 'bold',
    },
    note: {
        fontSize: '0.7em',
        color: '#6C757D',
        marginTop: '10px',
    }
};

export default RiskAssessmentBox;