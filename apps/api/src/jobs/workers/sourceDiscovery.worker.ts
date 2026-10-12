import { Worker } from "bullmq";
import { createBullConnection } from "../../config/redis";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { RUN_SOURCE_DISCOVERY_JOB } from "../definitions/runSourceDiscovery.job";
import { processSourceDiscoveryRun } from "../../services/sources/sourceDiscovery.service";
import { prisma } from "../../config/database";

export function startSourceDiscoveryWorker(): Worker {
  const worker = new Worker(
    "source-discovery",
    async (job) => {
      if (job.name !== RUN_SOURCE_DISCOVERY_JOB) {
        logger.warn({ jobName: job.name }, "source_discovery_unknown_job");
        return;
      }

      const { runId } = job.data as { runId: string };
      try {
        await processSourceDiscoveryRun(runId);
      } catch (error) {
        const attempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
        if (job.attemptsMade + 1 >= attempts) {
          try {
            await prisma.sourceDiscoveryRun.update({
              where: { id: runId },
              data: {
                status: "FAILED",
                errorMessage: error instanceof Error ? error.message : "Native source discovery failed",
                processedAt: new Date(),
              },
            });
          } catch (statusError) {
            logger.error(
              { err: statusError, discoveryRunId: runId },
              "source_discovery_failure_status_update_failed",
            );
          }
        }
        throw error;
      }
    },
    {
      connection: createBullConnection(),
      prefix: env.QUEUE_PREFIX,
      concurrency: 2,
    },
  );

  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, err: error }, "source_discovery_job_failed");
  });

  return worker;
}
