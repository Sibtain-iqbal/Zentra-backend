const logger = require('../config/logger');
const { Trade, TradingPlan, BehaviorHeatmapHistory, StabilityTrendHistory } = require('../models');
const {
  mentalBattery,
  planControl,
  behaviorHeatmap,
  psychologicalRadar,
  breathwork,
  performanceWindow,
  consistencyTrend,
  quotes,
} = require('./zentra');

/**
 * Get start of a given date (midnight local)
 */
const getStartOfDay = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

/**
 * Get end of a given date (23:59:59.999 local)
 */
const getEndOfDay = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
};

/**
 * Get trades for a specific date (defaults to today)
 */
const getTradesForDate = async (userId, dateStr) => {
  const start = getStartOfDay(dateStr);
  const end = getEndOfDay(dateStr);
  return Trade.find({
    userId,
    entryTime: { $gte: start, $lte: end },
  })
    .sort({ entryTime: -1 })
    .lean();
};

/**
 * Get recent trades (last N)
 */
const getRecentTrades = async (userId, limit = 5) => {
  return Trade.find({ userId }).sort({ entryTime: -1 }).limit(limit).lean();
};

/**
 * Get trades within date range
 */
const getTradesInRange = async (userId, startDate, endDate = new Date()) => {
  return Trade.find({
    userId,
    entryTime: { $gte: startDate, $lte: endDate },
  })
    .sort({ entryTime: -1 })
    .lean();
};

/**
 * Feature 1: Get Mental Battery
 */
const getMentalBattery = async (userId, date) => {
  logger.info('[ZentraService] getMentalBattery for user: %s date: %s', userId, date || 'today');

  const [plan, dateTrades, recentTrades] = await Promise.all([
    TradingPlan.findOne({ userId }).lean(),
    getTradesForDate(userId, date),
    getRecentTrades(userId, 5),
  ]);

  const planControlResult = planControl.calculatePlanControl(recentTrades, plan);
  const result = mentalBattery.calculateMentalBattery(dateTrades, plan, planControlResult.percentage);

  logger.info('[ZentraService] Mental battery result: %d%% status: %s', result.battery, result.status);
  return result;
};

/**
 * Feature 2: Get Plan Control % with deviation attribution
 */
const getPlanControl = async (userId, date) => {
  logger.info('[ZentraService] getPlanControl for user: %s date: %s', userId, date || 'today');

  const [plan, dateTrades, recentTrades] = await Promise.all([
    TradingPlan.findOne({ userId }).lean(),
    getTradesForDate(userId, date),
    getRecentTrades(userId, 5),
  ]);

  const planControlBasic = planControl.calculatePlanControl(recentTrades, plan);
  const batteryResult = mentalBattery.calculateMentalBattery(dateTrades, plan, planControlBasic.percentage);
  const result = planControl.calculatePlanControlWithAttribution(recentTrades, plan, batteryResult.battery);

  logger.info(
    '[ZentraService] Plan control result: %d%% attribution: %s',
    result.percentage,
    result.deviationAttribution?.primaryCause || 'none'
  );
  return result;
};

/**
 * Feature 3: Get Behavior Heatmap with insight
 * Returns heatmap for the selected date only.
 */
const getBehaviorHeatmap = async (userId, date) => {
  logger.info('[ZentraService] getBehaviorHeatmap for user: %s date: %s', userId, date || 'today');

  const [plan, trades] = await Promise.all([TradingPlan.findOne({ userId }).lean(), getTradesForDate(userId, date)]);

  const result = behaviorHeatmap.calculateBehaviorHeatmapWithInsight(trades, plan);

  logger.info(
    '[ZentraService] Behavior heatmap generated with %d trades, insight: %s',
    result.totalTrades,
    result.insight?.type || 'none'
  );

  // Persist snapshot only when there are actual trades for this date
  if (result.totalTrades > 0) {
    const snapshotDate = getStartOfDay(date);
    await BehaviorHeatmapHistory.updateOne(
      { userId, date: snapshotDate },
      {
        userId,
        date: snapshotDate,
        windows: result.windows,
        insight: result.insight,
        totalTrades: result.totalTrades,
      },
      { upsert: true }
    );
  }

  return result;
};

/**
 * Feature 4: Get Psychological Radar
 */
const getPsychologicalRadar = async (userId, date) => {
  logger.info('[ZentraService] getPsychologicalRadar for user: %s date: %s', userId, date || 'today');

  const endDate = date ? getEndOfDay(date) : new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7); // last 7 days context

  const [plan, recentTrades] = await Promise.all([
    TradingPlan.findOne({ userId }).lean(),
    getTradesInRange(userId, startDate, endDate),
  ]);

  const result = psychologicalRadar.calculatePsychologicalRadar(recentTrades.slice(0, 5), plan);

  logger.info('[ZentraService] Psychological radar generated for %d trades', result.tradesAnalyzed);
  return result;
};

/**
 * Feature 5: Get Breathwork Suggestion
 */
const getBreathworkSuggestion = async (userId, date) => {
  logger.info('[ZentraService] getBreathworkSuggestion for user: %s date: %s', userId, date || 'today');

  const endDate = date ? getEndOfDay(date) : new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);

  const [plan, dateTrades, recentTrades] = await Promise.all([
    TradingPlan.findOne({ userId }).lean(),
    getTradesForDate(userId, date),
    getTradesInRange(userId, startDate, endDate),
  ]);

  const planControlResult = planControl.calculatePlanControl(recentTrades.slice(0, 5), plan);
  const batteryResult = mentalBattery.calculateMentalBattery(dateTrades, plan, planControlResult.percentage);
  const radarResult = psychologicalRadar.calculatePsychologicalRadar(recentTrades.slice(0, 5), plan);

  const result = breathwork.shouldSuggestBreathwork({
    mentalBattery: batteryResult.battery,
    emotionalVolatility: radarResult.traits.emotionalVolatility,
    todayTrades: dateTrades,
    sessionStartBattery: 100,
  });

  logger.info('[ZentraService] Breathwork suggestion: %s', result.shouldSuggest);
  return result;
};

/**
 * Feature 6: Get Performance Window
 */
const getPerformanceWindow = async (userId, date) => {
  logger.info('[ZentraService] getPerformanceWindow for user: %s date: %s', userId, date || 'today');

  const endDate = date ? getEndOfDay(date) : new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 30);

  const [plan, recentTrades] = await Promise.all([
    TradingPlan.findOne({ userId }).lean(),
    getTradesInRange(userId, startDate, endDate),
  ]);

  const top10 = recentTrades.slice(0, 10);
  const currentTrades = top10.slice(0, 5);
  const previousTrades = top10.slice(5, 10);

  const currentPlanControl = planControl.calculatePlanControl(currentTrades, plan);
  const previousPlanControl = previousTrades.length > 0 ? planControl.calculatePlanControl(previousTrades, plan) : null;

  const result = performanceWindow.getPerformanceWindow(
    currentTrades,
    plan,
    currentPlanControl.percentage,
    previousPlanControl?.percentage
  );

  logger.info('[ZentraService] Performance window: %s improvements detected', result.hasImprovement);
  return result;
};

/**
 * Feature 7: Get Consistency Trend
 * Returns trend analysis anchored to the selected date.
 */
const getConsistencyTrend = async (userId, daysOption = '7', date) => {
  logger.info('[ZentraService] getConsistencyTrend for user: %s days: %s date: %s', userId, daysOption, date || 'today');

  const endDate = date ? getEndOfDay(date) : new Date();
  let startDate;
  if (daysOption === 'all') {
    startDate = new Date(0);
  } else {
    const days = parseInt(daysOption, 10);
    startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);
  }

  const [plan, trades, dateTrades] = await Promise.all([
    TradingPlan.findOne({ userId }).lean(),
    getTradesInRange(userId, startDate, endDate),
    getTradesForDate(userId, date),
  ]);

  const result = consistencyTrend.calculateConsistencyTrend(trades, plan, daysOption);

  logger.info(
    '[ZentraService] Consistency trend: %d data points, direction: %s',
    result.trend.length,
    result.summary.trendDirection
  );

  // Persist the selected date's stability score
  const snapshotDate = getStartOfDay(date);
  const dateScore = consistencyTrend.calculateDailyScore(dateTrades, plan);
  if (dateScore) {
    await StabilityTrendHistory.updateOne(
      { userId, date: snapshotDate },
      {
        userId,
        date: snapshotDate,
        score: dateScore.score,
        metrics: dateScore.metrics,
        tradeCount: dateScore.tradeCount,
      },
      { upsert: true }
    );
  }

  return result;
};

/**
 * Get behavior heatmap history between dates (default last 30 days)
 * @param {ObjectId} userId
 * @param {Object} query
 * @returns {Promise<Object>}
 */
const getBehaviorHeatmapHistory = async (userId, query = {}) => {
  const { startDate, endDate } = query;
  const start = startDate !== undefined ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate !== undefined ? new Date(endDate) : new Date();

  const history = await BehaviorHeatmapHistory.find({
    userId,
    date: { $gte: start, $lte: end },
    totalTrades: { $gt: 0 }, // only return snapshots that have actual trades
  })
    .sort({ date: -1 })
    .lean();

  logger.info('[ZentraService] Heatmap history records: %d', history.length);
  return { history, count: history.length };
};

/**
 * Get stability (consistency) trend history between dates (default last 30 days)
 * @param {ObjectId} userId
 * @param {Object} query
 * @returns {Promise<Object>}
 */
const getStabilityHistory = async (userId, query = {}) => {
  const { startDate, endDate } = query;
  const start = startDate !== undefined ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate !== undefined ? new Date(endDate) : new Date();

  const history = await StabilityTrendHistory.find({
    userId,
    date: { $gte: start, $lte: end },
  })
    .sort({ date: -1 })
    .lean();

  logger.info('[ZentraService] Stability history records: %d', history.length);
  return { history, count: history.length };
};

/**
 * Feature 8: Get Daily Quote
 */
const getDailyQuote = async (userId, date) => {
  logger.info('[ZentraService] getDailyQuote for user: %s date: %s', userId, date || 'today');

  const result = quotes.getDailyQuote(userId, date);

  logger.info('[ZentraService] Daily quote category: %s', result.category);
  return result;
};

module.exports = {
  getMentalBattery,
  getPlanControl,
  getBehaviorHeatmap,
  getPsychologicalRadar,
  getBreathworkSuggestion,
  getPerformanceWindow,
  getConsistencyTrend,
  getBehaviorHeatmapHistory,
  getStabilityHistory,
  getDailyQuote,
};
