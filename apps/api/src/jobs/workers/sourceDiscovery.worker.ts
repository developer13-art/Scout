import { logger } from "../../config/logger";
import { RUN_SOURCE_DISCOVERY_JOB } from "../definitions/runSourceDiscovery.job";
import { processSourceDiscoveryRun } from "../../services/sources/sourceDiscovery.service";

export async function processSourceDiscoveryJob(job: {
  name: string;
  payload: unknown;
}): Promise<void> {
  if (job.name !== RUN_SOURCE_DISCOVERY_JOB) {
    logger.warn({ jobName: job.name }, "source_discovery_unknown_job");
    return;
  }

  const { runId } = job.payload as { runId: string };
  await processSourceDiscoveryRun(runId);
}
