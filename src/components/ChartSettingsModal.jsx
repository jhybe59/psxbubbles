import React, { useState, useEffect, useRef } from 'react';

// Premium Palette (same as IndicatorSettings)
const COLOR_PALETTE = [
    ['#131722', '#1e222d', '#2a2e39', '#363a45', '#434651', '#50535e', '#5d606b', '#6a6d78', '#787b84', '#858990', '#93969f', '#a1a4ad', '#b2b5be', '#d1d4dc', '#e0e3eb', '#f0f3fa'],
    ['#f23645', '#ff9800', '#ffeb3b', '#4caf50', '#089981', '#00bcd4', '#2196f3', '#2962ff', '#673ab7', '#9c27b0', '#e91e63', '#ff5252', '#ff6d00', '#ffab00', '#c6ff00', '#00e676'],
    ['#ff5252', '#ffb74d', '#fff176', '#81c784', '#4db6ac', '#4dd0e1', '#64b5f6', '#5c6bc0', '#9575cd', '#ba68c8', '#f06292', '#ff8a80', '#ffab40', '#ffd740', '#eeff41', '#69f0ae'],
    ['#b71c1c', '#e65100', '#f9a825', '#2e7d32', '#00695c', '#00838f', '#1565c0', '#0d47a1', '#4527a0', '#6a1b9a', '#ad1457', '#c62828', '#d84315', '#ff8f00', '#9e9d24', '#00c853'],
];

/**
 * ChartSettingsModal
 * Configures global chart settings like Day Separators
 */
export default function ChartSettingsModal({ isOpen, onClose, settings, onSave }) {
    const [localSettings, setLocalSettings] = useState(settings || {
        sessionBreaks: { visible: false, color: '#363a45', lineStyle: 1, lineWidth: 1, opacity: 0.5 }
    });
    const [activeTab, setActiveTab] = useState('Events');
    const [showColorPicker, setShowColorPicker] = useState(false);
    const colorPickerRef = useRef(null);

    useEffect(() => {
        if (settings) {
            setLocalSettings(JSON.parse(JSON.stringify(settings)));
        }
    }, [settings, isOpen]);

    // Close color picker on outside click
    useEffect(() => {
        function handleClickOutside(e) {
            if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
                setShowColorPicker(false);
            }
        }
        if (showColorPicker) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showColorPicker]);

    if (!isOpen) return null;

    const handleUpdate = (section, updates) => {
        setLocalSettings(prev => ({
            ...prev,
            [section]: { ...prev[section], ...updates }
        }));
    };

    const tabs = ['Symbol', 'Status line', 'Scales', 'Canvas', 'Trading', 'Events'];

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={onClose}
        >
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(4px)'
            }} />

            <div
                style={{
                    position: 'relative',
                    width: '600px',
                    height: '500px',
                    background: '#1e222d',
                    borderRadius: '8px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'scaleIn 0.2s ease-out',
                    border: '1px solid #2a2e39'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header with Labs */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #2a2e39', fontSize: '18px', fontWeight: '500', color: '#d1d4dc' }}>
                    Chart settings
                </div>

                <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                    {/* Sidebar Tabs */}
                    <div style={{ width: '160px', borderRight: '1px solid #2a2e39', padding: '16px 0', background: '#1e222d' }}>
                        {tabs.map(tab => (
                            <div
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    padding: '8px 24px',
                                    color: activeTab === tab ? '#2962ff' : '#b2b5be',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    background: activeTab === tab ? '#2a2e39' : 'transparent',
                                    transition: 'all 0.1s'
                                }}
                            >
                                {tab}
                            </div>
                        ))}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
                        {activeTab === 'Events' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Session Breaks */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                                        <input
                                            type="checkbox"
                                            checked={localSettings.sessionBreaks?.visible}
                                            onChange={(e) => handleUpdate('sessionBreaks', { visible: e.target.checked })}
                                            style={{ width: '16px', height: '16px' }}
                                        />
                                        <span style={{ color: '#d1d4dc', fontSize: '14px' }}>Session Breaks (Day Separator)</span>
                                    </label>
                                </div>

                                {localSettings.sessionBreaks?.visible && (
                                    <div style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {/* Color Picker Button */}
                                            <div style={{ position: 'relative' }}>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
                                                    style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        background: localSettings.sessionBreaks.color,
                                                        border: '1px solid rgba(255,255,255,0.2)',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer'
                                                    }}
                                                />
                                                {showColorPicker && (
                                                    <div
                                                        ref={colorPickerRef}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '40px',
                                                            left: '0',
                                                            background: '#1e222d',
                                                            border: '1px solid #2a2e39',
                                                            borderRadius: '8px',
                                                            padding: '12px',
                                                            zIndex: 1000,
                                                            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                                            width: '280px'
                                                        }}
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                            {COLOR_PALETTE.map((row) => row.map(color => (
                                                                <div
                                                                    key={color}
                                                                    onClick={() => { handleUpdate('sessionBreaks', { color }); setShowColorPicker(false); }}
                                                                    style={{
                                                                        width: '24px',
                                                                        height: '24px',
                                                                        background: color,
                                                                        borderRadius: '3px',
                                                                        cursor: 'pointer',
                                                                        border: localSettings.sessionBreaks.color === color ? '2px solid white' : '1px solid rgba(255,255,255,0.1)'
                                                                    }}
                                                                />
                                                            )))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Line Style Dropdown */}
                                            <select
                                                value={localSettings.sessionBreaks.lineStyle}
                                                onChange={(e) => handleUpdate('sessionBreaks', { lineStyle: parseInt(e.target.value) })}
                                                style={{
                                                    background: '#2a2e39',
                                                    color: '#d1d4dc',
                                                    border: '1px solid #363a45',
                                                    borderRadius: '4px',
                                                    padding: '6px 12px',
                                                    fontSize: '13px',
                                                    outline: 'none'
                                                }}
                                            >
                                                <option value={0}>Solid</option>
                                                <option value={1}>Dashed</option>
                                                <option value={2}>Dotted</option>
                                            </select>

                                            {/* Line Width Dropdown */}
                                            <select
                                                value={localSettings.sessionBreaks.lineWidth}
                                                onChange={(e) => handleUpdate('sessionBreaks', { lineWidth: parseInt(e.target.value) })}
                                                style={{
                                                    background: '#2a2e39',
                                                    color: '#d1d4dc',
                                                    border: '1px solid #363a45',
                                                    borderRadius: '4px',
                                                    padding: '6px 12px',
                                                    fontSize: '13px',
                                                    outline: 'none'
                                                }}
                                            >
                                                {[1, 2, 3, 4].map(w => (
                                                    <option key={w} value={w}>{w}px</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ color: '#6a6d78', fontSize: '13px', padding: '20px', textAlign: 'center' }}>
                                This tab is not yet implemented for this demo.
                                <br />Please go to <b>Events</b> for Day Separator settings.
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid #2a2e39', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 24px',
                            background: 'transparent',
                            color: '#d1d4dc',
                            border: '1px solid #363a45',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(localSettings)}
                        style={{
                            padding: '8px 24px',
                            background: '#2962ff',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500'
                        }}
                    >
                        OK
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            `}</style>
        </div>
    );
}
