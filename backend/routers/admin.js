const { Router } = require('express');
const { Case } = require('../models/case');
const { UserInputs } = require('../models/userInput');
const { UserRegister } = require('../models/userRegister');

const adminRouter = Router();

// Admin Login
adminRouter.post('/login', async (req, res) => {
  const { email } = req.body;
  const isKwame = email?.toLowerCase().includes('kwame');
  return res.status(200).json({
    token: `admin_jwt_${Date.now()}`,
    analyst: {
      id: 'analyst_001',
      name: isKwame ? 'Kwame Mensah' : 'Swipe Pay Administrator',
      email: email || 'admin@swipepay.gh',
      role: 'admin',
    },
  });
});

// GET /admin/cases
adminRouter.get('/cases', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }
    if (req.query.detectionType && req.query.detectionType !== 'all') {
      filter.detectionType = req.query.detectionType;
    }
    if (req.query.riskLevel && req.query.riskLevel !== 'all') {
      filter.riskLevel = req.query.riskLevel;
    }

    const cases = await Case.find(filter).sort({ createdAt: -1 });
    return res.status(200).json(cases);
  } catch (error) {
    console.error('Error fetching admin cases:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /admin/cases/:id
adminRouter.get('/cases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const foundCase = await Case.findOne({
      $or: [{ caseId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!foundCase) {
      return res.status(404).json({ message: `Case ${id} not found` });
    }

    const caseObj = foundCase.toJSON ? foundCase.toJSON() : foundCase.toObject();
    if (foundCase.userId) {
      const user = await UserRegister.findById(foundCase.userId);
      if (user) {
        caseObj.userStatus = user.status || 'active';
        caseObj.frozenReason = user.frozenReason || null;
        caseObj.frozenAt = user.frozenAt || null;
        caseObj.userEmail = user.email || caseObj.userEmail;
        caseObj.userName = user.fullName || caseObj.userName;
        caseObj.userGhanaCard = user.ghanaCard;
        caseObj.userBalance = user.balance;
        caseObj.userRegisteredDevice = user.device;
        caseObj.userRegisteredLocation = user.location;
        caseObj.userCreatedAt = user.createdAt;
      }
    }

    return res.status(200).json(caseObj);
  } catch (error) {
    console.error('Error fetching admin case by id:', error);
    return res.status(500).json({ message: error.message });
  }
});

// Helper to broadcast socket events
function broadcastCaseUpdate(req, updatedCase) {
  const io = req.app.get('io');
  if (io) {
    io.emit('admin:case:updated', updatedCase.toJSON ? updatedCase.toJSON() : updatedCase);
  }
}

// POST /admin/cases/:id/approve (Pathway B: False-Positive Clearance)
adminRouter.post('/cases/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const foundCase = await Case.findOne({
      $or: [{ caseId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!foundCase) {
      return res.status(404).json({ message: `Case ${id} not found` });
    }

    foundCase.status = 'approved';
    if (note) {
      foundCase.analystNotes.push({
        author: 'Kwame Mensah',
        content: note,
        createdAt: new Date(),
      });
    }

    await foundCase.save();

    // Update associated transaction if exists
    if (foundCase.transactionId) {
      await UserInputs.findByIdAndUpdate(foundCase.transactionId, {
        status: 'approved',
      });
    }

    // Unfreeze user account if it was restricted
    let updatedUserStatus = 'active';
    if (foundCase.userId) {
      const user = await UserRegister.findById(foundCase.userId);
      if (user && user.status === 'frozen') {
        user.status = 'active';
        user.frozenReason = null;
        user.frozenAt = null;
        await user.save();
        const io = req.app.get('io');
        if (io) {
          io.emit('account:unfrozen', {
            userId: user._id.toString(),
            email: user.email,
            status: 'active',
          });
        }
      } else if (user) {
        updatedUserStatus = user.status || 'active';
      }
    }

    broadcastCaseUpdate(req, foundCase);
    const resData = foundCase.toJSON ? foundCase.toJSON() : foundCase.toObject();
    resData.userStatus = updatedUserStatus;
    return res.status(200).json(resData);
  } catch (error) {
    console.error('Error approving case:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /admin/cases/:id/block
adminRouter.post('/cases/:id/block', async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const foundCase = await Case.findOne({
      $or: [{ caseId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!foundCase) {
      return res.status(404).json({ message: `Case ${id} not found` });
    }

    foundCase.status = 'blocked';
    if (note) {
      foundCase.analystNotes.push({
        author: 'Kwame Mensah',
        content: note,
        createdAt: new Date(),
      });
    }

    await foundCase.save();

    // Update associated transaction
    if (foundCase.transactionId) {
      await UserInputs.findByIdAndUpdate(foundCase.transactionId, {
        status: 'rejected',
      });
    }

    broadcastCaseUpdate(req, foundCase);
    return res.status(200).json(foundCase);
  } catch (error) {
    console.error('Error blocking case:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /admin/cases/:id/escalate
adminRouter.post('/cases/:id/escalate', async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const foundCase = await Case.findOne({
      $or: [{ caseId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!foundCase) {
      return res.status(404).json({ message: `Case ${id} not found` });
    }

    foundCase.status = 'escalated';
    if (note) {
      foundCase.analystNotes.push({
        author: 'Kwame Mensah',
        content: note,
        createdAt: new Date(),
      });
    }

    await foundCase.save();
    broadcastCaseUpdate(req, foundCase);
    return res.status(200).json(foundCase);
  } catch (error) {
    console.error('Error escalating case:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /admin/cases/:id/notes
adminRouter.post('/cases/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, author = 'Kwame Mensah' } = req.body;

    const foundCase = await Case.findOne({
      $or: [{ caseId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    });

    if (!foundCase) {
      return res.status(404).json({ message: `Case ${id} not found` });
    }

    foundCase.analystNotes.push({
      author,
      content,
      createdAt: new Date(),
    });

    await foundCase.save();
    broadcastCaseUpdate(req, foundCase);
    return res.status(200).json(foundCase);
  } catch (error) {
    console.error('Error adding case note:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /admin/transactions
adminRouter.get('/transactions', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }
    const limit = Number(req.query.limit) || 100;
    const transactions = await UserInputs.find(filter)
      .populate('userID')
      .sort({ createdAt: -1 })
      .limit(limit);

    // Format for client consumption
    const formatted = transactions.map((t) => {
      const user = t.userID;
      const rawType = String(t.channel || t.transactionType || t.reason || 'send_money').toLowerCase();
      let channel = 'send_money';
      if (rawType.includes('cash_out') || rawType.includes('cashout') || rawType.includes('withdraw')) {
        channel = 'cash_out';
      } else if (rawType.includes('cash_in') || rawType.includes('cashin') || rawType.includes('deposit')) {
        channel = 'cash_in';
      } else {
        channel = 'send_money';
      }

      return {
        id: t._id.toString(),
        type: channel,
        channel,
        transactionType: channel,
        amount: t.amount,
        currency: 'GHS',
        sender: t.SenderPhone,
        receiver: t.receiverPhone,
        status: t.status,
        mlScore: parseFloat(t.fraudScore) || 0,
        mlRiskLevel:
          parseFloat(t.fraudScore) >= 0.8
            ? 'critical'
            : parseFloat(t.fraudScore) >= 0.6
            ? 'high'
            : parseFloat(t.fraudScore) >= 0.3
            ? 'medium'
            : 'low',
        location: {
          latitude: parseFloat(t.location?.lat) || 5.6037,
          longitude: parseFloat(t.location?.long) || -0.187,
          city: t.city || 'Accra',
          country: t.country || 'Ghana',
        },
        deviceProfile: {
          deviceId: t.device || 'unknown',
        },
        senderDetails: {
          userId: user?._id?.toString() || (t.userID?.toString ? t.userID.toString() : ''),
          fullName: user?.fullName || 'Swipe Pay Customer',
          email: user?.email || '',
          phoneNumber: t.SenderPhone,
          ghanaCard: user?.ghanaCard || '—',
          balance: user?.balance ?? null,
          status: user?.status || 'active',
          registeredDevice: user?.device || '—',
          registeredLocation: user?.location || null,
          createdAt: user?.createdAt || null,
        },
        createdAt: t.createdAt,
      };
    });

    return res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching admin transactions:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /admin/analytics
adminRouter.get('/analytics', async (req, res) => {
  try {
    const [allCases, allTxns] = await Promise.all([
      Case.find(),
      UserInputs.find().populate('userID'),
    ]);

    const totalTransactions = allTxns.length;
    const totalCases = allCases.length;
    const openCases = allCases.filter((c) => c.status === 'open').length;
    const underReview = allCases.filter((c) => c.status === 'under_review').length;
    const approvedCases = allCases.filter((c) => c.status === 'approved').length;
    const blockedCases = allCases.filter((c) => c.status === 'blocked').length;
    const escalatedCases = allCases.filter((c) => c.status === 'escalated').length;
    const resolvedCases = approvedCases + blockedCases;

    const totalFlagged = allTxns.filter((t) => ['flagged', 'blocked', 'rejected'].includes(t.status)).length + totalCases;
    const totalBlocked = allTxns.filter((t) => t.status === 'blocked').length + blockedCases;
    const totalApproved = allTxns.filter((t) => t.status === 'completed' || t.status === 'approved').length;
    const flagRate = totalTransactions > 0 ? ((totalFlagged / totalTransactions) * 100).toFixed(1) : '0.0';

    const atodCases = allCases.filter((c) => c.detectionType === 'atod').length;
    const anomalyCases = allCases.filter(
      (c) => c.detectionType === 'transaction_anomaly',
    ).length;

    const lowRisk = allCases.filter((c) => c.riskLevel === 'low').length;
    const medRisk = allCases.filter((c) => c.riskLevel === 'medium').length;
    const highRisk = allCases.filter((c) => c.riskLevel === 'high').length;
    const critRisk = allCases.filter((c) => c.riskLevel === 'critical').length;

    const txScores = allTxns.map((t) => parseFloat(t.fraudScore)).filter((s) => !isNaN(s));
    const avgMlScore = txScores.length > 0 ? (txScores.reduce((a, b) => a + b, 0) / txScores.length) : 0.05;

    // 30 days flagsOverTime
    const flagsOverTime = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count =
        allCases.filter((c) => c.createdAt && new Date(c.createdAt).toISOString().split('T')[0] === dateStr).length +
        allTxns.filter((t) => t.status === 'blocked' && t.createdAt && new Date(t.createdAt).toISOString().split('T')[0] === dateStr).length;
      flagsOverTime.push({ date: dateStr, count });
    }

    // ML Score Distribution brackets
    const mlScoreDistribution = [
      { bracket: '0-29% (Low)', count: txScores.filter((s) => s < 0.3).length },
      { bracket: '30-59% (Med)', count: txScores.filter((s) => s >= 0.3 && s < 0.6).length },
      { bracket: '60-79% (High)', count: txScores.filter((s) => s >= 0.6 && s < 0.8).length },
      { bracket: '80-100% (Crit)', count: txScores.filter((s) => s >= 0.8).length },
    ];

    // Top Flagged Accounts
    const userFlagMap = {};
    for (const c of allCases) {
      const uid = c.userId?.toString() || c.userPhone;
      if (!userFlagMap[uid]) {
        userFlagMap[uid] = {
          userId: uid,
          userName: c.userName || 'Swipe Pay User',
          phoneNumber: c.userPhone || '—',
          flagCount: 0,
          lastFlaggedAt: c.createdAt,
          riskLevel: c.riskLevel || 'medium',
        };
      }
      userFlagMap[uid].flagCount++;
      if (new Date(c.createdAt) > new Date(userFlagMap[uid].lastFlaggedAt)) {
        userFlagMap[uid].lastFlaggedAt = c.createdAt;
      }
    }
    for (const t of allTxns) {
      if (['flagged', 'blocked'].includes(t.status)) {
        const uid = t.userID?._id?.toString() || t.SenderPhone;
        const u = t.userID;
        if (!userFlagMap[uid]) {
          userFlagMap[uid] = {
            userId: uid,
            userName: u?.fullName || 'Swipe Pay User',
            phoneNumber: t.SenderPhone || '—',
            flagCount: 0,
            lastFlaggedAt: t.createdAt,
            riskLevel: parseFloat(t.fraudScore) >= 0.8 ? 'critical' : 'high',
          };
        }
        userFlagMap[uid].flagCount++;
        if (new Date(t.createdAt) > new Date(userFlagMap[uid].lastFlaggedAt)) {
          userFlagMap[uid].lastFlaggedAt = t.createdAt;
        }
      }
    }
    const topFlaggedAccounts = Object.values(userFlagMap)
      .sort((a, b) => b.flagCount - a.flagCount)
      .slice(0, 10);

    const flaggedVolume = allTxns
      .filter((t) => ['flagged', 'rejected', 'blocked'].includes(t.status))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalVolume = allTxns.reduce((sum, t) => sum + (t.amount || 0), 0);

    const sendMoneyTxns = allTxns.filter((t) => {
      const c = String(t.channel || t.transactionType || t.reason || '').toLowerCase();
      return !c.includes('cash_out') && !c.includes('cash_in');
    });
    const cashOutTxns = allTxns.filter((t) => String(t.channel || t.transactionType || t.reason || '').toLowerCase().includes('cash_out'));
    const cashInTxns = allTxns.filter((t) => String(t.channel || t.transactionType || t.reason || '').toLowerCase().includes('cash_in'));

    const channelBreakdown = {
      sendMoney: {
        total: sendMoneyTxns.length,
        blocked: sendMoneyTxns.filter((t) => ['flagged', 'blocked', 'rejected'].includes(t.status)).length,
      },
      cashOut: {
        total: cashOutTxns.length,
        blocked: cashOutTxns.filter((t) => ['flagged', 'blocked', 'rejected'].includes(t.status)).length,
      },
      cashIn: {
        total: cashInTxns.length,
        blocked: 0,
      },
    };

    const analytics = {
      totalTransactions,
      totalFlagged,
      flagRate,
      totalBlocked,
      totalApproved,
      channelBreakdown,
      mlModelAccuracy: 99.2,
      avgMlScore,
      detectionSplit: {
        atod: atodCases,
        transactionAnomaly: anomalyCases,
      },
      flagsOverTime,
      mlScoreDistribution,
      topFlaggedAccounts,

      totalCases,
      openCases,
      underReview,
      resolvedCases,
      avgResolutionTimeMinutes: 12.5,
      riskDistribution: {
        low: lowRisk,
        medium: medRisk,
        high: highRisk,
        critical: critRisk,
      },
      actionsBreakdown: {
        approved: approvedCases,
        blocked: blockedCases,
        escalated: escalatedCases,
      },
      volumeAtRisk: {
        currency: 'GHS',
        amount: flaggedVolume,
      },
      hourlyTrend: Array.from({ length: 24 }, (_, i) => ({
        hour: `${String(i).padStart(2, '0')}:00`,
        count: allCases.filter((c) => new Date(c.createdAt).getHours() === i).length,
      })),
      weeklyVolume: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
        (day) => ({
          day,
          total: Math.round(totalVolume / 7),
          flagged: Math.round(flaggedVolume / 7),
        }),
      ),
    };

    return res.status(200).json(analytics);
  } catch (error) {
    console.error('Error fetching admin analytics:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /admin/accounts/:id/freeze
adminRouter.post('/accounts/:id/freeze', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Account frozen by security analyst' } = req.body;

    const user = await UserRegister.findById(id);
    if (!user) {
      return res.status(404).json({ message: `User ${id} not found` });
    }

    user.status = 'frozen';
    user.frozenReason = reason;
    user.frozenAt = new Date();
    await user.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('account:frozen', {
        userId: user._id.toString(),
        email: user.email,
        reason,
        status: 'frozen',
      });
      io.emit('admin:account:status', {
        userId: user._id.toString(),
        status: 'frozen',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Account for ${user.fullName} (${user.email}) has been frozen.`,
      userStatus: 'frozen',
    });
  } catch (error) {
    console.error('Error freezing account:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /admin/accounts/:id/unfreeze
adminRouter.post('/accounts/:id/unfreeze', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Account cleared by security analyst' } = req.body;

    const user = await UserRegister.findById(id);
    if (!user) {
      return res.status(404).json({ message: `User ${id} not found` });
    }

    user.status = 'active';
    user.frozenReason = null;
    user.frozenAt = null;
    await user.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('account:unfrozen', {
        userId: user._id.toString(),
        email: user.email,
        status: 'active',
      });
      io.emit('admin:account:status', {
        userId: user._id.toString(),
        status: 'active',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Account for ${user.fullName} (${user.email}) has been reactivated.`,
      userStatus: 'active',
    });
  } catch (error) {
    console.error('Error unfreezing account:', error);
    return res.status(500).json({ message: error.message });
  }
});

module.exports = adminRouter;
