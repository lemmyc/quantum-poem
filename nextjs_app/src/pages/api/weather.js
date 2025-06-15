export default async function handler(req, res) {
  const { lat, lon } = req.query;
  const API_KEY = process.env.NEXT_PUBLIC_API_WEATHER_KEY;

  try {
    const result = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
    );
    const data = await result.json();

    res.status(200).json({
      temp: data.main.temp,
      feels_like: data.main.feels_like,
      humidity: data.main.humidity,
      wind_speed: data.wind.speed,
      description: data.weather[0].description,
      name: data.name,
      country: data.sys.country,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
}
