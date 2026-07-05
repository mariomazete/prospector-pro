import { defineMcp } from "@lovable.dev/mcp-js";
import searchBusinesses from "./tools/search-businesses";

export default defineMcp({
  name: "prospector-ai-mcp",
  title: "Prospector AI",
  version: "0.1.0",
  instructions:
    "Tools for the Prospector AI app. Use `search_businesses` to find local businesses by niche and location via Google Places.",
  tools: [searchBusinesses],
});