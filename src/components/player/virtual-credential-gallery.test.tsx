import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  VirtualCredentialGallery, type CredentialApplication,
  type VirtualCredentialApplicant,
} from "./virtual-credential-gallery";

const applicant: VirtualCredentialApplicant = {
  displayName: "Example SIMVERSE Player",
  username: "virtual_demo",
  simverseId: "SV-ABCDEF0123456789ABCDEF01",
  avatarUrl: null,
  playerIdIssuedAt: "2026-02-04T12:00:00.000Z",
};
const country = { id: "country-1", name: "Example Virtual Country", isoAlpha2: null };
const approved = (kind: string, serial: string, status = "ISSUED",
  issuedAt = "2026-01-12T12:00:00.000Z",
  expiresAt = "2027-01-12T12:00:00.000Z"): CredentialApplication => ({
    id: serial, kind, status: "APPROVED", country,
    document: { serial, status, issuedAt, expiresAt, displayStatus: "VALID" },
  });

describe("issued SIMVERSE virtual document wallet", () => {
  it("creates a dated player card from a completed SIMVERSE profile without claiming citizenship", () => {
    const html = renderToStaticMarkup(
      <VirtualCredentialGallery applications={[]} applicant={applicant} />,
    );
    expect(html).toContain("Virtual Player ID Card");
    expect(html).toContain("04 Feb 2026");
    expect(html).toContain("04 Feb 2029");
    expect(html).toContain("No citizenship implied");
    expect(html).toContain("0 issued");
    expect(html).not.toContain("Virtual Passport");
  });

  it("requires a completed username to show the base player ID card", () => {
    const html = renderToStaticMarkup(
      <VirtualCredentialGallery applications={[]} applicant={{ ...applicant, username: null }} />,
    );
    expect(html).not.toContain("Virtual Player ID Card");
    expect(html).toContain("Complete your SIMVERSE username");
  });

  it("shows a dated collectible ID card for approved citizenship with owner-only details", () => {
    const html = renderToStaticMarkup(
      <VirtualCredentialGallery applications={[approved("CITIZENSHIP", "SVV-TEST-CITIZEN")]}
        applicant={applicant} />,
    );
    expect(html).toContain("Virtual Citizen ID");
    expect(html).toContain("Example SIMVERSE Player");
    expect(html).toContain("SV-ABCDEF0123456789ABCDEF01");
    expect(html).toContain("@virtual_demo");
    expect(html).toContain("12 Jan 2026");
    expect(html).toContain("12 Jan 2027");
    expect(html).toContain("SVV-TEST-CITIZEN");
    expect(html).toContain("NOT GOVERNMENT IDENTIFICATION");
  });

  it("shows both fictional passport booklet designs with issue/expiry dates", () => {
    const html = renderToStaticMarkup(
      <VirtualCredentialGallery applications={[
        approved("NATIONAL_PASSPORT", "SVV-TEST-NATIONAL"),
        approved("INTERNATIONAL_PASSPORT", "SVV-TEST-INTERNATIONAL"),
        approved("RESIDENCY", "SVV-TEST-RESIDENCY"),
      ]} applicant={applicant} />,
    );
    expect(html).toContain("National");
    expect(html).toContain("International");
    expect(html).toContain("Virtual Passport");
    expect(html).toContain("Virtual Residency Card");
    expect(html).toContain("SVV-TEST-INTERNATIONAL");
    expect(html).toContain("NOT VALID FOR BORDER CROSSING");
    expect(html).toContain("3 issued");
  });

  it("never presents a pending or denied application as an issued virtual credential", () => {
    const pending = approved("INTERNATIONAL_PASSPORT", "SVV-NOT-ISSUED");
    pending.status = "PENDING_REVIEW";
    const denied = approved("CITIZENSHIP", "SVV-NOT-APPROVED");
    denied.status = "DENIED";
    const html = renderToStaticMarkup(
      <VirtualCredentialGallery applications={[pending, denied]} applicant={applicant} />,
    );
    expect(html).toContain("collection is empty");
    expect(html).toContain("0 issued");
    expect(html).not.toContain("SVV-NOT-ISSUED");
    expect(html).not.toContain("SVV-NOT-APPROVED");
  });

  it("prominently marks expired/revoked credentials rather than implying validity", () => {
    const html = renderToStaticMarkup(
      <VirtualCredentialGallery applications={[
        approved("INTERNATIONAL_PASSPORT", "SVV-EXPIRED", "ISSUED",
          "2023-01-12T00:00:00Z", "2024-01-12T00:00:00Z"),
        approved("CITIZENSHIP", "SVV-REVOKED", "REVOKED"),
      ]} applicant={applicant} />,
    );
    expect(html).toContain("EXPIRED");
    expect(html).toContain("REVOKED");
    expect(html).toContain("2 issued");
  });
});
