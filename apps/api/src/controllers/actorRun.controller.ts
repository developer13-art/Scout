import type { Request, Response } from "express";
import * as RunService from "../services/apify/run.service";
import * as IngestionService from "../services/apify/runIngestion.service";
import { enqueueRunApifyActor } from "../jobs/definitions/runApifyActor.job";
import { apifyActors, abortActorRun, startActorRun } from "../services/apify/actor.service";
import { apifyConfig } from "../config/apify";
import { assertDatabaseJobRunnerReady } from "../jobs/runner";
import { asyncHandler } from "../utils/asyncHandler";
import { logger } from "../config/logger";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await RunService.listRuns({
    sourceId: typeof req.query.sourceId === "string" ? req.query.sourceId : undefined,
    status: typeof req.query.status === "string" ? (req.query.status as never) : undefined,
    trigger: typeof req.query.trigger === "string" ? (req.query.trigger as never) : undefined,
    page: req.query.page ? Number(req.query.page) : 1,
    pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
  });
  res.json({ data: result.items });
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const data = await RunService.getRun(req.params.id);
  res.json({ data });
});

export const trigger = asyncHandler(async (req: Request, res: Response) => {
  const { sourceId } = req.body as { sourceId: string };
  if (!sourceId) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "sourceId is required" },
    });
    return;
  }
  if (!apifyActors.opportunityDiscovery || !apifyConfig.isConfigured) {
    res.status(503).json({
      error: {
        code: "APIFY_NOT_CONFIGURED",
        message: "Configure the Apify actor ID and APIFY_TOKEN secret before running discovery.",
      },
    });
    return;
  }
  await assertDatabaseJobRunnerReady();

  const run = await IngestionService.triggerIngestion({
    sourceId,
    trigger: "MANUAL_ADMIN",
    createdBy: req.user?.id ?? null,
  });

  let apifyRunId: string | undefined;
  try {
    const input = await IngestionService.buildActorInput(sourceId);
    const actorRun = await startActorRun(apifyActors.opportunityDiscovery, input, {
      memoryMb: apifyConfig.defaultMemoryMb,
      timeoutSeconds: apifyConfig.defaultTimeoutSeconds,
    });
    apifyRunId = actorRun.id;
    const startedRun = await RunService.markRunStarted(run.id, actorRun.id);

    await enqueueRunApifyActor({
      sourceId,
      runId: run.id,
      actorId: apifyActors.opportunityDiscovery,
      apifyRunId: actorRun.id,
    });

    logger.info({ sourceId, runId: run.id, apifyRunId }, "actor_run_started_and_tracking_enqueued");
    res.status(202).json({ data: startedRun });
  } catch (error) {
    try {
      await RunService.markRunFinished({
        runId: run.id,
        status: "FAILED",
        itemsFound: 0,
        itemsImported: 0,
        itemsUpdated: 0,
        itemsDuplicate: 0,
        itemsUnchanged: 0,
        itemsInvalid: 0,
        errorMessage: apifyRunId
          ? `Apify started run ${apifyRunId}, but run tracking could not be prepared.`
          : error instanceof Error
            ? error.message
            : "The Apify discovery run could not be started.",
        errorDetails: {
          reason: error instanceof Error ? error.message : "Unknown queue error",
          ...(apifyRunId ? { apifyRunId } : {}),
        },
      });
    } catch (statusError) {
      logger.error(
        { err: statusError, sourceId, runId: run.id },
        "actor_run_queue_failure_status_update_failed",
      );
    }
    logger.error({ err: error, sourceId, runId: run.id, apifyRunId }, "actor_run_start_or_queue_failed");
    throw error;
  }
});

export const abort = asyncHandler(async (req: Request, res: Response) => {
  const run = await RunService.getRun(req.params.id);
  if (run?.apifyRunId) await abortActorRun(run.apifyRunId);
  res.status(202).json({ data: { aborted: true } });
});

export const rawItems = asyncHandler(async (req: Request, res: Response) => {
  const data = await RunService.getRawItemsForRun(req.params.id);
  res.json({ data });
});