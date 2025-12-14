import React, { useState, useEffect, useRef } from 'react';
import { INDICATOR_COLORS, getIndicator } from '../../lib/indicators/indicatorRegistry';

// Premium Color Palette for picker
const COLOR_PALETTE = [
    // Row 1 - Grays
    ['#131722', '#1e222d', '#2a2e39', '#363a45', '#434651', '#50535e', '#5d606b', '#6a6d78', '#787b84', '#858990', '#93969f', '#a1a4ad', '#b2b5be', '#d1d4dc', '#e0e3eb', '#f0f3fa'],
    // Row 2 - Primary Colors
    ['#f23645', '#ff9800', '#ffeb3b', '#4caf50', '#089981', '#00bcd4', '#2196f3', '#2962ff', '#673ab7', '#9c27b0', '#e91e63', '#ff5252', '#ff6d00', '#ffab00', '#c6ff00', '#00e676'],
    // Row 3 - Light Variants  
    ['#ff5252', '#ffb74d', '#fff176', '#81c784', '#4db6ac', '#4dd0e1', '#64b5f6', '#5c6bc0', '#9575cd', '#ba68c8', '#f06292', '#ff8a80', '#ffab40', '#ffd740', '#eeff41', '#69f0ae'],
    // Row 4 - Dark Variants
    ['#b71c1c', '#e65100', '#f9a825', '#2e7d32', '#00695c', '#00838f', '#1565c0', '#0d47a1', '#4527a0', '#6a1b9a', '#ad1457', '#c62828', '#d84315', '#ff8f00', '#9e9d24', '#00c853'],
];

/**
 * Premium Indicator Settings Modal
 * TradingView-inspired design with glassmorphism and smooth animations
 */
export default function IndicatorSettingsModal({ isOpen, onClose, indicator, onSave }) {
    const [activeTab, setActiveTab] = useState('Inputs');
    const [params, setParams] = useState({});
    const [styles, setStyles] = useState({});
    const [showColorPicker, setShowColorPicker] = useState(null); // plotId or null
    const colorPickerRef = useRef(null);

    const def = indicator ? getIndicator(indicator.indicatorId) : null;

    useEffect(() => {
        if (indicator) {
            setParams({ ...indicator.params });
            if (indicator.styles) {
                setStyles(JSON.parse(JSON.stringify(indicator.styles)));
            } else {
                const initialStyles = {};
                if (def && def.plots) {
                    def.plots.forEach(plot => {
                        initialStyles[plot.id] = {
                            color: indicator.color || '#2962FF',
                            lineWidth: 2,
                            lineStyle: 0,
                            visible: true,
                            type: plot.type
                        };
                    });
                }
                setStyles(initialStyles);
            }
        }
    }, [indicator, isOpen, def]);

    // Close color picker when clicking outside
    useEffect(() => {
        function handleClickOutside(e) {
            if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
                setShowColorPicker(null);
            }
        }
        if (showColorPicker) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showColorPicker]);

    if (!isOpen || !indicator || !def) return null;

    const handleSave = () => {
        onSave(indicator.instanceId, { params, styles });
    };

    const tabs = ['Inputs', 'Style', 'Visibility'];

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
            {/* Backdrop with blur */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)'
            }} />

            {/* Modal Container */}
            <div
                style={{
                    position: 'relative',
                    width: '440px',
                    maxHeight: '85vh',
                    background: 'linear-gradient(180deg, #1e222d 0%, #131722 100%)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 32px 64px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.05) inset',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'slideUp 0.25s ease-out'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0',
                    borderBottom: '1px solid rgba(255,255,255,0.06)'
                }}>
                    {/* Indicator Name */}
                    <div style={{
                        padding: '16px 20px',
                        fontSize: '15px',
                        fontWeight: '600',
                        color: '#f0f3fa',
                        letterSpacing: '0.3px',
                        borderRight: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(255,255,255,0.02)'
                    }}>
                        {indicator.shortName}
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', flex: 1 }}>
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    padding: '16px 20px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: activeTab === tab ? '#2962ff' : '#6a6d78',
                                    fontWeight: activeTab === tab ? '600' : '400',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    position: 'relative',
                                    transition: 'color 0.2s ease',
                                    letterSpacing: '0.2px'
                                }}
                            >
                                {tab}
                                {activeTab === tab && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        width: '70%',
                                        height: '2px',
                                        background: 'linear-gradient(90deg, transparent, #2962ff, transparent)',
                                        borderRadius: '2px 2px 0 0'
                                    }} />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        style={{
                            width: '48px',
                            height: '48px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'transparent',
                            border: 'none',
                            color: '#6a6d78',
                            fontSize: '18px',
                            cursor: 'pointer',
                            transition: 'color 0.2s ease, background 0.2s ease',
                            borderRadius: '0'
                        }}
                        onMouseEnter={e => {
                            e.target.style.color = '#f0f3fa';
                            e.target.style.background = 'rgba(255,255,255,0.05)';
                        }}
                        onMouseLeave={e => {
                            e.target.style.color = '#6a6d78';
                            e.target.style.background = 'transparent';
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Content Area */}
                <div style={{
                    padding: '24px',
                    minHeight: '320px',
                    maxHeight: '450px',
                    overflowY: 'auto',
                    overflowX: 'hidden'
                }}>

                    {/* INPUTS TAB */}
                    {activeTab === 'Inputs' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <IndicatorParamsForm def={def} params={params} onChange={setParams} />
                        </div>
                    )}

                    {/* STYLE TAB */}
                    {activeTab === 'Style' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {def.plots && def.plots.map(plot => (
                                <StylePlotSection
                                    key={plot.id}
                                    plot={plot}
                                    styleDef={styles[plot.id] || { color: '#2962FF', lineWidth: 2, lineStyle: 0, visible: true }}
                                    onStyleChange={(updates) => {
                                        setStyles(prev => ({
                                            ...prev,
                                            [plot.id]: { ...prev[plot.id], ...updates }
                                        }));
                                    }}
                                    showColorPicker={showColorPicker === plot.id}
                                    onToggleColorPicker={() => setShowColorPicker(showColorPicker === plot.id ? null : plot.id)}
                                    colorPickerRef={showColorPicker === plot.id ? colorPickerRef : null}
                                />
                            ))}
                            {(!def.plots || def.plots.length === 0) && (
                                <div style={{
                                    padding: '40px 20px',
                                    textAlign: 'center',
                                    color: '#6a6d78',
                                    fontSize: '13px',
                                    fontStyle: 'italic'
                                }}>
                                    No customizable styles for this indicator.
                                </div>
                            )}
                        </div>
                    )}

                    {/* VISIBILITY TAB */}
                    {activeTab === 'Visibility' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{
                                fontSize: '12px',
                                color: '#6a6d78',
                                marginBottom: '12px',
                                letterSpacing: '0.3px'
                            }}>
                                Select intervals where this indicator should be visible:
                            </div>
                            {['Seconds', 'Minutes', 'Hours', 'Days', 'Weeks', 'Months'].map(range => (
                                <VisibilityRow key={range} label={range} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(0,0,0,0.2)'
                }}>
                    <button
                        style={{
                            padding: '10px 20px',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '6px',
                            color: '#b2b5be',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={e => {
                            e.target.style.borderColor = 'rgba(255,255,255,0.25)';
                            e.target.style.color = '#f0f3fa';
                        }}
                        onMouseLeave={e => {
                            e.target.style.borderColor = 'rgba(255,255,255,0.12)';
                            e.target.style.color = '#b2b5be';
                        }}
                    >
                        Defaults
                    </button>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '10px 24px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                color: '#b2b5be',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '500',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => {
                                e.target.style.background = 'rgba(255,255,255,0.08)';
                                e.target.style.color = '#f0f3fa';
                            }}
                            onMouseLeave={e => {
                                e.target.style.background = 'rgba(255,255,255,0.05)';
                                e.target.style.color = '#b2b5be';
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            style={{
                                padding: '10px 32px',
                                background: 'linear-gradient(135deg, #2962ff 0%, #1e4bd8 100%)',
                                border: 'none',
                                borderRadius: '6px',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '600',
                                boxShadow: '0 4px 12px rgba(41, 98, 255, 0.3)',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => {
                                e.target.style.boxShadow = '0 6px 20px rgba(41, 98, 255, 0.45)';
                                e.target.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={e => {
                                e.target.style.boxShadow = '0 4px 12px rgba(41, 98, 255, 0.3)';
                                e.target.style.transform = 'translateY(0)';
                            }}
                        >
                            Ok
                        </button>
                    </div>
                </div>

                {/* CSS Animations */}
                <style>{`
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes slideUp {
                        from { opacity: 0; transform: translateY(20px) scale(0.98); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                `}</style>
            </div>
        </div>
    );
}

/**
 * Style Plot Section - Premium UI for each plot
 */
function StylePlotSection({ plot, styleDef, onStyleChange, showColorPicker, onToggleColorPicker, colorPickerRef }) {
    const thicknessOptions = [1, 2, 3, 4];
    const lineStyleOptions = [
        { value: 0, label: 'Solid', dasharray: 'none' },
        { value: 1, label: 'Dashed', dasharray: '8,4' },
        { value: 2, label: 'Dotted', dasharray: '2,2' }
    ];

    return (
        <div style={{
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.06)',
            padding: '20px',
            position: 'relative'
        }}>
            {/* Header Row: Checkbox + Title + Color/Preview */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Premium Checkbox */}
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        border: styleDef.visible ? 'none' : '2px solid #6a6d78',
                        background: styleDef.visible ? 'linear-gradient(135deg, #2962ff 0%, #1e4bd8 100%)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}>
                        <input
                            type="checkbox"
                            checked={styleDef.visible ?? true}
                            onChange={(e) => onStyleChange({ visible: e.target.checked })}
                            style={{ display: 'none' }}
                        />
                        {styleDef.visible && (
                            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                                <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                    </label>
                    <span style={{
                        fontSize: '14px',
                        color: '#f0f3fa',
                        fontWeight: '500',
                        letterSpacing: '0.2px'
                    }}>
                        {plot.title}
                    </span>
                </div>

                {/* Color + Line Preview */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
                    {/* Color Box */}
                    <div
                        onClick={onToggleColorPicker}
                        style={{
                            width: '36px',
                            height: '24px',
                            borderRadius: '4px',
                            background: styleDef.color,
                            cursor: 'pointer',
                            border: '2px solid rgba(255,255,255,0.15)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            transition: 'all 0.2s ease'
                        }}
                    />
                    {/* Line Preview SVG */}
                    <svg width="40" height="24" style={{ display: 'block' }}>
                        <line
                            x1="2" y1="12" x2="38" y2="12"
                            stroke={styleDef.color}
                            strokeWidth={styleDef.lineWidth || 2}
                            strokeDasharray={
                                styleDef.lineStyle === 1 ? '8,4' :
                                    styleDef.lineStyle === 2 ? '2,2' : 'none'
                            }
                            strokeLinecap="round"
                        />
                    </svg>

                    {/* Color Picker Dropdown */}
                    {showColorPicker && (
                        <div
                            ref={colorPickerRef}
                            style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '8px',
                                background: '#1e222d',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                padding: '12px',
                                boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                                zIndex: 1000,
                                minWidth: '280px'
                            }}
                        >
                            {/* Color Grid */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {COLOR_PALETTE.map((row, ri) => (
                                    <div key={ri} style={{ display: 'flex', gap: '4px' }}>
                                        {row.map((color, ci) => (
                                            <div
                                                key={ci}
                                                onClick={() => {
                                                    onStyleChange({ color });
                                                    onToggleColorPicker();
                                                }}
                                                style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    borderRadius: '2px',
                                                    background: color,
                                                    cursor: 'pointer',
                                                    border: styleDef.color === color ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                                                    transition: 'transform 0.1s ease'
                                                }}
                                                onMouseEnter={e => e.target.style.transform = 'scale(1.2)'}
                                                onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                                            />
                                        ))}
                                    </div>
                                ))}
                            </div>
                            {/* Custom Color Input */}
                            <div style={{
                                marginTop: '12px',
                                paddingTop: '12px',
                                borderTop: '1px solid rgba(255,255,255,0.08)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span style={{ fontSize: '11px', color: '#6a6d78' }}>Custom:</span>
                                <input
                                    type="color"
                                    value={styleDef.color}
                                    onChange={(e) => onStyleChange({ color: e.target.value })}
                                    style={{
                                        width: '32px',
                                        height: '24px',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        background: 'transparent'
                                    }}
                                />
                                <input
                                    type="text"
                                    value={styleDef.color.toUpperCase()}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                                            onStyleChange({ color: val });
                                        }
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '6px 10px',
                                        background: 'rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '4px',
                                        color: '#f0f3fa',
                                        fontSize: '12px',
                                        fontFamily: 'monospace'
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Thickness Section */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{
                    fontSize: '11px',
                    color: '#6a6d78',
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    fontWeight: '500'
                }}>
                    Thickness
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {thicknessOptions.map(width => (
                        <button
                            key={width}
                            onClick={() => onStyleChange({ lineWidth: width })}
                            style={{
                                width: '48px',
                                height: '36px',
                                background: (styleDef.lineWidth || 2) === width
                                    ? 'rgba(41, 98, 255, 0.15)'
                                    : 'rgba(255,255,255,0.03)',
                                border: (styleDef.lineWidth || 2) === width
                                    ? '1px solid rgba(41, 98, 255, 0.5)'
                                    : '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <div style={{
                                width: '24px',
                                height: `${width}px`,
                                background: styleDef.color,
                                borderRadius: `${width / 2}px`
                            }} />
                        </button>
                    ))}
                </div>
            </div>

            {/* Line Style Section (Solid/Dashed/Dotted) */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{
                    fontSize: '11px',
                    color: '#6a6d78',
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    fontWeight: '500'
                }}>
                    Line Style
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {lineStyleOptions.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => onStyleChange({ lineStyle: opt.value })}
                            style={{
                                width: '64px',
                                height: '36px',
                                background: (styleDef.lineStyle ?? 0) === opt.value
                                    ? 'rgba(41, 98, 255, 0.15)'
                                    : 'rgba(255,255,255,0.03)',
                                border: (styleDef.lineStyle ?? 0) === opt.value
                                    ? '1px solid rgba(41, 98, 255, 0.5)'
                                    : '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease'
                            }}
                            title={opt.label}
                        >
                            <svg width="40" height="4">
                                <line
                                    x1="2" y1="2" x2="38" y2="2"
                                    stroke={styleDef.color}
                                    strokeWidth="2"
                                    strokeDasharray={opt.dasharray}
                                    strokeLinecap="round"
                                />
                            </svg>
                        </button>
                    ))}
                </div>
            </div>

            {/* Line Type Section (Line/Step/Curved) */}
            <div>
                <div style={{
                    fontSize: '11px',
                    color: '#6a6d78',
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    fontWeight: '500'
                }}>
                    Line Type
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Line (Simple/Diagonal) */}
                    <button
                        onClick={() => onStyleChange({ lineType: 0 })}
                        style={{
                            flex: 1,
                            height: '42px',
                            background: (styleDef.lineType ?? 0) === 0
                                ? 'rgba(41, 98, 255, 0.15)'
                                : 'rgba(255,255,255,0.03)',
                            border: (styleDef.lineType ?? 0) === 0
                                ? '1px solid rgba(41, 98, 255, 0.5)'
                                : '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            transition: 'all 0.15s ease'
                        }}
                        title="Line - Diagonal connection between points"
                    >
                        <svg width="36" height="18" viewBox="0 0 36 18">
                            <polyline
                                points="2,14 12,10 22,6 34,2"
                                fill="none"
                                stroke={styleDef.color}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <span style={{ fontSize: '9px', color: '#6a6d78', letterSpacing: '0.5px' }}>LINE</span>
                    </button>

                    {/* Step Line */}
                    <button
                        onClick={() => onStyleChange({ lineType: 1 })}
                        style={{
                            flex: 1,
                            height: '42px',
                            background: (styleDef.lineType ?? 0) === 1
                                ? 'rgba(41, 98, 255, 0.15)'
                                : 'rgba(255,255,255,0.03)',
                            border: (styleDef.lineType ?? 0) === 1
                                ? '1px solid rgba(41, 98, 255, 0.5)'
                                : '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            transition: 'all 0.15s ease'
                        }}
                        title="Step Line - Horizontal then vertical (staircase pattern)"
                    >
                        <svg width="36" height="18" viewBox="0 0 36 18">
                            {/* Step line: horizontal, then vertical steps */}
                            <polyline
                                points="2,14 10,14 10,10 18,10 18,6 26,6 26,2 34,2"
                                fill="none"
                                stroke={styleDef.color}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <span style={{ fontSize: '9px', color: '#6a6d78', letterSpacing: '0.5px' }}>STEP</span>
                    </button>

                    {/* Curved Line */}
                    <button
                        onClick={() => onStyleChange({ lineType: 2 })}
                        style={{
                            flex: 1,
                            height: '42px',
                            background: (styleDef.lineType ?? 0) === 2
                                ? 'rgba(41, 98, 255, 0.15)'
                                : 'rgba(255,255,255,0.03)',
                            border: (styleDef.lineType ?? 0) === 2
                                ? '1px solid rgba(41, 98, 255, 0.5)'
                                : '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            transition: 'all 0.15s ease'
                        }}
                        title="Curved - Smooth bezier curve through points"
                    >
                        <svg width="36" height="18" viewBox="0 0 36 18">
                            {/* Smooth curve using bezier */}
                            <path
                                d="M2,14 C8,14 10,6 18,9 C26,12 28,2 34,2"
                                fill="none"
                                stroke={styleDef.color}
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </svg>
                        <span style={{ fontSize: '9px', color: '#6a6d78', letterSpacing: '0.5px' }}>CURVED</span>
                    </button>
                </div>
            </div>
            {/* TradingView Step Logic Option */}
            {styleDef.lineType === 1 && (
                <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: 'rgba(41, 98, 255, 0.05)',
                    border: '1px solid rgba(41, 98, 255, 0.1)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        borderRadius: '4px',
                        border: styleDef.tvStepLogic ? 'none' : '2px solid #6a6d78',
                        background: styleDef.tvStepLogic ? 'linear-gradient(135deg, #2962ff 0%, #1e4bd8 100%)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}>
                        <input
                            type="checkbox"
                            checked={styleDef.tvStepLogic ?? false}
                            onChange={(e) => onStyleChange({ tvStepLogic: e.target.checked })}
                            style={{ display: 'none' }}
                        />
                        {styleDef.tvStepLogic && (
                            <svg width="10" height="8" viewBox="0 0 12 10" fill="none">
                                <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                    </label>
                    <div>
                        <div style={{ fontSize: '13px', color: '#f0f3fa', fontWeight: '500' }}>TV Step Logic</div>
                        <div style={{ fontSize: '11px', color: '#6a6d78', marginTop: '2px' }}>Use previous value for step strategy</div>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Visibility Row - Premium toggle row
 */
function VisibilityRow({ label }) {
    const [checked, setChecked] = useState(true);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.04)',
            transition: 'all 0.2s ease'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Premium Checkbox */}
                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '18px',
                    height: '18px',
                    borderRadius: '4px',
                    border: checked ? 'none' : '2px solid #6a6d78',
                    background: checked ? 'linear-gradient(135deg, #2962ff 0%, #1e4bd8 100%)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                }}>
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setChecked(e.target.checked)}
                        style={{ display: 'none' }}
                    />
                    {checked && (
                        <svg width="10" height="8" viewBox="0 0 12 10" fill="none">
                            <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    )}
                </label>
                <span style={{ fontSize: '13px', color: '#b2b5be', fontWeight: '400' }}>{label}</span>
            </div>
            <span style={{ fontSize: '11px', color: '#50535e', fontFamily: 'monospace' }}>1 - 59</span>
        </div>
    );
}

/**
 * Premium Input Form for indicator params
 */
function IndicatorParamsForm({ def, params, onChange }) {
    if (!def || !def.paramDefs) return null;

    const handleChange = (key, value) => {
        onChange(prev => ({ ...prev, [key]: value }));
    };

    return (
        <>
            {def.paramDefs.map(p => (
                <div
                    key={p.key}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.04)'
                    }}
                >
                    <label style={{
                        fontSize: '13px',
                        color: '#b2b5be',
                        fontWeight: '400'
                    }}>
                        {p.label}
                    </label>

                    {p.type === 'number' && (
                        <input
                            type="number"
                            value={params[p.key]}
                            min={p.min}
                            max={p.max}
                            step={p.step}
                            onChange={(e) => handleChange(p.key, parseFloat(e.target.value))}
                            style={{
                                width: '80px',
                                padding: '8px 12px',
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                color: '#f0f3fa',
                                fontSize: '13px',
                                textAlign: 'right',
                                outline: 'none',
                                transition: 'border-color 0.2s ease'
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'rgba(41, 98, 255, 0.5)'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                        />
                    )}

                    {p.type === 'select' && (
                        <select
                            value={params[p.key]}
                            onChange={(e) => handleChange(p.key, e.target.value)}
                            style={{
                                padding: '8px 12px',
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                color: '#f0f3fa',
                                fontSize: '13px',
                                outline: 'none',
                                cursor: 'pointer',
                                minWidth: '100px'
                            }}
                        >
                            {p.options.map(opt => (
                                <option key={opt.value} value={opt.value} style={{ background: '#1e222d' }}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            ))}
        </>
    );
}
