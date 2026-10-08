export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_requests: {
        Row: {
          cost_usd_estimated: number;
          created_at: string;
          error_code: string | null;
          id: string;
          input_tokens: number | null;
          latency_ms: number;
          model: string;
          on_behalf_of_guest: boolean;
          operation: string;
          output_tokens: number | null;
          participant_id: string | null;
          payer_workspace_id: string;
          provider: string;
          room_id: string;
          success: boolean;
          units: number | null;
        };
        Insert: {
          cost_usd_estimated?: number;
          created_at?: string;
          error_code?: string | null;
          id?: string;
          input_tokens?: number | null;
          latency_ms: number;
          model: string;
          on_behalf_of_guest?: boolean;
          operation: string;
          output_tokens?: number | null;
          participant_id?: string | null;
          payer_workspace_id: string;
          provider: string;
          room_id: string;
          success: boolean;
          units?: number | null;
        };
        Update: {
          cost_usd_estimated?: number;
          created_at?: string;
          error_code?: string | null;
          id?: string;
          input_tokens?: number | null;
          latency_ms?: number;
          model?: string;
          on_behalf_of_guest?: boolean;
          operation?: string;
          output_tokens?: number | null;
          participant_id?: string | null;
          payer_workspace_id?: string;
          provider?: string;
          room_id?: string;
          success?: boolean;
          units?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_requests_participant_id_fkey';
            columns: ['participant_id'];
            isOneToOne: false;
            referencedRelation: 'room_participants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_requests_payer_workspace_id_fkey';
            columns: ['payer_workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_requests_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'rooms';
            referencedColumns: ['id'];
          },
        ];
      };
      credit_ledger: {
        Row: {
          ai_request_id: string | null;
          created_at: string;
          delta: number;
          id: string;
          reason: string;
          workspace_id: string;
        };
        Insert: {
          ai_request_id?: string | null;
          created_at?: string;
          delta: number;
          id?: string;
          reason: string;
          workspace_id: string;
        };
        Update: {
          ai_request_id?: string | null;
          created_at?: string;
          delta?: number;
          id?: string;
          reason?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'credit_ledger_ai_request_id_fkey';
            columns: ['ai_request_id'];
            isOneToOne: false;
            referencedRelation: 'ai_requests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'credit_ledger_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      gesture_lab_admins: {
        Row: { created_at: string; user_id: string };
        Insert: { created_at?: string; user_id: string };
        Update: { created_at?: string; user_id?: string };
        Relationships: [];
      };
      gesture_lab_presets: {
        Row: {
          author_id: string;
          author_name: string;
          created_at: string;
          id: string;
          name: string;
          settings: Json;
        };
        Insert: {
          author_id: string;
          author_name: string;
          created_at?: string;
          id?: string;
          name: string;
          settings: Json;
        };
        Update: {
          author_id?: string;
          author_name?: string;
          created_at?: string;
          id?: string;
          name?: string;
          settings?: Json;
        };
        Relationships: [];
      };
      gesture_recordings: {
        Row: {
          armed: boolean;
          author_id: string;
          author_name: string;
          created_at: string;
          description: string;
          expect: string | null;
          frames: Json;
          id: string;
          label: string;
        };
        Insert: {
          armed: boolean;
          author_id: string;
          author_name: string;
          created_at?: string;
          description?: string;
          expect?: string | null;
          frames: Json;
          id?: string;
          label: string;
        };
        Update: {
          armed?: boolean;
          author_id?: string;
          author_name?: string;
          created_at?: string;
          description?: string;
          expect?: string | null;
          frames?: Json;
          id?: string;
          label?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      room_participants: {
        Row: {
          display_name: string;
          duration_seconds: number | null;
          id: string;
          joined_at: string;
          language: string;
          left_at: string | null;
          role: string;
          room_id: string;
          user_id: string | null;
        };
        Insert: {
          display_name: string;
          duration_seconds?: number | null;
          id?: string;
          joined_at?: string;
          language: string;
          left_at?: string | null;
          role: string;
          room_id: string;
          user_id?: string | null;
        };
        Update: {
          display_name?: string;
          duration_seconds?: number | null;
          id?: string;
          joined_at?: string;
          language?: string;
          left_at?: string | null;
          role?: string;
          room_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'room_participants_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'rooms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'room_participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      rooms: {
        Row: {
          created_at: string;
          created_by: string;
          ended_at: string | null;
          ends_at: string | null;
          guest_credit_cap: number | null;
          id: string;
          join_code: string;
          planned_minutes: number;
          purged_at: string | null;
          started_at: string | null;
          status: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          ended_at?: string | null;
          ends_at?: string | null;
          guest_credit_cap?: number | null;
          id?: string;
          join_code: string;
          planned_minutes?: number;
          purged_at?: string | null;
          started_at?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          ended_at?: string | null;
          ends_at?: string | null;
          guest_credit_cap?: number | null;
          id?: string;
          join_code?: string;
          planned_minutes?: number;
          purged_at?: string | null;
          started_at?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'rooms_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'rooms_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspace_members: {
        Row: {
          created_at: string;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          role?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          role?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          credits_balance: number;
          id: string;
          logo_url: string | null;
          name: string;
          owner_id: string;
          plan: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          credits_balance?: number;
          id?: string;
          logo_url?: string | null;
          name: string;
          owner_id: string;
          plan?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          credits_balance?: number;
          id?: string;
          logo_url?: string | null;
          name?: string;
          owner_id?: string;
          plan?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspaces_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      ai_record_request: {
        Args: {
          p_charged: number;
          p_cost_usd: number;
          p_error_code: string;
          p_input_tokens: number;
          p_latency_ms: number;
          p_model: string;
          p_operation: string;
          p_output_tokens: number;
          p_participant: string;
          p_provider: string;
          p_reserved: number;
          p_room: string;
          p_success: boolean;
          p_workspace: string;
        };
        Returns: string;
      };
      ai_reserve_credits: {
        Args: { p_credits: number; p_workspace: string };
        Returns: boolean;
      };
      grant_credits: {
        Args: { p_credits: number; p_reason?: string; p_workspace: string };
        Returns: number;
      };
      is_gesture_lab_admin: { Args: never; Returns: boolean };
      is_workspace_member: { Args: { ws: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
