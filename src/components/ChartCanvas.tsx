import { useEffect, useRef } from 'react';
import {
  Chart,
  ChartConfiguration,
  ChartType,
  registerables,
} from 'chart.js';

Chart.register(...registerables);

interface ChartCanvasProps<T extends ChartType = ChartType> {
  config: ChartConfiguration<T>;
  testId?: string;
  heightClass?: string;
  ariaLabel: string;
}

export function ChartCanvas<T extends ChartType = ChartType>({
  config,
  testId,
  heightClass = 'h-64',
  ariaLabel,
}: ChartCanvasProps<T>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(canvas, config as ChartConfiguration);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [config]);

  return (
    <div className={`relative w-full ${heightClass}`}>
      <canvas
        ref={canvasRef}
        data-testid={testId}
        aria-label={ariaLabel}
        role="img"
      />
    </div>
  );
}
