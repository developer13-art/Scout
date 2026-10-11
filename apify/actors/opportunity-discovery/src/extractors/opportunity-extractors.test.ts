import assert from "node:assert/strict";
import test from "node:test";
import { load } from "cheerio";
import { DetailExtractor } from "./detail.extractor.js";
import { ListingExtractor } from "./listing.extractor.js";
import { extractOrganization } from "./organization.extractor.js";

test("filters Africa No Filter navigation while retaining opportunity detail links", () => {
  const html = `
    <a href="/opportunities/abc123">Commonwealth Master's Scholarships</a>
    <a href="/stories">Success Stories</a>
    <a href="/learn">Learn &amp; upskill</a>
    <a href="/about">About the Opportunity Hub</a>
    <a href="/opportunities?type=grant">Browse grants</a>
    <a href="https://africanofilter.org/what-we-do/community/#grants">Grant community</a>
    <a href="/">The Opportunity Hub · Africa No Filter</a>
  `;

  const links = new ListingExtractor().extractListingLinks(
    load(html),
    "https://opportunity.africanofilter.org/",
  );

  assert.deepEqual(
    links.map((link) => link.href),
    ["https://opportunity.africanofilter.org/opportunities/abc123"],
  );
});

test("recognizes an organization named after a title separator", () => {
  assert.equal(
    extractOrganization(
      "Commonwealth Master's Scholarships: Commonwealth Scholarship Commission",
    ),
    "Commonwealth Scholarship Commission",
  );
  assert.equal(
    extractOrganization("ALX Software Engineering Programme: ALX Africa"),
    "ALX Africa",
  );
  assert.equal(
    extractOrganization("Chevening Scholarships: Chevening (UK Government)"),
    "Chevening (UK Government)",
  );
});

test("does not treat an application instruction as an organization", () => {
  assert.equal(
    extractOrganization("Scholarship programme: Apply before the deadline"),
    null,
  );
});

test("extracts eligibility and requirements from labeled page sections", () => {
  const $ = load(`
    <h2>Eligibility</h2>
    <p>Applicants must be citizens of an eligible African country.</p>
    <h2>Requirements</h2>
    <ul><li>Submit a completed application and academic transcripts.</li></ul>
  `);
  const detail = new DetailExtractor();

  assert.equal(
    detail.extractLabeledSection($, "eligibility"),
    "Applicants must be citizens of an eligible African country.",
  );
  assert.equal(
    detail.extractLabeledSection($, "requirements"),
    "Submit a completed application and academic transcripts.",
  );
});
