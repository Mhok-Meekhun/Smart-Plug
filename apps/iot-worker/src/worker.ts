import {
  availabilityPayloadSchema,
  commandAcknowledgementPayloadSchema,
  deviceStatePayloadSchema,
  deviceTopic,
  parseDeviceTopic,
  relayCommandPayloadSchema,
  telemetryPayloadSchema
} from "@smart-home/contracts";
import { nextRepeatingRun } from "@smart-home/domain";
import mqtt, { type MqttClient } from "mqtt";
import { Pool } from "pg";
import { z } from "zod";
import type { WorkerConfig } from "./config.js";
import { RealtimePublisher } from "./realtime.js";

const uuidSchema = z.string().uuid();
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

interface OutboxCommand {
  command_id: string;
  device_id: string;
  desired_relay_state: boolean;
  requested_at: Date;
  expires_at: Date;
}

interface DueSchedule {
  id: string;
  device_id: string;
  created_by: string;
  kind: "ONCE" | "REPEATING";
  desired_relay_state: boolean;
  timezone: string;
  local_time: string | null;
  weekdays: number[];
  next_run_at: Date;
}

export class IotWorker {
  private readonly pool: Pool;
  private readonly realtime: RealtimePublisher;
  private readonly mqtt: MqttClient;
  private stopping = false;
  private lastMaintenanceAt = 0;

  constructor(private readonly config: WorkerConfig) {
    this.pool = new Pool({ connectionString: config.DATABASE_URL, max: 10 });
    this.realtime = new RealtimePublisher(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY);
    this.mqtt = mqtt.connect(config.MQTT_URL, {
      username: config.MQTT_USERNAME,
      password: config.MQTT_PASSWORD,
      clientId: config.MQTT_CLIENT_ID,
      clean: false,
      reconnectPeriod: 1_000,
      connectTimeout: 20_000,
      rejectUnauthorized: true
    });
  }

  async start() {
    this.mqtt.on("connect", () => {
      this.log("info", "mqtt_connected");
      this.mqtt.subscribe([
        "v1/devices/+/telemetry",
        "v1/devices/+/state",
        "v1/devices/+/acks",
        "v1/devices/+/availability"
      ], { qos: 1 });
    });
    this.mqtt.on("message", (topic, payload) => void this.handleMessage(topic, payload));
    this.mqtt.on("error", (error) => this.log("error", "mqtt_error", { message: error.message }));
    void this.runOutbox();
  }

  async stop() {
    this.stopping = true;
    await new Promise<void>((resolve, reject) =>
      this.mqtt.end(false, {}, (error) => error ? reject(error) : resolve())
    );
    await this.realtime.close();
    await this.pool.end();
  }

  private async handleMessage(topic: string, bytes: Buffer) {
    const parsedTopic = parseDeviceTopic(topic);
    if (!parsedTopic || parsedTopic.kind === "commands") return;
    if (!uuidSchema.safeParse(parsedTopic.deviceId).success) {
      this.log("warn", "invalid_device_topic", { topic }); return;
    }
    let json: unknown;
    try { json = JSON.parse(bytes.toString("utf8")); }
    catch { this.log("warn", "invalid_json", { topic }); return; }

    try {
      if (parsedTopic.kind === "telemetry") await this.ingestTelemetry(telemetryPayloadSchema.parse(json));
      else if (parsedTopic.kind === "state") await this.ingestState(deviceStatePayloadSchema.parse(json));
      else if (parsedTopic.kind === "availability") await this.ingestAvailability(availabilityPayloadSchema.parse(json));
      else if (parsedTopic.kind === "acks") await this.ingestAcknowledgement(commandAcknowledgementPayloadSchema.parse(json));
    } catch (error) {
      this.log("warn", "message_rejected", { topic, message: error instanceof Error ? error.message : "unknown" });
    }
  }

  private async ingestTelemetry(message: z.infer<typeof telemetryPayloadSchema>) {
    const result = await this.pool.query<{ home_id: string }>(`
      with inserted as (
        insert into public.telemetry_readings
          (message_id, device_id, sequence, device_timestamp, voltage_v, current_a, power_w, energy_kwh, frequency_hz, power_factor, signal_strength_dbm)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        on conflict (device_id, message_id) do nothing
        returning device_id
      ), updated as (
        insert into public.device_states
          (device_id, connection_status, voltage_v, current_a, power_w, energy_kwh, sequence, last_seen_at)
        select $2, 'ONLINE', $5, $6, $7, $8, $3, now() from inserted
        on conflict (device_id) do update set
          connection_status='ONLINE', voltage_v=excluded.voltage_v,
          current_a=excluded.current_a, power_w=excluded.power_w,
          energy_kwh=excluded.energy_kwh, sequence=excluded.sequence,
          last_seen_at=excluded.last_seen_at
        where public.device_states.sequence is null or excluded.sequence >= public.device_states.sequence
        returning device_id
      )
      select d.home_id from updated join public.devices d on d.id=updated.device_id
    `, [message.messageId, message.deviceId, message.sequence, message.deviceTimestamp, message.voltageV, message.currentA, message.powerW, message.energyKwh, message.frequencyHz ?? null, message.powerFactor ?? null, message.rssiDbm ?? null]);
    const homeId = result.rows[0]?.home_id;
    if (homeId) await this.realtime.publish(homeId, "telemetry.updated", { ...message });
  }

  private async ingestState(message: z.infer<typeof deviceStatePayloadSchema>) {
    const result = await this.pool.query<{ home_id: string }>(`
      insert into public.device_states
        (device_id, connection_status, relay_state, voltage_v, current_a, power_w, energy_kwh, sequence, last_seen_at)
      values ($1,'ONLINE',$2,$3,$4,$5,$6,$7,now())
      on conflict (device_id) do update set relay_state=excluded.relay_state,
        connection_status='ONLINE', voltage_v=coalesce(excluded.voltage_v, public.device_states.voltage_v),
        current_a=coalesce(excluded.current_a, public.device_states.current_a),
        power_w=coalesce(excluded.power_w, public.device_states.power_w),
        energy_kwh=coalesce(excluded.energy_kwh, public.device_states.energy_kwh),
        sequence=excluded.sequence, last_seen_at=excluded.last_seen_at
      where public.device_states.sequence is null or excluded.sequence >= public.device_states.sequence
      returning (select home_id from public.devices where id=$1) as home_id
    `, [message.deviceId, message.relayState, message.voltageV ?? null, message.currentA ?? null, message.powerW ?? null, message.energyKwh ?? null, message.sequence]);
    const homeId = result.rows[0]?.home_id;
    if (homeId) await this.realtime.publish(homeId, "device.state", { deviceId: message.deviceId, relayState: message.relayState, sequence: message.sequence });
  }

  private async ingestAvailability(message: z.infer<typeof availabilityPayloadSchema>) {
    const status = message.online ? "ONLINE" : "OFFLINE";
    const result = await this.pool.query<{ home_id: string }>(`
      insert into public.device_states (device_id, connection_status, last_seen_at)
      values ($1,$2,now()) on conflict (device_id) do update
      set connection_status=excluded.connection_status, last_seen_at=excluded.last_seen_at
      returning (select home_id from public.devices where id=$1) as home_id
    `, [message.deviceId, status]);
    const homeId = result.rows[0]?.home_id;
    if (homeId) await this.realtime.publish(homeId, "device.availability", { deviceId: message.deviceId, online: message.online, reason: message.reason });
  }

  private async ingestAcknowledgement(message: z.infer<typeof commandAcknowledgementPayloadSchema>) {
    if (!uuidSchema.safeParse(message.commandId).success) throw new Error("Acknowledgement commandId must be a UUID");
    const status = message.status;
    const result = await this.pool.query<{ home_id: string }>(`
      with changed as (
        update public.device_commands set status=$3, acknowledged_at=now(),
          failure_code=$4, acknowledgement_payload=$5::jsonb
        where id=$1 and device_id=$2 and status in ('PENDING','SENT') and expires_at >= now()
        returning device_id
      ), state as (
        update public.device_states set relay_state=$6, last_seen_at=now()
        where device_id in (select device_id from changed)
      )
      select d.home_id from changed join public.devices d on d.id=changed.device_id
    `, [message.commandId, message.deviceId, status, message.errorCode ?? null, JSON.stringify(message), message.confirmedRelayState]);
    const homeId = result.rows[0]?.home_id;
    if (homeId) await this.realtime.publish(homeId, "command.updated", { commandId: message.commandId, deviceId: message.deviceId, status, confirmedRelayState: message.confirmedRelayState });
  }

  private async runOutbox() {
    while (!this.stopping) {
      try {
        await this.executeDueSchedule();
        await this.publishOne();
        await this.timeoutExpired();
        if (Date.now() - this.lastMaintenanceAt >= 60_000) {
          await this.runMaintenance();
          this.lastMaintenanceAt = Date.now();
        }
      }
      catch (error) { this.log("error", "outbox_error", { message: error instanceof Error ? error.message : "unknown" }); }
      await sleep(this.config.OUTBOX_POLL_MS);
    }
  }

  private async publishOne() {
    const client = await this.pool.connect();
    let command: OutboxCommand | undefined;
    try {
      await client.query("begin");
      const result = await client.query<OutboxCommand>(`
        select o.command_id, c.device_id, c.desired_relay_state, c.requested_at, c.expires_at
        from public.device_command_outbox o join public.device_commands c on c.id=o.command_id
        where o.published_at is null and o.available_at <= now() and c.status='PENDING'
        order by o.available_at for update of o skip locked limit 1
      `);
      command = result.rows[0];
      if (command) await client.query("update public.device_command_outbox set locked_at=now(), locked_by=$2 where command_id=$1", [command.command_id, this.config.MQTT_CLIENT_ID]);
      await client.query("commit");
    } catch (error) { await client.query("rollback"); throw error; }
    finally { client.release(); }
    if (!command) return;

    const payload = relayCommandPayloadSchema.parse({ schemaVersion: 1, commandId: command.command_id, deviceId: command.device_id, type: "SET_RELAY", requestedState: command.desired_relay_state, issuedAt: command.requested_at.toISOString(), expiresAt: command.expires_at.toISOString() });
    await new Promise<void>((resolve, reject) => this.mqtt.publish(deviceTopic(command.device_id, "commands"), JSON.stringify(payload), { qos: 1, retain: false }, (error) => error ? reject(error) : resolve()));
    const publishClient = await this.pool.connect();
    try {
      await publishClient.query("begin");
      await publishClient.query(
        "update public.device_commands set status='SENT', sent_at=now(), attempt_count=attempt_count+1 where id=$1 and status='PENDING'",
        [command.command_id]
      );
      await publishClient.query(
        "update public.device_command_outbox set published_at=now(), locked_at=null, locked_by=null where command_id=$1",
        [command.command_id]
      );
      await publishClient.query("commit");
    } catch (error) {
      await publishClient.query("rollback");
      throw error;
    } finally {
      publishClient.release();
    }
  }

  private async timeoutExpired() {
    await this.pool.query("update public.device_commands set status='TIMED_OUT', failure_code='ACK_TIMEOUT' where status in ('PENDING','SENT') and expires_at < now()");
  }

  private async runMaintenance() {
    await this.pool.query(`
      update public.device_states
      set connection_status='OFFLINE'
      where connection_status <> 'OFFLINE'
        and (last_seen_at is null or last_seen_at < now() - interval '45 seconds')
    `);
    for (const [bucketSize, truncation, lookback] of [
      ["MINUTE", "minute", "3 hours"],
      ["HOUR", "hour", "3 days"],
      ["DAY", "day", "45 days"]
    ] as const) {
      await this.pool.query(`
        with ordered as (
          select device_id, server_received_at, power_w, voltage_v, energy_kwh,
            lag(energy_kwh) over (partition by device_id order by server_received_at) as previous_energy
          from public.telemetry_readings
          where server_received_at >= now() - $1::interval
        ), grouped as (
          select device_id, date_trunc($2, server_received_at) as bucket_start,
            count(*)::integer as sample_count,
            sum(case when previous_energy is not null and energy_kwh >= previous_energy
              then energy_kwh - previous_energy else 0 end) as consumed_kwh,
            avg(power_w) as average_power_w, max(power_w) as peak_power_w,
            min(voltage_v) as minimum_voltage_v, max(voltage_v) as maximum_voltage_v
          from ordered group by device_id, date_trunc($2, server_received_at)
        )
        insert into public.energy_aggregates
          (device_id,bucket_size,bucket_start,sample_count,energy_kwh,average_power_w,peak_power_w,minimum_voltage_v,maximum_voltage_v)
        select device_id,$3::public.energy_bucket_size,bucket_start,sample_count,
          consumed_kwh,average_power_w,peak_power_w,minimum_voltage_v,maximum_voltage_v
        from grouped
        on conflict (device_id,bucket_size,bucket_start) do update set
          sample_count=excluded.sample_count, energy_kwh=excluded.energy_kwh,
          average_power_w=excluded.average_power_w, peak_power_w=excluded.peak_power_w,
          minimum_voltage_v=excluded.minimum_voltage_v,
          maximum_voltage_v=excluded.maximum_voltage_v, calculated_at=now()
      `, [lookback, truncation, bucketSize]);
    }
  }

  private async executeDueSchedule() {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const result = await client.query<DueSchedule>(`
        select id, device_id, created_by, kind, desired_relay_state,
          timezone, local_time::text, weekdays, next_run_at
        from public.device_schedules
        where enabled=true and next_run_at <= now()
        order by next_run_at
        for update skip locked limit 1
      `);
      const schedule = result.rows[0];
      if (!schedule) { await client.query("commit"); return; }

      const execution = await client.query<{ id: string }>(`
        insert into public.schedule_executions (schedule_id, scheduled_for)
        values ($1,$2) on conflict (schedule_id, scheduled_for) do nothing
        returning id
      `, [schedule.id, schedule.next_run_at]);

      if (execution.rows[0]) {
        const idempotencyKey = `schedule:${schedule.id}:${schedule.next_run_at.toISOString()}`;
        const command = await client.query<{ id: string }>(`
          insert into public.device_commands
            (device_id, requested_by, desired_relay_state, idempotency_key, expires_at)
          values ($1,$2,$3,$4,now()+interval '30 seconds') returning id
        `, [schedule.device_id, schedule.created_by, schedule.desired_relay_state, idempotencyKey]);
        const commandId = command.rows[0]?.id;
        if (!commandId) throw new Error("Schedule command was not created");
        await client.query("insert into public.device_command_outbox(command_id) values ($1)", [commandId]);
        await client.query("update public.schedule_executions set status='COMMAND_CREATED', command_id=$2, completed_at=now() where id=$1", [execution.rows[0].id, commandId]);
      }

      if (schedule.kind === "ONCE") {
        await client.query("update public.device_schedules set enabled=false, last_run_at=$2, next_run_at=null where id=$1", [schedule.id, schedule.next_run_at]);
      } else {
        if (!schedule.local_time) throw new Error("Repeating schedule is missing local_time");
        const nextRun = nextRepeatingRun({ localTime: schedule.local_time.slice(0, 5), weekdays: schedule.weekdays, timezone: schedule.timezone }, new Date(Math.max(Date.now(), schedule.next_run_at.getTime())));
        await client.query("update public.device_schedules set last_run_at=$2, next_run_at=$3 where id=$1", [schedule.id, schedule.next_run_at, nextRun]);
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  private log(level: "info" | "warn" | "error", event: string, details: Record<string, unknown> = {}) {
    process.stdout.write(`${JSON.stringify({ level, event, service: "iot-worker", timestamp: new Date().toISOString(), ...details })}\n`);
  }
}
