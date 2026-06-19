"""
Financial Dashboard FastAPI Backend
Integrates Angel One SmartAPI for stock data and Google Gemini for AI analysis
"""

import os
import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv
import logging

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Third-party imports
import requests
import google.generativeai as genai
from smartapi import SmartConnect
from smartapi.utils import SmartConnectException

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== Configuration ====================

API_KEY_ANGEL_ONE = os.getenv("ANGEL_ONE_API_KEY")
CLIENT_CODE_ANGEL_ONE = os.getenv("ANGEL_ONE_CLIENT_CODE")
PASSWORD_ANGEL_ONE = os.getenv("ANGEL_ONE_PASSWORD")
TOTP_ANGEL_ONE = os.getenv("ANGEL_ONE_TOTP")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Validate required credentials
if not all([API_KEY_ANGEL_ONE, CLIENT_CODE_ANGEL_ONE, PASSWORD_ANGEL_ONE, GEMINI_API_KEY]):
    logger.warning("Missing required environment variables. Some features may not work.")

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# ==================== FastAPI App Setup ====================

app = FastAPI(
    title="Financial Dashboard API",
    description="Backend API for stock data and AI-powered financial analysis",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Restrict to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Pydantic Models ====================

class StockSearchResult(BaseModel):
    """Model for stock search results"""
    symbol: str
    name: str
    token: str
    exchange: str
    instrument_type: str


class CandleData(BaseModel):
    """Model for OHLCV candlestick data"""
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: int


class StockHistoryResponse(BaseModel):
    """Response model for historical stock data"""
    symbol: str
    token: str
    timeframe: str
    candles: List[CandleData]
    current_price: float
    change_percent: float


class StockMetrics(BaseModel):
    """Basic stock metrics for analysis"""
    symbol: str
    current_price: float
    open_price: float
    high_price: float
    low_price: float
    volume: int
    pe_ratio: Optional[float] = None
    market_cap: Optional[str] = None


class AnalysisRequest(BaseModel):
    """Request model for stock analysis"""
    symbol: str
    metrics: StockMetrics
    recent_history: List[CandleData]
    additional_context: Optional[str] = None


class GeminiAnalysisResponse(BaseModel):
    """Response model for Gemini analysis"""
    symbol: str
    momentum: str
    risks: str
    performance: str
    overall_sentiment: str
    generated_at: str


# ==================== Angel One SmartAPI Integration ====================

class AngelOneConnector:
    """Handles Angel One SmartAPI connections and requests"""

    def __init__(self):
        self.client = None
        self.auth_token = None
        self.feed_token = None
        self.instrument_list = None

    def authenticate(self) -> bool:
        """Authenticate with Angel One SmartAPI"""
        try:
            self.client = SmartConnect(api_key=API_KEY_ANGEL_ONE)
            
            # Generate session using credentials
            session_data = self.client.generateSession(
                clientcode=CLIENT_CODE_ANGEL_ONE,
                password=PASSWORD_ANGEL_ONE,
                totp=TOTP_ANGEL_ONE
            )

            if session_data and session_data.get("status"):
                self.auth_token = session_data.get("data", {}).get("jwtToken")
                self.feed_token = session_data.get("data", {}).get("feedToken")
                logger.info("✓ Angel One authentication successful")
                return True
            else:
                logger.error("✗ Angel One authentication failed")
                return False

        except SmartConnectException as e:
            logger.error(f"SmartAPI Exception: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return False

    def get_instrument_list(self) -> List[Dict]:
        """Fetch the instrument list from Angel One"""
        try:
            # Typically fetched from Angel One's data API
            # This is a mock implementation - replace with actual API call
            response = requests.get(
                "https://api.angelone.in/rest/secure/angelbroking/instruments/",
                headers={"Authorization": f"Bearer {self.auth_token}"}
            )
            if response.status_code == 200:
                self.instrument_list = response.json()
                logger.info(f"✓ Fetched {len(self.instrument_list)} instruments")
                return self.instrument_list
            else:
                logger.error("Failed to fetch instrument list")
                return []
        except Exception as e:
            logger.error(f"Error fetching instruments: {str(e)}")
            return []

    def search_instruments(self, query: str) -> List[Dict]:
        """Search for instruments matching the query"""
        if not self.instrument_list:
            self.get_instrument_list()

        query_lower = query.lower()
        results = []

        for instrument in self.instrument_list:
            if (query_lower in instrument.get("symbol", "").lower() or
                query_lower in instrument.get("name", "").lower()):
                results.append(instrument)

        return results[:10]  # Return top 10 results

    def get_candle_data(
        self,
        symbol_token: str,
        interval: str = "ONE_MINUTE",
        exchange: str = "NSE"
    ) -> List[Dict]:
        """
        Fetch candlestick data from Angel One
        interval: ONE_MINUTE, FIVE_MINUTE, FIFTEEN_MINUTE, THIRTY_MINUTE, SIXTY_MINUTE, DAILY, WEEKLY, MONTHLY
        """
        try:
            if not self.client:
                self.authenticate()

            # Request historical candle data
            candle_data = self.client.getCandleData(
                mode="LTP",
                exchangeTokens={
                    exchange: [symbol_token]
                },
                interval=interval,
                fromdate=datetime.now() - timedelta(days=30),
                todate=datetime.now()
            )

            if candle_data and candle_data.get("status"):
                return candle_data.get("data", {}).get(exchange, {}).get(symbol_token, [])
            else:
                logger.error(f"Failed to fetch candle data for {symbol_token}")
                return []

        except SmartConnectException as e:
            logger.error(f"SmartAPI Exception: {str(e)}")
            return []
        except Exception as e:
            logger.error(f"Error fetching candle data: {str(e)}")
            return []


# Initialize Angel One connector (singleton pattern)
angel_one = AngelOneConnector()

# ==================== API Endpoints ====================

@app.on_event("startup")
async def startup_event():
    """Initialize connections on app startup"""
    logger.info("🚀 Starting Financial Dashboard API...")
    # Optionally authenticate on startup
    # angel_one.authenticate()


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }


@app.get("/api/stock/search", response_model=List[StockSearchResult])
async def search_stocks(query: str = Query(..., min_length=1, max_length=50)):
    """
    Search for stocks matching the query
    
    Query can be stock symbol or name
    Example: /api/stock/search?query=AAPL
    """
    try:
        if not angel_one.client:
            if not angel_one.authenticate():
                raise HTTPException(
                    status_code=503,
                    detail="Failed to connect to Angel One API"
                )

        results = angel_one.search_instruments(query)

        if not results:
            raise HTTPException(
                status_code=404,
                detail=f"No stocks found for query: {query}"
            )

        # Format results
        formatted_results = [
            StockSearchResult(
                symbol=result.get("symbol", "N/A"),
                name=result.get("name", "N/A"),
                token=result.get("token", "N/A"),
                exchange=result.get("exchange", "NSE"),
                instrument_type=result.get("instrumenttype", "N/A")
            )
            for result in results
        ]

        logger.info(f"✓ Found {len(formatted_results)} results for '{query}'")
        return formatted_results

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@app.get("/api/stock/history/{symbol_token}", response_model=StockHistoryResponse)
async def get_stock_history(
    symbol_token: str,
    interval: str = Query("DAILY", regex="^(ONE_MINUTE|FIVE_MINUTE|FIFTEEN_MINUTE|THIRTY_MINUTE|SIXTY_MINUTE|DAILY|WEEKLY|MONTHLY)$"),
    exchange: str = Query("NSE", regex="^(NSE|BSE)$")
):
    """
    Fetch historical OHLCV candlestick data for a stock
    
    Args:
        symbol_token: Token identifier from Angel One
        interval: Timeframe for candles (default: DAILY)
        exchange: Stock exchange (NSE or BSE)
    
    Example: /api/stock/history/3045?interval=DAILY&exchange=NSE
    """
    try:
        if not angel_one.client:
            if not angel_one.authenticate():
                raise HTTPException(
                    status_code=503,
                    detail="Failed to connect to Angel One API"
                )

        # Fetch candlestick data
        candle_data = angel_one.get_candle_data(
            symbol_token=symbol_token,
            interval=interval,
            exchange=exchange
        )

        if not candle_data:
            raise HTTPException(
                status_code=404,
                detail=f"No data found for token {symbol_token}"
            )

        # Format candle data
        formatted_candles = [
            CandleData(
                timestamp=candle[0] if isinstance(candle[0], str) else datetime.fromtimestamp(candle[0]).isoformat(),
                open=float(candle[1]),
                high=float(candle[2]),
                low=float(candle[3]),
                close=float(candle[4]),
                volume=int(candle[5]) if len(candle) > 5 else 0
            )
            for candle in candle_data
        ]

        if not formatted_candles:
            raise HTTPException(status_code=404, detail="No candlestick data available")

        # Calculate price change
        first_price = formatted_candles[0].open
        last_price = formatted_candles[-1].close
        change_percent = ((last_price - first_price) / first_price * 100) if first_price > 0 else 0

        logger.info(f"✓ Fetched {len(formatted_candles)} candles for {symbol_token}")

        return StockHistoryResponse(
            symbol=symbol_token,
            token=symbol_token,
            timeframe=interval,
            candles=formatted_candles,
            current_price=last_price,
            change_percent=round(change_percent, 2)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"History fetch error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")


@app.post("/api/stock/analyze", response_model=GeminiAnalysisResponse)
async def analyze_stock(request: AnalysisRequest):
    """
    Analyze stock using Google Gemini AI
    
    Takes recent price history and metrics, generates investment analysis
    """
    try:
        if not GEMINI_API_KEY:
            raise HTTPException(
                status_code=503,
                detail="Gemini API not configured"
            )

        # Prepare data for analysis
        price_trend = "📈 Uptrend" if request.metrics.current_price >= request.metrics.open_price else "📉 Downtrend"
        
        # Calculate moving averages and other metrics
        close_prices = [candle.close for candle in request.recent_history]
        avg_volume = sum([candle.volume for candle in request.recent_history]) / len(request.recent_history) if request.recent_history else 0
        price_range = max(close_prices) - min(close_prices) if close_prices else 0

        # Construct prompt for Gemini
        analysis_prompt = f"""
        Analyze the following stock and provide investment insights:
        
        Stock: {request.symbol}
        Current Price: ${request.metrics.current_price}
        Open: ${request.metrics.open_price}
        High: ${request.metrics.high_price}
        Low: ${request.metrics.low_price}
        Volume: {request.metrics.volume:,}
        P/E Ratio: {request.metrics.pe_ratio or 'N/A'}
        Market Cap: {request.metrics.market_cap or 'N/A'}
        
        Price Trend: {price_trend}
        Average Volume: {int(avg_volume):,}
        Price Range (30d): ${price_range:.2f}
        
        {f"Additional Context: {request.additional_context}" if request.additional_context else ""}
        
        Please provide:
        1. MOMENTUM: Current market momentum and trend analysis
        2. RISKS: Potential risk factors and concerns
        3. PERFORMANCE: Recent performance and future outlook
        4. SENTIMENT: Overall investment sentiment (Bullish/Bearish/Neutral)
        
        Format your response as JSON with keys: momentum, risks, performance, sentiment
        """

        # Call Gemini API
        model = genai.GenerativeModel("gemini-pro")
        response = model.generate_content(analysis_prompt)

        # Parse response
        analysis_text = response.text
        
        # Try to extract JSON from response
        try:
            # Find JSON in response
            json_start = analysis_text.find('{')
            json_end = analysis_text.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = analysis_text[json_start:json_end]
                analysis_data = json.loads(json_str)
            else:
                # If no JSON found, create structured response
                analysis_data = {
                    "momentum": analysis_text[:500],
                    "risks": "See analysis",
                    "performance": "See analysis",
                    "sentiment": "Neutral"
                }
        except json.JSONDecodeError:
            logger.warning("Could not parse JSON from Gemini response")
            analysis_data = {
                "momentum": analysis_text[:500],
                "risks": "Analysis provided in momentum section",
                "performance": "Analysis provided in momentum section",
                "sentiment": "Neutral"
            }

        logger.info(f"✓ Analysis completed for {request.symbol}")

        return GeminiAnalysisResponse(
            symbol=request.symbol,
            momentum=analysis_data.get("momentum", "N/A"),
            risks=analysis_data.get("risks", "N/A"),
            performance=analysis_data.get("performance", "N/A"),
            overall_sentiment=analysis_data.get("sentiment", "Neutral"),
            generated_at=datetime.now().isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )


@app.get("/api/stock/suggest")
async def suggest_stocks():
    """
    Return a list of suggested popular stocks
    """
    suggestions = [
        {"symbol": "AAPL", "name": "Apple Inc.", "token": "3045", "exchange": "NSE"},
        {"symbol": "GOOGL", "name": "Alphabet Inc.", "token": "3046", "exchange": "NSE"},
        {"symbol": "MSFT", "name": "Microsoft Corporation", "token": "3047", "exchange": "NSE"},
        {"symbol": "AMZN", "name": "Amazon.com Inc.", "token": "3048", "exchange": "NSE"},
        {"symbol": "TSLA", "name": "Tesla Inc.", "token": "3049", "exchange": "NSE"},
    ]
    return suggestions


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {str(exc)}")
    return {
        "status": "error",
        "message": "Internal server error",
        "detail": str(exc)
    }


# ==================== Main ====================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
