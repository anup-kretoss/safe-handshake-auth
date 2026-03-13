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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          product_id: string | null
          seller_id: string
          type: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          product_id?: string | null
          seller_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          product_id?: string | null
          seller_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_requests: {
        Row: {
          buyer_id: string
          created_at: string
          expires_at: string
          id: string
          order_id: string | null
          product_id: string
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          expires_at?: string
          id?: string
          order_id?: string | null
          product_id: string
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          order_id?: string | null
          product_id?: string
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          message_type: string
          offer_amount: number | null
          offer_status: string | null
          sender_id: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message_type?: string
          offer_amount?: number | null
          offer_status?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message_type?: string
          offer_amount?: number | null
          offer_status?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          buyer_id: string
          created_at: string
          delivery_price: number
          delivery_type: string
          id: string
          product_id: string
          seller_id: string
          shipping_address: Json
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          delivery_price?: number
          delivery_type?: string
          id?: string
          product_id: string
          seller_id: string
          shipping_address: Json
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          delivery_price?: number
          delivery_type?: string
          id?: string
          product_id?: string
          seller_id?: string
          shipping_address?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_otps: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          otp: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          otp: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          otp?: string
          verified?: boolean
        }
        Relationships: []
      }
      products: {
        Row: {
          brand: string | null
          category_id: string
          color: string | null
          condition: string | null
          created_at: string
          description: string | null
          id: string
          images: string[] | null
          is_sold: boolean
          location: string | null
          material: string | null
          pickup_address: Json | null
          price: number
          seller_id: string
          service_fee_percentage: number
          size: string | null
          sub_category_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category_id: string
          color?: string | null
          condition?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          is_sold?: boolean
          location?: string | null
          material?: string | null
          pickup_address?: Json | null
          price: number
          seller_id: string
          service_fee_percentage?: number
          size?: string | null
          sub_category_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category_id?: string
          color?: string | null
          condition?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          is_sold?: boolean
          location?: string | null
          material?: string | null
          pickup_address?: Json | null
          price?: number
          seller_id?: string
          service_fee_percentage?: number
          size?: string | null
          sub_category_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          country_code: string
          created_at: string
          date_of_birth: string
          email: string
          fcm_token: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string
          phone_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          country_code: string
          created_at?: string
          date_of_birth: string
          email: string
          fcm_token?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          phone_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          country_code?: string
          created_at?: string
          date_of_birth?: string
          email?: string
          fcm_token?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          phone_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sub_categories: {
        Row: {
          category_id: string
          created_at: string
          group_name: string | null
          id: string
          name: string
        }
        Insert: {
          category_id: string
          created_at?: string
          group_name?: string | null
          id?: string
          name: string
        }
        Update: {
          category_id?: string
          created_at?: string
          group_name?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
