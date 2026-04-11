import { getDb, getIdentityByUserId } from "../server/db";
import { users } from "../drizzle/schema";
import { ensureGHLIdentity, recordPortalSignupConsent } from "../server/services/identitySync";

async function main() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const allUsers = await db.select().from(users);

  let processed = 0;
  let consented = 0;
  let ghlLinked = 0;

  for (const user of allUsers) {
    processed += 1;

    const existingIdentity = await getIdentityByUserId(user.id);
    const ghlContactId =
      existingIdentity?.ghlContactId ??
      (await ensureGHLIdentity(
        {
          id: user.id,
          name: user.name,
          email: user.email,
          openId: user.openId,
        },
        existingIdentity?.phoneNumber ?? undefined
      ));

    await recordPortalSignupConsent(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        openId: user.openId,
      },
      { ghlContactId }
    );

    const refreshedIdentity = await getIdentityByUserId(user.id);
    if (refreshedIdentity?.consentGiven) {
      consented += 1;
    }
    if (refreshedIdentity?.ghlContactId) {
      ghlLinked += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        processed,
        consented,
        ghlLinked,
      },
      null,
      2
    )
  );
}

void main().catch((error) => {
  console.error("[BackfillPortalConsent] Failed:", error);
  process.exit(1);
});
