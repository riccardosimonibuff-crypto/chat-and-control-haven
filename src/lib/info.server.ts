const WMO: Record<number, string> = {
  0: "Sereno", 1: "Poco nuvoloso", 2: "Parzialmente nuvoloso", 3: "Coperto", 45: "Nebbia", 48: "Nebbia con brina",
  51: "Pioviggine leggera", 53: "Pioviggine", 55: "Pioviggine intensa", 61: "Pioggia leggera", 63: "Pioggia", 65: "Pioggia forte",
  71: "Neve leggera", 73: "Neve", 75: "Neve forte", 80: "Rovesci leggeri", 81: "Rovesci", 82: "Rovesci violenti",
  95: "Temporale", 96: "Temporale con grandine", 99: "Temporale con grandine forte",
};

export type Weather = {
  current: { temp: number; feels: number; humidity: number; wind: number; code: number; label: string };
  days: { date: string; max: number; min: number; rain: number; label: string }[];
};

export async function getWeather(lat: number, lon: number): Promise<Weather> {
  const q = new URLSearchParams({
    latitude: String(lat), longitude: String(lon), timezone: "auto", forecast_days: "4",
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
  if (!res.ok) throw new Error(`Open-Meteo ha risposto ${res.status}`);
  const d = await res.json();
  const c = d.current;
  return {
    current: { temp: c.temperature_2m, feels: c.apparent_temperature, humidity: c.relative_humidity_2m, wind: c.wind_speed_10m, code: c.weather_code, label: WMO[c.weather_code] ?? "—" },
    days: (d.daily.time as string[]).map((date, i) => ({
      date, max: d.daily.temperature_2m_max[i], min: d.daily.temperature_2m_min[i],
      rain: d.daily.precipitation_probability_max[i] ?? 0, label: WMO[d.daily.weather_code[i]] ?? "—",
    })),
  };
}

export type NewsItem = { title: string; link: string; date: string; summary: string };

const clean = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "")
  .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

export async function getNews(limit = 10): Promise<NewsItem[]> {
  const res = await fetch("https://www.ansa.it/sito/ansait_rss.xml", { headers: { "User-Agent": "VEGA/1.0" } });
  if (!res.ok) throw new Error(`ANSA ha risposto ${res.status}`);
  const xml = await res.text();
  const items = xml.split("<item>").slice(1, limit + 1);
  const tag = (s: string, t: string) => clean(s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1] ?? "");
  return items.map((it) => ({ title: tag(it, "title"), link: tag(it, "link"), date: tag(it, "pubDate"), summary: tag(it, "description").slice(0, 280) }));
}
