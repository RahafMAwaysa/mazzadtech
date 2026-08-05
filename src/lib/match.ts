export type MatchInput = {
  request: {
    budget_min: number | null;
    budget_max: number | null;
    specs: string[];
    warranty_preference: string | null;
    delivery_preference: string | null;
    brands: string[];
  };
  offer: {
    price: number;
    specs: string[];
    warranty_months: number;
    delivery_days: number;
    product_name: string;
  };
  supplier: { rating: number; verified: boolean };
};

export type MatchResult = { score: number; reasons: { ok: boolean; key: ReasonKey }[] };

export type ReasonKey =
  | "specs"
  | "budget"
  | "warranty"
  | "supplier"
  | "delivery"
  | "brand";

const REASON_TEXT: Record<ReasonKey, { en: [string, string]; ar: [string, string] }> = {
  specs: {
    en: ["Meets required specifications", "Misses some required specifications"],
    ar: ["يلبي المواصفات المطلوبة", "لا يلبي بعض المواصفات المطلوبة"],
  },
  budget: {
    en: ["Fits customer's budget", "Above the stated budget"],
    ar: ["ضمن ميزانية العميل", "أعلى من الميزانية المحددة"],
  },
  warranty: {
    en: ["Strong warranty", "Short warranty"],
    ar: ["ضمان قوي", "ضمان قصير"],
  },
  supplier: {
    en: ["High supplier rating", "Average supplier rating"],
    ar: ["تقييم مورد مرتفع", "تقييم مورد متوسط"],
  },
  delivery: {
    en: ["Suitable delivery time", "Slower delivery time"],
    ar: ["مدة توصيل مناسبة", "مدة توصيل أطول"],
  },
  brand: {
    en: ["Matches a preferred brand", "Different brand than preferred"],
    ar: ["يطابق علامة مفضلة", "علامة مختلفة عن المفضلة"],
  },
};

export function reasonText(key: ReasonKey, ok: boolean, lang: "en" | "ar") {
  return REASON_TEXT[key][lang][ok ? 0 : 1];
}

function tokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function computeMatch({ request, offer, supplier }: MatchInput): MatchResult {
  const offerText = tokens([offer.product_name, ...offer.specs].join(" "));

  let specHits = 0;
  for (const spec of request.specs) {
    const needed = tokens(spec);
    if (needed.length === 0) continue;
    const hits = needed.filter((n) => offerText.some((o) => o.includes(n) || n.includes(o))).length;
    if (hits / needed.length >= 0.5) specHits += 1;
  }
  const specRatio = request.specs.length ? specHits / request.specs.length : 0.8;

  const max = request.budget_max ?? request.budget_min;
  let budgetScore = 1;
  if (max && max > 0) {
    if (offer.price <= max) budgetScore = 1;
    else budgetScore = Math.max(0, 1 - (offer.price - max) / max);
  }

  const warrantyScore = Math.min(1, offer.warranty_months / 24);
  const supplierScore = Math.min(1, supplier.rating / 5) * (supplier.verified ? 1 : 0.85);
  const deliveryScore = offer.delivery_days <= 3 ? 1 : offer.delivery_days <= 7 ? 0.8 : 0.55;

  const brandWanted = request.brands.length > 0;
  const brandOk =
    !brandWanted ||
    request.brands.some((b) => offer.product_name.toLowerCase().includes(b.toLowerCase()));

  const score = Math.round(
    (specRatio * 0.34 +
      budgetScore * 0.26 +
      warrantyScore * 0.13 +
      supplierScore * 0.15 +
      deliveryScore * 0.12) *
      100 *
      (brandOk ? 1 : 0.94),
  );

  const reasons: { ok: boolean; key: ReasonKey }[] = [
    { key: "specs", ok: specRatio >= 0.6 },
    { key: "budget", ok: budgetScore >= 0.99 },
    { key: "warranty", ok: offer.warranty_months >= 12 },
    { key: "supplier", ok: supplier.rating >= 4.3 },
    { key: "delivery", ok: offer.delivery_days <= 5 },
  ];
  if (brandWanted) reasons.push({ key: "brand", ok: brandOk });

  return { score: Math.max(35, Math.min(99, score)), reasons };
}
