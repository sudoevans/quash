import { describe, it, expect, beforeEach } from "vitest";
import { initSimnet } from "@stacks/clarinet-sdk";
import { Cl, cvToValue } from "@stacks/transactions";

const simnet = await initSimnet();
const accounts = simnet.getAccounts();

const deployer = accounts.get("deployer")!;
const agent    = accounts.get("wallet_1")!;
const author   = accounts.get("wallet_2")!;
const stranger = accounts.get("wallet_3")!;

const CONTRACT = "quash-escrow";
const SOLUTION_ID = "seed-sol-001";
const LOCK_AMOUNT = 30_000n; // 30,000 microSTX
// Must match PLATFORM_WALLET constant in the contract
const PLATFORM_WALLET = "ST2MH65RCF2W7GA8ZEVM0V3V55XT97Y9BHM5RN9TE";

describe("quash-escrow", () => {

  // ── lock-stx ──────────────────────────────────────────────────────────

  describe("lock-stx", () => {
    it("locks STX in the contract and stores escrow entry", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT, "lock-stx",
        [Cl.stringAscii(SOLUTION_ID), Cl.principal(author), Cl.uint(LOCK_AMOUNT)],
        agent
      );
      expect(result).toBeOk(Cl.bool(true));

      // Verify escrow entry written
      const { result: escrow } = simnet.callReadOnlyFn(
        CONTRACT, "get-escrow",
        [Cl.stringAscii(SOLUTION_ID)],
        deployer
      );
      const entry = cvToValue(escrow) as any;
      expect(entry).not.toBeNull();
      expect(entry.value.currency.value).toBe("STX");
      expect(entry.value.released.value).toBe(false);
      expect(entry.value.refunded.value).toBe(false);
    });

    it("rejects duplicate lock on same solution-id", () => {
      simnet.callPublicFn(
        CONTRACT, "lock-stx",
        [Cl.stringAscii(SOLUTION_ID), Cl.principal(author), Cl.uint(LOCK_AMOUNT)],
        agent
      );
      const { result } = simnet.callPublicFn(
        CONTRACT, "lock-stx",
        [Cl.stringAscii(SOLUTION_ID), Cl.principal(author), Cl.uint(LOCK_AMOUNT)],
        agent
      );
      expect(result).toBeErr(Cl.uint(101)); // ERR_ALREADY_EXISTS
    });
  });

  // ── release-stx ───────────────────────────────────────────────────────

  describe("release-stx", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        CONTRACT, "lock-stx",
        [Cl.stringAscii(SOLUTION_ID), Cl.principal(author), Cl.uint(LOCK_AMOUNT)],
        agent
      );
    });

    it("sends 80% to author and 20% to platform wallet", () => {
      const authorBefore   = simnet.getAssetsMap().get("STX")?.get(author)          ?? 0n;
      const platformBefore = simnet.getAssetsMap().get("STX")?.get(PLATFORM_WALLET) ?? 0n;

      const { result } = simnet.callPublicFn(
        CONTRACT, "release-stx",
        [Cl.stringAscii(SOLUTION_ID)],
        deployer
      );
      expect(result).toBeOk(Cl.bool(true));

      const authorAfter   = simnet.getAssetsMap().get("STX")?.get(author)          ?? 0n;
      const platformAfter = simnet.getAssetsMap().get("STX")?.get(PLATFORM_WALLET) ?? 0n;

      expect(authorAfter - authorBefore).toBe((LOCK_AMOUNT * 80n) / 100n);
      expect(platformAfter - platformBefore).toBe((LOCK_AMOUNT * 20n) / 100n);
    });

    it("marks escrow as released", () => {
      simnet.callPublicFn(CONTRACT, "release-stx", [Cl.stringAscii(SOLUTION_ID)], deployer);
      const { result } = simnet.callReadOnlyFn(
        CONTRACT, "is-released", [Cl.stringAscii(SOLUTION_ID)], deployer
      );
      expect(result).toBeBool(true);
    });

    it("rejects double-release", () => {
      simnet.callPublicFn(CONTRACT, "release-stx", [Cl.stringAscii(SOLUTION_ID)], deployer);
      const { result } = simnet.callPublicFn(CONTRACT, "release-stx", [Cl.stringAscii(SOLUTION_ID)], deployer);
      expect(result).toBeErr(Cl.uint(103)); // ERR_ALREADY_RELEASED
    });

    it("rejects non-owner calling release", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT, "release-stx", [Cl.stringAscii(SOLUTION_ID)], stranger
      );
      expect(result).toBeErr(Cl.uint(100)); // ERR_NOT_OWNER
    });
  });

  // ── refund-stx ────────────────────────────────────────────────────────

  describe("refund-stx", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        CONTRACT, "lock-stx",
        [Cl.stringAscii(SOLUTION_ID), Cl.principal(author), Cl.uint(LOCK_AMOUNT)],
        agent
      );
    });

    it("returns full amount to agent", () => {
      const agentBefore = simnet.getAssetsMap().get("STX")?.get(agent) ?? 0n;
      const { result } = simnet.callPublicFn(
        CONTRACT, "refund-stx", [Cl.stringAscii(SOLUTION_ID)], deployer
      );
      expect(result).toBeOk(Cl.bool(true));
      const agentAfter = simnet.getAssetsMap().get("STX")?.get(agent) ?? 0n;
      expect(agentAfter - agentBefore).toBe(LOCK_AMOUNT);
    });

    it("rejects refund after release", () => {
      simnet.callPublicFn(CONTRACT, "release-stx", [Cl.stringAscii(SOLUTION_ID)], deployer);
      const { result } = simnet.callPublicFn(CONTRACT, "refund-stx", [Cl.stringAscii(SOLUTION_ID)], deployer);
      expect(result).toBeErr(Cl.uint(103)); // ERR_ALREADY_RELEASED
    });

    it("rejects non-owner calling refund", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT, "refund-stx", [Cl.stringAscii(SOLUTION_ID)], stranger
      );
      expect(result).toBeErr(Cl.uint(100)); // ERR_NOT_OWNER
    });
  });

  // ── SIP-010 stubs (Phase 2) ────────────────────────────────────────────

  describe("SIP-010 stubs", () => {
    it("lock-ft returns ERR_NOT_YET_SUPPORTED", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT, "lock-ft",
        [Cl.stringAscii("any-id"), Cl.principal(author), Cl.uint(100n)],
        agent
      );
      expect(result).toBeErr(Cl.uint(105)); // ERR_NOT_YET_SUPPORTED
    });

    it("release-ft returns ERR_NOT_YET_SUPPORTED", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT, "release-ft", [Cl.stringAscii("any-id")], deployer
      );
      expect(result).toBeErr(Cl.uint(105));
    });

    it("refund-ft returns ERR_NOT_YET_SUPPORTED", () => {
      const { result } = simnet.callPublicFn(
        CONTRACT, "refund-ft", [Cl.stringAscii("any-id")], deployer
      );
      expect(result).toBeErr(Cl.uint(105));
    });
  });
});
