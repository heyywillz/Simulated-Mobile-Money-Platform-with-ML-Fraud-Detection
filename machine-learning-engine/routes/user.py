from fastapi import APIRouter

from models.userData import userInputs
from schema.user import serialize, serializers

import os
import pickle

user = APIRouter()

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "model.sav")
with open(MODEL_PATH, "rb") as file:
  model = pickle.load(file)

print("model_type", type(model))

def calibrate_prediction(base_pred: float, user_input: dict):
    """
    Intelligent domain calibration layer tailored to the project's two focal scopes:
    1. Account Takeover (ATOD): Device Changed + Impossible Location Jump
    2. Abnormal Transaction: Sudden high-volume outflow spike (e.g. 10, 10, 30000)
    """
    device_changed = int(user_input.get("device_changed", 0)) == 1
    unusual_location = int(user_input.get("txn_unusual_location", 0)) == 1
    unusual_amount = int(user_input.get("txn_unusual_amount", 0)) == 1
    sim_change = int(user_input.get("sim_device_change", 0)) == 1
    atod_risk = (
        int(user_input.get("account_takeover_risk", 0)) == 1 or
        int(user_input.get("fraud_account_takeover", 0)) == 1
    )

    is_atod = (device_changed and unusual_location) or atod_risk or (device_changed and sim_change)
    is_amount_anomaly = unusual_amount

    calibrated_score = float(base_pred)
    reason = "base_xgboost_inference"

    # Case 1: Compound Threat (Account Takeover + Abnormal Amount Draining)
    if is_atod and is_amount_anomaly:
        calibrated_score = max(calibrated_score, 18.6 + min(1.1, (base_pred - 3.0) * 0.1))
        reason = "compound_atod_and_outflow_anomaly"

    # Case 2: Scope 1 - Account Takeover (Device Change + Location Jump)
    elif is_atod:
        calibrated_score = max(calibrated_score, 16.3 + min(1.7, (base_pred - 3.0) * 0.2))
        reason = "account_takeover_detected"

    # Case 3: Scope 2 - Abnormal Transaction Outflow Spike (e.g. 10, 10, 30000)
    elif is_amount_anomaly:
        calibrated_score = max(calibrated_score, 15.2 + min(2.1, (base_pred - 3.0) * 0.2))
        reason = "abnormal_amount_spike_detected"

    # Case 4: Single isolated partial triggers (Device alone or Location alone)
    elif device_changed and not unusual_location:
        calibrated_score = max(calibrated_score, 7.8)
        reason = "unrecognized_device_alert"

    elif unusual_location and not device_changed:
        calibrated_score = max(calibrated_score, 7.3)
        reason = "unusual_location_travel_alert"

    final_score = max(3.0, min(20.0, calibrated_score))
    return final_score, reason

@user.post('/')
async def predict_fraud(user: userInputs): 
  user_input = serialize(user)
  list_output = list(user_input.values())
  raw_prediction = float(model.predict([list_output])[0])

  calibrated_score, calibration_reason = calibrate_prediction(raw_prediction, user_input)
  print(f"[ML Engine] Base Score: {raw_prediction:.2f} -> Calibrated: {calibrated_score:.2f} ({calibration_reason})")

  return {
    "fraud_risk_score": calibrated_score,
    "base_ml_score": raw_prediction,
    "calibrated": calibrated_score != raw_prediction,
    "calibration_reason": calibration_reason,
  }



