import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { doc, setDoc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { auth, db } from '@/config/firebase';

export type GroceryItem = {
  id: string;
  name: string;
  checked: boolean;
  addedAt: Date;
};

type GroceryContextType = {
  groceryItems: GroceryItem[];
  addGroceryItem: (ingredient: string) => void;
  removeGroceryItem: (id: string) => void;
  removeGroceryItemByName: (name: string) => void;
  toggleGroceryItem: (id: string) => void;
  clearCheckedItems: () => void;
  clearAllItems: () => void;
  loading: boolean;
  isLoggedIn: boolean;
  setIsLoggedIn: (value: boolean) => void;
  syncGroceryList: () => Promise<void>;
};

const ANONYMOUS_GROCERY_KEY = '@recipe_rabbit_anonymous_grocery';

const GroceryContext = createContext<GroceryContextType | undefined>(undefined);

// Helper function to safely convert to Date
const safeToDate = (dateValue: any): Date => {
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? new Date() : dateValue;
  }
  
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? new Date() : date;
  }
  
  // If it's a Firestore Timestamp
  if (dateValue && typeof dateValue.toDate === 'function') {
    try {
      return dateValue.toDate();
    } catch (error) {
      console.error('Error converting Firestore timestamp:', error);
      return new Date();
    }
  }
  
  // Default to current date if we can't parse
  return new Date();
};

export const GroceryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // Refs to prevent stale closures and manage state
  const isUpdatingFromFirestore = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const isInitialized = useRef(false);
  const firestoreUnsubscribeRef = useRef<(() => void) | null>(null);

  // Load grocery items from AsyncStorage
  const loadAnonymousGroceryList = useCallback(async (): Promise<GroceryItem[]> => {
    try {
      const storedGrocery = await AsyncStorage.getItem(ANONYMOUS_GROCERY_KEY);
      if (storedGrocery) {
        const parsedItems = JSON.parse(storedGrocery);
        // Convert date strings back to Date objects safely
        const itemsWithDates = parsedItems.map((item: any) => ({
          ...item,
          addedAt: safeToDate(item.addedAt)
        }));
        return itemsWithDates;
      }
      return [];
    } catch (error) {
      console.error('Error loading grocery list from AsyncStorage:', error);
      return [];
    }
  }, []);

  // Cleanup function to properly dispose of listeners and timeouts
  const cleanup = useCallback(() => {
    // Clear Firestore listener
    if (firestoreUnsubscribeRef.current) {
      try {
        firestoreUnsubscribeRef.current();
      } catch (error) {
        console.error('Error unsubscribing from Firestore listener:', error);
      }
      firestoreUnsubscribeRef.current = null;
    }

    // Clear save timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // Reset flags
    isUpdatingFromFirestore.current = false;
    isInitialized.current = false;
  }, []);

  const saveGroceryList = useCallback(async (updatedGrocery: GroceryItem[], immediate = false) => {
  // Clear any existing timeout
  if (saveTimeoutRef.current) {
    clearTimeout(saveTimeoutRef.current);
  }

    // Validate all dates before saving
  const validatedGrocery = updatedGrocery.map(item => ({
    ...item,
    addedAt: safeToDate(item.addedAt)
  }));

  console.log('saveGroceryList called with items:', validatedGrocery.length);

  const performSave = async () => {
    try {
      const currentUserId = currentUserIdRef.current;
      
      // Only save to Firestore if user is logged in and we're not updating from Firestore
      if (currentUserId && auth.currentUser && !isUpdatingFromFirestore.current) {
        const userDocRef = doc(db, 'users', currentUserId);
        
        // Set flag to prevent listener conflicts
        isUpdatingFromFirestore.current = true;
        console.log('Saving to Firestore for user:', currentUserId);
        
        try {
          // Always use setDoc with merge to handle both create and update cases
          await setDoc(userDocRef, { groceryList: validatedGrocery }, { merge: true });
          console.log('Successfully saved to Firestore');
        } finally {
          // Always reset the flag after a short delay
          setTimeout(() => {
            isUpdatingFromFirestore.current = false;
            console.log('Reset isUpdatingFromFirestore flag');
          }, 100);
        }
      } else if (!currentUserId) {
        // Save to AsyncStorage for anonymous users
        await AsyncStorage.setItem(ANONYMOUS_GROCERY_KEY, JSON.stringify(validatedGrocery));
        console.log('Saved to AsyncStorage');
      }
    } catch (error) {
      console.error('Error saving grocery list:', error);
      isUpdatingFromFirestore.current = false;
      
      // Only show error if user is still logged in
      if (auth.currentUser) {
        Alert.alert(
          'Save Error',
          'There was an issue saving your grocery list. Your changes may not be synced. Please check your connection and try again.',
          [
            {
              text: 'Retry',
              onPress: () => saveGroceryList(updatedGrocery, immediate)
            },
            {
              text: 'OK',
              style: 'cancel'
            }
          ]
        );
      }
    }
  };

  if (immediate) {
    // Save immediately for bulk operations
    await performSave();
  } else {
    // Set a new timeout to batch updates
    saveTimeoutRef.current = setTimeout(performSave, 300);
  }
}, []);

  const setupGroceryListener = useCallback((uid: string) => {
  if (!uid) return null;
  
  const userDocRef = doc(db, 'users', uid);
  
  const unsubscribe = onSnapshot(userDocRef, 
    async (docSnap) => {
      console.log('Firestore listener triggered');
      console.log('isUpdatingFromFirestore:', isUpdatingFromFirestore.current);
      
      // Don't update state if we're currently updating Firestore
      if (isUpdatingFromFirestore.current) {
        console.log('Skipping listener update - currently updating Firestore');
        return;
      }

      // Check if user is still logged in before processing
      if (!auth.currentUser || auth.currentUser.uid !== uid) {
        console.log('User not logged in or UID mismatch - skipping listener update');
        return;
      }

      if (docSnap.exists() && docSnap.data().groceryList) {
        const firestoreGrocery = docSnap.data().groceryList;
        console.log('Received grocery list from Firestore:', firestoreGrocery.length, 'items');
        
        // Convert date strings back to Date objects safely
        const itemsWithDates = firestoreGrocery.map((item: any) => ({
          ...item,
          addedAt: safeToDate(item.addedAt)
        }));
        
        console.log('Setting grocery items from Firestore');
        setGroceryItems(itemsWithDates);
        setLoading(false);
      } else if (!isInitialized.current) {
        // Only initialize for new users on first load
        console.log('Initializing new user grocery list');
        isInitialized.current = true;
        
        // Check if we have anonymous grocery items to migrate
        try {
          const anonymousItems = await loadAnonymousGroceryList();
          
          // Create user document with grocery list
          isUpdatingFromFirestore.current = true;
          try {
            await setDoc(userDocRef, { groceryList: anonymousItems }, { merge: true });
            setGroceryItems(anonymousItems);
            
            // Clear anonymous grocery list after migration
            if (anonymousItems.length > 0) {
              await AsyncStorage.removeItem(ANONYMOUS_GROCERY_KEY);
            }
          } finally {
            setTimeout(() => {
              isUpdatingFromFirestore.current = false;
            }, 100);
          }
        } catch (error) {
          console.error('Error initializing grocery list:', error);
          isUpdatingFromFirestore.current = true;
          try {
            await setDoc(userDocRef, { groceryList: [] }, { merge: true });
            setGroceryItems([]);
          } catch (err) {
            console.error('Error creating user document:', err);
          } finally {
            setTimeout(() => {
              isUpdatingFromFirestore.current = false;
            }, 100);
          }
        }
        setLoading(false);
      }
    }, 
    (error) => {
      console.error('Error setting up grocery list listener:', error);
      
      // Only show alert if user is still logged in
      if (auth.currentUser) {
        Alert.alert(
          'Connection Error',
          'There was an issue connecting to your grocery list. Some features may not work properly.'
        );
      }
      setLoading(false);
    }
  );

  return unsubscribe;
}, [loadAnonymousGroceryList]);


  // Listen for auth state changes
  useEffect(() => {
    setLoading(true);
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Always cleanup previous state first
      cleanup();

      if (user) {
        setUserId(user.uid);
        currentUserIdRef.current = user.uid;
        setIsLoggedIn(true);
        
        // Set up new listener for grocery list
        const unsubscribeFirestore = setupGroceryListener(user.uid);
        if (unsubscribeFirestore) {
          firestoreUnsubscribeRef.current = unsubscribeFirestore;
        }
      } else {
        setUserId(null);
        currentUserIdRef.current = null;
        setIsLoggedIn(false);
        
        // Load grocery list from anonymous local storage
        const anonymousItems = await loadAnonymousGroceryList();
        setGroceryItems(anonymousItems);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      cleanup();
    };
  }, [loadAnonymousGroceryList, setupGroceryListener, cleanup]);

  const addGroceryItem = useCallback((ingredient: string) => {
    if (!ingredient || !ingredient.trim()) {
      console.warn('Cannot add empty ingredient');
      return;
    }

    setGroceryItems(currentItems => {
      // Check if ingredient already exists
      const existingItem = currentItems.find(item => 
        item.name.toLowerCase().trim() === ingredient.toLowerCase().trim()
      );
      
      if (existingItem) {
        // If item exists but is checked, uncheck it to make it active again
        if (existingItem.checked) {
          const updatedItems = currentItems.map(item =>
            item.id === existingItem.id ? { ...item, checked: false } : item
          );
          saveGroceryList(updatedItems);
          return updatedItems;
        }
        return currentItems; // Item already exists and is not checked
      }

      const newItem: GroceryItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: ingredient.trim(),
        checked: false,
        addedAt: new Date() // Always use current date for new items
      };

      const updatedGrocery = [...currentItems, newItem];
      saveGroceryList(updatedGrocery);
      return updatedGrocery;
    });
  }, [saveGroceryList]);

  const removeGroceryItem = useCallback((id: string) => {
    setGroceryItems(currentItems => {
      const updatedGrocery = currentItems.filter((item) => item.id !== id);
      saveGroceryList(updatedGrocery);
      return updatedGrocery;
    });
  }, [saveGroceryList]);

  // New function to remove grocery item by name
  const removeGroceryItemByName = useCallback((name: string) => {
    setGroceryItems(currentItems => {
      const updatedGrocery = currentItems.filter(item => 
        item.name.toLowerCase().trim() !== name.toLowerCase().trim()
      );
      saveGroceryList(updatedGrocery);
      return updatedGrocery;
    });
  }, [saveGroceryList]);

  // Debug version of toggleGroceryItem
  const toggleGroceryItem = useCallback((id: string) => {
    console.log('Toggle item with ID:', id);
    setGroceryItems(currentItems => {
      const item = currentItems.find(item => item.id === id);
      console.log('Item before toggle:', item);
      
      const updatedGrocery = currentItems.map(item =>
        item.id === id ? { ...item, checked: !item.checked } : item
      );
      
      const updatedItem = updatedGrocery.find(item => item.id === id);
      console.log('Item after toggle:', updatedItem);
      
      saveGroceryList(updatedGrocery);
      return updatedGrocery;
    });
  }, [saveGroceryList]);

const clearCheckedItems = useCallback(async () => {
  console.log('clearCheckedItems called');
  setGroceryItems(currentItems => {
    console.log('Current items before filter:', currentItems.length);
    const checkedItems = currentItems.filter(item => item.checked);
    const uncheckedItems = currentItems.filter(item => !item.checked);
    console.log('Checked items to remove:', checkedItems.length);
    console.log('Unchecked items to keep:', uncheckedItems.length);
    
    // Filter out checked items (keep only unchecked items)
    const updatedGrocery = currentItems.filter(item => !item.checked);
    console.log('Updated grocery list length:', updatedGrocery.length);
    
    // Save immediately for bulk operations to ensure it completes
    saveGroceryList(updatedGrocery, true);
    return updatedGrocery;
  });
  
  setTimeout(() => {
    isUpdatingFromFirestore.current = false;
    console.log('Reset isUpdatingFromFirestore flag after clearCheckedItems');
  }, 500);
}, [saveGroceryList]);

  const clearAllItems = useCallback(() => {
    setGroceryItems([]);
    // Save immediately for bulk operations to ensure it completes
    saveGroceryList([], true);
  }, [saveGroceryList]);

  // Sync grocery list from AsyncStorage to Firestore after login
  const syncGroceryList = useCallback(async () => {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.log('No user found during syncGroceryList');
      return;
    }
    
    const currentUserId = currentUser.uid;
    if (!currentUserId) {
      console.log('No user ID available during syncGroceryList');
      return;
    }
    
    try {
      setLoading(true);
      // Get existing grocery list from Firestore
      const userDocRef = doc(db, 'users', currentUserId);
      const docSnap = await getDoc(userDocRef);
      
      let firestoreGrocery: GroceryItem[] = [];
      if (docSnap.exists() && docSnap.data().groceryList) {
        const groceryData = docSnap.data().groceryList;
        firestoreGrocery = groceryData.map((item: any) => ({
          ...item,
          addedAt: safeToDate(item.addedAt)
        }));
      }
      
      // Get anonymous grocery list that may need to be synced
      const anonymousGrocery = await loadAnonymousGroceryList();
      
      // If no anonymous grocery and user already has Firestore grocery, nothing to do
      if (anonymousGrocery.length === 0 && firestoreGrocery.length > 0) {
        setGroceryItems(firestoreGrocery);
        setLoading(false);
        return;
      }
      
      // Merge grocery lists (giving priority to Firestore)
      const mergedGrocery = [...firestoreGrocery];
      
      // Add anonymous grocery items that don't exist in Firestore
      if (anonymousGrocery.length > 0) {
        anonymousGrocery.forEach(localItem => {
          if (!mergedGrocery.some(item => 
            item.name.toLowerCase().trim() === localItem.name.toLowerCase().trim()
          )) {
            mergedGrocery.push(localItem);
          }
        });
      }
      
      // Save merged grocery list
      setGroceryItems(mergedGrocery);
      isUpdatingFromFirestore.current = true;
      try {
        await setDoc(userDocRef, { groceryList: mergedGrocery }, { merge: true });
      } finally {
        setTimeout(() => {
          isUpdatingFromFirestore.current = false;
        }, 100);
      }
      
      // Clear anonymous grocery list after successful sync
      if (anonymousGrocery.length > 0) {
        await AsyncStorage.removeItem(ANONYMOUS_GROCERY_KEY);
        Alert.alert('Success', 'Your grocery list has been synced successfully!');
      }
    } catch (error) {
      console.error('Error syncing grocery list:', error);
      isUpdatingFromFirestore.current = false;
      Alert.alert(
        'Sync Error',
        'There was a problem syncing your grocery list. Please try again later.'
      );
    } finally {
      setLoading(false);
    }
  }, [loadAnonymousGroceryList]);

  return (
    <GroceryContext.Provider
      value={{ 
        groceryItems,
        addGroceryItem,
        removeGroceryItem,
        removeGroceryItemByName,
        toggleGroceryItem,
        clearCheckedItems,
        clearAllItems,
        loading,
        isLoggedIn,
        setIsLoggedIn,
        syncGroceryList
      }}
    >
      {children}
    </GroceryContext.Provider>
  );
};

export const useGrocery = () => {
  const context = useContext(GroceryContext);
  if (!context) {
    throw new Error("useGrocery must be used within a GroceryProvider");
  }
  return context;
};