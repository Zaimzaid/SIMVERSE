import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { updateMyPlayerIdentity } from "./player-identity-service";
import { createMyVirtualBusinessDraft, selectMyProfession } from "./player-economy-service";
import {
  getBusinessReviewQueue, getOrientationInfo, reviewBusiness,
  submitBusinessForReview, submitOrientation,
} from "./player-training-business-service";
import {
  applyForVirtualJob, decideMyWorkOffer, decideWorkApplicationAsEmployer,
  getMyWorkCenter, postMyVirtualJob,
} from "./player-work-service";

let sequence = 0;
async function player(professionCode: "AGRICULTURE" | "COMMERCE" = "AGRICULTURE") {
  sequence++;
  const registered = await registerUser({
    displayName: "SIMVERSE worker",
    email: `player-work-${sequence}@example.com`,
    password: "Password123", confirmPassword: "Password123",
  });
  await updateMyPlayerIdentity(registered.user.id, {
    username: `work_player_${sequence}`, displayName: "SIMVERSE worker",
    avatarUrl: "", bannerUrl: "", creatorName: "", biography: "",
    profileVisibility: "PRIVATE", experienceMode: "PLAYER", homeCountryId: "",
  });
  await selectMyProfession(registered.user.id, { professionCode });
  return registered.user;
}
const correct = { answers: [1, 2, 0] };
beforeEach(async () => { await resetDb(); });

describe("Phase 6 introductory orientation and fictional employment lifecycle", () => {
  it("validates all orientation answers, only issues one in-world record, never extra credits", async () => {
    const user = await player();
    const info = await getOrientationInfo(user.id);
    expect(info.questions).toHaveLength(3);
    expect(JSON.stringify(info)).not.toContain('"correctAnswer"');
    await expect(submitOrientation(user.id, { answers: [0, 0, 0] }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.playerOrientationCertificate.count()).toBe(0);
    const result = await submitOrientation(user.id, correct);
    expect(result.certificate.score).toBe(3);
    await expect(submitOrientation(user.id, correct)).rejects.toBeInstanceOf(ConflictError);
    expect((await prisma.playerVirtualWallet.findFirstOrThrow()).balance).toBe(850);
    expect(await prisma.playerWalletEntry.count()).toBe(1);
    await expect(submitOrientation(user.id, { answers: [1, 2, 0], medicalLicense: true }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it("requires independent business authorization and rejects self-approval", async () => {
    const owner = await player("COMMERCE");
    const stranger = await player();
    const created = await createMyVirtualBusinessDraft(owner.id, {
      name: "Arc Commerce Group", sector: "COMMERCE",
      description: "Fictional merchandising business",
    });
    await expect(submitBusinessForReview(owner.id, created.business.id, {}))
      .rejects.toBeInstanceOf(ValidationError);
    await submitOrientation(owner.id, correct);
    await expect(submitBusinessForReview(stranger.id, created.business.id, {}))
      .rejects.toBeInstanceOf(ValidationError);
    await submitBusinessForReview(owner.id, created.business.id, {});
    await expect(postMyVirtualJob(owner.id, {
      businessId: created.business.id, title: "Virtual farm operator",
      description: "Help manage a simulated crop production company.", professionCode: "AGRICULTURE",
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(getBusinessReviewQueue(stranger.id)).rejects.toBeInstanceOf(AuthorizationError);
    await prisma.playerBusinessReviewer.create({ data: { userId: owner.id, isActive: true } });
    await expect(reviewBusiness(owner.id, created.business.id, {
      decision: "APPROVE", note: "I should not be able to approve my own company.",
    })).rejects.toBeInstanceOf(AuthorizationError);
    await prisma.playerBusinessReviewer.create({ data: { userId: stranger.id, isActive: true } });
    expect((await getBusinessReviewQueue(stranger.id)).businesses.map((b) => b.id)).toContain(created.business.id);
    await reviewBusiness(stranger.id, created.business.id, {
      decision: "APPROVE", note: "Checked the SIMVERSE fictional business criteria.",
    });
    expect((await prisma.playerVirtualBusiness.findUniqueOrThrow({
      where: { id: created.business.id },
    })).status).toBe("APPROVED");
    await expect(reviewBusiness(stranger.id, created.business.id, {
      decision: "DENY", note: "Cannot review this twice",
    })).rejects.toBeInstanceOf(ConflictError);
  });

  it("completes job post -> application -> offer -> accepted virtual employment with no payroll", async () => {
    const employer = await player("COMMERCE");
    const worker = await player("AGRICULTURE");
    const reviewer = await player();
    await submitOrientation(employer.id, correct);
    await submitOrientation(worker.id, correct);
    const business = await createMyVirtualBusinessDraft(employer.id, {
      name: "Greenfield Sim Farming", sector: "AGRICULTURE",
    });
    await submitBusinessForReview(employer.id, business.business.id, {});
    await prisma.playerBusinessReviewer.create({ data: { userId: reviewer.id, isActive: true } });
    await reviewBusiness(reviewer.id, business.business.id, {
      decision: "APPROVE", note: "Pilot review permits creating simulated jobs.",
    });
    const created = await postMyVirtualJob(employer.id, {
      businessId: business.business.id,
      title: "Simulated farm technician",
      description: "Help manage virtual crop production, records and safety.",
      professionCode: "AGRICULTURE",
    });
    const jobId = created.job.id;
    expect((await getMyWorkCenter(worker.id)).availableJobs.map((j) => j.id)).toContain(jobId);
    await expect(applyForVirtualJob(employer.id, jobId, {
      statement: "I want to work for my own company.",
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(applyForVirtualJob(reviewer.id, jobId, {
      statement: "No completed profession orientation.",
    })).rejects.toBeInstanceOf(ValidationError);
    const app = await applyForVirtualJob(worker.id, jobId, {
      statement: "I have completed the simulated agriculture orientation.",
    });
    await expect(applyForVirtualJob(worker.id, jobId, {
      statement: "Duplicate application should not create another record.",
    })).rejects.toBeInstanceOf(ConflictError);
    await expect(decideWorkApplicationAsEmployer(worker.id, app.application.id, {
      decision: "OFFER",
    })).rejects.toBeInstanceOf(ConflictError);
    await decideWorkApplicationAsEmployer(employer.id, app.application.id, { decision: "OFFER" });
    expect((await prisma.playerVirtualJob.findUniqueOrThrow({ where: { id: jobId } })).status).toBe("OFFER_PENDING");
    await expect(decideMyWorkOffer(employer.id, app.application.id, {
      decision: "ACCEPT",
    })).rejects.toBeInstanceOf(ConflictError);
    const accepted = await decideMyWorkOffer(worker.id, app.application.id, {
      decision: "ACCEPT",
    });
    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.employment?.status).toBe("ACTIVE");
    expect(await prisma.playerVirtualEmployment.count()).toBe(1);
    await expect(decideMyWorkOffer(worker.id, app.application.id, {
      decision: "ACCEPT",
    })).rejects.toBeInstanceOf(ConflictError);
    expect((await getMyWorkCenter(worker.id)).applications[0]?.employment?.status).toBe("ACTIVE");
    expect((await prisma.playerVirtualWallet.findFirstOrThrow({
      where: { identity: { userId: worker.id } },
    })).balance).toBe(850);
    expect(await prisma.playerWalletEntry.count()).toBe(3);
  });

  it("allows declining a single offer without minting funds or duplicating employment", async () => {
    const employer = await player("COMMERCE");
    const worker = await player();
    const reviewer = await player();
    await submitOrientation(employer.id, correct);
    await submitOrientation(worker.id, correct);
    const business = await createMyVirtualBusinessDraft(employer.id, {
      name: "Farm Studio Work", sector: "AGRICULTURE",
    });
    await submitBusinessForReview(employer.id, business.business.id, {});
    await prisma.playerBusinessReviewer.create({ data: { userId: reviewer.id, isActive: true } });
    await reviewBusiness(reviewer.id, business.business.id, {
      decision: "APPROVE", note: "Virtual business approved in test-only flow.",
    });
    const job = await postMyVirtualJob(employer.id, {
      businessId: business.business.id, title: "Virtual agricultural assistant",
      description: "Maintain crop logs in this fictional farm simulation.",
      professionCode: "AGRICULTURE",
    });
    const submitted = await applyForVirtualJob(worker.id, job.job.id, {
      statement: "I can maintain virtual farm records and routines.",
    });
    await decideWorkApplicationAsEmployer(employer.id, submitted.application.id, { decision: "OFFER" });
    const declined = await decideMyWorkOffer(worker.id, submitted.application.id, { decision: "DECLINE" });
    expect(declined.status).toBe("DECLINED");
    expect(declined.employment).toBeNull();
    expect((await prisma.playerVirtualJob.findUniqueOrThrow({ where: { id: job.job.id } })).status).toBe("OPEN");
    expect(await prisma.playerVirtualEmployment.count()).toBe(0);
  });
});
