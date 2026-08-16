import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

export class RealtimePublisher {
  private readonly client: SupabaseClient;
  private readonly channels = new Map<string, RealtimeChannel>();

  constructor(url: string, secretKey: string) {
    this.client = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }

  async publish(homeId: string, event: string, payload: Record<string, unknown>) {
    const topic = `home:${homeId}`;
    let channel = this.channels.get(topic);
    if (!channel) {
      channel = this.client.channel(topic, { config: { private: true } });
      await channel.subscribe();
      this.channels.set(topic, channel);
    }
    await channel.send({ type: "broadcast", event, payload });
  }

  async close() {
    await Promise.all([...this.channels.values()].map((channel) => this.client.removeChannel(channel)));
  }
}
