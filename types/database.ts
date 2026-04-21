// ============================================================
// Business OS — Supabase Database Types
//
// Hand-maintained reflection of the schema in supabase/migrations/.
// Mirrors the state AFTER all migrations 001–014 have been applied.
//
// Shape matches what `supabase gen types typescript` produces:
//   - Each table has Row / Insert / Update / Relationships.
//   - Insert/Update are explicit object types (NOT generic helpers)
//     because Supabase's PostgREST overloads do structural matching
//     on the concrete type — generics resolve to `never`.
//   - Every table has `Relationships: []` (empty is fine; the app
//     doesn't use typed relationship joins).
//
// Regeneration:
//   Fix supabase/config.toml (remove invalid `project` key) then
//   run `pnpm db:types`. Until then this file is the source of truth.
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ─── ENUM-LIKE STRING LITERALS ───
// These match the CHECK constraints in the database. They're exported
// separately for use in application code.

export type DbMode = 'personal' | 'agency';
export type DbTone = 'formal' | 'conversational' | 'confident';
export type DbPreferredChannel = 'email' | 'whatsapp' | 'phone';

// Post-migration 006
export type DbClientStage =
  | 'lead' | 'contacted' | 'qualified'
  | 'proposal_sent' | 'proposal_accepted'
  | 'contract_sent' | 'contract_signed'
  | 'upfront_paid' | 'requirements_sent' | 'requirements_received' | 'credentials_pending'
  | 'in_progress' | 'milestone_review' | 'revision'
  | 'final_review' | 'final_payment_sent' | 'final_payment_received'
  | 'handover' | 'deployed'
  | 'support_active' | 'feedback_sent' | 'retention_sent' | 'completed';

export type DbDocumentType = 'proposal' | 'contract' | 'sow' | 'requirements' | 'invoice' | 'delivery';
// Post-migrations 009 + 014
export type DbDocumentStatus = 'draft' | 'final' | 'sent' | 'viewed' | 'signed' | 'paid' | 'overdue';

export type DbLeadStage =
  | 'prospect' | 'contacted' | 'replied' | 'meeting_scheduled'
  | 'proposal_sent' | 'negotiating' | 'closed_won' | 'closed_lost';

// Post-migrations 010 + 011
export type DbOutreachChannel = 'linkedin' | 'email' | 'whatsapp' | 'phone' | 'cold_call' | 'instagram' | 'other';

export type DbTransactionType = 'income' | 'expense';
export type DbBillingCycle = 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
export type DbSubscriptionStatus = 'active' | 'paused' | 'cancelled';

// Post-migration 010
export type DbSocialPlatform = 'linkedin' | 'github' | 'twitter' | 'instagram' | 'other';
export type DbSocialPostStatus = 'idea' | 'draft' | 'scheduled' | 'published';
export type DbTimeBlockType = 'deep' | 'outreach' | 'admin' | 'personal';
export type DbQuickLogType = 'lead' | 'call' | 'client_note' | 'payment' | 'task' | 'other';
export type DbTestimonialSource = 'direct' | 'linkedin' | 'email' | 'form';
export type DbBosUserRole = 'superadmin' | 'admin';
export type DbSignatureType = 'typed' | 'drawn';

// ============================================================
// Database
// ============================================================

export interface Database {
  public: {
    Tables: {
      // ─── brand_profiles ───
      brand_profiles: {
        Row: {
          id: string;
          user_id: string;
          mode: DbMode;
          logo_url: string | null;
          signature_url: string | null;
          signature_type: 'drawn' | 'uploaded' | null;
          primary_colour: string;
          secondary_colour: string;
          font_choice: string;
          tone: DbTone;
          business_name: string;
          tagline: string | null;
          phone: string | null;
          whatsapp: string | null;
          email: string | null;
          website: string | null;
          address: string | null;
          gst_number: string | null;
          bank_name: string | null;
          bank_account_number: string | null;
          bank_ifsc: string | null;
          bank_upi: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: DbMode;
          logo_url?: string | null;
          signature_url?: string | null;
          signature_type?: 'drawn' | 'uploaded' | null;
          primary_colour?: string;
          secondary_colour?: string;
          font_choice?: string;
          tone?: DbTone;
          business_name?: string;
          tagline?: string | null;
          phone?: string | null;
          whatsapp?: string | null;
          email?: string | null;
          website?: string | null;
          address?: string | null;
          gst_number?: string | null;
          bank_name?: string | null;
          bank_account_number?: string | null;
          bank_ifsc?: string | null;
          bank_upi?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: DbMode;
          logo_url?: string | null;
          signature_url?: string | null;
          signature_type?: 'drawn' | 'uploaded' | null;
          primary_colour?: string;
          secondary_colour?: string;
          font_choice?: string;
          tone?: DbTone;
          business_name?: string;
          tagline?: string | null;
          phone?: string | null;
          whatsapp?: string | null;
          email?: string | null;
          website?: string | null;
          address?: string | null;
          gst_number?: string | null;
          bank_name?: string | null;
          bank_account_number?: string | null;
          bank_ifsc?: string | null;
          bank_upi?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ─── clients (with migration 005 additions) ───
      clients: {
        Row: {
          id: string;
          user_id: string;
          mode: DbMode;
          name: string;
          company: string | null;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          preferred_channel: DbPreferredChannel | null;
          notes: string;
          current_stage: DbClientStage;
          stage_history: Json;
          service_type: string | null;
          credentials: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: DbMode;
          name: string;
          company?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          preferred_channel?: DbPreferredChannel | null;
          notes?: string;
          current_stage?: DbClientStage;
          stage_history?: Json;
          service_type?: string | null;
          credentials?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: DbMode;
          name?: string;
          company?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          preferred_channel?: DbPreferredChannel | null;
          notes?: string;
          current_stage?: DbClientStage;
          stage_history?: Json;
          service_type?: string | null;
          credentials?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ─── documents (migrations 008, 009, 013, 014) ───
      documents: {
        Row: {
          id: string;
          user_id: string;
          mode: DbMode;
          type: DbDocumentType;
          client_id: string | null;
          title: string;
          fields: Json;
          status: DbDocumentStatus;
          share_token: string | null;
          signed_at: string | null;
          signer_name: string | null;
          access_code: string | null;
          access_code_expires_at: string | null;
          edit_count: number;
          last_edited_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: DbMode;
          type: DbDocumentType;
          client_id?: string | null;
          title?: string;
          fields?: Json;
          status?: DbDocumentStatus;
          share_token?: string | null;
          signed_at?: string | null;
          signer_name?: string | null;
          access_code?: string | null;
          access_code_expires_at?: string | null;
          edit_count?: number;
          last_edited_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: DbMode;
          type?: DbDocumentType;
          client_id?: string | null;
          title?: string;
          fields?: Json;
          status?: DbDocumentStatus;
          share_token?: string | null;
          signed_at?: string | null;
          signer_name?: string | null;
          access_code?: string | null;
          access_code_expires_at?: string | null;
          edit_count?: number;
          last_edited_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ─── signatures (migration 008) ───
      signatures: {
        Row: {
          id: string;
          document_id: string;
          signer_name: string;
          signed_at: string;
          ip_address: string | null;
          signature_type: DbSignatureType | null;
          signature_data: string | null;
          signed_date: string | null;
        };
        Insert: {
          id?: string;
          document_id: string;
          signer_name: string;
          signed_at?: string;
          ip_address?: string | null;
          signature_type?: DbSignatureType | null;
          signature_data?: string | null;
          signed_date?: string | null;
        };
        Update: {
          id?: string;
          document_id?: string;
          signer_name?: string;
          signed_at?: string;
          ip_address?: string | null;
          signature_type?: DbSignatureType | null;
          signature_data?: string | null;
          signed_date?: string | null;
        };
        Relationships: [];
      };

      // ─── document_versions (append-only snapshots, incremental 018) ───
      document_versions: {
        Row: {
          id: string;
          document_id: string;
          user_id: string;
          version_number: number;
          fields: Json;
          title: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          user_id: string;
          version_number: number;
          fields?: Json;
          title?: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          user_id?: string;
          version_number?: number;
          fields?: Json;
          title?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };

      // ─── leads (with migration 011 additions) ───
      leads: {
        Row: {
          id: string;
          user_id: string;
          mode: DbMode;
          company: string;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          source: string | null;
          stage: DbLeadStage;
          notes: Json;
          last_activity_at: string;
          next_action: string | null;
          next_action_date: string | null;
          deal_value: number | null;
          channel: DbOutreachChannel | null;
          profile_url: string | null;
          context: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: DbMode;
          company: string;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          source?: string | null;
          stage?: DbLeadStage;
          notes?: Json;
          last_activity_at?: string;
          next_action?: string | null;
          next_action_date?: string | null;
          deal_value?: number | null;
          channel?: DbOutreachChannel | null;
          profile_url?: string | null;
          context?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: DbMode;
          company?: string;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          source?: string | null;
          stage?: DbLeadStage;
          notes?: Json;
          last_activity_at?: string;
          next_action?: string | null;
          next_action_date?: string | null;
          deal_value?: number | null;
          channel?: DbOutreachChannel | null;
          profile_url?: string | null;
          context?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ─── transactions ───
      transactions: {
        Row: {
          id: string;
          user_id: string;
          mode: DbMode;
          type: DbTransactionType;
          category: string;
          amount: number;
          description: string | null;
          date: string;
          invoice_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: DbMode;
          type: DbTransactionType;
          category: string;
          amount?: number;
          description?: string | null;
          date?: string;
          invoice_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: DbMode;
          type?: DbTransactionType;
          category?: string;
          amount?: number;
          description?: string | null;
          date?: string;
          invoice_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ─── subscriptions ───
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          mode: DbMode;
          name: string;
          category: string;
          cost: number;
          billing_cycle: DbBillingCycle;
          next_renewal_at: string;
          status: DbSubscriptionStatus;
          auto_pay: boolean;
          last_reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: DbMode;
          name: string;
          category?: string;
          cost?: number;
          billing_cycle?: DbBillingCycle;
          next_renewal_at: string;
          status?: DbSubscriptionStatus;
          auto_pay?: boolean;
          last_reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: DbMode;
          name?: string;
          category?: string;
          cost?: number;
          billing_cycle?: DbBillingCycle;
          next_renewal_at?: string;
          status?: DbSubscriptionStatus;
          auto_pay?: boolean;
          last_reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ─── social_posts ───
      social_posts: {
        Row: {
          id: string;
          user_id: string;
          mode: DbMode;
          platform: DbSocialPlatform;
          title: string | null;
          content: string | null;
          planned_date: string | null;
          status: DbSocialPostStatus;
          engagement_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: DbMode;
          platform?: DbSocialPlatform;
          title?: string | null;
          content?: string | null;
          planned_date?: string | null;
          status?: DbSocialPostStatus;
          engagement_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: DbMode;
          platform?: DbSocialPlatform;
          title?: string | null;
          content?: string | null;
          planned_date?: string | null;
          status?: DbSocialPostStatus;
          engagement_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ─── time_blocks ───
      time_blocks: {
        Row: {
          id: string;
          user_id: string;
          mode: DbMode;
          date: string;
          type: DbTimeBlockType;
          start_time: string;
          end_time: string;
          label: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: DbMode;
          date?: string;
          type: DbTimeBlockType;
          start_time: string;
          end_time: string;
          label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: DbMode;
          date?: string;
          type?: DbTimeBlockType;
          start_time?: string;
          end_time?: string;
          label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ─── priorities ───
      priorities: {
        Row: {
          id: string;
          user_id: string;
          mode: DbMode;
          date: string;
          text: string;
          completed: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: DbMode;
          date?: string;
          text: string;
          completed?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: DbMode;
          date?: string;
          text?: string;
          completed?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ─── personal_blockers ───
      personal_blockers: {
        Row: {
          id: string;
          user_id: string;
          mode: DbMode;
          date: string;
          text: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: DbMode;
          date?: string;
          text: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: DbMode;
          date?: string;
          text?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ─── support_periods ───
      support_periods: {
        Row: {
          id: string;
          user_id: string;
          mode: DbMode;
          client_id: string;
          start_date: string;
          end_date: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: DbMode;
          client_id: string;
          start_date: string;
          end_date: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: DbMode;
          client_id?: string;
          start_date?: string;
          end_date?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ─── testimonials ───
      testimonials: {
        Row: {
          id: string;
          user_id: string;
          mode: DbMode;
          client_id: string;
          content: string;
          source: DbTestimonialSource | null;
          portfolio_usable: boolean;
          received_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: DbMode;
          client_id: string;
          content: string;
          source?: DbTestimonialSource | null;
          portfolio_usable?: boolean;
          received_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: DbMode;
          client_id?: string;
          content?: string;
          source?: DbTestimonialSource | null;
          portfolio_usable?: boolean;
          received_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ─── quick_logs ───
      quick_logs: {
        Row: {
          id: string;
          user_id: string;
          mode: DbMode;
          type: DbQuickLogType;
          content: string;
          processed: boolean;
          linked_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode: DbMode;
          type: DbQuickLogType;
          content: string;
          processed?: boolean;
          linked_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: DbMode;
          type?: DbQuickLogType;
          content?: string;
          processed?: boolean;
          linked_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      // ─── profile_reviews ───
      profile_reviews: {
        Row: {
          id: string;
          user_id: string;
          platform: DbSocialPlatform;
          section: string;
          completed: boolean;
          last_reviewed_at: string | null;
          next_review_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          platform: DbSocialPlatform;
          section: string;
          completed?: boolean;
          last_reviewed_at?: string | null;
          next_review_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          platform?: DbSocialPlatform;
          section?: string;
          completed?: boolean;
          last_reviewed_at?: string | null;
          next_review_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ─── bos_users (custom auth — migration 004) ───
      bos_users: {
        Row: {
          id: string;
          name: string;
          email: string;
          password_hash: string;
          role: DbBosUserRole;
          allowed_personal: string[] | null;
          allowed_agency: string[] | null;
          is_active: boolean;
          created_by: string | null;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          password_hash: string;
          role?: DbBosUserRole;
          allowed_personal?: string[] | null;
          allowed_agency?: string[] | null;
          is_active?: boolean;
          created_by?: string | null;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          password_hash?: string;
          role?: DbBosUserRole;
          allowed_personal?: string[] | null;
          allowed_agency?: string[] | null;
          is_active?: boolean;
          created_by?: string | null;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ─── outreach_leads (migration 005 + 010) ───
      outreach_leads: {
        Row: {
          id: string;
          user_id: string;
          mode: string;
          name: string;
          profile_url: string | null;
          company: string | null;
          requirement: string | null;
          status: string;
          notes: string | null;
          found_at: string | null;
          channel: DbOutreachChannel;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          mode?: string;
          name: string;
          profile_url?: string | null;
          company?: string | null;
          requirement?: string | null;
          status?: string;
          notes?: string | null;
          found_at?: string | null;
          channel?: DbOutreachChannel;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          mode?: string;
          name?: string;
          profile_url?: string | null;
          company?: string | null;
          requirement?: string | null;
          status?: string;
          notes?: string | null;
          found_at?: string | null;
          channel?: DbOutreachChannel;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };

      // ─── lab_projects (migration 005) ───
      lab_projects: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          status: string;
          tech_stack: string | null;
          url: string | null;
          repo_url: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          status?: string;
          tech_stack?: string | null;
          url?: string | null;
          repo_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          status?: string;
          tech_stack?: string | null;
          url?: string | null;
          repo_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };

      // ─── lab_tools (migration 005) ───
      lab_tools: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          category: string;
          status: string;
          notes: string | null;
          url: string | null;
          monthly_cost: number | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          category?: string;
          status?: string;
          notes?: string | null;
          url?: string | null;
          monthly_cost?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          category?: string;
          status?: string;
          notes?: string | null;
          url?: string | null;
          monthly_cost?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };

      // ─── lab_skills (migration 005) ───
      lab_skills: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          category: string;
          status: string;
          resource: string | null;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          category?: string;
          status?: string;
          resource?: string | null;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          category?: string;
          status?: string;
          resource?: string | null;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      /**
       * Single-RPC dashboard stats aggregation. See
       * supabase/migrations-consolidated/003_functions_and_seed.sql.
       * Returns the full HomeStats payload as JSONB.
       */
      get_home_stats: {
        Args: { p_user_id: string; p_mode: string };
        Returns: Json;
      };
      /**
       * Seeds the LinkedIn + GitHub 90-day review checklists for a user.
       * Idempotent — re-running is a no-op due to on-conflict guards.
       */
      initialize_profile_reviews: {
        Args: { uid: string };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
