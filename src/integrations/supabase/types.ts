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
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          language: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          language?: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          language?: string
          phone?: string | null
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
      is_order_courier: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
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
