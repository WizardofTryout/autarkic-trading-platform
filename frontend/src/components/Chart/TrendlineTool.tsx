import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

export interface Trendline {
    id: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    color: string;
    label?: string;
}

interface TrendlineToolProps {
    width: number;
    height: number;
    xScale: d3.ScaleTime<number, number> | d3.ScaleLinear<number, number>;
    yScale: d3.ScaleLinear<number, number>;
    isActive: boolean;
    onTrendlineAdded?: (trendline: Trendline) => void;
    trendlines?: Trendline[];
    onTrendlineRemoved?: (id: string) => void;
}

const TrendlineTool: React.FC<TrendlineToolProps> = ({
    width,
    height,
    xScale,
    yScale,
    isActive,
    onTrendlineAdded,
    trendlines = [],
    onTrendlineRemoved
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [drawingState, setDrawingState] = useState<{
        isDrawing: boolean;
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
    } | null>(null);

    useEffect(() => {
        if (!svgRef.current) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const g = svg.append('g').attr('class', 'trendlines');

        // Render existing trendlines
        trendlines.forEach((trendline) => {
            const line = g.append('line')
                .attr('x1', trendline.startX)
                .attr('y1', trendline.startY)
                .attr('x2', trendline.endX)
                .attr('y2', trendline.endY)
                .attr('stroke', trendline.color)
                .attr('stroke-width', 2)
                .attr('stroke-linecap', 'round')
                .style('cursor', 'pointer');

            // Add delete button on hover
            line.on('mouseover', function (event) {
                d3.select(this).attr('stroke-width', 3);

                // Show delete button
                const midX = (trendline.startX + trendline.endX) / 2;
                const midY = (trendline.startY + trendline.endY) / 2;

                g.append('circle')
                    .attr('class', 'delete-btn')
                    .attr('cx', midX)
                    .attr('cy', midY)
                    .attr('r', 12)
                    .attr('fill', '#EF4444')
                    .style('cursor', 'pointer')
                    .on('click', () => {
                        if (onTrendlineRemoved) {
                            onTrendlineRemoved(trendline.id);
                        }
                    });

                g.append('text')
                    .attr('class', 'delete-btn')
                    .attr('x', midX)
                    .attr('y', midY + 4)
                    .attr('text-anchor', 'middle')
                    .attr('fill', 'white')
                    .attr('font-size', '14px')
                    .attr('font-weight', 'bold')
                    .text('×')
                    .style('pointer-events', 'none');
            })
                .on('mouseout', function () {
                    d3.select(this).attr('stroke-width', 2);
                    g.selectAll('.delete-btn').remove();
                });

            // Add label if exists
            if (trendline.label) {
                g.append('text')
                    .attr('x', trendline.endX + 5)
                    .attr('y', trendline.endY)
                    .attr('fill', trendline.color)
                    .attr('font-size', '11px')
                    .text(trendline.label)
                    .style('pointer-events', 'none');
            }
        });

        // Render temporary line while drawing
        if (drawingState?.isDrawing) {
            g.append('line')
                .attr('class', 'temp-line')
                .attr('x1', drawingState.startX)
                .attr('y1', drawingState.startY)
                .attr('x2', drawingState.currentX)
                .attr('y2', drawingState.currentY)
                .attr('stroke', '#3B82F6')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '5,5')
                .attr('stroke-linecap', 'round');
        }
    }, [trendlines, drawingState, onTrendlineRemoved]);

    const handleMouseDown = (event: React.MouseEvent<SVGSVGElement>) => {
        if (!isActive) return;

        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        setDrawingState({
            isDrawing: true,
            startX: x,
            startY: y,
            currentX: x,
            currentY: y
        });
    };

    const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
        if (!isActive || !drawingState?.isDrawing) return;

        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        setDrawingState({
            ...drawingState,
            currentX: x,
            currentY: y
        });
    };

    const handleMouseUp = (event: React.MouseEvent<SVGSVGElement>) => {
        if (!isActive || !drawingState?.isDrawing) return;

        const rect = event.currentTarget.getBoundingClientRect();
        const endX = event.clientX - rect.left;
        const endY = event.clientY - rect.top;

        // Only create trendline if there's meaningful distance
        const distance = Math.sqrt(
            Math.pow(endX - drawingState.startX, 2) +
            Math.pow(endY - drawingState.startY, 2)
        );

        if (distance > 20) {
            const newTrendline: Trendline = {
                id: `trendline-${Date.now()}`,
                startX: drawingState.startX,
                startY: drawingState.startY,
                endX,
                endY,
                color: '#3B82F6' // blue-500
            };

            if (onTrendlineAdded) {
                onTrendlineAdded(newTrendline);
            }
        }

        setDrawingState(null);
    };

    return (
        <svg
            ref={svgRef}
            width={width}
            height={height}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: isActive ? 'all' : 'none',
                cursor: isActive ? 'crosshair' : 'default'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        />
    );
};

export default TrendlineTool;
