import pandas as pd
import numpy as np
import requests
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
import pytz
from datetime import datetime

IST = pytz.timezone('Asia/Kolkata')

load_dotenv()

ZONES = {'Zone_A': (28.632, 77.218), 'Zone_B': (28.524, 77.185), 'Zone_C': (28.704, 77.102)}
API_KEYS = {
    'GROQ_API_KEY': os.environ.get('GROQ_API_KEY', 'YOUR_GROQ_API_KEY_IS_MISSING'),
    'OPEN_METEO_KEY': os.environ.get('OPEN_METEO_KEY', 'NO_KEY_NEEDED_FOR_FREE_TIER')
}
OUTPUT_FILE = 'master_load_weather_data.csv'
HISTORICAL_DAYS = 90


def fetch_historical_open_meteo(lat, lon, days=HISTORICAL_DAYS):
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    url = f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}&start_date={start_date.strftime('%Y-%m-%d')}&end_date={end_date.strftime('%Y-%m-%d')}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m"
    
    try:
        print(f"    Attempting fetch for Lat={lat}, Lon={lon}...")
        response = requests.get(url, timeout=15).json() 
    except requests.exceptions.RequestException as e:
        print(f"    ❌ Network Error/Timeout fetching data: {e}")
        return pd.DataFrame()

    if 'hourly' not in response:
        print("    ❌ API response did not contain 'hourly' data. Using dummy data.")
        return pd.DataFrame()

    hourly = response['hourly']
    df = pd.DataFrame({
        'timestamp': datetime.now(IST),
        'temp_C': hourly['temperature_2m'],
        'humidity': hourly['relative_humidity_2m'],
        'wind_speed': hourly['wind_speed_10m']
    })
    
    print("    ✅ Data fetch complete.")
    return df.set_index('timestamp')

def generate_synthetic_load(df_weather):
    if df_weather.empty:
        return pd.Series(np.random.rand(HISTORICAL_DAYS * 24) * 1000)

    base_load = 500
    temp_factor = (df_weather['temp_C'] * 15)
    daily_cycle = 100 * np.sin(2 * np.pi * df_weather.index.hour / 24)
    noise = np.random.randn(len(df_weather)) * 20
    
    load = base_load + temp_factor + daily_cycle + noise
    return load.rename('load_MW')

if __name__ == '__main__':
    
    print("--- ZEDF Data Collector: Starting ---")
    all_zone_data = []
    
    for zone, (lat, lon) in ZONES.items():
        print(f"\nProcessing Zone: {zone}")
        
        weather_df = fetch_historical_open_meteo(lat, lon, days=HISTORICAL_DAYS)
        load_series = generate_synthetic_load(weather_df)
        
        if not weather_df.empty:
            df = pd.concat([load_series, weather_df], axis=1).dropna()
        else:
            df = pd.DataFrame({'load_MW': load_series, 
                               'temp_C': np.random.rand(len(load_series)) * 20 + 25})
            df['zone_id'] = zone
            df = df.set_index(load_series.index)
        
        df['hour'] = df.index.hour
        df['day_of_week'] = df.index.dayofweek
        df['is_weekend'] = df.index.dayofweek >= 5
        df['zone_id'] = zone
        all_zone_data.append(df)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    save_path = os.path.join(script_dir, OUTPUT_FILE) 

    master_df = pd.concat(all_zone_data)
    
    try:
        master_df.to_csv(save_path)
        print(f"\n✅ Master data saved successfully to: {save_path}")
    except Exception as e:
        print(f"\n❌ FATAL ERROR: Could not save file. Details: {e}")
        print("Check directory permissions or ensure the script is in a writable folder.")