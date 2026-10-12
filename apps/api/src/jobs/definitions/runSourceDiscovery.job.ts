import { sourceDiscoveryQueue } from "../queues/sourceDiscovery.queue";

export interface RunSourceDiscoveryPayload {
  runId: string;
}

export const RUN_SOURCE_DISCOVERY_JOB = "run-source-discovery";

export async function enqueueSourceDiscovery(payload: RunSourceDiscoveryPayload) {
  return sourceDiscoveryQueue.add(RUN_SOURCE_DISCOVERY_JOB, payload, {
    jobId: `${RUN_SOURCE_DISCOVERY_JOB}:${payload.runId}`,
  });
}
