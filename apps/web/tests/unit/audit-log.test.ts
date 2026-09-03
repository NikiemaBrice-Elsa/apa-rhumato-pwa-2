import { describe, expect, it, vi, afterEach } from "vitest";
import { recordAuditLog } from "@/lib/auditLog";

/**
 * §79 : « Ne jamais cacher une erreur. » — Sprint 15.
 *
 * Reproduit précisément le bug découvert en écrivant
 * infra/db/scripts/verify_rls.sh : une erreur d'insertion dans
 * `audit_logs` (ex. incompatibilité de type, comme `entity_id` avant la
 * migration 0012) ne doit JAMAIS disparaître silencieusement. Ce test ne
 * touche aucune base réelle : il simule le client service_role pour
 * vérifier uniquement la décision (que fait `recordAuditLog` face à
 * `{ error }` ?), pas l'I/O elle-même.
 */
describe("recordAuditLog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ne lève PAS d'exception quand l'insertion échoue (n'empêche pas l'action admin déjà effectuée)", async () => {
    const client = {
      from: () => ({
        insert: async () => ({ data: null, error: { message: "invalid input syntax for type uuid" } }),
      }),
    } as any;

    await expect(
      recordAuditLog(client, { actorUserId: "admin-1", action: "test_action", entityType: "clinical_rules", entityId: "NOT_A_UUID" })
    ).resolves.toBeUndefined();
  });

  it("signale explicitement l'erreur via console.error plutôt que de l'ignorer", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = {
      from: () => ({
        insert: async () => ({ data: null, error: { message: "invalid input syntax for type uuid" } }),
      }),
    } as any;

    await recordAuditLog(client, {
      actorUserId: "admin-1",
      action: "admin_update_clinical_rule",
      entityType: "clinical_rules",
      entityId: "LBP_RED_FLAG_QUEUE_DE_CHEVAL",
    });

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [, payload] = consoleErrorSpy.mock.calls[0];
    expect(payload).toMatchObject({
      action: "admin_update_clinical_rule",
      entityType: "clinical_rules",
      entityId: "LBP_RED_FLAG_QUEUE_DE_CHEVAL",
    });
  });

  it("ne journalise rien via console.error quand l'insertion réussit", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = {
      from: () => ({
        insert: async () => ({ data: [{ id: "log-1" }], error: null }),
      }),
    } as any;

    await recordAuditLog(client, { actorUserId: "admin-1", action: "test_action", entityType: "users" });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
