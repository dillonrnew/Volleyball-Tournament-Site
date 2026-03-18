// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://atxjzodlczvrybtejvsn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0eGp6b2RsY3p2cnlidGVqdnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2OTI3MTUsImV4cCI6MjA4OTI2ODcxNX0.sAzlnRDq31WvQIbtmPzMa8iocyV9oSgc8R7fs_7JvdI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
