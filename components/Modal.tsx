import React, { useState, FormEvent } from 'react';
import { Employee } from '../types';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

interface InputFormProps {
    label: string;
    placeholder: string;
    buttonText: string;
    onSave: (value: string) => void;
}

interface AddTaskFormProps {
    availableTasks: string[];
    onAddTaskToSheet: (taskName: string) => void;
    onSubmitNewTask: (taskName: string) => void;
}

interface NewEmployeeFormProps {
    onSave: (name: string, username: string, password: string, role: 'admin' | 'employee') => void;
}

const Modal: React.FC<ModalProps> & { 
    InputForm: React.FC<InputFormProps>,
    AddTaskForm: React.FC<AddTaskFormProps>,
    NewEmployeeForm: React.FC<NewEmployeeFormProps>
} = ({ title, onClose, children }) => {
  return (
    <div 
      className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 transition-opacity"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-md m-4 transform transition-all"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-800">{title}</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

const InputForm: React.FC<InputFormProps> = ({ label, placeholder, buttonText, onSave }) => {
    const [value, setValue] = useState('');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (value.trim()) {
            onSave(value.trim());
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <label htmlFor="modal-input" className="block text-sm font-medium text-gray-700">{label}</label>
            <input
                id="modal-input"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                placeholder={placeholder}
                autoFocus
            />
            <div className="mt-6 flex justify-end">
                <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
                >
                    {buttonText}
                </button>
            </div>
        </form>
    );
};

const AddTaskForm: React.FC<AddTaskFormProps> = ({ availableTasks, onAddTaskToSheet, onSubmitNewTask }) => {
    const [selection, setSelection] = useState('');
    const [newTaskName, setNewTaskName] = useState('');
    const showNewTaskInput = selection === '__CREATE_NEW__';

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (showNewTaskInput) {
            if (newTaskName.trim()) {
                onSubmitNewTask(newTaskName.trim());
            }
        } else if (selection) {
            onAddTaskToSheet(selection);
        }
    };

    const buttonText = showNewTaskInput ? "Soumettre pour approbation" : "Ajouter la tâche";

    return (
        <form onSubmit={handleSubmit}>
            <label htmlFor="task-select" className="block text-sm font-medium text-gray-700">Choisir une tâche existante</label>
            <select
                id="task-select"
                value={selection}
                onChange={(e) => setSelection(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
            >
                <option value="" disabled>-- Sélectionner --</option>
                {availableTasks.map(task => <option key={task} value={task}>{task}</option>)}
                <option value="__CREATE_NEW__" className="font-bold text-cyan-700">-- Proposer une nouvelle tâche --</option>
            </select>

            {showNewTaskInput && (
                <div className="mt-4">
                    <label htmlFor="new-task-input" className="block text-sm font-medium text-gray-700">Nom de la nouvelle tâche :</label>
                    <input
                        id="new-task-input"
                        type="text"
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                        placeholder="Ex: Rédaction de rapport"
                        autoFocus
                    />
                </div>
            )}
            
            <div className="mt-6 flex justify-end">
                <button
                    type="submit"
                    disabled={!selection || (showNewTaskInput && !newTaskName.trim())}
                    className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {buttonText}
                </button>
            </div>
        </form>
    );
};

const NewEmployeeForm: React.FC<NewEmployeeFormProps> = ({ onSave }) => {
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<Employee['role']>('employee');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (name.trim() && username.trim() && password.trim()) {
            onSave(name.trim(), username.trim(), password.trim(), role);
        }
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="employee-name" className="block text-sm font-medium text-gray-700">Nom complet :</label>
                <input
                    id="employee-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="Ex: Jean Dupont"
                    required
                    autoFocus
                />
            </div>
            <div>
                <label htmlFor="employee-username" className="block text-sm font-medium text-gray-700">Identifiant :</label>
                <input
                    id="employee-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="Ex: jean.dupont"
                    required
                />
            </div>
            <div>
                <label htmlFor="employee-password" className="block text-sm font-medium text-gray-700">Mot de passe :</label>
                <input
                    id="employee-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="••••••••"
                    required
                />
            </div>
             <div>
                <label htmlFor="employee-role" className="block text-sm font-medium text-gray-700">Rôle :</label>
                <select
                    id="employee-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as Employee['role'])}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                >
                    <option value="employee">Collaborateur</option>
                    <option value="admin">Administrateur</option>
                </select>
            </div>
            <div className="mt-6 flex justify-end">
                <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
                >
                    Enregistrer
                </button>
            </div>
        </form>
    );
};

Modal.InputForm = InputForm;
Modal.AddTaskForm = AddTaskForm;
Modal.NewEmployeeForm = NewEmployeeForm;

export default Modal;
