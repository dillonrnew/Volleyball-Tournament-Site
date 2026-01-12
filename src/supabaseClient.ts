// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cszyqguhwvxnkozuyldj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzenlxZ3Vod3Z4bmtvenV5bGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODc2ODksImV4cCI6MjA3OTQ2MzY4OX0.nqxjN2aGdZm-7BfMW6GolxQ9hG8hdWSXdENVrpXo-MU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
