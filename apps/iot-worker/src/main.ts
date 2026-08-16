import { loadConfig } from "./config.js";
import { IotWorker } from "./worker.js";

const worker = new IotWorker(loadConfig());
await worker.start();

const shutdown = async () => { await worker.stop(); process.exit(0); };
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
