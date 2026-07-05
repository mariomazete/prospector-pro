import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { placesTextSearch, toBusiness } from "@/lib/prospector-core";

export default defineTool({
  name: "search_businesses",
  title: "Search local businesses",
  description:
    "Search Google Places for local businesses by niche and location. Returns name, category, rating, reviews, website, phone, and address for each result.",
  inputSchema: {
    niche: z.string().min(1).describe("Business niche or category, e.g. 'dentists', 'restaurants'."),
    country: z.string().min(1).describe("Country name, e.g. 'Portugal'."),
    city: z.string().optional().describe("Optional city name to narrow the search."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ niche, country, city }) => {
    const c = city?.trim() ?? "";
    const query = c ? `${niche} in ${c}, ${country}` : `${niche} in ${country}`;
    try {
      const places = await placesTextSearch(query);
      const unique = Array.from(new Map(places.filter((p) => p.id).map((p) => [p.id, p])).values());
      const businesses = await Promise.all(unique.map((p) => toBusiness(p, country, c, niche)));
      const compact = businesses.map((b) => ({
        name: b.name,
        category: b.category,
        address: b.address,
        city: b.city,
        country: b.country,
        phone: b.phone,
        website: b.website,
        rating: b.rating,
        reviews: b.reviewsCount,
        mapsUrl: b.mapsUrl,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(compact, null, 2) }],
        structuredContent: { businesses: compact },
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Search failed: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
});