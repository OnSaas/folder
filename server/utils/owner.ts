import { ulid } from "ulidx";
import type { BucketRecord, UserRecord } from "../storage/types";
import { keys } from "../storage/keys";
import { getJson, listKeys, setJson } from "../storage/kv";
import { bucketRepository } from "../repositories/bucket";
import { userRepository } from "../repositories/user";

const DEFAULT_OWNER_ID = "owner";
const DEFAULT_BUCKET_NAME = "files";

function configuredBucketName() {
  try {
    const config = useRuntimeConfig();
    const name = (config.bucketName as string | undefined) || "";
    if (name) return name;
  } catch {
    // ignore
  }
  return process.env.NUXT_BUCKET_NAME || DEFAULT_BUCKET_NAME;
}

async function findExistingBucket(): Promise<BucketRecord | null> {
  const named = await bucketRepository.getByName(configuredBucketName());
  if (named) return named;
  const listed = await listKeys("bucket:");
  for (const key of listed) {
    if (!/^bucket:[^:]+$/.test(key)) continue;
    const rec = await getJson<BucketRecord>(key);
    if (rec?.userId) return rec;
  }
  return null;
}

export async function ensureOwnerAndBucket(): Promise<{
  user: UserRecord;
  bucket: BucketRecord;
}> {
  let ownerId = await getJson<string>(keys.owner());
  let bucket = ownerId ? await bucketRepository.getByUser(ownerId) : null;
  if (!bucket) bucket = await findExistingBucket();

  ownerId = bucket?.userId || ownerId || DEFAULT_OWNER_ID;
  await setJson(keys.owner(), ownerId);

  let user = await userRepository.get(ownerId);
  if (!user) {
    user = await userRepository.create({
      id: ownerId,
      name: "Owner",
      status: "active",
      createdAt: Date.now(),
    });
  }

  if (!bucket) {
    bucket = await bucketRepository.create({
      id: ulid() as string,
      name: configuredBucketName(),
      userId: ownerId,
      size: 0,
      count: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  return { user, bucket };
}
