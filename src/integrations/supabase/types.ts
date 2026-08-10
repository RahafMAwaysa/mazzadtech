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
      conversations: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          messages: Json
          request_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          messages?: Json
          request_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          messages?: Json
          request_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_companies: {
        Row: {
          active: boolean
          alias: string
          city: string | null
          company_name: string
          completed_deliveries: number
          created_at: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          alias?: string
          city?: string | null
          company_name: string
          completed_deliveries?: number
          created_at?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          alias?: string
          city?: string | null
          company_name?: string
          completed_deliveries?: number
          created_at?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          benefits: string | null
          brand: string | null
          created_at: string
          delivery_days: number
          id: string
          image_url: string | null
          images: Json
          match_reasons: Json
          match_score: number | null
          model: string | null
          price: number
          product_name: string
          request_id: string
          specs: Json
          status: Database["public"]["Enums"]["offer_status"]
          supplier_id: string
          warranty_months: number
          video_url: string | null
        }
        Insert: {
          benefits?: string | null
          brand?: string | null
          created_at?: string
          delivery_days?: number
          id?: string
          image_url?: string | null
          images?: Json
          match_reasons?: Json
          match_score?: number | null
          model?: string | null
          price: number
          product_name: string
          request_id: string
          specs?: Json
          status?: Database["public"]["Enums"]["offer_status"]
          supplier_id: string
          warranty_months?: number
          video_url?: string | null
        }
        Update: {
          benefits?: string | null
          brand?: string | null
          created_at?: string
          delivery_days?: number
          id?: string
          image_url?: string | null
          images?: Json
          match_reasons?: Json
          match_score?: number | null
          model?: string | null
          price?: number
          product_name?: string
          request_id?: string
          specs?: Json
          status?: Database["public"]["Enums"]["offer_status"]
          supplier_id?: string
          warranty_months?: number
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          created_at: string
          id: string
          note: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          commission: number
          customer_commission: number
          delivery_fee: number
          delivery_location_id: string | null
          payment_card_id: string | null
          created_at: string
          customer_id: string
          delivery_company_id: string | null
          id: string
          offer_id: string
          order_number: string
          payment_method: string
          payment_status: string
          request_id: string
          status: Database["public"]["Enums"]["order_status"]
          supplier_id: string
        }
        Insert: {
          amount: number
          commission?: number
          customer_commission?: number
          delivery_fee?: number
          delivery_location_id?: string | null
          payment_card_id?: string | null
          created_at?: string
          customer_id: string
          delivery_company_id?: string | null
          id?: string
          offer_id: string
          order_number?: string
          payment_method: string
          payment_status?: string
          request_id: string
          status?: Database["public"]["Enums"]["order_status"]
          supplier_id: string
        }
        Update: {
          amount?: number
          commission?: number
          customer_commission?: number
          delivery_fee?: number
          delivery_location_id?: string | null
          payment_card_id?: string | null
          created_at?: string
          customer_id?: string
          delivery_company_id?: string | null
          id?: string
          offer_id?: string
          order_number?: string
          payment_method?: string
          payment_status?: string
          request_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_delivery_company_id_fkey"
            columns: ["delivery_company_id"]
            isOneToOne: false
            referencedRelation: "delivery_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_card_id_fkey"
            columns: ["payment_card_id"]
            isOneToOne: false
            referencedRelation: "payment_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_location_id_fkey"
            columns: ["delivery_location_id"]
            isOneToOne: false
            referencedRelation: "delivery_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_locations: {
        Row: {
          id: string
          user_id: string
          label: string
          address: string
          city: string | null
          phone: string | null
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          label: string
          address: string
          city?: string | null
          phone?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          label?: string
          address?: string
          city?: string | null
          phone?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          language: string
          phone: string | null
          suspended: boolean
          suspension_reason: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          language?: string
          phone?: string | null
          suspended?: boolean
          suspension_reason?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          language?: string
          phone?: string | null
          suspended?: boolean
          suspension_reason?: string | null
        }
        Relationships: []
      }
      purchase_requests: {
        Row: {
          bidding_ends_at: string
          brands: string[]
          budget_max: number | null
          budget_min: number | null
          category: string
          created_at: string
          currency: string
          customer_id: string
          delivery_preference: string | null
          id: string
          notes: string | null
          purpose: string | null
          specs: Json
          status: Database["public"]["Enums"]["request_status"]
          title: string
          warranty_preference: string | null
        }
        Insert: {
          bidding_ends_at?: string
          brands?: string[]
          budget_max?: number | null
          budget_min?: number | null
          category: string
          created_at?: string
          currency?: string
          customer_id: string
          delivery_preference?: string | null
          id?: string
          notes?: string | null
          purpose?: string | null
          specs?: Json
          status?: Database["public"]["Enums"]["request_status"]
          title: string
          warranty_preference?: string | null
        }
        Update: {
          bidding_ends_at?: string
          brands?: string[]
          budget_max?: number | null
          budget_min?: number | null
          category?: string
          created_at?: string
          currency?: string
          customer_id?: string
          delivery_preference?: string | null
          id?: string
          notes?: string | null
          purpose?: string | null
          specs?: Json
          status?: Database["public"]["Enums"]["request_status"]
          title?: string
          warranty_preference?: string | null
        }
        Relationships: []
      }
      supplier_profiles: {
        Row: {
          alias: string
          categories: string[]
          city: string | null
          company_name: string
          completed_orders: number
          created_at: string
          id: string
          rating: number
          response_rate: number
          user_id: string
          verified: boolean
          verification_status: string
          verification_note: string | null
        }
        Insert: {
          alias?: string
          categories?: string[]
          city?: string | null
          company_name: string
          completed_orders?: number
          created_at?: string
          id?: string
          rating?: number
          response_rate?: number
          user_id: string
          verified?: boolean
          verification_status?: string
          verification_note?: string | null
        }
        Update: {
          alias?: string
          categories?: string[]
          city?: string | null
          company_name?: string
          completed_orders?: number
          created_at?: string
          id?: string
          rating?: number
          response_rate?: number
          user_id?: string
          verified?: boolean
          verification_status?: string
          verification_note?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: boolean
          default_supplier_commission_pct: number
          default_customer_commission_pct: number
          default_delivery_commission_pct: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          default_supplier_commission_pct?: number
          default_customer_commission_pct?: number
          default_delivery_commission_pct?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          default_supplier_commission_pct?: number
          default_customer_commission_pct?: number
          default_delivery_commission_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          name: string
          name_ar: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          name_ar?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          name_ar?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_cards: {
        Row: {
          id: string
          customer_id: string
          brand: string
          last4: string
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          brand?: string
          last4: string
          is_default?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          brand?: string
          last4?: string
          is_default?: boolean
          created_at?: string
        }
        Relationships: []
      }
      disputes: {
        Row: {
          id: string
          order_id: string
          filed_by: string
          filed_by_role: string
          category: string
          description: string
          status: string
          resolution_action: string | null
          resolution_note: string | null
          resolved_by: string | null
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          order_id: string
          filed_by: string
          filed_by_role: string
          category: string
          description: string
          status?: string
          resolution_action?: string | null
          resolution_note?: string | null
          resolved_by?: string | null
          created_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          filed_by?: string
          filed_by_role?: string
          category?: string
          description?: string
          status?: string
          resolution_action?: string | null
          resolution_note?: string | null
          resolved_by?: string | null
          created_at?: string
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          id: string
          order_id: string
          rater_id: string
          ratee_id: string
          rater_role: string
          stars: number
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          rater_id: string
          ratee_id: string
          rater_role: string
          stars: number
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          rater_id?: string
          ratee_id?: string
          rater_role?: string
          stars?: number
          comment?: string | null
          created_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          id: string
          supplier_id: string
          title: string
          params: Json
          content: Json
          created_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          title: string
          params?: Json
          content?: Json
          created_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string
          title?: string
          params?: Json
          content?: Json
          created_at?: string
        }
        Relationships: []
      }
      transaction_contracts: {
        Row: {
          id: string
          order_id: string
          payload: Json
          hash: string
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          payload: Json
          hash: string
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          payload?: Json
          hash?: string
          created_at?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          id: string
          supplier_id: string
          balance: number
          updated_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          balance?: number
          updated_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string
          balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          id: string
          wallet_id: string
          order_id: string | null
          type: string
          amount: number
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          wallet_id: string
          order_id?: string | null
          type: string
          amount: number
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          wallet_id?: string
          order_id?: string | null
          type?: string
          amount?: number
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      is_courier_for_person: {
        Args: { _person_id: string; _user_id: string }
        Returns: boolean
      }
      is_order_courier: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      get_commission_rates: {
        Args: { _category?: string }
        Returns: { supplier_pct: number; customer_pct: number; delivery_pct: number }[]
      }
      credit_supplier_wallet: {
        Args: { _supplier_id: string; _amount: number; _order_id: string }
        Returns: undefined
      }
      withdraw_from_wallet: {
        Args: { _amount: number }
        Returns: undefined
      }
      resolve_dispute: {
        Args: { _dispute_id: string; _action: string; _note: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "customer" | "supplier" | "admin" | "delivery"
      offer_status: "submitted" | "accepted" | "rejected"
      order_status:
        | "confirmed"
        | "preparing"
        | "verified"
        | "shipping"
        | "delivered"
        | "cancelled"
        | "received_from_supplier"
        | "in_transit"
      request_status: "draft" | "open" | "awarded" | "closed"
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
      app_role: ["customer", "supplier", "admin", "delivery"],
      offer_status: ["submitted", "accepted", "rejected"],
      order_status: [
        "confirmed",
        "preparing",
        "verified",
        "shipping",
        "delivered",
        "cancelled",
        "received_from_supplier",
        "in_transit",
      ],
      request_status: ["draft", "open", "awarded", "closed"],
    },
  },
} as const
