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
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      background_jobs: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          id: string
          job_type: string
          last_error: string | null
          max_attempts: number | null
          metadata: Json | null
          scheduled_at: string
          status: string
          target_id: string
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          job_type: string
          last_error?: string | null
          max_attempts?: number | null
          metadata?: Json | null
          scheduled_at: string
          status?: string
          target_id: string
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          job_type?: string
          last_error?: string | null
          max_attempts?: number | null
          metadata?: Json | null
          scheduled_at?: string
          status?: string
          target_id?: string
        }
        Relationships: []
      }
      chat_channels: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          order_id: string | null
          participant_1: string
          participant_2: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          order_id?: string | null
          participant_1: string
          participant_2: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          order_id?: string | null
          participant_1?: string
          participant_2?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_channels_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_channels_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_driver_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "chat_channels_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_channels_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_warehouse_queue"
            referencedColumns: ["order_id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          channel_id: string
          created_at: string | null
          id: string
          message: string
          message_type: string | null
          read_at: string | null
          sender_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          id?: string
          message: string
          message_type?: string | null
          read_at?: string | null
          sender_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          id?: string
          message?: string
          message_type?: string | null
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_events: {
        Row: {
          created_at: string | null
          driver_id: string
          event_type: string
          gps_latitude: number | null
          gps_longitude: number | null
          id: string
          id_document_type: string | null
          id_verified: boolean | null
          metadata: Json | null
          notes: string | null
          order_id: string
          outcome: string
          recipient_name: string | null
        }
        Insert: {
          created_at?: string | null
          driver_id: string
          event_type: string
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          id_document_type?: string | null
          id_verified?: boolean | null
          metadata?: Json | null
          notes?: string | null
          order_id: string
          outcome: string
          recipient_name?: string | null
        }
        Update: {
          created_at?: string | null
          driver_id?: string
          event_type?: string
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          id_document_type?: string | null
          id_verified?: boolean | null
          metadata?: Json | null
          notes?: string | null
          order_id?: string
          outcome?: string
          recipient_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_driver_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "compliance_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_warehouse_queue"
            referencedColumns: ["order_id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          address_line3: string | null
          city: string
          coordinates: Json | null
          country: string
          created_at: string | null
          delivery_zone: string | null
          full_name: string
          id: string
          is_default: boolean | null
          label: string | null
          phone: string
          postal_code: string
          province: string
          suburb: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          address_line3?: string | null
          city: string
          coordinates?: Json | null
          country?: string
          created_at?: string | null
          delivery_zone?: string | null
          full_name: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          phone: string
          postal_code: string
          province: string
          suburb: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          address_line3?: string | null
          city?: string
          coordinates?: Json | null
          country?: string
          created_at?: string | null
          delivery_zone?: string | null
          full_name?: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          phone?: string
          postal_code?: string
          province?: string
          suburb?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      delivery_assignments: {
        Row: {
          all_items_scanned: boolean | null
          assigned_by: string | null
          assigned_vehicle: string | null
          created_at: string | null
          delivered_at: string | null
          delivery_started_at: string | null
          dispatch_score: number | null
          driver_id: string | null
          failed_at: string | null
          failed_reason: string | null
          id: string
          items_verified: boolean | null
          order_id: string
          pickup_verified_at: string | null
          recommended_vehicle: string | null
          return_confirmed_at: string | null
          signature: string | null
          status: string
          total_items: number
          total_volume_m3: number | null
          total_weight_kg: number | null
          updated_at: string | null
          vehicle_mismatch_warning: boolean | null
          verified_count: number | null
        }
        Insert: {
          all_items_scanned?: boolean | null
          assigned_by?: string | null
          assigned_vehicle?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_started_at?: string | null
          dispatch_score?: number | null
          driver_id?: string | null
          failed_at?: string | null
          failed_reason?: string | null
          id?: string
          items_verified?: boolean | null
          order_id: string
          pickup_verified_at?: string | null
          recommended_vehicle?: string | null
          return_confirmed_at?: string | null
          signature?: string | null
          status?: string
          total_items?: number
          total_volume_m3?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
          vehicle_mismatch_warning?: boolean | null
          verified_count?: number | null
        }
        Update: {
          all_items_scanned?: boolean | null
          assigned_by?: string | null
          assigned_vehicle?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_started_at?: string | null
          dispatch_score?: number | null
          driver_id?: string | null
          failed_at?: string | null
          failed_reason?: string | null
          id?: string
          items_verified?: boolean | null
          order_id?: string
          pickup_verified_at?: string | null
          recommended_vehicle?: string | null
          return_confirmed_at?: string | null
          signature?: string | null
          status?: string
          total_items?: number
          total_volume_m3?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
          vehicle_mismatch_warning?: boolean | null
          verified_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          customer_id: string
          delivery_rating: number
          driver_id: string
          driver_rating: number
          id: string
          order_id: string
          tip_amount: number | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          customer_id: string
          delivery_rating: number
          driver_id: string
          driver_rating: number
          id?: string
          order_id: string
          tip_amount?: number | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          customer_id?: string
          delivery_rating?: number
          driver_id?: string
          driver_rating?: number
          id?: string
          order_id?: string
          tip_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_driver_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "delivery_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_warehouse_queue"
            referencedColumns: ["order_id"]
          },
        ]
      }
      delivery_slots: {
        Row: {
          created_at: string | null
          current_orders: number | null
          date: string
          end_time: string
          id: string
          is_available: boolean | null
          max_orders: number | null
          premium_fee: number | null
          slot_type: string | null
          start_time: string
          zone_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_orders?: number | null
          date: string
          end_time: string
          id?: string
          is_available?: boolean | null
          max_orders?: number | null
          premium_fee?: number | null
          slot_type?: string | null
          start_time: string
          zone_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_orders?: number | null
          date?: string
          end_time?: string
          id?: string
          is_available?: boolean | null
          max_orders?: number | null
          premium_fee?: number | null
          slot_type?: string | null
          start_time?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_slots_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_tracking: {
        Row: {
          accuracy: number | null
          assignment_id: string
          heading: number | null
          id: string
          latitude: number
          longitude: number
          recorded_at: string | null
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          assignment_id: string
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string | null
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          assignment_id?: string
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string | null
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_tracking_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "driver_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_tracking_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_driver_orders"
            referencedColumns: ["assignment_id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          base_delivery_fee: number
          created_at: string | null
          description: string | null
          estimated_delivery_minutes: number | null
          id: string
          is_active: boolean | null
          max_delivery_distance_km: number | null
          min_order_value: number | null
          name: string
          operating_hours: Json | null
          polygon: Json
          surge_multiplier: number | null
          updated_at: string | null
        }
        Insert: {
          base_delivery_fee?: number
          created_at?: string | null
          description?: string | null
          estimated_delivery_minutes?: number | null
          id?: string
          is_active?: boolean | null
          max_delivery_distance_km?: number | null
          min_order_value?: number | null
          name: string
          operating_hours?: Json | null
          polygon: Json
          surge_multiplier?: number | null
          updated_at?: string | null
        }
        Update: {
          base_delivery_fee?: number
          created_at?: string | null
          description?: string | null
          estimated_delivery_minutes?: number | null
          id?: string
          is_active?: boolean | null
          max_delivery_distance_km?: number | null
          min_order_value?: number | null
          name?: string
          operating_hours?: Json | null
          polygon?: Json
          surge_multiplier?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      disputes: {
        Row: {
          created_at: string | null
          customer_id: string
          description: string
          evidence_urls: string[] | null
          id: string
          order_id: string
          refund_amount: number | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          type: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          description: string
          evidence_urls?: string[] | null
          id?: string
          order_id: string
          refund_amount?: number | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          type: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          description?: string
          evidence_urls?: string[] | null
          id?: string
          order_id?: string
          refund_amount?: number | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_driver_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_warehouse_queue"
            referencedColumns: ["order_id"]
          },
        ]
      }
      driver_assignments: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          current_location: Json | null
          customer_confirmed_at: string | null
          customer_pin_verified_at: string | null
          delivered_at: string | null
          delivery_notes: string | null
          delivery_photo_url: string | null
          depot_released_at: string | null
          depot_released_by: string | null
          distance_km: number | null
          driver_id: string
          driver_signed_off_at: string | null
          eta_minutes: number | null
          id: string
          order_id: string
          picked_up_at: string | null
          pin_attempts: number | null
          recipient_name: string | null
          status: Database["public"]["Enums"]["driver_assignment_status"]
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          current_location?: Json | null
          customer_confirmed_at?: string | null
          customer_pin_verified_at?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          delivery_photo_url?: string | null
          depot_released_at?: string | null
          depot_released_by?: string | null
          distance_km?: number | null
          driver_id: string
          driver_signed_off_at?: string | null
          eta_minutes?: number | null
          id?: string
          order_id: string
          picked_up_at?: string | null
          pin_attempts?: number | null
          recipient_name?: string | null
          status?: Database["public"]["Enums"]["driver_assignment_status"]
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          current_location?: Json | null
          customer_confirmed_at?: string | null
          customer_pin_verified_at?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          delivery_photo_url?: string | null
          depot_released_at?: string | null
          depot_released_by?: string | null
          distance_km?: number | null
          driver_id?: string
          driver_signed_off_at?: string | null
          eta_minutes?: number | null
          id?: string
          order_id?: string
          picked_up_at?: string | null
          pin_attempts?: number | null
          recipient_name?: string | null
          status?: Database["public"]["Enums"]["driver_assignment_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_driver_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "driver_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_warehouse_queue"
            referencedColumns: ["order_id"]
          },
        ]
      }
      driver_profiles: {
        Row: {
          created_at: string | null
          driver_license_url: string | null
          email: string | null
          full_name: string
          id: string
          id_number: string
          is_verified: boolean | null
          phone: string
          profile_picture_url: string | null
          rating: number
          total_deliveries: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          driver_license_url?: string | null
          email?: string | null
          full_name: string
          id?: string
          id_number: string
          is_verified?: boolean | null
          phone: string
          profile_picture_url?: string | null
          rating?: number
          total_deliveries?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          driver_license_url?: string | null
          email?: string | null
          full_name?: string
          id?: string
          id_number?: string
          is_verified?: boolean | null
          phone?: string
          profile_picture_url?: string | null
          rating?: number
          total_deliveries?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      driver_vehicles: {
        Row: {
          capacity_kg: number | null
          created_at: string | null
          driver_id: string
          id: string
          is_verified: boolean | null
          license_plate: string
          make_model: string
          updated_at: string | null
          vehicle_photo_url: string | null
          vehicle_type: string
        }
        Insert: {
          capacity_kg?: number | null
          created_at?: string | null
          driver_id: string
          id?: string
          is_verified?: boolean | null
          license_plate: string
          make_model: string
          updated_at?: string | null
          vehicle_photo_url?: string | null
          vehicle_type: string
        }
        Update: {
          capacity_kg?: number | null
          created_at?: string | null
          driver_id?: string
          id?: string
          is_verified?: boolean | null
          license_plate?: string
          make_model?: string
          updated_at?: string | null
          vehicle_photo_url?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_accounts: {
        Row: {
          created_at: string | null
          id: string
          lifetime_points: number
          points_balance: number
          tier: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lifetime_points?: number
          points_balance?: number
          tier?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lifetime_points?: number
          points_balance?: number
          tier?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          order_id: string | null
          points: number
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          points: number
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          points?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_driver_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_warehouse_queue"
            referencedColumns: ["order_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          barcode: string | null
          created_at: string | null
          group_id: string | null
          id: string
          is_grouped: boolean | null
          is_scanned: boolean | null
          order_id: string
          product_id: string
          product_image: string | null
          product_name: string
          quantity: number
          scanned_at: string | null
          scanned_by: string | null
          subtotal: number
          unit_price: number
          updated_at: string | null
          volume_m3: number | null
          weight_kg: number | null
        }
        Insert: {
          barcode?: string | null
          created_at?: string | null
          group_id?: string | null
          id?: string
          is_grouped?: boolean | null
          is_scanned?: boolean | null
          order_id: string
          product_id: string
          product_image?: string | null
          product_name: string
          quantity: number
          scanned_at?: string | null
          scanned_by?: string | null
          subtotal: number
          unit_price: number
          updated_at?: string | null
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Update: {
          barcode?: string | null
          created_at?: string | null
          group_id?: string | null
          id?: string
          is_grouped?: boolean | null
          is_scanned?: boolean | null
          order_id?: string
          product_id?: string
          product_image?: string | null
          product_name?: string
          quantity?: number
          scanned_at?: string | null
          scanned_by?: string | null
          subtotal?: number
          unit_price?: number
          updated_at?: string | null
          volume_m3?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_driver_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_warehouse_queue"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          notes: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          notes?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          notes?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_driver_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_warehouse_queue"
            referencedColumns: ["order_id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_driver_id: string | null
          assigned_warehouse_id: string | null
          compliance_verified: boolean | null
          confirmed_at: string | null
          created_at: string | null
          customer_notes: string | null
          delivered_at: string | null
          delivery_address: Json
          delivery_fee: number
          delivery_instructions: string | null
          delivery_method: string
          delivery_pin: string | null
          delivery_zone: string | null
          discount_amount: number
          discount_code: string | null
          dispatched_at: string | null
          estimated_delivery: string | null
          failed_delivery_count: number | null
          id: string
          order_number: string
          packed_at: string | null
          payment_method: string
          payment_reference: string | null
          payment_status: string
          pin_attempts: number | null
          pin_locked: boolean | null
          promo_code: string | null
          promo_code_id: string | null
          return_reason: string | null
          scheduled_date: string | null
          scheduled_delivery_id: string | null
          scheduled_slot: string | null
          status: Database["public"]["Enums"]["order_status"]
          stock_decremented_at: string | null
          stock_reserved: boolean | null
          stock_reserved_at: string | null
          subtotal: number
          total: number
          updated_at: string | null
          user_id: string
          vat_amount: number
        }
        Insert: {
          assigned_driver_id?: string | null
          assigned_warehouse_id?: string | null
          compliance_verified?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          customer_notes?: string | null
          delivered_at?: string | null
          delivery_address: Json
          delivery_fee?: number
          delivery_instructions?: string | null
          delivery_method: string
          delivery_pin?: string | null
          delivery_zone?: string | null
          discount_amount?: number
          discount_code?: string | null
          dispatched_at?: string | null
          estimated_delivery?: string | null
          failed_delivery_count?: number | null
          id?: string
          order_number: string
          packed_at?: string | null
          payment_method: string
          payment_reference?: string | null
          payment_status?: string
          pin_attempts?: number | null
          pin_locked?: boolean | null
          promo_code?: string | null
          promo_code_id?: string | null
          return_reason?: string | null
          scheduled_date?: string | null
          scheduled_delivery_id?: string | null
          scheduled_slot?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stock_decremented_at?: string | null
          stock_reserved?: boolean | null
          stock_reserved_at?: string | null
          subtotal: number
          total: number
          updated_at?: string | null
          user_id: string
          vat_amount: number
        }
        Update: {
          assigned_driver_id?: string | null
          assigned_warehouse_id?: string | null
          compliance_verified?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          customer_notes?: string | null
          delivered_at?: string | null
          delivery_address?: Json
          delivery_fee?: number
          delivery_instructions?: string | null
          delivery_method?: string
          delivery_pin?: string | null
          delivery_zone?: string | null
          discount_amount?: number
          discount_code?: string | null
          dispatched_at?: string | null
          estimated_delivery?: string | null
          failed_delivery_count?: number | null
          id?: string
          order_number?: string
          packed_at?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          pin_attempts?: number | null
          pin_locked?: boolean | null
          promo_code?: string | null
          promo_code_id?: string | null
          return_reason?: string | null
          scheduled_date?: string | null
          scheduled_delivery_id?: string | null
          scheduled_slot?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stock_decremented_at?: string | null
          stock_reserved?: boolean | null
          stock_reserved_at?: string | null
          subtotal?: number
          total?: number
          updated_at?: string | null
          user_id?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      package_groups: {
        Row: {
          created_at: string | null
          group_barcode: string
          group_name: string
          id: string
          is_scanned: boolean | null
          order_id: string
          scanned_at: string | null
          scanned_by: string | null
          total_items: number
          total_volume_m3: number | null
          total_weight_kg: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          group_barcode: string
          group_name: string
          id?: string
          is_scanned?: boolean | null
          order_id: string
          scanned_at?: string | null
          scanned_by?: string | null
          total_items?: number
          total_volume_m3?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          group_barcode?: string
          group_name?: string
          id?: string
          is_scanned?: boolean | null
          order_id?: string
          scanned_at?: string | null
          scanned_by?: string | null
          total_items?: number
          total_volume_m3?: number | null
          total_weight_kg?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          authorized_at: string | null
          captured_at: string | null
          created_at: string | null
          currency: string
          failed_at: string | null
          failure_reason: string | null
          gateway: string
          gateway_reference: string | null
          gateway_response: Json | null
          id: string
          metadata: Json | null
          order_id: string
          ozow_payment_request_id: string | null
          ozow_transaction_id: string | null
          payment_method: string
          refunded_at: string | null
          status: string
          updated_at: string | null
          yoco_charge_id: string | null
          yoco_refund_id: string | null
        }
        Insert: {
          amount: number
          authorized_at?: string | null
          captured_at?: string | null
          created_at?: string | null
          currency?: string
          failed_at?: string | null
          failure_reason?: string | null
          gateway?: string
          gateway_reference?: string | null
          gateway_response?: Json | null
          id?: string
          metadata?: Json | null
          order_id: string
          ozow_payment_request_id?: string | null
          ozow_transaction_id?: string | null
          payment_method: string
          refunded_at?: string | null
          status?: string
          updated_at?: string | null
          yoco_charge_id?: string | null
          yoco_refund_id?: string | null
        }
        Update: {
          amount?: number
          authorized_at?: string | null
          captured_at?: string | null
          created_at?: string | null
          currency?: string
          failed_at?: string | null
          failure_reason?: string | null
          gateway?: string
          gateway_reference?: string | null
          gateway_response?: Json | null
          id?: string
          metadata?: Json | null
          order_id?: string
          ozow_payment_request_id?: string | null
          ozow_transaction_id?: string | null
          payment_method?: string
          refunded_at?: string | null
          status?: string
          updated_at?: string | null
          yoco_charge_id?: string | null
          yoco_refund_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_driver_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_warehouse_queue"
            referencedColumns: ["order_id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          comment: string
          created_at: string
          id: string
          product_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          product_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          alcohol_pct: string | null
          barcode: string | null
          bottle_size: string | null
          category: string
          cheapest_retailer: string | null
          checkers_price: number | null
          country: string | null
          created_at: string | null
          description: string | null
          id: string
          image_search_url: string | null
          image_url: string | null
          in_stock: boolean | null
          is_best_seller: boolean | null
          is_featured: boolean | null
          is_new_arrival: boolean | null
          is_trending: boolean | null
          last_restock_date: string | null
          last_sold_date: string | null
          low_stock_threshold: number | null
          makro_price: number | null
          markup_pct: number | null
          max_stock: number | null
          max_stock_level: number | null
          name: string
          norman_price: number | null
          pnp_price: number | null
          price: number
          product_search_url: string | null
          rating: number | null
          reorder_level: number | null
          review_count: number | null
          stock_quantity: number | null
          tops_price: number | null
          units_sold_30d: number | null
          units_sold_7d: number | null
          updated_at: string | null
          woolworths_price: number | null
        }
        Insert: {
          alcohol_pct?: string | null
          barcode?: string | null
          bottle_size?: string | null
          category: string
          cheapest_retailer?: string | null
          checkers_price?: number | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_search_url?: string | null
          image_url?: string | null
          in_stock?: boolean | null
          is_best_seller?: boolean | null
          is_featured?: boolean | null
          is_new_arrival?: boolean | null
          is_trending?: boolean | null
          last_restock_date?: string | null
          last_sold_date?: string | null
          low_stock_threshold?: number | null
          makro_price?: number | null
          markup_pct?: number | null
          max_stock?: number | null
          max_stock_level?: number | null
          name: string
          norman_price?: number | null
          pnp_price?: number | null
          price?: number
          product_search_url?: string | null
          rating?: number | null
          reorder_level?: number | null
          review_count?: number | null
          stock_quantity?: number | null
          tops_price?: number | null
          units_sold_30d?: number | null
          units_sold_7d?: number | null
          updated_at?: string | null
          woolworths_price?: number | null
        }
        Update: {
          alcohol_pct?: string | null
          barcode?: string | null
          bottle_size?: string | null
          category?: string
          cheapest_retailer?: string | null
          checkers_price?: number | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_search_url?: string | null
          image_url?: string | null
          in_stock?: boolean | null
          is_best_seller?: boolean | null
          is_featured?: boolean | null
          is_new_arrival?: boolean | null
          is_trending?: boolean | null
          last_restock_date?: string | null
          last_sold_date?: string | null
          low_stock_threshold?: number | null
          makro_price?: number | null
          markup_pct?: number | null
          max_stock?: number | null
          max_stock_level?: number | null
          name?: string
          norman_price?: number | null
          pnp_price?: number | null
          price?: number
          product_search_url?: string | null
          rating?: number | null
          reorder_level?: number | null
          review_count?: number | null
          stock_quantity?: number | null
          tops_price?: number | null
          units_sold_30d?: number | null
          units_sold_7d?: number | null
          updated_at?: string | null
          woolworths_price?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_order_value: number | null
          starts_at: string | null
          target_audience: string | null
          used_count: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_order_value?: number | null
          starts_at?: string | null
          target_audience?: string | null
          used_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_order_value?: number | null
          starts_at?: string | null
          target_audience?: string | null
          used_count?: number | null
        }
        Relationships: []
      }
      proof_of_delivery: {
        Row: {
          created_at: string | null
          driver_id: string
          gps_accuracy: number | null
          gps_latitude: number | null
          gps_longitude: number | null
          id: string
          id_type: string | null
          notes: string | null
          order_id: string
          photo_storage_path: string | null
          photo_url: string | null
          recipient_id_verified: boolean | null
          recipient_name: string | null
          signature_data: string | null
        }
        Insert: {
          created_at?: string | null
          driver_id: string
          gps_accuracy?: number | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          id_type?: string | null
          notes?: string | null
          order_id: string
          photo_storage_path?: string | null
          photo_url?: string | null
          recipient_id_verified?: boolean | null
          recipient_name?: string | null
          signature_data?: string | null
        }
        Update: {
          created_at?: string | null
          driver_id?: string
          gps_accuracy?: number | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          id?: string
          id_type?: string | null
          notes?: string | null
          order_id?: string
          photo_storage_path?: string | null
          photo_url?: string | null
          recipient_id_verified?: boolean | null
          recipient_name?: string | null
          signature_data?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proof_of_delivery_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_of_delivery_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_driver_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "proof_of_delivery_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_of_delivery_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_warehouse_queue"
            referencedColumns: ["order_id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          reward_amount: number | null
          user_id: string
          uses: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          reward_amount?: number | null
          user_id: string
          uses?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          reward_amount?: number | null
          user_id?: string
          uses?: number | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          completed_at: string | null
          created_at: string | null
          first_order_id: string | null
          id: string
          referral_code_id: string
          referred_id: string
          referrer_id: string
          reward_amount: number | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          first_order_id?: string | null
          id?: string
          referral_code_id: string
          referred_id: string
          referrer_id: string
          reward_amount?: number | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          first_order_id?: string | null
          id?: string
          referral_code_id?: string
          referred_id?: string
          referrer_id?: string
          reward_amount?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_first_order_id_fkey"
            columns: ["first_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_first_order_id_fkey"
            columns: ["first_order_id"]
            isOneToOne: false
            referencedRelation: "v_driver_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "referrals_first_order_id_fkey"
            columns: ["first_order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_first_order_id_fkey"
            columns: ["first_order_id"]
            isOneToOne: false
            referencedRelation: "v_warehouse_queue"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "referrals_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          gateway_reference: string | null
          gateway_response: Json | null
          id: string
          notes: string | null
          order_id: string
          payment_id: string | null
          processed_at: string | null
          reason: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          gateway_reference?: string | null
          gateway_response?: Json | null
          id?: string
          notes?: string | null
          order_id: string
          payment_id?: string | null
          processed_at?: string | null
          reason: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          gateway_reference?: string | null
          gateway_response?: Json | null
          id?: string
          notes?: string | null
          order_id?: string
          payment_id?: string | null
          processed_at?: string | null
          reason?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_driver_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_warehouse_queue"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_deliveries: {
        Row: {
          created_at: string | null
          delivery_type: string | null
          id: string
          order_id: string
          scheduled_date: string
          scheduled_end_time: string
          scheduled_start_time: string
          slot_id: string | null
          special_instructions: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_type?: string | null
          id?: string
          order_id: string
          scheduled_date: string
          scheduled_end_time: string
          scheduled_start_time: string
          slot_id?: string | null
          special_instructions?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_type?: string | null
          id?: string
          order_id?: string
          scheduled_date?: string
          scheduled_end_time?: string
          scheduled_start_time?: string
          slot_id?: string | null
          special_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_driver_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "scheduled_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_warehouse_queue"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "scheduled_deliveries_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "delivery_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string | null
          description: string
          id: string
          order_id: string | null
          priority: string
          resolution: string | null
          resolved_at: string | null
          sla_deadline: string | null
          status: string
          subject: string
          ticket_number: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string | null
          description: string
          id?: string
          order_id?: string | null
          priority?: string
          resolution?: string | null
          resolved_at?: string | null
          sla_deadline?: string | null
          status?: string
          subject: string
          ticket_number: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          order_id?: string | null
          priority?: string
          resolution?: string | null
          resolved_at?: string | null
          sla_deadline?: string | null
          status?: string
          subject?: string
          ticket_number?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_driver_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_warehouse_queue"
            referencedColumns: ["order_id"]
          },
        ]
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
      warehouse_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          order_id: string
          packed_at: string | null
          packer_notes: string | null
          picked_at: string | null
          picker_notes: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["warehouse_task_status"]
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          order_id: string
          packed_at?: string | null
          packer_notes?: string | null
          picked_at?: string | null
          picker_notes?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["warehouse_task_status"]
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          order_id?: string
          packed_at?: string | null
          packer_notes?: string | null
          picked_at?: string | null
          picker_notes?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["warehouse_task_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_driver_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "warehouse_tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_warehouse_queue"
            referencedColumns: ["order_id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string | null
          error: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          source: string
          status: string
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          source: string
          status?: string
        }
        Update: {
          created_at?: string | null
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          source?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      driver_leaderboard: {
        Row: {
          deliveries_7d: number | null
          driver_user_id: string | null
          rank: number | null
        }
        Relationships: []
      }
      v_driver_orders: {
        Row: {
          assignment_id: string | null
          assignment_status:
            | Database["public"]["Enums"]["driver_assignment_status"]
            | null
          created_at: string | null
          delivery_address: Json | null
          delivery_method: string | null
          driver_id: string | null
          item_count: number | null
          order_id: string | null
          order_number: string | null
          total: number | null
        }
        Relationships: []
      }
      v_orders_dashboard: {
        Row: {
          created_at: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_method: string | null
          driver_id: string | null
          driver_status:
            | Database["public"]["Enums"]["driver_assignment_status"]
            | null
          id: string | null
          item_count: number | null
          order_number: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          total: number | null
          warehouse_status:
            | Database["public"]["Enums"]["warehouse_task_status"]
            | null
        }
        Relationships: []
      }
      v_warehouse_queue: {
        Row: {
          assigned_to: string | null
          delivery_method: string | null
          items: Json | null
          order_id: string | null
          order_number: string | null
          order_time: string | null
          scheduled_date: string | null
          scheduled_slot: string | null
          task_id: string | null
          task_status:
            | Database["public"]["Enums"]["warehouse_task_status"]
            | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_reassign_timed_out_assignments: { Args: never; Returns: undefined }
      calculate_dispatch_score: {
        Args: { p_driver_id: string; p_order_lat: number; p_order_lng: number }
        Returns: number
      }
      check_cart_stock: {
        Args: { p_items: Json }
        Returns: {
          available: number
          product_id: string
          product_name: string
          requested: number
          sufficient: boolean
        }[]
      }
      check_stock_availability: {
        Args: { p_order_id: string }
        Returns: {
          available: number
          product_id: string
          product_name: string
          requested: number
          sufficient: boolean
        }[]
      }
      decrement_stock: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: undefined
      }
      depot_release: {
        Args: { p_order_id: string; p_user_id: string }
        Returns: Json
      }
      generate_delivery_pin: { Args: { p_order_id: string }; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_failed_delivery_count: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      increment_stock: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: undefined
      }
      process_auto_complete_jobs: { Args: never; Returns: number }
      recalculate_order_total: { Args: { p_order_id: string }; Returns: Json }
      record_depot_release:
        | {
            Args: {
              p_driver_id: string
              p_items_verified?: boolean
              p_notes?: string
              p_order_id: string
            }
            Returns: undefined
          }
        | {
            Args: { p_order_id: string; p_warehouse_user_id: string }
            Returns: Json
          }
      record_driver_signoff:
        | { Args: { p_order_id: string }; Returns: Json }
        | {
            Args: {
              p_driver_id: string
              p_items_count: number
              p_order_id: string
              p_signature?: string
            }
            Returns: undefined
          }
      release_reserved_stock: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: undefined
      }
      reserve_stock: {
        Args: { p_product_id: string; p_quantity: number }
        Returns: boolean
      }
      validate_and_apply_promo: {
        Args: { p_code: string; p_order_id: string; p_subtotal: number }
        Returns: Json
      }
      verify_delivery_pin:
        | { Args: { p_entered_pin: string; p_order_id: string }; Returns: Json }
        | { Args: { p_entered_pin: string; p_order_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "customer" | "warehouse" | "driver"
      driver_assignment_status:
        | "pending"
        | "accepted"
        | "picked_up"
        | "en_route"
        | "delivered"
        | "failed"
      order_status:
        | "pending"
        | "awaiting_payment"
        | "payment_failed"
        | "confirmed"
        | "preparing"
        | "ready"
        | "driver_assigned"
        | "picked_up"
        | "en_route"
        | "delivery_failed"
        | "return_to_store"
        | "return_received"
        | "rescheduled"
        | "delivered"
        | "completed"
        | "refunded"
        | "cancelled"
        | "failed"
      warehouse_task_status:
        | "pending"
        | "picking"
        | "picked"
        | "packing"
        | "packed"
        | "ready_dispatch"
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
      app_role: ["admin", "customer", "warehouse", "driver"],
      driver_assignment_status: [
        "pending",
        "accepted",
        "picked_up",
        "en_route",
        "delivered",
        "failed",
      ],
      order_status: [
        "pending",
        "awaiting_payment",
        "payment_failed",
        "confirmed",
        "preparing",
        "ready",
        "driver_assigned",
        "picked_up",
        "en_route",
        "delivery_failed",
        "return_to_store",
        "return_received",
        "rescheduled",
        "delivered",
        "completed",
        "refunded",
        "cancelled",
        "failed",
      ],
      warehouse_task_status: [
        "pending",
        "picking",
        "picked",
        "packing",
        "packed",
        "ready_dispatch",
      ],
    },
  },
} as const
