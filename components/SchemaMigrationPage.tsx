


import React from 'react';

interface SchemaMigrationPageProps {
  onRetry: () => void;
  error?: any;
}

const migrationScripts: { [key: string]: { title: string; description: string; script: string } } = {
  'default': {
    title: "Mise à Jour de la Base de Données Requise (v1)",
    description: "L'application a été mise à jour avec des fonctionnalités de validation de tâches qui nécessitent une modification de la structure de votre base de données.",
    script: `-- Ce script met à jour votre table 'chargeable_tasks' pour la nouvelle fonctionnalité de validation des tâches.

-- Ajoute une colonne 'status' pour suivre l'état d'approbation des tâches.
-- La valeur par défaut 'approved' est appliquée aux tâches existantes.
ALTER TABLE public.chargeable_tasks
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';

-- Ajoute une colonne 'proposed_by' pour lier à l'utilisateur qui a soumis la tâche.
ALTER TABLE public.chargeable_tasks
ADD COLUMN IF NOT EXISTS proposed_by UUID REFERENCES auth.users(id);
`
  },
  'PGRST200': {
    title: "Correction de la Base de Données Requise (v2)",
    description: "Une relation est manquante dans votre base de données, ce qui empêche l'affichage du nom des personnes qui proposent des tâches. Ce script va corriger cette relation.",
    script: `-- SCRIPT DE CORRECTION (v2)
-- Ce script corrige la relation manquante entre 'chargeable_tasks' et 'profiles'.

-- ÉTAPE 1: Assurer que la colonne 'proposed_by' existe.
-- (Ne fait rien si elle existe déjà)
ALTER TABLE public.chargeable_tasks
ADD COLUMN IF NOT EXISTS proposed_by UUID;

-- ÉTAPE 2: Supprimer l'ancienne contrainte incorrecte si elle existe.
-- L'ancienne contrainte pointait vers 'auth.users'. Nous la supprimons.
-- Cette commande peut afficher une erreur si la contrainte n'existe pas, c'est normal.
ALTER TABLE public.chargeable_tasks
DROP CONSTRAINT IF EXISTS chargeable_tasks_proposed_by_fkey;

-- ÉTAPE 3: Créer la nouvelle contrainte correcte pointant vers 'profiles'.
-- Cela permet à l'application de trouver le nom du proposant.
ALTER TABLE public.chargeable_tasks
ADD CONSTRAINT chargeable_tasks_proposed_by_fkey
FOREIGN KEY (proposed_by)
REFERENCES public.profiles(id);
`
  },
  'STATUS_COLUMN_MISSING': {
    title: "Mise à Jour de la Base de Données Requise (v3)",
    description: "L'application a été mise à jour avec un flux de validation des feuilles de temps. Cela nécessite d'ajouter une colonne 'status' à votre table 'timesheets'.",
    script: `-- Ce script ajoute la colonne 'status' pour le flux de validation.

-- Ajoute une colonne 'status' pour suivre l'état de la feuille de temps.
-- La valeur par défaut 'draft' (brouillon) est appliquée à toutes les fiches existantes.
ALTER TABLE public.timesheets
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';`
  },
  'TIMESHEET_RLS_MISSING': {
    title: "Mise à Jour de la Sécurité Requise (v4)",
    description: "L'application a détecté une erreur de permission lors de la mise à jour d'une feuille de temps. Cela est dû à des règles de sécurité (Row Level Security) manquantes ou incorrectes sur la table 'timesheets'. Ce script complet va corriger le problème.",
    script: `-- =================================================================
-- SCRIPT DE SÉCURITÉ COMPLET POUR LA TABLE 'timesheets' (v4)
--
-- Ce script :
-- 1. Crée la fonction 'is_admin()' nécessaire pour les règles de sécurité.
-- 2. Nettoie les anciennes règles sur 'timesheets'.
-- 3. Applique les permissions correctes pour le flux de validation.
-- =================================================================

-- ÉTAPE 1: Création d'une fonction sécurisée pour vérifier le rôle admin.
-- 'SECURITY DEFINER' est CRUCIAL. Il exécute la fonction avec les droits du créateur
-- (postgres) et non de l'utilisateur appelant, ce qui empêche la récursion.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
-- Définir le chemin de recherche explicitement est une bonne pratique de sécurité.
SET search_path = public
AS $$
BEGIN
  -- Vérifie si l'utilisateur actuellement authentifié a le rôle 'admin'.
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- ÉTAPE 2: Activation de la Sécurité au Niveau des Lignes (RLS) sur la table.
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

-- ÉTAPE 3: Suppression de TOUTES les anciennes politiques pour un état propre.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'timesheets' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.timesheets;';
    END LOOP;
END $$;

-- ÉTAPE 4: Création de la politique de LECTURE (SELECT).
-- Les admins peuvent voir toutes les feuilles, les employés ne voient que les leurs.
CREATE POLICY "policy_select_timesheets"
ON public.timesheets FOR SELECT TO authenticated
USING (public.is_admin() OR (auth.uid() = employee_id));

-- ÉTAPE 5: Création de la politique d'ÉCRITURE (INSERT).
-- Un utilisateur ne peut créer une feuille de temps que pour lui-même.
CREATE POLICY "policy_insert_timesheets"
ON public.timesheets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = employee_id);

-- ÉTAPE 6: Création des politiques de MISE À JOUR (UPDATE).

-- Règle 6a: Les employés ne peuvent modifier que leurs propres feuilles de temps
-- et UNIQUEMENT si elles sont encore à l'état de brouillon ('draft').
CREATE POLICY "policy_update_own_draft_timesheets"
ON public.timesheets FOR UPDATE TO authenticated
USING ( (NOT public.is_admin()) AND (auth.uid() = employee_id) AND (status = 'draft') )
WITH CHECK ( (auth.uid() = employee_id) );

-- Règle 6b: Les admins peuvent mettre à jour n'importe quelle feuille de temps,
-- peu importe son statut. C'est ce qui leur permet d'approuver ou de dévalider.
CREATE POLICY "policy_update_any_timesheet_for_admins"
ON public.timesheets FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ÉTAPE 7: Création de la politique de SUPPRESSION (DELETE).
-- Seuls les admins peuvent supprimer des feuilles de temps.
CREATE POLICY "policy_delete_timesheets_for_admins"
ON public.timesheets FOR DELETE TO authenticated
USING (public.is_admin());

-- =================================================================
-- FIN DU SCRIPT. Le flux de validation devrait fonctionner.
-- =================================================================
`
  },
  'SCHEMA_CACHE_ERROR': {
    title: "Réparation Ultime Requise (v7)",
    description: "L'application a détecté une erreur de synchronisation persistante entre la base de données et l'API. Ce script 'ultime' va réinitialiser les permissions et forcer la synchronisation pour résoudre le problème. Si cela ne fonctionne pas, des instructions manuelles sont incluses.",
    script: `-- =================================================================
-- SCRIPT DE RÉPARATION ULTIME (v7) - Problème de Cache & Permissions
--
-- Exécutez ce script si vous êtes bloqué par l'erreur "Could not find the 'status' column".
-- Ce script va :
-- 1. S'assurer que la colonne 'status' existe.
-- 2. Recréer la fonction d'aide 'is_admin()'.
-- 3. Réinitialiser complètement la sécurité (RLS) sur la table 'timesheets'.
-- 4. Forcer l'API à recharger son cache.
-- =================================================================

-- ÉTAPE 1: Assurer que la colonne 'status' existe dans la table 'timesheets'.
ALTER TABLE public.timesheets
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';

-- ÉTAPE 2: Recréation de la fonction sécurisée 'is_admin()'.
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

-- ÉTAPE 3: Nettoyage et réinitialisation complète de la RLS.
-- On supprime d'abord toutes les politiques existantes pour éviter les conflits.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'timesheets' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.timesheets;';
    END LOOP;
END $$;

-- On désactive puis réactive la RLS pour forcer une réinitialisation.
ALTER TABLE public.timesheets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

-- ÉTAPE 4: Application des nouvelles politiques de sécurité.
CREATE POLICY "policy_select_timesheets" ON public.timesheets FOR SELECT TO authenticated USING (public.is_admin() OR (auth.uid() = employee_id));
CREATE POLICY "policy_insert_timesheets" ON public.timesheets FOR INSERT TO authenticated WITH CHECK (auth.uid() = employee_id);
CREATE POLICY "policy_update_own_draft_timesheets" ON public.timesheets FOR UPDATE TO authenticated USING ( (NOT public.is_admin()) AND (auth.uid() = employee_id) AND (status = 'draft') ) WITH CHECK ( (auth.uid() = employee_id) );
CREATE POLICY "policy_update_any_timesheet_for_admins" ON public.timesheets FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "policy_delete_timesheets_for_admins" ON public.timesheets FOR DELETE TO authenticated USING (public.is_admin());


-- ÉTAPE 5: Forcer le rechargement du cache de l'API. C'est l'étape la plus importante.
NOTIFY pgrst, 'reload schema';

-- =================================================================
-- FIN DU SCRIPT.
-- Si l'erreur persiste après avoir exécuté ce script, le problème est probablement plus profond.
-- Essayez de "Pause" puis "Restore" votre projet depuis le dashboard Supabase
-- (Project Settings -> General). Cela force un redémarrage complet de l'API.
-- =================================================================`
  },
};


const SchemaMigrationPage: React.FC<SchemaMigrationPageProps> = ({ onRetry, error }) => {

    const errorKey = error?.code === 'SCHEMA_CACHE_ERROR' ? 'SCHEMA_CACHE_ERROR'
        : error?.code === 'TIMESHEET_RLS_MISSING' ? 'TIMESHEET_RLS_MISSING'
        : error?.code === 'STATUS_COLUMN_MISSING' ? 'STATUS_COLUMN_MISSING'
        : error?.code === 'PGRST200' ? 'PGRST200' 
        : 'default';
    const { title, description, script } = migrationScripts[errorKey];

    const handleCopy = () => {
        navigator.clipboard.writeText(script)
            .then(() => alert('Script copié dans le presse-papiers !'))
            .catch(err => console.error('Failed to copy text: ', err));
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
            <div className="max-w-2xl w-full bg-white shadow-lg rounded-lg p-8">
                <div className="text-center mb-6">
                    <svg className="mx-auto h-12 w-12 text-yellow-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21L21 17.25" />
                    </svg>
                    <h1 className="text-2xl font-bold text-gray-800 mt-4">{title}</h1>
                    <p className="text-gray-600 mt-2">{description}</p>
                </div>
                
                <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 mb-6 rounded-md" role="alert">
                    <p className="font-bold">Action requise</p>
                    <p className="mt-1 text-sm">Veuillez exécuter le script SQL ci-dessous dans l'éditeur SQL de votre projet Supabase pour continuer.</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Script de Migration SQL :
                        </label>
                        <div className="mt-1 bg-gray-800 text-white p-4 rounded-md text-xs font-mono overflow-x-auto relative">
                             <button
                                onClick={handleCopy}
                                className="absolute top-2 right-2 px-2 py-1 bg-gray-600 text-white rounded-md text-xs hover:bg-gray-500"
                            >
                                Copier
                            </button>
                            <pre><code>{script}</code></pre>
                        </div>
                    </div>
                     <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                        <li>Allez sur <a href="https://supabase.com/" target="_blank" rel="noopener noreferrer" className="underline font-semibold">votre projet Supabase</a>.</li>
                        <li>Dans le menu de gauche, cliquez sur <strong>SQL Editor</strong>.</li>
                        <li>Copiez le script ci-dessus et collez-le dans l'éditeur.</li>
                        <li>Cliquez sur le bouton <strong>RUN</strong>.</li>
                    </ol>
                    <div>
                        <button
                            type="button"
                            onClick={onRetry}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
                        >
                            J'ai exécuté le script, continuer vers l'application
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SchemaMigrationPage;