import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { FVGZone } from '../../utils/fvgDetection';

interface FVGOverlayProps {
    fvgZones: FVGZone[];
    xScale: d3.ScaleTime<number, number> | d3.ScaleLinear<number, number>;
    yScale: d3.ScaleLinear<number, number>;
    width: number;
    height: number;
    onFVGClick?: (fvg: FVGZone) => void;
}

const FVGOverlay: React.FC<FVGOverlayProps> = ({
    fvgZones,
    xScale,
    yScale,
    width,
    height,
    onFVGClick
}) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || !fvgZones.length) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove(); // Clear previous renders

        // Create tooltip
        const tooltip = d3.select('body')
            .selectAll('.fvg-tooltip')
            .data([null])
            .join('div')
            .attr('class', 'fvg-tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background-color', 'rgba(0, 0, 0, 0.9)')
            .style('color', 'white')
            .style('padding', '8px 12px')
            .style('border-radius', '6px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.3)');

        // Render FVG rectangles
        const fvgGroup = svg.append('g').attr('class', 'fvg-zones');

        fvgZones.forEach((fvg) => {
            const startX = typeof fvg.startTime === 'number'
                ? xScale(fvg.startTime)
                : xScale(new Date(fvg.startTime).getTime());

            const endX = typeof fvg.endTime === 'number'
                ? xScale(fvg.endTime)
                : xScale(new Date(fvg.endTime).getTime());

            const topY = yScale(fvg.topPrice);
            const bottomY = yScale(fvg.bottomPrice);

            const rectWidth = endX - startX;
            const rectHeight = bottomY - topY;

            // Determine color based on type and filled status
            const color = fvg.type === 'bullish'
                ? (fvg.filled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.25)') // green
                : (fvg.filled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.25)');  // red

            const borderColor = fvg.type === 'bullish' ? '#10B981' : '#EF4444';

            // Draw rectangle
            fvgGroup.append('rect')
                .attr('x', startX)
                .attr('y', topY)
                .attr('width', rectWidth)
                .attr('height', rectHeight)
                .attr('fill', color)
                .attr('stroke', borderColor)
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', fvg.filled ? '5,5' : '0')
                .attr('opacity', fvg.filled ? 0.5 : 1)
                .style('cursor', 'pointer')
                .on('mouseover', function (event) {
                    d3.select(this).attr('opacity', 0.8);

                    const gapSize = (fvg.topPrice - fvg.bottomPrice).toFixed(2);
                    const status = fvg.filled ? 'Filled' : 'Unfilled';

                    tooltip
                        .style('visibility', 'visible')
                        .html(`
              <div>
                <strong>${fvg.type === 'bullish' ? '📈 Bullish' : '📉 Bearish'} FVG</strong><br/>
                <span style="color: #9CA3AF;">Status:</span> ${status}<br/>
                <span style="color: #9CA3AF;">Range:</span> ${fvg.bottomPrice.toFixed(2)} - ${fvg.topPrice.toFixed(2)}<br/>
                <span style="color: #9CA3AF;">Gap Size:</span> ${gapSize}
                ${fvg.filled && fvg.filledAt ? `<br/><span style="color: #9CA3AF;">Filled:</span> ${new Date(fvg.filledAt).toLocaleString()}` : ''}
              </div>
            `);
                })
                .on('mousemove', function (event) {
                    tooltip
                        .style('top', (event.pageY - 10) + 'px')
                        .style('left', (event.pageX + 10) + 'px');
                })
                .on('mouseout', function () {
                    d3.select(this).attr('opacity', fvg.filled ? 0.5 : 1);
                    tooltip.style('visibility', 'hidden');
                })
                .on('click', function () {
                    if (onFVGClick) {
                        onFVGClick(fvg);
                    }
                });

            // Add label for unfilled FVGs
            if (!fvg.filled) {
                fvgGroup.append('text')
                    .attr('x', startX + 5)
                    .attr('y', topY + 15)
                    .attr('fill', borderColor)
                    .attr('font-size', '10px')
                    .attr('font-weight', 'bold')
                    .text('FVG')
                    .style('pointer-events', 'none');
            }
        });

        return () => {
            tooltip.remove();
        };
    }, [fvgZones, xScale, yScale, width, height, onFVGClick]);

    return (
        <svg
            ref={svgRef}
            width={width}
            height={height}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'all'
            }}
        />
    );
};

export default FVGOverlay;
