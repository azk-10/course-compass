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
      activity_logs: {
        Row: {
          confidence: number | null
          created_at: string
          detail: Json
          id: string
          kind: string
          organization_id: string | null
          session_id: string | null
          teacher_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          detail?: Json
          id?: string
          kind: string
          organization_id?: string | null
          session_id?: string | null
          teacher_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          detail?: Json
          id?: string
          kind?: string
          organization_id?: string | null
          session_id?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          created_at: string
          credits: number
          duration_ms: number
          fallback: boolean
          id: string
          input_tokens: number
          model: string
          operation: string
          output_tokens: number
          session_id: string | null
          status: string
          teacher_id: string | null
        }
        Insert: {
          created_at?: string
          credits?: number
          duration_ms?: number
          fallback?: boolean
          id?: string
          input_tokens?: number
          model?: string
          operation?: string
          output_tokens?: number
          session_id?: string | null
          status?: string
          teacher_id?: string | null
        }
        Update: {
          created_at?: string
          credits?: number
          duration_ms?: number
          fallback?: boolean
          id?: string
          input_tokens?: number
          model?: string
          operation?: string
          output_tokens?: number
          session_id?: string | null
          status?: string
          teacher_id?: string | null
        }
        Relationships: []
      }
      capacity_events: {
        Row: {
          actor_id: string | null
          amount_cents: number
          created_at: string
          id: string
          kind: string
          quantity: number
          subscription_id: string
          unit_price_cents: number
        }
        Insert: {
          actor_id?: string | null
          amount_cents?: number
          created_at?: string
          id?: string
          kind: string
          quantity?: number
          subscription_id: string
          unit_price_cents?: number
        }
        Update: {
          actor_id?: string | null
          amount_cents?: number
          created_at?: string
          id?: string
          kind?: string
          quantity?: number
          subscription_id?: string
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "capacity_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_settings: {
        Row: {
          allow_teacher_override: boolean
          archive_minutes: number
          audio_detect_pct: number
          cooldown_ms: number
          created_at: string
          followup_seconds: number
          id: string
          organization_id: string | null
          question_confirm_pct: number
          resolve_pct: number
          spam_sensitivity: number
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          allow_teacher_override?: boolean
          archive_minutes?: number
          audio_detect_pct?: number
          cooldown_ms?: number
          created_at?: string
          followup_seconds?: number
          id?: string
          organization_id?: string | null
          question_confirm_pct?: number
          resolve_pct?: number
          spam_sensitivity?: number
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          allow_teacher_override?: boolean
          archive_minutes?: number
          audio_detect_pct?: number
          cooldown_ms?: number
          created_at?: string
          followup_seconds?: number
          id?: string
          organization_id?: string | null
          question_confirm_pct?: number
          resolve_pct?: number
          spam_sensitivity?: number
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          accent: string
          archived_at: string | null
          created_at: string
          id: string
          is_crash: boolean
          join_code: string
          status: string
          teacher_id: string
          term: string | null
          title: string
        }
        Insert: {
          accent?: string
          archived_at?: string | null
          created_at?: string
          id?: string
          is_crash?: boolean
          join_code?: string
          status?: string
          teacher_id: string
          term?: string | null
          title: string
        }
        Update: {
          accent?: string
          archived_at?: string | null
          created_at?: string
          id?: string
          is_crash?: boolean
          join_code?: string
          status?: string
          teacher_id?: string
          term?: string | null
          title?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          created_at: string
          id: string
          status: string
          student_email: string | null
          student_label: string
          student_phone: string | null
          student_user_id: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          status?: string
          student_email?: string | null
          student_label: string
          student_phone?: string | null
          student_user_id?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          status?: string
          student_email?: string | null
          student_label?: string
          student_phone?: string | null
          student_user_id?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          ai_messages_used: number
          base_cents: number
          created_at: string
          discount_cents: number
          extra_classes: number
          extra_classes_cents: number
          extra_student_blocks: number
          extra_students_cents: number
          extra_teachers: number
          extra_teachers_cents: number
          id: string
          notes: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          status: string
          subscription_id: string
          total_cents: number
          updated_at: string
        }
        Insert: {
          ai_messages_used?: number
          base_cents?: number
          created_at?: string
          discount_cents?: number
          extra_classes?: number
          extra_classes_cents?: number
          extra_student_blocks?: number
          extra_students_cents?: number
          extra_teachers?: number
          extra_teachers_cents?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: string
          subscription_id: string
          total_cents?: number
          updated_at?: string
        }
        Update: {
          ai_messages_used?: number
          base_cents?: number
          created_at?: string
          discount_cents?: number
          extra_classes?: number
          extra_classes_cents?: number
          extra_student_blocks?: number
          extra_students_cents?: number
          extra_teachers?: number
          extra_teachers_cents?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: string
          subscription_id?: string
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          ai_failed: boolean
          body: string
          category: string
          confidence: number
          course_id: string | null
          created_at: string
          id: string
          is_teacher: boolean
          message_type: string
          sender_label: string
          session_id: string
          student_id: string | null
          teacher_id: string | null
          thread_id: string | null
        }
        Insert: {
          ai_failed?: boolean
          body: string
          category?: string
          confidence?: number
          course_id?: string | null
          created_at?: string
          id?: string
          is_teacher?: boolean
          message_type?: string
          sender_label: string
          session_id: string
          student_id?: string | null
          teacher_id?: string | null
          thread_id?: string | null
        }
        Update: {
          ai_failed?: boolean
          body?: string
          category?: string
          confidence?: number
          course_id?: string | null
          created_at?: string
          id?: string
          is_teacher?: boolean
          message_type?: string
          sender_label?: string
          session_id?: string
          student_id?: string | null
          teacher_id?: string | null
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      org_approval_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          organization_id: string
          teacher_email: string | null
          teacher_id: string
          teacher_name: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          organization_id: string
          teacher_email?: string | null
          teacher_id: string
          teacher_name?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          teacher_email?: string | null
          teacher_id?: string
          teacher_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_approval_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          base_price_cents: number
          created_at: string
          extra_class_price_cents: number
          extra_student_block_price_cents: number
          extra_teacher_price_cents: number
          id: string
          included_ai_messages: number
          included_classes: number
          included_students: number
          included_teachers: number
          is_active: boolean
          is_custom: boolean
          kind: string
          name: string
          sort_order: number
          student_block_size: number
          updated_at: string
        }
        Insert: {
          base_price_cents?: number
          created_at?: string
          extra_class_price_cents?: number
          extra_student_block_price_cents?: number
          extra_teacher_price_cents?: number
          id: string
          included_ai_messages?: number
          included_classes?: number
          included_students?: number
          included_teachers?: number
          is_active?: boolean
          is_custom?: boolean
          kind: string
          name: string
          sort_order?: number
          student_block_size?: number
          updated_at?: string
        }
        Update: {
          base_price_cents?: number
          created_at?: string
          extra_class_price_cents?: number
          extra_student_block_price_cents?: number
          extra_teacher_price_cents?: number
          id?: string
          included_ai_messages?: number
          included_classes?: number
          included_students?: number
          included_teachers?: number
          is_active?: boolean
          is_custom?: boolean
          kind?: string
          name?: string
          sort_order?: number
          student_block_size?: number
          updated_at?: string
        }
        Relationships: []
      }
      poll_responses: {
        Row: {
          answer: string
          created_at: string
          id: string
          poll_id: string
          session_id: string
          student_label: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          poll_id: string
          session_id: string
          student_label: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          poll_id?: string
          session_id?: string
          student_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_responses_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          id: string
          kind: string
          prompt: string
          session_id: string
          status: string
          thread_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          prompt: string
          session_id: string
          status?: string
          thread_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          prompt?: string
          session_id?: string
          status?: string
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "polls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          approval_status: string
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          organization_id: string | null
          organization_name: string | null
          role: string
        }
        Insert: {
          account_status?: string
          approval_status?: string
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          organization_id?: string | null
          organization_name?: string | null
          role?: string
        }
        Update: {
          account_status?: string
          approval_status?: string
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          organization_id?: string | null
          organization_name?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_leads: {
        Row: {
          consent: boolean
          country: string
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          organization: string
          phone: string
          plan: string
          role: string
          status: string
          students: number | null
          teachers: number | null
          updated_at: string
        }
        Insert: {
          consent?: boolean
          country: string
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          organization: string
          phone: string
          plan?: string
          role: string
          status?: string
          students?: number | null
          teachers?: number | null
          updated_at?: string
        }
        Update: {
          consent?: boolean
          country?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          organization?: string
          phone?: string
          plan?: string
          role?: string
          status?: string
          students?: number | null
          teachers?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      session_blocks: {
        Row: {
          created_at: string
          id: string
          kind: string
          session_id: string
          student_label: string
          teacher_id: string
          until: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          session_id: string
          student_label: string
          teacher_id: string
          until?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          session_id?: string
          student_label?: string
          teacher_id?: string
          until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_blocks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_reactions: {
        Row: {
          created_at: string
          id: string
          kind: string
          session_id: string
          student_label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          session_id: string
          student_label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          session_id?: string
          student_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_reactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          chat_paused: boolean
          course_id: string
          ended_at: string | null
          id: string
          mode: string
          pinned_message_id: string | null
          quiz_answer_type: string | null
          quiz_options: Json
          quiz_prompt: string | null
          resolve_threshold: number
          started_at: string
          status: string
          teacher_id: string
          title: string
        }
        Insert: {
          chat_paused?: boolean
          course_id: string
          ended_at?: string | null
          id?: string
          mode?: string
          pinned_message_id?: string | null
          quiz_answer_type?: string | null
          quiz_options?: Json
          quiz_prompt?: string | null
          resolve_threshold?: number
          started_at?: string
          status?: string
          teacher_id: string
          title?: string
        }
        Update: {
          chat_paused?: boolean
          course_id?: string
          ended_at?: string | null
          id?: string
          mode?: string
          pinned_message_id?: string | null
          quiz_answer_type?: string | null
          quiz_options?: Json
          quiz_prompt?: string | null
          resolve_threshold?: number
          started_at?: string
          status?: string
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          ai_messages_allowed: number
          classes_allowed: number
          created_at: string
          current_period_end: string
          current_period_start: string
          custom_base_price_cents: number | null
          id: string
          is_free: boolean
          notes: string | null
          organization_id: string | null
          owner_user_id: string
          plan_id: string
          status: string
          storage_mb_allowed: number
          students_allowed: number
          teachers_allowed: number
          unlimited_ai: boolean
          unlimited_classes: boolean
          unlimited_storage: boolean
          unlimited_students: boolean
          unlimited_teachers: boolean
          updated_at: string
        }
        Insert: {
          ai_messages_allowed?: number
          classes_allowed?: number
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          custom_base_price_cents?: number | null
          id?: string
          is_free?: boolean
          notes?: string | null
          organization_id?: string | null
          owner_user_id: string
          plan_id: string
          status?: string
          storage_mb_allowed?: number
          students_allowed?: number
          teachers_allowed?: number
          unlimited_ai?: boolean
          unlimited_classes?: boolean
          unlimited_storage?: boolean
          unlimited_students?: boolean
          unlimited_teachers?: boolean
          updated_at?: string
        }
        Update: {
          ai_messages_allowed?: number
          classes_allowed?: number
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          custom_base_price_cents?: number | null
          id?: string
          is_free?: boolean
          notes?: string | null
          organization_id?: string | null
          owner_user_id?: string
          plan_id?: string
          status?: string
          storage_mb_allowed?: number
          students_allowed?: number
          teachers_allowed?: number
          unlimited_ai?: boolean
          unlimited_classes?: boolean
          unlimited_storage?: boolean
          unlimited_students?: boolean
          unlimited_teachers?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      thread_feedback: {
        Row: {
          created_at: string
          id: string
          session_id: string
          state: string
          student_label: string
          thread_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          state?: string
          student_label: string
          thread_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          state?: string
          student_label?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_feedback_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_participants: {
        Row: {
          created_at: string
          id: string
          session_id: string
          student_label: string
          thread_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          student_label: string
          thread_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          student_label?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_votes: {
        Row: {
          created_at: string
          id: string
          session_id: string
          student_label: string
          thread_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          student_label: string
          thread_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          student_label?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_votes_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          ai_failed: boolean
          archived_at: string | null
          category: string
          course_id: string | null
          created_at: string
          id: string
          last_activity_at: string
          session_id: string
          status: string
          teacher_id: string | null
          title: string
        }
        Insert: {
          ai_failed?: boolean
          archived_at?: string | null
          category?: string
          course_id?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          session_id: string
          status?: string
          teacher_id?: string | null
          title: string
        }
        Update: {
          ai_failed?: boolean
          archived_at?: string | null
          category?: string
          course_id?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          session_id?: string
          status?: string
          teacher_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          ai_messages: number
          created_at: string
          id: string
          period_month: string
          storage_bytes: number
          subscription_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ai_messages?: number
          created_at?: string
          id?: string
          period_month?: string
          storage_bytes?: number
          subscription_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ai_messages?: number
          created_at?: string
          id?: string
          period_month?: string
          storage_bytes?: number
          subscription_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
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
      can_post: {
        Args: { _label: string; _session_id: string }
        Returns: boolean
      }
      course_by_code: {
        Args: { _code: string }
        Returns: {
          id: string
          is_crash: boolean
          join_code: string
          teacher_id: string
          term: string
          title: string
        }[]
      }
      generate_course_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      in_session: { Args: { _session: string }; Returns: boolean }
      is_org_owner: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_staff: {
        Args: { _org: string; _user_id: string }
        Returns: boolean
      }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      is_session_student: { Args: { _session: string }; Returns: boolean }
      is_session_teacher: { Args: { _session: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "owner"
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
      app_role: ["admin", "owner"],
    },
  },
} as const
