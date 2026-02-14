"""
Regime Auditor (Phase 7.5 Discipline)
The DISCIPLINE ENFORCEMENT of the trading system.

Verifies that regime rules are being followed.
Logs violations. Creates behavioral report.

Without discipline, the system is dangerous.
"""
from datetime import datetime
from typing import Optional, Dict, List, Any
from dataclasses import dataclass
from enum import Enum
import structlog

from regime_strategy import (
    regime_strategy, 
    RegimeRules, 
    TradePermission,
    Regime
)

logger = structlog.get_logger()


class ViolationType(str, Enum):
    """Types of rule violations."""
    TRADE_IN_PANIC = "trade_in_panic"
    TRADE_IN_COMPRESSION = "trade_in_compression"
    OVERSIZED_IN_CHOP = "oversized_in_chop"
    UNDERSIZED_IN_BREAKOUT = "undersized_in_breakout"
    LOW_CONFIDENCE_TRADE = "low_confidence_trade"
    RISK_OFF_IGNORED = "risk_off_ignored"


@dataclass
class Violation:
    """Record of a rule violation."""
    violation_id: str
    timestamp: datetime
    regime: str
    violation_type: ViolationType
    expected: str
    actual: str
    signal_id: Optional[str] = None
    symbol: Optional[str] = None
    severity: str = "warning"  # 'warning', 'critical'
    
    def to_dict(self) -> dict:
        return {
            'violation_id': self.violation_id,
            'timestamp': self.timestamp.isoformat(),
            'regime': self.regime,
            'violation_type': self.violation_type.value,
            'expected': self.expected,
            'actual': self.actual,
            'signal_id': self.signal_id,
            'symbol': self.symbol,
            'severity': self.severity
        }


@dataclass
class AuditReport:
    """Regime audit report."""
    period_start: datetime
    period_end: datetime
    
    # Activity
    total_signals: int = 0
    total_trades: int = 0
    
    # Compliance
    violations: int = 0
    critical_violations: int = 0
    discipline_score: float = 1.0
    
    # Regime breakdown
    regime_distribution: Dict[str, int] = None
    regime_compliance: Dict[str, float] = None
    
    # Violations by type
    violations_by_type: Dict[str, int] = None
    
    def to_dict(self) -> dict:
        return {
            'period_start': self.period_start.isoformat(),
            'period_end': self.period_end.isoformat(),
            'total_signals': self.total_signals,
            'total_trades': self.total_trades,
            'violations': self.violations,
            'critical_violations': self.critical_violations,
            'discipline_score': round(self.discipline_score, 3),
            'regime_distribution': self.regime_distribution or {},
            'regime_compliance': self.regime_compliance or {},
            'violations_by_type': self.violations_by_type or {}
        }


class RegimeAuditor:
    """
    Regime Discipline Auditor.
    
    Checks every trade decision against regime rules.
    Logs violations. Creates compliance reports.
    
    Regime Rules:
    - PANIC: No trades allowed
    - COMPRESSION: No trades allowed
    - CHOP: Small size only (≤3%)
    - BREAKOUT: Aggressive allowed (≥5%)
    - TRENDING: Normal trading
    """
    
    # Rules enforcement
    PANIC_TRADE_ALLOWED = False
    COMPRESSION_TRADE_ALLOWED = False
    MAX_SIZE_IN_CHOP = 0.03        # 3%
    MIN_SIZE_IN_BREAKOUT = 0.05   # 5%
    
    def __init__(self):
        self.violations: List[Violation] = []
        self.max_violations = 1000
        
        # Activity tracking
        self._signal_count = 0
        self._trade_count = 0
        self._regime_counts: Dict[str, int] = {}
        self._regime_violations: Dict[str, int] = {}
        
        self._violation_counter = 0
        
        logger.info("regime_auditor_initialized")
    
    # ==================== RULE CHECKING ====================
    
    def check_trade(
        self,
        regime: str,
        action: str,            # 'long', 'short', 'hold', 'close'
        position_size_pct: float,
        confidence: float,
        signal_id: Optional[str] = None,
        symbol: Optional[str] = None
    ) -> Optional[Violation]:
        """
        Check if a trade decision violates regime rules.
        
        Returns Violation if rule broken, None if compliant.
        """
        self._signal_count += 1
        self._regime_counts[regime] = self._regime_counts.get(regime, 0) + 1
        
        # Track trades (not holds)
        if action in ['long', 'short']:
            self._trade_count += 1
        
        violation = None
        
        # Check PANIC regime
        if regime == Regime.PANIC.value:
            if action in ['long', 'short']:
                violation = self._create_violation(
                    regime=regime,
                    violation_type=ViolationType.TRADE_IN_PANIC,
                    expected="No trades",
                    actual=f"Attempted {action}",
                    signal_id=signal_id,
                    symbol=symbol,
                    severity="critical"
                )
        
        # Check COMPRESSION regime
        elif regime == Regime.COMPRESSION.value:
            if action in ['long', 'short']:
                violation = self._create_violation(
                    regime=regime,
                    violation_type=ViolationType.TRADE_IN_COMPRESSION,
                    expected="No trades (prepare only)",
                    actual=f"Attempted {action}",
                    signal_id=signal_id,
                    symbol=symbol,
                    severity="warning"
                )
        
        # Check CHOP regime - size limit
        elif regime == Regime.CHOP.value:
            if action in ['long', 'short'] and position_size_pct > self.MAX_SIZE_IN_CHOP * 100:
                violation = self._create_violation(
                    regime=regime,
                    violation_type=ViolationType.OVERSIZED_IN_CHOP,
                    expected=f"Size ≤ {self.MAX_SIZE_IN_CHOP*100:.0f}%",
                    actual=f"Size = {position_size_pct:.1f}%",
                    signal_id=signal_id,
                    symbol=symbol,
                    severity="warning"
                )
        
        # Check BREAKOUT regime - minimum size
        elif regime == Regime.BREAKOUT.value:
            if action in ['long', 'short'] and position_size_pct < self.MIN_SIZE_IN_BREAKOUT * 100:
                violation = self._create_violation(
                    regime=regime,
                    violation_type=ViolationType.UNDERSIZED_IN_BREAKOUT,
                    expected=f"Size ≥ {self.MIN_SIZE_IN_BREAKOUT*100:.0f}%",
                    actual=f"Size = {position_size_pct:.1f}%",
                    signal_id=signal_id,
                    symbol=symbol,
                    severity="warning"
                )
        
        # Check confidence thresholds
        rules = regime_strategy.get_rules(regime)
        if action in ['long', 'short'] and confidence < rules.min_confidence:
            violation = violation or self._create_violation(
                regime=regime,
                violation_type=ViolationType.LOW_CONFIDENCE_TRADE,
                expected=f"Confidence ≥ {rules.min_confidence:.0%}",
                actual=f"Confidence = {confidence:.0%}",
                signal_id=signal_id,
                symbol=symbol,
                severity="warning"
            )
        
        # Check RISK_OFF permission
        if rules.permission == TradePermission.RISK_OFF:
            if action in ['long', 'short']:
                violation = self._create_violation(
                    regime=regime,
                    violation_type=ViolationType.RISK_OFF_IGNORED,
                    expected="No trades (risk off)",
                    actual=f"Attempted {action}",
                    signal_id=signal_id,
                    symbol=symbol,
                    severity="critical"
                )
        
        return violation
    
    def _create_violation(
        self,
        regime: str,
        violation_type: ViolationType,
        expected: str,
        actual: str,
        signal_id: Optional[str],
        symbol: Optional[str],
        severity: str
    ) -> Violation:
        """Create and log a violation."""
        self._violation_counter += 1
        
        violation = Violation(
            violation_id=f"V-{datetime.now().strftime('%Y%m%d')}-{self._violation_counter:05d}",
            timestamp=datetime.now(),
            regime=regime,
            violation_type=violation_type,
            expected=expected,
            actual=actual,
            signal_id=signal_id,
            symbol=symbol,
            severity=severity
        )
        
        self.violations.append(violation)
        
        # Track by regime
        self._regime_violations[regime] = self._regime_violations.get(regime, 0) + 1
        
        # Trim if needed
        if len(self.violations) > self.max_violations:
            self.violations.pop(0)
        
        logger.warning("regime_violation",
                      type=violation_type.value,
                      regime=regime,
                      severity=severity)
        
        return violation
    
    # ==================== REPORTING ====================
    
    def get_discipline_score(self) -> float:
        """
        Calculate overall discipline score (0-1).
        
        Score = (signals - violations) / signals
        """
        if self._signal_count == 0:
            return 1.0
        
        violations = len(self.violations)
        return max(0, (self._signal_count - violations) / self._signal_count)
    
    def generate_audit_report(self) -> AuditReport:
        """Generate comprehensive audit report."""
        violations = list(self.violations)
        
        # Get period
        if violations:
            period_start = min(v.timestamp for v in violations)
            period_end = max(v.timestamp for v in violations)
        else:
            period_start = period_end = datetime.now()
        
        # Count by type
        violations_by_type = {}
        critical_count = 0
        for v in violations:
            vtype = v.violation_type.value
            violations_by_type[vtype] = violations_by_type.get(vtype, 0) + 1
            if v.severity == 'critical':
                critical_count += 1
        
        # Calculate regime compliance
        regime_compliance = {}
        for regime in self._regime_counts:
            count = self._regime_counts[regime]
            violations = self._regime_violations.get(regime, 0)
            if count > 0:
                regime_compliance[regime] = (count - violations) / count
            else:
                regime_compliance[regime] = 1.0
        
        return AuditReport(
            period_start=period_start,
            period_end=period_end,
            total_signals=self._signal_count,
            total_trades=self._trade_count,
            violations=len(violations),
            critical_violations=critical_count,
            discipline_score=self.get_discipline_score(),
            regime_distribution=dict(self._regime_counts),
            regime_compliance=regime_compliance,
            violations_by_type=violations_by_type
        )
    
    def get_recent_violations(self, n: int = 10) -> List[Violation]:
        """Get most recent violations."""
        return self.violations[-n:]
    
    def get_violations_by_regime(self, regime: str) -> List[Violation]:
        """Get violations for a specific regime."""
        return [v for v in self.violations if v.regime == regime]
    
    # ==================== MANUAL VERIFICATION ====================
    
    def verify_no_panic_trades(self) -> Dict[str, Any]:
        """Manual verification: no trades in panic regime."""
        panic_violations = [
            v for v in self.violations 
            if v.violation_type == ViolationType.TRADE_IN_PANIC
        ]
        
        return {
            'check': 'no_panic_trades',
            'passed': len(panic_violations) == 0,
            'violations': len(panic_violations),
            'details': [v.to_dict() for v in panic_violations[:5]]
        }
    
    def verify_chop_sizing(self) -> Dict[str, Any]:
        """Manual verification: proper sizing in chop."""
        chop_violations = [
            v for v in self.violations 
            if v.violation_type == ViolationType.OVERSIZED_IN_CHOP
        ]
        
        return {
            'check': 'chop_sizing',
            'passed': len(chop_violations) == 0,
            'violations': len(chop_violations),
            'max_allowed': f"{self.MAX_SIZE_IN_CHOP*100:.0f}%"
        }
    
    def run_all_verifications(self) -> Dict[str, Any]:
        """Run all manual verification checks."""
        return {
            'panic_trades': self.verify_no_panic_trades(),
            'chop_sizing': self.verify_chop_sizing(),
            'overall_score': self.get_discipline_score(),
            'total_violations': len(self.violations)
        }


# Singleton instance
regime_auditor = RegimeAuditor()


# ==================== INTEGRATION ====================

def audit_trade_decision(
    regime: str,
    action: str,
    position_size_pct: float,
    confidence: float,
    signal_id: Optional[str] = None,
    symbol: Optional[str] = None
) -> bool:
    """
    Check trade decision and log violation if any.
    
    Returns True if compliant, False if violated.
    """
    violation = regime_auditor.check_trade(
        regime=regime,
        action=action,
        position_size_pct=position_size_pct,
        confidence=confidence,
        signal_id=signal_id,
        symbol=symbol
    )
    
    return violation is None
