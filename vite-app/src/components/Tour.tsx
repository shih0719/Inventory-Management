import { useEffect, useRef } from 'react';
import { driver, type Config } from 'driver.js';
import 'driver.js/dist/driver.css';

export interface TourStep {
  id: string;
  title: string;
  description: string;
  selector: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface TourProps {
  steps: TourStep[];
  onComplete?: () => void;
}

export function Tour({ steps, onComplete }: TourProps) {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  useEffect(() => {
    // 轉換步驟格式為 Driver.js 格式
    const driverSteps: Config['steps'] = steps.map(step => ({
      element: step.selector,
      popover: {
        title: step.title,
        description: step.description,
        side: (step.position || 'bottom') as 'left' | 'right' | 'top' | 'bottom',
        align: 'center',
      },
    }));

    // 創建 Driver 實例
    driverRef.current = driver({
      steps: driverSteps,
      overlayOpacity: 0.6,
      stagePadding: 12,
      onDestroyed: () => {
        onComplete?.();
      },
    });

    return () => {
      driverRef.current?.destroy();
    };
  }, [steps, onComplete]);

  const startTour = () => {
    driverRef.current?.drive();
  };

  return (
    <button
      className="tour-trigger-driver"
      onClick={startTour}
      title={steps.length > 0 ? '按此開始功能導覽' : '尚無導覽'}
      disabled={steps.length === 0}
    >
      📍
    </button>
  );
}
