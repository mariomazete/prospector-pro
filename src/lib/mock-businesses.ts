export interface Review {
  author: string;
  rating: number;
  text: string;
  sentiment: "positive" | "negative";
}

export interface Business {
  id: string;
  name: string;
  category: string;
  country: string;
  city: string;
  address: string;
  phone: string;
  website: string | null;
  rating: number;
  reviewsCount: number;
  photos: string[];
  hours: string;
  mapsUrl: string;
  reviews: Review[];
  aiSummary: string[];
  isLocal: boolean;
}

// Local aiSummary generator (used by real API path too)
export function buildAiSummary(b: Pick<Business, "website" | "rating" | "reviewsCount">): string[] {
  const out: string[] = [];
  if (b.rating >= 4.5) out.push("Customers consistently praise the service quality and reputation is strong.");
  else if (b.rating >= 4.0) out.push("Overall positive reviews, but with some concerns about consistency.");
  else out.push("Mixed reviews — reputation could be improved with better customer touchpoints.");
  if (b.reviewsCount >= 100) out.push("High review volume indicates real customer demand and traffic.");
  else out.push("Low review count — a website could help capture more social proof over time.");
  out.push(
    b.website
      ? "Business has an online presence but the site may look outdated or underperform on mobile."
      : "No professional website detected — clear opportunity to establish digital presence.",
  );
  return out;
}

export function calcOpportunityScore(b: Business): number {
  let score = 0;
  if (!b.website) score += 50;
  if (b.rating >= 4.5) score += 20;
  if (b.reviewsCount >= 100) score += 20;
  if (b.isLocal) score += 10;
  return Math.min(score, 100);
}

const PHOTO_POOL = [
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
  "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
  "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=800",
  "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800",
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",
];

const NAMES = [
  "Pet", "Studio", "Clinic", "Dental", "Law Firm", "House", "Center", "Group",
  "Express", "Premium", "Hub", "Lab", "Boutique", "Lounge", "Co.", "Corner",
];
const PREFIX = [
  "Royal", "Urban", "Golden", "Blue", "Atlas", "Nova", "Lumi", "Vita",
  "Bella", "Casa", "Sunset", "Aurora", "Pure", "Elite", "Prime", "Crown",
];

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function pick<T>(arr: T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)];
}

const COUNTRY_CODES: Record<string, string> = {
  Brazil: "+55", Portugal: "+351", Spain: "+34", France: "+33",
  USA: "+1", Germany: "+49", Italy: "+39", "United Kingdom": "+44",
  Mexico: "+52", Canada: "+1", Argentina: "+54", Netherlands: "+31",
};

export function generateMockBusinesses(
  country: string,
  city: string,
  niche: string,
): Business[] {
  const seedBase =
    (country + city + niche).split("").reduce((a, c) => a + c.charCodeAt(0), 0) || 1;
  const r = seeded(seedBase);
  const count = 40 + Math.floor(r() * 60); // 40–99
  const code = COUNTRY_CODES[country] ?? "+1";
  const out: Business[] = [];

  for (let i = 0; i < count; i++) {
    const name = `${pick(PREFIX, r)} ${niche} ${pick(NAMES, r)}`;
    const hasWebsite = r() > 0.55;
    const rating = +(3.5 + r() * 1.5).toFixed(1);
    const reviewsCount = Math.floor(10 + r() * 900);
    const photoCount = Math.floor(r() * 6) + 1;
    const photos = Array.from({ length: photoCount }, () => pick(PHOTO_POOL, r));
    const phone = `${code} ${Math.floor(100 + r() * 899)} ${Math.floor(100 + r() * 899)} ${Math.floor(100 + r() * 899)}`;

    const b: Business = {
      id: `biz-${seedBase}-${i}`,
      name,
      category: niche,
      country,
      city,
      address: `${Math.floor(r() * 999) + 1} ${pick(["Main", "Park", "Liberty", "Sunset", "Market"], r)} St, ${city}`,
      phone,
      website: hasWebsite ? `https://${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com` : null,
      rating,
      reviewsCount,
      photos,
      hours: "Mon–Sat 09:00 – 19:00",
      mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(name + " " + city)}`,
      isLocal: true,
      reviews: [
        {
          author: "Maria S.",
          rating: 5,
          text: "Excellent service, the team is very attentive and professional.",
          sentiment: "positive",
        },
        {
          author: "João P.",
          rating: 5,
          text: "Highly recommended — best experience I've had in this city.",
          sentiment: "positive",
        },
        {
          author: "Ana R.",
          rating: 2,
          text: "Took too long to respond on WhatsApp. They should have a website.",
          sentiment: "negative",
        },
      ],
      aiSummary: [
        "Customers consistently praise the service quality and friendly staff.",
        "Several reviews mention slow WhatsApp responses and unclear pricing.",
        hasWebsite
          ? "Business has an online presence but the site looks outdated."
          : "Strong local reputation but lacks a professional website — clear opportunity.",
      ],
    };
    out.push(b);
  }

  return out.sort((a, b) => calcOpportunityScore(b) - calcOpportunityScore(a));
}

export const COUNTRIES = [
  "Brazil", "Portugal", "Spain", "France", "USA", "Germany",
  "Italy", "United Kingdom", "Mexico", "Canada", "Argentina", "Netherlands",
];

export const NICHES = [
  "Pet Shop", "Dentist", "Lawyer", "Restaurant", "Barbershop",
  "Beauty Salon", "Lash Studio", "Real Estate", "Gym", "Automotive",
  "Veterinary", "Clinic",
];