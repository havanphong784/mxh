import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module.js";
import { MediaService } from "../media/media.service.js";
import { MessagingService } from "../messaging/messaging.service.js";

const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
try {
  const dryRun = !process.argv.includes("--apply");
  const result = await app.get(MessagingService).purgeUnusedMedia(app.get(MediaService), dryRun);
  console.log(JSON.stringify({ dryRun, ...result }));
  if (result.failed) process.exitCode = 1;
} finally {
  await app.close();
}
