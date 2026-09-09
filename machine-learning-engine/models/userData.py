from pydantic import BaseModel; 


class userInputs(BaseModel): 
  is_new_user: int
  txn_unusual_location: int
  txn_unusual_time: int
  txn_unusual_amount: int
  device_changed : int
  ip_mismatch: int
  has_multiple_anomalies: int
  sim_device_change: int
  account_takeover_risk: int
  fraud_detected: int
  was_reversed: int
  was_reported: int
  fraud_account_takeover: int
  platform_mtn_momo: int
  txn_cash_in:int
  txn_cash_out: int
  victim_vulnerability: int
  detection_score: int
