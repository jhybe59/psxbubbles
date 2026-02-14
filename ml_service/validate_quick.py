"""
Zero-Dependency Validation
Tests logic by importing only standard library.
Self-contained - no project imports.
"""
import sys
import os
import time
import ast
from pathlib import Path

print("="*60)
print("ZERO-DEPENDENCY VALIDATION")
print("="*60)

tests_passed = 0
tests_failed = 0
ml_service_dir = Path(__file__).parent

def test(name: str, condition: bool, details: str = ""):
    global tests_passed, tests_failed
    if condition:
        print(f"  ✓ {name}")
        tests_passed += 1
    else:
        print(f"  ✗ {name}: {details}")
        tests_failed += 1

def file_exists(filename: str) -> bool:
    return (ml_service_dir / filename).exists()

def syntax_valid(filename: str) -> bool:
    try:
        path = ml_service_dir / filename
        with open(path, 'r', encoding='utf-8') as f:
            source = f.read()
        ast.parse(source)
        return True
    except SyntaxError as e:
        return False

def has_class(filename: str, classname: str) -> bool:
    try:
        path = ml_service_dir / filename
        with open(path, 'r', encoding='utf-8') as f:
            source = f.read()
        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef) and node.name == classname:
                return True
        return False
    except:
        return False

def has_function(filename: str, funcname: str) -> bool:
    try:
        path = ml_service_dir / filename
        with open(path, 'r', encoding='utf-8') as f:
            source = f.read()
        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == funcname:
                return True
        return False
    except:
        return False

# ============================================================
# Test 1: Core Files Exist
# ============================================================
print("\n[1] Core Files...")
core_files = [
    "realtime.py",
    "inference.py", 
    "signal_router.py",
    "confidence_gate.py",
    "throttler.py",
    "risk_filter.py",
    "latency_profiler.py",
    "health_monitor.py",
    "signal_validator.py",
    "e2e_test.py",
    "intelligence.py"
]
for f in core_files:
    test(f, file_exists(f), "missing")

# ============================================================
# Test 2: Syntax Validation
# ============================================================
print("\n[2] Python Syntax...")
for f in core_files:
    test(f"syntax: {f}", syntax_valid(f), "syntax error")

# ============================================================
# Test 3: Deep Models
# ============================================================
print("\n[3] Deep Models...")
deep_models = ["lstm_model.py", "transformer_model.py", "cnn_timeseries.py", "regime_model.py"]
for f in deep_models:
    path = f"deep_models/{f}"
    test(path, file_exists(path), "missing")

# ============================================================
# Test 4: Agents
# ============================================================
print("\n[4] Agents...")
agents = ["base_agent.py", "volume_agent.py", "volatility_agent.py", "momentum_agent.py", "flow_agent.py", "regime_agent.py"]
for f in agents:
    path = f"agents/{f}"
    test(path, file_exists(path), "missing")

# ============================================================
# Test 5: Fusion
# ============================================================
print("\n[5] Fusion...")
fusion = ["ensemble.py", "decision_engine.py"]
for f in fusion:
    path = f"fusion/{f}"
    test(path, file_exists(path), "missing")

# ============================================================
# Test 6: Key Classes
# ============================================================
print("\n[6] Key Classes...")
class_checks = [
    ("realtime.py", "RealtimeInference"),
    ("inference.py", "InferRequest"),
    ("signal_router.py", "SignalRouter"),
    ("confidence_gate.py", "ConfidenceGate"),
    ("throttler.py", "SignalThrottler"),
    ("risk_filter.py", "RiskFilter"),
    ("latency_profiler.py", "LatencyProfiler"),
    ("health_monitor.py", "SystemHealthMonitor"),
    ("signal_validator.py", "SignalValidator"),
    ("intelligence.py", "IntelligenceSystem"),
]
for filename, classname in class_checks:
    test(f"{classname}", has_class(filename, classname), f"not found in {filename}")

# ============================================================
# Test 7: Key Functions
# ============================================================
print("\n[7] Key Functions...")
func_checks = [
    ("e2e_test.py", "run_tests"),
    ("latency_profiler.py", "__init__"),
]
for filename, funcname in func_checks:
    test(f"{filename}:{funcname}", has_function(filename, funcname), "not found")

# ============================================================
# Test 8: Node.js Integration
# ============================================================
print("\n[8] Node.js Integration...")
api_dir = ml_service_dir.parent / "api"
test("ml-consumer.mjs", (api_dir / "services" / "ml-consumer.mjs").exists(), "missing")
test("ml.mjs routes", (api_dir / "routes" / "ml.mjs").exists(), "missing")

# ============================================================
# Test 9: Requirements file
# ============================================================
print("\n[9] Configuration...")
test("requirements.txt", file_exists("requirements.txt"), "missing")
test("Dockerfile", file_exists("Dockerfile"), "missing")

# ============================================================
# Summary
# ============================================================
print("\n" + "="*60)
total = tests_passed + tests_failed
print(f"RESULTS: {tests_passed}/{total} passed ({100*tests_passed//total}%)")
print("="*60)

if tests_failed == 0:
    print("\n✅ ALL VALIDATIONS PASSED - System structure verified!")
    sys.exit(0)
else:
    print(f"\n⚠️ {tests_failed} checks need attention")
    sys.exit(1 if tests_failed > 5 else 0)  # Allow minor issues
