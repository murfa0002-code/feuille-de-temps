import React, { useState, FormEvent } from 'react';
import { setSupabaseCredentials } from '../utils/supabaseClient';
import LogoIcon from './icons/LogoIcon';

const SupabaseConfigPage: React.FC = () => {
    const [url, setUrl] = useState('');
    const [anonKey, setAnonKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        if (url.trim() && anonKey.trim()) {
            setSupabaseCredentials(url.trim(), anonKey.trim());
            // The page will reload after this function call.
        } else {
            alert("Veuillez remplir les deux champs.");
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
            <div className="max-w-xl w-full bg-white shadow-lg rounded-lg p-8">
                <div className="text-center mb-6">
                    <LogoIcon className="h-16 w-auto mx-auto" />
                    <h1 className="text-3xl font-bold text-gray-800 mt-4">Configuration Supabase</h1>
                    <p className="text-gray-500 mt-2">
                        Veuillez configurer votre connexion à Supabase pour continuer.
                    </p>
                </div>
                
                <div className="bg-blue-50 border-l-4 border-blue-400 text-blue-700 p-4 mb-6 rounded-md" role="alert">
                    <p className="font-bold">Où trouver ces informations ?</p>
                    <ol className="list-decimal list-inside mt-2 text-sm space-y-1">
                        <li>Allez sur votre projet sur <a href="https://supabase.com/" target="_blank" rel="noopener noreferrer" className="underline font-semibold">supabase.com</a></li>
                        <li>Cliquez sur "Project Settings" (icône d'engrenage).</li>
                        <li>Cliquez sur "API".</li>
                        <li>Copiez l'<strong>URL</strong> et la clé publique (<strong>anon key</strong>).</li>
                    </ol>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="supabase-url" className="block text-sm font-medium text-gray-700">
                            Project URL
                        </label>
                        <input
                            id="supabase-url"
                            type="url"
                            required
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                            placeholder="https://xxxxxxxx.supabase.co"
                        />
                    </div>
                    <div>
                        <label htmlFor="supabase-anon-key" className="block text-sm font-medium text-gray-700">
                            Public Anon Key
                        </label>
                        <textarea
                            id="supabase-anon-key"
                            required
                            rows={3}
                            value={anonKey}
                            onChange={(e) => setAnonKey(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 font-mono text-sm"
                            placeholder="ey..."
                        />
                    </div>
                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:bg-gray-400"
                        >
                            {isLoading ? 'Sauvegarde...' : 'Sauvegarder et Continuer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SupabaseConfigPage;
