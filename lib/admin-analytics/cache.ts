import { unstable_cache } from "next/cache";
import { runMetric, dataCoverage, type DataCoverage } from "./metrics";
import { listAllUsers, lookupUser } from "./user";
import type { MetricResult } from "./types";
import type { UserListRow, UserReport } from "./user";

export const ADMIN_CACHE_TAG = "admin-analytics";
const TTL_SECONDS = 300;

export const cachedMetric = unstable_cache(
  (key: string, days: number): Promise<MetricResult> =>
    runMetric(key, { days }),
  ["admin-metric"],
  { revalidate: TTL_SECONDS, tags: [ADMIN_CACHE_TAG] },
);

export const cachedCoverage = unstable_cache(
  (): Promise<DataCoverage> => dataCoverage(),
  ["admin-data-coverage"],
  { revalidate: TTL_SECONDS, tags: [ADMIN_CACHE_TAG] },
);

export const cachedUserList = unstable_cache(
  (): Promise<UserListRow[]> => listAllUsers(),
  ["admin-user-list"],
  { revalidate: TTL_SECONDS, tags: [ADMIN_CACHE_TAG] },
);

export const cachedUserReport = unstable_cache(
  (q: string): Promise<UserReport | null> => lookupUser(q),
  ["admin-user-report"],
  { revalidate: 120, tags: [ADMIN_CACHE_TAG] },
);
