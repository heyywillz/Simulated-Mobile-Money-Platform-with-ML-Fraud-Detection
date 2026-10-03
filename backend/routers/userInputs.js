const _ = require('lodash');
const { Router } = require('express');
const { validateUser, UserInputs } = require('../models/userInput');
const { authUser } = require('../auth/authUser');
const { locationRisk } = require('../utils/distance');
const { UserRegister } = require('../models/userRegister');
const { Case } = require('../models/case');
const { abNormalTransaction } = require('../utils/upNormalTransaction');
const axios = require('axios');

const userInputs = Router();

const default_inputs = {
  is_new_user: 0,
  txn_unusual_location: 0,
  txn_unusual_time: 0,
  txn_unusual_amount: 0,
  device_changed: 0,
  ip_mismatch: 0,
  has_multiple_anomalies: 0,
  sim_device_change: 0,
  account_takeover_risk: 0,
  fraud_detected: 0,
  was_reversed: 0,
  was_reported: 0,
  fraud_account_takeover: 0,
  platform_mtn_momo: 0,
  txn_cash_in: 0,
  txn_cash_out: 0,
  victim_vulnerability: 0,
  detection_score: 0,
};

userInputs.post('/', [authUser], async (req, res) => {
  const { id: userID } = req.user;
  console.log('userdecodded', req.user);

  // Normalize phone numbers to 233-XXXXXXXXX (9 digits after prefix)
  if (req.body.SenderPhone) {
    const cleanSender = String(req.body.SenderPhone).replace(/^\+?233|^0/, '').replace(/\D/g, '');
    req.body.SenderPhone = `233-${(cleanSender || '241234567').padEnd(9, '0').slice(0, 9)}`;
  }
  if (req.body.receiverPhone) {
    const cleanReceiver = String(req.body.receiverPhone).replace(/^\+?233|^0/, '').replace(/\D/g, '');
    req.body.receiverPhone = `233-${(cleanReceiver || '240000000').padEnd(9, '0').slice(0, 9)}`;
  }

  // validate userInputs
  const { error } = validateUser({ ...req.body, userID });
  console.log('error message', error);
  if (error) return res.status(400).json({ message: error.details[0].message });

  console.log('error', error);
  console.log('validated');

  try {
    const original_user = await UserRegister.findById(userID);
    if (!original_user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    if (original_user.status === 'frozen') {
      return res.status(403).json({
        message: 'Your account is frozen due to security flags. Transfers cannot be processed. Please contact fraud support or visit a service center with your Ghana Card.',
        isFrozen: true,
      });
    }

    // Check for rapid duplicate submission (idempotency defense within 4-second window)
    const recentDuplicate = await UserInputs.findOne({
      userID,
      amount: req.body.amount,
      SenderPhone: req.body.SenderPhone,
      receiverPhone: req.body.receiverPhone,
      createdAt: { $gte: new Date(Date.now() - 4000) },
    });
    if (recentDuplicate) {
      console.log('Duplicate transaction detected within 4s window. Returning existing transaction record.');
      return res.status(200).json({
        data: recentDuplicate,
        balance: original_user?.balance ?? null,
        status: { fraud_risk_score: parseFloat(recentDuplicate.fraudScore) || 0.05 },
        case: null,
        isDeducted: true,
      });
    }

    console.log('before', { ...req.body, userID });
    const rawChannel = String(req.body.channel || req.body.transactionType || req.body.reason || 'send_money').toLowerCase();
    let channel = 'send_money';
    if (rawChannel.includes('cash_out') || rawChannel.includes('cashout') || rawChannel.includes('withdraw')) {
      channel = 'cash_out';
    } else if (rawChannel.includes('cash_in') || rawChannel.includes('cashin') || rawChannel.includes('deposit')) {
      channel = 'cash_in';
    } else {
      channel = 'send_money';
    }

    const new_userInputs = await UserInputs.create({
      ...req.body,
      userID,
      channel,
      transactionType: channel,
      reason: channel,
    });
    console.log('after');

    const user_inputObject = { ...default_inputs };

    if (channel === 'cash_out') {
      user_inputObject['txn_cash_out'] = 1;
      user_inputObject['txn_cash_in'] = 0;
    } else if (channel === 'cash_in') {
      user_inputObject['txn_cash_in'] = 1;
      user_inputObject['txn_cash_out'] = 0;
    } else {
      user_inputObject['txn_cash_in'] = 0;
      user_inputObject['txn_cash_out'] = 0;
    }

    const user_transactions = await UserInputs.find({ userID: userID }).sort({
      createdAt: -1,
    });

    // new users
    if (user_transactions.length <= 1) {
      user_inputObject['is_new_user'] = 1;
    }

    // comaparing device transaction with -current_transaction device
    console.log('original_user', original_user);
    console.log('all users', new_userInputs.device, original_user.device);

    const reqDevice = String(new_userInputs.device || '').toLowerCase().trim();
    const userDevice = String(original_user.device || '').toLowerCase().trim();
    const isSameDevice =
      reqDevice === userDevice ||
      reqDevice.includes(userDevice) ||
      userDevice.includes(reqDevice) ||
      (reqDevice.startsWith('dev_') && userDevice.startsWith('dev_')) ||
      (reqDevice.includes('web') && userDevice.includes('web')) ||
      (reqDevice.includes('chrome') && userDevice.includes('chrome')) ||
      (reqDevice.includes('windows') && userDevice.includes('windows'));

    user_inputObject['device_changed'] = isSameDevice ? 0 : 1;

    // comparing with the previous transaction
    let [current, prev] = user_transactions.slice(0, 2);

    // first time transaction

    if (!prev) {
      try {
        prev = await UserRegister.findById(userID);
      } catch (error) {
        console.error(error?.message || error);
      }
    }

    // console.log('current', current, 'prev', prev);

    const difference_time =
      (new Date(current.createdAt) - new Date(prev.createdAt)) / (1000 * 60);

    console.log(
      prev.location['long'],
      current.location['long'],
      // prev.location?.lat,
      // prev.locaton?.long,
      // current.location?.lat,
      // current.location?.long,
      'user_transactions',

      prev.location,
      current.location,
    );

    const { lat: prev_lat, long: prev_long } = prev.location;

    const { lat: current_lat, long: current_long } = current.location;

    console.log('check all', prev_lat, prev_long, current_lat, current_long);
    const risk = locationRisk({
      previousLat: parseFloat(prev_lat),
      previousLong: parseFloat(prev_long),
      currentLat: parseFloat(current_lat),
      currentLong: parseFloat(current_long),
      minutesSincePreviousTransaction: difference_time,
    });

    console.log('risk', risk);

    const distKm = risk.distanceKm || 0;
    // Ignore minor GPS jitter / local movement within the same city (< 30 km)
    const isGenuinelySuspiciousLocation = distKm > 30 && risk.suspicious === 1;

    user_inputObject['txn_unusual_location'] = isGenuinelySuspiciousLocation ? 1 : 0;
    user_inputObject['txn_unusual_time'] = isGenuinelySuspiciousLocation ? 1 : 0;

    console.log(
      'final_risk_score ',
      {
        previousLat: prev.location.lat,
        previousLong: prev.location.long,
        currentLat: current.location.lat,
        currentLong: current.location.long,
        minutesSincePreviousTransaction: difference_time,
      },
      risk,
    );

    // abnormal transaction

    const all_transaction = user_transactions.map(
      (transaction) => transaction.amount,
    );
    const current_transaction = all_transaction[0];
    const previous_transactionArray = all_transaction.slice(1);

    if (previous_transactionArray.length >= 1) {
      const anomalyScore = abNormalTransaction({
        transactionsArray: previous_transactionArray,
        currentAmount: current_transaction,
      });

      const prevAvg =
        previous_transactionArray.reduce((sum, val) => sum + val, 0) /
        previous_transactionArray.length;

      if (
        anomalyScore >= 3 ||
        anomalyScore <= -2 ||
        current_transaction > 4000 ||
        (current_transaction >= 500 && current_transaction >= prevAvg * 4)
      ) {
        user_inputObject['txn_unusual_amount'] = 1;
      }
      console.log('transaction anomaly score:', anomalyScore, 'unusual_amount:', user_inputObject['txn_unusual_amount']);
    }

    // Activate composite flags for Account Takeover and Multiple Anomalies
    const isAtodActive =
      user_inputObject['device_changed'] === 1 &&
      user_inputObject['txn_unusual_location'] === 1;

    if (isAtodActive) {
      user_inputObject['account_takeover_risk'] = 1;
      user_inputObject['fraud_account_takeover'] = 1;
    }

    const anomalySignalCount =
      (user_inputObject['device_changed'] === 1 ? 1 : 0) +
      (user_inputObject['txn_unusual_location'] === 1 ? 1 : 0) +
      (user_inputObject['txn_unusual_amount'] === 1 ? 1 : 0) +
      (user_inputObject['txn_unusual_time'] === 1 ? 1 : 0);

    if (anomalySignalCount >= 2) {
      user_inputObject['has_multiple_anomalies'] = 1;
    }

    if (anomalySignalCount >= 1) {
      user_inputObject['detection_score'] = 1;
    }

    console.log('all transaction', all_transaction);
    console.log('output feed', user_inputObject);

    let new_container = {};

    const keysArray = Object.keys(default_inputs);
    console.log('keyArrays before', keysArray);
    keysArray.map((key) => {
      if (user_inputObject[key] > default_inputs[key]) {
        new_container[key] = user_inputObject[key];
      } else {
        new_container[key] = default_inputs[key];
      }
    });

    let response;
    // try {
    //   console.log(
    //     'process_env',
    //     process.env.URL,
    //     typeof new_container,
    //     JSON.stringify(new_container),
    //   );
    //   response = await axios.post(
    //     process.env.URL,
    //     JSON.stringify({
    //       is_new_user: 0,
    //       txn_unusual_location: 0,
    //       txn_unusual_time: 0,
    //       txn_unusual_amount: 0,
    //       device_changed: 0,
    //       ip_mismatch: 0,
    //       has_multiple_anomalies: 0,
    //       sim_device_change: 0,
    //       account_takeover_risk: 0,
    //       fraud_detected: 0,
    //       was_reversed: 0,
    //       was_reported: 0,
    //       fraud_account_takeover: 0,
    //       platform_mtn_momo: 0,
    //       txn_cash_in: 0,
    //       txn_cash_out: 0,
    //       victim_vulnerability: 0,
    //       detection_score: 0,
    //     }),
    //   );
    // } catch (error) {
    //   console.error(error?.message || error);
    // }

    try {
      const mlPayload = {
        ...default_inputs,
        ...new_container,
      };

      const mlUrl = process.env.ML_ENGINE_URL || process.env.URL || 'http://localhost:8000/';
      response = await axios.post(
        mlUrl,
        mlPayload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        },
      );

      console.log('ML API response hit:', response.data);
    } catch (error) {
      console.error('ML API error:', error.message);
    }

    const mlStatus = response?.data || { fraud_risk_score: 0.05 };

    const rawScore = mlStatus?.fraud_risk_score;
    let normalizedScore = 0.05;
    const ML_MIN_SCORE = 3.0;
    const ML_MAX_SCORE = 20.0;
    if (typeof rawScore === 'number') {
      if (rawScore <= 1.0) {
        normalizedScore = Math.max(0, Math.min(1, rawScore));
      } else {
        // Map raw model output range [~3.0, ~20.0] linearly to [0.0, 1.0]
        normalizedScore = Math.max(0, Math.min(1, (rawScore - ML_MIN_SCORE) / (ML_MAX_SCORE - ML_MIN_SCORE)));
      }
    }

    const isCashIn = channel === 'cash_in';

    // As requested: cash_in is necessary to record in admin, but we do not detect fraud on cash_in.
    // Full fraud scoring & zero-deduction Model A auto-blocking apply to send_money & cash_out.
    let isHighRisk = false;
    let riskLevel = 'low';
    let blockReason = 'Transaction completed';

    if (isCashIn) {
      normalizedScore = 0.01;
      riskLevel = 'low';
      isHighRisk = false;
    } else {
      const hasAmountAnomaly = user_inputObject['txn_unusual_amount'] === 1;
      const hasDeviceAndLocationAnomaly =
        user_inputObject['device_changed'] === 1 && user_inputObject['txn_unusual_location'] === 1;

      isHighRisk =
        normalizedScore >= 0.60 ||
        hasAmountAnomaly ||
        hasDeviceAndLocationAnomaly;

      if (normalizedScore >= 0.80 || (hasAmountAnomaly && hasDeviceAndLocationAnomaly)) {
        riskLevel = 'critical';
      } else if (normalizedScore >= 0.60 || isHighRisk) {
        riskLevel = 'high';
      } else if (normalizedScore >= 0.30) {
        riskLevel = 'medium';
      } else {
        riskLevel = 'low';
      }

      if (hasDeviceAndLocationAnomaly && hasAmountAnomaly) {
        blockReason = `Security defense: Account takeover and abnormal outflow spike detected (${(normalizedScore * 100).toFixed(0)}% risk). 0.00 GHS deducted.`;
      } else if (hasDeviceAndLocationAnomaly) {
        blockReason = `Security defense: Account takeover detected from unrecognized device and location jump (${(normalizedScore * 100).toFixed(0)}% risk). 0.00 GHS deducted.`;
      } else if (hasAmountAnomaly) {
        blockReason = `Transaction anomaly defense: Unusual amount pattern detected (${(normalizedScore * 100).toFixed(0)}% risk). 0.00 GHS deducted.`;
      } else if (isHighRisk) {
        blockReason = `Automated ML fraud defense: ${(normalizedScore * 100).toFixed(0)}% risk. 0.00 GHS deducted.`;
      }
    }

    new_userInputs.fraudScore = String(normalizedScore);
    new_userInputs.status = isHighRisk ? 'blocked' : 'completed';
    if (isHighRisk) {
      new_userInputs.reason = blockReason;
    }
    await new_userInputs.save();

    // Adjust user balance in MongoDB Atlas if transaction succeeded (not high-risk fraud block)
    if (!isHighRisk) {
      if (channel === 'cash_in') {
        original_user.balance = (Number(original_user.balance) || 0) + Number(new_userInputs.amount);
      } else {
        original_user.balance = Math.max(0, (Number(original_user.balance) || 0) - Number(new_userInputs.amount));
      }
      await original_user.save();
    }

    let createdCase = null;
    if (isHighRisk) {
      const caseId = `CASE-${Date.now().toString().slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const detectionType =
        user_inputObject['device_changed'] === 1 && user_inputObject['txn_unusual_location'] === 1
          ? 'atod'
          : 'transaction_anomaly';

      const signals = [];
      if (user_inputObject['device_changed'] === 1) {
        signals.push({
          type: 'new_device',
          label: 'Unrecognized Device Fingerprint',
          description: `Login from hardware footprint "${new_userInputs.device}" not matching account registration "${original_user?.device || 'Registered Device'}"`,
          score: 0.88,
          details: { deviceId: new_userInputs.device },
        });
      }
      if (user_inputObject['txn_unusual_location'] === 1) {
        signals.push({
          type: 'new_location',
          label: 'Geographical Telemetry Jump',
          description: `Transfer initiated with suspicious location displacement (${new_userInputs.location?.lat}, ${new_userInputs.location?.long})`,
          score: 0.82,
          details: { location: new_userInputs.location },
        });
      }
      if (user_inputObject['txn_unusual_amount'] === 1) {
        signals.push({
          type: 'unusual_amount',
          label: 'Sudden High Volume Outflow',
          description: `Amount GH₵ ${new_userInputs.amount} exceeds normal user baseline`,
          score: 0.9,
          details: { amount: new_userInputs.amount },
        });
      }
      signals.push({
        type: 'ml_score',
        label: 'FastAPI ML Fraud Risk Score',
        description: `XGBoost model evaluated this ${channel === 'cash_out' ? 'cash-out' : 'transfer'} with ${(normalizedScore * 100).toFixed(1)}% fraud probability`,
        score: normalizedScore,
        details: {
          model: 'xgboost_regressor_v1',
          rawScore,
          calibrated: mlStatus?.calibrated ?? false,
          calibrationReason: mlStatus?.calibration_reason ?? null,
        },
      });

      createdCase = await Case.create({
        caseId,
        transactionId: new_userInputs._id.toString(),
        userId: userID,
        userName: original_user?.fullName || 'Swipe Pay User',
        userPhone: original_user?.email || new_userInputs.SenderPhone,
        detectionType,
        riskLevel,
        status: 'open',
        transaction: {
          id: new_userInputs._id.toString(),
          type: channel,
          channel,
          amount: new_userInputs.amount,
          currency: 'GHS',
          sender: new_userInputs.SenderPhone,
          receiver: new_userInputs.receiverPhone,
          receiverName: new_userInputs.receiverPhone,
          status: 'blocked',
          mlScore: normalizedScore,
          mlRiskLevel: riskLevel,
          reason: blockReason,
          caseId,
          location: {
            latitude: parseFloat(new_userInputs.location?.lat) || 5.6037,
            longitude: parseFloat(new_userInputs.location?.long) || -0.187,
            city: new_userInputs.city || 'Accra',
            country: new_userInputs.country || 'Ghana',
          },
          deviceProfile: {
            deviceId: new_userInputs.device || 'web_client',
          },
          createdAt: new_userInputs.createdAt,
        },
        signals,
        userProfile: {
          avgTransactionAmount: new_userInputs.amount,
          knownDevices: [original_user?.device || 'web_client'],
          accountAge: 30,
          totalTransactions: user_transactions.length,
        },
        analystNotes: [],
      });

      const io = req.app.get('io');
      if (io) {
        console.log('Broadcasting admin:case:new to admin socket:', caseId);
        io.emit('admin:case:new', createdCase.toJSON());
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('admin:transaction:new', {
        id: new_userInputs._id.toString(),
        type: channel,
        channel,
        amount: new_userInputs.amount,
        currency: 'GHS',
        sender: new_userInputs.SenderPhone,
        receiver: new_userInputs.receiverPhone,
        status: new_userInputs.status,
        mlScore: normalizedScore,
        mlRiskLevel: riskLevel,
        location: {
          latitude: parseFloat(new_userInputs.location?.lat) || 5.6037,
          longitude: parseFloat(new_userInputs.location?.long) || -0.187,
          city: new_userInputs.city || 'Accra',
          country: new_userInputs.country || 'Ghana',
        },
        deviceProfile: { deviceId: new_userInputs.device || 'web_client' },
        senderDetails: {
          userId: original_user?._id?.toString() || userID,
          fullName: original_user?.fullName || 'Swipe Pay Customer',
          email: original_user?.email || '',
          phoneNumber: new_userInputs.SenderPhone,
          ghanaCard: original_user?.ghanaCard || '—',
          balance: original_user?.balance ?? null,
          status: original_user?.status || 'active',
          registeredDevice: original_user?.device || '—',
          registeredLocation: original_user?.location || null,
          createdAt: original_user?.createdAt || null,
        },
        createdAt: new_userInputs.createdAt,
      });
    }

    return res
      .status(200)
      .json({
        data: new_userInputs,
        balance: original_user?.balance ?? null,
        status: mlStatus,
        case: createdCase,
        isDeducted: !isHighRisk,
      });
  } catch (error) {
    console.error('Transaction error:', error?.message || error);
    return res.status(500).json({ message: error?.message || 'Internal Server Error' });
  }
});

userInputs.get('/user', [authUser], async (req, res) => {
  const { id: userID } = req.user;

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const offset = (page - 1) * limit;

  try {
    const userTransactionList = await UserInputs.find({ userID })
      .skip(offset)
      .limit(limit);

    console.log('all_transaction', userTransactionList);
    return res.status(200).json(userTransactionList);
  } catch (error) {
    console.log('error: ', error);
    return res.status(400).json({ message: error?.message || error });
  }
});

module.exports = userInputs;
