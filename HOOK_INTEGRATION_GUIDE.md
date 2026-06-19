# useStockData Hook Integration Guide

## Overview

The `useStockData` custom React hook provides seamless integration between your React dashboard and the FastAPI backend. It handles:

- 📊 Fetching historical stock data
- 🤖 Fetching AI-powered Gemini analysis
- ⚡ Concurrent parallel requests
- 💾 Intelligent caching (5-minute TTL)
- 🔄 Automatic retry with exponential backoff
- 📈 Timeframe management with debouncing
- ⚠️ Comprehensive error handling

---

## Installation

### 1. Install Dependencies

```bash
npm install axios
```

### 2. Set Environment Variables

Create `.env.local` in your React app root:

```env
# Backend API URL
REACT_APP_API_URL=http://localhost:8000
```

For production:

```env
REACT_APP_API_URL=https://your-api-domain.com
```

---

## Basic Usage

### Simple Example

```tsx
import React from 'react';
import useStockData from './useStockData';

function StockDashboard() {
  // Initialize hook with optional initial stock token
  const { data, fetchStockData, loading, error } = useStockData('AAPL');

  return (
    <div>
      {/* Loading State */}
      {loading && <p>Loading stock data...</p>}

      {/* Error State */}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {/* Success State */}
      {data.history && (
        <div>
          <h2>{data.symbol}</h2>
          <p>Current Price: ${data.history.current_price}</p>
          <p>Change: {data.history.change_percent}%</p>
        </div>
      )}

      {/* AI Analysis */}
      {data.analysis && (
        <div>
          <h3>Gemini AI Analysis</h3>
          <p><strong>Momentum:</strong> {data.analysis.momentum}</p>
          <p><strong>Risks:</strong> {data.analysis.risks}</p>
          <p><strong>Sentiment:</strong> {data.analysis.overall_sentiment}</p>
        </div>
      )}
    </div>
  );
}

export default StockDashboard;
```

---

## Advanced Usage

### With Search and Timeframe Toggle

```tsx
import React, { useState } from 'react';
import useStockData, { useDebounce } from './useStockData';

function AdvancedDashboard() {
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 500);

  // Use debounced value to trigger fetches
  const { data, fetchStockData, setTimeframe, clearError, refetch } =
    useStockData();

  const handleSearch = async (symbol: string) => {
    if (symbol) {
      await fetchStockData(symbol, 'DAILY');
    }
  };

  const handleTimeframeChange = (newTimeframe: string) => {
    setTimeframe(newTimeframe);
  };

  React.useEffect(() => {
    if (debouncedSearch) {
      handleSearch(debouncedSearch);
    }
  }, [debouncedSearch]);

  return (
    <div>
      {/* Search Input */}
      <input
        type="text"
        placeholder="Search stock..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />

      {/* Timeframe Buttons */}
      <div>
        {['DAILY', 'ONE_MINUTE', 'FIVE_MINUTE', 'HOURLY'].map((tf) => (
          <button
            key={tf}
            onClick={() => handleTimeframeChange(tf)}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Refetch Button */}
      <button onClick={refetch}>Refresh</button>

      {/* Error Message with Clear */}
      {data.error && (
        <div style={{ color: 'red' }}>
          {data.error}
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}

      {/* Chart */}
      {data.history && (
        <Chart
          candles={data.history.candles}
          symbol={data.symbol}
        />
      )}

      {/* Insights */}
      {data.analysis && <InsightsPanel analysis={data.analysis} />}
    </div>
  );
}

export default AdvancedDashboard;
```

---

## Return Value

### `data` Object

```typescript
interface StockDataState {
  symbol: string;              // Stock symbol
  history: StockHistoryData | null;  // OHLCV candles
  analysis: GeminiAnalysis | null;   // AI analysis
  loading: boolean;             // Is fetching?
  error: string | null;         // Error message
  lastUpdated: string | null;   // ISO timestamp
}
```

### Available Functions

```typescript
// Fetch specific stock with optional timeframe
await fetchStockData('GOOGL', 'DAILY');

// Refetch current stock
await refetch();

// Change timeframe (debounced)
setTimeframe('1W');

// Clear error message
clearError();
```

---

## Features Explained

### 1. Concurrent Data Fetching

Both historical data and AI analysis are fetched in parallel:

```typescript
// Both run simultaneously
await Promise.all([
  fetchStockHistory(symbolToken, timeframe),
  fetchStockAnalysis(symbol, metrics, history),
]);
```

### 2. Smart Caching

5-minute TTL cache prevents redundant API calls:

```typescript
const cachedHistory = cache.getHistory(`AAPL-DAILY`);
if (cachedHistory) {
  // Use cached data
  return cachedHistory;
}
// Otherwise fetch fresh data
```

### 3. Automatic Retry

Exponential backoff retry for transient failures:

```typescript
// Attempt 1: immediate
// Attempt 2: wait 1000ms
// Attempt 3: wait 2000ms
await retryWithBackoff(fetchFn, 3, 1000);
```

### 4. Debounced Timeframe Changes

Prevents excessive API calls when rapidly switching timeframes:

```typescript
setTimeframe('1W'); // Wait 300ms before fetching
setTimeframe('1M'); // New timeout, cancels previous
```

### 5. Memory Leak Prevention

Proper cleanup on component unmount:

```typescript
useEffect(() => {
  return () => {
    // Cancel pending requests
    abortControllerRef.current?.abort();
    // Clear timers
    clearTimeout(debounceTimerRef.current);
  };
}, []);
```

---

## Error Handling

### Common Error Scenarios

```tsx
function ErrorHandling() {
  const { data, clearError } = useStockData();

  if (data.error) {
    return (
      <div className="error-banner">
        <p>{data.error}</p>
        <button onClick={clearError}>Dismiss</button>

        {/* Specific error messages */}
        {data.error.includes('404') && (
          <p>Stock not found. Check the symbol and try again.</p>
        )}
        {data.error.includes('503') && (
          <p>Service unavailable. Please try again later.</p>
        )}
      </div>
    );
  }

  return null;
}
```

---

## Integration with FinancialDashboard Component

### Complete Example

```tsx
import React from 'react';
import useStockData, { useDebounce } from './useStockData';
import FinancialDashboard from './FinancialDashboard';

function App() {
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 500);

  const {
    data,
    fetchStockData,
    setTimeframe,
    clearError,
    refetch,
  } = useStockData('AAPL');

  React.useEffect(() => {
    if (debouncedSearch) {
      fetchStockData(debouncedSearch, 'DAILY');
    }
  }, [debouncedSearch]);

  return (
    <FinancialDashboard
      stockData={data}
      onSearch={setSearchInput}
      onTimeframeChange={setTimeframe}
      onRefresh={refetch}
      onErrorDismiss={clearError}
    />
  );
}

export default App;
```

---

## Performance Optimization

### Memoization

```tsx
const MemoizedChart = React.memo(({ candles }) => {
  // Only re-renders if candles object changes
  return <Chart data={candles} />;
});
```

### Lazy Loading

```tsx
const ChartComponent = React.lazy(() => import('./Chart'));

function Dashboard() {
  return (
    <React.Suspense fallback={<div>Loading chart...</div>}>
      <ChartComponent />
    </React.Suspense>
  );
}
```

---

## Debugging

All operations log to console:

```
📤 API Request: GET /api/stock/history/AAPL
🔄 Attempt 1/3...
✅ API Response: 200 /api/stock/history/AAPL
✨ Using cached analysis data
✅ Stock data loaded successfully
```

---

## API Endpoints Reference

### GET /api/stock/search

```typescript
const results = await fetch('/api/stock/search?query=AAPL');
```

### GET /api/stock/history/{symbol_token}

```typescript
const history = await fetch('/api/stock/history/AAPL?interval=DAILY&exchange=NSE');
```

### POST /api/stock/analyze

```typescript
const analysis = await fetch('/api/stock/analyze', {
  method: 'POST',
  body: JSON.stringify({ symbol, metrics, recent_history }),
});
```

---

## Troubleshooting

### Issue: CORS Errors

**Solution:** Ensure backend has CORS enabled:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Issue: Slow API Responses

**Solution:** Use caching and increase retry delays:

```typescript
await retryWithBackoff(fetchFn, 3, 2000); // 2s initial delay
```

### Issue: Memory Leaks

**Solution:** Ensure proper cleanup in useEffect cleanup functions.

---

## Best Practices

✅ Always use debounced search for user input
✅ Show loading states during fetch
✅ Display error messages clearly
✅ Cache data to reduce API calls
✅ Handle component unmount properly
✅ Use TypeScript for type safety
✅ Log errors for debugging

---

## Next Steps

1. Integrate hook with your components
2. Test with mock data first
3. Connect to backend API
4. Add error handling UI
5. Implement caching strategy
6. Monitor performance in production

For more info, check the inline code comments in `useStockData.ts`!
