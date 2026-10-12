import { env } from "../../config/env";
import { createDatabaseQueue } from "../databaseQueue";

export const sourceDiscoveryQueue = createDatabaseQueue(env.JOB_ATTEMPTS_DEFAULT);
