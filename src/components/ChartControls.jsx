import React, { useState } from 'react';

// Icons as SVG components - accept size prop
const ZoomOutIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);

const ZoomInIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);

const PanLeftIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
);

const PanRightIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
);

const ResetIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
        <path d="M3 3v5h5"></path>
    </svg>
);

export default function ChartControls({ chart, style = {}, size = 'normal' }) {
    const [isHovered, setIsHovered] = useState(false);

    if (!chart) return null;

    // Sizing based on prop
    const isSmall = size === 'small';
    const iconSize = isSmall ? 14 : 20;
    const resetIconSize = isSmall ? 12 : 18;
    const btnPadding = isSmall ? '3px' : '6px';
    const containerPadding = isSmall ? '2px' : '4px';
    const borderRadius = isSmall ? '4px' : '6px';
    const gap = isSmall ? '1px' : '2px';

    const handleZoomIn = (e) => {
        e.stopPropagation();
        const timeScale = chart.timeScale();
        // Increase bar spacing (zoom in)
        timeScale.applyOptions({
            barSpacing: timeScale.options().barSpacing * 1.2
        });
    };

    const handleZoomOut = (e) => {
        e.stopPropagation();
        const timeScale = chart.timeScale();
        // Decrease bar spacing (zoom out)
        timeScale.applyOptions({
            barSpacing: timeScale.options().barSpacing * 0.8
        });
    };

    const handlePanLeft = (e) => {
        e.stopPropagation();
        const timeScale = chart.timeScale();
        const currentPos = timeScale.scrollPosition();
        timeScale.scrollToPosition(currentPos + 5, true);
    };

    const handlePanRight = (e) => {
        e.stopPropagation();
        const timeScale = chart.timeScale();
        const currentPos = timeScale.scrollPosition();
        timeScale.scrollToPosition(currentPos - 5, true);
    };

    const handleReset = (e) => {
        e.stopPropagation();
        const timeScale = chart.timeScale();
        timeScale.scrollToRealTime();
        timeScale.applyOptions({ barSpacing: 6 }); // Reset zoom
    };

    const btnStyle = {
        background: 'transparent',
        border: 'none',
        color: '#94a3b8',
        cursor: 'pointer',
        padding: btnPadding,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: isSmall ? '3px' : '4px',
        transition: 'background 0.2s, color 0.2s',
    };

    const btnHoverStyle = {
        background: 'rgba(255, 255, 255, 0.1)',
        color: '#fff',
    };

    return (
        <div
            className="chart-controls-wrapper"
            style={{
                position: 'absolute',
                bottom: isSmall ? '8px' : '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 20,
                // Expand hover area slightly
                padding: '8px',
                ...style
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div
                className="chart-controls"
                style={{
                    display: 'flex',
                    gap: gap,
                    background: '#1e293b',
                    padding: containerPadding,
                    borderRadius: borderRadius,
                    border: '1px solid #334155',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    opacity: isHovered ? 1 : 0,
                    transition: 'opacity 0.2s ease-in-out',
                    pointerEvents: isHovered ? 'auto' : 'none',
                }}
                onClick={(e) => e.stopPropagation()} // Prevent chart click through
            >
                <button
                    title="Zoom Out"
                    onClick={handleZoomOut}
                    onMouseEnter={e => { Object.assign(e.currentTarget.style, btnHoverStyle) }}
                    onMouseLeave={e => { Object.assign(e.currentTarget.style, btnStyle) }}
                    style={btnStyle}
                >
                    <ZoomOutIcon size={iconSize} />
                </button>

                <button
                    title="Zoom In"
                    onClick={handleZoomIn}
                    onMouseEnter={e => { Object.assign(e.currentTarget.style, btnHoverStyle) }}
                    onMouseLeave={e => { Object.assign(e.currentTarget.style, btnStyle) }}
                    style={btnStyle}
                >
                    <ZoomInIcon size={iconSize} />
                </button>

                <div style={{ width: '1px', background: '#334155', margin: `0 ${gap}` }} />

                <button
                    title="Pan Left"
                    onClick={handlePanLeft}
                    onMouseEnter={e => { Object.assign(e.currentTarget.style, btnHoverStyle) }}
                    onMouseLeave={e => { Object.assign(e.currentTarget.style, btnStyle) }}
                    style={btnStyle}
                >
                    <PanLeftIcon size={iconSize} />
                </button>

                <button
                    title="Pan Right"
                    onClick={handlePanRight}
                    onMouseEnter={e => { Object.assign(e.currentTarget.style, btnHoverStyle) }}
                    onMouseLeave={e => { Object.assign(e.currentTarget.style, btnStyle) }}
                    style={btnStyle}
                >
                    <PanRightIcon size={iconSize} />
                </button>

                <div style={{ width: '1px', background: '#334155', margin: `0 ${gap}` }} />

                <button
                    title="Reset View"
                    onClick={handleReset}
                    onMouseEnter={e => { Object.assign(e.currentTarget.style, btnHoverStyle) }}
                    onMouseLeave={e => { Object.assign(e.currentTarget.style, btnStyle) }}
                    style={btnStyle}
                >
                    <ResetIcon size={resetIconSize} />
                </button>
            </div>
        </div>
    );
}
