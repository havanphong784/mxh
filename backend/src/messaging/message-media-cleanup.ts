type Asset = { publicId: string; createdAt: string };
export interface CleanupDependencies {
  pages(): AsyncIterable<Asset[]>;
  pending?(): AsyncIterable<string[]>;
  reserve(publicId: string): Promise<boolean>;
  remove(publicId: string): Promise<void>;
  complete(publicId: string): Promise<void>;
}

export async function purgeMessageMedia(
  dependencies: CleanupDependencies,
  options: { dryRun: boolean; before: Date },
): Promise<{ candidates: number; deleted: number; failed: number }> {
  const result = { candidates: 0, deleted: 0, failed: 0 };
  const retried = new Set<string>();
  async function remove(publicId: string) {
    result.candidates++;
    if (options.dryRun) return;
    try {
      if (!(await dependencies.reserve(publicId))) return;
      await dependencies.remove(publicId);
      await dependencies.complete(publicId);
      result.deleted++;
    } catch {
      result.failed++;
    }
  }
  if (dependencies.pending) {
    for await (const page of dependencies.pending()) {
      for (const publicId of page) {
        if (!/^mxh\/[^/]+\/messages\/.+/.test(publicId)) continue;
        retried.add(publicId);
        await remove(publicId);
      }
    }
  }
  for await (const page of dependencies.pages()) {
    for (const asset of page) {
      if (
        retried.has(asset.publicId) ||
        !/^mxh\/[^/]+\/messages\/.+/.test(asset.publicId) ||
        !(new Date(asset.createdAt).getTime() < options.before.getTime())
      )
        continue;
      await remove(asset.publicId);
    }
  }
  return result;
}
