import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "./config.js";

const base={DATABASE_URL:"postgresql://postgres:password@example.com:5432/postgres",MQTT_USERNAME:"worker",MQTT_PASSWORD:"secret-password",MQTT_CLIENT_ID:"worker-test",SUPABASE_URL:"https://example.supabase.co",SUPABASE_SECRET_KEY:"sb_secret_abcdefghijklmnopqrstuvwxyz"};

afterEach(()=>vi.unstubAllEnvs());

describe("worker configuration",()=>{
  it("requires MQTT TLS in production",()=>{
    for(const [key,value] of Object.entries({...base,NODE_ENV:"production",MQTT_URL:"mqtt://broker.example.com:1883"}))vi.stubEnv(key,value);
    expect(()=>loadConfig()).toThrow(/Production MQTT must use TLS/);
  });
  it("accepts a production TLS endpoint",()=>{
    for(const [key,value] of Object.entries({...base,NODE_ENV:"production",MQTT_URL:"mqtts://broker.example.com:8883"}))vi.stubEnv(key,value);
    expect(loadConfig().MQTT_URL).toBe("mqtts://broker.example.com:8883");
  });
});
