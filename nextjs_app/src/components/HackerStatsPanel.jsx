import React, { useEffect, useState } from 'react';
import './HackerStatsPanel.scss';

export default function HackerStatsPanel() {
  const [time, setTime] = useState(new Date());
  const [weatherData, setWeatherData] = useState(null);
  const [locationName, setLocationName] = useState('Loading...');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem('user_location');
    if (!stored) {
      setLocationName('No location');
      setIsLoading(false);
      return;
    }

    const { latitude, longitude } = JSON.parse(stored);
    setIsLoading(true);
    fetch(`/api/weather?lat=${latitude}&lon=${longitude}`)
      .then((res) => res.json())
      .then((data) => {
        setWeatherData({
          temp: data.temp,
          feelsLike: data.feels_like,
          humidity: data.humidity,
          description: data.description,
          windSpeed: data.wind_speed,
          icon: data.icon,
        });
        setLocationName(`${data.name}, ${data.country}`);
        setIsLoading(false);
      })
      .catch(() => {
        setLocationName('Failed to load');
        setIsLoading(false);
      });
  }, []);

  const getWeatherIcon = (description) => {
    if (!description) return '🌍';
    const desc = description.toLowerCase();
    if (desc.includes('clear')) return '☀️';
    if (desc.includes('cloud')) return '☁️';
    if (desc.includes('rain')) return '🌧️';
    if (desc.includes('storm')) return '⛈️';
    if (desc.includes('snow')) return '❄️';
    return '🌍';
  };

  return (
    <div className="hacker-stats-panel">
      <div className="panel-title">⛅ Cyber Weather</div>
      <div className="panel-divider" />

      {isLoading ? (
        <div className="panel-row small">
          <div className="label">🔄 Status: </div>
          <div className="value typing">Connecting to satellites...</div>
        </div>
      ) : (
        <>
          <div className="panel-row">
            <div className="label">📍 City: </div>
            <div className="value typing">{locationName}</div>
          </div>
          <div className="panel-row">
            <div className="label">⏰ Time: </div>
            <div className="value typing">{time.toLocaleTimeString()}</div>
          </div>
          <div className="panel-row">
            <div className="label">🌡️ Temp: </div>
            <div className="value typing">{weatherData ? `${weatherData.temp}°C` : 'N/A'}</div>
          </div>
          <div className="panel-row">
            <div className="label">☁️ Status: </div>
            <div className="value typing">
              {weatherData ? (
                <>
                  {getWeatherIcon(weatherData.description)} {weatherData.description}
                </>
              ) : 'N/A'}
            </div>
          </div>
         
        </>
      )}
    </div>
  );
}