// config.js - FINAL CORRECTED VERSION

// Replace with your Supabase project's URL and anon key
const SUPABASE_URL = 'https://lhviottjqinidjrerrpu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxodmlvdHRqcWluaWRqcmVycnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NDE4MDMsImV4cCI6MjA2ODQxNzgwM30.k3p6hVLp58TcQcsv45C32QPQWL8NVdK0otg9BZOma4o';

// This is the correct line. It uses the global 'supabase' object from the CDN,
// which has the 'createClient' method.
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);