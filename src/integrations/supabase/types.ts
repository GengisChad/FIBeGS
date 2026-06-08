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
      achievements: {
        Row: {
          badge_id: string | null
          bonus_points: number
          condition_meta: Json
          condition_type: string
          condition_value: number
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          badge_id?: string | null
          bonus_points?: number
          condition_meta?: Json
          condition_type: string
          condition_value?: number
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          badge_id?: string | null
          bonus_points?: number
          condition_meta?: Json
          condition_type?: string
          condition_value?: number
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "achievements_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          recipients_count: number
          sent_by: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          recipients_count?: number
          sent_by: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          recipients_count?: number
          sent_by?: string
          title?: string
        }
        Relationships: []
      }
      app_releases: {
        Row: {
          active: boolean
          bundle_url: string
          checksum: string
          created_at: string
          id: string
          mandatory: boolean
          min_native_version: string
          platform: string
          release_notes: string | null
          updated_at: string
          version: string
        }
        Insert: {
          active?: boolean
          bundle_url: string
          checksum: string
          created_at?: string
          id?: string
          mandatory?: boolean
          min_native_version?: string
          platform?: string
          release_notes?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          active?: boolean
          bundle_url?: string
          checksum?: string
          created_at?: string
          id?: string
          mandatory?: boolean
          min_native_version?: string
          platform?: string
          release_notes?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      battlepass_scores: {
        Row: {
          created_at: string
          id: string
          launch_speed: number
          recorded_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          launch_speed: number
          recorded_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          launch_speed?: number
          recorded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      beta_elo_matches: {
        Row: {
          created_at: string
          delta: number
          id: string
          opponent_id: string
          opponent_rating_before: number
          played_at: string
          player_id: string
          rating_after: number
          rating_before: number
          result: string
          source_match_id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          opponent_id: string
          opponent_rating_before: number
          played_at?: string
          player_id: string
          rating_after: number
          rating_before: number
          result: string
          source_match_id: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          opponent_id?: string
          opponent_rating_before?: number
          played_at?: string
          player_id?: string
          rating_after?: number
          rating_before?: number
          result?: string
          source_match_id?: string
          tournament_id?: string
        }
        Relationships: []
      }
      beta_elo_ratings: {
        Row: {
          created_at: string
          draws: number
          last_match_at: string | null
          losses: number
          matches_played: number
          peak_rating: number
          rating: number
          tier_key: string
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          created_at?: string
          draws?: number
          last_match_at?: string | null
          losses?: number
          matches_played?: number
          peak_rating?: number
          rating?: number
          tier_key?: string
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          created_at?: string
          draws?: number
          last_match_at?: string | null
          losses?: number
          matches_played?: number
          peak_rating?: number
          rating?: number
          tier_key?: string
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: []
      }
      beta_elo_tiers: {
        Row: {
          color_hex: string
          created_at: string
          glow_hex: string
          id: string
          key: string
          max_rating: number | null
          min_rating: number
          name: string
          sort_order: number
        }
        Insert: {
          color_hex: string
          created_at?: string
          glow_hex: string
          id?: string
          key: string
          max_rating?: number | null
          min_rating: number
          name: string
          sort_order: number
        }
        Update: {
          color_hex?: string
          created_at?: string
          glow_hex?: string
          id?: string
          key?: string
          max_rating?: number | null
          min_rating?: number
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      championship_managers: {
        Row: {
          championship_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          championship_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          championship_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "championship_managers_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
        ]
      }
      championship_referees: {
        Row: {
          added_by: string | null
          championship_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          championship_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          championship_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "championship_referees_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
        ]
      }
      championship_sponsors: {
        Row: {
          championship_id: string
          created_at: string
          id: string
          link_url: string | null
          logo_url: string
          name: string
          sort_order: number
        }
        Insert: {
          championship_id: string
          created_at?: string
          id?: string
          link_url?: string | null
          logo_url: string
          name: string
          sort_order?: number
        }
        Update: {
          championship_id?: string
          created_at?: string
          id?: string
          link_url?: string | null
          logo_url?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "championship_sponsors_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
        ]
      }
      championships: {
        Row: {
          banner_url: string | null
          club_required: boolean
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          primary_color: string | null
          rules_text: string | null
          secondary_color: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          club_required?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          primary_color?: string | null
          rules_text?: string | null
          secondary_color?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          club_required?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          rules_text?: string | null
          secondary_color?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      changelog_entries: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string
          id: string
          scope: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          description: string
          id?: string
          scope?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          scope?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "changelog_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      child_profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          display_name: string
          id: string
          parent_user_id: string
          points: number
          points_monthly: number
          region_id: string | null
          updated_at: string
          wins: number
          wins_monthly: number
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          display_name: string
          id?: string
          parent_user_id: string
          points?: number
          points_monthly?: number
          region_id?: string | null
          updated_at?: string
          wins?: number
          wins_monthly?: number
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          display_name?: string
          id?: string
          parent_user_id?: string
          points?: number
          points_monthly?: number
          region_id?: string | null
          updated_at?: string
          wins?: number
          wins_monthly?: number
        }
        Relationships: [
          {
            foreignKeyName: "child_profiles_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      club_follows: {
        Row: {
          club_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_follows_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      club_free_play_exceptions: {
        Row: {
          created_at: string
          created_by: string | null
          end_time: string | null
          exception_date: string
          exception_type: string
          id: string
          note: string | null
          schedule_id: string
          start_time: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          exception_date: string
          exception_type: string
          id?: string
          note?: string | null
          schedule_id: string
          start_time?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          exception_date?: string
          exception_type?: string
          id?: string
          note?: string | null
          schedule_id?: string
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_free_play_exceptions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "club_free_play_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      club_free_play_schedules: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          start_time: string
          title: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          venue_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          start_time: string
          title?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          venue_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
          title?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_free_play_schedules_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_free_play_schedules_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "club_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      club_links: {
        Row: {
          created_at: string
          id: string
          requested_by: string
          requester_club_id: string
          responded_by: string | null
          status: string
          target_club_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          requested_by: string
          requester_club_id: string
          responded_by?: string | null
          status?: string
          target_club_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          requested_by?: string
          requester_club_id?: string
          responded_by?: string | null
          status?: string
          target_club_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_links_requester_club_id_fkey"
            columns: ["requester_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_links_target_club_id_fkey"
            columns: ["target_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_member_phones: {
        Row: {
          club_id: string
          club_member_id: string
          created_at: string
          id: string
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          club_member_id: string
          created_at?: string
          id?: string
          phone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          club_member_id?: string
          created_at?: string
          id?: string
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_member_phones_club_member_id_fkey"
            columns: ["club_member_id"]
            isOneToOne: true
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_member_phones_club_member_id_fkey"
            columns: ["club_member_id"]
            isOneToOne: true
            referencedRelation: "club_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          city: string | null
          club_id: string
          id: string
          joined_at: string
          last_tournament_at: string | null
          role: Database["public"]["Enums"]["club_role"]
          user_id: string
        }
        Insert: {
          city?: string | null
          club_id: string
          id?: string
          joined_at?: string
          last_tournament_at?: string | null
          role?: Database["public"]["Enums"]["club_role"]
          user_id: string
        }
        Update: {
          city?: string | null
          club_id?: string
          id?: string
          joined_at?: string
          last_tournament_at?: string | null
          role?: Database["public"]["Enums"]["club_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members_delete_audit: {
        Row: {
          city: string | null
          club_id: string
          club_member_id: string
          delete_source: string
          deleted_at: string
          deleted_by: string | null
          id: number
          joined_at: string | null
          last_tournament_at: string | null
          role: string | null
          txid: number
          user_id: string
        }
        Insert: {
          city?: string | null
          club_id: string
          club_member_id: string
          delete_source?: string
          deleted_at?: string
          deleted_by?: string | null
          id?: never
          joined_at?: string | null
          last_tournament_at?: string | null
          role?: string | null
          txid?: number
          user_id: string
        }
        Update: {
          city?: string | null
          club_id?: string
          club_member_id?: string
          delete_source?: string
          deleted_at?: string
          deleted_by?: string | null
          id?: never
          joined_at?: string | null
          last_tournament_at?: string | null
          role?: string | null
          txid?: number
          user_id?: string
        }
        Relationships: []
      }
      club_members_recovery_applied: {
        Row: {
          applied_at: string
          batch_id: string
          club_id: string
          club_member_id: string
          confidence: string
          id: number
          user_id: string
        }
        Insert: {
          applied_at?: string
          batch_id: string
          club_id: string
          club_member_id: string
          confidence: string
          id?: never
          user_id: string
        }
        Update: {
          applied_at?: string
          batch_id?: string
          club_id?: string
          club_member_id?: string
          confidence?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      club_members_recovery_staging: {
        Row: {
          applied_at: string | null
          club_id: string
          confidence: string
          id: number
          last_tournament_at: string | null
          prepared_at: string
          tournaments_count_365d: number
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          club_id: string
          confidence: string
          id?: never
          last_tournament_at?: string | null
          prepared_at?: string
          tournaments_count_365d: number
          user_id: string
        }
        Update: {
          applied_at?: string | null
          club_id?: string
          confidence?: string
          id?: never
          last_tournament_at?: string | null
          prepared_at?: string
          tournaments_count_365d?: number
          user_id?: string
        }
        Relationships: []
      }
      club_messages: {
        Row: {
          club_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          sender_id: string
        }
        Insert: {
          club_id: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          club_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_messages_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_order_products: {
        Row: {
          added_by: string
          component_id: string
          created_at: string
          id: string
          is_shipped: boolean
          price: number
          quantity_available: number
          session_id: string
        }
        Insert: {
          added_by: string
          component_id: string
          created_at?: string
          id?: string
          is_shipped?: boolean
          price?: number
          quantity_available?: number
          session_id: string
        }
        Update: {
          added_by?: string
          component_id?: string
          created_at?: string
          id?: string
          is_shipped?: boolean
          price?: number
          quantity_available?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_order_products_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "collection_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_order_products_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "club_order_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      club_order_reservations: {
        Row: {
          created_at: string
          id: string
          is_cancelled: boolean
          is_paid: boolean
          is_picked_up: boolean
          order_product_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cancelled?: boolean
          is_paid?: boolean
          is_picked_up?: boolean
          order_product_id: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cancelled?: boolean
          is_paid?: boolean
          is_picked_up?: boolean
          order_product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_order_reservations_order_product_id_fkey"
            columns: ["order_product_id"]
            isOneToOne: false
            referencedRelation: "club_order_products"
            referencedColumns: ["id"]
          },
        ]
      }
      club_order_sessions: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          deadline: string | null
          id: string
          is_open: boolean
          title: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          deadline?: string | null
          id?: string
          is_open?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          deadline?: string | null
          id?: string
          is_open?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_order_sessions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_request_invites: {
        Row: {
          created_at: string
          id: string
          request_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          request_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_request_invites_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "club_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_request_invites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      club_requests: {
        Row: {
          address: string | null
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          city: string | null
          club_name: string
          created_at: string
          description: string | null
          id: string
          latitude: number | null
          longitude: number | null
          region_id: string | null
          special_reason: string | null
          status: Database["public"]["Enums"]["club_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          club_name: string
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          region_id?: string | null
          special_reason?: string | null
          status?: Database["public"]["Enums"]["club_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          club_name?: string
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          region_id?: string | null
          special_reason?: string | null
          status?: Database["public"]["Enums"]["club_request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_requests_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      club_venues: {
        Row: {
          address: string
          city: string
          club_id: string
          created_at: string
          id: string
          is_primary: boolean
          is_shop: boolean
          latitude: number | null
          longitude: number | null
          name: string
          primary_changed_at: string | null
          shop_description: string | null
          shop_email: string | null
          shop_facebook: string | null
          shop_hours: Json | null
          shop_instagram: string | null
          shop_logo_url: string | null
          shop_owner_user_id: string | null
          shop_phone: string | null
          shop_tiktok: string | null
          shop_website: string | null
          shop_whatsapp: string | null
        }
        Insert: {
          address: string
          city: string
          club_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          is_shop?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          primary_changed_at?: string | null
          shop_description?: string | null
          shop_email?: string | null
          shop_facebook?: string | null
          shop_hours?: Json | null
          shop_instagram?: string | null
          shop_logo_url?: string | null
          shop_owner_user_id?: string | null
          shop_phone?: string | null
          shop_tiktok?: string | null
          shop_website?: string | null
          shop_whatsapp?: string | null
        }
        Update: {
          address?: string
          city?: string
          club_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          is_shop?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          primary_changed_at?: string | null
          shop_description?: string | null
          shop_email?: string | null
          shop_facebook?: string | null
          shop_hours?: Json | null
          shop_instagram?: string | null
          shop_logo_url?: string | null
          shop_owner_user_id?: string | null
          shop_phone?: string | null
          shop_tiktok?: string | null
          shop_website?: string | null
          shop_whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_venues_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_venues_shop_owner_user_id_fkey"
            columns: ["shop_owner_user_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          banner_url: string | null
          city: string | null
          created_at: string
          default_paypal_link: string | null
          description: string | null
          id: string
          is_active: boolean
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          region_id: string | null
          social_discord: string | null
          social_facebook: string | null
          social_instagram: string | null
          social_tiktok: string | null
          social_whatsapp_channel: string | null
          social_whatsapp_group: string | null
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          city?: string | null
          created_at?: string
          default_paypal_link?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          region_id?: string | null
          social_discord?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_whatsapp_channel?: string | null
          social_whatsapp_group?: string | null
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          city?: string | null
          created_at?: string
          default_paypal_link?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          region_id?: string | null
          social_discord?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_whatsapp_channel?: string | null
          social_whatsapp_group?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_products_only: boolean
          name: string
          parent_id: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_products_only?: boolean
          name: string
          parent_id?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_products_only?: boolean
          name?: string
          parent_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "collection_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_component_links: {
        Row: {
          id: string
          linked_component_id: string
          parent_component_id: string
        }
        Insert: {
          id?: string
          linked_component_id: string
          parent_component_id: string
        }
        Update: {
          id?: string
          linked_component_id?: string
          parent_component_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_component_links_linked_component_id_fkey"
            columns: ["linked_component_id"]
            isOneToOne: false
            referencedRelation: "collection_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_component_links_parent_component_id_fkey"
            columns: ["parent_component_id"]
            isOneToOne: false
            referencedRelation: "collection_components"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_component_stats: {
        Row: {
          component_id: string
          created_at: string
          id: string
          stat_name: string
          stat_order: number
          stat_value: number
        }
        Insert: {
          component_id: string
          created_at?: string
          id?: string
          stat_name: string
          stat_order?: number
          stat_value?: number
        }
        Update: {
          component_id?: string
          created_at?: string
          id?: string
          stat_name?: string
          stat_order?: number
          stat_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_component_stats_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "collection_components"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_component_variants: {
        Row: {
          component_id: string
          created_at: string
          id: string
          image_url: string | null
          sort_order: number
          variant_name: string
        }
        Insert: {
          component_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          sort_order?: number
          variant_name: string
        }
        Update: {
          component_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          sort_order?: number
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_component_variants_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "collection_components"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_components: {
        Row: {
          category_id: string
          created_at: string
          id: string
          image_url: string | null
          is_infinite: boolean
          name: string
          recommended_price: number | null
          sort_order: number
          weight_max: number | null
          weight_min: number | null
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_infinite?: boolean
          name: string
          recommended_price?: number | null
          sort_order?: number
          weight_max?: number | null
          weight_min?: number | null
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_infinite?: boolean
          name?: string
          recommended_price?: number | null
          sort_order?: number
          weight_max?: number | null
          weight_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_components_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "collection_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_variant_links: {
        Row: {
          id: string
          linked_variant_id: string
          parent_variant_id: string
        }
        Insert: {
          id?: string
          linked_variant_id: string
          parent_variant_id: string
        }
        Update: {
          id?: string
          linked_variant_id?: string
          parent_variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_variant_links_linked_variant_id_fkey"
            columns: ["linked_variant_id"]
            isOneToOne: false
            referencedRelation: "collection_component_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_variant_links_parent_variant_id_fkey"
            columns: ["parent_variant_id"]
            isOneToOne: false
            referencedRelation: "collection_component_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_requests: {
        Row: {
          category: string
          created_at: string
          email: string
          id: string
          message: string
          name: string
          status: string
        }
        Insert: {
          category: string
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          status?: string
        }
        Update: {
          category?: string
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      credential_help_requests: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          matched_user_id: string | null
          message: string | null
          new_email: string
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          matched_user_id?: string | null
          message?: string | null
          new_email: string
          status?: string
          updated_at?: string
          username: string
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          matched_user_id?: string | null
          message?: string | null
          new_email?: string
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      deck_beyblade_components: {
        Row: {
          component_id: string
          component_type: string
          deck_beyblade_id: string
          id: string
          variant_id: string | null
        }
        Insert: {
          component_id: string
          component_type: string
          deck_beyblade_id: string
          id?: string
          variant_id?: string | null
        }
        Update: {
          component_id?: string
          component_type?: string
          deck_beyblade_id?: string
          id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deck_beyblade_components_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "collection_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_beyblade_components_deck_beyblade_id_fkey"
            columns: ["deck_beyblade_id"]
            isOneToOne: false
            referencedRelation: "deck_beyblades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_beyblade_components_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "collection_component_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_beyblades: {
        Row: {
          blade_type: string
          deck_id: string
          id: string
          position: number
          ratchet_type: string | null
        }
        Insert: {
          blade_type: string
          deck_id: string
          id?: string
          position: number
          ratchet_type?: string | null
        }
        Update: {
          blade_type?: string
          deck_id?: string
          id?: string
          position?: number
          ratchet_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deck_beyblades_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_likes: {
        Row: {
          created_at: string
          deck_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deck_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deck_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_likes_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_reports: {
        Row: {
          created_at: string
          deck_id: string
          id: string
          reason: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          deck_id: string
          id?: string
          reason: string
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          deck_id?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_reports_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_fingerprint_whitelist: {
        Row: {
          added_by: string | null
          created_at: string
          fingerprint_hash: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          fingerprint_hash: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          fingerprint_hash?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      device_fingerprints: {
        Row: {
          blocked: boolean
          fingerprint_hash: string
          first_seen_at: string
          first_user_id: string | null
          id: string
          last_seen_at: string
          platform: string | null
          seen_user_ids: string[]
          signup_attempts: number
          user_agent: string | null
        }
        Insert: {
          blocked?: boolean
          fingerprint_hash: string
          first_seen_at?: string
          first_user_id?: string | null
          id?: string
          last_seen_at?: string
          platform?: string | null
          seen_user_ids?: string[]
          signup_attempts?: number
          user_agent?: string | null
        }
        Update: {
          blocked?: boolean
          fingerprint_hash?: string
          first_seen_at?: string
          first_user_id?: string | null
          id?: string
          last_seen_at?: string
          platform?: string | null
          seen_user_ids?: string[]
          signup_attempts?: number
          user_agent?: string | null
        }
        Relationships: []
      }
      event_feedback_responses: {
        Row: {
          answers: Json
          created_at: string
          id: string
          submitted_at: string
          target_id: string
          target_type: string
          template_id: string | null
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          submitted_at?: string
          target_id: string
          target_type: string
          template_id?: string | null
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          submitted_at?: string
          target_id?: string
          target_type?: string
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_feedback_responses_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "event_feedback_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      event_feedback_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          scope: string
          steps: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          scope: string
          steps?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          scope?: string
          steps?: Json
          updated_at?: string
        }
        Relationships: []
      }
      event_participants: {
        Row: {
          created_at: string
          id: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      external_player_mappings: {
        Row: {
          created_at: string
          external_username: string
          id: string
          internal_user_id: string | null
          platform: string
          region_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_username: string
          id?: string
          internal_user_id?: string | null
          platform: string
          region_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_username?: string
          id?: string
          internal_user_id?: string | null
          platform?: string
          region_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_player_mappings_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_contact_categories: {
        Row: {
          created_at: string | null
          description: string | null
          email: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          email?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          email?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      faq_history_entries: {
        Row: {
          created_at: string | null
          description: string | null
          generation: string | null
          id: string
          image_url: string | null
          month: number | null
          sort_order: number | null
          title: string
          year: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          generation?: string | null
          id?: string
          image_url?: string | null
          month?: number | null
          sort_order?: number | null
          title: string
          year: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          generation?: string | null
          id?: string
          image_url?: string | null
          month?: number | null
          sort_order?: number | null
          title?: string
          year?: number
        }
        Relationships: []
      }
      faq_supporters: {
        Row: {
          avatar_url: string | null
          badge_id: string | null
          created_at: string | null
          display_name: string
          id: string
          is_active: boolean | null
          kofi_amount: number | null
          kofi_email: string | null
          kofi_message_id: string | null
          message: string | null
          sort_order: number | null
          tier: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          badge_id?: string | null
          created_at?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          kofi_amount?: number | null
          kofi_email?: string | null
          kofi_message_id?: string | null
          message?: string | null
          sort_order?: number | null
          tier?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          badge_id?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          kofi_amount?: number | null
          kofi_email?: string | null
          kofi_message_id?: string | null
          message?: string | null
          sort_order?: number | null
          tier?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faq_supporters_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          attachment_url: string | null
          created_at: string
          device_info: string | null
          id: string
          is_read: boolean
          message: string
          status: string
          user_id: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          device_info?: string | null
          id?: string
          is_read?: boolean
          message: string
          status?: string
          user_id: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          device_info?: string | null
          id?: string
          is_read?: boolean
          message?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback_replies: {
        Row: {
          created_at: string
          feedback_id: string
          id: string
          is_staff: boolean
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_id: string
          id?: string
          is_staff?: boolean
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_id?: string
          id?: string
          is_staff?: boolean
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_replies_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_posts: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_pinned: boolean | null
          likes_count: number | null
          replies_count: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_pinned?: boolean | null
          likes_count?: number | null
          replies_count?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_pinned?: boolean | null
          likes_count?: number | null
          replies_count?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_reply_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_reply_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_reply_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_parent_reply_id_fkey"
            columns: ["parent_reply_id"]
            isOneToOne: false
            referencedRelation: "forum_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_export"
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
      forum_reports: {
        Row: {
          created_at: string
          id: string
          post_id: string | null
          reason: string
          reply_id: string | null
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id?: string | null
          reason: string
          reply_id?: string | null
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string | null
          reason?: string
          reply_id?: string | null
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_reports_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "forum_replies"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_stickers: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          url?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          id: string
          requested_by: string
          status: string
          updated_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          requested_by: string
          status?: string
          updated_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          requested_by?: string
          status?: string
          updated_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      global_messages: {
        Row: {
          content: string
          created_at: string
          edited_at: string | null
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: []
      }
      imported_tournaments_staging: {
        Row: {
          city: string | null
          club_id: string | null
          created_at: string
          description: string | null
          event_date: string | null
          format: string | null
          id: string
          imported_by: string
          is_ranked: boolean
          location: string | null
          matches: Json
          participants: Json
          raw_data: Json
          region_id: string | null
          registration_deadline: string | null
          send_error: string | null
          sent_tournament_id: string | null
          source_platform: string
          standings: Json
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          club_id?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          format?: string | null
          id?: string
          imported_by: string
          is_ranked?: boolean
          location?: string | null
          matches?: Json
          participants?: Json
          raw_data?: Json
          region_id?: string | null
          registration_deadline?: string | null
          send_error?: string | null
          sent_tournament_id?: string | null
          source_platform: string
          standings?: Json
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          club_id?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          format?: string | null
          id?: string
          imported_by?: string
          is_ranked?: boolean
          location?: string | null
          matches?: Json
          participants?: Json
          raw_data?: Json
          region_id?: string | null
          registration_deadline?: string | null
          send_error?: string | null
          sent_tournament_id?: string | null
          source_platform?: string
          standings?: Json
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "imported_tournaments_staging_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_tournaments_staging_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_tournaments_staging_sent_tournament_id_fkey"
            columns: ["sent_tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      judge_course_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          course_id: string
          created_at: string
          current_step: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          course_id: string
          created_at?: string
          current_step?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          course_id?: string
          created_at?: string
          current_step?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "judge_course_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "judge_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      judge_course_quiz_answers: {
        Row: {
          attempts: number
          course_id: string
          created_at: string
          id: string
          is_correct: boolean
          selected_index: number | null
          step_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          course_id: string
          created_at?: string
          id?: string
          is_correct?: boolean
          selected_index?: number | null
          step_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          course_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          selected_index?: number | null
          step_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "judge_course_quiz_answers_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "judge_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judge_course_quiz_answers_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "judge_course_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      judge_course_steps: {
        Row: {
          content_html: string | null
          course_id: string
          created_at: string
          id: string
          media_url: string | null
          position: number
          quiz: Json | null
          step_type: string
          title: string | null
          updated_at: string
        }
        Insert: {
          content_html?: string | null
          course_id: string
          created_at?: string
          id?: string
          media_url?: string | null
          position?: number
          quiz?: Json | null
          step_type: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          content_html?: string | null
          course_id?: string
          created_at?: string
          id?: string
          media_url?: string | null
          position?: number
          quiz?: Json | null
          step_type?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "judge_course_steps_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "judge_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      judge_courses: {
        Row: {
          category: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_published: boolean
          position: number
          required_for_test: boolean
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          position?: number
          required_for_test?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          position?: number
          required_for_test?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_chat_closures: {
        Row: {
          chat_id: string
          closed_at: string
          id: string
          user_id: string
        }
        Insert: {
          chat_id: string
          closed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          closed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_chat_closures_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "market_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_chat_closures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      market_chats: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          listing_id: string | null
          seller_id: string
          updated_at: string
          wanted_id: string | null
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          listing_id?: string | null
          seller_id: string
          updated_at?: string
          wanted_id?: string | null
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          listing_id?: string | null
          seller_id?: string
          updated_at?: string
          wanted_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_chats_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_chats_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "market_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_chats_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_chats_wanted_id_fkey"
            columns: ["wanted_id"]
            isOneToOne: false
            referencedRelation: "market_wanted"
            referencedColumns: ["id"]
          },
        ]
      }
      market_likes: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_likes_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "market_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      market_listing_components: {
        Row: {
          component_id: string
          created_at: string
          id: string
          listing_id: string
        }
        Insert: {
          component_id: string
          created_at?: string
          id?: string
          listing_id: string
        }
        Update: {
          component_id?: string
          created_at?: string
          id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_listing_components_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "collection_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_listing_components_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "market_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      market_listings: {
        Row: {
          categories: string[]
          condition: string
          created_at: string
          free_shipping: boolean
          id: string
          image_url: string | null
          price: number | null
          product_name: string
          sale_link: string | null
          shipping_cost: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          categories?: string[]
          condition: string
          created_at?: string
          free_shipping?: boolean
          id?: string
          image_url?: string | null
          price?: number | null
          product_name: string
          sale_link?: string | null
          shipping_cost?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          categories?: string[]
          condition?: string
          created_at?: string
          free_shipping?: boolean
          id?: string
          image_url?: string | null
          price?: number | null
          product_name?: string
          sale_link?: string | null
          shipping_cost?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_listings_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      market_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "market_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      market_reports: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          reason: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          reason: string
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          reason?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_reports_user"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "market_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      market_wanted: {
        Row: {
          condition: string
          created_at: string
          id: string
          max_price: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          condition?: string
          created_at?: string
          id?: string
          max_price?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          condition?: string
          created_at?: string
          id?: string
          max_price?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_wanted_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      media_categories: {
        Row: {
          cover_url: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          type: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          type?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          type?: string
        }
        Relationships: []
      }
      media_chapters: {
        Row: {
          chapter_number: number
          created_at: string
          id: string
          pdf_url: string | null
          season_id: string
          sort_order: number
          title: string
        }
        Insert: {
          chapter_number?: number
          created_at?: string
          id?: string
          pdf_url?: string | null
          season_id: string
          sort_order?: number
          title: string
        }
        Update: {
          chapter_number?: number
          created_at?: string
          id?: string
          pdf_url?: string | null
          season_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_chapters_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "media_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      media_episodes: {
        Row: {
          created_at: string
          episode_number: number
          id: string
          is_youtube: boolean
          platform: string | null
          season_id: string
          sort_order: number
          streaming_links: Json | null
          title: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          episode_number?: number
          id?: string
          is_youtube?: boolean
          platform?: string | null
          season_id: string
          sort_order?: number
          streaming_links?: Json | null
          title: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          episode_number?: number
          id?: string
          is_youtube?: boolean
          platform?: string | null
          season_id?: string
          sort_order?: number
          streaming_links?: Json | null
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_episodes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "media_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      media_seasons: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          series_id: string
          sort_order: number
          title: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          series_id: string
          sort_order?: number
          title: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          series_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_seasons_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "media_series"
            referencedColumns: ["id"]
          },
        ]
      }
      media_series: {
        Row: {
          category_id: string
          cover_url: string | null
          created_at: string
          description: string | null
          episodes_count: number | null
          genre: string | null
          id: string
          sort_order: number
          title: string
          year: number | null
        }
        Insert: {
          category_id: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          episodes_count?: number | null
          genre?: string | null
          id?: string
          sort_order?: number
          title: string
          year?: number | null
        }
        Update: {
          category_id?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          episodes_count?: number | null
          genre?: string | null
          id?: string
          sort_order?: number
          title?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_series_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "media_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          badge_id: string | null
          bonus_points: number
          condition_meta: Json
          condition_type: string
          condition_value: number
          created_at: string
          description: string | null
          ends_at: string
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          period: string
          sort_order: number
          starts_at: string
        }
        Insert: {
          badge_id?: string | null
          bonus_points?: number
          condition_meta?: Json
          condition_type: string
          condition_value?: number
          created_at?: string
          description?: string | null
          ends_at: string
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          period?: string
          sort_order?: number
          starts_at: string
        }
        Update: {
          badge_id?: string | null
          bonus_points?: number
          condition_meta?: Json
          condition_type?: string
          condition_value?: number
          created_at?: string
          description?: string | null
          ends_at?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          period?: string
          sort_order?: number
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      municipalities: {
        Row: {
          created_at: string
          id: string
          name: string
          province: string
          province_code: string
          region_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          province: string
          province_code: string
          region_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          province?: string
          province_code?: string
          region_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipalities_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
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
          push_eligible: boolean
          push_sent: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          push_eligible?: boolean
          push_sent?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          push_eligible?: boolean
          push_sent?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_pkce_states: {
        Row: {
          child_profile_id: string | null
          code_verifier: string | null
          created_at: string
          expires_at: string
          platform: string
          redirect_uri: string
          state: string
          user_id: string
        }
        Insert: {
          child_profile_id?: string | null
          code_verifier?: string | null
          created_at?: string
          expires_at?: string
          platform: string
          redirect_uri: string
          state: string
          user_id: string
        }
        Update: {
          child_profile_id?: string | null
          code_verifier?: string | null
          created_at?: string
          expires_at?: string
          platform?: string
          redirect_uri?: string
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_pkce_states_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_role_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      passkey_challenges: {
        Row: {
          challenge: string
          created_at: string
          expires_at: string
          id: string
          type: string
          user_id: string | null
        }
        Insert: {
          challenge: string
          created_at?: string
          expires_at?: string
          id?: string
          type: string
          user_id?: string | null
        }
        Update: {
          challenge?: string
          created_at?: string
          expires_at?: string
          id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pending_tournament_results: {
        Row: {
          base_points: number
          created_at: string
          external_username: string
          id: string
          participants_count: number
          placement: number
          platform: string
          region_id: string | null
          scaled_points: number
          tournament_id: string
        }
        Insert: {
          base_points?: number
          created_at?: string
          external_username: string
          id?: string
          participants_count: number
          placement: number
          platform: string
          region_id?: string | null
          scaled_points?: number
          tournament_id: string
        }
        Update: {
          base_points?: number
          created_at?: string
          external_username?: string
          id?: string
          participants_count?: number
          placement?: number
          platform?: string
          region_id?: string | null
          scaled_points?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_tournament_results_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_tournament_results_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      private_chats: {
        Row: {
          closed_by_a: boolean
          closed_by_b: boolean
          created_at: string
          id: string
          last_message_at: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          closed_by_a?: boolean
          closed_by_b?: boolean
          created_at?: string
          id?: string
          last_message_at?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          closed_by_a?: boolean
          closed_by_b?: boolean
          created_at?: string
          id?: string
          last_message_at?: string | null
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      private_messages: {
        Row: {
          chat_id: string
          content_encrypted: string
          created_at: string
          edited_at: string | null
          id: string
          nonce: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          chat_id: string
          content_encrypted: string
          created_at?: string
          edited_at?: string | null
          id?: string
          nonce: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          chat_id?: string
          content_encrypted?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          nonce?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "private_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          best_launch_speed: number | null
          bio: string | null
          card_code: number
          city: string | null
          created_at: string
          display_name: string | null
          favorite_deck_id: string | null
          id: string
          last_seen_at: string | null
          points: number | null
          points_monthly: number
          public_key: string | null
          region_id: string | null
          updated_at: string
          user_id: string
          username: string | null
          wins: number | null
          wins_monthly: number
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          best_launch_speed?: number | null
          bio?: string | null
          card_code?: number
          city?: string | null
          created_at?: string
          display_name?: string | null
          favorite_deck_id?: string | null
          id?: string
          last_seen_at?: string | null
          points?: number | null
          points_monthly?: number
          public_key?: string | null
          region_id?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
          wins?: number | null
          wins_monthly?: number
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          best_launch_speed?: number | null
          bio?: string | null
          card_code?: number
          city?: string | null
          created_at?: string
          display_name?: string | null
          favorite_deck_id?: string | null
          id?: string
          last_seen_at?: string | null
          points?: number | null
          points_monthly?: number
          public_key?: string | null
          region_id?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
          wins?: number | null
          wins_monthly?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_favorite_deck_id_fkey"
            columns: ["favorite_deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_private: {
        Row: {
          birth_date: string | null
          created_at: string
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_private_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "fk_push_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      ranked_3d_models: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          download_url: string
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          download_url: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          download_url?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      ranking_seasons: {
        Row: {
          bfl: number
          closed_at: string | null
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          monthly_bfl: number
          monthly_bfl_enabled: boolean
          name: string
          start_date: string
        }
        Insert: {
          bfl?: number
          closed_at?: string | null
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          monthly_bfl?: number
          monthly_bfl_enabled?: boolean
          name: string
          start_date: string
        }
        Update: {
          bfl?: number
          closed_at?: string | null
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          monthly_bfl?: number
          monthly_bfl_enabled?: boolean
          name?: string
          start_date?: string
        }
        Relationships: []
      }
      ranking_snapshots: {
        Row: {
          city: string | null
          created_at: string
          display_name: string | null
          final_rank: number
          id: string
          points: number
          region_id: string | null
          season_id: string
          user_id: string
          wins: number
        }
        Insert: {
          city?: string | null
          created_at?: string
          display_name?: string | null
          final_rank: number
          id?: string
          points?: number
          region_id?: string | null
          season_id: string
          user_id: string
          wins?: number
        }
        Update: {
          city?: string | null
          created_at?: string
          display_name?: string | null
          final_rank?: number
          id?: string
          points?: number
          region_id?: string | null
          season_id?: string
          user_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_snapshots_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_snapshots_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_snapshots_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "ranking_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      referee_test_answers: {
        Row: {
          answer_text: string
          created_at: string | null
          id: string
          is_correct: boolean | null
          question_id: string
          sort_order: number | null
        }
        Insert: {
          answer_text: string
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          question_id: string
          sort_order?: number | null
        }
        Update: {
          answer_text?: string
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          question_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "referee_test_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "referee_test_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      referee_test_attempts: {
        Row: {
          attempted_at: string | null
          id: string
          passed: boolean | null
          score: number
          test_type: string
          total_questions: number
          user_id: string
        }
        Insert: {
          attempted_at?: string | null
          id?: string
          passed?: boolean | null
          score?: number
          test_type?: string
          total_questions?: number
          user_id: string
        }
        Update: {
          attempted_at?: string | null
          id?: string
          passed?: boolean | null
          score?: number
          test_type?: string
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      referee_test_questions: {
        Row: {
          created_at: string | null
          id: string
          is_multiple_choice: boolean | null
          media_type: string | null
          media_url: string | null
          question_text: string
          sort_order: number | null
          test_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_multiple_choice?: boolean | null
          media_type?: string | null
          media_url?: string | null
          question_text: string
          sort_order?: number | null
          test_type?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_multiple_choice?: boolean | null
          media_type?: string | null
          media_url?: string | null
          question_text?: string
          sort_order?: number | null
          test_type?: string
        }
        Relationships: []
      }
      referee_test_settings: {
        Row: {
          badge_id: string | null
          button1_text: string | null
          button1_url: string | null
          button2_text: string | null
          button2_url: string | null
          cooldown_days: number | null
          description: string | null
          id: string
          image_url: string | null
          pass_percentage: number | null
          test_intro: string | null
          test_type: string
          updated_at: string | null
        }
        Insert: {
          badge_id?: string | null
          button1_text?: string | null
          button1_url?: string | null
          button2_text?: string | null
          button2_url?: string | null
          cooldown_days?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          pass_percentage?: number | null
          test_intro?: string | null
          test_type?: string
          updated_at?: string | null
        }
        Update: {
          badge_id?: string | null
          button1_text?: string | null
          button1_url?: string | null
          button2_text?: string | null
          button2_url?: string | null
          cooldown_days?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          pass_percentage?: number | null
          test_intro?: string | null
          test_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referee_test_settings_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      regional_channel_closures: {
        Row: {
          channel_id: string
          closed_at: string
          id: string
          user_id: string
        }
        Insert: {
          channel_id: string
          closed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          closed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "regional_channel_closures_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "regional_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regional_channel_closures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      regional_channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "regional_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "regional_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regional_channel_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      regional_channels: {
        Row: {
          channel_type: string
          club_request_id: string | null
          created_at: string
          id: string
          is_active: boolean
          region_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          channel_type: string
          club_request_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          region_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          channel_type?: string
          club_request_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          region_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regional_channels_club_request_id_fkey"
            columns: ["club_request_id"]
            isOneToOne: false
            referencedRelation: "club_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regional_channels_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      regional_messages: {
        Row: {
          attachment_url: string | null
          channel_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          channel_id: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          channel_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "regional_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "regional_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regional_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      regional_referents: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          is_active: boolean
          public_email: string | null
          public_phone: string | null
          region_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          public_email?: string | null
          public_phone?: string | null
          region_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          public_email?: string | null
          public_phone?: string | null
          region_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "regional_referents_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regional_referents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      report_replies: {
        Row: {
          created_at: string
          id: string
          is_staff: boolean
          message: string
          report_id: string
          report_source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_staff?: boolean
          message: string
          report_id: string
          report_source: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_staff?: boolean
          message?: string
          report_id?: string
          report_source?: string
          user_id?: string
        }
        Relationships: []
      }
      rpg_component_settings: {
        Row: {
          bey_type: string
          bey_type_manual: boolean
          component_id: string
          created_at: string
          enabled: boolean
          rarity: string
          updated_at: string
        }
        Insert: {
          bey_type?: string
          bey_type_manual?: boolean
          component_id: string
          created_at?: string
          enabled?: boolean
          rarity?: string
          updated_at?: string
        }
        Update: {
          bey_type?: string
          bey_type_manual?: boolean
          component_id?: string
          created_at?: string
          enabled?: boolean
          rarity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rpg_component_settings_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: true
            referencedRelation: "collection_components"
            referencedColumns: ["id"]
          },
        ]
      }
      rpg_game_deck_beys: {
        Row: {
          bit_id: string | null
          blade_id: string | null
          created_at: string
          cx_assist_id: string | null
          cx_infinity_id: string | null
          deck_id: string
          id: string
          lock_chip_id: string | null
          position: number
          ratchet_id: string | null
          ratchet_mode: string
          ribs_id: string | null
          series: string
          ux_infinity_id: string | null
        }
        Insert: {
          bit_id?: string | null
          blade_id?: string | null
          created_at?: string
          cx_assist_id?: string | null
          cx_infinity_id?: string | null
          deck_id: string
          id?: string
          lock_chip_id?: string | null
          position: number
          ratchet_id?: string | null
          ratchet_mode?: string
          ribs_id?: string | null
          series?: string
          ux_infinity_id?: string | null
        }
        Update: {
          bit_id?: string | null
          blade_id?: string | null
          created_at?: string
          cx_assist_id?: string | null
          cx_infinity_id?: string | null
          deck_id?: string
          id?: string
          lock_chip_id?: string | null
          position?: number
          ratchet_id?: string | null
          ratchet_mode?: string
          ribs_id?: string | null
          series?: string
          ux_infinity_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rpg_game_deck_beys_bit_id_fkey"
            columns: ["bit_id"]
            isOneToOne: false
            referencedRelation: "collection_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rpg_game_deck_beys_blade_id_fkey"
            columns: ["blade_id"]
            isOneToOne: false
            referencedRelation: "collection_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rpg_game_deck_beys_cx_assist_id_fkey"
            columns: ["cx_assist_id"]
            isOneToOne: false
            referencedRelation: "collection_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rpg_game_deck_beys_cx_infinity_id_fkey"
            columns: ["cx_infinity_id"]
            isOneToOne: false
            referencedRelation: "collection_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rpg_game_deck_beys_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "rpg_game_decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rpg_game_deck_beys_lock_chip_id_fkey"
            columns: ["lock_chip_id"]
            isOneToOne: false
            referencedRelation: "collection_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rpg_game_deck_beys_ratchet_id_fkey"
            columns: ["ratchet_id"]
            isOneToOne: false
            referencedRelation: "collection_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rpg_game_deck_beys_ribs_id_fkey"
            columns: ["ribs_id"]
            isOneToOne: false
            referencedRelation: "collection_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rpg_game_deck_beys_ux_infinity_id_fkey"
            columns: ["ux_infinity_id"]
            isOneToOne: false
            referencedRelation: "collection_components"
            referencedColumns: ["id"]
          },
        ]
      }
      rpg_game_decks: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rpg_inventory: {
        Row: {
          created_at: string
          id: string
          item_key: string
          qty: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_key: string
          qty?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_key?: string
          qty?: number
          user_id?: string
        }
        Relationships: []
      }
      rpg_owned_components: {
        Row: {
          component_id: string
          obtained_at: string
          qty: number
          user_id: string
        }
        Insert: {
          component_id: string
          obtained_at?: string
          qty?: number
          user_id: string
        }
        Update: {
          component_id?: string
          obtained_at?: string
          qty?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rpg_owned_components_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "collection_components"
            referencedColumns: ["id"]
          },
        ]
      }
      rpg_profiles: {
        Row: {
          avatar_key: string
          created_at: string
          currency: number
          eyes: string
          gacha_points: number
          gender: string
          hair: string
          outfit: string
          owned_cosmetics: Json
          selected_deck: Json
          site_deck_id: string | null
          skin: string
          unlocked_level: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_key?: string
          created_at?: string
          currency?: number
          eyes?: string
          gacha_points?: number
          gender?: string
          hair?: string
          outfit?: string
          owned_cosmetics?: Json
          selected_deck?: Json
          site_deck_id?: string | null
          skin?: string
          unlocked_level?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_key?: string
          created_at?: string
          currency?: number
          eyes?: string
          gacha_points?: number
          gender?: string
          hair?: string
          outfit?: string
          owned_cosmetics?: Json
          selected_deck?: Json
          site_deck_id?: string | null
          skin?: string
          unlocked_level?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rpg_runs: {
        Row: {
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          state: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rules_section_visibility: {
        Row: {
          is_visible: boolean
          position: number
          section_key: string
          updated_at: string
        }
        Insert: {
          is_visible?: boolean
          position?: number
          section_key: string
          updated_at?: string
        }
        Update: {
          is_visible?: boolean
          position?: number
          section_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          roles: string[]
          sort_order: number
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          roles?: string[]
          sort_order?: number
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          roles?: string[]
          sort_order?: number
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      team_invites: {
        Row: {
          created_at: string
          id: string
          invited_by: string
          invited_user_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["team_invite_status"]
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by: string
          invited_user_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["team_invite_status"]
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string
          invited_user_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["team_invite_status"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["team_role"]
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_messages: {
        Row: {
          content: string
          created_at: string
          edited_at: string | null
          id: string
          sender_id: string
          team_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          sender_id: string
          team_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          sender_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          city: string | null
          created_at: string
          created_by: string
          description: string | null
          disband_at: string | null
          id: string
          logo_url: string | null
          max_members: number
          name: string
          region_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          disband_at?: string | null
          id?: string
          logo_url?: string | null
          max_members?: number
          name: string
          region_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          disband_at?: string | null
          id?: string
          logo_url?: string | null
          max_members?: number
          name?: string
          region_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_read_status: {
        Row: {
          id: string
          last_read_at: string
          ticket_id: string
          ticket_type: string
          user_id: string
        }
        Insert: {
          id?: string
          last_read_at?: string
          ticket_id: string
          ticket_type: string
          user_id: string
        }
        Update: {
          id?: string
          last_read_at?: string
          ticket_id?: string
          ticket_type?: string
          user_id?: string
        }
        Relationships: []
      }
      topcut_pairing_audit: {
        Row: {
          bad_pairs: number
          checked_at: string
          details: Json
          is_canonical: boolean
          matches_round1: number | null
          top_cut_size: number | null
          tournament_id: string
        }
        Insert: {
          bad_pairs?: number
          checked_at?: string
          details?: Json
          is_canonical: boolean
          matches_round1?: number | null
          top_cut_size?: number | null
          tournament_id: string
        }
        Update: {
          bad_pairs?: number
          checked_at?: string
          details?: Json
          is_canonical?: boolean
          matches_round1?: number | null
          top_cut_size?: number | null
          tournament_id?: string
        }
        Relationships: []
      }
      tournament_deck_selections: {
        Row: {
          created_at: string
          deck_id: string
          id: string
          tournament_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deck_id: string
          id?: string
          tournament_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deck_id?: string
          id?: string
          tournament_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_deck_selections_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_deck_selections_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_match_decks: {
        Row: {
          created_at: string
          deck_beyblade_id: string
          id: string
          match_id: string
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          deck_beyblade_id: string
          id?: string
          match_id: string
          position?: number
          user_id: string
        }
        Update: {
          created_at?: string
          deck_beyblade_id?: string
          id?: string
          match_id?: string
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_match_decks_deck_beyblade_id_fkey"
            columns: ["deck_beyblade_id"]
            isOneToOne: false
            referencedRelation: "deck_beyblades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_match_decks_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_matches: {
        Row: {
          created_at: string
          group_number: number | null
          id: string
          match_number: number
          pairing_meta: Json
          phase: string
          player1_id: string | null
          player1_score: number | null
          player1_side: string | null
          player2_id: string | null
          player2_score: number | null
          player2_side: string | null
          round: number
          scored_by: string | null
          status: string
          tournament_id: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          group_number?: number | null
          id?: string
          match_number?: number
          pairing_meta?: Json
          phase?: string
          player1_id?: string | null
          player1_score?: number | null
          player1_side?: string | null
          player2_id?: string | null
          player2_score?: number | null
          player2_side?: string | null
          round: number
          scored_by?: string | null
          status?: string
          tournament_id: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          group_number?: number | null
          id?: string
          match_number?: number
          pairing_meta?: Json
          phase?: string
          player1_id?: string | null
          player1_score?: number | null
          player1_side?: string | null
          player2_id?: string | null
          player2_score?: number | null
          player2_side?: string | null
          round?: number
          scored_by?: string | null
          status?: string
          tournament_id?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_referees: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          tournament_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_referees_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_registrations: {
        Row: {
          child_profile_id: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          id: string
          is_ready: boolean
          registered_at: string
          status: string | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          child_profile_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          id?: string
          is_ready?: boolean
          registered_at?: string
          status?: string | null
          tournament_id: string
          user_id: string
        }
        Update: {
          child_profile_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          id?: string
          is_ready?: boolean
          registered_at?: string
          status?: string | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registrations_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_results: {
        Row: {
          base_points: number
          created_at: string
          id: string
          participants_count: number
          placement: number
          scaled_points: number
          tournament_id: string
          user_id: string
        }
        Insert: {
          base_points?: number
          created_at?: string
          id?: string
          participants_count?: number
          placement: number
          scaled_points?: number
          tournament_id: string
          user_id: string
        }
        Update: {
          base_points?: number
          created_at?: string
          id?: string
          participants_count?: number
          placement?: number
          scaled_points?: number
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_results_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_round_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          group_number: number | null
          id: string
          matches_data: Json
          phase: string
          round: number
          tournament_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_number?: number | null
          id?: string
          matches_data: Json
          phase?: string
          round: number
          tournament_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_number?: number | null
          id?: string
          matches_data?: Json
          phase?: string
          round?: number
          tournament_id?: string
        }
        Relationships: []
      }
      tournament_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          matches: Json
          reason: string
          registrations: Json
          standings: Json
          tournament_data: Json
          tournament_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          matches: Json
          reason: string
          registrations: Json
          standings: Json
          tournament_data: Json
          tournament_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          matches?: Json
          reason?: string
          registrations?: Json
          standings?: Json
          tournament_data?: Json
          tournament_id?: string
        }
        Relationships: []
      }
      tournament_standings: {
        Row: {
          created_at: string
          draws: number
          dropped: boolean
          game_losses: number
          game_wins: number
          group_number: number | null
          id: string
          losses: number
          opponent_match_win_pct: number | null
          points: number
          resistance: number
          seed: number | null
          tournament_id: string
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          created_at?: string
          draws?: number
          dropped?: boolean
          game_losses?: number
          game_wins?: number
          group_number?: number | null
          id?: string
          losses?: number
          opponent_match_win_pct?: number | null
          points?: number
          resistance?: number
          seed?: number | null
          tournament_id: string
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          created_at?: string
          draws?: number
          dropped?: boolean
          game_losses?: number
          game_wins?: number
          group_number?: number | null
          id?: string
          losses?: number
          opponent_match_win_pct?: number | null
          points?: number
          resistance?: number
          seed?: number | null
          tournament_id?: string
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournament_standings_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_streaming_settings: {
        Row: {
          created_at: string
          enabled: boolean
          highlighted_match_id: string | null
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          highlighted_match_id?: string | null
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          highlighted_match_id?: string | null
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_streaming_settings_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_team_members: {
        Row: {
          child_profile_id: string | null
          created_at: string
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          child_profile_id?: string | null
          created_at?: string
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          child_profile_id?: string | null
          created_at?: string
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_team_members_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_teams: {
        Row: {
          club_id: string | null
          created_at: string
          created_by: string
          id: string
          is_ready: boolean
          team_name: string
          tournament_id: string
        }
        Insert: {
          club_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_ready?: boolean
          team_name: string
          tournament_id: string
        }
        Update: {
          club_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_ready?: boolean
          team_name?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          action_log: string | null
          auto_publish_at: string | null
          banlist: string | null
          championship_id: string | null
          check_in_enabled: boolean
          city: string
          club_id: string | null
          created_at: string
          created_by: string | null
          custom_rules: string | null
          custom_swiss_win_points: number | null
          custom_top_win_points: number | null
          description: string | null
          enabled_tiebreakers: Json
          entry_fee: number | null
          event_date: string
          event_end_date: string | null
          event_type: string
          external_source: string | null
          flyer_url: string | null
          format: string | null
          groups_count: number | null
          has_waitlist: boolean
          id: string
          image_url: string | null
          is_active: boolean | null
          is_external: boolean
          is_hidden: boolean
          is_ranked: boolean
          location: string
          matches_per_table: number
          max_participants: number | null
          parent_event_id: string | null
          payment_link: string | null
          payment_method: string | null
          prize_description: string | null
          region_id: string | null
          registration_deadline: string
          registration_opens_at: string | null
          scoring_policy: string
          status: string
          swiss_rounds: number | null
          table_assignment_enabled: boolean
          team_mode: string
          tiebreaker_depth: number | null
          tiebreaker_mode: string
          title: string
          top_cut_size: number | null
          u12_swiss_rounds: number | null
          under12_enabled: boolean
          under12_separate_topcut: boolean
          updated_at: string
        }
        Insert: {
          action_log?: string | null
          auto_publish_at?: string | null
          banlist?: string | null
          championship_id?: string | null
          check_in_enabled?: boolean
          city: string
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_rules?: string | null
          custom_swiss_win_points?: number | null
          custom_top_win_points?: number | null
          description?: string | null
          enabled_tiebreakers?: Json
          entry_fee?: number | null
          event_date: string
          event_end_date?: string | null
          event_type?: string
          external_source?: string | null
          flyer_url?: string | null
          format?: string | null
          groups_count?: number | null
          has_waitlist?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_external?: boolean
          is_hidden?: boolean
          is_ranked?: boolean
          location: string
          matches_per_table?: number
          max_participants?: number | null
          parent_event_id?: string | null
          payment_link?: string | null
          payment_method?: string | null
          prize_description?: string | null
          region_id?: string | null
          registration_deadline: string
          registration_opens_at?: string | null
          scoring_policy?: string
          status?: string
          swiss_rounds?: number | null
          table_assignment_enabled?: boolean
          team_mode?: string
          tiebreaker_depth?: number | null
          tiebreaker_mode?: string
          title: string
          top_cut_size?: number | null
          u12_swiss_rounds?: number | null
          under12_enabled?: boolean
          under12_separate_topcut?: boolean
          updated_at?: string
        }
        Update: {
          action_log?: string | null
          auto_publish_at?: string | null
          banlist?: string | null
          championship_id?: string | null
          check_in_enabled?: boolean
          city?: string
          club_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_rules?: string | null
          custom_swiss_win_points?: number | null
          custom_top_win_points?: number | null
          description?: string | null
          enabled_tiebreakers?: Json
          entry_fee?: number | null
          event_date?: string
          event_end_date?: string | null
          event_type?: string
          external_source?: string | null
          flyer_url?: string | null
          format?: string | null
          groups_count?: number | null
          has_waitlist?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_external?: boolean
          is_hidden?: boolean
          is_ranked?: boolean
          location?: string
          matches_per_table?: number
          max_participants?: number | null
          parent_event_id?: string | null
          payment_link?: string | null
          payment_method?: string | null
          prize_description?: string | null
          region_id?: string | null
          registration_deadline?: string
          registration_opens_at?: string | null
          scoring_policy?: string
          status?: string
          swiss_rounds?: number | null
          table_assignment_enabled?: boolean
          team_mode?: string
          tiebreaker_depth?: number | null
          tiebreaker_mode?: string
          title?: string
          top_cut_size?: number | null
          u12_swiss_rounds?: number | null
          under12_enabled?: boolean
          under12_separate_topcut?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          completed_at: string
          id: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          completed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          completed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          badge_id: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          badge_id: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          badge_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bans: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          issued_by: string
          reason: string
          revoked_at: string | null
          revoked_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_by: string
          reason: string
          revoked_at?: string | null
          revoked_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_by?: string
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_chat_key_history: {
        Row: {
          created_at: string
          id: string
          private_key: string
          public_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          private_key: string
          public_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          private_key?: string
          public_key?: string
          user_id?: string
        }
        Relationships: []
      }
      user_chat_keys: {
        Row: {
          created_at: string
          private_key: string
          public_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          private_key: string
          public_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          private_key?: string
          public_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_chat_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      user_collection_data: {
        Row: {
          items: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          items?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          items?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_external_accounts: {
        Row: {
          access_token: string | null
          child_profile_id: string | null
          created_at: string
          external_user_id: string | null
          external_username: string
          id: string
          platform: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token?: string | null
          child_profile_id?: string | null
          created_at?: string
          external_user_id?: string | null
          external_username: string
          id?: string
          platform: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token?: string | null
          child_profile_id?: string | null
          created_at?: string
          external_user_id?: string | null
          external_username?: string
          id?: string
          platform?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_external_accounts_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_external_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      user_missions: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          mission_id: string
          progress: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_id: string
          progress?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_id?: string
          progress?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_passkeys: {
        Row: {
          aaguid: string | null
          backup_eligible: boolean | null
          backup_state: boolean | null
          counter: number
          created_at: string
          credential_id: string
          device_fingerprint: string | null
          device_name: string | null
          device_os: string | null
          id: string
          last_used_at: string | null
          public_key: string
          revoked_at: string | null
          transports: string[] | null
          user_id: string
        }
        Insert: {
          aaguid?: string | null
          backup_eligible?: boolean | null
          backup_state?: boolean | null
          counter?: number
          created_at?: string
          credential_id: string
          device_fingerprint?: string | null
          device_name?: string | null
          device_os?: string | null
          id?: string
          last_used_at?: string | null
          public_key: string
          revoked_at?: string | null
          transports?: string[] | null
          user_id: string
        }
        Update: {
          aaguid?: string | null
          backup_eligible?: boolean | null
          backup_state?: boolean | null
          counter?: number
          created_at?: string
          credential_id?: string
          device_fingerprint?: string | null
          device_name?: string | null
          device_os?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string
          revoked_at?: string | null
          transports?: string[] | null
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      user_timeouts: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          issued_by: string
          reason: string
          revoked_at: string | null
          revoked_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          issued_by: string
          reason: string
          revoked_at?: string | null
          revoked_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          issued_by?: string
          reason?: string
          revoked_at?: string | null
          revoked_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_warns: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          issued_by: string
          reason: string
          section: Database["public"]["Enums"]["warn_section"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          issued_by: string
          reason: string
          section: Database["public"]["Enums"]["warn_section"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          issued_by?: string
          reason?: string
          section?: Database["public"]["Enums"]["warn_section"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      club_members_public: {
        Row: {
          city: string | null
          club_id: string | null
          id: string | null
          joined_at: string | null
          last_tournament_at: string | null
          role: Database["public"]["Enums"]["club_role"] | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          club_id?: string | null
          id?: string | null
          joined_at?: string | null
          last_tournament_at?: string | null
          role?: Database["public"]["Enums"]["club_role"] | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          club_id?: string | null
          id?: string | null
          joined_at?: string | null
          last_tournament_at?: string | null
          role?: Database["public"]["Enums"]["club_role"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_export"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_supporters_public: {
        Row: {
          avatar_url: string | null
          badge_id: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          is_active: boolean | null
          kofi_amount: number | null
          message: string | null
          sort_order: number | null
          tier: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          badge_id?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          is_active?: boolean | null
          kofi_amount?: number | null
          message?: string | null
          sort_order?: number | null
          tier?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          badge_id?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          is_active?: boolean | null
          kofi_amount?: number | null
          message?: string | null
          sort_order?: number | null
          tier?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faq_supporters_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      users_export: {
        Row: {
          created_at: string | null
          id: string | null
          last_sign_in_at: string | null
          name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          last_sign_in_at?: string | null
          name?: never
        }
        Update: {
          created_at?: string | null
          id?: string | null
          last_sign_in_at?: string | null
          name?: never
        }
        Relationships: []
      }
    }
    Functions: {
      _sys_refinalize_no_rank: {
        Args: { _tournament_id: string }
        Returns: undefined
      }
      admin_debug_cleanup_tests: { Args: never; Returns: Json }
      admin_debug_create_club_invite: {
        Args: { _target_user_id: string }
        Returns: Json
      }
      admin_debug_create_club_request: {
        Args: { _target_user_id: string }
        Returns: Json
      }
      admin_debug_send_notification: {
        Args: {
          _link?: string
          _message: string
          _push?: boolean
          _target_user_id: string
          _title: string
          _type: string
        }
        Returns: string
      }
      admin_merge_users: {
        Args: {
          _keep_avatar?: boolean
          _keep_city?: boolean
          _keep_display_name?: boolean
          _keep_email?: boolean
          _keep_region?: boolean
          _keep_user_id: string
          _keep_username?: boolean
          _merge_user_id: string
        }
        Returns: undefined
      }
      admin_register_player: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: Json
      }
      admin_replace_tournament_player: {
        Args: {
          _new_user_id: string
          _old_user_id: string
          _tournament_id: string
        }
        Returns: Json
      }
      admin_resync_tournament: {
        Args: { _tournament_id: string }
        Returns: Json
      }
      admin_set_match_players: {
        Args: { _match_id: string; _player1_id: string; _player2_id: string }
        Returns: undefined
      }
      admin_swap_match_players: {
        Args: {
          _match1_id: string
          _match2_id: string
          _player1_id: string
          _player2_id: string
          _tournament_id: string
        }
        Returns: Json
      }
      admin_update_profile: {
        Args: {
          _bio?: string
          _city?: string
          _display_name?: string
          _region_id?: string
          _user_id: string
          _username?: string
        }
        Returns: Json
      }
      apply_placement_bracket_overrides: {
        Args: { _tournament_id: string }
        Returns: undefined
      }
      approve_club_request_and_transfer: {
        Args: { _request_id: string }
        Returns: string
      }
      are_clubs_linked: {
        Args: { _club_id_a: string; _club_id_b: string }
        Returns: boolean
      }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      are_teammates: { Args: { _a: string; _b: string }; Returns: boolean }
      assert_top8_pairings: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      auto_publish_hidden_tournaments: { Args: never; Returns: undefined }
      beta_elo_backfill: { Args: never; Returns: number }
      beta_elo_process_match: {
        Args: { _match_id: string }
        Returns: undefined
      }
      beta_elo_tier_for: { Args: { _rating: number }; Returns: string }
      bulk_create_ghost_profiles: {
        Args: { _profiles: Json }
        Returns: undefined
      }
      can_chat_by_staff_scope: {
        Args: { _a: string; _b: string }
        Returns: boolean
      }
      can_chat_via_club_request: {
        Args: { _a: string; _b: string }
        Returns: boolean
      }
      check_username_available: { Args: { _username: string }; Returns: Json }
      claim_achievement: { Args: { _achievement_id: string }; Returns: Json }
      claim_ghost_username: {
        Args: { _real_user_id: string; _username: string }
        Returns: Json
      }
      claim_mission: { Args: { _mission_id: string }; Returns: Json }
      cleanup_expired_market_listings: { Args: never; Returns: number }
      cleanup_expired_passkey_challenges: { Args: never; Returns: undefined }
      cleanup_expired_teams: { Args: never; Returns: undefined }
      cleanup_old_chat_messages: { Args: never; Returns: undefined }
      cleanup_old_notifications: { Args: never; Returns: number }
      cleanup_tournament_guests: {
        Args: { _tournament_id: string }
        Returns: number
      }
      convert_child_to_account: {
        Args: {
          _child_id: string
          _email: string
          _password: string
          _username: string
        }
        Returns: Json
      }
      count_active_warns: {
        Args: {
          _section: Database["public"]["Enums"]["warn_section"]
          _user_id: string
        }
        Returns: number
      }
      count_children: { Args: { _parent_id: string }; Returns: number }
      create_tournament_snapshot: {
        Args: { _reason: string; _tournament_id: string }
        Returns: string
      }
      disband_team: { Args: { _team_id: string }; Returns: undefined }
      ensure_region_channel: { Args: { _region_id: string }; Returns: string }
      filter_real_user_ids: {
        Args: { _user_ids: string[] }
        Returns: {
          user_id: string
        }[]
      }
      finalize_tournament_points: {
        Args: { _tournament_id: string }
        Returns: undefined
      }
      finalize_tournament_points_with_placement_overrides: {
        Args: { _tournament_id: string }
        Returns: undefined
      }
      generate_next_swiss_round_fide: {
        Args: { _tournament_id: string }
        Returns: Json
      }
      generate_swiss_pairings_fide: {
        Args: { _round?: number; _tournament_id: string }
        Returns: Json
      }
      generate_top_cut_bracket: {
        Args: { _tournament_id: string }
        Returns: Json
      }
      get_achievement_progress: {
        Args: { _user_id: string }
        Returns: {
          achievement_id: string
          current_progress: number
        }[]
      }
      get_aggregated_match_wins: {
        Args: { _user_ids: string[] }
        Returns: {
          total_wins: number
          tournament_count: number
          user_id: string
        }[]
      }
      get_all_ghost_user_ids: {
        Args: never
        Returns: {
          user_id: string
        }[]
      }
      get_chat_public_key_history: {
        Args: { _user_id: string }
        Returns: {
          public_key: string
        }[]
      }
      get_club_member_counts: {
        Args: never
        Returns: {
          club_id: string
          member_count: number
        }[]
      }
      get_club_members_with_phone: {
        Args: { _club_id: string }
        Returns: {
          city: string
          club_id: string
          id: string
          joined_at: string
          last_tournament_at: string
          phone: string
          role: Database["public"]["Enums"]["club_role"]
          user_id: string
        }[]
      }
      get_email_by_username: { Args: { _username: string }; Returns: string }
      get_ghost_profiles_with_results: {
        Args: never
        Returns: {
          display_name: string
          region_id: string
          user_id: string
          username: string
        }[]
      }
      get_linked_club_ids: { Args: { _club_id: string }; Returns: string[] }
      get_mission_progress: {
        Args: { _user_id: string }
        Returns: {
          current_progress: number
          mission_id: string
        }[]
      }
      get_real_bladers_count: { Args: never; Returns: number }
      get_real_user_profiles: {
        Args: never
        Returns: {
          display_name: string
          user_id: string
          username: string
        }[]
      }
      get_staff_user_ids: { Args: never; Returns: string[] }
      get_test_answers_safe:
        | {
            Args: never
            Returns: {
              answer_text: string
              id: string
              question_id: string
              sort_order: number
            }[]
          }
        | {
            Args: { _test_type?: string }
            Returns: {
              answer_text: string
              id: string
              question_id: string
              sort_order: number
            }[]
          }
      get_tournament_child_profiles: {
        Args: { _tournament_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
        }[]
      }
      get_tournament_registration_counts: {
        Args: { _tournament_ids: string[] }
        Returns: {
          reg_count: number
          tournament_id: string
        }[]
      }
      get_user_team: { Args: { _user_id: string }; Returns: string }
      has_club_role: {
        Args: {
          _club_id: string
          _role: Database["public"]["Enums"]["club_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_championship_manager: {
        Args: { _championship_id: string; _user_id: string }
        Returns: boolean
      }
      is_championship_referee: {
        Args: { _championship_id: string; _user_id: string }
        Returns: boolean
      }
      is_channel_member: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_chat_participant: {
        Args: { _chat_id: string; _user_id: string }
        Returns: boolean
      }
      is_club_member: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_club_request_creator: {
        Args: { _request_id: string; _user_id: string }
        Returns: boolean
      }
      is_club_staff: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_invited_to_club_request: {
        Args: { _request_id: string; _user_id: string }
        Returns: boolean
      }
      is_member_or_linked: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_regional_referent: {
        Args: { _region_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff_or_linked: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_owner: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_tournament_club_staff: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: boolean
      }
      is_tournament_referee: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: boolean
      }
      is_user_banned: { Args: { _user_id: string }; Returns: boolean }
      is_user_blocked: { Args: { _user_id: string }; Returns: boolean }
      is_user_timed_out: { Args: { _user_id: string }; Returns: boolean }
      is_venue_shop_owner: { Args: { _venue_id: string }; Returns: boolean }
      join_club_member: {
        Args: {
          p_city?: string
          p_club_id: string
          p_phone: string
          p_role?: Database["public"]["Enums"]["club_role"]
          p_user_id: string
        }
        Returns: string
      }
      judge_course_category_passed: {
        Args: { _category: string; _user_id: string }
        Returns: boolean
      }
      judge_course_required_passed: {
        Args: { _user_id: string }
        Returns: boolean
      }
      link_external_account_backfill: {
        Args: {
          _external_username: string
          _platform: string
          _user_id: string
        }
        Returns: Json
      }
      link_external_account_backfill_child: {
        Args: {
          _child_id: string
          _external_username: string
          _platform: string
        }
        Returns: Json
      }
      max_swiss_rounds_for_players: {
        Args: { players_count: number }
        Returns: number
      }
      notify_mention: {
        Args: {
          _context: string
          _mentioned_username: string
          _mentioner_id: string
          _post_id: string
        }
        Returns: undefined
      }
      promote_tournament_waitlist: {
        Args: { _tournament_id: string }
        Returns: number
      }
      recalc_tournament_standings: {
        Args: { _tournament_id: string }
        Returns: undefined
      }
      recalculate_all_rankings: {
        Args: {
          _bfl?: number
          _monthly_bfl?: number
          _monthly_bfl_enabled?: boolean
        }
        Returns: undefined
      }
      recalculate_user_points: {
        Args: { _user_id: string }
        Returns: undefined
      }
      reconcile_imported_account_points: {
        Args: { _user_id: string }
        Returns: Json
      }
      referent_open_direct_channel: {
        Args: { _target_user_id: string }
        Returns: string
      }
      reject_club_request: {
        Args: { _reason?: string; _request_id: string }
        Returns: undefined
      }
      repair_top_cut_pairings: {
        Args: { _tournament_id: string }
        Returns: Json
      }
      restore_tournament_snapshot: {
        Args: { _snapshot_id: string }
        Returns: Json
      }
      run_topcut_pairing_audit: { Args: never; Returns: Json }
      search_mentionable_users: {
        Args: { q: string }
        Returns: {
          avatar_url: string
          display_name: string
          username: string
        }[]
      }
      submit_referee_test:
        | { Args: { _answers: Json }; Returns: Json }
        | { Args: { _answers: Json; _test_type?: string }; Returns: Json }
      sync_profile_region_from_membership: { Args: never; Returns: undefined }
      sync_user_collection: {
        Args: { _adds?: Json; _removes?: Json }
        Returns: undefined
      }
      topcut_bracket_order: { Args: { _n: number }; Returns: number[] }
      transfer_team_leadership: {
        Args: { _new_owner: string; _team_id: string }
        Returns: undefined
      }
      upsert_club_member_contact: {
        Args: {
          p_city?: string
          p_member_id: string
          p_phone: string
          p_update_city?: boolean
        }
        Returns: undefined
      }
      user_has_active_passkey: { Args: { _user_id: string }; Returns: boolean }
      validate_top8_pairings: {
        Args: { p_tournament_id: string }
        Returns: {
          high_seed: number
          low_seed: number
          match_number: number
          p1_seed: number
          p2_seed: number
          valid_pair: boolean
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "staff"
        | "parent"
        | "sponsor"
        | "regional_referent"
      club_request_status: "pending" | "approved" | "rejected"
      club_role: "leader" | "staff" | "vice_leader" | "member"
      team_invite_status: "pending" | "accepted" | "declined"
      team_role: "owner" | "member"
      warn_section: "forum" | "market" | "decks" | "tournaments" | "profile"
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
      app_role: [
        "admin",
        "moderator",
        "user",
        "staff",
        "parent",
        "sponsor",
        "regional_referent",
      ],
      club_request_status: ["pending", "approved", "rejected"],
      club_role: ["leader", "staff", "vice_leader", "member"],
      team_invite_status: ["pending", "accepted", "declined"],
      team_role: ["owner", "member"],
      warn_section: ["forum", "market", "decks", "tournaments", "profile"],
    },
  },
} as const
