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
      affiliates: {
        Row: {
          affiliate_link: string
          clicks: number | null
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          affiliate_link: string
          clicks?: number | null
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          affiliate_link?: string
          clicks?: number | null
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_blocks: {
        Row: {
          block_type: string
          config: Json
          created_at: string
          id: string
          is_active: boolean
          position: number
          product_id: string
        }
        Insert: {
          block_type: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          product_id: string
        }
        Update: {
          block_type?: string
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_blocks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_testimonials: {
        Row: {
          author_avatar_url: string | null
          author_name: string
          content: string
          created_at: string
          id: string
          is_active: boolean | null
          position: number | null
          product_id: string
          rating: number | null
        }
        Insert: {
          author_avatar_url?: string | null
          author_name: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          position?: number | null
          product_id: string
          rating?: number | null
        }
        Update: {
          author_avatar_url?: string | null
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          position?: number | null
          product_id?: string
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_testimonials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          affiliate_id: string
          amount: number
          created_at: string
          id: string
          sale_id: string
          status: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          created_at?: string
          id?: string
          sale_id: string
          status?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          created_at?: string
          id?: string
          sale_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          suggestion_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          suggestion_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          suggestion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "community_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      community_suggestions: {
        Row: {
          created_at: string
          description: string
          id: string
          reviewed_at: string | null
          status: string
          title: string
          user_id: string
          votes_count: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          reviewed_at?: string | null
          status?: string
          title: string
          user_id: string
          votes_count?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          reviewed_at?: string | null
          status?: string
          title?: string
          user_id?: string
          votes_count?: number
        }
        Relationships: []
      }
      community_votes: {
        Row: {
          created_at: string
          id: string
          suggestion_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          suggestion_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          suggestion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "community_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          producer_id: string
          uses: number | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          producer_id: string
          uses?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          producer_id?: string
          uses?: number | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      funnel_steps: {
        Row: {
          created_at: string
          description: string | null
          discount_percentage: number | null
          id: string
          is_active: boolean | null
          offer_product_id: string
          position: number | null
          product_id: string
          step_type: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          offer_product_id: string
          position?: number | null
          product_id: string
          step_type: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          offer_product_id?: string
          position?: number | null
          product_id?: string
          step_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_steps_offer_product_id_fkey"
            columns: ["offer_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_steps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          id: string
          lesson_id: string
          progress_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          lesson_id: string
          progress_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          lesson_id?: string
          progress_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_free: boolean | null
          module_id: string
          position: number | null
          title: string
          video_url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_free?: boolean | null
          module_id: string
          position?: number | null
          title: string
          video_url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_free?: boolean | null
          module_id?: string
          position?: number | null
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          position: number | null
          product_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          position?: number | null
          product_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          position?: number | null
          product_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_bumps: {
        Row: {
          bump_product_id: string
          created_at: string
          description: string | null
          discount_percentage: number | null
          id: string
          is_active: boolean | null
          product_id: string
          title: string
        }
        Insert: {
          bump_product_id: string
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          product_id: string
          title: string
        }
        Update: {
          bump_product_id?: string
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          product_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_bumps_bump_product_id_fkey"
            columns: ["bump_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_bumps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_payments: {
        Row: {
          affiliate_ref: string | null
          amount: number
          asaas_payment_id: string
          buyer_cpf: string | null
          buyer_email: string | null
          buyer_name: string | null
          created_at: string
          id: string
          product_id: string
          status: string
        }
        Insert: {
          affiliate_ref?: string | null
          amount: number
          asaas_payment_id: string
          buyer_cpf?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string
          id?: string
          product_id: string
          status?: string
        }
        Update: {
          affiliate_ref?: string | null
          amount?: number
          asaas_payment_id?: string
          buyer_cpf?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string
          id?: string
          product_id?: string
          status?: string
        }
        Relationships: []
      }
      platform_banners: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          position: number
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          position?: number
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          position?: number
          title?: string
        }
        Relationships: []
      }
      platform_popups: {
        Row: {
          button_text: string | null
          button_url: string | null
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          show_once: boolean
          title: string
        }
        Insert: {
          button_text?: string | null
          button_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          show_once?: boolean
          title: string
        }
        Update: {
          button_text?: string | null
          button_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          show_once?: boolean
          title?: string
        }
        Relationships: []
      }
      product_access: {
        Row: {
          buyer_email: string | null
          granted_at: string
          id: string
          product_id: string
          sale_id: string | null
          user_id: string | null
        }
        Insert: {
          buyer_email?: string | null
          granted_at?: string
          id?: string
          product_id: string
          sale_id?: string | null
          user_id?: string | null
        }
        Update: {
          buyer_email?: string | null
          granted_at?: string
          id?: string
          product_id?: string
          sale_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_access_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_access_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pixels: {
        Row: {
          access_token: string | null
          config: Json
          created_at: string
          id: string
          is_active: boolean
          pixel_id: string
          platform: string
          product_id: string
        }
        Insert: {
          access_token?: string | null
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          pixel_id: string
          platform: string
          product_id: string
        }
        Update: {
          access_token?: string | null
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          pixel_id?: string
          platform?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_pixels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          affiliate_commission: number | null
          allow_affiliates: boolean
          checkout_banner_url: string | null
          checkout_headline: string | null
          checkout_theme: string
          checkout_timer_minutes: number | null
          cover_url: string | null
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          is_published: boolean | null
          price: number
          producer_id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          affiliate_commission?: number | null
          allow_affiliates?: boolean
          checkout_banner_url?: string | null
          checkout_headline?: string | null
          checkout_theme?: string
          checkout_timer_minutes?: number | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          is_published?: boolean | null
          price?: number
          producer_id: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          affiliate_commission?: number | null
          allow_affiliates?: boolean
          checkout_banner_url?: string | null
          checkout_headline?: string | null
          checkout_theme?: string
          checkout_timer_minutes?: number | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          is_published?: boolean | null
          price?: number
          producer_id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string | null
          already_sells: boolean | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          current_platform: string | null
          custom_fee_fixed: number | null
          custom_fee_percentage: number | null
          display_name: string | null
          id: string
          monthly_revenue: string | null
          onboarding_completed: boolean | null
          referral_source: string | null
          terms_accepted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string | null
          already_sells?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_platform?: string | null
          custom_fee_fixed?: number | null
          custom_fee_percentage?: number | null
          display_name?: string | null
          id?: string
          monthly_revenue?: string | null
          onboarding_completed?: boolean | null
          referral_source?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string | null
          already_sells?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_platform?: string | null
          custom_fee_fixed?: number | null
          custom_fee_percentage?: number | null
          display_name?: string | null
          id?: string
          monthly_revenue?: string | null
          onboarding_completed?: boolean | null
          referral_source?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_notifications_log: {
        Row: {
          body: string | null
          created_at: string
          id: string
          sent_by: string
          sent_count: number | null
          title: string
          total_devices: number | null
          url: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          sent_by: string
          sent_count?: number | null
          title: string
          total_devices?: number | null
          url?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          sent_by?: string
          sent_count?: number | null
          title?: string
          total_devices?: number | null
          url?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          affiliate_id: string | null
          amount: number
          buyer_id: string | null
          created_at: string
          id: string
          payment_id: string | null
          payment_provider: string | null
          platform_fee: number | null
          producer_id: string | null
          product_id: string | null
          status: string
        }
        Insert: {
          affiliate_id?: string | null
          amount: number
          buyer_id?: string | null
          created_at?: string
          id?: string
          payment_id?: string | null
          payment_provider?: string | null
          platform_fee?: number | null
          producer_id?: string | null
          product_id?: string | null
          status?: string
        }
        Update: {
          affiliate_id?: string | null
          amount?: number
          buyer_id?: string | null
          created_at?: string
          id?: string
          payment_id?: string | null
          payment_provider?: string | null
          platform_fee?: number | null
          producer_id?: string | null
          product_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          balance_type: string
          category: string
          created_at: string
          id: string
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_type?: string
          category: string
          created_at?: string
          id?: string
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_type?: string
          category?: string
          created_at?: string
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          id: string
          paid_at: string | null
          pix_key: string | null
          pix_key_type: string | null
          processed_at: string | null
          status: string
          transfer_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          paid_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          processed_at?: string | null
          status?: string
          transfer_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          processed_at?: string | null
          status?: string
          transfer_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "producer" | "buyer"
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
      app_role: ["admin", "producer", "buyer"],
    },
  },
} as const
