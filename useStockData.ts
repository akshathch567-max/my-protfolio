import { useState, useCallback, useEffect, useRef } from 'react';
import axios, { AxiosInstance } from 'axios';

// ==================== Types & Interfaces ====================

interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StockHistoryData {
  symbol: string;
  token: string;
  timeframe: string;
  candles: CandleData[];
  current_price: number;
  change_percent: number;
}

interface StockMetrics {
  symbol: string;
  current_price: number;
  open_price: number;
  high_price: number;
  low_price: number;
  volume: number;
  pe_ratio?: number;
  market_cap?: string;
}

interface GeminiAnalysis {
  symbol: string;
  momentum: string;
  risks: string;
  performance: string;
  overall_sentiment: string;
  generated_at: string;
}

interface StockDataState {
  symbol: string;
  history: StockHistoryData | null;
  analysis: GeminiAnalysis | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

interface UseStockDataReturn {
  data: StockDataState;
  fetchStockData: (symbolToken: string, timeframe?: string) => Promise<void>;
  refetch: () => Promise<void>;
  clearError: () => void;
  setTimeframe: (timeframe: string) => void;
}

// ==================== API Configuration ====================

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Create Axios instance with default config
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor
  client.interceptors.request.use(
    (config) => {
      console.log(`📤 API Request: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    },
    (error) => {
      console.error('❌ Request error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor
  client.interceptors.response.use(
    (response) => {
      console.log(`✅ API Response: ${response.status} ${response.config.url}`);
      return response;
    },
    (error) => {
      if (error.response) {
        console.error(`❌ API Error: ${error.response.status} - ${error.response.data?.detail}`);
      } else if (error.request) {
        console.error('❌ No response received:', error.request);
      } else {
        console.error('❌ Error:', error.message);
      }
      return Promise.reject(error);
    }
  );

  return client;
};

const apiClient = createApiClient();

// ==================== API Service Functions ====================

/**
 * Fetch historical stock data from backend
 */
const fetchStockHistory = async (
  symbolToken: string,
  interval: string = 'DAILY'
): Promise<StockHistoryData> => {
  try {
    const response = await apiClient.get<StockHistoryData>(
      `/api/stock/history/${symbolToken}`,
      {
        params: {
          interval,
          exchange: 'NSE',
        },
      }
    );
    return response.data;
  } catch (error) {
    throw new Error(
      `Failed to fetch stock history: ${
        axios.isAxiosError(error)
          ? error.response?.data?.detail || error.message
          : 'Unknown error'
      }`
    );
  }
};

/**
 * Fetch Gemini AI analysis for stock
 */
const fetchStockAnalysis = async (
  symbol: string,
  metrics: StockMetrics,
  history: CandleData[],
  additionalContext?: string
): Promise<GeminiAnalysis> => {
  try {
    const response = await apiClient.post<GeminiAnalysis>('/api/stock/analyze', {
      symbol,
      metrics,
      recent_history: history,
      additional_context: additionalContext,
    });
    return response.data;
  } catch (error) {
    throw new Error(
      `Failed to fetch AI analysis: ${
        axios.isAxiosError(error)
          ? error.response?.data?.detail || error.message
          : 'Unknown error'
      }`
    );
  }
};

/**
 * Retry logic with exponential backoff
 */
const retryWithBackoff = async <T,>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries}...`);
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ Attempt ${attempt} failed:`, lastError.message);

      // Don't retry on client errors (4xx)
      if (axios.isAxiosError(error) && error.response?.status && error.response.status < 500) {
        throw error;
      }

      if (attempt < maxRetries) {
        const waitTime = delay * Math.pow(2, attempt - 1);
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
};

// ==================== Cache Management ====================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class DataCache {
  private historyCache: Map<string, CacheEntry<StockHistoryData>> = new Map();
  private analysisCache: Map<string, CacheEntry<GeminiAnalysis>> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  getHistory(key: string): StockHistoryData | null {
    const entry = this.historyCache.get(key);
    if (entry && Date.now() - entry.timestamp < this.TTL) {
      console.log('✨ Using cached history data');
      return entry.data;
    }
    return null;
  }

  setHistory(key: string, data: StockHistoryData): void {
    this.historyCache.set(key, { data, timestamp: Date.now() });
  }

  getAnalysis(key: string): GeminiAnalysis | null {
    const entry = this.analysisCache.get(key);
    if (entry && Date.now() - entry.timestamp < this.TTL) {
      console.log('✨ Using cached analysis data');
      return entry.data;
    }
    return null;
  }

  setAnalysis(key: string, data: GeminiAnalysis): void {
    this.analysisCache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.historyCache.clear();
    this.analysisCache.clear();
  }
}

const cache = new DataCache();

// ==================== Custom Hook: useStockData ====================

/**
 * Custom React Hook for fetching and managing stock data
 *
 * @param initialSymbolToken - Initial stock token to fetch (optional)
 * @returns Object containing stock data, loading state, error state, and fetch functions
 *
 * @example
 * const { data, fetchStockData, loading, error } = useStockData('3045');
 *
 * // Fetch new stock
 * await fetchStockData('3046', '1W');
 *
 * // Refetch current stock
 * await refetch();
 */
export const useStockData = (initialSymbolToken?: string): UseStockDataReturn => {
  // State management
  const [state, setState] = useState<StockDataState>({
    symbol: initialSymbolToken || '',
    history: null,
    analysis: null,
    loading: false,
    error: null,
    lastUpdated: null,
  });

  const [timeframe, setTimeframeState] = useState('DAILY');

  // Refs for cleanup and debouncing
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * Main function to fetch stock data
   */
  const fetchStockData = useCallback(
    async (symbolToken: string, newTimeframe: string = 'DAILY') => {
      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      // Check if already loading same symbol
      if (state.symbol === symbolToken && state.loading) {
        console.log('⏸️  Already loading this stock');
        return;
      }

      setState((prev) => ({
        ...prev,
        symbol: symbolToken,
        loading: true,
        error: null,
      }));

      setTimeframeState(newTimeframe);

      try {
        console.log(`📊 Fetching data for ${symbolToken}...`);

        // Check cache first
        const cacheKey = `${symbolToken}-${newTimeframe}`;
        const cachedHistory = cache.getHistory(cacheKey);
        const cachedAnalysis = cache.getAnalysis(symbolToken);

        let history: StockHistoryData | null = cachedHistory;
        let analysis: GeminiAnalysis | null = cachedAnalysis;

        // Fetch history if not cached
        if (!history) {
          history = await retryWithBackoff(
            () => fetchStockHistory(symbolToken, newTimeframe),
            3,
            1000
          );
          if (isMountedRef.current) {
            cache.setHistory(cacheKey, history);
          }
        }

        // Fetch analysis if not cached
        if (!analysis && history) {
          const metrics: StockMetrics = {
            symbol: history.symbol,
            current_price: history.current_price,
            open_price: history.candles[0]?.open || history.current_price,
            high_price: Math.max(...history.candles.map((c) => c.high)),
            low_price: Math.min(...history.candles.map((c) => c.low)),
            volume: history.candles[history.candles.length - 1]?.volume || 0,
            pe_ratio: undefined,
            market_cap: undefined,
          };

          analysis = await retryWithBackoff(
            () =>
              fetchStockAnalysis(
                symbolToken,
                metrics,
                history!.candles.slice(-30) // Last 30 candles for analysis
              ),
            2,
            2000
          );

          if (isMountedRef.current) {
            cache.setAnalysis(symbolToken, analysis);
          }
        }

        // Update state only if component is still mounted
        if (isMountedRef.current) {
          setState({
            symbol: symbolToken,
            history,
            analysis,
            loading: false,
            error: null,
            lastUpdated: new Date().toISOString(),
          });

          console.log('✅ Stock data loaded successfully');
        }
      } catch (error) {
        if (isMountedRef.current && !abortControllerRef.current?.signal.aborted) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to fetch stock data';

          setState((prev) => ({
            ...prev,
            loading: false,
            error: errorMessage,
          }));

          console.error('❌ Error:', errorMessage);
        }
      }
    },
    [state.symbol, state.loading]
  );

  /**
   * Refetch current stock data
   */
  const refetch = useCallback(async () => {
    if (state.symbol) {
      await fetchStockData(state.symbol, timeframe);
    }
  }, [state.symbol, timeframe, fetchStockData]);

  /**
   * Update timeframe with debouncing
   */
  const setTimeframe = useCallback(
    (newTimeframe: string) => {
      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce fetch by 300ms
      debounceTimerRef.current = setTimeout(() => {
        if (state.symbol) {
          fetchStockData(state.symbol, newTimeframe);
        }
      }, 300);
    },
    [state.symbol, fetchStockData]
  );

  // Initial fetch if symbolToken provided
  useEffect(() => {
    if (initialSymbolToken && !state.history) {
      fetchStockData(initialSymbolToken, timeframe);
    }
  }, []); // Only run on mount

  return {
    data: state,
    fetchStockData,
    refetch,
    clearError,
    setTimeframe,
  };
};

// ==================== Helper Hooks ====================

/**
 * Hook for debounced search input
 */
export const useDebounce = <T,>(value: T, delay: number = 500): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook for API error handling with toast/notification
 */
export const useErrorHandler = () => {
  const handleError = useCallback((error: string | null) => {
    if (error) {
      console.error('📢 User notification:', error);
      // TODO: Integration with toast notification library (e.g., react-toastify)
      // toast.error(error);
    }
  }, []);

  return { handleError };
};

export default useStockData;
