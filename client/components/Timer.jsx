import { useState, useEffect } from 'react';

export default function Timer({ isActive, onTimeUp, initialTime = 20 }) {
  const [timeLeft, setTimeLeft] = useState(initialTime);

  useEffect(() => {
    if (!isActive) {
      setTimeLeft(initialTime);
      return;
    }

    if (timeLeft === 0) {
      onTimeUp();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, timeLeft, initialTime, onTimeUp]);

  // Reset timeLeft when initialTime changes
  useEffect(() => {
    if (!isActive) {
      setTimeLeft(initialTime);
    }
  }, [initialTime, isActive]);

  const bgColor = timeLeft <= 5 ? 'bg-red-500' : 'bg-blue-500';

  return (
    <div className={`${bgColor} text-white text-4xl font-bold text-center rounded-lg padding-4 mx-4 mt-2 py-4 transition-colors`}>
      {timeLeft}秒
    </div>
  );
}
