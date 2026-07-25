export type OrgRole = "founder" | "admin" | "member"
export type ListStatus = "ready" | "processing" | "archived"
export type ConsentStatus = "unknown" | "opted_in" | "opted_out"
export type DeploymentStatus =
  | "draft"
  | "ready"
  | "sending"
  | "paused"
  | "completed"
  | "stopped"

export type Org = {
  id: string
  name: string
  created_at: string
}

export type OrgMember = {
  id: string
  org_id: string
  user_id: string
  role: OrgRole
  created_at: string
}

export type List = {
  id: string
  org_id: string
  name: string
  source: string
  contact_count: number
  status: ListStatus
  created_at: string
  updated_at: string
}

export type Contact = {
  id: string
  list_id: string
  org_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  consent_status: ConsentStatus
  tags: string[]
  created_at: string
}

export type TemplateQuestionOption = {
  id: string
  label: string
  points: number
}

export type TemplateQuestion = {
  id: string
  prompt: string
  type: "single" | "multi" | "text"
  required: boolean
  options?: TemplateQuestionOption[]
}

export type ScoringBand = {
  id: string
  label: string
  min: number
  max: number
  description: string
}

export type ScoringRules = {
  label: string
  method: "sum"
  bands: ScoringBand[]
}

export type Template = {
  id: string
  name: string
  description: string
  questions: TemplateQuestion[]
  intro_text: string
  scoring_rules: ScoringRules
  is_active: boolean
  created_at: string
}

export type Deployment = {
  id: string
  org_id: string
  list_id: string
  template_id: string
  name: string
  status: DeploymentStatus
  cost_estimate: number | null
  created_at: string
  launched_at: string | null
}

export type ResponseRow = {
  id: string
  org_id: string
  deployment_id: string
  contact_id: string
  answers: Record<string, string>
  score: number
  band_id: string | null
  band_label: string | null
  recommended_next_step: string | null
  created_at: string
}

export type ScoredLead = ResponseRow & {
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  deployment_name?: string
  list_name?: string
  template_name?: string
}

export type MessageChannel = "email" | "sms"
export type MessageSendStatus = "sent" | "failed" | "skipped"

export type DeploymentConsent = {
  id: string
  org_id: string
  deployment_id: string
  attested_by_user_id: string | null
  attested_by_email: string | null
  attestation_text: string
  attested_at: string
  created_at: string
}

export type MessageSend = {
  id: string
  org_id: string
  deployment_id: string
  contact_id: string
  channel: MessageChannel
  status: MessageSendStatus
  provider_message_id: string | null
  to_address: string | null
  error: string | null
  created_at: string
}

export type DeploymentSendStats = {
  eligible: number
  sent: number
  failed: number
}

export type ResponseInvite = {
  id: string
  org_id: string
  deployment_id: string
  contact_id: string
  token: string
  agent_name: string
  org_name: string
  expires_at: string
  used_at: string | null
  response_id: string | null
  created_at: string
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type TableDef<Row, Insert, Update, Relationships extends unknown[] = []> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: Relationships
}

export type Database = {
  public: {
    Tables: {
      orgs: TableDef<
        Org,
        { id?: string; name: string; created_at?: string },
        { id?: string; name?: string; created_at?: string }
      >
      org_members: TableDef<
        OrgMember,
        {
          id?: string
          org_id: string
          user_id: string
          role?: OrgRole
          created_at?: string
        },
        {
          id?: string
          org_id?: string
          user_id?: string
          role?: OrgRole
          created_at?: string
        },
        [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      >
      lists: TableDef<
        List,
        {
          id?: string
          org_id: string
          name: string
          source?: string
          contact_count?: number
          status?: ListStatus
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          org_id?: string
          name?: string
          source?: string
          contact_count?: number
          status?: ListStatus
          created_at?: string
          updated_at?: string
        },
        [
          {
            foreignKeyName: "lists_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      >
      contacts: TableDef<
        Contact,
        {
          id?: string
          list_id: string
          org_id: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip?: string | null
          consent_status?: ConsentStatus
          tags?: string[]
          created_at?: string
        },
        {
          id?: string
          list_id?: string
          org_id?: string
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          zip?: string | null
          consent_status?: ConsentStatus
          tags?: string[]
          created_at?: string
        },
        [
          {
            foreignKeyName: "contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      >
      templates: TableDef<
        {
          id: string
          name: string
          description: string
          questions: Json
          intro_text: string
          scoring_rules: Json
          is_active: boolean
          created_at: string
        },
        {
          id?: string
          name: string
          description?: string
          questions?: Json
          intro_text?: string
          scoring_rules?: Json
          is_active?: boolean
          created_at?: string
        },
        {
          id?: string
          name?: string
          description?: string
          questions?: Json
          intro_text?: string
          scoring_rules?: Json
          is_active?: boolean
          created_at?: string
        }
      >
      deployments: TableDef<
        Deployment,
        {
          id?: string
          org_id: string
          list_id: string
          template_id: string
          name: string
          status?: DeploymentStatus
          cost_estimate?: number | null
          created_at?: string
          launched_at?: string | null
        },
        {
          id?: string
          org_id?: string
          list_id?: string
          template_id?: string
          name?: string
          status?: DeploymentStatus
          cost_estimate?: number | null
          created_at?: string
          launched_at?: string | null
        },
        [
          {
            foreignKeyName: "deployments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      >
      responses: TableDef<
        {
          id: string
          org_id: string
          deployment_id: string
          contact_id: string
          answers: Json
          score: number
          band_id: string | null
          band_label: string | null
          recommended_next_step: string | null
          created_at: string
        },
        {
          id?: string
          org_id: string
          deployment_id: string
          contact_id: string
          answers?: Json
          score?: number
          band_id?: string | null
          band_label?: string | null
          recommended_next_step?: string | null
          created_at?: string
        },
        {
          id?: string
          org_id?: string
          deployment_id?: string
          contact_id?: string
          answers?: Json
          score?: number
          band_id?: string | null
          band_label?: string | null
          recommended_next_step?: string | null
          created_at?: string
        },
        [
          {
            foreignKeyName: "responses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      >
      deployment_consents: TableDef<
        DeploymentConsent,
        {
          id?: string
          org_id: string
          deployment_id: string
          attested_by_user_id?: string | null
          attested_by_email?: string | null
          attestation_text: string
          attested_at?: string
          created_at?: string
        },
        {
          id?: string
          org_id?: string
          deployment_id?: string
          attested_by_user_id?: string | null
          attested_by_email?: string | null
          attestation_text?: string
          attested_at?: string
          created_at?: string
        },
        [
          {
            foreignKeyName: "deployment_consents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployment_consents_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: true
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
        ]
      >
      message_sends: TableDef<
        MessageSend,
        {
          id?: string
          org_id: string
          deployment_id: string
          contact_id: string
          channel?: MessageChannel
          status: MessageSendStatus
          provider_message_id?: string | null
          to_address?: string | null
          error?: string | null
          created_at?: string
        },
        {
          id?: string
          org_id?: string
          deployment_id?: string
          contact_id?: string
          channel?: MessageChannel
          status?: MessageSendStatus
          provider_message_id?: string | null
          to_address?: string | null
          error?: string | null
          created_at?: string
        },
        [
          {
            foreignKeyName: "message_sends_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_sends_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_sends_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      >
      response_invites: TableDef<
        ResponseInvite,
        {
          id?: string
          org_id: string
          deployment_id: string
          contact_id: string
          token: string
          agent_name: string
          org_name: string
          expires_at: string
          used_at?: string | null
          response_id?: string | null
          created_at?: string
        },
        {
          id?: string
          org_id?: string
          deployment_id?: string
          contact_id?: string
          token?: string
          agent_name?: string
          org_name?: string
          expires_at?: string
          used_at?: string | null
          response_id?: string | null
          created_at?: string
        },
        [
          {
            foreignKeyName: "response_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_invites_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_invites_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      >
    }
    Views: Record<string, never>
    Functions: {
      create_organization: {
        Args: { org_name: string }
        Returns: string
      }
      get_user_org_ids: {
        Args: Record<string, never>
        Returns: string[]
      }
      is_org_member: {
        Args: { check_org_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { check_org_id: string }
        Returns: boolean
      }
      get_checkin_by_token: {
        Args: { p_token: string }
        Returns: Json
      }
      submit_checkin_by_token: {
        Args: {
          p_token: string
          p_answers: Json
          p_score: number
          p_band_id: string | null
          p_band_label: string | null
          p_recommended_next_step: string | null
        }
        Returns: Json
      }
    }
    Enums: {
      org_role: OrgRole
      list_status: ListStatus
      consent_status: ConsentStatus
      deployment_status: DeploymentStatus
    }
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
