# Tasks

- [/] Analyze Breakouts in Data
    - [ ] Locate and inspect the data (QuestDB or CSV)
    - [ ] Create a script to process the data and identify "breakouts" (sudden price increases) on 50-tick intervals
    - [ ] Generate a report or list of identified breakouts
    - [ ] Analyze pre-breakout conditions for these identified instances

- [x] **Breakout Analysis & Screener Debugging**
    - [x] Analyze 50-tick breakouts (Script: `analyze-breakouts-50ticks.mjs`, Output: `breakouts_50t.csv`)
    - [x] Relax screener thresholds (Tightness < 5%, VolPulse > 1.5x)
    - [x] Implement "Flash Wake-up" (Dead Stock: Vol > 50x overrides tightness)
    - [x] Implement "Sustained Signal" (5 min Memory)
    - [x] Verify detection rate (Improved to 61.8%)
    - [x] Restart Server to apply changes

- [x] **Fix Missing Tooltip Data**
    - [x] Debug Backend (Fix dayStart logic in bubbles.mjs)
    - [x] Fix Tick-Interal Data (Add lead_metrics to tick-bubbles.mjs)
    - [x] Fix Frontend Mapping (Pass lead_metrics in useOHLCV.js)
    - [x] Polish Live Engine UI (Relocated to Interval Alerts column to fix overlay)
