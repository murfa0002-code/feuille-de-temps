import { createClient, SupabaseClient } from '@supabase/supabase-js'

// --- Supabase Project Credentials ---
// These are your project's specific URL and public API key.
// We prioritize credentials from localStorage if they have been set by the user.
const supabaseUrl = localStorage.getItem('supabaseUrl') || 'https://kqglsrwjknnyafbmyqep.supabase.co';
const supabaseAnonKey = localStorage.getItem('supabaseAnonKey') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZ2xzcndqa25ueWFmYm15cWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0OTU2ODEsImV4cCI6MjA3NTA3MTY4MX0.AOlsAzFim2XC_zOxY_gS5Oly6LtFEFKwE05rvfqXozU';


// Check if credentials are provided
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL and Anon Key are missing. Please provide them in utils/supabaseClient.ts");
}

/**
 * The Supabase client is initialized with the provided credentials.
 * This single instance is exported and used throughout the application.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Stores Supabase credentials in localStorage and reloads the page to apply them.
 * @param url The Supabase project URL.
 * @param anonKey The Supabase public anon key.
 */
export const setSupabaseCredentials = (url: string, anonKey: string) => {
    localStorage.setItem('supabaseUrl', url);
    localStorage.setItem('supabaseAnonKey', anonKey);
    window.location.reload();
};
