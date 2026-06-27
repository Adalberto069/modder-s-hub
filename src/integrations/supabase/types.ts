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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_runs: {
        Row: {
          admins_notified: number
          details: Json
          id: string
          orphan_access_count: number
          ran_at: string
          source: string
          suspicious_bounties_count: number
          suspicious_purchases_count: number
          total_issues: number
        }
        Insert: {
          admins_notified?: number
          details?: Json
          id?: string
          orphan_access_count?: number
          ran_at?: string
          source?: string
          suspicious_bounties_count?: number
          suspicious_purchases_count?: number
          total_issues?: number
        }
        Update: {
          admins_notified?: number
          details?: Json
          id?: string
          orphan_access_count?: number
          ran_at?: string
          source?: string
          suspicious_bounties_count?: number
          suspicious_purchases_count?: number
          total_issues?: number
        }
        Relationships: []
      }
      badge_definitions: {
        Row: {
          category: string
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          category?: string
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      bounties: {
        Row: {
          assigned_modder_id: string | null
          category_id: string | null
          completed_at: string | null
          created_at: string
          deadline: string | null
          description: string
          game_name: string | null
          id: string
          requester_id: string
          reward_amount: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_modder_id?: string | null
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description: string
          game_name?: string | null
          id?: string
          requester_id: string
          reward_amount?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_modder_id?: string | null
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string
          game_name?: string | null
          id?: string
          requester_id?: string
          reward_amount?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounties_assigned_modder_id_fkey"
            columns: ["assigned_modder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bounties_assigned_modder_id_fkey"
            columns: ["assigned_modder_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bounties_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bounties_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bounties_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["user_id"]
          },
        ]
      }
      bounty_applications: {
        Row: {
          bounty_id: string
          created_at: string
          id: string
          message: string
          modder_id: string
          status: string
        }
        Insert: {
          bounty_id: string
          created_at?: string
          id?: string
          message: string
          modder_id: string
          status?: string
        }
        Update: {
          bounty_id?: string
          created_at?: string
          id?: string
          message?: string
          modder_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounty_applications_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "bounties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bounty_applications_modder_id_fkey"
            columns: ["modder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bounty_applications_modder_id_fkey"
            columns: ["modder_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["user_id"]
          },
        ]
      }
      bounty_deliveries: {
        Row: {
          bounty_id: string
          delivered_at: string
          dispute_reason: string | null
          dispute_resolved: boolean
          dispute_resolved_by: string | null
          disputed: boolean
          file_name: string
          file_url: string
          id: string
          modder_id: string
          released: boolean
          released_at: string | null
          test_approved: boolean
        }
        Insert: {
          bounty_id: string
          delivered_at?: string
          dispute_reason?: string | null
          dispute_resolved?: boolean
          dispute_resolved_by?: string | null
          disputed?: boolean
          file_name: string
          file_url: string
          id?: string
          modder_id: string
          released?: boolean
          released_at?: string | null
          test_approved?: boolean
        }
        Update: {
          bounty_id?: string
          delivered_at?: string
          dispute_reason?: string | null
          dispute_resolved?: boolean
          dispute_resolved_by?: string | null
          disputed?: boolean
          file_name?: string
          file_url?: string
          id?: string
          modder_id?: string
          released?: boolean
          released_at?: string | null
          test_approved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "bounty_deliveries_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "bounties"
            referencedColumns: ["id"]
          },
        ]
      }
      bounty_messages: {
        Row: {
          bounty_id: string
          content: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          bounty_id: string
          content: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          bounty_id?: string
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounty_messages_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "bounties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bounty_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bounty_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["user_id"]
          },
        ]
      }
      bounty_purchases: {
        Row: {
          amount: number
          base_amount: number
          bounty_id: string
          commission_rate: number
          created_at: string
          fee: number
          id: string
          modder_earnings: number
          modder_id: string
          payer_id: string
          payment_id: string | null
          payment_method: string | null
          platform_commission: number
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          base_amount?: number
          bounty_id: string
          commission_rate?: number
          created_at?: string
          fee?: number
          id?: string
          modder_earnings?: number
          modder_id: string
          payer_id: string
          payment_id?: string | null
          payment_method?: string | null
          platform_commission?: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          base_amount?: number
          bounty_id?: string
          commission_rate?: number
          created_at?: string
          fee?: number
          id?: string
          modder_earnings?: number
          modder_id?: string
          payer_id?: string
          payment_id?: string | null
          payment_method?: string | null
          platform_commission?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounty_purchases_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "bounties"
            referencedColumns: ["id"]
          },
        ]
      }
      bounty_test_logs: {
        Row: {
          bounty_id: string
          created_at: string
          delivery_id: string
          id: string
          ip_address: string | null
          user_id: string
        }
        Insert: {
          bounty_id: string
          created_at?: string
          delivery_id: string
          id?: string
          ip_address?: string | null
          user_id: string
        }
        Update: {
          bounty_id?: string
          created_at?: string
          delivery_id?: string
          id?: string
          ip_address?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounty_test_logs_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "bounties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bounty_test_logs_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "bounty_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      forum_posts: {
        Row: {
          category: string
          code_content: string | null
          content: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          code_content?: string | null
          content: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          code_content?: string | null
          content?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      forum_replies: {
        Row: {
          code_content: string | null
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          code_content?: string | null
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          code_content?: string | null
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_reply_likes: {
        Row: {
          created_at: string
          id: string
          reply_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reply_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reply_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_reply_likes_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "forum_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      modder_mp_accounts: {
        Row: {
          connected_at: string
          id: string
          mp_access_token: string
          mp_public_key: string | null
          mp_refresh_token: string
          mp_token_expires_at: string | null
          mp_user_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_at?: string
          id?: string
          mp_access_token: string
          mp_public_key?: string | null
          mp_refresh_token: string
          mp_token_expires_at?: string | null
          mp_user_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_at?: string
          id?: string
          mp_access_token?: string
          mp_public_key?: string | null
          mp_refresh_token?: string
          mp_token_expires_at?: string | null
          mp_user_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      moderation_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          moderator_id: string
          new_status: string | null
          previous_status: string | null
          script_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          moderator_id: string
          new_status?: string | null
          previous_status?: string | null
          script_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          moderator_id?: string
          new_status?: string | null
          previous_status?: string | null
          script_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_logs_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          recipient_id: string
          script_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          recipient_id: string
          script_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          recipient_id?: string
          script_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_messages_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          reputation_score: number
          total_downloads: number
          total_positive_reviews: number
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          reputation_score?: number
          total_downloads?: number
          total_positive_reviews?: number
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          reputation_score?: number
          total_downloads?: number
          total_positive_reviews?: number
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reported_user_id: string | null
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          script_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          script_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          script_id?: string | null
          status?: string
        }
        Relationships: []
      }
      script_access: {
        Row: {
          id: string
          script_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          id?: string
          script_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          id?: string
          script_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_access_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      script_analyses: {
        Row: {
          analyzed_by: string
          classification: string
          created_at: string
          functionality: string | null
          id: string
          reviewed: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          script_id: string
          security_score: number
          summary: string | null
          threats: Json
        }
        Insert: {
          analyzed_by: string
          classification?: string
          created_at?: string
          functionality?: string | null
          id?: string
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          script_id: string
          security_score?: number
          summary?: string | null
          threats?: Json
        }
        Update: {
          analyzed_by?: string
          classification?: string
          created_at?: string
          functionality?: string | null
          id?: string
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          script_id?: string
          security_score?: number
          summary?: string | null
          threats?: Json
        }
        Relationships: [
          {
            foreignKeyName: "script_analyses_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      script_favorites: {
        Row: {
          created_at: string
          id: string
          script_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          script_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          script_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      script_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          script_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          script_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          script_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "script_images_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      script_licenses: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          license_key: string
          purchase_id: string
          script_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          license_key: string
          purchase_id: string
          script_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          license_key?: string
          purchase_id?: string
          script_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "licenses_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "script_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licenses_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      script_passwords: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_permanent: boolean
          password_hash: string | null
          script_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_permanent?: boolean
          password_hash?: string | null
          script_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_permanent?: boolean
          password_hash?: string | null
          script_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_passwords_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: true
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      script_purchases: {
        Row: {
          amount: number
          commission_rate: number
          created_at: string
          id: string
          modder_earnings: number
          payment_id: string | null
          payment_method: string | null
          platform_commission: number
          script_id: string
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          commission_rate?: number
          created_at?: string
          id?: string
          modder_earnings?: number
          payment_id?: string | null
          payment_method?: string | null
          platform_commission?: number
          script_id: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          commission_rate?: number
          created_at?: string
          id?: string
          modder_earnings?: number
          payment_id?: string | null
          payment_method?: string | null
          platform_commission?: number
          script_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      script_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          script_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          script_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          script_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      script_test_logs: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          script_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          script_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          script_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_test_logs_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          average_rating: number
          category_id: string | null
          code_hash: string | null
          created_at: string
          description: string | null
          download_count: number
          external_link: string | null
          features: string[] | null
          file_url: string | null
          game_name: string | null
          id: string
          is_active: boolean
          is_paid: boolean
          is_verified: boolean
          license_duration_days: number | null
          modder_id: string
          price: number | null
          publish_status: string
          related_tutorial_id: string | null
          script_type: string
          security_status: string
          status: Database["public"]["Enums"]["script_status"]
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          total_ratings: number
          updated_at: string
          version: string | null
          video_url: string | null
        }
        Insert: {
          average_rating?: number
          category_id?: string | null
          code_hash?: string | null
          created_at?: string
          description?: string | null
          download_count?: number
          external_link?: string | null
          features?: string[] | null
          file_url?: string | null
          game_name?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          is_verified?: boolean
          license_duration_days?: number | null
          modder_id: string
          price?: number | null
          publish_status?: string
          related_tutorial_id?: string | null
          script_type?: string
          security_status?: string
          status?: Database["public"]["Enums"]["script_status"]
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          total_ratings?: number
          updated_at?: string
          version?: string | null
          video_url?: string | null
        }
        Update: {
          average_rating?: number
          category_id?: string | null
          code_hash?: string | null
          created_at?: string
          description?: string | null
          download_count?: number
          external_link?: string | null
          features?: string[] | null
          file_url?: string | null
          game_name?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          is_verified?: boolean
          license_duration_days?: number | null
          modder_id?: string
          price?: number | null
          publish_status?: string
          related_tutorial_id?: string | null
          script_type?: string
          security_status?: string
          status?: Database["public"]["Enums"]["script_status"]
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          total_ratings?: number
          updated_at?: string
          version?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scripts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_related_tutorial_id_fkey"
            columns: ["related_tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      tools: {
        Row: {
          category: string
          created_at: string
          description: string | null
          download_url: string | null
          external_url: string | null
          icon: string | null
          id: string
          name: string
          platform: string
          sort_order: number
          tags: string[] | null
          tutorial_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          download_url?: string | null
          external_url?: string | null
          icon?: string | null
          id?: string
          name: string
          platform?: string
          sort_order?: number
          tags?: string[] | null
          tutorial_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          download_url?: string | null
          external_url?: string | null
          icon?: string | null
          id?: string
          name?: string
          platform?: string
          sort_order?: number
          tags?: string[] | null
          tutorial_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorial_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          tutorial_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          tutorial_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          tutorial_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_comments_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorial_ratings: {
        Row: {
          created_at: string
          id: string
          rating: number
          tutorial_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating: number
          tutorial_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rating?: number
          tutorial_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_ratings_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorials: {
        Row: {
          author_id: string
          category: string
          content: string | null
          created_at: string
          description: string | null
          id: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          author_id: string
          category?: string
          content?: string | null
          created_at?: string
          description?: string | null
          id?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          author_id?: string
          category?: string
          content?: string | null
          created_at?: string
          description?: string | null
          id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badge_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          approved: boolean
          approved_at: string | null
          id: string
          requested_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          id?: string
          requested_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          id?: string
          requested_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_roles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          reputation_score: number | null
          total_downloads: number | null
          total_positive_reviews: number | null
          updated_at: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          reputation_score?: number | null
          total_downloads?: number | null
          total_positive_reviews?: number | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          reputation_score?: number | null
          total_downloads?: number | null
          total_positive_reviews?: number | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_assign_badge: {
        Args: { _badge_slug: string; _user_id: string }
        Returns: undefined
      }
      generate_license_key: { Args: never; Returns: string }
      get_my_email: { Args: never; Returns: string }
      get_script_file_url: { Args: { _script_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_modder: { Args: { _user_id: string }; Returns: boolean }
      purge_old_read_moderation_messages: { Args: never; Returns: number }
      script_has_purchases: { Args: { _script_id: string }; Returns: boolean }
      validate_script_password: {
        Args: { _password: string; _script_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "modder" | "admin"
      script_status: "working" | "detected" | "updating"
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
      app_role: ["user", "modder", "admin"],
      script_status: ["working", "detected", "updating"],
    },
  },
} as const
