import { Task, TaskCategory } from './types';

export const DAYS_OF_WEEK = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi & dimanche'];

export const NORMAL_HOURS = [8, 8, 8, 8, 8, 0];

// Renamed and removed UUIDs. They will be generated on timesheet creation.
export const INITIAL_NON_CHARGEABLE_TASKS: Omit<Task, 'id' | 'hours'>[] = [
  // Chargeable tasks are now added dynamically by the user.
  // This initial list only contains non-chargeable tasks.

  // Temps non chargeable
  { name: 'Réunions', category: TaskCategory.NON_CHARGEABLE },
  { name: 'Séminaires', category: TaskCategory.NON_CHARGEABLE },
  { name: 'Examens', category: TaskCategory.NON_CHARGEABLE },
  { name: 'Jours fériés', category: TaskCategory.NON_CHARGEABLE },
  { name: 'Maladie', category: TaskCategory.NON_CHARGEABLE },
  { name: 'Absence non payée', category: TaskCategory.NON_CHARGEABLE },
  { name: 'Congés payés', category: TaskCategory.NON_CHARGEABLE },
  { name: 'Autres', category: TaskCategory.NON_CHARGEABLE },
];
