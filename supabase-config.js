/**
 * Supabase Client Configuration & Helper Interface
 */
const SUPABASE_URL = window.SUPABASE_URL || 'https://xyzcompany.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo-key';

let supabaseClient = null;

if (typeof supabase !== 'undefined' && supabase.createClient) {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.warn('Supabase SDK CDN not loaded or unavailable. Operating in offline/local-first mode.');
}

const SupabaseService = {
  getClient() {
    return supabaseClient;
  },

  async insertPunch(punchRecord) {
    if (!navigator.onLine || !supabaseClient) {
      console.log('Offline/No Supabase Client. Enqueuing punch for background sync:', punchRecord.id);
      return { success: false, offline: true };
    }

    try {
      const { data, error } = await supabaseClient
        .from('punches')
        .insert([{
          id: punchRecord.id,
          employee_id: punchRecord.employeeId,
          event_type: punchRecord.eventType,
          timestamp_utc: punchRecord.timestamp,
          photo_base64: punchRecord.photo,
          auth_method: punchRecord.authMethod,
          justification: punchRecord.justification || null,
          synced_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Supabase insert error:', error);
        return { success: false, error };
      }

      return { success: true, data };
    } catch (err) {
      console.error('Network exception calling Supabase:', err);
      return { success: false, offline: true, error: err };
    }
  },

  async insertInconsistency(incRecord) {
    if (!navigator.onLine || !supabaseClient) {
      return { success: false, offline: true };
    }

    try {
      const { data, error } = await supabaseClient
        .from('inconsistencies')
        .insert([{
          id: incRecord.id,
          employee_id: incRecord.employeeId,
          type: incRecord.type,
          description: incRecord.description,
          date: incRecord.date,
          created_at: new Date().toISOString()
        }]);

      if (error) return { success: false, error };
      return { success: true, data };
    } catch (err) {
      return { success: false, offline: true, error: err };
    }
  }
};
