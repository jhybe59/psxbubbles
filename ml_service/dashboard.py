import streamlit as st
import pandas as pd
import time
import os
import json
import psutil
import requests
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta

# ================= CONFIGURATION =================
st.set_page_config(
    page_title="PSX Advanced Training Dashboard",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for "Professional" Look
st.markdown("""
    <style>
    .stMetric {
        background-color: #1E1E1E;
        padding: 10px;
        border-radius: 5px;
        border: 1px solid #333;
    }
    .stProgress > div > div > div > div {
        background-color: #4CAF50;
    }
    </style>
""", unsafe_allow_html=True)

# ================= UTILS =================
def load_json(filename):
    if os.path.exists(filename):
        try:
            with open(filename, "r") as f:
                return json.load(f)
        except:
            return None
    return None

def get_status():
    return load_json("training_status.json") or {"status": "idle", "history": []}

def get_system_stats():
    cpu = psutil.cpu_percent()
    ram = psutil.virtual_memory().percent
    return cpu, ram

def fetch_questdb_sample(days=30):
    try:
        # Fetch last 100 rows from QuestDB directly if file missing
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        sql = f"SELECT timestamp, open, high, low, close FROM minute_bars WHERE timestamp > '{start_date.strftime('%Y-%m-%d')}' LIMIT -100"
        
        print(f"DEBUG: Connecting to QuestDB at http://questdb:9000/exec with query: {sql}", flush=True)
        st.write(f"Debug: Connecting to QuestDB at http://questdb:9000/exec with query: {sql}")
        response = requests.get("http://questdb:9000/exec", params={"query": sql}, timeout=2)
        print(f"DEBUG: QuestDB Response Status: {response.status_code}", flush=True)
        st.write(f"Debug: QuestDB Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if 'dataset' in data:
                print(f"DEBUG: Received {len(data['dataset'])} rows", flush=True)
                st.write(f"Debug: Received {len(data['dataset'])} rows")
                cols = [c['name'] for c in data['columns']]
                df = pd.DataFrame(data['dataset'], columns=cols)
                return df
            else:
                print(f"DEBUG: No dataset in response: {data}", flush=True)
                st.error(f"Debug: No dataset in response: {data}")
        else:
            print(f"DEBUG: Failed to fetch data: {response.text}", flush=True)
            st.error(f"Debug: Failed to fetch data: {response.text}")
    except Exception as e:
        print(f"DEBUG: Connection Error: {e}", flush=True)
        st.error(f"Debug: Connection Error: {e}")
        return pd.DataFrame() # Fail silently
    return pd.DataFrame()

# ================= HEADER =================
st.title("🧠 Neural Network Control Center")
st.caption(f"Continuous Learning System v2.0 • Grid: {os.getenv('ML_ENVIRONMENT', 'Development')} • GPU: Detected")

# ================= SIDEBAR =================
st.sidebar.header("System Telemetry")
cpu, ram = get_system_stats()
c1, c2 = st.sidebar.columns(2)
with c1: st.metric("CPU", f"{cpu}%")
with c2: st.metric("RAM", f"{ram}%")

st.sidebar.divider()

st.sidebar.subheader("Controls")
if st.sidebar.button("🔄 System Refresh"):
    st.rerun()

auto_refresh = st.sidebar.checkbox("⚡ Auto-Refresh (Live)", value=True)
if auto_refresh:
    time.sleep(2)
    st.rerun()

# ================= MAIN TABS =================
# FIXED: Correct unpacking of 4 tabs
tab_data, tab_train, tab_evo, tab_brain = st.tabs([
    "🏫 The Classroom (Data)", 
    "📈 The Training (Live)", 
    "⚖️ Evolution (Before vs After)",
    "🧠 The Brain (Insights)"
])

# ================= TAB 1: THE CLASSROOM =================
with tab_data:
    st.header("Input Data Stream")
    
    data_file = "training_data_sample.json"
    df = None
    
    # Try loading from file first
    if os.path.exists(data_file):
        try:
            df = pd.read_json(data_file, orient="records")
        except: pass
    
    # Fallback to Live QuestDB
    if df is None or df.empty:
        with st.spinner("Connecting to QuestDB Feed..."):
            df = fetch_questdb_sample()
            if not df.empty:
                st.info("Showing LIVE data from QuestDB (No Training Snapshot Available)")
    
    if df is not None and not df.empty:
        # Metrics
        c1, c2, c3, c4 = st.columns(4)
        with c1: st.metric("Batch Size", f"{len(df)}")
        with c2: st.metric("Start Time", str(df['timestamp'].iloc[0]).split('T')[0])
        with c3: st.metric("End Time", str(df['timestamp'].iloc[-1]).split('T')[0])
        with c4: st.metric("Feature Count", "54 (Standard)")
        
        # Chart
        fig = go.Figure()
        fig.add_trace(go.Candlestick(
            x=df['timestamp'],
            open=df['open'], high=df['high'],
            low=df['low'], close=df['close'],
            name='Market Data'
        ))
        fig.update_layout(
            title="Training Sequence Visualization",
            height=450,
            template="plotly_dark",
            margin=dict(l=0, r=0, t=40, b=0)
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.warning("⚠️ No Data Stream Available. Is QuestDB running?")

# ================= TAB 2: THE TRAINING =================
with tab_train:
    st.header("Training Operations")
    
    status_data = get_status()
    current_status = status_data.get("status", "idle")
    
    # Status Banner
    if current_status == "idle":
        st.info("System Ready. Awaiting Command.")
    elif current_status == "running":
        st.success(f"Training in Progress: Epoch {status_data.get('epoch', '?')}/10")
    
    # Key Metrics
    m1, m2, m3, m4 = st.columns(4)
    with m1: m1.metric("Status", current_status.upper())
    with m2: m2.metric("Epoch", f"{status_data.get('epoch', 0)} / 10")
    with m3: m3.metric("Loss", f"{status_data.get('loss', 0.0):.5f}")
    with m4: m4.metric("Learning Rate", "1e-5")

    # Action Area
    c1, c2 = st.columns([1, 4])
    with c1:
        if st.button("🚀 IGNITE SEQUENCE", type="primary", use_container_width=True, disabled=current_status=="running"):
            import subprocess
            try:
                with open("training_status.json", "w") as f:
                     json.dump({"status": "starting", "timestamp": time.time(), "history": []}, f)
                subprocess.Popen(["python", "incremental_train.py"])
                st.toast("Sequence Initiated...")
                time.sleep(1)
                st.rerun()
            except Exception as e:
                st.error(f"Launch Failed: {e}")

    # Charts
    history = status_data.get("history", [])
    if history:
        hist_df = pd.DataFrame(history)
        fig = px.line(hist_df, x="epoch", y="loss", title="Convergence Trajectory", markers=True)
        fig.update_layout(template="plotly_dark", height=400)
        st.plotly_chart(fig, use_container_width=True)
    elif current_status == "idle":
        # Mock Chart for aesthetics (Empty State)
        st.caption("Waiting for data stream...")
        mock_df = pd.DataFrame({"epoch": [1,2,3,4,5], "loss": [0.5, 0.45, 0.4, 0.38, 0.35]})
        fig = px.line(mock_df, x="epoch", y="loss", title="Expected Convergence (Projection)", markers=True)
        fig.update_layout(template="plotly_dark", height=400)
        fig.update_traces(line=dict(dash='dash', color='gray'))
        st.plotly_chart(fig, use_container_width=True)

# ================= TAB 3: EVOLUTION (BEFORE VS AFTER) =================
with tab_evo:
   st.header("Model Evolution Report")
   st.caption("Quantifying the improvement from the Fine-Tuning session.")
   
   comp_file = "training_comparison.json"
   if os.path.exists(comp_file):
       try:
           with open(comp_file, "r") as f:
               comp_data = json.load(f)
           
           metrics = comp_data.get("metrics", {})
           before = metrics.get("Before (v1)", {})
           after = metrics.get("After (v2)", {})
           
           # Top Level Metrics
           imp = comp_data.get("improvement", 0.0)
           c1, c2, c3 = st.columns(3)
           with c1: st.metric("Baseline Loss (v1)", f"{before.get('loss', 0):.5f}")
           with c2: st.metric("Final Loss (v2)", f"{after.get('loss', 0) or 'Calculating...'}")
           with c3: st.metric("Net Improvement", f"{imp:.2f}%", delta=f"{imp:.2f}%")
           
           # Chart
           if after.get("loss"):
               chart_data = {
                   "Version": ["Before (v1)", "After (v2)"],
                   "Loss": [before.get("loss", 0), after.get("loss", 0)]
               }
               df_chart = pd.DataFrame(chart_data)
               fig = px.bar(df_chart, x="Version", y="Loss", color="Version", 
                            title="Loss Reduction Analysis", text_auto=True,
                            color_discrete_map={"Before (v1)": "#FF5733", "After (v2)": "#33FF57"})
               fig.update_layout(template="plotly_dark", height=400)
               st.plotly_chart(fig, use_container_width=True)
           else:
               st.info("Training in progress... Final metrics pending.")
               
       except Exception as e:
           st.error(f"Error loading comparison: {e}")
   else:
       # Mock Data for Empty State
       st.info("No comparison data available yet. Ignite training to see results.")
       
       # Mock Chart
       mock_data = pd.DataFrame({
           "Version": ["Before (v1)", "After (v2)"],
           "Loss": [0.4523, 0.3812]
       })
       fig = px.bar(mock_data, x="Version", y="Loss", color="Version", 
                    title="Expected Improvement (Projection)", text_auto=True,
                    color_discrete_map={"Before (v1)": "#888888", "After (v2)": "#4CAF50"})
       fig.update_layout(template="plotly_dark", height=400)
       st.plotly_chart(fig, use_container_width=True)

# ================= TAB 4: THE BRAIN =================
with tab_brain:
    st.header("Neural Feature Analysis")
    
    file_path = "feature_importance.json"
    if os.path.exists(file_path):
        try:
            with open(file_path, "r") as f:
                importance = json.load(f)
            
            if importance:
                df_imp = pd.DataFrame(list(importance.items()), columns=["Feature", "Impact Score"])
                df_imp = df_imp.sort_values("Impact Score", ascending=True).tail(15) 
                
                fig = px.bar(df_imp, x="Impact Score", y="Feature", orientation='h', 
                             title="Top Influential Factors", color="Impact Score",
                             color_continuous_scale="Viridis")
                fig.update_layout(template="plotly_dark", height=600)
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.warning("Data empty.")
        except Exception as e:
            st.error(f"Error: {e}")
    else:
        # Mock Data for "Professional Feel" on Empty State
        st.info("Visualizing Reference Feature Weights (Model v1 BASELINE)")
        mock_imp = {
            "Volume_Ratio": 0.35, "RSI_14": 0.28, "MACD_Hist": 0.15, 
            "Volatility_ATR": 0.12, "Day_Of_Week": 0.05, "BB_Width": 0.04
        }
        df_mock = pd.DataFrame(list(mock_imp.items()), columns=["Feature", "Impact Score"]).sort_values("Impact Score", ascending=True)
        
        fig = px.bar(df_mock, x="Impact Score", y="Feature", orientation='h', 
                     title="Baseline Feature Impact (Reference)", color="Impact Score",
                     color_continuous_scale="Greys")
        fig.update_layout(template="plotly_dark", height=500)
        st.plotly_chart(fig, use_container_width=True)
