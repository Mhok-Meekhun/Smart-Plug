export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      device_command_outbox: {
        Row: {
          available_at: string
          command_id: string
          created_at: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          published_at: string | null
        }
        Insert: {
          available_at?: string
          command_id: string
          created_at?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          published_at?: string | null
        }
        Update: {
          available_at?: string
          command_id?: string
          created_at?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          published_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_command_outbox_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: true
            referencedRelation: "device_commands"
            referencedColumns: ["id"]
          },
        ]
      }
      device_commands: {
        Row: {
          acknowledged_at: string | null
          acknowledgement_payload: Json | null
          attempt_count: number
          desired_relay_state: boolean
          device_id: string
          expires_at: string
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          requested_at: string
          requested_by: string
          sent_at: string | null
          status: Database["public"]["Enums"]["device_command_status"]
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledgement_payload?: Json | null
          attempt_count?: number
          desired_relay_state: boolean
          device_id: string
          expires_at: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key: string
          requested_at?: string
          requested_by: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["device_command_status"]
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledgement_payload?: Json | null
          attempt_count?: number
          desired_relay_state?: boolean
          device_id?: string
          expires_at?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          requested_at?: string
          requested_by?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["device_command_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_commands_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_commands_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_credentials: {
        Row: {
          activated_at: string | null
          credential_id: string
          device_id: string
          expires_at: string | null
          id: string
          issued_at: string
          issued_by: string | null
          last_used_at: string | null
          revoked_at: string | null
          rotated_from_id: string | null
          secret_hash: string
          status: Database["public"]["Enums"]["device_credential_status"]
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          credential_id: string
          device_id: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          rotated_from_id?: string | null
          secret_hash: string
          status?: Database["public"]["Enums"]["device_credential_status"]
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          credential_id?: string
          device_id?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          rotated_from_id?: string | null
          secret_hash?: string
          status?: Database["public"]["Enums"]["device_credential_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_credentials_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_credentials_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_credentials_rotated_from_id_fkey"
            columns: ["rotated_from_id"]
            isOneToOne: false
            referencedRelation: "device_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      device_pairing_tokens: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          created_by: string | null
          device_id: string | null
          expires_at: string
          firmware_version: string | null
          hardware_id: string
          id: string
          is_virtual: boolean
          revoked_at: string | null
          status: Database["public"]["Enums"]["device_pairing_status"]
          token_hash: string
          updated_at: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          expires_at: string
          firmware_version?: string | null
          hardware_id: string
          id?: string
          is_virtual?: boolean
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["device_pairing_status"]
          token_hash: string
          updated_at?: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          expires_at?: string
          firmware_version?: string | null
          hardware_id?: string
          id?: string
          is_virtual?: boolean
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["device_pairing_status"]
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_pairing_tokens_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_pairing_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_pairing_tokens_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: true
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_provisioning_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          device_id: string | null
          home_id: string | null
          id: number
          metadata: Json
          outcome: string
          pairing_token_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          device_id?: string | null
          home_id?: string | null
          id?: never
          metadata?: Json
          outcome: string
          pairing_token_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          device_id?: string | null
          home_id?: string | null
          id?: never
          metadata?: Json
          outcome?: string
          pairing_token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_provisioning_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_provisioning_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_provisioning_events_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_provisioning_events_pairing_token_id_fkey"
            columns: ["pairing_token_id"]
            isOneToOne: false
            referencedRelation: "device_pairing_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      device_schedules: {
        Row: {
          created_at: string
          created_by: string
          desired_relay_state: boolean
          device_id: string
          enabled: boolean
          execute_at: string | null
          id: string
          kind: Database["public"]["Enums"]["schedule_kind"]
          last_run_at: string | null
          local_time: string | null
          name: string
          next_run_at: string | null
          timezone: string
          updated_at: string
          weekdays: number[]
        }
        Insert: {
          created_at?: string
          created_by: string
          desired_relay_state: boolean
          device_id: string
          enabled?: boolean
          execute_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["schedule_kind"]
          last_run_at?: string | null
          local_time?: string | null
          name: string
          next_run_at?: string | null
          timezone?: string
          updated_at?: string
          weekdays?: number[]
        }
        Update: {
          created_at?: string
          created_by?: string
          desired_relay_state?: boolean
          device_id?: string
          enabled?: boolean
          execute_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["schedule_kind"]
          last_run_at?: string | null
          local_time?: string | null
          name?: string
          next_run_at?: string | null
          timezone?: string
          updated_at?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "device_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_schedules_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_states: {
        Row: {
          connection_status: Database["public"]["Enums"]["device_connection_status"]
          current_a: number | null
          device_id: string
          energy_kwh: number | null
          last_seen_at: string | null
          power_w: number | null
          relay_state: boolean
          sequence: number | null
          updated_at: string
          voltage_v: number | null
        }
        Insert: {
          connection_status?: Database["public"]["Enums"]["device_connection_status"]
          current_a?: number | null
          device_id: string
          energy_kwh?: number | null
          last_seen_at?: string | null
          power_w?: number | null
          relay_state?: boolean
          sequence?: number | null
          updated_at?: string
          voltage_v?: number | null
        }
        Update: {
          connection_status?: Database["public"]["Enums"]["device_connection_status"]
          current_a?: number | null
          device_id?: string
          energy_kwh?: number | null
          last_seen_at?: string | null
          power_w?: number | null
          relay_state?: boolean
          sequence?: number | null
          updated_at?: string
          voltage_v?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "device_states_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: true
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          firmware_version: string | null
          hardware_id: string
          home_id: string
          icon: string | null
          id: string
          lifecycle_status: Database["public"]["Enums"]["device_lifecycle_status"]
          name: string
          rated_current_a: number
          room_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          firmware_version?: string | null
          hardware_id: string
          home_id: string
          icon?: string | null
          id?: string
          lifecycle_status?: Database["public"]["Enums"]["device_lifecycle_status"]
          name: string
          rated_current_a?: number
          room_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          firmware_version?: string | null
          hardware_id?: string
          home_id?: string
          icon?: string | null
          id?: string
          lifecycle_status?: Database["public"]["Enums"]["device_lifecycle_status"]
          name?: string
          rated_current_a?: number
          room_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_room_home_consistency"
            columns: ["room_id", "home_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id", "home_id"]
          },
          {
            foreignKeyName: "devices_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      electricity_tariffs: {
        Row: {
          created_at: string
          currency: string
          effective_from: string
          effective_to: string | null
          flat_rate_per_kwh: number
          home_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          effective_from: string
          effective_to?: string | null
          flat_rate_per_kwh: number
          home_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          effective_from?: string
          effective_to?: string | null
          flat_rate_per_kwh?: number
          home_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "electricity_tariffs_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      energy_aggregates: {
        Row: {
          average_power_w: number
          bucket_size: Database["public"]["Enums"]["energy_bucket_size"]
          bucket_start: string
          calculated_at: string
          device_id: string
          energy_kwh: number
          maximum_voltage_v: number | null
          minimum_voltage_v: number | null
          peak_power_w: number
          sample_count: number
        }
        Insert: {
          average_power_w: number
          bucket_size: Database["public"]["Enums"]["energy_bucket_size"]
          bucket_start: string
          calculated_at?: string
          device_id: string
          energy_kwh: number
          maximum_voltage_v?: number | null
          minimum_voltage_v?: number | null
          peak_power_w: number
          sample_count: number
        }
        Update: {
          average_power_w?: number
          bucket_size?: Database["public"]["Enums"]["energy_bucket_size"]
          bucket_start?: string
          calculated_at?: string
          device_id?: string
          energy_kwh?: number
          maximum_voltage_v?: number | null
          minimum_voltage_v?: number | null
          peak_power_w?: number
          sample_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "energy_aggregates_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      home_members: {
        Row: {
          created_at: string
          home_id: string
          role: Database["public"]["Enums"]["home_member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          home_id: string
          role?: Database["public"]["Enums"]["home_member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          home_id?: string
          role?: Database["public"]["Enums"]["home_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_members_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      homes: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          id: string
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          name: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          locale: Database["public"]["Enums"]["app_locale"]
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          locale?: Database["public"]["Enums"]["app_locale"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["app_locale"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          created_at: string
          home_id: string
          icon: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          home_id: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          home_id?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_executions: {
        Row: {
          command_id: string | null
          completed_at: string | null
          created_at: string
          failure_message: string | null
          id: string
          schedule_id: string
          scheduled_for: string
          status: Database["public"]["Enums"]["schedule_execution_status"]
        }
        Insert: {
          command_id?: string | null
          completed_at?: string | null
          created_at?: string
          failure_message?: string | null
          id?: string
          schedule_id: string
          scheduled_for: string
          status?: Database["public"]["Enums"]["schedule_execution_status"]
        }
        Update: {
          command_id?: string | null
          completed_at?: string | null
          created_at?: string
          failure_message?: string | null
          id?: string
          schedule_id?: string
          scheduled_for?: string
          status?: Database["public"]["Enums"]["schedule_execution_status"]
        }
        Relationships: [
          {
            foreignKeyName: "schedule_executions_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "device_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_executions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "device_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry_readings: {
        Row: {
          current_a: number
          device_id: string
          device_timestamp: string
          energy_kwh: number
          frequency_hz: number | null
          id: number
          message_id: string
          power_factor: number | null
          power_w: number
          sequence: number
          server_received_at: string
          signal_strength_dbm: number | null
          voltage_v: number
        }
        Insert: {
          current_a: number
          device_id: string
          device_timestamp: string
          energy_kwh: number
          frequency_hz?: number | null
          id?: never
          message_id: string
          power_factor?: number | null
          power_w: number
          sequence: number
          server_received_at?: string
          signal_strength_dbm?: number | null
          voltage_v: number
        }
        Update: {
          current_a?: number
          device_id?: string
          device_timestamp?: string
          energy_kwh?: number
          frequency_hz?: number | null
          id?: never
          message_id?: string
          power_factor?: number | null
          power_w?: number
          sequence?: number
          server_received_at?: string
          signal_strength_dbm?: number | null
          voltage_v?: number
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_readings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_locale: "th" | "en"
      device_command_status:
        | "PENDING"
        | "SENT"
        | "ACKNOWLEDGED"
        | "FAILED"
        | "TIMED_OUT"
        | "CANCELLED"
      device_connection_status: "ONLINE" | "OFFLINE" | "CONNECTING" | "ERROR"
      device_credential_status: "STAGED" | "ACTIVE" | "REVOKED"
      device_lifecycle_status: "UNPAIRED" | "ACTIVE" | "DISABLED" | "REVOKED"
      device_pairing_status: "AVAILABLE" | "CLAIMED" | "REVOKED"
      energy_bucket_size: "MINUTE" | "HOUR" | "DAY"
      home_member_role: "OWNER" | "MEMBER"
      schedule_execution_status:
        | "PENDING"
        | "COMMAND_CREATED"
        | "FAILED"
        | "SKIPPED"
      schedule_kind: "ONCE" | "REPEATING"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_locale: ["th", "en"],
      device_command_status: [
        "PENDING",
        "SENT",
        "ACKNOWLEDGED",
        "FAILED",
        "TIMED_OUT",
        "CANCELLED",
      ],
      device_connection_status: ["ONLINE", "OFFLINE", "CONNECTING", "ERROR"],
      device_credential_status: ["STAGED", "ACTIVE", "REVOKED"],
      device_lifecycle_status: ["UNPAIRED", "ACTIVE", "DISABLED", "REVOKED"],
      device_pairing_status: ["AVAILABLE", "CLAIMED", "REVOKED"],
      energy_bucket_size: ["MINUTE", "HOUR", "DAY"],
      home_member_role: ["OWNER", "MEMBER"],
      schedule_execution_status: [
        "PENDING",
        "COMMAND_CREATED",
        "FAILED",
        "SKIPPED",
      ],
      schedule_kind: ["ONCE", "REPEATING"],
    },
  },
} as const

