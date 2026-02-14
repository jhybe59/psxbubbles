"""
Signal Router
Publishes signals to Redis channels for consumption by Node.js.

Channels:
- signals.raw.<symbol>    - Raw unfiltered signals
- signals.live.<symbol>   - Filtered trade signals
- signals.ui.<symbol>     - UI-optimized feed
"""
import json
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any
import redis.asyncio as aioredis
import structlog

from fusion.ensemble import FusedSignal
from fusion.decision_engine import TradeDecision

logger = structlog.get_logger()


class SignalRouter:
    """
    Routes signals to appropriate Redis channels.
    """
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self.redis: Optional[aioredis.Redis] = None
        
        # Stats
        self.signals_published = 0
        self.last_publish_time: Dict[str, datetime] = {}
    
    async def connect(self) -> bool:
        """Connect to Redis."""
        try:
            self.redis = aioredis.from_url(self.redis_url)
            await self.redis.ping()
            logger.info("signal_router_connected")
            return True
        except Exception as e:
            logger.error("signal_router_connect_failed", error=str(e))
            return False
    
    async def close(self) -> None:
        """Close Redis connection."""
        if self.redis:
            await self.redis.close()
            logger.info("signal_router_closed")
    
    async def publish_raw_signal(
        self,
        symbol: str,
        signal: FusedSignal
    ) -> bool:
        """Publish raw signal (before filtering)."""
        if not self.redis:
            return False
        
        try:
            channel = f"signals.raw.{symbol}"
            message = self._format_signal(symbol, signal)
            await self.redis.publish(channel, json.dumps(message))
            return True
        except Exception as e:
            logger.warning("raw_signal_publish_failed", error=str(e))
            return False
    
    async def publish_live_signal(
        self,
        symbol: str,
        decision: TradeDecision
    ) -> bool:
        """Publish filtered live signal for execution."""
        if not self.redis:
            return False
        
        try:
            channel = f"signals.live.{symbol}"
            message = self._format_decision(decision)
            await self.redis.publish(channel, json.dumps(message))
            
            self.signals_published += 1
            self.last_publish_time[symbol] = datetime.now()
            
            logger.info("live_signal_published",
                       symbol=symbol,
                       action=decision.action)
            return True
        except Exception as e:
            logger.warning("live_signal_publish_failed", error=str(e))
            return False
    
    async def publish_ui_signal(
        self,
        symbol: str,
        signal: FusedSignal,
        decision: Optional[TradeDecision] = None
    ) -> bool:
        """Publish UI-optimized signal for frontend display."""
        if not self.redis:
            return False
        
        try:
            channel = f"signals.ui.{symbol}"
            message = self._format_ui_signal(symbol, signal, decision)
            await self.redis.publish(channel, json.dumps(message))
            return True
        except Exception as e:
            logger.warning("ui_signal_publish_failed", error=str(e))
            return False
    
    async def broadcast_regime(self, regime: str, confidence: float) -> bool:
        """Broadcast current market regime."""
        if not self.redis:
            return False
        
        try:
            message = {
                'type': 'regime',
                'regime': regime,
                'confidence': confidence,
                'timestamp': datetime.now().isoformat()
            }
            await self.redis.publish("market.regime", json.dumps(message))
            return True
        except Exception as e:
            logger.warning("regime_broadcast_failed", error=str(e))
            return False
    
    def _format_signal(self, symbol: str, signal: FusedSignal) -> dict:
        """Format FusedSignal for transmission."""
        return {
            'type': 'signal',
            'symbol': symbol,
            'timestamp': datetime.now().isoformat(),
            'signal_strength': signal.signal_strength,
            'direction': signal.direction,
            'confidence': signal.confidence,
            'regime': signal.regime,
            'action': signal.action,
            'agreement': signal.agreement_score,
            'agents': {
                name: {
                    'strength': s.signal_strength,
                    'confidence': s.confidence
                }
                for name, s in signal.agent_signals.items()
            }
        }
    
    def _format_decision(self, decision: TradeDecision) -> dict:
        """Format TradeDecision for transmission."""
        return {
            'type': 'decision',
            'symbol': decision.symbol,
            'timestamp': decision.timestamp.isoformat(),
            'action': decision.action,
            'signal_strength': decision.signal_strength,
            'confidence': decision.confidence,
            'position_size_pct': decision.position_size_pct,
            'risk_pct': decision.risk_pct,
            'entry_price': decision.entry_price,
            'stop_loss': decision.stop_loss,
            'take_profit': decision.take_profit,
            'regime': decision.regime,
            'reason': decision.reason
        }
    
    def _format_ui_signal(
        self,
        symbol: str,
        signal: FusedSignal,
        decision: Optional[TradeDecision]
    ) -> dict:
        """Format signal for UI display (compact)."""
        base = {
            'type': 'ui_signal',
            'symbol': symbol,
            'ts': datetime.now().isoformat(),
            'str': round(signal.signal_strength, 2),
            'dir': signal.direction,
            'conf': round(signal.confidence, 2),
            'regime': signal.regime,
            'action': signal.action
        }
        
        if decision and decision.action not in ['hold']:
            base['trade'] = {
                'action': decision.action,
                'size': decision.position_size_pct,
                'sl': decision.stop_loss,
                'tp': decision.take_profit
            }
        
        return base
    
    def get_stats(self) -> dict:
        """Get router statistics."""
        return {
            'signals_published': self.signals_published,
            'last_publish': {
                k: v.isoformat() 
                for k, v in self.last_publish_time.items()
            }
        }


# Singleton
from config import settings
signal_router = SignalRouter(redis_url=settings.redis_url)
