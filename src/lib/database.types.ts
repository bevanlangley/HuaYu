// Generated types for the HuaYu Supabase schema.
// Regenerate after schema changes:
//   npx supabase gen types typescript --project-id fbuwzzsesxukavldlrmu > src/lib/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      seeds: {
        Row: {
          id: string
          name: string
          source_url: string | null
          tag: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          source_url?: string | null
          tag?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          source_url?: string | null
          tag?: string | null
          created_at?: string
        }
        Relationships: []
      }
      phrases: {
        Row: {
          id: string
          seed_id: string
          mandarin: string
          english: string
          pinyin: string
          phrase_type: Database['public']['Enums']['phrase_type']
          created_at: string
        }
        Insert: {
          id?: string
          seed_id: string
          mandarin: string
          english: string
          pinyin: string
          phrase_type?: Database['public']['Enums']['phrase_type']
          created_at?: string
        }
        Update: {
          id?: string
          seed_id?: string
          mandarin?: string
          english?: string
          pinyin?: string
          phrase_type?: Database['public']['Enums']['phrase_type']
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'phrases_seed_id_fkey'
            columns: ['seed_id']
            isOneToOne: false
            referencedRelation: 'seeds'
            referencedColumns: ['id']
          }
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
      phrase_type: 'question' | 'answer' | 'statement'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience derived types
export type Seed = Database['public']['Tables']['seeds']['Row']
export type SeedInsert = Database['public']['Tables']['seeds']['Insert']
export type SeedUpdate = Database['public']['Tables']['seeds']['Update']

export type Phrase = Database['public']['Tables']['phrases']['Row']
export type PhraseInsert = Database['public']['Tables']['phrases']['Insert']
export type PhraseUpdate = Database['public']['Tables']['phrases']['Update']
export type PhraseType = Database['public']['Enums']['phrase_type']

export type SeedWithPhrases = Seed & { phrases: Phrase[] }
export type SeedWithCount = Seed & { phraseCount: number }
export type PhraseWithSeed = Phrase & { seeds: Pick<Seed, 'id' | 'name' | 'tag'> | null }
