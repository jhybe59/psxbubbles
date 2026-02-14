"""
Gate Validator (Phase 7.5 Safety)
The AUTOMATION FIREWALL of the trading system.

7 Gates must ALL pass before live trading is allowed.
Even one failure = NO LIVE MONEY.

This is the discipline layer.
This is where most systems fail - by skipping gates.
"""
from datetime import datetime
from typing import Optional, Dict, List
from dataclasses import dataclass
from enum import Enum
import structlog

from paper_trader import paper_trader
from profit_validator import profit_validator
from regime_strategy import regime_strategy
from learning_loop import learning_loop
from signal_tracker import signal_tracker

logger = structlog.get_logger()


class GateStatus(str, Enum):
    """Gate status values."""
    PASSED = "passed"
    FAILED = "failed"
    PENDING = "pending"  # Not enough data


@dataclass
class Gate:
    """Individual validation gate."""
    name: str
    description: str
    passed: bool
    status: GateStatus
    current_value: float
    threshold: float
    message: str
    last_checked: datetime
    
    def to_dict(self) -> dict:
        return {
            'name': self.name,
            'description': self.description,
            'passed': self.passed,
            'status': self.status.value,
            'current_value': round(self.current_value, 4),
            'threshold': round(self.threshold, 4),
            'message': self.message,
            'last_checked': self.last_checked.isoformat()
        }


@dataclass
class GateReport:
    """Complete gate validation report."""
    timestamp: datetime
    all_passed: bool
    gates_passed: int
    gates_total: int
    gates: List[Gate]
    automation_allowed: bool
    message: str
    
    def to_dict(self) -> dict:
        return {
            'timestamp': self.timestamp.isoformat(),
            'all_passed': self.all_passed,
            'gates_passed': self.gates_passed,
            'gates_total': self.gates_total,
            'automation_allowed': self.automation_allowed,
            'message': self.message,
            'gates': [g.to_dict() for g in self.gates]
        }


class GateValidator:
    """
    7-Gate Automation Firewall.
    
    ALL gates must pass for live trading to be allowed.
    This is non-negotiable. No exceptions. No overrides.
    
    Gates:
    1. Truth Gate - Enough data collected
    2. Risk Gate - Drawdown under control
    3. Discipline Gate - Regime rules followed
    4. Trust Gate - Human approved (manual)
    5. Stability Gate - No wild metric swings
    6. Learning Gate - Adaptation stable
    7. Profit Gate - Profit factor acceptable
    """
    
    # Thresholds (non-negotiable)
    MIN_SIGNALS_FOR_TRUTH = 100      # Need at least 100 signals
    MAX_DRAWDOWN_ALLOWED = 0.10      # 10% max drawdown
    MIN_DISCIPLINE_SCORE = 0.90      # 90% rule compliance
    MIN_PROFIT_FACTOR = 1.3          # Must be profitable
    MAX_WEIGHT_CHANGE = 0.20         # 20% max weight swing
    MIN_EDGE_STABILITY = 0.80        # 80% edge consistency
    
    def __init__(self):
        # Human trust approval (starts False, must be set manually)
        self._human_approved = False
        self._approval_timestamp: Optional[datetime] = None
        self._approval_reason: str = ""
        
        # Last report cache
        self._last_report: Optional[GateReport] = None
        
        logger.info("gate_validator_initialized")
    
    # ==================== GATE CHECKS ====================
    
    def _check_truth_gate(self) -> Gate:
        """Gate 1: Enough data collected."""
        stats = paper_trader.get_cumulative_stats()
        signals = stats.total_signals
        
        passed = signals >= self.MIN_SIGNALS_FOR_TRUTH
        
        return Gate(
            name="truth",
            description="Sufficient data collected",
            passed=passed,
            status=GateStatus.PASSED if passed else 
                   GateStatus.PENDING if signals < 20 else GateStatus.FAILED,
            current_value=signals,
            threshold=self.MIN_SIGNALS_FOR_TRUTH,
            message=f"{signals}/{self.MIN_SIGNALS_FOR_TRUTH} signals",
            last_checked=datetime.now()
        )
    
    def _check_risk_gate(self) -> Gate:
        """Gate 2: Drawdown under control."""
        stats = paper_trader.get_cumulative_stats()
        drawdown = stats.max_drawdown
        
        passed = drawdown <= self.MAX_DRAWDOWN_ALLOWED
        
        return Gate(
            name="risk",
            description="Maximum drawdown acceptable",
            passed=passed,
            status=GateStatus.PASSED if passed else GateStatus.FAILED,
            current_value=drawdown,
            threshold=self.MAX_DRAWDOWN_ALLOWED,
            message=f"Max DD: {drawdown*100:.1f}% (limit: {self.MAX_DRAWDOWN_ALLOWED*100:.0f}%)",
            last_checked=datetime.now()
        )
    
    def _check_discipline_gate(self) -> Gate:
        """Gate 3: Regime rules followed."""
        daily = paper_trader.get_daily_report()
        
        # Calculate discipline score from violations
        total_signals = daily.total_signals
        violations = daily.violations
        
        if total_signals > 0:
            score = (total_signals - violations) / total_signals
        else:
            score = 1.0  # Perfect if no activity
        
        passed = score >= self.MIN_DISCIPLINE_SCORE
        
        return Gate(
            name="discipline",
            description="Regime rules respected",
            passed=passed,
            status=GateStatus.PASSED if passed else 
                   GateStatus.PENDING if total_signals < 10 else GateStatus.FAILED,
            current_value=score,
            threshold=self.MIN_DISCIPLINE_SCORE,
            message=f"Discipline: {score*100:.0f}% ({violations} violations)",
            last_checked=datetime.now()
        )
    
    def _check_trust_gate(self) -> Gate:
        """Gate 4: Human approved."""
        passed = self._human_approved
        
        return Gate(
            name="trust",
            description="Human approval granted",
            passed=passed,
            status=GateStatus.PASSED if passed else GateStatus.PENDING,
            current_value=1.0 if passed else 0.0,
            threshold=1.0,
            message="Approved" if passed else "Awaiting human approval",
            last_checked=datetime.now()
        )
    
    def _check_stability_gate(self) -> Gate:
        """Gate 5: No wild metric swings."""
        # Check learning loop for weight stability
        weights = learning_loop.get_current_weights()
        default_weights = {
            'volume': 0.20,
            'volatility': 0.15,
            'momentum': 0.25,
            'flow': 0.20,
            'regime': 0.20
        }
        
        max_change = 0
        for key in weights:
            if key in default_weights:
                change = abs(weights[key] - default_weights[key])
                if change > max_change:
                    max_change = change
        
        passed = max_change <= self.MAX_WEIGHT_CHANGE
        
        return Gate(
            name="stability",
            description="Weight changes within bounds",
            passed=passed,
            status=GateStatus.PASSED if passed else GateStatus.FAILED,
            current_value=max_change,
            threshold=self.MAX_WEIGHT_CHANGE,
            message=f"Max weight change: {max_change*100:.0f}%",
            last_checked=datetime.now()
        )
    
    def _check_learning_gate(self) -> Gate:
        """Gate 6: Learning loop stable."""
        status = learning_loop.get_status()
        
        # Check retrain frequency
        retrains = status['stats']['retrains_triggered']
        checks = status['stats']['checks_performed']
        
        if checks > 0:
            retrain_rate = retrains / checks
            stable = retrain_rate < 0.1  # Less than 10% retrain rate
        else:
            stable = True  # No checks yet
        
        passed = stable
        
        return Gate(
            name="learning",
            description="Learning adaptation stable",
            passed=passed,
            status=GateStatus.PASSED if passed else 
                   GateStatus.PENDING if checks < 10 else GateStatus.FAILED,
            current_value=1.0 - (retrains / max(checks, 1)),
            threshold=0.90,
            message=f"Retrains: {retrains}/{checks} checks",
            last_checked=datetime.now()
        )
    
    def _check_profit_gate(self) -> Gate:
        """Gate 7: Profit factor acceptable."""
        pf = profit_validator.get_profit_factor()
        
        passed = pf >= self.MIN_PROFIT_FACTOR
        
        return Gate(
            name="profit",
            description="Profit factor meets threshold",
            passed=passed,
            status=GateStatus.PASSED if passed else 
                   GateStatus.PENDING if pf == 0 else GateStatus.FAILED,
            current_value=pf,
            threshold=self.MIN_PROFIT_FACTOR,
            message=f"Profit Factor: {pf:.2f} (min: {self.MIN_PROFIT_FACTOR})",
            last_checked=datetime.now()
        )
    
    # ==================== VALIDATION ====================
    
    def check_all(self) -> GateReport:
        """
        Check all 7 gates and return report.
        
        This is the core function. ALL gates must pass.
        """
        gates = [
            self._check_truth_gate(),
            self._check_risk_gate(),
            self._check_discipline_gate(),
            self._check_trust_gate(),
            self._check_stability_gate(),
            self._check_learning_gate(),
            self._check_profit_gate()
        ]
        
        passed = sum(1 for g in gates if g.passed)
        total = len(gates)
        all_passed = passed == total
        
        # Build message
        if all_passed:
            message = "✅ ALL GATES PASSED - Automation allowed"
        else:
            failed = [g.name for g in gates if not g.passed]
            message = f"❌ {total - passed} gates failed: {', '.join(failed)}"
        
        report = GateReport(
            timestamp=datetime.now(),
            all_passed=all_passed,
            gates_passed=passed,
            gates_total=total,
            gates=gates,
            automation_allowed=all_passed,
            message=message
        )
        
        self._last_report = report
        
        logger.info("gate_check_complete",
                   passed=passed,
                   total=total,
                   automation=all_passed)
        
        return report
    
    def is_automation_allowed(self) -> bool:
        """
        Quick check if automation is allowed.
        
        Returns False unless ALL 7 gates pass.
        """
        report = self.check_all()
        return report.automation_allowed
    
    # ==================== HUMAN APPROVAL ====================
    
    def grant_approval(self, reason: str = "Manual approval") -> None:
        """
        Grant human approval (Trust Gate).
        
        This is a manual action - system cannot auto-approve.
        """
        self._human_approved = True
        self._approval_timestamp = datetime.now()
        self._approval_reason = reason
        
        logger.warning("human_approval_granted", reason=reason)
    
    def revoke_approval(self, reason: str = "Manual revocation") -> None:
        """Revoke human approval."""
        self._human_approved = False
        self._approval_reason = f"Revoked: {reason}"
        
        logger.warning("human_approval_revoked", reason=reason)
    
    def get_approval_status(self) -> Dict:
        """Get human approval status."""
        return {
            'approved': self._human_approved,
            'timestamp': self._approval_timestamp.isoformat() if self._approval_timestamp else None,
            'reason': self._approval_reason
        }
    
    # ==================== REPORTING ====================
    
    def get_status_summary(self) -> Dict:
        """Get quick status summary for dashboard."""
        report = self.check_all()
        
        return {
            'automation_allowed': report.automation_allowed,
            'gates_passed': report.gates_passed,
            'gates_total': report.gates_total,
            'gate_status': {
                g.name: g.status.value for g in report.gates
            },
            'message': report.message
        }
    
    def get_last_report(self) -> Optional[GateReport]:
        """Get last validation report."""
        return self._last_report


# Singleton instance
gate_validator = GateValidator()


# ==================== INTEGRATION ====================

def is_live_trading_allowed() -> bool:
    """Quick check for use in other modules."""
    return gate_validator.is_automation_allowed()


def get_gate_summary() -> Dict:
    """Get gate summary for API."""
    return gate_validator.get_status_summary()
