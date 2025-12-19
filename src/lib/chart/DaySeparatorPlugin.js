/**
 * DaySeparatorPaneView
 * The view responsible for rendering the day separators.
 */
class DaySeparatorPaneView {
    constructor(source) {
        this._source = source;
    }

    renderer() {
        // Return a renderer object with the draw function
        return {
            draw: (target) => {
                this._drawImpl(target);
            }
        };
    }

    _drawImpl(target) {
        const source = this._source;
        const options = source._options;

        if (!options.visible || !source._currChart || !source._currSeries) return;

        target.useMediaCoordinateSpace((scope) => {
            const ctx = scope.context;
            const timeScale = source._currChart.timeScale();
            const visibleRange = timeScale.getVisibleLogicalRange();

            if (!visibleRange) return;

            ctx.save();
            ctx.beginPath();

            // Set Style
            ctx.strokeStyle = options.color;
            ctx.lineWidth = options.lineWidth;
            ctx.globalAlpha = options.opacity;

            if (options.lineStyle === 1) {
                ctx.setLineDash([10, 10]); // Dashed - Increased size
            } else if (options.lineStyle === 2) {
                ctx.setLineDash([2, 4]); // Dotted
            } else {
                ctx.setLineDash([]); // Solid
            }

            // Iterate logical range to find day breaks
            const start = Math.floor(visibleRange.from);
            const end = Math.ceil(visibleRange.to);

            // Helper to get time for index
            const getTime = (index) => {
                const data = source._currSeries.dataByIndex(index);
                return data ? data.time : null;
            };

            let prevDay = null;

            // Optimization using lookback
            const lookbackTime = getTime(start - 1);
            if (lookbackTime) {
                const d = new Date(lookbackTime * 1000);
                prevDay = d.getDate();
            }

            for (let i = start; i <= end; i++) {
                const time = getTime(i);
                if (!time) continue;

                const date = new Date(time * 1000);
                const day = date.getDate();

                if (prevDay !== null && day !== prevDay) {
                    // Calculate midpoint between current and previous candle
                    const x1 = timeScale.logicalToCoordinate(i);
                    const x2 = timeScale.logicalToCoordinate(i - 1);
                    let x = x1;
                    if (x1 !== null && x2 !== null) {
                        x = (x1 + x2) / 2;
                    }
                    // Draw full height line
                    if (x !== null) {
                        ctx.moveTo(x, 0);
                        ctx.lineTo(x, scope.mediaSize.height);
                    }
                }

                prevDay = day;
            }

            ctx.stroke();
            ctx.restore();
        });
    }
}

/**
 * DaySeparatorPlugin
 * A custom series primitive for Lightweight Charts to draw vertical separators at day breaks.
 */
class DaySeparatorPlugin {
    constructor() {
        this._currChart = null;
        this._currSeries = null;
        this._options = {
            visible: true,
            color: '#363a45',
            lineStyle: 1, // 0=Solid, 1=Dashed, 2=Dotted
            lineWidth: 1,
            opacity: 0.5
        };
        this._paneViews = [new DaySeparatorPaneView(this)];
    }

    attached({ chart, series, requestUpdate }) {
        this._currChart = chart;
        this._currSeries = series;
        this._requestUpdate = requestUpdate;
    }

    detached() {
        this._currChart = null;
        this._currSeries = null;
        this._requestUpdate = null;
    }

    paneViews() {
        return this._paneViews;
    }

    applyOptions(options) {
        this._options = { ...this._options, ...options };
        if (this._requestUpdate) this._requestUpdate();
    }
}

export default DaySeparatorPlugin;
