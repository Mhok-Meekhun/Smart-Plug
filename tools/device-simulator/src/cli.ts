import { availabilityPayloadSchema, deviceTopic, relayCommandPayloadSchema } from "@smart-home/contracts";
import mqtt from "mqtt";
import { z } from "zod";
import { SmartPlugSimulator } from "./simulator.js";

const config=z.object({SIM_DEVICE_ID:z.string().uuid(),SIM_SEED:z.coerce.number().int().default(42),SIM_PUBLISH_SECONDS:z.coerce.number().int().min(1).max(300).default(5),SIM_ACTIVE_POWER_W:z.coerce.number().positive().max(25_000).default(65),MQTT_URL:z.string().regex(/^mqtts?:\/\//).default("mqtt://localhost:1883"),MQTT_USERNAME:z.string().min(1),MQTT_PASSWORD:z.string().min(1)}).parse(process.env);
const simulator=new SmartPlugSimulator({deviceId:config.SIM_DEVICE_ID,seed:config.SIM_SEED,activePowerW:config.SIM_ACTIVE_POWER_W});
const availabilityTopic=deviceTopic(config.SIM_DEVICE_ID,"availability");
const lwt=availabilityPayloadSchema.parse({schemaVersion:1,messageId:"sim_lwt_offline",deviceId:config.SIM_DEVICE_ID,deviceTimestamp:new Date().toISOString(),online:false,reason:"LWT",firmwareVersion:simulator.firmwareVersion});
const client=mqtt.connect(config.MQTT_URL,{username:config.MQTT_USERNAME,password:config.MQTT_PASSWORD,clientId:`sim-${config.SIM_DEVICE_ID}`,clean:false,reconnectPeriod:1_000,will:{topic:availabilityTopic,payload:JSON.stringify(lwt),qos:1,retain:true}});

client.on("connect",()=>{
  client.subscribe(deviceTopic(config.SIM_DEVICE_ID,"commands"),{qos:1});
  client.publish(availabilityTopic,JSON.stringify(simulator.connect(new Date())),{qos:1,retain:true});
  client.publish(deviceTopic(config.SIM_DEVICE_ID,"state"),JSON.stringify(simulator.state(new Date())),{qos:1,retain:true});
});
client.on("message",(_topic,bytes)=>{
  try{
    const command=relayCommandPayloadSchema.parse(JSON.parse(bytes.toString("utf8")));
    const acknowledgement=simulator.receiveCommand(command,new Date());
    client.publish(deviceTopic(config.SIM_DEVICE_ID,"acks"),JSON.stringify(acknowledgement),{qos:1,retain:false});
    client.publish(deviceTopic(config.SIM_DEVICE_ID,"state"),JSON.stringify(simulator.state(new Date())),{qos:1,retain:true});
  }catch(error){process.stderr.write(`${error instanceof Error?error.message:"Invalid command"}\n`);}
});

const timer=setInterval(()=>{
  const now=new Date();
  client.publish(deviceTopic(config.SIM_DEVICE_ID,"telemetry"),JSON.stringify(simulator.tick(config.SIM_PUBLISH_SECONDS,now)),{qos:0,retain:false});
  client.publish(availabilityTopic,JSON.stringify(simulator.heartbeat(now)),{qos:1,retain:true});
},config.SIM_PUBLISH_SECONDS*1_000);

process.on("SIGUSR2",()=>client.publish(deviceTopic(config.SIM_DEVICE_ID,"state"),JSON.stringify(simulator.manualToggle(new Date())),{qos:1,retain:true}));
const shutdown=()=>{clearInterval(timer);client.publish(availabilityTopic,JSON.stringify(simulator.disconnect(new Date())),{qos:1,retain:true},()=>client.end(false,{},()=>process.exit(0)));};
process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);
