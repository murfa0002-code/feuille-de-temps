import React, { useState, FormEvent, useEffect } from 'react';
import LogoIcon from './icons/LogoIcon';
import { supabase } from '../utils/supabaseClient';

// Helper function to translate common Supabase auth errors into French
const translateSupabaseError = (message: string): string => {
    if (message.includes('Email not confirmed')) {
        return 'Veuillez confirmer votre adresse e-mail. Vérifiez votre boîte de réception (et vos spams) pour trouver l\'e-mail de confirmation.';
    }
    if (message.includes('User already registered')) {
        return 'Un utilisateur avec cette adresse e-mail est déjà enregistré.';
    }
    if (message.includes('Invalid login credentials')) {
        return 'Adresse e-mail ou mot de passe incorrect.';
    }
    if (message.includes('Password should be at least 6 characters')) {
        return 'Le mot de passe doit contenir au moins 6 caractères.';
    }
    if (message.includes('Unable to validate email address: invalid format')) {
        return "Le format de l'adresse e-mail est invalide.";
    }
    if (message.includes('Email rate limit exceeded')) {
        return 'Trop de tentatives. Veuillez réessayer plus tard.';
    }
    // Fallback for other errors
    return "Une erreur est survenue. Veuillez réessayer.";
};

const InfiniteRecursionError = () => {
    const sqlScript = `-- =================================================================
-- SCRIPT DE RÉINITIALISATION COMPLET POUR 'PROFILES' (Version 2)
-- Corrige l'erreur de "récursion infinie".
-- À exécuter en tant que superutilisateur (ex: 'postgres') depuis l'éditeur SQL.
-- =================================================================

-- ÉTAPE 1: Suppression de TOUTES les anciennes politiques sur la table 'profiles'.
-- Cela garantit un état propre avant de créer les nouvelles règles.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.profiles;';
    END LOOP;
END $$;


-- ÉTAPE 2: Création d'une fonction sécurisée pour vérifier le rôle admin.
-- 'SECURITY DEFINER' est CRUCIAL. Il exécute la fonction avec les droits du créateur (postgres)
-- et non de l'utilisateur appelant, ce qui contourne la RLS à l'intérieur de la fonction et empêche la récursion.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
-- Définir le chemin de recherche explicitement est une bonne pratique de sécurité.
SET search_path = public
AS $$
BEGIN
  -- Vérifie si l'utilisateur actuellement authentifié a le rôle 'admin' dans la table des profils.
  -- Renvoie true si c'est le cas, sinon false. 'EXISTS' est efficace.
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;


-- ÉTAPE 3: Activation de la Sécurité au Niveau des Lignes (RLS).
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- ÉTAPE 4: Création d'une politique de LECTURE (SELECT) unique et efficace.
-- Cette unique règle gère tous les cas de lecture.
CREATE POLICY "Les utilisateurs peuvent consulter les profils"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    is_admin() -- Si l'utilisateur est un admin, il peut tout voir.
    OR
    auth.uid() = id -- Sinon, il ne peut voir que son propre profil.
);


-- ÉTAPE 5: Création d'une politique de MISE À JOUR (UPDATE).
-- Permet aux utilisateurs de modifier leurs propres informations.
CREATE POLICY "Les utilisateurs peuvent mettre à jour leur propre profil"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- =================================================================
-- FIN DU SCRIPT. La connexion devrait maintenant fonctionner.
-- =================================================================`;

    return (
        <div className="text-left text-sm text-red-600 border border-red-300 bg-red-50 p-4 rounded-md">
            <p className="font-bold text-base mb-2">Erreur de Récursion Infinie (Mise à jour)</p>
            <p className="mb-3">Il semble que la solution précédente n'a pas fonctionné. Cette erreur persistante est due à une configuration complexe de vos règles de sécurité (RLS).</p>
            <p className="mb-3 font-semibold">Solution Définitive : Veuillez exécuter cette version améliorée du script SQL dans votre éditeur Supabase. Il nettoie plus agressivement les anciennes règles et en crée de nouvelles, plus robustes :</p>
            <div className="bg-gray-800 text-white p-3 rounded-md text-xs overflow-x-auto">
                <pre><code>{sqlScript}</code></pre>
            </div>
        </div>
    );
};


const LoginPage: React.FC = () => {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<React.ReactNode | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showResend, setShowResend] = useState(false);

    useEffect(() => {
        const loginError = sessionStorage.getItem('loginError');
        if (loginError) {
            if (loginError === 'infinite_recursion') {
                setError(<InfiniteRecursionError />);
            } else {
                setError(loginError);
            }
            sessionStorage.removeItem('loginError');
        }
    }, []);

    const handleLogin = async () => {
        setShowResend(false);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) {
            if (error.message.includes('Email not confirmed')) {
                setShowResend(true);
            }
            setError(translateSupabaseError(error.message));
        }
    }

    const handleSignup = async () => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                    username,
                }
            }
        });
        if (error) {
            setError(translateSupabaseError(error.message));
        } else {
            setSuccess('Compte créé ! Veuillez vérifier vos e-mails pour confirmer votre inscription.');
            setMode('login');
        }
    }

    const handleResendConfirmation = async () => {
        if (!email) {
            setError("Veuillez entrer votre adresse e-mail dans le champ ci-dessus.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setSuccess(null);
        setShowResend(false);

        const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email: email,
        });

        setIsLoading(false);
        if (resendError) {
            setError(`Erreur lors du renvoi de l'e-mail : ${resendError.message}`);
        } else {
            setSuccess("E-mail de confirmation renvoyé ! Veuillez vérifier votre boîte de réception.");
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setShowResend(false);
        setIsLoading(true);
        
        if (mode === 'login') {
            await handleLogin();
        } else {
            await handleSignup();
        }
        setIsLoading(false);
    };

    const toggleMode = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        setMode(prev => prev === 'login' ? 'signup' : 'login');
        setError(null);
        setSuccess(null);
        setShowResend(false);
        setName('');
        setUsername('');
        setEmail('');
        setPassword('');
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
                <div className="text-center mb-8">
                    <LogoIcon className="h-16 w-auto mx-auto" />
                    <h1 className="text-3xl font-bold text-gray-800 mt-4">LGMC- MUTANDIS</h1>
                    <p className="text-gray-500">
                        {mode === 'login' ? 'Veuillez vous connecter pour continuer' : 'Créez votre compte pour commencer'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {mode === 'signup' && (
                         <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                Nom complet
                            </label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                autoComplete="name"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                                placeholder="Jean Dupont"
                            />
                        </div>
                    )}
                     {mode === 'signup' && (
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                                Identifiant (court)
                            </label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                                placeholder="jdupont"
                            />
                        </div>
                    )}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                            Adresse e-mail
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                            placeholder="vous@exemple.com"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                            Mot de passe
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <div className="text-center">
                            {(() => {
                                if (React.isValidElement(error)) {
                                    return error;
                                }
                                if (typeof error === 'string') {
                                    return <p className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>;
                                }
                                // Fallback for other types to avoid "[object Object]"
                                return (
                                    <div className="text-left text-xs bg-red-50 p-2 border border-red-200 rounded">
                                        <p className="font-bold text-sm text-red-700 mb-1">Erreur inattendue :</p>
                                        <pre className="whitespace-pre-wrap break-all">
                                            {JSON.stringify(error, null, 2)}
                                        </pre>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                    {success && <p className="text-sm text-green-600 text-center">{success}</p>}

                    {showResend && (
                        <div className="text-center">
                            <button
                                type="button"
                                onClick={handleResendConfirmation}
                                disabled={isLoading}
                                className="text-sm font-medium text-cyan-600 hover:text-cyan-500 focus:outline-none disabled:text-gray-400"
                            >
                                Renvoyer l'e-mail de confirmation
                            </button>
                        </div>
                    )}
                    
                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:bg-gray-400"
                        >
                            {isLoading ? 'Chargement...' : (mode === 'login' ? 'Se connecter' : 'Créer le compte')}
                        </button>
                    </div>

                    <div className="text-center text-sm">
                        <p className="text-gray-600">
                            {mode === 'login' ? 'Pas encore de compte ?' : 'Vous avez déjà un compte ?'}
                            <button onClick={toggleMode} className="font-medium text-cyan-600 hover:text-cyan-500 ml-1 focus:outline-none">
                                {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
                            </button>
                        </p>
                    </div>
                </form>
            </div>
            <footer className="text-center text-sm text-gray-500 mt-8">
                <p>&copy; {new Date().getFullYear()} Daily Task Tracker. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default LoginPage;