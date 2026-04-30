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
      chit_groups: {
        Row: {
          agreement_no: string | null
          auction_day: number
          auction_time: string | null
          chit_value: number
          commission_rate: number
          created_at: string
          duration_months: number
          group_code: string
          id: string
          start_month: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agreement_no?: string | null
          auction_day: number
          auction_time?: string | null
          chit_value: number
          commission_rate?: number
          created_at?: string
          duration_months: number
          group_code: string
          id?: string
          start_month?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agreement_no?: string | null
          auction_day?: number
          auction_time?: string | null
          chit_value?: number
          commission_rate?: number
          created_at?: string
          duration_months?: number
          group_code?: string
          id?: string
          start_month?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      dispatch_log: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          last_error: string | null
          month: string
          sent_at: string | null
          statement_image_path: string | null
          status: string
          subscriber_id: string
          whatsapp_number: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          month: string
          sent_at?: string | null
          statement_image_path?: string | null
          status?: string
          subscriber_id: string
          whatsapp_number: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          month?: string
          sent_at?: string | null
          statement_image_path?: string | null
          status?: string
          subscriber_id?: string
          whatsapp_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_log_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      member_dues: {
        Row: {
          base_installment: number
          chit_amount_due: number
          created_at: string
          id: string
          manual_override: boolean
          monthly_entry_id: string
          previous_bid: number | null
          share_of_discount: number
          subscription_id: string
        }
        Insert: {
          base_installment: number
          chit_amount_due: number
          created_at?: string
          id?: string
          manual_override?: boolean
          monthly_entry_id: string
          previous_bid?: number | null
          share_of_discount?: number
          subscription_id: string
        }
        Update: {
          base_installment?: number
          chit_amount_due?: number
          created_at?: string
          id?: string
          manual_override?: boolean
          monthly_entry_id?: string
          previous_bid?: number | null
          share_of_discount?: number
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_dues_monthly_entry_id_fkey"
            columns: ["monthly_entry_id"]
            isOneToOne: false
            referencedRelation: "monthly_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_dues_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_entries: {
        Row: {
          company_commission: number
          created_at: string
          entered_by: string | null
          group_id: string
          id: string
          locked: boolean
          month: string
          prized_subscription_id: string | null
          winning_bid: number
        }
        Insert: {
          company_commission: number
          created_at?: string
          entered_by?: string | null
          group_id: string
          id?: string
          locked?: boolean
          month: string
          prized_subscription_id?: string | null
          winning_bid: number
        }
        Update: {
          company_commission?: number
          created_at?: string
          entered_by?: string | null
          group_id?: string
          id?: string
          locked?: boolean
          month?: string
          prized_subscription_id?: string | null
          winning_bid?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_entries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chit_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_entries_prized_subscription_id_fkey"
            columns: ["prized_subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          access_code: string
          active: boolean
          address_line1: string | null
          address_line2: string | null
          alt_number: string | null
          city: string
          created_at: string
          id: string
          name: string
          pincode: string | null
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          access_code: string
          active?: boolean
          address_line1?: string | null
          address_line2?: string | null
          alt_number?: string | null
          city?: string
          created_at?: string
          id?: string
          name: string
          pincode?: string | null
          updated_at?: string
          whatsapp_number: string
        }
        Update: {
          access_code?: string
          active?: boolean
          address_line1?: string | null
          address_line2?: string | null
          alt_number?: string | null
          city?: string
          created_at?: string
          id?: string
          name?: string
          pincode?: string | null
          updated_at?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          active: boolean
          created_at: string
          group_id: string
          id: string
          name_on_chit: string
          prized: boolean
          prized_month: string | null
          seat_count: number
          subscriber_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          group_id: string
          id?: string
          name_on_chit: string
          prized?: boolean
          prized_month?: string | null
          seat_count?: number
          subscriber_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          group_id?: string
          id?: string
          name_on_chit?: string
          prized?: boolean
          prized_month?: string | null
          seat_count?: number
          subscriber_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chit_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "operator"
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
      app_role: ["admin", "operator"],
    },
  },
} as const
