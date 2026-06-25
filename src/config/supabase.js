const { createClient } = require('@supabase/supabase-js');

let _supabase = null;

const getSupabase = () => {
  if (!_supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridos en .env');
    }
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return _supabase;
};

// Proxy para mantener la API igual: supabase.from(...), supabase.storage...
const supabase = new Proxy(
  {},
  {
    get(_, prop) {
      return (...args) => getSupabase()[prop](...args);
    },
  }
);

module.exports = { supabase };
