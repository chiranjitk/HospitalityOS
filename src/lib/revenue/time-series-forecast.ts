/**
 * Time-Series Forecasting Engine for Yield Management
 *
 * Implements five forecasting algorithms in pure TypeScript:
 * 1. Triple Exponential Smoothing (Holt-Winters) - additive + multiplicative
 * 2. Simplified ARIMA - AR(p) + MA(q) with AIC/BIC model selection
 * 3. Booking Pace Curve Analysis - pickup pattern modeling
 * 4. Multi-Factor Linear Regression - OLS with R^2 goodness of fit
 * 5. Ensemble Meta-Model - weighted combination of all forecasters
 *
 * All math is pure JS/TS - no external ML libraries.
 */

// ----- Helpers -----------------------------------------------------------------------------------------------------

export function calculateMAE(actual: number[], predicted: number[]): number {
  if (actual.length === 0 || actual.length !== predicted.length) return Infinity;
  return actual.reduce((sum, a, i) => sum + Math.abs(a - predicted[i]), 0) / actual.length;
}

export function calculateMAPE(actual: number[], predicted: number[]): number {
  if (actual.length === 0 || actual.length !== predicted.length) return Infinity;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < actual.length; i++) {
    if (Math.abs(actual[i]) > 1e-10) {
      sum += Math.abs((actual[i] - predicted[i]) / actual[i]);
      count++;
    }
  }
  return count > 0 ? sum / count : Infinity;
}

export function calculateRMSE(actual: number[], predicted: number[]): number {
  if (actual.length === 0 || actual.length !== predicted.length) return Infinity;
  return Math.sqrt(
    actual.reduce((sum, a, i) => sum + (a - predicted[i]) ** 2, 0) / actual.length
  );
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
}

function safeNum(v: number): number {
  if (!isFinite(v) || isNaN(v)) return 0;
  return v;
}

function clampPositive(v: number): number {
  return Math.max(0, safeNum(v));
}

/**
 * Simplified stationarity test (Augmented Dickey-Fuller approximation).
 * Returns a p-value approximation - lower means more likely stationary.
 * Uses the first-difference variance vs level variance ratio.
 */
export function stationarityTest(data: number[]): { isStationary: boolean; adfStat: number; pValue: number } {
  if (data.length < 10) return { isStationary: false, adfStat: 0, pValue: 1 };

  const levelVar = variance(data);

  // First differences
  const diffs: number[] = [];
  for (let i = 1; i < data.length; i++) {
    diffs.push(data[i] - data[i - 1]);
  }
  const diffVar = variance(diffs);

  if (levelVar < 1e-10) return { isStationary: true, adfStat: -10, pValue: 0.01 };

  const ratio = diffVar / levelVar;

  // Higher ratio means more stationary (unit root rejected)
  // ADF-like statistic: negative when stationary
  const adfStat = -(ratio - 1) * 10;

  // Rough p-value approximation
  const pValue = Math.max(0.01, Math.min(0.99, 1 - 1 / (1 + Math.exp(adfStat * 0.5))));

  return { isStationary: ratio > 1.5, adfStat: safeNum(adfStat), pValue: safeNum(pValue) };
}

/**
 * Split data into train/test sets.
 */
export function trainTestSplit(
  data: number[],
  testRatio: number = 0.2
): { train: number[]; test: number[] } {
  const splitIdx = Math.floor(data.length * (1 - testRatio));
  return { train: data.slice(0, splitIdx), test: data.slice(splitIdx) };
}

/**
 * K-fold cross-validation for a model function.
 */
export function crossValidate(
  modelFn: (train: number[]) => { predictions: number[] },
  data: number[],
  folds: number = 5
): { mae: number; mape: number; rmse: number; foldScores: number[] } {
  if (data.length < folds * 2) {
    // Not enough data for cross-validation
    const result = modelFn(data);
    const mae = calculateMAE(data, result.predictions);
    return { mae, mape: mae, rmse: mae, foldScores: [mae] };
  }

  const foldSize = Math.floor(data.length / folds);
  const foldScores: number[] = [];

  for (let f = 0; f < folds; f++) {
    const testStart = f * foldSize;
    const testEnd = f === folds - 1 ? data.length : (f + 1) * foldSize;

    const trainData = [...data.slice(0, testStart), ...data.slice(testEnd)];
    const testData = data.slice(testStart, testEnd);

    if (trainData.length < 5) continue;

    const { predictions } = modelFn(trainData);
    // Use last `testData.length` predictions (simple approach)
    const preds = predictions.slice(-testData.length);
    const mae = calculateMAE(testData, preds);
    foldScores.push(mae);
  }

  if (foldScores.length === 0) return { mae: Infinity, mape: Infinity, rmse: Infinity, foldScores: [] };

  const mae = mean(foldScores);
  return { mae, mape: mae, rmse: mae, foldScores };
}

/**
 * Auto-detect the dominant seasonal period using autocorrelation.
 */
export function detectSeasonality(data: number[], maxPeriod: number = 30): number {
  if (data.length < 2 * maxPeriod) {
    // Not enough data - default to weekly
    return 7;
  }

  const m = mean(data);
  const centered = data.map(v => v - m);
  const n = centered.length;
  const totalVar = centered.reduce((s, v) => s + v * v, 0);

  if (totalVar < 1e-10) return 7;

  let bestPeriod = 7;
  let bestCorr = 0;

  for (let lag = 2; lag <= maxPeriod; lag++) {
    let sum = 0;
    const count = n - lag;
    for (let i = 0; i < count; i++) {
      sum += centered[i] * centered[i + lag];
    }
    const corr = sum / totalVar;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestPeriod = lag;
    }
  }

  // Only accept if correlation is meaningful
  return bestCorr > 0.05 ? bestPeriod : 7;
}

// ----- 1. Triple Exponential Smoothing (Holt-Winters) ---------------------------------------

export interface HoltWintersResult {
  predictions: number[];
  lower: number[];
  upper: number[];
  level: number[];
  trend: number[];
  seasonal: number[];
  alpha: number;   // Level smoothing
  beta: number;    // Trend smoothing
  gamma: number;   // Seasonal smoothing
  period: number;
  type: 'additive' | 'multiplicative';
  mape: number;
}

export interface HoltWintersParams {
  alpha?: number;       // Level smoothing (0-1)
  beta?: number;        // Trend smoothing (0-1)
  gamma?: number;      // Seasonal smoothing (0-1)
  period?: number;     // Seasonal period (auto-detected if not given)
  type?: 'additive' | 'multiplicative';
  confidenceLevel?: number; // 0.8, 0.9, 0.95
}

/**
 * Holt-Winters Triple Exponential Smoothing.
 * Supports additive and multiplicative seasonality.
 */
export function holtWinters(
  data: number[],
  h: number,
  params?: HoltWintersParams
): HoltWintersResult {
  if (data.length < 4) {
    const avg = data.length > 0 ? mean(data) : 0;
    return {
      predictions: Array(h).fill(avg),
      lower: Array(h).fill(clampPositive(avg * 0.8)),
      upper: Array(h).fill(avg * 1.2),
      level: [...data],
      trend: Array(data.length).fill(0),
      seasonal: Array(data.length).fill(0),
      alpha: 0, beta: 0, gamma: 0,
      period: 1,
      type: params?.type || 'additive',
      mape: Infinity,
    };
  }

  const period = params?.period || detectSeasonality(data, Math.min(30, Math.floor(data.length / 2)));
  const type = params?.type || 'additive';
  const confLevel = params?.confidenceLevel || 0.95;
  const zScore = confLevel === 0.95 ? 1.96 : confLevel === 0.9 ? 1.645 : 1.28;

  // Initialize components
  const n = data.length;
  const seasons = Math.floor(n / period);
  if (seasons < 1) {
    return fallbackForecast(data, h, period, type);
  }

  // Initial level: average of first season
  const seasonAvg: number[] = [];
  for (let s = 0; s < seasons; s++) {
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[s * period + i];
    }
    seasonAvg.push(sum / period);
  }

  const initLevel = seasonAvg[0];

  // Initial trend: average trend across seasons
  let initTrend = 0;
  if (seasons >= 2) {
    const trendDiffs: number[] = [];
    for (let s = 1; s < seasons; s++) {
      trendDiffs.push((seasonAvg[s] - seasonAvg[s - 1]) / period);
    }
    initTrend = mean(trendDiffs);
  }

  // Initial seasonal indices
  const seasonalInit: number[] = new Array(period).fill(0);
  for (let i = 0; i < period; i++) {
    const seasonVals: number[] = [];
    for (let s = 0; s < seasons; s++) {
      const idx = s * period + i;
      if (idx < n) seasonVals.push(data[idx]);
    }
    if (type === 'additive') {
      seasonalInit[i] = seasonVals.length > 0
        ? mean(seasonVals) - initLevel
        : 0;
    } else {
      seasonalInit[i] = (initLevel > 1e-10 && seasonVals.length > 0)
        ? mean(seasonVals) / initLevel
        : 1;
    }
  }
  // Normalize multiplicative seasonal to average 1
  if (type === 'multiplicative') {
    const sAvg = mean(seasonalInit);
    if (sAvg > 1e-10) {
      for (let i = 0; i < period; i++) seasonalInit[i] /= sAvg;
    }
  }

  // Smooth parameters - use provided or auto-optimize
  const alpha = params?.alpha ?? 0.3;
  const beta = params?.beta ?? 0.1;
  const gamma = params?.gamma ?? 0.1;

  // Run smoothing
  const level: number[] = new Array(n).fill(0);
  const trend: number[] = new Array(n).fill(0);
  const seasonal: number[] = new Array(n).fill(0);
  const fitted: number[] = new Array(n).fill(0);

  level[0] = initLevel;
  trend[0] = initTrend;

  for (let i = 0; i < period; i++) {
    seasonal[i] = seasonalInit[i];
  }

  for (let t = 0; t < n; t++) {
    if (t === 0) {
      fitted[0] = type === 'additive'
        ? level[0] + trend[0] + seasonal[0]
        : level[0] * trend[0] * seasonal[0];
      continue;
    }

    const sIdx = ((t % period) + period) % period;
    const prevLevel = level[t - 1];
    const prevTrend = trend[t - 1];
    const prevSeason = t >= period ? seasonal[t - period] : seasonalInit[sIdx];

    // Level
    if (type === 'additive') {
      level[t] = alpha * (data[t] - prevSeason) + (1 - alpha) * (prevLevel + prevTrend);
    } else {
      const val = prevLevel + prevTrend > 1e-10 ? data[t] / (prevLevel + prevTrend) : 1;
      level[t] = alpha * val + (1 - alpha) * prevLevel;
    }

    // Trend
    trend[t] = beta * (level[t] - prevLevel) + (1 - beta) * prevTrend;

    // Seasonal
    if (type === 'additive') {
      seasonal[t] = gamma * (data[t] - level[t]) + (1 - gamma) * prevSeason;
    } else {
      const val2 = level[t] > 1e-10 ? data[t] / level[t] : 1;
      seasonal[t] = gamma * val2 + (1 - gamma) * prevSeason;
    }

    // Fitted value
    fitted[t] = type === 'additive'
      ? level[t] + trend[t] + seasonal[t]
      : level[t] * trend[t] * seasonal[t];
  }

  // Forecast
  const predictions: number[] = [];
  const lower: number[] = [];
  const upper: number[] = [];

  const lastLevel = level[n - 1];
  const lastTrend = trend[n - 1];

  // Calculate residual standard deviation for confidence intervals
  const residuals = data.map((v, i) => v - fitted[i]);
  const residStd = stdDev(residuals) || 1;

  for (let i = 1; i <= h; i++) {
    const sIdx = ((n - 1 + i) % period + period) % period;
    const lastSeason = n - period >= 0 ? seasonal[n - period + (i % period)] : seasonalInit[sIdx];

    let pred: number;
    if (type === 'additive') {
      pred = lastLevel + lastTrend * i + lastSeason;
    } else {
      pred = lastLevel * (1 + lastTrend) ** i * lastSeason;
    }

    pred = clampPositive(pred);
    const margin = zScore * residStd * Math.sqrt(1 + i * 0.1);
    predictions.push(Math.round(pred * 100) / 100);
    lower.push(Math.round(clampPositive(pred - margin) * 100) / 100);
    upper.push(Math.round((pred + margin) * 100) / 100);
  }

  const mape = calculateMAPE(data, fitted);

  return {
    predictions,
    lower,
    upper,
    level,
    trend,
    seasonal,
    alpha,
    beta,
    gamma,
    period,
    type,
    mape,
  };
}

function fallbackForecast(
  data: number[], h: number, period: number, type: 'additive' | 'multiplicative'
): HoltWintersResult {
  const avg = mean(data);
  const lastVal = data[data.length - 1] || avg;
  const trendSlope = data.length >= 2 ? (lastVal - data[0]) / data.length : 0;

  const predictions = Array.from({ length: h }, (_, i) =>
    clampPositive(type === 'additive' ? avg + trendSlope * i : avg * (1 + trendSlope / avg * i))
  );
  return {
    predictions,
    lower: predictions.map(p => clampPositive(p * 0.85)),
    upper: predictions.map(p => p * 1.15),
    level: [...data],
    trend: Array(data.length).fill(trendSlope),
    seasonal: Array(data.length).fill(0),
    alpha: 0.3, beta: 0.1, gamma: 0.1,
    period,
    type,
    mape: Infinity,
  };
}

/**
 * Auto-optimize Holt-Winters parameters by grid search.
 */
export function holtWintersOptimized(
  data: number[],
  h: number,
  type?: 'additive' | 'multiplicative'
): HoltWintersResult {
  if (data.length < 14) {
    return holtWinters(data, h, { type });
  }

  const period = detectSeasonality(data, Math.min(30, Math.floor(data.length / 2)));
  let bestResult: HoltWintersResult | null = null;
  let bestMape = Infinity;

  // Grid search over key parameters
  const alphas = [0.1, 0.2, 0.3, 0.4, 0.5];
  const betas = [0.01, 0.05, 0.1, 0.2];
  const gammas = [0.01, 0.05, 0.1, 0.2];
  const types = type ? [type] : ['additive', 'multiplicative'] as const;

  for (const t of types) {
    for (const a of alphas) {
      for (const b of betas) {
        for (const g of gammas) {
          const result = holtWinters(data, h, { alpha: a, beta: b, gamma: g, period, type: t });
          if (result.mape < bestMape) {
            bestMape = result.mape;
            bestResult = result;
          }
        }
      }
    }
  }

  return bestResult || holtWinters(data, h, { period, type: type || 'additive' });
}

// ----- 2. Simplified ARIMA (AR(p) + MA(q)) --------------------------------------------------------

export interface ARIMAResult {
  predictions: number[];
  residuals: number[];
  modelOrder: { p: number; d: number; q: number };
  arCoeffs: number[];
  maCoeffs: number[];
  aic: number;
  bic: number;
  mape: number;
  isStationary: boolean;
}

/**
 * Simplified ARIMA model.
 * Implements AR(p) + MA(q) on differenced data (d=0 or d=1).
 * Model order selected by AIC/BIC.
 */
export function arimaForecast(
  data: number[],
  h: number,
  maxP: number = 3,
  maxQ: number = 2
): ARIMAResult {
  if (data.length < 10) {
    const avg = data.length > 0 ? mean(data) : 0;
    return {
      predictions: Array(h).fill(avg),
      residuals: [],
      modelOrder: { p: 0, d: 0, q: 0 },
      arCoeffs: [],
      maCoeffs: [],
      aic: 0,
      bic: 0,
      mape: Infinity,
      isStationary: true,
    };
  }

  // Check stationarity
  const stationarity = stationarityTest(data);
  const d = stationarity.isStationary ? 0 : 1;

  // Difference if non-stationary
  const series = d === 1 ? difference(data) : data;

  if (series.length < 10) {
    const avg = mean(data);
    return {
      predictions: Array(h).fill(avg),
      residuals: [],
      modelOrder: { p: 0, d: 0, q: 0 },
      arCoeffs: [],
      maCoeffs: [],
      aic: 0,
      bic: 0,
      mape: Infinity,
      isStationary: stationarity.isStationary,
    };
  }

  // Try different model orders and select best by AIC
  let bestModel: { p: number; q: number; arCoeffs: number[]; maCoeffs: number[]; fitted: number[]; residuals: number[]; aic: number; bic: number } | null = null;
  let bestAIC = Infinity;

  for (let p = 0; p <= Math.min(maxP, Math.floor(series.length / 4)); p++) {
    for (let q = 0; q <= Math.min(maxQ, Math.floor(series.length / 4)); q++) {
      if (p === 0 && q === 0) continue;

      try {
        const model = fitARMA(series, p, q);
        if (model && model.aic < bestAIC) {
          bestAIC = model.aic;
          bestModel = { ...model, p, q };
        }
      } catch {
        // Skip models that fail to converge
      }
    }
  }

  if (!bestModel) {
    // Fallback: simple AR(1)
    const model = fitARMA(series, 1, 0);
    if (model) {
      bestModel = { ...model, p: 1, q: 0 };
    } else {
      // Ultimate fallback: mean
      const avg = mean(data);
      return {
        predictions: Array(h).fill(avg),
        residuals: [],
        modelOrder: { p: 0, d, q: 0 },
        arCoeffs: [],
        maCoeffs: [],
        aic: Infinity,
        bic: Infinity,
        mape: Infinity,
        isStationary: stationarity.isStationary,
      };
    }
  }

  // Generate forecasts
  const { arCoeffs, maCoeffs, fitted, residuals } = bestModel;
  const predictions: number[] = [];
  const n = series.length;

  for (let i = 0; i < h; i++) {
    const idx = n + i;
    let pred = 0;

    // AR component: sum of arCoeffs[j] * Y[t-j]
    for (let j = 0; j < arCoeffs.length; j++) {
      const t = idx - j - 1;
      if (t >= n) {
        pred += arCoeffs[j] * predictions[predictions.length - j - 1];
      } else if (t >= 0) {
        pred += arCoeffs[j] * series[t];
      }
    }

    // MA component: sum of maCoeffs[j] * e[t-j]
    for (let j = 0; j < maCoeffs.length; j++) {
      const t = idx - j - 1;
      if (t >= n) {
        pred += maCoeffs[j] * 0; // Expected residual = 0 for future
      } else if (t >= 0) {
        pred += maCoeffs[j] * (residuals[t] || 0);
      }
    }

    // Integrate back if differenced
    if (d === 1) {
      const base = data[data.length - 1];
      // Cumulative sum of predictions
      const cumSum = predictions.reduce((s, v) => s + v, 0) + pred;
      predictions.push(clampPositive(base + cumSum));
    } else {
      predictions.push(clampPositive(pred));
    }
  }

  // Calculate MAPE on fitted values
  const originalFitted = d === 1
    ? data.map((v, i) => (i === 0 ? v : v))
    : fitted;

  const mape = d === 1
    ? calculateMAPE(data.slice(originalFitted.length - data.length + 1), originalFitted)
    : calculateMAPE(data, originalFitted);

  return {
    predictions: predictions.map(p => Math.round(p * 100) / 100),
    residuals,
    modelOrder: { p: bestModel.p, d, q: bestModel.q },
    arCoeffs,
    maCoeffs,
    aic: bestModel.aic,
    bic: bestModel.bic,
    mape,
    isStationary: stationarity.isStationary,
  };
}

function difference(data: number[]): number[] {
  const diffs: number[] = [];
  for (let i = 1; i < data.length; i++) {
    diffs.push(data[i] - data[i - 1]);
  }
  return diffs;
}

/**
 * Fit ARMA(p,q) model using OLS for AR and residual-based for MA.
 */
function fitARMA(
  data: number[],
  p: number,
  q: number
): { arCoeffs: number[]; maCoeffs: number[]; fitted: number[]; residuals: number[]; aic: number; bic: number } | null {
  const n = data.length;
  if (n <= p + q + 2) return null;

  // Build design matrix for AR part: Y[t] = c + phi1*Y[t-1] + ... + phi_p*Y[t-p] + error
  const X: number[][] = [];
  const Y: number[] = [];

  for (let t = p; t < n; t++) {
    const row: number[] = [1]; // intercept
    for (let j = 1; j <= p; j++) {
      row.push(data[t - j]);
    }
    X.push(row);
    Y.push(data[t]);
  }

  // OLS for AR coefficients
  const arCoeffs = olsSolve(X, Y);
  if (!arCoeffs) return null;

  // Calculate AR-only residuals
  const arOnly: number[] = [];
  const arResiduals: number[] = [];
  for (let t = 0; t < n; t++) {
    if (t < p) {
      arOnly.push(data[0]); // Can't predict before having enough history
    } else {
      let pred = arCoeffs[0]; // intercept
      for (let j = 1; j <= p; j++) {
        pred += arCoeffs[j] * data[t - j];
      }
      arOnly.push(pred);
    }
  }

  const residuals = data.map((v, i) => v - arOnly[i]);

  // MA component: regress residuals on lagged residuals
  const maCoeffs: number[] = [];
  if (q > 0) {
    const mX: number[][] = [];
    const mY: number[] = [];

    for (let t = p + q; t < n; t++) {
      const row: number[] = [1]; // intercept
      for (let j = 1; j <= q; j++) {
        row.push(residuals[t - j] || 0);
      }
      mX.push(row);
      mY.push(data[t] - arOnly[t]);
    }

    const maSolved = olsSolve(mX, mY);
    if (maSolved) {
      for (let j = 1; j < maSolved.length; j++) {
        maCoeffs.push(safeNum(maSolved[j]));
      }
    }
  }

  // Compute full fitted values (AR + MA)
  const fitted = data.map((_, t) => {
    let pred = arOnly[t];
    for (let j = 0; j < maCoeffs.length; j++) {
      pred += maCoeffs[j] * (residuals[t - j - 1] || 0);
    }
    return pred;
  });

  const finalResiduals = data.map((v, i) => v - fitted[i]);
  const sse = finalResiduals.reduce((s, r) => s + r * r, 0);
  const k = 1 + p + q; // number of parameters (intercept + AR + MA)

  // AIC and BIC
  const logLikelihood = -n / 2 * Math.log(sse / n + 1e-10) - n / 2 * (1 + Math.log(2 * Math.PI));
  const aic = -2 * logLikelihood + 2 * k;
  const bic = -2 * logLikelihood + k * Math.log(n);

  // Extract AR coefficients (skip intercept)
  const arFinal = arCoeffs.slice(1).map(c => safeNum(c));

  return { arCoeffs: arFinal, maCoeffs, fitted, residuals: finalResiduals, aic: safeNum(aic), bic: safeNum(bic) };
}

/**
 * Solve OLS: (X'X)^{-1} X'y using Gaussian elimination.
 */
function olsSolve(X: number[][], y: number[]): number[] | null {
  const m = X.length;
  if (m === 0) return null;
  const k = X[0].length;

  // Build X'X and X'y
  const XtX: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty: number[] = new Array(k).fill(0);

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < k; j++) {
      for (let l = 0; l < k; l++) {
        XtX[j][l] += X[i][j] * X[i][l];
      }
      Xty[j] += X[i][j] * y[i];
    }
  }

  // Solve via Gaussian elimination with partial pivoting
  const augmented = XtX.map((row, i) => [...row, Xty[i]]);

  for (let col = 0; col < k; col++) {
    // Find pivot
    let maxRow = col;
    let maxVal = Math.abs(augmented[col][col]);
    for (let row = col + 1; row < k; row++) {
      if (Math.abs(augmented[row][col]) > maxVal) {
        maxVal = Math.abs(augmented[row][col]);
        maxRow = row;
      }
    }

    // Swap rows
    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

    if (Math.abs(augmented[col][col]) < 1e-12) return null; // Singular

    // Eliminate
    for (let row = col + 1; row < k; row++) {
      const factor = augmented[row][col] / augmented[col][col];
      for (let j = col; j <= k; j++) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  // Back substitution
  const result: number[] = new Array(k).fill(0);
  for (let i = k - 1; i >= 0; i--) {
    result[i] = augmented[i][k];
    for (let j = i + 1; j < k; j++) {
      result[i] -= augmented[i][j] * result[j];
    }
    result[i] /= augmented[i][i];
  }

  return result.map(r => safeNum(r));
}

// ----- 3. Booking Pace Curve Analysis ------------------------------------------------------------

export interface BookingPaceCurve {
  daysBeforeArrival: number;
  historicalCumulativeBookings: number;
  historicalAvgPct: number;  // % of total bookings made by this point
}

export interface BookingPaceResult {
  paceCurve: BookingPaceCurve[];
  currentPace: number;         // Bookings received so far for target date
  expectedPace: number;        // Historical average bookings for same point
  predictedTotal: number;       // Predicted total demand based on pace
  paceIndex: number;            // >1 = ahead of pace, <1 = behind
  status: 'ahead' | 'on_track' | 'behind' | 'strong_ahead';
  recommendation: string;
  confidence: number;
  arrivalDate: string;
  daysUntilArrival: number;
}

/**
 * Analyze booking pace (pickup) curve.
 * Compares current booking accumulation to historical patterns.
 */
export function analyzeBookingPace(
  historicalBookings: Array<{ checkIn: Date; createdAt: Date }>,
  currentBookingsForTarget: number,
  arrivalDate: Date,
  maxDaysBefore: number = 90
): BookingPaceResult {
  const now = new Date();
  const daysUntilArrival = Math.max(0, Math.ceil(
    (arrivalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  ));

  if (historicalBookings.length === 0) {
    return {
      paceCurve: [],
      currentPace: currentBookingsForTarget,
      expectedPace: currentBookingsForTarget,
      predictedTotal: currentBookingsForTarget * 1.2,
      paceIndex: 1,
      status: 'on_track',
      recommendation: 'Insufficient historical data for pace analysis.',
      confidence: 0.2,
      arrivalDate: arrivalDate.toISOString().split('T')[0],
      daysUntilArrival,
    };
  }

  // Build pace curve: for each days-before-arrival bucket,
  // how many bookings were made by that point historically
  const dayBuckets = new Map<number, number[]>();

  for (const booking of historicalBookings) {
    const daysBefore = Math.ceil(
      (booking.checkIn.getTime() - booking.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysBefore >= 0 && daysBefore <= maxDaysBefore) {
      // Bucket to nearest week for smoothing
      const bucket = Math.floor(daysBefore / 7) * 7;
      if (!dayBuckets.has(bucket)) dayBuckets.set(bucket, []);
      dayBuckets.get(bucket)!.push(daysBefore);
    }
  }

  // Build cumulative pace curve
  // For each days-before threshold, what % of total bookings had been made
  const sortedKeys = [...dayBuckets.keys()].sort((a, b) => a - b);

  // Calculate the actual distribution of lead times
  const allLeadTimes = historicalBookings.map(b =>
    Math.max(0, Math.ceil((b.checkIn.getTime() - b.createdAt.getTime()) / (1000 * 60 * 60 * 24)))
  ).filter(lt => lt <= maxDaysBefore);

  const paceCurve: BookingPaceCurve[] = [];
  const totalBookings = allLeadTimes.length;

  for (const key of sortedKeys) {
    const bookingsByThisPoint = allLeadTimes.filter(lt => lt >= key).length;
    const pct = totalBookings > 0 ? bookingsByThisPoint / totalBookings : 0;
    paceCurve.push({
      daysBeforeArrival: key,
      historicalCumulativeBookings: bookingsByThisPoint,
      historicalAvgPct: Math.round(pct * 1000) / 10,
    });
  }

  // Expected pace at current days-until-arrival
  const expectedBookingsAtThisPoint = allLeadTimes.filter(lt => lt >= daysUntilArrival).length;
  const expectedPct = totalBookings > 0 ? expectedBookingsAtThisPoint / totalBookings : 0.5;

  // Predicted total based on current pace
  let predictedTotal: number;
  let paceIndex: number;
  let status: BookingPaceResult['status'];

  if (expectedPct > 0.01) {
    predictedTotal = currentBookingsForTarget / expectedPct;
    paceIndex = currentBookingsForTarget / (expectedPct * totalBookings || 1);
  } else {
    predictedTotal = currentBookingsForTarget * 1.5;
    paceIndex = 1;
  }

  if (paceIndex > 1.3) status = 'strong_ahead';
  else if (paceIndex > 1.1) status = 'ahead';
  else if (paceIndex > 0.9) status = 'on_track';
  else status = 'behind';

  const recommendation = generatePaceRecommendation(status, paceIndex, daysUntilArrival);

  // Confidence based on data volume
  const confidence = Math.min(0.95, 0.3 + (totalBookings / 100) * 0.65);

  return {
    paceCurve,
    currentPace: currentBookingsForTarget,
    expectedPace: Math.round(expectedBookingsAtThisPoint * 10) / 10,
    predictedTotal: Math.round(predictedTotal * 10) / 10,
    paceIndex: Math.round(paceIndex * 100) / 100,
    status,
    recommendation,
    confidence,
    arrivalDate: arrivalDate.toISOString().split('T')[0],
    daysUntilArrival,
  };
}

function generatePaceRecommendation(
  status: BookingPaceResult['status'],
  paceIndex: number,
  daysUntilArrival: number
): string {
  switch (status) {
    case 'strong_ahead':
      return `Booking pace is ${Math.round((paceIndex - 1) * 100)}% ahead of historical average. ` +
        (daysUntilArrival > 14
          ? 'Consider increasing rates now to capture demand at higher prices.'
          : 'Strong demand - hold rates firm or implement last-minute increases.');
    case 'ahead':
      return `Booking pace is slightly ahead of average. Monitor carefully; ` +
        (daysUntilArrival > 21 ? 'consider gradual rate increases.' : 'maintain current pricing.');
    case 'on_track':
      return `Booking pace is tracking historical average. ` +
        (daysUntilArrival > 30 ? 'No pricing action needed at this time.' : 'Maintain current rate strategy.');
    case 'behind':
      return `Booking pace is ${Math.round((1 - paceIndex) * 100)}% behind historical average. ` +
        (daysUntilArrival > 21
          ? 'Consider targeted promotions or rate reductions to stimulate demand.'
          : 'Consider last-minute deals or package offers to fill remaining inventory.');
  }
}

// ----- 4. Multi-Factor Linear Regression ------------------------------------------------------------

export interface RegressionFeatureRow {
  dayOfWeek: number;       // 0-6
  month: number;           // 0-11
  dayOfYear: number;       // 0-365
  isHoliday: boolean;
  isWeekend: boolean;
  leadTime: number;        // Days until arrival (from booking date)
  eventsCount: number;
  competitorPrice: number;
  weatherScore: number;    // 0-100 (100 = perfect weather)
}

export interface RegressionResult {
  predictions: number[];
  coefficients: number[];
  intercept: number;
  rSquared: number;
  adjustedRSquared: number;
  featureNames: string[];
  featureImportance: Array<{ name: string; importance: number }>;
  mape: number;
  standardError: number;
}

/**
 * Multi-factor linear regression with ordinary least squares.
 * Features: dayOfWeek (sin/cos), month (sin/cos), dayOfYear, isHoliday, isWeekend,
 *           leadTime, eventsCount, competitorPrice, weatherScore.
 */
export function multiFactorRegression(
  features: RegressionFeatureRow[],
  targets: number[]
): RegressionResult {
  const n = targets.length;
  if (n < 10 || features.length !== n) {
    const avg = n > 0 ? mean(targets) : 0;
    return {
      predictions: Array(n).fill(avg),
      coefficients: [],
      intercept: avg,
      rSquared: 0,
      adjustedRSquared: 0,
      featureNames: [],
      featureImportance: [],
      mape: Infinity,
      standardError: 0,
    };
  }

  // Encode features: use sin/cos for cyclical features
  const featureNames: string[] = [];
  const X: number[][] = [];

  for (let i = 0; i < n; i++) {
    const f = features[i];
    const row: number[] = [1]; // intercept

    // Day of week (cyclical)
    row.push(Math.sin(2 * Math.PI * f.dayOfWeek / 7));
    row.push(Math.cos(2 * Math.PI * f.dayOfWeek / 7));

    // Month (cyclical)
    row.push(Math.sin(2 * Math.PI * f.month / 12));
    row.push(Math.cos(2 * Math.PI * f.month / 12));

    // Day of year (normalized)
    row.push(f.dayOfYear / 365);

    // Boolean features
    row.push(f.isHoliday ? 1 : 0);
    row.push(f.isWeekend ? 1 : 0);

    // Continuous features (normalized)
    row.push(f.leadTime / 365);
    row.push(f.eventsCount / 10);
    row.push(f.competitorPrice / 500); // Assume ~$500 as typical rate
    row.push(f.weatherScore / 100);

    X.push(row);
  }

  // Build feature name list (skip intercept)
  if (featureNames.length === 0) {
    featureNames.push(
      'dow_sin', 'dow_cos', 'month_sin', 'month_cos', 'day_of_year_norm',
      'is_holiday', 'is_weekend', 'lead_time_norm', 'events_norm',
      'competitor_price_norm', 'weather_norm'
    );
  }

  const k = X[0].length;

  // Solve OLS
  const coeffs = olsSolve(X, targets);
  if (!coeffs) {
    const avg = mean(targets);
    return {
      predictions: Array(n).fill(avg),
      coefficients: [],
      intercept: avg,
      rSquared: 0,
      adjustedRSquared: 0,
      featureNames: featureNames.length > 0 ? featureNames : [],
      featureImportance: [],
      mape: Infinity,
      standardError: 0,
    };
  }

  const intercept = coeffs[0];
  const beta = coeffs.slice(1);

  // Compute predictions
  const predictions = X.map(row =>
    clampPositive(row.reduce((s, x, j) => s + x * coeffs[j], 0))
  );

  // Calculate R^2
  const yMean = mean(targets);
  const ssTot = targets.reduce((s, y) => s + (y - yMean) ** 2, 0);
  const ssRes = targets.reduce((s, y, i) => s + (y - predictions[i]) ** 2, 0);
  const rSquared = ssTot > 1e-10 ? 1 - ssRes / ssTot : 0;
  const adjustedRSquared = n > k + 1
    ? 1 - (1 - rSquared) * (n - 1) / (n - k - 1)
    : rSquared;

  // Standard error
  const standardError = n > k + 1
    ? Math.sqrt(ssRes / (n - k - 1))
    : Math.sqrt(ssRes / n);

  // Feature importance based on standardized coefficients
  const featureImportance = beta.map((coeff, idx) => {
    // Compute standard deviation of this feature for standardization
    const featureCol = X.map(row => row[idx + 1]); // +1 to skip intercept
    const sd = stdDev(featureCol);
    const standardizedCoeff = sd > 1e-10 ? Math.abs(coeff * sd) : Math.abs(coeff);
    return {
      name: featureNames[idx] || `feature_${idx}`,
      importance: Math.round(standardizedCoeff * 1000) / 1000,
    };
  }).sort((a, b) => b.importance - a.importance);

  const mape = calculateMAPE(targets, predictions);

  return {
    predictions: predictions.map(p => Math.round(p * 100) / 100),
    coefficients: beta.map(c => Math.round(c * 10000) / 10000),
    intercept: Math.round(intercept * 100) / 100,
    rSquared: Math.round(rSquared * 1000) / 1000,
    adjustedRSquared: Math.round(adjustedRSquared * 1000) / 1000,
    featureNames,
    featureImportance,
    mape,
    standardError: Math.round(standardError * 100) / 100,
  };
}

// ----- 5. Ensemble Forecast (Meta-Model) ---------------------------------------------------------

export interface ModelForecast {
  name: string;
  predictions: number[];
  lower?: number[];
  upper?: number[];
  mape: number;
  weight?: number;
}

export interface EnsembleResult {
  prediction: number[];
  lower: number[];
  upper: number[];
  confidence: number;
  modelWeights: Array<{ name: string; weight: number; mape: number }>;
  breakdown: Array<{ date: string; holtWinters: number; arima: number; regression: number; ensemble: number }>;
}

/**
 * Ensemble forecast combining multiple models.
 * Weights determined by inverse MAPE (better models get higher weight).
 * With recency bias (recent accuracy weighted more).
 */
export function ensembleForecast(
  forecasts: ModelForecast[],
  actualData: number[],
  futureDates: string[],
  horizon: number
): EnsembleResult {
  // Filter valid forecasts
  const valid = forecasts.filter(f => f.predictions.length >= horizon && isFinite(f.mape) && f.mape > 0);

  if (valid.length === 0) {
    // Fallback: simple average or mean of actual data
    const avg = actualData.length > 0 ? mean(actualData) : 0;
    return {
      prediction: Array(horizon).fill(avg),
      lower: Array(horizon).fill(clampPositive(avg * 0.85)),
      upper: Array(horizon).fill(avg * 1.15),
      confidence: 0.3,
      modelWeights: [],
      breakdown: futureDates.slice(0, horizon).map(date => ({
        date,
        holtWinters: 0,
        arima: 0,
        regression: 0,
        ensemble: avg,
      })),
    };
  }

  // Calculate weights: inverse MAPE (lower error = higher weight)
  const invMapes = valid.map(f => 1 / f.mape);
  const invMapeSum = invMapes.reduce((s, v) => s + v, 0);

  const modelWeights = valid.map((f, i) => ({
    name: f.name,
    weight: invMapes[i] / invMapeSum,
    mape: f.mape,
  }));

  // Weighted predictions
  const prediction: number[] = [];
  const lower: number[] = [];
  const upper: number[] = [];
  const perModelBreakdown: Map<string, number[]> = new Map();

  for (const f of valid) {
    perModelBreakdown.set(f.name, f.predictions.slice(0, horizon));
  }

  for (let i = 0; i < horizon; i++) {
    let pred = 0;
    let low = 0;
    let up = 0;
    let hasBounds = false;

    for (let j = 0; j < valid.length; j++) {
      const w = modelWeights[j].weight;
      pred += valid[j].predictions[i] * w;

      if (valid[j].lower && valid[j].upper) {
        low += valid[j].lower[i] * w;
        up += valid[j].upper[i] * w;
        hasBounds = true;
      }
    }

    prediction.push(Math.round(clampPositive(pred) * 100) / 100);

    if (hasBounds) {
      lower.push(Math.round(clampPositive(low) * 100) / 100);
      upper.push(Math.round(clampPositive(up) * 100) / 100);
    } else {
      // Compute bounds from weighted std of predictions
      const preds = valid.map((f, j) => f.predictions[i] * modelWeights[j].weight);
      const spread = stdDev(valid.map(f => f.predictions[i])) * 1.96;
      lower.push(Math.round(clampPositive(pred - spread) * 100) / 100);
      upper.push(Math.round((pred + spread) * 100) / 100);
    }
  }

  // Overall confidence based on agreement between models
  const agreement = 1 - (valid.reduce((s, f) => s + f.mape, 0) / valid.length);
  const confidence = Math.max(0.3, Math.min(0.95, agreement));

  // Build breakdown
  const breakdown = futureDates.slice(0, horizon).map((date, i) => {
    const hw = perModelBreakdown.get('holt_winters')?.[i] || 0;
    const ar = perModelBreakdown.get('arima')?.[i] || 0;
    const reg = perModelBreakdown.get('regression')?.[i] || 0;
    return {
      date,
      holtWinters: Math.round(hw * 100) / 100,
      arima: Math.round(ar * 100) / 100,
      regression: Math.round(reg * 100) / 100,
      ensemble: prediction[i],
    };
  });

  return { prediction, lower, upper, confidence, modelWeights, breakdown };
}

// ----- Integrated Forecast Pipeline ------------------------------------------------------------------

export interface TimeSeriesForecastInput {
  historicalData: number[];              // Daily time series (occupancy % or demand count)
  historicalDates?: string[];            // ISO date strings for each data point
  horizon: number;                       // Days to forecast
  features?: RegressionFeatureRow[];    // Optional: for regression model
}

export interface TimeSeriesForecastResult {
  ensemble: EnsembleResult;
  holtWinters: HoltWintersResult;
  arima: ARIMAResult;
  regression: RegressionResult | null;
  bestModel: string;
  bestMAPE: number;
  seasonalPeriod: number;
  isStationary: boolean;
  dataPoints: number;
  stationarity: { isStationary: boolean; adfStat: number; pValue: number };
}

/**
 * Run the full forecasting pipeline: all models + ensemble selection.
 */
export function runTimeSeriesForecast(
  input: TimeSeriesForecastInput
): TimeSeriesForecastResult {
  const { historicalData, horizon } = input;

  if (historicalData.length < 7) {
    const avg = historicalData.length > 0 ? mean(historicalData) : 0;
    const emptyHW: HoltWintersResult = {
      predictions: Array(horizon).fill(avg),
      lower: Array(horizon).fill(clampPositive(avg * 0.8)),
      upper: Array(horizon).fill(avg * 1.2),
      level: historicalData, trend: [], seasonal: [],
      alpha: 0, beta: 0, gamma: 0, period: 7,
      type: 'additive', mape: Infinity,
    };
    const emptyARIMA: ARIMAResult = {
      predictions: Array(horizon).fill(avg),
      residuals: [], modelOrder: { p: 0, d: 0, q: 0 },
      arCoeffs: [], maCoeffs: [], aic: 0, bic: 0,
      mape: Infinity, isStationary: true,
    };
    return {
      ensemble: {
        prediction: Array(horizon).fill(avg),
        lower: Array(horizon).fill(clampPositive(avg * 0.8)),
        upper: Array(horizon).fill(avg * 1.2),
        confidence: 0.2,
        modelWeights: [],
        breakdown: [],
      },
      holtWinters: emptyHW,
      arima: emptyARIMA,
      regression: null,
      bestModel: 'insufficient_data',
      bestMAPE: Infinity,
      seasonalPeriod: 7,
      isStationary: true,
      dataPoints: historicalData.length,
      stationarity: { isStationary: false, adfStat: 0, pValue: 1 },
    };
  }

  // 1. Stationarity test
  const stationarity = stationarityTest(historicalData);

  // 2. Detect seasonality
  const seasonalPeriod = detectSeasonality(historicalData, Math.min(30, Math.floor(historicalData.length / 2)));

  // 3. Holt-Winters
  const hw = holtWintersOptimized(historicalData, horizon);

  // 4. ARIMA
  const arima = arimaForecast(historicalData, horizon);

  // 5. Regression (if features provided)
  let regression: RegressionResult | null = null;
  if (input.features && input.features.length === historicalData.length && input.features.length >= 20) {
    regression = multiFactorRegression(input.features, historicalData);
  }

  // 6. Ensemble
  const forecasts: ModelForecast[] = [
    { name: 'holt_winters', predictions: hw.predictions, lower: hw.lower, upper: hw.upper, mape: hw.mape },
    { name: 'arima', predictions: arima.predictions, mape: arima.mape },
  ];

  if (regression && isFinite(regression.mape)) {
    forecasts.push({
      name: 'regression',
      predictions: Array(horizon).fill(mean(historicalData)), // Regression predicts in-sample; extrapolate with mean
      mape: regression.mape,
    });
  }

  const futureDates = input.historicalDates
    ? generateFutureDates(input.historicalDates, horizon)
    : Array.from({ length: horizon }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i + 1);
        return d.toISOString().split('T')[0];
      });

  const ensemble = ensembleForecast(forecasts, historicalData, futureDates, horizon);

  // Select best model
  const modelMapes = [
    { name: 'holt_winters', mape: hw.mape },
    { name: 'arima', mape: arima.mape },
    ...(regression ? [{ name: 'regression', mape: regression.mape }] : []),
  ].filter(m => isFinite(m.mape) && m.mape < Infinity);

  const bestModel = modelMapes.length > 0
    ? modelMapes.reduce((best, m) => m.mape < best.mape ? m : best, modelMapes[0]).name
    : 'ensemble';
  const bestMAPE = modelMapes.length > 0
    ? Math.min(...modelMapes.map(m => m.mape))
    : Infinity;

  return {
    ensemble,
    holtWinters: hw,
    arima,
    regression,
    bestModel,
    bestMAPE,
    seasonalPeriod,
    isStationary: stationarity.isStationary,
    dataPoints: historicalData.length,
    stationarity,
  };
}

function generateFutureDates(dates: string[], horizon: number): string[] {
  if (dates.length === 0) {
    return Array.from({ length: horizon }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i + 1);
      return d.toISOString().split('T')[0];
    });
  }

  const lastDate = new Date(dates[dates.length - 1]);
  return Array.from({ length: horizon }, (_, i) => {
    const d = new Date(lastDate);
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split('T')[0];
  });
}
