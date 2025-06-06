import { StyleSheet, View, ScrollView, Image, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Button, Divider } from '@rneui/themed';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { FirebaseError } from 'firebase/app';
import { auth } from '@/config/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import AntDesign from '@expo/vector-icons/AntDesign';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFavorites } from '@/context/FavoritesContext';

// Type guard for Firebase Error
function isFirebaseError(error: unknown): error is FirebaseError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const router = useRouter();
  const { setIsLoggedIn } = useFavorites();

  // Check for auth state changes
  useEffect(() => {
    if (!auth) {
      console.error('Firebase auth is not initialized');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []);

  // Handle user logout with proper cleanup and sequencing
  const handleLogout = async () => {
    if (!auth) {
      console.error('Firebase auth is not initialized');
      Alert.alert('Error', 'Authentication service is not available');
      return;
    }

    try {
      setLogoutLoading(true);
      
      // Step 1: Set isLoggedIn to false FIRST to trigger context cleanup
      console.log('Setting isLoggedIn to false...');
      setIsLoggedIn(false);
      
      // Step 2: Wait for context listeners to properly detach
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 3: Sign out from Firebase
      console.log('Signing out from Firebase...');
      await signOut(auth);
      console.log('User signed out successfully');
      
      // Step 4: Navigate to login screen
      router.replace('/');
      
    } catch (error) {
      console.error('Logout error:', error);
      
      if (isFirebaseError(error)) {
        Alert.alert('Logout Failed', error.message || 'Failed to log out. Please try again.');
      } else {
        Alert.alert('Logout Failed', 'An unknown error occurred. Please try again later.');
      }
    } finally {
      setLogoutLoading(false);
    }
  };

  // Handle navigation to saved recipes
  const handleSavedRecipes = () => {
    router.push('/library');
  };

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <View style={[styles.screen, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#3E1F15" />
        <ThemedText style={{ marginTop: 20 }}>Loading profile...</ThemedText>
      </View>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    router.replace('/');
    return null;
  }

  // Get user display name or email for profile
  const displayName = user.displayName || user.email?.split('@')[0] || 'User';
  const userEmail = user.email || 'No email available';
  const isEmailVerified = user.emailVerified;
  const authProvider = user.providerData[0]?.providerId || 'email';
  const isGoogleUser = authProvider.includes('google');

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Profile</ThemedText>
        </ThemedView>
        
        <ThemedView style={styles.profileContainer}>
          <View style={styles.avatarContainer}>
            {user.photoURL ? (
              <Image 
                source={{ uri: user.photoURL }} 
                style={styles.avatar} 
              />
            ) : (
              <View style={styles.defaultAvatar}>
                <ThemedText type="title">{displayName.charAt(0).toUpperCase()}</ThemedText>
              </View>
            )}
          </View>
          
          <ThemedText type="subtitle" style={styles.displayName}>
            {displayName}
          </ThemedText>
          
          <ThemedText type="default" style={styles.email}>
            {userEmail}
          </ThemedText>
          
          {!isGoogleUser && (
            <View style={styles.verificationContainer}>
              {isEmailVerified ? (
                <View style={styles.verifiedContainer}>
                  <AntDesign name="checkcircle" size={16} color="green" />
                  <ThemedText style={styles.verifiedText}>Email Verified</ThemedText>
                </View>
              ) : (
                <View style={styles.unverifiedContainer}>
                  <AntDesign name="exclamationcircle" size={16} color="orange" />
                  <ThemedText style={styles.unverifiedText}>Email Not Verified</ThemedText>
                </View>
              )}
            </View>
          )}
        </ThemedView>
        
        <Divider width={1} style={styles.divider} />
        
        <ThemedView style={styles.menuContainer}>
          
          <Button
            title="Saved Recipes"
            icon={<AntDesign name="heart" size={24} color="white" style={styles.buttonIcon} />}
            onPress={handleSavedRecipes}
            buttonStyle={styles.menuButton}
            titleStyle={styles.buttonTitle}
          />
          
          <Button
            title="Logout"
            loading={logoutLoading}
            icon={<FontAwesome name="sign-out" size={24} color="white" style={styles.buttonIcon} />}
            onPress={handleLogout}
            buttonStyle={[styles.menuButton, styles.logoutButton]}
            titleStyle={styles.buttonTitle}
          />
        </ThemedView>
        
        <ThemedView style={styles.appInfoContainer}>
          <ThemedText type="default" style={styles.appVersion}>Recipe Rabbit v1.0.0</ThemedText>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFCE0',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: 50,
  },
  profileContainer: {
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 20,
  },
  avatarContainer: {
    marginBottom: 15,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#3E1F15',
  },
  defaultAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#3E1F15',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#6B4226',
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  verificationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  verifiedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f7e6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  verifiedText: {
    color: 'green',
    marginLeft: 5,
    fontSize: 14,
  },
  unverifiedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  unverifiedText: {
    color: 'orange',
    marginLeft: 5,
    fontSize: 14,
  },
  divider: {
    marginVertical: 15,
    marginHorizontal: 20,
  },
  menuContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  menuButton: {
    backgroundColor: '#3E1F15',
    borderRadius: 10,
    marginVertical: 8,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
  },
  logoutButton: {
    backgroundColor: '#A63A3A',
    marginTop: 20,
  },
  buttonIcon: {
    marginRight: 15,
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'left', 
  },
  appInfoContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  appVersion: {
    color: '#999',
    fontSize: 14,
  },
});