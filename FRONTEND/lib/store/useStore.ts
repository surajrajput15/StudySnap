import { create } from 'zustand';
import { StateStorage, createJSONStorage, persist } from 'zustand/middleware';
import type { StoreApi } from 'zustand';
import { DAILY_GOAL, REVISION_INTERVAL_DAYS } from '../constants';
import { dateKey } from '../utils';

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[]; // parsed from comma-separated string
  isPinned: boolean;
  isFavorite: boolean;
  pinLock: string | null; // salted hash if locked (never the raw PIN), else null
  categoryId: string | null;
  folderId: string | null;
  lastRevisedAt: string | null;
  nextRevisionAt: string | null;
  revisionStreak: number;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceNote {
  id: string;
  noteId: string;
  audioUrl: string;
  duration: number; // in seconds
  transcript: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Folder {
  id: string;
  name: string;
}

export interface UserProfile {
  name: string;
  college: string;
  field: string;
  semester: string;
  studyGoals: string;
  streakCount: number;
  lastActiveDate: string | null;
}

export interface RevisionLog {
  id: string;
  noteId: string;
  revisedAt: string;
  rating: 'easy' | 'medium' | 'hard';
  nextScheduledAt: string;
}

export interface WeeklyChallenge {
  id: string;
  label: string;
  description: string;
  target: number;
  progress: number;
  xpReward: number;
  coinReward: number;
  weekStart: string;
}

interface AppState {
  theme: 'light' | 'dark';
  user: UserProfile;
  notes: Note[];
  voiceNotes: VoiceNote[];
  categories: Category[];
  folders: Folder[];
  revisionLogs: RevisionLog[];
  isOffline: boolean;
  activeNoteId: string | null;
  activeFolderId: string | null;
  activeCategoryId: string | null;
  searchQuery: string;
  activeAiTool: string | null;

  // Gamification
  coins: number;
  earnedAchievements: string[];
  weeklyChallenge: WeeklyChallenge | null;
  dailyGoal: number;
  dailyProgress: number;
  lastDailyReset: string;

  // Storage health (ephemeral — never persisted)
  persistenceError: boolean;

  // Theme Actions
  toggleTheme: () => void;

  // Profile Actions
  updateProfile: (profile: Partial<UserProfile>) => void;
  syncProfileNameFromClerk: (fullName: string | null | undefined) => void;
  incrementStreak: () => void;

  // Notes Actions
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'lastRevisedAt' | 'nextRevisionAt' | 'revisionStreak'> & { 
    id?: string;
    lastRevisedAt?: string | null;
    nextRevisionAt?: string | null;
    revisionStreak?: number;
  }) => Note;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;

  // Voice Notes Actions
  addVoiceNote: (voiceNote: Omit<VoiceNote, 'id' | 'createdAt'> & { id?: string }) => VoiceNote;
  deleteVoiceNote: (id: string) => void;

  // Categories Actions
  addCategory: (category: Omit<Category, 'id'>) => Category;
  deleteCategory: (id: string) => void;

  // Folders Actions
  addFolder: (folder: Omit<Folder, 'id'>) => Folder;
  deleteFolder: (id: string) => void;

  // Revision Actions
  markAsRevised: (noteId: string, rating: 'easy' | 'medium' | 'hard') => void;

  // Gamification Actions
  addCoins: (amount: number) => void;
  earnAchievement: (id: string) => void;
  setWeeklyChallenge: (challenge: WeeklyChallenge | null) => void;
  checkAndResetDaily: () => void;

  // Sync / App UI State Actions
  setOfflineStatus: (isOffline: boolean) => void;
  setActiveNoteId: (id: string | null) => void;
  setActiveFolderId: (id: string | null) => void;
  setActiveCategoryId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setActiveAiTool: (tool: string | null) => void;

  // Storage health action
  setPersistenceError: (hasError: boolean) => void;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-physics', name: 'Physics', color: '#3B82F6' },
  { id: 'cat-chemistry', name: 'Chemistry', color: '#10B981' },
  { id: 'cat-maths', name: 'Maths', color: '#F59E0B' },
  { id: 'cat-biology', name: 'Biology', color: '#EC4899' },
  { id: 'cat-computer', name: 'Computer Science', color: '#8B5CF6' },
  { id: 'cat-english', name: 'English', color: '#EF4444' },
  { id: 'cat-hindi', name: 'Hindi', color: '#F97316' },
  { id: 'cat-history', name: 'History', color: '#14B8A6' },
  { id: 'cat-geography', name: 'Geography', color: '#84CC16' },
  { id: 'cat-political', name: 'Political Science', color: '#06B6D4' },
  { id: 'cat-economics', name: 'Economics', color: '#D946EF' },
  { id: 'cat-commerce', name: 'Commerce', color: '#0EA5E9' },
  { id: 'cat-accounting', name: 'Accounting', color: '#6366F1' },
  { id: 'cat-medical', name: 'Medical Science', color: '#EC4899' },
  { id: 'cat-engineering', name: 'Engineering', color: '#F59E0B' },
  { id: 'cat-arts', name: 'Arts & Humanities', color: '#A855F7' },
  { id: 'cat-law', name: 'Law', color: '#DC2626' },
  { id: 'cat-management', name: 'Management', color: '#2563EB' },
  { id: 'cat-psychology', name: 'Psychology', color: '#DB2777' },
  { id: 'cat-sociology', name: 'Sociology', color: '#7C3AED' },
  { id: 'cat-philosophy', name: 'Philosophy', color: '#9333EA' },
  { id: 'cat-education', name: 'Education', color: '#0891B2' },
  { id: 'cat-environment', name: 'Environmental Science', color: '#059669' },
  { id: 'cat-general', name: 'General Knowledge', color: '#78716C' },
];

// Showcased persistence key prefix. Authenticated users store under
// `studysnap-store:${clerkUserId}` so accounts stay isolated.
const STORE_BASE_KEY = 'studysnap-store';
let activeStoreUserId: string | null = null;

type SetStateFn = StoreApi<AppState>['setState'];

function makeInitialState(set: SetStateFn): AppState {
  return {
    theme: 'light',
    user: {
      name: 'Student',
      college: '',
      field: '',
      semester: '',
      studyGoals: 'Complete my daily study goals and revise consistently!',
      streakCount: 1,
      lastActiveDate: dateKey(),
    },
    notes: [],
    voiceNotes: [],
    categories: DEFAULT_CATEGORIES,
    folders: [],
    revisionLogs: [],
    coins: 0,
    earnedAchievements: [],
    weeklyChallenge: null,
    dailyGoal: DAILY_GOAL,
    dailyProgress: 0,
    lastDailyReset: dateKey(),
    isOffline: false,
    activeNoteId: null,
    activeFolderId: null,
    activeCategoryId: null,
    searchQuery: '',
    activeAiTool: null,
    persistenceError: false,

    toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

    updateProfile: (updates) => set((state) => ({
      user: { ...state.user, ...updates, name: updates.name || state.user.name }
    })),
    syncProfileNameFromClerk: (fullName) => set((state) => {
      if (!fullName || !fullName.trim()) return {};
      const name = fullName.trim();
      // Respect profile names the user has already set; only adopt Clerk's
      // name when our own is still the default placeholder.
      if (state.user.name && state.user.name !== 'Student') return {};
      return { user: { ...state.user, name } };
    }),
    incrementStreak: () => set((state) => {
      const today = dateKey();
      const lastActive = state.user.lastActiveDate;

      if (lastActive === today) {
        return {}; // Already incremented today
      }

      let newStreak = state.user.streakCount;
      if (lastActive) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = dateKey(yesterday);

        if (lastActive === yesterdayStr) {
          newStreak += 1;
        } else {
          newStreak = 1; // Streak broken, reset to 1
        }
      } else {
        newStreak = 1; // First day
      }

      return {
        user: {
          ...state.user,
          streakCount: newStreak,
          lastActiveDate: today,
        }
      };
    }),

    addNote: (noteData) => {
      const newNote: Note = {
        id: noteData.id || crypto.randomUUID(),
        title: noteData.title,
        content: noteData.content,
        tags: noteData.tags || [],
        isPinned: noteData.isPinned || false,
        isFavorite: noteData.isFavorite || false,
        pinLock: noteData.pinLock || null,
        categoryId: noteData.categoryId || null,
        folderId: noteData.folderId || null,
        lastRevisedAt: noteData.lastRevisedAt || null,
        nextRevisionAt: noteData.nextRevisionAt || null,
        revisionStreak: noteData.revisionStreak || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set((state) => {
        const today = dateKey();
        const isNewDay = state.lastDailyReset !== today;
        return {
          notes: [newNote, ...state.notes],
          dailyProgress: isNewDay ? 1 : state.dailyProgress + 1,
          lastDailyReset: today,
        };
      });
      return newNote;
    },
    updateNote: (id, updates) => set((state) => ({
      notes: state.notes.map((n) => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n)
    })),
    deleteNote: (id) => set((state) => ({
      notes: state.notes.filter((n) => n.id !== id),
      activeNoteId: state.activeNoteId === id ? null : state.activeNoteId
    })),

    addVoiceNote: (voiceNoteData) => {
      const newVoiceNote: VoiceNote = {
        id: voiceNoteData.id || crypto.randomUUID(),
        noteId: voiceNoteData.noteId,
        audioUrl: voiceNoteData.audioUrl,
        duration: voiceNoteData.duration,
        transcript: voiceNoteData.transcript || null,
        createdAt: new Date().toISOString(),
      };
      set((state) => {
        const today = dateKey();
        const isNewDay = state.lastDailyReset !== today;
        return {
          voiceNotes: [newVoiceNote, ...state.voiceNotes],
          dailyProgress: isNewDay ? 1 : state.dailyProgress + 1,
          lastDailyReset: today,
        };
      });
      return newVoiceNote;
    },
    deleteVoiceNote: (id) => set((state) => ({
      voiceNotes: state.voiceNotes.filter((vn) => vn.id !== id)
    })),

    addCategory: (categoryData) => {
      const newCategory: Category = {
        id: crypto.randomUUID(),
        ...categoryData,
      };
      set((state) => ({ categories: [...state.categories, newCategory] }));
      return newCategory;
    },
    deleteCategory: (id) => set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
      notes: state.notes.map((n) => n.categoryId === id ? { ...n, categoryId: null } : n),
      activeCategoryId: state.activeCategoryId === id ? null : state.activeCategoryId
    })),

    addFolder: (folderData) => {
      const newFolder: Folder = {
        id: crypto.randomUUID(),
        ...folderData,
      };
      set((state) => ({ folders: [...state.folders, newFolder] }));
      return newFolder;
    },
    deleteFolder: (id) => set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
      notes: state.notes.filter((n) => n.folderId !== id), // cascade notes inside folders
      activeFolderId: state.activeFolderId === id ? null : state.activeFolderId
    })),

    markAsRevised: (noteId, rating) => set((state) => {
      const today = new Date();

      const nextRev = new Date();
      nextRev.setDate(today.getDate() + REVISION_INTERVAL_DAYS[rating]);

      const newLog: RevisionLog = {
        id: crypto.randomUUID(),
        noteId,
        revisedAt: today.toISOString(),
        rating,
        nextScheduledAt: nextRev.toISOString(),
      };

      const updatedNotes = state.notes.map((n) => {
        if (n.id === noteId) {
          return {
            ...n,
            lastRevisedAt: today.toISOString(),
            nextRevisionAt: nextRev.toISOString(),
            revisionStreak: n.revisionStreak + 1,
          };
        }
        return n;
      });

      const dayKey = dateKey();
      const isNewDay = state.lastDailyReset !== dayKey;

      return {
        revisionLogs: [newLog, ...state.revisionLogs],
        notes: updatedNotes,
        dailyProgress: isNewDay ? 1 : state.dailyProgress + 1,
        lastDailyReset: dayKey,
      };
    }),

    // Gamification Actions
    addCoins: (amount) => set((state) => ({ coins: state.coins + amount })),
    earnAchievement: (id) => set((state) => ({
      earnedAchievements: state.earnedAchievements.includes(id) ? state.earnedAchievements : [...state.earnedAchievements, id]
    })),
    setWeeklyChallenge: (challenge) => set({ weeklyChallenge: challenge }),
    checkAndResetDaily: () => set((state) => {
      const today = dateKey();
      if (state.lastDailyReset !== today) {
        return { dailyProgress: 0, lastDailyReset: today };
      }
      return state;
    }),

    setOfflineStatus: (isOffline) => set({ isOffline }),
    setActiveNoteId: (id) => set({ activeNoteId: id }),
    setActiveFolderId: (id) => set({ activeFolderId: id, activeCategoryId: null }), // filter priority folder
    setActiveCategoryId: (id) => set({ activeCategoryId: id, activeFolderId: null }), // filter priority category
    setSearchQuery: (query) => set({ searchQuery: query }),
    setActiveAiTool: (tool) => set({ activeAiTool: tool }),
    setPersistenceError: (hasError) => set((state) => (state.persistenceError === hasError ? state : { persistenceError: hasError })),
  };
}

const userScopedStorage: StateStorage & {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
} = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null;
    const key = activeStoreUserId ? `${name}:${activeStoreUserId}` : name;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return;
    const key = activeStoreUserId ? `${name}:${activeStoreUserId}` : name;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Surface storage failures (e.g. quota exceeded) instead of crashing.
      try {
        useStore.getState().setPersistenceError(true);
      } catch {
        // store not ready yet — ignore
      }
    }
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return;
    const key = activeStoreUserId ? `${name}:${activeStoreUserId}` : name;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export const useStore = create<AppState>()(
  persist(
    (set) => makeInitialState(set),
    {
      name: STORE_BASE_KEY,
      storage: createJSONStorage(() => userScopedStorage),
      partialize: (state) => ({
        theme: state.theme,
        user: state.user,
        notes: state.notes,
        voiceNotes: state.voiceNotes,
        categories: state.categories,
        folders: state.folders,
        revisionLogs: state.revisionLogs,
        coins: state.coins,
        earnedAchievements: state.earnedAchievements,
        weeklyChallenge: state.weeklyChallenge,
        dailyGoal: state.dailyGoal,
        dailyProgress: state.dailyProgress,
        lastDailyReset: state.lastDailyReset,
      }),
    }
  )
);

/**
 * Switches the persisted store to the given Clerk user (or back to the
 * anonymous/default scope when `clerkUserId` is null).
 *
 * - Resets the user-owned data to defaults before loading the target key so a
 *   previous user's data can never briefly flash for the next user.
 * - Never deletes data belonging to other users (or the anonymous store).
 */
export function switchStoreScopeForUser(clerkUserId: string | null) {
  if (clerkUserId === activeStoreUserId) return;
  activeStoreUserId = clerkUserId;
  const key = clerkUserId ? `${STORE_BASE_KEY}:${clerkUserId}` : STORE_BASE_KEY;

  let persisted: Partial<AppState> = {};
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: Partial<AppState> };
      if (parsed && typeof parsed.state === 'object' && parsed.state) {
        persisted = parsed.state;
      }
    }
  } catch {
    persisted = {};
  }

  useStore.setState({
    ...scopedDefaults(),
    ...persisted,
    // Non-persisted UI state is intentionally reset so the previous account's
    // navigation state never leaks into the next account.
    activeNoteId: null,
    activeFolderId: null,
    activeCategoryId: null,
    searchQuery: '',
    activeAiTool: null,
  });
}

/** Fresh default values for every user-scoped field in the store. */
function scopedDefaults(): Partial<AppState> {
  const today = dateKey();
  return {
    theme: 'light',
    user: {
      name: 'Student',
      college: '',
      field: '',
      semester: '',
      studyGoals: 'Complete my daily study goals and revise consistently!',
      streakCount: 1,
      lastActiveDate: today,
    },
    notes: [],
    voiceNotes: [],
    categories: DEFAULT_CATEGORIES,
    folders: [],
    revisionLogs: [],
    coins: 0,
    earnedAchievements: [],
    weeklyChallenge: null,
    dailyGoal: DAILY_GOAL,
    dailyProgress: 0,
    lastDailyReset: today,
  };
}

/** Returns the store scope key the app is currently persisting under. */
export function getStoreScopeKey(): string {
  return activeStoreUserId ? `${STORE_BASE_KEY}:${activeStoreUserId}` : STORE_BASE_KEY;
}