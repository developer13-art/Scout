import { BaseAdapter } from "./base.adapter.js";
import type { ActorInput, ExtractedOpportunity, RawListingItem } from "../types.js";
import { fetchHtml } from "../utils/fetch.js";
import { absoluteUrl } from "../utils/crawler.js";
import { load } from "cheerio";
import { DetailExtractor } from "../extractors/detail.extractor.js";

export class GenericRssAdapter extends BaseAdapter {
  key = "genericRss";
  private detail = new DetailExtractor();

  async list(input: ActorInput): Promise<RawListingItem[]> {
    const xml = await fetchHtml(input.sourceUrl, {
      waitUntil: input.waitUntil ?? "domcontentloaded",
      waitForSelector: input.waitForSelector,
      waitExtraMs: input.waitExtraMs,
      timeoutMs: (input.requestTimeoutSeconds ?? 60) * 1000,
    });
    const $ = load(xml, { xmlMode: true });
    const items: RawListingItem[] = [];

    $("item, entry").each((_i, element) => {
      const entry = $(element);
      const readText = (...selectors: string[]) => {
        for (const selector of selectors) {
          const value = this.normalize(entry.find(selector).first().text());
          if (value) return value;
        }
        return null;
      };
      const linkNode = entry.find("link").first();
      const link = linkNode.text().trim() || linkNode.attr("href") || "";
      const title = readText("title") ?? "";
      const description = readText("description", "summary", "content\\:encoded") ?? "";
      const categories = entry
        .find("category")
        .toArray()
        .map((category) => this.normalize($(category).text()))
        .filter((category): category is string => Boolean(category));
      if (!link) return;
      items.push({
        url: absoluteUrl(input.sourceUrl, link),
        title,
        raw: {
          listingText: `${title}\n\n${description}`.trim(),
          feedDescription: description,
          feedAuthor: readText("author", "creator", "dc\\:creator"),
          feedCategory: categories.join(", ") || null,
          feedPublishedAt: readText("pubDate", "published", "updated", "dc\\:date", "date"),
          feedSourceName: readText("source"),
        },
      });
    });

    return items.slice(0, input.maxItems ?? 200);
  }

  async extract(
    input: ActorInput,
    item: RawListingItem,
  ): Promise<ExtractedOpportunity> {
    const html = await fetchHtml(item.url, {
      waitUntil: input.waitUntil ?? "domcontentloaded",
      waitExtraMs: input.waitExtraMs,
      timeoutMs: (input.requestTimeoutSeconds ?? 60) * 1000,
    });
    const $ = load(html);
    const country = input.country ?? null;
    const feedDescription = this.normalize(
      load(String(item.raw?.feedDescription ?? "")).text(),
    );
    const pageDescription = this.detail.extractDescription($);
    const description =
      pageDescription ?? feedDescription ?? this.normalize(String(item.raw?.listingText ?? ""));
    const feedPublishedAt = item.raw?.feedPublishedAt;
    const publishedAt = this.toIsoOrNull(
      this.detail.extractDate($, "published") ??
        (typeof feedPublishedAt === "string" ? feedPublishedAt : null),
    );

    return {
      title:
        this.detail.extractTitle($, item.title) ??
        this.normalize(item.title) ??
        this.normalize($("h1").first().text()) ??
        "Untitled",
      organization:
        this.detail.extractOrganization($) ??
        this.normalize(String(item.raw?.feedAuthor ?? "")),
      country,
      location: this.detail.extractLocation($) ?? this.countryName(country),
      category: input.category ?? this.normalize(String(item.raw?.feedCategory ?? "")),
      publishedAt,
      deadline: this.toIsoOrNull(this.detail.extractDate($, "deadline")),
      description,
      sourceUrl: item.url,
      sourceName: this.normalize(String(item.raw?.feedSourceName ?? "")),
      sourceId: input.sourceId,
      adapter: this.key,
      referenceNumber: this.detail.extractReferenceNumber($),
      valueMin: null,
      valueMax: null,
      currency: null,
      eligibility: this.detail.extractLabeledSection($, "eligibility"),
      requirements: this.detail.extractLabeledSection($, "requirements"),
      documents: this.detail.extractDocumentLinks($, item.url),
      raw: {
        ...item.raw,
        detailText: description?.slice(0, 6000) ?? null,
      },
    };
  }

  private countryName(code: string | null): string | null {
    const names: Record<string, string> = {
      GB: "United Kingdom",
      US: "United States",
      CA: "Canada",
      AU: "Australia",
      NZ: "New Zealand",
      NG: "Nigeria",
      GH: "Ghana",
      KE: "Kenya",
      UG: "Uganda",
      ZA: "South Africa",
      BJ: "Benin",
      RW: "Rwanda",
      TZ: "Tanzania",
      SN: "Senegal",
      ET: "Ethiopia",
      IN: "India",
      DE: "Germany",
      FR: "France",
      CH: "Switzerland",
      JP: "Japan",
    };
    return code ? names[code.toUpperCase()] ?? code : null;
  }
}