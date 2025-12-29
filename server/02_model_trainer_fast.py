import pandas as pd
import joblib
import os
from darts import TimeSeries
from darts.models import BlockRNNModel, TFTModel, RegressionEnsembleModel
from sklearn.linear_model import Ridge
from dotenv import load_dotenv

load_dotenv()

# --- Configuration (Adjusted for Speed) ---
DATA_FILE = 'master_load_weather_data.csv'
MODEL_DIR = 'models/'
ZONES = ['Zone_A', 'Zone_B', 'Zone_C']
FORECAST_HORIZON = 24
INPUT_CHUNK_LENGTH = 72
N_EPOCHS = 3
RANDOM_STATE = 42

# --- Data Loading and Preparation ---

def load_and_prepare_data():
    df = pd.read_csv(DATA_FILE, index_col=0, parse_dates=True)
    all_series = {}
    
    COVARIATE_COLS = ['temp_C', 'humidity', 'wind_speed', 'hour', 'day_of_week', 'is_weekend']
    
    for zone in ZONES:
        zone_df = df[df['zone_id'] == zone].copy()
        
        target_series = TimeSeries.from_dataframe(zone_df, value_cols='load_MW')
        
        covariate_series = TimeSeries.from_dataframe(zone_df, value_cols=COVARIATE_COLS)
        
        split_point = len(target_series) - FORECAST_HORIZON * 2
        
        all_series[zone] = {
            'target': target_series[:split_point],
            'covariates': covariate_series[:split_point],
            'val_target': target_series[split_point:],
            'val_covariates': covariate_series[split_point:]
        }
    return all_series

# --- Model Definition and Training ---

def create_base_learner(model_type, zone_name):
    
    pl_trainer_kwargs = {'accelerator': 'cpu', 'enable_progress_bar': False} 
    
    common_params = {
        'input_chunk_length': INPUT_CHUNK_LENGTH,
        'output_chunk_length': FORECAST_HORIZON,
        'n_epochs': N_EPOCHS,
        'batch_size': 32,
        'random_state': RANDOM_STATE,
        'model_name': f'BASE_MODEL_TEMPLATE', 
        'force_reset': True,
        'pl_trainer_kwargs': pl_trainer_kwargs
    }

    if model_type == 'LSTM':
        lstm_params = common_params.copy()
        lstm_params['model_name'] = f'LSTM_{zone_name}_fast'
        return BlockRNNModel(model='LSTM', n_rnn_layers=1, hidden_dim=32, **lstm_params)
    
    elif model_type == 'BiLSTM':
        def create_lstm_model(name_suffix):
            model_specific_params = common_params.copy()
            model_specific_params['model_name'] = f'BiLSTM_sim_{zone_name}_{name_suffix}'
            
            return BlockRNNModel(
                model='LSTM', 
                n_rnn_layers=1, 
                hidden_dim=32, 
                **model_specific_params
            )
        
        return [create_lstm_model('fwd'), create_lstm_model('bwd')]
        
    elif model_type == 'TFT':
        tft_params = common_params.copy()
        tft_params['model_name'] = f'TFT_{zone_name}_fast'
        return TFTModel(hidden_size=32, lstm_layers=1, num_attention_heads=2, **tft_params)
    
    else:
        raise ValueError(f"Unknown model type: {model_type}")

def train_and_save_ensemble(zone, data):
    
    base_learners_to_create = ['LSTM', 'BiLSTM', 'TFT']
    trained_models = []
    
    for model_type in base_learners_to_create:
        
        model_or_list = create_base_learner(model_type, zone)
        
        if isinstance(model_or_list, list):
            for model in model_or_list:
                print(f"  Training Simulated BiLSTM Component ({model.model_name})...")
                model.fit(
                    series=data['target'],
                    past_covariates=data['covariates'],
                    future_covariates=data['covariates']
                )
                trained_models.append(model)
        else:
            model = model_or_list
            print(f"  Training {model_type}...")
            model.fit(
                series=data['target'],
                past_covariates=data['covariates'],
                future_covariates=data['covariates']
            )
            trained_models.append(model)

    stacking_model = RegressionEnsembleModel(
        forecasting_models=trained_models,
        regression_model=Ridge(random_state=RANDOM_STATE),
        regression_train_n_points=FORECAST_HORIZON,
        train_forecasting_models=False 
    )

    print("  Training Ridge Meta-Learner...")
    stacking_model.fit(
        series=data['target'],
        past_covariates=data['covariates'],
        future_covariates=data['covariates'],
    )
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_dir_path = os.path.join(script_dir, MODEL_DIR)
    
    if not os.path.exists(model_dir_path):
        os.makedirs(model_dir_path)
        
    joblib.dump(stacking_model, os.path.join(model_dir_path, f'ensemble_model_{zone}.pkl'))
    print(f"  ✅ Ensemble Model saved for {zone}. (Total models stacked: {len(trained_models)})")

# --- Main Execution ---

if __name__ == '__main__':
    DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), DATA_FILE)
    
    if not os.path.exists(DATA_PATH):
        print(f"ERROR: Data file '{DATA_FILE}' not found at {DATA_PATH}. Run '01_data_collector.py' first.")
    else:
        all_data = load_and_prepare_data()
        for zone in ZONES:
            train_and_save_ensemble(zone, all_data[zone])