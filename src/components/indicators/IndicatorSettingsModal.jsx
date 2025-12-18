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
 * Style Plot Section - Modern Collapsible Card Design
 * Compact, iOS-inspired with accordion behavior
 */
function StylePlotSection({ plot, styleDef, onStyleChange, showColorPicker, onToggleColorPicker, colorPickerRef }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const thicknessOptions = [1, 2, 3, 4];
    const lineStyleOptions = [
        { value: 0, icon: '━━━', label: 'Solid' },
        { value: 1, icon: '- - -', label: 'Dashed' },
        { value: 2, icon: '···', label: 'Dotted' }
    ];

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.08)',
            overflow: 'hidden',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            {/* Header - Always visible */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    cursor: 'pointer',
                    userSelect: 'none'
                }}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {/* iOS Toggle for visibility */}
                    <label
                        style={{
                            position: 'relative',
                            display: 'inline-block',
                            width: '44px',
                            height: '26px',
                            cursor: 'pointer'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <input
                            type="checkbox"
                            checked={styleDef.visible ?? true}
                            onChange={(e) => onStyleChange({ visible: e.target.checked })}
                            style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '26px',
                            background: styleDef.visible
                                ? 'linear-gradient(135deg, #34d399 0%, #10b981 100%)'
                                : 'rgba(120, 113, 108, 0.3)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: styleDef.visible
                                ? '0 2px 8px rgba(16, 185, 129, 0.3)'
                                : 'none'
                        }} />
                        <span style={{
                            position: 'absolute',
                            top: '2px',
                            left: styleDef.visible ? '20px' : '2px',
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }} />
                    </label>

                    {/* Plot Title */}
                    <span style={{
                        fontSize: '14px',
                        color: styleDef.visible ? '#f8fafc' : '#64748b',
                        fontWeight: '600',
                        letterSpacing: '0.3px',
                        transition: 'color 0.2s ease'
                    }}>
                        {plot.title}
                    </span>
                </div>

                {/* Right side: Color preview + Expand icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Color swatch with line preview */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 10px',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '8px'
                    }}>
                        <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '6px',
                            background: styleDef.color,
                            boxShadow: `0 0 0 2px rgba(255,255,255,0.1), 0 2px 4px ${styleDef.color}40`
                        }} />
                        <svg width="40" height="4">
                            <line
                                x1="0" y1="2" x2="40" y2="2"
                                stroke={styleDef.color}
                                strokeWidth={styleDef.lineWidth || 2}
                                strokeDasharray={
                                    styleDef.lineStyle === 1 ? '6,3' :
                                        styleDef.lineStyle === 2 ? '2,2' : 'none'
                                }
                                strokeLinecap="round"
                            />
                        </svg>
                    </div>

                    {/* Expand/Collapse chevron */}
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        style={{
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            color: '#64748b'
                        }}
                    >
                        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            </div>

            {/* Expandable Content */}
            <div style={{
                maxHeight: isExpanded ? '400px' : '0',
                opacity: isExpanded ? 1 : 0,
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
                <div style={{
                    padding: '0 18px 18px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    {/* Color Picker Row */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>Color</span>
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleColorPicker(); }}
                                style={{
                                    width: '80px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    border: '2px solid rgba(255,255,255,0.1)',
                                    background: styleDef.color,
                                    cursor: 'pointer',
                                    boxShadow: `0 2px 8px ${styleDef.color}40`,
                                    transition: 'all 0.2s ease'
                                }}
                            />
                            {/* Color Picker Dropdown - Fixed position to avoid overflow */}
                            {showColorPicker && (
                                <div
                                    ref={colorPickerRef}
                                    onClick={e => e.stopPropagation()}
                                    style={{
                                        position: 'fixed',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        background: 'linear-gradient(180deg, #1e222d 0%, #131722 100%)',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        borderRadius: '16px',
                                        padding: '18px',
                                        boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
                                        zIndex: 2000
                                    }}
                                >
                                    {/* Header */}
                                    <div style={{ marginBottom: '12px', fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>
                                        Select Color
                                    </div>
                                    {/* Color Grid */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {COLOR_PALETTE.map((row, ri) => (
                                            <div key={ri} style={{ display: 'flex', gap: '4px' }}>
                                                {row.map((color, ci) => (
                                                    <div
                                                        key={ci}
                                                        onClick={() => { onStyleChange({ color }); onToggleColorPicker(); }}
                                                        style={{
                                                            width: '20px',
                                                            height: '20px',
                                                            borderRadius: '4px',
                                                            background: color,
                                                            cursor: 'pointer',
                                                            border: styleDef.color === color ? '2px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                                                            transform: 'scale(1)',
                                                            transition: 'transform 0.15s ease'
                                                        }}
                                                        onMouseEnter={e => e.target.style.transform = 'scale(1.15)'}
                                                        onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                                                    />
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                    {/* Custom Color Input */}
                                    <div style={{
                                        marginTop: '14px',
                                        paddingTop: '14px',
                                        borderTop: '1px solid rgba(255,255,255,0.08)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}>
                                        <input
                                            type="color"
                                            value={styleDef.color}
                                            onChange={(e) => onStyleChange({ color: e.target.value })}
                                            style={{
                                                width: '32px',
                                                height: '32px',
                                                border: 'none',
                                                borderRadius: '8px',
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
                                                padding: '10px 12px',
                                                background: 'rgba(0,0,0,0.4)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '8px',
                                                color: '#f8fafc',
                                                fontSize: '13px',
                                                fontFamily: 'monospace',
                                                fontWeight: '500'
                                            }}
                                        />
                                    </div>
                                    {/* Close button */}
                                    <button
                                        onClick={onToggleColorPicker}
                                        style={{
                                            marginTop: '14px',
                                            width: '100%',
                                            padding: '10px',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '8px',
                                            color: '#94a3b8',
                                            fontSize: '12px',
                                            fontWeight: '500',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        Done
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Opacity Slider */}
                    <div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '10px'
                        }}>
                            <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>Opacity</span>
                            <span style={{
                                fontSize: '12px',
                                color: '#f8fafc',
                                fontWeight: '600',
                                background: 'rgba(0,0,0,0.3)',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontFamily: 'monospace'
                            }}>
                                {Math.round((styleDef.opacity ?? 1) * 100)}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round((styleDef.opacity ?? 1) * 100)}
                            onChange={(e) => { e.stopPropagation(); onStyleChange({ opacity: parseInt(e.target.value) / 100 }); }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: '100%',
                                height: '6px',
                                borderRadius: '3px',
                                background: `linear-gradient(to right, ${styleDef.color} 0%, ${styleDef.color}00 100%)`,
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                cursor: 'pointer',
                                outline: 'none'
                            }}
                        />
                    </div>

                    {/* Thickness - Segmented Control */}
                    <div>
                        <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500', display: 'block', marginBottom: '10px' }}>
                            Thickness
                        </span>
                        <div style={{
                            display: 'flex',
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: '10px',
                            padding: '3px',
                            gap: '2px'
                        }}>
                            {thicknessOptions.map(width => (
                                <button
                                    key={width}
                                    onClick={(e) => { e.stopPropagation(); onStyleChange({ lineWidth: width }); }}
                                    style={{
                                        flex: 1,
                                        height: '36px',
                                        background: (styleDef.lineWidth || 2) === width
                                            ? 'linear-gradient(135deg, rgba(41, 98, 255, 0.3) 0%, rgba(41, 98, 255, 0.15) 100%)'
                                            : 'transparent',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div style={{
                                        width: '24px',
                                        height: `${width + 1}px`,
                                        background: (styleDef.lineWidth || 2) === width ? styleDef.color : '#64748b',
                                        borderRadius: `${(width + 1) / 2}px`
                                    }} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Line Style - Segmented Control */}
                    <div>
                        <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500', display: 'block', marginBottom: '10px' }}>
                            Style
                        </span>
                        <div style={{
                            display: 'flex',
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: '10px',
                            padding: '3px',
                            gap: '2px'
                        }}>
                            {lineStyleOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={(e) => { e.stopPropagation(); onStyleChange({ lineStyle: opt.value }); }}
                                    style={{
                                        flex: 1,
                                        height: '36px',
                                        background: (styleDef.lineStyle ?? 0) === opt.value
                                            ? 'linear-gradient(135deg, rgba(41, 98, 255, 0.3) 0%, rgba(41, 98, 255, 0.15) 100%)'
                                            : 'transparent',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        color: (styleDef.lineStyle ?? 0) === opt.value ? '#f8fafc' : '#64748b',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        letterSpacing: '0.5px',
                                        transition: 'all 0.2s ease'
                                    }}
                                    title={opt.label}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Line Type - Segmented Control (LINE/STEP/CURVED) */}
                    <div>
                        <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500', display: 'block', marginBottom: '10px' }}>
                            Line Type
                        </span>
                        <div style={{
                            display: 'flex',
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: '10px',
                            padding: '3px',
                            gap: '2px'
                        }}>
                            {/* Line */}
                            <button
                                onClick={(e) => { e.stopPropagation(); onStyleChange({ lineType: 0 }); }}
                                style={{
                                    flex: 1,
                                    height: '44px',
                                    background: (styleDef.lineType ?? 0) === 0
                                        ? 'linear-gradient(135deg, rgba(41, 98, 255, 0.3) 0%, rgba(41, 98, 255, 0.15) 100%)'
                                        : 'transparent',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '3px',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <svg width="32" height="14" viewBox="0 0 32 14">
                                    <polyline
                                        points="2,12 10,8 20,4 30,2"
                                        fill="none"
                                        stroke={(styleDef.lineType ?? 0) === 0 ? styleDef.color : '#64748b'}
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                                <span style={{ fontSize: '9px', color: (styleDef.lineType ?? 0) === 0 ? '#f8fafc' : '#64748b', fontWeight: '600' }}>LINE</span>
                            </button>

                            {/* Step */}
                            <button
                                onClick={(e) => { e.stopPropagation(); onStyleChange({ lineType: 1 }); }}
                                style={{
                                    flex: 1,
                                    height: '44px',
                                    background: (styleDef.lineType ?? 0) === 1
                                        ? 'linear-gradient(135deg, rgba(41, 98, 255, 0.3) 0%, rgba(41, 98, 255, 0.15) 100%)'
                                        : 'transparent',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '3px',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <svg width="32" height="14" viewBox="0 0 32 14">
                                    <polyline
                                        points="2,12 8,12 8,8 16,8 16,4 24,4 24,2 30,2"
                                        fill="none"
                                        stroke={(styleDef.lineType ?? 0) === 1 ? styleDef.color : '#64748b'}
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                                <span style={{ fontSize: '9px', color: (styleDef.lineType ?? 0) === 1 ? '#f8fafc' : '#64748b', fontWeight: '600' }}>STEP</span>
                            </button>

                            {/* Curved */}
                            <button
                                onClick={(e) => { e.stopPropagation(); onStyleChange({ lineType: 2 }); }}
                                style={{
                                    flex: 1,
                                    height: '44px',
                                    background: (styleDef.lineType ?? 0) === 2
                                        ? 'linear-gradient(135deg, rgba(41, 98, 255, 0.3) 0%, rgba(41, 98, 255, 0.15) 100%)'
                                        : 'transparent',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '3px',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <svg width="32" height="14" viewBox="0 0 32 14">
                                    <path
                                        d="M2,12 C8,12 10,4 16,7 C22,10 24,2 30,2"
                                        fill="none"
                                        stroke={(styleDef.lineType ?? 0) === 2 ? styleDef.color : '#64748b'}
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <span style={{ fontSize: '9px', color: (styleDef.lineType ?? 0) === 2 ? '#f8fafc' : '#64748b', fontWeight: '600' }}>CURVED</span>
                            </button>
                        </div>
                    </div>

                    {/* TV Step Logic - Only visible when lineType is STEP */}
                    {styleDef.lineType === 1 && (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '14px 16px',
                                background: 'linear-gradient(135deg, rgba(41, 98, 255, 0.08) 0%, rgba(41, 98, 255, 0.03) 100%)',
                                borderRadius: '12px',
                                border: '1px solid rgba(41, 98, 255, 0.15)'
                            }}
                        >
                            <div>
                                <div style={{ fontSize: '13px', color: '#f8fafc', fontWeight: '500' }}>TV Step Logic</div>
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Use previous value for step</div>
                            </div>
                            {/* iOS Toggle */}
                            <label style={{
                                position: 'relative',
                                display: 'inline-block',
                                width: '44px',
                                height: '26px',
                                cursor: 'pointer'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={styleDef.tvStepLogic ?? false}
                                    onChange={(e) => onStyleChange({ tvStepLogic: e.target.checked })}
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span style={{
                                    position: 'absolute',
                                    inset: 0,
                                    borderRadius: '26px',
                                    background: styleDef.tvStepLogic
                                        ? 'linear-gradient(135deg, #2962ff 0%, #1e4bd8 100%)'
                                        : 'rgba(120, 113, 108, 0.3)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: styleDef.tvStepLogic
                                        ? '0 2px 8px rgba(41, 98, 255, 0.3)'
                                        : 'none'
                                }} />
                                <span style={{
                                    position: 'absolute',
                                    top: '2px',
                                    left: styleDef.tvStepLogic ? '20px' : '2px',
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                }} />
                            </label>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Visibility Row - Modern iOS-style design
 */
function VisibilityRow({ label }) {
    const [checked, setChecked] = useState(true);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.06)',
            transition: 'all 0.2s ease'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {/* iOS Toggle */}
                <label style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: '44px',
                    height: '26px',
                    cursor: 'pointer'
                }}>
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setChecked(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '26px',
                        background: checked
                            ? 'linear-gradient(135deg, #34d399 0%, #10b981 100%)'
                            : 'rgba(120, 113, 108, 0.3)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: checked
                            ? '0 2px 8px rgba(16, 185, 129, 0.3)'
                            : 'none'
                    }} />
                    <span style={{
                        position: 'absolute',
                        top: '2px',
                        left: checked ? '20px' : '2px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} />
                </label>
                <span style={{
                    fontSize: '14px',
                    color: checked ? '#e2e8f0' : '#64748b',
                    fontWeight: '500',
                    transition: 'color 0.2s ease'
                }}>
                    {label}
                </span>
            </div>
            <span style={{
                fontSize: '12px',
                color: '#475569',
                fontFamily: 'monospace',
                background: 'rgba(0,0,0,0.2)',
                padding: '4px 8px',
                borderRadius: '6px'
            }}>
                All
            </span>
        </div>
    );
}

/**
 * Premium Input Form for indicator params
 * Redesigned with iOS-style toggles and modern aesthetics
 */
function IndicatorParamsForm({ def, params, onChange }) {
    if (!def || !def.paramDefs) return null;

    const handleChange = (key, value) => {
        onChange(prev => ({ ...prev, [key]: value }));
    };

    // Group boolean params together for cleaner organization
    const booleanParams = def.paramDefs.filter(p => p.type === 'boolean');
    const otherParams = def.paramDefs.filter(p => p.type !== 'boolean');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Non-boolean parameters first */}
            {otherParams.map(p => (
                <div
                    key={p.key}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 18px',
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    <label style={{
                        fontSize: '14px',
                        color: '#e2e8f0',
                        fontWeight: '500',
                        letterSpacing: '0.2px'
                    }}>
                        {p.label}
                    </label>

                    {p.type === 'number' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Stepper buttons for number input */}
                            <button
                                onClick={() => handleChange(p.key, Math.max(p.min || 0, (params[p.key] || 0) - (p.step || 1)))}
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: 'rgba(255,255,255,0.08)',
                                    color: '#94a3b8',
                                    fontSize: '18px',
                                    fontWeight: '300',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.12)'}
                                onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.08)'}
                            >
                                −
                            </button>
                            <input
                                type="number"
                                value={params[p.key]}
                                min={p.min}
                                max={p.max}
                                step={p.step}
                                onChange={(e) => handleChange(p.key, parseFloat(e.target.value))}
                                style={{
                                    width: '60px',
                                    padding: '8px 4px',
                                    background: 'transparent',
                                    border: 'none',
                                    borderBottom: '2px solid rgba(41, 98, 255, 0.4)',
                                    color: '#f8fafc',
                                    fontSize: '15px',
                                    fontWeight: '600',
                                    textAlign: 'center',
                                    outline: 'none',
                                    transition: 'border-color 0.2s ease'
                                }}
                                onFocus={(e) => e.target.style.borderBottomColor = '#2962ff'}
                                onBlur={(e) => e.target.style.borderBottomColor = 'rgba(41, 98, 255, 0.4)'}
                            />
                            <button
                                onClick={() => handleChange(p.key, Math.min(p.max || 999, (params[p.key] || 0) + (p.step || 1)))}
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: 'rgba(255,255,255,0.08)',
                                    color: '#94a3b8',
                                    fontSize: '18px',
                                    fontWeight: '300',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.12)'}
                                onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.08)'}
                            >
                                +
                            </button>
                        </div>
                    )}

                    {p.type === 'select' && (
                        <div style={{ position: 'relative' }}>
                            <select
                                value={params[p.key]}
                                onChange={(e) => handleChange(p.key, e.target.value)}
                                style={{
                                    padding: '10px 36px 10px 14px',
                                    background: 'rgba(0,0,0,0.4)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '10px',
                                    color: '#f8fafc',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    minWidth: '110px',
                                    appearance: 'none',
                                    WebkitAppearance: 'none'
                                }}
                            >
                                {p.options.map(opt => (
                                    <option key={opt.value} value={opt.value} style={{ background: '#1e222d' }}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                            {/* Custom dropdown arrow */}
                            <div style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                pointerEvents: 'none',
                                color: '#64748b'
                            }}>
                                ▾
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {/* Boolean parameters with iOS-style toggle switches */}
            {booleanParams.length > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    overflow: 'hidden'
                }}>
                    {booleanParams.map((p, idx) => (
                        <div
                            key={p.key}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '16px 18px',
                                borderBottom: idx < booleanParams.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none'
                            }}
                        >
                            <span style={{
                                fontSize: '14px',
                                color: '#e2e8f0',
                                fontWeight: '500'
                            }}>
                                {p.label}
                            </span>

                            {/* iOS-style Toggle Switch */}
                            <label style={{
                                position: 'relative',
                                display: 'inline-block',
                                width: '51px',
                                height: '31px',
                                cursor: 'pointer'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={params[p.key] ?? p.default ?? false}
                                    onChange={(e) => handleChange(p.key, e.target.checked)}
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                {/* Track */}
                                <span style={{
                                    position: 'absolute',
                                    inset: 0,
                                    borderRadius: '31px',
                                    background: params[p.key]
                                        ? 'linear-gradient(135deg, #34d399 0%, #10b981 100%)'
                                        : 'rgba(120, 113, 108, 0.3)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: params[p.key]
                                        ? 'inset 0 0 0 1px rgba(255,255,255,0.1), 0 2px 8px rgba(16, 185, 129, 0.3)'
                                        : 'inset 0 0 0 1px rgba(255,255,255,0.05)'
                                }} />
                                {/* Knob */}
                                <span style={{
                                    position: 'absolute',
                                    top: '2px',
                                    left: params[p.key] ? '22px' : '2px',
                                    width: '27px',
                                    height: '27px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                }} />
                            </label>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {def.paramDefs.length === 0 && (
                <div style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '14px'
                }}>
                    No configurable parameters for this indicator.
                </div>
            )}
        </div>
    );
}

