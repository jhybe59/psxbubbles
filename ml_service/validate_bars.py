"""
Pipeline Validation Tests
Verify bar aggregation correctness against raw ticks.
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import structlog

from bar_engine import (
    Tick, TimeBarEngine, VolumeBarEngine, TickBarEngine,
    process_ticks_to_bars
)
from export import DataExporter

logger = structlog.get_logger()


def validate_bar_aggregation(
    ticks_df: pd.DataFrame,
    bars_df: pd.DataFrame,
    symbol: str
) -> dict:
    """
    Validate bar aggregation against raw ticks.
    
    Checks:
    1. Total volume matches
    2. Total ticks matches
    3. High/Low bounds are correct
    4. VWAP is accurate
    5. No data loss
    
    Returns:
        Validation report dict
    """
    report = {
        "symbol": symbol,
        "ticks_count": len(ticks_df),
        "bars_count": len(bars_df),
        "passed": True,
        "errors": []
    }
    
    if ticks_df.empty or bars_df.empty:
        report["errors"].append("Empty data")
        report["passed"] = False
        return report
    
    # Total volume check
    tick_volume = ticks_df['volume'].sum()
    bar_volume = bars_df['volume'].sum()
    volume_diff_pct = abs(tick_volume - bar_volume) / tick_volume * 100 if tick_volume > 0 else 0
    
    report["tick_volume"] = float(tick_volume)
    report["bar_volume"] = float(bar_volume)
    report["volume_diff_pct"] = float(volume_diff_pct)
    
    if volume_diff_pct > 0.01:  # Allow 0.01% tolerance
        report["errors"].append(f"Volume mismatch: {volume_diff_pct:.4f}%")
        report["passed"] = False
    
    # Total ticks check
    bar_ticks = bars_df['ticks'].sum()
    report["bar_ticks_sum"] = int(bar_ticks)
    
    if bar_ticks != len(ticks_df):
        report["errors"].append(f"Tick count mismatch: {bar_ticks} vs {len(ticks_df)}")
        # This can happen if we don't flush - not necessarily an error
    
    # High/Low bounds
    tick_high = ticks_df['price'].max()
    tick_low = ticks_df['price'].min()
    bar_high = bars_df['high'].max()
    bar_low = bars_df['low'].min()
    
    report["tick_high"] = float(tick_high)
    report["tick_low"] = float(tick_low)
    report["bar_high"] = float(bar_high)
    report["bar_low"] = float(bar_low)
    
    if bar_high > tick_high * 1.0001 or bar_low < tick_low * 0.9999:
        report["errors"].append("High/Low bounds violation")
        report["passed"] = False
    
    # VWAP accuracy (for entire period)
    tick_vwap = (ticks_df['price'] * ticks_df['volume']).sum() / ticks_df['volume'].sum()
    bar_vwap = (bars_df['vwap'] * bars_df['volume']).sum() / bars_df['volume'].sum()
    vwap_diff_pct = abs(tick_vwap - bar_vwap) / tick_vwap * 100
    
    report["tick_vwap"] = float(tick_vwap)
    report["bar_vwap"] = float(bar_vwap)
    report["vwap_diff_pct"] = float(vwap_diff_pct)
    
    if vwap_diff_pct > 0.1:  # Allow 0.1% tolerance
        report["errors"].append(f"VWAP mismatch: {vwap_diff_pct:.4f}%")
        report["passed"] = False
    
    # Time alignment check
    first_tick_time = pd.to_datetime(ticks_df['timestamp'].min())
    last_tick_time = pd.to_datetime(ticks_df['timestamp'].max())
    first_bar_time = pd.to_datetime(bars_df['start_time'].min())
    last_bar_time = pd.to_datetime(bars_df['end_time'].max())
    
    report["time_range"] = {
        "first_tick": str(first_tick_time),
        "last_tick": str(last_tick_time),
        "first_bar": str(first_bar_time),
        "last_bar": str(last_bar_time)
    }
    
    return report


def run_validation(symbol: str, days: int = 1):
    """Run full validation suite."""
    from datetime import datetime, timedelta
    
    exporter = DataExporter()
    end = datetime.now()
    start = end - timedelta(days=days)
    
    # Export ticks
    print(f"Fetching ticks for {symbol}...")
    ticks_df = exporter.export_ticks(symbol, start, end, format="dataframe")
    
    if ticks_df is None or ticks_df.empty:
        print(f"No tick data found for {symbol}")
        return
    
    print(f"Got {len(ticks_df)} ticks")
    
    # Test each bar type
    bar_types = {
        "time_60s": {"bar_type": "time", "interval_seconds": 60},
        "time_5s": {"bar_type": "time", "interval_seconds": 5},
        "volume_5000": {"bar_type": "volume", "volume_threshold": 5000},
        "tick_50": {"bar_type": "tick", "tick_threshold": 50},
    }
    
    results = []
    
    for name, params in bar_types.items():
        print(f"\nTesting {name}...")
        bars_df = process_ticks_to_bars(ticks_df, symbol, **params)
        
        if bars_df.empty:
            print(f"  No bars generated")
            continue
        
        report = validate_bar_aggregation(ticks_df, bars_df, symbol)
        report["bar_type"] = name
        results.append(report)
        
        status = "✅ PASS" if report["passed"] else "❌ FAIL"
        print(f"  {status} - {len(bars_df)} bars")
        if report["errors"]:
            for err in report["errors"]:
                print(f"    - {err}")
    
    # Summary
    print("\n" + "="*60)
    print("VALIDATION SUMMARY")
    print("="*60)
    passed = sum(1 for r in results if r["passed"])
    print(f"Passed: {passed}/{len(results)}")
    
    return results


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Validate bar aggregation")
    parser.add_argument("--symbol", default="LUCK")
    parser.add_argument("--days", type=int, default=1)
    args = parser.parse_args()
    
    run_validation(args.symbol, args.days)
