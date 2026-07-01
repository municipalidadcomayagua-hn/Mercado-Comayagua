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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      abonos: {
        Row: {
          anio: number | null
          cobrador_id: string
          cobrador_nombre: string | null
          created_at: string
          fecha: string
          id: string
          mercado_id: string | null
          mes_aplicado: number | null
          meses: number[] | null
          monto: number
          numero_puesto: string
          numero_recibo: number | null
          referencia: string | null
          rubro_aplicado_concepto: string | null
        }
        Insert: {
          anio?: number | null
          cobrador_id: string
          cobrador_nombre?: string | null
          created_at?: string
          fecha?: string
          id?: string
          mercado_id?: string | null
          mes_aplicado?: number | null
          meses?: number[] | null
          monto: number
          numero_puesto: string
          numero_recibo?: number | null
          referencia?: string | null
          rubro_aplicado_concepto?: string | null
        }
        Update: {
          anio?: number | null
          cobrador_id?: string
          cobrador_nombre?: string | null
          created_at?: string
          fecha?: string
          id?: string
          mercado_id?: string | null
          mes_aplicado?: number | null
          meses?: number[] | null
          monto?: number
          numero_puesto?: string
          numero_recibo?: number | null
          referencia?: string | null
          rubro_aplicado_concepto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abonos_cobrador_id_fkey"
            columns: ["cobrador_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abonos_mercado_id_fkey"
            columns: ["mercado_id"]
            isOneToOne: false
            referencedRelation: "mercados"
            referencedColumns: ["id"]
          },
        ]
      }
      abonos_mora: {
        Row: {
          created_at: string
          deuda_mora_id: string
          fecha: string
          id: string
          mercado_id: string | null
          monto: number
          numero_recibo: number
          observacion: string | null
          saldo_pendiente_despues: number
          usuario_id: string
          usuario_nombre: string
        }
        Insert: {
          created_at?: string
          deuda_mora_id: string
          fecha?: string
          id?: string
          mercado_id?: string | null
          monto: number
          numero_recibo: number
          observacion?: string | null
          saldo_pendiente_despues: number
          usuario_id: string
          usuario_nombre: string
        }
        Update: {
          created_at?: string
          deuda_mora_id?: string
          fecha?: string
          id?: string
          mercado_id?: string | null
          monto?: number
          numero_recibo?: number
          observacion?: string | null
          saldo_pendiente_despues?: number
          usuario_id?: string
          usuario_nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "abonos_mora_deuda_mora_id_fkey"
            columns: ["deuda_mora_id"]
            isOneToOne: false
            referencedRelation: "deudas_mora"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abonos_mora_mercado_id_fkey"
            columns: ["mercado_id"]
            isOneToOne: false
            referencedRelation: "mercados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abonos_mora_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cobradores: {
        Row: {
          apellido: string
          codigo_cuenta: string
          created_at: string
          dni: string
          email: string | null
          estado: string
          foto_url: string | null
          id: string
          lat: number | null
          lng: number | null
          mercado_id: string | null
          nombre: string
          telefono: string | null
          user_id: string
        }
        Insert: {
          apellido: string
          codigo_cuenta: string
          created_at?: string
          dni: string
          email?: string | null
          estado?: string
          foto_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          mercado_id?: string | null
          nombre: string
          telefono?: string | null
          user_id: string
        }
        Update: {
          apellido?: string
          codigo_cuenta?: string
          created_at?: string
          dni?: string
          email?: string | null
          estado?: string
          foto_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          mercado_id?: string | null
          nombre?: string
          telefono?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobradores_mercado_id_fkey"
            columns: ["mercado_id"]
            isOneToOne: false
            referencedRelation: "mercados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobradores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cobros: {
        Row: {
          actualizado_cierre_anual: string | null
          anio: number
          anulado_por_id: string | null
          cobrador_id: string
          cobrador_nombre: string
          codigo_cuenta: string
          created_at: string
          dias_mes: number | null
          es_cobro_diario: boolean
          estado: string
          estado_cargo: string | null
          fecha_anulacion: string | null
          fecha_cobro: string
          fecha_cobro_dia: string | null
          fecha_reporte_completado: string | null
          id: string
          mercado_id: string | null
          mes: number | null
          monto: number
          motivo_anulacion: string | null
          nombre_cliente: string | null
          numero_puesto: string
          numero_recibo: number
          recibo_generado: boolean
          renta_mensual: number | null
          reporte_diario_completado: boolean | null
          sincronizado: boolean
          tipo_cobro: string
          tipo_pago: string | null
          tipo_puesto: string | null
          valor_diario: number | null
        }
        Insert: {
          actualizado_cierre_anual?: string | null
          anio: number
          anulado_por_id?: string | null
          cobrador_id: string
          cobrador_nombre: string
          codigo_cuenta: string
          created_at?: string
          dias_mes?: number | null
          es_cobro_diario?: boolean
          estado?: string
          estado_cargo?: string | null
          fecha_anulacion?: string | null
          fecha_cobro?: string
          fecha_cobro_dia?: string | null
          fecha_reporte_completado?: string | null
          id?: string
          mercado_id?: string | null
          mes?: number | null
          monto: number
          motivo_anulacion?: string | null
          nombre_cliente?: string | null
          numero_puesto: string
          numero_recibo: number
          recibo_generado?: boolean
          renta_mensual?: number | null
          reporte_diario_completado?: boolean | null
          sincronizado?: boolean
          tipo_cobro: string
          tipo_pago?: string | null
          tipo_puesto?: string | null
          valor_diario?: number | null
        }
        Update: {
          actualizado_cierre_anual?: string | null
          anio?: number
          anulado_por_id?: string | null
          cobrador_id?: string
          cobrador_nombre?: string
          codigo_cuenta?: string
          created_at?: string
          dias_mes?: number | null
          es_cobro_diario?: boolean
          estado?: string
          estado_cargo?: string | null
          fecha_anulacion?: string | null
          fecha_cobro?: string
          fecha_cobro_dia?: string | null
          fecha_reporte_completado?: string | null
          id?: string
          mercado_id?: string | null
          mes?: number | null
          monto?: number
          motivo_anulacion?: string | null
          nombre_cliente?: string | null
          numero_puesto?: string
          numero_recibo?: number
          recibo_generado?: boolean
          renta_mensual?: number | null
          reporte_diario_completado?: boolean | null
          sincronizado?: boolean
          tipo_cobro?: string
          tipo_pago?: string | null
          tipo_puesto?: string | null
          valor_diario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cobros_anulado_por_id_fkey"
            columns: ["anulado_por_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_cobrador_id_fkey"
            columns: ["cobrador_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_mercado_id_fkey"
            columns: ["mercado_id"]
            isOneToOne: false
            referencedRelation: "mercados"
            referencedColumns: ["id"]
          },
        ]
      }
      cobros_abonos_concepto: {
        Row: {
          cobro_id: string
          concepto: string
          id: string
          monto: number
        }
        Insert: {
          cobro_id: string
          concepto: string
          id?: string
          monto: number
        }
        Update: {
          cobro_id?: string
          concepto?: string
          id?: string
          monto?: number
        }
        Relationships: [
          {
            foreignKeyName: "cobros_abonos_concepto_cobro_id_fkey"
            columns: ["cobro_id"]
            isOneToOne: false
            referencedRelation: "cobros"
            referencedColumns: ["id"]
          },
        ]
      }
      cobros_pagos_adicionales: {
        Row: {
          cobro_id: string
          concepto: string
          id: string
          monto: number
        }
        Insert: {
          cobro_id: string
          concepto: string
          id?: string
          monto: number
        }
        Update: {
          cobro_id?: string
          concepto?: string
          id?: string
          monto?: number
        }
        Relationships: [
          {
            foreignKeyName: "cobros_pagos_adicionales_cobro_id_fkey"
            columns: ["cobro_id"]
            isOneToOne: false
            referencedRelation: "cobros"
            referencedColumns: ["id"]
          },
        ]
      }
      cobros_pagos_diarios: {
        Row: {
          cobro_id: string
          codigo: string | null
          concepto: string | null
          id: string
          monto: number
          numero_puesto: number
          rubro_id: string | null
          timestamp: string | null
        }
        Insert: {
          cobro_id: string
          codigo?: string | null
          concepto?: string | null
          id?: string
          monto: number
          numero_puesto: number
          rubro_id?: string | null
          timestamp?: string | null
        }
        Update: {
          cobro_id?: string
          codigo?: string | null
          concepto?: string | null
          id?: string
          monto?: number
          numero_puesto?: number
          rubro_id?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobros_pagos_diarios_cobro_id_fkey"
            columns: ["cobro_id"]
            isOneToOne: false
            referencedRelation: "cobros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_pagos_diarios_rubro_id_fkey"
            columns: ["rubro_id"]
            isOneToOne: false
            referencedRelation: "rubros"
            referencedColumns: ["id"]
          },
        ]
      }
      contadores_recibo: {
        Row: {
          id: string
          mercado_id: string | null
          ultimo: number
        }
        Insert: {
          id?: string
          mercado_id?: string | null
          ultimo?: number
        }
        Update: {
          id?: string
          mercado_id?: string | null
          ultimo?: number
        }
        Relationships: [
          {
            foreignKeyName: "contadores_recibo_mercado_id_fkey"
            columns: ["mercado_id"]
            isOneToOne: true
            referencedRelation: "mercados"
            referencedColumns: ["id"]
          },
        ]
      }
      cuentas_por_cobrar: {
        Row: {
          cobrador_id: string
          created_at: string
          estado: string
          fecha_vencimiento: string | null
          id: string
          monto_total: number
          nombre_cliente: string | null
          numero_puesto: string
          saldo_pendiente: number
          total_abonado: number
          ultima_fecha_abono: string | null
          ultima_fecha_cobro: string
          updated_at: string
        }
        Insert: {
          cobrador_id: string
          created_at?: string
          estado?: string
          fecha_vencimiento?: string | null
          id?: string
          monto_total?: number
          nombre_cliente?: string | null
          numero_puesto: string
          saldo_pendiente?: number
          total_abonado?: number
          ultima_fecha_abono?: string | null
          ultima_fecha_cobro?: string
          updated_at?: string
        }
        Update: {
          cobrador_id?: string
          created_at?: string
          estado?: string
          fecha_vencimiento?: string | null
          id?: string
          monto_total?: number
          nombre_cliente?: string | null
          numero_puesto?: string
          saldo_pendiente?: number
          total_abonado?: number
          ultima_fecha_abono?: string | null
          ultima_fecha_cobro?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cuentas_por_cobrar_cobrador_id_fkey"
            columns: ["cobrador_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deudas_mora: {
        Row: {
          cobrador_id: string
          created_at: string
          descripcion: string | null
          id: string
          mercado_id: string | null
          monto_total: number
          nombre_cliente: string
          numero_puesto: string
          puesto_id: string
          rubro_codigo: string
          rubro_concepto: string
          rubro_id: string
          saldo_pendiente: number
          tipo_rubro: string
          total_abonado: number
          updated_at: string
        }
        Insert: {
          cobrador_id: string
          created_at?: string
          descripcion?: string | null
          id?: string
          mercado_id?: string | null
          monto_total: number
          nombre_cliente: string
          numero_puesto: string
          puesto_id: string
          rubro_codigo: string
          rubro_concepto: string
          rubro_id: string
          saldo_pendiente: number
          tipo_rubro?: string
          total_abonado?: number
          updated_at?: string
        }
        Update: {
          cobrador_id?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          mercado_id?: string | null
          monto_total?: number
          nombre_cliente?: string
          numero_puesto?: string
          puesto_id?: string
          rubro_codigo?: string
          rubro_concepto?: string
          rubro_id?: string
          saldo_pendiente?: number
          tipo_rubro?: string
          total_abonado?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deudas_mora_cobrador_id_fkey"
            columns: ["cobrador_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deudas_mora_mercado_id_fkey"
            columns: ["mercado_id"]
            isOneToOne: false
            referencedRelation: "mercados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deudas_mora_puesto_id_fkey"
            columns: ["puesto_id"]
            isOneToOne: false
            referencedRelation: "puestos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deudas_mora_rubro_id_fkey"
            columns: ["rubro_id"]
            isOneToOne: false
            referencedRelation: "rubros"
            referencedColumns: ["id"]
          },
        ]
      }
      mercados: {
        Row: {
          activo: boolean
          codigo: string | null
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          codigo?: string | null
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          codigo?: string | null
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      perfiles: {
        Row: {
          activo: boolean
          created_at: string
          email: string
          id: string
          mercado_id: string | null
          nombre: string
          rol: string
          ultimo_acceso: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email: string
          id: string
          mercado_id?: string | null
          nombre: string
          rol: string
          ultimo_acceso?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string
          id?: string
          mercado_id?: string | null
          nombre?: string
          rol?: string
          ultimo_acceso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_mercado_id_fkey"
            columns: ["mercado_id"]
            isOneToOne: false
            referencedRelation: "mercados"
            referencedColumns: ["id"]
          },
        ]
      }
      puestos: {
        Row: {
          activo: boolean
          anio: number
          cobrador_id: string
          codigo: string
          created_at: string
          direccion_cliente: string | null
          en_mora: boolean | null
          foto_contrato_arrendamiento_urls: string[] | null
          foto_documento_url: string | null
          foto_permiso_operacion_urls: string[] | null
          foto_tarjeta_cobro_anual_urls: string[] | null
          id: string
          nombre_cliente: string
          numero_identidad: string | null
          numero_puesto: string
          observaciones: string | null
          rtn: string | null
          telefono: string | null
          tipo_puesto: string
          valor_diario: number
        }
        Insert: {
          activo?: boolean
          anio: number
          cobrador_id: string
          codigo: string
          created_at?: string
          direccion_cliente?: string | null
          en_mora?: boolean | null
          foto_contrato_arrendamiento_urls?: string[] | null
          foto_documento_url?: string | null
          foto_permiso_operacion_urls?: string[] | null
          foto_tarjeta_cobro_anual_urls?: string[] | null
          id?: string
          nombre_cliente: string
          numero_identidad?: string | null
          numero_puesto: string
          observaciones?: string | null
          rtn?: string | null
          telefono?: string | null
          tipo_puesto: string
          valor_diario?: number
        }
        Update: {
          activo?: boolean
          anio?: number
          cobrador_id?: string
          codigo?: string
          created_at?: string
          direccion_cliente?: string | null
          en_mora?: boolean | null
          foto_contrato_arrendamiento_urls?: string[] | null
          foto_documento_url?: string | null
          foto_permiso_operacion_urls?: string[] | null
          foto_tarjeta_cobro_anual_urls?: string[] | null
          id?: string
          nombre_cliente?: string
          numero_identidad?: string | null
          numero_puesto?: string
          observaciones?: string | null
          rtn?: string | null
          telefono?: string | null
          tipo_puesto?: string
          valor_diario?: number
        }
        Relationships: [
          {
            foreignKeyName: "puestos_cobrador_id_fkey"
            columns: ["cobrador_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rubros: {
        Row: {
          abreviatura: string
          activo: boolean
          cobrador_id: string | null
          codigo: string
          concepto: string
          es_global: boolean
          id: string
          tipo_rubro: string
        }
        Insert: {
          abreviatura?: string
          activo?: boolean
          cobrador_id?: string | null
          codigo: string
          concepto: string
          es_global?: boolean
          id?: string
          tipo_rubro?: string
        }
        Update: {
          abreviatura?: string
          activo?: boolean
          cobrador_id?: string | null
          codigo?: string
          concepto?: string
          es_global?: boolean
          id?: string
          tipo_rubro?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubros_cobrador_id_fkey"
            columns: ["cobrador_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      siguiente_numero_recibo: {
        Args: { p_mercado_id: string }
        Returns: number
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
