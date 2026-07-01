import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { citiesForCountry } from "@/lib/cities-db";
import { placesTextSearch, toBusiness } from "@/lib/prospector-core";
import type { Business } from "@/lib/mock-businesses";

const InputSchema = z.object({
  country: z.string().min(1),
  niche: z.string().min(1),
});

const CONCURRENCY = 4;

export const Route = createFileRoute("/api/public/prospector-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const parsed = InputSchema.safeParse(body);
        if (!parsed.success) return new Response("Invalid input", { status: 400 });
        const { country, niche } = parsed.data;
        const cities = citiesForCountry(country);
        if (cities.length === 0) {
          return new Response(JSON.stringify({ error: `No city database for ${country}` }), {
            status: 400, headers: { "content-type": "application/json" },
          });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (obj: unknown) => {
              controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
            };

            const seen = new Set<string>();
            let processed = 0;
            let errored = 0;
            let dupes = 0;
            let found = 0;

            send({ type: "start", totalCities: cities.length, country, niche });

            // Simple concurrency pool
            let cursor = 0;
            const runWorker = async () => {
              while (true) {
                const idx = cursor++;
                if (idx >= cities.length) return;
                const city = cities[idx];
                send({ type: "city_start", city, index: idx });
                try {
                  const places = await placesTextSearch(`${niche} in ${city}, ${country}`);
                  const fresh = places.filter((p) => {
                    if (seen.has(p.id)) { dupes++; return false; }
                    seen.add(p.id);
                    return true;
                  });
                  // Skip photo resolution for speed on nationwide scans
                  const businesses: Business[] = await Promise.all(
                    fresh.map((p) => toBusiness(p, country, city, niche, false)),
                  );
                  found += businesses.length;
                  processed++;
                  send({
                    type: "city_done", city, index: idx,
                    businesses, processed, totalCities: cities.length,
                    found, dupes, errored,
                  });
                } catch (err) {
                  errored++;
                  processed++;
                  send({
                    type: "city_error", city, index: idx,
                    error: String((err as Error).message ?? err),
                    processed, totalCities: cities.length, found, dupes, errored,
                  });
                }
              }
            };
            await Promise.all(
              Array.from({ length: Math.min(CONCURRENCY, cities.length) }, runWorker),
            );

            send({ type: "done", processed, found, dupes, errored });
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "content-type": "application/x-ndjson; charset=utf-8",
            "cache-control": "no-store, no-transform",
            "x-accel-buffering": "no",
          },
        });
      },
    },
  },
});