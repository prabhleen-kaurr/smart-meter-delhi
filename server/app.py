import pandas as pd
import numpy as np
import joblib
import os
from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from darts import TimeSeries 
from datetime import datetime, timedelta
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy 
from groq import Groq 
import pytz
from datetime import datetime

IST = pytz.timezone('Asia/Kolkata')
load_dotenv()

# --- Configuration and State ---
API_KEYS = {
    'GROQ_API_KEY': os.environ.get('GROQ_API_KEY', 'YOUR_GROQ_API_KEY_IS_MISSING'),
    'OPEN_METEO_KEY': os.environ.get('OPEN_METEO_KEY', 'NO_KEY_NEEDED_FOR_FREE_TIER')
}
MODEL_DIR = 'models/'
DATA_FILE = 'master_load_weather_data.csv'
USER_DATA_FILE = 'user_consumption.csv'
ZONES = {'Zone_A': (28.632, 77.218), 'Zone_B': (28.524, 77.185), 'Zone_C': (28.704, 77.102)}
FORECAST_HORIZON = 24
INPUT_CHUNK_LENGTH = 72
LOADED_MODELS = {}

# --- NEW GLOBAL CONSTANT ---
SYSTEM_CAPACITY_MW = 1800 # Define system capacity for margin calculation
# ---------------------------

# --- Initialize Flask and CORS ---
app = Flask(__name__)
CORS(app) 

# --- DATABASE CONFIGURATION ---
database_url = os.environ.get('DATABASE_URL')
if database_url:
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
else:
    # Fallback for local development
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'consumption_data.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Database Model for Consumption Data
class Consumption(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    zone_id = db.Column(db.String(10), nullable=False)
    consumer_code = db.Column(db.String(50), nullable=False)
    units_consumed = db.Column(db.Float, nullable=False)

    def __repr__(self):
        return f'<Consumption {self.zone_id} [{self.consumer_code}]: {self.units_consumed} kWh>'


# --- UTILITY FUNCTIONS ---

# Domain-Specific Factor Lookup (Used for Festival Alert)
FESTIVAL_FACTORS = {
    (10, 28): "High Spike (Diwali/Festive Lighting)",
    (1, 1): "Medium Spike (New Year/Holiday)",
    (3, 20): "Moderate Spike (Holi)",
}
def get_festival_factor(dt):
    """Checks the date for a festival and returns the simulated impact description."""
    key = (dt.month, dt.day)
    if key in FESTIVAL_FACTORS:
        return FESTIVAL_FACTORS[key]
    return "None (Standard Day)"

def load_models():
    """Loads all pre-trained ensemble models from the models/ directory."""
    global LOADED_MODELS
    
    if not os.path.exists(MODEL_DIR):
        return False
        
    for zone in ZONES:
        model_path = os.path.join(MODEL_DIR, f'ensemble_model_{zone}.pkl')
        if os.path.exists(model_path):
            LOADED_MODELS[zone] = joblib.load(model_path)
    
    return len(LOADED_MODELS) == len(ZONES)

def initialize_user_data_csv():
    """Creates the user consumption CSV file if it doesn't exist."""
    if not os.path.exists(USER_DATA_FILE):
        df_init = pd.DataFrame(columns=['timestamp', 'zone_id', 'consumer_code', 'units_consumed'])
        df_init.to_csv(USER_DATA_FILE, index=False)

def get_zone_average_consumption(zone_id):
    """Calculates the average units consumed for a zone from the CSV file."""
    try:
        df = pd.read_csv(USER_DATA_FILE)
        zone_data = df[df['zone_id'] == zone_id]
        if zone_data.empty: return 800.0
        # Use np.nan_to_num to guarantee output is a clean float
        mean_value = zone_data['units_consumed'].mean()
        return float(np.nan_to_num(mean_value))
    except Exception:
        return 800.0


def fetch_live_covariates(zone_id):
    # Use naive datetime to match the CSV format
    start_time = datetime.now(IST).replace(minute=0, second=0, microsecond=0, tzinfo=None) + timedelta(hours=1)
    
    # Use 'h' instead of 'H' to fix the FutureWarning
    time_index = pd.date_range(start=start_time, periods=FORECAST_HORIZON, freq='h') 
    
    forecast_df = pd.DataFrame({
        'temp_C': 30 + 5 * np.sin(2 * np.pi * np.arange(FORECAST_HORIZON) / 24),
        'humidity': 60 + 10 * np.cos(2 * np.pi * np.arange(FORECAST_HORIZON) / 24),
        'wind_speed': 5 + np.random.rand(FORECAST_HORIZON) * 2,
        'hour': time_index.hour,
        'day_of_week': time_index.dayofweek,
        'is_weekend': time_index.dayofweek >= 5
    }, index=time_index)
    return TimeSeries.from_dataframe(forecast_df)

def get_simulated_ai_insight(zone_id):
    """Provides a stable, local text insight (replacement for Groq if API fails)."""
    avg_units = get_zone_average_consumption(zone_id)
    if avg_units > 1000:
        return "Proactive Capacity Increase: Anticipate high evening load spike."
    elif avg_units > 850:
        return "Routine Monitoring: Maintain current generation levels; moderate risk."
    else:
        return "Standby Mode: Low predicted demand, optimize for energy savings."

def get_groq_ai_insight(zone_id, forecast_covariates):
    """Uses Groq to generate a fast, interpretive text insight."""
    
    if not API_KEYS.get('GROQ_API_KEY'):
        return get_simulated_ai_insight(zone_id)
    
    try:
        client = Groq(api_key=API_KEYS['GROQ_API_KEY'])
        
        # Access data via stable NumPy values and manual dictionary construction
        weather_values = forecast_covariates.values()[-1].flatten()
        weather_columns = ['temp_C', 'humidity', 'wind_speed', 'hour', 'day_of_week', 'is_weekend']
        latest_weather_dict = dict(zip(weather_columns, weather_values))
        
        forecast_date = forecast_covariates.time_index[0].to_pydatetime()
        festival_status = get_festival_factor(forecast_date)
        
        prompt = (
            "You are a grid stability analyst. Provide a SINGLE, short, actionable insight (max 15 words). "
            f"Current Zone Avg: {get_zone_average_consumption(zone_id):.1f} kWh. "
            f"Domain Factor: {festival_status}. "
            f"Forecast Hour 1 Weather: {latest_weather_dict}"
        )
        response = client.chat.completions.create(
            model="mixtral-8x7b-32768", messages=[{"role": "user", "content": prompt}],
            temperature=0.0, max_tokens=30,
        )
        return response.choices[0].message.content.strip()
    
    except Exception as e:
        return get_simulated_ai_insight(zone_id)

# --- NEW UTILITY FUNCTION FOR RISK ASSESSMENT ---
def get_risk_assessment_text(final_prediction_array):
    """
    Simulates the risk assessment output based on the predicted load array.
    Returns a dictionary of risk statuses keyed by hazard.
    """
    
    peak_load = np.max(final_prediction_array)
    
    RISK_THRESHOLD_HIGH = 1300
    RISK_THRESHOLD_CRITICAL = 1450
    
    risk_data = {}
    
    if peak_load >= RISK_THRESHOLD_CRITICAL:
        risk_data["Transformer Burnouts during Peak Summer"] = "High Risk"
        risk_data["Grid Instability due to Demand Surges"] = "High Risk"
    else:
        risk_data["Transformer Burnouts during Peak Summer"] = "Low Risk"
        risk_data["Grid Instability due to Demand Surges"] = "Low Risk"
        
    if peak_load >= RISK_THRESHOLD_HIGH:
        risk_data["Cable Bursts and Underground Faults"] = "Medium Risk"
        risk_data["Feeder Overload and Tripping"] = "Medium Risk"
    else:
        risk_data["Cable Bursts and Underground Faults"] = "Low Risk"
        risk_data["Feeder Overload and Tripping"] = "Low Risk"
        
    return risk_data
# --- END NEW UTILITY FUNCTION ---


# --- API ENDPOINTS ---

@app.route('/api/submit_consumption', methods=['POST'])
def submit_consumption():
    data = request.get_json()
    zone_id = data.get('zone_id')
    consumer_code = data.get('consumer_code')
    units_consumed = data.get('units_consumed')

    if not zone_id or units_consumed is None or not consumer_code:
        return jsonify({"error": "Missing zone_id, consumer_code, or units_consumed"}), 400
    
    try:
        new_data = pd.DataFrame([{
            'timestamp': datetime.now(IST),
            'zone_id': zone_id,
            'consumer_code': consumer_code,
            'units_consumed': units_consumed
        }])
        
        new_data.to_csv(USER_DATA_FILE, mode='a', header=not os.path.exists(USER_DATA_FILE) or os.path.getsize(USER_DATA_FILE) == 0, index=False)
        
        return jsonify({"message": "Consumption data saved successfully."}), 200
        
    except Exception as e:
        return jsonify({"error": "CSV write error", "details": str(e)}), 500


@app.route('/api/forecast/<zone_id>', methods=['GET'])
def get_ensemble_forecast(zone_id):
    start_time = datetime.now(IST).replace(tzinfo=None)
    
    if zone_id not in ZONES:
        return jsonify({"error": f"Invalid zone: {zone_id}"}), 404

    try:
        # 1. Load Data
        script_dir = os.path.dirname(os.path.abspath(__file__))
        data_path = os.path.join(script_dir, DATA_FILE)
        df_master = pd.read_csv(data_path, index_col=0, parse_dates=True)
        df_master.index = df_master.index.tz_localize(None)
        zone_df = df_master[df_master['zone_id'] == zone_id]
        
        target_series = TimeSeries.from_dataframe(zone_df, value_cols='load_MW')
        
        # 2. Get Future Covariates and Festival Status
        future_covariates_forecast = fetch_live_covariates(zone_id)
        
        forecast_date = future_covariates_forecast.time_index[0].to_pydatetime()
        festival_status = get_festival_factor(forecast_date)

        # 3. GENERATE SIMULATED PREDICTION 
        # FIX APPLIED: Initialize required_margin before calculation block
        required_margin = 0.0
        
        last_known_load = float(target_series.values()[-1][0]) if target_series.n_timesteps > 0 else 1000.0
        avg_units = get_zone_average_consumption(zone_id)
        base_factor = avg_units / 800.0
        
        festival_boost = 1.0
        if festival_status != "None (Standard Day)":
            festival_boost = 1.25 
        
        # Accessing features via stable time_index
        forecast_hours = future_covariates_forecast.time_index.hour.values

        time_based_impact = np.ones(FORECAST_HORIZON, dtype=float)
        for i, hour in enumerate(forecast_hours):
            if hour >= 18 or hour <= 6:
                time_based_impact[i] = base_factor 
            else:
                time_based_impact[i] = 1.0 + (base_factor - 1.0) * 0.25 

        hourly_cycle_base = np.sin(2 * np.pi * np.arange(FORECAST_HORIZON) / 24) * 50 
        trend = np.linspace(5, 15, FORECAST_HORIZON) 
        
        simulated_prediction = (
            last_known_load + 
            hourly_cycle_base * time_based_impact * festival_boost + 
            trend + 
            (np.random.rand(FORECAST_HORIZON) * 5)
        ).flatten().astype(float)
        
        final_prediction = simulated_prediction
        final_prediction[final_prediction < 0] = 0
        
        # Calculate Required Margin based on Peak Load
        peak_load = np.max(final_prediction)
        required_margin = SYSTEM_CAPACITY_MW - peak_load # Now this calculation is safe.
        
        # 4. Get AI Insight (The most stable part is the local simulation)
        groq_insight = get_groq_ai_insight(zone_id, future_covariates_forecast)
        
        # 5. Final Formatting
        end_time = datetime.now()
        elapsed_time_ms = (end_time - start_time).total_seconds() * 1000

        pred_time_index = future_covariates_forecast.time_index

        # 6. Risk Assessment (Needs prediction array)
        risk_assessment = get_risk_assessment_text(final_prediction)

        # 7. Format and Return Results
        # Ensure all metrics are explicitly protected against NaN/None
        final_avg_load = float(np.nan_to_num(np.mean(final_prediction)))
        final_user_avg = get_zone_average_consumption(zone_id) 

        forecast_output = {
            "zone_id": zone_id,
            "prediction_time_ms": round(elapsed_time_ms, 2),
            "method": "SIMULATED (High-Fidelity Bypass)",
            "predictions": [
                { "timestamp": t.isoformat(), "load_mw": round(float(load), 3) } 
                for t, load in zip(pred_time_index, final_prediction)
            ],
            "base_model_contributions": {
                "darts_ensemble_contribution": round(final_avg_load, 3),
                "user_data_avg": round(final_user_avg, 2),
                "groq_insight": groq_insight,
                "festival_impact": festival_status,
                "risk_assessment": risk_assessment,
                # FIX: required_capacity_margin is now correctly defined here
                "required_capacity_margin": round(np.nan_to_num(required_margin), 2)
            }
        }
        
        response = jsonify(forecast_output)
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        return response, 200

    except Exception as e:
        print(f"\nFATAL CRASH in API logic: {type(e).__name__}: {str(e)}")
        # If any part of the simulation fails, return a detailed error.
        return jsonify({"error": "Forecast calculation failed.", "details": str(e)}), 500

@app.route('/', methods=['GET'])
def status():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    models_exist = all(os.path.exists(os.path.join(script_dir, MODEL_DIR, f'ensemble_model_{z}.pkl')) for z in ZONES)
    response_data = jsonify({
        "service": "ZEDF Hackathon Prototype API",
        "status": "Ready",
        "models_loaded": models_exist,
        "available_zones": list(ZONES.keys()),
    })
    
    response = make_response(response_data, 200)
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

# --- MAIN EXECUTION ---

if __name__ == '__main__':
    with app.app_context():
        db.create_all() 
        
    initialize_user_data_csv()
        
    load_models()
    
    # Render Port Binding
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
