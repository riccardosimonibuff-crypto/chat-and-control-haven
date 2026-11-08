import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const fetchInfo = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ lat: z.number().min(-90).max(90).nullable(), lon: z.number().min(-180).max(180).nullable() }).parse(d))
  .handler(async ({ data }) => {
    const { getWeather, getNews } = await import("./info.server");
    const [weather, news] = await Promise.allSettled([
      data.lat != null && data.lon != null ? getWeather(data.lat, data.lon) : Promise.resolve(null),
      getNews(12),
    ]);
    return {
      weather: weather.status === "fulfilled" ? weather.value : null,
      weatherError: weather.status === "rejected" ? String(weather.reason?.message ?? weather.reason) : null,
      news: news.status === "fulfilled" ? news.value : [],
      newsError: news.status === "rejected" ? String(news.reason?.message ?? news.reason) : null,
    };
  });
