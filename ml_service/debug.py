import streamlit as st
import psutil

st.set_page_config(page_title="Debug")
st.title("✅ Dashboard Connection Verified")
st.write("If you see this, the server is working perfectly.")

try:
    cpu = psutil.cpu_percent()
    st.metric("CPU (psutil check)", f"{cpu}%")
except Exception as e:
    st.error(f"psutil failed: {e}")
