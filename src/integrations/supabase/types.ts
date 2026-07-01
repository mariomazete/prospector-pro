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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          address: string | null
          ai_summary: string | null
          attack_plan: Json | null
          category: string | null
          city: string | null
          conversion_chance: number | null
          country: string | null
          created_at: string
          email: string | null
          facebook: string | null
          first_seen_at: string
          hours: Json | null
          id: string
          instagram: string | null
          last_updated_at: string
          lat: number | null
          linkedin: string | null
          lng: number | null
          maps_url: string | null
          name: string
          open_now: boolean | null
          opportunity_score: number | null
          phone: string | null
          photos: Json
          pitches: Json | null
          place_id: string
          rating: number | null
          reviews: Json
          reviews_count: number | null
          search_appearances: number
          state: string | null
          subcategory: string | null
          temperature: string | null
          updated_at: string
          utc_offset_minutes: number | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          ai_summary?: string | null
          attack_plan?: Json | null
          category?: string | null
          city?: string | null
          conversion_chance?: number | null
          country?: string | null
          created_at?: string
          email?: string | null
          facebook?: string | null
          first_seen_at?: string
          hours?: Json | null
          id?: string
          instagram?: string | null
          last_updated_at?: string
          lat?: number | null
          linkedin?: string | null
          lng?: number | null
          maps_url?: string | null
          name: string
          open_now?: boolean | null
          opportunity_score?: number | null
          phone?: string | null
          photos?: Json
          pitches?: Json | null
          place_id: string
          rating?: number | null
          reviews?: Json
          reviews_count?: number | null
          search_appearances?: number
          state?: string | null
          subcategory?: string | null
          temperature?: string | null
          updated_at?: string
          utc_offset_minutes?: number | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          ai_summary?: string | null
          attack_plan?: Json | null
          category?: string | null
          city?: string | null
          conversion_chance?: number | null
          country?: string | null
          created_at?: string
          email?: string | null
          facebook?: string | null
          first_seen_at?: string
          hours?: Json | null
          id?: string
          instagram?: string | null
          last_updated_at?: string
          lat?: number | null
          linkedin?: string | null
          lng?: number | null
          maps_url?: string | null
          name?: string
          open_now?: boolean | null
          opportunity_score?: number | null
          phone?: string | null
          photos?: Json
          pitches?: Json | null
          place_id?: string
          rating?: number | null
          reviews?: Json
          reviews_count?: number | null
          search_appearances?: number
          state?: string | null
          subcategory?: string | null
          temperature?: string | null
          updated_at?: string
          utc_offset_minutes?: number | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      company_events: {
        Row: {
          company_id: string
          content: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["timeline_kind"]
          meta: Json | null
          user_id: string
        }
        Insert: {
          company_id: string
          content?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["timeline_kind"]
          meta?: Json | null
          user_id: string
        }
        Update: {
          company_id?: string
          content?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["timeline_kind"]
          meta?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_searches: {
        Row: {
          city: string | null
          company_id: string
          country: string
          found_at: string
          id: string
          niche: string
          user_id: string | null
        }
        Insert: {
          city?: string | null
          company_id: string
          country: string
          found_at?: string
          id?: string
          niche: string
          user_id?: string | null
        }
        Update: {
          city?: string | null
          company_id?: string
          country?: string
          found_at?: string
          id?: string
          niche?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_searches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      prospector_cache: {
        Row: {
          cache_key: string
          city: string
          country: string
          created_at: string
          expires_at: string
          id: string
          niche: string
          payload: Json
        }
        Insert: {
          cache_key: string
          city: string
          country: string
          created_at?: string
          expires_at?: string
          id?: string
          niche: string
          payload: Json
        }
        Update: {
          cache_key?: string
          city?: string
          country?: string
          created_at?: string
          expires_at?: string
          id?: string
          niche?: string
          payload?: Json
        }
        Relationships: []
      }
      user_company_state: {
        Row: {
          company_id: string
          created_at: string
          favorite: boolean
          id: string
          in_pipeline: boolean
          next_followup_at: string | null
          notes: string | null
          pipeline_added_at: string | null
          status: Database["public"]["Enums"]["company_status"]
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          favorite?: boolean
          id?: string
          in_pipeline?: boolean
          next_followup_at?: string | null
          notes?: string | null
          pipeline_added_at?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          favorite?: boolean
          id?: string
          in_pipeline?: boolean
          next_followup_at?: string | null
          notes?: string | null
          pipeline_added_at?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_state_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      company_status:
        | "never_prospected"
        | "prospecting"
        | "contacted"
        | "replied"
        | "meeting"
        | "proposal"
        | "negotiating"
        | "client"
        | "lost"
        | "archived"
      timeline_kind:
        | "note"
        | "status_change"
        | "followup"
        | "call"
        | "email"
        | "whatsapp"
        | "meeting"
        | "pitch"
        | "discovery"
        | "update"
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
      company_status: [
        "never_prospected",
        "prospecting",
        "contacted",
        "replied",
        "meeting",
        "proposal",
        "negotiating",
        "client",
        "lost",
        "archived",
      ],
      timeline_kind: [
        "note",
        "status_change",
        "followup",
        "call",
        "email",
        "whatsapp",
        "meeting",
        "pitch",
        "discovery",
        "update",
      ],
    },
  },
} as const
