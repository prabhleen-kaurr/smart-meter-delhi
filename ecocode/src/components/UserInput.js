import React, { useState } from 'react';
import '../index.css'; 

const ZONES = [
  { id: 'Zone_A', name: 'West Delhi' },
  { id: 'Zone_B', name: 'South Delhi' },
  { id: 'Zone_C', name: 'North Delhi' },
];

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:5000';

const UserInput = ({ onSubmissionSuccess }) => {
  const [consumerCode, setConsumerCode] = useState('');
  const [units, setUnits] = useState('');
  const [zoneId, setZoneId] = useState('Zone_A');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!units || !zoneId || !consumerCode) return;

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/submit_consumption`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zone_id: zoneId,
          consumer_code: consumerCode,
          units_consumed: parseFloat(units),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('✅ Data Submitted! Routing back to the main system...');
        setTimeout(() => {
          onSubmissionSuccess();
        }, 1500);
      } else {
        setMessage(`❌ Error: ${data.details || data.error}`);
      }
    } catch (error) {
      setMessage(`❌ Network Error: Could not connect to backend.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel user-input-container">
      <h2 style={styles.heading}>Household Data Collection</h2>
      <p style={styles.subtext}>
        Submit your consumer code and monthly consumption (kWh) to simulate real-time data ingestion.
      </p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Consumer Code:</label>
          <input
            type="text"
            value={consumerCode}
            onChange={(e) => setConsumerCode(e.target.value)}
            required
            placeholder="e.g., DEL12345"
            style={styles.input}
            disabled={loading}
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Monthly Units (kWh):</label>
          <input
            type="number"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            required
            min="100"
            style={styles.input}
            disabled={loading}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Select Your Load Zone:</label>
          <select
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            required
            style={styles.input}
            disabled={loading}
          >
            {ZONES.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name} ({zone.id})
              </option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Submitting...' : 'Submit Data'}
        </button>
      </form>

      {message && <p className={message.startsWith('❌') ? 'error-message' : 'success-message'}>{message}</p>}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '500px',
    margin: '80px auto',
    textAlign: 'center',
  },
  heading: {
    fontSize: '1.8em',
    color: '#007BFF',
    marginBottom: '10px',
  },
  subtext: {
    color: '#6C757D',
    marginBottom: '30px',
  },
  form: {
    textAlign: 'left',
    padding: '20px',
    border: '1px solid #EEE',
    borderRadius: '6px',
    background: '#F9F9F9',
  },
  inputGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    fontWeight: 'bold',
    color: '#343A40',
  },
  input: {
    width: '100%',
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#28A745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.2s',
  },
  message: {
    marginTop: '20px',
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #28A745',
    color: '#28A745',
    background: '#E6F4EA',
    textAlign: 'left',
  },
};

export default UserInput;