import React, { useState, useMemo } from 'react';
import { Search, TrendingUp, AlertCircle } from 'lucide-react';

// Mock stock data for auto-suggest
const STOCK_SYMBOLS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'DIS', name: 'The Walt Disney Company' },
];

// Mock historical price data
const MOCK_PRICE_DATA = {
  '1D': [
    { time: '09:00', price: 185.2 },
    { time: '10:00', price: 186.5 },
    { time: '11:00', price: 185.8 },
    { time: '12:00', price: 187.3 },
    { time: '13:00', price: 189.1 },
    { time: '14:00', price: 188.7 },
    { time: '15:00', price: 190.5 },
    { time: '16:00', price: 189.8 },
  ],
  '1W': [
    { time: 'Mon', price: 182.5 },
    { time: 'Tue', price: 184.2 },
    { time: 'Wed', price: 183.9 },
    { time: 'Thu', price: 186.1 },
    { time: 'Fri', price: 189.8 },
  ],
  '1M': [
    { time: 'Week 1', price: 175.3 },
    { time: 'Week 2', price: 178.6 },
    { time: 'Week 3', price: 182.4 },
    { time: 'Week 4', price: 189.8 },
  ],
  '1Y': [
    { time: 'Jan', price: 155.2 },
    { time: 'Feb', price: 158.7 },
    { time: 'Mar', price: 162.1 },
    { time: 'Apr', price: 159.8 },
    { time: 'May', price: 165.3 },
    { time: 'Jun', price: 172.5 },
    { time: 'Jul', price: 178.9 },
    { time: 'Aug', price: 181.2 },
    { time: 'Sep', price: 185.6 },
    { time: 'Oct', price: 189.8 },
    { time: 'Nov', price: 188.2 },
    { time: 'Dec', price: 190.5 },
  ],
};

// Mock stock metrics
const MOCK_METRICS = {
  AAPL: {
    open: 188.50,
    high: 192.30,
    low: 187.20,
    close: 189.80,
    peRatio: 28.45,
    marketCap: '3.2T',
    weekHigh: 192.65,
    weekLow: 165.30,
    change: 2.85,
    changePercent: 1.53,
  },
};

// Component: Search Bar with Auto-Suggestions
const SearchBar = ({ onSelect }) => {
  const [searchInput, setSearchInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredStocks = useMemo(() => {
    if (!searchInput) return [];
    return STOCK_SYMBOLS.filter(
      (stock) =>
        stock.symbol.toLowerCase().includes(searchInput.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchInput.toLowerCase())
    ).slice(0, 6);
  }, [searchInput]);

  const handleSelect = (stock) => {
    setSearchInput('');
    setIsOpen(false);
    onSelect(stock);
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search stocks (e.g., AAPL, GOOGL)..."
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition"
        />
      </div>

      {/* Dropdown Suggestions */}
      {isOpen && filteredStocks.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
          {filteredStocks.map((stock) => (
            <button
              key={stock.symbol}
              onClick={() => handleSelect(stock)}
              className="w-full px-4 py-2 text-left hover:bg-gray-700 transition border-b border-gray-700 last:border-b-0"
            >
              <div className="font-semibold text-white">{stock.symbol}</div>
              <div className="text-xs text-gray-400">{stock.name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Component: Navigation Bar
const NavigationBar = ({ onStockSelect, selectedStock }) => {
  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-500" />
            <span className="text-xl font-bold text-white">FinDash</span>
          </div>

          {/* Search Bar */}
          <SearchBar onSelect={onStockSelect} />

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {selectedStock && (
              <div className="text-sm text-gray-400">
                Current: <span className="text-white font-semibold">{selectedStock.symbol}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

// Component: Simple Line Chart (using canvas/SVG alternative to Chart.js)
const LineChart = ({ data, timeframe, onTimeframeChange }) => {
  const timeframes = ['1D', '1W', '1M', '1Y'];
  const currentData = data[timeframe] || data['1D'];

  // Calculate SVG path
  const padding = 40;
  const width = 800;
  const height = 300;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  const minPrice = Math.min(...currentData.map((d) => d.price));
  const maxPrice = Math.max(...currentData.map((d) => d.price));
  const priceRange = maxPrice - minPrice || 1;

  const points = currentData.map((d, i) => ({
    x: padding + (i / (currentData.length - 1)) * graphWidth,
    y: height - padding - ((d.price - minPrice) / priceRange) * graphHeight,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const priceChange = currentData[currentData.length - 1].price - currentData[0].price;
  const priceChangePercent = (priceChange / currentData[0].price) * 100;
  const isPositive = priceChange >= 0;

  return (
    <div className="bg-gray-800 rounded-lg p-6 col-span-2">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">AAPL Stock Price</h3>
          <div className={`text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
          </div>
        </div>

        {/* Timeframe Buttons */}
        <div className="flex gap-2">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                timeframe === tf
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <svg width="100%" height="300" viewBox={`0 0 ${width} ${height}`} className="bg-gray-900 rounded">
        {/* Grid Lines */}
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={`grid-${i}`}
            x1={padding}
            y1={padding + (i / 4) * (height - padding * 2)}
            x2={width - padding}
            y2={padding + (i / 4) * (height - padding * 2)}
            stroke="#374151"
            strokeDasharray="4"
            strokeWidth="1"
          />
        ))}

        {/* Price Line */}
        <path d={pathD} stroke="#3b82f6" strokeWidth="2" fill="none" />

        {/* Area under curve */}
        <path
          d={`${pathD} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`}
          fill="url(#gradient)"
          opacity="0.1"
        />

        {/* Gradient Definition */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Data Points */}
        {points.map((p, i) => (
          <circle key={`point-${i}`} cx={p.x} cy={p.y} r="3" fill="#3b82f6" />
        ))}

        {/* Y-axis Labels */}
        {[0, 1, 2, 3, 4].map((i) => (
          <text
            key={`label-${i}`}
            x={padding - 10}
            y={height - padding - (i / 4) * (height - padding * 2) + 4}
            textAnchor="end"
            fontSize="12"
            fill="#9ca3af"
          >
            ${(minPrice + (i / 4) * priceRange).toFixed(0)}
          </text>
        ))}

        {/* X-axis Labels */}
        {currentData.map((d, i) => (
          <text
            key={`x-label-${i}`}
            x={padding + (i / (currentData.length - 1)) * (width - padding * 2)}
            y={height - 10}
            textAnchor="middle"
            fontSize="12"
            fill="#9ca3af"
          >
            {d.time}
          </text>
        ))}
      </svg>
    </div>
  );
};

// Component: Gemini Financial Insights Panel
const GeminiInsights = () => {
  return (
    <div className="bg-gray-800 rounded-lg p-6 col-span-1">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-semibold text-white">Gemini Financial Insights</h3>
      </div>

      <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
        <div>
          <h4 className="text-blue-400 font-semibold mb-2">📈 Current Momentum</h4>
          <p>
            Apple stock is showing strong bullish momentum with a 1.53% gain today. The price
            has broken above its 50-day moving average, indicating sustained buying interest from
            institutional investors.
          </p>
        </div>

        <div>
          <h4 className="text-yellow-400 font-semibold mb-2">⚠️ Risk Factors</h4>
          <p>
            Potential headwinds include increased competition in the smartphone market and supply
            chain disruptions. Keep an eye on upcoming earnings reports which could impact the
            stock direction.
          </p>
        </div>

        <div>
          <h4 className="text-green-400 font-semibold mb-2">✅ Performance Overview</h4>
          <p>
            AAPL has outperformed the S&P 500 by 8% over the last 12 months. Strong ecosystem
            loyalty and services revenue growth remain key drivers for long-term appreciation.
          </p>
        </div>

        <div className="bg-gray-900 p-3 rounded border border-gray-700 mt-4">
          <p className="text-xs text-gray-400">
            💡 <span className="text-gray-300 ml-2">Disclaimer: This is AI-generated analysis for educational purposes only. Not financial advice.</span>
          </p>
        </div>
      </div>
    </div>
  );
};

// Component: Metrics Grid
const MetricsGrid = ({ metrics }) => {
  const metricsList = [
    { label: 'Open', value: `$${metrics.open.toFixed(2)}` },
    { label: 'High', value: `$${metrics.high.toFixed(2)}` },
    { label: 'Low', value: `$${metrics.low.toFixed(2)}` },
    { label: 'Close', value: `$${metrics.close.toFixed(2)}` },
    { label: 'P/E Ratio', value: metrics.peRatio.toFixed(2) },
    { label: 'Market Cap', value: metrics.marketCap },
    { label: '52W High', value: `$${metrics.weekHigh.toFixed(2)}` },
    { label: '52W Low', value: `$${metrics.weekLow.toFixed(2)}` },
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-6 col-span-2">
      <h3 className="text-lg font-semibold text-white mb-6">Key Metrics</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricsList.map((metric) => (
          <div key={metric.label} className="bg-gray-900 p-4 rounded-lg border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">{metric.label}</p>
            <p className="text-lg font-bold text-white">{metric.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main Dashboard Component
export default function FinancialDashboard() {
  const [timeframe, setTimeframe] = useState('1D');
  const [selectedStock, setSelectedStock] = useState({ symbol: 'AAPL', name: 'Apple Inc.' });

  const handleStockSelect = (stock) => {
    setSelectedStock(stock);
    // TODO: Fetch real data from backend API
    console.log('Selected stock:', stock);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation */}
      <NavigationBar onStockSelect={handleStockSelect} selectedStock={selectedStock} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero Section with Chart and Insights */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Chart */}
          <LineChart
            data={MOCK_PRICE_DATA}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
          />

          {/* Sidebar Insights */}
          <GeminiInsights />
        </div>

        {/* Metrics Grid */}
        <MetricsGrid metrics={MOCK_METRICS.AAPL} />
      </main>
    </div>
  );
}
