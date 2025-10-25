import React, { useState } from 'react';

export default function Controls({ autoRefresh, setAutoRefresh }) {
  return (
    <div className="controls">
      <label>
        <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} /> Auto-refresh
      </label>
    </div>
  );
}
