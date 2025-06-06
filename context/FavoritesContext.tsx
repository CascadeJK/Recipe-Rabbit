import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { auth, db } from '@/config/firebase';

export type Recipe = {
  id: number;
  name: string;
  details: string;
  image: string;
};

type FavoritesContextType = {
  favorites: Recipe[];
  addFavorite: (recipe: Recipe) => void;
  removeFavorite: (id: number) => void;
  isFavorited: (id: number) => boolean;
  toggleFavorite: (recipe: Recipe) => void;
  loading: boolean;
  isLoggedIn: boolean;
  setIsLoggedIn: (value: boolean) => void;
  syncFavorites: () => Promise<void>;
};

const ANONYMOUS_STORAGE_KEY = '@recipe_rabbit_anonymous_favorites';

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // Use refs to track listeners and prevent memory leaks
  const firestoreListenerRef = useRef<(() => void) | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const isUpdatingFromFirestore = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load favorites from AsyncStorage
  const loadAnonymousFavorites = useCallback(async (): Promise<Recipe[]> => {
    try {
      const storedFavorites = await AsyncStorage.getItem(ANONYMOUS_STORAGE_KEY);
      if (storedFavorites) {
        return JSON.parse(storedFavorites);
      }
      return [];
    } catch (error) {
      console.error('Error loading favorites from AsyncStorage:', error);
      return [];
    }
  }, []);

  // Cleanup function to properly remove listeners
  const cleanupFirestoreListener = useCallback(() => {
    if (firestoreListenerRef.current) {
      try {
        firestoreListenerRef.current();
      } catch (error) {
        console.error('Error cleaning up Firestore listener:', error);
      }
      firestoreListenerRef.current = null;
    }
  }, []);

  // Set up real-time listener for favorites with better error handling
  const setupFavoritesListener = useCallback((uid: string) => {
    if (!uid || !auth.currentUser) return () => {};
    
    const userDocRef = doc(db, 'users', uid);
    
    const unsubscribe = onSnapshot(userDocRef, 
      async (docSnap) => {
        // Double-check that user is still authenticated
        if (!auth.currentUser || auth.currentUser.uid !== uid) {
          console.log('User auth state changed during listener callback, ignoring');
          return;
        }

        // Don't update if we're currently saving to prevent conflicts
        if (isUpdatingFromFirestore.current) {
          return;
        }

        if (docSnap.exists() && docSnap.data().favorites) {
          const firestoreFavorites = docSnap.data().favorites;
          setFavorites(firestoreFavorites);
        } else {
          // For new users: initialize with anonymous favorites if they exist
          try {
            const anonymousFavorites = await loadAnonymousFavorites();
            
            // Set updating flag to prevent listener conflicts
            isUpdatingFromFirestore.current = true;
            
            // Create user document with migrated favorites
            await setDoc(userDocRef, { favorites: anonymousFavorites }, { merge: true });
            setFavorites(anonymousFavorites);
            
            // Clear anonymous favorites after migration
            if (anonymousFavorites.length > 0) {
              await AsyncStorage.removeItem(ANONYMOUS_STORAGE_KEY);
            }
          } catch (error) {
            console.error('Error initializing favorites:', error);
            // Ensure we still create the document
            try {
              await setDoc(userDocRef, { favorites: [] }, { merge: true });
            } catch (err) {
              console.error('Error creating user document:', err);
            }
            setFavorites([]);
          } finally {
            // Reset flag after a delay
            setTimeout(() => {
              isUpdatingFromFirestore.current = false;
            }, 100);
          }
        }
        setLoading(false);
      }, 
      (error) => {
        console.error('Error setting up favorites listener:', error);
        
        // Only show error if user is still authenticated (not during logout)
        if (auth.currentUser && currentUserIdRef.current) {
          console.warn('Firestore listener error while user is authenticated:', error);
        }
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [loadAnonymousFavorites]);

  // Save favorites with debouncing and proper state management
  const saveFavorites = useCallback(async (updatedFavorites: Recipe[]) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce saves to prevent rapid-fire updates
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const currentUserId = currentUserIdRef.current;
        
        if (currentUserId && auth.currentUser && !isUpdatingFromFirestore.current) {
          // Set flag to prevent listener conflicts
          isUpdatingFromFirestore.current = true;
          
          const userDocRef = doc(db, 'users', currentUserId);
          await setDoc(userDocRef, { favorites: updatedFavorites }, { merge: true });
          
          // Reset flag after a delay
          setTimeout(() => {
            isUpdatingFromFirestore.current = false;
          }, 100);
        } else if (!currentUserId) {
          // Save to anonymous storage for non-logged-in users
          await AsyncStorage.setItem(ANONYMOUS_STORAGE_KEY, JSON.stringify(updatedFavorites));
        }
      } catch (error) {
        console.error('Error saving favorites:', error);
        isUpdatingFromFirestore.current = false;
        
        // Only show alert if user is still authenticated
        if (auth.currentUser) {
          Alert.alert(
            'Error Saving Favorites',
            'There was an issue saving your favorites. Please try again.'
          );
        }
      }
    }, 300);
  }, []);

  // Listen for auth state changes with improved cleanup
  useEffect(() => {
    setLoading(true);
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Clean up previous listener immediately
      cleanupFirestoreListener();
      
      // Clear any pending saves
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Reset flags
      isUpdatingFromFirestore.current = false;

      if (user) {
        setUserId(user.uid);
        currentUserIdRef.current = user.uid;
        setIsLoggedIn(true);
        
        // Set up new listener
        const unsubscribeFirestore = setupFavoritesListener(user.uid);
        firestoreListenerRef.current = unsubscribeFirestore;
      } else {
        setUserId(null);
        currentUserIdRef.current = null;
        setIsLoggedIn(false);
        
        // Load anonymous favorites when logged out
        try {
          const anonymousFavorites = await loadAnonymousFavorites();
          setFavorites(anonymousFavorites);
        } catch (error) {
          console.error('Error loading anonymous favorites:', error);
          setFavorites([]);
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      cleanupFirestoreListener();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [setupFavoritesListener, cleanupFirestoreListener, loadAnonymousFavorites]);

  const addFavorite = useCallback((recipe: Recipe) => {
    setFavorites(currentFavorites => {
      // Check if recipe already exists to prevent duplicates
      if (currentFavorites.some(fav => fav.id === recipe.id)) {
        return currentFavorites;
      }

      const updatedFavorites = [...currentFavorites, recipe];
      saveFavorites(updatedFavorites);
      return updatedFavorites;
    });
  }, [saveFavorites]);

  const removeFavorite = useCallback((id: number) => {
    setFavorites(currentFavorites => {
      const updatedFavorites = currentFavorites.filter((r) => r.id !== id);
      saveFavorites(updatedFavorites);
      return updatedFavorites;
    });
  }, [saveFavorites]);

  const toggleFavorite = useCallback((recipe: Recipe) => {
    setFavorites(currentFavorites => {
      const isAlreadyFavorite = currentFavorites.some(fav => fav.id === recipe.id);
      let updatedFavorites: Recipe[];
      
      if (isAlreadyFavorite) {
        updatedFavorites = currentFavorites.filter((r) => r.id !== recipe.id);
      } else {
        updatedFavorites = [...currentFavorites, recipe];
      }
      
      saveFavorites(updatedFavorites);
      return updatedFavorites;
    });
  }, [saveFavorites]);

  const isFavorited = useCallback((id: number) => {
    return favorites.some((r) => r.id === id);
  }, [favorites]);
  
  // Sync favorites from AsyncStorage to Firestore after login
  const syncFavorites = useCallback(async () => {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.log('No user found during syncFavorites');
      return;
    }
    
    const currentUserId = currentUser.uid;
    if (!currentUserId) {
      console.log('No user ID available during syncFavorites');
      return;
    }
    
    try {
      setLoading(true);
      
      // Get existing favorites from Firestore
      const userDocRef = doc(db, 'users', currentUserId);
      const docSnap = await getDoc(userDocRef);
      
      let firestoreFavorites: Recipe[] = [];
      if (docSnap.exists() && docSnap.data().favorites) {
        firestoreFavorites = docSnap.data().favorites;
      }
      
      // Get anonymous favorites that may need to be synced
      const anonymousFavorites = await loadAnonymousFavorites();
      
      // If no anonymous favorites and user already has Firestore favorites, nothing to do
      if (anonymousFavorites.length === 0 && firestoreFavorites.length > 0) {
        setFavorites(firestoreFavorites);
        setLoading(false);
        return;
      }
      
      // Merge favorites (giving priority to Firestore)
      const mergedFavorites = [...firestoreFavorites];
      
      // Add anonymous favorites that don't exist in Firestore
      if (anonymousFavorites.length > 0) {
        anonymousFavorites.forEach(localFav => {
          if (!mergedFavorites.some(fav => fav.id === localFav.id)) {
            mergedFavorites.push(localFav);
          }
        });
      }
      
      // Save merged favorites
      setFavorites(mergedFavorites);
      
      isUpdatingFromFirestore.current = true;
      await setDoc(userDocRef, { favorites: mergedFavorites }, { merge: true });
      
      // Reset flag after delay
      setTimeout(() => {
        isUpdatingFromFirestore.current = false;
      }, 100);
      
      // Clear anonymous favorites after successful sync
      if (anonymousFavorites.length > 0) {
        await AsyncStorage.removeItem(ANONYMOUS_STORAGE_KEY);
        Alert.alert('Success', 'Your favorites have been synced successfully!');
      }
    } catch (error) {
      console.error('Error syncing favorites:', error);
      isUpdatingFromFirestore.current = false;
      Alert.alert(
        'Sync Error',
        'There was a problem syncing your favorites. Please try again later.'
      );
    } finally {
      setLoading(false);
    }
  }, [loadAnonymousFavorites]);

  return (
    <FavoritesContext.Provider
      value={{ 
        favorites, 
        addFavorite, 
        removeFavorite, 
        isFavorited, 
        toggleFavorite, 
        loading,
        isLoggedIn,
        setIsLoggedIn,
        syncFavorites
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
};