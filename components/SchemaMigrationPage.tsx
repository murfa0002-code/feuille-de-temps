
import React from 'react';

interface SchemaMigrationPageProps {
  onRetry: () => void;
  error?: any;
}

const migrationScripts: { [key: string]: { title: string; description: string; script: string } } = {
  'MISSING_TABLES': {
    title: "Initialisation Complète de la Base de Données",
    description: "Votre base de données est vide (suite à la suspension du projet). Ce script va recréer toutes les tables, les relations et les règles de sécurité nécessaires.",
    script: `-- =================================================================
-- SCRIPT DE REGENERATION COMPLET (LGMC MUTANDIS)
-- Copiez tout ce contenu et exécutez-le dans l'éditeur SQL de Supabase.
-- =================================================================

-- 1. Vérification et nettoyage préalable (pour éviter les conflits)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.is_admin();

-- 2. Table PROFILES (Profils utilisateurs)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  username TEXT,
  role TEXT CHECK (role IN ('admin', 'employee')) DEFAULT 'employee',
  updated_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id)
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Table TIMESHEETS (Feuilles de temps)
CREATE TABLE IF NOT EXISTS public.timesheets (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.profiles(id) NOT NULL,
  period_number TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  tasks JSONB DEFAULT '[]'::jsonb,
  todo_list JSONB DEFAULT '[]'::jsonb, -- Ajout de la colonne pour la To-Do List
  normal_hours JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

-- 4. Table CHARGEABLE_TASKS (Tâches facturables)
CREATE TABLE IF NOT EXISTS public.chargeable_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'approved',
  proposed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);
ALTER TABLE public.chargeable_tasks ENABLE ROW LEVEL SECURITY;

-- 5. Fonction de vérification du rôle ADMIN
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- 6. Trigger pour création automatique de profil à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, username, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'name', 'Utilisateur'), 
    COALESCE(new.raw_user_meta_data->>'username', 'user'), 
    'employee'
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. POLITIQUES DE SÉCURITÉ (RLS) - Nettoyage et Création

-- Suppression des anciennes politiques pour éviter les erreurs "Policy already exists"
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(r.tablename) || ';';
    END LOOP;
END $$;

-- Politiques PROFILES
CREATE POLICY "Lecture publique des profils" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Modification de son propre profil" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Politiques TIMESHEETS
CREATE POLICY "Lecture: Admin tout, Employé les siennes" ON timesheets FOR SELECT TO authenticated USING (is_admin() OR auth.uid() = employee_id);
CREATE POLICY "Création: Employé pour lui-même" ON timesheets FOR INSERT TO authenticated WITH CHECK (auth.uid() = employee_id);
CREATE POLICY "Modification: Admin tout, Employé brouillon seulement" ON timesheets FOR UPDATE TO authenticated USING ((auth.uid() = employee_id AND status = 'draft') OR is_admin());
CREATE POLICY "Suppression: Admin seulement" ON timesheets FOR DELETE TO authenticated USING (is_admin());

-- Politiques CHARGEABLE_TASKS
CREATE POLICY "Lecture: Tout le monde" ON chargeable_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Création: Tout utilisateur authentifié" ON chargeable_tasks FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Modification: Admin seulement" ON chargeable_tasks FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Suppression: Admin seulement" ON chargeable_tasks FOR DELETE TO authenticated USING (is_admin());

-- Fin du script
`
  },
  'MISSING_TODO_LIST': {
    title: "Mise à Jour : Ajout To-Do List",
    description: "Une nouvelle fonctionnalité 'To-Do List' a été ajoutée. Une colonne est manquante dans la base de données.",
    script: `-- Ajout de la colonne todo_list
ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS todo_list JSONB DEFAULT '[]'::jsonb;
`
  },
  'default': {
    title: "Mise à Jour Requise",
    description: "Une erreur de schéma a été détectée. Veuillez appliquer le correctif ci-dessous.",
    script: `-- Ajout de la colonne todo_list (Correctif standard)
ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS todo_list JSONB DEFAULT '[]'::jsonb;
`
  },
  'PGRST200': {
    title: "Correction de Relation Manquante",
    description: "Le lien entre les tâches et les utilisateurs est manquant.",
    script: `ALTER TABLE public.chargeable_tasks ADD COLUMN IF NOT EXISTS proposed_by UUID REFERENCES public.profiles(id);`
  },
  'STATUS_COLUMN_MISSING': {
    title: "Colonne Status Manquante",
    description: "Ajout de la colonne status à la table timesheets.",
    script: `ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';`
  },
  'TIMESHEET_RLS_MISSING': {
    title: "Permissions Manquantes",
    description: "Réinitialisation des permissions de sécurité.",
    script: `-- Réinitialisation des permissions
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Voir feuilles" ON public.timesheets FOR SELECT USING (true);
`
  },
  'SCHEMA_CACHE_ERROR': {
    title: "Erreur de Cache Schema",
    description: "Le cache de l'API Supabase doit être rafraîchi.",
    script: `NOTIFY pgrst, 'reload schema';`
  },
};


const SchemaMigrationPage: React.FC<SchemaMigrationPageProps> = ({ onRetry, error }) => {
    
    // Detect if tables are completely missing (Error 42P01 usually)
    // Or if we get specific "relation does not exist" messages
    const errorMessage = typeof error === 'string' ? error : (error?.message || '');
    const isMissingTables = 
        error?.code === '42P01' || 
        errorMessage.includes('relation "profiles" does not exist') ||
        errorMessage.includes('relation "public.profiles" does not exist') ||
        errorMessage.includes('relation "timesheets" does not exist');
    
    // Determine the error key
    const errorKey = 
          error?.code === 'SCHEMA_CACHE_ERROR' ? 'SCHEMA_CACHE_ERROR'
        : error?.code === 'TIMESHEET_RLS_MISSING' ? 'TIMESHEET_RLS_MISSING'
        : error?.code === 'STATUS_COLUMN_MISSING' ? 'STATUS_COLUMN_MISSING'
        : error?.code === 'MISSING_TODO_LIST' ? 'MISSING_TODO_LIST'
        : error?.code === 'PGRST200' ? 'PGRST200' 
        : isMissingTables ? 'MISSING_TABLES'
        : 'default'; 
        
    const { title, description, script } = migrationScripts[errorKey] || migrationScripts['default'];

    const handleCopy = () => {
        navigator.clipboard.writeText(script)
            .then(() => alert('Script copié dans le presse-papiers !'))
            .catch(err => console.error('Failed to copy text: ', err));
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
            <div className="max-w-3xl w-full bg-white shadow-lg rounded-lg p-8">
                <div className="text-center mb-6">
                    <svg className="mx-auto h-12 w-12 text-cyan-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-4.991-2.695v4.992h-4.992m0 0l-3.182-3.182a8.25 8.25 0 0111.664 0l3.182 3.182" />
                    </svg>
                    <h1 className="text-2xl font-bold text-gray-800 mt-4">{title}</h1>
                    <p className="text-gray-600 mt-2">{description}</p>
                    <p className="text-xs text-gray-400 mt-2 font-mono bg-gray-50 inline-block px-2 py-1 rounded">Code erreur: {error?.code || 'N/A'}</p>
                </div>
                
                <div className="bg-blue-50 border-l-4 border-blue-400 text-blue-800 p-4 mb-6 rounded-md text-left" role="alert">
                    <p className="font-bold mb-2">Instructions de réparation :</p>
                    <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                        <li>Copiez le script SQL ci-dessous.</li>
                        <li>Allez sur <a href="https://supabase.com/dashboard/project/_/sql" target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-blue-600">l'éditeur SQL de votre projet Supabase</a>.</li>
                        <li>Collez le script dans la zone de texte (effacez tout contenu existant).</li>
                        <li>Cliquez sur le bouton vert <strong>RUN</strong> en bas à droite.</li>
                        <li>Une fois le succès confirmé ("Success"), revenez ici et cliquez sur le bouton en bas de page.</li>
                    </ol>
                </div>

                <div className="space-y-4 text-left">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Script SQL à exécuter :
                        </label>
                        <div className="relative group">
                            <div className="bg-gray-900 text-gray-100 p-4 rounded-md text-xs font-mono overflow-x-auto max-h-[400px] overflow-y-auto border border-gray-700 shadow-inner">
                                <pre><code>{script}</code></pre>
                            </div>
                            <button
                                onClick={handleCopy}
                                className="absolute top-2 right-2 px-3 py-1.5 bg-gray-700 text-white rounded-md text-xs font-medium hover:bg-gray-600 opacity-80 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                                Copier
                            </button>
                        </div>
                    </div>
                    
                    <div className="pt-4">
                        <button
                            type="button"
                            onClick={onRetry}
                            className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            J'ai exécuté le script, Recharger l'application
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SchemaMigrationPage;
