import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PodControlService } from "./pod-control.service";
import * as tenantContext from "../core/tenant/tenant.context";

describe("PodControlService", () => {
  let service: PodControlService;
  let podFindFirst: jest.Mock;
  let podCreate: jest.Mock;
  let podUpdate: jest.Mock;
  let podCheckItemFindFirst: jest.Mock;
  let podCheckItemCreate: jest.Mock;

  const ORG = "org-test";
  const ACTOR = "usr-admin";

  const mockPod = {
    id: "pod-1",
    organizationId: ORG,
    tripId: "trip-1",
    currentStatus: "PENDING_DELIVERY",
    holdReason: null,
    holdRemarks: null,
    checkItems: [],
    events: [],
  };

  beforeEach(() => {
    jest.spyOn(tenantContext, "requireTenant").mockReturnValue({ organizationId: ORG, userId: ACTOR });

    podFindFirst = jest.fn().mockResolvedValue(mockPod);
    podCreate = jest.fn().mockImplementation((args: any) =>
      Promise.resolve({ id: "pod-new", ...args.data, checkItems: [], events: [] }),
    );
    podUpdate = jest.fn().mockImplementation((args: any) =>
      Promise.resolve({ ...mockPod, ...args.data, checkItems: [], events: [] }),
    );
    podCheckItemFindFirst = jest.fn().mockResolvedValue(null);
    podCheckItemCreate = jest.fn().mockResolvedValue({ id: "pci-1" });

    const mockPrisma = {
      pod: {
        findFirst: podFindFirst,
        create: podCreate,
        update: podUpdate,
      },
      podCheckItem: {
        findFirst: podCheckItemFindFirst,
        create: podCheckItemCreate,
        update: jest.fn().mockResolvedValue({ id: "pci-1" }),
      },
    } as unknown as PrismaService;

    service = new PodControlService(mockPrisma);
  });

  // ─── ensurePodForTrip ─────────────────────────────────────────────────────────

  it("1. ensurePodForTrip() creates a new Pod with PENDING_DELIVERY when none exists", async () => {
    podFindFirst.mockResolvedValueOnce(null);

    await service.ensurePodForTrip("trip-1", ORG, ACTOR);

    expect(podCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tripId: "trip-1",
          organizationId: ORG,
          currentStatus: "PENDING_DELIVERY",
        }),
      }),
    );
  });

  it("2. ensurePodForTrip() is idempotent — returns existing pod without creating", async () => {
    podFindFirst.mockResolvedValueOnce(mockPod);

    const result = await service.ensurePodForTrip("trip-1", ORG, ACTOR);

    expect(podCreate).not.toHaveBeenCalled();
    expect(result).toEqual(mockPod);
  });

  // ─── getById ─────────────────────────────────────────────────────────────────

  it("3. getById() throws NotFoundException when pod not found", async () => {
    podFindFirst.mockResolvedValueOnce(null);

    await expect(service.getById("unknown")).rejects.toThrow(NotFoundException);
  });

  // ─── submitChecklist ──────────────────────────────────────────────────────────

  it("4. submitChecklist() transitions to SOFT_COPY_CHECKED when all items PASS", async () => {
    podFindFirst.mockResolvedValueOnce(mockPod);

    await service.submitChecklist(
      "pod-1",
      {
        items: [
          { itemCode: "STAMP_LEGIBLE", result: "PASS" as any },
          { itemCode: "SIGNATURE_VALID", result: "PASS" as any },
        ],
      },
      ACTOR,
    );

    expect(podUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStatus: "SOFT_COPY_CHECKED" }),
      }),
    );
  });

  it("5. submitChecklist() transitions to ON_HOLD when any item FAILs", async () => {
    podFindFirst.mockResolvedValueOnce(mockPod);

    await service.submitChecklist(
      "pod-1",
      {
        items: [
          { itemCode: "STAMP_LEGIBLE", result: "FAIL" as any },
          { itemCode: "SIGNATURE_VALID", result: "PASS" as any },
        ],
      },
      ACTOR,
    );

    expect(podUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStatus: "ON_HOLD" }),
      }),
    );
  });

  it("6. submitChecklist() throws BadRequestException for empty items array", async () => {
    podFindFirst.mockResolvedValueOnce(mockPod);

    await expect(
      service.submitChecklist("pod-1", { items: [] }, ACTOR),
    ).rejects.toThrow(BadRequestException);
  });

  it("7. submitChecklist() throws BadRequestException when pod is ACKNOWLEDGED", async () => {
    podFindFirst.mockResolvedValueOnce({ ...mockPod, currentStatus: "ACKNOWLEDGED" });

    await expect(
      service.submitChecklist(
        "pod-1",
        { items: [{ itemCode: "STAMP_LEGIBLE", result: "PASS" as any }] },
        ACTOR,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── placeOnHold ──────────────────────────────────────────────────────────────

  it("8. placeOnHold() transitions to ON_HOLD with reason and remarks", async () => {
    podFindFirst.mockResolvedValueOnce({ ...mockPod, currentStatus: "SOFT_COPY_RECEIVED" });

    await service.placeOnHold("pod-1", { reason: "Stamp missing", remarks: "Re-stamp required" }, ACTOR);

    expect(podUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentStatus: "ON_HOLD",
          holdReason: "Stamp missing",
          holdRemarks: "Re-stamp required",
        }),
      }),
    );
  });

  it("9. placeOnHold() throws ConflictException when already ON_HOLD", async () => {
    podFindFirst.mockResolvedValueOnce({ ...mockPod, currentStatus: "ON_HOLD" });

    await expect(
      service.placeOnHold("pod-1", { reason: "Again", remarks: "Again" }, ACTOR),
    ).rejects.toThrow(ConflictException);
  });

  // ─── releaseHold ──────────────────────────────────────────────────────────────

  it("10. releaseHold() transitions ON_HOLD → SOFT_COPY_RECEIVED and clears hold fields", async () => {
    podFindFirst.mockResolvedValueOnce({ ...mockPod, currentStatus: "ON_HOLD" });

    await service.releaseHold("pod-1", { reason: "Corrected by customer" }, ACTOR);

    expect(podUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentStatus: "SOFT_COPY_RECEIVED",
          holdReason: null,
          holdRemarks: null,
        }),
      }),
    );
  });

  it("11. releaseHold() throws BadRequestException when pod is not ON_HOLD", async () => {
    podFindFirst.mockResolvedValueOnce({ ...mockPod, currentStatus: "SOFT_COPY_RECEIVED" });

    await expect(
      service.releaseHold("pod-1", { reason: "Whatever" }, ACTOR),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── markSoftCopyReceived ──────────────────────────────────────────────────────

  it("12. markSoftCopyReceived() transitions PENDING_DELIVERY → SOFT_COPY_RECEIVED", async () => {
    podFindFirst.mockResolvedValueOnce({ ...mockPod, currentStatus: "PENDING_DELIVERY" });

    await service.markSoftCopyReceived("pod-1", ACTOR);

    expect(podUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStatus: "SOFT_COPY_RECEIVED" }),
      }),
    );
  });

  it("13. markSoftCopyReceived() throws BadRequestException when not in PENDING_DELIVERY", async () => {
    podFindFirst.mockResolvedValueOnce({ ...mockPod, currentStatus: "SOFT_COPY_RECEIVED" });

    await expect(service.markSoftCopyReceived("pod-1", ACTOR)).rejects.toThrow(BadRequestException);
  });

  // ─── Physical POD Tracking (R1-TASK-5.2) ─────────────────────────────────────

  it("14. dispatchCourier() transitions SOFT_COPY_CHECKED → ORIGINAL_DISPATCHED", async () => {
    podFindFirst.mockResolvedValueOnce({ ...mockPod, currentStatus: "SOFT_COPY_CHECKED" });

    await service.dispatchCourier("pod-1", { courierName: "BlueDart", courierTrackingNo: "BD123" }, ACTOR);

    expect(podUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentStatus: "ORIGINAL_DISPATCHED",
          courierName: "BlueDart",
          courierTrackingNo: "BD123",
        }),
      }),
    );
  });

  it("15. dispatchCourier() throws BadRequestException when not SOFT_COPY_CHECKED", async () => {
    podFindFirst.mockResolvedValueOnce({ ...mockPod, currentStatus: "ON_HOLD" });

    await expect(
      service.dispatchCourier("pod-1", { courierName: "BlueDart" }, ACTOR),
    ).rejects.toThrow(BadRequestException);
  });

  it("16. markOriginalReceived() transitions ORIGINAL_DISPATCHED → ORIGINAL_RECEIVED", async () => {
    podFindFirst.mockResolvedValueOnce({ ...mockPod, currentStatus: "ORIGINAL_DISPATCHED" });

    await service.markOriginalReceived("pod-1", ACTOR);

    expect(podUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStatus: "ORIGINAL_RECEIVED" }),
      }),
    );
  });

  it("17. markLost() transitions ORIGINAL_DISPATCHED → LOST with reason", async () => {
    podFindFirst.mockResolvedValueOnce({ ...mockPod, currentStatus: "ORIGINAL_DISPATCHED" });

    await service.markLost("pod-1", { reason: "Courier lost the package" }, ACTOR);

    expect(podUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStatus: "LOST" }),
      }),
    );
  });

  it("18. markLost() throws BadRequestException from invalid status (PENDING_DELIVERY)", async () => {
    podFindFirst.mockResolvedValueOnce({ ...mockPod, currentStatus: "PENDING_DELIVERY" });

    await expect(
      service.markLost("pod-1", { reason: "Lost" }, ACTOR),
    ).rejects.toThrow(BadRequestException);
  });

  it("19. requestDuplicate() transitions LOST → DUPLICATE_REQUESTED", async () => {
    podFindFirst.mockResolvedValueOnce({ ...mockPod, currentStatus: "LOST" });

    await service.requestDuplicate("pod-1", { notes: "Please issue duplicate stamp copy" }, ACTOR);

    expect(podUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStatus: "DUPLICATE_REQUESTED" }),
      }),
    );
  });

  it("20. requestDuplicate() throws BadRequestException when not LOST", async () => {
    podFindFirst.mockResolvedValueOnce({ ...mockPod, currentStatus: "ORIGINAL_DISPATCHED" });

    await expect(
      service.requestDuplicate("pod-1", { notes: "some notes" }, ACTOR),
    ).rejects.toThrow(BadRequestException);
  });

  it("21. submitToClient() transitions ORIGINAL_RECEIVED → SUBMITTED_TO_CLIENT", async () => {
    podFindFirst.mockResolvedValueOnce({ ...mockPod, currentStatus: "ORIGINAL_RECEIVED" });

    await service.submitToClient("pod-1", ACTOR);

    expect(podUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStatus: "SUBMITTED_TO_CLIENT" }),
      }),
    );
  });

  it("22. acknowledgeReceipt() transitions SUBMITTED_TO_CLIENT → ACKNOWLEDGED", async () => {
    podFindFirst.mockResolvedValueOnce({ ...mockPod, currentStatus: "SUBMITTED_TO_CLIENT" });

    await service.acknowledgeReceipt("pod-1", ACTOR);

    expect(podUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStatus: "ACKNOWLEDGED" }),
      }),
    );
  });
});
