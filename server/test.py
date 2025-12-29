import pandas as pd
import os

DATA_FILE = 'master_load_weather_data.csv'
USER_DATA_FILE = 'user_consumption.csv'

# --- 1. Load and Display Load/Weather Data ---
print("\n--- MASTER LOAD/WEATHER DATA (Input for Forecasting Model) ---")
try:
    df_master = pd.read_csv(DATA_FILE, index_col=0, parse_dates=True)
    print(f"Total rows: {len(df_master)}")
    print("Columns: ", df_master.columns.tolist())
    # Display the first and last 3 rows to show continuity and feature values
    # To show ALL rows of the master data:
    print(df_master.to_markdown(numalign="left", stralign="left"))

except FileNotFoundError:
    print(f"ERROR: File {DATA_FILE} not found. Run 01_data_collector.py first.")


# --- 2. Load and Display User Submission Data ---
print("\n--- USER SUBMISSION DATA (Input for Averaging) ---")
try:
    df_user = pd.read_csv(USER_DATA_FILE)
    print(f"Total user submissions: {len(df_user)}")
    # Display the entire user data table
    print(df_user.to_markdown(numalign="left", stralign="left"))

except FileNotFoundError:
    print(f"ERROR: File {USER_DATA_FILE} not found. Run app.py once to initialize it.")