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
      ai_chat_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string
          document_id: string | null
          id: string
          project_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          project_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          project_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ai_chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          project_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ai_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          citations: Json | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          mode: string | null
          role: string
          tokens_used: number | null
        }
        Insert: {
          citations?: Json | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          mode?: string | null
          role?: string
          tokens_used?: number | null
        }
        Update: {
          citations?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          mode?: string | null
          role?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          category: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          facade_id: string | null
          floor_number: number | null
          id: string
          is_read: boolean
          is_resolved: boolean
          photo_urls: string[] | null
          priority: string
          project_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          source_task_id: string | null
          synced_to_1c: string | null
          target_roles: Database["public"]["Enums"]["app_role"][] | null
          title: string
          type: string
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          facade_id?: string | null
          floor_number?: number | null
          id?: string
          is_read?: boolean
          is_resolved?: boolean
          photo_urls?: string[] | null
          priority?: string
          project_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_task_id?: string | null
          synced_to_1c?: string | null
          target_roles?: Database["public"]["Enums"]["app_role"][] | null
          title: string
          type?: string
        }
        Update: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          facade_id?: string | null
          floor_number?: number | null
          id?: string
          is_read?: boolean
          is_resolved?: boolean
          photo_urls?: string[] | null
          priority?: string
          project_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_task_id?: string | null
          synced_to_1c?: string | null
          target_roles?: Database["public"]["Enums"]["app_role"][] | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "holding_portfolio"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "alerts_facade_id_fkey"
            columns: ["facade_id"]
            isOneToOne: false
            referencedRelation: "facades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "ecosystem_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          decided_at: string | null
          decision_comment: string | null
          description: string | null
          entity_id: string | null
          id: string
          idempotency_key: string | null
          level: number
          project_id: string
          requested_by: string | null
          status: string
          title: string
          type: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          decided_at?: string | null
          decision_comment?: string | null
          description?: string | null
          entity_id?: string | null
          id?: string
          idempotency_key?: string | null
          level?: number
          project_id: string
          requested_by?: string | null
          status?: string
          title: string
          type: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          decided_at?: string | null
          decision_comment?: string | null
          description?: string | null
          entity_id?: string | null
          id?: string
          idempotency_key?: string | null
          level?: number
          project_id?: string
          requested_by?: string | null
          status?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "approvals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          correlation_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          correlation_id?: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          correlation_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: []
      }
      bot_audit_log: {
        Row: {
          action: string
          chat_id: string
          created_at: string
          duration_ms: number | null
          id: string
          payload: Json | null
          result: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          chat_id: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          payload?: Json | null
          result?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          chat_id?: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          payload?: Json | null
          result?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bot_documents: {
        Row: {
          comment: string | null
          created_at: string
          doc_type: string
          file_url: string | null
          id: string
          project_id: string | null
          recipients: string[]
          sender_id: string
          status: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          doc_type: string
          file_url?: string | null
          id?: string
          project_id?: string | null
          recipients?: string[]
          sender_id: string
          status?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          doc_type?: string
          file_url?: string | null
          id?: string
          project_id?: string | null
          recipients?: string[]
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bot_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_event_queue: {
        Row: {
          attempts: number
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          payload: Json | null
          priority: string
          processed_at: string | null
          project_id: string | null
          retry_count: number
          scheduled_at: string
          sent_at: string | null
          status: string
          target_chat_ids: string[] | null
          target_roles: string[] | null
          target_users: string[] | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          payload?: Json | null
          priority?: string
          processed_at?: string | null
          project_id?: string | null
          retry_count?: number
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          target_chat_ids?: string[] | null
          target_roles?: string[] | null
          target_users?: string[] | null
        }
        Update: {
          attempts?: number
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json | null
          priority?: string
          processed_at?: string | null
          project_id?: string | null
          retry_count?: number
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          target_chat_ids?: string[] | null
          target_roles?: string[] | null
          target_users?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_event_queue_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bot_event_queue_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_inbox: {
        Row: {
          created_at: string
          description: string | null
          file_url: string | null
          from_role: string
          from_user_id: string
          id: string
          project_id: string | null
          status: string
          title: string
          to_roles: string[]
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_url?: string | null
          from_role: string
          from_user_id: string
          id?: string
          project_id?: string | null
          status?: string
          title: string
          to_roles?: string[]
          type?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_url?: string | null
          from_role?: string
          from_user_id?: string
          id?: string
          project_id?: string | null
          status?: string
          title?: string
          to_roles?: string[]
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_inbox_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bot_inbox_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_sessions: {
        Row: {
          chat_id: string
          company_id: string | null
          context: Json
          expires_at: string
          message_id: number | null
          state: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          chat_id: string
          company_id?: string | null
          context?: Json
          expires_at?: string
          message_id?: number | null
          state?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          chat_id?: string
          company_id?: string | null
          context?: Json
          expires_at?: string
          message_id?: number | null
          state?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "holding_portfolio"
            referencedColumns: ["company_id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          doc_type_1c: string | null
          end_date: string | null
          id: string
          is_done: boolean
          priority: string | null
          project_id: string | null
          ref_1c: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          doc_type_1c?: string | null
          end_date?: string | null
          id?: string
          is_done?: boolean
          priority?: string | null
          project_id?: string | null
          ref_1c?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          doc_type_1c?: string | null
          end_date?: string | null
          id?: string
          is_done?: boolean
          priority?: string | null
          project_id?: string | null
          ref_1c?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          bot_token: string | null
          bot_username: string | null
          code: string | null
          created_at: string | null
          holding_id: string | null
          id: string
          inn: string | null
          is_active: boolean | null
          logo_url: string | null
          mini_app_url: string | null
          name: string
          primary_color: string | null
          settings: Json | null
        }
        Insert: {
          bot_token?: string | null
          bot_username?: string | null
          code?: string | null
          created_at?: string | null
          holding_id?: string | null
          id?: string
          inn?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          mini_app_url?: string | null
          name: string
          primary_color?: string | null
          settings?: Json | null
        }
        Update: {
          bot_token?: string | null
          bot_username?: string | null
          code?: string | null
          created_at?: string | null
          holding_id?: string | null
          id?: string
          inn?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          mini_app_url?: string | null
          name?: string
          primary_color?: string | null
          settings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "holding_portfolio"
            referencedColumns: ["company_id"]
          },
        ]
      }
      crews: {
        Row: {
          company_id: string | null
          created_at: string
          facade_id: string | null
          foreman_name: string | null
          foreman_user_id: string | null
          headcount: number
          id: string
          is_active: boolean
          name: string
          project_id: string | null
          specialization: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          facade_id?: string | null
          foreman_name?: string | null
          foreman_user_id?: string | null
          headcount?: number
          id?: string
          is_active?: boolean
          name: string
          project_id?: string | null
          specialization?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          facade_id?: string | null
          foreman_name?: string | null
          foreman_user_id?: string | null
          headcount?: number
          id?: string
          is_active?: boolean
          name?: string
          project_id?: string | null
          specialization?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "holding_portfolio"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "crews_facade_id_fkey"
            columns: ["facade_id"]
            isOneToOne: false
            referencedRelation: "facades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "crews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          created_at: string | null
          date: string
          id: string
          issues_description: string | null
          photo_urls: string[] | null
          project_id: string
          review_comment: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string | null
          updated_at: string | null
          volume: string | null
          weather: string | null
          workers_count: number | null
          works_description: string
          zone_name: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          issues_description?: string | null
          photo_urls?: string[] | null
          project_id: string
          review_comment?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          updated_at?: string | null
          volume?: string | null
          weather?: string | null
          workers_count?: number | null
          works_description: string
          zone_name?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          issues_description?: string | null
          photo_urls?: string[] | null
          project_id?: string
          review_comment?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          updated_at?: string | null
          volume?: string | null
          weather?: string | null
          workers_count?: number | null
          works_description?: string
          zone_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "daily_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_folders: {
        Row: {
          created_at: string
          department: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          project_id: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          department: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          project_id?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          department?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          project_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_folders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "document_folders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          ai_summary: string | null
          category: string | null
          created_at: string
          file_size: number | null
          file_type: string
          file_url: string
          folder_id: string | null
          id: string
          name: string
          parsed_text: string | null
          project_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          ai_summary?: string | null
          category?: string | null
          created_at?: string
          file_size?: number | null
          file_type?: string
          file_url: string
          folder_id?: string | null
          id?: string
          name: string
          parsed_text?: string | null
          project_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          ai_summary?: string | null
          category?: string | null
          created_at?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          folder_id?: string | null
          id?: string
          name?: string
          parsed_text?: string | null
          project_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ecosystem_tasks: {
        Row: {
          assigned_role: string | null
          assigned_to: string | null
          block: string
          code: string
          created_at: string
          deadline: string | null
          department: string
          dependency_ids: string | null
          duration_days: number | null
          facade_id: string | null
          id: string
          input_document: string | null
          name: string
          notes: string | null
          notification_type: string | null
          output_document: string | null
          planned_date: string | null
          priority: string
          progress: number
          project_id: string | null
          recipient: string | null
          reminder_sent: boolean | null
          responsible: string | null
          status: string
          task_number: number
          trigger_text: string | null
          updated_at: string
        }
        Insert: {
          assigned_role?: string | null
          assigned_to?: string | null
          block: string
          code: string
          created_at?: string
          deadline?: string | null
          department: string
          dependency_ids?: string | null
          duration_days?: number | null
          facade_id?: string | null
          id?: string
          input_document?: string | null
          name: string
          notes?: string | null
          notification_type?: string | null
          output_document?: string | null
          planned_date?: string | null
          priority?: string
          progress?: number
          project_id?: string | null
          recipient?: string | null
          reminder_sent?: boolean | null
          responsible?: string | null
          status?: string
          task_number: number
          trigger_text?: string | null
          updated_at?: string
        }
        Update: {
          assigned_role?: string | null
          assigned_to?: string | null
          block?: string
          code?: string
          created_at?: string
          deadline?: string | null
          department?: string
          dependency_ids?: string | null
          duration_days?: number | null
          facade_id?: string | null
          id?: string
          input_document?: string | null
          name?: string
          notes?: string | null
          notification_type?: string | null
          output_document?: string | null
          planned_date?: string | null
          priority?: string
          progress?: number
          project_id?: string | null
          recipient?: string | null
          reminder_sent?: boolean | null
          responsible?: string | null
          status?: string
          task_number?: number
          trigger_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ecosystem_tasks_facade_id_fkey"
            columns: ["facade_id"]
            isOneToOne: false
            referencedRelation: "facades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecosystem_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ecosystem_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      facades: {
        Row: {
          axes: string | null
          code: string | null
          created_at: string
          floors_count: number
          id: string
          name: string
          project_id: string | null
          total_modules: number
        }
        Insert: {
          axes?: string | null
          code?: string | null
          created_at?: string
          floors_count?: number
          id?: string
          name: string
          project_id?: string | null
          total_modules?: number
        }
        Update: {
          axes?: string | null
          code?: string | null
          created_at?: string
          floors_count?: number
          id?: string
          name?: string
          project_id?: string | null
          total_modules?: number
        }
        Relationships: [
          {
            foreignKeyName: "facades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "facades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      floors: {
        Row: {
          brackets_fact: number
          brackets_plan: number
          elevation: string | null
          facade_id: string
          floor_number: number
          id: string
          module_height: number | null
          module_type: string | null
          module_width: number | null
          modules_fact: number
          modules_plan: number
          photo_urls: string[] | null
          sealant_fact: number
          sealant_plan: number
          status: string
          updated_at: string
        }
        Insert: {
          brackets_fact?: number
          brackets_plan?: number
          elevation?: string | null
          facade_id: string
          floor_number: number
          id?: string
          module_height?: number | null
          module_type?: string | null
          module_width?: number | null
          modules_fact?: number
          modules_plan?: number
          photo_urls?: string[] | null
          sealant_fact?: number
          sealant_plan?: number
          status?: string
          updated_at?: string
        }
        Update: {
          brackets_fact?: number
          brackets_plan?: number
          elevation?: string | null
          facade_id?: string
          floor_number?: number
          id?: string
          module_height?: number | null
          module_type?: string | null
          module_width?: number | null
          modules_fact?: number
          modules_plan?: number
          photo_urls?: string[] | null
          sealant_fact?: number
          sealant_plan?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "floors_facade_id_fkey"
            columns: ["facade_id"]
            isOneToOne: false
            referencedRelation: "facades"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_documents: {
        Row: {
          ai_content: string | null
          created_at: string
          created_by: string
          file_type: string
          file_url: string | null
          id: string
          params: Json | null
          project_id: string | null
          template_type: string
          title: string
        }
        Insert: {
          ai_content?: string | null
          created_at?: string
          created_by: string
          file_type?: string
          file_url?: string | null
          id?: string
          params?: Json | null
          project_id?: string | null
          template_type: string
          title: string
        }
        Update: {
          ai_content?: string | null
          created_at?: string
          created_by?: string
          file_type?: string
          file_url?: string | null
          id?: string
          params?: Json | null
          project_id?: string | null
          template_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "generated_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          category: string | null
          code_1c: string | null
          company_id: string | null
          deficit: number
          eta: string | null
          id: string
          in_production: number
          installed: number
          name: string
          on_site: number
          order_date: string | null
          ordered: number
          price_per_unit: number | null
          project_id: string | null
          shipped: number
          status: string
          supplier: string | null
          supplier_code_1c: string | null
          supplier_inn: string | null
          synced_to_1c: string | null
          total_required: number
          unit: string
          updated_at: string
          updated_from_1c: string | null
        }
        Insert: {
          category?: string | null
          code_1c?: string | null
          company_id?: string | null
          deficit?: number
          eta?: string | null
          id?: string
          in_production?: number
          installed?: number
          name: string
          on_site?: number
          order_date?: string | null
          ordered?: number
          price_per_unit?: number | null
          project_id?: string | null
          shipped?: number
          status?: string
          supplier?: string | null
          supplier_code_1c?: string | null
          supplier_inn?: string | null
          synced_to_1c?: string | null
          total_required?: number
          unit: string
          updated_at?: string
          updated_from_1c?: string | null
        }
        Update: {
          category?: string | null
          code_1c?: string | null
          company_id?: string | null
          deficit?: number
          eta?: string | null
          id?: string
          in_production?: number
          installed?: number
          name?: string
          on_site?: number
          order_date?: string | null
          ordered?: number
          price_per_unit?: number | null
          project_id?: string | null
          shipped?: number
          status?: string
          supplier?: string | null
          supplier_code_1c?: string | null
          supplier_inn?: string | null
          synced_to_1c?: string | null
          total_required?: number
          unit?: string
          updated_at?: string
          updated_from_1c?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "holding_portfolio"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      norm_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          document_id: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          section_title: string | null
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          document_id?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          section_title?: string | null
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          document_id?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          section_title?: string | null
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "norm_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "norm_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      norm_documents: {
        Row: {
          category: string | null
          code: string
          created_at: string | null
          doc_type: string | null
          id: string
          metadata: Json | null
          raw_text: string | null
          source: string
          status: string | null
          title: string
          updated_at: string | null
          url: string | null
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string | null
          doc_type?: string | null
          id?: string
          metadata?: Json | null
          raw_text?: string | null
          source: string
          status?: string | null
          title: string
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string | null
          doc_type?: string | null
          id?: string
          metadata?: Json | null
          raw_text?: string | null
          source?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      notifications_config: {
        Row: {
          created_at: string | null
          deadline_alerts: boolean | null
          dnd_end: string | null
          dnd_start: string | null
          id: string
          morning_briefing: boolean | null
          report_reminder: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deadline_alerts?: boolean | null
          dnd_end?: string | null
          dnd_start?: string | null
          id?: string
          morning_briefing?: boolean | null
          report_reminder?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          deadline_alerts?: boolean | null
          dnd_end?: string | null
          dnd_start?: string | null
          id?: string
          morning_briefing?: boolean | null
          report_reminder?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      onboarding_attempts: {
        Row: {
          answers: Json | null
          attempt_number: number
          created_at: string
          id: string
          passed: boolean
          read_seconds: number | null
          role: string
          score: number
          total: number
          user_id: string
        }
        Insert: {
          answers?: Json | null
          attempt_number?: number
          created_at?: string
          id?: string
          passed: boolean
          read_seconds?: number | null
          role: string
          score: number
          total?: number
          user_id: string
        }
        Update: {
          answers?: Json | null
          attempt_number?: number
          created_at?: string
          id?: string
          passed?: boolean
          read_seconds?: number | null
          role?: string
          score?: number
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          actual_delivery: string | null
          company_id: string | null
          created_at: string
          expected_delivery: string | null
          id: string
          material_id: string | null
          material_name: string
          notes: string | null
          order_date: string | null
          order_number: string | null
          order_number_1c: string | null
          price_per_unit: number | null
          project_id: string | null
          quantity: number
          status: string
          supplier: string
          supplier_code_1c: string | null
          supplier_inn: string | null
          supplier_name: string | null
          synced_to_1c: string | null
          total_amount: number | null
          unit: string
          updated_at: string | null
          updated_from_1c: string | null
        }
        Insert: {
          actual_delivery?: string | null
          company_id?: string | null
          created_at?: string
          expected_delivery?: string | null
          id?: string
          material_id?: string | null
          material_name: string
          notes?: string | null
          order_date?: string | null
          order_number?: string | null
          order_number_1c?: string | null
          price_per_unit?: number | null
          project_id?: string | null
          quantity?: number
          status?: string
          supplier: string
          supplier_code_1c?: string | null
          supplier_inn?: string | null
          supplier_name?: string | null
          synced_to_1c?: string | null
          total_amount?: number | null
          unit?: string
          updated_at?: string | null
          updated_from_1c?: string | null
        }
        Update: {
          actual_delivery?: string | null
          company_id?: string | null
          created_at?: string
          expected_delivery?: string | null
          id?: string
          material_id?: string | null
          material_name?: string
          notes?: string | null
          order_date?: string | null
          order_number?: string | null
          order_number_1c?: string | null
          price_per_unit?: number | null
          project_id?: string | null
          quantity?: number
          status?: string
          supplier?: string
          supplier_code_1c?: string | null
          supplier_inn?: string | null
          supplier_name?: string | null
          synced_to_1c?: string | null
          total_amount?: number | null
          unit?: string
          updated_at?: string | null
          updated_from_1c?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "holding_portfolio"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "orders_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_fact: {
        Row: {
          company_id: string | null
          created_at: string
          crew_id: string | null
          date: string
          facade_id: string | null
          fact_value: number
          floor_id: string | null
          id: string
          input_type: string | null
          notes: string | null
          photo_urls: string[] | null
          plan_value: number
          project_id: string | null
          ref_1c: string | null
          reported_by: string | null
          synced_to_1c: string | null
          updated_at: string
          week_number: number
          work_type_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          crew_id?: string | null
          date: string
          facade_id?: string | null
          fact_value?: number
          floor_id?: string | null
          id?: string
          input_type?: string | null
          notes?: string | null
          photo_urls?: string[] | null
          plan_value?: number
          project_id?: string | null
          ref_1c?: string | null
          reported_by?: string | null
          synced_to_1c?: string | null
          updated_at?: string
          week_number: number
          work_type_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          crew_id?: string | null
          date?: string
          facade_id?: string | null
          fact_value?: number
          floor_id?: string | null
          id?: string
          input_type?: string | null
          notes?: string | null
          photo_urls?: string[] | null
          plan_value?: number
          project_id?: string | null
          ref_1c?: string | null
          reported_by?: string | null
          synced_to_1c?: string | null
          updated_at?: string
          week_number?: number
          work_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_fact_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_fact_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "holding_portfolio"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "plan_fact_facade_id_fkey"
            columns: ["facade_id"]
            isOneToOne: false
            referencedRelation: "facades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_fact_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_fact_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "plan_fact_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_fact_work_type_id_fkey"
            columns: ["work_type_id"]
            isOneToOne: false
            referencedRelation: "work_types"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          last_active_at: string | null
          notification_preferences: Json | null
          onboarding_attempts_count: number
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          phone: string | null
          pin_hash: string | null
          position: string | null
          telegram_chat_id: string | null
          telegram_username: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          last_active_at?: string | null
          notification_preferences?: Json | null
          onboarding_attempts_count?: number
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          phone?: string | null
          pin_hash?: string | null
          position?: string | null
          telegram_chat_id?: string | null
          telegram_username?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          last_active_at?: string | null
          notification_preferences?: Json | null
          onboarding_attempts_count?: number
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          phone?: string | null
          pin_hash?: string | null
          position?: string | null
          telegram_chat_id?: string | null
          telegram_username?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "holding_portfolio"
            referencedColumns: ["company_id"]
          },
        ]
      }
      project_chats: {
        Row: {
          category: string
          chat_type: string | null
          created_at: string
          created_by: string | null
          id: string
          last_message: string | null
          last_message_at: string | null
          name: string
          project_id: string
          reference_id: string | null
          sort_order: number | null
          telegram_chat_id: string | null
          telegram_link: string
          unread_count: number | null
        }
        Insert: {
          category: string
          chat_type?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          name: string
          project_id: string
          reference_id?: string | null
          sort_order?: number | null
          telegram_chat_id?: string | null
          telegram_link: string
          unread_count?: number | null
        }
        Update: {
          category?: string
          chat_type?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          name?: string
          project_id?: string
          reference_id?: string | null
          sort_order?: number | null
          telegram_chat_id?: string | null
          telegram_link?: string
          unread_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_chats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_chats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          city: string | null
          client_account: string | null
          client_actual_address: string | null
          client_bank: string | null
          client_director: string | null
          client_email: string | null
          client_inn: string | null
          client_kpp: string | null
          client_legal_address: string | null
          client_name: string | null
          client_ogrn: string | null
          client_phone: string | null
          code: string | null
          company_id: string | null
          contacts: Json | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          duration_days: number | null
          end_date: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          photo_url: string | null
          start_date: string | null
          status: string
          updated_at: string
          work_type: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          client_account?: string | null
          client_actual_address?: string | null
          client_bank?: string | null
          client_director?: string | null
          client_email?: string | null
          client_inn?: string | null
          client_kpp?: string | null
          client_legal_address?: string | null
          client_name?: string | null
          client_ogrn?: string | null
          client_phone?: string | null
          code?: string | null
          company_id?: string | null
          contacts?: Json | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          duration_days?: number | null
          end_date?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          photo_url?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          work_type?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          client_account?: string | null
          client_actual_address?: string | null
          client_bank?: string | null
          client_director?: string | null
          client_email?: string | null
          client_inn?: string | null
          client_kpp?: string | null
          client_legal_address?: string | null
          client_name?: string | null
          client_ogrn?: string | null
          client_phone?: string | null
          code?: string | null
          company_id?: string | null
          contacts?: Json | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          duration_days?: number | null
          end_date?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          photo_url?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "holding_portfolio"
            referencedColumns: ["company_id"]
          },
        ]
      }
      shipments: {
        Row: {
          batch_number: string | null
          created_at: string
          defect_count: number | null
          defect_notes: string | null
          eta: string | null
          id: string
          material_id: string
          notes: string | null
          quality_status: string | null
          quantity: number
          received_at: string | null
          shipped_at: string | null
          status: string
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          defect_count?: number | null
          defect_notes?: string | null
          eta?: string | null
          id?: string
          material_id: string
          notes?: string | null
          quality_status?: string | null
          quantity: number
          received_at?: string | null
          shipped_at?: string | null
          status?: string
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          defect_count?: number | null
          defect_notes?: string | null
          eta?: string | null
          id?: string
          material_id?: string
          notes?: string | null
          quality_status?: string | null
          quantity?: number
          received_at?: string | null
          shipped_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_acceptance: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          facade_id: string | null
          floor_id: string | null
          foreman_id: string | null
          id: string
          inspected_at: string | null
          inspector_id: string | null
          notes: string | null
          project_id: string | null
          pto_id: string | null
          ready_at: string | null
          stage: string
          status: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          facade_id?: string | null
          floor_id?: string | null
          foreman_id?: string | null
          id?: string
          inspected_at?: string | null
          inspector_id?: string | null
          notes?: string | null
          project_id?: string | null
          pto_id?: string | null
          ready_at?: string | null
          stage: string
          status?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          facade_id?: string | null
          floor_id?: string | null
          foreman_id?: string | null
          id?: string
          inspected_at?: string | null
          inspector_id?: string | null
          notes?: string | null
          project_id?: string | null
          pto_id?: string | null
          ready_at?: string | null
          stage?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stage_acceptance_facade_id_fkey"
            columns: ["facade_id"]
            isOneToOne: false
            referencedRelation: "facades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_acceptance_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_acceptance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stage_acceptance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_config: {
        Row: {
          column_mapping: Json | null
          created_at: string
          created_by: string | null
          direction: string
          id: string
          is_active: boolean
          last_error: string | null
          last_synced_at: string | null
          sheet_id: string
          sheet_name: string
          sync_interval_minutes: number | null
          target_table: string
        }
        Insert: {
          column_mapping?: Json | null
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_synced_at?: string | null
          sheet_id: string
          sheet_name: string
          sync_interval_minutes?: number | null
          target_table: string
        }
        Update: {
          column_mapping?: Json | null
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_synced_at?: string | null
          sheet_id?: string
          sheet_name?: string
          sync_interval_minutes?: number | null
          target_table?: string
        }
        Relationships: []
      }
      sync_log: {
        Row: {
          company_id: string | null
          details: string | null
          direction: string
          entity: string
          errors_count: number | null
          id: string
          records_synced: number | null
          synced_at: string | null
        }
        Insert: {
          company_id?: string | null
          details?: string | null
          direction: string
          entity: string
          errors_count?: number | null
          id?: string
          records_synced?: number | null
          synced_at?: string | null
        }
        Update: {
          company_id?: string | null
          details?: string | null
          direction?: string
          entity?: string
          errors_count?: number | null
          id?: string
          records_synced?: number | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "holding_portfolio"
            referencedColumns: ["company_id"]
          },
        ]
      }
      telegram_notification_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          message_preview: string | null
          project_id: string | null
          success: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          message_preview?: string | null
          project_id?: string | null
          success?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          message_preview?: string | null
          project_id?: string | null
          success?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_notification_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "telegram_notification_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          scope: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          scope?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          scope?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "holding_portfolio"
            referencedColumns: ["company_id"]
          },
        ]
      }
      user_xp: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          project_id: string | null
          user_id: string
          xp: number
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          project_id?: string | null
          user_id: string
          xp?: number
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          project_id?: string | null
          user_id?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_xp_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "user_xp_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      work_types: {
        Row: {
          created_at: string
          duration_days: number | null
          end_date: string | null
          facade_id: string | null
          id: string
          name: string
          project_id: string | null
          section: string
          sort_number: number | null
          start_date: string | null
          subsection: string | null
          unit: string
          volume: number | null
          workers_count: number | null
        }
        Insert: {
          created_at?: string
          duration_days?: number | null
          end_date?: string | null
          facade_id?: string | null
          id?: string
          name: string
          project_id?: string | null
          section: string
          sort_number?: number | null
          start_date?: string | null
          subsection?: string | null
          unit: string
          volume?: number | null
          workers_count?: number | null
        }
        Update: {
          created_at?: string
          duration_days?: number | null
          end_date?: string | null
          facade_id?: string | null
          id?: string
          name?: string
          project_id?: string | null
          section?: string
          sort_number?: number | null
          start_date?: string | null
          subsection?: string | null
          unit?: string
          volume?: number | null
          workers_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "work_types_facade_id_fkey"
            columns: ["facade_id"]
            isOneToOne: false
            referencedRelation: "facades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_types_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "work_types_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      holding_portfolio: {
        Row: {
          active_projects: number | null
          avg_progress: number | null
          company_code: string | null
          company_id: string | null
          company_name: string | null
          critical_alerts: number | null
          deficit_materials: number | null
          nearest_deadline_days: number | null
          total_alerts: number | null
          total_projects: number | null
        }
        Relationships: []
      }
      onboarding_analytics: {
        Row: {
          avg_read_seconds: number | null
          best_score: number | null
          display_name: string | null
          onboarding_attempts_count: number | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string | null
        }
        Relationships: []
      }
      overdue_events: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string | null
          days_overdue: number | null
          description: string | null
          doc_type_1c: string | null
          end_date: string | null
          id: string | null
          is_done: boolean | null
          priority: string | null
          project_id: string | null
          project_name: string | null
          ref_1c: string | null
          title: string | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_stats: {
        Row: {
          critical_alerts: number | null
          days_until_deadline: number | null
          deficit_materials: number | null
          open_alerts: number | null
          progress_pct: number | null
          project_code: string | null
          project_id: string | null
          project_name: string | null
          project_status: string | null
          total_fact: number | null
          total_plan: number | null
        }
        Relationships: []
      }
      upcoming_events: {
        Row: {
          date: string | null
          days_until: number | null
          id: string | null
          is_done: boolean | null
          project_id: string | null
          project_name: string | null
          ref_1c: string | null
          title: string | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "portfolio_stats"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accessible_company_ids: { Args: never; Returns: string[] }
      cleanup_expired_bot_sessions: { Args: never; Returns: number }
      cleanup_sync_log: { Args: never; Returns: undefined }
      current_company_id: { Args: never; Returns: string }
      get_user_roles: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_holding_director: { Args: never; Returns: boolean }
      record_onboarding_attempt: {
        Args: {
          p_answers: Json
          p_passed: boolean
          p_read_seconds: number
          p_role: string
          p_score: number
          p_total: number
        }
        Returns: Json
      }
      refresh_portfolio_stats: { Args: never; Returns: undefined }
      search_norm_chunks: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_id: string
          content: string
          document_code: string
          document_id: string
          document_title: string
          score: number
          section: string
          source_url: string
        }[]
      }
      seed_project_folders: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      user_project_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      app_role:
        | "director"
        | "pm"
        | "project"
        | "supply"
        | "production"
        | "foreman1"
        | "foreman2"
        | "foreman3"
        | "pto"
        | "inspector"
        | "project_opr"
        | "project_km"
        | "project_kmd"
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
        "director",
        "pm",
        "project",
        "supply",
        "production",
        "foreman1",
        "foreman2",
        "foreman3",
        "pto",
        "inspector",
        "project_opr",
        "project_km",
        "project_kmd",
      ],
    },
  },
} as const
