import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  MQTT_URL: z.string().regex(/^mqtts?:\/\//),
  MQTT_USERNAME: z.string().min(1),
  MQTT_PASSWORD: z.string().min(1),
  MQTT_CLIENT_ID: z.string().min(3).max(120),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(20),
  OUTBOX_POLL_MS: z.coerce.number().int().min(200).max(10_000).default(500)
}).superRefine((value,context)=>{
  if(value.NODE_ENV==="production"&&!value.MQTT_URL.startsWith("mqtts://")){
    context.addIssue({code:"custom",path:["MQTT_URL"],message:"Production MQTT must use TLS"});
  }
});

export type WorkerConfig = z.infer<typeof schema>;
export const loadConfig = (): WorkerConfig => schema.parse(process.env);
