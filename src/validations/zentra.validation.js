const Joi = require('joi');

// Accept both YYYY-MM-DD and full ISO datetime strings from the frontend
const dateQuery = Joi.object().keys({
  date: Joi.string().optional(),
});

const getMentalBattery = {
  query: dateQuery,
};

const getPlanControl = {
  query: dateQuery,
};

const getBehaviorHeatmap = {
  query: dateQuery,
};

const getPsychologicalRadar = {
  query: dateQuery,
};

const getBreathworkSuggestion = {
  query: dateQuery,
};

const getPerformanceWindow = {
  query: dateQuery,
};

const getConsistencyTrend = {
  query: Joi.object().keys({
    days: Joi.string().valid('7', '10', '20', 'all').default('7'),
    date: Joi.string().optional(),
  }),
};

const getDailyQuote = {
  query: dateQuery,
};

const getHeatmapHistory = {
  query: Joi.object().keys({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  }),
};

const getStabilityHistory = {
  query: Joi.object().keys({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  }),
};

module.exports = {
  getMentalBattery,
  getPlanControl,
  getBehaviorHeatmap,
  getPsychologicalRadar,
  getBreathworkSuggestion,
  getPerformanceWindow,
  getConsistencyTrend,
  getDailyQuote,
  getHeatmapHistory,
  getStabilityHistory,
};
