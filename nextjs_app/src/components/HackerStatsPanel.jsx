import React, { useEffect, useState } from 'react';
import './HackerStatsPanel.scss';

const mockData = {
  location: 'Hanoi, VN',
  temperature: 27.5,
  humidity: 68,
};

export default function HackerStatsPanel() {
  const [time, setTime] = useState(new Date());
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hacker-stats-panel">
      <div className="panel-title">PROCESS&gt;&gt;&gt;</div>
      <div className="panel-row">
        <span className="label">TIME:</span>
        <span className="value">
          {isClient ? time.toLocaleTimeString() : ''}
        </span>
      </div>
      <div className="panel-row">
        <span className="label">LOCATION:</span>
        <span className="value">{mockData.location}</span>
      </div>
      <div className="panel-row">
        <span className="label">TEMP:</span>
        <span className="value">{mockData.temperature}°C</span>
      </div>
      <div className="panel-row">
        <span className="label">HUMIDITY:</span>
        <span className="value">{mockData.humidity}%</span>
      </div>
      <div className="panel-divider" />
      <div className="panel-row small">
        <span className="label">STATUS:</span>
        <span className="value">ACTIVE</span>
      </div>
    </div>
  );
} 